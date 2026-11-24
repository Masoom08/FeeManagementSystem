import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/colors'
import { formatCurrency } from '../utils/formatCurrency'

export type PaymentBreakdownLine = {
  label: string
  amount: number
  note?: string
}

export function FullPaymentBreakdown({ lines, total, dueNow }: { lines: PaymentBreakdownLine[]; total: number; dueNow?: number }) {
  return (
    <View style={styles.box}>
      {lines.map(line => (
        <View key={line.label} style={styles.row}>
          <View style={styles.labelColumn}>
            <Text style={styles.label}>{line.label}</Text>
            {line.note ? <Text style={styles.note}>{line.note}</Text> : null}
          </View>
          <Text style={styles.amount}>{formatCurrency(line.amount)}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Remaining balance</Text>
        <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
      </View>
      {dueNow != null && dueNow !== total ? <Text style={styles.note}>Due now {formatCurrency(dueNow)}. Later semesters are not billed yet.</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#edf1f5' },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  labelColumn: { flex: 1 },
  label: { color: '#3f5268', fontSize: 13, fontWeight: '700' },
  note: { color: '#8b97a5', fontSize: 11, lineHeight: 16, marginTop: 2 },
  amount: { color: '#243851', fontSize: 13, fontWeight: '800' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#edf1f5' },
  totalLabel: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  totalAmount: { color: colors.navy, fontSize: 15, fontWeight: '800' },
})
