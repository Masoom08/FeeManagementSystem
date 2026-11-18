# Report module

Reports read the ledger and payment attempts. `format=json` is the example body. The workbook result records status, content type, and data row count. The cases below are one complete example run.

Base URL: `https://fee-management-icmrt.vercel.app`

On the deployment today, payments, unpaid, failed payments, and left students return `{"success":true,"data":[]}`. `GET /api/reports/payments?from=2026-07-01&to=2027-06-30&format=xlsx` returns `200` with content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `X-Row-Count: 0`. `GET /api/reports/reconciliation` returns `{"success":true,"data":{"courses":[{"courseId":1,"courseCode":"AKTU01","products":[]}]}}`. `GET /api/reports/on-time?semesterId=1`, waivers, and fines return `404` `{"success":false,"error":"SEMESTER_NOT_FOUND"}`. Omitting `semesterId` returns `400` `VALIDATION_ERROR`. Omitting `from` and `to` on payments returns `400` `VALIDATION_ERROR`.

## Success

### Payments by date

`GET /api/reports/payments?from=2026-07-01&to=2026-11-11&format=json`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/payments?from=2026-07-01&to=2026-11-11&format=json
```

Status: `200`

```json
{"success":true,"data":[{"id":1,"receiptNo":"RCPT-000001","method":"CASH","amount":10000,"status":"SUCCESS","paidOn":"2026-07-01T00:00:00.000Z","reference":"CASH-1001","registrationNumbers":["REG-ONTIME"],"courseCodes":["AKTU01"]},{"id":2,"receiptNo":"RCPT-000002","method":"CASH","amount":1000,"status":"SUCCESS","paidOn":"2026-11-11T00:00:00.000Z","reference":"CASH-CAUTION","registrationNumbers":["REG-LATE"],"courseCodes":["AKTU01"]},{"id":3,"receiptNo":"RCPT-000003","method":"HDFC","amount":2000,"status":"SUCCESS","paidOn":"2026-11-11T00:00:00.000Z","reference":"hdfc-pay-2000","registrationNumbers":["REG-PAY"],"courseCodes":["AKTU01"]},{"id":5,"receiptNo":"RCPT-000005","method":"CHALLAN","amount":1000,"status":"SUCCESS","paidOn":"2026-11-11T00:00:00.000Z","reference":"CHALLAN-1000","registrationNumbers":["REG-PAY"],"courseCodes":["AKTU01"]}]}
```

### Payments by date and course

`GET /api/reports/payments?from=2026-07-01&to=2026-11-11&courseId=1&format=json`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/payments?from=2026-07-01&to=2026-11-11&courseId=1&format=json
```

Status: `200`

```json
{"success":true,"data":[{"id":1,"receiptNo":"RCPT-000001","method":"CASH","amount":10000,"status":"SUCCESS","paidOn":"2026-07-01T00:00:00.000Z","reference":"CASH-1001","registrationNumbers":["REG-ONTIME"],"courseCodes":["AKTU01"]},{"id":2,"receiptNo":"RCPT-000002","method":"CASH","amount":1000,"status":"SUCCESS","paidOn":"2026-11-11T00:00:00.000Z","reference":"CASH-CAUTION","registrationNumbers":["REG-LATE"],"courseCodes":["AKTU01"]},{"id":3,"receiptNo":"RCPT-000003","method":"HDFC","amount":2000,"status":"SUCCESS","paidOn":"2026-11-11T00:00:00.000Z","reference":"hdfc-pay-2000","registrationNumbers":["REG-PAY"],"courseCodes":["AKTU01"]},{"id":5,"receiptNo":"RCPT-000005","method":"CHALLAN","amount":1000,"status":"SUCCESS","paidOn":"2026-11-11T00:00:00.000Z","reference":"CHALLAN-1000","registrationNumbers":["REG-PAY"],"courseCodes":["AKTU01"]}]}
```

### Payments workbook

`GET /api/reports/payments?from=2026-07-01&to=2026-11-11&format=xlsx`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/payments?from=2026-07-01&to=2026-11-11&format=xlsx -o payments.xlsx
```

Status: `200`

The body is the xlsx file. The recorded result is the status, content type, and data row count.

```json
{"status":200,"contentType":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","rowCount":4}
```

### Unpaid students

`GET /api/reports/unpaid`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/unpaid
```

Status: `200`

```json
{"success":true,"data":[{"id":2,"registrationNumber":"REG-LATE","name":"Bharat Singh","courseId":1,"courseCode":"AKTU01","duesOutstanding":9850},{"id":3,"registrationNumber":"REG-HOST","name":"Charu Das","courseId":1,"courseCode":"AKTU01","duesOutstanding":18120},{"id":4,"registrationNumber":"REG-LEFT","name":"Deepa Nair","courseId":1,"courseCode":"AKTU01","duesOutstanding":10060},{"id":6,"registrationNumber":"REG-PAY","name":"Esha Iyer","courseId":1,"courseCode":"AKTU01","duesOutstanding":7000},{"id":7,"registrationNumber":"REG-XLS","name":"Farah Khan","courseId":1,"courseCode":"AKTU01","duesOutstanding":10000}]}
```

### Unpaid students for one course

`GET /api/reports/unpaid?courseId=1`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/unpaid?courseId=1
```

Status: `200`

```json
{"success":true,"data":[{"id":2,"registrationNumber":"REG-LATE","name":"Bharat Singh","courseId":1,"courseCode":"AKTU01","duesOutstanding":9850},{"id":3,"registrationNumber":"REG-HOST","name":"Charu Das","courseId":1,"courseCode":"AKTU01","duesOutstanding":18120},{"id":4,"registrationNumber":"REG-LEFT","name":"Deepa Nair","courseId":1,"courseCode":"AKTU01","duesOutstanding":10060},{"id":6,"registrationNumber":"REG-PAY","name":"Esha Iyer","courseId":1,"courseCode":"AKTU01","duesOutstanding":7000},{"id":7,"registrationNumber":"REG-XLS","name":"Farah Khan","courseId":1,"courseCode":"AKTU01","duesOutstanding":10000}]}
```

### Failed payments

`GET /api/reports/failed-payments`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/failed-payments
```

Status: `200`

```json
{"success":true,"data":[{"id":4,"receiptNo":null,"method":"HDFC","amount":500,"status":"FAILED","paidOn":null,"reference":"hdfc-pay-fail","registrationNumbers":["REG-PAY"],"courseCodes":["AKTU01"]}]}
```

### On-time payment percentage

`GET /api/reports/on-time?semesterId=1`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/on-time?semesterId=1
```

Status: `200`

```json
{"success":true,"data":{"semesterId":1,"assessedCount":6,"onTimeCount":1,"percent":16.67,"students":[{"studentId":1,"registrationNumber":"REG-ONTIME","onTime":true},{"studentId":2,"registrationNumber":"REG-LATE","onTime":false},{"studentId":3,"registrationNumber":"REG-HOST","onTime":false},{"studentId":4,"registrationNumber":"REG-LEFT","onTime":false},{"studentId":6,"registrationNumber":"REG-PAY","onTime":false},{"studentId":7,"registrationNumber":"REG-XLS","onTime":false}]}}
```

### Waiver count and percentage

`GET /api/reports/waivers?semesterId=1`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/waivers?semesterId=1
```

Status: `200`

```json
{"success":true,"data":{"semesterId":1,"finedStudentCount":3,"waiverStudentCount":1,"percent":33.33}}
```

### Students who left

`GET /api/reports/left-students`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/left-students
```

Status: `200`

```json
{"success":true,"data":[{"id":4,"registrationNumber":"REG-LEFT","name":"Deepa Nair","courseId":1,"status":"LEFT","leftOn":"2026-12-01T00:00:00.000Z"}]}
```

### Semester fine collection

`GET /api/reports/fines?semesterId=1`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/fines?semesterId=1
```

Status: `200`

```json
{"success":true,"data":{"semesterId":1,"total":240,"byCourse":[{"courseId":1,"courseCode":"AKTU01","total":240}]}}
```

### Reconciliation

`GET /api/reports/reconciliation`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/reconciliation
```

Status: `200`

```json
{"success":true,"data":{"courses":[{"courseId":1,"courseCode":"AKTU01","products":[{"product":"ACADEMIC","assessed":66000,"paid":14000,"fines":180,"waivers":10,"refunds":400,"depositHeld":300,"duesOutstanding":46970},{"product":"HOSTEL","assessed":8500,"paid":0,"fines":60,"waivers":0,"refunds":0,"depositHeld":0,"duesOutstanding":8060}]},{"courseId":2,"courseCode":"AKTU02","products":[]}]}}
```

## Other failure

### Unknown semester

`GET /api/reports/on-time?semesterId=999999`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reports/on-time?semesterId=999999
```

Status: `404`

```json
{"success":false,"error":"SEMESTER_NOT_FOUND"}
```
