import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { AppText } from './AppText'
import { colors } from '../theme/colors'
import { formatCurrency } from '../utils/formatCurrency'

export type HostelSeatChoice = { id: number; condition: string; occupancy: string; annualFee: number }

export function HostelFeeCard({ amount, onPay, seat, rates, saving, onSelect }: {
  amount: number
  onPay: () => void
  seat: HostelSeatChoice | null
  rates: HostelSeatChoice[]
  saving: boolean
  onSelect: (hostelRateId: number) => void
}) {
  const [open, setOpen] = useState(false)
  const canPay = amount > 0
  const groups = ['AC', 'Non-AC'].map(condition => ({ condition, rates: rates.filter(rate => rate.condition === condition) })).filter(group => group.rates.length > 0)
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <AppText style={styles.title}>Hostel fees</AppText>
          <AppText style={styles.detail}>{seat ? `${seat.condition} · ${seat.occupancy}` : 'No hostel seat selected'}</AppText>
          <AppText style={styles.note}>A change does not alter hostel fees already billed.</AppText>
        </View>
        <AppText style={styles.amount}>{formatCurrency(amount)}</AppText>
      </View>
      <Pressable onPress={() => setOpen(value => !value)} disabled={saving} style={({ pressed }) => [styles.seatButton, pressed && styles.buttonPressed]}>
        <AppText style={styles.seatButtonLabel}>{saving ? 'Saving…' : seat ? 'Change seat' : 'Choose seat'}</AppText>
      </Pressable>
      {open && <View style={styles.choices}>
        {groups.map(group => <View key={group.condition} style={styles.group}>
          <AppText style={styles.groupTitle}>{group.condition}</AppText>
          {group.rates.map(rate => {
            const selected = seat?.id === rate.id
            return <Pressable key={rate.id} disabled={saving || selected} onPress={() => { onSelect(rate.id); setOpen(false) }} style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && !selected && styles.buttonPressed]}>
              <AppText style={styles.choiceLabel}>{rate.occupancy}</AppText>
              <AppText style={styles.choiceFee}>{formatCurrency(rate.annualFee)}</AppText>
            </Pressable>
          })}
        </View>)}
      </View>}
      <Pressable onPress={onPay} disabled={!canPay} style={({ pressed }) => [styles.button, !canPay && styles.buttonDisabled, pressed && canPay && styles.buttonPressed]}>
        <AppText style={[styles.buttonLabel, !canPay && styles.buttonLabelDisabled]}>Pay hostel fees</AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: 12, marginTop: 10, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  copy: { flex: 1 },
  title: { color: '#293b50', fontSize: 14, fontWeight: '800' },
  detail: { color: '#243851', fontSize: 13, fontWeight: '700', marginTop: 4 },
  note: { color: '#8b97a5', fontSize: 12, marginTop: 4, lineHeight: 17 },
  amount: { color: '#243851', fontSize: 15, fontWeight: '800' },
  seatButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#0d335f', backgroundColor: '#fff' },
  seatButtonLabel: { color: colors.navyText, fontSize: 12, fontWeight: '800' },
  choices: { gap: 10 },
  group: { gap: 6 },
  groupTitle: { color: '#5d7084', fontSize: 11, fontWeight: '800' },
  choice: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  choiceSelected: { borderColor: '#0d335f', backgroundColor: '#eaf1f8' },
  choiceLabel: { color: '#243851', fontSize: 13, fontWeight: '700' },
  choiceFee: { color: '#243851', fontSize: 13, fontWeight: '800' },
  button: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#ffc000' },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { backgroundColor: '#e5eaf0' },
  buttonLabel: { color: colors.navyText, fontSize: 12, fontWeight: '800' },
  buttonLabelDisabled: { color: '#8b97a5' },
})
