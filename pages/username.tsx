'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { createBrowserClient } from '@/utils/supabase/browser';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';
import { User, Check, Warning } from '@phosphor-icons/react';

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
      try {
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
          .maybeSingle();

        if (data?.username) {
          router.replace('/home');
          return;
        }

        setIsChecking(false);
      } catch (err: any) {
        setError(err.message ?? 'Errore durante il controllo della sessione');
        setIsChecking(false);
      }
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

      router.replace('/home');
    } catch (err: any) {
      setError(err.message ?? 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: C.bgSoft,
      }}>
        <div style={{ fontSize: '32px' }}>🎬</div>
      </div>
    );
  }

  const isValid = username.trim().length >= 3;
  const preview = username.trim().length >= 3;

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pop {
          0%   { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        .username-input {
          padding: 14px 16px;
          border: 2px solid ${C.border};
          border-radius: ${R.md};
          font-size: 18px;
          font-family: ${FONT.sans};
          font-weight: 700;
          color: ${C.ink};
          background: ${C.bg};
          outline: none;
          width: 100%;
          text-align: center;
          letter-spacing: 0.5px;
          transition: border-color .2s;
        }
        .username-input:focus { border-color: ${C.primary}; }
        .username-input.valid  { border-color: ${C.success}; }
        .username-input.error  { border-color: ${C.error}; }
        .btn-submit {
          width: 100%; padding: 16px;
          background: ${C.primary}; color: #fff;
          border: none; border-radius: ${R.full};
          font-size: ${TEXT.base}; font-weight: 700;
          cursor: pointer; font-family: ${FONT.sans};
          box-shadow: 0 4px 16px rgba(232,56,109,.3);
          transition: opacity .15s, transform .15s;
          display: flex; align-items: center;
          justify-content: center; gap: 8px;
        }
        .btn-submit:disabled {
          background: ${C.border};
          box-shadow: none;
          cursor: not-allowed;
        }
        .btn-submit:not(:disabled):hover {
          opacity: .9; transform: translateY(-1px);
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: C.bgSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: S.md,
        fontFamily: FONT.sans,
      }}>
        <div style={{
          background: C.bg,
          borderRadius: R.xl,
          padding: `${S.xl} ${S.lg}`,
          width: '100%',
          maxWidth: '400px',
          boxShadow: SHADOW.lg,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>

          {/* ── Icona ── */}
          <div style={{
            width: '72px', height: '72px',
            borderRadius: '50%',
            background: C.primaryLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
            marginBottom: S.lg,
            animation: mounted ? 'pop 0.4s ease 0.2s both' : 'none',
          }}>
            <User size={36} color={C.primary} weight="duotone" />
          </div>

          {/* ── Testo ── */}
          <div style={{ textAlign: 'center', marginBottom: S.lg }}>
            <div style={{ fontSize: TEXT.xl, fontWeight: '800', color: C.ink, marginBottom: S.xs }}>
              Scegli il tuo username
            </div>
            <div style={{ fontSize: TEXT.sm, color: C.muted, lineHeight: 1.6 }}>
              Sarà visibile nelle stanze e nelle recensioni.
              Puoi cambiarlo in qualsiasi momento.
            </div>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>

            {/* Campo username */}
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '14px', top: '50%',
                transform: 'translateY(-50%)',
                fontSize: TEXT.base, color: C.muted, fontWeight: '700',
              }}>
                @
              </span>
              <input
                className={`username-input${isValid ? ' valid' : error ? ' error' : ''}`}
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
                style={{ paddingLeft: '30px' }}
              />
              {/* Check verde */}
              {isValid && !error && (
                <div style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: C.success,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'pop 0.2s ease',
                }}>
                  <Check size={14} color="#fff" weight="bold" />
                </div>
              )}
            </div>

            {/* Regole */}
            <div style={{ fontSize: TEXT.xs, color: C.faint, textAlign: 'center' }}>
              Solo lettere minuscole, numeri e _ · min 3 caratteri
            </div>

            {/* Preview */}
            {preview && !error && (
              <div style={{
                background: C.primaryLight,
                borderRadius: R.md, padding: S.sm,
                textAlign: 'center',
                fontSize: TEXT.sm, color: C.primary,
                fontWeight: '600',
                animation: 'fadeUp 0.2s ease',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px',
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: C.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: TEXT.sm, fontWeight: '800', color: '#fff',
                }}>
                  {username.charAt(0).toUpperCase()}
                </div>
                Sarai mostrato come <strong>@{username}</strong>
              </div>
            )}

            {/* Errore */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: C.errorLight, color: C.error,
                borderRadius: R.sm, padding: '10px 14px',
                fontSize: TEXT.sm,
                animation: 'fadeUp 0.2s ease',
              }}>
                <Warning size={16} color={C.error} weight="fill" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn-submit"
              disabled={!isValid || isLoading}
              style={{ marginTop: S.xs }}
            >
              {isLoading ? '⏳ Salvataggio...' : (
                <><Check size={18} color="#fff" weight="bold" /> Conferma username</>
              )}
            </button>
          </form>

        </div>
      </div>
    </>
  );
}
