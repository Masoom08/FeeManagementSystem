import type { ApiAcademicYear, ApiSemester, ApiStudentSummary } from '../../api/client'

export type StudentFeeStatus = 'Paid' | 'Unpaid'

export type SemesterFee = {
  semesterId: number
  semester: string
  feeDue: number
  amountPaid: number
  balance: number
  paymentDate: string | null
  dueDate: string
  status: StudentFeeStatus
  lateFee: number
  fineEntryId: number | null
  fineRemaining: number
  waivedAmount: number
  waivedAt: string | null
  waivedBy: string | null
}

export type StudentFeeRecord = SemesterFee & {
  apiStudentId: number
  academicAccountId: number
  hostelAccountId: number
  depositAccountId: number
  depositHeld: number
  hostelOutstanding: number
  enrolmentNumber: string | null
  isHosteller: boolean
  studentStatus: string
  name: string
  registrationNo: string
  phone: string
  course: string
  batch: string
  studyYear: number
  startDate: string
  endDate: string
  semesterFees: SemesterFee[]
}

const emptyFee = (): SemesterFee => ({
  semesterId: 0, semester: 'No assessed semester', feeDue: 0, amountPaid: 0, balance: 0, paymentDate: null, dueDate: '', status: 'Unpaid', lateFee: 0, fineEntryId: null, fineRemaining: 0, waivedAmount: 0, waivedAt: null, waivedBy: null,
})

export function toFeeRecord(student: ApiStudentSummary, years: ApiAcademicYear[], semesters: ApiSemester[]): StudentFeeRecord {
  const year = years.find(item => item.id === student.academicYearId) ?? student.academicYear
  const academicAccounts = student.accounts.filter(account => account.product === 'ACADEMIC')
  const hostelAccounts = student.accounts.filter(account => account.product === 'HOSTEL')
  const academicLines = academicAccounts.flatMap(account => account.lines)
  const semesterFees = semesters.flatMap(semester => {
    const lines = academicLines.filter(line => line.semesterId === semester.id && line.bucket === 'DUES')
    if (!lines.some(line => line.entryType === 'ASSESSMENT')) return []
    const feeDue = lines.filter(line => line.entryType === 'ASSESSMENT' && line.direction === 'INCREASE').reduce((sum, line) => sum + line.amount, 0)
    const amountPaid = lines.filter(line => line.entryType === 'PAYMENT' && line.direction === 'DECREASE').reduce((sum, line) => sum + line.amount, 0)
    const adjustments = lines.filter(line => line.entryType === 'ADJUSTMENT' && line.direction === 'DECREASE').reduce((sum, line) => sum + line.amount, 0)
    const fines = lines.filter(line => line.entryType === 'FINE' && line.direction === 'INCREASE')
    const waivers = lines.filter(line => line.entryType === 'WAIVER' && line.direction === 'DECREASE')
    const waivedAmount = waivers.reduce((sum, line) => sum + line.amount, 0)
    const lateFee = Math.max(0, fines.reduce((sum, line) => sum + line.amount, 0) - waivedAmount)
    const openFine = [...fines].reverse().find(fine => fine.amount > waivers.filter(waiver => waiver.relatedEntryId === fine.id).reduce((sum, waiver) => sum + waiver.amount, 0))
    const covered = openFine ? waivers.filter(waiver => waiver.relatedEntryId === openFine.id).reduce((sum, waiver) => sum + waiver.amount, 0) : 0
    const latestWaiver = waivers.at(-1)
    const payment = lines.filter(line => line.entryType === 'PAYMENT').at(-1)
    const balance = Math.max(0, feeDue - amountPaid - adjustments + lateFee)
    const label = years.find(item => item.id === semester.academicYearId)?.label
    return [{
      semesterId: semester.id,
      semester: label ? `${label} · ${semester.name}` : semester.name,
      feeDue, amountPaid, balance, paymentDate: payment?.effectiveDate ?? null, dueDate: semester.dueDate,
      status: (balance === 0 ? 'Paid' : 'Unpaid') as StudentFeeStatus,
      lateFee, fineEntryId: openFine?.id ?? null, fineRemaining: openFine ? openFine.amount - covered : 0,
      waivedAmount, waivedAt: latestWaiver?.effectiveDate ?? null, waivedBy: latestWaiver?.actedBy ?? null,
    }]
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const depositAccount = [...student.accounts].reverse().find(account => (account.depositHeld ?? 0) > 0)
  return {
    ...(semesterFees.at(-1) ?? emptyFee()),
    apiStudentId: student.id,
    academicAccountId: academicAccounts[0]?.id ?? 0,
    hostelAccountId: hostelAccounts[0]?.id ?? 0,
    depositAccountId: depositAccount?.id ?? 0,
    depositHeld: student.accounts.reduce((sum, account) => sum + (account.depositHeld ?? 0), 0),
    hostelOutstanding: hostelAccounts.reduce((sum, account) => sum + account.duesOutstanding, 0),
    enrolmentNumber: student.enrolmentNumber,
    isHosteller: student.isHosteller,
    studentStatus: student.status,
    name: student.name,
    registrationNo: student.registrationNumber,
    phone: student.phoneNumber,
    course: student.course.courseName,
    batch: year?.label ?? String(student.academicYearId),
    studyYear: student.studyYear,
    startDate: (year?.startDate ?? '').slice(0, 4),
    endDate: (year?.endDate ?? '').slice(0, 4),
    semesterFees,
  }
}
