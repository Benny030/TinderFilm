'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/router';
import {
  Check,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  FilmSlate,
  Moon,
  SignOut,
  Sun,
} from '@phosphor-icons/react';

import { createBrowserClient } from '@/utils/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';

type Mode = 'login' | 'register';
type PasswordCheck = { label: string; ok: boolean };

function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { label: 'Almeno 8 caratteri', ok: password.length >= 8 },
    { label: 'Una lettera maiuscola', ok: /[A-Z]/.test(password) },
    { label: 'Una lettera minuscola', ok: /[a-z]/.test(password) },
    { label: 'Un numero', ok: /[0-9]/.test(password) },
    {
      label: 'Un carattere speciale',
      ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password),
    },
  ];
}

function isPasswordValid(password: string) {
  return getPasswordChecks(password).every((check) => check.ok);
}

async function getUserProfile(
  supabase: ReturnType<typeof createBrowserClient>,
  user: { id: string }
) {
  const { data, error } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Unable to load user profile:', error.message);
    return null;
  }

  return data;
}

function getOAuthCallbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

function getAuthCallbackErrorMessage(code: string) {
  const messages: Record<string, string> = {
    missing_code:
      'Il link di accesso non è valido o è incompleto.',
    configuration:
      'La configurazione di accesso non è disponibile.',
    exchange_failed:
      'Il link di accesso è scaduto o è già stato utilizzato.',
    session_failed:
      'Non siamo riusciti ad aprire la tua sessione.',
    profile_failed:
      'Non siamo riusciti a caricare il tuo profilo.',
    profile_bootstrap_failed:
      'Non siamo riusciti a preparare il tuo profilo.',
    unexpected:
      'Si è verificato un errore durante l’accesso.',
  };

  return (
    messages[code] ??
    'Si è verificato un errore durante l’accesso.'
  );
}

function GoogleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917Z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.344 4.337-17.694 10.691Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917Z"
      />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="17"
      height="17"
      viewBox="0 0 384 512"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9Z"
      />
    </svg>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = useRef(createBrowserClient()).current;
  const { enterAsGuest } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const T = theme === 'dark' ? THEME.dark : THEME.light;
  const isDark = theme === 'dark';

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
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 40);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    const callbackError =
      typeof router.query.oauth_error === 'string'
        ? router.query.oauth_error
        : null;

    if (!callbackError) return;

    setError(
      getAuthCallbackErrorMessage(callbackError)
    );

    /*
     * Dopo aver mostrato il messaggio togliamo il parametro
     * dall'URL: un refresh non deve riproporre un errore vecchio.
     */
    void router.replace(
      '/auth',
      undefined,
      { shallow: true }
    );
  }, [
    router.isReady,
    router.query.oauth_error,
    router,
  ]);

  useEffect(() => {
    if (!router.isReady) return;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const profile = await getUserProfile(supabase, {
        id: session.user.id,
      });

      void router.replace(profile?.username ? '/home' : '/username');
    };

    void checkSession();
  }, [router.isReady, router, supabase]);

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

  const handleModeSwitch = (nextMode: Mode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError('');

    try {
      sessionStorage.setItem('cineDateOAuthStarted', 'true');

      const { error: oauthError } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: getOAuthCallbackUrl(),
          },
        });

      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Errore con Google'
      );
      setIsGoogleLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError(
        'Inserisci prima la tua email.'
      );
      return;
    }

    setResetLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo: `${window.location.origin}/auth/reset-password`,
          }
        );

      if (resetError) {
        throw resetError;
      }

      /*
       * Non riveliamo se l'indirizzo esiste realmente:
       * è una risposta più sicura contro l'enumerazione account.
       */
      setSuccessMsg(
        'Se esiste un account con questa email, riceverai un link per reimpostare la password.'
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile inviare il link di recupero.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');

    if (mode === 'register') {
      if (!emailsMatch) {
        setError('Le email non coincidono');
        return;
      }

      if (!passwordValid) {
        setError('La password non soddisfa i requisiti');
        return;
      }

      if (!passwordsMatch) {
        setError('Le password non coincidono');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (loginError) throw loginError;

        setSuccessMsg('Accesso effettuato!');

        window.setTimeout(() => {
          void router.replace('/home');
        }, 650);
      } else {
        const { data, error: registerError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              // La conferma email deve rientrare nel callback PKCE di Cinedate,
              // così la sessione viene creata e l'utente prosegue su /username.
              emailRedirectTo: getOAuthCallbackUrl(),
            },
          });

        if (registerError) throw registerError;

        if (data.user) {
          setRegisteredEmail(email);
          setEmailSent(true);
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '';

      if (message.includes('Invalid login credentials')) {
        setError('Email o password errati');
      } else if (message.includes('Email not confirmed')) {
        setError('Conferma prima la tua email');
      } else if (message.includes('already registered')) {
        setError('Email già registrata — accedi');
      } else {
        setError(message || 'Errore sconosciuto');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = () => {
    enterAsGuest();
    window.location.href = '/home';
  };

  const vars = {
    '--auth-bg': T.bg,
    '--auth-soft': T.bgSoft,
    '--auth-card': T.surface,
    '--auth-hover': T.surfaceHover,
    '--auth-border': T.border,
    '--auth-text': T.text,
    '--auth-muted': T.textMuted,
    '--auth-faint': T.textFaint,
    '--auth-pink': T.primary,
    '--auth-gold': T.accent,
    '--auth-gold-soft': T.accentSoft,
  } as CSSProperties;

  if (emailSent) {
    return (
      <>
        <style>{`
          .cdr-auth-mail * { box-sizing: border-box; }
          .cdr-auth-mail button { border-radius: 0; }
        `}</style>

        <main
          className="cdr-auth-mail"
          style={{
            ...vars,
            minHeight: '100vh',
            background: T.bg,
            color: T.text,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            fontFamily: FONT.sans,
          }}
        >
          <section
            style={{
              width: '100%',
              maxWidth: 430,
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: 28,
              boxShadow: isDark
                ? '0 24px 80px rgba(0,0,0,.42)'
                : '0 20px 60px rgba(31,26,22,.12)',
            }}
          >
            <EnvelopeSimple
              size={34}
              color={T.primary}
              weight="duotone"
            />

            <div
              style={{
                marginTop: 14,
                color: T.accent,
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
              }}
            >
              Quasi fatto
            </div>

            <h1
              style={{
                margin: '5px 0 7px',
                color: T.text,
                fontFamily: FONT.display,
                fontSize: 28,
                lineHeight: 1.05,
              }}
            >
              Controlla la tua email
            </h1>

            <p
              style={{
                margin: 0,
                color: T.textMuted,
                fontSize: 11.5,
                lineHeight: 1.6,
              }}
            >
              Abbiamo inviato un link di conferma a
            </p>

            <div
              style={{
                marginTop: 10,
                borderLeft: `2px solid ${T.primary}`,
                background: T.primaryGlow,
                color: T.primary,
                padding: '9px 11px',
                fontSize: 11,
                fontWeight: 800,
                overflowWrap: 'anywhere',
              }}
            >
              {registeredEmail}
            </div>

            <div
              style={{
                marginTop: 15,
                border: `1px solid ${T.border}`,
                background: T.bgSoft,
                padding: 13,
                display: 'grid',
                gap: 8,
              }}
            >
              {[
                'Apri la tua casella email',
                'Clicca il link di conferma',
                'Scegli il tuo username',
              ].map((label, index) => (
                <div
                  key={label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '20px minmax(0,1fr)',
                    gap: 8,
                    alignItems: 'center',
                    color: T.textMuted,
                    fontSize: 10,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: `1px solid ${T.border}`,
                      display: 'grid',
                      placeItems: 'center',
                      color: T.accent,
                      fontSize: 9,
                      fontWeight: 900,
                    }}
                  >
                    {index + 1}
                  </span>
                  {label}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.resend({
                  type: 'signup',
                  email: registeredEmail,
                  options: {
                    emailRedirectTo: getOAuthCallbackUrl(),
                  },
                });

                setSuccessMsg('Email inviata di nuovo!');

                window.setTimeout(
                  () => setSuccessMsg(''),
                  3000
                );
              }}
              style={{
                width: '100%',
                marginTop: 14,
                border: `1px solid ${T.accent}`,
                background: T.accentGlow,
                color: T.accent,
                padding: '10px 12px',
                fontFamily: FONT.sans,
                fontSize: 10,
                fontWeight: 850,
                cursor: 'pointer',
              }}
            >
              Invia di nuovo
            </button>

            {successMsg && (
              <div
                style={{
                  marginTop: 9,
                  color: '#22c55e',
                  fontSize: 10,
                  textAlign: 'center',
                }}
              >
                {successMsg}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setEmailSent(false);
                setMode('login');
              }}
              style={{
                display: 'block',
                margin: '14px auto 0',
                border: 0,
                background: 'transparent',
                color: T.textFaint,
                padding: 0,
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 9.5,
                fontWeight: 750,
              }}
            >
              ← Torna al login
            </button>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes cdrAuthIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .cdr-auth-page,
        .cdr-auth-page * {
          box-sizing: border-box;
        }

        .cdr-auth-page button,
        .cdr-auth-page input {
          border-radius: 0;
        }

        .cdr-auth-page input::placeholder {
          color: var(--auth-faint);
        }

        .cdr-auth-card {
          animation: cdrAuthIn .45s ease both;
        }

        .cdr-auth-card::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: -1px;
          transform: translateX(-50%);
          width: 16px;
          height: 6px;
          background: var(--auth-bg);
          border: 1px solid var(--auth-border);
          border-bottom: 0;
          border-radius: 50% 50% 0 0;
        }

        .cdr-auth-input:focus {
          border-color: var(--auth-gold) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--auth-gold) 15%, transparent);
          outline: none;
        }

        @media (max-width: 520px) {
          .cdr-auth-page {
            align-items: start !important;
            padding: 14px !important;
          }

          .cdr-auth-card {
            margin-top: 20px;
            padding: 20px 17px !important;
          }

          .cdr-auth-register-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <main
        className="cdr-auth-page"
        style={{
          ...vars,
          minHeight: '100vh',
          background: T.bg,
          color: T.text,
          display: 'grid',
          placeItems: 'center',
          padding: 20,
          fontFamily: FONT.sans,
          position: 'relative',
          overflow: 'hidden',
          opacity: mounted ? 1 : 0,
          transition: 'opacity .25s ease',
        }}
      >
        {isDark && (
          <>
            <img
              src="/assets/landing/authbk.png"
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '-15%',
                width: '130%',
                height: '130%',
                objectFit: 'cover',
                opacity: 0.17,
                filter: 'grayscale(.2)',
                transform: 'rotate(7deg) scale(1.05)',
              }}
            />

            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 70% 15%, rgba(245,185,47,.08), transparent 36%), radial-gradient(circle at 15% 80%, rgba(237,61,115,.12), transparent 36%), rgba(10,8,6,.70)',
              }}
            />
          </>
        )}

        <section
          className="cdr-auth-card"
          style={{
            width: '100%',
            maxWidth: 430,
            position: 'relative',
            zIndex: 2,
            border: `1px solid ${T.border}`,
            background: isDark
              ? 'rgba(28,22,19,.95)'
              : T.surface,
            padding: '22px 22px 20px',
            boxShadow: isDark
              ? '0 28px 90px rgba(0,0,0,.48)'
              : '0 22px 65px rgba(31,26,22,.13)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <button
              type="button"
              onClick={() => void router.push('/')}
              aria-label="Torna alla pagina iniziale"
              style={{
                width: 33,
                height: 33,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                color: T.textFaint,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SignOut size={14} />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                isDark
                  ? 'Passa al tema chiaro'
                  : 'Passa al tema scuro'
              }
              style={{
                width: 33,
                height: 33,
                border: `1px solid ${T.border}`,
                background: T.bgSoft,
                color: T.text,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {isDark ? (
                <Sun size={14} />
              ) : (
                <Moon size={14} />
              )}
            </button>
          </div>

          <div
            style={{
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 23,
                fontWeight: 850,
                letterSpacing: '-.025em',
              }}
            >
              CINE
              <span style={{ color: T.primary }}>
                DATE
              </span>
            </div>

            <div
              style={{
                marginTop: 3,
                color: T.textFaint,
                fontSize: 10.5,
              }}
            >
              {mode === 'login'
                ? 'Bentornato nel tuo cinema.'
                : 'Inizia a scegliere insieme.'}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              border: `1px solid ${T.border}`,
              margin: '17px 0 13px',
            }}
          >
            {([
              ['login', 'Accedi'],
              ['register', 'Registrati'],
            ] as const).map(([id, label], index) => {
              const active = mode === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleModeSwitch(id)}
                  style={{
                    border: 0,
                    borderRight:
                      index === 0
                        ? `1px solid ${T.border}`
                        : undefined,
                    background: active
                      ? T.primary
                      : T.bgSoft,
                    color: active
                      ? '#fff'
                      : T.textMuted,
                    padding: '9px 10px',
                    cursor: 'pointer',
                    fontFamily: FONT.sans,
                    fontSize: 10.5,
                    fontWeight: 850,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleLogin()}
            disabled={isGoogleLoading}
            style={{
              width: '100%',
              height: 41,
              border: `1px solid ${T.border}`,
              background: T.bgSoft,
              color: T.text,
              cursor: isGoogleLoading
                ? 'wait'
                : 'pointer',
              opacity: isGoogleLoading ? 0.55 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              fontFamily: FONT.sans,
              fontSize: 10.5,
              fontWeight: 750,
            }}
          >
            <GoogleLogo />
            {isGoogleLoading
              ? 'Reindirizzamento…'
              : 'Continua con Google'}
          </button>

          <button
            type="button"
            disabled
            style={{
              width: '100%',
              height: 41,
              marginTop: 7,
              border: `1px solid ${T.border}`,
              background: T.bgSoft,
              color: T.textFaint,
              opacity: 0.48,
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              fontFamily: FONT.sans,
              fontSize: 10.5,
              fontWeight: 700,
            }}
          >
            <AppleLogo />
            Continua con Apple
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '15px 0',
              color: T.textFaint,
              fontSize: 8.5,
              textTransform: 'uppercase',
              letterSpacing: '.12em',
            }}
          >
            <span
              style={{
                height: 1,
                background: T.border,
                flex: 1,
              }}
            />
            oppure
            <span
              style={{
                height: 1,
                background: T.border,
                flex: 1,
              }}
            />
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            <input
              className="cdr-auth-input"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Email"
              required
              autoComplete="email"
              style={{
                width: '100%',
                height: 41,
                padding: '0 12px',
                border: `1px solid ${T.border}`,
                background: T.bgSoft,
                color: T.text,
                fontFamily: FONT.sans,
                fontSize: 11,
              }}
            />

            {mode === 'register' && (
              <div>
                <input
                  className="cdr-auth-input"
                  type="email"
                  value={emailConfirm}
                  onChange={(event) =>
                    setEmailConfirm(event.target.value)
                  }
                  placeholder="Conferma email"
                  required
                  autoComplete="email"
                  style={{
                    width: '100%',
                    height: 41,
                    padding: '0 12px',
                    border: `1px solid ${
                      emailConfirm.length > 0
                        ? emailsMatch
                          ? '#22c55e'
                          : '#ef4444'
                        : T.border
                    }`,
                    background: T.bgSoft,
                    color: T.text,
                    fontFamily: FONT.sans,
                    fontSize: 11,
                  }}
                />

                {emailConfirm.length > 0 && (
                  <div
                    style={{
                      marginTop: 4,
                      color: emailsMatch
                        ? '#22c55e'
                        : '#ef4444',
                      fontSize: 8.5,
                    }}
                  >
                    {emailsMatch
                      ? 'Le email coincidono'
                      : 'Le email non coincidono'}
                  </div>
                )}
              </div>
            )}

            <div>
              <div style={{ position: 'relative' }}>
                <input
                  className="cdr-auth-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  onFocus={() =>
                    setPasswordFocused(true)
                  }
                  onBlur={() =>
                    setPasswordFocused(false)
                  }
                  placeholder="Password"
                  required
                  autoComplete={
                    mode === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  style={{
                    width: '100%',
                    height: 41,
                    padding: '0 40px 0 12px',
                    border: `1px solid ${
                      mode === 'register' &&
                      password.length > 0
                        ? passwordValid
                          ? '#22c55e'
                          : '#ef4444'
                        : T.border
                    }`,
                    background: T.bgSoft,
                    color: T.text,
                    fontFamily: FONT.sans,
                    fontSize: 11,
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPass((current) => !current)
                  }
                  aria-label={
                    showPass
                      ? 'Nascondi password'
                      : 'Mostra password'
                  }
                  style={{
                    position: 'absolute',
                    right: 5,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 31,
                    height: 31,
                    border: 0,
                    background: 'transparent',
                    color: T.textFaint,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {showPass ? (
                    <Eye size={15} />
                  ) : (
                    <EyeSlash size={15} />
                  )}
                </button>
              </div>

              {mode === 'register' &&
                (passwordFocused ||
                  password.length > 0) && (
                  <div
                    style={{
                      marginTop: 6,
                      border: `1px solid ${T.border}`,
                      background: T.bgSoft,
                      padding: 9,
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(2,minmax(0,1fr))',
                      gap: '5px 10px',
                    }}
                    className="cdr-auth-register-grid"
                  >
                    {checks.map((check) => (
                      <div
                        key={check.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          color: check.ok
                            ? '#22c55e'
                            : T.textFaint,
                          fontSize: 8,
                          lineHeight: 1.35,
                        }}
                      >
                        <Check
                          size={9}
                          weight="bold"
                        />
                        {check.label}
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {mode === 'login' && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: -3,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    void handlePasswordReset()
                  }
                  disabled={resetLoading}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: T.textFaint,
                    padding: 0,
                    cursor: resetLoading
                      ? 'wait'
                      : 'pointer',
                    fontFamily: FONT.sans,
                    fontSize: 8.8,
                    fontWeight: 750,
                  }}
                >
                  {resetLoading
                    ? 'Invio…'
                    : 'Password dimenticata?'}
                </button>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="cdr-auth-input"
                    type={
                      showPassConfirm
                        ? 'text'
                        : 'password'
                    }
                    value={passwordConfirm}
                    onChange={(event) =>
                      setPasswordConfirm(
                        event.target.value
                      )
                    }
                    placeholder="Conferma password"
                    required
                    autoComplete="new-password"
                    style={{
                      width: '100%',
                      height: 41,
                      padding: '0 40px 0 12px',
                      border: `1px solid ${
                        passwordConfirm.length > 0
                          ? passwordsMatch
                            ? '#22c55e'
                            : '#ef4444'
                          : T.border
                      }`,
                      background: T.bgSoft,
                      color: T.text,
                      fontFamily: FONT.sans,
                      fontSize: 11,
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassConfirm(
                        (current) => !current
                      )
                    }
                    aria-label={
                      showPassConfirm
                        ? 'Nascondi conferma password'
                        : 'Mostra conferma password'
                    }
                    style={{
                      position: 'absolute',
                      right: 5,
                      top: '50%',
                      transform:
                        'translateY(-50%)',
                      width: 31,
                      height: 31,
                      border: 0,
                      background: 'transparent',
                      color: T.textFaint,
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {showPassConfirm ? (
                      <Eye size={15} />
                    ) : (
                      <EyeSlash size={15} />
                    )}
                  </button>
                </div>

                {passwordConfirm.length > 0 && (
                  <div
                    style={{
                      marginTop: 4,
                      color: passwordsMatch
                        ? '#22c55e'
                        : '#ef4444',
                      fontSize: 8.5,
                    }}
                  >
                    {passwordsMatch
                      ? 'Le password coincidono'
                      : 'Le password non coincidono'}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                style={{
                  border: '1px solid rgba(239,68,68,.30)',
                  background: 'rgba(239,68,68,.08)',
                  color: '#ef4444',
                  padding: '9px 10px',
                  fontSize: 9.5,
                  lineHeight: 1.45,
                }}
              >
                {error}
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  border: '1px solid rgba(34,197,94,.26)',
                  background: 'rgba(34,197,94,.07)',
                  color: '#22c55e',
                  padding: '9px 10px',
                  fontSize: 9.5,
                }}
              >
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: 42,
                border: 0,
                background: `linear-gradient(180deg, ${T.accent}, ${T.accentSoft})`,
                color: isDark ? '#0a0806' : T.text,
                opacity: isLoading ? 0.58 : 1,
                cursor: isLoading ? 'wait' : 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10.5,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '.07em',
              }}
            >
              {isLoading
                ? 'Caricamento…'
                : mode === 'login'
                  ? 'Accedi'
                  : 'Registrati'}
            </button>
          </form>

          <div
            style={{
              textAlign: 'center',
              marginTop: 13,
              color: T.textFaint,
              fontSize: 9.5,
            }}
          >
            {mode === 'login'
              ? 'Non hai ancora un account? '
              : 'Hai già un account? '}

            <button
              type="button"
              onClick={() =>
                handleModeSwitch(
                  mode === 'login'
                    ? 'register'
                    : 'login'
                )
              }
              style={{
                border: 0,
                background: 'transparent',
                color: T.primary,
                padding: 0,
                fontFamily: FONT.sans,
                fontSize: 9.5,
                fontWeight: 850,
                cursor: 'pointer',
              }}
            >
              {mode === 'login'
                ? 'Registrati'
                : 'Accedi'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '14px 0 12px',
              color: T.textFaint,
              fontSize: 8,
              textTransform: 'uppercase',
              letterSpacing: '.11em',
            }}
          >
            <span
              style={{
                height: 1,
                background: T.border,
                flex: 1,
              }}
            />
            senza account
            <span
              style={{
                height: 1,
                background: T.border,
                flex: 1,
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleGuest}
            style={{
              width: '100%',
              height: 39,
              border: `1px solid ${T.primary}`,
              background: T.primaryGlow,
              color: T.primary,
              cursor: 'pointer',
              fontFamily: FONT.sans,
              fontSize: 10,
              fontWeight: 850,
            }}
          >
            Continua come ospite
          </button>

          <div
            style={{
              textAlign: 'center',
              marginTop: 12,
              color: T.textFaint,
              fontSize: 7.5,
              lineHeight: 1.55,
            }}
          >
            Continuando accetti i Termini di servizio e
            l’Informativa sulla privacy.
          </div>
        </section>
      </main>
    </>
  );
}
