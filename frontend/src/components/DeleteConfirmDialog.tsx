import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, type DeleteImpact } from '../api/client'
import { queryKeys } from '../api/queries'
import './DeleteConfirmDialog.css'

export type DeleteTarget = {
  kind: DeleteImpact['entity']
  id: number
}

const previewByKind = {
  course: api.previewCourseDelete,
  academicYear: api.previewAcademicYearDelete,
  semester: api.previewSemesterDelete,
  student: api.previewStudentDelete,
  feeStructure: api.previewFeeStructureDelete,
  hostelRate: api.previewHostelRateDelete,
  reminder: api.previewReminderDelete,
} as const

const deleteByKind = {
  course: api.deleteCourse,
  academicYear: api.deleteAcademicYear,
  semester: api.deleteSemester,
  student: api.deleteStudent,
  feeStructure: api.deleteFeeStructure,
  hostelRate: api.deleteHostelRate,
  reminder: api.deleteReminder,
} as const

const noticeByKind: Record<DeleteTarget['kind'], string> = {
  course: 'Course deleted.',
  academicYear: 'Academic year deleted.',
  semester: 'Semester deleted.',
  student: 'Student deleted.',
  feeStructure: 'Fee structure deleted.',
  hostelRate: 'Hostel rate deleted.',
  reminder: 'Reminder deleted.',
}

export function DeleteConfirmDialog({ target, onClose, onNotice }: {
  target: DeleteTarget
  onClose: () => void
  onNotice: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const [impact, setImpact] = useState<DeleteImpact | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setImpact(null)
    setError('')
    previewByKind[target.kind](target.id)
      .then(result => { if (!cancelled) setImpact(result) })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not check what this delete removes') })
    return () => { cancelled = true }
  }, [target.id, target.kind])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, saving])

  const confirm = async () => {
    if (!impact) return
    setSaving(true)
    setError('')
    try {
      await deleteByKind[target.kind](target.id)
      await Promise.all([
        queryKeys.courses,
        queryKeys.academicYears,
        queryKeys.semesters,
        queryKeys.feeStructures,
        queryKeys.hostelRates,
        queryKeys.students,
        queryKeys.reminders,
        queryKeys.reports,
      ].map(queryKey => queryClient.invalidateQueries({ queryKey })))
      onNotice(noticeByKind[target.kind])
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete this record')
    } finally {
      setSaving(false)
    }
  }

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="admin-modal delete-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-busy={saving || !impact}>
      <header className="admin-modal-header">
        <div>
          <div className="eyebrow">SUPER ADMIN · DELETE</div>
          <h2 id="delete-confirm-title">Delete {impact?.label ?? 'this record'}?</h2>
        </div>
        <button type="button" className="admin-modal-close" aria-label="Close dialog" onClick={onClose} disabled={saving}>×</button>
      </header>
      {error && <div className="admin-form-error" role="alert">{error}</div>}
      {!impact && !error && <p className="delete-confirm-status">Checking what this delete will remove…</p>}
      {impact && impact.deletes.length === 0 && impact.clears.length === 0 && <p className="delete-confirm-status">Only this record will be deleted.</p>}
      {impact && impact.deletes.length > 0 && <div className="delete-confirm-impact">
        <p>This will also remove:</p>
        <ul>{impact.deletes.map(item => <li key={item.key}><span>{item.label}</span><strong>{item.count}</strong></li>)}</ul>
      </div>}
      {impact?.clears.map(item => <p className="delete-clear-note" key={item.key}>{item.message}</p>)}
      <div className="admin-form-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="danger-button" onClick={() => void confirm()} disabled={!impact || saving}>{saving ? 'Deleting…' : 'Delete'}</button>
      </div>
    </section>
  </div>
}
