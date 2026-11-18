# Frontend API integration inventory

The web app reads its API base URL from `VITE_API_BASE_URL`. The default is
`http://localhost:3000/api`.

The sign-in page authenticates against `POST /api/auth/login`. The backend
keeps the Super Admin credentials in its environment and protects the other
API routes with the returned bearer token.

## Connected to the fee structure screen

- `GET /api/courses` — course names and IDs used to label the fee rows.
- `GET /api/academic-years` — academic year selector.
- `GET /api/semesters` — semester labels for fee rows.
- `GET /api/fee-structures` — academic and hostel fee amounts by course, year,
  semester, component, and study year.
- `GET /api/hostel-rates` — AC and non-AC annual rates by occupancy.
- `POST /api/courses`, `POST /api/academic-years`, `POST /api/semesters`,
  `POST /api/fee-structures`, and `POST /api/students` — Super Admin setup
  forms for course, cohort, term, fee, and student records.
- `GET /api/students` — live student roster, course, academic year, semester,
  contact details, and fee account ledger lines. The UI calculates semester
  due, paid, and outstanding values from the ledger.
- `POST /api/payments` — records the student table's cash payment action and
  refreshes balances from the roster API.
- `GET /api/reminders` and `POST /api/reminders` — loads reminder history and
  sends selected student reminders through the configured SMS gateway.

## API contracts that do not currently fit a frontend flow

There is no distinct batch resource. The student table uses the associated
academic year label as its batch value. The SMS gateway reports submission
acceptance; handset delivery receipts are not integrated.

The student list endpoint returns the full ledger for every student and does
not paginate. This fits the current roster size but should be revisited if the
student population grows substantially.

## Remaining backend API surface

- `POST /api/courses`, `GET /api/courses/:id`, `PATCH /api/courses/:id`
- `POST /api/academic-years`
- `POST /api/semesters`
- `POST /api/fee-structures`
- `GET /api/students?q=...`, `GET /api/students/:id`, `POST /api/students`,
  `PATCH /api/students/:id`, `POST /api/students/imports/preview`,
  `POST /api/students/imports/:id/commit`
- `GET /api/fees/accounts/:id`, `POST /api/fees/fines/run`,
  `POST /api/fees/fines/:entryId/waive`,
  `POST /api/fees/deposits/:accountId/refund`,
  `POST /api/fees/deposits/:accountId/adjust`
- `POST /api/payments`, `POST /api/payments/:id/callback`,
  `POST /api/payments/:id/verify`, `GET /api/receipts/:paymentId`
- `GET /api/reports/*` (payments, unpaid, failed payments, on-time, waivers,
  left students, fines, and reconciliation)

The remaining endpoints above are not called by the current web UI. The
existing reminder and payment presentation flows are demo-only; late fee waiver
and fee account management endpoints are not used by the current screens.
