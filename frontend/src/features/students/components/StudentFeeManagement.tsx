import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Icon } from '../../../components/ui/AppIcon'
import { studentFeeRecords, type SemesterFee, type StudentFeeRecord, type StudentFeeStatus } from '../../../data/mockData'
import { api, type ApiSession, type ApiReceipt, type ApiSemester, type ApiStudentImportBatch, type ApiStudentSummary } from '../../../api/client'
import { InvoiceTemplate } from '../../payments/components/InvoiceTemplate'
import './StudentFeeManagement.css'

type StatusFilter = 'All' | StudentFeeStatus
type StudentFeeManagementProps = { onNotice: (message: string) => void; view: 'students' | 'reminders'; onAddStudent?: () => void; canImportStudents?: boolean; refreshKey?: number }
type ReminderLog = { id: string; name: string; registrationNo: string; phone: string; course: string; semester: string; createdAt: string; message: string }
type ReminderBatch = { id: string; recipients: number; course: string; semester: string; createdAt: string; message: string }
type LiveStudentFeeRecord = StudentFeeRecord & { apiStudentId: number; academicAccountId: number; accountIdsBySession: Record<string, number>; apiStudent: ApiStudentSummary; currentSemesterLabel: string; session: string }
type FeeRow = LiveStudentFeeRecord & SemesterFee
const reminderHistoryKey = 'iccmrt-reminder-history'
const reminderMessage = 'Dear student, our records show an outstanding current semester fee balance. Please contact the accounts office or complete your payment. If you have already paid, kindly ignore this message.'
const studentCourseTabs = ['All courses', 'B.Com', 'BBA (LU)', 'BBA (AKTU)', 'MBA (AKTU)']

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function toFeeRecord(student: ApiStudentSummary, years: ApiSession[], semesters: ApiSemester[]): LiveStudentFeeRecord {
  const year = years.find(item => item.id === student.sessionId)
  const academicPeriodSemester = (student.studyYear - 1) * 2 + (new Date().getMonth() >= 6 ? 1 : 2)
  const currentSemester = semesters.find(semester =>
    semester.sessionId === student.sessionId &&
    semester.name.trim().toLowerCase() === `semester ${academicPeriodSemester}`,
  )
  const currentSemesterLabel = currentSemester
    ? `${currentSemester.name}${year?.label ? ` (${year.label})` : ''}`
    : `Semester ${academicPeriodSemester}${year?.label ? ` (${year.label})` : ''}`
  const academicAccounts = student.accounts.filter(account => account.product === 'ACADEMIC')
  const semesterFees: SemesterFee[] = semesters.flatMap(semester => {
    const lines = academicAccounts.flatMap(account => account.lines).filter(line => line.semesterId === semester.id && line.bucket === 'DUES')
    if (!lines.length) return []
    const feeDue = lines.filter(line => line.direction === 'INCREASE').reduce((sum, line) => sum + line.amount, 0)
    const balance = Math.max(0, lines.reduce((sum, line) => sum + (line.direction === 'INCREASE' ? line.amount : -line.amount), 0))
    const paid = Math.max(0, feeDue - balance)
    const payment = lines.filter(line => line.entryType === 'PAYMENT' && line.direction === 'DECREASE').at(-1)
    const label = years.find(item => item.id === semester.sessionId)?.label
    return [{ semester: `${semester.name}${label ? ` (${label})` : ''}`, feeDue, amountPaid: paid, paymentDate: payment?.effectiveDate ?? null, dueDate: semester.dueDate, status: (balance === 0 ? 'Paid' : 'Unpaid') as StudentFeeStatus }]
  })
  const admissionSemesterLabel = `${student.admissionSemester.name}${year?.label ? ` (${year.label})` : ''}`
  const firstFee = semesterFees.find(fee => fee.semester === currentSemesterLabel)
    ?? semesterFees.find(fee => fee.semester === admissionSemesterLabel)
    ?? semesterFees[0]
    ?? { semester: 'No assessed semester', feeDue: 0, amountPaid: 0, paymentDate: null, dueDate: '', status: 'Unpaid' as const }
  const startDate = student.batch.startDate.slice(0, 4)
  const endDate = student.batch.endDate.slice(0, 4)
  const accountIdsBySession = Object.fromEntries(academicAccounts.map(account => [years.find(item => item.id === account.sessionId)?.label ?? '', account.id]))
  return { apiStudentId: student.id, academicAccountId: academicAccounts.find(account => account.sessionId === student.sessionId)?.id ?? academicAccounts[0]?.id ?? 0, accountIdsBySession, apiStudent: student, name: student.name, registrationNo: student.registrationNumber, phone: student.phoneNumber, course: student.course.courseName, batch: student.batch.label, studyYear: student.studyYear, startDate, endDate, semesterFees, currentSemesterLabel, session: year?.label ?? '—', ...firstFee, lateFee: 0 }
}

async function loadStudentRoster() {
  const [students, years, semesters] = await Promise.all([api.students(), api.sessions(), api.semesters()])
  return students.filter(student => student.status !== 'LEFT').map(student => toFeeRecord(student, years, semesters))
}

function toReminderLogs(rows: Awaited<ReturnType<typeof api.reminders>>, students: LiveStudentFeeRecord[]): ReminderLog[] {
  return rows.flatMap(row => row.reminders.map(reminder => {
    const student = students.find(item => item.apiStudentId === row.studentId)
    return {
      id: String(reminder.id), name: row.name, registrationNo: row.registrationNumber,
      phone: student?.phone ?? '', course: student?.course ?? '—', semester: 'All semesters',
      createdAt: reminder.sentAt,
      message: `${reminder.channel} reminder recorded. Outstanding balance: ${currency.format(row.duesOutstanding)}.`,
    }
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function getReminderRecipients(course: string, semester: string) {
  return studentFeeRecords.flatMap(student => {
    if (course !== 'All courses' && student.course !== course) return []
    const fee = semester === 'All semesters'
      ? student.semesterFees[(student.studyYear - 1) * 2]
      : student.semesterFees.find(item => item.semester === semester)
    return fee?.status === 'Unpaid' ? [{ student, semester: fee.semester }] : []
  })
}

function localDateKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function currentDateTime() {
  const now = new Date()
  return {
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  }
}

function matchesCourseTab(courseName: string, tab: string) {
  if (tab === 'All courses') return true
  const normalized = courseName.toLowerCase().replaceAll('.', '')
  if (tab === 'B.Com') return normalized.includes('bcom') || normalized.includes('commerce')
  if (tab === 'BBA (LU)') return normalized.includes('bba') && (normalized.includes('lu') || normalized.includes('lucknow'))
  if (tab === 'BBA (AKTU)') return normalized.includes('bba') && normalized.includes('aktu')
  if (tab === 'MBA (AKTU)') return normalized.includes('mba') && (normalized.includes('aktu') || normalized.trim() === 'mba')
  return courseName === tab
}

function restoreReminderHistory(): ReminderLog[] {
  try {
    const saved = JSON.parse(localStorage.getItem(reminderHistoryKey) ?? '[]') as Array<ReminderLog | ReminderBatch>
    return saved.flatMap(entry => {
      if ('name' in entry) return [entry]
      return getReminderRecipients(entry.course, entry.semester).slice(0, entry.recipients).map(({ student, semester }) => ({
        id: `${entry.id}-${student.registrationNo}`,
        name: student.name,
        registrationNo: student.registrationNo,
        phone: student.phone,
        course: student.course,
        semester,
        createdAt: entry.createdAt,
        message: entry.message,
      }))
    })
  } catch {
    return []
  }
}

function csvCell(value: string | number) {
  const safe = String(value).replace(/^[=+@-]/, "'$&")
  return `"${safe.replaceAll('"', '""')}"`
}

function exportStudents(rows: LiveStudentFeeRecord[], status: StatusFilter) {
  const heading = ['Student name', 'Registration number', 'Phone', 'Course', 'Batch', 'Session', 'Study year', 'Semester', 'Semester fee', 'Amount paid', 'Payment date', 'Balance due', 'Due date', 'Fee status']
  const records = rows.map(student => [
    student.name,
    student.registrationNo,
    student.phone,
    student.course,
    student.batch,
    student.session,
    `Year ${student.studyYear}`,
    student.semester,
    student.feeDue,
    student.amountPaid,
    student.paymentDate ?? '-',
    Math.max(0, student.feeDue - student.amountPaid),
    student.dueDate,
    student.status,
  ])
  const csv = [heading, ...records].map(row => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ICCMRT-${status.toLowerCase()}-students-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function StudentFeeManagement({ onNotice, view, onAddStudent, canImportStudents = false, refreshKey = 0 }: StudentFeeManagementProps) {
  const [apiRecords, setApiRecords] = useState<LiveStudentFeeRecord[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [studentApiError, setStudentApiError] = useState('')
  const [course, setCourse] = useState('All courses')
  const [batch, setBatch] = useState('All batches')
  const [studyYear, setStudyYear] = useState('All years')
  const [sessionFilter, setSessionFilter] = useState('All sessions')
  const [semester, setSemester] = useState('All semesters')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [query, setQuery] = useState('')
  const [reminderQuery, setReminderQuery] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderCourse, setReminderCourse] = useState('All courses')
  const [reminderSemester, setReminderSemester] = useState('All semesters')
  const [smsOpen, setSmsOpen] = useState(false)
  const [cashStudent, setCashStudent] = useState<Pick<FeeRow, 'apiStudentId' | 'academicAccountId' | 'name' | 'registrationNo' | 'semester' | 'feeDue' | 'amountPaid'> | null>(null)
  const [cashDate, setCashDate] = useState('')
  const [cashPaymentKey, setCashPaymentKey] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [receipt, setReceipt] = useState<ApiReceipt | null>(null)
  const [savingReminders, setSavingReminders] = useState(false)
  const [expandedReminder, setExpandedReminder] = useState<string | null>(null)
  const [reminderHistory, setReminderHistory] = useState<ReminderLog[]>(restoreReminderHistory)
  const [studentImportOpen, setStudentImportOpen] = useState(false)
  const [studentImportFile, setStudentImportFile] = useState<File | null>(null)
  const [studentImportBatch, setStudentImportBatch] = useState<ApiStudentImportBatch | null>(null)
  const [studentImportBusy, setStudentImportBusy] = useState(false)
  const [studentImportError, setStudentImportError] = useState('')
  const [editingStudent, setEditingStudent] = useState<ApiStudentSummary | null>(null)

  useEffect(() => {
    let active = true
    loadStudentRoster()
      .then(records => {
        if (!active) return
        setApiRecords(records)
        setLoadingStudents(false)
        api.reminders().then(rows => { if (active) setReminderHistory(toReminderLogs(rows, records)) }).catch(() => undefined)
      })
      .catch(error => {
        if (!active) return
        setStudentApiError(error instanceof Error ? error.message : 'Could not load students')
        setLoadingStudents(false)
      })
    return () => { active = false }
  }, [refreshKey])

  useEffect(() => {
    localStorage.setItem(reminderHistoryKey, JSON.stringify(reminderHistory))
  }, [reminderHistory])

  const courseRows = useMemo<FeeRow[]>(() => apiRecords.filter(student =>
    matchesCourseTab(student.course, course) &&
    (batch === 'All batches' || String(student.batch) === batch) &&
    (studyYear === 'All years' || student.studyYear === Number(studyYear)) &&
    (sessionFilter === 'All sessions' || student.session === sessionFilter) &&
    (semester === 'All semesters' || student.semesterFees.some(item => item.semester === semester)) &&
    `${student.name} ${student.registrationNo}`.toLowerCase().includes(query.toLowerCase()),
  ).flatMap(student => {
    const fee = semester === 'All semesters'
      ? student.semesterFees.find(item => item.semester === student.currentSemesterLabel)
        ?? student.semesterFees.find(item => item.semester === `${student.apiStudent.admissionSemester.name} (${student.session})`)
        ?? student.semesterFees[0]
      : student.semesterFees.find(item => item.semester === semester)
    if (!fee) return []
    const feeSession = fee.semester.match(/\(([^)]+)\)$/)?.[1] ?? student.session
    return [{ ...student, ...fee, academicAccountId: student.accountIdsBySession[feeSession] ?? student.academicAccountId }]
  }), [apiRecords, course, batch, studyYear, sessionFilter, semester, query])
  const batches = Array.from(new Set(apiRecords.map(student => String(student.batch)))).sort((a, b) => b.localeCompare(a))
  const batchRecords = apiRecords.filter(student => batch === 'All batches' || String(student.batch) === batch)
  const courseRecords = batchRecords.filter(student => matchesCourseTab(student.course, course))
  const availableStudyYears = Array.from(new Set(courseRecords.map(student => student.studyYear))).sort((a, b) => a - b)
  const studyYearRecords = courseRecords.filter(student => studyYear === 'All years' || student.studyYear === Number(studyYear))
  const availableSessions = Array.from(new Set(studyYearRecords.map(student => student.session))).sort((a, b) => b.localeCompare(a))
  const sessionRecords = studyYearRecords.filter(student => sessionFilter === 'All sessions' || student.session === sessionFilter)
  const availableSemesters = Array.from(new Set(sessionRecords.flatMap(student => student.semesterFees.map(item => item.semester))))
    .filter(item => studyYear === 'All years' || Number(item.match(/semester\s+(\d+)/i)?.[1]) >= (Number(studyYear) - 1) * 2 + 1 && Number(item.match(/semester\s+(\d+)/i)?.[1]) <= Number(studyYear) * 2)
    .sort((a, b) => Number(a.match(/semester\s+(\d+)/i)?.[1] ?? 0) - Number(b.match(/semester\s+(\d+)/i)?.[1] ?? 0))
  const paidCount = courseRows.filter(student => student.status === 'Paid').length
  const unpaidRows = courseRows.filter(student => student.status === 'Unpaid')
  const visibleRows = status === 'All' ? courseRows : courseRows.filter(student => student.status === status)
  const outstanding = unpaidRows.reduce((total, student) => total + Math.max(0, student.feeDue - student.amountPaid), 0)
  const visibleReminders = reminderHistory.filter(item =>
    `${item.name} ${item.phone} ${item.registrationNo} ${item.createdAt}`.toLowerCase().includes(reminderQuery.trim().toLowerCase()) &&
    (!reminderDate || localDateKey(item.createdAt) === reminderDate) &&
    (reminderCourse === 'All courses' || item.course === reminderCourse) &&
    (reminderSemester === 'All semesters' || item.semester === reminderSemester),
  )
  const hasReminderFilters = Boolean(reminderQuery || reminderDate || reminderCourse !== 'All courses' || reminderSemester !== 'All semesters')

  const previewStudentImport = async () => {
    if (!studentImportFile) return
    setStudentImportBusy(true)
    setStudentImportError('')
    setStudentImportBatch(null)
    try {
      setStudentImportBatch(await api.previewStudentImport(studentImportFile))
    } catch (error) {
      setStudentImportError(error instanceof Error ? error.message : 'Could not check the Excel file.')
    } finally {
      setStudentImportBusy(false)
    }
  }

  const commitStudentImport = async () => {
    if (!studentImportBatch || studentImportBatch.rows.some(row => !row.valid)) return
    setStudentImportBusy(true)
    setStudentImportError('')
    try {
      const result = await api.commitStudentImport(studentImportBatch.id)
      setStudentImportOpen(false)
      setStudentImportFile(null)
      setStudentImportBatch(null)
      onNotice(`${result.students.length} student${result.students.length === 1 ? '' : 's'} added successfully.`)
      try {
        setApiRecords(await loadStudentRoster())
      } catch {
        onNotice('Students were added, but the roster could not be refreshed. Reload the page to see them.')
      }
    } catch (error) {
      setStudentImportError(error instanceof Error ? error.message : 'Could not add the students.')
    } finally {
      setStudentImportBusy(false)
    }
  }

  const saveStudentChanges = async (studentId: number, form: FormData) => {
    const value = (name: string) => String(form.get(name) ?? '').trim()
    await api.updateStudent(studentId, {
      name: value('name'), phoneNumber: value('phoneNumber'), whatsappNumber: value('whatsappNumber'),
      email: value('email'), fatherName: value('fatherName'), branch: value('branch'),
      enrolmentNumber: value('enrolmentNumber') || undefined, studyYear: Number(value('studyYear')),
      isHosteller: form.get('isHosteller') === 'on',
    })
    setEditingStudent(null)
    onNotice('Student details updated.')
    try {
      setApiRecords(await loadStudentRoster())
    } catch {
      onNotice('Student details were updated, but the roster could not be refreshed. Reload the page to see the latest values.')
    }
  }

  const deleteStudentRecord = async (student: LiveStudentFeeRecord) => {
    if (!window.confirm(`Delete ${student.name}? The student will be archived and their fee/payment history will be preserved.`)) return
    try {
      await api.deleteStudent(student.apiStudentId)
      setApiRecords(rows => rows.filter(row => row.apiStudentId !== student.apiStudentId))
      onNotice(`${student.name} was archived.`)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not delete this student.')
    }
  }

  const recordReminderBatch = async () => {
    const studentIds = [...new Set(unpaidRows.map(student => student.apiStudentId))]
    if (!studentIds.length) return
    setSavingReminders(true)
    try {
      const result = await api.createReminders(studentIds, ['SMS'], 'frontend-admin', reminderMessage)
      setSmsOpen(false)
      onNotice(`${result.sent.length} SMS reminder${result.sent.length === 1 ? '' : 's'} accepted by the gateway${result.failed.length ? `; ${result.failed.length} failed` : ''}.`)
      api.reminders().then(rows => setReminderHistory(toReminderLogs(rows, apiRecords))).catch(() => undefined)
    } catch (error) {
      onNotice(error instanceof Error ? `Could not save reminder requests: ${error.message}` : 'Could not save reminder requests.')
    } finally {
      setSavingReminders(false)
    }
  }

  const saveCashPayment = async () => {
    if (!cashStudent || !cashStudent.academicAccountId || !cashDate || !Number(cashAmount)) return
    setSavingPayment(true)
    try {
      const payment = await api.createPayment({
        idempotencyKey: cashPaymentKey,
        actedBy: 'frontend-admin',
        paidOn: cashDate,
        allocations: [{ feeAccountId: cashStudent.academicAccountId, bucket: 'DUES', amount: Number(cashAmount) }],
      })
      setCashStudent(null)
      onNotice(`Cash payment of ${currency.format(Number(cashAmount))} saved to the fee account.`)
      try {
        setReceipt(await api.receipt(payment.id))
      } catch {
        onNotice('Payment saved, but its receipt could not be loaded. You can retry from the payment record.')
      }
      loadStudentRoster().then(setApiRecords).catch(() => onNotice('Payment was saved, but the roster could not be refreshed. Reload the page to see the latest balance.'))
    } catch (error) {
      onNotice(error instanceof Error ? `Could not record payment: ${error.message}` : 'Could not record payment.')
    } finally {
      setSavingPayment(false)
    }
  }

  return <section className="student-management" aria-labelledby="student-fee-title">
    <div className="student-page-heading">
      {view === 'reminders'
        ? <div><div className="eyebrow">STUDENT ACCOUNTS</div><h1 id="student-fee-title">Reminder history</h1><p>Recent SMS reminder batches prepared from this dashboard</p></div>
        : <div><div className="eyebrow">STUDENT ACCOUNTS · LIVE ROSTER</div><h1 id="student-fee-title">Student fee status</h1><p>Student details and fee balances from the connected API.</p></div>}
      {view === 'students' && <div className="student-page-actions">{onAddStudent && <button className="secondary-button" onClick={onAddStudent}><Icon name="plus" size={17}/> Add student</button>}{canImportStudents && <button className="secondary-button" onClick={() => { setStudentImportOpen(true); setStudentImportError(''); setStudentImportBatch(null); setStudentImportFile(null) }}><Icon name="upload" size={17}/> Import Excel</button>}<button className="primary-button reminder-button" onClick={() => setSmsOpen(true)} disabled={unpaidRows.length === 0}><Icon name="bell" size={19}/> Send SMS reminders <span>{unpaidRows.length}</span></button></div>}
    </div>

    {view === 'students' && <>
    {loadingStudents && <div className="student-empty" role="status">Loading students and fee balances…</div>}
    {studentApiError && <div className="student-empty" role="alert">Could not load the student list: {studentApiError}. Check VITE_API_BASE_URL and the API server.</div>}
    <div className="student-summary-grid" aria-label="Filtered student fee totals">
      <article className="student-summary-card"><span className="summary-symbol summary-all"><Icon name="users" size={21}/></span><div><span>Students in view</span><strong>{courseRows.length}</strong></div></article>
      <article className="student-summary-card"><span className="summary-symbol summary-paid"><Icon name="check" size={21}/></span><div><span>Semester fee paid</span><strong>{paidCount}</strong></div></article>
      <article className="student-summary-card"><span className="summary-symbol summary-unpaid"><Icon name="clock" size={21}/></span><div><span>Semester fee unpaid</span><strong>{unpaidRows.length}</strong></div></article>
      <article className="student-summary-card"><span className="summary-symbol summary-balance"><Icon name="wallet" size={21}/></span><div><span>Outstanding balance</span><strong>{currency.format(outstanding)}</strong></div></article>
    </div>

    <div className="panel student-list-panel">
      <div className="student-list-title"><div><h2>Current semester fees</h2><p>Outstanding and paid amounts for the selected semester · fees shown in INR</p></div></div>
      <div className="student-course-tabs" role="tablist" aria-label="Student course sections">{studentCourseTabs.map(tab => <button key={tab} type="button" role="tab" aria-selected={course === tab} className={course === tab ? 'active' : ''} onClick={() => { setCourse(tab); setStudyYear('All years'); setSessionFilter('All sessions'); setSemester('All semesters') }}>{tab}</button>)}</div>
      <div className="student-filter-row">
        <label className="student-filter search-filter"><span>Search student</span><div><Icon name="search" size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or registration no."/></div></label>
        <label className="student-filter"><span>Batch</span><select value={batch} onChange={event => { setBatch(event.target.value); setStudyYear('All years'); setSessionFilter('All sessions'); setSemester('All semesters') }}><option>All batches</option>{batches.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="student-filter"><span>Study year</span><select value={studyYear} disabled={batch === 'All batches' || course === 'All courses'} onChange={event => { setStudyYear(event.target.value); setSessionFilter('All sessions'); setSemester('All semesters') }}><option>All years</option>{availableStudyYears.map(item => <option key={item} value={item}>Year {item}</option>)}</select></label>
        <label className="student-filter"><span>Session</span><select value={sessionFilter} disabled={batch === 'All batches'} onChange={event => { setSessionFilter(event.target.value); setSemester('All semesters') }}><option>All sessions</option>{availableSessions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="student-filter"><span>Semester fee status</span><select value={semester} disabled={batch === 'All batches' || course === 'All courses' || studyYear === 'All years' || sessionFilter === 'All sessions'} onChange={event => setSemester(event.target.value)}><option>All semesters</option>{availableSemesters.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="student-filter"><span>Fee status</span><select value={status} onChange={event => setStatus(event.target.value as StatusFilter)}><option>All</option><option>Paid</option><option>Unpaid</option></select></label>
      </div>

      <div className="student-export-row"><div className="export-caption download-caption"><Icon name="download" size={18}/><span>Download an Excel-compatible list</span></div><div className="export-buttons"><button className="export-all" onClick={() => exportStudents(courseRows, 'All')}><span>All</span><small>{courseRows.length}</small></button><button className="export-paid" onClick={() => exportStudents(courseRows.filter(student => student.status === 'Paid'), 'Paid')}><span>Paid</span><small>{paidCount}</small></button><button className="export-unpaid" onClick={() => exportStudents(unpaidRows, 'Unpaid')}><span>Unpaid</span><small>{unpaidRows.length}</small></button></div></div>

      <div className="student-table-wrap"><table className="student-fee-table"><thead><tr><th>REGISTRATION NO.</th><th>STUDENT</th><th>BATCH</th><th>COURSE</th><th>SESSION</th><th>STUDY YEAR</th><th>SEMESTER</th><th>SEMESTER FEE</th><th>PAID</th><th>PAYMENT DATE</th><th>BALANCE</th><th>STATUS</th><th>ACTION</th>{onAddStudent && <th>MANAGE</th>}</tr></thead><tbody>
        {visibleRows.map(student => {
          const balance = Math.max(0, student.feeDue - student.amountPaid)
          return <tr key={student.registrationNo}><td>{student.registrationNo}</td><td><div className="student-cell"><span><strong>{student.name}</strong><small>{student.phone}</small></span></div></td><td>{student.batch}</td><td>{student.course}</td><td>{student.session}</td><td>Year {student.studyYear}</td><td>{student.semester}</td><td className="amount-cell">{currency.format(student.feeDue)}</td><td>{currency.format(student.amountPaid)}</td><td>{student.paymentDate ?? '-'}</td><td className={balance > 0 ? 'balance-due' : 'amount-cell'}>{currency.format(balance)}</td><td><span className={`status status-${student.status.toLowerCase()}`}><i/>{student.status}</span></td><td>{balance > 0 ? <button className="cash-payment-button" onClick={() => { const now = currentDateTime(); setCashStudent(student); setCashDate(now.date); setCashPaymentKey(crypto.randomUUID()); setCashAmount(String(balance)) }}>Record cash</button> : <span className="cash-paid-label">Paid in full</span>}</td>{onAddStudent && <td><div className="management-row-actions"><button onClick={() => setEditingStudent(student.apiStudent)}>Edit</button><button className="danger" onClick={() => void deleteStudentRecord(student)}>Delete</button></div></td>}</tr>
        })}
      </tbody></table>{visibleRows.length === 0 && <div className="student-empty">{loadingStudents ? 'Loading students…' : 'No students match the selected filters.'}</div>}</div>
      <div className="student-list-footer"><span>Showing <strong>{visibleRows.length}</strong> of <strong>{courseRows.length}</strong> matching students</span><span>Fee due date: <strong>{visibleRows[0]?.dueDate ?? 'varies by semester'}</strong></span></div>
    </div>
    </>}

    {view === 'reminders' && <section className="panel reminder-history" aria-label="Prepared reminder messages"><div className="reminder-history-heading"><div><h2>Reminder messages</h2><p>Open a message to see its full text and recipient details.</p></div><span className="history-count">{hasReminderFilters ? `${visibleReminders.length} of ${reminderHistory.length} messages` : `${reminderHistory.length} ${reminderHistory.length === 1 ? 'message' : 'messages'}`}</span></div><div className="reminder-filters"><label className="reminder-search"><Icon name="search" size={17}/><input value={reminderQuery} onChange={event => setReminderQuery(event.target.value)} placeholder="Search name, phone, or registration no." aria-label="Search reminders by student name, phone, registration number, or date"/>{reminderQuery && <button type="button" onClick={() => setReminderQuery('')} aria-label="Clear reminder search">×</button>}</label><label className="reminder-filter"><span>Date</span><input type="date" value={reminderDate} onChange={event => setReminderDate(event.target.value)} aria-label="Filter reminders by date"/></label><label className="reminder-filter"><span>Course</span><select value={reminderCourse} onChange={event => setReminderCourse(event.target.value)}><option>All courses</option>{Array.from(new Set(reminderHistory.map(item => item.course))).sort().map(item => <option key={item}>{item}</option>)}</select></label><label className="reminder-filter"><span>Semester</span><select value={reminderSemester} onChange={event => setReminderSemester(event.target.value)}><option>All semesters</option>{Array.from(new Set(reminderHistory.map(item => item.semester))).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))).map(item => <option key={item}>{item}</option>)}</select></label>{hasReminderFilters && <button className="reminder-clear-filters" onClick={() => { setReminderQuery(''); setReminderDate(''); setReminderCourse('All courses'); setReminderSemester('All semesters') }}>Clear filters</button>}</div>
      {reminderHistory.length === 0 ? <div className="history-empty"><span className="history-empty-icon"><Icon name="bell" size={20}/></span><div><strong>No reminders yet</strong><p>Each prepared reminder will appear here with its recipient and message.</p></div></div> : visibleReminders.length === 0 ? <div className="history-empty"><span className="history-empty-icon"><Icon name="search" size={20}/></span><div><strong>No matching students</strong><p>Try another name, mobile number, or registration number.</p></div></div> : <div className="history-list">{visibleReminders.map(item => <article className={`history-message${expandedReminder === item.id ? ' is-expanded' : ''}`} key={item.id}><button className="history-row" aria-expanded={expandedReminder === item.id} onClick={() => setExpandedReminder(current => current === item.id ? null : item.id)}><span className="history-avatar">{item.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="history-row-main"><span className="history-row-top"><strong>{item.name}</strong><span className="history-row-date">{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></span><span className="history-row-meta">To: {item.phone} · {item.registrationNo} · {item.course} · {item.semester}</span><span className="history-row-preview">{item.message}</span></span></button>{expandedReminder === item.id && <div className="history-details"><dl><div><dt>Recipient</dt><dd>{item.name}</dd></div><div><dt>Mobile number</dt><dd>{item.phone}</dd></div><div><dt>Registration number</dt><dd>{item.registrationNo}</dd></div><div><dt>Course and semester</dt><dd>{item.course} · {item.semester}</dd></div><div><dt>Prepared</dt><dd>{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div></dl><div className="history-message-body"><span>FULL MESSAGE</span><p>{item.message}</p></div></div>}</article>)}</div>}
    </section>}

    {smsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSmsOpen(false) }}><section className="sms-modal" role="dialog" aria-modal="true" aria-labelledby="sms-title"><div className="sms-modal-icon"><Icon name="bell" size={23}/></div><button className="modal-close" aria-label="Close" onClick={() => setSmsOpen(false)}>×</button><h2 id="sms-title">Remind unpaid students</h2><p className="sms-count">{unpaidRows.length} students · {course === 'All courses' ? 'all courses' : course} · {semester === 'All semesters' ? 'all semesters' : semester}</p><div className="sms-preview"><span>MESSAGE PREVIEW</span><p>{reminderMessage}</p></div><p className="sms-prototype-note">Sending submits this message to the configured SMS gateway for the selected students.</p><div className="sms-modal-actions"><button className="secondary-button" onClick={() => setSmsOpen(false)}>Cancel</button><button className="primary-button" onClick={() => void recordReminderBatch()} disabled={savingReminders}>{savingReminders ? 'Sending…' : 'Send SMS reminders'}</button></div></section></div>}
    {studentImportOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !studentImportBusy) setStudentImportOpen(false) }}><section className="sms-modal student-import-modal" role="dialog" aria-modal="true" aria-labelledby="student-import-title"><div className="sms-modal-icon"><Icon name="upload" size={23}/></div><button className="modal-close" aria-label="Close" disabled={studentImportBusy} onClick={() => setStudentImportOpen(false)}>×</button><h2 id="student-import-title">Import students from Excel</h2><p className="sms-count">Upload an .xlsx file to add multiple students in one batch.</p><p className="student-import-fields"><strong>Make sure the Excel file has all required fields:</strong> registrationNumber, name, whatsappNumber, phoneNumber, email, fatherName, branch, courseCode, batchLabel, sessionLabel, admissionType, isHosteller, studyYear, semesterName.</p><label className="student-import-file"><span>{studentImportFile?.name ?? 'Choose an Excel .xlsx file'}</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={studentImportBusy} onChange={event => { setStudentImportFile(event.target.files?.[0] ?? null); setStudentImportBatch(null); setStudentImportError('') }}/></label>{studentImportBatch && <div className="student-import-results" role="status"><strong>{studentImportBatch.rows.filter(row => row.valid).length} of {studentImportBatch.rows.length} rows ready</strong>{studentImportBatch.rows.some(row => !row.valid) && <div className="student-import-errors">{studentImportBatch.rows.filter(row => !row.valid).map(row => <p key={row.rowNumber}>Row {row.rowNumber}: {row.errors?.map(item => `${item.path} ${item.message}`).join('; ')}</p>)}</div>}</div>}{studentImportError && <p className="student-import-error" role="alert">{studentImportError}</p>}<div className="sms-modal-actions"><button className="secondary-button" disabled={!studentImportFile || studentImportBusy} onClick={() => void previewStudentImport()}>{studentImportBusy ? 'Please wait…' : 'Check file'}</button><button className="primary-button" disabled={studentImportBusy || !studentImportBatch || studentImportBatch.rows.some(row => !row.valid)} onClick={() => void commitStudentImport()}>{studentImportBusy ? 'Adding…' : `Add ${studentImportBatch?.rows.length ?? 0} student${studentImportBatch?.rows.length === 1 ? '' : 's'}`}</button></div></section></div>}
    {cashStudent && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCashStudent(null) }}><section className="sms-modal cash-payment-modal" role="dialog" aria-modal="true" aria-labelledby="cash-payment-title"><div className="sms-modal-icon cash-modal-icon"><Icon name="wallet" size={23}/></div><button className="modal-close" aria-label="Close" onClick={() => setCashStudent(null)}>×</button><h2 id="cash-payment-title">Record cash payment</h2><p className="sms-count">{cashStudent.name} · {cashStudent.registrationNo} · {cashStudent.semester}</p><div className="cash-balance-note">Remaining balance: <strong>{currency.format(Math.max(0, cashStudent.feeDue - cashStudent.amountPaid))}</strong></div><div className="cash-payment-fields"><label><span>Amount received (INR)</span><input type="number" min="1" max={Math.max(0, cashStudent.feeDue - cashStudent.amountPaid)} step="1" value={cashAmount} onChange={event => setCashAmount(event.target.value)} required/></label><label><span>Payment date</span><input type="date" value={cashDate} onChange={event => setCashDate(event.target.value)} required/></label><label><span>Payment method</span><input value="Cash" readOnly/></label></div><p className="cash-payment-note">Saving this entry updates the student’s paid amount, balance, and fee status.</p><div className="sms-modal-actions"><button className="secondary-button" onClick={() => setCashStudent(null)}>Cancel</button><button className="primary-button" disabled={!Number(cashAmount) || Number(cashAmount) <= 0 || Number(cashAmount) > cashStudent.feeDue - cashStudent.amountPaid || !cashDate || savingPayment} onClick={() => void saveCashPayment()}>{savingPayment ? 'Saving…' : 'Save payment'}</button></div></section></div>}
    {receipt && <InvoiceTemplate receipt={receipt} onClose={() => setReceipt(null)}/>}
    {editingStudent && <StudentEditModal student={editingStudent} onClose={() => setEditingStudent(null)} onSave={saveStudentChanges}/>}
  </section>
}

function StudentEditModal({ student, onClose, onSave }: { student: ApiStudentSummary; onClose: () => void; onSave: (studentId: number, form: FormData) => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true); setError('')
    try { await onSave(student.id, new FormData(event.currentTarget)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update student details.') }
    finally { setSaving(false) }
  }
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="student-edit-title"><header className="admin-modal-header"><div><div className="eyebrow">SUPER ADMIN · STUDENTS</div><h2 id="student-edit-title">Edit student</h2></div><button className="admin-modal-close" aria-label="Close dialog" disabled={saving} onClick={onClose}>×</button></header><p className="sms-count">{student.registrationNumber} · {student.course.courseName} · Batch {student.batch.label} · Session {student.session.label}</p>{error && <div className="admin-form-error" role="alert">{error}</div>}<form className="admin-form" onSubmit={submit}>
    <label><span>Student name</span><input name="name" defaultValue={student.name} maxLength={120} required/></label><label><span>Phone number</span><input name="phoneNumber" type="tel" defaultValue={student.phoneNumber} minLength={8} maxLength={20} required/></label><label><span>WhatsApp number</span><input name="whatsappNumber" type="tel" defaultValue={student.whatsappNumber} minLength={8} maxLength={20} required/></label><label><span>Email</span><input name="email" type="email" defaultValue={student.email} maxLength={120} required/></label><label><span>Father / guardian name</span><input name="fatherName" defaultValue={student.fatherName} maxLength={120} required/></label><label><span>Branch</span><input name="branch" defaultValue={student.branch} maxLength={80} required/></label><label><span>Enrolment number (optional)</span><input name="enrolmentNumber" defaultValue={student.enrolmentNumber ?? ''} maxLength={40}/></label><label><span>Current study year</span><input name="studyYear" type="number" min="1" max="10" defaultValue={student.studyYear} required/></label><label className="admin-form-checkbox"><input name="isHosteller" type="checkbox" defaultChecked={student.isHosteller}/><span>Hosteller</span></label><div className="admin-form-actions"><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form></section></div>
}

