import type { ReactNode } from 'react';
import { FONT, S, TEXT, THEME } from '@/styles/token';
import { useTheme } from '@/context/ThemeContext';

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function SectionHeader({ eyebrow, title, description, action }: Props) {
  const { theme } = useTheme();
  const P = THEME[theme === 'dark' ? 'dark' : 'light'];

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: S.md, marginBottom: S.md }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div style={{ color: P.primary, fontSize: TEXT.xs, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: S.xxs }}>
            {eyebrow}
          </div>
        )}
        <h2 style={{ margin: 0, color: P.text, fontFamily: FONT.display, fontSize: TEXT.xl, lineHeight: 1.15, fontWeight: 700 }}>
          {title}
        </h2>
        {description && (
          <p style={{ margin: `${S.xs} 0 0`, color: P.textMuted, fontFamily: FONT.sans, fontSize: TEXT.sm, lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
