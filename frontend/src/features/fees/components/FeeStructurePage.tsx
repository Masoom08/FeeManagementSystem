import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { DeleteConfirmDialog, type DeleteTarget } from '../../../components/DeleteConfirmDialog'
import { Icon } from '../../../components/ui/AppIcon'
import { api, type ApiFeeStructure, type ApiHostelRate } from '../../../api/client'
import { queryKeys, useAcademicYears, useCourses, useFeeStructures, useHostelRates, useHostelSelections, useSemesters } from '../../../api/queries'
import { programSemesterLabel, programSemesterNumber, semesterNumbers, studyYearForSemester, termForSemester, termOrder, courseDurationYears, SEMESTER_TERMS, semestersForYear } from '../../academic/labels'
import './FeeStructurePage.css'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const componentLabel: Record<ApiFeeStructure['component'], string> = {
  ACADEMIC_FEE: 'Academic fee',
  ACADEMIC_CAUTION: 'Academic caution',
  HOSTEL_FEE: 'Hostel fee',
  HOSTEL_SECURITY: 'Hostel security',
}

export function FeeStructurePage({ onAddFeeStructure, canManage = false, onNotice }: { onAddFeeStructure?: () => void; canManage?: boolean; onNotice?: (message: string) => void }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'course' | 'hostel'>('course')
  const [selectedYearId, setSelectedYearId] = useState('')
  const [openBreakdown, setOpenBreakdown] = useState<string | null>(null)
  const [breakdownPosition, setBreakdownPosition] = useState({ top: 0, left: 0 })
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [editStructure, setEditStructure] = useState<ApiFeeStructure | null>(null)
  const [feeCourseId, setFeeCourseId] = useState('')
  const [feeYearId, setFeeYearId] = useState('')
  const [feeSemester, setFeeSemester] = useState('')
  const [feeComponent, setFeeComponent] = useState<ApiFeeStructure['component']>('ACADEMIC_FEE')
  const [feeAmount, setFeeAmount] = useState('')
  const [editRate, setEditRate] = useState<ApiHostelRate | null>(null)
  const [rateCondition, setRateCondition] = useState<'AC' | 'Non-AC'>('AC')
  const [rateOccupancy, setRateOccupancy] = useState('')
  const [rateFee, setRateFee] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const coursesQuery = useCourses()
  const yearsQuery = useAcademicYears()
  const semestersQuery = useSemesters()
  const structuresQuery = useFeeStructures()
  const hostelQuery = useHostelRates()
  const selectionsQuery = useHostelSelections()
  const courses = coursesQuery.data ?? []
  const years = yearsQuery.data ?? []
  const semesters = semestersQuery.data ?? []
  const structures = structuresQuery.data ?? []
  const hostelRates = hostelQuery.data ?? []
  const hostelSelections = selectionsQuery.data ?? []
  const loadError = coursesQuery.error || yearsQuery.error || semestersQuery.error || structuresQuery.error || hostelQuery.error || selectionsQuery.error
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
  const firstSemester = semesters.find(item => item.academicYearId === sessionId && item.name === SEMESTER_TERMS[0])
  const secondSemester = semesters.find(item => item.academicYearId === sessionId && item.name === SEMESTER_TERMS[1])
  const visibleStructures = selectedYearId ? structures.filter(item => item.academicYearId === sessionId) : []
  const academicStructures = visibleStructures.filter(item => item.component === 'ACADEMIC_FEE' || item.component === 'ACADEMIC_CAUTION')
  const amountFor = (courseId: number, studyYear: number, semesterId?: number) => academicStructures.filter(item => item.courseId === courseId && item.studyYear === studyYear && item.semesterId === semesterId).reduce((sum, item) => sum + item.amount, 0)
  const courseGroups = [
    { title: "Bachelor's degree", courses: courses.filter(item => !item.courseName.toLowerCase().includes('mba')) },
    { title: "Master's degree", courses: courses.filter(item => item.courseName.toLowerCase().includes('mba')) },
  ].map(group => {
    const rows = group.courses.flatMap(course => {
      const numbers = semesterNumbers(courseDurationYears(course)).filter(number => academicStructures.some(item => item.courseId === course.id && item.studyYear === studyYearForSemester(number) && termOrder(semesters.find(semester => semester.id === item.semesterId)?.name ?? '') === (number % 2 === 0 ? 1 : 0)))
      return numbers.length ? [{ course, numbers }] : []
    })
    const columnCount = Math.max(0, ...rows.flatMap(row => row.numbers))
    return { ...group, rows, columns: Array.from({ length: columnCount }, (_, index) => index + 1) }
  })
  const openFeeEditor = (row: ApiFeeStructure) => {
    setEditRate(null)
    setEditStructure(row)
    setFeeCourseId(String(row.courseId))
    setFeeYearId(String(row.academicYearId))
    setFeeSemester(String(programSemesterNumber(row.studyYear, semesters.find(item => item.id === row.semesterId)?.name ?? '')))
    setFeeComponent(row.component)
    setFeeAmount(String(row.amount))
    setEditError('')
  }
  const openHostelEditor = (rate: ApiHostelRate) => {
    setEditStructure(null)
    setEditRate(rate)
    setRateCondition(rate.condition === 'Non-AC' ? 'Non-AC' : 'AC')
    setRateOccupancy(rate.occupancy)
    setRateFee(String(rate.annualFee))
    setEditError('')
  }
  const saveFeeStructure = async () => {
    if (!editStructure) return
    const placement = semestersForYear(semesters, Number(feeYearId)).find(item => item.name === termForSemester(Number(feeSemester)))
    if (!placement) {
      setEditError('Add the semester due dates for this batch before saving.')
      return
    }
    const amount = Number(feeAmount)
    if (!Number.isInteger(amount) || amount < 1) {
      setEditError('Amount must be a positive whole number.')
      return
    }
    setSavingEdit(true)
    setEditError('')
    try {
      await api.updateFeeStructure(editStructure.id, {
        courseId: Number(feeCourseId),
        academicYearId: Number(feeYearId),
        semesterId: placement.id,
        component: feeComponent,
        studyYear: studyYearForSemester(Number(feeSemester)),
        amount,
      })
      setEditStructure(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.feeStructures })
      onNotice?.('Fee structure updated.')
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Could not update this fee structure.')
    } finally {
      setSavingEdit(false)
    }
  }
  const saveHostelRate = async () => {
    if (!editRate) return
    const annualFee = Number(rateFee)
    if (!rateOccupancy.trim()) {
      setEditError('Occupancy is required.')
      return
    }
    if (!Number.isInteger(annualFee) || annualFee < 1) {
      setEditError('Fee must be a positive whole number.')
      return
    }
    setSavingEdit(true)
    setEditError('')
    try {
      await api.updateHostelRate(editRate.id, { condition: rateCondition, occupancy: rateOccupancy.trim(), annualFee })
      setEditRate(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.hostelRates })
      onNotice?.('Hostel fee updated.')
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Could not update this hostel fee.')
    } finally {
      setSavingEdit(false)
    }
  }
  const configuredCharges = [...visibleStructures].sort((a, b) => {
    const courseOrder = (courses.find(course => course.id === a.courseId)?.courseName ?? '').localeCompare(courses.find(course => course.id === b.courseId)?.courseName ?? '')
    if (courseOrder) return courseOrder
    if (a.studyYear !== b.studyYear) return a.studyYear - b.studyYear
    const term = (id: number) => termOrder(semesters.find(item => item.id === id)?.name ?? '')
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
    <p className="fee-structure-intro">Fee charges for the selected session. Each course shows Semester 1 onward, based on its duration.</p>
    <div className="fee-course-tables">
      {courseGroups.map(group => <article className="panel fee-course-table-card" key={group.title}>
          <h2><Icon name="receipt" size={18}/> Fee structure for {group.title}</h2>
          {group.rows.length === 0 ? <p className="fee-structure-note">No charges in this session.</p> : <div className="fee-table-scroll"><table className="fee-structure-table fee-session-table">
            <thead><tr><th>Course</th>{group.columns.map(number => <th key={number}>{programSemesterLabel(number)}</th>)}</tr></thead>
            <tbody>{group.rows.map(({ course, numbers }) => {
              return <tr key={course.id}><th>{course.courseName}</th>{group.columns.map(number => {
                if (!numbers.includes(number)) return <td key={number}>—</td>
                const studyYear = studyYearForSemester(number)
                const semester = termForSemester(number) === SEMESTER_TERMS[1] ? secondSemester : firstSemester
                const breakdown = academicStructures.filter(row => row.courseId === course.id && row.studyYear === studyYear && row.semesterId === semester?.id).map(row => ({ label: row.component === 'ACADEMIC_FEE' ? 'Academic fee' : 'Academic caution', amount: row.amount }))
                const total = amountFor(course.id, studyYear, semester?.id)
                const key = `${course.id}-${number}`
                const isOpen = openBreakdown === key
                const label = programSemesterLabel(number)
                return <td key={number}><details className="fee-amount-details" open={isOpen}><summary aria-label={`${currency.format(total)} ${label} fee; view breakdown`} onClick={event => { event.preventDefault(); const current = event.currentTarget.getBoundingClientRect(); const popoverHeight = 190; const top = current.bottom + popoverHeight + 12 <= window.innerHeight ? current.bottom + 8 : Math.max(12, current.top - popoverHeight - 8); const popoverWidth = window.innerWidth <= 650 ? 256 : 281; const left = Math.max(12, Math.min(current.left, window.innerWidth - popoverWidth - 12)); setBreakdownPosition({ top, left }); setOpenBreakdown(value => value === key ? null : key) }}>{currency.format(total)}<span className="fee-chevron" aria-hidden="true"/></summary>{isOpen && createPortal(<div className="fee-breakdown-popover" style={{ top: breakdownPosition.top, left: breakdownPosition.left }} role="region" aria-label={`${label} fee breakdown`}><strong>{label}</strong>{breakdown.map(charge => <div key={charge.label}><span>{charge.label}</span><b>{currency.format(charge.amount)}</b></div>)}<div className="fee-breakdown-total"><span>Total</span><b>{currency.format(total)}</b></div></div>, document.body)}</details></td>
              })}</tr>
            })}</tbody>
          </table></div>}
        </article>)}
    </div>
    <p className="fee-structure-note">Amounts reflect the selected academic year and fee components configured in the fee management API.</p>
    {canManage && onNotice && <article className="panel fee-course-table-card">
      <h2><Icon name="receipt" size={18}/> Configured charges</h2>
      <div className="fee-table-scroll"><table className="fee-structure-table fee-record-table">
        <thead><tr><th>Course</th><th>Academic year</th><th>Semester</th><th>Component</th><th>Amount</th><th>Action</th></tr></thead>
        <tbody>{configuredCharges.map(row => <tr key={row.id}>
          <td>{courses.find(course => course.id === row.courseId)?.courseName ?? row.courseId}</td>
          <td>{years.find(year => year.id === row.academicYearId)?.label ?? row.academicYearId}</td>
          <td>{programSemesterLabel(programSemesterNumber(row.studyYear, semesters.find(semester => semester.id === row.semesterId)?.name ?? ''))}</td>
          <td>{componentLabel[row.component]}</td>
          <td>{currency.format(row.amount)}</td>
          <td className="fee-row-actions"><button type="button" className="row-edit-button" onClick={() => openFeeEditor(row)}>Edit</button><button type="button" className="row-delete-button" onClick={() => setDeleteTarget({ kind: 'feeStructure', id: row.id })}>Delete</button></td>
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
          <tbody>{hostelRates.filter(rate => rate.condition === condition).map(rate => <tr key={rate.id}><th>{rate.occupancy}</th><td>{currency.format(rate.annualFee)}</td>{canManage && onNotice && <td className="fee-row-actions"><button type="button" className="row-edit-button" onClick={() => openHostelEditor(rate)}>Edit</button><button type="button" className="row-delete-button" onClick={() => setDeleteTarget({ kind: 'hostelRate', id: rate.id })}>Delete</button></td>}</tr>)}</tbody>
        </table></div>
      </article>)}</div>
      <article className="hostel-seat-card">
        <h3>Seat selections</h3>
        <p>Students choose a room type in the student app. A later change does not alter hostel fees already billed.</p>
        {hostelSelections.length === 0 ? <p className="fee-structure-note">No hostel seats selected.</p> : <div className="fee-table-scroll"><table className="fee-structure-table hostel-seat-table"><thead><tr><th>Student</th><th>Registration</th><th>Course</th><th>Batch</th><th>Condition</th><th>Occupancy</th><th>Annual fee</th><th>Hostel fee</th></tr></thead>
          <tbody>{hostelSelections.map(row => <tr key={row.studentId}><td>{row.name}</td><td>{row.registrationNumber}</td><td>{row.course}</td><td>{row.batch}</td><td>{row.condition}</td><td>{row.occupancy}</td><td>{currency.format(row.annualFee)}</td><td>{row.billed ? 'Billed' : 'Not billed'}</td></tr>)}</tbody>
        </table></div>}
      </article>
      <p className="fee-structure-note hostel-fee-note">Hostel fees are listed per academic year.</p>
    </section>}
    {editStructure && <div className="fee-edit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !savingEdit) setEditStructure(null) }}><section className="fee-edit-modal" role="dialog" aria-modal="true" aria-labelledby="fee-edit-title"><header><div><div className="eyebrow">SUPER ADMIN</div><h2 id="fee-edit-title">Edit fee structure</h2></div><button type="button" className="fee-edit-close" aria-label="Close dialog" onClick={() => setEditStructure(null)} disabled={savingEdit}>×</button></header>{editError && <p className="fee-edit-error" role="alert">{editError}</p>}<div className="fee-edit-fields"><label><span>Course</span><select value={feeCourseId} onChange={event => { setFeeCourseId(event.target.value); setFeeSemester('') }}>{courses.map(course => <option key={course.id} value={course.id}>{course.courseName} ({course.courseCode}) · {courseDurationYears(course) * 2} semesters</option>)}</select></label><label><span>Academic year</span><select value={feeYearId} onChange={event => setFeeYearId(event.target.value)}>{years.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label><label><span>Semester</span><select value={feeSemester} onChange={event => setFeeSemester(event.target.value)}>{semesterNumbers(courseDurationYears(courses.find(course => course.id === Number(feeCourseId)) ?? {})).map(number => <option key={number} value={number}>Semester {number}</option>)}</select></label><label><span>Component</span><select value={feeComponent} onChange={event => setFeeComponent(event.target.value as ApiFeeStructure['component'])}><option value="ACADEMIC_FEE">Academic fee</option><option value="ACADEMIC_CAUTION">Academic caution deposit</option><option value="HOSTEL_FEE">Hostel fee</option><option value="HOSTEL_SECURITY">Hostel security deposit</option></select></label><label><span>Amount (INR)</span><input type="number" min="1" step="1" value={feeAmount} onChange={event => setFeeAmount(event.target.value)} required/></label></div><p className="fee-edit-note">This updates the rate used for later assessments. Amounts already billed stay as recorded.</p><div className="fee-edit-actions"><button type="button" className="secondary-button" onClick={() => setEditStructure(null)} disabled={savingEdit}>Cancel</button><button type="button" className="primary-button" disabled={savingEdit || !feeSemester || !feeAmount} onClick={() => void saveFeeStructure()}>{savingEdit ? 'Saving…' : 'Save fee structure'}</button></div></section></div>}
    {editRate && <div className="fee-edit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !savingEdit) setEditRate(null) }}><section className="fee-edit-modal" role="dialog" aria-modal="true" aria-labelledby="hostel-edit-title"><header><div><div className="eyebrow">SUPER ADMIN</div><h2 id="hostel-edit-title">Edit hostel fee</h2></div><button type="button" className="fee-edit-close" aria-label="Close dialog" onClick={() => setEditRate(null)} disabled={savingEdit}>×</button></header>{editError && <p className="fee-edit-error" role="alert">{editError}</p>}<div className="fee-edit-fields"><label><span>Condition</span><select value={rateCondition} onChange={event => setRateCondition(event.target.value as 'AC' | 'Non-AC')}><option value="AC">AC</option><option value="Non-AC">Non-AC</option></select></label><label><span>Occupancy</span><input value={rateOccupancy} maxLength={30} onChange={event => setRateOccupancy(event.target.value)} required/></label><label><span>Annual fee (INR)</span><input type="number" min="1" step="1" value={rateFee} onChange={event => setRateFee(event.target.value)} required/></label></div><p className="fee-edit-note">This updates the hostel rate. Fees already billed stay as recorded.</p><div className="fee-edit-actions"><button type="button" className="secondary-button" onClick={() => setEditRate(null)} disabled={savingEdit}>Cancel</button><button type="button" className="primary-button" disabled={savingEdit || !rateOccupancy.trim() || !rateFee} onClick={() => void saveHostelRate()}>{savingEdit ? 'Saving…' : 'Save hostel fee'}</button></div></section></div>}
    {deleteTarget && onNotice && <DeleteConfirmDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onNotice={onNotice}/>}
  </section>
}





