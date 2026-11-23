import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DeleteConfirmDialog, type DeleteTarget } from '../../../components/DeleteConfirmDialog'
import { Icon } from '../../../components/ui/AppIcon'
import { type ApiFeeStructure } from '../../../api/client'
import { useAcademicYears, useCourses, useFeeStructures, useHostelRates, useSemesters } from '../../../api/queries'
import './FeeStructurePage.css'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const componentLabel: Record<ApiFeeStructure['component'], string> = {
  ACADEMIC_FEE: 'Academic fee',
  ACADEMIC_CAUTION: 'Academic caution',
  HOSTEL_FEE: 'Hostel fee',
  HOSTEL_SECURITY: 'Hostel security',
}

export function FeeStructurePage({ onAddFeeStructure, canManage = false, onNotice }: { onAddFeeStructure?: () => void; canManage?: boolean; onNotice?: (message: string) => void }) {
  const [activeTab, setActiveTab] = useState<'course' | 'hostel'>('course')
  const [selectedYearId, setSelectedYearId] = useState('')
  const [openBreakdown, setOpenBreakdown] = useState<string | null>(null)
  const [breakdownPosition, setBreakdownPosition] = useState({ top: 0, left: 0 })
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const coursesQuery = useCourses()
  const yearsQuery = useAcademicYears()
  const semestersQuery = useSemesters()
  const structuresQuery = useFeeStructures()
  const hostelQuery = useHostelRates()
  const courses = coursesQuery.data ?? []
  const years = yearsQuery.data ?? []
  const semesters = semestersQuery.data ?? []
  const structures = structuresQuery.data ?? []
  const hostelRates = hostelQuery.data ?? []
  const loadError = coursesQuery.error || yearsQuery.error || semestersQuery.error || structuresQuery.error || hostelQuery.error
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.fee-amount-details, .fee-breakdown-popover')) setOpenBreakdown(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenBreakdown(null) }
    document.addEventListener('click', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('click', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) }
  }, [])
  const sessionYears = [...years].sort((a, b) => b.label.localeCompare(a.label))
  useEffect(() => {
    if (selectedYearId || years.length === 0) return
    const latest = [...years].sort((a, b) => b.label.localeCompare(a.label))[0]
    if (latest) setSelectedYearId(String(latest.id))
  }, [selectedYearId, years])
  const sessionId = Number(selectedYearId)
  const oddSemester = semesters.find(item => item.academicYearId === sessionId && item.name === 'Odd')
  const evenSemester = semesters.find(item => item.academicYearId === sessionId && item.name === 'Even')
  const visibleStructures = selectedYearId ? structures.filter(item => item.academicYearId === sessionId) : []
  const academicStructures = visibleStructures.filter(item => item.component === 'ACADEMIC_FEE' || item.component === 'ACADEMIC_CAUTION')
  const amountFor = (courseId: number, studyYear: number, semesterId?: number) => academicStructures.filter(item => item.courseId === courseId && item.studyYear === studyYear && item.semesterId === semesterId).reduce((sum, item) => sum + item.amount, 0)
  const courseGroups = [
    { title: "Bachelor's degree", courses: courses.filter(item => !item.courseName.toLowerCase().includes('mba')) },
    { title: "Master's degree", courses: courses.filter(item => item.courseName.toLowerCase().includes('mba')) },
  ].map(group => ({
    ...group,
    rows: group.courses.flatMap(course => [...new Set(academicStructures.filter(item => item.courseId === course.id).map(item => item.studyYear))].sort((a, b) => a - b).map(studyYear => ({ course, studyYear }))),
  }))
  const configuredCharges = [...visibleStructures].sort((a, b) => {
    const courseOrder = (courses.find(course => course.id === a.courseId)?.courseName ?? '').localeCompare(courses.find(course => course.id === b.courseId)?.courseName ?? '')
    if (courseOrder) return courseOrder
    if (a.studyYear !== b.studyYear) return a.studyYear - b.studyYear
    const term = (id: number) => semesters.find(item => item.id === id)?.name === 'Odd' ? 0 : 1
    return term(a.semesterId) - term(b.semesterId)
  })

  return <section className="fee-structure-page" aria-labelledby="fee-structure-title">
    <div className="eyebrow">ACADEMIC FEES</div>
    <div className="fee-structure-title-row"><h1 id="fee-structure-title">Fee structure</h1>{onAddFeeStructure && <button className="primary-button" onClick={onAddFeeStructure}>Add fee structure</button>}</div>
    <label className="fee-year-filter">Academic year <select aria-label="Academic year" value={selectedYearId} onChange={event => setSelectedYearId(event.target.value)}>{sessionYears.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
    {loadError && <p role="alert">Could not load live fee data: {loadError instanceof Error ? loadError.message : 'Could not load fee structure'}. Check VITE_API_BASE_URL and the API server.</p>}
    <div className="fee-structure-tabs" role="tablist" aria-label="Fee structure type">
      <button role="tab" aria-selected={activeTab === 'course'} className={activeTab === 'course' ? 'active' : ''} onClick={() => setActiveTab('course')}>Fee Charge</button>
      <button role="tab" aria-selected={activeTab === 'hostel'} className={activeTab === 'hostel' ? 'active' : ''} onClick={() => setActiveTab('hostel')}>Hostel Fees</button>
    </div>
    {activeTab === 'course' && <>
    <p className="fee-structure-intro">Fee charges for the selected session. Each course is listed once per study year, with the Odd and Even term amounts.</p>
    <div className="fee-course-tables">
      {courseGroups.map(group => <article className="panel fee-course-table-card" key={group.title}>
          <h2><Icon name="receipt" size={18}/> Fee structure for {group.title}</h2>
          {group.rows.length === 0 ? <p className="fee-structure-note">No charges in this session.</p> : <div className="fee-table-scroll"><table className="fee-structure-table fee-session-table">
            <thead><tr><th>Course</th><th>Study year</th><th>Odd</th><th>Even</th></tr></thead>
            <tbody>{group.rows.map(({ course, studyYear }) => {
              const cells = [{ term: 'Odd', semester: oddSemester }, { term: 'Even', semester: evenSemester }]
              return <tr key={`${course.id}-${studyYear}`}><th>{course.courseName}</th><td>Year {studyYear}</td>{cells.map(cell => {
                const breakdown = academicStructures.filter(row => row.courseId === course.id && row.studyYear === studyYear && row.semesterId === cell.semester?.id).map(row => ({ label: row.component === 'ACADEMIC_FEE' ? 'Academic fee' : 'Academic caution', amount: row.amount }))
                const total = amountFor(course.id, studyYear, cell.semester?.id)
                const key = `${course.id}-${studyYear}-${cell.term}`
                const isOpen = openBreakdown === key
                return <td key={cell.term}><details className="fee-amount-details" open={isOpen}><summary aria-label={`${currency.format(total)} ${cell.term} fee, year ${studyYear}; view breakdown`} onClick={event => { event.preventDefault(); const current = event.currentTarget.getBoundingClientRect(); const popoverHeight = 190; const top = current.bottom + popoverHeight + 12 <= window.innerHeight ? current.bottom + 8 : Math.max(12, current.top - popoverHeight - 8); const popoverWidth = window.innerWidth <= 650 ? 256 : 281; const left = Math.max(12, Math.min(current.left, window.innerWidth - popoverWidth - 12)); setBreakdownPosition({ top, left }); setOpenBreakdown(value => value === key ? null : key) }}>{currency.format(total)}<span className="fee-chevron" aria-hidden="true"/></summary>{isOpen && createPortal(<div className="fee-breakdown-popover" style={{ top: breakdownPosition.top, left: breakdownPosition.left }} role="region" aria-label={`${cell.term} fee breakdown`}><strong>Year {studyYear} · {cell.term}</strong>{breakdown.map(charge => <div key={charge.label}><span>{charge.label}</span><b>{currency.format(charge.amount)}</b></div>)}<div className="fee-breakdown-total"><span>Total</span><b>{currency.format(total)}</b></div></div>, document.body)}</details></td>
              })}</tr>
            })}</tbody>
          </table></div>}
        </article>)}
    </div>
    <p className="fee-structure-note">Amounts reflect the selected academic year and fee components configured in the fee management API.</p>
    {canManage && onNotice && <article className="panel fee-course-table-card">
      <h2><Icon name="receipt" size={18}/> Configured charges</h2>
      <div className="fee-table-scroll"><table className="fee-structure-table fee-record-table">
        <thead><tr><th>Course</th><th>Academic year</th><th>Semester</th><th>Component</th><th>Study year</th><th>Amount</th><th>Action</th></tr></thead>
        <tbody>{configuredCharges.map(row => <tr key={row.id}>
          <td>{courses.find(course => course.id === row.courseId)?.courseName ?? row.courseId}</td>
          <td>{years.find(year => year.id === row.academicYearId)?.label ?? row.academicYearId}</td>
          <td>{semesters.find(semester => semester.id === row.semesterId)?.name ?? row.semesterId}</td>
          <td>{componentLabel[row.component]}</td>
          <td>Year {row.studyYear}</td>
          <td>{currency.format(row.amount)}</td>
          <td><button type="button" className="row-delete-button" onClick={() => setDeleteTarget({ kind: 'feeStructure', id: row.id })}>Delete</button></td>
        </tr>)}</tbody>
      </table></div>
      {visibleStructures.length === 0 && <div className="fee-structure-note">No fee structures for this selection.</div>}
    </article>}
    </>}
    {activeTab === 'hostel' && <section className="panel hostel-fee-panel" aria-labelledby="hostel-fees-title">
      <div className="hostel-fee-heading"><div><h2 id="hostel-fees-title">Hostel accommodation fees</h2><p>Annual rates by air conditioning and occupancy.</p></div><span className="sample-data-note">Annual rates</span></div>
      <div className="hostel-room-tables">{['AC', 'Non-AC'].map(condition => <article className="hostel-room-card" key={condition}>
        <h3>{condition === 'AC' ? 'AC Rooms' : 'Non-AC Rooms'}</h3>
        <div className="fee-table-scroll"><table className="fee-structure-table hostel-fee-table"><thead><tr><th>Occupancy</th><th>Fee</th>{canManage && <th>Action</th>}</tr></thead>
          <tbody>{hostelRates.filter(rate => rate.condition === condition).map(rate => <tr key={rate.id}><th>{rate.occupancy}</th><td>{currency.format(rate.annualFee)}</td>{canManage && onNotice && <td><button type="button" className="row-delete-button" onClick={() => setDeleteTarget({ kind: 'hostelRate', id: rate.id })}>Delete</button></td>}</tr>)}</tbody>
        </table></div>
      </article>)}</div>
      <p className="fee-structure-note hostel-fee-note">Hostel fees are listed per academic year.</p>
    </section>}
    {deleteTarget && onNotice && <DeleteConfirmDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onNotice={onNotice}/>}
  </section>
}





