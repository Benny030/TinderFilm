import { C, R, FONT, TEXT, S } from '@/styles/token';
import { FilmSlate, ArrowClockwise, Ticket } from '@phosphor-icons/react';

type Props = {
  onAddFilms: () => void;
  onReset: () => void;
};

export default function EmptyState({ onAddFilms, onReset }: Props) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: S.xl, textAlign: 'center', gap: S.md,
    }}>
      <FilmSlate size={64} color={C.faint} weight="duotone" />
      <div style={{ fontSize: TEXT.lg, fontWeight: '700', color: C.ink }}>
        Hai visto tutto!
      </div>
      <div style={{ fontSize: TEXT.sm, color: C.muted, lineHeight: 1.6 }}>
        Hai swipato tutti i film disponibili.<br />
        Aggiungi altri film o ricomincia da capo.
      </div>
      <button
        onClick={onAddFilms}
        style={{
          padding: '12px 28px', background: C.primary,
          color: '#fff', border: 'none', borderRadius: R.full,
          fontSize: TEXT.sm, fontWeight: '600',
          cursor: 'pointer', fontFamily: FONT.sans,
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        <Ticket size={16} color="#fff" weight="fill" />
        Aggiungi film
      </button>
      <button
        onClick={onReset}
        style={{
          padding: '10px 24px', background: 'transparent',
          color: C.muted, border: `1.5px solid ${C.border}`,
          borderRadius: R.full, fontSize: TEXT.sm,
          cursor: 'pointer', fontFamily: FONT.sans,
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        <ArrowClockwise size={16} color={C.muted} />
        Ricomincia
      </button>
    </div>
  );
}