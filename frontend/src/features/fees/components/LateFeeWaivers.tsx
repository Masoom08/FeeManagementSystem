import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '../../../components/ui/AppIcon'
import { api } from '../../../api/client'
import { queryKeys, useAcademicYears, useCourses, useSemesters, useStudents } from '../../../api/queries'
import { toFeeRecord, type StudentFeeRecord } from '../../students/studentFees'
import './LateFeeWaivers.css'

type WaiverFilter = 'All unpaid' | 'Late fee pending' | 'Fee waived'
type WaiverRow = StudentFeeRecord
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function csvCell(value: string | number) {
  const safe = String(value).replace(/^[=+@-]/, "'$&")
  return `"${safe.replaceAll('"', '""')}"`
}

function downloadWaivedStudents(rows: WaiverRow[]) {
  const headers = ['Student name', 'Registration number', 'Phone', 'Course', 'Semester', 'Semester fee', 'Amount paid', 'Fee balance', 'Late fine waived', 'Waived date', 'Waived by', 'Semester fee status']
  const data = rows.map(student => [student.name, student.registrationNo, student.phone, student.course, student.semester, student.feeDue, student.amountPaid, student.balance, student.waivedAmount, student.waivedAt ? new Date(student.waivedAt).toLocaleDateString('en-IN') : '', student.waivedBy ?? '', student.status])
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

export function LateFeeWaivers({ canManage = false }: { canManage?: boolean }) {
  const queryClient = useQueryClient()
  const studentsQuery = useStudents()
  const yearsQuery = useAcademicYears()
  const semestersQuery = useSemesters()
  const courses = (useCourses().data ?? []).map(course => course.courseName)
  const [course, setCourse] = useState('All courses')
  const [filter, setFilter] = useState<WaiverFilter>('All unpaid')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<WaiverRow | null>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const records = useMemo(() => (studentsQuery.data ?? []).flatMap(student => {
    const record = toFeeRecord(student, yearsQuery.data ?? [], semestersQuery.data ?? [])
    return record.semesterFees.filter(fee => fee.lateFee > 0 || fee.waivedAmount > 0).map(fee => ({ ...record, ...fee }))
  }), [studentsQuery.data, yearsQuery.data, semestersQuery.data])
  const studentsWithFines = useMemo(() => records.filter(student =>
    (course === 'All courses' || student.course === course) &&
    `${student.name} ${student.registrationNo}`.toLowerCase().includes(query.toLowerCase()),
  ), [records, course, query])
  const pendingCount = studentsWithFines.filter(student => student.lateFee > 0).length
  const waivedStudents = studentsWithFines.filter(student => student.waivedAmount > 0)
  const visibleStudents = studentsWithFines.filter(student => {
    if (filter === 'Late fee pending') return student.lateFee > 0
    if (filter === 'Fee waived') return student.waivedAmount > 0
    return true
  })
  const pendingFineTotal = studentsWithFines.reduce((total, student) => total + student.lateFee, 0)

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.students }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports }),
  ])

  const runFines = async () => {
    setSaving(true)
    try {
      const result = await api.runFines(new Date().toISOString().slice(0, 10))
      await refresh()
      setNotice(`${result.posted.length} late-fee ${result.posted.length === 1 ? 'entry' : 'entries'} posted.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not calculate late fees.')
    } finally {
      setSaving(false)
    }
  }

  const waiveSelectedFine = async () => {
    if (!selected?.fineEntryId || selected.fineRemaining <= 0) return
    setSaving(true)
    try {
      await api.waiveFine(selected.fineEntryId, selected.fineRemaining, 'Approved waiver')
      await refresh()
      setNotice(`Late fine waived for ${selected.name}. Semester fee remains unpaid until it is paid.`)
      setSelected(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not waive this fine.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="waivers-page" aria-labelledby="waivers-title">
    <div className="waivers-page-heading">
      <div><div className="eyebrow">FEE SUPPORT</div><h1 id="waivers-title">Late fee waivers</h1><p>Review unpaid fines and waive them when approved. MBA is ₹15 per day and other courses are ₹5 per day.</p></div>
      <div className="waiver-heading-actions">{canManage && <button className="secondary-button" onClick={() => void runFines()} disabled={saving}>Calculate late fees</button>}<button className="waiver-download-button" onClick={() => downloadWaivedStudents(waivedStudents)} disabled={waivedStudents.length === 0}><Icon name="download" size={17}/> Download waived list <span>{waivedStudents.length}</span></button></div>
    </div>

    {notice && <div className="waiver-notice" role="status"><Icon name="check" size={18}/><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
    {(studentsQuery.error || yearsQuery.error) && <div className="waiver-notice" role="alert"><span>Could not load late fees from the API.</span></div>}

    <div className="waiver-summary-grid">
      <article className="waiver-summary"><span className="waiver-summary-icon waiver-pending-icon"><Icon name="clock" size={21}/></span><div><span>Late fines pending</span><strong>{pendingCount}</strong></div></article>
      <article className="waiver-summary"><span className="waiver-summary-icon waiver-total-icon"><Icon name="wallet" size={21}/></span><div><span>Pending fine amount</span><strong>{currency.format(pendingFineTotal)}</strong></div></article>
      <article className="waiver-summary"><span className="waiver-summary-icon waiver-done-icon"><Icon name="check" size={21}/></span><div><span>Fines waived</span><strong>{waivedStudents.length}</strong></div></article>
    </div>

    <section className="panel waiver-list-panel">
      <div className="waiver-list-heading"><div><h2>Students with late fines</h2><p>Waiving a fine does not clear the student's semester fee balance.</p></div><label className="waiver-course-filter"><span>Course</span><select value={course} onChange={event => setCourse(event.target.value)}><option>All courses</option>{courses.map(item => <option key={item}>{item}</option>)}</select></label></div>
      <div className="waiver-filter-tabs" role="tablist" aria-label="Filter fee waivers">{(['All unpaid', 'Late fee pending', 'Fee waived'] as WaiverFilter[]).map(tab => <button key={tab} className={filter === tab ? 'selected' : ''} role="tab" aria-selected={filter === tab} onClick={() => setFilter(tab)}>{tab}<span>{tab === 'All unpaid' ? studentsWithFines.length : tab === 'Late fee pending' ? pendingCount : waivedStudents.length}</span></button>)}</div>
      <label className="waiver-search"><Icon name="search" size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by student name or registration number"/></label>
      <div className="waiver-table-wrap"><table className="waiver-table"><thead><tr><th>REGISTRATION NO.</th><th>STUDENT</th><th>BATCH</th><th>COURSE</th><th>YEAR</th><th>PERIOD (YEARS)</th><th>SEMESTER</th><th>SEMESTER FEE</th><th>PAID</th><th>PAYMENT DATE</th><th>BALANCE</th><th>LATE FINE</th><th>FINE STATUS</th><th>ACTION</th></tr></thead><tbody>
        {visibleStudents.map(student => <tr key={`${student.registrationNo}-${student.semesterId}`}><td>{student.registrationNo}</td><td><div className="student-cell"><span><strong>{student.name}</strong><small>{student.phone}</small></span></div></td><td>{student.batch}</td><td>{student.course}</td><td>Year {student.studyYear}</td><td>{student.startDate.slice(-4)} - {student.endDate.slice(-4)}</td><td>{student.semester}</td><td className="amount-cell">{currency.format(student.feeDue)}</td><td>{currency.format(student.amountPaid)}</td><td>{student.paymentDate ? student.paymentDate.slice(0, 10) : '-'}</td><td className="amount-cell">{currency.format(student.balance)}</td><td className={student.lateFee === 0 ? 'waived-amount' : 'fine-amount'}>{currency.format(student.lateFee || student.waivedAmount)}</td><td>{student.lateFee === 0 ? <span className="fine-status fine-waived"><i/>Waived</span> : <span className="fine-status fine-pending"><i/>Pending</span>}</td><td>{student.lateFee === 0 ? <span className="waived-date">{student.waivedAt ? new Date(student.waivedAt).toLocaleDateString('en-IN') : '—'}{student.waivedBy ? ` · ${student.waivedBy}` : ''}</span> : canManage ? <button className="waive-button" onClick={() => setSelected(student)}>Waive fine</button> : 'Pending'}</td></tr>)}
      </tbody></table>{visibleStudents.length === 0 && <div className="waiver-empty">{studentsQuery.isLoading ? 'Loading late fees…' : 'No late fees match this filter. Calculate late fees to post fines from the due dates.'}</div>}</div>
      <div className="waiver-table-footer"><span>Showing <strong>{visibleStudents.length}</strong> students</span><span>Fines, waiver date, and administrator come from the fee ledger.</span></div>
    </section>

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }}><section className="waiver-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="waive-confirm-title"><div className="waiver-warning-icon"><Icon name="receipt" size={23}/></div><button className="modal-close" aria-label="Close" onClick={() => setSelected(null)}>×</button><h2 id="waive-confirm-title">Are you sure you want to waive this fine?</h2><p className="waiver-confirm-student">{selected.name} · {selected.course} · {selected.semester}</p><div className="waive-amount-row"><span>Late fine to waive</span><strong>{currency.format(selected.fineRemaining)}</strong></div><p className="waiver-impact-note">This removes only the late fine. The semester fee balance of <strong>{currency.format(Math.max(0, selected.balance - selected.lateFee))}</strong> will remain unpaid.</p><div className="waiver-modal-actions"><button className="secondary-button" onClick={() => setSelected(null)}>Cancel</button><button className="primary-button confirm-waive-button" disabled={saving} onClick={() => void waiveSelectedFine()}>{saving ? 'Saving…' : 'Yes, waive fine'}</button></div></section></div>}
  </section>
}
