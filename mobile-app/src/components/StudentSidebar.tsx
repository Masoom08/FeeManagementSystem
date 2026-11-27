import { useState } from 'react'
import { Alert, Image, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { AppText } from './AppText'
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
  const [webSignOutVisible, setWebSignOutVisible] = useState(false)
  const { width } = useWindowDimensions()
  const persistentOnWeb = Platform.OS === 'web' && width >= 900
  const initials = student.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  const details = studentDetails(student)
  const confirmSignOut = () => {
    if (Platform.OS === 'web') {
      setWebSignOutVisible(true)
      return
    }
    Alert.alert('Are you sure?', 'Do you want to sign out of the student portal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onSignOut },
    ])
  }

  const panel = (
    <View style={[styles.sidebar, persistentOnWeb && styles.webSidebar]}>
          <View style={styles.header}>
            <View style={styles.brandRow}><Image source={require('../../assets/logo-iccmrt.png')} accessibilityLabel="ICCMRT logo" resizeMode="contain" style={styles.logo}/><View><AppText style={styles.brandName}>ICCMRT Fee Portal</AppText><AppText style={styles.brandCaption}>STUDENT PORTAL</AppText></View></View>
            {!persistentOnWeb && <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" style={styles.closeButton}><AppText style={styles.closeText}>×</AppText></Pressable>}
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatar}><AppText style={styles.avatarText}>{initials}</AppText></View>
            <AppText style={styles.studentName}>{student.name}</AppText>
            <AppText style={styles.studentLabel}>Student account</AppText>
          </View>

          <AppText style={styles.sectionLabel}>STUDENT DETAILS</AppText>
          <View style={styles.detailsCard}>
            {details.map((detail, index) => <View key={detail.label} style={[styles.detailRow, index === details.length - 1 && styles.lastDetailRow]}>
              <AppText style={styles.detailLabel}>{detail.label}</AppText><AppText selectable style={styles.detailValue}>{detail.value}</AppText>
            </View>)}
          </View>

          <View style={styles.footer}>
            <Pressable onPress={confirmSignOut} accessibilityRole="button" style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed]}>
              <AppText style={styles.signOutIcon}>↪</AppText><AppText style={styles.signOutText}>Sign out</AppText>
            </Pressable>
            <AppText style={styles.version}>ICCMRT Fee Management</AppText>
          </View>
    </View>
  )

  const webSignOutDialog = Platform.OS === 'web' ? (
    <Modal visible={webSignOutVisible} transparent animationType="fade" onRequestClose={() => setWebSignOutVisible(false)}>
      <View style={styles.confirmOverlay}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setWebSignOutVisible(false)} accessibilityRole="button" accessibilityLabel="Cancel sign out" />
        <View style={styles.confirmCard} accessibilityRole="alert">
          <View style={styles.confirmIcon}><AppText style={styles.confirmIconText}>?</AppText></View>
          <AppText style={styles.confirmTitle}>Are you sure?</AppText>
          <AppText style={styles.confirmMessage}>Do you want to sign out of the student portal?</AppText>
          <View style={styles.confirmActions}>
            <Pressable onPress={() => setWebSignOutVisible(false)} accessibilityRole="button" style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelPressed]}>
              <AppText style={styles.cancelButtonText}>Cancel</AppText>
            </Pressable>
            <Pressable onPress={() => { setWebSignOutVisible(false); onSignOut() }} accessibilityRole="button" style={({ pressed }) => [styles.confirmSignOutButton, pressed && styles.confirmSignOutPressed]}>
              <AppText style={styles.confirmSignOutText}>Sign out</AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  ) : null

  if (persistentOnWeb) return <><View style={styles.webSidebarFrame}>{panel}</View>{webSignOutDialog}</>

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close student menu"/>
          {panel}
        </View>
      </Modal>
      {webSignOutDialog}
    </>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12, 29, 49, 0.48)' },
  sidebar: { width: '84%', maxWidth: 350, height: '100%', paddingHorizontal: 19, paddingTop: 16, paddingBottom: 18, backgroundColor: colors.surface, borderTopRightRadius: 18, borderBottomRightRadius: 18, elevation: 15, shadowColor: '#10243a', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 4, height: 0 } },
  webSidebarFrame: { width: 280, flexShrink: 0, alignSelf: 'stretch', backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
  webSidebar: { width: '100%', maxWidth: 280, borderTopRightRadius: 0, borderBottomRightRadius: 0, elevation: 0, shadowOpacity: 0 },
  confirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  confirmBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18, 37, 59, 0.42)' },
  confirmCard: { width: '100%', maxWidth: 390, padding: 26, borderRadius: 18, borderWidth: 1, borderColor: '#e6ebf1', backgroundColor: colors.surface, alignItems: 'center', shadowColor: '#132b43', shadowOpacity: 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  confirmIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef3f8' },
  confirmIconText: { color: colors.navy, fontSize: 23, fontWeight: '700' },
  confirmTitle: { marginTop: 16, color: colors.navyText, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  confirmMessage: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  confirmActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cancelPressed: { backgroundColor: '#f3f6f9' },
  cancelButtonText: { color: '#52657a', fontSize: 14, fontWeight: '700' },
  confirmSignOutButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.redAccent },
  confirmSignOutPressed: { opacity: 0.88 },
  confirmSignOutText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
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
