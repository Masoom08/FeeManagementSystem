import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { AppText } from '../../components/AppText'
import type { ScrollViewInstance } from 'react-native'
import { DashboardHeader } from '../../components/DashboardHeader'
import { HostelFeeCard, type HostelSeatChoice } from '../../components/HostelFeeCard'
import { DashboardTabs, type DashboardTab } from '../../components/DashboardTabs'
import { PaymentOptionsTable } from '../../components/PaymentOptionsTable'
import { ReceiptHistoryTable } from '../../components/ReceiptHistoryTable'
import { StudentSidebar } from '../../components/StudentSidebar'
import { SummaryMetricCard } from '../../components/SummaryMetricCard'
import { PaymentCheckoutScreen, type FeeCheckout } from '../payments/PaymentCheckoutScreen'
import { displayPaymentMethod, loadStudentProfile, loadStudentReceipts, saveHostelSeat, type StudentPaymentStatus } from '../../services/studentApi'
import { colors } from '../../theme/colors'
import type { PaymentReceipt, SemesterFee, Student } from '../../types/fee'
import { formatCurrency } from '../../utils/formatCurrency'

type StudentDashboardScreenProps = { token: string; student: Student; onSignOut: () => void }

export function StudentDashboardScreen({ token, student, onSignOut }: StudentDashboardScreenProps) {
  const { width } = useWindowDimensions()
  const isWideWeb = Platform.OS === 'web' && width >= 900
  const [account, setAccount] = useState(student)
  const [fees, setFees] = useState<SemesterFee[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('pay')
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([])
  const [customAmount, setCustomAmount] = useState('')
  const [isCustomAmountFocused, setIsCustomAmountFocused] = useState(false)
  const [checkout, setCheckout] = useState<FeeCheckout | null>(null)
  const [paymentNotice, setPaymentNotice] = useState('')
  const [accountPayments, setAccountPayments] = useState<StudentPaymentStatus[]>([])
  const [hostelOutstanding, setHostelOutstanding] = useState(0)
  const [hostelSeat, setHostelSeat] = useState<HostelSeatChoice | null>(null)
  const [hostelRates, setHostelRates] = useState<HostelSeatChoice[]>([])
  const [savingSeat, setSavingSeat] = useState(false)
  const dashboardScrollRef = useRef<ScrollViewInstance | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([loadStudentProfile(token), loadStudentReceipts(token)]).then(([profile, history]) => {
      if (active) { setAccount(profile.student); setFees(profile.fees); setReceipts(history); setAccountPayments(profile.payments); setHostelOutstanding(profile.hostelOutstanding); setHostelSeat(profile.hostelSeat); setHostelRates(profile.hostelRates) }
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

  const currentFee = fees.find(fee => Math.max(0, fee.fee - fee.paid) > 0)
  const paidTotal = useMemo(() => fees.reduce((sum, fee) => sum + fee.paid, 0), [fees])
  const payableFees = fees.filter(fee => Math.max(0, fee.fee - fee.paid) > 0)
  const fullPaymentAmount = payableFees.reduce((sum, fee) => sum + Math.max(0, fee.fee - fee.paid), 0)
  const remainingBalance = useMemo(() => fees.reduce((sum, fee) => sum + Math.max(0, fee.fee - fee.paid), 0), [fees])
  const fullPaymentLines = useMemo(() => fees.map(fee => ({
    label: `Semester ${fee.semester}`,
    amount: Math.max(0, fee.fee - fee.paid),
    note: fee.billed ? undefined : 'Not billed yet',
  })), [fees])

  const refreshAccount = async () => {
    const [profile, history] = await Promise.all([loadStudentProfile(token), loadStudentReceipts(token)])
    setAccount(profile.student)
    setFees(profile.fees)
    setReceipts(history)
    setAccountPayments(profile.payments)
    setHostelOutstanding(profile.hostelOutstanding)
    setHostelSeat(profile.hostelSeat)
    setHostelRates(profile.hostelRates)
  }

  const chooseHostelSeat = async (hostelRateId: number) => {
    setSavingSeat(true)
    try {
      await saveHostelSeat(token, hostelRateId)
      await refreshAccount()
    } catch (error) {
      Alert.alert('Could not save hostel seat', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSavingSeat(false)
    }
  }

  const openCheckout = (paymentType: 'semester' | 'full' | 'custom') => {
    const selectedFees = paymentType === 'semester' ? (currentFee ? [currentFee] : []) : payableFees
    const amount = paymentType === 'custom'
      ? Number(customAmount)
      : selectedFees.reduce((sum, fee) => sum + Math.max(0, fee.fee - fee.paid), 0)
    if (fullPaymentAmount <= 0 || selectedFees.length === 0 || amount <= 0) return
    if (amount > fullPaymentAmount) {
      Alert.alert('Amount is too high', `Enter an amount up to the remaining balance, ${formatCurrency(fullPaymentAmount)}.`)
      return
    }
    const title = paymentType === 'semester' ? 'Current semester' : paymentType === 'full' ? 'Full payment' : 'Custom payment'
    const detail = paymentType === 'custom'
      ? 'Applied toward the oldest unpaid semesters'
      : selectedFees.map(fee => `Semester ${fee.semester}`).join(', ')
    setPaymentNotice('')
    setCheckout({ title, detail, amount, semesters: selectedFees.map(fee => fee.semester), lines: paymentType === 'full' ? fullPaymentLines : undefined, balance: paymentType === 'full' ? remainingBalance : undefined, product: 'ACADEMIC' })
  }

  const payHostel = () => {
    if (hostelOutstanding <= 0) return
    setPaymentNotice('')
    setCheckout({ title: 'Hostel fees', detail: 'Hostel fee payment', amount: hostelOutstanding, semesters: [], product: 'HOSTEL' })
  }

  const downloadReceipt = async (receipt: PaymentReceipt) => {
    try {
      const { downloadFeeReceipt } = await import('../../services/feeReceiptService')
      await downloadFeeReceipt(account, { ...receipt, method: displayPaymentMethod(receipt.method) })
    } catch (error) {
      Alert.alert('Could not open receipt tools', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const sidebar = (
    <StudentSidebar
      visible={isSidebarOpen || isWideWeb}
      student={account}
      onClose={() => setIsSidebarOpen(false)}
      onSignOut={() => {
        setIsSidebarOpen(false)
        onSignOut()
      }}
    />
  )

  return (
    <View style={[styles.shell, isWideWeb && styles.wideShell]}>
      {isWideWeb ? sidebar : null}
      <View style={styles.mainColumn}>
      <DashboardHeader
        firstName={account.name.split(' ')[0]}
        onOpenMenu={() => setIsSidebarOpen(true)}
        showMenu={!isWideWeb}
      />
      {!isWideWeb ? sidebar : null}
      <KeyboardAvoidingView
        style={styles.keyboardSafeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {checkout ? (
          <PaymentCheckoutScreen
            token={token}
            student={account}
            payment={checkout}
            onCancel={() => setCheckout(null)}
            onRecorded={() => {
              void refreshAccount().catch(error =>
                Alert.alert(
                  'Payment recorded',
                  error instanceof Error
                    ? error.message
                    : 'The payment was recorded. Pull to refresh if the balance does not update.',
                ),
              )
            }}
            onClose={() => {
              setCheckout(null)
              setCustomAmount('')
              setActiveTab('receipts')
              setPaymentNotice('Your payment is recorded. The receipt is ready to download.')
            }}
          />
        ) : (
          <ScrollView
            ref={dashboardScrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.metrics}>
              <SummaryMetricCard label="PAID TO DATE" value={formatCurrency(paidTotal)} />
              <SummaryMetricCard label="REMAINING BALANCE" value={formatCurrency(remainingBalance)} />
            </View>
            {/* {fees.length > 0 ? (
              <View style={styles.semesterBalances}>
                {fees.map(fee => (
                  <View key={fee.semester} style={styles.semesterBalanceRow}>
                    <View style={styles.semesterBalanceCopy}>
                      <AppText style={styles.semesterBalanceLabel}>Semester {fee.semester}</AppText>
                      <AppText style={styles.semesterBalanceDetail}>
                        Fee {formatCurrency(fee.fee)} · Paid {formatCurrency(fee.paid)} ·{' '}
                        {fee.billed ? fee.status : 'Not billed yet'}
                        {fee.dueDate ? ` · due ${fee.dueDate}` : ''}
                      </AppText>
                    </View>
                    <AppText style={styles.semesterBalanceAmount}>
                      {formatCurrency(Math.max(0, fee.fee - fee.paid))}
                    </AppText>
                  </View>
                ))}
                <View style={styles.semesterBalanceTotal}>
                  <AppText style={styles.semesterBalanceLabel}>Remaining balance</AppText>
                  <AppText style={styles.semesterBalanceAmount}>
                    {formatCurrency(remainingBalance)}
                  </AppText>
                </View>
              </View>
            ) : null} */}

            <DashboardTabs
              activeTab={activeTab}
              receiptCount={receipts.length}
              onChange={setActiveTab}
            />

            {activeTab === 'pay' ? (
              <>
                <View style={styles.sectionHeading}>
                  <View>
                    <AppText style={styles.sectionTitle}>Pay fees</AppText>
                    <AppText style={styles.sectionSubtitle}>
                      Choose the current semester or full remaining balance
                    </AppText>
                  </View>
                  <AppText style={styles.currencyTag}>INR</AppText>
                </View>
                <PaymentOptionsTable
                  currentFee={currentFee}
                  fullPaymentAmount={fullPaymentAmount}
                  fullPaymentLines={fullPaymentLines}
                  payableSemesters={payableFees.map(fee => fee.semester)}
                  isPaying={false}
                  customAmount={customAmount}
                  onCustomAmountChange={setCustomAmount}
                  onCustomAmountFocusChange={setIsCustomAmountFocused}
                  onPayCurrent={() => openCheckout('semester')}
                  onPayFull={() => openCheckout('full')}
                  onPayCustom={() => openCheckout('custom')}
                />
                <HostelFeeCard
                  amount={hostelOutstanding}
                  seat={hostelSeat}
                  rates={hostelRates}
                  saving={savingSeat}
                  onSelect={hostelRateId => {
                    void chooseHostelSeat(hostelRateId)
                  }}
                  onPay={payHostel}
                />
                {accountPayments
                  .filter(payment => payment.status !== 'SUCCESS')
                  .map(payment => (
                    <AppText
                      key={`${payment.reference}-${payment.status}`}
                      style={styles.paymentNotice}
                    >
                      {payment.status === 'FAILED' ? 'Failed' : 'Pending'}{' '}
                      {displayPaymentMethod(payment.method)} payment of{' '}
                      {formatCurrency(payment.amount)}
                    </AppText>
                  ))}
                {paymentNotice ? (
                  <AppText style={styles.paymentNotice}>{paymentNotice}</AppText>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.sectionHeading}>
                  <View>
                    <AppText style={styles.sectionTitle}>Receipts</AppText>
                    <AppText style={styles.sectionSubtitle}>
                      Payment history and downloadable PDF receipts
                    </AppText>
                  </View>
                  <AppText style={styles.receiptCount}>
                    {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'}
                  </AppText>
                </View>
                <ReceiptHistoryTable receipts={receipts} onDownload={downloadReceipt} />
              </>
            )}

            <View style={styles.securityNote}>
              <AppText style={styles.securityIcon}>◇</AppText>
              <AppText style={styles.securityText}>
                Payments are recorded on your fee account. A receipt is ready to download after
                the payment is confirmed.
              </AppText>
            </View>
            <AppText style={styles.footer}>
              Need help with your fees? Contact the institute accounts office.
            </AppText>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  wideShell: { flexDirection: 'row' },
  mainColumn: { flex: 1, minWidth: 0 },
  keyboardSafeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 35 },
  metrics: { flexDirection: 'row', gap: 11, marginTop: 12 },
  semesterBalances: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.navy },
  semesterBalanceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  semesterBalanceCopy: { flex: 1 },
  semesterBalanceLabel: { color: '#3f5268', fontSize: 13, fontWeight: '700' },
  semesterBalanceDetail: { color: '#8b97a5', fontSize: 11, lineHeight: 16, marginTop: 3 },
  semesterBalanceAmount: { color: '#243851', fontSize: 13, fontWeight: '800' },
  semesterBalanceTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#edf1f5' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 11, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: '#0d335f', backgroundColor: colors.navy },
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: '#d5e3f2', fontSize: 12, marginTop: 5 },
  currencyTag: { color: colors.navy, backgroundColor: '#ffc000', borderRadius: 5, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 11, fontWeight: '800' },
  receiptCount: { color: colors.navy, backgroundColor: '#ffc000', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6, fontSize: 11, fontWeight: '800' },
  securityNote: { flexDirection: 'row', gap: 10, padding: 12, marginTop: 15, borderRadius: 10, backgroundColor: '#eaf1f8' },
  securityIcon: { color: '#396b98', fontSize: 19, fontWeight: '700' },
  securityText: { flex: 1, color: '#62758a', fontSize: 12, lineHeight: 18 },
  paymentNotice: { marginTop: 12, color: colors.navy, fontSize: 13, fontWeight: '700' },
  footer: { textAlign: 'center', color: '#9aa4b0', fontSize: 11, lineHeight: 17, marginTop: 18 },
})
