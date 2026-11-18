const ExcelJS = require("exceljs");
const prisma = require("../../lib/prisma");
const { notFound } = require("../../lib/errors");
const { balances, percent } = require("../../lib/balance");
const { addDays, formatISODate, parseISODate } = require("../../lib/dates");

async function requireSemester(id) {
  const semester = await prisma.semester.findUnique({ where: { id } });
  if (!semester) {
    throw notFound("SEMESTER_NOT_FOUND");
  }
  return semester;
}

function paymentView(payment) {
  const registrationNumbers = [];
  const courseCodes = [];
  for (const allocation of payment.allocations) {
    const student = allocation.feeAccount.student;
    if (!registrationNumbers.includes(student.registrationNumber)) {
      registrationNumbers.push(student.registrationNumber);
    }
    if (!courseCodes.includes(student.course.courseCode)) {
      courseCodes.push(student.course.courseCode);
    }
  }
  return {
    id: payment.id,
    receiptNo: payment.receiptNo,
    method: payment.method,
    amount: payment.amount,
    status: payment.status,
    paidOn: payment.paidOn,
    reference: payment.reference,
    registrationNumbers,
    courseCodes,
  };
}

const paymentInclude = {
  allocations: {
    include: {
      feeAccount: {
        include: { student: { include: { course: true } } },
      },
    },
  },
};

async function paymentsReport(query) {
  const payments = await prisma.paymentAttempt.findMany({
    where: {
      status: "SUCCESS",
      paidOn: { gte: parseISODate(query.from), lte: parseISODate(query.to) },
    },
    orderBy: { id: "asc" },
    include: paymentInclude,
  });
  const rows = payments
    .filter((payment) =>
      query.courseId
        ? payment.allocations.some((allocation) => allocation.feeAccount.student.courseId === query.courseId)
        : true
    )
    .map(paymentView);
  if (query.format === "xlsx") {
    return paymentsWorkbook(rows);
  }
  return rows;
}

async function paymentsWorkbook(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("payments");
  sheet.addRow(["receiptNo", "paidOn", "method", "amount", "registrationNumbers", "courseCodes"]);
  for (const row of rows) {
    sheet.addRow([
      row.receiptNo,
      row.paidOn ? formatISODate(row.paidOn) : "",
      row.method,
      row.amount,
      row.registrationNumbers.join(","),
      row.courseCodes.join(","),
    ]);
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, rowCount: rows.length };
}

async function unpaidReport(courseId) {
  const students = await prisma.student.findMany({
    where: courseId ? { courseId } : {},
    orderBy: { id: "asc" },
    include: {
      course: true,
      feeAccounts: { include: { ledgerEntries: true } },
    },
  });
  return students
    .map((student) => ({
      id: student.id,
      registrationNumber: student.registrationNumber,
      name: student.name,
      courseId: student.courseId,
      courseCode: student.course.courseCode,
      duesOutstanding: student.feeAccounts.reduce(
        (sum, account) => sum + balances(account.ledgerEntries).duesOutstanding,
        0
      ),
    }))
    .filter((student) => student.duesOutstanding > 0);
}

async function failedPaymentsReport() {
  const payments = await prisma.paymentAttempt.findMany({
    where: { status: "FAILED" },
    orderBy: { id: "asc" },
    include: paymentInclude,
  });
  return payments.map(paymentView);
}

function studentClearance(entries, semesterId) {
  const relevant = entries
    .filter((entry) => entry.semesterId === semesterId && entry.bucket === "DUES")
    .sort((left, right) => left.id - right.id);
  let principal = 0;
  let sawAssessment = false;
  let clearedOn = null;
  for (const entry of relevant) {
    if (entry.entryType === "ASSESSMENT" && entry.direction === "INCREASE") {
      principal += entry.amount;
      sawAssessment = true;
      clearedOn = null;
    } else if (
      (entry.entryType === "PAYMENT" || entry.entryType === "ADJUSTMENT") &&
      entry.direction === "DECREASE"
    ) {
      principal -= entry.amount;
    }
    if (sawAssessment && principal <= 0) {
      clearedOn = entry.effectiveDate;
    }
  }
  return {
    assessed: sawAssessment,
    outstanding: Math.max(0, principal),
    clearedOn: principal <= 0 ? clearedOn : null,
  };
}

async function onTimeReport(semesterId) {
  const semester = await requireSemester(semesterId);
  const deadline = addDays(semester.dueDate, semester.graceDays);
  const students = await prisma.student.findMany({
    orderBy: { id: "asc" },
    include: { feeAccounts: { include: { ledgerEntries: true } } },
  });
  const rows = [];
  for (const student of students) {
    const entries = student.feeAccounts.flatMap((account) => account.ledgerEntries);
    const clearance = studentClearance(entries, semesterId);
    if (!clearance.assessed) {
      continue;
    }
    const onTime = Boolean(clearance.clearedOn) && clearance.clearedOn <= deadline && clearance.outstanding === 0;
    rows.push({
      studentId: student.id,
      registrationNumber: student.registrationNumber,
      onTime,
    });
  }
  const onTimeCount = rows.filter((row) => row.onTime).length;
  return {
    semesterId,
    assessedCount: rows.length,
    onTimeCount,
    percent: percent(onTimeCount, rows.length),
    students: rows,
  };
}

async function waiverReport(semesterId) {
  await requireSemester(semesterId);
  const entries = await prisma.ledgerEntry.findMany({
    where: { semesterId, entryType: { in: ["FINE", "WAIVER"] } },
    include: { feeAccount: true },
  });
  const fined = new Set();
  const waived = new Set();
  for (const entry of entries) {
    if (entry.entryType === "FINE") {
      fined.add(entry.feeAccount.studentId);
    }
    if (entry.entryType === "WAIVER") {
      waived.add(entry.feeAccount.studentId);
    }
  }
  return {
    semesterId,
    finedStudentCount: fined.size,
    waiverStudentCount: waived.size,
    percent: percent(waived.size, fined.size),
  };
}

function leftStudentsReport() {
  return prisma.student.findMany({
    where: { status: "LEFT" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      registrationNumber: true,
      name: true,
      courseId: true,
      status: true,
      leftOn: true,
    },
  });
}

async function fineReport(semesterId) {
  await requireSemester(semesterId);
  const entries = await prisma.ledgerEntry.findMany({
    where: { semesterId, entryType: "FINE" },
    include: { feeAccount: { include: { student: { include: { course: true } } } } },
  });
  const byCourse = new Map();
  let total = 0;
  for (const entry of entries) {
    total += entry.amount;
    const course = entry.feeAccount.student.course;
    const current = byCourse.get(course.id) || { courseId: course.id, courseCode: course.courseCode, total: 0 };
    current.total += entry.amount;
    byCourse.set(course.id, current);
  }
  return { semesterId, total, byCourse: [...byCourse.values()] };
}

async function reconciliationReport(courseId) {
  const courses = await prisma.course.findMany({
    where: courseId ? { id: courseId } : {},
    orderBy: { id: "asc" },
  });
  if (courseId && courses.length === 0) {
    throw notFound("COURSE_NOT_FOUND");
  }
  const accounts = await prisma.feeAccount.findMany({
    where: courseId ? { student: { courseId } } : {},
    include: {
      ledgerEntries: true,
      student: { include: { course: true } },
    },
  });
  return {
    courses: courses.map((course) => {
      const courseAccounts = accounts.filter((account) => account.student.courseId === course.id);
      const products = ["ACADEMIC", "HOSTEL"]
        .map((product) => {
          const entries = courseAccounts
            .filter((account) => account.product === product)
            .flatMap((account) => account.ledgerEntries);
          if (entries.length === 0) {
            return null;
          }
          const summary = balances(entries);
          const amountOf = (type) =>
            entries.filter((entry) => entry.entryType === type).reduce((sum, entry) => sum + entry.amount, 0);
          return {
            product,
            assessed: amountOf("ASSESSMENT"),
            paid: amountOf("PAYMENT"),
            fines: amountOf("FINE"),
            waivers: amountOf("WAIVER"),
            refunds: amountOf("REFUND"),
            depositHeld: summary.depositHeld,
            duesOutstanding: summary.duesOutstanding,
          };
        })
        .filter(Boolean);
      return { courseId: course.id, courseCode: course.courseCode, products };
    }),
  };
}

module.exports = {
  paymentsReport,
  unpaidReport,
  failedPaymentsReport,
  onTimeReport,
  waiverReport,
  leftStudentsReport,
  fineReport,
  reconciliationReport,
};
