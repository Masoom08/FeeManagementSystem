import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/colors'

export function DashboardHeader({ firstName, onOpenMenu }: { firstName: string; onOpenMenu: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable onPress={onOpenMenu} accessibilityRole="button" accessibilityLabel="Open student menu" style={styles.menuButton}>
        <View style={styles.menuLine}/><View style={styles.menuLine}/><View style={styles.menuLine}/>
      </Pressable>
      <Image source={require('../../assets/logo-iccmrt.png')} accessibilityLabel="ICCMRT logo" style={styles.logo} resizeMode="contain"/>
      <View style={styles.brandCopy}><Text style={styles.appName} numberOfLines={1}>ICCMRT Fee Portal</Text><Text style={styles.greeting} numberOfLines={1}>Welcome back, {firstName}</Text></View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuButton: { width: 40, height: 40, flex: 0, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 },
  menuLine: { width: 16, height: 2, borderRadius: 2, backgroundColor: '#385a7c' },
  logo: { width: 40, height: 40, flex: 0 },
  brandCopy: { flex: 1, minWidth: 0, gap: 3 },
  appName: { color: colors.navyText, fontSize: 16, lineHeight: 20, fontWeight: '800', letterSpacing: 0.1 },
  greeting: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
})
