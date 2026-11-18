import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/colors'

type SummaryMetricCardProps = { label: string; value: string; suffix?: string }

export function SummaryMetricCard({ label, value, suffix }: SummaryMetricCardProps) {
  return <View style={styles.card}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}{suffix && <Text style={styles.suffix}>{suffix}</Text>}</Text></View>
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.navy },
  label: { color: '#8995a4', fontSize: 12, fontWeight: '800', letterSpacing: 0.7 },
  value: { color: '#1d3048', fontSize: 19, fontWeight: '800', marginTop: 7 },
  suffix: { color: '#9aa5b2', fontSize: 14, fontWeight: '600' },
})
