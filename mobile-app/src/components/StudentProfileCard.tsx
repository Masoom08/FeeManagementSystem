import { StyleSheet, View } from 'react-native'
import { AppText } from './AppText'
import type { Student } from '../types/fee'
import { colors } from '../theme/colors'

export function StudentProfileCard({ student }: { student: Student }) {
  const initials = student.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  return (
    <View style={styles.card}>
      <View style={styles.avatar}><AppText style={styles.avatarText}>{initials}</AppText></View>
      <View style={styles.identity}>
        <AppText style={styles.name}>{student.name}</AppText>
        <AppText style={styles.meta}>{student.registrationNo} Â· {student.course}</AppText>
        <AppText style={styles.meta}>Batch {student.batch} Â· Year {student.year}</AppText>
        {student.academicYears?.map(year => (
          <AppText key={year.session} style={styles.meta}>{year.session} · Year {year.studyYear} · {year.isHosteller ? 'Hosteller' : 'Non-hosteller'}</AppText>
        ))}
      </View>
      <View style={styles.verified}><AppText style={styles.verifiedText}>âœ“</AppText></View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#dfeaf5', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#214d78', fontSize: 15, fontWeight: '800' },
  identity: { flex: 1, marginLeft: 12 },
  name: { color: '#1e3047', fontSize: 16, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 5 },
  verified: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#e6f5ec', alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: '#2a8754', fontSize: 13, fontWeight: '900' },
})
