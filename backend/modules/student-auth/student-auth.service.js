const prisma = require("../../lib/prisma");
const { httpError } = require("../../lib/errors");
const { issueStudentToken } = require("../auth/auth.service");
const { balances } = require("../../lib/balance");
const { parseISODate } = require("../../lib/dates");
const { programSemesterForLine, termOrder } = require("../../lib/programSemester");
const { FIRST_SEMESTER, SECOND_SEMESTER } = require("../../lib/terms");
const paymentService = require("../payment/payment.service");
const { assessStudent } = require("../fee/assess");
const crypto = require("crypto");

const DEMO_OTP = "111111";
const OTP_TTL_MS = 5 * 60 * 1000;
const pendingOtps = new Map();

function normalizePhoneNumber(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (!/^\d{10}$/.test(digits)) {
    throw httpError(400, "INVALID_PHONE_NUMBER");
  }
  return digits;
}

async function findStudentByPhone(phoneNumber) {
  const wanted = normalizePhoneNumber(phoneNumber);
  const students = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      phoneNumber: true,
      course: { select: { courseName: true } },
    },
  });
  return students.find((student) => {
    try {
      return normalizePhoneNumber(student.phoneNumber) === wanted;
    } catch {
      return false;
    }
  }) || null;
}

async function requestOtp(phoneNumber) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const student = await findStudentByPhone(normalizedPhone);
  if (!student) {
    throw httpError(404, "MOBILE_NOT_REGISTERED", {
      message: "Sorry, this mobile number is not attached to any student.",
    });
  }

  pendingOtps.set(normalizedPhone, {
    studentId: student.id,
    otp: DEMO_OTP,
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  return {
    message: "OTP sent.",
    phoneNumber: normalizedPhone,
    otp: DEMO_OTP,
    expiresIn: OTP_TTL_MS / 1000,
  };
}

async function verifyOtp(phoneNumber, otp) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const pending = pendingOtps.get(normalizedPhone);
  pendingOtps.delete(normalizedPhone);
  if (!pending || pending.expiresAt < Date.now() || pending.otp !== otp) {
    throw httpError(401, "INVALID_OR_EXPIRED_OTP");
  }

  const student = await prisma.student.findUnique({
    where: { id: pending.studentId },
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      phoneNumber: true,
      studyYear: true,
      course: { select: { courseName: true, affiliation: true } },
      academicYear: { select: { label: true } },
    },
  });
  if (!student || student.phoneNumber.replace(/\D/g, "").slice(-10) !== normalizedPhone) {
    throw httpError(401, "STUDENT_ACCOUNT_UNAVAILABLE");
  }

  return { ...issueStudentToken(student.id), student };
}

function sumLines(lines, entryType, direction) {
  return lines
    .filter((line) => line.entryType === entryType && line.direction === direction)
    .reduce((total, line) => total + line.amount, 0);
}

function chargeForLines(lines) {
  const dues = lines.filter((line) => line.bucket === "DUES");
  if (!dues.some((line) => line.entryType === "ASSESSMENT")) return null;
  const lateFee = Math.max(0, sumLines(dues, "FINE", "INCREASE") - sumLines(dues, "WAIVER", "DECREASE"));
  const payment = [...dues].reverse().find((line) => line.entryType === "PAYMENT");
  return {
    fee: sumLines(dues, "ASSESSMENT", "INCREASE") + lateFee,
    paid: sumLines(dues, "PAYMENT", "DECREASE") + sumLines(dues, "ADJUSTMENT", "DECREASE"),
    paymentDate: payment?.effectiveDate ?? null,
    paymentAttemptId: payment?.paymentAttemptId ?? null,
  };
}

async function listReceipts(studentId) {
  const [student, years, payments] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { academicYearId: true, studyYear: true },
    }),
    prisma.academicYear.findMany({ select: { id: true, label: true, startDate: true } }),
    prisma.paymentAttempt.findMany({
      where: {
        status: "SUCCESS",
        allocations: {
          some: { feeAccount: { is: { studentId } } },
        },
      },
      orderBy: [{ paidOn: "desc" }, { id: "desc" }],
      include: {
        allocations: {
          where: { feeAccount: { is: { studentId } } },
          include: {
            feeAccount: {
              include: {
                ledgerEntries: { include: { semester: { select: { name: true, academicYearId: true } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  return payments.map((payment) => {
    const allocations = payment.allocations;
    const semesterNumbers = student
      ? allocations.flatMap((allocation) =>
        allocation.feeAccount.ledgerEntries
          .filter((entry) => entry.paymentAttemptId === payment.id && entry.semester)
          .map((entry) => programSemesterForLine(student, years, entry.semester))
      )
      : [];
    const product = allocations.some((allocation) => allocation.feeAccount.product === "HOSTEL") ? "HOSTEL" : "ACADEMIC";
    return {
      receiptNo: payment.receiptNo,
      paymentId: payment.id,
      amount: allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      paidOn: payment.paidOn,
      method: payment.method,
      product,
      semesters: product === "HOSTEL" ? [] : [...new Set(semesterNumbers)].sort((a, b) => a - b),
    };
  });
}

async function getStudentReceipt(studentId, paymentId) {
  const receipt = (await listReceipts(studentId)).find((item) => item.paymentId === paymentId);
  if (!receipt) throw httpError(404, "RECEIPT_NOT_FOUND");
  return receipt;
}

async function getProfile(studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { course: true, academicYear: true, hostelRate: true, feeAccounts: { include: { ledgerEntries: { include: { semester: true }, orderBy: { id: "asc" } } } } },
  });
  if (!student || student.status !== "ACTIVE") throw httpError(404, "STUDENT_ACCOUNT_UNAVAILABLE");
  const [years, hostelRates] = await Promise.all([
    prisma.academicYear.findMany({ select: { id: true, label: true, startDate: true } }),
    prisma.hostelRate.findMany({
      orderBy: [{ condition: "asc" }, { annualFee: "desc" }],
      select: { id: true, condition: true, occupancy: true, annualFee: true },
    }),
  ]);
  const academicEntries = student.feeAccounts
    .filter((account) => account.product === "ACADEMIC")
    .flatMap((account) => account.ledgerEntries);
  const semesters = new Map();
  const seenSemesterIds = new Set();
  for (const entry of academicEntries) {
    if (!entry.semester || seenSemesterIds.has(entry.semesterId)) continue;
    seenSemesterIds.add(entry.semesterId);
    const charge = chargeForLines(academicEntries.filter((line) => line.semesterId === entry.semesterId));
    if (!charge) continue;
    const number = programSemesterForLine(student, years, entry.semester);
    const row = semesters.get(number) || {
      semester: number,
      fee: 0,
      paid: 0,
      dueDate: entry.semester.dueDate,
      receiptNo: undefined,
      paymentDate: null,
      paymentAttemptId: null,
      billed: true,
    };
    row.fee += charge.fee;
    row.paid += charge.paid;
    if (!row.dueDate || entry.semester.dueDate < row.dueDate) row.dueDate = entry.semester.dueDate;
    if (charge.paymentDate && (!row.paymentDate || charge.paymentDate > row.paymentDate)) {
      row.paymentDate = charge.paymentDate;
      row.paymentAttemptId = charge.paymentAttemptId;
    }
    semesters.set(number, row);
  }
  const semesterCount = Math.max(1, student.course.durationYears) * 2;
  const missing = [];
  for (let number = 1; number <= semesterCount; number += 1) {
    if (!semesters.has(number)) missing.push(number);
  }
  if (missing.length) {
    const [structures, calendarSemesters] = await Promise.all([
      prisma.feeStructure.findMany({
        where: { courseId: student.courseId, academicYearId: student.academicYearId, component: "ACADEMIC_FEE" },
        include: { semester: { select: { name: true } } },
      }),
      prisma.semester.findMany({ select: { name: true, academicYearId: true, dueDate: true } }),
    ]);
    const orderedYears = [...years].sort((a, b) => new Date(a.startDate) - new Date(b.startDate) || String(a.label).localeCompare(String(b.label)));
    const currentIndex = orderedYears.findIndex((year) => year.id === student.academicYearId);
    for (const number of missing) {
      const studyYear = Math.ceil(number / 2);
      const term = number % 2 === 1 ? 0 : 1;
      const structure = structures.find((row) => row.studyYear === studyYear && termOrder(row.semester.name) === term);
      const targetYear = currentIndex >= 0 ? orderedYears[currentIndex + (studyYear - student.studyYear)] : null;
      const calendar = targetYear
        ? calendarSemesters.find((item) => item.academicYearId === targetYear.id && termOrder(item.name) === term)
        : null;
      semesters.set(number, {
        semester: number,
        fee: structure?.amount || 0,
        paid: 0,
        dueDate: calendar?.dueDate || null,
        receiptNo: undefined,
        paymentDate: null,
        paymentAttemptId: null,
        billed: false,
      });
    }
  }
  const attemptIds = [...semesters.values()].map((row) => row.paymentAttemptId).filter(Boolean);
  const attempts = attemptIds.length
    ? await prisma.paymentAttempt.findMany({ where: { id: { in: attemptIds } }, select: { id: true, receiptNo: true } })
    : [];
  const receiptByAttempt = new Map(attempts.map((attempt) => [attempt.id, attempt.receiptNo]));
  const payments = await prisma.paymentAttempt.findMany({
    where: { allocations: { some: { feeAccount: { studentId } } } },
    orderBy: { id: "desc" },
    take: 8,
    select: { reference: true, status: true, amount: true, method: true, receiptNo: true },
  });
  const hostelOutstanding = student.feeAccounts
    .filter((account) => account.product === "HOSTEL")
    .reduce((sum, account) => sum + balances(account.ledgerEntries).duesOutstanding, 0);
  return {
    student: { id: student.id, name: student.name, registrationNo: student.registrationNumber, phone: student.phoneNumber, course: student.course.courseName, batch: student.academicYear.label, year: student.studyYear },
    fees: [...semesters.values()].sort((a, b) => a.semester - b.semester).map((row) => {
      const { paymentAttemptId, ...fee } = row;
      const balance = Math.max(0, fee.fee - fee.paid);
      const billed = fee.billed !== false;
      return {
        ...fee,
        billed,
        receiptNo: receiptByAttempt.get(paymentAttemptId) || undefined,
        status: !billed || !fee.dueDate ? "Upcoming" : balance === 0 ? "Paid" : fee.dueDate > new Date() ? "Upcoming" : "Due",
      };
    }),
    hostelOutstanding,
    hostelSeat: student.hostelRate
      ? { id: student.hostelRate.id, condition: student.hostelRate.condition, occupancy: student.hostelRate.occupancy, annualFee: student.hostelRate.annualFee }
      : null,
    hostelRates,
    payments,
    accounts: student.feeAccounts.map((account) => ({ id: account.id, product: account.product, ...balances(account.ledgerEntries) })),
  };
}

function yearStart(label) {
  const match = String(label || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

async function findOrCreateAcademicYear(tx, startYear) {
  const label = `${startYear}-${String(startYear + 1).slice(-2)}`;
  const existing = await tx.academicYear.findUnique({ where: { label } });
  if (existing) return existing;
  return tx.academicYear.create({
    data: {
      label,
      startDate: parseISODate(`${startYear}-08-01`),
      endDate: parseISODate(`${startYear + 1}-07-31`),
    },
  });
}

async function semesterForProgram(tx, student, programSemester) {
  const years = await tx.academicYear.findMany();
  const ordered = [...years].sort((a, b) => new Date(a.startDate) - new Date(b.startDate) || String(a.label).localeCompare(String(b.label)));
  const currentIndex = ordered.findIndex((year) => year.id === student.academicYearId);
  const studyYear = Math.ceil(programSemester / 2);
  const term = programSemester % 2 === 1 ? 0 : 1;
  const anchorIndex = currentIndex >= 0 ? currentIndex : ordered.length - 1;
  const targetIndex = anchorIndex + (studyYear - student.studyYear);
  let year = ordered[targetIndex];
  if (!year) {
    const anchor = ordered[anchorIndex];
    year = await findOrCreateAcademicYear(tx, yearStart(anchor.label) + (targetIndex - anchorIndex));
  }
  const name = term === 0 ? FIRST_SEMESTER : SECOND_SEMESTER;
  const existing = await tx.semester.findFirst({ where: { academicYearId: year.id, name } });
  if (existing) return existing;
  const startYear = yearStart(year.label);
  return tx.semester.create({
    data: {
      academicYearId: year.id,
      name,
      dueDate: term === 0 ? parseISODate(`${startYear}-06-10`) : parseISODate(`${startYear + 1}-01-10`),
      graceDays: 0,
    },
  });
}

async function academicFeeAccount(studentId) {
  const accounts = await prisma.feeAccount.findMany({
    where: { studentId, product: "ACADEMIC" },
    include: { ledgerEntries: true },
    orderBy: { id: "asc" },
  });
  return accounts.find((account) => balances(account.ledgerEntries).duesOutstanding > 0) || accounts[accounts.length - 1] || null;
}

async function ensureAcademicCoverage(studentId, feeAccountId, amount) {
  const account = await prisma.feeAccount.findUnique({
    where: { id: feeAccountId },
    include: { ledgerEntries: true },
  });
  if (!account) return;
  let gap = amount - balances(account.ledgerEntries).duesOutstanding;
  if (gap <= 0) return;
  const [profile, student] = await Promise.all([
    getProfile(studentId),
    prisma.student.findUnique({ where: { id: studentId } }),
  ]);
  if (!student) return;
  const unbilled = profile.fees.filter((fee) => !fee.billed && Math.max(0, fee.fee - fee.paid) > 0);
  await prisma.transaction(async (tx) => {
    for (const fee of unbilled) {
      if (gap <= 0) break;
      const semester = await semesterForProgram(tx, student, fee.semester);
      const assessAmount = Math.max(0, fee.fee - fee.paid);
      const existing = await tx.ledgerEntry.findFirst({
        where: { feeAccountId, semesterId: semester.id, entryType: "ASSESSMENT", bucket: "DUES", component: "ACADEMIC_FEE" },
      });
      if (!existing && assessAmount > 0) {
        await tx.ledgerEntry.create({
          data: {
            feeAccountId,
            semesterId: semester.id,
            bucket: "DUES",
            entryType: "ASSESSMENT",
            direction: "INCREASE",
            amount: assessAmount,
            component: "ACADEMIC_FEE",
            effectiveDate: semester.dueDate,
            actedBy: `STUDENT:${studentId}`,
            reason: "Semester fee",
          },
        });
      }
      gap -= assessAmount;
    }
  });
}

async function createStudentPayment(studentId, data) {
  const product = data.product || "ACADEMIC";
  const account = product === "HOSTEL"
    ? await prisma.feeAccount.findFirst({ where: { studentId, product } })
    : await academicFeeAccount(studentId);
  if (!account) throw httpError(404, "FEE_ACCOUNT_NOT_FOUND");
  const rows = await getProfile(studentId);
  const payable = rows.fees.filter((fee) => Math.max(0, fee.fee - fee.paid) > 0);
  const maxAmount = product === "HOSTEL"
    ? rows.hostelOutstanding
    : payable.reduce((total, fee) => total + Math.max(0, fee.fee - fee.paid), 0);
  if (data.amount > maxAmount) throw httpError(400, "AMOUNT_EXCEEDS_BALANCE");
  const prior = await prisma.paymentAttempt.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
    include: { allocations: { include: { feeAccount: { select: { studentId: true } } } } },
  });
  if (prior) {
    if (prior.method !== "MOCK" || prior.allocations.some((item) => item.feeAccount.studentId !== studentId)) throw httpError(409, "DUPLICATE_IDEMPOTENCY_KEY");
    return { orderId: prior.reference };
  }
  const allocations = [{ feeAccountId: account.id, bucket: "DUES", amount: data.amount }];
  const orderId = `MOCK-${crypto.randomUUID()}`;
  await prisma.paymentAttempt.create({ data: {
    method: "MOCK", status: "PENDING", amount: data.amount,
    idempotencyKey: data.idempotencyKey, actedBy: `STUDENT:${studentId}`,
    reference: orderId,
    allocations: { create: allocations },
  } });
  return { orderId };
}

async function completeMockPayment(studentId, orderId, status) {
  const payment = await prisma.paymentAttempt.findUnique({
    where: { reference: orderId },
    include: { allocations: { include: { feeAccount: { select: { studentId: true, product: true } } } } },
  });
  if (!payment || payment.method !== "MOCK" || !payment.allocations.length || payment.allocations.some((item) => item.feeAccount.studentId !== studentId)) {
    throw httpError(404, "PAYMENT_ORDER_NOT_FOUND");
  }
  if (payment.status === status) return { orderId, status: payment.status, receiptNo: payment.receiptNo };
  if (payment.status !== "PENDING") throw httpError(409, "PAYMENT_ALREADY_COMPLETED");
  if (status === "FAILED") {
    const failed = await paymentService.failMockPayment(payment.id);
    return { orderId, status: failed.status };
  }
  for (const allocation of payment.allocations) {
    if (allocation.bucket === "DUES" && allocation.feeAccount.product === "ACADEMIC") {
      await ensureAcademicCoverage(studentId, allocation.feeAccountId, allocation.amount);
    }
  }
  const completed = await paymentService.completeMockPayment(payment.id);
  return { orderId, status: completed.status, receiptNo: completed.receiptNo };
}

async function chooseHostelSeat(studentId, hostelRateId) {
  const rate = await prisma.hostelRate.findUnique({ where: { id: hostelRateId } });
  if (!rate) throw httpError(404, "HOSTEL_RATE_NOT_FOUND");
  const existing = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      feeAccounts: {
        where: { product: "HOSTEL" },
        include: {
          ledgerEntries: {
            where: { entryType: "ASSESSMENT", component: "HOSTEL_FEE" },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!existing || existing.status !== "ACTIVE") throw httpError(404, "STUDENT_ACCOUNT_UNAVAILABLE");
  const billed = existing.feeAccounts.some((account) => account.ledgerEntries.length > 0);
  await prisma.$transaction(async (tx) => {
    const student = await tx.student.update({
      where: { id: studentId },
      data: { hostelRateId, isHosteller: true },
    });
    if (!billed) await assessStudent(tx, student, ["HOSTEL"]);
  });
  return getProfile(studentId);
}

module.exports = { requestOtp, verifyOtp, listReceipts, getStudentReceipt, getProfile, chooseHostelSeat, createStudentPayment, completeMockPayment, normalizePhoneNumber };
