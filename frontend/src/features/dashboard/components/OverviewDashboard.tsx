import { useMemo, useState } from 'react'
import { Icon } from '../../../components/ui/AppIcon'
import { api } from '../../../api/client'
import { useAcademicYears, useOverviewReports, useSemesters, useStudents } from '../../../api/queries'
import { semesterLabel, semestersBySession } from '../../academic/labels'
import { toFeeRecord } from '../../students/studentFees'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
type OverviewDashboardProps = { onNotice: (message: string) => void; onFeeStructure: () => void; onStudents: () => void; role: 'TEACHER' | 'SUPERADMIN' }

function monthOf(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getUTCMonth()
}

export function OverviewDashboard({ onNotice, onFeeStructure, onStudents, role }: OverviewDashboardProps) {
  const [period, setPeriod] = useState('June installment')
  const studentsQuery = useStudents()
  const yearsQuery = useAcademicYears()
  const semestersQuery = useSemesters()
  const [semesterId, setSemesterId] = useState('')
  const semesterGroups = useMemo(() => semestersBySession(semestersQuery.data ?? [], yearsQuery.data ?? []), [semestersQuery.data, yearsQuery.data])
  const selectedSemesterId = Number(semesterId || semesterGroups[0]?.semesters[0]?.id || 0) || undefined
  const reports = useOverviewReports(selectedSemesterId)
  const records = useMemo(() => (studentsQuery.data ?? []).map(student => toFeeRecord(student, yearsQuery.data ?? [], semestersQuery.data ?? [])), [studentsQuery.data, yearsQuery.data, semestersQuery.data])
  const fees = records.flatMap(student => student.semesterFees.map(fee => ({ ...fee, course: student.course })))
  const matches = (value: string | null) => {
    const month = monthOf(value)
    if (period === 'June installment') return month === 5
    if (period === 'January installment') return month === 0
    return month != null
  }
  const collectionByDay = useMemo(() => {
    const totals = Array.from({ length: 10 }, () => 0)
    fees.forEach(fee => {
      if (!fee.paymentDate || !matches(fee.paymentDate)) return
      const day = new Date(fee.paymentDate).getUTCDate()
      if (day >= 1 && day <= 10) totals[day - 1] += fee.amountPaid
    })
    return totals
  }, [fees, period])
  const collected = fees.filter(fee => matches(fee.paymentDate)).reduce((sum, fee) => sum + fee.amountPaid, 0)
  const assessed = fees.filter(fee => matches(fee.dueDate)).reduce((sum, fee) => sum + fee.feeDue, 0)
  const paidPercent = assessed ? Math.min(100, Math.round((collected / assessed) * 1000) / 10) : 0
  const paymentCount = fees.filter(fee => fee.amountPaid > 0 && matches(fee.paymentDate)).length
  const pendingCount = records.filter(student => student.balance > 0).length
  const outstanding = records.reduce((sum, student) => sum + student.balance + student.hostelOutstanding, 0)
  const activeCount = records.filter(student => student.studentStatus === 'ACTIVE').length
  const maxChartValue = Math.max(...collectionByDay, 1)
  const chartPoints = collectionByDay.map((amount, index) => ({ x: index * (620 / 9), y: 118 - (amount / maxChartValue) * 104 }))
  const linePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} V130 H0Z`
  const compactCurrency = (amount: number) => amount >= 100000 ? `${currency.format(amount / 100000)}L` : amount >= 1000 ? `${currency.format(amount / 1000)}k` : currency.format(amount)
  const byCourse = new Map<string, number>()
  fees.filter(fee => matches(fee.paymentDate)).forEach(fee => byCourse.set(fee.course, (byCourse.get(fee.course) ?? 0) + fee.amountPaid))
  const courseRows = [...byCourse.entries()].sort((a, b) => b[1] - a[1])
  const courseTotal = courseRows.reduce((sum, [, amount]) => sum + amount, 0) || 1
  const palette = ['var(--chart-gold)', 'var(--chart-indigo)', 'var(--chart-green)', 'var(--chart-red)', 'var(--chart-purple)']
  let cursor = 0
  const donut = courseRows.length ? `conic-gradient(${courseRows.map(([, amount], index) => { const start = cursor; cursor += (amount / courseTotal) * 100; return `${palette[index % palette.length]} ${start}% ${cursor}%` }).join(',')})` : undefined
  const report = reports.data

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
      onNotice(error instanceof Error ? error.message : 'Could not download the payments report.')
    }
  }

  return <>
    <div className="welcome-row"><div><h1>Welcome, {role === 'SUPERADMIN' ? 'Super Admin' : 'Teacher'}<span className="wave"></span></h1><p className="page-subtitle">Manage student accounts, monitor collections, and review fee activity across your institution.</p></div><div className="welcome-actions"><button className="secondary-button" onClick={() => void exportFeeReport()}><Icon name="download" size={16}/> Export report</button><button className="primary-button" onClick={onStudents}><Icon name="plus" size={17}/> Record payment</button></div></div>
    <section className="stats-grid" aria-label="Fee summary">
      <article className="stat-card stat-main"><div className="stat-top"><span className="stat-icon indigo"><Icon name="wallet" size={18}/></span><span className="stat-trend">{paidPercent}%</span></div><div className="stat-label">Total collected</div><div className="stat-number">{currency.format(collected)}</div><div className="stat-foot">{paidPercent}% of {currency.format(assessed)} assessed in this installment</div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-icon green"><Icon name="check" size={18}/></span><span className="stat-note">This installment</span></div><div className="stat-label">Payments received</div><div className="stat-number">{paymentCount}</div><div className="stat-foot">Paid semester rows in the selected installment</div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><Icon name="clock" size={18}/></span><span className="stat-alert">Needs attention</span></div><div className="stat-label">Pending payments</div><div className="stat-number">{pendingCount}</div><div className="stat-foot"><span className="attention">{currency.format(outstanding)}</span> outstanding amount</div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-icon rose"><Icon name="receipt" size={18}/></span><span className="stat-note">Across all courses</span></div><div className="stat-label">Total students</div><div className="stat-number">{records.length}</div><div className="stat-foot"><span className="positive">{activeCount} active</span> · {records.length - activeCount} inactive</div></article>
    </section>

    <section className="overview-grid"><article className="panel collection-panel"><div className="panel-heading"><div><h2>Collection overview</h2><p>Collected by scheduled payment date</p></div><select value={period} onChange={event => setPeriod(event.target.value)} aria-label="Payment installment"><option>June installment</option><option>January installment</option><option>All installments</option></select></div><div className="collection-total"><strong>{compactCurrency(collected)}</strong><span><i/> {paidPercent}% of assessed</span></div><div className="progress-track"><span style={{ width: `${paidPercent}%` }}/></div><div className="progress-labels"><span>₹0</span><strong>Assessed {compactCurrency(assessed)}</strong></div><div className="chart-wrap"><div className="chart-y"><span>{compactCurrency(maxChartValue)}</span><span>{compactCurrency(maxChartValue * 2 / 3)}</span><span>{compactCurrency(maxChartValue / 3)}</span><span>₹0</span></div><div className="chart"><div className="chart-grid"><i/><i/><i/><i/></div><svg viewBox="0 0 620 130" preserveAspectRatio="none" className="chart-svg"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-indigo)" stopOpacity=".2"/><stop offset="100%" stopColor="var(--chart-indigo)" stopOpacity="0"/></linearGradient><linearGradient id="collectionLine" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="var(--chart-red)"/><stop offset="25%" stopColor="var(--chart-gold)"/><stop offset="50%" stopColor="var(--chart-green)"/><stop offset="75%" stopColor="var(--chart-purple)"/><stop offset="100%" stopColor="var(--chart-indigo)"/></linearGradient></defs><path className="chart-fill" d={areaPath}/><path className="chart-line" d={linePath}/>{chartPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="2"/>)}</svg><div className="chart-x"><span>{period === 'January installment' ? '1st Jan' : period === 'June installment' ? '1st Jun' : '1st'}</span><span>{period === 'January installment' ? '3rd Jan' : period === 'June installment' ? '3rd Jun' : '3rd'}</span><span>{period === 'January installment' ? '5th Jan' : period === 'June installment' ? '5th Jun' : '5th'}</span><span>{period === 'January installment' ? '7th Jan' : period === 'June installment' ? '7th Jun' : '7th'}</span><span>{period === 'January installment' ? '10th Jan' : period === 'June installment' ? '10th Jun' : '10th'}</span></div></div></div><div className="chart-legend"><span><i className="legend-paid"/> Amount paid</span><span><i className="legend-target"/> Payment deadline · 10th</span></div></article>
      <article className="panel breakdown-panel"><div className="panel-heading"><button className="fee-breakdown-link" onClick={onFeeStructure}><span>Fee collection by course</span><small>Collected across courses</small></button></div><div className="donut-area"><div className="donut" style={donut ? { background: donut } : undefined}><div><strong>{compactCurrency(courseTotal === 1 && courseRows.length === 0 ? 0 : courseRows.reduce((sum, [, amount]) => sum + amount, 0))}</strong><span>Total collected</span></div></div></div><div className="breakdown-list">{courseRows.length === 0 ? <div><span className="category-name">No collections in this installment</span></div> : courseRows.map(([name, amount]) => <div key={name}><span className="category-name">{name}</span><strong>{currency.format(amount)}</strong><small>{Math.round((amount / courseTotal) * 100)}%</small></div>)}</div></article></section>

    <section className="panel" aria-label="Management review">
      <div className="panel-heading"><div><h2>Management review</h2><p>On-time payments, waivers, fines, students who left, failed payments, and reconciliation.</p></div><select aria-label="Review semester" value={String(selectedSemesterId ?? '')} onChange={event => setSemesterId(event.target.value)}>{semesterGroups.flatMap(group => group.semesters).map(semester => <option key={semester.id} value={semester.id}>{semesterLabel(semester, yearsQuery.data ?? [])}</option>)}</select></div>
      {reports.isLoading && <p>Loading reports…</p>}
      {reports.error && <p role="alert">{reports.error instanceof Error ? reports.error.message : 'Could not load reports.'}</p>}
      {report && <div className="breakdown-list">
        <div><span className="category-name">Paid on time</span><strong>{report.onTime.percent}%</strong><small>{report.onTime.onTimeCount}/{report.onTime.assessedCount}</small></div>
        <div><span className="category-name">Fines waived</span><strong>{report.waivers.percent}%</strong><small>{report.waivers.waiverStudentCount}/{report.waivers.finedStudentCount}</small></div>
        <div><span className="category-name">Semester fines</span><strong>{currency.format(report.fines.total)}</strong><small>{report.fines.byCourse.map(course => `${course.courseCode} ${currency.format(course.total)}`).join(' · ') || 'None'}</small></div>
        <div><span className="category-name">Unpaid students</span><strong>{report.unpaid.length}</strong><small>{currency.format(report.unpaid.reduce((sum, row) => sum + row.duesOutstanding, 0))} due</small></div>
        <div><span className="category-name">Students who left</span><strong>{report.left.length}</strong></div>
        <div><span className="category-name">Failed payments</span><strong>{report.failed.length}</strong><small>{report.failed.slice(0, 3).map(payment => `${payment.registrationNumbers.join(', ') || 'Unknown'} · ${payment.status} · ${currency.format(payment.amount)}`).join(' · ') || 'None'}</small></div>
        {report.reconciliation.courses.map(course => <div key={course.courseCode}><span className="category-name">{course.courseCode} reconciliation</span><small>{course.products.map(product => `${product.product}: assessed ${currency.format(product.assessed)}, paid ${currency.format(product.paid)}, fines ${currency.format(product.fines)}, waivers ${currency.format(product.waivers)}, refunds ${currency.format(product.refunds)}, due ${currency.format(product.duesOutstanding)}`).join(' · ') || 'No ledger rows'}</small></div>)}
      </div>}
    </section>

    <footer className="page-footer"><span>© 2026 ICCMRT Fee Management</span><span>Need help? <a href="mailto:support@iccmrt.edu.in">Contact support</a></span></footer>
  </>
}
