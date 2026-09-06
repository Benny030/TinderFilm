'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/router';
import {
  Check,
  Eye,
  EyeSlash,
  FilmSlate,
  LockKey,
} from '@phosphor-icons/react';

import { createBrowserClient } from '@/utils/supabase/browser';
import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';

type PasswordCheck = {
  label: string;
  ok: boolean;
};

function getPasswordChecks(
  password: string
): PasswordCheck[] {
  return [
    {
      label: 'Almeno 8 caratteri',
      ok: password.length >= 8,
    },
    {
      label: 'Una lettera maiuscola',
      ok: /[A-Z]/.test(password),
    },
    {
      label: 'Una lettera minuscola',
      ok: /[a-z]/.test(password),
    },
    {
      label: 'Un numero',
      ok: /[0-9]/.test(password),
    },
    {
      label: 'Un carattere speciale',
      ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(
        password
      ),
    },
  ];
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase =
    useRef(createBrowserClient()).current;
  const { theme } = useTheme();
  const T =
    theme === 'dark'
      ? THEME.dark
      : THEME.light;

  const [checkingSession, setCheckingSession] =
    useState(true);
  const [validSession, setValidSession] =
    useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] =
    useState(false);
  const [showConfirm, setShowConfirm] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] =
    useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    let active = true;

    const check = async () => {
      try {
        const code =
          typeof router.query.code === 'string'
            ? router.query.code
            : null;

        /*
         * Con @supabase/ssr il flusso browser usa PKCE:
         * il link di recovery può quindi arrivare qui con ?code=...
         * e va scambiato esplicitamente per una sessione.
         */
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }

          if (!active) return;

          /*
           * Togliamo il code dall'URL dopo lo scambio, così un refresh
           * non prova a riutilizzarlo.
           */
          void router.replace(
            '/auth/reset-password',
            undefined,
            { shallow: true }
          );
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError || !session) {
          setValidSession(false);
          return;
        }

        setValidSession(true);
      } catch (err: unknown) {
        console.error(
          'Password recovery session failed:',
          err
        );

        if (active) {
          setValidSession(false);
          setError(
            err instanceof Error
              ? err.message
              : 'Link di recupero non valido.'
          );
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    };

    void check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          event === 'PASSWORD_RECOVERY' ||
          Boolean(session)
        ) {
          setValidSession(Boolean(session));
          setCheckingSession(false);
        }
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [
    router.isReady,
    router.query.code,
    router,
    supabase,
  ]);

  const checks = useMemo(
    () => getPasswordChecks(password),
    [password]
  );

  const passwordValid = checks.every(
    (check) => check.ok
  );

  const passwordsMatch =
    password.length > 0 &&
    password === confirm;

  const submit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!passwordValid) {
      setError(
        'La password non soddisfa i requisiti.'
      );
      return;
    }

    if (!passwordsMatch) {
      setError(
        'Le password non coincidono.'
      );
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      window.setTimeout(() => {
        void router.replace('/home');
      }, 1100);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile aggiornare la password.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (checkingSession) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: T.bg,
          display: 'grid',
          placeItems: 'center',
          color: T.textMuted,
          fontFamily: FONT.sans,
        }}
      >
        <FilmSlate
          size={38}
          color={T.primary}
          weight="duotone"
        />
      </main>
    );
  }

  if (!validSession) {
    return (
      <main
        style={{
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
            padding: 24,
          }}
        >
          <LockKey
            size={30}
            color={T.primary}
            weight="duotone"
          />

          <h1
            style={{
              margin: '12px 0 6px',
              fontFamily: FONT.display,
              fontSize: 27,
            }}
          >
            Link non valido
          </h1>

          <p
            style={{
              margin: 0,
              color: T.textMuted,
              fontSize: 10.5,
              lineHeight: 1.6,
            }}
          >
            Il link di recupero è scaduto, non è valido
            oppure è già stato utilizzato. Richiedine uno
            nuovo dalla pagina di accesso.
          </p>

          {error && (
            <div
              style={{
                marginTop: 10,
                border: `1px solid ${T.primary}45`,
                background: T.primaryGlow,
                color: T.primary,
                padding: '9px 10px',
                fontSize: 9,
                lineHeight: 1.45,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              void router.replace('/auth')
            }
            style={{
              width: '100%',
              marginTop: 16,
              border: 0,
              background: T.primary,
              color: '#fff',
              padding: '11px 12px',
              fontFamily: FONT.sans,
              fontSize: 10,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Torna ad Accedi
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
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
          padding: 24,
          boxShadow:
            theme === 'dark'
              ? '0 24px 80px rgba(0,0,0,.42)'
              : '0 20px 60px rgba(31,26,22,.12)',
        }}
      >
        <div
          style={{
            color: T.accent,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
          }}
        >
          Sicurezza account
        </div>

        <h1
          style={{
            margin: '5px 0 6px',
            fontFamily: FONT.display,
            fontSize: 29,
            lineHeight: 1.05,
          }}
        >
          Nuova password
        </h1>

        <p
          style={{
            margin: 0,
            color: T.textMuted,
            fontSize: 10.5,
            lineHeight: 1.55,
          }}
        >
          Scegli una nuova password per il tuo
          account Cinedate.
        </p>

        {success ? (
          <div
            style={{
              marginTop: 18,
              border: `1px solid ${T.accent}`,
              background: T.accentGlow,
              color: T.accent,
              padding: 13,
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            Password aggiornata. Ti porto su
            Cinedate…
          </div>
        ) : (
          <form
            onSubmit={submit}
            style={{
              marginTop: 18,
              display: 'grid',
              gap: 10,
            }}
          >
            <div
              style={{
                position: 'relative',
              }}
            >
              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(event) => {
                  setPassword(
                    event.target.value
                  );
                  setError('');
                }}
                placeholder="Nuova password"
                autoComplete="new-password"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 42,
                  padding: '0 42px 0 12px',
                  border: `1px solid ${T.border}`,
                  background: T.bgSoft,
                  color: T.text,
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  outline: 'none',
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: 5,
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
                aria-label={
                  showPassword
                    ? 'Nascondi password'
                    : 'Mostra password'
                }
              >
                {showPassword ? (
                  <Eye size={15} />
                ) : (
                  <EyeSlash size={15} />
                )}
              </button>
            </div>

            <div
              style={{
                border: `1px solid ${T.border}`,
                background: T.bgSoft,
                padding: 9,
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2,minmax(0,1fr))',
                gap: '5px 10px',
              }}
            >
              {checks.map((check) => (
                <div
                  key={check.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    color: check.ok
                      ? T.accent
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

            <div
              style={{
                position: 'relative',
              }}
            >
              <input
                type={
                  showConfirm
                    ? 'text'
                    : 'password'
                }
                value={confirm}
                onChange={(event) => {
                  setConfirm(
                    event.target.value
                  );
                  setError('');
                }}
                placeholder="Conferma nuova password"
                autoComplete="new-password"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 42,
                  padding: '0 42px 0 12px',
                  border: `1px solid ${
                    confirm.length > 0
                      ? passwordsMatch
                        ? T.accent
                        : T.primary
                      : T.border
                  }`,
                  background: T.bgSoft,
                  color: T.text,
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  outline: 'none',
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirm(
                    (current) => !current
                  )
                }
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: 5,
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
                aria-label={
                  showConfirm
                    ? 'Nascondi conferma'
                    : 'Mostra conferma'
                }
              >
                {showConfirm ? (
                  <Eye size={15} />
                ) : (
                  <EyeSlash size={15} />
                )}
              </button>
            </div>

            {error && (
              <div
                style={{
                  border: `1px solid ${T.primary}45`,
                  background: T.primaryGlow,
                  color: T.primary,
                  padding: '9px 10px',
                  fontSize: 9.5,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                saving ||
                !passwordValid ||
                !passwordsMatch
              }
              style={{
                width: '100%',
                height: 42,
                border: 0,
                background:
                  saving ||
                  !passwordValid ||
                  !passwordsMatch
                    ? T.border
                    : T.primary,
                color:
                  saving ||
                  !passwordValid ||
                  !passwordsMatch
                    ? T.textFaint
                    : '#fff',
                cursor:
                  saving ||
                  !passwordValid ||
                  !passwordsMatch
                    ? 'default'
                    : 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10.5,
                fontWeight: 900,
              }}
            >
              {saving
                ? 'Aggiornamento…'
                : 'Aggiorna password'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
