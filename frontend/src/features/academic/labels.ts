import type { ApiAcademicYear, ApiSemester } from '../../api/client'

export function semesterLabel(semester: Pick<ApiSemester, 'name' | 'academicYearId'>, years: Pick<ApiAcademicYear, 'id' | 'label'>[]) {
  const year = years.find(item => item.id === semester.academicYearId)
  return year ? `${year.label} · ${semester.name}` : semester.name
}

export function semestersBySession(semesters: ApiSemester[], years: ApiAcademicYear[]) {
  const termOrder = (name: string) => name === 'Odd' ? 0 : name === 'Even' ? 1 : 2
  return [...years]
    .sort((a, b) => b.label.localeCompare(a.label))
    .map(year => ({
      year,
      semesters: semesters
        .filter(item => item.academicYearId === year.id)
        .sort((a, b) => termOrder(a.name) - termOrder(b.name) || a.name.localeCompare(b.name)),
    }))
    .filter(group => group.semesters.length)
}
