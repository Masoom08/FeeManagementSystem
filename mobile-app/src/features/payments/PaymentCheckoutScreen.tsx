import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { FullPaymentBreakdown, type PaymentBreakdownLine } from '../../components/FullPaymentBreakdown'
import { confirmStudentPayment, PaymentConfirmError } from '../../services/studentApi'
import { colors } from '../../theme/colors'
import type { PaymentReceipt, Student } from '../../types/fee'
import { formatCurrency } from '../../utils/formatCurrency'

export type FeeCheckout = {
  title: string
  detail: string
  amount: number
  semesters: number[]
  lines?: PaymentBreakdownLine[]
  balance?: number
  product?: 'ACADEMIC' | 'HOSTEL'
}

type PaymentMethodId = 'upi' | 'card' | 'netbanking'

const paymentMethods: { id: PaymentMethodId; label: string; hint: string }[] = [
  { id: 'upi', label: 'UPI', hint: 'Google Pay, PhonePe, BHIM' },
  { id: 'card', label: 'Card', hint: 'Debit or credit card' },
  { id: 'netbanking', label: 'Net banking', hint: 'Pay from your bank' },
]

type PaymentCheckoutScreenProps = {
  token: string
  student: Student
  payment: FeeCheckout
  onCancel: () => void
  onRecorded: () => void
  onClose: () => void
}

export function PaymentCheckoutScreen({ token, student, payment, onCancel, onRecorded, onClose }: PaymentCheckoutScreenProps) {
  const [method, setMethod] = useState<PaymentMethodId>('upi')
  const [phase, setPhase] = useState<'review' | 'processing' | 'success'>('review')
  const [errorMessage, setErrorMessage] = useState('')
  const [orderId, setOrderId] = useState<string | undefined>()
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null)
  const selectedMethod = paymentMethods.find(item => item.id === method) ?? paymentMethods[0]

  const payNow = async () => {
    setPhase('processing')
    setErrorMessage('')
    const startedAt = Date.now()
    try {
      const confirmed = await confirmStudentPayment(token, payment.amount, orderId, payment.product)
      const elapsed = Date.now() - startedAt
      if (elapsed < 700) await new Promise(resolve => setTimeout(resolve, 700 - elapsed))
      const paidReceipt: PaymentReceipt = {
        receiptNo: confirmed.receiptNo || '',
        amount: payment.amount,
        paymentDate: new Date().toLocaleDateString('en-IN'),
        semesters: payment.semesters,
        method: selectedMethod.label,
        product: payment.product,
      }
      setReceipt(paidReceipt)
      setPhase('success')
      onRecorded()
    } catch (error) {
      if (error instanceof PaymentConfirmError && error.orderId) setOrderId(error.orderId)
      setErrorMessage(error instanceof Error ? error.message : 'Please try again.')
      setPhase('review')
    }
  }

  const downloadReceipt = async () => {
    if (!receipt) return
    try {
      const { downloadFeeReceipt } = await import('../../services/feeReceiptService')
      await downloadFeeReceipt(student, receipt)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.sectionHeading}>
        <View style={styles.headingCopy}>
          <Text style={styles.sectionTitle}>{phase === 'success' ? 'Payment successful' : 'Checkout'}</Text>
          <Text style={styles.sectionSubtitle}>{phase === 'success' ? 'Your fee payment has been recorded' : 'Review the amount and pay'}</Text>
        </View>
        <Text style={styles.currencyTag}>INR</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.amountLabel}>AMOUNT TO PAY</Text>
        <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
        <Text style={styles.paymentTitle}>{payment.title}</Text>
        <Text style={styles.paymentDetail}>{payment.detail}</Text>
        {payment.lines ? <FullPaymentBreakdown lines={payment.lines} total={payment.balance ?? payment.amount} dueNow={payment.balance != null && payment.balance !== payment.amount ? payment.amount : undefined}/> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>STUDENT</Text>
        <Text style={styles.studentName}>{student.name}</Text>
        <Text style={styles.meta}>{student.registrationNo}</Text>
        <Text style={styles.meta}>{student.course}</Text>
      </View>

      {phase === 'success' && receipt ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Paid {formatCurrency(receipt.amount)}</Text>
          <Text style={styles.successCopy}>{receipt.receiptNo ? `Receipt ${receipt.receiptNo} is ready. ` : ''}Paid on {receipt.paymentDate} with {selectedMethod.label}.</Text>
          {receipt.receiptNo ? <Pressable onPress={() => { void downloadReceipt() }} style={({ pressed }) => [styles.goldButton, pressed && styles.goldPressed]}>
            <Text style={styles.goldLabel}>Download receipt</Text>
          </Pressable> : null}
          <Pressable onPress={onClose} style={({ pressed }) => [styles.navyButton, pressed && styles.navyPressed]}>
            <Text style={styles.navyLabel}>Back to fees</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.methodHeading}>Pay using</Text>
          <View style={styles.methods}>
            {paymentMethods.map(item => {
              const selected = item.id === method
              return (
                <Pressable
                  key={item.id}
                  disabled={phase === 'processing'}
                  onPress={() => setMethod(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.method, selected && styles.methodSelected]}
                >
                  <Text style={styles.methodLabel}>{item.label}</Text>
                  <Text style={styles.methodHint}>{item.hint}</Text>
                </Pressable>
              )
            })}
          </View>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          {phase === 'processing' ? (
            <View style={styles.processing}>
              <ActivityIndicator color={colors.navy}/>
              <Text style={styles.processingText}>Processing payment…</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable onPress={() => { void payNow() }} style={({ pressed }) => [styles.goldButton, pressed && styles.goldPressed]}>
                <Text style={styles.goldLabel}>{orderId ? 'Retry payment' : 'Pay now'}</Text>
              </Pressable>
              <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelPressed]}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 35 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 11, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: '#0d335f', backgroundColor: colors.navy },
  headingCopy: { flex: 1 },
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: '#d5e3f2', fontSize: 12, marginTop: 5 },
  currencyTag: { color: colors.navy, backgroundColor: '#ffc000', borderRadius: 5, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 11, fontWeight: '800' },
  card: { gap: 4, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  amountLabel: { color: '#708094', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  amount: { color: colors.navy, fontSize: 28, fontWeight: '800', marginTop: 2 },
  paymentTitle: { color: '#293b50', fontSize: 14, fontWeight: '800', marginTop: 8 },
  paymentDetail: { color: '#62758a', fontSize: 12, lineHeight: 18 },
  cardLabel: { color: '#708094', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  studentName: { color: '#293b50', fontSize: 15, fontWeight: '800', marginTop: 4 },
  meta: { color: '#62758a', fontSize: 12, marginTop: 2 },
  methodHeading: { color: colors.navyText, fontSize: 13, fontWeight: '800', marginTop: 6, marginBottom: 8 },
  methods: { gap: 8 },
  method: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  methodSelected: { borderColor: colors.navy, borderWidth: 2, backgroundColor: '#f3f7fb' },
  methodLabel: { color: colors.navyText, fontSize: 14, fontWeight: '800' },
  methodHint: { color: '#7e8b9a', fontSize: 12, marginTop: 3 },
  actions: { gap: 10, marginTop: 16 },
  goldButton: { minHeight: 49, borderRadius: 10, backgroundColor: '#ffc000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  goldPressed: { backgroundColor: '#e6ad00' },
  goldLabel: { color: colors.navyText, fontSize: 14, fontWeight: '800' },
  cancelButton: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelPressed: { opacity: 0.7 },
  cancelLabel: { color: colors.slate, fontSize: 14, fontWeight: '700' },
  processing: { minHeight: 72, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  processingText: { color: colors.navy, fontSize: 14, fontWeight: '800' },
  error: { marginTop: 12, color: colors.redAccent, fontSize: 13, fontWeight: '700' },
  successCard: { gap: 10, marginTop: 4, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#cfe8d8', backgroundColor: colors.greenBackground },
  successTitle: { color: colors.green, fontSize: 18, fontWeight: '800' },
  successCopy: { color: '#245c38', fontSize: 13, lineHeight: 19 },
  navyButton: { minHeight: 49, borderRadius: 10, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  navyPressed: { backgroundColor: '#305f91' },
  navyLabel: { color: colors.surface, fontSize: 14, fontWeight: '800' },
})
