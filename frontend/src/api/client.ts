const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')
export const AUTH_TOKEN_STORAGE_KEY = 'iccmrt-superadmin-token'

export type ApiCourse = { id: number; courseCode: string; courseName: string; affiliation: string; lateFeePerDay: number; active: boolean }
export type ApiAcademicYear = { id: number; label: string; startDate: string; endDate: string }
export type ApiSemester = { id: number; academicYearId: number; name: string; dueDate: string; graceDays: number; fineEndDate?: string | null }
export type ApiFeeStructure = { id: number; courseId: number; academicYearId: number; semesterId: number; component: 'ACADEMIC_FEE' | 'ACADEMIC_CAUTION' | 'HOSTEL_FEE' | 'HOSTEL_SECURITY'; studyYear: number; amount: number }
export type ApiHostelRate = { id: number; condition: string; occupancy: string; annualFee: number }
export type ApiReminder = { studentId: number; registrationNumber: string; name: string; duesOutstanding: number; reminders: Array<{ id: number; channel: string; sentAt: string; actedBy: string }> }
export type ApiReminderSendResult = { sent: Array<{ studentId: number; channel: string; reminderId: number }>; failed: Array<{ studentId: number; channel: string; reason: string }> }
export type ApiDashboardSummary = { totalAmountCollected: number; paymentsReceived: number; pendingPayments: number; pendingAmount: number; totalStudentCount: number }
export type ApiCourseCollectionSummary = { totalCollected: number; courses: Array<{ courseId: number; courseName: string; amount: number; sharePercent: number }> }
export type ApiPaymentHistoryRow = { paymentId: number; receiptNo: string | null; paidOn: string; method: string; amount: number; bucket: 'DUES' | 'DEPOSIT'; product: 'ACADEMIC' | 'HOSTEL'; semester: string | null; semesterAcademicYear: string | null; student: { id: number; name: string; registrationNumber: string; courseId: number; courseName: string; batch: string; studyYear: number } }

export type ApiStudentCourse = Pick<ApiCourse, 'id' | 'courseCode' | 'courseName'> & { lateFeePerDay: number }
export type ApiStudentSummary = { id: number; registrationNumber: string; enrolmentNumber: string | null; name: string; phoneNumber: string; whatsappNumber: string; email: string; fatherName: string; branch: string; courseId: number; academicYearId: number; admissionSemesterId: number; studyYear: number; status: string; isHosteller: boolean; duesOutstanding: number; course: ApiStudentCourse; academicYear: ApiAcademicYear; admissionSemester: ApiSemester; accounts: ApiFeeAccount[] }
export type ApiStudentImportRow = { rowNumber: number; valid: boolean; errors: Array<{ path: string; message: string }> | null; payload: Record<string, unknown> }
export type ApiStudentImportBatch = { id: number; status: string; fileName: string; rows: ApiStudentImportRow[] }
export type ApiLedgerEntry = { id: number; semesterId: number | null; bucket: 'DUES' | 'DEPOSIT'; entryType: string; direction: 'INCREASE' | 'DECREASE'; amount: number; component: string; effectiveDate: string }
export type ApiFeeAccount = { id: number; product: 'ACADEMIC' | 'HOSTEL'; academicYearId: number; duesOutstanding: number; lines: ApiLedgerEntry[] }
export type ApiStudent = ApiStudentSummary
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
    student: { id: number; name: string; registrationNumber: string; phoneNumber: string; courseName: string; affiliation: string; batch: string }
  }>
}

async function request<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
  const headers = new Headers(init?.headers)
  if (authenticated && typeof sessionStorage !== 'undefined') {
    const token = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  const body = await response.json() as { success: boolean; data?: T; error?: string; details?: Array<{ message?: string }> | { message?: string } }
  if (!response.ok || !body.success || body.data === undefined) {
    const detailMessage = Array.isArray(body.details) ? body.details[0]?.message : body.details?.message
    throw new Error(detailMessage || body.error || `API request failed (${response.status})`)
  }
  return body.data
}

export const api = {
  login: (email: string, password: string) => request<{ accessToken: string; tokenType: string; expiresIn: number; user: { id: number; email: string; role: 'ADMIN' | 'SUPERADMIN' } }>('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  }, false),
  dashboardSummary: () => request<ApiDashboardSummary>('/reports/dashboard'),
  courseCollections: () => request<ApiCourseCollectionSummary>('/reports/course-collections'),
  courses: () => request<ApiCourse[]>('/courses'),
  academicYears: () => request<ApiAcademicYear[]>('/academic-years'),
  semesters: () => request<ApiSemester[]>('/semesters'),
  feeStructures: (academicYearId?: number) => request<ApiFeeStructure[]>(`/fee-structures${academicYearId ? `?academicYearId=${academicYearId}` : ''}`),
  hostelRates: () => request<ApiHostelRate[]>('/hostel-rates'),
  students: (query = '') => request<ApiStudentSummary[]>(`/students${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  student: (id: number) => request<ApiStudent>(`/students/${id}`),
  reminders: () => request<ApiReminder[]>('/reminders'),
  createReminders: (studentIds: number[], channels: Array<'SMS' | 'WHATSAPP'>, actedBy: string, message: string) => request<ApiReminderSendResult>('/reminders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentIds, channels, actedBy, message }),
  }),
  createPayment: (payload: { idempotencyKey: string; actedBy: string; paidOn: string; allocations: Array<{ feeAccountId: number; bucket: 'DUES'; amount: number }> }) => request<{ id: number; receiptNo: string | null }>('/payments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'CASH', ...payload }),
  }),
  receipt: (paymentId: number) => request<ApiReceipt>(`/receipts/${paymentId}`),
  paymentHistory: () => request<ApiPaymentHistoryRow[]>('/payments/history'),
  createCourse: (payload: { courseCode: string; courseName: string; affiliation: 'AKTU' | 'LU'; lateFeePerDay: number }) => request<ApiCourse>('/courses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  updateCourse: (id: number, payload: Partial<{ courseCode: string; courseName: string; affiliation: 'AKTU' | 'LU'; lateFeePerDay: number; active: boolean }>) => request<ApiCourse>(`/courses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  deleteCourse: (id: number) => request<ApiCourse | { id: number; deleted: true }>(`/courses/${id}`, { method: 'DELETE' }),
  createStudent: (payload: { registrationNumber: string; name: string; whatsappNumber: string; phoneNumber: string; email: string; fatherName: string; branch: string; courseId: number; academicYearId: number; semesterId: number; admissionType: 'DIRECT' | 'COUNSELLING'; isHosteller: boolean; studyYear: number }) => request<ApiStudentSummary>('/students', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  updateStudent: (id: number, payload: Partial<{ name: string; phoneNumber: string; whatsappNumber: string; email: string; fatherName: string; branch: string; enrolmentNumber: string; isHosteller: boolean; studyYear: number; status: 'ACTIVE' | 'LEFT' | 'COMPLETED' }>) => request<ApiStudentSummary>(`/students/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  deleteStudent: (id: number) => request<ApiStudentSummary>(`/students/${id}`, { method: 'DELETE' }),
  previewStudentImport: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<ApiStudentImportBatch>('/students/imports/preview', { method: 'POST', body: form })
  },
  commitStudentImport: (batchId: number) => request<{ batchId: number; status: string; students: ApiStudentSummary[] }>(`/students/imports/${batchId}/commit`, { method: 'POST' }),
  createAcademicYear: (payload: { label: string; startDate: string; endDate: string }) => request<ApiAcademicYear>('/academic-years', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  updateAcademicYear: (id: number, payload: Partial<{ label: string; startDate: string; endDate: string }>) => request<ApiAcademicYear>(`/academic-years/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  deleteAcademicYear: (id: number) => request<{ id: number; deleted: true }>(`/academic-years/${id}`, { method: 'DELETE' }),
  createSemester: (payload: { academicYearId: number; name: string; dueDate: string; graceDays: number; fineEndDate?: string }) => request<ApiSemester>('/semesters', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  updateSemester: (id: number, payload: Partial<{ name: string; dueDate: string; graceDays: number; fineEndDate: string | null }>) => request<ApiSemester>(`/semesters/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  deleteSemester: (id: number) => request<{ id: number; deleted: true }>(`/semesters/${id}`, { method: 'DELETE' }),
  createFeeStructure: (payload: { courseId: number; academicYearId: number; semesterId: number; component: ApiFeeStructure['component']; studyYear: number; amount: number }) => request<ApiFeeStructure>('/fee-structures', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  updateFeeStructure: (id: number, payload: Partial<Pick<ApiFeeStructure, 'courseId' | 'academicYearId' | 'semesterId' | 'component' | 'studyYear' | 'amount'>>) => request<ApiFeeStructure>(`/fee-structures/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  deleteFeeStructure: (id: number) => request<{ id: number; deleted: true }>(`/fee-structures/${id}`, { method: 'DELETE' }),
}

