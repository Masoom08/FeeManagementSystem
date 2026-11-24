import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { DeleteConfirmDialog, type DeleteTarget } from '../components/DeleteConfirmDialog'
import { Icon } from '../components/ui/AppIcon'
import { api, type ApiFeeStructure } from '../api/client'
import { queryKeys, useAcademicYears, useCourses, useSemesters } from '../api/queries'
import { SEMESTER_TERMS, courseDurationYears, semesterNumbers, semestersBySession, semestersForYear, studyYearForSemester, termDisplayName, termForSemester } from '../features/academic/labels'
import './AdminManagementPage.css'

export type ManagementListSection = 'Courses' | 'Academic years' | 'Semesters'
export type ManagementFormSection = 'Add student' | 'Add course' | 'Add academic year' | 'Add semester' | 'Add fee structure'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function keepTenDigits(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget
  const digits = input.value.replace(/\D/g, '').slice(0, 10)
  if (digits !== input.value) input.value = digits
  input.setCustomValidity(digits.length === 0 || /^[1-9]\d{9}$/.test(digits) ? '' : 'Enter a 10-digit mobile number.')
}
const formTitle: Record<ManagementFormSection, string> = {
  'Add student': 'Add student', 'Add course': 'Add course', 'Add academic year': 'Add academic year',
  'Add semester': 'Add semester', 'Add fee structure': 'Add fee structure',
}

export function AdminManagementPage({ section, onCreate, onNotice }: {
  section: ManagementListSection
  onCreate: (section: ManagementFormSection) => void
  onNotice: (message: string) => void
}) {
  const coursesQuery = useCourses()
  const yearsQuery = useAcademicYears()
  const semestersQuery = useSemesters()
  const courses = coursesQuery.data ?? []
  const years = yearsQuery.data ?? []
  const semesters = semestersQuery.data ?? []
  const loading = coursesQuery.isLoading || yearsQuery.isLoading || semestersQuery.isLoading
  const error = coursesQuery.error || yearsQuery.error || semestersQuery.error

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const title = section
  const deleteKind: DeleteTarget['kind'] = section === 'Courses' ? 'course' : section === 'Academic years' ? 'academicYear' : 'semester'
  const formFor: Record<ManagementListSection, ManagementFormSection> = {
    Courses: 'Add course', 'Academic years': 'Add academic year', Semesters: 'Add semester',
  }

  return <section className="admin-management-page">
    <div className="admin-management-heading"><div><div className="eyebrow">SUPER ADMIN</div><h1>{title}</h1><p>Manage {title.toLowerCase()} used by the student and fee workflows.</p></div><button className="primary-button" onClick={() => onCreate(formFor[section])}><Icon name="plus" size={17}/> Add {section === 'Courses' ? 'course' : section === 'Academic years' ? 'academic year' : 'semester'}</button></div>
    {error && <div className="admin-form-error" role="alert">{error instanceof Error ? error.message : 'Could not load management data'}</div>}
    {loading ? <div className="panel admin-management-empty">Loading {title.toLowerCase()}…</div> : <div className="panel admin-management-table-wrap">
      {section === 'Courses' && <table className="admin-management-table"><thead><tr><th>CODE</th><th>COURSE</th><th>AFFILIATION</th><th>YEARS</th><th>SEMESTERS</th><th>LATE FEE / DAY</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{courses.map(course => <tr key={course.id}><td>{course.courseCode}</td><td>{course.courseName}</td><td>{course.affiliation}</td><td>{courseDurationYears(course)}</td><td>{courseDurationYears(course) * 2}</td><td>{currency.format(course.lateFeePerDay)}</td><td>{course.active ? 'Active' : 'Inactive'}</td><td><button type="button" className="row-delete-button" onClick={() => setDeleteTarget({ kind: deleteKind, id: course.id })}>Delete</button></td></tr>)}</tbody></table>}
      {section === 'Academic years' && <table className="admin-management-table"><thead><tr><th>LABEL</th><th>START DATE</th><th>END DATE</th><th>ACTION</th></tr></thead><tbody>{years.map(year => <tr key={year.id}><td>{year.label}</td><td>{year.startDate.slice(0, 10)}</td><td>{year.endDate.slice(0, 10)}</td><td><button type="button" className="row-delete-button" onClick={() => setDeleteTarget({ kind: deleteKind, id: year.id })}>Delete</button></td></tr>)}</tbody></table>}
      {section === 'Semesters' && <table className="admin-management-table"><thead><tr><th>TERM</th><th>DUE DATE</th><th>GRACE DAYS</th><th>ACTION</th></tr></thead>{semestersBySession(semesters, years).map(group => <tbody key={group.year.id}><tr className="semester-group"><th colSpan={4}>{group.year.label}</th></tr>{group.semesters.map(semester => <tr key={semester.id}><td>{termDisplayName(semester.name)}</td><td>{semester.dueDate.slice(0, 10)}</td><td>{semester.graceDays}</td><td><button type="button" className="row-delete-button" onClick={() => setDeleteTarget({ kind: deleteKind, id: semester.id })}>Delete</button></td></tr>)}</tbody>)}</table>}
      {((section === 'Courses' && courses.length === 0) || (section === 'Academic years' && years.length === 0) || (section === 'Semesters' && semesters.length === 0)) && <div className="admin-management-empty">No {title.toLowerCase()} found yet.</div>}
    </div>}
    {deleteTarget && <DeleteConfirmDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onNotice={onNotice}/>}
  </section>
}

export function AdminManagementModal({ section, onClose, onNotice }: {
  section: ManagementFormSection
  onClose: () => void
  onNotice: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const coursesQuery = useCourses()
  const yearsQuery = useAcademicYears()
  const semestersQuery = useSemesters()
  const courses = coursesQuery.data ?? []
  const years = yearsQuery.data ?? []
  const semesters = semestersQuery.data ?? []
  const loading = coursesQuery.isLoading || yearsQuery.isLoading || semestersQuery.isLoading
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [durationYears, setDurationYears] = useState('3')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedYearId, setSelectedYearId] = useState('')
  const [programSemester, setProgramSemester] = useState('')
  const selectedCourse = courses.find(course => course.id === Number(selectedCourseId))
  const courseDuration = selectedCourse ? courseDurationYears(selectedCourse) : 0
  const enteredDuration = Number(durationYears)
  const parsedDuration = Number.isInteger(enteredDuration) && enteredDuration >= 1 && enteredDuration <= 6 ? enteredDuration : 0
  const programSemesters = semesterNumbers(courseDuration)

  useEffect(() => {
    const loadError = coursesQuery.error || yearsQuery.error || semestersQuery.error
    if (loadError) setError(loadError instanceof Error ? loadError.message : 'Could not load required options')
  }, [coursesQuery.error, yearsQuery.error, semestersQuery.error])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, saving])

  const placementFor = (academicYearId: number, semesterNumber: number) => {
    const term = semestersForYear(semesters, academicYearId).find(item => item.name === termForSemester(semesterNumber))
    return term ? { semesterId: term.id, studyYear: studyYearForSemester(semesterNumber) } : null
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    setSaving(true); setError('')
    try {
      if (section === 'Add course') {
        await api.createCourse({ courseCode: value('courseCode'), courseName: value('courseName'), affiliation: value('affiliation') as 'AKTU' | 'LU', durationYears: Number(value('durationYears')), lateFeePerDay: Number(value('lateFeePerDay')) })
      } else if (section === 'Add academic year') {
        await api.createAcademicYear({ label: value('label'), startDate: value('startDate'), endDate: value('endDate') })
      } else if (section === 'Add semester') {
        const fineEndDate = value('fineEndDate')
        await api.createSemester({ academicYearId: Number(value('academicYearId')), name: value('name'), dueDate: value('dueDate'), graceDays: Number(value('graceDays')), ...(fineEndDate ? { fineEndDate } : {}) })
      } else if (section === 'Add fee structure' || section === 'Add student') {
        const placement = placementFor(Number(value('academicYearId')), Number(value('programSemester')))
        if (!placement) {
          setError('Add the semester due dates for this batch before saving.')
          return
        }
        if (section === 'Add fee structure') {
          await api.createFeeStructure({ courseId: Number(value('courseId')), academicYearId: Number(value('academicYearId')), semesterId: placement.semesterId, component: value('component') as ApiFeeStructure['component'], studyYear: placement.studyYear, amount: Number(value('amount')) })
        } else {
          const mobileNumber = /^[1-9]\d{9}$/
          if (!mobileNumber.test(value('phoneNumber')) || !mobileNumber.test(value('whatsappNumber'))) {
            setError('Phone number and WhatsApp number must each be a 10-digit number.')
            return
          }
          await api.createStudent({
            registrationNumber: value('registrationNumber'), name: value('name'), phoneNumber: value('phoneNumber'),
            whatsappNumber: value('whatsappNumber'), email: value('email'), fatherName: value('fatherName'), branch: value('branch'),
            courseId: Number(value('courseId')), academicYearId: Number(value('academicYearId')), semesterId: placement.semesterId,
            admissionType: value('admissionType') as 'DIRECT' | 'COUNSELLING', isHosteller: form.get('isHosteller') === 'on', studyYear: placement.studyYear,
          })
        }
      }
      const key = section === 'Add course' ? queryKeys.courses : section === 'Add academic year' ? queryKeys.academicYears : section === 'Add semester' ? queryKeys.semesters : section === 'Add fee structure' ? queryKeys.feeStructures : queryKeys.students
      await queryClient.invalidateQueries({ queryKey: key })
      if (section === 'Add student' || section === 'Add fee structure') await queryClient.invalidateQueries({ queryKey: queryKeys.reports })
      onNotice(`${formTitle[section].replace('Add ', '')} added.`)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this record')
    } finally {
      setSaving(false)
    }
  }

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
      <header className="admin-modal-header"><div><div className="eyebrow">SUPER ADMIN · SETUP</div><h2 id="admin-modal-title">{formTitle[section]}</h2></div><button type="button" className="admin-modal-close" aria-label="Close dialog" onClick={onClose} disabled={saving}>×</button></header>
      {error && <div className="admin-form-error" role="alert">{error}</div>}
      {loading ? <div className="admin-management-empty">Loading required options…</div> : <form className="admin-form" onSubmit={submit}>
        {section === 'Add course' && <>
          <label><span>Course code</span><input name="courseCode" maxLength={20} required placeholder="e.g. BBA-LU" /></label>
          <label><span>Course name</span><input name="courseName" maxLength={120} required placeholder="e.g. BBA (LU)" /></label>
          <label><span>Affiliation</span><select name="affiliation" required><option value="LU">Lucknow University (LU)</option><option value="AKTU">AKTU</option></select></label>
          <label><span>Duration (years)</span><input name="durationYears" type="number" min="1" max="6" step="1" value={durationYears} onChange={event => setDurationYears(event.target.value)} required /></label>
          <p className="admin-form-note">{parsedDuration ? `${parsedDuration * 2} semesters: Semester 1 through Semester ${parsedDuration * 2}.` : 'Enter a duration from 1 to 6 years.'}</p>
          <label><span>Late fee per day (INR)</span><input name="lateFeePerDay" type="number" min="1" step="1" defaultValue="5" required /></label>
        </>}
        {section === 'Add academic year' && <>
          <label><span>Academic year label</span><input name="label" maxLength={20} required placeholder="2027-28" /></label>
          <label><span>Start date</span><input name="startDate" type="date" required /></label>
          <label><span>End date</span><input name="endDate" type="date" required /></label>
        </>}
        {section === 'Add semester' && <>
          <label><span>Academic year</span><select name="academicYearId" required defaultValue=""><option value="" disabled>Select an academic year</option>{years.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
          <label><span>Semester group</span><select name="name" required defaultValue={SEMESTER_TERMS[0]}>{SEMESTER_TERMS.map(term => <option key={term} value={term}>{termDisplayName(term)}</option>)}</select></label>
          <label><span>Fee due date</span><input name="dueDate" type="date" required /></label>
          <label><span>Grace days</span><input name="graceDays" type="number" min="0" step="1" defaultValue="0" required /></label>
          <label><span>Fine end date (optional)</span><input name="fineEndDate" type="date" /></label>
        </>}
        {section === 'Add fee structure' && <>
          <label><span>Course</span><select name="courseId" required value={selectedCourseId} onChange={event => { setSelectedCourseId(event.target.value); setProgramSemester('') }}><option value="" disabled>Select a course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.courseName} ({course.courseCode}) · {courseDurationYears(course) * 2} semesters</option>)}</select></label>
          <label><span>Academic year</span><select name="academicYearId" required value={selectedYearId} onChange={event => setSelectedYearId(event.target.value)}><option value="" disabled>Select an academic year</option>{years.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
          <label><span>Semester</span><select name="programSemester" required value={programSemester} onChange={event => setProgramSemester(event.target.value)} disabled={!selectedCourse}><option value="" disabled>Select a semester</option>{programSemesters.map(number => <option key={number} value={number}>Semester {number}</option>)}</select></label>
          <label><span>Component</span><select name="component" required><option value="ACADEMIC_FEE">Academic fee</option><option value="ACADEMIC_CAUTION">Academic caution deposit</option><option value="HOSTEL_FEE">Hostel fee</option><option value="HOSTEL_SECURITY">Hostel security deposit</option></select></label>
          <label><span>Amount (INR)</span><input name="amount" type="number" min="1" step="1" required /></label>
        </>}
        {section === 'Add student' && <>
          <label><span>Registration number</span><input name="registrationNumber" maxLength={40} required /></label>
          <label><span>Student name</span><input name="name" maxLength={120} required /></label>
          <label><span>Phone number</span><input name="phoneNumber" type="text" inputMode="numeric" autoComplete="tel" minLength={10} maxLength={10} pattern="[1-9][0-9]{9}" title="Enter a 10-digit mobile number" placeholder="10-digit mobile number" onInput={keepTenDigits} required /></label>
          <label><span>WhatsApp number</span><input name="whatsappNumber" type="text" inputMode="numeric" autoComplete="tel" minLength={10} maxLength={10} pattern="[1-9][0-9]{9}" title="Enter a 10-digit mobile number" placeholder="10-digit mobile number" onInput={keepTenDigits} required /></label>
          <label><span>Email</span><input name="email" type="email" maxLength={120} required /></label>
          <label><span>Father / guardian name</span><input name="fatherName" maxLength={120} required /></label>
          <label><span>Branch</span><input name="branch" maxLength={80} required placeholder="e.g. Management" /></label>
          <label><span>Course</span><select name="courseId" required value={selectedCourseId} onChange={event => { setSelectedCourseId(event.target.value); setProgramSemester('') }}><option value="" disabled>Select a course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.courseName} · {courseDurationYears(course) * 2} semesters</option>)}</select></label>
          <label><span>Batch</span><select name="academicYearId" required value={selectedYearId} onChange={event => setSelectedYearId(event.target.value)}><option value="" disabled>Select a batch</option>{years.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
          <label><span>Semester</span><select name="programSemester" required value={programSemester} onChange={event => setProgramSemester(event.target.value)} disabled={!selectedCourse}><option value="" disabled>Select a semester</option>{programSemesters.map(number => <option key={number} value={number}>Semester {number}</option>)}</select></label>
          <label><span>Admission type</span><select name="admissionType"><option value="DIRECT">Direct</option><option value="COUNSELLING">Counselling</option></select></label>
          <label className="admin-form-checkbox"><input name="isHosteller" type="checkbox" /><span>Hosteller</span></label>
        </>}
        <div className="admin-form-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : `Save ${section.replace('Add ', '').toLowerCase()}`}</button></div>
      </form>}
    </section>
  </div>
}
