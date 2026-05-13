'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { createBrowserClient } from '@/utils/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import { styles } from '@/styles/appStyles';

type Mode = 'login' | 'register';

type PasswordCheck = {
  label: string;
  ok: boolean;
};

function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { label: 'Almeno 8 caratteri',          ok: password.length >= 8 },
    { label: 'Una lettera maiuscola',        ok: /[A-Z]/.test(password) },
    { label: 'Una lettera minuscola',        ok: /[a-z]/.test(password) },
    { label: 'Un numero',                    ok: /[0-9]/.test(password) },
    { label: 'Un carattere speciale (!@#$)', ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];
}

function isPasswordValid(password: string): boolean {
  return getPasswordChecks(password).every((c) => c.ok);
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = useRef(createBrowserClient()).current;
  const { enterAsGuest } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [mounted, setMounted] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // ─── Campi form ───────────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setEmail('');
    setEmailConfirm('');
    setPassword('');
    setPasswordConfirm('');
    setError('');
    setSuccessMsg('');
    setPasswordFocused(false);
  }, [mode]);

  const passwordChecks = getPasswordChecks(password);
  const passwordValid = isPasswordValid(password);
  const emailsMatch = email === emailConfirm;
  const passwordsMatch = password === passwordConfirm;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (mode === 'register') {
      if (!emailsMatch) {
        setError('Le email non coincidono');
        triggerShake();
        return;
      }
      if (!passwordValid) {
        setError('La password non soddisfa i requisiti');
        triggerShake();
        return;
      }
      if (!passwordsMatch) {
        setError('Le password non coincidono');
        triggerShake();
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSuccessMsg('Accesso effettuato! Reindirizzamento...');
        setTimeout(() => router.replace('/'), 800);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          setRegisteredEmail(email);
          setEmailSent(true);
        }
      }
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('Invalid login credentials')) {
        setError('Email o password errati — verifica anche di aver confermato l\'email');
      } else if (msg.includes('Email not confirmed')) {
        setError('Devi confermare l\'email prima di accedere — controlla la tua casella');
      } else if (msg.includes('Email already registered') || msg.includes('already been registered')) {
        setError('Email già registrata — prova ad accedere');
      } else if (msg.includes('Password should be')) {
        setError('Password troppo corta (minimo 6 caratteri)');
      } else {
        setError(msg || 'Errore sconosciuto');
      }
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = () => {
  enterAsGuest();
  // ─── window.location invece di router.replace ─────────────────────────
  // router.replace può portarsi dietro i query param della pagina corrente
  window.location.href = '/';
  };

  // ─── Schermata "controlla email" ──────────────────────────────────────────
  if (emailSent) {
    return (
      <>
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={styles.screen}>
          <div style={styles.header}>
            <button style={styles.headerBtn} onClick={() => setEmailSent(false)}>←</button>
            <span style={styles.headerTitle}>Conferma email</span>
            <span />
          </div>

          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column' as const,
            alignItems: 'center', justifyContent: 'center',
            padding: '32px 24px', gap: '20px', textAlign: 'center' as const,
          }}>
            <div style={{ fontSize: '72px', animation: 'pulse 2s ease infinite' }}>📬</div>

            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', animation: 'fadeUp 0.4s ease' }}>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#2E2A26' }}>
                Controlla la tua email
              </div>
              <div style={{ fontSize: '14px', color: '#7A6F65', lineHeight: '1.6', maxWidth: '280px' }}>
                Abbiamo inviato un link di conferma a
              </div>
              <div style={{
                fontSize: '14px', fontWeight: '700', color: '#E8869E',
                background: '#F9E0E6', padding: '8px 16px', borderRadius: '999px',
              }}>
                {registeredEmail}
              </div>
            </div>

            <div style={{
              background: '#EEE8D8', borderRadius: '16px', padding: '20px',
              maxWidth: '300px', display: 'flex', flexDirection: 'column' as const,
              gap: '12px', animation: 'fadeUp 0.4s ease 0.1s both',
            }}>
              <div style={{ fontSize: '13px', color: '#2E2A26', fontWeight: '700' }}>
                Come procedere:
              </div>
              {[
                { icon: '1️⃣', text: 'Apri la tua casella email' },
                { icon: '2️⃣', text: 'Clicca il link di conferma' },
                { icon: '3️⃣', text: 'Verrai reindirizzato a scegliere il tuo username' },
              ].map((step) => (
                <div key={step.icon} style={{
                  display: 'flex', gap: '10px',
                  alignItems: 'center', fontSize: '13px', color: '#7A6F65',
                }}>
                  <span>{step.icon}</span>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '12px', color: '#B0A899', animation: 'fadeUp 0.4s ease 0.2s both' }}>
              Non hai ricevuto l'email?
            </div>

            <button
              onClick={async () => {
                const { error } = await supabase.auth.resend({
                  type: 'signup',
                  email: registeredEmail,
                });
                if (!error) {
                  setSuccessMsg('Email inviata di nuovo!');
                  setTimeout(() => setSuccessMsg(''), 3000);
                }
              }}
              style={{
                ...styles.submitBtn,
                background: '#EEE8D8',
                animation: 'fadeUp 0.4s ease 0.25s both',
              }}
            >
              🔄 Invia di nuovo
            </button>

            {successMsg && (
              <div style={{ ...styles.message, animation: 'fadeUp 0.2s ease' }}>
                ✅ {successMsg}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─── Form principale ──────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '340px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: 'opacity 0.4s ease, transform 0.4s ease',
    animation: shake ? 'shake 0.5s ease' : 'none',
  };

  const checkRowStyle = (ok: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: ok ? '#3CA648' : '#B0A899',
    transition: 'color 0.2s ease',
  });

  const matchIndicator = (match: boolean, text: string) => (
    <div style={{
      fontSize: '11px',
      color: match ? '#3CA648' : '#E8869E',
      marginTop: '4px',
      transition: 'color 0.2s',
    }}>
      {match ? '✓' : '✗'} {text}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .auth-tab {
          flex: 1;
          padding: 10px;
          border: none;
          background: #EEE8D8;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #7A6F65;
          transition: background 0.2s, color 0.2s;
          font-family: inherit;
        }
        .auth-tab:first-child { border-radius: 12px 0 0 12px; }
        .auth-tab:last-child  { border-radius: 0 12px 12px 0; }
        .auth-tab-active {
          background: #F4B8C8 !important;
          color: #2E2A26 !important;
        }
      `}</style>

      <div style={styles.screen}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column' as const,
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 24px', gap: '20px', overflowY: 'auto' as const,
        }}>

          {/* Logo */}
          <div style={{
            display: 'flex', flexDirection: 'column' as const,
            alignItems: 'center', gap: '6px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-16px)',
            transition: 'opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s',
          }}>
            <div style={{ fontSize: '48px' }}>🎬</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#E8869E', letterSpacing: '3px' }}>
              CINEDATE
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', width: '100%', maxWidth: '340px',
            borderRadius: '12px', overflow: 'hidden',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s ease 0.15s',
          }}>
            <button
              className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : ''}`}
              onClick={() => setMode('login')}
            >
              Accedi
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'auth-tab-active' : ''}`}
              onClick={() => setMode('register')}
            >
              Registrati
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={cardStyle}>

            {/* Email */}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              style={styles.input}
            />

            {/* Email conferma — solo register */}
            {mode === 'register' && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <input
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  placeholder="Conferma email"
                  required
                  autoComplete="email"
                  style={{
                    ...styles.input,
                    borderColor: emailConfirm.length > 0
                      ? (emailsMatch ? '#9EE6A4' : '#F4B8C8')
                      : '#E0D6C8',
                  }}
                />
                {emailConfirm.length > 0 && matchIndicator(emailsMatch, 'Le email coincidono')}
              </div>
            )}

            {/* Password */}
            <div>
              <div style={{ position: 'relative' as const }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="Password"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  style={{
                    ...styles.input,
                    paddingRight: '44px',
                    borderColor: mode === 'register' && password.length > 0
                      ? (passwordValid ? '#9EE6A4' : '#F4B8C8')
                      : '#E0D6C8',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  style={{
                    position: 'absolute' as const,
                    right: '10px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: '18px',
                    opacity: showPass ? 1 : 0.45,
                  }}
                >👁️</button>
              </div>

              {/* Checklist password — solo register */}
              {mode === 'register' && (passwordFocused || password.length > 0) && (
                <div style={{
                  background: '#FAF3E0', border: '1px solid #E0D6C8',
                  borderRadius: '8px', padding: '10px 12px', marginTop: '6px',
                  display: 'flex', flexDirection: 'column' as const,
                  gap: '4px', animation: 'fadeIn 0.2s ease',
                }}>
                  {passwordChecks.map((c) => (
                    <div key={c.label} style={checkRowStyle(c.ok)}>
                      <span style={{ fontSize: '13px' }}>{c.ok ? '✅' : '⬜'}</span>
                      {c.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Password conferma — solo register */}
            {mode === 'register' && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ position: 'relative' as const }}>
                  <input
                    type={showPassConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Conferma password"
                    required
                    autoComplete="new-password"
                    style={{
                      ...styles.input,
                      paddingRight: '44px',
                      borderColor: passwordConfirm.length > 0
                        ? (passwordsMatch ? '#9EE6A4' : '#F4B8C8')
                        : '#E0D6C8',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassConfirm((v) => !v)}
                    style={{
                      position: 'absolute' as const,
                      right: '10px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '18px',
                      opacity: showPassConfirm ? 1 : 0.45,
                    }}
                  >👁️</button>
                </div>
                {passwordConfirm.length > 0 && matchIndicator(passwordsMatch, 'Le password coincidono')}
              </div>
            )}

            {/* Errore */}
            {error && (
              <div style={{
                ...styles.message,
                background: '#F4B8C8', color: '#E8869E', borderColor: '#E8869E',
                animation: 'fadeIn 0.2s ease',
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Successo */}
            {successMsg && (
              <div style={{ ...styles.message, animation: 'fadeIn 0.2s ease' }}>
                ✅ {successMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                ...styles.submitBtn,
                opacity: isLoading ? 0.7 : 1,
                transform: isLoading ? 'scale(0.98)' : 'scale(1)',
                transition: 'opacity 0.2s, transform 0.2s',
              }}
            >
              {isLoading
                ? '⏳ Caricamento...'
                : mode === 'login' ? '🔓 Accedi' : '✨ Registrati'}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            width: '100%', maxWidth: '340px',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s ease 0.3s',
          }}>
            <div style={{ flex: 1, borderTop: '1px solid #E0D6C8' }} />
            <span style={{ fontSize: '12px', color: '#B0A899' }}>oppure</span>
            <div style={{ flex: 1, borderTop: '1px solid #E0D6C8' }} />
          </div>

          {/* Ospite */}
          <button
            onClick={handleGuest}
            style={{
              ...styles.submitBtn,
              background: '#EEE8D8',
              width: '100%', maxWidth: '340px',
              opacity: mounted ? 1 : 0,
              transition: 'opacity 0.4s ease 0.35s',
            }}
          >
            👤 Continua come ospite
          </button>

          <div style={{
            fontSize: '11px', color: '#B0A899',
            textAlign: 'center' as const, maxWidth: '280px', lineHeight: '1.5',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s ease 0.4s',
          }}>
            Come ospite puoi fare swipe e usare le stanze.<br />
            Recensioni, like e match salvati richiedono un account.
          </div>

        </div>
      </div>
    </>
  );
}