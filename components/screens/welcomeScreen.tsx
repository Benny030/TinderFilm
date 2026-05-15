'use client';

import type { FormEvent } from 'react';
import type { RoomUser } from '@/types';
import { styles } from '@/styles/appStyles';  // ← importato qui

type Props = {
  roomId: string;
  onEnter: () => void;
  roomUsers: RoomUser[];
  currentUserId: string | null;
  currentUserName: string;
  isRoomFull: boolean;
  codeInput: string;
  setCodeInput: (v: string) => void;
  codeError: string;
  onJoinByCode: (e: FormEvent<HTMLFormElement>) => void;
  onAddFilms: () => void;
  // ← niente più styles: any
};

export default function WelcomeScreen({
  roomId, onEnter, roomUsers, currentUserId, currentUserName,
  isRoomFull, codeInput, setCodeInput, codeError, onJoinByCode, onAddFilms,
}: Props) {
  return (
    <div style={styles.screen}>
      <div style={styles.headerMain}>
        <span />
        <button style={styles.addFilm} onClick={onAddFilms}>⚙️</button>
      </div>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>🎬</div>
        <div style={styles.logoName}>CineDate</div>
        <div style={styles.logoSub}>Scegli il film in coppia</div>
      </div>
      <div style={{ textAlign: 'center', padding: '0 24px 4px', fontSize: '14px', color: '#2E2A26' }}>
        Ciao, <span style={{ color: '#E8869E', fontWeight: '700' }}>@{currentUserName}</span> 👋
      </div>
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: '#F9E0E6', borderRadius: '16px', padding: '18px 20px', border: '1.5px solid #F4B8C8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#7A6F65', letterSpacing: '1px', textTransform: 'uppercase' }}>
            La tua stanza
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#E8869E', letterSpacing: '4px', textAlign: 'center', fontFamily: "'DM Mono', monospace", background: '#FAF3E0', borderRadius: '10px', padding: '12px' }}>
            {roomId}
          </div>
          <div style={{ fontSize: '12px', color: '#7A6F65', textAlign: 'center' }}>
            Condividi questo codice con il tuo partner
          </div>
          <button onClick={onEnter} disabled={isRoomFull} style={{ ...styles.submitBtn, opacity: isRoomFull ? 0.5 : 1 }}>
            {isRoomFull ? 'Stanza piena' : '🎬 Entra nella stanza'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, borderTop: '1px solid #E0D6C8' }} />
          <span style={{ fontSize: '12px', color: '#B0A899' }}>oppure entra in un'altra stanza</span>
          <div style={{ flex: 1, borderTop: '1px solid #E0D6C8' }} />
        </div>

        <form onSubmit={onJoinByCode} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="Inserisci codice (es. MAPLE-73)"
            maxLength={10}
            style={{ ...styles.input, textAlign: 'center', letterSpacing: '3px', fontWeight: '700', fontSize: '16px', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          {codeError && <div style={{ fontSize: '12px', color: '#E8869E', textAlign: 'center' }}>⚠️ {codeError}</div>}
          <button type="submit" disabled={codeInput.trim().length < 4} style={{ ...styles.submitBtn, background: '#EEE8D8', opacity: codeInput.trim().length < 4 ? 0.5 : 1 }}>
            🚪 Entra con codice
          </button>
        </form>

        <div style={styles.statusCard}>
          <div style={styles.statusTitle}>Partecipanti in stanza</div>
          {roomUsers.length === 0
            ? <div style={styles.statusText}>Nessuno ancora in stanza</div>
            : roomUsers.map((user) => (
                <div key={user.id} style={styles.statusText}>
                  {user.name} {user.id === currentUserId ? '(tu)' : ''}
                </div>
              ))
          }
          {roomUsers.length === 1 && (
            <div style={styles.pendingText}>In attesa del partner... condividi il codice!</div>
          )}
        </div>
      </div>
    </div>
  );
}