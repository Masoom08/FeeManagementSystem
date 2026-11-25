
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type ApiLateFeeDashboard } from '../../../api/client'
import { Icon } from '../../../components/ui/AppIcon'
import './LateFeeWaivers.css'

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const tabs = ['B.Com (Hons.)', 'BBA (LU)', 'BBA (AKTU)', 'MBA (AKTU)']

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

type OverdueStudent = ApiLateFeeDashboard['students'][number]

type StudentFineFilter =
  | 'All overdue'
  | 'Fine pending'
  | 'Fine waived'

function dateLabel(month: number, day: number) {
  return `${day} ${monthNames[month - 1] ?? ''}`
}

function courseMatches(name: string, tab: string) {
  const normalized = name.toLowerCase()

  if (tab === 'MBA (AKTU)') {
    return normalized.includes('mba') && !normalized.includes('bba')
  }

  if (tab === 'B.Com (Hons.)') {
    return normalized.includes('b.com')
  }

  return normalized.includes(tab.toLowerCase())
}

function downloadWaivedStudents(rows: OverdueStudent[]) {
  const headers = [
    'Student name',
    'Registration number',
    'Phone',
    'Course',
    'Semester',
    'Deadline',
    'Days overdue',
    'Late fine waived',
    'Waived date',
  ]

  const data = rows
    .filter(row => row.waivedAmount > 0)
    .map(student => [
      student.name,
      student.registrationNumber,
      student.phoneNumber,
      student.courseName,
      student.semester,
      student.dueDate,
      student.daysOverdue,
      student.waivedAmount,
      student.waivedAt
        ? new Date(student.waivedAt).toLocaleDateString('en-IN')
        : '',
    ])

  const csvCell = (value: string | number) =>
    `"${String(value)
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`

  const csv = [headers, ...data]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n')

  const blob = new Blob(['\uFEFF', csv], {
    type: 'text/csv;charset=utf-8',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `ICCMRT-waived-students-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`

  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function LateFeeWaivers({
  canWaive,
}: {
  canWaive: boolean
}) {
  const [dashboard, setDashboard] =
    useState<ApiLateFeeDashboard | null>(null)

  const [activeTab, setActiveTab] = useState(tabs[0])

  const [studentFilter, setStudentFilter] =
    useState<StudentFineFilter>('Fine pending')

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<OverdueStudent | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setError('')
      const data = await api.lateFeeDashboard()
      setDashboard(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load course deadlines and fee balances.',
      )
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectedCourse = dashboard?.courses.find(course =>
    courseMatches(course.courseName, activeTab),
  )

  const oddDeadline = selectedCourse?.deadlines.find(
    deadline => deadline.semesterType === 'ODD',
  )

  const evenDeadline = selectedCourse?.deadlines.find(
    deadline => deadline.semesterType === 'EVEN',
  )

  const rateLabel = selectedCourse
    ? `${currency.format(selectedCourse.lateFeePerDay)} per day`
    : '—'

  const overdueStudents = useMemo(
    () => dashboard?.students ?? [],
    [dashboard],
  )

  const courseStudents = overdueStudents.filter(
    student => selectedCourse?.id === student.courseId,
  )

  const visibleStudents = courseStudents.filter(student => {
    if (
      studentFilter === 'Fine pending' &&
      student.pendingFine <= 0
    ) {
      return false
    }

    if (
      studentFilter === 'Fine waived' &&
      student.waivedAmount <= 0
    ) {
      return false
    }

    return `${student.name} ${student.registrationNumber} ${student.courseName}`
      .toLowerCase()
      .includes(query.toLowerCase())
  })

  const pendingTotal = courseStudents.reduce(
    (sum, student) => sum + student.pendingFine,
    0,
  )

  const waivedStudents = courseStudents.filter(
    student => student.waivedAmount > 0,
  )

  const waiveSelected = async () => {
    if (!selected) return

    setBusy(true)

    try {
      await api.waiveLateFee(
        selected.studentId,
        'Super Admin',
        'Approved late fee waiver',
      )

      setNotice(
        `Late fee waived for ${selected.name}. The semester fee remains unpaid.`,
      )

      setSelected(null)
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to waive this late fee.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="waivers-page"
      aria-labelledby="waivers-title"
    >
      <div className="waivers-page-heading">
        <div>
          <div className="eyebrow">FEE SUPPORT</div>
          <h1 id="waivers-title">Course fee deadlines</h1>
          <p>
            Review course due dates, overdue fee balances and late fee
            waivers.
          </p>
        </div>

        <button
          className="waiver-download-button"
          onClick={() => downloadWaivedStudents(waivedStudents)}
          disabled={!waivedStudents.length}
        >
          <Icon name="download" size={17} />
          Download waived list
          <span>{waivedStudents.length}</span>
        </button>
      </div>

      {notice && (
        <div className="waiver-notice" role="status">
          <Icon name="check" size={18} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => setNotice('')}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="waiver-error" role="alert">
          {error}
          <button onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      <section className="panel deadline-panel">
        <div className="deadline-heading">
          <div>
            <h2>Last fee date by course</h2>
            <p>Odd and even semester deadlines</p>
          </div>
          <span>As of {dashboard?.asOfDate ?? '—'}</span>
        </div>

        <div
          className="deadline-tabs"
          role="tablist"
          aria-label="Courses"
        >
          {tabs.map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? 'selected' : ''}
              onClick={() => {
                setActiveTab(tab)
                setStudentFilter('Fine pending')
                setQuery('')
                setSelected(null)
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="deadline-cards">
          <article>
            <span>ODD SEMESTER</span>
            <strong>
              {oddDeadline
                ? dateLabel(oddDeadline.month, oddDeadline.day)
                : 'Not configured'}
            </strong>
            <small>Last date for odd semester fee</small>
          </article>

          <article>
            <span>EVEN SEMESTER</span>
            <strong>
              {evenDeadline
                ? dateLabel(evenDeadline.month, evenDeadline.day)
                : 'Not configured'}
            </strong>
            <small>Last date for even semester fee</small>
          </article>
        </div>
      </section>

      <div className="waiver-summary-grid">
        <article className="waiver-summary">
          <span className="waiver-summary-icon waiver-pending-icon">
            <Icon name="clock" size={21} />
          </span>
          <div>
            <span>{activeTab} students overdue</span>
            <strong>{courseStudents.length}</strong>
          </div>
        </article>

        <article className="waiver-summary">
          <span className="waiver-summary-icon waiver-total-icon">
            <Icon name="wallet" size={21} />
          </span>
          <div>
            <span>Pending late fines</span>
            <strong>{currency.format(pendingTotal)}</strong>
          </div>
        </article>

        <article className="waiver-summary">
          <span className="waiver-summary-icon waiver-done-icon">
            <Icon name="check" size={21} />
          </span>
          <div>
            <span>{activeTab} students with fines waived</span>
            <strong>{waivedStudents.length}</strong>
          </div>
        </article>
      </div>

      <section className="panel waiver-list-panel">
        <div className="waiver-list-heading">
          <div>
            <h2>{activeTab} students with unpaid fees</h2>
            <p>
              Only {activeTab} students with an outstanding balance
              past their course fee deadline appear here.
            </p>
          </div>
        </div>

        <div
          className="waiver-filter-tabs"
          role="tablist"
          aria-label="Filter overdue students"
        >
          {(
            [
              'All overdue',
              'Fine pending',
              'Fine waived',
            ] as StudentFineFilter[]
          ).map(filter => {
            const count =
              filter === 'All overdue'
                ? courseStudents.length
                : filter === 'Fine pending'
                  ? courseStudents.filter(
                      student => student.pendingFine > 0,
                    ).length
                  : courseStudents.filter(
                      student => student.waivedAmount > 0,
                    ).length

            return (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={studentFilter === filter}
                className={
                  studentFilter === filter ? 'selected' : ''
                }
                onClick={() => setStudentFilter(filter)}
              >
                {filter}
                <span>{count}</span>
              </button>
            )
          })}
        </div>

        <label className="waiver-search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by student name or registration number"
          />
        </label>

        <div className="waiver-table-wrap">
          <table className="waiver-table overdue-students-table">
            <thead>
              <tr>
                <th>REGISTRATION NO.</th>
                <th>STUDENT</th>
                <th>COURSE</th>
                <th>BATCH</th>
                <th>SEMESTER</th>
                <th>FEE BALANCE</th>
                <th>LAST FEE DATE</th>
                <th>DAYS OVERDUE</th>
                <th>RATE / DAY</th>
                <th>LATE FINE</th>
                <th>FINE STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {visibleStudents.map(student => (
                <tr key={student.studentId}>
                  <td>{student.registrationNumber}</td>

                  <td>
                    <div className="student-cell">
                      <span>
                        <strong>{student.name}</strong>
                        <small>{student.phoneNumber}</small>
                      </span>
                    </div>
                  </td>

                  <td>{student.courseName}</td>
                  <td>{student.batch}</td>
                  <td>{student.semester}</td>

                  <td className="amount-cell">
                    {currency.format(student.semesterFee)}
                  </td>

                  <td>
                    {new Date(
                      `${student.dueDate}T00:00:00`,
                    ).toLocaleDateString('en-IN')}
                  </td>

                  <td>{student.daysOverdue}</td>

                  <td>{currency.format(student.ratePerDay)}</td>

                  <td
                    className={
                      student.pendingFine
                        ? 'fine-amount'
                        : 'waived-amount'
                    }
                  >
                    {currency.format(student.fineAmount)}
                  </td>

                  <td>
                    {student.pendingFine ? (
                      <span className="fine-status fine-pending">
                        <i />
                        Pending
                      </span>
                    ) : (
                      <span className="fine-status fine-waived">
                        <i />
                        Waived
                      </span>
                    )}
                  </td>

                  <td>
                    {student.pendingFine > 0 && canWaive ? (
                      <button
                        className="waive-button"
                        onClick={() => setSelected(student)}
                      >
                        Waive fine
                      </button>
                    ) : student.waivedAt ? (
                      <span className="waived-date">
                        {new Date(
                          student.waivedAt,
                        ).toLocaleDateString('en-IN')}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!visibleStudents.length && (
            <div className="waiver-empty">
              {dashboard
                ? 'No overdue students found.'
                : 'Loading overdue students…'}
            </div>
          )}
        </div>

        <div className="waiver-table-footer">
          <span>
            Showing <strong>{visibleStudents.length}</strong>{' '}
            {activeTab} students
          </span>
          <span>{rateLabel} after the last fee date.</span>
        </div>
      </section>

      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (
              event.target === event.currentTarget &&
              !busy
            ) {
              setSelected(null)
            }
          }}
        >
          <section
            className="waiver-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="waive-confirm-title"
          >
            <div className="waiver-warning-icon">
              <Icon name="receipt" size={23} />
            </div>

            <button
              className="modal-close"
              aria-label="Close"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <h2 id="waive-confirm-title">
              Waive this late fee?
            </h2>

            <p className="waiver-confirm-student">
              {selected.name} · {selected.courseName} ·{' '}
              {selected.semester}
            </p>

            <div className="waive-amount-row">
              <span>Late fine to waive</span>
              <strong>
                {currency.format(selected.pendingFine)}
              </strong>
            </div>

            <p className="waiver-impact-note">
              This waives the late fine only. The outstanding
              semester fee of{' '}
              <strong>
                {currency.format(selected.semesterFee)}
              </strong>{' '}
              remains due.
            </p>

            <div className="waiver-modal-actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>

              <button
                className="primary-button confirm-waive-button"
                disabled={busy}
                onClick={() => void waiveSelected()}
              >
                {busy ? 'Saving…' : 'Yes, waive fine'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
