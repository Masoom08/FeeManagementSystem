import { useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton } from '../../components/PrimaryButton'
import { colors } from '../../theme/colors'
import { requestStudentOtp, verifyStudentOtp } from '../../services/studentApi'
import type { Student } from '../../types/fee'

type LoginScreenProps = { onAuthenticated: (token: string, student: Student) => void }

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [developmentOtp, setDevelopmentOtp] = useState('')

  const requestOtp = async () => {
    const normalized = phone.replace(/\D/g, '').slice(-10)
    if (normalized.length !== 10) {
      Alert.alert('Check your number', 'Enter a valid 10-digit mobile number.')
      return
    }
    setPhone(normalized)
    setBusy(true); setError('')
    try { const result = await requestStudentOtp(normalized); setDevelopmentOtp(result.otp ?? ''); setOtpStep(true) }
    catch (e) {
      const message = e instanceof Error ? e.message : ''
      setError(message === 'MOBILE_NOT_REGISTERED' || message.toLowerCase().includes('not attached to any student')
        ? 'This number is not registered to any student.'
        : message || 'Could not send OTP.')
    }
    finally { setBusy(false) }
  }

  const verifyOtp = async () => {
    setBusy(true); setError('')
    try { const result = await verifyStudentOtp(phone, otp); onAuthenticated(result.accessToken, result.student) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not verify OTP.') }
    finally { setBusy(false) }
  }

  return (
    <>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Image source={require('../../../assets/logo-iccmrt.png')} accessibilityLabel="ICCMRT logo" resizeMode="contain" style={styles.logo}/>
          <View><Text style={styles.brandName}>ICCMRT Fee Portal</Text><Text style={styles.brandCaption}>STUDENT FEE PORTAL</Text></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>STUDENT ACCESS</Text>
          <Text style={styles.title}>{otpStep ? 'Verify your number' : 'Your fees, clear and simple.'}</Text>
              <Text style={styles.copy}>{otpStep ? `Enter the 6-digit code sent to +91 ${phone}.` : 'Sign in securely to view semester fees, payment dates, and receipts.'}</Text>
        </View>

        <View style={styles.card}>
          {otpStep ? (
            <>
              <Text style={styles.fieldLabel}>ONE-TIME PASSWORD</Text>
              <TextInput value={otp} onChangeText={value => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="• • • • • •" placeholderTextColor="#aab4c2" style={[styles.input, styles.otpInput]} accessibilityLabel="One-time password" />
              {developmentOtp ? <Text style={styles.demoHint}>Development OTP: <Text style={styles.demoCode}>{developmentOtp}</Text></Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label={busy ? 'Verifying…' : 'Verify and continue'} onPress={verifyOtp} />
              <Pressable onPress={() => { setOtpStep(false); setOtp('') }} style={styles.backLink}><Text style={styles.backLinkText}>← Change mobile number</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
              <View style={styles.phoneInput}>
                <Text style={styles.countryCode}>+91</Text><View style={styles.inputDivider}/>
                <TextInput value={phone} onChangeText={value => setPhone(value.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" maxLength={10} placeholder="10-digit mobile number" placeholderTextColor="#aab4c2" style={styles.phoneTextInput} accessibilityLabel="Mobile number" />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label={busy ? 'Sending…' : 'Continue with OTP'} onPress={requestOtp} />
            </>
          )}
          <Text style={styles.loginFoot}>Your account details stay private and secure.</Text>
        </View>
        <Text style={styles.footer}>ICCMRT · Fee Management System</Text>
      </ScrollView>
    </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logo: { width: 42, height: 42, flex: 0 },
  brandName: { color: '#1d2d43', fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },
  brandCaption: { color: '#8592a3', fontSize: 11, fontWeight: '800', letterSpacing: 1.25 },
  hero: { marginTop: 62, marginBottom: 27 },
  kicker: { color: '#2873b9', fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: 12 },
  title: { color: '#172b45', fontSize: 32, lineHeight: 39, fontWeight: '800', letterSpacing: -0.7, maxWidth: 320 },
  copy: { color: '#6e7d90', fontSize: 14, lineHeight: 22, marginTop: 12, maxWidth: 330 },
  card: { padding: 20, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#e4eaf1', shadowColor: '#173b5e', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  fieldLabel: { color: '#4c5d71', fontSize: 12, fontWeight: '800', letterSpacing: 0.9, marginBottom: 9 },
  phoneInput: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#dbe3ec', borderRadius: 10, backgroundColor: colors.surface },
  countryCode: { color: '#354b64', fontSize: 15, fontWeight: '700' },
  inputDivider: { height: 21, width: 1, backgroundColor: '#dfe5ed', marginHorizontal: 13 },
  phoneTextInput: { flex: 1, height: '100%', color: '#1d2d43', fontSize: 15 },
  input: { height: 52, paddingHorizontal: 14, borderWidth: 1, borderColor: '#dbe3ec', borderRadius: 10, color: '#1d2d43', fontSize: 16 },
  otpInput: { textAlign: 'center', letterSpacing: 9, fontSize: 20, fontWeight: '700' },
  demoHint: { color: '#8793a2', fontSize: 13, marginTop: 10, marginBottom: 18 },
  demoCode: { color: '#315d87', fontWeight: '800', letterSpacing: 0.3 },
  error: { color: '#b42318', fontSize: 13, marginBottom: 12 },
  backLink: { alignSelf: 'center', padding: 12, marginTop: 5 },
  backLinkText: { color: colors.blue, fontSize: 14, fontWeight: '700' },
  loginFoot: { color: '#a1aab6', fontSize: 12, textAlign: 'center', marginTop: 18 },
  footer: { color: '#a1aab6', fontSize: 12, textAlign: 'center', marginTop: 'auto', paddingTop: 34 },
})
