# Payment module

HDFC is a local callback. Challan stays pending until verify. Cash is recorded as success immediately. A repeated success callback does not post a second ledger line. The cases below are one complete example run.

Base URL: `https://fee-management-icmrt.vercel.app`

On the deployment today there are no payments. `GET /api/receipts/1` returns `404` `{"success":false,"error":"NOT_FOUND"}`. `POST /api/payments` with an empty body returns `400` `VALIDATION_ERROR` (`method`, `idempotencyKey`, and `allocations` are required). There is no `GET /api/payments`. `POST /api/payments/1/callback` with an empty body returns `400` `VALIDATION_ERROR` (`status` must be `SUCCESS` or `FAILED`).

## Setup

### Create the student who pays online

`POST /api/students`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/students \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"REG-PAY","name":"Esha Iyer","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"esha@example.com","fatherName":"Esha Iyer Father","branch":"Management","courseId":1,"academicYearId":1,"semesterId":1,"admissionType":"DIRECT"}'
```

Status: `201`

```json
{"success":true,"data":{"id":6,"registrationNumber":"REG-PAY","enrolmentNumber":null,"name":"Esha Iyer","whatsappNumber":"9876543210","phoneNumber":"9123456780","email":"esha@example.com","fatherName":"Esha Iyer Father","branch":"Management","courseId":1,"academicYearId":1,"admissionSemesterId":1,"admissionType":"DIRECT","isHosteller":false,"studyYear":1,"status":"ACTIVE","leftOn":null,"course":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","lateFeePerDay":15},"accounts":[{"id":6,"studentId":6,"product":"ACADEMIC","academicYearId":1,"duesOutstanding":10000,"depositHeld":0,"depositOutstanding":1000,"lines":[{"id":22,"feeAccountId":6,"semesterId":1,"bucket":"DUES","entryType":"ASSESSMENT","direction":"INCREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null},{"id":23,"feeAccountId":6,"semesterId":1,"bucket":"DEPOSIT","entryType":"ASSESSMENT","direction":"INCREASE","amount":1000,"component":"ACADEMIC_CAUTION","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"system","reason":"Fee assessment","relatedEntryId":null,"paymentAttemptId":null}]}]}}
```

## Success

### Record a cash payment

`POST /api/payments`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments \
  -H "Content-Type: application/json" \
  -d '{"method":"CASH","idempotencyKey":"cash-ontime-dues","reference":"CASH-1001","actedBy":"fee-clerk","paidOn":"2026-07-01","allocations":[{"feeAccountId":1,"bucket":"DUES","amount":10000}]}'
```

Status: `201`

```json
{"success":true,"data":{"id":1,"method":"CASH","status":"SUCCESS","amount":10000,"reference":"CASH-1001","idempotencyKey":"cash-ontime-dues","receiptNo":"RCPT-000001","actedBy":"fee-clerk","paidOn":"2026-07-01T00:00:00.000Z","createdAt":"2026-11-11T10:12:47.195Z","allocations":[{"id":1,"paymentAttemptId":1,"feeAccountId":1,"bucket":"DUES","amount":10000}],"ledgerEntries":[{"id":11,"feeAccountId":1,"semesterId":1,"bucket":"DUES","entryType":"PAYMENT","direction":"DECREASE","amount":10000,"component":"ACADEMIC_FEE","effectiveDate":"2026-07-01T00:00:00.000Z","actedBy":"fee-clerk","reason":"CASH payment","relatedEntryId":null,"paymentAttemptId":1}]}}
```

### Start an HDFC payment

`POST /api/payments`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments \
  -H "Content-Type: application/json" \
  -d '{"method":"HDFC","idempotencyKey":"hdfc-pay-2000","allocations":[{"feeAccountId":6,"bucket":"DUES","amount":2000}]}'
```

Status: `201`

```json
{"success":true,"data":{"id":3,"method":"HDFC","status":"PENDING","amount":2000,"reference":"hdfc-pay-2000","idempotencyKey":"hdfc-pay-2000","receiptNo":null,"actedBy":null,"paidOn":null,"createdAt":"2026-11-11T10:12:47.353Z","allocations":[{"id":3,"paymentAttemptId":3,"feeAccountId":6,"bucket":"DUES","amount":2000}],"ledgerEntries":[]}}
```

### Confirm the HDFC payment

`POST /api/payments/3/callback`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments/3/callback \
  -H "Content-Type: application/json" \
  -d '{"status":"SUCCESS","paidOn":"2026-11-11"}'
```

Status: `200`

```json
{"success":true,"data":{"id":3,"method":"HDFC","status":"SUCCESS","amount":2000,"reference":"hdfc-pay-2000","idempotencyKey":"hdfc-pay-2000","receiptNo":"RCPT-000003","actedBy":null,"paidOn":"2026-11-11T00:00:00.000Z","createdAt":"2026-11-11T10:12:47.353Z","allocations":[{"id":3,"paymentAttemptId":3,"feeAccountId":6,"bucket":"DUES","amount":2000}],"ledgerEntries":[{"id":24,"feeAccountId":6,"semesterId":1,"bucket":"DUES","entryType":"PAYMENT","direction":"DECREASE","amount":2000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"HDFC","reason":"HDFC payment","relatedEntryId":null,"paymentAttemptId":3}]}}
```

### Repeat the successful HDFC callback

`POST /api/payments/3/callback`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments/3/callback \
  -H "Content-Type: application/json" \
  -d '{"status":"SUCCESS","paidOn":"2026-11-11"}'
```

Status: `200`

```json
{"success":true,"data":{"id":3,"method":"HDFC","status":"SUCCESS","amount":2000,"reference":"hdfc-pay-2000","idempotencyKey":"hdfc-pay-2000","receiptNo":"RCPT-000003","actedBy":null,"paidOn":"2026-11-11T00:00:00.000Z","createdAt":"2026-11-11T10:12:47.353Z","allocations":[{"id":3,"paymentAttemptId":3,"feeAccountId":6,"bucket":"DUES","amount":2000}],"ledgerEntries":[{"id":24,"feeAccountId":6,"semesterId":1,"bucket":"DUES","entryType":"PAYMENT","direction":"DECREASE","amount":2000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"HDFC","reason":"HDFC payment","relatedEntryId":null,"paymentAttemptId":3}]}}
```

### Download the receipt

`GET /api/receipts/3`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/receipts/3
```

Status: `200`

```json
{"success":true,"data":{"receiptNo":"RCPT-000003","paymentId":3,"amount":2000,"paidOn":"2026-11-11T00:00:00.000Z","method":"HDFC","allocations":[{"id":3,"paymentAttemptId":3,"feeAccountId":6,"bucket":"DUES","amount":2000}]}}
```

### Start a second HDFC payment

`POST /api/payments`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments \
  -H "Content-Type: application/json" \
  -d '{"method":"HDFC","idempotencyKey":"hdfc-pay-fail","allocations":[{"feeAccountId":6,"bucket":"DUES","amount":500}]}'
```

Status: `201`

```json
{"success":true,"data":{"id":4,"method":"HDFC","status":"PENDING","amount":500,"reference":"hdfc-pay-fail","idempotencyKey":"hdfc-pay-fail","receiptNo":null,"actedBy":null,"paidOn":null,"createdAt":"2026-11-11T10:12:47.388Z","allocations":[{"id":4,"paymentAttemptId":4,"feeAccountId":6,"bucket":"DUES","amount":500}],"ledgerEntries":[]}}
```

### Mark the HDFC payment failed

`POST /api/payments/4/callback`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments/4/callback \
  -H "Content-Type: application/json" \
  -d '{"status":"FAILED"}'
```

Status: `200`

```json
{"success":true,"data":{"id":4,"method":"HDFC","status":"FAILED","amount":500,"reference":"hdfc-pay-fail","idempotencyKey":"hdfc-pay-fail","receiptNo":null,"actedBy":null,"paidOn":null,"createdAt":"2026-11-11T10:12:47.388Z","allocations":[{"id":4,"paymentAttemptId":4,"feeAccountId":6,"bucket":"DUES","amount":500}],"ledgerEntries":[]}}
```

### Record a challan payment

`POST /api/payments`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments \
  -H "Content-Type: application/json" \
  -d '{"method":"CHALLAN","idempotencyKey":"challan-1000","reference":"CHALLAN-1000","actedBy":"fee-clerk","allocations":[{"feeAccountId":6,"bucket":"DUES","amount":1000}]}'
```

Status: `201`

```json
{"success":true,"data":{"id":5,"method":"CHALLAN","status":"PENDING","amount":1000,"reference":"CHALLAN-1000","idempotencyKey":"challan-1000","receiptNo":null,"actedBy":"fee-clerk","paidOn":null,"createdAt":"2026-11-11T10:12:47.411Z","allocations":[{"id":5,"paymentAttemptId":5,"feeAccountId":6,"bucket":"DUES","amount":1000}],"ledgerEntries":[]}}
```

### Verify the challan

`POST /api/payments/5/verify`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments/5/verify \
  -H "Content-Type: application/json" \
  -d '{"paidOn":"2026-11-11","actedBy":"fee-clerk"}'
```

Status: `200`

```json
{"success":true,"data":{"id":5,"method":"CHALLAN","status":"SUCCESS","amount":1000,"reference":"CHALLAN-1000","idempotencyKey":"challan-1000","receiptNo":"RCPT-000005","actedBy":"fee-clerk","paidOn":"2026-11-11T00:00:00.000Z","createdAt":"2026-11-11T10:12:47.411Z","allocations":[{"id":5,"paymentAttemptId":5,"feeAccountId":6,"bucket":"DUES","amount":1000}],"ledgerEntries":[{"id":25,"feeAccountId":6,"semesterId":1,"bucket":"DUES","entryType":"PAYMENT","direction":"DECREASE","amount":1000,"component":"ACADEMIC_FEE","effectiveDate":"2026-11-11T00:00:00.000Z","actedBy":"fee-clerk","reason":"CHALLAN payment","relatedEntryId":null,"paymentAttemptId":5}]}}
```

## Wrong entry

### Amount above the outstanding balance

`POST /api/payments`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments \
  -H "Content-Type: application/json" \
  -d '{"method":"HDFC","idempotencyKey":"hdfc-too-much","allocations":[{"feeAccountId":6,"bucket":"DUES","amount":999999}]}'
```

Status: `400`

```json
{"success":false,"error":"AMOUNT_EXCEEDS_BALANCE","details":[{"path":"allocations","message":"amount exceeds DUES outstanding"}]}
```

## Other failure

### Receipt before success

`GET /api/receipts/4`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/receipts/4
```

Status: `409`

```json
{"success":false,"error":"RECEIPT_NOT_AVAILABLE"}
```

### Callback for an unknown payment

`POST /api/payments/999999/callback`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/payments/999999/callback \
  -H "Content-Type: application/json" \
  -d '{"status":"SUCCESS"}'
```

Status: `404`

```json
{"success":false,"error":"NOT_FOUND"}
```
