import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/ui/AppIcon'
import { api, type ApiAcademicYear, type ApiCourse, type ApiFeeStructure, type ApiSemester } from '../api/client'
import './AdminManagementPage.css'

export type ManagementListSection = 'Courses' | 'Academic years' | 'Semesters'
export type ManagementFormSection = 'Add student' | 'Add course' | 'Add academic year' | 'Add semester' | 'Add fee structure'
type EditableRecord = { kind: 'course'; row: ApiCourse } | { kind: 'year'; row: ApiAcademicYear } | { kind: 'semester'; row: ApiSemester }

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const formTitle: Record<ManagementFormSection, string> = {
  'Add student': 'Add student', 'Add course': 'Add course', 'Add academic year': 'Add academic year',
  'Add semester': 'Add semester', 'Add fee structure': 'Add fee structure',
}

export function AdminManagementPage({ section, onCreate, onNotice, refreshKey }: {
  section: ManagementListSection
  onCreate: (section: ManagementFormSection) => void
  onNotice: (message: string) => void
  refreshKey: number
}) {
  const [courses, setCourses] = useState<ApiCourse[]>([])
  const [years, setYears] = useState<ApiAcademicYear[]>([])
  const [semesters, setSemesters] = useState<ApiSemester[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<EditableRecord | null>(null)

  const refresh = useCallback(async () => {
    const [courseRows, yearRows, semesterRows] = await Promise.all([api.courses(), api.academicYears(), api.semesters()])
    setCourses(courseRows); setYears(yearRows); setSemesters(semesterRows)
  }, [])

  useEffect(() => {
    let active = true
    refresh().catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load management data') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refresh, refreshKey])

  const title = section
  const formFor: Record<ManagementListSection, ManagementFormSection> = {
    Courses: 'Add course', 'Academic years': 'Add academic year', Semesters: 'Add semester',
  }

  const removeRecord = async (record: EditableRecord) => {
    const label = record.kind === 'course' ? record.row.courseName : record.kind === 'year' ? record.row.label : record.row.name
    const action = record.kind === 'course' ? (record.row.active ? 'Delete' : 'Reactivate') : 'Delete'
    if (!window.confirm(`${action} ${label}?${record.kind === 'course' && record.row.active ? ' A course with linked students or fee structures will be deactivated to preserve history.' : ''}`)) return
    try {
      let outcome = 'deleted'
      if (record.kind === 'course') {
        if (record.row.active) {
          await api.deleteCourse(record.row.id)
          outcome = 'deleted'
        } else {
          await api.updateCourse(record.row.id, { active: true })
          outcome = 'reactivated'
        }
      } else if (record.kind === 'year') await api.deleteAcademicYear(record.row.id)
      else await api.deleteSemester(record.row.id)
      await refresh()
      onNotice(`${label} ${outcome}.`)
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : `Could not ${action.toLowerCase()} this record.`)
    }
  }

  return <section className="admin-management-page">
    <div className="admin-management-heading"><div><div className="eyebrow">SUPER ADMIN</div><h1>{title}</h1><p>Manage {title.toLowerCase()} used by the student and fee workflows.</p></div><button className="primary-button" onClick={() => onCreate(formFor[section])}><Icon name="plus" size={17}/> Add {section === 'Courses' ? 'course' : section === 'Academic years' ? 'academic year' : 'semester'}</button></div>
    {error && <div className="admin-form-error" role="alert">{error}</div>}
    {loading ? <div className="panel admin-management-empty">Loading {title.toLowerCase()}…</div> : <div className="panel admin-management-table-wrap">
      {section === 'Courses' && <table className="admin-management-table"><thead><tr><th>CODE</th><th>COURSE</th><th>AFFILIATION</th><th>LATE FEE / DAY</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{courses.map(course => <tr key={course.id}><td>{course.courseCode}</td><td>{course.courseName}</td><td>{course.affiliation}</td><td>{currency.format(course.lateFeePerDay)}</td><td>{course.active ? 'Active' : 'Inactive'}</td><td><div className="management-row-actions"><button onClick={() => setEditing({ kind: 'course', row: course })}>Edit</button><button className="danger" onClick={() => void removeRecord({ kind: 'course', row: course })}>{course.active ? 'Delete' : 'Reactivate'}</button></div></td></tr>)}</tbody></table>}
      {section === 'Academic years' && <table className="admin-management-table"><thead><tr><th>LABEL</th><th>START DATE</th><th>END DATE</th><th>ACTIONS</th></tr></thead><tbody>{years.map(year => <tr key={year.id}><td>{year.label}</td><td>{year.startDate.slice(0, 10)}</td><td>{year.endDate.slice(0, 10)}</td><td><div className="management-row-actions"><button onClick={() => setEditing({ kind: 'year', row: year })}>Edit</button><button className="danger" onClick={() => void removeRecord({ kind: 'year', row: year })}>Delete</button></div></td></tr>)}</tbody></table>}
      {section === 'Semesters' && <table className="admin-management-table"><thead><tr><th>ACADEMIC YEAR</th><th>SEMESTER</th><th>DUE DATE</th><th>GRACE DAYS</th><th>ACTIONS</th></tr></thead><tbody>{semesters.map(semester => <tr key={semester.id}><td>{years.find(year => year.id === semester.academicYearId)?.label ?? semester.academicYearId}</td><td>{semester.name}</td><td>{semester.dueDate.slice(0, 10)}</td><td>{semester.graceDays}</td><td><div className="management-row-actions"><button onClick={() => setEditing({ kind: 'semester', row: semester })}>Edit</button><button className="danger" onClick={() => void removeRecord({ kind: 'semester', row: semester })}>Delete</button></div></td></tr>)}</tbody></table>}
      {((section === 'Courses' && courses.length === 0) || (section === 'Academic years' && years.length === 0) || (section === 'Semesters' && semesters.length === 0)) && <div className="admin-management-empty">No {title.toLowerCase()} found yet.</div>}
    </div>}
    {editing && <AdminRecordEditModal record={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh() }} onNotice={onNotice}/>}
  </section>
}

function AdminRecordEditModal({ record, onClose, onSaved, onNotice }: { record: EditableRecord; onClose: () => void; onSaved: () => void; onNotice: (message: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (key: string) => String(form.get(key) ?? '').trim()
    setSaving(true); setError('')
    try {
      if (record.kind === 'course') await api.updateCourse(record.row.id, { courseCode: value('courseCode'), courseName: value('courseName'), affiliation: value('affiliation') as 'AKTU' | 'LU', lateFeePerDay: Number(value('lateFeePerDay')) })
      else if (record.kind === 'year') await api.updateAcademicYear(record.row.id, { label: value('label'), startDate: value('startDate'), endDate: value('endDate') })
      else await api.updateSemester(record.row.id, { name: value('name'), dueDate: value('dueDate'), graceDays: Number(value('graceDays')), fineEndDate: value('fineEndDate') || null })
      onNotice('Changes saved.')
      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update this record.')
    } finally { setSaving(false) }
  }
  const title = record.kind === 'course' ? 'Edit course' : record.kind === 'year' ? 'Edit batch / academic year' : 'Edit semester'
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-management-title"><header className="admin-modal-header"><div><div className="eyebrow">SUPER ADMIN · EDIT</div><h2 id="edit-management-title">{title}</h2></div><button type="button" className="admin-modal-close" aria-label="Close dialog" disabled={saving} onClick={onClose}>×</button></header>{error && <div className="admin-form-error" role="alert">{error}</div>}<form className="admin-form" onSubmit={submit}>
    {record.kind === 'course' && <><label><span>Course code</span><input name="courseCode" defaultValue={record.row.courseCode} maxLength={20} required/></label><label><span>Course name</span><input name="courseName" defaultValue={record.row.courseName} maxLength={120} required/></label><label><span>Affiliation</span><select name="affiliation" defaultValue={record.row.affiliation} required><option value="LU">Lucknow University (LU)</option><option value="AKTU">AKTU</option></select></label><label><span>Late fee per day (INR)</span><input name="lateFeePerDay" type="number" min="1" defaultValue={record.row.lateFeePerDay} required/></label></>}
    {record.kind === 'year' && <><label><span>Academic year label</span><input name="label" defaultValue={record.row.label} maxLength={20} required/></label><label><span>Start date</span><input name="startDate" type="date" defaultValue={record.row.startDate.slice(0, 10)} required/></label><label><span>End date</span><input name="endDate" type="date" defaultValue={record.row.endDate.slice(0, 10)} required/></label></>}
    {record.kind === 'semester' && <><label><span>Academic year</span><input value={record.row.academicYearId} readOnly/></label><label><span>Semester name</span><input name="name" defaultValue={record.row.name} maxLength={40} required/></label><label><span>Fee due date</span><input name="dueDate" type="date" defaultValue={record.row.dueDate.slice(0, 10)} required/></label><label><span>Grace days</span><input name="graceDays" type="number" min="0" defaultValue={record.row.graceDays} required/></label><label><span>Fine end date (optional)</span><input name="fineEndDate" type="date" defaultValue={record.row.fineEndDate?.slice(0, 10) ?? ''}/></label></>}
    <div className="admin-form-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form></section></div>
}

export function AdminManagementModal({ section, onClose, onSaved, onNotice }: {
  section: ManagementFormSection
  onClose: () => void
  onSaved: () => void
  onNotice: (message: string) => void
}) {
  const [courses, setCourses] = useState<ApiCourse[]>([])
  const [years, setYears] = useState<ApiAcademicYear[]>([])
  const [semesters, setSemesters] = useState<ApiSemester[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([api.courses(), api.academicYears(), api.semesters()])
      .then(([courseRows, yearRows, semesterRows]) => {
        if (!active) return
        setCourses(courseRows); setYears(yearRows); setSemesters(semesterRows)
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load required options') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, saving])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    setSaving(true); setError('')
    try {
      if (section === 'Add course') {
        await api.createCourse({ courseCode: value('courseCode'), courseName: value('courseName'), affiliation: value('affiliation') as 'AKTU' | 'LU', lateFeePerDay: Number(value('lateFeePerDay')) })
      } else if (section === 'Add academic year') {
        await api.createAcademicYear({ label: value('label'), startDate: value('startDate'), endDate: value('endDate') })
      } else if (section === 'Add semester') {
        const fineEndDate = value('fineEndDate')
        await api.createSemester({ academicYearId: Number(value('academicYearId')), name: value('name'), dueDate: value('dueDate'), graceDays: Number(value('graceDays')), ...(fineEndDate ? { fineEndDate } : {}) })
      } else if (section === 'Add fee structure') {
        await api.createFeeStructure({ courseId: Number(value('courseId')), academicYearId: Number(value('academicYearId')), semesterId: Number(value('semesterId')), component: value('component') as ApiFeeStructure['component'], studyYear: Number(value('studyYear')), amount: Number(value('amount')) })
      } else {
        await api.createStudent({
          registrationNumber: value('registrationNumber'), name: value('name'), phoneNumber: value('phoneNumber'),
          whatsappNumber: value('whatsappNumber'), email: value('email'), fatherName: value('fatherName'), branch: value('branch'),
          courseId: Number(value('courseId')), academicYearId: Number(value('academicYearId')), semesterId: Number(value('semesterId')),
          admissionType: value('admissionType') as 'DIRECT' | 'COUNSELLING', isHosteller: form.get('isHosteller') === 'on', studyYear: Number(value('studyYear')),
        })
      }
      onNotice(`${formTitle[section].replace('Add ', '')} added.`)
      onSaved()
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
          <label><span>Late fee per day (INR)</span><input name="lateFeePerDay" type="number" min="1" step="1" defaultValue="10" required /></label>
        </>}
        {section === 'Add academic year' && <>
          <label><span>Academic year label</span><input name="label" maxLength={20} required placeholder="2027-28" /></label>
          <label><span>Start date</span><input name="startDate" type="date" required /></label>
          <label><span>End date</span><input name="endDate" type="date" required /></label>
        </>}
        {section === 'Add semester' && <>
          <label><span>Academic year</span><select name="academicYearId" required defaultValue=""><option value="" disabled>Select an academic year</option>{years.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
          <label><span>Semester name</span><input name="name" maxLength={40} required placeholder="Semester 1" /></label>
          <label><span>Fee due date</span><input name="dueDate" type="date" required /></label>
          <label><span>Grace days</span><input name="graceDays" type="number" min="0" step="1" defaultValue="0" required /></label>
          <label><span>Fine end date (optional)</span><input name="fineEndDate" type="date" /></label>
        </>}
        {section === 'Add fee structure' && <>
          <label><span>Course</span><select name="courseId" required defaultValue=""><option value="" disabled>Select a course</option>{courses.filter(course => course.active).map(course => <option key={course.id} value={course.id}>{course.courseName} ({course.courseCode})</option>)}</select></label>
          <label><span>Academic year</span><select name="academicYearId" required defaultValue=""><option value="" disabled>Select an academic year</option>{years.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
          <label><span>Semester</span><select name="semesterId" required defaultValue=""><option value="" disabled>Select a semester</option>{semesters.map(semester => <option key={semester.id} value={semester.id}>{years.find(year => year.id === semester.academicYearId)?.label} · {semester.name}</option>)}</select></label>
          <label><span>Component</span><select name="component" required><option value="ACADEMIC_FEE">Academic fee</option><option value="ACADEMIC_CAUTION">Academic caution deposit</option><option value="HOSTEL_FEE">Hostel fee</option><option value="HOSTEL_SECURITY">Hostel security deposit</option></select></label>
          <label><span>Study year</span><input name="studyYear" type="number" min="1" max="10" step="1" defaultValue="1" required /></label>
          <label><span>Amount (INR)</span><input name="amount" type="number" min="1" step="1" required /></label>
        </>}
        {section === 'Add student' && <>
          <label><span>Registration number</span><input name="registrationNumber" maxLength={40} required /></label>
          <label><span>Student name</span><input name="name" maxLength={120} required /></label>
          <label><span>Phone number</span><input name="phoneNumber" type="tel" minLength={8} maxLength={20} required /></label>
          <label><span>WhatsApp number</span><input name="whatsappNumber" type="tel" minLength={8} maxLength={20} required /></label>
          <label><span>Email</span><input name="email" type="email" maxLength={120} required /></label>
          <label><span>Father / guardian name</span><input name="fatherName" maxLength={120} required /></label>
          <label><span>Branch</span><input name="branch" maxLength={80} required placeholder="e.g. Management" /></label>
          <label><span>Course</span><select name="courseId" required defaultValue=""><option value="" disabled>Select a course</option>{courses.filter(course => course.active).map(course => <option key={course.id} value={course.id}>{course.courseName}</option>)}</select></label>
          <label><span>Batch / academic year</span><select name="academicYearId" required defaultValue=""><option value="" disabled>Select an academic year</option>{years.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
          <label><span>Admission semester</span><select name="semesterId" required defaultValue=""><option value="" disabled>Select a semester</option>{semesters.map(semester => <option key={semester.id} value={semester.id}>{years.find(year => year.id === semester.academicYearId)?.label} · {semester.name}</option>)}</select></label>
          <label><span>Admission type</span><select name="admissionType"><option value="DIRECT">Direct</option><option value="COUNSELLING">Counselling</option></select></label>
          <label><span>Current study year</span><input name="studyYear" type="number" min="1" max="10" step="1" defaultValue="1" required /></label>
          <label className="admin-form-checkbox"><input name="isHosteller" type="checkbox" /><span>Hosteller</span></label>
        </>}
        <div className="admin-form-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : `Save ${section.replace('Add ', '').toLowerCase()}`}</button></div>
      </form>}
    </section>
  </div>
}
