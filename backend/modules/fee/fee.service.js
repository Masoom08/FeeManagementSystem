const prisma = require("../../lib/prisma");
const cascadeDelete = require("../../lib/cascadeDelete");
const { badRequest, conflict, notFound } = require("../../lib/errors");
const { addDays, diffDays, formatISODate, parseISODate, todayUTC } = require("../../lib/dates");
const { balances, postedFineTotal, principalOutstanding } = require("../../lib/balance");
const { componentFor } = require("./assess");

function presentAccount(account) {
  const { ledgerEntries, ...rest } = account;
  return {
    ...rest,
    ...balances(ledgerEntries),
    lines: ledgerEntries,
  };
}

async function createSession(data) {
  const startDate = parseISODate(data.startDate);
  const endDate = parseISODate(data.endDate);
  if (endDate <= startDate) {
    throw badRequest("INVALID_DATE_RANGE", [{ path: "endDate", message: "endDate must be after startDate" }]);
  }
  try {
    return await prisma.session.create({
      data: { label: data.label, startDate, endDate },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw conflict("DUPLICATE_SESSION");
    }
    throw err;
  }
}

function listSessions() {
  return prisma.session.findMany({ orderBy: { id: "asc" } });
}

async function updateSession(id, data) {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) throw notFound("SESSION_NOT_FOUND");
  const startDate = data.startDate ? parseISODate(data.startDate) : existing.startDate;
  const endDate = data.endDate ? parseISODate(data.endDate) : existing.endDate;
  if (endDate <= startDate) throw badRequest("INVALID_DATE_RANGE", [{ path: "endDate", message: "endDate must be after startDate" }]);
  try {
    return await prisma.session.update({ where: { id }, data: { ...data, startDate, endDate } });
  } catch (err) {
    if (err.code === "P2002") throw conflict("DUPLICATE_SESSION");
    throw err;
  }
}

async function deleteSession(id) {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) throw notFound("SESSION_NOT_FOUND");
  const counts = await prisma.session.findUnique({ where: { id }, include: { _count: { select: { semesters: true, feeStructures: true, feeAccounts: true, students: true } } } });
  if (Object.values(counts._count).some(Boolean)) {
    throw conflict("SESSION_IN_USE", [{ message: "This session is linked to students, fee accounts, semesters, or fee structures and cannot be deleted." }]);
  }
  await prisma.session.delete({ where: { id } });
  return { id, deleted: true };
}

async function createSemester(data) {
  const year = await prisma.session.findUnique({ where: { id: data.sessionId } });
  if (!year) {
    throw notFound("SESSION_NOT_FOUND");
  }
  try {
    return await prisma.semester.create({
      data: {
        sessionId: data.sessionId,
        name: data.name,
        dueDate: parseISODate(data.dueDate),
        graceDays: data.graceDays,
        fineEndDate: data.fineEndDate ? parseISODate(data.fineEndDate) : null,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw conflict("DUPLICATE_SEMESTER");
    }
    throw err;
  }
}

function listSemesters() {
  return prisma.semester.findMany({ orderBy: { id: "asc" } });
}

async function updateSemester(id, data) {
  const existing = await prisma.semester.findUnique({ where: { id } });
  if (!existing) throw notFound("SEMESTER_NOT_FOUND");
  const patch = { ...data };
  if (data.dueDate) patch.dueDate = parseISODate(data.dueDate);
  if (data.fineEndDate) patch.fineEndDate = parseISODate(data.fineEndDate);
  if (data.fineEndDate === null) patch.fineEndDate = null;
  try {
    return await prisma.semester.update({ where: { id }, data: patch });
  } catch (err) {
    if (err.code === "P2002") throw conflict("DUPLICATE_SEMESTER");
    throw err;
  }
}

async function deleteSemester(id) {
  const existing = await prisma.semester.findUnique({ where: { id } });
  if (!existing) throw notFound("SEMESTER_NOT_FOUND");
  const counts = await prisma.semester.findUnique({ where: { id }, include: { _count: { select: { feeStructures: true, ledgerEntries: true, students: true } } } });
  if (Object.values(counts._count).some(Boolean)) {
    throw conflict("SEMESTER_IN_USE", [{ message: "This semester is linked to students, fee structures, or fee ledger entries and cannot be deleted." }]);
  }
  await prisma.semester.delete({ where: { id } });
  return { id, deleted: true };
}

async function createFeeStructure(data) {
  const [course, year, semester] = await Promise.all([
    prisma.course.findUnique({ where: { id: data.courseId } }),
    prisma.session.findUnique({ where: { id: data.sessionId } }),
    prisma.semester.findUnique({ where: { id: data.semesterId } }),
  ]);
  if (!course) {
    throw notFound("COURSE_NOT_FOUND");
  }
  if (!course.active) {
    throw conflict("COURSE_INACTIVE", [{ message: "This course is inactive and cannot be used for a new fee structure." }]);
  }
  if (!year) {
    throw notFound("SESSION_NOT_FOUND");
  }
  if (!semester || semester.sessionId !== data.sessionId) {
    throw notFound("SEMESTER_NOT_FOUND");
  }
  try {
    return await prisma.feeStructure.create({ data });
  } catch (err) {
    if (err.code === "P2002") {
      throw conflict("DUPLICATE_FEE_STRUCTURE");
    }
    throw err;
  }
}

function listFeeStructures(sessionId) {
  return prisma.feeStructure.findMany({
    where: sessionId ? { sessionId } : {},
    orderBy: [{ courseId: "asc" }, { semesterId: "asc" }, { component: "asc" }],
  });
}

async function updateFeeStructure(id, data) {
  const existing = await prisma.feeStructure.findUnique({ where: { id } });
  if (!existing) throw notFound("FEE_STRUCTURE_NOT_FOUND");
  const next = { ...existing, ...data };
  const [course, year, semester] = await Promise.all([
    prisma.course.findUnique({ where: { id: next.courseId } }),
    prisma.session.findUnique({ where: { id: next.sessionId } }),
    prisma.semester.findUnique({ where: { id: next.semesterId } }),
  ]);
  if (!course) throw notFound("COURSE_NOT_FOUND");
  if (!year) throw notFound("SESSION_NOT_FOUND");
  if (!semester || semester.sessionId !== next.sessionId) throw notFound("SEMESTER_NOT_FOUND");
  try {
    return await prisma.feeStructure.update({ where: { id }, data });
  } catch (err) {
    if (err.code === "P2002") throw conflict("DUPLICATE_FEE_STRUCTURE");
    throw err;
  }
}

async function deleteFeeStructure(id) {
  const existing = await prisma.feeStructure.findUnique({ where: { id } });
  if (!existing) throw notFound("FEE_STRUCTURE_NOT_FOUND");
  await prisma.feeStructure.delete({ where: { id } });
  return { id, deleted: true };
}

function listHostelRates() {
  return prisma.hostelRate.findMany({ orderBy: [{ condition: "asc" }, { annualFee: "desc" }] });
}

async function getAccount(id) {
  const account = await prisma.feeAccount.findUnique({
    where: { id },
    include: { ledgerEntries: { orderBy: { id: "asc" } } },
  });
  if (!account) {
    throw notFound();
  }
  return presentAccount(account);
}

async function runFines(data) {
  const asOf = parseISODate(data.asOfDate);
  const accounts = await prisma.feeAccount.findMany({
    include: {
      ledgerEntries: { orderBy: { id: "asc" } },
      student: { include: { course: true } },
    },
    orderBy: { id: "asc" },
  });
  const posted = [];

  for (const account of accounts) {
    const semesterIds = [...new Set(account.ledgerEntries.map((entry) => entry.semesterId).filter(Boolean))];
    for (const semesterId of semesterIds) {
      if (principalOutstanding(account.ledgerEntries, semesterId) <= 0) {
        continue;
      }
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester) {
        continue;
      }
      let end = asOf;
      if (semester.fineEndDate && semester.fineEndDate < end) {
        end = semester.fineEndDate;
      }
      const days = diffDays(end, addDays(semester.dueDate, semester.graceDays));
      if (days <= 0) {
        continue;
      }
      const delta = account.student.course.lateFeePerDay * days - postedFineTotal(account.ledgerEntries, semesterId);
      if (delta <= 0) {
        continue;
      }
      const line = await prisma.ledgerEntry.create({
        data: {
          feeAccountId: account.id,
          semesterId,
          bucket: "DUES",
          entryType: "FINE",
          direction: "INCREASE",
          amount: delta,
          component: account.product === "HOSTEL" ? "HOSTEL_FEE" : "ACADEMIC_FEE",
          effectiveDate: asOf,
          actedBy: data.actedBy,
          reason: `Late fee for ${days} day(s)`,
        },
      });
      posted.push(line);
      account.ledgerEntries.push(line);
    }
  }

  return { posted };
}

async function waiveFine(entryId, data) {
  const fine = await prisma.ledgerEntry.findUnique({ where: { id: entryId } });
  if (!fine) {
    throw notFound();
  }
  if (fine.entryType !== "FINE") {
    throw conflict("NOT_A_FINE");
  }
  const waived = await prisma.ledgerEntry.aggregate({
    where: { relatedEntryId: fine.id, entryType: "WAIVER" },
    _sum: { amount: true },
  });
  const remaining = fine.amount - (waived._sum.amount || 0);
  if (data.amount > remaining) {
    throw badRequest("AMOUNT_EXCEEDS_FINE", [
      { path: "amount", message: "amount exceeds the remaining fine" },
    ]);
  }
  return prisma.ledgerEntry.create({
    data: {
      feeAccountId: fine.feeAccountId,
      semesterId: fine.semesterId,
      bucket: "DUES",
      entryType: "WAIVER",
      direction: "DECREASE",
      amount: data.amount,
      component: fine.component,
      effectiveDate: todayUTC(),
      actedBy: data.actedBy,
      reason: data.reason,
      relatedEntryId: fine.id,
    },
  });
}

function semesterNumber(name) {
  const match = String(name).match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

function scheduledDeadline(schedule, today) {
  const year = today.getUTCFullYear();
  let dueDate = new Date(Date.UTC(year, schedule.month - 1, schedule.day));
  if (dueDate > today && dueDate.getUTCMonth() !== today.getUTCMonth()) {
    dueDate = new Date(Date.UTC(year - 1, schedule.month - 1, schedule.day));
  }
  return dueDate;
}

async function readCourseDeadlines() {
  try {
    return await prisma.$queryRaw`SELECT course_id AS courseId, semester_type AS semesterType, month, day FROM course_fee_deadlines`;
  } catch (error) {
    // Keep the fees page available while a local database is waiting for migrations.
    if (error.code === "P2010" && String(error.meta?.message ?? "").includes("course_fee_deadlines")) return [];
    throw error;
  }
}

async function getLateFeeDashboard() {
  const today = todayUTC();
  const [courses, deadlines, accounts] = await Promise.all([
    prisma.course.findMany({ where: { active: true }, orderBy: { courseName: "asc" } }),
    readCourseDeadlines(),
    prisma.feeAccount.findMany({
    where: { product: "ACADEMIC", student: { status: "ACTIVE" } },
      include: { ledgerEntries: true, student: { include: { course: true, batch: true, session: true, admissionSemester: true } } },
    }),
  ]);
  const deadlinesByCourse = new Map();
  for (const deadline of deadlines) {
    const rows = deadlinesByCourse.get(deadline.courseId) ?? [];
    rows.push(deadline);
    deadlinesByCourse.set(deadline.courseId, rows);
  }
  // Deadlines are managed in course_fee_deadlines. Missing rows stay unconfigured
  // instead of silently substituting an in-code date.
  const schedulesFor = (course) => deadlinesByCourse.get(course.id) ?? [];
  const students = [];
  for (const account of accounts) {
    const student = account.student;
    if (account.sessionId !== student.sessionId) continue;
    const course = courses.find((item) => item.id === student.courseId);
    if (!course) continue;
    const semester = student.admissionSemester;
    const number = semesterNumber(semester.name);
    if (!number || principalOutstanding(account.ledgerEntries, semester.id) <= 0) continue;
    const type = number % 2 ? "ODD" : "EVEN";
    const schedule = schedulesFor(course).find((item) => item.semesterType === type);
    if (!schedule) continue;
    const dueDate = scheduledDeadline(schedule, today);
    const daysOverdue = Math.max(0, diffDays(today, dueDate));
    if (!daysOverdue) continue;
    const ratePerDay = course.lateFeePerDay;
    const fineAmount = daysOverdue * ratePerDay;
    const fineEntries = account.ledgerEntries.filter((entry) => entry.semesterId === semester.id && entry.entryType === "FINE");
    const fineEntryIds = fineEntries.map((entry) => entry.id);
    const fineTotal = fineEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const waivedTotal = account.ledgerEntries.filter((entry) => entry.entryType === "WAIVER" && fineEntryIds.includes(entry.relatedEntryId)).reduce((sum, entry) => sum + entry.amount, 0);
    students.push({
      studentId: student.id, accountId: account.id, name: student.name,
      registrationNumber: student.registrationNumber, phoneNumber: student.phoneNumber,
      courseId: course.id, courseName: course.courseName, batch: student.batch.label,
      studyYear: student.studyYear, semester: semester.name, semesterId: semester.id,
      semesterFee: principalOutstanding(account.ledgerEntries, semester.id),
      dueDate: formatISODate(dueDate), daysOverdue, ratePerDay, fineAmount,
      waivedAmount: waivedTotal, pendingFine: Math.max(0, fineAmount - waivedTotal),
      waivedAt: account.ledgerEntries.find((entry) => entry.entryType === "WAIVER" && fineEntryIds.includes(entry.relatedEntryId))?.effectiveDate ?? null,
    });
  }
  return {
    asOfDate: formatISODate(today),
    courses: courses.map((course) => ({
      id: course.id, courseName: course.courseName, lateFeePerDay: course.lateFeePerDay,
      deadlines: schedulesFor(course).sort((a, b) => a.semesterType.localeCompare(b.semesterType)).map(({ semesterType, month, day }) => ({ semesterType, month, day })),
    })),
    students: students.sort((a, b) => b.fineAmount - a.fineAmount || a.name.localeCompare(b.name)),
  };
}

async function waiveLateFeeForStudent(studentId, data) {
  const dashboard = await getLateFeeDashboard();
  const overdue = dashboard.students.find((student) => student.studentId === studentId);
  if (!overdue) throw notFound("OVERDUE_STUDENT_NOT_FOUND");
  if (overdue.pendingFine <= 0) throw conflict("FINE_ALREADY_WAIVED");
  return prisma.$transaction(async (tx) => {
    const account = await tx.feeAccount.findUnique({ where: { id: overdue.accountId }, include: { ledgerEntries: true } });
    const fineEntries = account.ledgerEntries.filter((entry) => entry.semesterId === overdue.semesterId && entry.entryType === "FINE");
    const posted = fineEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const fine = posted < overdue.fineAmount ? await tx.ledgerEntry.create({
      data: {
        feeAccountId: account.id, semesterId: overdue.semesterId, bucket: "DUES", entryType: "FINE", direction: "INCREASE",
        amount: overdue.fineAmount - posted, component: "ACADEMIC_FEE", effectiveDate: parseISODate(dashboard.asOfDate),
        actedBy: data.actedBy, reason: `Late fee for ${overdue.daysOverdue} day(s) at Rs ${overdue.ratePerDay} per day`,
      },
    }) : fineEntries[0];
    return tx.ledgerEntry.create({
      data: {
        feeAccountId: account.id, semesterId: overdue.semesterId, bucket: "DUES", entryType: "WAIVER", direction: "DECREASE",
        amount: overdue.pendingFine, component: "ACADEMIC_FEE", effectiveDate: todayUTC(), actedBy: data.actedBy,
        reason: data.reason, relatedEntryId: fine.id,
      },
    });
  });
}

async function loadAccount(id) {
  const account = await prisma.feeAccount.findUnique({
    where: { id },
    include: {
      ledgerEntries: { orderBy: { id: "asc" } },
      student: true,
    },
  });
  if (!account) {
    throw notFound();
  }
  return account;
}

async function refundDeposit(accountId, data) {
  const account = await loadAccount(accountId);
  const deductionAmount = data.deductionAmount || 0;
  const { depositHeld } = balances(account.ledgerEntries);
  if (data.amount + deductionAmount > depositHeld) {
    throw badRequest("AMOUNT_EXCEEDS_DEPOSIT", [
      { path: "amount", message: "amount exceeds the deposit held" },
    ]);
  }
  const today = todayUTC();
  const lines = await prisma.transaction(async (tx) => {
    const created = [];
    created.push(
      await tx.ledgerEntry.create({
        data: {
          feeAccountId: account.id,
          semesterId: account.student.admissionSemesterId,
          bucket: "DEPOSIT",
          entryType: "REFUND",
          direction: "DECREASE",
          amount: data.amount,
          component: componentFor(account.product, "DEPOSIT"),
          effectiveDate: today,
          actedBy: data.actedBy,
          reason: data.reason,
        },
      })
    );
    if (deductionAmount > 0) {
      created.push(
        await tx.ledgerEntry.create({
          data: {
            feeAccountId: account.id,
            semesterId: account.student.admissionSemesterId,
            bucket: "DEPOSIT",
            entryType: "DEDUCTION",
            direction: "DECREASE",
            amount: deductionAmount,
            component: componentFor(account.product, "DEPOSIT"),
            effectiveDate: today,
            actedBy: data.actedBy,
            reason: data.deductionReason,
            relatedEntryId: created[0].id,
          },
        })
      );
    }
    return created;
  });
  return { lines, account: await getAccount(account.id) };
}

async function adjustDeposit(accountId, data) {
  const account = await loadAccount(accountId);
  const { depositHeld, duesOutstanding } = balances(account.ledgerEntries);
  if (data.amount > depositHeld || data.amount > duesOutstanding) {
    throw badRequest("AMOUNT_EXCEEDS_BALANCE", [
      { path: "amount", message: "amount exceeds the deposit held or the dues outstanding" },
    ]);
  }
  const today = todayUTC();
  const lines = await prisma.transaction(async (tx) => {
    const depositLine = await tx.ledgerEntry.create({
      data: {
        feeAccountId: account.id,
        semesterId: account.student.admissionSemesterId,
        bucket: "DEPOSIT",
        entryType: "ADJUSTMENT",
        direction: "DECREASE",
        amount: data.amount,
        component: componentFor(account.product, "DEPOSIT"),
        effectiveDate: today,
        actedBy: data.actedBy,
        reason: data.reason,
      },
    });
    const duesLine = await tx.ledgerEntry.create({
      data: {
        feeAccountId: account.id,
        semesterId: account.student.admissionSemesterId,
        bucket: "DUES",
        entryType: "ADJUSTMENT",
        direction: "DECREASE",
        amount: data.amount,
        component: componentFor(account.product, "DUES"),
        effectiveDate: today,
        actedBy: data.actedBy,
        reason: data.reason,
        relatedEntryId: depositLine.id,
      },
    });
    return [depositLine, duesLine];
  });
  return { lines, account: await getAccount(account.id) };
}

function previewAcademicYearDelete(id) {
  return cascadeDelete.previewAcademicYear(id);
}

function deleteAcademicYear(id) {
  return cascadeDelete.deleteAcademicYear(id);
}

function previewSemesterDelete(id) {
  return cascadeDelete.previewSemester(id);
}

function deleteSemester(id) {
  return cascadeDelete.deleteSemester(id);
}

function previewFeeStructureDelete(id) {
  return cascadeDelete.previewFeeStructure(id);
}

function deleteFeeStructure(id) {
  return cascadeDelete.deleteFeeStructure(id);
}

function previewHostelRateDelete(id) {
  return cascadeDelete.previewHostelRate(id);
}

function deleteHostelRate(id) {
  return cascadeDelete.deleteHostelRate(id);
}

module.exports = {
  createSession,
  listSessions,
  updateSession,
  deleteSession,
  createSemester,
  listSemesters,
  updateSemester,
  deleteSemester,
  createFeeStructure,
  listFeeStructures,
  updateFeeStructure,
  deleteFeeStructure,
  listHostelRates,
  getAccount,
  runFines,
  waiveFine,
  getLateFeeDashboard,
  waiveLateFeeForStudent,
  refundDeposit,
  adjustDeposit,
  previewAcademicYearDelete,
  deleteAcademicYear,
  previewSemesterDelete,
  deleteSemester,
  previewFeeStructureDelete,
  deleteFeeStructure,
  previewHostelRateDelete,
  deleteHostelRate,
};
