import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../../components/ui/AppIcon'
import { api, type ApiPaymentHistoryRow } from '../../../api/client'
import './FeeHistoryPage.css'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const courseTabs = ['All courses', 'B.Com', 'BBA (LU)', 'BBA (AKTU)', 'MBA (AKTU)']

function ordinalYear(value: number) {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'
  return `${value}${suffix} year`
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

export function FeeHistoryPage() {
  const [rows, setRows] = useState<ApiPaymentHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [batch, setBatch] = useState('All batches')
  const [course, setCourse] = useState('All courses')
  const [studyYear, setStudyYear] = useState('All years')
  const [sessionFilter, setSessionFilter] = useState('All sessions')
  const [semesterGroup, setSemesterGroup] = useState('All semesters')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    api.paymentHistory().then(data => { if (active) setRows(data) }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load payment history.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const batches = useMemo(() => Array.from(new Set(rows.map(row => row.student.batch))).sort((a, b) => b.localeCompare(a)), [rows])
  const batchRows = rows.filter(row => batch === 'All batches' || row.student.batch === batch)
  const courseRows = batchRows.filter(row => matchesCourseTab(row.student.courseName, course))
  const studyYears = Array.from(new Set(courseRows.map(row => row.studyYear))).sort((a, b) => a - b)
  const studyYearRows = courseRows.filter(row => studyYear === 'All years' || row.studyYear === Number(studyYear))
  const sessions = Array.from(new Set(studyYearRows.map(row => row.semesterSession).filter((item): item is string => Boolean(item)))).sort((a, b) => b.localeCompare(a))
  const visibleRows = courseRows.filter(row =>
    (studyYear === 'All years' || row.studyYear === Number(studyYear)) &&
    (sessionFilter === 'All sessions' || row.semesterSession === sessionFilter) &&
    (semesterGroup === 'All semesters' || (() => {
      const number = Number(row.semester?.match(/semester\s+(\d+)/i)?.[1])
      return Number.isFinite(number) && (semesterGroup === 'Odd semesters' ? number % 2 === 1 : number % 2 === 0)
    })()) &&
    `${row.student.name} ${row.student.registrationNumber} ${row.receiptNo ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const total = visibleRows.reduce((sum, row) => sum + row.amount, 0)

  return <section className="fee-history-page" aria-labelledby="fee-history-title">
    <header className="fee-history-heading"><div><div className="eyebrow">PAYMENTS</div><h1 id="fee-history-title">Fee history</h1><p>Review payments by batch, session, course, study year, and semester group.</p></div></header>
    <div className="fee-history-summary">
      <article><span className="fee-history-icon"><Icon name="receipt" size={19}/></span><div><small>Payments shown</small><strong>{visibleRows.length}</strong></div></article>
      <article><span className="fee-history-icon fee-history-total-icon"><Icon name="wallet" size={19}/></span><div><small>Total collected</small><strong>{currency.format(total)}</strong></div></article>
    </div>
    <section className="panel fee-history-panel" aria-label="Payment history">
      <div className="fee-history-panel-heading"><div><h2>Student payment records</h2><p>Each row shows a payment allocated to a student's fee account.</p></div></div>
      <div className="fee-history-course-tabs" role="tablist" aria-label="Payment history course sections">{courseTabs.map(tab => <button key={tab} type="button" role="tab" aria-selected={course === tab} className={course === tab ? 'active' : ''} onClick={() => { setCourse(tab); setStudyYear('All years'); setSessionFilter('All sessions'); setSemesterGroup('All semesters') }}>{tab}</button>)}</div>
      <div className="fee-history-filters">
        <label><span>Batch</span><select value={batch} onChange={event => { setBatch(event.target.value); setStudyYear('All years'); setSessionFilter('All sessions'); setSemesterGroup('All semesters') }}><option>All batches</option>{batches.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>Study year</span><select value={studyYear} disabled={batch === 'All batches'} onChange={event => { setStudyYear(event.target.value); setSessionFilter('All sessions') }}><option>All years</option>{studyYears.map(item => <option key={item} value={item}>{ordinalYear(item)}</option>)}</select></label>
        <label><span>Session</span><select value={sessionFilter} disabled={batch === 'All batches'} onChange={event => setSessionFilter(event.target.value)}><option>All sessions</option>{sessions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>Semester group</span><select value={semesterGroup} disabled={batch === 'All batches'} onChange={event => setSemesterGroup(event.target.value)}><option>All semesters</option><option>Odd semesters</option><option>Even semesters</option></select></label>
        <label className="fee-history-search"><span>Search student or receipt</span><div><Icon name="search" size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, registration no., receipt"/></div></label>
      </div>
      {error && <div className="fee-history-empty" role="alert">Could not load payment history: {error}</div>}
      <div className="fee-history-table-wrap"><table className="fee-history-table"><thead><tr><th>Payment date</th><th>Student</th><th>Registration no.</th><th>Course</th><th>Batch</th><th>Session</th><th>Semester</th><th>Receipt</th><th>Method</th><th>Amount paid</th></tr></thead><tbody>
        {visibleRows.map((row, index) => <tr key={`${row.paymentId}-${row.student.id}-${row.bucket}-${row.semester}-${index}`}><td>{row.paidOn ? new Date(`${row.paidOn.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN') : '—'}</td><td><strong>{row.student.name}</strong></td><td>{row.student.registrationNumber}</td><td>{row.student.courseName}</td><td>{row.student.batch}</td><td>{row.semesterSession ?? '—'}</td><td>{row.semester ?? (row.product === 'HOSTEL' ? 'Hostel fee' : 'Fee payment')}</td><td>{row.receiptNo ?? '—'}</td><td>{row.method}</td><td className="fee-history-amount">{currency.format(row.amount)}</td></tr>)}
      </tbody></table></div>
      {!error && <div className="fee-history-empty">{loading ? 'Loading payment history…' : visibleRows.length ? `Showing ${visibleRows.length} payment records` : 'No payment records match these filters.'}</div>}
    </section>
  </section>
}
