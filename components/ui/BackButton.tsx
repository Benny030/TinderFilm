import { ArrowLeft } from '@phosphor-icons/react';
import { useTheme } from '@/context/ThemeContext';
import { FONT, MOTION, THEME } from '@/styles/token';

type BackButtonProps = {
  onClick: () => void;
  label?: string;
  className?: string;
};

export default function BackButton({
  onClick,
  label = 'Indietro',
  className,
}: BackButtonProps) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? THEME.dark : THEME.light;

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{
        border: 0,
        background: 'transparent',
        color: T.textMuted,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        cursor: 'pointer',
        fontFamily: FONT.sans,
        fontSize: 11,
        fontWeight: 750,
        lineHeight: 1,
        transition: `color ${MOTION.fast}`,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.color = T.text;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.color = T.textMuted;
      }}
    >
      <ArrowLeft size={15} weight="bold" />
      {label}
    </button>
  );
}
