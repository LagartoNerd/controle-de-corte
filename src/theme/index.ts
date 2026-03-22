import {StyleSheet} from 'react-native';

export const Colors = {
  // Base
  white: '#ffffff',
  black: '#000000',
  // Zinc
  zinc50: '#fafafa',
  zinc100: '#f4f4f5',
  zinc200: '#e4e4e7',
  zinc300: '#d4d4d8',
  zinc400: '#a1a1aa',
  zinc500: '#71717a',
  zinc600: '#52525b',
  zinc700: '#3f3f46',
  zinc800: '#27272a',
  zinc900: '#18181b',
  // Semantic
  primary: '#18181b',
  background: '#fafafa',
  card: '#ffffff',
  border: '#e4e4e7',
  text: '#18181b',
  textMuted: '#71717a',
  // Status
  emerald50: '#ecfdf5',
  emerald600: '#059669',
  emerald700: '#047857',
  red50: '#fef2f2',
  red500: '#ef4444',
  red600: '#dc2626',
  amber50: '#fffbeb',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  blue50: '#eff6ff',
  blue600: '#2563eb',
  purple600: '#9333ea',
};

export const Fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.zinc900,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.zinc500,
    marginTop: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.zinc500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.zinc50,
    borderWidth: 1,
    borderColor: Colors.zinc200,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.zinc900,
  },
  primaryButton: {
    backgroundColor: Colors.zinc900,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: Colors.zinc200,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.zinc700,
    fontWeight: '700',
    fontSize: 15,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.zinc100,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.zinc900,
    marginBottom: Spacing.lg,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.zinc400,
    marginTop: 12,
    fontWeight: '500',
  },
});
