# Fee Management Backend

Standalone backend for the fee management app. Its local `.env` is configured
for the workspace MySQL connection. Do not commit `.env`.

## Create tables and load frontend demo data

Start MySQL, then run these commands from this directory:

```powershell
npm install
npm run db:create
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The seed can be rerun. It maintains six mobile demo students, their semester
assessments, successful payment attempts, payment allocations, ledger entries,
receipt numbers, course fees, and six hostel rates. The third-year account
`ICM2024BCM01` has paid history through semester 5 and an upcoming semester 6.
Seed cleanup is limited to the explicitly listed demo registration numbers;
unrelated student records are left untouched.

The demo seed also creates four MBA (AKTU) students in batch 2022-24 with
session-by-session residence cases: hosteller then non-hosteller, non-hosteller
then hosteller, hosteller in both sessions, and non-hosteller in both sessions.
`student_years` stores the student's study year and hostel status independently
for every session. Student APIs include `academicYears`; update one session with
`PATCH /api/students/:studentId/academic-years/:sessionId` and body
`{"isHosteller":true}` (SUPERADMIN).

The API listens on port 3000. The frontend can use
`VITE_API_BASE_URL=http://localhost:3000/api`.

## Staff login

The public `POST /api/auth/login` endpoint checks password hashes stored in the
`users` table and issues a 12-hour signed bearer token. Run
`npm run db:seed-users` to create or reset the demo accounts:

- `admin@gmail.com` is a Teacher.
- `superadmin@gmail.com` is the Super Admin.

Both demo accounts use the password `12345678`. Teacher accounts can use the
student, fee, payment, and reminder workflows. Student creation and setup pages
for courses, batches, sessions, semesters, and fee structures are Super Admin only.
Set `AUTH_TOKEN_SECRET` in `.env` to a long random value.

## Student OTP login

`POST /api/student-auth/request-otp` accepts `{ "phoneNumber": "9454716083" }`.
It issues an OTP only for an active student whose phone number is on the roster.
Unknown numbers return `MOBILE_NOT_REGISTERED`. This demo flow returns the fixed
OTP `111111` in the response and does not send an SMS. The OTP expires after
five minutes and is held in server memory.

`POST /api/student-auth/verify-otp` accepts the same phone number and the OTP;
on success it returns a 24-hour student bearer token and the student profile.
Student tokens are separate from staff tokens and do not grant access to the
staff API. The mobile app uses these student endpoints:

- `GET /api/student-auth/me` for profile and assessed semester balances.
- `GET /api/student-auth/receipts` and `GET /api/student-auth/receipts/:paymentId`
  for payment history and individual receipt data.
- `POST /api/student-auth/payments` with `{ "amount": 24500,
  "idempotencyKey": "..." }` to create a pending mock payment and return its
  order ID.
- `POST /api/student-auth/payments/:orderId/mock-success` and
  `POST /api/student-auth/payments/:orderId/mock-failure` to simulate the result.
- `POST /api/student-auth/logout` to complete client sign-out. Remove the bearer
  token on the client; tokens are stateless and expire after 24 hours.

The success simulator writes payment ledger entries and issues a receipt. The
failure simulator keeps the attempt as failed and does not issue a receipt. Both
simulator routes verify that the order belongs to the authenticated student.

## Payment receipt

Successful payments are available from the student receipt endpoints and the
staff `GET /api/receipts/:paymentId` endpoint. The mobile app can save each
student receipt as a PDF. Seeded historical payments already have receipt IDs.

## SMS reminders

`POST /api/reminders` sends SMS messages through the provider settings in
`.env`. Keep the API key private. Successful gateway submissions are recorded
in the reminders table; failures are returned per student. Gateway acceptance
does not confirm delivery to a handset. WhatsApp requests are reported as
unsupported until a WhatsApp provider is configured.
