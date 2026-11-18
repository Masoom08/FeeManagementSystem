import { useMemo, useState } from 'react'
import { Icon } from '../../../components/ui/AppIcon'
import { studentFeeRecords } from '../../../data/mockData'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
type OverviewDashboardProps = { onNotice: (message: string) => void; onFeeStructure: () => void }

function exportFeeReport() {
  const reportRows = studentFeeRecords.map(student => ({
    ...student,
    balance: Math.max(0, student.feeDue - student.amountPaid),
  }))
  const totalDue = reportRows.reduce((total, student) => total + student.feeDue, 0)
  const totalCollected = reportRows.reduce((total, student) => total + student.amountPaid, 0)
  const totalOutstanding = reportRows.reduce((total, student) => total + student.balance, 0)
  const paidCount = reportRows.filter(student => student.status === 'Paid').length
  const summaryRows = [
    ['ICCMRT FEE MANAGEMENT REPORT', `Generated ${new Date().toLocaleDateString('en-IN')}`],
    [],
    ['Summary', 'Value'],
    ['Student accounts', reportRows.length],
    ['Paid accounts', paidCount],
    ['Unpaid accounts', reportRows.length - paidCount],
    ['Fees due (INR)', totalDue],
    ['Collected (INR)', totalCollected],
    ['Outstanding (INR)', totalOutstanding],
  ]
  const studentRows = [
    ['Registration No.', 'Student', 'Batch', 'Course', 'Year', 'Period', 'Semester', 'Fee Due (INR)', 'Paid (INR)', 'Balance (INR)', 'Payment Date', 'Due Date', 'Status'],
    ...reportRows.map(student => [
      student.registrationNo, student.name, student.batch, student.course, student.studyYear,
      `${student.startDate.slice(-4)} - ${student.endDate.slice(-4)}`, student.semester,
      student.feeDue, student.amountPaid, student.balance, student.paymentDate ?? '', student.dueDate, student.status,
    ]),
  ]
  const xmlEscape = (value: string | number) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
  const cellBorders = '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8D3DF"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8D3DF"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8D3DF"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8D3DF"/></Borders>'
  const styles = `<Styles>
    <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10" ss:Color="#263445"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Title"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos Display" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#17365D" ss:Pattern="Solid"/></Style>
    <Style ss:ID="ReportDate"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10" ss:Italic="1" ss:Color="#FFFFFF"/><Interior ss:Color="#17365D" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Section"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="11" ss:Bold="1" ss:Color="#17365D"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/></Style>
    <Style ss:ID="ColumnHeader"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Aptos" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1F4E78" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Metric"><Font ss:Bold="1" ss:Color="#17365D"/></Style>
    <Style ss:ID="Money"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="&quot;₹&quot;#,##0;[Red](&quot;₹&quot;#,##0)"/></Style>
    <Style ss:ID="MoneyAlt"><Alignment ss:Horizontal="Right"/><Interior ss:Color="#F2F6FA" ss:Pattern="Solid"/><NumberFormat ss:Format="&quot;₹&quot;#,##0;[Red](&quot;₹&quot;#,##0)"/></Style>
    <Style ss:ID="BodyAlt"><Interior ss:Color="#F2F6FA" ss:Pattern="Solid"/></Style>
    <Style ss:ID="StatusPaid"><Font ss:Bold="1" ss:Color="#26734D"/></Style>
    <Style ss:ID="StatusUnpaid"><Font ss:Bold="1" ss:Color="#B54708"/></Style>
  </Styles>`.replaceAll('</Style>', `${cellBorders}</Style>`)
  const worksheet = (name: string, rows: (string | number)[][], kind: 'summary' | 'students') => {
    const rowXml = rows.map((row, rowIndex) => {
      const height = kind === 'summary' && rowIndex === 0 ? 34 : kind === 'students' && rowIndex === 0 ? 32 : 22
      const cells = row.map((value, columnIndex) => {
        let style = 'Default'
        if (kind === 'summary' && rowIndex === 0) style = columnIndex === 0 ? 'Title' : 'ReportDate'
        else if (kind === 'summary' && rowIndex === 2) style = 'Section'
        else if (kind === 'summary' && rowIndex > 2) style = columnIndex === 0 ? 'Metric' : rowIndex >= 6 ? 'Money' : 'Default'
        else if (kind === 'students' && rowIndex === 0) style = 'ColumnHeader'
        else if (kind === 'students' && columnIndex >= 7 && columnIndex <= 9) style = rowIndex % 2 === 0 ? 'MoneyAlt' : 'Money'
        else if (kind === 'students' && columnIndex === 12) style = value === 'Paid' ? 'StatusPaid' : 'StatusUnpaid'
        else if (kind === 'students' && rowIndex % 2 === 0) style = 'BodyAlt'
        const type = typeof value === 'number' ? 'Number' : 'String'
        return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`
      }).join('')
      return `<Row ss:AutoFitHeight="0" ss:Height="${height}">${cells}</Row>`
    }).join('')
    const columns = kind === 'summary' ? '<Column ss:Width="230"/><Column ss:Width="150"/>' : [100, 150, 55, 110, 50, 100, 90, 95, 95, 105, 110, 100, 75].map(width => `<Column ss:Width="${width}"/>`).join('')
    return `<Worksheet ss:Name="${name}"><Table>${columns}${rowXml}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>${kind === 'summary' ? 3 : 1}</SplitHorizontal><TopRowBottom>${kind === 'summary' ? 3 : 1}</TopRowBottom><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`
  }
  const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">${styles}${worksheet('Summary', summaryRows, 'summary')}${worksheet('Student List', studentRows, 'students')}</Workbook>`
  const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `iccmrt-fee-report-${new Date().toISOString().slice(0, 10)}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function OverviewDashboard({ onNotice, onFeeStructure }: OverviewDashboardProps) {
  const [period, setPeriod] = useState('June installment')
  const collectionByDay = useMemo(() => {
    const totals = Array.from({ length: 10 }, () => 0)
    studentFeeRecords.forEach(student => student.semesterFees.forEach(fee => {
      if (!fee.paymentDate) return
      const month = fee.paymentDate.includes('Jan') ? 'January installment' : 'June installment'
      if (period !== 'All installments' && period !== month) return
      const day = Number(fee.paymentDate.match(/^\d+/)?.[0])
      if (day >= 1 && day <= 10) totals[day - 1] += fee.amountPaid
    }))
    return totals
  }, [period])
  const collectionTotal = collectionByDay.reduce((sum, amount) => sum + amount, 0)
  const targetTotal = collectionTotal / 0.764
  const maxChartValue = Math.max(...collectionByDay, 1)
  const chartPoints = collectionByDay.map((amount, index) => ({ x: index * (620 / 9), y: 118 - (amount / maxChartValue) * 104 }))
  const linePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} V130 H0Z`
  const compactCurrency = (amount: number) => amount >= 100000 ? `${currency.format(amount / 100000)}L` : amount >= 1000 ? `${currency.format(amount / 1000)}k` : currency.format(amount)

  return <>
    <div className="welcome-row"><div><h1>Welcome, Priya<span className="wave"></span></h1><p className="page-subtitle">Manage student accounts, monitor collections, and review fee activity across your institution.</p></div><div className="welcome-actions"><button className="secondary-button" onClick={() => { exportFeeReport(); onNotice('Fee report downloaded successfully.') }}><Icon name="download" size={16}/> Export report</button><button className="primary-button" onClick={() => onNotice('Fee collection is paused for now.')}><Icon name="plus" size={17}/> Record payment</button></div></div>
    <section className="stats-grid" aria-label="Fee summary">
      <article className="stat-card stat-main"><div className="stat-top"><span className="stat-icon indigo"><Icon name="wallet" size={18}/></span><span className="stat-trend">↗ 12.8%</span></div><div className="stat-label">Total collected</div><div className="stat-number">₹4,82,650</div><div className="stat-foot">Compared to ₹4,28,100 last month</div><div className="sparkline"><svg viewBox="0 0 150 34" preserveAspectRatio="none"><path d="M0 27 C15 25 18 29 29 20 S46 25 56 14 S72 20 86 13 S102 17 111 8 S127 17 136 5 S145 9 150 2"/></svg></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-icon green"><Icon name="check" size={18}/></span><span className="stat-note">This month</span></div><div className="stat-label">Payments received</div><div className="stat-number">248</div><div className="stat-foot"><span className="positive">+18</span> compared to last month</div><div className="mini-bars green-bars">{[42,57,48,70,52,78,61,88,69,100,76,90].map((height,index) => <i key={index} style={{height:`${height}%`}}/>)}</div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><Icon name="clock" size={18}/></span><span className="stat-alert">Needs attention</span></div><div className="stat-label">Pending payments</div><div className="stat-number">36</div><div className="stat-foot"><span className="attention">₹1,26,400</span> outstanding amount</div><div className="mini-bars amber-bars">{[70,48,58,40,66,54,78,51,92,62,76,100].map((height,index) => <i key={index} style={{height:`${height}%`}}/>)}</div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-icon rose"><Icon name="receipt" size={18}/></span><span className="stat-note">Across all courses</span></div><div className="stat-label">Total students</div><div className="stat-number">1,284</div><div className="stat-foot"><span className="positive">1,102 active</span> · 182 inactive</div><div className="student-progress"><span/></div></article>
    </section>

    <section className="overview-grid"><article className="panel collection-panel"><div className="panel-heading"><div><h2>Collection overview</h2><p>Collected by scheduled payment date</p></div><select value={period} onChange={event => setPeriod(event.target.value)} aria-label="Payment installment"><option>June installment</option><option>January installment</option><option>All installments</option></select></div><div className="collection-total"><strong>{compactCurrency(collectionTotal)}</strong><span><i/> {collectionTotal ? '76.4%' : '0%'} of target</span></div><div className="progress-track"><span style={{ width: collectionTotal ? '76.4%' : '0%' }}/></div><div className="progress-labels"><span>₹0</span><strong>Target {compactCurrency(targetTotal)}</strong></div><div className="chart-wrap"><div className="chart-y"><span>{compactCurrency(targetTotal)}</span><span>{compactCurrency(targetTotal * 2 / 3)}</span><span>{compactCurrency(targetTotal / 3)}</span><span>₹0</span></div><div className="chart"><div className="chart-grid"><i/><i/><i/><i/></div><svg viewBox="0 0 620 130" preserveAspectRatio="none" className="chart-svg"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-indigo)" stopOpacity=".2"/><stop offset="100%" stopColor="var(--chart-indigo)" stopOpacity="0"/></linearGradient><linearGradient id="collectionLine" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="var(--chart-red)"/><stop offset="25%" stopColor="var(--chart-gold)"/><stop offset="50%" stopColor="var(--chart-green)"/><stop offset="75%" stopColor="var(--chart-purple)"/><stop offset="100%" stopColor="var(--chart-indigo)"/></linearGradient></defs><path className="chart-fill" d={areaPath}/><path className="chart-line" d={linePath}/>{chartPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="2"/>)}</svg><div className="chart-x"><span>{period === 'January installment' ? '1st Jan' : period === 'June installment' ? '1st Jun' : '1st'}</span><span>{period === 'January installment' ? '3rd Jan' : period === 'June installment' ? '3rd Jun' : '3rd'}</span><span>{period === 'January installment' ? '5th Jan' : period === 'June installment' ? '5th Jun' : '5th'}</span><span>{period === 'January installment' ? '7th Jan' : period === 'June installment' ? '7th Jun' : '7th'}</span><span>{period === 'January installment' ? '10th Jan' : period === 'June installment' ? '10th Jun' : '10th'}</span></div></div></div><div className="chart-legend"><span><i className="legend-paid"/> Amount paid</span><span><i className="legend-target"/> Payment deadline · 10th</span></div></article>
      <article className="panel breakdown-panel"><div className="panel-heading"><button className="fee-breakdown-link" onClick={onFeeStructure}><span>Fee collection by course</span><small>Collected across courses</small></button><button className="more-button" aria-label="Course collection options" onClick={() => onNotice('Course collection options are up to date.')}>···</button></div><div className="donut-area"><div className="donut"><div><strong>₹4.83L</strong><span>Total collected</span></div></div></div><div className="breakdown-list"><div><span className="category-dot dot-purple"/><span className="category-name">BBA (LU)</span><strong>₹1,44,795</strong><small>30%</small></div><div><span className="category-dot dot-blue"/><span className="category-name">B.Com (Hons.)</span><strong>₹96,530</strong><small>20%</small></div><div><span className="category-dot dot-orange"/><span className="category-name">BBA (AKTU)</span><strong>₹1,20,663</strong><small>25%</small></div><div><span className="category-dot dot-gray"/><span className="category-name">MBA</span><strong>₹1,20,662</strong><small>25%</small></div></div></article></section>

    <footer className="page-footer"><span>© 2026 ICCMRT Fee Management</span><span>Need help? <a href="mailto:support@iccmrt.edu.in">Contact support</a></span></footer>
  </>
}





