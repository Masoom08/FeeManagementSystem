# Student module

## Session-by-session academic and hostel details

Student records include an `academicYears` array. Each entry identifies its
session, study year, hostel status, and optional hostel rate. For example:

```json
{"academicYears":[
  {"sessionId":11,"studyYear":1,"session":{"label":"2022-23"},"isHosteller":true,"hostelRate":{"condition":"Non-AC","occupancy":"Double seater"}},
  {"sessionId":12,"studyYear":2,"session":{"label":"2023-24"},"isHosteller":false,"hostelRate":null}
]}
```

Super admins can set a student's status for an individual session:

```http
PATCH /api/students/123/academic-years/11
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{"isHosteller":true,"hostelRateId":4}
```

Set `isHosteller` to `false` to clear that session's hostel rate. The student's
existing `isHosteller` field remains a compatibility mirror of their current
session. The mobile profile and staff student roster show the year-by-year
history.

Registration number is the unique key. The enrolment number is added on the same row. A valid workbook is previewed, then committed. The cases below are one complete example run.

Base URL: `https://fee-management-icmrt.vercel.app`

On the deployment today, `GET /api/students` and `GET /api/students?q=REG` return `{"success":true,"data":[]}`. `GET /api/students/1` returns `404` `{"success":false,"error":"NOT_FOUND"}`. Creating `REG-ONTIME` against semester `1` returns `404` `{"success":false,"error":"SEMESTER_NOT_FOUND"}` because no semester exists yet. `POST /api/students/imports/preview` without a file returns `400` `{"success":false,"error":"FILE_REQUIRED","details":[{"path":"file","message":"xlsx file is required"}]}`. Import batch `1` already exists from an earlier preview, and `POST /api/students/imports/1/commit` returns `409` `{"success":false,"error":"PREVIEW_HAS_ERRORS"}`.

## Success

### Create student before enrolment number

`POST /api/students`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"REG-ONTIME","name":"Asha Rao","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"asha@example.com","fatherName":"Asha Rao Father","branch":"Management","courseId":1,"sessionId":1,"semesterId":1,"admissionType":"DIRECT"}'
```

Status: `201`

```json
{"success":true,"data":{"id":1,"registrationNumber":"REG-ONTIME","enrolmentNumber":null,"name":"Asha Rao","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"asha@example.com","fatherName":"Asha Rao Father","branch":"Management","courseId":1,"sessionId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":false,"studyYear":1,"status":"ACTIVE","leftOn":null,"course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":1,"studentId":1,"product":"ACADEMIC","sessionId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":1,"feeAccountId":1,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":2,"feeAccountId":1,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}}
```

### Search by registration number

`GET /api/students?q=REG-ONTIME`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/students?q=REG-ONTIME
```

Status: `200`

```json
{"success":true,"data":[{"id":1,"registrationNumber":"REG-ONTIME","enrolmentNumber":null,"name":"Asha Rao","courseId":1,"status":"ACTIVE","isHosteller":false,"duesOutstanding":10000}]}
```

### Get student by id

`GET /api/students/1`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/students/1
```

Status: `200`

```json
{"success":true,"data":{"id":1,"registrationNumber":"REG-ONTIME","enrolmentNumber":null,"name":"Asha Rao","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"asha@example.com","fatherName":"Asha Rao Father","branch":"Management","courseId":1,"sessionId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":false,"studyYear":1,"status":"ACTIVE","leftOn":null,"course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":1,"studentId":1,"product":"ACADEMIC","sessionId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":1,"feeAccountId":1,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":2,"feeAccountId":1,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}}
```

### Add enrolment number to the same student

`PATCH /api/students/1`

```bash
curl -X PATCH https://fee-management-icmrt.vercel.app/api/students/1 \
  -H "Content-Type: application/json" \
  -d '{"enrolmentNumber":"ENR1001"}'
```

Status: `200`

```json
{"success":true,"data":{"id":1,"registrationNumber":"REG-ONTIME","enrolmentNumber":"ENR1001","name":"Asha Rao","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"asha@example.com","fatherName":"Asha Rao Father","branch":"Management","courseId":1,"sessionId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":false,"studyYear":1,"status":"ACTIVE","leftOn":null,"course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":1,"studentId":1,"product":"ACADEMIC","sessionId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":1,"feeAccountId":1,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":2,"feeAccountId":1,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}}
```

### Create a day scholar who later joins the hostel

`POST /api/students`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"REG-HOST","name":"Charu Das","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"charu@example.com","fatherName":"Charu Das Father","branch":"Management","courseId":1,"sessionId":1,"semesterId":1,"admissionType":"DIRECT"}'
```

Status: `201`

```json
{"success":true,"data":{"id":3,"registrationNumber":"REG-HOST","enrolmentNumber":null,"name":"Charu Das","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"charu@example.com","fatherName":"Charu Das Father","branch":"Management","courseId":1,"sessionId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":false,"studyYear":1,"status":"ACTIVE","leftOn":null,"course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":3,"studentId":3,"product":"ACADEMIC","sessionId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":5,"feeAccountId":3,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":6,"feeAccountId":3,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}}
```

### Mark the student as a hosteller and assess hostel fees

`PATCH /api/students/3`

```bash
curl -X PATCH https://fee-management-icmrt.vercel.app/api/students/3 \
  -H "Content-Type: application/json" \
  -d '{"isHosteller":true}'
```

Status: `200`

```json
{"success":true,"data":{"id":3,"registrationNumber":"REG-HOST","enrolmentNumber":null,"name":"Charu Das","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"charu@example.com","fatherName":"Charu Das Father","branch":"Management","courseId":1,"sessionId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":true,"studyYear":1,"status":"ACTIVE","leftOn":null,"course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":3,"studentId":3,"product":"ACADEMIC","sessionId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":5,"feeAccountId":3,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":6,"feeAccountId":3,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]},{"id":4,"studentId":3,"product":"HOSTEL","sessionId":1,"duesOutstanding":8000,"depositHeld":0,"depositOutstanding":500,"lines":[{"id":7,"feeAccountId":4,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":8000,"component":"HOSTEL_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":8,"feeAccountId":4,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":500,"component":"HOSTEL_SECURITY","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}}
```

### Mark a student as left

`POST /api/students`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"REG-LEFT","name":"Deepa Nair","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"deepa@example.com","fatherName":"Deepa Nair Father","branch":"Management","courseId":1,"sessionId":1,"semesterId":1,"admissionType":"DIRECT"}'
```

Status: `201`

```json
{"success":true,"data":{"id":4,"registrationNumber":"REG-LEFT","enrolmentNumber":null,"name":"Deepa Nair","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"deepa@example.com","fatherName":"Deepa Nair Father","branch":"Management","courseId":1,"sessionId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":false,"studyYear":1,"status":"ACTIVE","leftOn":null,"course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":5,"studentId":4,"product":"ACADEMIC","sessionId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":9,"feeAccountId":5,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":10,"feeAccountId":5,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}}
```

### Record the leaving date without moving money

`PATCH /api/students/4`

```bash
curl -X PATCH https://fee-management-icmrt.vercel.app/api/students/4 \
  -H "Content-Type: application/json" \
  -d '{"status":"LEFT","leftOn":"2026-12-01"}'
```

Status: `200`

```json
{"success":true,"data":{"id":4,"registrationNumber":"REG-LEFT","enrolmentNumber":null,"name":"Deepa Nair","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"deepa@example.com","fatherName":"Deepa Nair Father","branch":"Management","courseId":1,"sessionId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":false,"studyYear":1,"status":"LEFT","leftOn":"2026-12-01T00:00:00.000Z","course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":5,"studentId":4,"product":"ACADEMIC","sessionId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":9,"feeAccountId":5,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":10,"feeAccountId":5,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}}
```

### Preview a valid student workbook

`POST /api/students/imports/preview`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students/imports/preview \
  -F "file=@docs/fixtures/students-valid.xlsx"
```

Status: `200`

```json
{"success":true,"data":{"id":1,"status":"PREVIEW","fileName":"students-valid.xlsx","rows":[{"rowNumber":2,"valid":true,"errors":null,"payload":{"name":"Farah Khan","email":"farah@example.com","branch":"Management","courseId":1,"studyYear":1,"courseCode":"AKTU01","fatherName":"Farah Khan Father","semesterId":1,"isHosteller":false,"phoneNumber":"9123456780","semesterName":"SEMESTER_1","admissionType":"DIRECT","sessionId":1,"whatsappNumber":"9876543210","sessionLabel":"2026-27","registrationNumber":"REG-XLS"}}]}}
```

### Commit the valid preview

`POST /api/students/imports/1/commit`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students/imports/1/commit
```

Status: `201`

```json
{"success":true,"data":{"batchId":1,"status":"COMMITTED","students":[{"id":7,"registrationNumber":"REG-XLS","enrolmentNumber":null,"name":"Farah Khan","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"farah@example.com","fatherName":"Farah Khan Father","branch":"Management","courseId":1,"sessionId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":false,"studyYear":1,"status":"ACTIVE","leftOn":null,"course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":7,"studentId":7,"product":"ACADEMIC","sessionId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":26,"feeAccountId":7,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":27,"feeAccountId":7,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}]}}
```

## Wrong entry

### Missing registration number

`POST /api/students`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students \
  -H "Content-Type: application/json" \
  -d '{"name":"Missing Reg","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"missing@example.com","fatherName":"Father","branch":"Management","courseId":1,"sessionId":1,"semesterId":1,"admissionType":"DIRECT"}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"registrationNumber","message":"registrationNumber is required"}]}
```

### Admission type outside DIRECT or COUNSELLING

`POST /api/students`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"REG-BADTYPE","name":"Bad Type","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"badtype@example.com","fatherName":"Bad Type Father","branch":"Management","courseId":1,"sessionId":1,"semesterId":1,"admissionType":"LATERAL"}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"admissionType","message":"admissionType must be DIRECT or COUNSELLING"}]}
```

### Unknown course on a student

`POST /api/students`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"REG-NOCOURSE","name":"No Course","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"nocourse@example.com","fatherName":"No Course Father","branch":"Management","courseId":999999,"sessionId":1,"semesterId":1,"admissionType":"DIRECT"}'
```

Status: `404`

```json
{"success":false,"error":"COURSE_NOT_FOUND"}
```

### Duplicate registration number

`POST /api/students`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"REG-ONTIME","name":"Asha Copy","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"asha.copy@example.com","fatherName":"Asha Copy Father","branch":"Management","courseId":1,"sessionId":1,"semesterId":1,"admissionType":"DIRECT"}'
```

Status: `409`

```json
{"success":false,"error":"DUPLICATE_REGISTRATION_NUMBER"}
```

### Preview a workbook row with an empty registration number

`POST /api/students/imports/preview`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students/imports/preview \
  -F "file=@docs/fixtures/students-bad.xlsx"
```

Status: `200`

```json
{"success":true,"data":{"id":2,"status":"PREVIEW","fileName":"students-bad.xlsx","rows":[{"rowNumber":2,"valid":false,"errors":[{"path":"registrationNumber","message":"registrationNumber is required"}],"payload":{"name":"No Reg","email":"noreg@example.com","branch":"Management","studyYear":1,"courseCode":"AKTU01","fatherName":"Father","isHosteller":false,"phoneNumber":"9123456780","semesterName":"SEMESTER_1","admissionType":"DIRECT","whatsappNumber":"9876543210","sessionLabel":"2026-27","registrationNumber":""}}]}}
```

### Preview a workbook row with a duplicate registration number

`POST /api/students/imports/preview`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students/imports/preview \
  -F "file=@docs/fixtures/students-duplicate.xlsx"
```

Status: `200`

```json
{"success":true,"data":{"id":3,"status":"PREVIEW","fileName":"students-duplicate.xlsx","rows":[{"rowNumber":2,"valid":false,"errors":[{"path":"registrationNumber","message":"duplicate registration number"}],"payload":{"name":"Asha Copy","email":"copy@example.com","branch":"Management","studyYear":1,"courseCode":"AKTU01","fatherName":"Asha Copy Father","isHosteller":false,"phoneNumber":"9123456780","semesterName":"SEMESTER_1","admissionType":"COUNSELLING","whatsappNumber":"9876543210","sessionLabel":"2026-27","registrationNumber":"REG-ONTIME"}}]}}
```

## Other failure

### Get a missing student

`GET /api/students/999999`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/students/999999
```

Status: `404`

```json
{"success":false,"error":"NOT_FOUND"}
```

### Patch a missing student

`PATCH /api/students/999999`

```bash
curl -X PATCH https://fee-management-icmrt.vercel.app/api/students/999999 \
  -H "Content-Type: application/json" \
  -d '{"enrolmentNumber":"ENR-MISSING"}'
```

Status: `404`

```json
{"success":false,"error":"NOT_FOUND"}
```

### Commit a preview that has errors

`POST /api/students/imports/2/commit`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students/imports/2/commit
```

Status: `409`

```json
{"success":false,"error":"PREVIEW_HAS_ERRORS"}
```

### Commit a preview that was already committed

`POST /api/students/imports/1/commit`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students/imports/1/commit
```

Status: `409`

```json
{"success":false,"error":"ALREADY_COMMITTED"}
```
