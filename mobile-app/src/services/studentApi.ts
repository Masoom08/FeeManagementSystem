import type { PaymentReceipt, SemesterFee, Student } from '../types/fee'

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')
const apiDebugEnabled = process.env.NODE_ENV !== 'production'

async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  if (!baseUrl) throw new Error('Set EXPO_PUBLIC_API_URL to the backend address.')
  const url = `${baseUrl}/api${path}`
  const method = init.method || 'GET'
  const startedAt = Date.now()

  if (apiDebugEnabled) console.info(`[API] ${method} ${url}`)

  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    })
    const payload = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: string; details?: { message?: string }[] | { message?: string } } | null
    if (!response.ok || !payload?.success) {
      if (apiDebugEnabled) console.warn(`[API] ${method} ${url} ${response.status} (${Date.now() - startedAt} ms)`)
      const detailMessage = Array.isArray(payload?.details) ? payload.details[0]?.message : payload?.details?.message
      throw new Error(detailMessage || payload?.error || 'The server could not complete the request.')
    }
    if (apiDebugEnabled) console.info(`[API] ${method} ${url} ${response.status} (${Date.now() - startedAt} ms)`)
    return payload.data as T
  } catch (error) {
    if (apiDebugEnabled && error instanceof TypeError) {
      console.error(`[API] ${method} ${url} failed (${Date.now() - startedAt} ms)`, error)
    }
    throw error
  }
}

export async function requestStudentOtp(phoneNumber: string) {
  return request<{ phoneNumber: string; otp?: string }>('/student-auth/request-otp', undefined, { method: 'POST', body: JSON.stringify({ phoneNumber }) })
}

export async function verifyStudentOtp(phoneNumber: string, otp: string) {
  const result = await request<{ accessToken: string; student: { id: number; name: string; registrationNumber: string; phoneNumber: string; studyYear: number; course: { courseName: string }; batch: { label: string } } }>('/student-auth/verify-otp', undefined, { method: 'POST', body: JSON.stringify({ phoneNumber, otp }) })
  return {
    accessToken: result.accessToken,
    student: { id: result.student.id, name: result.student.name, registrationNo: result.student.registrationNumber, phone: result.student.phoneNumber, year: result.student.studyYear, course: result.student.course.courseName, batch: Number(result.student.batch.label.slice(0, 4)) } as Student,
  }
}

export type StudentPaymentStatus = { reference: string | null; status: 'PENDING' | 'SUCCESS' | 'FAILED'; amount: number; method: string; receiptNo: string | null }

export async function loadStudentProfile(token: string) {
  const result = await request<{ student: Student; hostelOutstanding?: number; payments?: StudentPaymentStatus[]; fees: (Omit<SemesterFee, 'dueDate' | 'paymentDate'> & { dueDate: string; paymentDate: string | null })[] }>('/student-auth/me', token)
  return { ...result, payments: result.payments ?? [], hostelOutstanding: result.hostelOutstanding ?? 0, fees: result.fees.map(fee => ({ ...fee, dueDate: new Date(fee.dueDate).toLocaleDateString('en-IN'), paymentDate: fee.paymentDate ? new Date(fee.paymentDate).toLocaleDateString('en-IN') : null })) }
}

export async function loadStudentReceipts(token: string) {
  const receipts = await request<{ receiptNo: string; paymentId: number; amount: number; paidOn: string; method: string; semesters: number[] }[]>('/student-auth/receipts', token)
  return receipts.map(receipt => ({ ...receipt, paymentDate: new Date(receipt.paidOn).toLocaleDateString('en-IN') })) as PaymentReceipt[]
}

export async function createStudentPayment(token: string, amount: number, idempotencyKey: string) {
  return request<{ orderId: string }>('/student-auth/payments', token, {
    method: 'POST', body: JSON.stringify({ amount, idempotencyKey }),
  })
}

export async function completeMockStudentPayment(token: string, orderId: string, result: 'success' | 'failure') {
  const action = result === 'success' ? 'mock-success' : 'mock-failure'
  return request<{ orderId: string; status: 'SUCCESS' | 'FAILED'; receiptNo?: string }>(`/student-auth/payments/${encodeURIComponent(orderId)}/${action}`, token, { method: 'POST' })
}

export async function signOutStudent(token: string) {
  return request<{ message: string }>('/student-auth/logout', token, { method: 'POST' })
}
