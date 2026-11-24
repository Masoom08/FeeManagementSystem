import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { useState } from 'react'
import { FullPaymentBreakdown, type PaymentBreakdownLine } from './FullPaymentBreakdown'
import type { SemesterFee } from '../types/fee'
import { colors } from '../theme/colors'
import { formatCurrency } from '../utils/formatCurrency'

type PaymentOptionsTableProps = {
  currentFee?: SemesterFee
  fullPaymentAmount: number
  fullPaymentLines: PaymentBreakdownLine[]
  payableSemesters: number[]
  isPaying: boolean
  customAmount: string
  onCustomAmountChange: (amount: string) => void
  onCustomAmountFocusChange: (focused: boolean) => void
  onPayCurrent: () => void
  onPayFull: () => void
  onPayCustom: () => void
}

export function PaymentOptionsTable({ currentFee, fullPaymentAmount, fullPaymentLines, payableSemesters, isPaying, customAmount, onCustomAmountChange, onCustomAmountFocusChange, onPayCurrent, onPayFull, onPayCustom }: PaymentOptionsTableProps) {
  const { width } = useWindowDimensions()
  const [isInputFocused, setIsInputFocused] = useState(false)
  const currentBalance = currentFee ? currentFee.fee - currentFee.paid : 0
  const currentEnabled = Boolean(currentFee && currentBalance > 0 && !isPaying)
  const fullEnabled = fullPaymentAmount > 0 && payableSemesters.length > 0 && !isPaying
  const customValue = Number(customAmount)
  const customEnabled = fullPaymentAmount > 0 && customValue > 0 && customValue <= fullPaymentAmount && !isPaying

  if (width < 600) {
    return <View style={styles.mobileList}>
      <View style={styles.mobileCard}>
        <View style={styles.mobileCardTop}><View><View style={styles.currentOptionTitle}><Text style={styles.mobileTitle}>Current semester</Text><Text style={styles.currentTag}>CURRENT</Text></View><Text style={styles.secondaryText}>{currentFee ? `Semester ${currentFee.semester}${currentFee.dueDate ? ` · due ${currentFee.dueDate}` : ''}` : 'No current balance due'}</Text></View><Text style={[styles.mobileAmount, currentBalance > 0 && styles.dueAmount]}>{formatCurrency(currentBalance)}</Text></View>
        <PayButton label="Pay current semester" enabled={currentEnabled} loading={isPaying} onPress={onPayCurrent} compact/>
      </View>
      <View style={styles.mobileCard}>
        <View style={styles.mobileCardTop}><View><Text style={styles.mobileTitle}>Full payment</Text><Text style={styles.secondaryText}>{payableSemesters.length ? `Semesters ${payableSemesters.join(', ')}` : 'No remaining balance'}</Text></View><Text style={styles.mobileAmount}>{formatCurrency(fullPaymentAmount)}</Text></View>
        <FullPaymentBreakdown lines={fullPaymentLines} total={fullPaymentLines.reduce((sum, line) => sum + line.amount, 0)} dueNow={fullPaymentAmount}/>
        <PayButton label="Pay full amount" enabled={fullEnabled} loading={isPaying} onPress={onPayFull} compact/>
      </View>
      <View style={styles.mobileCard}>
        <View style={styles.mobileCardTop}><View><Text style={styles.mobileTitle}>Custom payment</Text><Text style={styles.secondaryText}>{fullPaymentAmount > 0 ? `Choose any amount up to the remaining balance, ${formatCurrency(fullPaymentAmount)}` : 'No remaining balance'}</Text></View></View>
        <TextInput
          value={customAmount}
          onChangeText={value => onCustomAmountChange(value.replace(/\D/g, ''))}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={String(Math.floor(fullPaymentAmount)).length}
          placeholder="Enter amount in rupees"
          placeholderTextColor="#718096"
          selectionColor={colors.blue}
          onFocus={() => { setIsInputFocused(true); onCustomAmountFocusChange(true) }}
          onBlur={() => { setIsInputFocused(false); onCustomAmountFocusChange(false) }}
          style={[styles.customAmountInput, isInputFocused && styles.customAmountInputFocused]}
          accessibilityLabel="Custom payment amount in rupees"
          accessibilityHint={`Enter an amount up to ${formatCurrency(fullPaymentAmount)}`}
        />
        {customAmount !== '' && <Text style={styles.amountPreview}>Amount entered: {formatCurrency(customValue)}</Text>}
        {customAmount !== '' && customValue > fullPaymentAmount && <Text style={styles.validationText}>Amount cannot exceed the remaining balance, {formatCurrency(fullPaymentAmount)}.</Text>}
        <PayButton label="Pay custom amount" enabled={customEnabled} loading={isPaying} onPress={onPayCustom} compact/>
      </View>
    </View>
  }

  return (
    <View style={styles.desktopStack}>
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalContent}>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.optionColumn]}>PAYMENT OPTION</Text>
          <Text style={[styles.headerCell, styles.semesterColumn]}>COVERS</Text>
          <Text style={[styles.headerCell, styles.amountColumn]}>AMOUNT</Text>
          <Text style={[styles.headerCell, styles.actionColumn]}>ACTION</Text>
        </View>
        <View style={styles.bodyRow}>
          <View style={[styles.bodyCell, styles.optionColumn]}><Text style={styles.primaryText}>Current semester</Text><Text style={styles.secondaryText}>{currentFee ? (currentFee.dueDate ? `Due ${currentFee.dueDate}` : `Semester ${currentFee.semester}`) : 'No current balance due'}</Text></View>
          <Text style={[styles.bodyText, styles.semesterColumn]}>{currentFee ? `Semester ${currentFee.semester}` : '—'}</Text>
          <Text style={[styles.amountText, styles.amountColumn, currentBalance > 0 && styles.dueAmount]}>{formatCurrency(currentBalance)}</Text>
          <View style={[styles.actionColumn, styles.actionCell]}><PayButton label="Pay semester" enabled={currentEnabled} loading={isPaying} onPress={onPayCurrent}/></View>
        </View>
        <View style={styles.bodyRow}>
          <View style={[styles.bodyCell, styles.optionColumn]}><Text style={styles.primaryText}>Full payment</Text><Text style={styles.secondaryText}>{payableSemesters.length ? 'All semesters with a remaining fee' : 'No remaining balance'}</Text></View>
          <Text style={[styles.bodyText, styles.semesterColumn]}>{payableSemesters.length ? payableSemesters.map(number => `Sem ${number}`).join(', ') : 'No balance'}</Text>
          <Text style={[styles.amountText, styles.amountColumn]}>{formatCurrency(fullPaymentAmount)}</Text>
          <View style={[styles.actionColumn, styles.actionCell]}><PayButton label="Pay full amount" enabled={fullEnabled} loading={isPaying} onPress={onPayFull}/></View>
        </View>
        <View style={[styles.bodyRow, styles.lastRow]}>
          <View style={[styles.bodyCell, styles.optionColumn]}><Text style={styles.primaryText}>Custom payment</Text><Text style={styles.secondaryText}>{fullPaymentAmount > 0 ? `Any amount up to ${formatCurrency(fullPaymentAmount)}` : 'No remaining balance'}</Text></View>
          <Text style={[styles.bodyText, styles.semesterColumn]}>{payableSemesters.length ? payableSemesters.map(number => `Sem ${number}`).join(', ') : 'No balance'}</Text>
          <TextInput
            value={customAmount}
            onChangeText={value => onCustomAmountChange(value.replace(/\D/g, ''))}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={String(Math.floor(fullPaymentAmount)).length}
            placeholder="Enter amount"
            placeholderTextColor="#718096"
            selectionColor={colors.blue}
            onFocus={() => { setIsInputFocused(true); onCustomAmountFocusChange(true) }}
            onBlur={() => { setIsInputFocused(false); onCustomAmountFocusChange(false) }}
            style={[styles.customAmountInput, styles.amountColumn, isInputFocused && styles.customAmountInputFocused]}
            accessibilityLabel="Custom payment amount in rupees"
            accessibilityHint={`Enter an amount up to ${formatCurrency(fullPaymentAmount)}`}
          />
          <View style={[styles.actionColumn, styles.actionCell]}><PayButton label="Pay custom" enabled={customEnabled} loading={isPaying} onPress={onPayCustom}/></View>
        </View>
      </View>
    </ScrollView>
    {customAmount !== '' && customValue > fullPaymentAmount ? <Text style={styles.validationText}>Amount cannot exceed the remaining balance, {formatCurrency(fullPaymentAmount)}.</Text> : null}
    <View style={styles.desktopBreakdown}>
      <Text style={styles.breakdownTitle}>Full payment breakdown</Text>
      <FullPaymentBreakdown lines={fullPaymentLines} total={fullPaymentLines.reduce((sum, line) => sum + line.amount, 0)} dueNow={fullPaymentAmount}/>
    </View>
    </View>
  )
}

function PayButton({ label, enabled, loading, onPress, compact = false }: { label: string; enabled: boolean; loading: boolean; onPress: () => void; compact?: boolean }) {
  return <Pressable onPress={onPress} disabled={!enabled} style={({ pressed }) => [styles.payButton, compact && styles.compactPayButton, !enabled && styles.disabledButton, pressed && enabled && styles.pressedButton]}><Text numberOfLines={1} style={[styles.payButtonText, !enabled && styles.disabledText]}>{loading ? 'Connecting…' : label}</Text></Pressable>
}

const styles = StyleSheet.create({
  desktopStack: { gap: 10 },
  desktopBreakdown: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  breakdownTitle: { color: '#293b50', fontSize: 14, fontWeight: '800' },
  horizontalContent: { minWidth: '100%' },
  table: { minWidth: 760, flex: 1, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  headerRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4f8', borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCell: { paddingHorizontal: 12, color: '#708094', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  bodyRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf1f5' },
  lastRow: { borderBottomWidth: 0 },
  bodyCell: { justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  optionColumn: { width: 184 },
  semesterColumn: { width: 190, paddingHorizontal: 10 },
  amountColumn: { width: 118, paddingHorizontal: 10 },
  actionColumn: { width: 190, paddingHorizontal: 10 },
  actionCell: { justifyContent: 'center' },
  primaryText: { color: '#293b50', fontSize: 13, fontWeight: '800' },
  secondaryText: { color: '#8b97a5', fontSize: 11, marginTop: 4 },
  bodyText: { color: '#627185', fontSize: 12 },
  amountText: { color: '#243851', fontSize: 14, fontWeight: '800' },
  payButton: { minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 7, backgroundColor: '#ffc000' },
  pressedButton: { backgroundColor: '#e6ad00' },
  disabledButton: { backgroundColor: '#e5eaf0' },
  payButtonText: { color: colors.navyText, fontSize: 12, fontWeight: '800' },
  disabledText: { color: '#8b97a5' },
  mobileList: { gap: 10 },
  mobileCard: { gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  mobileCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  mobileTitle: { color: '#293b50', fontSize: 14, fontWeight: '800' },
  currentOptionTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  currentTag: { overflow: 'hidden', borderRadius: 8, backgroundColor: colors.yellowBackground, color: colors.yellow, paddingHorizontal: 7, paddingVertical: 4, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  mobileAmount: { flexShrink: 0, color: '#243851', fontSize: 15, fontWeight: '800' },
  dueAmount: { color: colors.redAccent },
  compactPayButton: { minHeight: 40, width: '100%' },
  validationText: { color: colors.redAccent, fontSize: 11 },
  customAmountInput: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: '#aab9ca', borderRadius: 8, backgroundColor: '#ffffff', color: '#142c46', fontSize: 16, fontWeight: '700' },
  customAmountInputFocused: { borderColor: colors.blue, borderWidth: 2 },
  amountPreview: { color: '#243851', fontSize: 14, fontWeight: '700' },
})
