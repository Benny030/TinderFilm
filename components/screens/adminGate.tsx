'use client';

import { useState, type FormEvent } from 'react';
import { styles } from '@/styles/appStyles';

const ADMIN_USER = 'Admin';
const ADMIN_PASS = 'Paolo1234!';

type Props = {
  onSuccess: () => void;
  onBack: () => void;
};

export default function AdminGate({ onSuccess, onBack }: Props) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      setError('');
      onSuccess();
    } else {
      setError('Credenziali errate. Riprova.');
    }
  };

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button style={styles.headerBtn} onClick={onBack}>←</button>
        <span style={styles.headerTitle}>Area Admin</span>
        <span />
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: '16px',
      }}>
        <div style={{ fontSize: '48px' }}>🔐</div>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#2E2A26' }}>
          Accesso riservato
        </div>
        <div style={{ fontSize: '13px', color: '#7A6F65', marginBottom: '8px' }}>
          Inserisci le credenziali admin per continuare
        </div>

        <form onSubmit={handleSubmit} style={{ ...styles.form, width: '100%', maxWidth: '320px' }}>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            style={styles.input}
          />
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            style={styles.input}
          />
          {error && (
            <div style={{ ...styles.message, background: '#F4B8C8', color: '#E8869E', borderColor: '#E8869E' }}>
              {error}
            </div>
          )}
          <button type="submit" style={styles.submitBtn}>
            🔓 Entra
          </button>
        </form>
      </div>
    </div>
  );
}