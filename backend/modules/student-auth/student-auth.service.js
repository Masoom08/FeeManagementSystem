const prisma = require("../../lib/prisma");
const { httpError } = require("../../lib/errors");
const { issueStudentToken } = require("../auth/auth.service");
const { balances } = require("../../lib/balance");
const paymentService = require("../payment/payment.service");
const crypto = require("crypto");

const DEMO_OTP = "111111";
const OTP_TTL_MS = 5 * 60 * 1000;

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

  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const otpHash = crypto.createHash("sha256").update(DEMO_OTP).digest("hex");
  await prisma.$executeRaw`DELETE FROM student_otps WHERE expires_at <= CURRENT_TIMESTAMP(3)`;
  await prisma.$executeRaw`INSERT INTO student_otps (student_id, phone_number, otp_hash, expires_at, attempts)
    VALUES (${student.id}, ${normalizedPhone}, ${otpHash}, ${expiresAt}, 0)
    ON DUPLICATE KEY UPDATE student_id = VALUES(student_id), otp_hash = VALUES(otp_hash), expires_at = VALUES(expires_at), attempts = 0, created_at = CURRENT_TIMESTAMP(3)`;
  return {
    message: "OTP sent.",
    phoneNumber: normalizedPhone,
    otp: DEMO_OTP,
    expiresIn: OTP_TTL_MS / 1000,
  };
}

async function verifyOtp(phoneNumber, otp) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const pending = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`SELECT student_id AS studentId, otp_hash AS otpHash, expires_at AS expiresAt, attempts
      FROM student_otps WHERE phone_number = ${normalizedPhone} LIMIT 1`;
    const challenge = rows[0];
    if (!challenge) return null;
    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      await tx.$executeRaw`DELETE FROM student_otps WHERE phone_number = ${normalizedPhone}`;
      return null;
    }
    const suppliedHash = crypto.createHash("sha256").update(otp).digest();
    const storedHash = Buffer.from(challenge.otpHash, "hex");
    const matches = storedHash.length === suppliedHash.length && crypto.timingSafeEqual(storedHash, suppliedHash);
    if (!matches) {
      if (challenge.attempts + 1 >= 5) {
        await tx.$executeRaw`DELETE FROM student_otps WHERE phone_number = ${normalizedPhone}`;
      } else {
        await tx.$executeRaw`UPDATE student_otps SET attempts = attempts + 1 WHERE phone_number = ${normalizedPhone}`;
      }
      return null;
    }
    await tx.$executeRaw`DELETE FROM student_otps WHERE phone_number = ${normalizedPhone}`;
    return challenge;
  });
  if (!pending) {
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
      batch: { select: { label: true } },
      session: { select: { label: true } },
    },
  });
  if (!student || student.phoneNumber.replace(/\D/g, "").slice(-10) !== normalizedPhone) {
    throw httpError(401, "STUDENT_ACCOUNT_UNAVAILABLE");
  }

  return { ...issueStudentToken(student.id), student };
}

async function listReceipts(studentId) {
  const payments = await prisma.paymentAttempt.findMany({
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
              ledgerEntries: { include: { semester: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  return payments.map((payment) => {
    const allocations = payment.allocations;
    const semesterNumbers = allocations.flatMap((allocation) =>
      allocation.feeAccount.ledgerEntries
        .filter((entry) => entry.paymentAttemptId === payment.id && entry.semester?.name)
        .map((entry) => Number(entry.semester.name.match(/\d+/)?.[0]))
        .filter(Number.isFinite)
    );
    return {
      receiptNo: payment.receiptNo,
      paymentId: payment.id,
      amount: allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      paidOn: payment.paidOn,
      method: payment.method,
      semesters: [...new Set(semesterNumbers)].sort((a, b) => a - b),
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
    include: { course: true, batch: true, session: true, feeAccounts: { include: { ledgerEntries: { include: { semester: true }, orderBy: { id: "asc" } } } } },
  });
  if (!student || student.status !== "ACTIVE") throw httpError(404, "STUDENT_ACCOUNT_UNAVAILABLE");
  const semesters = new Map();
  for (const account of student.feeAccounts.filter((item) => item.product === "ACADEMIC")) {
    for (const entry of account.ledgerEntries) {
      if (!entry.semester) continue;
      const number = Number(entry.semester.name.match(/\d+/)?.[0]);
      if (!Number.isFinite(number)) continue;
      const row = semesters.get(number) || { semester: number, fee: 0, paid: 0, dueDate: entry.semester.dueDate, receiptNo: undefined, paymentDate: null };
      if (entry.entryType === "ASSESSMENT") row.fee += entry.amount;
      if (entry.entryType === "PAYMENT" && entry.bucket === "DUES") {
        row.paid += entry.amount;
        row.paymentDate = entry.effectiveDate;
        if (entry.paymentAttemptId) {
          const attempt = await prisma.paymentAttempt.findUnique({ where: { id: entry.paymentAttemptId }, select: { receiptNo: true } });
          row.receiptNo = attempt?.receiptNo || row.receiptNo;
        }
      }
      semesters.set(number, row);
    }
  }
  return {
    student: { id: student.id, name: student.name, registrationNo: student.registrationNumber, phone: student.phoneNumber, course: student.course.courseName, batch: student.batch.label, session: student.session.label, year: student.studyYear },
    fees: [...semesters.values()].sort((a, b) => a.semester - b.semester).map((row) => ({
      ...row,
      status: row.paid >= row.fee && row.fee > 0 ? "Paid" : row.dueDate > new Date() ? "Upcoming" : "Due",
    })),
    accounts: student.feeAccounts.map((account) => ({ id: account.id, product: account.product, ...balances(account.ledgerEntries) })),
  };
}

async function createStudentPayment(studentId, data) {
  const account = await prisma.feeAccount.findFirst({ where: { studentId, product: "ACADEMIC" } });
  if (!account) throw httpError(404, "FEE_ACCOUNT_NOT_FOUND");
  const rows = await getProfile(studentId);
  const payable = rows.fees.filter((fee) => fee.status !== "Paid");
  const maxAmount = payable.reduce((total, fee) => total + Math.max(0, fee.fee - fee.paid), 0);
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
    include: { allocations: { include: { feeAccount: { select: { studentId: true } } } } },
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
  const completed = await paymentService.completeMockPayment(payment.id);
  return { orderId, status: completed.status, receiptNo: completed.receiptNo };
}

module.exports = { requestOtp, verifyOtp, listReceipts, getStudentReceipt, getProfile, createStudentPayment, completeMockPayment, normalizePhoneNumber };
