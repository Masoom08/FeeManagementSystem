const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')
export const AUTH_TOKEN_STORAGE_KEY = 'iccmrt-superadmin-token'

export type ApiCourse = { id: number; courseCode: string; courseName: string; affiliation: string; lateFeePerDay: number; active: boolean }
export type ApiAcademicYear = { id: number; label: string; startDate: string; endDate: string }
export type ApiSemester = { id: number; academicYearId: number; name: string; dueDate: string; graceDays: number; fineEndDate?: string | null }
export type ApiFeeStructure = { id: number; courseId: number; academicYearId: number; semesterId: number; component: 'ACADEMIC_FEE' | 'ACADEMIC_CAUTION' | 'HOSTEL_FEE' | 'HOSTEL_SECURITY'; studyYear: number; amount: number }
export type ApiHostelRate = { id: number; condition: string; occupancy: string; annualFee: number }
export type ApiReminder = { studentId: number; registrationNumber: string; name: string; duesOutstanding: number; reminders: Array<{ id: number; channel: string; sentAt: string; actedBy: string }> }
export type ApiReminderSendResult = { sent: Array<{ studentId: number; channel: string; reminderId: number }>; failed: Array<{ studentId: number; channel: string; reason: string }> }

export type ApiStudentCourse = Pick<ApiCourse, 'id' | 'courseCode' | 'courseName'> & { lateFeePerDay: number }
export type ApiStudentSummary = { id: number; registrationNumber: string; enrolmentNumber: string | null; name: string; phoneNumber: string; whatsappNumber: string; email: string; fatherName: string; branch: string; courseId: number; academicYearId: number; admissionSemesterId: number; studyYear: number; status: string; isHosteller: boolean; duesOutstanding: number; course: ApiStudentCourse; academicYear: ApiAcademicYear; admissionSemester: ApiSemester; accounts: ApiFeeAccount[] }
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
  const body = await response.json() as { success: boolean; data?: T; error?: string }
  if (!response.ok || !body.success || body.data === undefined) throw new Error(body.error ?? `API request failed (${response.status})`)
  return body.data
}

export const api = {
  login: (email: string, password: string) => request<{ accessToken: string; tokenType: string; expiresIn: number; user: { id: number; email: string; role: 'TEACHER' | 'SUPERADMIN' } }>('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  }, false),
  courses: () => request<ApiCourse[]>('/courses'),
  academicYears: () => request<ApiAcademicYear[]>('/academic-years'),
  semesters: () => request<ApiSemester[]>('/semesters'),
  feeStructures: () => request<ApiFeeStructure[]>('/fee-structures'),
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
  createCourse: (payload: { courseCode: string; courseName: string; affiliation: 'AKTU' | 'LU'; lateFeePerDay: number }) => request<ApiCourse>('/courses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  createStudent: (payload: { registrationNumber: string; name: string; whatsappNumber: string; phoneNumber: string; email: string; fatherName: string; branch: string; courseId: number; academicYearId: number; semesterId: number; admissionType: 'DIRECT' | 'COUNSELLING'; isHosteller: boolean; studyYear: number }) => request<ApiStudentSummary>('/students', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  createAcademicYear: (payload: { label: string; startDate: string; endDate: string }) => request<ApiAcademicYear>('/academic-years', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  createSemester: (payload: { academicYearId: number; name: string; dueDate: string; graceDays: number; fineEndDate?: string }) => request<ApiSemester>('/semesters', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  createFeeStructure: (payload: { courseId: number; academicYearId: number; semesterId: number; component: ApiFeeStructure['component']; studyYear: number; amount: number }) => request<ApiFeeStructure>('/fee-structures', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
}

