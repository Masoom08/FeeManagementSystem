import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DeleteConfirmDialog, type DeleteTarget } from '../../../components/DeleteConfirmDialog'
import { Icon } from '../../../components/ui/AppIcon'
import { actedBy, api, type ApiImportBatch, type ApiReceipt } from '../../../api/client'
import { queryKeys, useAcademicYears, useCourses, useReminders, useSemesters, useStudents } from '../../../api/queries'
import { toFeeRecord, type StudentFeeRecord, type StudentFeeStatus } from '../studentFees'
import { InvoiceTemplate } from '../../payments/components/InvoiceTemplate'
import './StudentFeeManagement.css'

type StatusFilter = 'All' | StudentFeeStatus
type StudentFeeManagementProps = { onNotice: (message: string) => void; view: 'students' | 'reminders'; onAddStudent?: () => void; canManage?: boolean }
type ReminderLog = { id: string; name: string; registrationNo: string; phone: string; course: string; semester: string; createdAt: string; message: string }
type FeeRow = StudentFeeRecord
const reminderMessage = 'Dear student, our records show an outstanding fee balance. Please contact the accounts office or complete your payment. If you have already paid, kindly ignore this message.'
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function toReminderLogs(rows: Awaited<ReturnType<typeof api.reminders>>, students: FeeRow[]): ReminderLog[] {
  return rows.flatMap(row => row.reminders.map(reminder => {
    const student = students.find(item => item.apiStudentId === row.studentId)
    return {
      id: String(reminder.id), name: row.name, registrationNo: row.registrationNumber, phone: student?.phone ?? '',
      course: student?.course ?? '—', semester: 'All semesters', createdAt: reminder.sentAt,
      message: `${reminder.channel} reminder recorded by ${reminder.actedBy}. Outstanding balance: ${currency.format(row.duesOutstanding)}.`,
    }
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function localDateKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function csvCell(value: string | number) {
  const safe = String(value).replace(/^[=+@-]/, "'$&")
  return `"${safe.replaceAll('"', '""')}"`
}

function exportStudents(rows: FeeRow[], status: StatusFilter) {
  const heading = ['Student name', 'Registration number', 'Enrolment number', 'Phone', 'Course', 'Batch', 'Study year', 'Start year', 'End year', 'Semester', 'Semester fee', 'Amount paid', 'Payment date', 'Balance due', 'Hostel due', 'Due date', 'Fee status']
  const records = rows.map(student => [student.name, student.registrationNo, student.enrolmentNumber ?? '', student.phone, student.course, student.batch, `Year ${student.studyYear}`, student.startDate, student.endDate, student.semester, student.feeDue, student.amountPaid, student.paymentDate ?? '-', student.balance, student.hostelOutstanding, student.dueDate, student.status])
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

export function StudentFeeManagement({ onNotice, view, onAddStudent, canManage = false }: StudentFeeManagementProps) {
  const queryClient = useQueryClient()
  const studentsQuery = useStudents()
  const yearsQuery = useAcademicYears()
  const semestersQuery = useSemesters()
  const coursesQuery = useCourses()
  const remindersQuery = useReminders()
  const [course, setCourse] = useState('All courses')
  const [batch, setBatch] = useState('All batches')
  const [studyYear, setStudyYear] = useState('All years')
  const [semester, setSemester] = useState('All semesters')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [query, setQuery] = useState('')
  const [reminderQuery, setReminderQuery] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderCourse, setReminderCourse] = useState('All courses')
  const [reminderSemester, setReminderSemester] = useState('All semesters')
  const [smsOpen, setSmsOpen] = useState(false)
  const [cashStudent, setCashStudent] = useState<FeeRow | null>(null)
  const [cashAccount, setCashAccount] = useState<'ACADEMIC' | 'HOSTEL'>('ACADEMIC')
  const [cashMethod, setCashMethod] = useState<'CASH' | 'CHALLAN'>('CASH')
  const [cashReference, setCashReference] = useState('')
  const [cashDate, setCashDate] = useState('')
  const [cashPaymentKey, setCashPaymentKey] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [receipt, setReceipt] = useState<ApiReceipt | null>(null)
  const [savingReminders, setSavingReminders] = useState(false)
  const [expandedReminder, setExpandedReminder] = useState<string | null>(null)
  const [editStudent, setEditStudent] = useState<FeeRow | null>(null)
  const [enrolmentNumber, setEnrolmentNumber] = useState('')
  const [studentStatus, setStudentStatus] = useState<'ACTIVE' | 'LEFT' | 'COMPLETED'>('ACTIVE')
  const [hosteller, setHosteller] = useState(false)
  const [refundStudent, setRefundStudent] = useState<FeeRow | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [deductionAmount, setDeductionAmount] = useState('')
  const [deductionReason, setDeductionReason] = useState('')
  const [importBatch, setImportBatch] = useState<ApiImportBatch | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [savingRecord, setSavingRecord] = useState(false)

  const apiRecords = useMemo(() => (studentsQuery.data ?? []).map(student => toFeeRecord(student, yearsQuery.data ?? [], semestersQuery.data ?? [])), [studentsQuery.data, yearsQuery.data, semestersQuery.data])
  const courses = (coursesQuery.data ?? []).map(item => item.courseName)
  const loadingStudents = studentsQuery.isLoading || yearsQuery.isLoading || semestersQuery.isLoading
  const studentApiError = studentsQuery.error || yearsQuery.error || semestersQuery.error
  const reminderHistory = toReminderLogs(remindersQuery.data ?? [], apiRecords)
  const refreshShared = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.students }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reminders }),
  ])

  const courseRows = useMemo<FeeRow[]>(() => apiRecords.filter(student =>
    (course === 'All courses' || student.course === course) &&
    (batch === 'All batches' || String(student.batch) === batch) &&
    (studyYear === 'All years' || student.studyYear === Number(studyYear)) &&
    (semester === 'All semesters' || student.semesterFees.some(item => item.semester === semester)) &&
    `${student.name} ${student.registrationNo} ${student.enrolmentNumber ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  ).flatMap(student => {
    const fee = semester === 'All semesters' ? student.semesterFees.at(-1) : student.semesterFees.find(item => item.semester === semester)
    if (!fee) return []
    return [{ ...student, ...fee }]
  }), [apiRecords, course, batch, studyYear, semester, query])
  const batches = Array.from(new Set(apiRecords.map(student => String(student.batch)))).sort((a, b) => b.localeCompare(a))
  const paidCount = courseRows.filter(student => student.status === 'Paid').length
  const unpaidRows = courseRows.filter(student => student.status === 'Unpaid')
  const visibleRows = status === 'All' ? courseRows : courseRows.filter(student => student.status === status)
  const outstanding = unpaidRows.reduce((total, student) => total + student.balance, 0)
  const visibleReminders = reminderHistory.filter(item =>
    `${item.name} ${item.phone} ${item.registrationNo} ${item.createdAt}`.toLowerCase().includes(reminderQuery.trim().toLowerCase()) &&
    (!reminderDate || localDateKey(item.createdAt) === reminderDate) &&
    (reminderCourse === 'All courses' || item.course === reminderCourse) &&
    (reminderSemester === 'All semesters' || item.semester === reminderSemester),
  )
  const hasReminderFilters = Boolean(reminderQuery || reminderDate || reminderCourse !== 'All courses' || reminderSemester !== 'All semesters')
  const paymentMax = cashStudent ? (cashAccount === 'HOSTEL' ? cashStudent.hostelOutstanding : cashStudent.balance) : 0

  const recordReminderBatch = async () => {
    const studentIds = [...new Set(unpaidRows.map(student => student.apiStudentId))]
    if (!studentIds.length) return
    setSavingReminders(true)
    try {
      const result = await api.createReminders(studentIds, ['SMS', 'WHATSAPP'], actedBy(), reminderMessage)
      setSmsOpen(false)
      await refreshShared()
      onNotice(`${result.sent.length} reminder${result.sent.length === 1 ? '' : 's'} recorded${result.failed.length ? `; ${result.failed.length} failed` : ''}.`)
    } catch (error) {
      onNotice(error instanceof Error ? `Could not save reminder requests: ${error.message}` : 'Could not save reminder requests.')
    } finally {
      setSavingReminders(false)
    }
  }

  const saveCashPayment = async () => {
    if (!cashStudent || !cashDate || !Number(cashAmount)) return
    const feeAccountId = cashAccount === 'HOSTEL' ? cashStudent.hostelAccountId : cashStudent.academicAccountId
    if (!feeAccountId || (cashMethod === 'CHALLAN' && !cashReference.trim())) return
    setSavingPayment(true)
    try {
      const payment = await api.createPayment({
        method: cashMethod, idempotencyKey: cashPaymentKey, actedBy: actedBy(), paidOn: cashDate,
        ...(cashMethod === 'CHALLAN' ? { reference: cashReference.trim() } : {}),
        allocations: [{ feeAccountId, bucket: 'DUES', amount: Number(cashAmount) }],
      })
      const settled = cashMethod === 'CHALLAN' ? await api.verifyPayment(payment.id, { actedBy: actedBy(), paidOn: cashDate }) : payment
      setCashStudent(null)
      await refreshShared()
      onNotice(`${cashMethod === 'CHALLAN' ? 'Challan' : 'Cash'} payment of ${currency.format(Number(cashAmount))} saved to the fee account.`)
      try { setReceipt(await api.receipt(settled.id)) } catch { onNotice('Payment saved, but its receipt could not be loaded.') }
    } catch (error) {
      onNotice(error instanceof Error ? `Could not record payment: ${error.message}` : 'Could not record payment.')
    } finally {
      setSavingPayment(false)
    }
  }

  const saveStudentRecord = async () => {
    if (!editStudent) return
    setSavingRecord(true)
    try {
      await api.updateStudent(editStudent.apiStudentId, {
        ...(enrolmentNumber.trim() ? { enrolmentNumber: enrolmentNumber.trim() } : {}),
        isHosteller: hosteller,
        status: studentStatus,
      })
      setEditStudent(null)
      await refreshShared()
      onNotice(`Student record updated for ${editStudent.name}.`)
    } catch (error) {
      onNotice(error instanceof Error ? `Could not update student: ${error.message}` : 'Could not update student.')
    } finally {
      setSavingRecord(false)
    }
  }

  const saveRefund = async (adjust: boolean) => {
    if (!refundStudent?.depositAccountId || !refundReason.trim() || !Number(refundAmount)) return
    setSavingRecord(true)
    try {
      if (adjust) await api.adjustDeposit(refundStudent.depositAccountId, Number(refundAmount), refundReason.trim())
      else {
        const deduction = Number(deductionAmount)
        await api.refundDeposit(refundStudent.depositAccountId, { amount: Number(refundAmount), reason: refundReason.trim(), ...(deduction > 0 ? { deductionAmount: deduction, deductionReason: deductionReason.trim() } : {}) })
      }
      setRefundStudent(null)
      await refreshShared()
      onNotice(adjust ? 'Deposit adjusted against fees.' : 'Deposit refund recorded.')
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not update the deposit.')
    } finally {
      setSavingRecord(false)
    }
  }

  const previewUpload = async (file: File) => {
    setSavingRecord(true)
    try { setImportBatch(await api.previewImport(file)) }
    catch (error) { onNotice(error instanceof Error ? error.message : 'Could not read the workbook.') }
    finally { setSavingRecord(false) }
  }

  const commitUpload = async () => {
    if (!importBatch || importBatch.rows.some(row => !row.valid)) return
    setSavingRecord(true)
    try {
      await api.commitImport(importBatch.id)
      setImportBatch(null)
      await refreshShared()
      onNotice('Student workbook imported.')
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not import the workbook.')
    } finally {
      setSavingRecord(false)
    }
  }

  const openPayment = (student: FeeRow) => {
    setCashStudent(student); setCashAccount('ACADEMIC'); setCashMethod('CASH'); setCashReference(''); setCashDate(todayKey()); setCashPaymentKey(crypto.randomUUID()); setCashAmount(String(student.balance))
  }

  return <section className="student-management" aria-labelledby="student-fee-title">
    <div className="student-page-heading">
      {view === 'reminders'
        ? <div><div className="eyebrow">STUDENT ACCOUNTS</div><h1 id="student-fee-title">Reminder history</h1><p>SMS and WhatsApp reminders recorded by the fee API.</p></div>
        : <div><div className="eyebrow">STUDENT ACCOUNTS · LIVE ROSTER</div><h1 id="student-fee-title">Student fee status</h1><p>Student details and fee balances from the connected API.</p></div>}
      {view === 'students' && <div className="student-page-actions">{canManage && <label className="secondary-button">Upload Excel<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void previewUpload(file) }}/></label>}{onAddStudent && <button className="secondary-button" onClick={onAddStudent}><Icon name="plus" size={17}/> Add student</button>}<button className="primary-button reminder-button" onClick={() => setSmsOpen(true)} disabled={unpaidRows.length === 0}><Icon name="bell" size={19}/> Send reminders <span>{unpaidRows.length}</span></button></div>}
    </div>

    {view === 'students' && <>
    {loadingStudents && <div className="student-empty" role="status">Loading students and fee balances…</div>}
    {studentApiError && <div className="student-empty" role="alert">Could not load the student list: {studentApiError instanceof Error ? studentApiError.message : 'Could not load students'}. Check VITE_API_BASE_URL and the API server.</div>}
    <div className="student-summary-grid" aria-label="Filtered student fee totals">
      <article className="student-summary-card"><span className="summary-symbol summary-all"><Icon name="users" size={21}/></span><div><span>Students in view</span><strong>{courseRows.length}</strong></div></article>
      <article className="student-summary-card"><span className="summary-symbol summary-paid"><Icon name="check" size={21}/></span><div><span>Semester fee paid</span><strong>{paidCount}</strong></div></article>
      <article className="student-summary-card"><span className="summary-symbol summary-unpaid"><Icon name="clock" size={21}/></span><div><span>Semester fee unpaid</span><strong>{unpaidRows.length}</strong></div></article>
      <article className="student-summary-card"><span className="summary-symbol summary-balance"><Icon name="wallet" size={21}/></span><div><span>Outstanding balance</span><strong>{currency.format(outstanding)}</strong></div></article>
    </div>

    <div className="panel student-list-panel">
      <div className="student-list-title"><div><h2>Student list & semester fees</h2><p>Fee status for the selected semester · fees shown in INR</p></div></div>
      <div className="student-filter-row">
        <label className="student-filter search-filter"><span>Search student</span><div><Icon name="search" size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or registration no."/></div></label>
        <label className="student-filter"><span>Batch / academic year</span><select value={batch} onChange={event => setBatch(event.target.value)}><option>All batches</option>{batches.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="student-filter"><span>Study year</span><select value={studyYear} onChange={event => setStudyYear(event.target.value)}><option>All years</option><option value="1">Year 1</option><option value="2">Year 2</option><option value="3">Year 3</option></select></label>
        <label className="student-filter"><span>Course</span><select value={course} onChange={event => setCourse(event.target.value)}><option>All courses</option>{courses.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="student-filter"><span>Semester fee status</span><select value={semester} onChange={event => setSemester(event.target.value)}><option>All semesters</option>{Array.from(new Set(apiRecords.flatMap(student => student.semesterFees.map(item => item.semester)))).sort().map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="student-filter"><span>Fee status</span><select value={status} onChange={event => setStatus(event.target.value as StatusFilter)}><option>All</option><option>Paid</option><option>Unpaid</option></select></label>
      </div>

      <div className="student-export-row"><div className="export-caption download-caption"><Icon name="download" size={18}/><span>Download an Excel-compatible list</span></div><div className="export-buttons"><button className="export-all" onClick={() => exportStudents(courseRows, 'All')}><span>All</span><small>{courseRows.length}</small></button><button className="export-paid" onClick={() => exportStudents(courseRows.filter(student => student.status === 'Paid'), 'Paid')}><span>Paid</span><small>{paidCount}</small></button><button className="export-unpaid" onClick={() => exportStudents(unpaidRows, 'Unpaid')}><span>Unpaid</span><small>{unpaidRows.length}</small></button></div></div>

      <div className="student-table-wrap"><table className="student-fee-table"><thead><tr><th>REGISTRATION NO.</th><th>STUDENT</th><th>BATCH</th><th>COURSE</th><th>YEAR</th><th>PERIOD (YEARS)</th><th>SEMESTER</th><th>SEMESTER FEE</th><th>PAID</th><th>PAYMENT DATE</th><th>BALANCE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
        {visibleRows.map(student => <tr key={`${student.registrationNo}-${student.semesterId}`}><td>{student.registrationNo}</td><td><div className="student-cell"><span><strong>{student.name}</strong><small>{student.phone}{student.enrolmentNumber ? ` · ${student.enrolmentNumber}` : ''}{student.hostelOutstanding ? ` · Hostel due ${currency.format(student.hostelOutstanding)}` : ''}</small></span></div></td><td>{student.batch}</td><td>{student.course}</td><td>Year {student.studyYear}</td><td>{student.startDate.slice(-4)} - {student.endDate.slice(-4)}</td><td>{student.semester}</td><td className="amount-cell">{currency.format(student.feeDue)}</td><td>{currency.format(student.amountPaid)}</td><td>{student.paymentDate ? student.paymentDate.slice(0, 10) : '-'}</td><td className={student.balance > 0 ? 'balance-due' : 'amount-cell'}>{currency.format(student.balance)}</td><td><span className={`status status-${student.status.toLowerCase()}`}><i/>{student.status}</span></td><td><div className="student-row-actions">{student.balance > 0 || student.hostelOutstanding > 0 ? <button className="cash-payment-button" onClick={() => openPayment(student)}>Record payment</button> : <span className="cash-paid-label">Paid in full</span>}{canManage && <button className="cash-payment-button" onClick={() => { setEditStudent(student); setEnrolmentNumber(student.enrolmentNumber ?? ''); setStudentStatus(student.studentStatus as 'ACTIVE' | 'LEFT' | 'COMPLETED'); setHosteller(student.isHosteller) }}>Update</button>}{canManage && student.depositHeld > 0 && <button className="cash-payment-button" onClick={() => { setRefundStudent(student); setRefundAmount(String(student.depositHeld)); setRefundReason(''); setDeductionAmount(''); setDeductionReason('') }}>Deposit</button>}{canManage && <button type="button" className="row-delete-button" onClick={() => setDeleteTarget({ kind: 'student', id: student.apiStudentId })}>Delete</button>}</div></td></tr>)}
      </tbody></table>{visibleRows.length === 0 && <div className="student-empty">{loadingStudents ? 'Loading students…' : 'No students match the selected filters.'}</div>}</div>
      <div className="student-list-footer"><span>Showing <strong>{visibleRows.length}</strong> of <strong>{courseRows.length}</strong> matching students</span><span>Fee due date: <strong>{visibleRows[0]?.dueDate ? visibleRows[0].dueDate.slice(0, 10) : 'varies by semester'}</strong></span></div>
    </div>
    </>}

    {view === 'reminders' && <section className="panel reminder-history" aria-label="Prepared reminder messages"><div className="reminder-history-heading"><div><h2>Reminder messages</h2><p>Open a message to see its full text and recipient details.</p></div><span className="history-count">{hasReminderFilters ? `${visibleReminders.length} of ${reminderHistory.length} messages` : `${reminderHistory.length} ${reminderHistory.length === 1 ? 'message' : 'messages'}`}</span></div><div className="reminder-filters"><label className="reminder-search"><Icon name="search" size={17}/><input value={reminderQuery} onChange={event => setReminderQuery(event.target.value)} placeholder="Search name, phone, or registration no." aria-label="Search reminders by student name, phone, registration number, or date"/>{reminderQuery && <button type="button" onClick={() => setReminderQuery('')} aria-label="Clear reminder search">×</button>}</label><label className="reminder-filter"><span>Date</span><input type="date" value={reminderDate} onChange={event => setReminderDate(event.target.value)} aria-label="Filter reminders by date"/></label><label className="reminder-filter"><span>Course</span><select value={reminderCourse} onChange={event => setReminderCourse(event.target.value)}><option>All courses</option>{Array.from(new Set(reminderHistory.map(item => item.course))).sort().map(item => <option key={item}>{item}</option>)}</select></label><label className="reminder-filter"><span>Semester</span><select value={reminderSemester} onChange={event => setReminderSemester(event.target.value)}><option>All semesters</option>{Array.from(new Set(reminderHistory.map(item => item.semester))).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))).map(item => <option key={item}>{item}</option>)}</select></label>{hasReminderFilters && <button className="reminder-clear-filters" onClick={() => { setReminderQuery(''); setReminderDate(''); setReminderCourse('All courses'); setReminderSemester('All semesters') }}>Clear filters</button>}</div>
      {remindersQuery.isLoading ? <div className="history-empty"><div><strong>Loading reminders…</strong></div></div> : reminderHistory.length === 0 ? <div className="history-empty"><span className="history-empty-icon"><Icon name="bell" size={20}/></span><div><strong>No reminders yet</strong><p>Each sent reminder will appear here with its recipient and channel.</p></div></div> : visibleReminders.length === 0 ? <div className="history-empty"><span className="history-empty-icon"><Icon name="search" size={20}/></span><div><strong>No matching students</strong><p>Try another name, mobile number, or registration number.</p></div></div> : <div className="history-list">{visibleReminders.map(item => <article className={`history-message${expandedReminder === item.id ? ' is-expanded' : ''}`} key={item.id}><div className="history-row-bar"><button className="history-row" aria-expanded={expandedReminder === item.id} onClick={() => setExpandedReminder(current => current === item.id ? null : item.id)}><span className="history-avatar">{item.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="history-row-main"><span className="history-row-top"><strong>{item.name}</strong><span className="history-row-date">{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></span><span className="history-row-meta">To: {item.phone} · {item.registrationNo} · {item.course} · {item.semester}</span><span className="history-row-preview">{item.message}</span></span></button>{canManage && <button type="button" className="row-delete-button" onClick={() => setDeleteTarget({ kind: 'reminder', id: Number(item.id) })}>Delete</button>}</div>{expandedReminder === item.id && <div className="history-details"><dl><div><dt>Recipient</dt><dd>{item.name}</dd></div><div><dt>Mobile number</dt><dd>{item.phone}</dd></div><div><dt>Registration number</dt><dd>{item.registrationNo}</dd></div><div><dt>Course and semester</dt><dd>{item.course} · {item.semester}</dd></div><div><dt>Prepared</dt><dd>{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div></dl><div className="history-message-body"><span>FULL MESSAGE</span><p>{item.message}</p></div></div>}</article>)}</div>}
    </section>}

    {smsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSmsOpen(false) }}><section className="sms-modal" role="dialog" aria-modal="true" aria-labelledby="sms-title"><div className="sms-modal-icon"><Icon name="bell" size={23}/></div><button className="modal-close" aria-label="Close" onClick={() => setSmsOpen(false)}>×</button><h2 id="sms-title">Remind unpaid students</h2><p className="sms-count">{unpaidRows.length} students · {course === 'All courses' ? 'all courses' : course} · {semester === 'All semesters' ? 'all semesters' : semester}</p><div className="sms-preview"><span>MESSAGE PREVIEW</span><p>{reminderMessage}</p></div><p className="sms-prototype-note">Sending asks the API to deliver this message by SMS and WhatsApp. A channel is recorded only when its provider accepts it.</p><div className="sms-modal-actions"><button className="secondary-button" onClick={() => setSmsOpen(false)}>Cancel</button><button className="primary-button" onClick={() => void recordReminderBatch()} disabled={savingReminders}>{savingReminders ? 'Sending…' : 'Send reminders'}</button></div></section></div>}
    {cashStudent && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCashStudent(null) }}><section className="sms-modal cash-payment-modal" role="dialog" aria-modal="true" aria-labelledby="cash-payment-title"><div className="sms-modal-icon cash-modal-icon"><Icon name="wallet" size={23}/></div><button className="modal-close" aria-label="Close" onClick={() => setCashStudent(null)}>×</button><h2 id="cash-payment-title">Record payment</h2><p className="sms-count">{cashStudent.name} · {cashStudent.registrationNo} · {cashStudent.semester}</p><div className="cash-balance-note">Remaining balance: <strong>{currency.format(paymentMax)}</strong></div><div className="cash-payment-fields"><label><span>Account</span><select value={cashAccount} onChange={event => { const next = event.target.value as 'ACADEMIC' | 'HOSTEL'; setCashAccount(next); setCashAmount(String(next === 'HOSTEL' ? cashStudent.hostelOutstanding : cashStudent.balance)) }}><option value="ACADEMIC">Academic dues</option>{cashStudent.hostelAccountId > 0 && <option value="HOSTEL">Hostel dues</option>}</select></label><label><span>Amount received (INR)</span><input type="number" min="1" max={paymentMax} step="1" value={cashAmount} onChange={event => setCashAmount(event.target.value)} required/></label><label><span>Payment date</span><input type="date" value={cashDate} onChange={event => setCashDate(event.target.value)} required/></label><label><span>Payment method</span><select value={cashMethod} onChange={event => setCashMethod(event.target.value as 'CASH' | 'CHALLAN')}><option value="CASH">Cash</option><option value="CHALLAN">Challan</option></select></label>{cashMethod === 'CHALLAN' && <label><span>Challan reference</span><input value={cashReference} onChange={event => setCashReference(event.target.value)} required/></label>}</div><p className="cash-payment-note">{cashMethod === 'CHALLAN' ? 'Saving records the challan and verifies it, which updates the fee ledger.' : 'Saving this entry updates the student’s paid amount, balance, and fee status.'}</p><div className="sms-modal-actions"><button className="secondary-button" onClick={() => setCashStudent(null)}>Cancel</button><button className="primary-button" disabled={!Number(cashAmount) || Number(cashAmount) <= 0 || Number(cashAmount) > paymentMax || !cashDate || savingPayment || (cashMethod === 'CHALLAN' && !cashReference.trim())} onClick={() => void saveCashPayment()}>{savingPayment ? 'Saving…' : 'Save payment'}</button></div></section></div>}
    {editStudent && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditStudent(null) }}><section className="sms-modal" role="dialog" aria-modal="true" aria-labelledby="student-update-title"><button className="modal-close" aria-label="Close" onClick={() => setEditStudent(null)}>×</button><h2 id="student-update-title">Update student</h2><p className="sms-count">{editStudent.name} · {editStudent.registrationNo}</p><div className="cash-payment-fields"><label><span>Enrolment number</span><input value={enrolmentNumber} onChange={event => setEnrolmentNumber(event.target.value)} placeholder="Added after Year 1"/></label><label><span>Status</span><select value={studentStatus} onChange={event => setStudentStatus(event.target.value as 'ACTIVE' | 'LEFT' | 'COMPLETED')}><option value="ACTIVE">Active</option><option value="LEFT">Left</option><option value="COMPLETED">Completed</option></select></label><label className="admin-form-checkbox"><input type="checkbox" checked={hosteller} onChange={event => setHosteller(event.target.checked)}/><span>Hosteller</span></label></div><div className="sms-modal-actions"><button className="secondary-button" onClick={() => setEditStudent(null)}>Cancel</button><button className="primary-button" disabled={savingRecord} onClick={() => void saveStudentRecord()}>{savingRecord ? 'Saving…' : 'Save record'}</button></div></section></div>}
    {refundStudent && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRefundStudent(null) }}><section className="sms-modal" role="dialog" aria-modal="true" aria-labelledby="deposit-title"><button className="modal-close" aria-label="Close" onClick={() => setRefundStudent(null)}>×</button><h2 id="deposit-title">Caution or security deposit</h2><p className="sms-count">{refundStudent.name} · held {currency.format(refundStudent.depositHeld)}</p><div className="cash-payment-fields"><label><span>Amount (INR)</span><input type="number" min="1" max={refundStudent.depositHeld} value={refundAmount} onChange={event => setRefundAmount(event.target.value)}/></label><label><span>Reason</span><input value={refundReason} onChange={event => setRefundReason(event.target.value)} required/></label><label><span>Deduction amount (optional)</span><input type="number" min="0" value={deductionAmount} onChange={event => setDeductionAmount(event.target.value)}/></label><label><span>Deduction reason</span><input value={deductionReason} onChange={event => setDeductionReason(event.target.value)}/></label></div><div className="sms-modal-actions"><button className="secondary-button" onClick={() => setRefundStudent(null)}>Cancel</button><button className="secondary-button" disabled={savingRecord || !refundReason.trim() || !Number(refundAmount)} onClick={() => void saveRefund(true)}>Adjust to fees</button><button className="primary-button" disabled={savingRecord || !refundReason.trim() || !Number(refundAmount) || (Number(deductionAmount) > 0 && !deductionReason.trim())} onClick={() => void saveRefund(false)}>{savingRecord ? 'Saving…' : 'Refund'}</button></div></section></div>}
    {importBatch && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setImportBatch(null) }}><section className="sms-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><button className="modal-close" aria-label="Close" onClick={() => setImportBatch(null)}>×</button><h2 id="import-title">Excel preview</h2><p className="sms-count">{importBatch.fileName} · {importBatch.rows.filter(row => row.valid).length} valid · {importBatch.rows.filter(row => !row.valid).length} invalid</p><div className="sms-preview"><span>ROW CHECK</span>{importBatch.rows.map(row => <p key={row.rowNumber}>Row {row.rowNumber}: {row.valid ? 'valid' : (row.errors ?? []).map(error => error.message).join('; ')}</p>)}</div><div className="sms-modal-actions"><button className="secondary-button" onClick={() => setImportBatch(null)}>Close</button><button className="primary-button" disabled={savingRecord || importBatch.rows.some(row => !row.valid)} onClick={() => void commitUpload()}>{savingRecord ? 'Importing…' : 'Import valid file'}</button></div></section></div>}
    {receipt && <InvoiceTemplate receipt={receipt} onClose={() => setReceipt(null)}/>}
    {deleteTarget && <DeleteConfirmDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onNotice={onNotice}/>}
  </section>
}
