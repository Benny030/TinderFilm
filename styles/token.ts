// ─── Colori ───────────────────────────────────────────────────────────────────
export const C = {
  primary:      '#E8386D',
  primaryHover: '#D42E60',
  primaryLight: '#FFE8EF',
  primaryFaint: '#FFF4F7',

  bg:           '#FFFFFF',
  bgSoft:       '#F8F8F8',
  bgCard:       '#FFFFFF',

  ink:          '#1A1A1A',
  muted:        '#666666',
  faint:        '#AAAAAA',
  border:       '#EEEEEE',
  borderSoft:   '#F4F4F4',

  success:      '#22C55E',
  successLight: '#DCFCE7',
  error:        '#EF4444',
  errorLight:   '#FEE2E2',

  white:        '#FFFFFF',
  black:        '#000000',
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────
export const R = {
  xs:   '6px',
  sm:   '10px',
  md:   '14px',
  lg:   '20px',
  xl:   '28px',
  full: '999px',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const FONT = {
  sans: "'Inter', 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
} as const;

export const TEXT = {
  xs:   '11px',
  sm:   '13px',
  base: '15px',
  md:   '17px',
  lg:   '20px',
  xl:   '24px',
  xxl:  '32px',
  hero: '48px',
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const S = {
  xs:  '4px',
  sm:  '8px',
  md:  '16px',
  lg:  '24px',
  xl:  '32px',
  xxl: '48px',
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const SHADOW = {
  sm:  '0 1px 4px rgba(0,0,0,0.06)',
  md:  '0 4px 16px rgba(0,0,0,0.08)',
  lg:  '0 8px 32px rgba(0,0,0,0.12)',
  xl:  '0 16px 48px rgba(0,0,0,0.16)',
} as const;

// ─── Bottom nav height (usato per padding bottom nelle schermate) ─────────────
export const BOTTOM_NAV_HEIGHT = '64px';

// ─── Breakpoints ──────────────────────────────────────────────────────────────
export const BP = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
} as const;

// ─── Componenti riutilizzabili ────────────────────────────────────────────────
export const btn = {
  primary: {
    background: C.primary,
    color: C.white,
    border: 'none',
    borderRadius: R.full,
    padding: '14px 24px',
    fontSize: TEXT.base,
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: FONT.sans,
    width: '100%',
    transition: 'opacity 0.15s ease',
  },
  secondary: {
    background: C.bg,
    color: C.primary,
    border: `1.5px solid ${C.primary}`,
    borderRadius: R.full,
    padding: '13px 24px',
    fontSize: TEXT.base,
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: FONT.sans,
    width: '100%',
    transition: 'opacity 0.15s ease',
  },
  ghost: {
    background: 'none',
    color: C.muted,
    border: `1px solid ${C.border}`,
    borderRadius: R.full,
    padding: '13px 24px',
    fontSize: TEXT.base,
    fontWeight: '500' as const,
    cursor: 'pointer',
    fontFamily: FONT.sans,
    width: '100%',
  },
  social: {
    background: C.bg,
    color: C.ink,
    border: `1.5px solid ${C.border}`,
    borderRadius: R.full,
    padding: '13px 24px',
    fontSize: TEXT.base,
    fontWeight: '500' as const,
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
    border: `1.5px solid ${C.border}`,
    borderRadius: R.md,
    fontSize: TEXT.base,
    fontFamily: FONT.sans,
    color: C.ink,
    background: C.bg,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s ease',
  },
} as const;