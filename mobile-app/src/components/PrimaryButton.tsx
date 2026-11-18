import { Pressable, StyleSheet, Text } from 'react-native'
import { colors } from '../theme/colors'

type PrimaryButtonProps = {
  label: string
  onPress: () => void
  disabled?: boolean
}

export function PrimaryButton({ label, onPress, disabled = false }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.buttonPressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: 49, borderRadius: 10, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  buttonPressed: { backgroundColor: '#305f91', opacity: 0.9 },
  label: { color: colors.surface, fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
})
