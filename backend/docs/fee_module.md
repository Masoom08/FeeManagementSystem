# Fee module

Academic years, semesters, fee structures, ledger balances, late fees, waivers, and deposit settlement. Amounts in these curls are sample rows, not hardcoded college fees. The cases below are one complete example run, in order.

Base URL: `https://fee-management-icmrt.vercel.app`

On the deployment today, `GET /api/academic-years` returns year `2026-27` (id 1). `GET /api/semesters` and `GET /api/fee-structures` return `{"success":true,"data":[]}`. `GET /api/fees/accounts/1` returns `404` `{"success":false,"error":"NOT_FOUND"}`. Posting year `2026-27` again returns `409` `{"success":false,"error":"DUPLICATE_ACADEMIC_YEAR"}`. There is no `GET /api/fees`; fee reads use `/api/fees/accounts/:id`.

## Setup

### Create the student used for fines and deposits

`POST /api/students`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"REG-LATE","name":"Bharat Singh","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"bharat@example.com","fatherName":"Bharat Singh Father","branch":"Management","courseId":1,"academicYearId":1,"semesterId":1,"admissionType":"DIRECT"}'
```

Status: `201`

```json
{"success":true,"data":{"id":2,"registrationNumber":"REG-LATE","enrolmentNumber":null,"name":"Bharat Singh","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"bharat@example.com","fatherName":"Bharat Singh Father","branch":"Management","courseId":1,"academicYearId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":false,"studyYear":1,"status":"ACTIVE","leftOn":null,"course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":2,"studentId":2,"product":"ACADEMIC","academicYearId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":3,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":4,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}}
```

### Collect caution money before refund

`POST /api/payments`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments \
  -H "Content-Type: application/json" \
  -d '{"method":"CASH","idempotencyKey":"cash-late-caution","reference":"CASH-CAUTION","actedBy":"fee-clerk","paidOn":"2026-11-11","allocations":[{"feeAccountId":2,"bucket":"DEPOSIT","amount":1000}]}'
```

Status: `201`

```json
{"success":true,"data":{"id":2,"method":"CASH","status":"SUCCESS","amount":1000,"reference":"CASH-CAUTION","idempotencyKey":"cash-late-caution","receiptNo":"RCPT-000002","actedBy":"fee-clerk","paidOn":"2026-11-11T00:00:00.000Z","createdAt":"2026-11-11T10:12:47.269Z","allocations":[{"id":2,"paymentAttemptId":2,"feeAccountId":2,"bucket":"DEPOSIT","amount":1000}],"ledgerEntries":[{"id":17,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"PAYMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-clerk","reason":"CASH payment","relatedEntryId":null,"paymentAttemptId":2}]}}
```

## Success

### Create academic year

`POST /api/academic-years`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/academic-years \
  -H "Content-Type: application/json" \
  -d '{"label":"2026-27","startDate":"2026-07-01","endDate":"2027-06-30"}'
```

Status: `201`

```json
{"success":true,"data":{"id":1,"label":"2026-27","startDate":"2026-07-01T00:00:00.000Z","endDate":"2027-06-30T00:00:00.000Z"}}
```

### List academic years

`GET /api/academic-years`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/academic-years
```

Status: `200`

```json
{"success":true,"data":[{"id":1,"label":"2026-27","startDate":"2026-07-01T00:00:00.000Z","endDate":"2027-06-30T00:00:00.000Z"}]}
```

### Create semester

`POST /api/semesters`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/semesters \
  -H "Content-Type: application/json" \
  -d '{"academicYearId":1,"name":"SEMESTER_1","dueDate":"2026-07-01","graceDays":5}'
```

Status: `201`

```json
{"success":true,"data":{"id":1,"academicYearId":1,"name":"SEMESTER_1","dueDate":"2026-07-01T00:00:00.000Z","graceDays":5,"fineEndDate":null}}
```

### List semesters

`GET /api/semesters`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/semesters
```

Status: `200`

```json
{"success":true,"data":[{"id":1,"academicYearId":1,"name":"SEMESTER_1","dueDate":"2026-07-01T00:00:00.000Z","graceDays":5,"fineEndDate":null}]}
```

### Create ACADEMIC_FEE structure

`POST /api/fee-structures`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fee-structures \
  -H "Content-Type: application/json" \
  -d '{"courseId":1,"academicYearId":1,"semesterId":1,"component":"ACADEMIC_FEE","studyYear":1,"amount":10000}'
```

Status: `201`

```json
{"success":true,"data":{"id":1,"courseId":1,"academicYearId":1,"semesterId":1,"component":"ACADEMIC_FEE","studyYear":1,"amount":10000}}
```

### Create ACADEMIC_CAUTION structure

`POST /api/fee-structures`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fee-structures \
  -H "Content-Type: application/json" \
  -d '{"courseId":1,"academicYearId":1,"semesterId":1,"component":"ACADEMIC_CAUTION","studyYear":1,"amount":1000}'
```

Status: `201`

```json
{"success":true,"data":{"id":2,"courseId":1,"academicYearId":1,"semesterId":1,"component":"ACADEMIC_CAUTION","studyYear":1,"amount":1000}}
```

### Create HOSTEL_FEE structure

`POST /api/fee-structures`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fee-structures \
  -H "Content-Type: application/json" \
  -d '{"courseId":1,"academicYearId":1,"semesterId":1,"component":"HOSTEL_FEE","studyYear":1,"amount":8000}'
```

Status: `201`

```json
{"success":true,"data":{"id":3,"courseId":1,"academicYearId":1,"semesterId":1,"component":"HOSTEL_FEE","studyYear":1,"amount":8000}}
```

### Create HOSTEL_SECURITY structure

`POST /api/fee-structures`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fee-structures \
  -H "Content-Type: application/json" \
  -d '{"courseId":1,"academicYearId":1,"semesterId":1,"component":"HOSTEL_SECURITY","studyYear":1,"amount":500}'
```

Status: `201`

```json
{"success":true,"data":{"id":4,"courseId":1,"academicYearId":1,"semesterId":1,"component":"HOSTEL_SECURITY","studyYear":1,"amount":500}}
```

### List fee structures

`GET /api/fee-structures`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/fee-structures
```

Status: `200`

```json
{"success":true,"data":[{"id":1,"courseId":1,"academicYearId":1,"semesterId":1,"component":"ACADEMIC_FEE","studyYear":1,"amount":10000},{"id":2,"courseId":1,"academicYearId":1,"semesterId":1,"component":"ACADEMIC_CAUTION","studyYear":1,"amount":1000},{"id":3,"courseId":1,"academicYearId":1,"semesterId":1,"component":"HOSTEL_FEE","studyYear":1,"amount":8000},{"id":4,"courseId":1,"academicYearId":1,"semesterId":1,"component":"HOSTEL_SECURITY","studyYear":1,"amount":500}]}
```

### Read a fee account

`GET /api/fees/accounts/2`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/fees/accounts/2
```

Status: `200`

```json
{"success":true,"data":{"id":2,"studentId":2,"product":"ACADEMIC","academicYearId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":3,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":4,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}}
```

### Run late fees as of 2026-07-10

`POST /api/fees/fines/run`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fees/fines/run \
  -H "Content-Type: application/json" \
  -d '{"asOfDate":"2026-07-10","actedBy":"fee-admin"}'
```

Status: `200`

```json
{"success":true,"data":{"posted":[{"id":12,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"FINE","direction":"INCREASE","amount":60,"component":"ACADEMIC_FEE","effectiveDate":"2026-07-10T00:00:00.000Z","actedBy":"fee-admin","reason":"Late fee for 4 day(s)","relatedEntryId":null,"paymentAttemptId":null},{"id":13,"feeAccountId":3,"semesterId":1,"bucket":"DUES","entryType":"FINE","direction":"INCREASE","amount":60,"component":"ACADEMIC_FEE","effectiveDate":"2026-07-10T00:00:00.000Z","actedBy":"fee-admin","reason":"Late fee for 4 day(s)","relatedEntryId":null,"paymentAttemptId":null},{"id":14,"feeAccountId":4,"semesterId":1,"bucket":"DUES","entryType":"FINE","direction":"INCREASE","amount":60,"component":"HOSTEL_FEE","effectiveDate":"2026-07-10T00:00:00.000Z","actedBy":"fee-admin","reason":"Late fee for 4 day(s)","relatedEntryId":null,"paymentAttemptId":null},{"id":15,"feeAccountId":5,"semesterId":1,"bucket":"DUES","entryType":"FINE","direction":"INCREASE","amount":60,"component":"ACADEMIC_FEE","effectiveDate":"2026-07-10T00:00:00.000Z","actedBy":"fee-admin","reason":"Late fee for 4 day(s)","relatedEntryId":null,"paymentAttemptId":null}]}}
```

### Run late fees again for the same date

`POST /api/fees/fines/run`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fees/fines/run \
  -H "Content-Type: application/json" \
  -d '{"asOfDate":"2026-07-10","actedBy":"fee-admin"}'
```

Status: `200`

```json
{"success":true,"data":{"posted":[]}}
```

### Waive part of a fine

`POST /api/fees/fines/12/waive`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fees/fines/12/waive \
  -H "Content-Type: application/json" \
  -d '{"amount":10,"actedBy":"fee-admin","reason":"Approved waiver"}'
```

Status: `201`

```json
{"success":true,"data":{"id":16,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"WAIVER","direction":"DECREASE","amount":10,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Approved waiver","relatedEntryId":12,"paymentAttemptId":null}}
```

### Read the account after the waiver

`GET /api/fees/accounts/2`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/fees/accounts/2
```

Status: `200`

```json
{"success":true,"data":{"id":2,"studentId":2,"product":"ACADEMIC","academicYearId":1,"duesOutstanding":10050,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":3,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":4,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":12,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"FINE","direction":"INCREASE","amount":60,"component":"ACADEMIC_FEE","effectiveDate":"2026-07-10T00:00:00.000Z","actedBy":"fee-admin","reason":"Late fee for 4 day(s)","relatedEntryId":null,"paymentAttemptId":null},{"id":16,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"WAIVER","direction":"DECREASE","amount":10,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Approved waiver","relatedEntryId":12,"paymentAttemptId":null}]}}
```

### Refund caution with a deduction

`POST /api/fees/deposits/2/refund`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fees/deposits/2/refund \
  -H "Content-Type: application/json" \
  -d '{"amount":400,"deductionAmount":100,"deductionReason":"Damage","actedBy":"fee-admin","reason":"Left after semester 1"}'
```

Status: `201`

```json
{"success":true,"data":{"lines":[{"id":18,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"REFUND","direction":"DECREASE","amount":400,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Left after semester 1","relatedEntryId":null,"paymentAttemptId":null},{"id":19,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"DEDUCTION","direction":"DECREASE","amount":100,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Damage","relatedEntryId":18,"paymentAttemptId":null}],"account":{"id":2,"studentId":2,"product":"ACADEMIC","academicYearId":1,"duesOutstanding":10050,"depositHeld":500,"depositOutstanding":0,"lines":[{"id":3,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":4,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":12,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"FINE","direction":"INCREASE","amount":60,"component":"ACADEMIC_FEE","effectiveDate":"2026-07-10T00:00:00.000Z","actedBy":"fee-admin","reason":"Late fee for 4 day(s)","relatedEntryId":null,"paymentAttemptId":null},{"id":16,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"WAIVER","direction":"DECREASE","amount":10,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Approved waiver","relatedEntryId":12,"paymentAttemptId":null},{"id":17,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"PAYMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-clerk","reason":"CASH payment","relatedEntryId":null,"paymentAttemptId":2},{"id":18,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"REFUND","direction":"DECREASE","amount":400,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Left after semester 1","relatedEntryId":null,"paymentAttemptId":null},{"id":19,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"DEDUCTION","direction":"DECREASE","amount":100,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Damage","relatedEntryId":18,"paymentAttemptId":null}]}}}
```

### Adjust deposit against dues

`POST /api/fees/deposits/2/adjust`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fees/deposits/2/adjust \
  -H "Content-Type: application/json" \
  -d '{"amount":200,"actedBy":"fee-admin","reason":"Apply caution to fees"}'
```

Status: `201`

```json
{"success":true,"data":{"lines":[{"id":20,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"ADJUSTMENT","direction":"DECREASE","amount":200,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Apply caution to fees","relatedEntryId":null,"paymentAttemptId":null},{"id":21,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"ADJUSTMENT","direction":"DECREASE","amount":200,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Apply caution to fees","relatedEntryId":20,"paymentAttemptId":null}],"account":{"id":2,"studentId":2,"product":"ACADEMIC","academicYearId":1,"duesOutstanding":9850,"depositHeld":300,"depositOutstanding":0,"lines":[{"id":3,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":4,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":12,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"FINE","direction":"INCREASE","amount":60,"component":"ACADEMIC_FEE","effectiveDate":"2026-07-10T00:00:00.000Z","actedBy":"fee-admin","reason":"Late fee for 4 day(s)","relatedEntryId":null,"paymentAttemptId":null},{"id":16,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"WAIVER","direction":"DECREASE","amount":10,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Approved waiver","relatedEntryId":12,"paymentAttemptId":null},{"id":17,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"PAYMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-clerk","reason":"CASH payment","relatedEntryId":null,"paymentAttemptId":2},{"id":18,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"REFUND","direction":"DECREASE","amount":400,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Left after semester 1","relatedEntryId":null,"paymentAttemptId":null},{"id":19,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"DEDUCTION","direction":"DECREASE","amount":100,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Damage","relatedEntryId":18,"paymentAttemptId":null},{"id":20,"feeAccountId":2,"semesterId":1,"bucket":"DEPOSIT","entryType":"ADJUSTMENT","direction":"DECREASE","amount":200,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Apply caution to fees","relatedEntryId":null,"paymentAttemptId":null},{"id":21,"feeAccountId":2,"semesterId":1,"bucket":"DUES","entryType":"ADJUSTMENT","direction":"DECREASE","amount":200,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-admin","reason":"Apply caution to fees","relatedEntryId":20,"paymentAttemptId":null}]}}}
```

## Wrong entry

### Unknown fee component

`POST /api/fee-structures`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fee-structures \
  -H "Content-Type: application/json" \
  -d '{"courseId":1,"academicYearId":1,"semesterId":1,"component":"LIBRARY","studyYear":1,"amount":1000}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"component","message":"component must be a fee component"}]}
```

### Fee amount of 0

`POST /api/fee-structures`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fee-structures \
  -H "Content-Type: application/json" \
  -d '{"courseId":1,"academicYearId":1,"semesterId":1,"component":"ACADEMIC_FEE","studyYear":2,"amount":0}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"amount","message":"amount must be a positive integer"}]}
```

### Unknown course

`POST /api/fee-structures`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fee-structures \
  -H "Content-Type: application/json" \
  -d '{"courseId":999999,"academicYearId":1,"semesterId":1,"component":"ACADEMIC_FEE","studyYear":1,"amount":1000}'
```

Status: `404`

```json
{"success":false,"error":"COURSE_NOT_FOUND"}
```

### Duplicate fee structure

`POST /api/fee-structures`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fee-structures \
  -H "Content-Type: application/json" \
  -d '{"courseId":1,"academicYearId":1,"semesterId":1,"component":"ACADEMIC_FEE","studyYear":1,"amount":10000}'
```

Status: `409`

```json
{"success":false,"error":"DUPLICATE_FEE_STRUCTURE"}
```

### Waive more than the fine

`POST /api/fees/fines/12/waive`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fees/fines/12/waive \
  -H "Content-Type: application/json" \
  -d '{"amount":61,"actedBy":"fee-admin","reason":"Too much"}'
```

Status: `400`

```json
{"success":false,"error":"AMOUNT_EXCEEDS_FINE","details":[{"path":"amount","message":"amount exceeds the remaining fine"}]}
```

### Refund more than the deposit held

`POST /api/fees/deposits/2/refund`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fees/deposits/2/refund \
  -H "Content-Type: application/json" \
  -d '{"amount":1001,"actedBy":"fee-admin","reason":"Too much"}'
```

Status: `400`

```json
{"success":false,"error":"AMOUNT_EXCEEDS_DEPOSIT","details":[{"path":"amount","message":"amount exceeds the deposit held"}]}
```

## Other failure

### Waive a line that is not a fine

`POST /api/fees/fines/3/waive`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/fees/fines/3/waive \
  -H "Content-Type: application/json" \
  -d '{"amount":10,"actedBy":"fee-admin","reason":"Not a fine"}'
```

Status: `409`

```json
{"success":false,"error":"NOT_A_FINE"}
```

### Read a missing fee account

`GET /api/fees/accounts/999999`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/fees/accounts/999999
```

Status: `404`

```json
{"success":false,"error":"NOT_FOUND"}
```
