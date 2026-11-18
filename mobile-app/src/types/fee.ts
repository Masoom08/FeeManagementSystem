export type FeeStatus = 'Paid' | 'Due' | 'Upcoming'

export type SemesterFee = {
  semester: number
  fee: number
  paid: number
  status: FeeStatus
  paymentDate: string | null
  dueDate: string
  receiptNo?: string
}

export type PaymentReceipt = {
  receiptNo: string
  amount: number
  paymentDate: string
  semesters: number[]
  method: string
}

export type Student = {
  name: string
  registrationNo: string
  phone: string
  course: string
  batch: number
  year: number
}

export type PaymentSession = { orderId: string; checkoutUrl: string }
export type PaymentStatus = { status: 'paid' | 'pending' | 'failed'; paymentDate?: string; receiptNo?: string }
