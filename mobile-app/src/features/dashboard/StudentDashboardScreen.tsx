import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ScrollViewInstance } from 'react-native'
import { DashboardHeader } from '../../components/DashboardHeader'
import { DashboardTabs, type DashboardTab } from '../../components/DashboardTabs'
import { PaymentOptionsTable } from '../../components/PaymentOptionsTable'
import { ReceiptHistoryTable } from '../../components/ReceiptHistoryTable'
import { StudentSidebar } from '../../components/StudentSidebar'
import { SummaryMetricCard } from '../../components/SummaryMetricCard'
import { completeMockStudentPayment, createStudentPayment, loadStudentProfile, loadStudentReceipts } from '../../services/studentApi'
import { colors } from '../../theme/colors'
import type { PaymentReceipt, SemesterFee, Student } from '../../types/fee'
import { formatCurrency } from '../../utils/formatCurrency'

type StudentDashboardScreenProps = { token: string; student: Student; onSignOut: () => void }

export function StudentDashboardScreen({ token, student, onSignOut }: StudentDashboardScreenProps) {
  const [fees, setFees] = useState<SemesterFee[]>([])
  const [isPaying, setIsPaying] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('pay')
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([])
  const [customAmount, setCustomAmount] = useState('')
  const [isCustomAmountFocused, setIsCustomAmountFocused] = useState(false)
  const dashboardScrollRef = useRef<ScrollViewInstance | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([loadStudentProfile(token), loadStudentReceipts(token)]).then(([profile, history]) => {
      if (active) { setFees(profile.fees); setReceipts(history) }
    }).catch(error => Alert.alert('Could not load account', error instanceof Error ? error.message : 'Please try again.'))
    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (!isCustomAmountFocused) return
    const scrollToInput = () => dashboardScrollRef.current?.scrollToEnd({ animated: true })
    const keyboardSubscription = Keyboard.addListener('keyboardDidShow', scrollToInput)
    const fallbackTimer = setTimeout(scrollToInput, 500)
    return () => {
      keyboardSubscription.remove()
      clearTimeout(fallbackTimer)
    }
  }, [isCustomAmountFocused])

  const currentFee = fees.find(fee => fee.status === 'Due')
  const paidTotal = useMemo(() => fees.reduce((sum, fee) => sum + fee.paid, 0), [fees])
  const payableFees = fees.filter(fee => fee.status === 'Due' || fee.status === 'Upcoming')
  const fullPaymentAmount = payableFees.reduce((sum, fee) => sum + Math.max(0, fee.fee - fee.paid), 0)

  const simulatePaymentResult = async (orderId: string, result: 'success' | 'failure') => {
    try {
      const payment = await completeMockStudentPayment(token, orderId, result)
      const [profile, history] = await Promise.all([loadStudentProfile(token), loadStudentReceipts(token)])
      setFees(profile.fees)
      setReceipts(history)
      Alert.alert(payment.status === 'SUCCESS' ? 'Mock payment successful' : 'Mock payment failed', payment.status === 'SUCCESS' ? `Receipt ${payment.receiptNo} is ready to download.` : 'The failed payment was saved. No receipt was issued.')
    } catch (error) {
      Alert.alert('Could not update payment', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setCustomAmount('')
    }
  }

  const startPayment = async (paymentType: 'semester' | 'full' | 'custom') => {
    const selectedFees = paymentType === 'semester' ? (currentFee ? [currentFee] : []) : payableFees
    const amount = paymentType === 'custom'
      ? Number(customAmount)
      : selectedFees.reduce((sum, fee) => sum + Math.max(0, fee.fee - fee.paid), 0)
    if (selectedFees.length === 0 || amount <= 0) return
    if (amount > fullPaymentAmount) {
      Alert.alert('Amount is too high', `Enter an amount up to ${formatCurrency(fullPaymentAmount)}.`)
      return
    }
    setIsPaying(true)
    try {
      const result = await createStudentPayment(token, amount, `MOBILE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      Alert.alert('Mock payment started', `Order ${result.orderId} is saved as pending. Choose a simulator result.`, [
        { text: 'Simulate success', onPress: () => { void simulatePaymentResult(result.orderId, 'success') } },
        { text: 'Simulate failure', style: 'destructive', onPress: () => { void simulatePaymentResult(result.orderId, 'failure') } },
        { text: 'Later', style: 'cancel', onPress: () => setCustomAmount('') },
      ])
    } catch (error) {
      Alert.alert('Could not create payment', error instanceof Error ? error.message : 'Please try again later.')
    } finally {
      setIsPaying(false)
    }
  }

  const downloadReceipt = async (receipt: PaymentReceipt) => {
    try {
      const { downloadFeeReceipt } = await import('../../services/feeReceiptService')
      await downloadFeeReceipt(student, receipt)
    } catch (error) {
      Alert.alert('Could not open receipt tools', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <>
      <DashboardHeader firstName={student.name.split(' ')[0]} onOpenMenu={() => setIsSidebarOpen(true)}/>
      <StudentSidebar
        visible={isSidebarOpen}
        student={student}
        onClose={() => setIsSidebarOpen(false)}
        onSignOut={() => { setIsSidebarOpen(false); onSignOut() }}
      />
      <KeyboardAvoidingView style={styles.keyboardSafeArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={dashboardScrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.metrics}>
          <SummaryMetricCard label="PAID TO DATE" value={formatCurrency(paidTotal)}/>
          <SummaryMetricCard label="FULL PAYMENT BALANCE" value={formatCurrency(fullPaymentAmount)}/>
        </View>

        <DashboardTabs activeTab={activeTab} receiptCount={receipts.length} onChange={setActiveTab}/>

        {activeTab === 'pay' ? <>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionTitle}>Pay fees</Text><Text style={styles.sectionSubtitle}>Choose the current semester or full remaining balance</Text></View>
            <Text style={styles.currencyTag}>INR</Text>
          </View>
          <PaymentOptionsTable
            currentFee={currentFee}
            fullPaymentAmount={fullPaymentAmount}
            payableSemesters={payableFees.map(fee => fee.semester)}
            isPaying={isPaying}
            customAmount={customAmount}
            onCustomAmountChange={setCustomAmount}
            onCustomAmountFocusChange={setIsCustomAmountFocused}
            onPayCurrent={() => startPayment('semester')}
            onPayFull={() => startPayment('full')}
            onPayCustom={() => startPayment('custom')}
          />
        </> : <>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionTitle}>Receipts</Text><Text style={styles.sectionSubtitle}>Payment history and downloadable PDF receipts</Text></View>
            <Text style={styles.receiptCount}>{receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'}</Text>
          </View>
          <ReceiptHistoryTable receipts={receipts} onDownload={downloadReceipt}/>
        </>}

        <View style={styles.securityNote}><Text style={styles.securityIcon}>◇</Text><Text style={styles.securityText}>Mock payments create a pending order. Choose success or failure to simulate the result and save it to your payment history.</Text></View>
        <Text style={styles.footer}>Need help with your fees? Contact the institute accounts office.</Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  keyboardSafeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 35 },
  metrics: { flexDirection: 'row', gap: 11, marginTop: 12 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 11, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: '#0d335f', backgroundColor: colors.navy },
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: '#d5e3f2', fontSize: 12, marginTop: 5 },
  currencyTag: { color: colors.navy, backgroundColor: '#ffc000', borderRadius: 5, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 11, fontWeight: '800' },
  receiptCount: { color: colors.navy, backgroundColor: '#ffc000', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6, fontSize: 11, fontWeight: '800' },
  securityNote: { flexDirection: 'row', gap: 10, padding: 12, marginTop: 15, borderRadius: 10, backgroundColor: '#eaf1f8' },
  securityIcon: { color: '#396b98', fontSize: 19, fontWeight: '700' },
  securityText: { flex: 1, color: '#62758a', fontSize: 12, lineHeight: 18 },
  footer: { textAlign: 'center', color: '#9aa4b0', fontSize: 11, lineHeight: 17, marginTop: 18 },
})
