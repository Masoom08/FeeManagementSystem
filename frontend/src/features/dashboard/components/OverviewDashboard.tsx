
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../../components/ui/AppIcon'
import {
  api,
  type ApiCourseCollectionSummary,
  type ApiDashboardSummary,
  type ApiPaymentHistoryRow,
} from '../../../api/client'

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const courseColors = [
  '#dc2626',
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#0f766e',
  '#0891b2',
]

type ChartPoint = { x: number; y: number }

function smoothPath(points: ChartPoint[]) {
  if (points.length < 2) return ''

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const beforePrevious = points[index - 1] ?? previous
    const next = points[index + 2] ?? point
    const lowerY = Math.min(previous.y, point.y)
    const upperY = Math.max(previous.y, point.y)
    const controlOneX = previous.x + (point.x - beforePrevious.x) / 6
    const controlOneY = Math.min(upperY, Math.max(lowerY, previous.y + (point.y - beforePrevious.y) / 6))
    const controlTwoX = point.x - (next.x - previous.x) / 6
    const controlTwoY = Math.min(upperY, Math.max(lowerY, point.y - (next.y - previous.y) / 6))

    return `${path} C ${controlOneX},${controlOneY} ${controlTwoX},${controlTwoY} ${point.x},${point.y}`
  }, `M ${points[0].x},${points[0].y}`)
}

type OverviewDashboardProps = {
  onNotice: (message: string) => void
  onFeeStructure: () => void
}

export function OverviewDashboard({
  onNotice,
  onFeeStructure,
}: OverviewDashboardProps) {
  const [summary, setSummary] = useState<ApiDashboardSummary | null>(null)
  const [summaryError, setSummaryError] = useState('')

  const [courseCollections, setCourseCollections] =
    useState<ApiCourseCollectionSummary | null>(null)
  const [courseCollectionError, setCourseCollectionError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [paymentHistory, setPaymentHistory] = useState<ApiPaymentHistoryRow[] | null>(null)
  const [paymentHistoryError, setPaymentHistoryError] = useState('')

  useEffect(() => {
    let active = true

    api.dashboardSummary()
      .then(data => {
        if (active) setSummary(data)
      })
      .catch(() => {
        if (active) {
          setSummaryError('Dashboard totals could not be loaded.')
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setCourseCollectionError('')

    api.courseCollections()
      .then(data => {
        if (active) setCourseCollections(data)
      })
      .catch(() => {
        if (active) {
          setCourseCollectionError(
            'Course collections could not be loaded.',
          )
        }
      })

    return () => {
      active = false
    }
  }, [refreshKey])

  useEffect(() => {
    let active = true

    api.paymentHistory()
      .then(rows => {
        if (active) setPaymentHistory(rows)
      })
      .catch(() => {
        if (active) setPaymentHistoryError('Semester payment history could not be loaded.')
      })

    return () => {
      active = false
    }
  }, [])

  const displayValue = (value: number | undefined) =>
    value === undefined
      ? '—'
      : new Intl.NumberFormat('en-IN').format(value)

  const displayAmount = (value: number | undefined) =>
    value === undefined ? '—' : currency.format(value)

  const compactCurrency = (amount: number) =>
    amount >= 100000
      ? `${currency.format(amount / 100000)}L`
      : amount >= 1000
        ? `${currency.format(amount / 1000)}k`
        : currency.format(amount)

  const donutBackground = useMemo(() => {
    if (!courseCollections?.totalCollected) {
      return 'conic-gradient(#e8eaf0 0 100%)'
    }

    let position = 0

    const segments = courseCollections.courses.flatMap(
      (course, index) => {
        if (!course.amount) return []

        const end =
          position +
          (course.amount / courseCollections.totalCollected) * 100

        const segment = `${courseColors[index % courseColors.length]} ${position}% ${end}%`
        position = end

        return [segment]
      },
    )

    return `conic-gradient(${segments.join(',')})`
  }, [courseCollections])

  const semesterTrend = useMemo(() => {
    const now = new Date()
    const firstMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1)
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date),
        odd: 0,
        even: 0,
      }
    })
    const monthByKey = new Map(months.map(month => [month.key, month]))

    for (const row of paymentHistory ?? []) {
      if (row.product !== 'ACADEMIC' || row.bucket !== 'DUES' || !row.semester) continue
      const semesterNumber = Number(row.semester.match(/\d+/)?.[0])
      if (!semesterNumber) continue

      const paidDate = new Date(`${row.paidOn.slice(0, 10)}T00:00:00`)
      if (Number.isNaN(paidDate.getTime())) continue

      const key = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}`
      const month = monthByKey.get(key)
      if (month) month[semesterNumber % 2 === 1 ? 'odd' : 'even'] += row.amount
    }

    return months
  }, [paymentHistory])

  const semesterTrendMax = Math.max(0, ...semesterTrend.flatMap(month => [month.odd, month.even]))
  const chartTop = 20
  const chartBottom = 166
  const chartLeft = 54
  const chartRight = 704
  const pointX = (index: number) => chartLeft + (index * (chartRight - chartLeft)) / (semesterTrend.length - 1)
  const pointY = (amount: number) => chartBottom - (amount / (semesterTrendMax || 1)) * (chartBottom - chartTop)
  const oddSemesterPoints = semesterTrend.map((month, index) => ({ x: pointX(index), y: pointY(month.odd) }))
  const evenSemesterPoints = semesterTrend.map((month, index) => ({ x: pointX(index), y: pointY(month.even) }))

  const exportFeeReport = async () => {
    const today = new Date()
    const from = `${today.getFullYear()}-01-01`
    const to = today.toISOString().slice(0, 10)

    try {
      const blob = await api.downloadPaymentsReport(from, to)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `iccmrt-payments-${from}-to-${to}.xlsx`

      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      onNotice('Payments report downloaded.')
    } catch (error) {
      onNotice(
        error instanceof Error
          ? error.message
          : 'Could not download the payments report.',
      )
    }
  }

  return (
    <>
      <div className="welcome-row">
        <div>
          <h1>
            Welcome Back!
            <span className="wave"></span>
          </h1>
          <p className="page-subtitle">
            Manage student accounts, monitor collections, and review fee
            activity across your institution.
          </p>
        </div>

        <div className="welcome-actions">
          <button
            className="secondary-button"
            onClick={() => void exportFeeReport()}
          >
            <Icon name="download" size={16} />
            Export report
          </button>
        </div>
      </div>

      <section className="stats-grid" aria-label="Fee summary">
        <article className="stat-card stat-main">
          <div className="stat-top">
            <span className="stat-icon indigo">
              <Icon name="wallet" size={18} />
            </span>
            <span className="stat-note">All time</span>
          </div>
          <div className="stat-label">Total collected</div>
          <div className="stat-number">
            {displayAmount(summary?.totalAmountCollected)}
          </div>
          <div className="stat-foot">
            Successful payments recorded in the database
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon green">
              <Icon name="check" size={18} />
            </span>
            <span className="stat-note">Successful</span>
          </div>
          <div className="stat-label">Payments received</div>
          <div className="stat-number">
            {displayValue(summary?.paymentsReceived)}
          </div>
          <div className="stat-foot">
            Successful payment transactions
          </div>
          <div className="mini-bars green-bars">
            {[42, 57, 48, 70, 52, 78, 61, 88, 69, 100, 76, 90].map(
              (height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ),
            )}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon amber">
              <Icon name="clock" size={18} />
            </span>
            <span className="stat-alert">Outstanding</span>
          </div>
          <div className="stat-label">Pending payments</div>
          <div className="stat-number">
            {displayValue(summary?.pendingPayments)}
          </div>
          <div className="stat-foot">
            <span className="attention">
              {displayAmount(summary?.pendingAmount)}
            </span>{' '}
            unpaid amount
          </div>
          <div className="mini-bars amber-bars">
            {[70, 48, 58, 40, 66, 54, 78, 51, 92, 62, 76, 100].map(
              (height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ),
            )}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon rose">
              <Icon name="receipt" size={18} />
            </span>
            <span className="stat-note">All statuses</span>
          </div>
          <div className="stat-label">Total students</div>
          <div className="stat-number">
            {displayValue(summary?.totalStudentCount)}
          </div>
          <div className="stat-foot">
            Student records in the database
          </div>
          <div className="student-progress">
            <span />
          </div>
        </article>
      </section>

      {summaryError && (
        <p className="page-subtitle" role="alert">
          {summaryError}
        </p>
      )}

      <section className="overview-grid">
        <article className="panel collection-panel">
          <div className="panel-heading">
            <div>
              <h2>Collection overview</h2>
              <p>Monthly successful academic collections by odd/even semester · last 12 months</p>
            </div>
          </div>

          <div className="collection-total">
            <strong>
              {compactCurrency(courseCollections?.totalCollected ?? 0)}
            </strong>
            <span>
              <i /> Total collected
            </span>
          </div>

          <div className="progress-track">
            <span
              style={{
                width: courseCollections?.totalCollected ? '100%' : '0%',
              }}
            />
          </div>

          <div className="progress-labels">
            <span>₹0</span>
            <strong>
              {courseCollections
                ? currency.format(courseCollections.totalCollected)
                : 'Loading...'}
            </strong>
          </div>

          <div className="semester-trend-content">

        {paymentHistoryError ? (
          <p className="semester-trend-message" role="alert">{paymentHistoryError}</p>
        ) : paymentHistory === null ? (
          <p className="semester-trend-message">Loading semester payments…</p>
        ) : semesterTrendMax === 0 ? (
          <p className="semester-trend-message">No academic semester payments recorded in the last 12 months.</p>
        ) : (
          <>
            <svg className="semester-trend-svg" viewBox="0 0 720 220" role="img" aria-label="Monthly fees paid for odd and even semesters over the last 12 months">
              {[0, 0.5, 1].map(ratio => {
                const y = chartBottom - ratio * (chartBottom - chartTop)
                const value = semesterTrendMax * ratio
                return (
                  <g key={ratio}>
                    <line x1={chartLeft} x2={chartRight} y1={y} y2={y} className="semester-trend-gridline" />
                    <text x={chartLeft - 9} y={y + 3} textAnchor="end" className="semester-trend-axis-label">{compactCurrency(value)}</text>
                  </g>
                )
              })}

              <path d={smoothPath(oddSemesterPoints)} className="semester-trend-line odd" />
              <path d={smoothPath(evenSemesterPoints)} className="semester-trend-line even" />

              {oddSemesterPoints.map((point, index) => (
                <circle key={`odd-${index}`} cx={point.x} cy={point.y} r="3.5" className="semester-trend-point odd">
                  <title>{`${semesterTrend[index].label}: Odd semesters ${currency.format(semesterTrend[index].odd)}`}</title>
                </circle>
              ))}
              {evenSemesterPoints.map((point, index) => (
                <circle key={`even-${index}`} cx={point.x} cy={point.y} r="3.5" className="semester-trend-point even">
                  <title>{`${semesterTrend[index].label}: Even semesters ${currency.format(semesterTrend[index].even)}`}</title>
                </circle>
              ))}

              {semesterTrend.map((month, index) => (
                <text key={month.key} x={pointX(index)} y="198" textAnchor="middle" className="semester-trend-axis-label">{month.label}</text>
              ))}
            </svg>
            <div className="semester-trend-legend" aria-label="Chart legend">
              <span><i className="odd" /> Odd semesters</span>
              <span><i className="even" /> Even semesters</span>
            </div>
          </>
        )}
          </div>
          {courseCollectionError && (
            <p className="course-collection-message" role="alert">
              {courseCollectionError}
            </p>
          )}

          {!courseCollections && !courseCollectionError && (
            <p className="course-collection-message">
              Loading course collections…
            </p>
          )}
        </article>

        <article className="panel breakdown-panel">
          <div className="panel-heading">
            <button
              className="fee-breakdown-link"
              onClick={onFeeStructure}
            >
              <span>Fee collection by course</span>
              <small>Collected across courses</small>
            </button>

            <button
              className="more-button"
              aria-label="Refresh course collections"
              title="Refresh course collections"
              onClick={() => setRefreshKey(key => key + 1)}
            >
              ···
            </button>
          </div>

          <div className="donut-area">
            <div
              className="donut"
              style={{ background: donutBackground }}
            >
              <div>
                <strong>
                  {courseCollections
                    ? currency.format(courseCollections.totalCollected)
                    : '—'}
                </strong>
                <span>Total collected</span>
              </div>
            </div>
          </div>

          <div className="breakdown-list">
            {courseCollections?.courses.map((course, index) => (
              <div key={course.courseId}>
                <span
                  className="category-dot"
                  style={{
                    backgroundColor:
                      courseColors[index % courseColors.length],
                  }}
                />
                <span className="category-name">
                  {course.courseName}
                </span>
                <strong>{currency.format(course.amount)}</strong>
                <small>
                  {Number(course.sharePercent.toFixed(2)).toLocaleString(
                    'en-IN',
                  )}
                  %
                </small>
              </div>
            ))}

            {courseCollections?.courses.length === 0 && (
              <p className="course-collection-message">
                No course collections recorded.
              </p>
            )}

            {courseCollectionError && (
              <p className="course-collection-message" role="alert">
                {courseCollectionError}
              </p>
            )}
          </div>
        </article>
      </section>



      <footer className="page-footer">
        <span>© 2026 ICCMRT Fee Management</span>
        <span>
          Need help?{' '}
          <a href="mailto:support@iccmrt.edu.in">
            Contact support
          </a>
        </span>
      </footer>
    </>
  )
}
