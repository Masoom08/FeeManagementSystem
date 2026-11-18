import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Student } from '../types/fee'
import { colors } from '../theme/colors'

type StudentSidebarProps = {
  visible: boolean
  student: Student
  onClose: () => void
  onSignOut: () => void
}

const studentDetails = (student: Student) => [
  { label: 'Registration number', value: student.registrationNo },
  { label: 'Mobile number', value: `+91 ${student.phone.slice(0, 5)} ${student.phone.slice(5)}` },
  { label: 'Course', value: student.course },
  { label: 'Year', value: `Year ${student.year}` },
  { label: 'Batch', value: String(student.batch) },
]

export function StudentSidebar({ visible, student, onClose, onSignOut }: StudentSidebarProps) {
  const initials = student.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  const details = studentDetails(student)
  const confirmSignOut = () => Alert.alert('Are you sure?', 'Do you want to sign out of the student portal?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: onSignOut },
  ])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close student menu"/>
        <View style={styles.sidebar}>
          <View style={styles.header}>
            <View style={styles.brandRow}><Image source={require('../../assets/logo-iccmrt.png')} accessibilityLabel="ICCMRT logo" resizeMode="contain" style={styles.logo}/><View><Text style={styles.brandName}>ICCMRT Fee Portal</Text><Text style={styles.brandCaption}>STUDENT PORTAL</Text></View></View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <Text style={styles.studentName}>{student.name}</Text>
            <Text style={styles.studentLabel}>Student account</Text>
          </View>

          <Text style={styles.sectionLabel}>STUDENT DETAILS</Text>
          <View style={styles.detailsCard}>
            {details.map((detail, index) => <View key={detail.label} style={[styles.detailRow, index === details.length - 1 && styles.lastDetailRow]}>
              <Text style={styles.detailLabel}>{detail.label}</Text><Text selectable style={styles.detailValue}>{detail.value}</Text>
            </View>)}
          </View>

          <View style={styles.footer}>
            <Pressable onPress={confirmSignOut} accessibilityRole="button" style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed]}>
              <Text style={styles.signOutIcon}>↪</Text><Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
            <Text style={styles.version}>ICCMRT Fee Management</Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12, 29, 49, 0.48)' },
  sidebar: { width: '84%', maxWidth: 350, height: '100%', paddingHorizontal: 19, paddingTop: 16, paddingBottom: 18, backgroundColor: colors.surface, borderTopRightRadius: 18, borderBottomRightRadius: 18, elevation: 15, shadowColor: '#10243a', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 4, height: 0 } },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 37, height: 37, flex: 0 },
  brandName: { color: '#1d2d43', fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
  brandCaption: { color: '#8592a3', fontSize: 11, fontWeight: '800', letterSpacing: 0.9, marginTop: 2 },
  closeButton: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#f0f3f7', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#62748a', fontSize: 23, lineHeight: 25 },
  profileCard: { alignItems: 'center', marginTop: 30, marginBottom: 27, padding: 20, borderRadius: 14, backgroundColor: '#f2f6fa', borderWidth: 1, borderColor: '#e7edf4' },
  avatar: { width: 62, height: 62, borderRadius: 20, backgroundColor: '#dce9f5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#214d78', fontSize: 19, fontWeight: '800' },
  studentName: { color: colors.navyText, fontSize: 17, fontWeight: '800', marginTop: 12 },
  studentLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  sectionLabel: { color: '#8391a1', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  detailsCard: { paddingHorizontal: 13, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  detailRow: { minHeight: 54, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#edf1f5' },
  lastDetailRow: { borderBottomWidth: 0 },
  detailLabel: { color: '#8a96a5', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { color: '#2c3d52', fontSize: 14, fontWeight: '700', marginTop: 4 },
  footer: { marginTop: 'auto' },
  signOutButton: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderColor: '#f0c9c6', borderRadius: 10, backgroundColor: colors.redBackground },
  signOutPressed: { backgroundColor: '#fde9e7' },
  signOutIcon: { color: colors.redAccent, fontSize: 17, fontWeight: '800' },
  signOutText: { color: colors.redAccent, fontSize: 14, fontWeight: '800' },
  version: { color: '#a0aab6', fontSize: 11, textAlign: 'center', marginTop: 12 },
})
