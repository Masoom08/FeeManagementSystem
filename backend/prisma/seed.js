require("../config/database-url");

const prisma = require("../lib/prisma");
const { pool } = require("../config/db");
const { hashPassword } = require("../modules/auth/auth.service");

const seedActor = "FRONTEND-DEMO-SEED";
const courseDefinitions = [
  { name: "BBA (LU)", code: "BLU", fee: 24500, affiliation: "LU", duration: 3 },
  { name: "B.Com (Hons.)", code: "BCM", fee: 22000, affiliation: "LU", duration: 3 },
  { name: "MBA", code: "MBA", fee: 32000, affiliation: "LU", duration: 2 },
  { name: "BBA (AKTU)", code: "BAK", fee: 26000, affiliation: "AKTU", duration: 3 },
  { name: "MBA (AKTU)", code: "MBAAK", fee: 32000, affiliation: "AKTU", duration: 2 },
];
const coursesByBatch = {
  2026: ["BBA (AKTU)"],
  2025: ["BBA (LU)", "MBA (AKTU)"],
  2024: ["B.Com (Hons.)"],
};
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

function semesterDueDate(batch, semesterNumber) {
  const month = semesterNumber % 2 === 1 ? 6 : 1;
  const year = batch + Math.floor((semesterNumber - 1) / 2) + (semesterNumber % 2 === 0 ? 1 : 0);
  return date(`${year}-${String(month).padStart(2, "0")}-10`);
}

function paymentDate(batch, semesterNumber, index) {
  const month = semesterNumber % 2 === 1 ? 6 : 1;
  const year = batch + Math.floor((semesterNumber - 1) / 2) + (semesterNumber % 2 === 0 ? 1 : 0);
  const day = ((index * 3 + semesterNumber * 2) % 10) + 1;
  return date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

async function seedCourses() {
  const result = new Map();
  for (const definition of courseDefinitions) {
    const course = await prisma.course.upsert({
      where: { courseCode: definition.code },
      update: { courseName: definition.name, affiliation: definition.affiliation },
      create: {
        courseCode: definition.code,
        courseName: definition.name,
        affiliation: definition.affiliation,
        lateFeePerDay: 0,
      },
    });
    result.set(definition.name, { ...definition, id: course.id });
  }
  return result;
}

async function seedAcademicYears() {
  const result = new Map();
  for (const batch of [2024, 2025, 2026]) {
    const year = await prisma.academicYear.upsert({
      where: { label: String(batch) },
      update: { startDate: date(`${batch}-08-01`), endDate: date(`${batch + 3}-07-31`) },
      create: {
        label: String(batch),
        startDate: date(`${batch}-08-01`),
        endDate: date(`${batch + 3}-07-31`),
      },
    });
    result.set(batch, year);
  }
  return result;
}

async function seedSemesters(years) {
  const result = new Map();
  for (const [batch, year] of years) {
    const rows = [];
    for (let number = 1; number <= 6; number += 1) {
      const dueDate = semesterDueDate(batch, number);
      rows.push(await prisma.semester.upsert({
        where: { academicYearId_name: { academicYearId: year.id, name: `Semester ${number}` } },
        update: { dueDate, graceDays: 0 },
        create: { academicYearId: year.id, name: `Semester ${number}`, dueDate, graceDays: 0 },
      }));
    }
    result.set(batch, rows);
  }
  return result;
}

async function seedStructures(courses, years, semesters) {
  for (const [batch, courseNames] of Object.entries(coursesByBatch)) {
    const cohort = Number(batch);
    for (const name of courseNames) {
      const course = courses.get(name);
      for (let semesterNumber = 1; semesterNumber <= course.duration * 2; semesterNumber += 1) {
        const studyYear = Math.floor((semesterNumber - 1) / 2) + 1;
        const semester = semesters.get(cohort)[semesterNumber - 1];
        await prisma.feeStructure.upsert({
          where: {
            courseId_academicYearId_semesterId_component_studyYear: {
              courseId: course.id,
              academicYearId: years.get(cohort).id,
              semesterId: semester.id,
              component: "ACADEMIC_FEE",
              studyYear,
            },
          },
          update: { amount: course.fee },
          create: {
            courseId: course.id,
            academicYearId: years.get(cohort).id,
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
      where: { condition_occupancy: { condition: rate.condition, occupancy: rate.occupancy } },
      update: { annualFee: rate.annualFee },
      create: rate,
    });
  }
}

async function seedUsers() {
  const passwordHash = await hashPassword("12345678");
  for (const user of [
    { email: "admin@gmail.com", role: "TEACHER" },
    { email: "superadmin@gmail.com", role: "SUPERADMIN" },
  ]) {
    await pool.execute(
      "INSERT INTO users (email, password_hash, role, active) VALUES (?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), active = TRUE",
      [user.email, passwordHash, user.role]
    );
  }
}

async function seedStudents(courses, years, semesters) {
  const legacyStudents = await prisma.student.findMany({
    where: { registrationNumber: { in: legacySeedRegistrationNumbers } },
    select: { id: true },
  });
  const studentIds = legacyStudents.map((student) => student.id);
  if (studentIds.length) {
    const accounts = await prisma.feeAccount.findMany({
      where: { studentId: { in: studentIds } },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);
    await prisma.$transaction(async (tx) => {
      await tx.reminder.deleteMany({ where: { studentId: { in: studentIds } } });
      if (accountIds.length) {
          const attempts = await tx.paymentAllocation.findMany({ where: { feeAccountId: { in: accountIds } }, select: { paymentAttemptId: true } });
          const attemptIds = [...new Set(attempts.map((item) => item.paymentAttemptId))];
        await tx.paymentAllocation.deleteMany({ where: { feeAccountId: { in: accountIds } } });
        await tx.ledgerEntry.updateMany({
          where: { relatedEntryId: { in: (await tx.ledgerEntry.findMany({ where: { feeAccountId: { in: accountIds } }, select: { id: true } })).map((entry) => entry.id) } },
          data: { relatedEntryId: null },
        });
        await tx.ledgerEntry.deleteMany({ where: { feeAccountId: { in: accountIds } } });
        await tx.feeAccount.deleteMany({ where: { id: { in: accountIds } } });
          if (attemptIds.length) await tx.paymentAttempt.deleteMany({ where: { id: { in: attemptIds } } });
      }
      await tx.student.deleteMany({ where: { id: { in: studentIds } } });
    });
  }

  for (const definition of studentDefinitions) {
    const { batch, courseName, semesterNumber } = definition;
    const year = years.get(batch);
    const course = courses.get(courseName);
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
        academicYearId: year.id,
        admissionSemesterId: semesters.get(batch)[0].id,
        admissionType: "DIRECT",
        isHosteller: false,
        studyYear: definition.studyYear,
        status: "ACTIVE",
      },
    });
    const account = await prisma.feeAccount.create({
      data: { studentId: student.id, product: "ACADEMIC", academicYearId: year.id },
    });

    for (let currentSemester = 1; currentSemester <= course.duration * 2; currentSemester += 1) {
      const semester = semesters.get(batch)[currentSemester - 1];
      await prisma.ledgerEntry.create({
        data: {
          feeAccountId: account.id,
          semesterId: semester.id,
          bucket: "DUES",
          entryType: "ASSESSMENT",
          direction: "INCREASE",
          amount: course.fee,
          component: "ACADEMIC_FEE",
          effectiveDate: semesterDueDate(batch, currentSemester),
          actedBy: seedActor,
          reason: "Demo semester fee",
        },
      });
      if (currentSemester < semesterNumber || (currentSemester === semesterNumber && definition.paid)) {
        const attempt = await prisma.paymentAttempt.create({
          data: {
            method: "HDFC",
            status: "SUCCESS",
            amount: course.fee,
            idempotencyKey: `SEED-${definition.registrationNumber}-${currentSemester}`,
            reference: `SEED-${definition.registrationNumber}-${currentSemester}`,
            receiptNo: `RCPT-${definition.registrationNumber}-${String(currentSemester).padStart(2, "0")}`,
            actedBy: seedActor,
            paidOn: paymentDate(batch, currentSemester, 0),
            allocations: { create: [{ feeAccountId: account.id, bucket: "DUES", amount: course.fee }] },
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
            effectiveDate: paymentDate(batch, currentSemester, 0),
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
  const years = await seedAcademicYears();
  const semesters = await seedSemesters(years);
  await seedStructures(courses, years, semesters);
  await seedHostelRates();
  const studentCount = await seedStudents(courses, years, semesters);
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
