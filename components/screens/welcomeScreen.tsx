'use client';

import type { FormEvent } from 'react';

type RoomUser = {
  id: string;
  name: string;
};

type Props = {
  roomId: string;
  nameInput: string;
  setNameInput: (v: string) => void;
  onJoin: (e: FormEvent<HTMLFormElement>) => void;
  onShare: () => void;
  roomUsers: RoomUser[];
  currentUserId: string | null;
  isJoining: boolean;
  isRoomFull: boolean;
  statusMessage: string;
  copyMessage: string;
  onAddFilms: () => void;

  styles: any;
};

export default function WelcomeScreen({
  roomId,
  nameInput,
  setNameInput,
  onJoin,
  onShare,
  roomUsers,
  currentUserId,
  isJoining,
  isRoomFull,
  statusMessage,
  copyMessage,
  onAddFilms,
  styles
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
        <div style={styles.logoSub}>
          Condividi la stanza e scegli il film in coppia
        </div>

        <div style={styles.roomCode}>
          Stanza: {roomId ? roomId.slice(0, 8) + '...' : 'Caricamento...'}
        </div>

        <button style={styles.shareBtn} onClick={onShare}>
          Condividi stanza
        </button>

        {copyMessage && <div style={styles.copyInfo}>{copyMessage}</div>}
      </div>

      <form onSubmit={onJoin} style={styles.joinForm}>
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Il tuo nome"
          style={styles.input}
          maxLength={20}
        />

        <button
          type="submit"
          disabled={isJoining || isRoomFull}
          style={styles.submitBtn}
        >
          {isRoomFull ? 'Stanza piena' : 'Entra nella stanza'}
        </button>

        {statusMessage && <div style={styles.message}>{statusMessage}</div>}
      </form>

      <div style={styles.statusCard}>
        <div style={styles.statusTitle}>Partecipanti</div>

        {roomUsers.length === 0 ? (
          <div style={styles.statusText}>Nessuno ancora in stanza</div>
        ) : (
          roomUsers.map((user) => (
            <div key={user.id} style={styles.statusText}>
              {user.name} {user.id === currentUserId ? '(tu)' : ''}
            </div>
          ))
        )}

        {roomUsers.length === 1 && (
          <div style={styles.pendingText}>
            In attesa del secondo partner...
          </div>
        )}
      </div>
    </div>
  );
}