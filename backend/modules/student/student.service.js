const ExcelJS = require("exceljs");
const prisma = require("../../lib/prisma");
const cascadeDelete = require("../../lib/cascadeDelete");
const { badRequest, conflict, notFound } = require("../../lib/errors");
const { balances } = require("../../lib/balance");
const { parseISODate, todayUTC } = require("../../lib/dates");
const { assessStudent } = require("../fee/assess");
const { importRowSchema } = require("./student.validation");

const IMPORT_HEADERS = [
  "registrationNumber",
  "name",
  "whatsappNumber",
  "phoneNumber",
  "email",
  "fatherName",
  "branch",
  "courseCode",
  "admissionType",
  "isHosteller",
  "studyYear",
  "academicYearLabel",
  "semesterName",
];

function duplicateStudentError(err) {
  const target = JSON.stringify(err.meta?.target || "");
  if (target.includes("enrolment")) {
    return conflict("DUPLICATE_ENROLMENT_NUMBER");
  }
  return conflict("DUPLICATE_REGISTRATION_NUMBER");
}

function shapeStudent(student) {
  const accounts = (student.feeAccounts || []).map((account) => {
    const { ledgerEntries, ...rest } = account;
    return {
      ...rest,
      ...balances(ledgerEntries),
      lines: ledgerEntries,
    };
  });
  const { feeAccounts, ...rest } = student;
  return { ...rest, accounts };
}

const studentInclude = {
  course: { select: { id: true, courseCode: true, courseName: true, lateFeePerDay: true } },
  academicYear: true,
  admissionSemester: true,
  feeAccounts: { include: { ledgerEntries: { orderBy: { id: "asc" } } } },
};

async function loadStudent(id) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: studentInclude,
  });
  if (!student) {
    throw notFound();
  }
  return shapeStudent(student);
}

async function assertYearAndSemester(academicYearId, semesterId) {
  const year = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
  if (!year) {
    throw notFound("ACADEMIC_YEAR_NOT_FOUND");
  }
  const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
  if (!semester || semester.academicYearId !== academicYearId) {
    throw notFound("SEMESTER_NOT_FOUND");
  }
}

async function createStudent(data) {
  const course = await prisma.course.findUnique({ where: { id: data.courseId } });
  if (!course) {
    throw notFound("COURSE_NOT_FOUND");
  }
  await assertYearAndSemester(data.academicYearId, data.semesterId);
  try {
    const created = await prisma.transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          registrationNumber: data.registrationNumber,
          name: data.name,
          whatsappNumber: data.whatsappNumber,
          phoneNumber: data.phoneNumber,
          email: data.email,
          fatherName: data.fatherName,
          branch: data.branch,
          courseId: data.courseId,
          academicYearId: data.academicYearId,
          admissionSemesterId: data.semesterId,
          admissionType: data.admissionType,
          isHosteller: data.isHosteller ?? false,
          studyYear: data.studyYear ?? 1,
        },
      });
      await assessStudent(tx, student, student.isHosteller ? ["ACADEMIC", "HOSTEL"] : ["ACADEMIC"]);
      return student;
    });
    return loadStudent(created.id);
  } catch (err) {
    if (err.code === "P2002") {
      throw duplicateStudentError(err);
    }
    throw err;
  }
}

async function searchStudents(q) {
  const students = await prisma.student.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { registrationNumber: { contains: q } },
            { enrolmentNumber: { contains: q } },
          ],
        }
      : {},
    orderBy: { id: "asc" },
    include: studentInclude,
  });
  return students.map((student) => ({
    ...shapeStudent(student),
    duesOutstanding: student.feeAccounts.reduce(
      (sum, account) => sum + balances(account.ledgerEntries).duesOutstanding,
      0
    ),
  }));
}

function getStudent(id) {
  return loadStudent(id);
}

async function updateStudent(id, data) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) {
    throw notFound();
  }
  if (data.enrolmentNumber) {
    const taken = await prisma.student.findFirst({
      where: { enrolmentNumber: data.enrolmentNumber, id: { not: id } },
    });
    if (taken) {
      throw conflict("DUPLICATE_ENROLMENT_NUMBER");
    }
  }

  const patch = {};
  if (data.enrolmentNumber) {
    patch.enrolmentNumber = data.enrolmentNumber;
  }
  if (data.isHosteller != null) {
    patch.isHosteller = data.isHosteller;
  }
  if (data.status) {
    patch.status = data.status;
  }
  if (data.status === "LEFT") {
    patch.leftOn = data.leftOn ? parseISODate(data.leftOn) : todayUTC();
  }

  const becameHosteller = data.isHosteller === true && !existing.isHosteller;
  try {
    await prisma.transaction(async (tx) => {
      const student = await tx.student.update({ where: { id }, data: patch });
      if (becameHosteller) {
        await assessStudent(tx, student, ["HOSTEL"]);
      }
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw duplicateStudentError(err);
    }
    throw err;
  }
  return loadStudent(id);
}

function cellText(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "object") {
    if (value.text) {
      return String(value.text).trim();
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if (value.result != null) {
      return cellText(value.result);
    }
  }
  return String(value).trim();
}

function parseBool(value) {
  const text = cellText(value).toLowerCase();
  if (["true", "1", "yes"].includes(text)) {
    return true;
  }
  if (["false", "0", "no"].includes(text)) {
    return false;
  }
  return value;
}

function parseStudyYear(value) {
  if (typeof value === "number") {
    return value;
  }
  const text = cellText(value);
  if (!/^\d+$/.test(text)) {
    return value;
  }
  return Number(text);
}

async function readSheet(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw badRequest("INVALID_SPREADSHEET", [{ path: "file", message: "file must be an xlsx workbook" }]);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw badRequest("INVALID_SPREADSHEET", [{ path: "file", message: "workbook has no sheet" }]);
  }
  const headerMap = new Map();
  sheet.getRow(1).eachCell((cell, col) => {
    headerMap.set(cellText(cell.value), col);
  });
  const missing = IMPORT_HEADERS.filter((header) => !headerMap.has(header));
  if (missing.length > 0) {
    throw badRequest("INVALID_SPREADSHEET", [
      { path: "file", message: `missing columns: ${missing.join(", ")}` },
    ]);
  }

  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const raw = {};
    let empty = true;
    for (const header of IMPORT_HEADERS) {
      const value = sheet.getRow(rowNumber).getCell(headerMap.get(header)).value;
      const text = cellText(value);
      if (text !== "") {
        empty = false;
      }
      raw[header] = text;
    }
    if (empty) {
      continue;
    }
    raw.isHosteller = parseBool(sheet.getRow(rowNumber).getCell(headerMap.get("isHosteller")).value);
    raw.studyYear = parseStudyYear(sheet.getRow(rowNumber).getCell(headerMap.get("studyYear")).value);
    rows.push({ rowNumber, raw });
  }
  if (rows.length === 0) {
    throw badRequest("INVALID_SPREADSHEET", [{ path: "file", message: "workbook has no data rows" }]);
  }
  return rows;
}

async function previewImport(file) {
  if (!file) {
    throw badRequest("FILE_REQUIRED", [{ path: "file", message: "xlsx file is required" }]);
  }
  const parsedRows = await readSheet(file.buffer);
  const seen = new Map();
  const prepared = [];

  for (const { rowNumber, raw } of parsedRows) {
    const errors = [];
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ path: issue.path.join(".") || "row", message: issue.message });
      }
      prepared.push({ rowNumber, valid: false, errors, payload: raw });
      continue;
    }

    const value = parsed.data;
    if (seen.has(value.registrationNumber)) {
      errors.push({ path: "registrationNumber", message: "duplicate registration number in file" });
    }
    seen.set(value.registrationNumber, rowNumber);

    const [course, year, existing] = await Promise.all([
      prisma.course.findUnique({ where: { courseCode: value.courseCode } }),
      prisma.academicYear.findUnique({ where: { label: value.academicYearLabel } }),
      prisma.student.findUnique({ where: { registrationNumber: value.registrationNumber } }),
    ]);
    if (!course) {
      errors.push({ path: "courseCode", message: "course not found" });
    }
    if (!year) {
      errors.push({ path: "academicYearLabel", message: "academic year not found" });
    }
    let semester = null;
    if (year) {
      semester = await prisma.semester.findUnique({
        where: { academicYearId_name: { academicYearId: year.id, name: value.semesterName } },
      });
      if (!semester) {
        errors.push({ path: "semesterName", message: "semester not found" });
      }
    }
    if (existing) {
      errors.push({ path: "registrationNumber", message: "duplicate registration number" });
    }

    prepared.push({
      rowNumber,
      valid: errors.length === 0,
      errors,
      payload:
        errors.length === 0
          ? {
              ...value,
              courseId: course.id,
              academicYearId: year.id,
              semesterId: semester.id,
            }
          : raw,
    });
  }

  const batch = await prisma.importBatch.create({
    data: {
      fileName: file.originalname || "students.xlsx",
      rows: {
        create: prepared.map((row) => ({
          rowNumber: row.rowNumber,
          valid: row.valid,
          errors: row.errors.length ? row.errors : null,
          payload: row.payload,
        })),
      },
    },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  return presentBatch(batch);
}

function presentBatch(batch) {
  return {
    id: batch.id,
    status: batch.status,
    fileName: batch.fileName,
    rows: batch.rows.map((row) => ({
      rowNumber: row.rowNumber,
      valid: row.valid,
      errors: row.errors,
      payload: row.payload,
    })),
  };
}

async function commitImport(batchId) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) {
    throw notFound();
  }
  if (batch.status === "COMMITTED") {
    throw conflict("ALREADY_COMMITTED");
  }
  if (batch.rows.some((row) => !row.valid)) {
    throw conflict("PREVIEW_HAS_ERRORS");
  }

  const students = await prisma.transaction(async (tx) => {
    const created = [];
    for (const row of batch.rows) {
      const data = row.payload;
      const student = await tx.student.create({
        data: {
          registrationNumber: data.registrationNumber,
          name: data.name,
          whatsappNumber: data.whatsappNumber,
          phoneNumber: data.phoneNumber,
          email: data.email,
          fatherName: data.fatherName,
          branch: data.branch,
          courseId: data.courseId,
          academicYearId: data.academicYearId,
          admissionSemesterId: data.semesterId,
          admissionType: data.admissionType,
          isHosteller: data.isHosteller,
          studyYear: data.studyYear,
        },
      });
      await assessStudent(tx, student, student.isHosteller ? ["ACADEMIC", "HOSTEL"] : ["ACADEMIC"]);
      created.push(student.id);
    }
    await tx.importBatch.update({ where: { id: batchId }, data: { status: "COMMITTED" } });
    return created;
  });

  return {
    batchId,
    status: "COMMITTED",
    students: await Promise.all(students.map((id) => loadStudent(id))),
  };
}

function previewStudentDelete(id) {
  return cascadeDelete.previewStudent(id);
}

function deleteStudent(id) {
  return cascadeDelete.deleteStudent(id);
}

module.exports = {
  createStudent,
  searchStudents,
  getStudent,
  updateStudent,
  previewImport,
  commitImport,
  previewStudentDelete,
  deleteStudent,
};
