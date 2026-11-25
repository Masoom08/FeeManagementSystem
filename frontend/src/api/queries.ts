import { QueryClient, useQuery } from '@tanstack/react-query'
import { api } from './client'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, refetchOnWindowFocus: true, retry: false } },
})

export const queryKeys = {
  courses: ['courses'] as const,
  academicYears: ['academic-years'] as const,
  semesters: ['semesters'] as const,
  feeStructures: ['fee-structures'] as const,
  hostelRates: ['hostel-rates'] as const,
  students: ['students'] as const,
  reminders: ['reminders'] as const,
  reports: ['reports'] as const,
}

export function useCourses() {
  return useQuery({ queryKey: queryKeys.courses, queryFn: api.courses })
}

export function useAcademicYears() {
  return useQuery({ queryKey: queryKeys.academicYears, queryFn: api.academicYears })
}

export function useSemesters() {
  return useQuery({ queryKey: queryKeys.semesters, queryFn: api.semesters })
}

export function useFeeStructures() {
  return useQuery({ queryKey: queryKeys.feeStructures, queryFn: api.feeStructures })
}

export function useHostelRates() {
  return useQuery({ queryKey: queryKeys.hostelRates, queryFn: api.hostelRates })
}

export function useStudents() {
  return useQuery({ queryKey: queryKeys.students, queryFn: () => api.students() })
}

export function useReminders() {
  return useQuery({ queryKey: queryKeys.reminders, queryFn: api.reminders })
}

export function useOverviewReports(semesterId?: number) {
  return useQuery({
    queryKey: [...queryKeys.reports, semesterId ?? null],
    enabled: Boolean(semesterId),
    queryFn: async () => {
      const unpaid = await api.unpaidReport()
      const failed = await api.failedPayments()
      const onTime = await api.onTimeReport(semesterId!)
      const waivers = await api.waiverReport(semesterId!)
      const left = await api.leftStudents()
      const fines = await api.fineReport(semesterId!)
      const reconciliation = await api.reconciliation()
      return { unpaid, failed, onTime, waivers, left, fines, reconciliation }
    },
  })
}
