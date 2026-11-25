
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../components/ui/AppIcon'
import {
  api,
  type ApiSession,
  type ApiCourse,
  type ApiFeeStructure,
  type ApiHostelRate,
  type ApiSemester,
} from '../../../api/client'
import './FeeStructurePage.css'

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

type OverviewGroup = {
  title: string
  years: number
  courses: ApiCourse[]
}

function currentSessionId(sessions: ApiSession[]) {
  const now = new Date()

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const ordered = [...sessions].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  )

  return (
    ordered.find(
      session =>
        session.startDate.slice(0, 10) <= today &&
        session.endDate.slice(0, 10) >= today,
    )?.id ??
    ordered
      .filter(session => session.startDate.slice(0, 10) <= today)
      .at(-1)?.id ??
    ordered[0]?.id
  )
}

type FeeStructurePageProps = {
  onAddFeeStructure?: () => void
  onNotice?: (message: string) => void
  refreshKey?: number
}

export function FeeStructurePage({
  onAddFeeStructure,
  onNotice,
  refreshKey = 0,
}: FeeStructurePageProps) {
  const [activeTab, setActiveTab] = useState<'course' | 'hostel'>('course')
  const [selectedYearId, setSelectedYearId] = useState('')
  const [openBreakdown, setOpenBreakdown] = useState<string | null>(null)
  const [breakdownPosition, setBreakdownPosition] = useState({
    top: 0,
    left: 0,
  })

  const [courses, setCourses] = useState<ApiCourse[]>([])
  const [years, setYears] = useState<ApiSession[]>([])
  const [semesters, setSemesters] = useState<ApiSemester[]>([])
  const [hostelRates, setHostelRates] = useState<ApiHostelRate[]>([])
  const [structures, setStructures] = useState<ApiFeeStructure[]>([])

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingStructures, setLoadingStructures] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [mutatingFeeId, setMutatingFeeId] = useState<number | null>(null)
  const [editingFeeId, setEditingFeeId] = useState<number | null>(null)
  const [feeAmountDraft, setFeeAmountDraft] = useState('')

  // Load courses, sessions, semesters and hostel rates.
  useEffect(() => {
    let active = true

    setLoadingOptions(true)
    setLoadError('')

    Promise.all([
      api.courses(),
      api.sessions(),
      api.semesters(),
      api.hostelRates(),
    ])
      .then(([courseRows, sessionRows, semesterRows, hostelRateRows]) => {
        if (!active) return

        setCourses(courseRows)
        setYears(sessionRows)
        setSemesters(semesterRows)
        setHostelRates(hostelRateRows)

        const activeSessionId = currentSessionId(sessionRows)

        setSelectedYearId(current =>
          sessionRows.some(session => String(session.id) === current)
            ? current
            : String(activeSessionId ?? ''),
        )
      })
      .catch(error => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load fee structure.',
          )
        }
      })
      .finally(() => {
        if (active) setLoadingOptions(false)
      })

    return () => {
      active = false
    }
  }, [refreshKey])

  // Load fee structures for the selected session.
  useEffect(() => {
    if (!selectedYearId) {
      setStructures([])
      return
    }

    let active = true

    setLoadingStructures(true)
    setLoadError('')
    setStructures([])

    api
      .feeStructures(Number(selectedYearId))
      .then(rows => {
        if (active) setStructures(rows)
      })
      .catch(error => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load academic fees.',
          )
        }
      })
      .finally(() => {
        if (active) setLoadingStructures(false)
      })

    return () => {
      active = false
    }
  }, [refreshKey, selectedYearId])

  // Close fee breakdown when clicking outside or pressing Escape.
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(
          '.fee-amount-details, .fee-breakdown-popover',
        )
      ) {
        setOpenBreakdown(null)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenBreakdown(null)
      }
    }

    document.addEventListener('click', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('click', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const courseGroups: OverviewGroup[] = [
    {
      title: "Bachelor's degree",
      years: 3,
      courses: courses.filter(
        item => !item.courseName.toLowerCase().includes('mba'),
      ),
    },
    {
      title: "Master's degree",
      years: 2,
      courses: courses.filter(item =>
        item.courseName.toLowerCase().includes('mba'),
      ),
    },
  ]

  const visibleStructures = structures

  const academicStructures = visibleStructures.filter(
    item =>
      item.component === 'ACADEMIC_FEE' ||
      item.component === 'ACADEMIC_CAUTION',
  )

  const amountFor = (
    courseId: number,
    studyYear: number,
    semesterId?: number,
  ) =>
    academicStructures
      .filter(
        item =>
          item.courseId === courseId &&
          item.studyYear === studyYear &&
          item.semesterId === semesterId,
      )
      .reduce((sum, item) => sum + item.amount, 0)

  const saveFeeAmount = async (item: ApiFeeStructure) => {
    const amount = Number(feeAmountDraft)

    if (!Number.isInteger(amount) || amount <= 0) {
      onNotice?.('Enter a positive whole number for the fee amount.')
      return
    }

    setMutatingFeeId(item.id)

    try {
      const updated = await api.updateFeeStructure(item.id, { amount })

      setStructures(rows =>
        rows.map(row => (row.id === item.id ? updated : row)),
      )

      setEditingFeeId(null)
      onNotice?.('Fee structure updated.')
    } catch (error) {
      onNotice?.(
        error instanceof Error
          ? error.message
          : 'Could not update the fee structure.',
      )
    } finally {
      setMutatingFeeId(null)
    }
  }

  const deleteFeeStructure = async (item: ApiFeeStructure) => {
    const confirmed = window.confirm(
      `Delete this ${item.component.replaceAll('_', ' ').toLowerCase()} fee structure? Existing assessed student balances will remain unchanged.`,
    )

    if (!confirmed) return

    setMutatingFeeId(item.id)

    try {
      await api.deleteFeeStructure(item.id)

      setStructures(rows => rows.filter(row => row.id !== item.id))

      onNotice?.('Fee structure deleted.')
    } catch (error) {
      onNotice?.(
        error instanceof Error
          ? error.message
          : 'Could not delete the fee structure.',
      )
    } finally {
      setMutatingFeeId(null)
    }
  }

  const getBreakdownPosition = (element: HTMLElement) => {
    const current = element.getBoundingClientRect()
    const popoverHeight = 190

    const top =
      current.bottom + popoverHeight + 12 <= window.innerHeight
        ? current.bottom + 8
        : Math.max(12, current.top - popoverHeight - 8)

    const popoverWidth = window.innerWidth <= 650 ? 256 : 281

    const left = Math.max(
      12,
      Math.min(current.left, window.innerWidth - popoverWidth - 12),
    )

    return { top, left }
  }

  return (
    <section
      className="fee-structure-page"
      aria-labelledby="fee-structure-title"
    >
      <div className="eyebrow">ACADEMIC FEES</div>

      <div className="fee-structure-title-row">
        <h1 id="fee-structure-title">Fee structure</h1>

        {onAddFeeStructure && (
          <button
            className="primary-button"
            onClick={onAddFeeStructure}
          >
            Add fee structure
          </button>
        )}
      </div>

      <div className="fee-year-filter-row">
        <label
          className="fee-year-filter"
          htmlFor="session-select"
        >
          <span>Session</span>

          <span className="fee-year-select">
            <select
              id="session-select"
              value={selectedYearId}
              onChange={event =>
                setSelectedYearId(event.target.value)
              }
              disabled={loadingOptions || years.length === 0}
            >
              <option value="" disabled>
                Select session
              </option>

              {years.map(year => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </select>

            <Icon name="chevron" size={15} />
          </span>
        </label>

        {selectedYearId && (
          <span className="fee-year-caption">
            {loadingStructures
              ? 'Updating fees…'
              : `Showing ${
                  years.find(
                    year => String(year.id) === selectedYearId,
                  )?.label ?? 'selected session'
                } fee data`}
          </span>
        )}
      </div>

      {loadError && (
        <p role="alert">
          Could not load live fee data: {loadError}. Check
          VITE_API_BASE_URL and the API server.
        </p>
      )}

      <div
        className="fee-structure-tabs"
        role="tablist"
        aria-label="Fee structure type"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'course'}
          className={activeTab === 'course' ? 'active' : ''}
          onClick={() => setActiveTab('course')}
        >
          Fee Charge
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'hostel'}
          className={activeTab === 'hostel' ? 'active' : ''}
          onClick={() => setActiveTab('hostel')}
        >
          Hostel Fees
        </button>
      </div>

      {activeTab === 'course' && (
        <>
          {loadingOptions || loadingStructures ? (
            <p className="fee-structure-note" role="status">
              Loading academic fee structures…
            </p>
          ) : !loadError && years.length === 0 ? (
            <p className="fee-structure-note">
              No sessions are configured yet.
            </p>
          ) : (
            <>
              <p className="fee-structure-intro">
                Fee charges by course and semester. Select an amount
                to see what it includes.
              </p>

              <div className="fee-course-tables">
                {courseGroups.map(group => (
                  <article
                    className="panel fee-course-table-card"
                    key={group.title}
                  >
                    <h2>
                      <Icon name="receipt" size={18} />
                      Fee structure for {group.title}
                    </h2>

                    <div className="fee-table-scroll">
                      <table className="fee-structure-table">
                        <thead>
                          <tr>
                            <th rowSpan={2}>
                              Course / Fee Charge
                            </th>

                            {Array.from(
                              { length: group.years },
                              (_, year) => (
                                <th key={year} colSpan={2}>
                                  {year + 1}
                                  {year === 0
                                    ? 'st'
                                    : year === 1
                                      ? 'nd'
                                      : year === 2
                                        ? 'rd'
                                        : 'th'}{' '}
                                  year
                                </th>
                              ),
                            )}
                          </tr>

                          <tr>
                            {Array.from(
                              { length: group.years * 2 },
                              (_, semester) => (
                                <th key={semester}>
                                  {semester + 1}
                                  {semester === 0
                                    ? 'st'
                                    : semester === 1
                                      ? 'nd'
                                      : semester === 2
                                        ? 'rd'
                                        : 'th'}{' '}
                                  semester
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {group.courses.map(course => (
                            <tr key={course.id}>
                              <th>{course.courseName}</th>

                              {Array.from(
                                { length: group.years * 2 },
                                (_, semester) => {
                                  const studyYear =
                                    Math.floor(semester / 2) + 1

                                  const semesterName =
                                    `semester ${semester + 1}`

                                  const semesterRow = semesters.find(
                                    candidate =>
                                      candidate.sessionId ===
                                        Number(selectedYearId) &&
                                      candidate.name
                                        .trim()
                                        .toLowerCase() ===
                                        semesterName,
                                  )

                                  const breakdown =
                                    academicStructures
                                      .filter(
                                        row =>
                                          row.courseId === course.id &&
                                          row.studyYear === studyYear &&
                                          row.semesterId ===
                                            semesterRow?.id,
                                      )
                                      .map(row => ({
                                        label:
                                          row.component ===
                                          'ACADEMIC_FEE'
                                            ? 'Academic fee'
                                            : 'Academic caution',
                                        amount: row.amount,
                                      }))

                                  const total = amountFor(
                                    course.id,
                                    studyYear,
                                    semesterRow?.id ?? -1,
                                  )

                                  const key = `${course.id}-${semester}`
                                  const isOpen = openBreakdown === key

                                  return (
                                    <td key={semester}>
                                      <details
                                        className="fee-amount-details"
                                        open={isOpen}
                                      >
                                        <summary
                                          aria-label={
                                            total
                                              ? `${currency.format(total)} fee charge, semester ${semester + 1}; view breakdown`
                                              : `No fee configured for semester ${semester + 1}`
                                          }
                                          onClick={event => {
                                            if (!breakdown.length) return

                                            event.preventDefault()

                                            setBreakdownPosition(
                                              getBreakdownPosition(
                                                event.currentTarget,
                                              ),
                                            )

                                            setOpenBreakdown(value =>
                                              value === key ? null : key,
                                            )
                                          }}
                                        >
                                          {total
                                            ? currency.format(total)
                                            : '—'}

                                          {breakdown.length > 0 && (
                                            <span
                                              className="fee-chevron"
                                              aria-hidden="true"
                                            />
                                          )}
                                        </summary>

                                        {isOpen &&
                                          createPortal(
                                            <div
                                              className="fee-breakdown-popover"
                                              style={{
                                                top: breakdownPosition.top,
                                                left: breakdownPosition.left,
                                              }}
                                              role="region"
                                              aria-label={`Semester ${semester + 1} breakdown`}
                                            >
                                              <strong>
                                                Semester {semester + 1}{' '}
                                                breakdown
                                              </strong>

                                              {breakdown.map(charge => (
                                                <div key={charge.label}>
                                                  <span>
                                                    {charge.label}
                                                  </span>
                                                  <b>
                                                    {currency.format(
                                                      charge.amount,
                                                    )}
                                                  </b>
                                                </div>
                                              ))}

                                              <div className="fee-breakdown-total">
                                                <span>Total</span>
                                                <b>
                                                  {currency.format(total)}
                                                </b>
                                              </div>
                                            </div>,
                                            document.body,
                                          )}
                                      </details>
                                    </td>
                                  )
                                },
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </div>

              <p className="fee-structure-note">
                Amounts reflect the selected session and fee components
                configured in the fee management API.
              </p>

              {onAddFeeStructure && (
                <section className="panel fee-config-admin">
                  <div className="hostel-fee-heading">
                    <div>
                      <h2>Manage configured fee charges</h2>
                      <p>
                        Edit amounts or delete fee structure entries.
                        Changes affect future assessments; posted
                        student balances stay as recorded.
                      </p>
                    </div>
                  </div>

                  <div className="fee-table-scroll">
                    <table className="fee-structure-table">
                      <thead>
                        <tr>
                          <th>Course</th>
                          <th>Session</th>
                          <th>Semester</th>
                          <th>Study year</th>
                          <th>Component</th>
                          <th>Amount</th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {visibleStructures.map(item => (
                          <tr key={item.id}>
                            <td>
                              {courses.find(
                                row => row.id === item.courseId,
                              )?.courseName ?? item.courseId}
                            </td>

                            <td>
                              {years.find(
                                row => row.id === item.sessionId,
                              )?.label ?? item.sessionId}
                            </td>

                            <td>
                              {semesters.find(
                                row => row.id === item.semesterId,
                              )?.name ?? item.semesterId}
                            </td>

                            <td>{item.studyYear}</td>

                            <td>
                              {item.component.replaceAll('_', ' ')}
                            </td>

                            <td>
                              {editingFeeId === item.id ? (
                                <input
                                  className="fee-amount-edit"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={feeAmountDraft}
                                  onChange={event =>
                                    setFeeAmountDraft(
                                      event.target.value,
                                    )
                                  }
                                  aria-label="New fee amount in rupees"
                                />
                              ) : (
                                currency.format(item.amount)
                              )}
                            </td>

                            <td>
                              <div className="fee-admin-actions">
                                {editingFeeId === item.id ? (
                                  <>
                                    <button
                                      disabled={mutatingFeeId !== null}
                                      onClick={() =>
                                        void saveFeeAmount(item)
                                      }
                                    >
                                      Save
                                    </button>

                                    <button
                                      disabled={mutatingFeeId !== null}
                                      onClick={() =>
                                        setEditingFeeId(null)
                                      }
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      disabled={mutatingFeeId !== null}
                                      onClick={() => {
                                        setEditingFeeId(item.id)
                                        setFeeAmountDraft(
                                          String(item.amount),
                                        )
                                      }}
                                    >
                                      Edit
                                    </button>

                                    <button
                                      className="danger"
                                      disabled={mutatingFeeId !== null}
                                      onClick={() =>
                                        void deleteFeeStructure(item)
                                      }
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'hostel' && (
        <section
          className="panel hostel-fee-panel"
          aria-labelledby="hostel-fees-title"
        >
          <div className="hostel-fee-heading">
            <div>
              <h2 id="hostel-fees-title">
                Hostel accommodation fees
              </h2>
              <p>
                Annual rates by air conditioning and occupancy.
              </p>
            </div>

            <span className="sample-data-note">
              Annual rates
            </span>
          </div>

          <div className="hostel-room-tables">
            {['AC', 'Non-AC'].map(condition => (
              <article
                className="hostel-room-card"
                key={condition}
              >
                <h3>
                  {condition === 'AC' ? 'AC Rooms' : 'Non-AC Rooms'}
                </h3>

                <div className="fee-table-scroll">
                  <table className="fee-structure-table hostel-fee-table">
                    <thead>
                      <tr>
                        <th>Occupancy</th>
                        <th>Fee</th>
                      </tr>
                    </thead>

                    <tbody>
                      {hostelRates
                        .filter(rate => rate.condition === condition)
                        .map(rate => (
                          <tr key={rate.id}>
                            <th>{rate.occupancy}</th>
                            <td>
                              {currency.format(rate.annualFee)}
                            </td>
                          </tr>
                        ))}

                      {hostelRates.filter(
                        rate => rate.condition === condition,
                      ).length === 0 && (
                        <tr>
                          <td colSpan={2} className="fee-structure-note">
                            No hostel rates configured.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>

          <p className="fee-structure-note hostel-fee-note">
            Hostel fees are listed per session.
          </p>
        </section>
      )}
    </section>
  )
}
