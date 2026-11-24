import type { HostelSeatChoice } from '../components/HostelFeeCard'
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
  const result = await request<{ accessToken: string; student: { id: number; name: string; registrationNumber: string; phoneNumber: string; studyYear: number; course: { courseName: string }; academicYear: { label: string } } }>('/student-auth/verify-otp', undefined, { method: 'POST', body: JSON.stringify({ phoneNumber, otp }) })
  return {
    accessToken: result.accessToken,
    student: { id: result.student.id, name: result.student.name, registrationNo: result.student.registrationNumber, phone: result.student.phoneNumber, year: result.student.studyYear, course: result.student.course.courseName, batch: result.student.academicYear.label } as Student,
  }
}

export type StudentPaymentStatus = { reference: string | null; status: 'PENDING' | 'SUCCESS' | 'FAILED'; amount: number; method: string; receiptNo: string | null }

type StudentProfileResponse = {
  student: Student
  hostelOutstanding?: number
  hostelSeat?: HostelSeatChoice | null
  hostelRates?: HostelSeatChoice[]
  payments?: StudentPaymentStatus[]
  fees: (Omit<SemesterFee, 'dueDate' | 'paymentDate' | 'billed'> & { dueDate: string | null; paymentDate: string | null; billed?: boolean })[]
}

export async function loadStudentProfile(token: string) {
  const result = await request<StudentProfileResponse>('/student-auth/me', token)
  return { ...result, payments: result.payments ?? [], hostelOutstanding: result.hostelOutstanding ?? 0, hostelSeat: result.hostelSeat ?? null, hostelRates: result.hostelRates ?? [], fees: result.fees.map(fee => ({ ...fee, billed: fee.billed !== false, dueDate: fee.dueDate ? new Date(fee.dueDate).toLocaleDateString('en-IN') : null, paymentDate: fee.paymentDate ? new Date(fee.paymentDate).toLocaleDateString('en-IN') : null })) }
}

export async function saveHostelSeat(token: string, hostelRateId: number) {
  return request<StudentProfileResponse>('/student-auth/hostel-seat', token, { method: 'PATCH', body: JSON.stringify({ hostelRateId }) })
}

export async function loadStudentReceipts(token: string) {
  const receipts = await request<{ receiptNo: string; paymentId: number; amount: number; paidOn: string; method: string; product?: 'ACADEMIC' | 'HOSTEL'; semesters: number[] }[]>('/student-auth/receipts', token)
  return receipts.map(receipt => ({ ...receipt, paymentDate: new Date(receipt.paidOn).toLocaleDateString('en-IN') })) as PaymentReceipt[]
}

export async function createStudentPayment(token: string, amount: number, idempotencyKey: string, product?: 'ACADEMIC' | 'HOSTEL') {
  return request<{ orderId: string }>('/student-auth/payments', token, {
    method: 'POST', body: JSON.stringify({ amount, idempotencyKey, ...(product === 'HOSTEL' ? { product } : {}) }),
  })
}

export async function completeMockStudentPayment(token: string, orderId: string, result: 'success' | 'failure') {
  const action = result === 'success' ? 'mock-success' : 'mock-failure'
  return request<{ orderId: string; status: 'SUCCESS' | 'FAILED'; receiptNo?: string }>(`/student-auth/payments/${encodeURIComponent(orderId)}/${action}`, token, { method: 'POST' })
}

export type ConfirmedStudentPayment = { orderId: string; status: 'SUCCESS'; receiptNo?: string }

export class PaymentConfirmError extends Error {
  orderId?: string

  constructor(message: string, orderId?: string) {
    super(message)
    this.name = 'PaymentConfirmError'
    this.orderId = orderId
  }
}

export function displayPaymentMethod(method: string) {
  return method === 'MOCK' ? 'Online' : method
}

export async function confirmStudentPayment(token: string, amount: number, existingOrderId?: string, product?: 'ACADEMIC' | 'HOSTEL'): Promise<ConfirmedStudentPayment> {
  let orderId = existingOrderId
  try {
    if (!orderId) {
      const created = await createStudentPayment(token, amount, `MOBILE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, product)
      orderId = created.orderId
    }
    const payment = await completeMockStudentPayment(token, orderId, 'success')
    if (payment.status !== 'SUCCESS') throw new Error('The payment could not be confirmed.')
    return { orderId, status: 'SUCCESS', receiptNo: payment.receiptNo }
  } catch (error) {
    if (error instanceof PaymentConfirmError) throw error
    const message = error instanceof Error ? error.message : 'Please try again.'
    throw new PaymentConfirmError(message, orderId)
  }
}

export async function signOutStudent(token: string) {
  return request<{ message: string }>('/student-auth/logout', token, { method: 'POST' })
}
