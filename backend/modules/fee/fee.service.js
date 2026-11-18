const prisma = require("../../lib/prisma");
const { badRequest, conflict, notFound } = require("../../lib/errors");
const { addDays, diffDays, parseISODate, todayUTC } = require("../../lib/dates");
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

async function createAcademicYear(data) {
  const startDate = parseISODate(data.startDate);
  const endDate = parseISODate(data.endDate);
  if (endDate <= startDate) {
    throw badRequest("INVALID_DATE_RANGE", [{ path: "endDate", message: "endDate must be after startDate" }]);
  }
  try {
    return await prisma.academicYear.create({
      data: { label: data.label, startDate, endDate },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw conflict("DUPLICATE_ACADEMIC_YEAR");
    }
    throw err;
  }
}

function listAcademicYears() {
  return prisma.academicYear.findMany({ orderBy: { id: "asc" } });
}

async function createSemester(data) {
  const year = await prisma.academicYear.findUnique({ where: { id: data.academicYearId } });
  if (!year) {
    throw notFound("ACADEMIC_YEAR_NOT_FOUND");
  }
  try {
    return await prisma.semester.create({
      data: {
        academicYearId: data.academicYearId,
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

async function createFeeStructure(data) {
  const [course, year, semester] = await Promise.all([
    prisma.course.findUnique({ where: { id: data.courseId } }),
    prisma.academicYear.findUnique({ where: { id: data.academicYearId } }),
    prisma.semester.findUnique({ where: { id: data.semesterId } }),
  ]);
  if (!course) {
    throw notFound("COURSE_NOT_FOUND");
  }
  if (!year) {
    throw notFound("ACADEMIC_YEAR_NOT_FOUND");
  }
  if (!semester || semester.academicYearId !== data.academicYearId) {
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

function listFeeStructures() {
  return prisma.feeStructure.findMany({ orderBy: { id: "asc" } });
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

module.exports = {
  createAcademicYear,
  listAcademicYears,
  createSemester,
  listSemesters,
  createFeeStructure,
  listFeeStructures,
  listHostelRates,
  getAccount,
  runFines,
  waiveFine,
  refundDeposit,
  adjustDeposit,
};
