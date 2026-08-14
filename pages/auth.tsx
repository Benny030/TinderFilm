'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { createBrowserClient } from '@/utils/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import {
  SignOut,
  Eye,
  EyeSlash,
  Moon,
  Sun,
} from '@phosphor-icons/react';

type Mode = 'login' | 'register';

type PasswordCheck = { label: string; ok: boolean };

// ─── Palette (già allineata alla home) ─────────────────────────────────
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
};

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
};

const convertHexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r}, ${g}, ${b}`;
};

function getPasswordChecks(p: string): PasswordCheck[] {
  return [
    { label: 'Almeno 8 caratteri', ok: p.length >= 8 },
    { label: 'Una lettera maiuscola', ok: /[A-Z]/.test(p) },
    { label: 'Una lettera minuscola', ok: /[a-z]/.test(p) },
    { label: 'Un numero', ok: /[0-9]/.test(p) },
    { label: 'Un carattere speciale (!@#$)', ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
  ];
}

function isPasswordValid(p: string) {
  return getPasswordChecks(p).every((c) => c.ok);
}

async function getUserProfile(supabase: ReturnType<typeof createBrowserClient>, user: { id: string; email?: string }) {
  const { data: byId } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (byId?.username || !user.email) return byId;

  const { data: byEmail } = await supabase
    .from('users')
    .select('username')
    .eq('email', user.email)
    .maybeSingle();

  return byEmail;
}

function getOAuthCallbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

// ─── SVG Logo Google ──────────────────────────────────────────────────
const GoogleLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

// ─── SVG Logo Apple ──────────────────────────────────────────────────
const AppleLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 384 512">
    <path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-152.1c-24.3-29.4-58.9-42.1-88.5-42.1-25.9 0-59.4 13.4-83.2 37.8-24.7 25.4-37.4 60-33.5 93.2 36 2.7 67.8-15.1 92.3-40.9 24-25.2 35.5-58.6 32.9-88z"/>
  </svg>
);

export default function AuthPage() {
  const router = useRouter();
  const supabase = useRef(createBrowserClient()).current;
  const { enterAsGuest } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

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

  // Animated swipe state
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const profile = await getUserProfile(supabase, {
        id: session.user.id,
        email: session.user.email,
      });
      router.replace(profile?.username ? '/home' : '/username');
    };
    check().catch(console.error);
  }, [router.isReady, supabase]);

  useEffect(() => {
    setEmail('');
    setEmailConfirm('');
    setPassword('');
    setPasswordConfirm('');
    setError('');
    setSuccessMsg('');
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

  const handleModeSwitch = (newMode: Mode) => {
    if (newMode === mode) return;
    setSwipeDirection(newMode === 'register' ? 'left' : 'right');
    setMode(newMode);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError('');
    try {
      sessionStorage.setItem('cineDateOAuthStarted', 'true');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getOAuthCallbackUrl() },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message ?? 'Errore con Google');
      setIsGoogleLoading(false);
    }
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
        setSuccessMsg('Accesso effettuato!');
        setTimeout(() => router.replace('/home'), 800);
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

  const cssVars = {
    '--home-bg': P.bg,
    '--home-bg-soft': P.bgSoft,
    '--home-card': P.card,
    '--home-card-hover': P.cardHover,
    '--home-border': P.border,
    '--home-border-rgb': convertHexToRgb(P.border),
    '--home-gold': P.gold,
    '--home-gold-soft': P.goldSoft,
    '--home-gold-rgb': convertHexToRgb(P.gold),
    '--home-pink': P.pink,
    '--home-pink-deep': P.pinkDeep,
    '--home-pink-rgb': convertHexToRgb(P.pink),
    '--home-text': P.text,
    '--home-text-muted': P.textMuted,
    '--home-text-faint': P.textFaint,
  } as React.CSSProperties;

  if (emailSent) {
    return (
      <div className="home-cine" style={{ ...cssVars, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="ticket-card animate-in" style={{ width: '100%', maxWidth: '400px', padding: '28px 24px', textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📬</div>
          <div style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--home-font-display)', color: 'var(--home-text)', marginBottom: '4px' }}>Controlla la tua email</div>
          <div style={{ color: 'var(--home-text-muted)', fontSize: '12px', lineHeight: '1.5' }}>Abbiamo inviato un link di conferma a</div>
          <div style={{ display: 'inline-block', margin: '12px 0 16px', padding: '6px 14px', background: 'rgba(var(--home-pink-rgb), 0.15)', border: '1px solid rgba(var(--home-pink-rgb), 0.3)', color: 'var(--home-pink)', fontSize: '12px', fontWeight: '600' }}>{registeredEmail}</div>
          <div style={{ padding: '10px 14px', background: 'var(--home-bg-soft)', border: '1px solid var(--home-border)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', fontSize: '11px' }}>
            {['1️⃣ Apri la tua casella email', '2️⃣ Clicca il link di conferma', '3️⃣ Scegli il tuo username'].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--home-text-faint)' }}><span>{s}</span></div>
            ))}
          </div>
          <button onClick={async () => { await supabase.auth.resend({ type: 'signup', email: registeredEmail }); setSuccessMsg('Email inviata di nuovo!'); setTimeout(() => setSuccessMsg(''), 3000); }} style={{ border: '1px solid var(--home-border)', background: 'transparent', color: 'var(--home-text-muted)', padding: '6px 16px', cursor: 'pointer', fontFamily: 'var(--home-font)', fontSize: '11px', transition: 'all 0.25s ease' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--home-gold)'; e.currentTarget.style.color = 'var(--home-gold)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--home-border)'; e.currentTarget.style.color = 'var(--home-text-muted)'; }}>🔄 Invia di nuovo</button>
          {successMsg && <div style={{ marginTop: '10px', padding: '8px 12px', fontSize: '11px', color: '#5dd97c', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>{successMsg}</div>}
          <button onClick={() => setEmailSent(false)} style={{ display: 'block', margin: '16px auto 0', border: 0, background: 'transparent', color: 'var(--home-text-faint)', cursor: 'pointer', fontFamily: 'var(--home-font)', fontSize: '11px', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--home-text-muted)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--home-text-faint)')}>← Torna al login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-cine" style={{ ...cssVars, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--home-bg)', position: 'relative', overflow: 'hidden', padding: '20px' }}>

      {/* ─── Sfondo con animazioni (solo dark mode) ─────────────────── */}
      {isDark && (
        <>
          <div className="bg-film-grain" />
          <div className="bg-scanlines" />
          <div className="bg-flicker" />
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            <img src="/assets/landing/authbk.png" alt="background" style={{ width: 'auto', height: '100%', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg) scale(1.4)', opacity: 0.3, objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          </div>
        </>
      )}

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        <div className={`ticket-card ${mounted ? 'mounted' : ''}`} style={{ padding: '24px 24px 20px', backdropFilter: 'blur(12px)', border: '1px solid rgba(var(--home-border-rgb), 0.6)', boxShadow: '0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)', animation: mounted ? 'fadeUp 0.5s ease both 0.1s' : 'none', transform: shake ? 'translateX(-6px)' : 'none' }}>
          <div className="ticket-tear" style={{ background: 'var(--home-bg)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <button onClick={() => router.push('/')} className="icon-btn" style={{ background: 'transparent', border: '1px solid var(--home-border)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--home-text-faint)', transition: 'all 0.25s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--home-gold)'; e.currentTarget.style.color = 'var(--home-gold)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--home-border)'; e.currentTarget.style.color = 'var(--home-text-faint)'; }}><SignOut size={14} /></button>
            <button onClick={toggleTheme} className="icon-btn" style={{ background: 'var(--home-bg-soft)', border: '1px solid var(--home-border)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--home-text)', transition: 'border-color 0.25s' }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--home-gold)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--home-border)')}>{isDark ? <Sun size={14} /> : <Moon size={14} />}</button>
          </div>

          <div className="auth-brand" style={{ textAlign: 'center', marginBottom: '6px' }}>
            <div className="cine-logo" style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', fontFamily: 'var(--home-font-display)' }}>
              <span className="logo-cine" style={{ color: 'var(--home-text)' }}>CINE</span>
              <span className="logo-date" style={{ color: 'var(--home-pink)' }}>DATE</span>
            </div>
            <div className="auth-subtitle" style={{ color: 'var(--home-text-faint)', fontSize: '12px', marginTop: '2px' }}>{mode === 'login' ? 'Bentornato!' : 'Crea il tuo account'}</div>
          </div>

          {/* ─── TABS CON ANIMAZIONE SWIPE ───────────────────────────── */}
          <div className="tabs-container" style={{ display: 'flex', margin: '16px 0 14px', border: '1px solid var(--home-border)', overflow: 'hidden', background: 'var(--home-bg-soft)', position: 'relative' }}>
            <div 
              className={`tabs-slider ${swipeDirection}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '50%',
                background: 'linear-gradient(180deg, var(--home-pink), var(--home-pink-deep))',
                boxShadow: '0 4px 16px rgba(var(--home-pink-rgb), 0.4)',
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: mode === 'login' ? 'translateX(0%)' : 'translateX(100%)',
                zIndex: 1,
              }}
            />
            <button 
              onClick={() => handleModeSwitch('login')} 
              className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
              style={{ 
                flex: 1, 
                height: '36px', 
                border: 0, 
                background: 'transparent',
                color: mode === 'login' ? '#fff' : 'var(--home-text-faint)',
                fontSize: '12px', 
                fontWeight: '600', 
                cursor: 'pointer', 
                fontFamily: 'var(--home-font)', 
                transition: 'color 0.3s ease',
                position: 'relative',
                zIndex: 2,
              }}
            >
              Accedi
            </button>
            <button 
              onClick={() => handleModeSwitch('register')} 
              className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
              style={{ 
                flex: 1, 
                height: '36px', 
                border: 0, 
                background: 'transparent',
                color: mode === 'register' ? '#fff' : 'var(--home-text-faint)',
                fontSize: '12px', 
                fontWeight: '600', 
                cursor: 'pointer', 
                fontFamily: 'var(--home-font)', 
                transition: 'color 0.3s ease',
                position: 'relative',
                zIndex: 2,
              }}
            >
              Registrati
            </button>
          </div>

          <button onClick={handleGoogleLogin} disabled={isGoogleLoading} className="social-btn" style={{ width: '100%', height: '40px', border: '1px solid var(--home-border)', background: 'var(--home-bg-soft)', color: 'var(--home-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontFamily: 'var(--home-font)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.3s ease', opacity: isGoogleLoading ? 0.4 : 1 }} onMouseEnter={(e) => { if (!isGoogleLoading) { e.currentTarget.style.background = 'var(--home-card-hover)'; e.currentTarget.style.borderColor = 'var(--home-gold)'; } }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--home-bg-soft)'; e.currentTarget.style.borderColor = 'var(--home-border)'; }}><GoogleLogo />{isGoogleLoading ? 'Reindirizzamento...' : 'Continua con Google'}</button>

          <button disabled className="social-btn" style={{ width: '100%', height: '40px', marginTop: '8px', border: '1px solid var(--home-border)', background: 'var(--home-bg-soft)', color: 'var(--home-text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontFamily: 'var(--home-font)', fontSize: '12px', fontWeight: '500', cursor: 'not-allowed', opacity: 0.4 }}><AppleLogo />Continua con Apple</button>

          <div className="divider" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0', color: 'var(--home-text-faint)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}><span style={{ flex: 1, height: '1px', background: 'var(--home-border)' }} /><span>oppure</span><span style={{ flex: 1, height: '1px', background: 'var(--home-border)' }} /></div>

          {/* ─── FORM CON ANIMAZIONE SWIPE ───────────────────────────── */}
          <div className="form-container" style={{ overflow: 'hidden' }}>
            <div 
              className={`form-slider ${swipeDirection}`}
              style={{
                display: 'flex',
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: mode === 'login' ? 'translateX(0%)' : 'translateX(-50%)',
                width: '200%',
              }}
            >
              {/* ─── LOGIN FORM ────────────────────────────────────── */}
              <div style={{ width: '50%', paddingLeft: '15px', paddingRight: '15px' }}>
                <form onSubmit={handleSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-field">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required autoComplete="email" className="auth-input" style={{ width: '100%', height: '40px', padding: '0 14px', border: '1px solid var(--home-border)', outline: 'none', background: 'var(--home-bg-soft)', color: 'var(--home-text)', fontFamily: 'var(--home-font)', fontSize: '12px', transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box' }} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--home-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--home-gold-rgb), 0.2)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--home-border)'; e.currentTarget.style.boxShadow = 'none'; }} />
                  </div>

                  <div className="form-field">
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} onFocus={(e) => { setPasswordFocused(true); e.currentTarget.style.borderColor = 'var(--home-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--home-gold-rgb), 0.2)'; }} onBlur={(e) => { setPasswordFocused(false); if (password.length === 0) { e.currentTarget.style.borderColor = 'var(--home-border)'; } e.currentTarget.style.boxShadow = 'none'; }} placeholder="Password" required autoComplete="current-password" className="auth-input" style={{ width: '100%', height: '40px', padding: '0 40px 0 14px', border: '1px solid var(--home-border)', outline: 'none', background: 'var(--home-bg-soft)', color: 'var(--home-text)', fontFamily: 'var(--home-font)', fontSize: '12px', transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box' }} />
                      <button type="button" onClick={() => setShowPass((v) => !v)} className="toggle-vis" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '30px', height: '30px', display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: 'var(--home-text-faint)', cursor: 'pointer', fontSize: '14px', transition: 'color 0.3s, background 0.3s' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--home-text)'; e.currentTarget.style.background = 'var(--home-border)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--home-text-faint)'; e.currentTarget.style.background = 'transparent'; }}>{showPass ? <Eye size={16} /> : <EyeSlash size={16} />}</button>
                    </div>
                  </div>

                  {error && <div className="auth-error" style={{ padding: '10px 14px', fontSize: '11px', color: '#ff6868', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)' }}>⚠️ {error}</div>}
                  {successMsg && <div className="auth-success" style={{ padding: '10px 14px', fontSize: '11px', color: '#5dd97c', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>✅ {successMsg}</div>}

                  <button type="submit" disabled={isLoading} className="submit-btn" style={{ width: '100%', height: '40px', marginTop: '2px', border: 0, background: 'linear-gradient(180deg, var(--home-gold), var(--home-gold-soft))', color: '#0a0a0a', fontFamily: 'var(--home-font)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '0.6px', boxShadow: '0 4px 20px rgba(var(--home-gold-rgb), 0.3)', opacity: isLoading ? 0.5 : 1 }} onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(var(--home-gold-rgb), 0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }} onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--home-gold-rgb), 0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}>{isLoading ? '⏳ Caricamento...' : 'Accedi'}</button>
                </form>
              </div>

              {/* ─── REGISTER FORM ─────────────────────────────────── */}
              <div style={{ width: '50%', paddingLeft: '15px', paddingRight: '15px' }}>
                <form onSubmit={handleSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-field">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required autoComplete="email" className="auth-input" style={{ width: '100%', height: '40px', padding: '0 14px', border: '1px solid var(--home-border)', outline: 'none', background: 'var(--home-bg-soft)', color: 'var(--home-text)', fontFamily: 'var(--home-font)', fontSize: '12px', transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box' }} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--home-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--home-gold-rgb), 0.2)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--home-border)'; e.currentTarget.style.boxShadow = 'none'; }} />
                  </div>

                  <div className="form-field">
                    <input type="email" value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} placeholder="Conferma email" required className="auth-input" style={{ width: '100%', height: '40px', padding: '0 14px', border: `1px solid ${emailConfirm.length > 0 ? (emailsMatch ? '#43c96a' : '#ef5555') : 'var(--home-border)'}`, outline: 'none', background: 'var(--home-bg-soft)', color: 'var(--home-text)', fontFamily: 'var(--home-font)', fontSize: '12px', transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box' }} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--home-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--home-gold-rgb), 0.2)'; }} onBlur={(e) => { if (emailConfirm.length === 0) { e.currentTarget.style.borderColor = 'var(--home-border)'; } e.currentTarget.style.boxShadow = 'none'; }} />
                    {emailConfirm.length > 0 && <div className="validation-msg" style={{ marginTop: '4px', fontSize: '11px', color: emailsMatch ? '#43c96a' : '#ef5555', display: 'flex', alignItems: 'center', gap: '4px' }}>{emailsMatch ? '✓' : '✗'} {emailsMatch ? 'Le email coincidono' : 'Le email non coincidono'}</div>}
                  </div>

                  <div className="form-field">
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} onFocus={(e) => { setPasswordFocused(true); e.currentTarget.style.borderColor = 'var(--home-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--home-gold-rgb), 0.2)'; }} onBlur={(e) => { setPasswordFocused(false); if (password.length === 0) { e.currentTarget.style.borderColor = 'var(--home-border)'; } else { e.currentTarget.style.borderColor = passwordValid ? '#43c96a' : '#ef5555'; } e.currentTarget.style.boxShadow = 'none'; }} placeholder="Password" required autoComplete="new-password" className="auth-input" style={{ width: '100%', height: '40px', padding: '0 40px 0 14px', border: `1px solid ${password.length > 0 ? (passwordValid ? '#43c96a' : '#ef5555') : 'var(--home-border)'}`, outline: 'none', background: 'var(--home-bg-soft)', color: 'var(--home-text)', fontFamily: 'var(--home-font)', fontSize: '12px', transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box' }} />
                      <button type="button" onClick={() => setShowPass((v) => !v)} className="toggle-vis" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '30px', height: '30px', display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: 'var(--home-text-faint)', cursor: 'pointer', fontSize: '14px', transition: 'color 0.3s, background 0.3s' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--home-text)'; e.currentTarget.style.background = 'var(--home-border)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--home-text-faint)'; e.currentTarget.style.background = 'transparent'; }}>{showPass ? <Eye size={16} /> : <EyeSlash size={16} />}</button>
                    </div>
                    {(passwordFocused || password.length > 0) && (
                      <div className="password-checks" style={{ marginTop: '6px', padding: '10px 14px', background: 'var(--home-bg-soft)', border: '1px solid var(--home-border)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                        {checks.map((c) => <div key={c.label} className="check-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: c.ok ? '#43c96a' : 'var(--home-text-faint)', transition: 'color 0.3s' }}><span>{c.ok ? '✅' : '⬜'}</span>{c.label}</div>)}
                      </div>
                    )}
                  </div>

                  <div className="form-field">
                    <div style={{ position: 'relative' }}>
                      <input type={showPassConfirm ? 'text' : 'password'} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Conferma password" required autoComplete="new-password" className="auth-input" style={{ width: '100%', height: '40px', padding: '0 40px 0 14px', border: `1px solid ${passwordConfirm.length > 0 ? (passwordsMatch ? '#43c96a' : '#ef5555') : 'var(--home-border)'}`, outline: 'none', background: 'var(--home-bg-soft)', color: 'var(--home-text)', fontFamily: 'var(--home-font)', fontSize: '12px', transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box' }} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--home-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--home-gold-rgb), 0.2)'; }} onBlur={(e) => { if (passwordConfirm.length === 0) { e.currentTarget.style.borderColor = 'var(--home-border)'; } e.currentTarget.style.boxShadow = 'none'; }} />
                      <button type="button" onClick={() => setShowPassConfirm((v) => !v)} className="toggle-vis" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '30px', height: '30px', display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: 'var(--home-text-faint)', cursor: 'pointer', fontSize: '14px', transition: 'color 0.3s, background 0.3s' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--home-text)'; e.currentTarget.style.background = 'var(--home-border)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--home-text-faint)'; e.currentTarget.style.background = 'transparent'; }}>{showPassConfirm ? <Eye size={16} /> : <EyeSlash size={16} />}</button>
                    </div>
                    {passwordConfirm.length > 0 && <div className="validation-msg" style={{ marginTop: '4px', fontSize: '11px', color: passwordsMatch ? '#43c96a' : '#ef5555', display: 'flex', alignItems: 'center', gap: '4px' }}>{passwordsMatch ? '✓' : '✗'} {passwordsMatch ? 'Le password coincidono' : 'Le password non coincidono'}</div>}
                  </div>

                  {error && <div className="auth-error" style={{ padding: '10px 14px', fontSize: '11px', color: '#ff6868', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)' }}>⚠️ {error}</div>}
                  {successMsg && <div className="auth-success" style={{ padding: '10px 14px', fontSize: '11px', color: '#5dd97c', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>✅ {successMsg}</div>}

                  <button type="submit" disabled={isLoading} className="submit-btn" style={{ width: '100%', height: '40px', marginTop: '2px', border: 0, background: 'linear-gradient(180deg, var(--home-gold), var(--home-gold-soft))', color: '#0a0a0a', fontFamily: 'var(--home-font)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '0.6px', boxShadow: '0 4px 20px rgba(var(--home-gold-rgb), 0.3)', opacity: isLoading ? 0.5 : 1 }} onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(var(--home-gold-rgb), 0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }} onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--home-gold-rgb), 0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}>{isLoading ? '⏳ Caricamento...' : 'Registrati'}</button>
                </form>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button onClick={() => { handleModeSwitch(mode === 'login' ? 'register' : 'login'); setError(''); }} className="switch-mode" style={{ border: 0, background: 'transparent', color: 'var(--home-text-faint)', cursor: 'pointer', fontFamily: 'var(--home-font)', fontSize: '11px', transition: 'color 0.3s' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--home-text-muted)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--home-text-faint)')}>
              {mode === 'login' ? <>Non hai un account? <span style={{ color: 'var(--home-gold)', fontWeight: '600' }}>Registrati</span></> : <>Hai già un account? <span style={{ color: 'var(--home-gold)', fontWeight: '600' }}>Accedi</span></>}
            </button>
          </div>

          <div className="divider" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0 12px', color: 'var(--home-text-faint)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}><span style={{ flex: 1, height: '1px', background: 'var(--home-border)' }} /><span>oppure</span><span style={{ flex: 1, height: '1px', background: 'var(--home-border)' }} /></div>

          <button onClick={handleGuest} className="guest-btn" style={{ width: '100%', height: '40px', border: '1px solid var(--home-border)', background: 'var(--home-bg-soft)', color: 'var(--home-text-muted)', cursor: 'pointer', fontFamily: 'var(--home-font)', fontSize: '11px', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--home-gold)'; e.currentTarget.style.background = 'var(--home-card-hover)'; e.currentTarget.style.color = 'var(--home-text)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--home-border)'; e.currentTarget.style.background = 'var(--home-bg-soft)'; e.currentTarget.style.color = 'var(--home-text-muted)'; }}>👤 Accedi come ospite</button>

          <div style={{ textAlign: 'center', color: 'var(--home-text-faint)', fontSize: '9px', lineHeight: '1.5', marginTop: '10px' }}>Come ospite puoi fare swipe e usare le stanze.<br />Recensioni e match salvati richiedono un account.</div>

          <div className="ticket-tear" style={{ background: 'var(--home-bg)', bottom: '-1px', top: 'auto' }} />
        </div>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        .home-cine {
          --home-font: 'Inter', 'Helvetica Neue', sans-serif;
          --home-font-display: 'Playfair Display', Georgia, serif;
          --home-font-mono: 'JetBrains Mono', 'Courier New', monospace;
          font-family: var(--home-font);
          background: var(--home-bg);
          color: var(--home-text);
          min-height: 100%;
          letter-spacing: -0.01em;
        }

        .home-cine button,
        .home-cine input {
          border-radius: 0 !important;
        }
        .home-cine input:focus {
          outline: none;
        }

        /* ─── TICKET CARD ────────────────────────────────────────────── */
        .ticket-card {
          background: var(--home-card);
          border: 1px solid var(--home-border);
          position: relative;
          transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.3s ease;
          overflow: hidden;
        }
        .ticket-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid transparent;
          transition: border-color 0.3s ease;
          pointer-events: none;
        }
        .ticket-card:hover::after {
          border-color: rgba(var(--home-gold-rgb), 0.38);
        }
        .ticket-card .ticket-tear {
          position: absolute;
          left: 50%;
          bottom: -1px;
          transform: translateX(-50%);
          width: 14px;
          height: 5px;
          background: var(--home-bg);
          border-radius: 50% 50% 0 0;
          border-left: 1px solid var(--home-border);
          border-right: 1px solid var(--home-border);
          border-top: 1px solid var(--home-border);
          opacity: 0.6;
          animation: tearPulse 3s ease-in-out infinite;
        }

        @keyframes tearPulse {
          0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.9; transform: translateX(-50%) scale(1.1); }
        }

        /* ─── ANIMAZIONI SFONDO (solo dark) ─────────────────────────── */
        .bg-film-grain {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.08;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 256px 256px; 
        }

        .bg-scanlines {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.05;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px);
        }

        .bg-flicker {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          animation: flicker 8s infinite;
          opacity: 0.02;
        }

        @keyframes flicker {
          0%, 100% { opacity: 0.02; }
          10% { opacity: 0.06; }
          20% { opacity: 0.01; }
          30% { opacity: 0.05; }
          40% { opacity: 0.01; }
          70% { opacity: 0.03; }
          80% { opacity: 0.01; }
          90% { opacity: 0.05; }
        }

        /* ─── LOGO ANIMATO ───────────────────────────────────────────── */
        .cine-logo {
          display: inline-block;
        }
        .logo-cine {
          animation: goldGlow 4s ease-in-out infinite;
        }
        .logo-date {
          animation: pinkGlow 4s ease-in-out infinite 0.5s;
        }

        @keyframes goldGlow {
          0%, 100% { color: var(--home-text); }
          50% { color: var(--home-gold); }
        }
        @keyframes pinkGlow {
          0%, 100% { color: var(--home-pink); }
          50% { color: var(--home-gold); }
        }

        /* ─── SUBTITLE REVEAL ────────────────────────────────────────── */
        .auth-subtitle {
          animation: subtitleReveal 1.2s ease both;
        }
        @keyframes subtitleReveal {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        /* ─── BOTTONE SUBMIT PULSE ───────────────────────────────────── */
        .submit-btn {
          animation: submitPulse 3s ease-in-out infinite;
        }
        @keyframes submitPulse {
          0%, 100% { box-shadow: 0 4px 10px rgba(var(--home-gold-rgb), 0.3); }
          50% { box-shadow: 0 4px 15px rgba(var(--home-gold-rgb), 0.6); }
        }

        /* ─── SHIMMER BORDO CARD ────────────────────────────────────── */
        .ticket-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          background: linear-gradient(90deg, transparent, rgba(var(--home-gold-rgb), 0.1), transparent);
          background-size: 200% 100%;
          animation: shimmerBorder 4s linear infinite;
          pointer-events: none;
          z-index: 0;
          opacity: 0.3;
        }
        @keyframes shimmerBorder {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* ─── SWIPE ANIMATION PER TABS ──────────────────────────────── */
        .tabs-slider.left {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .tabs-slider.right {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* ─── SWIPE ANIMATION PER FORM ──────────────────────────────── */
        .form-slider.left {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .form-slider.right {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* ─── ALTRE ANIMAZIONI ───────────────────────────────────────── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ticket-card.mounted {
          animation: fadeUp 0.5s ease both 0.1s;
        }
        .animate-in {
          animation: fadeUp 0.4s ease forwards;
        }

        /* ─── RESPONSIVE ─────────────────────────────────────────────── */
        @media (max-width: 480px) {
          .ticket-card {
            padding: 18px 16px 16px !important;
          }
          .ticket-card .ticket-tear {
            width: 10px;
            height: 4px;
          }
          .home-cine {
            padding: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}