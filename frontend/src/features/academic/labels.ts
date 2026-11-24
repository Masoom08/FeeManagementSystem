import type { ApiAcademicYear, ApiSemester } from '../../api/client'

export const SEMESTER_TERMS = ['Ist Semester', 'IInd Semester'] as const

export function courseDurationYears(course: { durationYears?: number | null; courseName?: string; courseCode?: string }) {
  const value = Number(course.durationYears)
  if (Number.isInteger(value) && value >= 1 && value <= 6) return value
  const text = `${course.courseCode ?? ''} ${course.courseName ?? ''}`.toLowerCase()
  return text.includes('mba') ? 2 : 3
}

export function termOrder(name: string) {
  const value = name.trim().toLowerCase()
  if (value === 'ist semester' || value === 'odd' || value.startsWith('ist ')) return 0
  if (value === 'iind semester' || value === 'even' || value.startsWith('iind ')) return 1
  const index = SEMESTER_TERMS.indexOf(name as (typeof SEMESTER_TERMS)[number])
  return index === -1 ? SEMESTER_TERMS.length : index
}

export function termDisplayName(name: string) {
  if (termOrder(name) === 0) return 'Semester 1, 3, 5'
  if (termOrder(name) === 1) return 'Semester 2, 4, 6'
  return name
}

export function semesterCount(durationYears: number) {
  return Math.max(0, durationYears) * 2
}

export function semesterNumbers(durationYears: number) {
  return Array.from({ length: semesterCount(durationYears) }, (_, index) => index + 1)
}

export function studyYearForSemester(semesterNumber: number) {
  return Math.ceil(semesterNumber / 2)
}

export function termForSemester(semesterNumber: number) {
  return semesterNumber % 2 === 0 ? SEMESTER_TERMS[1] : SEMESTER_TERMS[0]
}

export function programSemesterNumber(studyYear: number, termName: string) {
  return (Math.max(1, studyYear) - 1) * 2 + (termOrder(termName) === 1 ? 2 : 1)
}

export function programSemesterLabel(semesterNumber: number) {
  return `Semester ${semesterNumber}`
}

export function semesterLabel(semester: Pick<ApiSemester, 'name' | 'academicYearId'>, years: Pick<ApiAcademicYear, 'id' | 'label'>[]) {
  const year = years.find(item => item.id === semester.academicYearId)
  const name = termDisplayName(semester.name)
  return year ? `${year.label} · ${name}` : name
}

export function semestersForYear(semesters: ApiSemester[], academicYearId: number) {
  return semesters
    .filter(item => item.academicYearId === academicYearId && termOrder(item.name) < SEMESTER_TERMS.length)
    .sort((a, b) => termOrder(a.name) - termOrder(b.name))
}

export function semestersBySession(semesters: ApiSemester[], years: ApiAcademicYear[]) {
  return [...years]
    .sort((a, b) => b.label.localeCompare(a.label))
    .map(year => ({
      year,
      semesters: semestersForYear(semesters, year.id),
    }))
    .filter(group => group.semesters.length)
}
