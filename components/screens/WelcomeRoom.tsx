import { type FormEvent } from 'react';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';
import { FilmSlate, Users, Door } from '@phosphor-icons/react';
import type { RoomUser } from '@/types';

type Props = {
  roomId: string;
  roomUsers: RoomUser[];
  currentUserId: string;
  currentUserName: string;
  isRoomFull: boolean;
  codeInput: string;
  setCodeInput: (v: string) => void;
  codeError: string;
  onJoinByCode: (e: FormEvent<HTMLFormElement>) => void;
  onEnter: () => void;
  onAddFilms: () => void;
};

export default function WelcomeRoom({
  roomId, roomUsers, currentUserId, currentUserName,
  isRoomFull, codeInput, setCodeInput, codeError,
  onJoinByCode, onEnter, onAddFilms,
}: Props) {
  return (
    <div style={{ padding: S.md, display: 'flex', flexDirection: 'column', gap: S.md }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Door size={12} color={C.muted} /> Stanza
          </div>
          <div style={{ fontSize: TEXT.xl, fontWeight: '800', color: C.ink }}>
            Ciao, <span style={{ color: C.primary }}>@{currentUserName}</span> 👋
          </div>
        </div>
        <button
          onClick={onAddFilms}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: C.bgSoft, border: `1.5px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          ⚙️
        </button>
      </div>

      {/* Codice stanza */}
      <div style={{
        background: C.primaryLight, borderRadius: R.lg,
        padding: S.lg, border: `1.5px solid #ffd0e0`,
        display: 'flex', flexDirection: 'column', gap: S.sm,
      }}>
        <div style={{ fontSize: TEXT.xs, fontWeight: '700', color: C.primary, letterSpacing: '1px', textTransform: 'uppercase' }}>
          La tua stanza
        </div>
        <div style={{
          fontSize: '28px', fontWeight: '800', color: C.primary,
          letterSpacing: '4px', textAlign: 'center',
          fontFamily: FONT.mono, background: '#fff',
          borderRadius: R.md, padding: S.md,
          boxShadow: SHADOW.sm,
        }}>
          {roomId}
        </div>
        <div style={{ fontSize: TEXT.xs, color: C.primary, textAlign: 'center', opacity: 0.8 }}>
          Condividi questo codice con il tuo partner
        </div>
        <button
          onClick={onEnter}
          disabled={isRoomFull}
          style={{
            width: '100%', padding: '14px',
            background: isRoomFull ? C.faint : C.primary,
            color: '#fff', border: 'none', borderRadius: R.full,
            fontSize: TEXT.base, fontWeight: '700',
            cursor: isRoomFull ? 'not-allowed' : 'pointer',
            fontFamily: FONT.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <FilmSlate size={18} color="#fff" weight="fill" />
          {isRoomFull ? 'Stanza piena' : 'Entra nella stanza'}
        </button>
      </div>

      {/* Partecipanti */}
      <div style={{
        background: C.bg, borderRadius: R.lg,
        border: `1.5px solid ${C.border}`, padding: S.md,
      }}>
        <div style={{ fontSize: TEXT.sm, fontWeight: '700', color: C.ink, marginBottom: S.sm, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={16} color={C.primary} weight="fill" />
          Partecipanti
        </div>
        {roomUsers.length === 0 ? (
          <div style={{ fontSize: TEXT.sm, color: C.muted }}>Nessuno ancora...</div>
        ) : (
          roomUsers.map((u) => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: S.sm,
              padding: '8px 0', borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: u.id === currentUserId ? C.primaryLight : C.bgSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: TEXT.sm, fontWeight: '700',
                color: u.id === currentUserId ? C.primary : C.muted,
              }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>@{u.name}</div>
                {u.id === currentUserId && (
                  <div style={{ fontSize: TEXT.xs, color: C.primary }}>Tu</div>
                )}
              </div>
            </div>
          ))
        )}
        {roomUsers.length === 1 && (
          <div style={{ fontSize: TEXT.xs, color: C.muted, marginTop: S.sm, fontStyle: 'italic' }}>
            In attesa del partner...
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
        <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
        <span style={{ fontSize: TEXT.xs, color: C.faint }}>oppure entra in un'altra stanza</span>
        <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
      </div>

      {/* Form codice */}
      <form onSubmit={onJoinByCode} style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="Inserisci codice (es. MAPLE-73)"
          maxLength={10}
          style={{
            padding: '13px 16px', border: `1.5px solid ${C.border}`,
            borderRadius: R.md, fontSize: TEXT.base,
            fontFamily: FONT.mono, color: C.ink,
            background: C.bg, outline: 'none',
            textAlign: 'center', letterSpacing: '3px',
            fontWeight: '700', textTransform: 'uppercase', width: '100%',
          }}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
        {codeError && (
          <div style={{ fontSize: TEXT.xs, color: C.error, textAlign: 'center' }}>
            ⚠️ {codeError}
          </div>
        )}
        <button
          type="submit"
          disabled={codeInput.trim().length < 4}
          style={{
            width: '100%', padding: '13px',
            background: C.bgSoft, color: C.ink,
            border: `1.5px solid ${C.border}`,
            borderRadius: R.full, fontSize: TEXT.base,
            fontWeight: '600', cursor: codeInput.trim().length < 4 ? 'not-allowed' : 'pointer',
            fontFamily: FONT.sans, opacity: codeInput.trim().length < 4 ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <Door size={18} color={C.muted} weight="fill" />
          Entra con codice
        </button>
      </form>
    </div>
  );
}