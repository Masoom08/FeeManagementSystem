import iccmrtLogo from '../../../assets/logo-iccmrt.png'
import type { ApiReceipt } from '../../../api/client'
import './InvoiceTemplate.css'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function durationFor(courseName: string) {
  return courseName.toUpperCase().startsWith('MBA') ? '2 years' : '3 years'
}

function particulars(allocation: ApiReceipt['allocations'][number]) {
  const product = allocation.product === 'HOSTEL' ? 'Hostel' : 'Academic'
  const component = allocation.bucket === 'DEPOSIT' ? 'security deposit' : 'fee'
  return `${product} ${component}${allocation.semesterName ? ` · ${allocation.semesterName}` : ''}`
}

export function InvoiceTemplate({ receipt, onClose }: { receipt: ApiReceipt; onClose: () => void }) {
  const students = [...new Map(receipt.allocations.map((item) => [item.student.id, item.student])).values()]
  const accountBalances = new Map<number, number>()
  for (const allocation of receipt.allocations) accountBalances.set(allocation.feeAccountId, allocation.balanceOutstanding)
  const balanceDue = [...accountBalances.values()].reduce((sum, amount) => sum + amount, 0)
  const firstStudent = students[0]
  const paymentDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(receipt.paidOn))

  return <div className="invoice-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="invoice-dialog" role="dialog" aria-modal="true" aria-labelledby="invoice-title">
      <div className="invoice-toolbar">
        <span>Payment receipt</span>
        <div><button type="button" className="invoice-print-button" onClick={() => window.print()}>Print / Save PDF</button><button type="button" className="invoice-close-button" onClick={onClose} aria-label="Close receipt">×</button></div>
      </div>
      <article className="invoice-paper">
        <header className="invoice-institution-header">
          <img src={iccmrtLogo} alt="ICCMRT institute logo" />
          <div><h1 id="invoice-title">ICCMRT</h1><p>Institute of Co-operative &amp; Corporate Management, Research &amp; Training</p><span>FEE PAYMENT RECEIPT</span></div>
          <div className="invoice-receipt-number"><small>RECEIPT NO.</small><strong>{receipt.receiptNo}</strong></div>
        </header>

        <section className="invoice-details-grid" aria-label="Receipt details">
          <div><span>Student name</span><strong>{students.map(student => student.name).join(', ') || '—'}</strong></div>
          <div><span>Registration number</span><strong>{students.map(student => student.registrationNumber).join(', ') || '—'}</strong></div>
          <div><span>Course</span><strong>{[...new Set(students.map(student => student.courseName))].join(', ') || '—'}</strong></div>
          <div><span>Course duration</span><strong>{firstStudent ? durationFor(firstStudent.courseName) : '—'}</strong></div>
          <div><span>Date of payment</span><strong>{paymentDate}</strong></div>
          <div><span>Paid by</span><strong>{receipt.method}</strong></div>
        </section>

        <table className="invoice-lines">
          <thead><tr><th>Sr. No.</th><th>Particulars</th><th>Amount</th></tr></thead>
          <tbody>{receipt.allocations.map((allocation, index) => <tr key={allocation.id}>
            <td>{index + 1}</td><td>{particulars(allocation)}{students.length > 1 && <small>{allocation.student.name} · {allocation.student.registrationNumber}</small>}</td><td>{currency.format(allocation.amount)}</td>
          </tr>)}</tbody>
          <tfoot><tr><td colSpan={2}>Total paid</td><td>{currency.format(receipt.amount)}</td></tr></tfoot>
        </table>

        <div className="invoice-balance-row"><span>Balance due after payment</span><strong>{currency.format(balanceDue)}</strong></div>
        <div className="invoice-signatures"><div><span>Authorized signature</span></div><div><span>Student signature</span></div></div>
        <footer className="invoice-footer">Please retain this receipt for your records. Amounts paid are non-refundable except as approved under institute policy.</footer>
      </article>
    </section>
  </div>
}
