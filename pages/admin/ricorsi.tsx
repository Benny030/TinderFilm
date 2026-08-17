'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  CheckCircle,
  Gavel,
  HourglassMedium,
  ShieldCheck,
  XCircle,
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

type AppealStatus = 'pending' | 'accepted' | 'rejected';

type AppealRow = {
  appeal_id: string;
  suspension_id: string;
  user_id: string;
  username: string;
  suspension_reason: string;
  suspended_until: string;
  appeal_text: string;
  status: AppealStatus;
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
};

const FILTERS: Array<{
  key: 'all' | AppealStatus;
  label: string;
}> = [
  { key: 'all', label: 'Tutti' },
  { key: 'pending', label: 'In attesa' },
  { key: 'accepted', label: 'Accettati' },
  { key: 'rejected', label: 'Rifiutati' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminRicorsiPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;

  const supabase = useRef(createBrowserClient()).current;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<'all' | AppealStatus>('pending');

  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedAppeal, setSelectedAppeal] =
    useState<AppealRow | null>(null);

  const [decision, setDecision] =
    useState<'accepted' | 'rejected'>('accepted');

  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

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

  const loadAppeals = async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: appealsError } = await supabase.rpc(
        'admin_get_suspension_appeals',
        {
          p_status: filter === 'all' ? null : filter,
          p_limit: 100,
          p_offset: 0,
        }
      );

      if (appealsError) throw appealsError;

      setAppeals((data ?? []) as AppealRow[]);
    } catch (err: unknown) {
      console.error('Admin appeals load failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile caricare i ricorsi.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;

    void loadAppeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, filter]);

  const openDecision = (
    appeal: AppealRow,
    nextDecision: 'accepted' | 'rejected'
  ) => {
    setSelectedAppeal(appeal);
    setDecision(nextDecision);
    setAdminNote('');
    setError('');
  };

  const submitDecision = async () => {
    if (
      !selectedAppeal ||
      !isAdmin ||
      !currentUser ||
      currentUser.isGuest ||
      saving
    ) {
      return;
    }

    const confirmed = window.confirm(
      decision === 'accepted'
        ? `Vuoi accettare il ricorso di @${selectedAppeal.username}? La sospensione verrà rimossa.`
        : `Vuoi rifiutare il ricorso di @${selectedAppeal.username}? La sospensione resterà attiva.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError('');

    try {
      const { error: reviewError } = await supabase.rpc(
        'admin_review_suspension_appeal',
        {
          p_appeal_id: selectedAppeal.appeal_id,
          p_decision: decision,
          p_admin_note: adminNote.trim() || null,
        }
      );

      if (reviewError) throw reviewError;

      setSelectedAppeal(null);
      setAdminNote('');

      await loadAppeals();
    } catch (err: unknown) {
      console.error('Appeal review failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile aggiornare il ricorso.'
      );
    } finally {
      setSaving(false);
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
          <div
            style={{
              maxWidth: 720,
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

              <p
                style={{
                  margin: 0,
                  color: P.textMuted,
                  fontSize: 11,
                }}
              >
                Questa sezione è riservata agli amministratori.
              </p>
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
            maxWidth: 980,
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
              <Gavel size={16} color={P.gold} weight="fill" />
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
              Ricorsi sospensioni
            </h1>

            <p
              style={{
                margin: 0,
                color: P.textMuted,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Valuta i ricorsi inviati dagli utenti sospesi.
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
              gap: 5,
              overflowX: 'auto',
              marginBottom: 16,
            }}
          >
            {FILTERS.map((item) => {
              const active = filter === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  style={{
                    border: `1px solid ${
                      active ? P.gold : P.border
                    }`,
                    background: active ? P.gold : P.card,
                    color: active ? '#111' : P.textMuted,
                    padding: '9px 12px',
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: FONT,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
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
              Caricamento ricorsi...
            </div>
          ) : appeals.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: 40,
                textAlign: 'center',
              }}
            >
              <Gavel
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
                Nessun ricorso
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 10,
              }}
            >
              {appeals.map((appeal) => (
                <article
                  key={appeal.appeal_id}
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.card,
                    padding: 15,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          void router.push(
                            `/utente/${encodeURIComponent(
                              appeal.username
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
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        @{appeal.username}
                      </button>

                      <div
                        style={{
                          color: P.textFaint,
                          fontSize: 9,
                          marginTop: 3,
                        }}
                      >
                        Ricorso inviato {formatDate(appeal.created_at)}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        color:
                          appeal.status === 'accepted'
                            ? P.success
                            : appeal.status === 'rejected'
                            ? P.error
                            : P.gold,
                        fontSize: 9,
                        fontWeight: 800,
                      }}
                    >
                      {appeal.status === 'accepted' ? (
                        <CheckCircle size={14} weight="fill" />
                      ) : appeal.status === 'rejected' ? (
                        <XCircle size={14} weight="fill" />
                      ) : (
                        <HourglassMedium size={14} weight="fill" />
                      )}

                      {appeal.status === 'accepted'
                        ? 'Accettato'
                        : appeal.status === 'rejected'
                        ? 'Rifiutato'
                        : 'In attesa'}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 11,
                      border: `1px solid ${P.border}`,
                      background: P.bgSoft,
                      padding: 11,
                    }}
                  >
                    <div
                      style={{
                        color: P.textFaint,
                        fontSize: 8,
                        textTransform: 'uppercase',
                        marginBottom: 5,
                      }}
                    >
                      Sospensione
                    </div>

                    <div
                      style={{
                        color: P.text,
                        fontSize: 10,
                        lineHeight: 1.55,
                      }}
                    >
                      {appeal.suspension_reason}
                    </div>

                    <div
                      style={{
                        color: P.textFaint,
                        fontSize: 8,
                        marginTop: 6,
                      }}
                    >
                      Fine prevista: {formatDate(appeal.suspended_until)}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                    }}
                  >
                    <div
                      style={{
                        color: P.textFaint,
                        fontSize: 8,
                        textTransform: 'uppercase',
                        marginBottom: 5,
                      }}
                    >
                      Testo del ricorso
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color: P.textMuted,
                        fontSize: 10,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {appeal.appeal_text}
                    </p>
                  </div>

                  {appeal.admin_note && (
                    <div
                      style={{
                        marginTop: 9,
                        borderTop: `1px solid ${P.border}`,
                        paddingTop: 9,
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
                        Nota admin
                      </div>

                      <div
                        style={{
                          color: P.textMuted,
                          fontSize: 10,
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {appeal.admin_note}
                      </div>
                    </div>
                  )}

                  {appeal.status === 'pending' && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: `1px solid ${P.border}`,
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          openDecision(appeal, 'rejected')
                        }
                        style={{
                          border: `1px solid ${P.error}`,
                          background: 'transparent',
                          color: P.error,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontFamily: FONT,
                          fontSize: 9,
                          fontWeight: 800,
                        }}
                      >
                        Rifiuta
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openDecision(appeal, 'accepted')
                        }
                        style={{
                          border: `1px solid ${P.success}`,
                          background: 'transparent',
                          color: P.success,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontFamily: FONT,
                          fontSize: 9,
                          fontWeight: 800,
                        }}
                      >
                        Accetta ricorso
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        {selectedAppeal && (
          <div
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedAppeal(null);
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 500,
              background: 'rgba(0,0,0,.68)',
              display: 'grid',
              placeItems: 'center',
              padding: 18,
            }}
          >
            <div
              style={{
                width: 'min(470px,100%)',
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 18,
                boxShadow: '0 24px 70px rgba(0,0,0,.42)',
              }}
            >
              <div
                style={{
                  color:
                    decision === 'accepted' ? P.success : P.error,
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                {decision === 'accepted'
                  ? 'Accetta ricorso'
                  : 'Rifiuta ricorso'}
              </div>

              <h2
                style={{
                  margin: '5px 0 6px',
                  fontFamily: FONT_DISPLAY,
                  fontSize: 21,
                }}
              >
                @{selectedAppeal.username}
              </h2>

              <p
                style={{
                  margin: 0,
                  color: P.textMuted,
                  fontSize: 10,
                  lineHeight: 1.55,
                }}
              >
                {decision === 'accepted'
                  ? 'La sospensione verrà rimossa immediatamente.'
                  : 'La sospensione resterà attiva fino alla scadenza prevista.'}
              </p>

              <label
                style={{
                  display: 'block',
                  color: P.textFaint,
                  fontSize: 8,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginTop: 14,
                  marginBottom: 5,
                }}
              >
                Nota per l'utente · opzionale
              </label>

              <textarea
                value={adminNote}
                maxLength={1000}
                onChange={(event) =>
                  setAdminNote(event.target.value)
                }
                placeholder="Aggiungi una spiegazione..."
                style={{
                  width: '100%',
                  minHeight: 100,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  border: `1px solid ${P.border}`,
                  background: P.bgSoft,
                  color: P.text,
                  padding: 10,
                  outline: 0,
                  fontFamily: FONT,
                  fontSize: 10,
                }}
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginTop: 13,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedAppeal(null)}
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.bgSoft,
                    color: P.textMuted,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontWeight: 800,
                  }}
                >
                  Annulla
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitDecision()}
                  style={{
                    border: `1px solid ${
                      decision === 'accepted'
                        ? P.success
                        : P.error
                    }`,
                    background:
                      decision === 'accepted'
                        ? P.success
                        : P.error,
                    color: '#fff',
                    padding: '10px 12px',
                    cursor: saving ? 'wait' : 'pointer',
                    opacity: saving ? 0.55 : 1,
                    fontFamily: FONT,
                    fontWeight: 800,
                  }}
                >
                  {saving
                    ? 'Salvataggio...'
                    : decision === 'accepted'
                    ? 'Accetta'
                    : 'Rifiuta'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}