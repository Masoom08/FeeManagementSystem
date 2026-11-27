import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../components/ui/AppIcon'
import { api, type ApiSession, type ApiCourse, type ApiFeeStructure, type ApiHostelRate, type ApiSemester } from '../../../api/client'
import './FeeStructurePage.css'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function currentSessionId(sessions: ApiSession[]) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const ordered = [...sessions].sort((left, right) => left.startDate.localeCompare(right.startDate))

  return ordered.find(session => session.startDate.slice(0, 10) <= today && session.endDate.slice(0, 10) >= today)?.id
    ?? ordered.filter(session => session.startDate.slice(0, 10) <= today).at(-1)?.id
    ?? ordered[0]?.id
}

export function FeeStructurePage({ onAddFeeStructure, refreshKey = 0 }: { onAddFeeStructure?: () => void; onNotice?: (message: string) => void; refreshKey?: number }) {
  const [activeTab, setActiveTab] = useState<'course' | 'hostel'>('course')
  const [selectedYearId, setSelectedYearId] = useState('')
  const [openBreakdown, setOpenBreakdown] = useState<string | null>(null)
  const [breakdownPosition, setBreakdownPosition] = useState({ top: 0, left: 0 })
  const [courses, setCourses] = useState<ApiCourse[]>([])
  const [years, setYears] = useState<ApiSession[]>([])
  const [semesters, setSemesters] = useState<ApiSemester[]>([])
  const [structures, setStructures] = useState<ApiFeeStructure[]>([])
  const [hostelRates, setHostelRates] = useState<ApiHostelRate[]>([])
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([api.courses(), api.sessions(), api.semesters(), api.feeStructures(), api.hostelRates()])
      .then(([courseRows, yearRows, semesterRows, structureRows, hostelRateRows]) => {
        if (!active) return
        setCourses(courseRows); setYears(yearRows); setSemesters(semesterRows); setStructures(structureRows); setHostelRates(hostelRateRows)
        setSelectedYearId(current => yearRows.some(year => String(year.id) === current) ? current : String(currentSessionId(yearRows) ?? ''))
      })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load fee structure') })
    return () => { active = false }
  }, [refreshKey])
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.fee-amount-details, .fee-breakdown-popover')) setOpenBreakdown(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenBreakdown(null) }
    document.addEventListener('click', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('click', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) }
  }, [])
  const courseGroups = [
    { title: "Bachelor's degree", years: 3, courses: courses.filter(item => !item.courseName.toLowerCase().includes('mba')) },
    { title: "Master's degree", years: 2, courses: courses.filter(item => item.courseName.toLowerCase().includes('mba')) },
  ]
  const visibleStructures = selectedYearId ? structures.filter(item => item.sessionId === Number(selectedYearId)) : structures
  const academicStructures = visibleStructures.filter(item => item.component === 'ACADEMIC_FEE' || item.component === 'ACADEMIC_CAUTION')
  const amountFor = (courseId: number, studyYear: number, semesterId: number) => academicStructures.filter(item => item.courseId === courseId && item.studyYear === studyYear && item.semesterId === semesterId).reduce((sum, item) => sum + item.amount, 0)

  return <section className="fee-structure-page" aria-labelledby="fee-structure-title">
    <div className="eyebrow">ACADEMIC FEES</div>
    <div className="fee-structure-title-row"><h1 id="fee-structure-title">Fee structure</h1>{onAddFeeStructure && <button className="primary-button" onClick={onAddFeeStructure}>Add fee structure</button>}</div>
    <label className="fee-year-filter">Academic year <select aria-label="Academic year" value={selectedYearId} onChange={event => setSelectedYearId(event.target.value)}>{years.length === 0 && <option value="">No academic years configured</option>}{years.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
    {loadError && <p role="alert">Could not load live fee data: {loadError}. Check VITE_API_BASE_URL and the API server.</p>}
    <div className="fee-structure-tabs" role="tablist" aria-label="Fee structure type">
      <button role="tab" aria-selected={activeTab === 'course'} className={activeTab === 'course' ? 'active' : ''} onClick={() => setActiveTab('course')}>Fee Charge</button>
      <button role="tab" aria-selected={activeTab === 'hostel'} className={activeTab === 'hostel' ? 'active' : ''} onClick={() => setActiveTab('hostel')}>Hostel Fees</button>
    </div>
    {activeTab === 'course' && <>
    <p className="fee-structure-intro">Fee charges by course and semester. Select an amount to see what it includes.</p>
    <div className="fee-course-tables">
      {courseGroups.map(group => <article className="panel fee-course-table-card" key={group.title}>
          <h2><Icon name="receipt" size={18}/> Fee structure for {group.title}</h2>
          <div className="fee-table-scroll"><table className="fee-structure-table">
            <thead>
              <tr><th rowSpan={2}>Course / Fee Charge</th>{Array.from({ length: group.years }, (_, year) => <th key={year} colSpan={2}>{year + 1}{year === 0 ? 'st' : year === 1 ? 'nd' : year === 2 ? 'rd' : 'th'} year</th>)}</tr>
              <tr>{Array.from({ length: group.years * 2 }, (_, semester) => <th key={semester}>{semester + 1}{semester === 0 ? 'st' : semester === 1 ? 'nd' : semester === 2 ? 'rd' : 'th'} semester</th>)}</tr>
            </thead>
            <tbody>{group.courses.map(item => <tr key={item.id}><th>{item.courseName}</th>{Array.from({ length: group.years * 2 }, (_, semester) => {
              const semesterRow = semesters.find(candidate => candidate.name.toLowerCase().includes(String(semester + 1)) && (!selectedYearId || candidate.sessionId === Number(selectedYearId)))
              const breakdown = academicStructures.filter(row => row.courseId === item.id && row.studyYear === Math.floor(semester / 2) + 1 && row.semesterId === semesterRow?.id).map(row => ({ label: row.component === 'ACADEMIC_FEE' ? 'Academic fee' : 'Academic caution', amount: row.amount }))
              const total = amountFor(item.id, Math.floor(semester / 2) + 1, semesterRow?.id ?? -1)
              const key = `${item.id}-${semester}`
              const isOpen = openBreakdown === key
              return <td key={semester}><details className="fee-amount-details" open={isOpen}><summary aria-label={`${currency.format(total)} fee charge, semester ${semester + 1}; view breakdown`} onClick={event => { event.preventDefault(); const current = event.currentTarget.getBoundingClientRect(); const popoverHeight = 190; const top = current.bottom + popoverHeight + 12 <= window.innerHeight ? current.bottom + 8 : Math.max(12, current.top - popoverHeight - 8); const popoverWidth = window.innerWidth <= 650 ? 256 : 281; const left = Math.max(12, Math.min(current.left, window.innerWidth - popoverWidth - 12)); setBreakdownPosition({ top, left }); setOpenBreakdown(value => value === key ? null : key) }}>{currency.format(total)}<span className="fee-chevron" aria-hidden="true"/></summary>{isOpen && createPortal(<div className="fee-breakdown-popover" style={{ top: breakdownPosition.top, left: breakdownPosition.left }} role="region" aria-label={`Semester ${semester + 1} fee breakdown`}><strong>Semester {semester + 1} breakdown</strong>{breakdown.map(charge => <div key={charge.label}><span>{charge.label}</span><b>{currency.format(charge.amount)}</b></div>)}<div className="fee-breakdown-total"><span>Total</span><b>{currency.format(total)}</b></div></div>, document.body)}</details></td>
            })}</tr>)}</tbody>
          </table></div>
        </article>)}
    </div>
    <p className="fee-structure-note">Amounts reflect the selected academic year and fee components configured in the fee management API.</p>
    </>}
    {activeTab === 'hostel' && <section className="panel hostel-fee-panel" aria-labelledby="hostel-fees-title">
      <div className="hostel-fee-heading"><div><h2 id="hostel-fees-title">Hostel accommodation fees</h2><p>Annual rates by air conditioning and occupancy.</p></div><span className="sample-data-note">Annual rates</span></div>
      <div className="hostel-room-tables">{['AC', 'Non-AC'].map(condition => <article className="hostel-room-card" key={condition}>
        <h3>{condition === 'AC' ? 'AC Rooms' : 'Non-AC Rooms'}</h3>
        <div className="fee-table-scroll"><table className="fee-structure-table hostel-fee-table"><thead><tr><th>Occupancy</th><th>Fee</th></tr></thead>
          <tbody>{hostelRates.filter(rate => rate.condition === condition).map(rate => <tr key={rate.id}><th>{rate.occupancy}</th><td>{currency.format(rate.annualFee)}</td></tr>)}</tbody>
        </table></div>
      </article>)}</div>
      <p className="fee-structure-note hostel-fee-note">Hostel fees are listed per academic year.</p>
    </section>}
  </section>
}
