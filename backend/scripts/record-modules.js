const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const BASE = "http://127.0.0.1:3000";
const root = path.join(__dirname, "..");
const fixtureDir = path.join(root, "docs", "fixtures");
const cases = [];
const failures = [];

function curlShow(method, urlPath, body) {
  if (!body) {
    return `curl -X ${method} ${BASE}${urlPath}`;
  }
  return `curl -X ${method} ${BASE}${urlPath} \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`;
}

function run(spec) {
  const args = ["-sS", "-w", "\nHTTP_STATUS:%{http_code}", "-X", spec.method, `${BASE}${spec.path}`];
  if (spec.body) {
    args.push("-H", "Content-Type: application/json", "-d", JSON.stringify(spec.body));
  }
  if (spec.file) {
    args.push("-F", `file=@${spec.file}`);
  }
  const output = execFileSync("curl", args, { encoding: "utf8" });
  const match = output.match(/\nHTTP_STATUS:(\d+)$/);
  const status = Number(match[1]);
  const raw = output.slice(0, match.index);
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
  if (spec.doc) {
    cases.push({ ...spec, status, raw, curl: spec.curl || curlShow(spec.method, spec.path, spec.body) });
  }
  if (spec.expect && status !== spec.expect) {
    failures.push(`${spec.title}: expected ${spec.expect}, got ${status}\n${raw.slice(0, 500)}`);
  }
  return { status, raw, json };
}

function studentBody(registrationNumber, name, email) {
  return {
    registrationNumber,
    name,
    whatsappNumber: "9876543210",
    phoneNumber: "9123456780",
    email,
    fatherName: `${name} Father`,
    branch: "Management",
    courseId,
    batchId,
    sessionId,
    semesterId,
    admissionType: "DIRECT",
  };
}

function accountOf(student, product) {
  return student.accounts.find((account) => account.product === product);
}

execFileSync("docker", [
  "exec",
  "server-mysql-1",
  "mysql",
  "-uroot",
  "-proot",
  "feemgmt",
  "-e",
  `SET FOREIGN_KEY_CHECKS=0;
   TRUNCATE TABLE reminders;
   TRUNCATE TABLE import_rows;
   TRUNCATE TABLE import_batches;
   TRUNCATE TABLE ledger_entries;
   TRUNCATE TABLE payment_allocations;
   TRUNCATE TABLE payment_attempts;
   TRUNCATE TABLE fee_accounts;
   TRUNCATE TABLE students;
   TRUNCATE TABLE fee_structures;
   TRUNCATE TABLE semesters;
   TRUNCATE TABLE batches;
   TRUNCATE TABLE sessions;
   SET FOREIGN_KEY_CHECKS=1;`,
]);

const courseList = run({
  title: "list courses",
  method: "GET",
  path: "/api/courses",
  expect: 200,
});
let course = courseList.json.data.find((item) => item.courseCode === "AKTU01");
if (!course) {
  course = run({
    title: "create course",
    method: "POST",
    path: "/api/courses",
    body: { courseCode: "AKTU01", courseName: "MBA (AKTU)", affiliation: "AKTU", lateFeePerDay: 15 },
    expect: 201,
  }).json.data;
}
const courseId = course.id;

const year = run({
  doc: "fee",
  group: "Success",
  title: "Create session",
  method: "POST",
  path: "/api/sessions",
  body: { label: "2026-27", startDate: "2026-07-01", endDate: "2027-06-30" },
  expect: 201,
}).json.data;
const sessionId = year.id;
const batch = run({
  doc: "student",
  group: "Success",
  title: "Create batch",
  method: "POST",
  path: "/api/batches",
  body: { courseId, label: "2026-28", startDate: "2026-07-01", endDate: "2028-06-30" },
  expect: 201,
}).json.data;
const batchId = batch.id;

run({
  doc: "fee",
  group: "Success",
  title: "List sessions",
  method: "GET",
  path: "/api/sessions",
  expect: 200,
});

const semester = run({
  doc: "fee",
  group: "Success",
  title: "Create semester",
  method: "POST",
  path: "/api/semesters",
  body: { sessionId, name: "SEMESTER_1", dueDate: "2026-07-01", graceDays: 5 },
  expect: 201,
}).json.data;
const semesterId = semester.id;

run({
  doc: "fee",
  group: "Success",
  title: "List semesters",
  method: "GET",
  path: "/api/semesters",
  expect: 200,
});

const structureInputs = [
  ["ACADEMIC_FEE", 10000],
  ["ACADEMIC_CAUTION", 1000],
  ["HOSTEL_FEE", 8000],
  ["HOSTEL_SECURITY", 500],
];
for (const [component, amount] of structureInputs) {
  run({
    doc: "fee",
    group: "Success",
    title: `Create ${component} structure`,
    method: "POST",
    path: "/api/fee-structures",
    body: { courseId, sessionId, semesterId, component, studyYear: 1, amount },
    expect: 201,
  });
}

run({
  doc: "fee",
  group: "Success",
  title: "List fee structures",
  method: "GET",
  path: "/api/fee-structures",
  expect: 200,
});

run({
  doc: "fee",
  group: "Wrong entry",
  title: "Unknown fee component",
  method: "POST",
  path: "/api/fee-structures",
  body: { courseId, sessionId, semesterId, component: "LIBRARY", studyYear: 1, amount: 1000 },
  expect: 400,
});

run({
  doc: "fee",
  group: "Wrong entry",
  title: "Fee amount of 0",
  method: "POST",
  path: "/api/fee-structures",
  body: { courseId, sessionId, semesterId, component: "ACADEMIC_FEE", studyYear: 2, amount: 0 },
  expect: 400,
});

run({
  doc: "fee",
  group: "Wrong entry",
  title: "Unknown course",
  method: "POST",
  path: "/api/fee-structures",
  body: { courseId: 999999, sessionId, semesterId, component: "ACADEMIC_FEE", studyYear: 1, amount: 1000 },
  expect: 404,
});

run({
  doc: "fee",
  group: "Wrong entry",
  title: "Duplicate fee structure",
  method: "POST",
  path: "/api/fee-structures",
  body: { courseId, sessionId, semesterId, component: "ACADEMIC_FEE", studyYear: 1, amount: 10000 },
  expect: 409,
});

const onTime = run({
  doc: "student",
  group: "Success",
  title: "Create student before enrolment number",
  method: "POST",
  path: "/api/students",
  body: studentBody("REG-ONTIME", "Asha Rao", "asha@example.com"),
  expect: 201,
}).json.data;
const onTimeAccountId = accountOf(onTime, "ACADEMIC").id;

run({
  doc: "student",
  group: "Success",
  title: "Search by registration number",
  method: "GET",
  path: "/api/students?q=REG-ONTIME",
  expect: 200,
});

run({
  doc: "student",
  group: "Success",
  title: "Get student by id",
  method: "GET",
  path: `/api/students/${onTime.id}`,
  expect: 200,
});

run({
  doc: "student",
  group: "Success",
  title: "Add enrolment number to the same student",
  method: "PATCH",
  path: `/api/students/${onTime.id}`,
  body: { enrolmentNumber: "ENR1001" },
  expect: 200,
});

const late = run({
  doc: "fee",
  group: "Setup",
  title: "Create the student used for fines and deposits",
  method: "POST",
  path: "/api/students",
  body: studentBody("REG-LATE", "Bharat Singh", "bharat@example.com"),
  expect: 201,
}).json.data;
const lateAccountId = accountOf(late, "ACADEMIC").id;

run({
  doc: "fee",
  group: "Success",
  title: "Read a fee account",
  method: "GET",
  path: `/api/fees/accounts/${lateAccountId}`,
  expect: 200,
});

const host = run({
  doc: "student",
  group: "Success",
  title: "Create a day scholar who later joins the hostel",
  method: "POST",
  path: "/api/students",
  body: studentBody("REG-HOST", "Charu Das", "charu@example.com"),
  expect: 201,
}).json.data;

run({
  doc: "student",
  group: "Success",
  title: "Mark the student as a hosteller and assess hostel fees",
  method: "PATCH",
  path: `/api/students/${host.id}`,
  body: { isHosteller: true },
  expect: 200,
});

run({
  doc: "student",
  group: "Success",
  title: "Mark a student as left",
  method: "POST",
  path: "/api/students",
  body: studentBody("REG-LEFT", "Deepa Nair", "deepa@example.com"),
  expect: 201,
});
const left = cases[cases.length - 1];
const leftId = JSON.parse(left.raw).data.id;
run({
  doc: "student",
  group: "Success",
  title: "Record the leaving date without moving money",
  method: "PATCH",
  path: `/api/students/${leftId}`,
  body: { status: "LEFT", leftOn: "2026-12-01" },
  expect: 200,
});

run({
  doc: "payment",
  group: "Success",
  title: "Record a cash payment",
  method: "POST",
  path: "/api/payments",
  body: {
    method: "CASH",
    idempotencyKey: "cash-ontime-dues",
    reference: "CASH-1001",
    actedBy: "fee-clerk",
    paidOn: "2026-07-01",
    allocations: [{ feeAccountId: onTimeAccountId, bucket: "DUES", amount: 10000 }],
  },
  expect: 201,
});

const fineRun = run({
  doc: "fee",
  group: "Success",
  title: "Run late fees as of 2026-07-10",
  method: "POST",
  path: "/api/fees/fines/run",
  body: { asOfDate: "2026-07-10", actedBy: "fee-admin" },
  expect: 200,
}).json.data;

const lateFine = fineRun.posted.find((line) => line.feeAccountId === lateAccountId);
if (!lateFine || lateFine.amount !== 60) {
  failures.push(`expected REG-LATE fine of 60, got ${JSON.stringify(lateFine)}`);
}

run({
  doc: "fee",
  group: "Success",
  title: "Run late fees again for the same date",
  method: "POST",
  path: "/api/fees/fines/run",
  body: { asOfDate: "2026-07-10", actedBy: "fee-admin" },
  expect: 200,
});

run({
  doc: "fee",
  group: "Wrong entry",
  title: "Waive more than the fine",
  method: "POST",
  path: `/api/fees/fines/${lateFine.id}/waive`,
  body: { amount: 61, actedBy: "fee-admin", reason: "Too much" },
  expect: 400,
});

run({
  doc: "fee",
  group: "Success",
  title: "Waive part of a fine",
  method: "POST",
  path: `/api/fees/fines/${lateFine.id}/waive`,
  body: { amount: 10, actedBy: "fee-admin", reason: "Approved waiver" },
  expect: 201,
});

const lateAccount = run({
  doc: "fee",
  group: "Success",
  title: "Read the account after the waiver",
  method: "GET",
  path: `/api/fees/accounts/${lateAccountId}`,
  expect: 200,
}).json.data;
const assessment = lateAccount.lines.find((line) => line.entryType === "ASSESSMENT" && line.bucket === "DUES");

run({
  doc: "fee",
  group: "Other failure",
  title: "Waive a line that is not a fine",
  method: "POST",
  path: `/api/fees/fines/${assessment.id}/waive`,
  body: { amount: 10, actedBy: "fee-admin", reason: "Not a fine" },
  expect: 409,
});

run({
  doc: "fee",
  group: "Other failure",
  title: "Read a missing fee account",
  method: "GET",
  path: "/api/fees/accounts/999999",
  expect: 404,
});

run({
  doc: "fee",
  group: "Setup",
  title: "Collect caution money before refund",
  method: "POST",
  path: "/api/payments",
  body: {
    method: "CASH",
    idempotencyKey: "cash-late-caution",
    reference: "CASH-CAUTION",
    actedBy: "fee-clerk",
    paidOn: "2026-11-11",
    allocations: [{ feeAccountId: lateAccountId, bucket: "DEPOSIT", amount: 1000 }],
  },
  expect: 201,
});

run({
  doc: "fee",
  group: "Wrong entry",
  title: "Refund more than the deposit held",
  method: "POST",
  path: `/api/fees/deposits/${lateAccountId}/refund`,
  body: { amount: 1001, actedBy: "fee-admin", reason: "Too much" },
  expect: 400,
});

run({
  doc: "fee",
  group: "Success",
  title: "Refund caution with a deduction",
  method: "POST",
  path: `/api/fees/deposits/${lateAccountId}/refund`,
  body: {
    amount: 400,
    deductionAmount: 100,
    deductionReason: "Damage",
    actedBy: "fee-admin",
    reason: "Left after semester 1",
  },
  expect: 201,
});

run({
  doc: "fee",
  group: "Success",
  title: "Adjust deposit against dues",
  method: "POST",
  path: `/api/fees/deposits/${lateAccountId}/adjust`,
  body: { amount: 200, actedBy: "fee-admin", reason: "Apply caution to fees" },
  expect: 201,
});

run({
  doc: "student",
  group: "Wrong entry",
  title: "Missing registration number",
  method: "POST",
  path: "/api/students",
  body: {
    name: "Missing Reg",
    whatsappNumber: "9876543210",
    phoneNumber: "9123456780",
    email: "missing@example.com",
    fatherName: "Father",
    branch: "Management",
    courseId,
    sessionId,
    semesterId,
    admissionType: "DIRECT",
  },
  expect: 400,
});

run({
  doc: "student",
  group: "Wrong entry",
  title: "Admission type outside DIRECT or COUNSELLING",
  method: "POST",
  path: "/api/students",
  body: { ...studentBody("REG-BADTYPE", "Bad Type", "badtype@example.com"), admissionType: "LATERAL" },
  expect: 400,
});

run({
  doc: "student",
  group: "Wrong entry",
  title: "Unknown course on a student",
  method: "POST",
  path: "/api/students",
  body: { ...studentBody("REG-NOCOURSE", "No Course", "nocourse@example.com"), courseId: 999999 },
  expect: 404,
});

run({
  doc: "student",
  group: "Wrong entry",
  title: "Duplicate registration number",
  method: "POST",
  path: "/api/students",
  body: studentBody("REG-ONTIME", "Asha Copy", "asha.copy@example.com"),
  expect: 409,
});

run({
  doc: "student",
  group: "Other failure",
  title: "Get a missing student",
  method: "GET",
  path: "/api/students/999999",
  expect: 404,
});

run({
  doc: "student",
  group: "Other failure",
  title: "Patch a missing student",
  method: "PATCH",
  path: "/api/students/999999",
  body: { enrolmentNumber: "ENR-MISSING" },
  expect: 404,
});

const payer = run({
  doc: "payment",
  group: "Setup",
  title: "Create the student who pays online",
  method: "POST",
  path: "/api/students",
  body: studentBody("REG-PAY", "Esha Iyer", "esha@example.com"),
  expect: 201,
}).json.data;
const payAccountId = accountOf(payer, "ACADEMIC").id;

const hdfc = run({
  doc: "payment",
  group: "Success",
  title: "Start an HDFC payment",
  method: "POST",
  path: "/api/payments",
  body: {
    method: "HDFC",
    idempotencyKey: "hdfc-pay-2000",
    allocations: [{ feeAccountId: payAccountId, bucket: "DUES", amount: 2000 }],
  },
  expect: 201,
}).json.data;

run({
  doc: "payment",
  group: "Success",
  title: "Confirm the HDFC payment",
  method: "POST",
  path: `/api/payments/${hdfc.id}/callback`,
  body: { status: "SUCCESS", paidOn: "2026-11-11" },
  expect: 200,
});

run({
  doc: "payment",
  group: "Success",
  title: "Repeat the successful HDFC callback",
  method: "POST",
  path: `/api/payments/${hdfc.id}/callback`,
  body: { status: "SUCCESS", paidOn: "2026-11-11" },
  expect: 200,
});

run({
  doc: "payment",
  group: "Success",
  title: "Download the receipt",
  method: "GET",
  path: `/api/receipts/${hdfc.id}`,
  expect: 200,
});

const failed = run({
  doc: "payment",
  group: "Success",
  title: "Start a second HDFC payment",
  method: "POST",
  path: "/api/payments",
  body: {
    method: "HDFC",
    idempotencyKey: "hdfc-pay-fail",
    allocations: [{ feeAccountId: payAccountId, bucket: "DUES", amount: 500 }],
  },
  expect: 201,
}).json.data;

run({
  doc: "payment",
  group: "Success",
  title: "Mark the HDFC payment failed",
  method: "POST",
  path: `/api/payments/${failed.id}/callback`,
  body: { status: "FAILED" },
  expect: 200,
});

run({
  doc: "payment",
  group: "Other failure",
  title: "Receipt before success",
  method: "GET",
  path: `/api/receipts/${failed.id}`,
  expect: 409,
});

const challan = run({
  doc: "payment",
  group: "Success",
  title: "Record a challan payment",
  method: "POST",
  path: "/api/payments",
  body: {
    method: "CHALLAN",
    idempotencyKey: "challan-1000",
    reference: "CHALLAN-1000",
    actedBy: "fee-clerk",
    allocations: [{ feeAccountId: payAccountId, bucket: "DUES", amount: 1000 }],
  },
  expect: 201,
}).json.data;

run({
  doc: "payment",
  group: "Success",
  title: "Verify the challan",
  method: "POST",
  path: `/api/payments/${challan.id}/verify`,
  body: { paidOn: "2026-11-11", actedBy: "fee-clerk" },
  expect: 200,
});

run({
  doc: "payment",
  group: "Wrong entry",
  title: "Amount above the outstanding balance",
  method: "POST",
  path: "/api/payments",
  body: {
    method: "HDFC",
    idempotencyKey: "hdfc-too-much",
    allocations: [{ feeAccountId: payAccountId, bucket: "DUES", amount: 999999 }],
  },
  expect: 400,
});

run({
  doc: "payment",
  group: "Other failure",
  title: "Callback for an unknown payment",
  method: "POST",
  path: "/api/payments/999999/callback",
  body: { status: "SUCCESS" },
  expect: 404,
});

fs.mkdirSync(fixtureDir, { recursive: true });
const headers = [
  "registrationNumber",
  "name",
  "whatsappNumber",
  "phoneNumber",
  "email",
  "fatherName",
  "branch",
  "courseCode",
  "batchLabel",
  "admissionType",
  "isHosteller",
  "studyYear",
  "sessionLabel",
  "semesterName",
];

async function writeSheet(fileName, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("students");
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }
  const file = path.join(fixtureDir, fileName);
  await workbook.xlsx.writeFile(file);
  return file;
}

function sheetRow(registrationNumber, name, email, admissionType) {
  return [
    registrationNumber,
    name,
    "9876543210",
    "9123456780",
    email,
    `${name} Father`,
    "Management",
    "AKTU01",
    "2026-28",
    admissionType,
    "false",
    1,
    "2026-27",
    "SEMESTER_1",
  ];
}

(async () => {
  const validFile = await writeSheet("students-valid.xlsx", [
    sheetRow("REG-XLS", "Farah Khan", "farah@example.com", "DIRECT"),
  ]);
  const badFile = await writeSheet("students-bad.xlsx", [
    ["", "No Reg", "9876543210", "9123456780", "noreg@example.com", "Father", "Management", "AKTU01", "2026-28", "DIRECT", "false", 1, "2026-27", "SEMESTER_1"],
  ]);
  const duplicateFile = await writeSheet("students-duplicate.xlsx", [
    sheetRow("REG-ONTIME", "Asha Copy", "copy@example.com", "COUNSELLING"),
  ]);

  run({
    doc: "student",
    group: "Success",
    title: "Preview a valid student workbook",
    method: "POST",
    path: "/api/students/imports/preview",
    file: validFile,
    curl: `curl -X POST ${BASE}/api/students/imports/preview \\\n  -F "file=@docs/fixtures/students-valid.xlsx"`,
    expect: 200,
  });
  const validBatchId = JSON.parse(cases[cases.length - 1].raw).data.id;

  run({
    doc: "student",
    group: "Success",
    title: "Commit the valid preview",
    method: "POST",
    path: `/api/students/imports/${validBatchId}/commit`,
    expect: 201,
  });

  run({
    doc: "student",
    group: "Wrong entry",
    title: "Preview a workbook row with an empty registration number",
    method: "POST",
    path: "/api/students/imports/preview",
    file: badFile,
    curl: `curl -X POST ${BASE}/api/students/imports/preview \\\n  -F "file=@docs/fixtures/students-bad.xlsx"`,
    expect: 200,
  });
  const badBatchId = JSON.parse(cases[cases.length - 1].raw).data.id;

  run({
    doc: "student",
    group: "Wrong entry",
    title: "Preview a workbook row with a duplicate registration number",
    method: "POST",
    path: "/api/students/imports/preview",
    file: duplicateFile,
    curl: `curl -X POST ${BASE}/api/students/imports/preview \\\n  -F "file=@docs/fixtures/students-duplicate.xlsx"`,
    expect: 200,
  });

  run({
    doc: "student",
    group: "Other failure",
    title: "Commit a preview that has errors",
    method: "POST",
    path: `/api/students/imports/${badBatchId}/commit`,
    expect: 409,
  });

  run({
    doc: "student",
    group: "Other failure",
    title: "Commit a preview that was already committed",
    method: "POST",
    path: `/api/students/imports/${validBatchId}/commit`,
    expect: 409,
  });

  run({
    doc: "reminder",
    group: "Success",
    title: "Send SMS and WhatsApp reminders",
    method: "POST",
    path: "/api/reminders",
    body: { studentIds: [late.id], channels: ["SMS", "WHATSAPP"], actedBy: "fee-admin" },
    expect: 201,
  });

  run({
    doc: "reminder",
    group: "Success",
    title: "List students reminded and still unpaid",
    method: "GET",
    path: "/api/reminders?unpaid=true",
    expect: 200,
  });

  run({
    doc: "reminder",
    group: "Wrong entry",
    title: "Remind a student with no dues",
    method: "POST",
    path: "/api/reminders",
    body: { studentIds: [onTime.id], channels: ["SMS"], actedBy: "fee-admin" },
    expect: 400,
  });

  run({
    doc: "reminder",
    group: "Wrong entry",
    title: "Empty channel list",
    method: "POST",
    path: "/api/reminders",
    body: { studentIds: [late.id], channels: [], actedBy: "fee-admin" },
    expect: 400,
  });

  run({
    doc: "reminder",
    group: "Other failure",
    title: "Unknown student",
    method: "POST",
    path: "/api/reminders",
    body: { studentIds: [999999], channels: ["SMS"], actedBy: "fee-admin" },
    expect: 404,
  });

  const reportQuery = `from=2026-07-01&to=2026-11-11`;
  run({
    doc: "report",
    group: "Success",
    title: "Payments by date",
    method: "GET",
    path: `/api/reports/payments?${reportQuery}&format=json`,
    expect: 200,
  });

  run({
    doc: "report",
    group: "Success",
    title: "Payments by date and course",
    method: "GET",
    path: `/api/reports/payments?${reportQuery}&courseId=${courseId}&format=json`,
    expect: 200,
  });

  const headerFile = "/tmp/payments-headers.txt";
  const bodyFile = "/tmp/payments.xlsx";
  execFileSync("curl", [
    "-sS",
    "-D",
    headerFile,
    "-o",
    bodyFile,
    `${BASE}/api/reports/payments?${reportQuery}&format=xlsx`,
  ]);
  const headersText = fs.readFileSync(headerFile, "utf8");
  const statusLine = headersText.split("\n").find((line) => line.startsWith("HTTP/"));
  const xlsxStatus = Number(statusLine.split(" ")[1]);
  const contentType = headersText
    .split("\n")
    .find((line) => line.toLowerCase().startsWith("content-type:"))
    .split(":")[1]
    .trim();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(bodyFile);
  const rowCount = workbook.worksheets[0].rowCount - 1;
  const xlsxRaw = JSON.stringify({ status: xlsxStatus, contentType, rowCount });
  cases.push({
    doc: "report",
    group: "Success",
    title: "Payments workbook",
    method: "GET",
    path: `/api/reports/payments?${reportQuery}&format=xlsx`,
    curl: `curl -X GET ${BASE}/api/reports/payments?${reportQuery}&format=xlsx -o payments.xlsx`,
    status: xlsxStatus,
    raw: xlsxRaw,
    note: "The body is the xlsx file. The recorded result is the status, content type, and data row count.",
  });
  if (xlsxStatus !== 200) {
    failures.push(`xlsx report expected 200, got ${xlsxStatus}`);
  }

  run({
    doc: "report",
    group: "Success",
    title: "Unpaid students",
    method: "GET",
    path: "/api/reports/unpaid",
    expect: 200,
  });

  run({
    doc: "report",
    group: "Success",
    title: "Unpaid students for one course",
    method: "GET",
    path: `/api/reports/unpaid?courseId=${courseId}`,
    expect: 200,
  });

  run({
    doc: "report",
    group: "Success",
    title: "Failed payments",
    method: "GET",
    path: "/api/reports/failed-payments",
    expect: 200,
  });

  run({
    doc: "report",
    group: "Success",
    title: "On-time payment percentage",
    method: "GET",
    path: `/api/reports/on-time?semesterId=${semesterId}`,
    expect: 200,
  });

  run({
    doc: "report",
    group: "Success",
    title: "Waiver count and percentage",
    method: "GET",
    path: `/api/reports/waivers?semesterId=${semesterId}`,
    expect: 200,
  });

  run({
    doc: "report",
    group: "Success",
    title: "Students who left",
    method: "GET",
    path: "/api/reports/left-students",
    expect: 200,
  });

  run({
    doc: "report",
    group: "Success",
    title: "Semester fine collection",
    method: "GET",
    path: `/api/reports/fines?semesterId=${semesterId}`,
    expect: 200,
  });

  run({
    doc: "report",
    group: "Success",
    title: "Reconciliation",
    method: "GET",
    path: "/api/reports/reconciliation",
    expect: 200,
  });

  run({
    doc: "report",
    group: "Other failure",
    title: "Unknown semester",
    method: "GET",
    path: "/api/reports/on-time?semesterId=999999",
    expect: 404,
  });

  const intros = {
    fee: "# Fee module\n\nSessions, semesters, fee structures, ledger balances, late fees, waivers, and deposit settlement. Amounts in these curls are sample rows, not hardcoded college fees. Responses are from one live run, in the order below.\n",
    student: "# Student module\n\nRegistration number is the unique key. The enrolment number is added on the same row. A valid workbook is previewed, then committed. Responses are from one live run.\n",
    payment: "# Payment module\n\nHDFC is a local callback. Challan stays pending until verify. Cash is recorded as success immediately. A repeated success callback does not post a second ledger line. Responses are from one live run.\n",
    reminder: "# Reminder module\n\nSMS and WhatsApp reminders are stored locally. No message provider is called. Responses are from one live run.\n",
    report: "# Report module\n\nReports read the ledger and payment attempts. `format=json` is the recorded body. The workbook result records status, content type, and data row count. Responses are from one live run.\n",
  };

  if (failures.length === 0) {
    for (const [doc, intro] of Object.entries(intros)) {
      let markdown = `${intro}\nBase URL: \`${BASE}\`\n`;
      for (const group of ["Setup", "Success", "Wrong entry", "Other failure"]) {
        const items = cases.filter((item) => item.doc === doc && item.group === group);
        if (items.length === 0) {
          continue;
        }
        markdown += `\n## ${group}\n`;
        for (const item of items) {
          markdown += `\n### ${item.title}\n\n\`${item.method} ${item.path}\`\n\n\`\`\`bash\n${item.curl}\n\`\`\`\n\nStatus: \`${item.status}\`\n\n`;
          if (item.note) {
            markdown += `${item.note}\n\n`;
          }
          markdown += `\`\`\`json\n${item.raw}\n\`\`\`\n`;
        }
      }
      fs.writeFileSync(path.join(root, "docs", `${doc}_module.md`), markdown);
    }
    console.log(`recorded ${cases.length} cases`);
  } else {
    console.error(failures.join("\n\n"));
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
