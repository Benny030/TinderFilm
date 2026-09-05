import type { CSSProperties, HTMLAttributes } from 'react';
import { MOTION, R, SHADOW, THEME } from '@/styles/token';
import { useTheme } from '@/context/ThemeContext';

type Props = HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  interactive?: boolean;
  padding?: CSSProperties['padding'];
};

export default function Card({
  elevated = false,
  interactive = false,
  padding = 20,
  style,
  children,
  ...props
}: Props) {
  const { theme } = useTheme();
  const P = THEME[theme === 'dark' ? 'dark' : 'light'];

  return (
    <div
      {...props}
      style={{
        background: P.surface,
        color: P.text,
        border: `1px solid ${P.border}`,
        borderRadius: R.lg,
        padding,
        boxShadow: elevated ? SHADOW.md : 'none',
        transition: interactive
          ? `background ${MOTION.fast}, border-color ${MOTION.fast}, transform ${MOTION.fast}`
          : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
