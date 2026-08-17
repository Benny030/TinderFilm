'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  ClockCounterClockwise,
  ShieldCheck,
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
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type AuditRow = {
  log_id: string;
  action: string;

  admin_user_id: string;
  admin_username: string;

  target_user_id: string | null;
  target_username: string | null;

  report_id: string | null;
  suspension_id: string | null;
  appeal_id: string | null;

  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  report_status_changed: 'Stato segnalazione aggiornato',
  review_removed: 'Recensione rimossa',
  comment_removed: 'Commento rimosso',
  user_suspended: 'Utente sospeso',
  suspension_lifted: 'Sospensione rimossa',
  appeal_accepted: 'Ricorso accettato',
  appeal_rejected: 'Ricorso rifiutato',
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

export default function AdminAuditPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;

  const supabase = useRef(createBrowserClient()).current;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      void router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const { data: adminData, error: adminError } =
          await supabase.rpc('is_current_user_admin');

        if (adminError) throw adminError;

        const allowed = adminData === true;
        setIsAdmin(allowed);

        if (!allowed) return;

        const { data, error: auditError } = await supabase.rpc(
          'admin_get_moderation_audit_log',
          {
            p_limit: 200,
            p_offset: 0,
          }
        );

        if (auditError) throw auditError;

        setRows((data ?? []) as AuditRow[]);
      } catch (err: unknown) {
        console.error('Audit log load failed:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare lo storico moderazione.'
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [currentUser, supabase]);

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
                  margin: '10px 0 6px',
                  fontFamily: FONT_DISPLAY,
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
              fontFamily: FONT,
              fontWeight: 700,
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
              <ClockCounterClockwise
                size={16}
                color={P.gold}
                weight="fill"
              />
              Moderazione
            </div>

            <h1
              style={{
                margin: '6px 0 5px',
                fontFamily: FONT_DISPLAY,
                fontSize: 31,
              }}
            >
              Storico azioni
            </h1>

            <p
              style={{
                margin: 0,
                color: P.textMuted,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Registro delle principali azioni effettuate dagli
              amministratori.
            </p>
          </header>

          {error && (
            <div
              style={{
                marginBottom: 12,
                border: '1px solid rgba(239,68,68,.3)',
                background: 'rgba(239,68,68,.08)',
                color: '#ef4444',
                padding: 11,
                fontSize: 11,
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 34,
                textAlign: 'center',
                color: P.textFaint,
                fontSize: 11,
              }}
            >
              Caricamento storico...
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: 40,
                textAlign: 'center',
                color: P.textFaint,
                fontSize: 11,
              }}
            >
              Nessuna azione registrata.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 8,
              }}
            >
              {rows.map((row) => (
                <article
                  key={row.log_id}
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.card,
                    padding: 13,
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
                    <div>
                      <strong
                        style={{
                          display: 'block',
                          color: P.text,
                          fontSize: 12,
                        }}
                      >
                        {ACTION_LABELS[row.action] ?? row.action}
                      </strong>

                      <div
                        style={{
                          color: P.textFaint,
                          fontSize: 9,
                          marginTop: 3,
                        }}
                      >
                        da @{row.admin_username}
                      </div>
                    </div>

                    <span
                      style={{
                        color: P.textFaint,
                        fontSize: 9,
                      }}
                    >
                      {formatDate(row.created_at)}
                    </span>
                  </div>

                  {row.target_username && (
                    <div
                      style={{
                        marginTop: 9,
                        color: P.textMuted,
                        fontSize: 10,
                      }}
                    >
                      Utente coinvolto:{' '}
                      <button
                        type="button"
                        onClick={() =>
                          void router.push(
                            `/utente/${encodeURIComponent(
                              row.target_username!
                            )}`
                          )
                        }
                        style={{
                          border: 0,
                          padding: 0,
                          background: 'transparent',
                          color: P.gold,
                          cursor: 'pointer',
                          fontFamily: FONT,
                          fontWeight: 800,
                        }}
                      >
                        @{row.target_username}
                      </button>
                    </div>
                  )}

                  {row.metadata &&
                    Object.keys(row.metadata).length > 0 && (
                      <pre
                        style={{
                          margin: '9px 0 0',
                          border: `1px solid ${P.border}`,
                          background: P.bgSoft,
                          padding: 9,
                          color: P.textMuted,
                          fontFamily:
                            "'SFMono-Regular',Consolas,monospace",
                          fontSize: 8,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    )}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}