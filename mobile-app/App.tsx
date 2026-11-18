import { useState } from 'react'
import { Platform, StatusBar, StyleSheet, View } from 'react-native'
import { LoginScreen } from './src/features/auth/LoginScreen'
import { StudentDashboardScreen } from './src/features/dashboard/StudentDashboardScreen'
import { colors } from './src/theme/colors'
import type { Student } from './src/types/fee'
import { signOutStudent } from './src/services/studentApi'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [token, setToken] = useState('')
  const [student, setStudent] = useState<Student | null>(null)
  const signOut = async () => {
    if (token) { try { await signOutStudent(token) } catch { /* Clear the local session even if the network is unavailable. */ } }
    setToken(''); setStudent(null); setIsAuthenticated(false)
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content"/>
      {isAuthenticated
        ? student ? <StudentDashboardScreen token={token} student={student} onSignOut={signOut}/> : null
        : <LoginScreen onAuthenticated={(newToken, profile) => { setToken(newToken); setStudent(profile); setIsAuthenticated(true) }}/>
      }
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
})
