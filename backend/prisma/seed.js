require("../config/database-url");

const prisma = require("../lib/prisma");
const { pool } = require("../config/db");
const { hashPassword } = require("../modules/auth/auth.service");
const { diffDays } = require("../lib/dates");

const seedActor = "FRONTEND-DEMO-SEED";
const currentStart = 2026;
const fineAsOf = date("2026-11-23");
const studentsPerIntake = 2;
const courseDefinitions = [
  { name: "BBA (LU)", code: "BLU", fee: 24500, affiliation: "LU", years: 3 },
  { name: "B.Com (Hons.)", code: "BCM", fee: 22000, affiliation: "LU", years: 3 },
  { name: "MBA", code: "MBA", fee: 32000, affiliation: "LU", years: 2 },
  { name: "BBA (AKTU)", code: "BAK", fee: 26000, affiliation: "AKTU", years: 3 },
  { name: "MBA (AKTU)", code: "MBAAK", fee: 32000, affiliation: "AKTU", years: 2 },
];
const sessions = [2021, 2022, 2023, 2024, 2025, 2026].map((startYear) => ({
  label: sessionLabel(startYear),
  startYear,
}));
const studentNames = [
  "Asha Rao", "Rahul Verma", "Neha Gupta", "Amit Sharma", "Priya Nair", "Vikram Joshi",
  "Sneha Iyer", "Karan Mehta", "Anjali Desai", "Rohit Kapoor", "Pooja Singh", "Arjun Patel",
  "Divya Reddy", "Sanjay Yadav", "Meera Khanna", "Nikhil Chauhan", "Kavita Jain", "Aditya Bose",
  "Ritu Malhotra", "Harsh Tiwari", "Shreya Banerjee", "Manish Agarwal", "Isha Kulkarni", "Deepak Mishra",
  "Nandini Shah", "Varun Saxena", "Tanvi Bhatt", "Gaurav Pandey", "Ayesha Khan", "Siddharth Rao",
  "Lavanya Menon", "Abhishek Dubey", "Pallavi Ghosh", "Yash Tripathi", "Komal Arora", "Rakesh Nanda",
  "Simran Kaur", "Mohit Bansal", "Ananya Pillai", "Vivek Chawla", "Fatima Sheikh", "Akash Goyal",
  "Rhea Dutta", "Pranav Khatri", "Sonal Jain", "Harshita Roy", "Devansh Sethi", "Kirti Bhatia",
  "Omkar Pawar", "Jaya Srinivasan", "Tarun Ahluwalia", "Muskan Qureshi", "Nitin Kaushik", "Aditi Chopra",
  "Rohan Das", "Swati Hegde", "Imran Farooqui", "Bhavna Thakur", "Kunal Rastogi",
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

function sessionLabel(startYear) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function oddDue(startYear) {
  return date(`${startYear}-06-10`);
}

function evenDue(startYear) {
  return date(`${startYear + 1}-01-10`);
}

function paidOnDate(dueDate) {
  const paidOn = new Date(dueDate);
  paidOn.setUTCDate(3);
  return paidOn;
}

async function resetDemo() {
  await prisma.$transaction(async (tx) => {
    await tx.reminder.deleteMany();
    await tx.paymentAllocation.deleteMany();
    await tx.ledgerEntry.updateMany({ where: { relatedEntryId: { not: null } }, data: { relatedEntryId: null } });
    await tx.ledgerEntry.deleteMany();
    await tx.feeAccount.deleteMany();
    await tx.paymentAttempt.deleteMany();
    await tx.$executeRawUnsafe("UPDATE users SET student_id = NULL WHERE student_id IS NOT NULL");
    await tx.student.deleteMany();
    await tx.importRow.deleteMany();
    await tx.importBatch.deleteMany();
    await tx.feeStructure.deleteMany();
    await tx.semester.deleteMany();
    await tx.academicYear.deleteMany();
    await tx.course.deleteMany();
  }, { maxWait: 15000, timeout: 60000 });
}

async function seedCourses() {
  const result = new Map();
  for (const definition of courseDefinitions) {
    const course = await prisma.course.create({
      data: {
        courseCode: definition.code,
        courseName: definition.name,
        affiliation: definition.affiliation,
        durationYears: definition.years,
        lateFeePerDay: definition.name.toUpperCase().includes("MBA") ? 15 : 5,
      },
    });
    result.set(definition.name, { ...definition, id: course.id, lateFeePerDay: course.lateFeePerDay });
  }
  return result;
}

async function seedAcademicYears() {
  const result = new Map();
  for (const session of sessions) {
    const year = await prisma.academicYear.create({
      data: {
        label: session.label,
        startDate: date(`${session.startYear}-08-01`),
        endDate: date(`${session.startYear + 1}-07-31`),
      },
    });
    result.set(session.label, year);
  }
  return result;
}

async function seedSemesters(years) {
  const result = new Map();
  for (const session of sessions) {
    const year = years.get(session.label);
    const first = await prisma.semester.create({
      data: { academicYearId: year.id, name: "Ist Semester", dueDate: oddDue(session.startYear), graceDays: 0 },
    });
    const second = await prisma.semester.create({
      data: { academicYearId: year.id, name: "IInd Semester", dueDate: evenDue(session.startYear), graceDays: 0 },
    });
    result.set(session.label, { first, second });
  }
  return result;
}

async function seedStructures(courses, years, semesters) {
  for (const session of sessions) {
    const year = years.get(session.label);
    const terms = semesters.get(session.label);
    for (const course of courses.values()) {
      for (let studyYear = 1; studyYear <= course.years; studyYear += 1) {
        for (const semester of [terms.first, terms.second]) {
          await prisma.feeStructure.create({
            data: {
              courseId: course.id,
              academicYearId: year.id,
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

async function assessTerm(account, semester, course, registrationNumber, pay) {
  await prisma.ledgerEntry.create({
    data: {
      feeAccountId: account.id,
      semesterId: semester.id,
      bucket: "DUES",
      entryType: "ASSESSMENT",
      direction: "INCREASE",
      amount: course.fee,
      component: "ACADEMIC_FEE",
      effectiveDate: semester.dueDate,
      actedBy: seedActor,
      reason: "Semester fee",
    },
  });
  if (!pay) return;
  const paidOn = paidOnDate(semester.dueDate);
  const key = `SEED-${registrationNumber}-${semester.academicYearId}-${semester.name.toUpperCase()}`;
  const attempt = await prisma.paymentAttempt.create({
    data: {
      method: "HDFC",
      status: "SUCCESS",
      amount: course.fee,
      idempotencyKey: key,
      reference: key,
      receiptNo: `RCPT-${registrationNumber}-${semester.academicYearId}-${semester.name.startsWith("IInd") ? "II" : "I"}`,
      actedBy: seedActor,
      paidOn,
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
      effectiveDate: paidOn,
      actedBy: seedActor,
      reason: "Semester payment",
      paymentAttemptId: attempt.id,
    },
  });
}

async function seedStudents(courses, years, semesters) {
  const fineDays = diffDays(fineAsOf, oddDue(currentStart));
  const finedCourses = new Set();
  let nameIndex = 0;
  let phone = 9454716084;
  let count = 0;

  for (let intake = 2021; intake <= currentStart; intake += 1) {
    for (const course of courses.values()) {
      const finalStart = intake + course.years - 1;
      const active = finalStart >= currentStart;
      const studyYear = active ? currentStart - intake + 1 : course.years;
      const latestStart = active ? currentStart : finalStart;
      const latest = years.get(sessionLabel(latestStart));
      const admission = semesters.get(sessionLabel(intake)).first;
      for (let seat = 1; seat <= studentsPerIntake; seat += 1) {
        const registrationNumber = `ICM${intake}${course.code}${String(seat).padStart(2, "0")}`;
        const name = registrationNumber === "ICM2026BAK01" ? "Masoom Singh" : studentNames[nameIndex++];
        const phoneNumber = registrationNumber === "ICM2026BAK01" ? "9454716083" : String(phone++);
        const withFine = active && seat === 1 && !finedCourses.has(course.name);
        if (withFine) finedCourses.add(course.name);
        const student = await prisma.student.create({
          data: {
            registrationNumber,
            enrolmentNumber: `ENR-${registrationNumber}`,
            name,
            whatsappNumber: phoneNumber,
            phoneNumber,
            email: `${registrationNumber.toLowerCase()}@example.com`,
            fatherName: "Guardian",
            branch: course.name,
            courseId: course.id,
            academicYearId: latest.id,
            admissionSemesterId: admission.id,
            admissionType: "DIRECT",
            isHosteller: false,
            studyYear,
            status: active ? "ACTIVE" : "COMPLETED",
          },
        });
        for (let yearNumber = 1; yearNumber <= studyYear; yearNumber += 1) {
          const startYear = intake + yearNumber - 1;
          const label = sessionLabel(startYear);
          const account = await prisma.feeAccount.create({
            data: { studentId: student.id, product: "ACADEMIC", academicYearId: years.get(label).id },
          });
          const terms = semesters.get(label);
          const currentFirst = startYear === currentStart;
          await assessTerm(account, terms.first, course, registrationNumber, !currentFirst);
          if (!currentFirst) await assessTerm(account, terms.second, course, registrationNumber, true);
          if (currentFirst && withFine) {
            await prisma.ledgerEntry.create({
              data: {
                feeAccountId: account.id,
                semesterId: terms.first.id,
                bucket: "DUES",
                entryType: "FINE",
                direction: "INCREASE",
                amount: course.lateFeePerDay * fineDays,
                component: "ACADEMIC_FEE",
                effectiveDate: fineAsOf,
                actedBy: seedActor,
                reason: `Late fee for ${fineDays} day(s)`,
              },
            });
          }
        }
        count += 1;
      }
    }
  }
  return count;
}

async function main() {
  await seedUsers();
  await resetDemo();
  const courses = await seedCourses();
  const years = await seedAcademicYears();
  const semesters = await seedSemesters(years);
  await seedStructures(courses, years, semesters);
  await seedHostelRates();
  const studentCount = await seedStudents(courses, years, semesters);
  console.log(`Frontend demo seed complete: ${studentCount} students, ${sessions.length} sessions, ${hostelRates.length} hostel rates.`);
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
