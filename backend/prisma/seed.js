require("../config/database-url");

const prisma = require("../lib/prisma");
const { pool } = require("../config/db");
const { hashPassword } = require("../modules/auth/auth.service");

const seedActor = "FRONTEND-DEMO-SEED";
const courseDefinitions = [
  { name: "BBA (LU)", code: "BLU", fee: 24500, affiliation: "LU", duration: 3 },
  { name: "B.Com (Hons.)", code: "BCM", fee: 22000, affiliation: "LU", duration: 3 },
  { name: "BBA (AKTU)", code: "BAK", fee: 26000, affiliation: "AKTU", duration: 3 },
  { name: "MBA (AKTU)", code: "MBAAK", fee: 32000, affiliation: "AKTU", duration: 2 },
];
const studentDefinitions = [
  { registrationNumber: "ICM2026BAK01", name: "Masoom Singh", phoneNumber: "9454716083", batch: 2026, courseName: "BBA (AKTU)", studyYear: 1, semesterNumber: 1, paid: true },
  { registrationNumber: "ICM2026BAK02", name: "Demo Student 2", phoneNumber: "9454716084", batch: 2026, courseName: "BBA (AKTU)", studyYear: 1, semesterNumber: 1, paid: false },
  { registrationNumber: "ICM2025BLU01", name: "Demo Student 3", phoneNumber: "9454716085", batch: 2025, courseName: "BBA (LU)", studyYear: 2, semesterNumber: 3, paid: true },
  { registrationNumber: "ICM2025MBAAK01", name: "Demo Student 4", phoneNumber: "9454716086", batch: 2025, courseName: "MBA (AKTU)", studyYear: 2, semesterNumber: 3, paid: false },
  { registrationNumber: "ICM2024BCM01", name: "Demo Student 5", phoneNumber: "9454716087", batch: 2024, courseName: "B.Com (Hons.)", studyYear: 3, semesterNumber: 5, paid: true },
  { registrationNumber: "ICM2024BCM02", name: "Demo Student 6", phoneNumber: "9454716088", batch: 2024, courseName: "B.Com (Hons.)", studyYear: 3, semesterNumber: 5, paid: false },
];
const legacySeedCoursesByBatch = {
  2026: ["BLU", "BCM", "MBA", "BAK"],
  2025: ["BLU", "BCM", "MBA", "BAK"],
  2024: ["BLU", "BCM", "BAK"],
};
const legacySeedRegistrationNumbers = [
  ...studentDefinitions.map((student) => student.registrationNumber),
  ...Object.entries(legacySeedCoursesByBatch).flatMap(([batch, codes]) =>
  codes.flatMap((code) => Array.from({ length: 10 }, (_, index) => `ICM${batch}${code}${String(index + 1).padStart(2, "0")}`))
  ),
];
const hostelRates = [
  { condition: "AC", occupancy: "Single seater", annualFee: 90000 },
  { condition: "AC", occupancy: "Double seater", annualFee: 65000 },
  { condition: "AC", occupancy: "Triple seater", annualFee: 55000 },
  { condition: "Non-AC", occupancy: "Single seater", annualFee: 70000 },
  { condition: "Non-AC", occupancy: "Double seater", annualFee: 50000 },
  { condition: "Non-AC", occupancy: "Triple seater", annualFee: 40000 },
];

function date(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function semesterDueDate(sessionYear, semesterNumber) {
  const month = semesterNumber % 2 === 1 ? 9 : 2;
  const year = sessionYear + (semesterNumber % 2 === 1 ? 0 : 1);
  return date(`${year}-${String(month).padStart(2, "0")}-10`);
}

function paymentDate(sessionYear, semesterNumber, index) {
  const month = semesterNumber % 2 === 1 ? 9 : 2;
  const year = sessionYear + (semesterNumber % 2 === 1 ? 0 : 1);
  const day = ((index * 3 + semesterNumber * 2) % 10) + 1;
  return date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}


async function seedCourses() {
  const duplicateMba = await prisma.course.findUnique({
    where: { courseCode: "MBA" },
    include: { _count: { select: { students: true } } },
  });

  if (duplicateMba) {
    if (duplicateMba._count.students > 0) {
      throw new Error(
        "Cannot remove the duplicate MBA course while students are assigned to it. Move those students to MBA (AKTU) first."
      );
    }

    await prisma.feeStructure.deleteMany({
      where: { courseId: duplicateMba.id },
    });

    await prisma.course.delete({ where: { id: duplicateMba.id } });
  }

  const result = new Map();

  for (const definition of courseDefinitions) {
    const lateFeePerDay = definition.name.startsWith("MBA") ? 10 : 5;

    const course = await prisma.course.upsert({
      where: { courseCode: definition.code },

      update: {
        courseName: definition.name,
        affiliation: definition.affiliation,
        durationYears: definition.duration,
        lateFeePerDay,
      },

      create: {
        courseCode: definition.code,
        courseName: definition.name,
        affiliation: definition.affiliation,
        durationYears: definition.duration,
        lateFeePerDay,
      },
    });

    const isMba = definition.name.startsWith("MBA");

    for (const [semesterType, month] of [
      ["ODD", isMba ? 5 : 6],
      ["EVEN", isMba ? 11 : 1],
    ]) {
      await prisma.$executeRaw`
        INSERT INTO course_fee_deadlines
          (course_id, semester_type, month, day)
        VALUES (${course.id}, ${semesterType}, ${month}, 10)
        ON DUPLICATE KEY UPDATE
          month = VALUES(month),
          day = VALUES(day)
      `;
    }

    result.set(definition.name, { ...definition, id: course.id });
  }

  return result;
}


async function seedSessions() {
  const result = new Map();
  for (const sessionYear of [2024, 2025, 2026, 2027, 2028]) {
    const label = `${sessionYear}-${String(sessionYear + 1).slice(-2)}`;
    const session = await prisma.session.upsert({
      where: { label },
      update: { startDate: date(`${sessionYear}-08-01`), endDate: date(`${sessionYear + 1}-07-31`) },
      create: {
        label,
        startDate: date(`${sessionYear}-08-01`),
        endDate: date(`${sessionYear + 1}-07-31`),
      },
    });
    result.set(sessionYear, session);
  }
  return result;
}

async function seedBatches(courses) {
  const result = new Map();

  for (const startYear of [2024, 2025, 2026]) {
    for (const course of courses.values()) {
      const endYear = startYear + course.duration;
      const label = `${startYear}-${String(endYear).slice(-2)}`;

      const batch = await prisma.batch.upsert({
        where: {
          courseId_label: {
            courseId: course.id,
            label,
          },
        },
        update: {
          startDate: date(`${startYear}-08-01`),
          endDate: date(`${endYear}-07-31`),
        },
        create: {
          courseId: course.id,
          label,
          startDate: date(`${startYear}-08-01`),
          endDate: date(`${endYear}-07-31`),
        },
      });

      result.set(`${course.id}:${startYear}`, batch);
    }
  }

  return result;
}

async function seedSemesters(sessions) {
  const result = new Map();
  for (const [sessionYear, session] of sessions) {
    const rows = [];
    for (let number = 1; number <= 6; number += 1) {
      const dueDate = semesterDueDate(sessionYear, number);
      rows.push(await prisma.semester.upsert({
        where: { sessionId_name: { sessionId: session.id, name: `Semester ${number}` } },
        update: { dueDate, graceDays: 0 },
        create: { sessionId: session.id, name: `Semester ${number}`, dueDate, graceDays: 0 },
      }));
    }
    result.set(sessionYear, rows);
  }
  return result;
}
async function seedStructures(courses, sessions, semesters) {
  for (const [sessionYear, session] of sessions) {
    for (const course of courses.values()) {
      for (
        let semesterNumber = 1;
        semesterNumber <= course.duration * 2;
        semesterNumber += 1
      ) {
        const studyYear = Math.floor((semesterNumber - 1) / 2) + 1;
        const semester = semesters.get(sessionYear)[semesterNumber - 1];

        await prisma.feeStructure.upsert({
          where: {
            courseId_sessionId_semesterId_component_studyYear: {
              courseId: course.id,
              sessionId: session.id,
              semesterId: semester.id,
              component: "ACADEMIC_FEE",
              studyYear,
            },
          },
          update: {
            amount: course.fee,
          },
          create: {
            courseId: course.id,
            sessionId: session.id,
            semesterId: semester.id,
            component: "ACADEMIC_FEE",
            studyYear,
            amount: course.fee,
          },
        });
      }
    }
  }
}

async function seedHostelRates() {
  for (const rate of hostelRates) {
    await prisma.hostelRate.upsert({
      where: {
        condition_occupancy: {
          condition: rate.condition,
          occupancy: rate.occupancy,
        },
      },
      update: {
        annualFee: rate.annualFee,
      },
      create: rate,
    });
  }
}

async function seedUsers() {
  const passwordHash = await hashPassword("12345678");

  for (const user of [
    { email: "admin@gmail.com", role: "ADMIN" },
    { email: "superadmin@gmail.com", role: "SUPERADMIN" },
  ]) {
    await pool.execute(
      `INSERT INTO users (email, password_hash, role, active)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE
         password_hash = VALUES(password_hash),
         role = VALUES(role),
         active = TRUE`,
      [user.email, passwordHash, user.role]
    );
  }
}

async function seedStudents(courses, batches, sessions, semesters) {
  const legacyStudents = await prisma.student.findMany({
    where: {
      registrationNumber: {
        in: legacySeedRegistrationNumbers,
      },
    },
    select: {
      id: true,
    },
  });

  // Remove only the known demo students and their associated records.
  const studentIds = legacyStudents.map((student) => student.id);

  if (studentIds.length) {
    const accounts = await prisma.feeAccount.findMany({
      where: {
        studentId: {
          in: studentIds,
        },
      },
      select: {
        id: true,
      },
    });

    const accountIds = accounts.map((account) => account.id);

    await prisma.$transaction(async (tx) => {
      await tx.reminder.deleteMany({
        where: {
          studentId: {
            in: studentIds,
          },
        },
      });

      if (accountIds.length) {
        const allocations = await tx.paymentAllocation.findMany({
          where: {
            feeAccountId: {
              in: accountIds,
            },
          },
          select: {
            paymentAttemptId: true,
          },
        });

        const attemptIds = [
          ...new Set(
            allocations.map((item) => item.paymentAttemptId)
          ),
        ];

        await tx.paymentAllocation.deleteMany({
          where: {
            feeAccountId: {
              in: accountIds,
            },
          },
        });

        const ledgerEntries = await tx.ledgerEntry.findMany({
          where: {
            feeAccountId: {
              in: accountIds,
            },
          },
          select: {
            id: true,
          },
        });

        const ledgerEntryIds = ledgerEntries.map(
          (entry) => entry.id
        );

        if (ledgerEntryIds.length) {
          await tx.ledgerEntry.updateMany({
            where: {
              relatedEntryId: {
                in: ledgerEntryIds,
              },
            },
            data: {
              relatedEntryId: null,
            },
          });
        }

        await tx.ledgerEntry.deleteMany({
          where: {
            feeAccountId: {
              in: accountIds,
            },
          },
        });

        await tx.feeAccount.deleteMany({
          where: {
            id: {
              in: accountIds,
            },
          },
        });

        if (attemptIds.length) {
          await tx.paymentAttempt.deleteMany({
            where: {
              id: {
                in: attemptIds,
              },
            },
          });
        }
      }

      await tx.student.deleteMany({
        where: {
          id: {
            in: studentIds,
          },
        },
      });
    });
  }

  for (const definition of studentDefinitions) {
    const {
      batch,
      courseName,
      semesterNumber,
    } = definition;

    const course = courses.get(courseName);

    if (!course) {
      throw new Error(`Course not found: ${courseName}`);
    }

    const batchRecord = batches.get(`${course.id}:${batch}`);

    if (!batchRecord) {
      throw new Error(
        `Batch not found for ${courseName}, ${batch}`
      );
    }

    const currentSessionYear = batch + definition.studyYear - 1;
    const currentSession = sessions.get(currentSessionYear);

    if (!currentSession) {
      throw new Error(
        `Session not found: ${currentSessionYear}`
      );
    }

    const currentSemesterNumber =
      (definition.studyYear - 1) * 2 + 1;

    const admissionSemesters = semesters.get(currentSessionYear);

    const admissionSemester =
      admissionSemesters?.[currentSemesterNumber - 1];

    if (!admissionSemester) {
      throw new Error(
        `Admission semester not found for ${definition.registrationNumber}`
      );
    }

    const student = await prisma.student.create({
      data: {
        registrationNumber: definition.registrationNumber,
        enrolmentNumber: `ENR-${definition.registrationNumber}`,
        name: definition.name,
        whatsappNumber: definition.phoneNumber,
        phoneNumber: definition.phoneNumber,
        email: `${definition.registrationNumber.toLowerCase()}@example.com`,
        fatherName: "Demo Parent",
        branch: course.name,
        courseId: course.id,
        batchId: batchRecord.id,
        sessionId: currentSession.id,
        admissionSemesterId: admissionSemester.id,
        admissionType: "DIRECT",
        isHosteller: false,
        studyYear: definition.studyYear,
        status: "ACTIVE",
      },
    });

    const accounts = new Map();

    for (
      let currentSemester = 1;
      currentSemester <= course.duration * 2;
      currentSemester += 1
    ) {
      const semesterSessionYear =
        batch + Math.floor((currentSemester - 1) / 2);

      const semesterSession = sessions.get(semesterSessionYear);

      const semester =
        semesters.get(semesterSessionYear)?.[currentSemester - 1];

      if (!semesterSession || !semester) {
        throw new Error(
          `Semester ${currentSemester} not found for ${definition.registrationNumber}`
        );
      }

      let account = accounts.get(semesterSessionYear);

      if (!account) {
        account = await prisma.feeAccount.create({
          data: {
            studentId: student.id,
            product: "ACADEMIC",
            sessionId: semesterSession.id,
          },
        });

        accounts.set(semesterSessionYear, account);
      }

      await prisma.ledgerEntry.create({
        data: {
          feeAccountId: account.id,
          semesterId: semester.id,
          bucket: "DUES",
          entryType: "ASSESSMENT",
          direction: "INCREASE",
          amount: course.fee,
          component: "ACADEMIC_FEE",
          effectiveDate: semesterDueDate(
            semesterSessionYear,
            currentSemester
          ),
          actedBy: seedActor,
          reason: "Demo semester fee",
        },
      });

      const shouldMarkPaid =
        currentSemester < semesterNumber ||
        (currentSemester === semesterNumber && definition.paid);

      if (shouldMarkPaid) {
        const paidOn = paymentDate(
          semesterSessionYear,
          currentSemester,
          0
        );

        const paymentReference =
          `SEED-${definition.registrationNumber}-${currentSemester}`;

        const attempt = await prisma.paymentAttempt.create({
          data: {
            method: "HDFC",
            status: "SUCCESS",
            amount: course.fee,
            idempotencyKey: paymentReference,
            reference: paymentReference,
            receiptNo:
              `RCPT-${definition.registrationNumber}-${String(currentSemester).padStart(2, "0")}`,
            actedBy: seedActor,
            paidOn,
            allocations: {
              create: [
                {
                  feeAccountId: account.id,
                  bucket: "DUES",
                  amount: course.fee,
                },
              ],
            },
          },
        });

        await prisma.ledgerEntry.create({
          data: {
            feeAccountId: account.id,
            semesterId: semester.id,
            bucket: "DUES",
            entryType: "PAYMENT",
            direction: "DECREASE",
            amount: course.fee,
            component: "ACADEMIC_FEE",
            effectiveDate: paidOn,
            actedBy: seedActor,
            reason: "Demo semester payment",
            paymentAttemptId: attempt.id,
          },
        });
      }
    }
  }

  return studentDefinitions.length;
}

async function main() {
  await seedUsers();
  const courses = await seedCourses();
  const sessions = await seedSessions();
  const batches = await seedBatches(courses);
  const semesters = await seedSemesters(sessions);
  await seedStructures(courses, sessions, semesters);
  await seedHostelRates();
  const studentCount = await seedStudents(courses, batches, sessions, semesters);
  console.log(`Frontend demo seed complete: ${studentCount} students, ${hostelRates.length} hostel rates.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });