import { Pressable, StyleSheet, View } from 'react-native'
import { AppText } from './AppText'
import { colors } from '../theme/colors'

export type DashboardTab = 'pay' | 'receipts'

type DashboardTabsProps = { activeTab: DashboardTab; receiptCount: number; onChange: (tab: DashboardTab) => void }

export function DashboardTabs({ activeTab, receiptCount, onChange }: DashboardTabsProps) {
  return (
    <View style={styles.tabBar} accessibilityRole="tablist">
      <TabButton label="Pay fees" active={activeTab === 'pay'} onPress={() => onChange('pay')} accessibilityLabel="Pay fees tab"/>
      <TabButton label="Receipts" count={receiptCount} active={activeTab === 'receipts'} onPress={() => onChange('receipts')} accessibilityLabel="Receipts tab"/>
    </View>
  )
}

function TabButton({ label, count, active, onPress, accessibilityLabel }: { label: string; count?: number; active: boolean; onPress: () => void; accessibilityLabel: string }) {
  return <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={accessibilityLabel} style={[styles.tab, active && styles.activeTab]}><AppText style={[styles.tabText, active && styles.activeTabText]}>{label}</AppText>{count !== undefined && <AppText style={[styles.count, active && styles.activeCount]}>{count}</AppText>}</Pressable>
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', padding: 4, gap: 4, marginTop: 17, marginBottom: 13, borderRadius: 11, backgroundColor: '#e9eef4' },
  tab: { minHeight: 40, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 8 },
  activeTab: { backgroundColor: colors.surface, shadowColor: '#19334f', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { color: '#778596', fontSize: 13, fontWeight: '700' },
  activeTabText: { color: colors.navy, fontWeight: '800' },
  count: { minWidth: 24, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden', borderRadius: 10, textAlign: 'center', backgroundColor: colors.yellowBackground, color: colors.yellow, fontSize: 11, fontWeight: '800' },
  activeCount: { backgroundColor: '#f8e8ad', color: colors.yellow },
})
