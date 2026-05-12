'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { createBrowserClient } from '@/utils/supabase/browser';
import { styles } from '@/styles/appStyles';

export default function UsernamePage() {
  const router = useRouter();
  const supabase = useRef(createBrowserClient()).current;

  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const check = async () => {
      await new Promise((r) => setTimeout(r, 500));
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (!user) {
        router.replace('/auth');
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const { data } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();

      if (data?.username) {
        router.replace('/');
        return;
      }

      setIsChecking(false);
    };

    check();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username.trim() || !userId) return;
    setIsLoading(true);
    setError('');

    try {
      const { error } = await supabase.from('users').upsert({
        id: userId,
        email: userEmail,
        username: username.trim(),
      });

      if (error) {
        if (error.code === '23505') {
          setError('Username già in uso, scegline un altro');
          return;
        }
        throw error;
      }

      router.replace('/');
    } catch (err: any) {
      setError(err.message ?? 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column' as const,
        alignItems: 'center', justifyContent: 'center',
        background: '#FAF3E0', gap: '12px',
      }}>
        <div style={{ fontSize: '40px' }}>🎬</div>
        <div style={{ fontSize: '13px', color: '#7A6F65' }}>Caricamento...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={styles.screen}>
        <div style={styles.header}>
          <span />
          <span style={styles.headerTitle}>Scegli username</span>
          <span />
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column' as const,
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 24px', gap: '16px',
        }}>

          <div style={{
            display: 'flex', flexDirection: 'column' as const,
            alignItems: 'center', gap: '12px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
          }}>
            <div style={{ fontSize: '48px' }}>🎭</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#2E2A26', textAlign: 'center' as const }}>
              Come vuoi essere chiamato?
            </div>
            <div style={{ fontSize: '13px', color: '#7A6F65', textAlign: 'center' as const, maxWidth: '260px', lineHeight: '1.5' }}>
              Il tuo username sarà visibile nelle recensioni e nelle stanze
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              ...styles.form,
              width: '100%', maxWidth: '320px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s',
            }}
          >
            <input
              value={username}
              onChange={(e) => setUsername(
                e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
              )}
              placeholder="username"
              maxLength={20}
              minLength={3}
              required
              style={{
                ...styles.input,
                borderColor: username.length >= 3 ? '#9EE6A4' : '#E0D6C8',
                transition: 'border-color 0.2s',
              }}
              autoCapitalize="none"
              autoCorrect="off"
            />

            <div style={{
              fontSize: '11px',
              color: username.length >= 3 ? '#3CA648' : '#B0A899',
              transition: 'color 0.2s',
            }}>
              {username.length >= 3 ? '✅' : '⬜'} Solo lettere minuscole, numeri e _ — min 3 caratteri
            </div>

            {/* Preview username */}
            {username.length >= 3 && (
              <div style={{
                background: '#F9E0E6', borderRadius: '8px',
                padding: '10px 14px', fontSize: '13px', color: '#2E2A26',
                animation: 'fadeUp 0.2s ease',
              }}>
                Sarai mostrato come <strong>@{username}</strong>
              </div>
            )}

            {error && (
              <div style={{
                ...styles.message,
                background: '#F4B8C8', color: '#E8869E', borderColor: '#E8869E',
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || username.trim().length < 3}
              style={{
                ...styles.submitBtn,
                opacity: username.trim().length < 3 ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isLoading ? '⏳ Salvataggio...' : '✅ Conferma username'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}