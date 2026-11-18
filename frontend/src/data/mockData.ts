export type StudentFeeStatus = 'Paid' | 'Unpaid'

export type SemesterFee = {
  semester: string
  feeDue: number
  amountPaid: number
  paymentDate: string | null
  dueDate: string
  status: StudentFeeStatus
}

export type StudentFeeRecord = {
  name: string
  registrationNo: string
  phone: string
  course: string
  batch: string | number
  studyYear: number
  startDate: string
  endDate: string
  semesterFees: SemesterFee[]
  semester: string
  feeDue: number
  amountPaid: number
  paymentDate: string | null
  lateFee: number
  dueDate: string
  status: StudentFeeStatus
}

const feeByCourse: Record<string, number> = {
  'BBA (LU)': 24500,
  'B.Com (Hons.)': 22000,
  MBA: 32000,
  'MBA (AKTU)': 32000,
  'BBA (AKTU)': 26000,
}
function ordinal(day: number) {
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return `${day}${suffix}`
}
type DemoStudent = {
  batch: number
  course: string
  studyYear: number
  paid: boolean
  name: string
  phone: string
  registrationNo: string
}

function makeStudent(definition: DemoStudent): StudentFeeRecord {
  const { batch, course, studyYear } = definition
  const duration = course.startsWith('MBA') ? 2 : 3
  const semesterCount = studyYear * 2 - 1
  const semesterFees = Array.from({ length: semesterCount }, (_, semesterIndex) => {
    const semesterNumber = semesterIndex + 1
    const amountPaid = semesterNumber < semesterCount || definition.paid ? feeByCourse[course] : 0
    const month = semesterNumber % 2 === 1 ? 'Jun' : 'Jan'
    const year = batch + Math.floor((semesterNumber - 1) / 2) + (semesterNumber % 2 === 0 ? 1 : 0)
    const paymentDay = amountPaid > 0 ? (semesterNumber * 2) % 10 + 1 : null
    const paymentDate = paymentDay ? `${ordinal(paymentDay)} ${month} ${year}` : null
    return {
      semester: `Semester ${semesterNumber}`,
      feeDue: feeByCourse[course],
      amountPaid,
      paymentDate,
      dueDate: `10 ${month} ${year}`,
      status: amountPaid >= feeByCourse[course] ? 'Paid' as const : 'Unpaid' as const,
    }
  })
  const currentFee = semesterFees.at(-1)!
  return {
    name: definition.name,
    registrationNo: definition.registrationNo,
    phone: definition.phone,
    course, batch, studyYear,
    startDate: `01 Aug ${batch}`,
    endDate: `31 Jul ${batch + duration}`,
    semesterFees,
    semester: currentFee.semester,
    feeDue: currentFee.feeDue,
    amountPaid: currentFee.amountPaid,
    paymentDate: currentFee.paymentDate,
    lateFee: currentFee.status === 'Unpaid' ? 500 : 0,
    dueDate: currentFee.dueDate,
    status: currentFee.status,
  }
}

export const studentFeeRecords: StudentFeeRecord[] = [
  { batch: 2026, course: 'BBA (AKTU)', studyYear: 1, paid: true, name: 'Masoom Singh', phone: '9454716083', registrationNo: 'ICM2026BAK01' },
  { batch: 2026, course: 'BBA (AKTU)', studyYear: 1, paid: false, name: 'Demo Student 2', phone: '9454716084', registrationNo: 'ICM2026BAK02' },
  { batch: 2025, course: 'BBA (LU)', studyYear: 2, paid: true, name: 'Demo Student 3', phone: '9454716085', registrationNo: 'ICM2025BLU01' },
  { batch: 2025, course: 'MBA (AKTU)', studyYear: 2, paid: false, name: 'Demo Student 4', phone: '9454716086', registrationNo: 'ICM2025MBAAK01' },
  { batch: 2024, course: 'B.Com (Hons.)', studyYear: 3, paid: true, name: 'Demo Student 5', phone: '9454716087', registrationNo: 'ICM2024BCM01' },
  { batch: 2024, course: 'B.Com (Hons.)', studyYear: 3, paid: false, name: 'Demo Student 6', phone: '9454716088', registrationNo: 'ICM2024BCM02' },
].map(makeStudent)

export const feeStructure = Object.entries(feeByCourse).map(([course, semesterFee]) => ({ course, semesterFee, annualFee: semesterFee * 2 }))

export const hostelFeeStructure = [
  { condition: 'AC', occupancy: 'Single seater', annualFee: 90000 },
  { condition: 'AC', occupancy: 'Double seater', annualFee: 65000 },
  { condition: 'AC', occupancy: 'Triple seater', annualFee: 55000 },
  { condition: 'Non-AC', occupancy: 'Single seater', annualFee: 70000 },
  { condition: 'Non-AC', occupancy: 'Double seater', annualFee: 50000 },
  { condition: 'Non-AC', occupancy: 'Triple seater', annualFee: 40000 },
]
