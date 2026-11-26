const { todayUTC } = require("../../lib/dates");

const DEPOSIT_COMPONENTS = new Set(["ACADEMIC_CAUTION", "HOSTEL_SECURITY"]);

function productFor(component) {
  return component.startsWith("HOSTEL") ? "HOSTEL" : "ACADEMIC";
}

async function ensureAccount(tx, student, product) {
  const where = {
    studentId_product_sessionId: {
      studentId: student.id,
      product,
      sessionId: student.sessionId,
    },
  };
  const existing = await tx.feeAccount.findUnique({ where });
  if (existing) {
    return existing;
  }
  return tx.feeAccount.create({
    data: {
      studentId: student.id,
      product,
      sessionId: student.sessionId,
    },
  });
}

async function assessStudent(tx, student, products) {
  const structures = await tx.feeStructure.findMany({
    where: {
      courseId: student.courseId,
      sessionId: student.sessionId,
      semesterId: student.admissionSemesterId,
      studyYear: student.studyYear,
    },
  });

  const applicable = structures.filter((row) => {
    const product = productFor(row.component);
    if (!products.includes(product)) {
      return false;
    }
    if (DEPOSIT_COMPONENTS.has(row.component) && student.studyYear !== 1) {
      return false;
    }
    if (product === "HOSTEL" && !student.isHosteller) {
      return false;
    }
    return true;
  });

  for (const product of products) {
    if (product === "HOSTEL" && !student.isHosteller) {
      continue;
    }
    const account = await ensureAccount(tx, student, product);
    const rows = applicable.filter((row) => productFor(row.component) === product);
    for (const row of rows) {
      if (row.component === "HOSTEL_FEE" && student.hostelRateId) {
        continue;
      }
      await postAssessment(tx, account, student, row.component, row.amount);
    }
    if (product === "HOSTEL" && student.hostelRateId) {
      const rate = await tx.hostelRate.findUnique({ where: { id: student.hostelRateId } });
      if (rate) {
        await postAssessment(tx, account, student, "HOSTEL_FEE", rate.annualFee);
      }
    }
  }
}

async function postAssessment(tx, account, student, component, amount) {
  const existing = await tx.ledgerEntry.findFirst({
    where: {
      feeAccountId: account.id,
      semesterId: student.admissionSemesterId,
      entryType: "ASSESSMENT",
      component,
    },
  });
  if (existing) {
    return;
  }
  await tx.ledgerEntry.create({
    data: {
      feeAccountId: account.id,
      semesterId: student.admissionSemesterId,
      bucket: DEPOSIT_COMPONENTS.has(component) ? "DEPOSIT" : "DUES",
      entryType: "ASSESSMENT",
      direction: "INCREASE",
      amount,
      component,
      effectiveDate: todayUTC(),
      actedBy: "system",
      reason: "Fee assessment",
    },
  });
}

function componentFor(product, bucket) {
  if (product === "HOSTEL") {
    return bucket === "DUES" ? "HOSTEL_FEE" : "HOSTEL_SECURITY";
  }
  return bucket === "DUES" ? "ACADEMIC_FEE" : "ACADEMIC_CAUTION";
}

module.exports = {
  assessStudent,
  componentFor,
};
