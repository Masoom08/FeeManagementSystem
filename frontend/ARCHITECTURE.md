# Frontend structure

The teacher/admin web app is organized by page and business feature. Keep `App.tsx` focused on URL routes and session transitions; keep screen markup in pages and reusable UI in components.

```text
src/
  App.tsx                         # Route table, URL changes, sign-in/out boundary
  App.css                         # App-wide visual styles (can later split by component)
  index.css                       # Reset, fonts, document defaults
  pages/
    LoginPage.tsx                 # Teacher/admin sign-in screen
    DashboardPage.tsx             # Admin overview and its workspace navigation
  components/
    ui/
      AppIcon.tsx                 # Shared icon component and icon names
  features/
    auth/                         # Later: auth API, session types, route guards
    students/
      components/
        StudentFeeManagement.tsx  # Course/semester filters, fee status, exports, reminder UI
      data/
        mockStudents.ts           # Temporary semester fee records; replace with API data
    fees/
      components/
        LateFeeWaivers.tsx        # Confirmed late fine waiver workflow
    academics/                    # Academic years, courses, semesters
    fees/                         # Fee structures, items, assessments, waivers
    payments/                     # Payments, allocations, deposits, refunds
      data/
        mockPayments.ts           # Temporary dashboard rows; replace with API data
    reports/                      # Collection, outstanding balance, audit reports
    imports/                      # Student/payment import batches and row errors
    notifications/                # Email/SMS notifications and delivery state
    users/                        # Staff accounts, roles, permissions
```

## Route map

| URL | Page/module |
| --- | --- |
| `/login` | Teacher/admin sign-in |
| `/admin` | Overview |
| `/admin/students` | Student directory |
| `/admin/waivers` | Late fee waiver review and history |

`App.tsx` currently provides a small history-based route switch so this scaffold does not need an extra router package. When the app grows, replace it with React Router and add nested admin layouts and protected routes.

## Business modules to build

1. **Authentication and access control:** staff sign-in, password reset, roles, permissions, and audit history. Students will use a separate React Native app and API access rules.
2. **Student and enrollment management:** student records, registration numbers, course enrollment, academic year, and enrollment status.
3. **Academic setup:** academic years, courses, semesters, and fee schedules.
4. **Fee setup and assessment:** fee structures and items, due dates, recurring charges, fines, waivers, and student fee assessments.
5. **Collection and reconciliation:** payment entry, online payment events, deposits, payment allocation, refunds, and outstanding balances.
6. **Operations:** import batches and errors, notifications, reports, audit log, and institution settings.

Fee collection and reports are planned modules, but are not currently exposed in the dashboard. Build modules around the database concepts in the supplied schema. Keep API calls and domain types inside each feature folder; pages should compose feature components instead of directly owning database logic.

## Current prototype limits

Sign-in is only a frontend demonstration. It accepts any non-empty email/password and stores a demo flag in `sessionStorage`; it is not real authentication. Payment rows and dashboard metrics are sample data. Connect an authenticated backend before using real student or payment information.

The student fee list exports UTF-8 CSV files that open in Excel, with a status column and all/paid/unpaid download choices. Course filters are BBA (LU), B.Com (Hons.), MBA, and BBA (AKTU). The SMS dialog previews a reminder batch and keeps a local message-style history with recipients and timestamp, but does not send messages until a messaging provider and backend endpoint are configured. Late fine waivers require confirmation, can be exported as a waived-student CSV, and are stored in this browser for the prototype; they do not alter the semester fee balance.
