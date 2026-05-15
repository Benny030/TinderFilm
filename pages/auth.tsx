'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { createBrowserClient } from '@/utils/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import { C, R, FONT, TEXT, S, SHADOW, btn, input } from '@/styles/token';

type Mode = 'login' | 'register';

type PasswordCheck = { label: string; ok: boolean };

function getPasswordChecks(p: string): PasswordCheck[] {
  return [
    { label: 'Almeno 8 caratteri',           ok: p.length >= 8 },
    { label: 'Una lettera maiuscola',         ok: /[A-Z]/.test(p) },
    { label: 'Una lettera minuscola',         ok: /[a-z]/.test(p) },
    { label: 'Un numero',                     ok: /[0-9]/.test(p) },
    { label: 'Un carattere speciale (!@#$)',  ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
  ];
}

function isPasswordValid(p: string) {
  return getPasswordChecks(p).every((c) => c.ok);
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = useRef(createBrowserClient()).current;
  const { enterAsGuest } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [mounted, setMounted] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setEmail(''); setEmailConfirm('');
    setPassword(''); setPasswordConfirm('');
    setError(''); setSuccessMsg('');
    setPasswordFocused(false);
  }, [mode]);

  const checks = getPasswordChecks(password);
  const passwordValid = isPasswordValid(password);
  const emailsMatch = email === emailConfirm;
  const passwordsMatch = password === passwordConfirm;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // ─── Google login ─────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message ?? 'Errore con Google');
      setIsGoogleLoading(false);
    }
  };

  // ─── Email submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(''); setSuccessMsg('');

    if (mode === 'register') {
      if (!emailsMatch) { setError('Le email non coincidono'); triggerShake(); return; }
      if (!passwordValid) { setError('La password non soddisfa i requisiti'); triggerShake(); return; }
      if (!passwordsMatch) { setError('Le password non coincidono'); triggerShake(); return; }
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSuccessMsg('Accesso effettuato!');
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
      if (msg.includes('Invalid login credentials')) setError('Email o password errati');
      else if (msg.includes('Email not confirmed')) setError('Conferma prima la tua email');
      else if (msg.includes('already registered')) setError('Email già registrata — accedi');
      else setError(msg || 'Errore sconosciuto');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = () => {
    enterAsGuest();
    window.location.href = '/home';
  };

  // ─── Schermata email inviata ──────────────────────────────────────────────
  if (emailSent) {
    return (
      <>
        <style>{`
          @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
          @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <div style={{ minHeight: '100vh', background: C.bgSoft, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: S.lg }}>
          <div style={{ background: C.bg, borderRadius: R.xl, padding: S.xl, maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: SHADOW.lg, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: S.md }}>
            <div style={{ fontSize: '64px', animation: 'pulse 2s ease infinite' }}>📬</div>
            <div style={{ fontSize: TEXT.xl, fontWeight: '800', color: C.ink }}>Controlla la tua email</div>
            <div style={{ fontSize: TEXT.sm, color: C.muted, lineHeight: '1.6' }}>Abbiamo inviato un link di conferma a</div>
            <div style={{ fontSize: TEXT.base, fontWeight: '700', color: C.primary, background: C.primaryLight, padding: '8px 20px', borderRadius: R.full }}>
              {registeredEmail}
            </div>
            <div style={{ background: C.bgSoft, borderRadius: R.md, padding: S.md, width: '100%', display: 'flex', flexDirection: 'column', gap: S.sm }}>
              {[
                { icon: '1️⃣', text: 'Apri la tua casella email' },
                { icon: '2️⃣', text: 'Clicca il link di conferma' },
                { icon: '3️⃣', text: 'Scegli il tuo username' },
              ].map((s) => (
                <div key={s.icon} style={{ display: 'flex', gap: S.sm, alignItems: 'center', fontSize: TEXT.sm, color: C.muted }}>
                  <span>{s.icon}</span><span>{s.text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                await supabase.auth.resend({ type: 'signup', email: registeredEmail });
                setSuccessMsg('Email inviata di nuovo!');
                setTimeout(() => setSuccessMsg(''), 3000);
              }}
              style={{ ...btn.ghost, width: 'auto', padding: '10px 24px' }}
            >
              🔄 Invia di nuovo
            </button>
            {successMsg && <div style={{ fontSize: TEXT.sm, color: C.success }}>{successMsg}</div>}
            <button onClick={() => setEmailSent(false)} style={{ fontSize: TEXT.sm, color: C.faint, background: 'none', border: 'none', cursor: 'pointer' }}>← Torna al login</button>
          </div>
        </div>
      </>
    );
  }

  // ─── Form principale ──────────────────────────────────────────────────────
  return (
    <>
      <style jsx>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        @keyframes fadeIn {
          from{opacity:0;transform:translateY(8px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes fadeUp {
          from{opacity:0;transform:translateY(20px)}
          to{opacity:1;transform:translateY(0)}
        }
        .auth-input:focus { border-color: ${C.primary} !important; }
        .auth-btn-primary:hover { opacity: 0.9; }
        .auth-btn-social:hover { background: ${C.bgSoft} !important; }
        .auth-tab { flex:1; padding:10px; border:none; background:${C.bgSoft}; cursor:pointer; font-size:${TEXT.base}; font-weight:600; color:${C.muted}; transition:all 0.2s; font-family:${FONT.sans}; }
        .auth-tab:first-child { border-radius:${R.full} 0 0 ${R.full}; }
        .auth-tab:last-child  { border-radius:0 ${R.full} ${R.full} 0; }
        .auth-tab-active { background:${C.primary} !important; color:${C.white} !important; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: C.bgSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: S.md,
      }}>
        <div style={{
          background: C.bg,
          borderRadius: R.xl,
          padding: `${S.xl} ${S.lg}`,
          width: '100%',
          maxWidth: '420px',
          boxShadow: SHADOW.lg,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>

          {/* ─── Logo ─────────────────────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: S.lg }}>
            <div style={{ fontSize: TEXT.xl, fontWeight: '800', color: C.primary, letterSpacing: '1px' }}>
              🎬 CINEDATE
            </div>
            <div style={{ fontSize: TEXT.sm, color: C.muted, marginTop: S.xs }}>
              {mode === 'login' ? 'Bentornato!' : 'Crea il tuo account'}
            </div>
          </div>

          {/* ─── Tab switcher ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', borderRadius: R.full, overflow: 'hidden', marginBottom: S.lg, border: `1.5px solid ${C.border}` }}>
            <button className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : ''}`} onClick={() => setMode('login')}>Accedi</button>
            <button className={`auth-tab ${mode === 'register' ? 'auth-tab-active' : ''}`} onClick={() => setMode('register')}>Registrati</button>
          </div>

          {/* ─── Google ───────────────────────────────────────────────────── */}
          <button
            className="auth-btn-social"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            style={{ ...btn.social, marginBottom: S.sm, opacity: isGoogleLoading ? 0.7 : 1 }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
            </svg>
            {isGoogleLoading ? 'Reindirizzamento...' : 'Continua con Google'}
          </button>

          {/* ─── Apple placeholder ────────────────────────────────────────── */}
          <button
            style={{ ...btn.social, marginBottom: S.lg, opacity: 0.4, cursor: 'not-allowed' }}
            disabled
            title="Disponibile prossimamente"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M13.173 9.438c-.02-2.137 1.748-3.17 1.826-3.22-1-1.458-2.548-1.658-3.094-1.677-1.315-.134-2.573.776-3.24.776-.666 0-1.692-.757-2.784-.737-1.43.021-2.754.835-3.49 2.118-1.492 2.589-.382 6.425 1.072 8.523.714 1.024 1.563 2.175 2.676 2.133 1.077-.042 1.483-.692 2.784-.692 1.302 0 1.666.692 2.805.67 1.16-.02 1.89-1.046 2.598-2.074.822-1.188 1.16-2.34 1.18-2.4-.026-.01-2.308-.885-2.333-3.42z"/>
              <path d="M11.07 3.18c.594-.72.993-1.72.883-2.72-.854.035-1.888.57-2.5 1.287-.546.634-1.027 1.647-.898 2.617.952.073 1.92-.484 2.515-1.184z"/>
            </svg>
            Continua con Apple
          </button>

          {/* ─── Divider ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.lg }}>
            <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
            <span style={{ fontSize: TEXT.xs, color: C.faint }}>oppure</span>
            <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
          </div>

          {/* ─── Form ─────────────────────────────────────────────────────── */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex', flexDirection: 'column', gap: S.sm,
              animation: shake ? 'shake 0.5s ease' : 'none',
            }}
          >
            {/* Email */}
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              style={input.base}
            />

            {/* Email conferma — solo register */}
            {mode === 'register' && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <input
                  className="auth-input"
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  placeholder="Conferma email"
                  required
                  style={{
                    ...input.base,
                    borderColor: emailConfirm.length > 0
                      ? emailsMatch ? C.success : C.error
                      : C.border,
                  }}
                />
                {emailConfirm.length > 0 && (
                  <div style={{ fontSize: TEXT.xs, color: emailsMatch ? C.success : C.error, marginTop: '4px' }}>
                    {emailsMatch ? '✓ Le email coincidono' : '✗ Le email non coincidono'}
                  </div>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <div style={{ position: 'relative' }}>
                <input
                  className="auth-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="Password"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  style={{
                    ...input.base,
                    paddingRight: '44px',
                    borderColor: mode === 'register' && password.length > 0
                      ? passwordValid ? C.success : C.error
                      : C.border,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', opacity: showPass ? 1 : 0.4 }}
                >👁️</button>
              </div>

              {/* Checklist — solo register */}
              {mode === 'register' && (passwordFocused || password.length > 0) && (
                <div style={{ background: C.bgSoft, borderRadius: R.sm, padding: S.sm, marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', animation: 'fadeIn 0.2s ease' }}>
                  {checks.map((c) => (
                    <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: TEXT.xs, color: c.ok ? C.success : C.faint, transition: 'color 0.2s' }}>
                      <span>{c.ok ? '✅' : '⬜'}</span>{c.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Password conferma — solo register */}
            {mode === 'register' && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    className="auth-input"
                    type={showPassConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Conferma password"
                    required
                    autoComplete="new-password"
                    style={{
                      ...input.base,
                      paddingRight: '44px',
                      borderColor: passwordConfirm.length > 0
                        ? passwordsMatch ? C.success : C.error
                        : C.border,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassConfirm((v) => !v)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', opacity: showPassConfirm ? 1 : 0.4 }}
                  >👁️</button>
                </div>
                {passwordConfirm.length > 0 && (
                  <div style={{ fontSize: TEXT.xs, color: passwordsMatch ? C.success : C.error, marginTop: '4px' }}>
                    {passwordsMatch ? '✓ Le password coincidono' : '✗ Le password non coincidono'}
                  </div>
                )}
              </div>
            )}

            {/* Errore */}
            {error && (
              <div style={{ background: C.errorLight, color: C.error, borderRadius: R.sm, padding: '10px 14px', fontSize: TEXT.sm, animation: 'fadeIn 0.2s ease' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Successo */}
            {successMsg && (
              <div style={{ background: C.successLight, color: C.success, borderRadius: R.sm, padding: '10px 14px', fontSize: TEXT.sm }}>
                ✅ {successMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="auth-btn-primary"
              style={{ ...btn.primary, opacity: isLoading ? 0.7 : 1, marginTop: S.xs }}
            >
              {isLoading ? '⏳ Caricamento...' : mode === 'login' ? 'Accedi' : 'Registrati'}
            </button>
          </form>

          {/* ─── Switch mode ──────────────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginTop: S.md }}>
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: TEXT.sm, color: C.muted }}
            >
              {mode === 'login'
                ? <>Non hai un account? <span style={{ color: C.primary, fontWeight: '600' }}>Registrati</span></>
                : <>Hai già un account? <span style={{ color: C.primary, fontWeight: '600' }}>Accedi</span></>
              }
            </button>
          </div>

          {/* ─── Divider ospite ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, margin: `${S.md} 0` }}>
            <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
            <span style={{ fontSize: TEXT.xs, color: C.faint }}>oppure</span>
            <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
          </div>

          {/* ─── Ospite ───────────────────────────────────────────────────── */}
          <button onClick={handleGuest} style={{ ...btn.ghost }}>
            👤 Accedi come ospite
          </button>

          <div style={{ fontSize: TEXT.xs, color: C.faint, textAlign: 'center', marginTop: S.sm, lineHeight: '1.5' }}>
            Come ospite puoi fare swipe e usare le stanze.<br />
            Recensioni e match salvati richiedono un account.
          </div>
        </div>
      </div>
    </>
  );
}