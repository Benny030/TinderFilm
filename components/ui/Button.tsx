import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { C, FONT, MOTION, R, TEXT, THEME } from '@/styles/token';
import { useTheme } from '@/context/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
};

const sizeStyles: Record<Size, CSSProperties> = {
  sm: { minHeight: 36, padding: '8px 12px', fontSize: TEXT.sm },
  md: { minHeight: 44, padding: '10px 16px', fontSize: TEXT.base },
  lg: { minHeight: 50, padding: '12px 20px', fontSize: TEXT.md },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leadingIcon,
  style,
  children,
  disabled,
  ...props
}: Props) {
  const { theme } = useTheme();
  const P = THEME[theme === 'dark' ? 'dark' : 'light'];

  const variants: Record<Variant, CSSProperties> = {
    primary: {
      background: C.primary,
      color: C.white,
      border: `1px solid ${C.primary}`,
    },
    secondary: {
      background: P.surface,
      color: P.text,
      border: `1px solid ${P.border}`,
    },
    ghost: {
      background: 'transparent',
      color: P.textMuted,
      border: '1px solid transparent',
    },
  };

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...sizeStyles[size],
        ...variants[variant],
        width: fullWidth ? '100%' : undefined,
        borderRadius: R.md,
        fontFamily: FONT.sans,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: `background ${MOTION.fast}, border-color ${MOTION.fast}, transform ${MOTION.fast}, opacity ${MOTION.fast}`,
        ...style,
      }}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
