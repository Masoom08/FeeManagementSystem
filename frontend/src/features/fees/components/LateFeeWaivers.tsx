import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../../components/ui/AppIcon'
import { studentFeeRecords } from '../../students/data/mockStudents'
import './LateFeeWaivers.css'

type WaiverFilter = 'All unpaid' | 'Late fee pending' | 'Fee waived'
type WaiverRecord = Record<string, string>
const waiverStorageKey = 'iccmrt-late-fee-waivers'
const courses = ['BBA (LU)', 'B.Com (Hons.)', 'MBA', 'BBA (AKTU)']
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function readWaivers(): WaiverRecord {
  try {
    return JSON.parse(localStorage.getItem(waiverStorageKey) ?? '{}') as WaiverRecord
  } catch {
    return {}
  }
}

function csvCell(value: string | number) {
  const safe = String(value).replace(/^[=+@-]/, "'$&")
  return `"${safe.replaceAll('"', '""')}"`
}

function downloadWaivedStudents(rows: typeof studentFeeRecords, waivers: WaiverRecord) {
  const headers = ['Student name', 'Registration number', 'Phone', 'Course', 'Semester', 'Semester fee', 'Amount paid', 'Fee balance', 'Late fine waived', 'Waived date', 'Semester fee status']
  const data = rows.map(student => [
    student.name,
    student.registrationNo,
    student.phone,
    student.course,
    student.semester,
    student.feeDue,
    student.amountPaid,
    Math.max(0, student.feeDue - student.amountPaid),
    student.lateFee,
    new Date(waivers[student.registrationNo]).toLocaleDateString('en-IN'),
    student.status,
  ])
  const csv = [headers, ...data].map(row => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ICCMRT-waived-students-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function LateFeeWaivers() {
  const [waivers, setWaivers] = useState<WaiverRecord>(readWaivers)
  const [course, setCourse] = useState('All courses')
  const [filter, setFilter] = useState<WaiverFilter>('All unpaid')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    localStorage.setItem(waiverStorageKey, JSON.stringify(waivers))
  }, [waivers])

  const studentsWithFines = useMemo(() => studentFeeRecords.filter(student =>
    student.status === 'Unpaid' && student.lateFee > 0 &&
    (course === 'All courses' || student.course === course) &&
    `${student.name} ${student.registrationNo}`.toLowerCase().includes(query.toLowerCase()),
  ), [course, query])

  const pendingCount = studentsWithFines.filter(student => !waivers[student.registrationNo]).length
  const waivedCount = studentsWithFines.filter(student => Boolean(waivers[student.registrationNo])).length
  const waivedStudents = studentsWithFines.filter(student => Boolean(waivers[student.registrationNo]))
  const visibleStudents = studentsWithFines.filter(student => {
    if (filter === 'Late fee pending') return !waivers[student.registrationNo]
    if (filter === 'Fee waived') return Boolean(waivers[student.registrationNo])
    return true
  })
  const selectedStudent = selectedId ? studentFeeRecords.find(student => student.registrationNo === selectedId) : undefined
  const pendingFineTotal = studentsWithFines.reduce((total, student) => total + (waivers[student.registrationNo] ? 0 : student.lateFee), 0)

  const waiveSelectedFine = () => {
    if (!selectedStudent) return
    setWaivers(current => ({ ...current, [selectedStudent.registrationNo]: new Date().toISOString() }))
    setNotice(`Late fine waived for ${selectedStudent.name}. Semester fee remains unpaid.`)
    setSelectedId(null)
  }

  return <section className="waivers-page" aria-labelledby="waivers-title">
    <div className="waivers-page-heading">
      <div><div className="eyebrow">FEE SUPPORT</div><h1 id="waivers-title">Late fee waivers</h1><p>Review unpaid students and waive late fines when approved.</p></div>
      <div className="waiver-heading-actions"><span className="waiver-prototype-tag">Admin action</span><button className="waiver-download-button" onClick={() => downloadWaivedStudents(waivedStudents, waivers)} disabled={waivedCount === 0}><Icon name="download" size={17}/> Download waived list <span>{waivedCount}</span></button></div>
    </div>

    {notice && <div className="waiver-notice" role="status"><Icon name="check" size={18}/><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}

    <div className="waiver-summary-grid">
      <article className="waiver-summary"><span className="waiver-summary-icon waiver-pending-icon"><Icon name="clock" size={21}/></span><div><span>Late fines pending</span><strong>{pendingCount}</strong></div></article>
      <article className="waiver-summary"><span className="waiver-summary-icon waiver-total-icon"><Icon name="wallet" size={21}/></span><div><span>Pending fine amount</span><strong>{currency.format(pendingFineTotal)}</strong></div></article>
      <article className="waiver-summary"><span className="waiver-summary-icon waiver-done-icon"><Icon name="check" size={21}/></span><div><span>Fines waived</span><strong>{waivedCount}</strong></div></article>
    </div>

    <section className="panel waiver-list-panel">
      <div className="waiver-list-heading"><div><h2>Unpaid students with late fines</h2><p>Waiving a fine does not clear the student's semester fee balance.</p></div><label className="waiver-course-filter"><span>Course</span><select value={course} onChange={event => setCourse(event.target.value)}><option>All courses</option>{courses.map(item => <option key={item}>{item}</option>)}</select></label></div>
      <div className="waiver-filter-tabs" role="tablist" aria-label="Filter fee waivers">{(['All unpaid', 'Late fee pending', 'Fee waived'] as WaiverFilter[]).map(tab => <button key={tab} className={filter === tab ? 'selected' : ''} role="tab" aria-selected={filter === tab} onClick={() => setFilter(tab)}>{tab}<span>{tab === 'All unpaid' ? studentsWithFines.length : tab === 'Late fee pending' ? pendingCount : waivedCount}</span></button>)}</div>
      <label className="waiver-search"><Icon name="search" size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by student name or registration number"/></label>
      <div className="waiver-table-wrap"><table className="waiver-table"><thead><tr><th>REGISTRATION NO.</th><th>STUDENT</th><th>BATCH</th><th>COURSE</th><th>YEAR</th><th>PERIOD (YEARS)</th><th>SEMESTER</th><th>SEMESTER FEE</th><th>PAID</th><th>PAYMENT DATE</th><th>BALANCE</th><th>LATE FINE</th><th>FINE STATUS</th><th>ACTION</th></tr></thead><tbody>
        {visibleStudents.map((student, index) => {
          const waivedAt = waivers[student.registrationNo]
          const balance = Math.max(0, student.feeDue - student.amountPaid)
          return <tr key={student.registrationNo}><td>{student.registrationNo}</td><td><div className="student-cell"><span><strong>{student.name}</strong><small>{student.phone}</small></span></div></td><td>{student.batch}</td><td>{student.course}</td><td>Year {student.studyYear}</td><td>{student.startDate.slice(-4)} - {student.endDate.slice(-4)}</td><td>{student.semester}</td><td className="amount-cell">{currency.format(student.feeDue)}</td><td>{currency.format(student.amountPaid)}</td><td>{student.paymentDate ?? '-'}</td><td className="amount-cell">{currency.format(balance)}</td><td className={waivedAt ? 'waived-amount' : 'fine-amount'}>{currency.format(student.lateFee)}</td><td>{waivedAt ? <span className="fine-status fine-waived"><i/>Waived</span> : <span className="fine-status fine-pending"><i/>Pending</span>}</td><td>{waivedAt ? <span className="waived-date">{new Date(waivedAt).toLocaleDateString('en-IN')}</span> : <button className="waive-button" onClick={() => setSelectedId(student.registrationNo)}>Waive fine</button>}</td></tr>
        })}
      </tbody></table>{visibleStudents.length === 0 && <div className="waiver-empty">No students found for this filter.</div>}</div>
      <div className="waiver-table-footer"><span>Showing <strong>{visibleStudents.length}</strong> students</span><span>Only unpaid students with a late fine appear here.</span></div>
    </section>

    {selectedStudent && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedId(null) }}><section className="waiver-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="waive-confirm-title"><div className="waiver-warning-icon"><Icon name="receipt" size={23}/></div><button className="modal-close" aria-label="Close" onClick={() => setSelectedId(null)}>×</button><h2 id="waive-confirm-title">Are you sure you want to waive this fine?</h2><p className="waiver-confirm-student">{selectedStudent.name} · {selectedStudent.course} · {selectedStudent.semester}</p><div className="waive-amount-row"><span>Late fine to waive</span><strong>{currency.format(selectedStudent.lateFee)}</strong></div><p className="waiver-impact-note">This removes only the late fine. The semester fee balance of <strong>{currency.format(Math.max(0, selectedStudent.feeDue - selectedStudent.amountPaid))}</strong> will remain unpaid.</p><div className="waiver-modal-actions"><button className="secondary-button" onClick={() => setSelectedId(null)}>Cancel</button><button className="primary-button confirm-waive-button" onClick={waiveSelectedFine}>Yes, waive fine</button></div></section></div>}
  </section>
}
