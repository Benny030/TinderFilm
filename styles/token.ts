// Cinedate Design System v1
// Single source of truth for brand, themes, typography and UI primitives.

export const C = {
  primary: '#ED3D73',
  primaryHover: '#D92F64',
  primaryDeep: '#8E1740',
  primaryLight: '#FFE7EF',
  primaryFaint: '#FFF4F7',

  accent: '#F5B92F',
  accentSoft: '#FFD875',
  accentFaint: '#FFF6D8',

  secondary: '#5BBEC8',
  secondaryLight: '#DDF6F8',

  bg: '#FFFFFF',
  bgSoft: '#F5EFE8',
  bgWarm: '#F0EBE3',
  bgCard: '#FFFFFF',

  ink: '#1F1A16',
  muted: '#5C5248',
  faint: '#8A7C6E',

  border: '#D6CBBC',
  borderSoft: '#E9E0D6',

  success: '#22C55E',
  successLight: '#DCFCE7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const THEME = {
  light: {
    bg: '#F5EFE8',
    bgSoft: '#ECE3D9',
    surface: '#FFFFFF',
    surfaceHover: '#FAF5EF',
    border: '#D6CBBC',
    text: '#1F1A16',
    textMuted: '#5C5248',
    textFaint: '#8A7C6E',
    primary: C.primary,
    primaryDeep: C.primaryDeep,
    accent: '#B8860B',
    accentSoft: '#E8C84A',
    primaryGlow: 'rgba(237,61,115,0.10)',
    accentGlow: 'rgba(184,134,11,0.10)',
  },
  dark: {
    bg: '#0A0806',
    bgSoft: '#14100E',
    surface: '#1C1613',
    surfaceHover: '#241D19',
    border: '#2D221C',
    text: '#F0EBE6',
    textMuted: '#B5A89E',
    textFaint: '#7A6B60',
    primary: C.primary,
    primaryDeep: C.primaryDeep,
    accent: C.accent,
    accentSoft: C.accentSoft,
    primaryGlow: 'rgba(237,61,115,0.15)',
    accentGlow: 'rgba(245,185,47,0.12)',
  },
} as const;

// Keep radius vocabulary intentionally small: controls, cards, pills.
export const R = {
  sm: '8px',
  md: '12px',
  lg: '20px',
  xl: '24px',
  full: '999px',
} as const;

export const FONT = {
  sans: "'Inter', 'Helvetica Neue', sans-serif",
  display: "'Playfair Display', 'Georgia', serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
} as const;

export const TEXT = {
  xs: '11px',
  sm: '13px',
  base: '15px',
  md: '17px',
  lg: '20px',
  xl: '24px',
  xxl: '32px',
  hero: '48px',
} as const;

// 4px base grid.
export const S = {
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  xxxl: '64px',
} as const;

export const SHADOW = {
  sm: '0 1px 4px rgba(31,26,22,0.06)',
  md: '0 4px 16px rgba(31,26,22,0.10)',
  lg: '0 12px 32px rgba(31,26,22,0.14)',
  xl: '0 20px 56px rgba(31,26,22,0.18)',
} as const;

export const MOTION = {
  fast: '150ms ease',
  base: '220ms ease',
  slow: '320ms ease',
} as const;

export const BOTTOM_NAV_HEIGHT = '64px';

export const BP = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
} as const;

// Legacy-compatible primitives. New components should consume THEME when they
// need dark/light awareness rather than defining a local palette.
export const btn = {
  primary: {
    background: C.primary,
    color: C.white,
    border: 'none',
    borderRadius: R.md,
    padding: '13px 20px',
    fontSize: TEXT.base,
    fontWeight: '700' as const,
    cursor: 'pointer',
    fontFamily: FONT.sans,
    width: '100%',
    transition: `background ${MOTION.fast}, transform ${MOTION.fast}`,
  },
  secondary: {
    background: C.bg,
    color: C.ink,
    border: `1px solid ${C.border}`,
    borderRadius: R.md,
    padding: '12px 20px',
    fontSize: TEXT.base,
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: FONT.sans,
    width: '100%',
    transition: `border-color ${MOTION.fast}, background ${MOTION.fast}`,
  },
  ghost: {
    background: 'transparent',
    color: C.muted,
    border: '1px solid transparent',
    borderRadius: R.md,
    padding: '12px 20px',
    fontSize: TEXT.base,
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: FONT.sans,
    width: '100%',
  },
  social: {
    background: C.bg,
    color: C.ink,
    border: `1px solid ${C.border}`,
    borderRadius: R.md,
    padding: '12px 20px',
    fontSize: TEXT.base,
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: FONT.sans,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
} as const;

export const input = {
  base: {
    padding: '13px 16px',
    border: `1px solid ${C.border}`,
    borderRadius: R.md,
    fontSize: TEXT.base,
    fontFamily: FONT.sans,
    color: C.ink,
    background: C.bg,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: `border-color ${MOTION.fast}, box-shadow ${MOTION.fast}`,
  },
} as const;
