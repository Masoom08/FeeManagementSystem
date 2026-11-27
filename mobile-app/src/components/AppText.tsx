import { Platform, Text, type TextProps } from 'react-native'

export const appFontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'system-ui',
})

export function AppText({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ fontFamily: appFontFamily }, style]} />
}
