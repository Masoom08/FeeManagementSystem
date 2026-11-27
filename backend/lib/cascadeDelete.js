const prisma = require("./prisma");
const { conflict, notFound } = require("./errors");

const txOptions = { maxWait: 15000, timeout: 60000 };

const DELETE_LABELS = {
  students: "Students",
  semesters: "Semesters",
  feeStructures: "Fee structures",
  feeAccounts: "Fee accounts",
  ledgerEntries: "Ledger entries",
  payments: "Payments",
  reminders: "Reminders",
};

const COMPONENT_LABELS = {
  ACADEMIC_FEE: "Academic fee",
  EXAM_FEE: "Exam fee",
  ACADEMIC_CAUTION: "Security money",
  HOSTEL_FEE: "Hostel fee",
  HOSTEL_SECURITY: "Hostel security",
};

function unique(values) {
  return [...new Set(values)];
}

function emptyImpact() {
  return {
    entity: "",
    id: 0,
    label: "",
    deletes: [],
    clears: [],
  };
}

function present(target, impact) {
  const hidden = new Set(target.hidden || []);
  return {
    entity: target.entity,
    id: target.id,
    label: target.label,
    deletes: Object.entries(impact.counts)
      .filter(([key, count]) => count > 0 && !hidden.has(key))
      .map(([key, count]) => ({ key, label: DELETE_LABELS[key], count })),
    clears: impact.clears,
  };
}

async function exclusivePaymentIds(db, accountIds) {
  if (!accountIds.length) return [];
  const [allocations, entries] = await Promise.all([
    db.paymentAllocation.findMany({
      where: { feeAccountId: { in: accountIds } },
      select: { paymentAttemptId: true },
    }),
    db.ledgerEntry.findMany({
      where: { feeAccountId: { in: accountIds }, paymentAttemptId: { not: null } },
      select: { paymentAttemptId: true },
    }),
  ]);
  const attemptIds = unique([
    ...allocations.map((row) => row.paymentAttemptId),
    ...entries.map((row) => row.paymentAttemptId),
  ]);
  if (!attemptIds.length) return [];
  const attempts = await db.paymentAttempt.findMany({
    where: { id: { in: attemptIds } },
    select: {
      id: true,
      allocations: { select: { feeAccountId: true } },
      ledgerEntries: { select: { feeAccountId: true } },
    },
  });
  const owned = new Set(accountIds);
  return attempts
    .filter(
      (attempt) =>
        attempt.allocations.every((row) => owned.has(row.feeAccountId)) &&
        attempt.ledgerEntries.every((row) => owned.has(row.feeAccountId))
    )
    .map((attempt) => attempt.id);
}

function clearMessages(count, phrase) {
  if (!count || !phrase) return [];
  const entry = count === 1 ? "entry stays" : "entries stay";
  const verb = count === 1 ? "is" : "are";
  return [
    {
      key: "semesterLinks",
      count,
      message: `${count} ledger ${entry}, but ${verb} no longer tied to ${phrase}`,
    },
  ];
}

async function collectImpact(db, spec) {
  const studentIds = unique(spec.studentIds || []);
  const semesterIds = unique(spec.semesterIds || []);
  const feeStructureIds = unique(spec.feeStructureIds || []);
  const studentAccounts = studentIds.length
    ? await db.feeAccount.findMany({ where: { studentId: { in: studentIds } }, select: { id: true } })
    : [];
  const accountIds = unique([...studentAccounts.map((row) => row.id), ...(spec.extraAccountIds || [])]);
  const [reminders, ledgerEntries, paymentAttemptIds, clearCount] = await Promise.all([
    studentIds.length ? db.reminder.count({ where: { studentId: { in: studentIds } } }) : 0,
    accountIds.length ? db.ledgerEntry.count({ where: { feeAccountId: { in: accountIds } } }) : 0,
    exclusivePaymentIds(db, accountIds),
    semesterIds.length
      ? db.ledgerEntry.count({
          where: {
            semesterId: { in: semesterIds },
            ...(accountIds.length ? { feeAccountId: { notIn: accountIds } } : {}),
          },
        })
      : 0,
  ]);

  return {
    studentIds,
    accountIds,
    feeStructureIds,
    semesterIds,
    paymentAttemptIds,
    counts: {
      students: studentIds.length,
      semesters: semesterIds.length,
      feeStructures: feeStructureIds.length,
      feeAccounts: accountIds.length,
      ledgerEntries,
      payments: paymentAttemptIds.length,
      reminders,
    },
    clears: clearMessages(clearCount, spec.clearPhrase),
  };
}

async function applyImpact(tx, impact) {
  const { studentIds, accountIds, feeStructureIds, semesterIds, paymentAttemptIds } = impact;
  if (studentIds.length) {
    await tx.reminder.deleteMany({ where: { studentId: { in: studentIds } } });
  }
  if (accountIds.length) {
    const entries = await tx.ledgerEntry.findMany({
      where: { feeAccountId: { in: accountIds } },
      select: { id: true },
    });
    const entryIds = entries.map((entry) => entry.id);
    if (entryIds.length) {
      await tx.ledgerEntry.updateMany({
        where: { relatedEntryId: { in: entryIds } },
        data: { relatedEntryId: null },
      });
    }
    await tx.paymentAllocation.deleteMany({ where: { feeAccountId: { in: accountIds } } });
    await tx.ledgerEntry.deleteMany({ where: { feeAccountId: { in: accountIds } } });
    await tx.feeAccount.deleteMany({ where: { id: { in: accountIds } } });
  }
  if (paymentAttemptIds.length) {
    await tx.paymentAttempt.deleteMany({ where: { id: { in: paymentAttemptIds } } });
  }
  if (feeStructureIds.length) {
    await tx.feeStructure.deleteMany({ where: { id: { in: feeStructureIds } } });
  }
  if (semesterIds.length) {
    await tx.ledgerEntry.updateMany({
      where: { semesterId: { in: semesterIds } },
      data: { semesterId: null },
    });
  }
  if (studentIds.length) {
    await tx.student.deleteMany({ where: { id: { in: studentIds } } });
  }
  if (semesterIds.length) {
    await tx.semester.deleteMany({ where: { id: { in: semesterIds } } });
  }
}

async function commit(loadTarget, after) {
  try {
    return await prisma.$transaction(async (tx) => {
      const target = await loadTarget(tx);
      const impact = await collectImpact(tx, target.spec);
      await applyImpact(tx, impact);
      if (after) await after(tx);
      return { deleted: true };
    }, txOptions);
  } catch (err) {
    if (err.status) throw err;
    if (err.code === "P2003" || err.code === "P2014") {
      throw conflict("DELETE_BLOCKED", [
        { path: "id", message: "Related records changed during delete. Refresh and try again." },
      ]);
    }
    throw err;
  }
}

async function previewOf(loadTarget) {
  const target = await loadTarget(prisma);
  const impact = await collectImpact(prisma, target.spec);
  return present(target, impact);
}

async function courseTarget(db, id) {
  const course = await db.course.findUnique({ where: { id } });
  if (!course) throw notFound("COURSE_NOT_FOUND");
  const [students, structures] = await Promise.all([
    db.student.findMany({ where: { courseId: id }, select: { id: true } }),
    db.feeStructure.findMany({ where: { courseId: id }, select: { id: true } }),
  ]);
  return {
    entity: "course",
    id,
    label: `${course.courseName} (${course.courseCode})`,
    hidden: [],
    spec: {
      studentIds: students.map((row) => row.id),
      feeStructureIds: structures.map((row) => row.id),
    },
  };
}

async function academicYearTarget(db, id) {
  const year = await db.academicYear.findUnique({ where: { id } });
  if (!year) throw notFound("ACADEMIC_YEAR_NOT_FOUND");
  const semesters = await db.semester.findMany({ where: { academicYearId: id }, select: { id: true } });
  const semesterIds = semesters.map((row) => row.id);
  const studentWhere = semesterIds.length
    ? { OR: [{ academicYearId: id }, { admissionSemesterId: { in: semesterIds } }] }
    : { academicYearId: id };
  const structureWhere = semesterIds.length
    ? { OR: [{ academicYearId: id }, { semesterId: { in: semesterIds } }] }
    : { academicYearId: id };
  const students = await db.student.findMany({ where: studentWhere, select: { id: true } });
  const studentIds = students.map((row) => row.id);
  const [structures, extraAccounts] = await Promise.all([
    db.feeStructure.findMany({ where: structureWhere, select: { id: true } }),
    db.feeAccount.findMany({
      where: {
        academicYearId: id,
        ...(studentIds.length ? { studentId: { notIn: studentIds } } : {}),
      },
      select: { id: true },
    }),
  ]);
  return {
    entity: "academicYear",
    id,
    label: year.label,
    hidden: [],
    spec: {
      studentIds,
      semesterIds,
      feeStructureIds: structures.map((row) => row.id),
      extraAccountIds: extraAccounts.map((row) => row.id),
      clearPhrase: "the deleted semesters",
    },
  };
}

async function semesterTarget(db, id) {
  const semester = await db.semester.findUnique({
    where: { id },
    include: { academicYear: true },
  });
  if (!semester) throw notFound("SEMESTER_NOT_FOUND");
  const [students, structures] = await Promise.all([
    db.student.findMany({ where: { admissionSemesterId: id }, select: { id: true } }),
    db.feeStructure.findMany({ where: { semesterId: id }, select: { id: true } }),
  ]);
  return {
    entity: "semester",
    id,
    label: `${semester.academicYear.label} · ${semester.name}`,
    hidden: ["semesters"],
    spec: {
      studentIds: students.map((row) => row.id),
      semesterIds: [id],
      feeStructureIds: structures.map((row) => row.id),
      clearPhrase: "this semester",
    },
  };
}

async function studentTarget(db, id) {
  const student = await db.student.findUnique({ where: { id } });
  if (!student) throw notFound();
  return {
    entity: "student",
    id,
    label: `${student.name} (${student.registrationNumber})`,
    hidden: ["students"],
    spec: { studentIds: [id] },
  };
}

async function feeStructureTarget(db, id) {
  const structure = await db.feeStructure.findUnique({
    where: { id },
    include: { course: true, academicYear: true, semester: true },
  });
  if (!structure) throw notFound("FEE_STRUCTURE_NOT_FOUND");
  return {
    entity: "feeStructure",
    id,
    label: `${structure.course.courseName} · ${structure.academicYear.label} · ${structure.semester.name} · ${COMPONENT_LABELS[structure.component] || structure.component} · Year ${structure.studyYear}`,
    spec: {},
  };
}

async function hostelRateTarget(db, id) {
  const rate = await db.hostelRate.findUnique({
    where: { id },
    include: { _count: { select: { students: true } } },
  });
  if (!rate) throw notFound("HOSTEL_RATE_NOT_FOUND");
  return {
    entity: "hostelRate",
    id,
    label: `${rate.condition} · ${rate.occupancy}`,
    studentCount: rate._count.students,
    spec: {},
  };
}

async function reminderTarget(db, id) {
  const reminder = await db.reminder.findUnique({ where: { id }, include: { student: true } });
  if (!reminder) throw notFound("REMINDER_NOT_FOUND");
  return {
    entity: "reminder",
    id,
    label: `${reminder.channel} reminder for ${reminder.student.name}`,
    spec: {},
  };
}

function simplePreview(loadTarget) {
  return async (id) => {
    const target = await loadTarget(prisma, id);
    return { ...emptyImpact(), entity: target.entity, id: target.id, label: target.label };
  };
}

function simpleDelete(model, loadTarget) {
  return async (id) => {
    await loadTarget(prisma, id);
    await prisma[model].delete({ where: { id } });
    return { deleted: true };
  };
}

module.exports = {
  previewCourse: (id) => previewOf((db) => courseTarget(db, id)),
  deleteCourse: (id) => commit((tx) => courseTarget(tx, id), (tx) => tx.course.delete({ where: { id } })),
  previewAcademicYear: (id) => previewOf((db) => academicYearTarget(db, id)),
  deleteAcademicYear: (id) =>
    commit((tx) => academicYearTarget(tx, id), (tx) => tx.academicYear.delete({ where: { id } })),
  previewSemester: (id) => previewOf((db) => semesterTarget(db, id)),
  deleteSemester: (id) => commit((tx) => semesterTarget(tx, id)),
  previewStudent: (id) => previewOf((db) => studentTarget(db, id)),
  deleteStudent: (id) => commit((tx) => studentTarget(tx, id)),
  previewFeeStructure: simplePreview(feeStructureTarget),
  deleteFeeStructure: simpleDelete("feeStructure", feeStructureTarget),
  previewHostelRate: async (id) => {
    const target = await hostelRateTarget(prisma, id);
    const selected = target.studentCount;
    return {
      ...emptyImpact(),
      entity: target.entity,
      id: target.id,
      label: target.label,
      clears: selected
        ? [{
            key: "hostelSeats",
            count: selected,
            message: `${selected} ${selected === 1 ? "student has" : "students have"} selected this rate. Delete is blocked until those selections change.`,
          }]
        : [],
    };
  },
  deleteHostelRate: async (id) => {
    const target = await hostelRateTarget(prisma, id);
    if (target.studentCount > 0) {
      throw conflict("HOSTEL_RATE_IN_USE", [
        { path: "id", message: "Students have selected this hostel rate." },
      ]);
    }
    await prisma.hostelRate.delete({ where: { id } });
    return { deleted: true };
  },
  previewReminder: simplePreview(reminderTarget),
  deleteReminder: simpleDelete("reminder", reminderTarget),
};
