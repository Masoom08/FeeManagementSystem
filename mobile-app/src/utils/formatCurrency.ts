export function formatCurrency(amount: number) {
  return `\u20B9${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`
}
