import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { displayPaymentMethod } from '../services/studentApi'
import type { PaymentReceipt } from '../types/fee'
import { colors } from '../theme/colors'
import { formatCurrency } from '../utils/formatCurrency'

function receiptCoverage(receipt: PaymentReceipt) {
  if (receipt.product === 'HOSTEL') return 'Hostel'
  if (!receipt.semesters.length) return 'Fee payment'
  return receipt.semesters.map(number => `Semester ${number}`).join(', ')
}

function receiptCoverageShort(receipt: PaymentReceipt) {
  if (receipt.product === 'HOSTEL') return 'Hostel'
  if (!receipt.semesters.length) return 'Fees'
  return receipt.semesters.map(number => `Sem ${number}`).join(', ')
}

export function ReceiptHistoryTable({ receipts, onDownload }: { receipts: PaymentReceipt[]; onDownload: (receipt: PaymentReceipt) => void }) {
  const { width } = useWindowDimensions()
  if (!receipts.length) return <View style={styles.empty}><Text style={styles.emptyTitle}>No receipts yet</Text><Text style={styles.emptyText}>Payment receipts will appear here after a payment is confirmed.</Text></View>

  if (width < 600) {
    return <View style={styles.mobileList}>{receipts.map(receipt => <View key={receipt.receiptNo} style={styles.mobileCard}>
      <View style={styles.mobileTop}><View><Text style={styles.mobileDate}>{receipt.paymentDate}</Text><Text style={styles.secondaryText}>{receiptCoverage(receipt)}</Text></View><Text style={styles.mobileAmount}>{formatCurrency(receipt.amount)}</Text></View>
      <View style={styles.mobileReceipt}><Text style={styles.mobileLabel}>RECEIPT</Text><Text selectable style={styles.mobileReceiptNo}>{receipt.receiptNo}</Text></View>
      <View style={styles.mobileBottom}><Text style={styles.mobileMethod}>{displayPaymentMethod(receipt.method)}</Text><Pressable onPress={() => onDownload(receipt)} style={({ pressed }) => [styles.mobileDownload, pressed && styles.downloadPressed]}><Text style={styles.downloadIcon}>↓</Text><Text style={styles.downloadText}>Download PDF</Text></Pressable></View>
    </View>)}</View>
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalContent}>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.dateColumn]}>PAYMENT DATE</Text>
          <Text style={[styles.headerCell, styles.semesterColumn]}>SEMESTER</Text>
          <Text style={[styles.headerCell, styles.amountColumn]}>AMOUNT</Text>
          <Text style={[styles.headerCell, styles.receiptColumn]}>RECEIPT NO.</Text>
          <Text style={[styles.headerCell, styles.actionColumn]}>DOWNLOAD</Text>
        </View>
        {receipts.map((receipt, index) => <View key={receipt.receiptNo} style={[styles.bodyRow, index === receipts.length - 1 && styles.lastRow]}>
          <Text style={[styles.bodyText, styles.dateColumn]}>{receipt.paymentDate}</Text>
          <View style={[styles.semesterColumn, styles.semesterCell]}><Text style={styles.primaryText}>{receiptCoverageShort(receipt)}</Text><Text style={styles.secondaryText}>{displayPaymentMethod(receipt.method)}</Text></View>
          <Text style={[styles.amountText, styles.amountColumn]}>{formatCurrency(receipt.amount)}</Text>
          <Text style={[styles.bodyText, styles.receiptColumn]} numberOfLines={1}>{receipt.receiptNo}</Text>
          <View style={[styles.actionColumn, styles.actionCell]}><Pressable onPress={() => onDownload(receipt)} style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadPressed]}><Text style={styles.downloadIcon}>↓</Text><Text style={styles.downloadText}>Download PDF</Text></Pressable></View>
        </View>)}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  horizontalContent: { minWidth: '100%' },
  table: { minWidth: 720, flex: 1, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  headerRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4f8', borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCell: { paddingHorizontal: 12, color: '#708094', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  bodyRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf1f5' },
  lastRow: { borderBottomWidth: 0 },
  dateColumn: { width: 120, paddingHorizontal: 12 },
  semesterColumn: { width: 130, paddingHorizontal: 10 },
  semesterCell: { justifyContent: 'center' },
  amountColumn: { width: 110, paddingHorizontal: 10 },
  receiptColumn: { width: 185, paddingHorizontal: 10 },
  actionColumn: { width: 165, paddingHorizontal: 10 },
  actionCell: { justifyContent: 'center' },
  primaryText: { color: '#293b50', fontSize: 12, fontWeight: '800' },
  secondaryText: { color: '#8b97a5', fontSize: 11, marginTop: 4 },
  bodyText: { color: '#627185', fontSize: 11 },
  amountText: { color: '#243851', fontSize: 13, fontWeight: '800' },
  downloadButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 7, backgroundColor: '#ffc000' },
  downloadPressed: { backgroundColor: '#e6ad00' },
  downloadIcon: { color: colors.navyText, fontSize: 14, fontWeight: '800' },
  downloadText: { color: colors.navyText, fontSize: 11, fontWeight: '800' },
  empty: { padding: 20, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: '#293b50', fontSize: 14, fontWeight: '800' },
  emptyText: { color: '#8b97a5', fontSize: 12, textAlign: 'center', marginTop: 5 },
  mobileList: { gap: 7 },
  mobileCard: { gap: 7, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.surface },
  mobileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  mobileDate: { color: '#293b50', fontSize: 13, fontWeight: '800' },
  mobileAmount: { color: '#243851', fontSize: 15, fontWeight: '800' },
  mobileReceipt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#edf1f5' },
  mobileLabel: { color: '#8995a4', fontSize: 11, fontWeight: '800', letterSpacing: 0.45 },
  mobileReceiptNo: { color: '#3f5268', fontSize: 11, fontWeight: '700' },
  mobileBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mobileMethod: { flex: 1, color: '#8390a0', fontSize: 11 },
  mobileDownload: { minHeight: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#ffc000' },
})
