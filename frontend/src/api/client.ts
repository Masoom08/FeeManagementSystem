
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

export const AUTH_TOKEN_STORAGE_KEY = 'iccmrt-superadmin-token'

export type ApiCourse = {
  id: number
  courseCode: string
  courseName: string
  affiliation: string
  lateFeePerDay: number
  active: boolean
}

export type ApiSession = {
  id: number
  label: string
  startDate: string
  endDate: string
}

export type ApiBatch = {
  id: number
  courseId: number
  label: string
  startDate: string
  endDate: string
  course?: Pick<ApiCourse, 'id' | 'courseName' | 'courseCode'>
}

export type ApiSemester = {
  id: number
  sessionId: number
  name: string
  dueDate: string
  graceDays: number
  fineEndDate?: string | null
}

export type ApiFeeStructure = {
  id: number
  courseId: number
  sessionId: number
  semesterId: number
  component: 'ACADEMIC_FEE' | 'ACADEMIC_CAUTION' | 'HOSTEL_FEE' | 'HOSTEL_SECURITY'
  studyYear: number
  amount: number
}

export type ApiLateFeeDashboard = {
  asOfDate: string
  courses: Array<{
    id: number
    courseName: string
    lateFeePerDay: number
    deadlines: Array<{
      semesterType: 'ODD' | 'EVEN'
      month: number
      day: number
    }>
  }>
  students: Array<{
    studentId: number
    accountId: number
    name: string
    registrationNumber: string
    phoneNumber: string
    courseId: number
    courseName: string
    batch: string
    studyYear: number
    semester: string
    semesterId: number
    semesterFee: number
    dueDate: string
    daysOverdue: number
    ratePerDay: number
    fineAmount: number
    waivedAmount: number
    pendingFine: number
    waivedAt: string | null
  }>
}

export type ApiHostelRate = {
  id: number
  condition: string
  occupancy: string
  annualFee: number
}

export type ApiReminder = {
  studentId: number
  registrationNumber: string
  name: string
  duesOutstanding: number
  reminders: Array<{
    id: number
    channel: string
    sentAt: string
    actedBy: string
  }>
}

export type ApiReminderSendResult = {
  sent: Array<{
    studentId: number
    channel: string
    reminderId: number
  }>
  failed: Array<{
    studentId: number
    channel: string
    reason: string
  }>
}

export type ApiDashboardSummary = {
  totalAmountCollected: number
  paymentsReceived: number
  pendingPayments: number
  pendingAmount: number
  totalStudentCount: number
}

export type ApiCourseCollectionSummary = {
  totalCollected: number
  courses: Array<{
    courseId: number
    courseName: string
    amount: number
    sharePercent: number
  }>
}

export type ApiPaymentHistoryRow = {
  paymentId: number
  receiptNo: string | null
  paidOn: string
  method: string
  amount: number
  bucket: 'DUES' | 'DEPOSIT'
  product: 'ACADEMIC' | 'HOSTEL'
  semester: string | null
  semesterSession: string | null
  studyYear: number
  student: {
    id: number
    name: string
    registrationNumber: string
    courseId: number
    courseName: string
    batch: string
    studyYear: number
  }
}

export type ApiStudentCourse =
  Pick<ApiCourse, 'id' | 'courseCode' | 'courseName'> & {
    lateFeePerDay: number
  }

export type ApiLedgerEntry = {
  id: number
  semesterId: number | null
  bucket: 'DUES' | 'DEPOSIT'
  entryType: string
  direction: 'INCREASE' | 'DECREASE'
  amount: number
  component: string
  effectiveDate: string
  actedBy?: string
  reason?: string | null
  relatedEntryId?: number | null
}

export type ApiFeeAccount = {
  id: number
  product: 'ACADEMIC' | 'HOSTEL'
  sessionId: number
  duesOutstanding: number
  depositHeld?: number
  depositOutstanding?: number
  lines: ApiLedgerEntry[]
}

export type ApiStudentSummary = {
  id: number
  registrationNumber: string
  enrolmentNumber: string | null
  name: string
  phoneNumber: string
  whatsappNumber: string
  email: string
  fatherName: string
  branch: string
  courseId: number
  batchId: number
  sessionId: number
  admissionSemesterId: number
  studyYear: number
  status: string
  isHosteller: boolean
  duesOutstanding: number
  course: ApiStudentCourse
  batch: ApiBatch
  session: ApiSession
  admissionSemester: ApiSemester
  accounts: ApiFeeAccount[]
}

export type ApiStudent = ApiStudentSummary

export type ApiStudentImportRow = {
  rowNumber: number
  valid: boolean
  errors: Array<{ path: string; message: string }> | null
  payload: Record<string, unknown>
}

export type ApiStudentImportBatch = {
  id: number
  status: string
  fileName: string
  rows: ApiStudentImportRow[]
}

export type ApiImportBatch = ApiStudentImportBatch

export type ApiUnpaidRow = {
  id: number
  registrationNumber: string
  name: string
  courseCode: string
  duesOutstanding: number
}

export type ApiFailedPayment = {
  id: number
  method: string
  amount: number
  status: string
  registrationNumbers: string[]
}

export type ApiOnTimeReport = {
  assessedCount: number
  onTimeCount: number
  percent: number
}

export type ApiWaiverReport = {
  finedStudentCount: number
  waiverStudentCount: number
  percent: number
}

export type ApiLeftStudent = {
  id: number
  registrationNumber: string
  name: string
  leftOn: string | null
}

export type ApiFineReport = {
  total: number
  byCourse: Array<{
    courseCode: string
    total: number
  }>
}

export type ApiReconciliation = {
  courses: Array<{
    courseCode: string
    products: Array<{
      product: string
      assessed: number
      paid: number
      fines: number
      waivers: number
      refunds: number
      duesOutstanding: number
      depositHeld: number
    }>
  }>
}

export type DeleteImpact = {
  entity: 'course' | 'semester' | 'student' | 'feeStructure' | 'hostelRate' | 'reminder'
  id: number
  label: string
  deletes: Array<{
    key: string
    label: string
    count: number
  }>
  clears: Array<{
    key: string
    count: number
    message: string
  }>
}

export type ApiReceipt = {
  receiptNo: string
  paymentId: number
  amount: number
  paidOn: string
  method: string
  allocations: Array<{
    id: number
    feeAccountId: number
    bucket: 'DUES' | 'DEPOSIT'
    amount: number
    product: 'ACADEMIC' | 'HOSTEL'
    balanceOutstanding: number
    semesterName: string | null
    student: {
      id: number
      name: string
      registrationNumber: string
      phoneNumber: string
      courseName: string
      affiliation: string
      batch: string
    }
  }>
}

async function request<T>(
  path: string,
  init?: RequestInit,
  authenticated = true
): Promise<T> {
  const headers = new Headers(init?.headers)

  if (authenticated && typeof sessionStorage !== 'undefined') {
    const token = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  const body = await response.json().catch(() => null) as {
    success?: boolean
    data?: T
    error?: string
    details?: Array<{ message?: string }> | { message?: string }
  } | null

  if (!response.ok || !body?.success || body.data === undefined) {
    const detailMessage = Array.isArray(body?.details)
      ? body.details.find(item => item.message)?.message
      : body?.details?.message

    throw new Error(
      detailMessage || body?.error || `API request failed (${response.status})`
    )
  }

  return body.data
}

export function actedBy() {
  return sessionStorage.getItem('iccmrt-user-email') || 'frontend-admin'
}

export const api = {
  login: (email: string, password: string) =>
    request<{
      accessToken: string
      tokenType: string
      expiresIn: number
      user: {
        id: number
        email: string
        role: 'ADMIN' | 'SUPERADMIN'
      }
    }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, false),

  dashboardSummary: () => request<ApiDashboardSummary>('/reports/dashboard'),

  courseCollections: () => request<ApiCourseCollectionSummary>('/reports/course-collections'),

  courses: () => request<ApiCourse[]>('/courses'),

  batches: () => request<ApiBatch[]>('/batches'),

  createBatch: (payload: {
    courseId: number
    label: string
    startDate: string
    endDate: string
  }) => request<ApiBatch>('/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  sessions: () => request<ApiSession[]>('/sessions'),

  semesters: () => request<ApiSemester[]>('/semesters'),

  feeStructures: (sessionId?: number) =>
    request<ApiFeeStructure[]>(
      `/fee-structures${sessionId ? `?sessionId=${sessionId}` : ''}`
    ),

  lateFeeDashboard: () => request<ApiLateFeeDashboard>('/fees/late-fees'),

  waiveLateFee: (studentId: number, actedBy: string, reason: string) =>
    request<ApiLedgerEntry>(`/fees/late-fees/students/${studentId}/waive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actedBy, reason }),
    }),

  hostelRates: () => request<ApiHostelRate[]>('/hostel-rates'),

  students: (query = '') =>
    request<ApiStudentSummary[]>(
      `/students${query ? `?q=${encodeURIComponent(query)}` : ''}`
    ),

  student: (id: number) => request<ApiStudent>(`/students/${id}`),

  reminders: () => request<ApiReminder[]>('/reminders'),

  createReminders: (
    studentIds: number[],
    channels: Array<'SMS' | 'WHATSAPP'>,
    actedBy: string,
    message: string
  ) => request<ApiReminderSendResult>('/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentIds, channels, actedBy, message }),
  }),

  createPayment: (payload: {
    method?: 'CASH' | 'CHALLAN' | 'HDFC'
    idempotencyKey: string
    actedBy: string
    paidOn: string
    reference?: string
    allocations: Array<{
      feeAccountId: number
      bucket: 'DUES' | 'DEPOSIT'
      amount: number
    }>
  }) => request<{
    id: number
    receiptNo: string | null
    status: string
  }>('/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'CASH', ...payload }),
  }),

  verifyPayment: (id: number, payload: {
    actedBy: string
    paidOn?: string
  }) => request<{
    id: number
    receiptNo: string | null
    status: string
  }>(`/payments/${id}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  updateStudent: (id: number, payload: Partial<{
    name: string
    phoneNumber: string
    whatsappNumber: string
    email: string
    fatherName: string
    branch: string
    enrolmentNumber: string
    isHosteller: boolean
    studyYear: number
    status: 'ACTIVE' | 'LEFT' | 'COMPLETED'
  }>) => request<ApiStudentSummary>(`/students/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  previewImport: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<ApiImportBatch>('/students/imports/preview', {
      method: 'POST',
      body,
    })
  },

  commitImport: (id: number) =>
    request<{ batchId: number; status: string }>(
      `/students/imports/${id}/commit`,
      { method: 'POST' }
    ),

  runFines: (asOfDate: string) =>
    request<{ posted: unknown[] }>('/fees/fines/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asOfDate, actedBy: actedBy() }),
    }),

  waiveFine: (entryId: number, amount: number, reason: string) =>
    request<{ id: number }>(`/fees/fines/${entryId}/waive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, actedBy: actedBy(), reason }),
    }),

  refundDeposit: (
    accountId: number,
    payload: {
      amount: number
      reason: string
      deductionAmount?: number
      deductionReason?: string
    }
  ) => request<{ account: ApiFeeAccount }>(
    `/fees/deposits/${accountId}/refund`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, actedBy: actedBy() }),
    }
  ),

  adjustDeposit: (accountId: number, amount: number, reason: string) =>
    request<{ account: ApiFeeAccount }>(
      `/fees/deposits/${accountId}/adjust`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, actedBy: actedBy(), reason }),
      }
    ),

  unpaidReport: () => request<ApiUnpaidRow[]>('/reports/unpaid'),

  failedPayments: () => request<ApiFailedPayment[]>('/reports/failed-payments'),

  onTimeReport: (semesterId: number) =>
    request<ApiOnTimeReport>(`/reports/on-time?semesterId=${semesterId}`),

  waiverReport: (semesterId: number) =>
    request<ApiWaiverReport>(`/reports/waivers?semesterId=${semesterId}`),

  leftStudents: () => request<ApiLeftStudent[]>('/reports/left-students'),

  fineReport: (semesterId: number) =>
    request<ApiFineReport>(`/reports/fines?semesterId=${semesterId}`),

  reconciliation: () =>
    request<ApiReconciliation>('/reports/reconciliation'),

  downloadPaymentsReport: async (from: string, to: string) => {
    const headers = new Headers()
    const token = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

    if (token) headers.set('Authorization', `Bearer ${token}`)

    const response = await fetch(
      `${API_BASE_URL}/reports/payments?from=${from}&to=${to}&format=xlsx`,
      { headers }
    )

    if (!response.ok) {
      throw new Error('Could not download the payments report')
    }

    return response.blob()
  },

  receipt: (paymentId: number) =>
    request<ApiReceipt>(`/receipts/${paymentId}`),

  paymentHistory: () =>
    request<ApiPaymentHistoryRow[]>('/payments/history'),

  createCourse: (payload: {
    courseCode: string
    courseName: string
    affiliation: 'AKTU' | 'LU'
    lateFeePerDay: number
  }) => request<ApiCourse>('/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  updateCourse: (
    id: number,
    payload: Partial<{
      courseCode: string
      courseName: string
      affiliation: 'AKTU' | 'LU'
      lateFeePerDay: number
      active: boolean
    }>
  ) => request<ApiCourse>(`/courses/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  previewCourseDelete: (id: number) =>
    request<DeleteImpact>(`/courses/${id}/delete-preview`),

  deleteCourse: (id: number) =>
    request<ApiCourse | { id: number; deleted: true }>(
      `/courses/${id}`,
      { method: 'DELETE' }
    ),

  createStudent: (payload: {
    registrationNumber: string
    name: string
    whatsappNumber: string
    phoneNumber: string
    email: string
    fatherName: string
    branch: string
    courseId: number
    batchId: number
    sessionId: number
    semesterId: number
    admissionType: 'DIRECT' | 'COUNSELLING'
    isHosteller: boolean
    studyYear: number
  }) => request<ApiStudentSummary>('/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  deleteStudent: (id: number) =>
    request<ApiStudentSummary>(`/students/${id}`, { method: 'DELETE' }),

  previewStudentDelete: (id: number) =>
    request<DeleteImpact>(`/students/${id}/delete-preview`),

  previewStudentImport: (file: File) => {
    const form = new FormData()
    form.append('file', file)

    return request<ApiStudentImportBatch>('/students/imports/preview', {
      method: 'POST',
      body: form,
    })
  },

  commitStudentImport: (batchId: number) =>
    request<{
      batchId: number
      status: string
      students: ApiStudentSummary[]
    }>(`/students/imports/${batchId}/commit`, {
      method: 'POST',
    }),

  createSession: (payload: {
    label: string
    startDate: string
    endDate: string
  }) => request<ApiSession>('/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  updateSession: (
    id: number,
    payload: Partial<{
      label: string
      startDate: string
      endDate: string
    }>
  ) => request<ApiSession>(`/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  deleteSession: (id: number) =>
    request<{ id: number; deleted: true }>(
      `/sessions/${id}`,
      { method: 'DELETE' }
    ),

  createSemester: (payload: {
    sessionId: number
    name: string
    dueDate: string
    graceDays: number
    fineEndDate?: string
  }) => request<ApiSemester>('/semesters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  updateSemester: (
    id: number,
    payload: Partial<{
      name: string
      dueDate: string
      graceDays: number
      fineEndDate: string | null
    }>
  ) => request<ApiSemester>(`/semesters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  previewSemesterDelete: (id: number) =>
    request<DeleteImpact>(`/semesters/${id}/delete-preview`),

  deleteSemester: (id: number) =>
    request<{ id: number; deleted: true }>(
      `/semesters/${id}`,
      { method: 'DELETE' }
    ),

  createFeeStructure: (payload: {
    courseId: number
    sessionId: number
    semesterId: number
    component: ApiFeeStructure['component']
    studyYear: number
    amount: number
  }) => request<ApiFeeStructure>('/fee-structures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  updateFeeStructure: (
    id: number,
    payload: Partial<Pick<
      ApiFeeStructure,
      'courseId' | 'sessionId' | 'semesterId' | 'component' | 'studyYear' | 'amount'
    >>
  ) => request<ApiFeeStructure>(`/fee-structures/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  previewFeeStructureDelete: (id: number) =>
    request<DeleteImpact>(`/fee-structures/${id}/delete-preview`),

  deleteFeeStructure: (id: number) =>
    request<{ id: number; deleted: true }>(
      `/fee-structures/${id}`,
      { method: 'DELETE' }
    ),

  previewHostelRateDelete: (id: number) =>
    request<DeleteImpact>(`/hostel-rates/${id}/delete-preview`),

  deleteHostelRate: (id: number) =>
    request<{ deleted: boolean }>(
      `/hostel-rates/${id}`,
      { method: 'DELETE' }
    ),

  previewReminderDelete: (id: number) =>
    request<DeleteImpact>(`/reminders/${id}/delete-preview`),

  deleteReminder: (id: number) =>
    request<{ deleted: boolean }>(
      `/reminders/${id}`,
      { method: 'DELETE' }
    ),
}
