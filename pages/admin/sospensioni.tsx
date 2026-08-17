'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  Clock,
  ShieldCheck,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react';

const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  border: '#2d221c',
  gold: '#f5b92f',
  pink: '#ed3d73',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
  error: '#ef4444',
  success: '#22c55e',
};

const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  border: '#d6cbbc',
  gold: '#b8860b',
  pink: '#b83060',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
  error: '#dc2626',
  success: '#16a34a',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type SuspensionRow = {
  suspension_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  reason: string;
  suspended_until: string;
  created_at: string;
  lifted_at: string | null;
  created_by: string;
  created_by_username: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminSospensioniPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();

  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  const [rows, setRows] = useState<SuspensionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      void router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    const checkAdmin = async () => {
      try {
        const { data, error: adminError } = await supabase.rpc(
          'is_current_user_admin'
        );

        if (adminError) throw adminError;

        const allowed = data === true;
        setIsAdmin(allowed);

        if (!allowed) {
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('Admin permission check failed:', err);
        setIsAdmin(false);
        setLoading(false);

        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile verificare i permessi admin.'
        );
      }
    };

    void checkAdmin();
  }, [currentUser, supabase]);

  const loadRows = async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: rowsError } = await supabase.rpc(
        'admin_get_user_suspensions',
        {
          p_active_only: activeOnly,
          p_limit: 100,
          p_offset: 0,
        }
      );

      if (rowsError) throw rowsError;

      setRows((data ?? []) as SuspensionRow[]);
    } catch (err: unknown) {
      console.error('Admin suspensions load failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile caricare le sospensioni.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;

    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeOnly]);

  const liftSuspension = async (row: SuspensionRow) => {
    if (!isAdmin || busyId) return;

    const confirmed = window.confirm(
      `Vuoi rimuovere la sospensione di @${row.username}?`
    );

    if (!confirmed) return;

    setBusyId(row.suspension_id);
    setError('');

    try {
      const { error: liftError } = await supabase.rpc(
        'admin_lift_user_suspension',
        {
          p_user_id: row.user_id,
        }
      );

      if (liftError) throw liftError;

      await loadRows();
    } catch (err: unknown) {
      console.error('Lift suspension failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile rimuovere la sospensione.'
      );
    } finally {
      setBusyId(null);
    }
  };

  if (
    isLoading ||
    !currentUser ||
    currentUser.isGuest ||
    isGuest
  ) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: P.bg,
          display: 'grid',
          placeItems: 'center',
          color: P.textMuted,
          fontFamily: FONT,
        }}
      >
        Caricamento...
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <AppShell activeNav="profilo">
        <main
          style={{
            minHeight: '100vh',
            background: P.bg,
            color: P.text,
            fontFamily: FONT,
            padding: '26px 18px 80px',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                border: 0,
                background: 'transparent',
                color: P.textMuted,
                padding: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 18,
                fontFamily: FONT,
              }}
            >
              <ArrowLeft size={16} />
              Indietro
            </button>

            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 40,
                textAlign: 'center',
              }}
            >
              <ShieldCheck
                size={42}
                color={P.textFaint}
                weight="duotone"
              />

              <h1
                style={{
                  fontFamily: FONT_DISPLAY,
                  margin: '10px 0 6px',
                  fontSize: 25,
                }}
              >
                Accesso non autorizzato
              </h1>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell activeNav="profilo">
      <main
        style={{
          minHeight: '100vh',
          background: P.bg,
          color: P.text,
          fontFamily: FONT,
          padding: '26px 18px 80px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 920,
            margin: '0 auto',
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: 0,
              background: 'transparent',
              color: P.textMuted,
              padding: 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 18,
              fontWeight: 700,
              fontFamily: FONT,
            }}
          >
            <ArrowLeft size={16} />
            Indietro
          </button>

          <header style={{ marginBottom: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                color: P.textFaint,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '.09em',
              }}
            >
              <WarningCircle
                size={16}
                color={P.error}
                weight="fill"
              />
              Moderazione
            </div>

            <h1
              style={{
                margin: '6px 0 5px',
                color: P.text,
                fontFamily: FONT_DISPLAY,
                fontSize: 31,
              }}
            >
              Sospensioni utenti
            </h1>

            <p
              style={{
                margin: 0,
                color: P.textMuted,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Controlla le sospensioni attive e lo storico.
            </p>
          </header>

          {error && (
            <div
              style={{
                marginBottom: 12,
                border: `1px solid ${P.error}45`,
                background: 'rgba(239,68,68,.08)',
                color: P.error,
                padding: 11,
                fontSize: 11,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveOnly(true)}
              style={{
                border: `1px solid ${
                  activeOnly ? P.error : P.border
                }`,
                background: activeOnly ? P.error : P.card,
                color: activeOnly ? '#fff' : P.textMuted,
                padding: '9px 12px',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              Attive
            </button>

            <button
              type="button"
              onClick={() => setActiveOnly(false)}
              style={{
                border: `1px solid ${
                  !activeOnly ? P.gold : P.border
                }`,
                background: !activeOnly ? P.gold : P.card,
                color: !activeOnly ? '#111' : P.textMuted,
                padding: '9px 12px',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              Storico
            </button>
          </div>

          {loading ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 35,
                textAlign: 'center',
                color: P.textFaint,
                fontSize: 11,
              }}
            >
              Caricamento sospensioni...
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: 40,
                textAlign: 'center',
              }}
            >
              <UserCircle
                size={35}
                color={P.textFaint}
                weight="duotone"
              />

              <div
                style={{
                  color: P.text,
                  fontSize: 13,
                  fontWeight: 800,
                  marginTop: 8,
                }}
              >
                Nessuna sospensione
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 9,
              }}
            >
              {rows.map((row) => {
                const active =
                  !row.lifted_at &&
                  new Date(row.suspended_until).getTime() > Date.now();

                const busy = busyId === row.suspension_id;

                return (
                  <article
                    key={row.suspension_id}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          minWidth: 0,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            void router.push(
                              `/utente/${encodeURIComponent(
                                row.username
                              )}`
                            )
                          }
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            border: 0,
                            padding: 0,
                            overflow: 'hidden',
                            background: P.bgSoft,
                            color: P.pink,
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            fontWeight: 900,
                          }}
                        >
                          {row.avatar_url ? (
                            <img
                              src={row.avatar_url}
                              alt=""
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            row.username.charAt(0).toUpperCase()
                          )}
                        </button>

                        <div style={{ minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() =>
                              void router.push(
                                `/utente/${encodeURIComponent(
                                  row.username
                                )}`
                              )
                            }
                            style={{
                              border: 0,
                              background: 'transparent',
                              padding: 0,
                              color: P.text,
                              cursor: 'pointer',
                              fontFamily: FONT,
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            @{row.username}
                          </button>

                          <div
                            style={{
                              marginTop: 3,
                              color: active ? P.error : P.textFaint,
                              fontSize: 9,
                              fontWeight: 800,
                            }}
                          >
                            {active ? 'Sospensione attiva' : 'Terminata'}
                          </div>
                        </div>
                      </div>

                      {active && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void liftSuspension(row)}
                          style={{
                            border: `1px solid ${P.success}`,
                            background: 'transparent',
                            color: P.success,
                            padding: '8px 10px',
                            cursor: busy ? 'wait' : 'pointer',
                            opacity: busy ? 0.55 : 1,
                            fontFamily: FONT,
                            fontSize: 9,
                            fontWeight: 800,
                          }}
                        >
                          {busy ? 'Attendi...' : 'Rimuovi sospensione'}
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 11,
                        border: `1px solid ${P.border}`,
                        background: P.bgSoft,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          color: P.textFaint,
                          fontSize: 8,
                          textTransform: 'uppercase',
                          marginBottom: 4,
                        }}
                      >
                        Motivo
                      </div>

                      <div
                        style={{
                          color: P.textMuted,
                          fontSize: 10,
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {row.reason}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 9,
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap',
                        color: P.textFaint,
                        fontSize: 8,
                      }}
                    >
                      <span>
                        <Clock size={11} /> fino al{' '}
                        {formatDate(row.suspended_until)}
                      </span>

                      <span>
                        Creata da @{row.created_by_username}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}