const prisma = require("../../lib/prisma");
const { badRequest, conflict, notFound } = require("../../lib/errors");
const { balances, principalOutstanding } = require("../../lib/balance");
const { parseISODate, todayUTC } = require("../../lib/dates");
const { componentFor } = require("../fee/assess");

const paymentInclude = {
  allocations: { orderBy: { id: "asc" } },
  ledgerEntries: { orderBy: { id: "asc" } },
};

function duplicatePaymentError(err) {
  const target = JSON.stringify(err.meta?.target || "");
  if (target.includes("idempotency")) {
    return conflict("DUPLICATE_IDEMPOTENCY_KEY");
  }
  if (target.includes("reference")) {
    return conflict("DUPLICATE_REFERENCE");
  }
  return conflict("DUPLICATE_PAYMENT");
}

async function assertAllocationsFit(allocations, db) {
  for (const allocation of allocations) {
    const account = await db.feeAccount.findUnique({
      where: { id: allocation.feeAccountId },
      include: { ledgerEntries: true },
    });
    if (!account) {
      throw notFound("FEE_ACCOUNT_NOT_FOUND");
    }
    const room = balances(account.ledgerEntries);
    const outstanding = allocation.bucket === "DUES" ? room.duesOutstanding : room.depositOutstanding;
    if (allocation.amount > outstanding) {
      throw badRequest("AMOUNT_EXCEEDS_BALANCE", [
        { path: "allocations", message: `amount exceeds ${allocation.bucket} outstanding` },
      ]);
    }
  }
}

async function settleTx(tx, payment, paidOn) {
  const current = await tx.paymentAttempt.findUnique({
    where: { id: payment.id },
    include: paymentInclude,
  });
  if (!current) {
    throw notFound();
  }
  if (current.status === "SUCCESS") {
    return current;
  }
  if (current.status !== "PENDING") {
    throw conflict("PAYMENT_NOT_PENDING");
  }
  await assertAllocationsFit(current.allocations, tx);
  for (const allocation of current.allocations) {
    const account = await tx.feeAccount.findUnique({
      where: { id: allocation.feeAccountId },
      include: { student: true },
    });
    const baseEntry = {
      feeAccountId: allocation.feeAccountId,
      bucket: allocation.bucket,
      entryType: "PAYMENT",
      direction: allocation.bucket === "DUES" ? "DECREASE" : "INCREASE",
      component: componentFor(account.product, allocation.bucket),
      effectiveDate: paidOn,
      actedBy: current.actedBy || "HDFC",
      reason: `${current.method} payment`,
      paymentAttemptId: current.id,
    };
    if (allocation.bucket !== "DUES") {
      await tx.ledgerEntry.create({ data: { ...baseEntry, semesterId: account.student.admissionSemesterId, amount: allocation.amount } });
      continue;
    }
    const ledger = await tx.ledgerEntry.findMany({ where: { feeAccountId: allocation.feeAccountId, bucket: "DUES" }, orderBy: [{ semesterId: "asc" }, { id: "asc" }] });
    const semesterIds = [...new Set(ledger.map((entry) => entry.semesterId).filter(Boolean))].sort((a, b) => a - b);
    let remaining = allocation.amount;
    for (const semesterId of semesterIds) {
      const outstanding = principalOutstanding(ledger, semesterId);
      const amount = Math.min(remaining, outstanding);
      if (amount > 0) {
        await tx.ledgerEntry.create({ data: { ...baseEntry, semesterId, amount } });
        remaining -= amount;
      }
      if (!remaining) break;
    }
    if (remaining > 0) await tx.ledgerEntry.create({ data: { ...baseEntry, semesterId: account.student.admissionSemesterId, amount: remaining } });
  }
  const receiptNo = `RCPT-${String(current.id).padStart(6, "0")}`;
  await tx.paymentAttempt.update({
    where: { id: current.id },
    data: { status: "SUCCESS", receiptNo, paidOn },
  });
  return tx.paymentAttempt.findUnique({
    where: { id: current.id },
    include: paymentInclude,
  });
}

async function createPayment(data) {
  const amount = data.allocations.reduce((sum, item) => sum + item.amount, 0);
  await assertAllocationsFit(data.allocations, prisma);
  const reference = data.reference || data.idempotencyKey;
  const paidOn = data.paidOn ? parseISODate(data.paidOn) : todayUTC();
  try {
    if (data.method === "CASH") {
      return await prisma.transaction(async (tx) => {
        const payment = await tx.paymentAttempt.create({
          data: {
            method: "CASH",
            status: "PENDING",
            amount,
            reference,
            idempotencyKey: data.idempotencyKey,
            actedBy: data.actedBy,
            allocations: { create: data.allocations },
          },
        });
        return settleTx(tx, payment, paidOn);
      });
    }
    return await prisma.paymentAttempt.create({
      data: {
        method: data.method,
        status: "PENDING",
        amount,
        reference,
        idempotencyKey: data.idempotencyKey,
        actedBy: data.actedBy || null,
        allocations: { create: data.allocations },
      },
      include: paymentInclude,
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw duplicatePaymentError(err);
    }
    throw err;
  }
}

async function callback(id, data) {
  return prisma.transaction(async (tx) => {
    const payment = await tx.paymentAttempt.findUnique({
      where: { id },
      include: paymentInclude,
    });
    if (!payment) {
      throw notFound();
    }
    if (payment.method !== "HDFC") {
      throw conflict("CALLBACK_NOT_ALLOWED");
    }
    if (payment.status === "SUCCESS") {
      if (data.status === "SUCCESS") {
        return payment;
      }
      throw conflict("PAYMENT_ALREADY_SUCCESS");
    }
    if (data.status === "FAILED") {
      return tx.paymentAttempt.update({
        where: { id },
        data: { status: "FAILED" },
        include: paymentInclude,
      });
    }
    return settleTx(tx, payment, data.paidOn ? parseISODate(data.paidOn) : todayUTC());
  });
}

async function verify(id, data) {
  return prisma.transaction(async (tx) => {
    const payment = await tx.paymentAttempt.findUnique({
      where: { id },
      include: paymentInclude,
    });
    if (!payment) {
      throw notFound();
    }
    if (payment.method !== "CHALLAN") {
      throw conflict("VERIFY_NOT_ALLOWED");
    }
    if (payment.status === "SUCCESS") {
      return payment;
    }
    if (data.actedBy) {
      await tx.paymentAttempt.update({ where: { id }, data: { actedBy: data.actedBy } });
      payment.actedBy = data.actedBy;
    }
    return settleTx(tx, payment, data.paidOn ? parseISODate(data.paidOn) : todayUTC());
  });
}

async function completeMockPayment(id) {
  return prisma.transaction(async (tx) => {
    const payment = await tx.paymentAttempt.findUnique({ where: { id }, include: paymentInclude });
    if (!payment) throw notFound("PAYMENT_ORDER_NOT_FOUND");
    if (payment.method !== "MOCK") throw conflict("MOCK_PAYMENT_ONLY");
    return settleTx(tx, payment, todayUTC());
  });
}

async function failMockPayment(id) {
  return prisma.transaction(async (tx) => {
    const payment = await tx.paymentAttempt.findUnique({ where: { id }, include: paymentInclude });
    if (!payment) throw notFound("PAYMENT_ORDER_NOT_FOUND");
    if (payment.method !== "MOCK") throw conflict("MOCK_PAYMENT_ONLY");
    if (payment.status === "FAILED") return payment;
    if (payment.status !== "PENDING") throw conflict("PAYMENT_ALREADY_COMPLETED");
    return tx.paymentAttempt.update({ where: { id }, data: { status: "FAILED" }, include: paymentInclude });
  });
}

async function getReceipt(paymentId) {
  const payment = await prisma.paymentAttempt.findUnique({
    where: { id: paymentId },
    include: {
      allocations: {
        orderBy: { id: "asc" },
        include: {
          feeAccount: {
            include: {
              student: {
                include: {
                  course: true,
                  academicYear: true,
                  admissionSemester: { select: { name: true } },
                },
              },
              ledgerEntries: {
                include: { semester: { select: { name: true } } },
                orderBy: { id: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!payment) {
    throw notFound();
  }
  if (payment.status !== "SUCCESS") {
    throw conflict("RECEIPT_NOT_AVAILABLE");
  }
  return {
    receiptNo: payment.receiptNo,
    paymentId: payment.id,
    amount: payment.amount,
    paidOn: payment.paidOn,
    method: payment.method,
    allocations: payment.allocations.map((allocation) => {
      const student = allocation.feeAccount.student;
      const paymentEntry = allocation.feeAccount.ledgerEntries.find(
        (entry) => entry.paymentAttemptId === payment.id && entry.bucket === allocation.bucket
      );
      return {
        id: allocation.id,
        feeAccountId: allocation.feeAccountId,
        bucket: allocation.bucket,
        amount: allocation.amount,
        product: allocation.feeAccount.product,
        balanceOutstanding: balances(allocation.feeAccount.ledgerEntries).duesOutstanding,
        semesterName: paymentEntry?.semester?.name || student.admissionSemester?.name || null,
        student: {
          id: student.id,
          name: student.name,
          registrationNumber: student.registrationNumber,
          phoneNumber: student.phoneNumber,
          courseName: student.course.courseName,
          affiliation: student.course.affiliation,
          batch: student.academicYear.label,
        },
      };
    }),
  };
}

module.exports = {
  createPayment,
  callback,
  verify,
  completeMockPayment,
  failMockPayment,
  getReceipt,
};
