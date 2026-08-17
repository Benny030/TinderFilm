'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { createBrowserClient } from '@/utils/supabase/browser';
import { useTheme } from '@/context/ThemeContext';
import { User, Check, Warning } from '@phosphor-icons/react';

// ─── Palette dark "cinema elegante" ──────────────────────────────────────
const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  cardHover: '#241d19',
  border: '#2d221c',
  gold: '#f5b92f',
  goldSoft: '#ffd875',
  goldGlow: 'rgba(245,185,47,0.12)',
  pink: '#ed3d73',
  pinkDeep: '#8e1740',
  pinkGlow: 'rgba(237,61,115,0.15)',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
  success: '#22c55e',
  error: '#ef4444',
};

// ─── Palette light "cinema elegante" ──────────────────────────────────────
const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  cardHover: '#faf5ef',
  border: '#d6cbbc',
  gold: '#b8860b',
  goldSoft: '#e8c84a',
  goldGlow: 'rgba(184,134,11,0.10)',
  pink: '#b83060',
  pinkDeep: '#8a1d44',
  pinkGlow: 'rgba(184,48,96,0.10)',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
  success: '#16a34a',
  error: '#dc2626',
};

const FONT_SANS = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

const withTimeout = async <T,>(
  promise: PromiseLike<T>,
  ms = 8000,
  label = 'Operazione'
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} scaduta. Riprova.`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export default function UsernamePage() {
  const router = useRouter();
  const supabase = useRef(createBrowserClient()).current;
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await withTimeout(
          supabase.auth.getUser(),
          5000,
          'Controllo sessione'
        );

        if (userError || !user) {
          router.replace('/auth');
          return;
        }

        setUserId(user.id);

        const { data, error: profileError } = await withTimeout(
          supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle(),
          8000,
          'Controllo profilo'
        );

        if (profileError) {
          throw profileError;
        }

        if (data?.username) {
          router.replace('/home');
          return;
        }

        setIsChecking(false);
      } catch (err: any) {
        console.error('Username session check failed:', err);
        setError(err.message ?? 'Errore sessione');
        setIsChecking(false);
      }
    };

    checkSession();
  }, [router, supabase]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanUsername = username.trim();
    if (!cleanUsername || !userId) return;

    setIsLoading(true);
    setError('');

    try {
      const { error: updateError } = await withTimeout(
        supabase
          .from('users')
          .update({ username: cleanUsername })
          .eq('id', userId),
        8000,
        'Salvataggio username'
      );

      if (updateError) {
        if (updateError.code === '23505') {
          setError('Username gia in uso, scegline un altro');
          return;
        }
        throw updateError;
      }

      const { data: profile, error: verifyError } = await withTimeout(
        supabase
          .from('users')
          .select('username')
          .eq('id', userId)
          .maybeSingle(),
        8000,
        'Verifica username'
      );

      if (verifyError) throw verifyError;

      if (!profile?.username) {
        throw new Error('Username non salvato');
      }

      router.replace('/home');
    } catch (err: any) {
      console.error('Username save failed:', err);
      setError(err.message ?? 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: P.bg,
      }}>
        <div style={{ fontSize: '32px' }}>🎬</div>
      </div>
    );
  }

  const isValid = username.trim().length >= 3;
  const preview = isValid;

  const inputStyle: React.CSSProperties = {
    padding: '14px 16px',
    border: `2px solid ${error ? P.error : isValid ? P.success : P.border}`,
    borderRadius: 0,
    fontSize: '18px',
    fontFamily: FONT_SANS,
    fontWeight: 700,
    color: P.text,
    background: P.bgSoft,
    outline: 'none',
    width: '100%',
    textAlign: 'center',
    letterSpacing: '0.5px',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: P.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: FONT_SANS,
      }}>
        <div style={{
          background: P.card,
          borderRadius: 0,
          padding: '32px 24px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          border: `1px solid ${P.border}`,
          position: 'relative',
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: P.pinkGlow,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: 24,
            animation: mounted ? 'pop 0.4s ease 0.2s both' : 'none',
            border: `1px solid ${P.pink}`,
          }}>
            <User size={36} color={P.pink} weight="duotone" />
          </div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontSize: '24px',
              fontWeight: 800,
              color: P.text,
              marginBottom: 4,
              fontFamily: FONT_DISPLAY,
            }}>
              Scegli il tuo username
            </div>
            <div style={{ fontSize: 13, color: P.textMuted, lineHeight: 1.6 }}>
              Sara visibile nelle stanze e nelle recensioni. Puoi cambiarlo in qualsiasi momento.
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 15,
                color: P.textMuted,
                fontWeight: 700,
              }}>
                @
              </span>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setError('');
                }}
                placeholder="username"
                maxLength={20}
                minLength={3}
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                style={{
                  ...inputStyle,
                  paddingLeft: 30,
                  borderColor: error ? P.error : isValid ? P.success : P.border,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = P.gold;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${P.goldGlow}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = error ? P.error : isValid ? P.success : P.border;
                }}
              />
              {isValid && !error && (
                <div style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: P.success,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pop 0.2s ease',
                }}>
                  <Check size={14} color="#fff" weight="bold" />
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: P.textFaint, textAlign: 'center' }}>
              Solo lettere minuscole, numeri e _ · min 3 caratteri
            </div>

            {preview && !error && (
              <div style={{
                background: P.pinkGlow,
                borderRadius: 0,
                padding: 8,
                textAlign: 'center',
                fontSize: 13,
                color: P.pink,
                fontWeight: 600,
                animation: 'fadeUp 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: `1px solid ${P.pink}`,
              }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: P.pink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#fff',
                }}>
                  {username.charAt(0).toUpperCase()}
                </div>
                Sarai mostrato come <strong>@{username}</strong>
              </div>
            )}

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(239,68,68,0.1)',
                color: P.error,
                borderRadius: 0,
                padding: '10px 14px',
                fontSize: 13,
                animation: 'fadeUp 0.2s ease',
                border: `1px solid ${P.error}40`,
              }}>
                <Warning size={16} color={P.error} weight="fill" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!isValid || isLoading}
              style={{
                width: '100%',
                padding: 16,
                background: isLoading ? P.border : P.pink,
                color: '#fff',
                border: 'none',
                borderRadius: 0,
                fontSize: 15,
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: FONT_SANS,
                boxShadow: isLoading ? 'none' : `0 4px 16px ${P.pinkGlow}`,
                transition: 'opacity 0.15s, transform 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
              }}
              onMouseEnter={(e) => {
                if (!isLoading && isValid) {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {isLoading ? (
                'Salvataggio...'
              ) : (
                <>
                  <Check size={18} color="#fff" weight="bold" />
                  Conferma username
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}