import { Platform, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

// Responsive sizing
const scale = (size: number) => width / 375 * size;

// Common spacing values
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Common border radius values
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  round: 50,
};

// Common colors
export const colors = {
  primary: '#4c669f',
  primaryLight: '#6b81b7',
  primaryDark: '#3b5998',
  secondary: '#192f6a',
  accent: '#ff4444',

  // Dark theme
  dark: {
    background: '#000',
    card: '#111',
    cardAlt: '#1a1a1a',
    text: '#fff',
    textSecondary: '#ccc',
    textMuted: '#999',
    border: 'rgba(76, 102, 159, 0.2)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    tabBar: '#000', // Siyah tab bar
  },

  // Light theme
  light: {
    background: '#f9f9f9',
    card: '#fff',
    cardAlt: '#f0f0f0',
    text: '#333',
    textSecondary: '#666',
    textMuted: '#999',
    border: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    tabBar: '#000', // Açık temada da siyah tab bar
  },
};

// Common shadows
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
};

// Safe area insets for different platforms
export const safeAreaInsets = {
  top: Platform.OS === 'ios' ? 50 : 30,
  bottom: Platform.OS === 'ios' ? 34 : 16,
  tabBar: Platform.OS === 'ios' ? 80 : 65, // Daha düşük tab bar yüksekliği
};

// Common text styles
export const typography = StyleSheet.create({
  title: {
    fontSize: scale(24),
    fontWeight: '700',
    fontFamily: 'SpaceMono',
    lineHeight: scale(32),
  },
  subtitle: {
    fontSize: scale(18),
    fontWeight: '600',
    fontFamily: 'SpaceMono',
    lineHeight: scale(24),
  },
  body: {
    fontSize: scale(15),
    fontFamily: 'SpaceMono',
    lineHeight: scale(22),
  },
  caption: {
    fontSize: scale(13),
    fontFamily: 'SpaceMono',
    lineHeight: scale(18),
  },
  small: {
    fontSize: scale(12),
    fontFamily: 'SpaceMono',
    lineHeight: scale(16),
  },
});

// Common layout styles
export const layout = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  safeContainer: {
    flex: 1,
    backgroundColor: colors.dark.background,
    paddingTop: safeAreaInsets.top,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
});

// Common component styles
export const components = {
  header: {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.dark.border,
    },
    title: {
      ...typography.title,
      flex: 1,
      marginHorizontal: spacing.md,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(76, 102, 159, 0.1)',
      borderWidth: 1,
      borderColor: colors.dark.border,
    },
  },
  button: {
    primary: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.small,
    },
    secondary: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    text: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: scale(16),
      fontFamily: 'SpaceMono',
    },
  },
};

export default {
  colors,
  spacing,
  borderRadius,
  shadows,
  safeAreaInsets,
  typography,
  layout,
  components,
  scale,
};
