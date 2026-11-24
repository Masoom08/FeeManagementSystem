const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const BASE = "https://feemanagement-icmrt.vercel.app";
const root = path.join(__dirname, "..");
const fixtureDir = path.join(root, "docs", "fixtures");
const outDir = path.join(root, "postman");

const MODULES = ["Course", "Fee", "Student", "Payment", "Reminder", "Report"];
const GROUPS = ["Setup", "Success", "Wrong entry", "Other failure"];
const STATUS_TEXT = {
  200: "OK",
  201: "Created",
  400: "Bad Request",
  404: "Not Found",
  409: "Conflict",
};

const folders = Object.fromEntries(MODULES.map((name) => [name, Object.fromEntries(GROUPS.map((group) => [group, []]))]));
const variables = { baseUrl: BASE };

function studentBody(registrationNumber, name, email, ids) {
  return {
    registrationNumber,
    name,
    whatsappNumber: "9876543210",
    phoneNumber: "9123456780",
    email,
    fatherName: `${name} Father`,
    branch: "Management",
    courseId: ids.courseId,
    academicYearId: ids.academicYearId,
    semesterId: ids.semesterId,
    admissionType: "DIRECT",
  };
}

function requestPayload(spec) {
  if (spec.file) {
    const form = new FormData();
    const bytes = fs.readFileSync(spec.file);
    form.append("file", new Blob([bytes]), spec.fileName || path.basename(spec.file));
    return { headers: {}, body: form };
  }
  if (spec.raw != null) {
    return { headers: { "Content-Type": "application/json" }, body: spec.raw };
  }
  if (spec.body != null) {
    return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(spec.body) };
  }
  return { headers: {}, body: undefined };
}

async function call(spec) {
  let response;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const payload = requestPayload(spec);
    try {
      response = await fetch(BASE + spec.path, { method: spec.method, headers: payload.headers, body: payload.body });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  if (lastError) {
    throw lastError;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";
  const rowCount = response.headers.get("x-row-count");
  const spreadsheet = contentType.includes("spreadsheet") || contentType.includes("octet-stream");
  const text = spreadsheet ? "" : buffer.toString("utf8");
  let json = null;
  if (!spreadsheet && text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return {
    status: response.status,
    contentType,
    rowCount,
    spreadsheet,
    text,
    json,
    bytes: buffer.length,
  };
}

function requestBody(spec) {
  if (spec.file) {
    return {
      mode: "formdata",
      formdata: [
        {
          key: "file",
          type: "file",
          src: spec.fixturePath,
        },
      ],
    };
  }
  if (spec.raw != null) {
    return { mode: "raw", raw: spec.raw, options: { raw: { language: "json" } } };
  }
  if (spec.body != null) {
    return { mode: "raw", raw: JSON.stringify(spec.body), options: { raw: { language: "json" } } };
  }
  return undefined;
}

function requestHeaders(spec) {
  if (spec.file || (spec.body == null && spec.raw == null)) {
    return [];
  }
  return [{ key: "Content-Type", value: "application/json" }];
}

function exampleBody(result, note) {
  if (result.spreadsheet) {
    return [
      note || "The body is an xlsx workbook, not JSON.",
      `Content-Type: ${result.contentType}`,
      `X-Row-Count: ${result.rowCount}`,
      `Bytes: ${result.bytes}`,
    ].join("\n");
  }
  return result.text;
}

async function record(spec) {
  const result = await call(spec);
  const statusText = STATUS_TEXT[result.status] || "Response";
  const headers = [{ key: "Content-Type", value: result.contentType || "application/json" }];
  if (result.rowCount != null) {
    headers.push({ key: "X-Row-Count", value: result.rowCount });
  }
  const item = {
    name: spec.title,
    request: {
      method: spec.method,
      header: requestHeaders(spec),
      url: `{{baseUrl}}${spec.variablePath || spec.path}`,
      description: spec.description || "",
    },
    response: [
      {
        name: `${result.status} ${statusText}`,
        originalRequest: {
          method: spec.method,
          header: requestHeaders(spec),
          url: `${BASE}${spec.path}`,
        },
        status: statusText,
        code: result.status,
        _postman_previewlanguage: result.spreadsheet ? "text" : "json",
        header: headers,
        cookie: [],
        body: exampleBody(result, spec.note),
      },
    ],
  };
  const body = requestBody(spec);
  if (body) {
    item.request.body = body;
    item.response[0].originalRequest.body = body;
  }
  folders[spec.module][spec.group].push(item);
  const label = `${result.status} ${spec.module} / ${spec.group} / ${spec.title}`;
  console.log(label);
  if (result.status >= 500) {
    throw new Error(`${label}\n${result.text.slice(0, 500)}`);
  }
  return result;
}

function dataOf(result, label) {
  if (!result.json || result.json.success !== true) {
    throw new Error(`${label} did not return data (${result.status}) ${result.text.slice(0, 400)}`);
  }
  return result.json.data;
}

async function main() {
  const rootResult = await record({
    module: "Course",
    group: "Success",
    title: "Service root",
    method: "GET",
    path: "/",
  });
  dataOf(rootResult, "service root");

  const createMba = await record({
    module: "Course",
    group: "Success",
    title: "Create MBA (AKTU)",
    method: "POST",
    path: "/api/courses",
    body: { courseCode: "AKTU01", courseName: "MBA (AKTU)", affiliation: "AKTU", durationYears: 2, lateFeePerDay: 15 },
  });

  const createBba = await record({
    module: "Course",
    group: "Success",
    title: "Create a second course",
    method: "POST",
    path: "/api/courses",
    body: { courseCode: "AKTU02", courseName: "BBA (AKTU)", affiliation: "AKTU", durationYears: 3, lateFeePerDay: 5 },
  });

  const courseList = dataOf(
    await record({
      module: "Course",
      group: "Success",
      title: "List courses",
      method: "GET",
      path: "/api/courses",
    }),
    "list courses"
  );
  const mba = courseList.find((course) => course.courseCode === "AKTU01");
  const bba = courseList.find((course) => course.courseCode === "AKTU02");
  if (!mba) {
    throw new Error(`AKTU01 missing after create (${createMba.status})`);
  }
  if (!bba) {
    throw new Error(`AKTU02 missing after create (${createBba.status})`);
  }
  variables.courseId = String(mba.id);
  variables.secondCourseId = String(bba.id);

  await record({
    module: "Course",
    group: "Success",
    title: "Get by id",
    method: "GET",
    path: `/api/courses/${mba.id}`,
    variablePath: "/api/courses/{{courseId}}",
  });
  await record({
    module: "Course",
    group: "Success",
    title: "Update the name",
    method: "PATCH",
    path: `/api/courses/${mba.id}`,
    variablePath: "/api/courses/{{courseId}}",
    body: { courseName: "MBA (AKTU) Updated" },
  });
  await record({
    module: "Course",
    group: "Success",
    title: "Deactivate a course",
    method: "PATCH",
    path: `/api/courses/${bba.id}`,
    variablePath: "/api/courses/{{secondCourseId}}",
    body: { active: false },
  });
  await record({
    module: "Course",
    group: "Success",
    title: "Read the deactivated course",
    method: "GET",
    path: `/api/courses/${bba.id}`,
    variablePath: "/api/courses/{{secondCourseId}}",
  });

  const courseErrors = [
    ["Missing courseCode", { courseName: "BBA (LU)", affiliation: "LU", lateFeePerDay: 5 }],
    ["Missing courseName", { courseCode: "LU01", affiliation: "LU", lateFeePerDay: 5 }],
    ["Affiliation other than AKTU or LU", { courseCode: "LU01", courseName: "BBA (LU)", affiliation: "CBSE", lateFeePerDay: 5 }],
    ["lateFeePerDay of 0", { courseCode: "LU01", courseName: "BBA (LU)", affiliation: "LU", lateFeePerDay: 0 }],
    ["Negative lateFeePerDay", { courseCode: "LU01", courseName: "BBA (LU)", affiliation: "LU", lateFeePerDay: -5 }],
    ["lateFeePerDay sent as a string", { courseCode: "LU01", courseName: "BBA (LU)", affiliation: "LU", lateFeePerDay: "5" }],
    ["Empty courseCode", { courseCode: "", courseName: "BBA (LU)", affiliation: "LU", lateFeePerDay: 5 }],
    ["Unknown field", { courseCode: "LU01", courseName: "BBA (LU)", affiliation: "LU", lateFeePerDay: 5, department: "Management" }],
  ];
  for (const [title, body] of courseErrors) {
    await record({ module: "Course", group: "Wrong entry", title, method: "POST", path: "/api/courses", body });
  }
  await record({
    module: "Course",
    group: "Wrong entry",
    title: "Non-numeric id",
    method: "GET",
    path: "/api/courses/abc",
  });
  await record({
    module: "Course",
    group: "Other failure",
    title: "Duplicate courseCode",
    method: "POST",
    path: "/api/courses",
    body: { courseCode: "AKTU01", courseName: "MBA duplicate", affiliation: "AKTU", durationYears: 2, lateFeePerDay: 15 },
  });
  await record({
    module: "Course",
    group: "Other failure",
    title: "Get an id that does not exist",
    method: "GET",
    path: "/api/courses/999999",
  });
  await record({
    module: "Course",
    group: "Other failure",
    title: "Patch an id that does not exist",
    method: "PATCH",
    path: "/api/courses/999999",
    body: { courseName: "Missing" },
  });
  await record({
    module: "Course",
    group: "Other failure",
    title: "Invalid JSON body",
    method: "POST",
    path: "/api/courses",
    raw: '{"courseCode":',
  });

  await record({
    module: "Fee",
    group: "Success",
    title: "Create academic year",
    method: "POST",
    path: "/api/academic-years",
    body: { label: "2026-27", startDate: "2026-07-01", endDate: "2027-06-30" },
  });
  const years = dataOf(
    await record({
      module: "Fee",
      group: "Success",
      title: "List academic years",
      method: "GET",
      path: "/api/academic-years",
    }),
    "list academic years"
  );
  const year = years.find((item) => item.label === "2026-27");
  if (!year) {
    throw new Error("academic year 2026-27 was not found");
  }
  variables.academicYearId = String(year.id);

  const semesterCreate = await record({
    module: "Fee",
    group: "Success",
    title: "Create semester",
    method: "POST",
    path: "/api/semesters",
    body: { academicYearId: year.id, name: "Ist Semester", dueDate: "2026-07-01", graceDays: 5 },
  });
  const semesters = dataOf(
    await record({
      module: "Fee",
      group: "Success",
      title: "List semesters",
      method: "GET",
      path: "/api/semesters",
    }),
    "list semesters"
  );
  const semester =
    semesterCreate.json?.data?.id != null
      ? semesterCreate.json.data
      : semesters.find((item) => item.academicYearId === year.id && item.name === "Ist Semester");
  if (!semester) {
    throw new Error(`semester was not created (${semesterCreate.status}) ${semesterCreate.text.slice(0, 300)}`);
  }
  variables.semesterId = String(semester.id);

  const structureInputs = [
    ["ACADEMIC_FEE", 10000],
    ["ACADEMIC_CAUTION", 1000],
    ["HOSTEL_FEE", 8000],
    ["HOSTEL_SECURITY", 500],
  ];
  for (const [component, amount] of structureInputs) {
    await record({
      module: "Fee",
      group: "Success",
      title: `Create ${component} structure`,
      method: "POST",
      path: "/api/fee-structures",
      body: {
        courseId: mba.id,
        academicYearId: year.id,
        semesterId: semester.id,
        component,
        studyYear: 1,
        amount,
      },
    });
  }
  const structures = dataOf(
    await record({
      module: "Fee",
      group: "Success",
      title: "List fee structures",
      method: "GET",
      path: "/api/fee-structures",
    }),
    "list fee structures"
  );
  for (const [component] of structureInputs) {
    const found = structures.find(
      (item) =>
        item.courseId === mba.id &&
        item.academicYearId === year.id &&
        item.semesterId === semester.id &&
        item.component === component &&
        item.studyYear === 1
    );
    if (!found) {
      throw new Error(`fee structure ${component} is missing`);
    }
  }

  const ids = { courseId: mba.id, academicYearId: year.id, semesterId: semester.id };

  async function ensureStudent(module, group, title, registrationNumber, name, email) {
    const created = await record({
      module,
      group,
      title,
      method: "POST",
      path: "/api/students",
      body: studentBody(registrationNumber, name, email, ids),
    });
    if (created.json?.data?.accounts) {
      return created.json.data;
    }
    const search = await call({ method: "GET", path: `/api/students?q=${encodeURIComponent(registrationNumber)}` });
    const row = search.json?.data?.find((student) => student.registrationNumber === registrationNumber);
    if (!row) {
      throw new Error(`${registrationNumber} was not created (${created.status}) ${created.text.slice(0, 300)}`);
    }
    const loaded = await call({ method: "GET", path: `/api/students/${row.id}` });
    return dataOf(loaded, registrationNumber);
  }

  function accountOf(student, product) {
    const account = student.accounts.find((item) => item.product === product);
    if (!account) {
      throw new Error(`${student.registrationNumber} has no ${product} account`);
    }
    return account;
  }

  const onTime = await ensureStudent("Student", "Success", "Create student before enrolment number", "REG-ONTIME", "Asha Rao", "asha@example.com");
  variables.onTimeStudentId = String(onTime.id);
  variables.onTimeAccountId = String(accountOf(onTime, "ACADEMIC").id);
  await record({
    module: "Student",
    group: "Success",
    title: "Search by registration number",
    method: "GET",
    path: "/api/students?q=REG-ONTIME",
  });
  await record({
    module: "Student",
    group: "Success",
    title: "Get student by id",
    method: "GET",
    path: `/api/students/${onTime.id}`,
    variablePath: "/api/students/{{onTimeStudentId}}",
  });
  await record({
    module: "Student",
    group: "Success",
    title: "Add enrolment number to the same student",
    method: "PATCH",
    path: `/api/students/${onTime.id}`,
    variablePath: "/api/students/{{onTimeStudentId}}",
    body: { enrolmentNumber: "ENR1001" },
  });

  const late = await ensureStudent("Fee", "Setup", "Create the student used for fines and deposits", "REG-LATE", "Bharat Singh", "bharat@example.com");
  variables.lateStudentId = String(late.id);
  const lateAccountId = accountOf(late, "ACADEMIC").id;
  variables.lateAccountId = String(lateAccountId);
  await record({
    module: "Fee",
    group: "Success",
    title: "Read a fee account",
    method: "GET",
    path: `/api/fees/accounts/${lateAccountId}`,
    variablePath: "/api/fees/accounts/{{lateAccountId}}",
  });

  const host = await ensureStudent("Student", "Success", "Create a day scholar who later joins the hostel", "REG-HOST", "Charu Das", "charu@example.com");
  variables.hostStudentId = String(host.id);
  await record({
    module: "Student",
    group: "Success",
    title: "Mark the student as a hosteller and assess hostel fees",
    method: "PATCH",
    path: `/api/students/${host.id}`,
    variablePath: "/api/students/{{hostStudentId}}",
    body: { isHosteller: true },
  });

  const left = await ensureStudent("Student", "Success", "Mark a student as left", "REG-LEFT", "Deepa Nair", "deepa@example.com");
  variables.leftStudentId = String(left.id);
  await record({
    module: "Student",
    group: "Success",
    title: "Record the leaving date without moving money",
    method: "PATCH",
    path: `/api/students/${left.id}`,
    variablePath: "/api/students/{{leftStudentId}}",
    body: { status: "LEFT", leftOn: "2026-12-01" },
  });

  await record({
    module: "Payment",
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
      allocations: [{ feeAccountId: Number(variables.onTimeAccountId), bucket: "DUES", amount: 10000 }],
    },
  });

  const fineRun = dataOf(
    await record({
      module: "Fee",
      group: "Success",
      title: "Run late fees as of 2026-07-10",
      method: "POST",
      path: "/api/fees/fines/run",
      body: { asOfDate: "2026-07-10", actedBy: "fee-admin" },
    }),
    "run fines"
  );
  const lateFine = fineRun.posted.find((line) => line.feeAccountId === lateAccountId);
  if (!lateFine) {
    throw new Error(`no fine was posted for account ${lateAccountId}`);
  }
  variables.lateFineId = String(lateFine.id);
  await record({
    module: "Fee",
    group: "Success",
    title: "Run late fees again for the same date",
    method: "POST",
    path: "/api/fees/fines/run",
    body: { asOfDate: "2026-07-10", actedBy: "fee-admin" },
  });
  await record({
    module: "Fee",
    group: "Wrong entry",
    title: "Waive more than the fine",
    method: "POST",
    path: `/api/fees/fines/${lateFine.id}/waive`,
    variablePath: "/api/fees/fines/{{lateFineId}}/waive",
    body: { amount: lateFine.amount + 1, actedBy: "fee-admin", reason: "Too much" },
  });
  await record({
    module: "Fee",
    group: "Success",
    title: "Waive part of a fine",
    method: "POST",
    path: `/api/fees/fines/${lateFine.id}/waive`,
    variablePath: "/api/fees/fines/{{lateFineId}}/waive",
    body: { amount: 10, actedBy: "fee-admin", reason: "Approved waiver" },
  });
  const lateAccount = dataOf(
    await record({
      module: "Fee",
      group: "Success",
      title: "Read the account after the waiver",
      method: "GET",
      path: `/api/fees/accounts/${lateAccountId}`,
      variablePath: "/api/fees/accounts/{{lateAccountId}}",
    }),
    "account after waiver"
  );
  const assessment = lateAccount.lines.find((line) => line.entryType === "ASSESSMENT" && line.bucket === "DUES");
  if (!assessment) {
    throw new Error("dues assessment line was not found");
  }
  variables.assessmentEntryId = String(assessment.id);
  await record({
    module: "Fee",
    group: "Other failure",
    title: "Waive a line that is not a fine",
    method: "POST",
    path: `/api/fees/fines/${assessment.id}/waive`,
    variablePath: "/api/fees/fines/{{assessmentEntryId}}/waive",
    body: { amount: 10, actedBy: "fee-admin", reason: "Not a fine" },
  });
  await record({
    module: "Fee",
    group: "Other failure",
    title: "Read a missing fee account",
    method: "GET",
    path: "/api/fees/accounts/999999",
  });

  await record({
    module: "Fee",
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
  });
  await record({
    module: "Fee",
    group: "Wrong entry",
    title: "Refund more than the deposit held",
    method: "POST",
    path: `/api/fees/deposits/${lateAccountId}/refund`,
    variablePath: "/api/fees/deposits/{{lateAccountId}}/refund",
    body: { amount: 1001, actedBy: "fee-admin", reason: "Too much" },
  });
  await record({
    module: "Fee",
    group: "Success",
    title: "Refund caution with a deduction",
    method: "POST",
    path: `/api/fees/deposits/${lateAccountId}/refund`,
    variablePath: "/api/fees/deposits/{{lateAccountId}}/refund",
    body: {
      amount: 400,
      deductionAmount: 100,
      deductionReason: "Damage",
      actedBy: "fee-admin",
      reason: "Left after semester 1",
    },
  });
  await record({
    module: "Fee",
    group: "Success",
    title: "Adjust deposit against dues",
    method: "POST",
    path: `/api/fees/deposits/${lateAccountId}/adjust`,
    variablePath: "/api/fees/deposits/{{lateAccountId}}/adjust",
    body: { amount: 200, actedBy: "fee-admin", reason: "Apply caution to fees" },
  });

  await record({
    module: "Fee",
    group: "Wrong entry",
    title: "Unknown fee component",
    method: "POST",
    path: "/api/fee-structures",
    body: { courseId: mba.id, academicYearId: year.id, semesterId: semester.id, component: "LIBRARY", studyYear: 1, amount: 1000 },
  });
  await record({
    module: "Fee",
    group: "Wrong entry",
    title: "Fee amount of 0",
    method: "POST",
    path: "/api/fee-structures",
    body: { courseId: mba.id, academicYearId: year.id, semesterId: semester.id, component: "ACADEMIC_FEE", studyYear: 2, amount: 0 },
  });
  await record({
    module: "Fee",
    group: "Wrong entry",
    title: "Unknown course",
    method: "POST",
    path: "/api/fee-structures",
    body: { courseId: 999999, academicYearId: year.id, semesterId: semester.id, component: "ACADEMIC_FEE", studyYear: 1, amount: 1000 },
  });
  await record({
    module: "Fee",
    group: "Wrong entry",
    title: "Duplicate fee structure",
    method: "POST",
    path: "/api/fee-structures",
    body: { courseId: mba.id, academicYearId: year.id, semesterId: semester.id, component: "ACADEMIC_FEE", studyYear: 1, amount: 10000 },
  });

  await record({
    module: "Student",
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
      courseId: mba.id,
      academicYearId: year.id,
      semesterId: semester.id,
      admissionType: "DIRECT",
    },
  });
  await record({
    module: "Student",
    group: "Wrong entry",
    title: "Admission type outside DIRECT or COUNSELLING",
    method: "POST",
    path: "/api/students",
    body: { ...studentBody("REG-BADTYPE", "Bad Type", "badtype@example.com", ids), admissionType: "LATERAL" },
  });
  await record({
    module: "Student",
    group: "Wrong entry",
    title: "Unknown course on a student",
    method: "POST",
    path: "/api/students",
    body: { ...studentBody("REG-NOCOURSE", "No Course", "nocourse@example.com", ids), courseId: 999999 },
  });
  await record({
    module: "Student",
    group: "Wrong entry",
    title: "Duplicate registration number",
    method: "POST",
    path: "/api/students",
    body: studentBody("REG-ONTIME", "Asha Copy", "asha.copy@example.com", ids),
  });
  await record({
    module: "Student",
    group: "Other failure",
    title: "Get a missing student",
    method: "GET",
    path: "/api/students/999999",
  });
  await record({
    module: "Student",
    group: "Other failure",
    title: "Patch a missing student",
    method: "PATCH",
    path: "/api/students/999999",
    body: { enrolmentNumber: "ENR-MISSING" },
  });

  const payer = await ensureStudent("Payment", "Setup", "Create the student who pays online", "REG-PAY", "Esha Iyer", "esha@example.com");
  variables.payerStudentId = String(payer.id);
  const payerAccountId = accountOf(payer, "ACADEMIC").id;
  variables.payerAccountId = String(payerAccountId);

  const hdfc = dataOf(
    await record({
      module: "Payment",
      group: "Success",
      title: "Start an HDFC payment",
      method: "POST",
      path: "/api/payments",
      body: {
        method: "HDFC",
        idempotencyKey: "hdfc-pay-2000",
        allocations: [{ feeAccountId: payerAccountId, bucket: "DUES", amount: 2000 }],
      },
    }),
    "start HDFC payment"
  );
  variables.hdfcPaymentId = String(hdfc.id);
  await record({
    module: "Payment",
    group: "Success",
    title: "Confirm the HDFC payment",
    method: "POST",
    path: `/api/payments/${hdfc.id}/callback`,
    variablePath: "/api/payments/{{hdfcPaymentId}}/callback",
    body: { status: "SUCCESS", paidOn: "2026-11-11" },
  });
  await record({
    module: "Payment",
    group: "Success",
    title: "Repeat the successful HDFC callback",
    method: "POST",
    path: `/api/payments/${hdfc.id}/callback`,
    variablePath: "/api/payments/{{hdfcPaymentId}}/callback",
    body: { status: "SUCCESS", paidOn: "2026-11-11" },
  });
  await record({
    module: "Payment",
    group: "Success",
    title: "Download the receipt",
    method: "GET",
    path: `/api/receipts/${hdfc.id}`,
    variablePath: "/api/receipts/{{hdfcPaymentId}}",
  });

  const failed = dataOf(
    await record({
      module: "Payment",
      group: "Success",
      title: "Start a second HDFC payment",
      method: "POST",
      path: "/api/payments",
      body: {
        method: "HDFC",
        idempotencyKey: "hdfc-pay-fail",
        allocations: [{ feeAccountId: payerAccountId, bucket: "DUES", amount: 500 }],
      },
    }),
    "start failed HDFC payment"
  );
  variables.failedPaymentId = String(failed.id);
  await record({
    module: "Payment",
    group: "Success",
    title: "Mark the HDFC payment failed",
    method: "POST",
    path: `/api/payments/${failed.id}/callback`,
    variablePath: "/api/payments/{{failedPaymentId}}/callback",
    body: { status: "FAILED" },
  });
  await record({
    module: "Payment",
    group: "Other failure",
    title: "Receipt before success",
    method: "GET",
    path: `/api/receipts/${failed.id}`,
    variablePath: "/api/receipts/{{failedPaymentId}}",
  });

  const challan = dataOf(
    await record({
      module: "Payment",
      group: "Success",
      title: "Record a challan payment",
      method: "POST",
      path: "/api/payments",
      body: {
        method: "CHALLAN",
        idempotencyKey: "challan-1000",
        reference: "CHALLAN-1000",
        actedBy: "fee-clerk",
        allocations: [{ feeAccountId: payerAccountId, bucket: "DUES", amount: 1000 }],
      },
    }),
    "record challan"
  );
  variables.challanPaymentId = String(challan.id);
  await record({
    module: "Payment",
    group: "Success",
    title: "Verify the challan",
    method: "POST",
    path: `/api/payments/${challan.id}/verify`,
    variablePath: "/api/payments/{{challanPaymentId}}/verify",
    body: { paidOn: "2026-11-11", actedBy: "fee-clerk" },
  });
  await record({
    module: "Payment",
    group: "Wrong entry",
    title: "Amount above the outstanding balance",
    method: "POST",
    path: "/api/payments",
    body: {
      method: "HDFC",
      idempotencyKey: "hdfc-too-much",
      allocations: [{ feeAccountId: payerAccountId, bucket: "DUES", amount: 999999 }],
    },
  });
  await record({
    module: "Payment",
    group: "Other failure",
    title: "Callback for an unknown payment",
    method: "POST",
    path: "/api/payments/999999/callback",
    body: { status: "SUCCESS" },
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
    "admissionType",
    "isHosteller",
    "studyYear",
    "academicYearLabel",
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
      admissionType,
      false,
      1,
      "2026-27",
      "Ist Semester",
    ];
  }
  const validFile = await writeSheet("students-valid.xlsx", [sheetRow("REG-XLS", "Farah Khan", "farah@example.com", "DIRECT")]);
  const badFile = await writeSheet("students-bad.xlsx", [
    ["", "No Reg", "9876543210", "9123456780", "noreg@example.com", "Father", "Management", "AKTU01", "DIRECT", false, 1, "2026-27", "Ist Semester"],
  ]);
  const duplicateFile = await writeSheet("students-duplicate.xlsx", [sheetRow("REG-ONTIME", "Asha Copy", "copy@example.com", "COUNSELLING")]);

  const validPreview = dataOf(
    await record({
      module: "Student",
      group: "Success",
      title: "Preview a valid student workbook",
      method: "POST",
      path: "/api/students/imports/preview",
      file: validFile,
      fileName: "students-valid.xlsx",
      fixturePath: "docs/fixtures/students-valid.xlsx",
      description: "Multipart field file. The workbook is docs/fixtures/students-valid.xlsx.",
    }),
    "valid preview"
  );
  variables.validBatchId = String(validPreview.id);
  await record({
    module: "Student",
    group: "Success",
    title: "Commit the valid preview",
    method: "POST",
    path: `/api/students/imports/${validPreview.id}/commit`,
    variablePath: "/api/students/imports/{{validBatchId}}/commit",
  });
  const badPreview = dataOf(
    await record({
      module: "Student",
      group: "Wrong entry",
      title: "Preview a workbook row with an empty registration number",
      method: "POST",
      path: "/api/students/imports/preview",
      file: badFile,
      fileName: "students-bad.xlsx",
      fixturePath: "docs/fixtures/students-bad.xlsx",
      description: "Multipart field file. The workbook is docs/fixtures/students-bad.xlsx.",
    }),
    "bad preview"
  );
  variables.badBatchId = String(badPreview.id);
  await record({
    module: "Student",
    group: "Wrong entry",
    title: "Preview a workbook row with a duplicate registration number",
    method: "POST",
    path: "/api/students/imports/preview",
    file: duplicateFile,
    fileName: "students-duplicate.xlsx",
    fixturePath: "docs/fixtures/students-duplicate.xlsx",
    description: "Multipart field file. The workbook is docs/fixtures/students-duplicate.xlsx.",
  });
  await record({
    module: "Student",
    group: "Other failure",
    title: "Commit a preview that has errors",
    method: "POST",
    path: `/api/students/imports/${badPreview.id}/commit`,
    variablePath: "/api/students/imports/{{badBatchId}}/commit",
  });
  await record({
    module: "Student",
    group: "Other failure",
    title: "Commit a preview that was already committed",
    method: "POST",
    path: `/api/students/imports/${validPreview.id}/commit`,
    variablePath: "/api/students/imports/{{validBatchId}}/commit",
  });

  await record({
    module: "Reminder",
    group: "Success",
    title: "Send SMS and WhatsApp reminders",
    method: "POST",
    path: "/api/reminders",
    body: { studentIds: [late.id], channels: ["SMS", "WHATSAPP"], actedBy: "fee-admin" },
  });
  await record({
    module: "Reminder",
    group: "Success",
    title: "List students reminded and still unpaid",
    method: "GET",
    path: "/api/reminders?unpaid=true",
  });
  await record({
    module: "Reminder",
    group: "Wrong entry",
    title: "Remind a student with no dues",
    method: "POST",
    path: "/api/reminders",
    body: { studentIds: [onTime.id], channels: ["SMS"], actedBy: "fee-admin" },
  });
  await record({
    module: "Reminder",
    group: "Wrong entry",
    title: "Empty channel list",
    method: "POST",
    path: "/api/reminders",
    body: { studentIds: [late.id], channels: [], actedBy: "fee-admin" },
  });
  await record({
    module: "Reminder",
    group: "Other failure",
    title: "Unknown student",
    method: "POST",
    path: "/api/reminders",
    body: { studentIds: [999999], channels: ["SMS"], actedBy: "fee-admin" },
  });

  const reportQuery = "from=2026-07-01&to=2026-11-17";
  await record({
    module: "Report",
    group: "Success",
    title: "Payments by date",
    method: "GET",
    path: `/api/reports/payments?${reportQuery}&format=json`,
  });
  await record({
    module: "Report",
    group: "Success",
    title: "Payments by date and course",
    method: "GET",
    path: `/api/reports/payments?${reportQuery}&courseId=${mba.id}&format=json`,
    variablePath: `/api/reports/payments?${reportQuery}&courseId={{courseId}}&format=json`,
  });
  await record({
    module: "Report",
    group: "Success",
    title: "Payments workbook",
    method: "GET",
    path: `/api/reports/payments?${reportQuery}&format=xlsx`,
    note: "The body is an xlsx workbook, not JSON.",
  });
  await record({
    module: "Report",
    group: "Success",
    title: "Unpaid students",
    method: "GET",
    path: "/api/reports/unpaid",
  });
  await record({
    module: "Report",
    group: "Success",
    title: "Unpaid students for one course",
    method: "GET",
    path: `/api/reports/unpaid?courseId=${mba.id}`,
    variablePath: "/api/reports/unpaid?courseId={{courseId}}",
  });
  await record({
    module: "Report",
    group: "Success",
    title: "Failed payments",
    method: "GET",
    path: "/api/reports/failed-payments",
  });
  await record({
    module: "Report",
    group: "Success",
    title: "On-time payment percentage",
    method: "GET",
    path: `/api/reports/on-time?semesterId=${semester.id}`,
    variablePath: "/api/reports/on-time?semesterId={{semesterId}}",
  });
  await record({
    module: "Report",
    group: "Success",
    title: "Waiver count and percentage",
    method: "GET",
    path: `/api/reports/waivers?semesterId=${semester.id}`,
    variablePath: "/api/reports/waivers?semesterId={{semesterId}}",
  });
  await record({
    module: "Report",
    group: "Success",
    title: "Students who left",
    method: "GET",
    path: "/api/reports/left-students",
  });
  await record({
    module: "Report",
    group: "Success",
    title: "Semester fine collection",
    method: "GET",
    path: `/api/reports/fines?semesterId=${semester.id}`,
    variablePath: "/api/reports/fines?semesterId={{semesterId}}",
  });
  await record({
    module: "Report",
    group: "Success",
    title: "Reconciliation",
    method: "GET",
    path: "/api/reports/reconciliation",
  });
  await record({
    module: "Report",
    group: "Other failure",
    title: "Unknown semester",
    method: "GET",
    path: "/api/reports/on-time?semesterId=999999",
  });

  const collection = {
    info: {
      name: "ICCMRT Fee Management",
      description:
        "Recorded from https://feemanagement-icmrt.vercel.app. Each request body is the payload that was sent. Each saved example is the status code and body the API returned.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: MODULES.map((name) => ({
      name,
      item: GROUPS.filter((group) => folders[name][group].length > 0).map((group) => ({
        name: group,
        item: folders[name][group],
      })),
    })),
    variable: Object.entries(variables).map(([key, value]) => ({ key, value })),
  };

  fs.mkdirSync(outDir, { recursive: true });
  const collectionPath = path.join(outDir, "ICCMRT-Fee-Management.postman_collection.json");
  fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`);
  const environment = {
    name: "ICCMRT Fee Management",
    values: [
      {
        key: "baseUrl",
        value: BASE,
        type: "default",
        enabled: true,
      },
    ],
    _postman_variable_scope: "environment",
  };
  fs.writeFileSync(path.join(outDir, "ICCMRT-Fee-Management.postman_environment.json"), `${JSON.stringify(environment, null, 2)}\n`);

  let requests = 0;
  for (const name of MODULES) {
    for (const group of GROUPS) {
      requests += folders[name][group].length;
    }
  }
  console.log(`wrote ${requests} requests to ${collectionPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
