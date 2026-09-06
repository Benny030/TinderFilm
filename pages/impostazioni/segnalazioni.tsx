'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  CheckCircle,
  Clock,
  Flag,
  HourglassMedium,
  XCircle,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import BackButton from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { C, FONT, THEME } from '@/styles/token';

type ReportStatus =
  | 'pending'
  | 'reviewing'
  | 'resolved'
  | 'dismissed';

type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual_content'
  | 'violence'
  | 'spoiler'
  | 'impersonation'
  | 'other';

type ReportRow = {
  id: string;
  reported_user_id: string | null;
  review_entry_id: string | null;
  comment_id: string | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  reviewed_at: string | null;
};

const REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Molestie o bullismo',
  hate: 'Odio o discriminazione',
  sexual_content: 'Contenuti sessuali',
  violence: 'Violenza',
  spoiler: 'Spoiler non segnalato',
  impersonation: 'Impersonificazione',
  other: 'Altro',
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

function getTargetLabel(report: ReportRow) {
  if (report.reported_user_id) return 'Profilo utente';
  if (report.review_entry_id) return 'Recensione';
  if (report.comment_id) return 'Commento';
  return 'Contenuto';
}

export default function SegnalazioniPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const T = theme === 'dark' ? THEME.dark : THEME.light;
  const supabase = useRef(createBrowserClient()).current;

  const [reports, setReports] = useState<ReportRow[]>([]);
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

    const loadReports = async () => {
      setLoading(true);
      setError('');

      try {
        const { data, error: reportsError } = await supabase
          .from('content_reports')
          .select(
            'id,reported_user_id,review_entry_id,comment_id,reason,details,status,created_at,reviewed_at'
          )
          .eq('reporter_user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (reportsError) throw reportsError;

        setReports((data ?? []) as ReportRow[]);
      } catch (err: unknown) {
        console.error('My reports load failed:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare le segnalazioni.'
        );
      } finally {
        setLoading(false);
      }
    };

    void loadReports();
  }, [currentUser, supabase]);

  const statusMeta = (status: ReportStatus) => {
    if (status === 'reviewing') {
      return {
        label: 'In revisione',
        color: T.accent,
        background: T.accentGlow,
        Icon: HourglassMedium,
      };
    }

    if (status === 'resolved') {
      return {
        label: 'Risolta',
        color: C.success,
        background: C.successLight,
        Icon: CheckCircle,
      };
    }

    if (status === 'dismissed') {
      return {
        label: 'Archiviata',
        color: T.textFaint,
        background: T.bgSoft,
        Icon: XCircle,
      };
    }

    return {
      label: 'In attesa',
      color: T.primary,
      background: T.primaryGlow,
      Icon: Clock,
    };
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
          background: T.bg,
          display: 'grid',
          placeItems: 'center',
          color: T.textMuted,
          fontFamily: FONT.sans,
        }}
      >
        <Flag
          size={40}
          color={T.primary}
          weight="duotone"
        />
      </div>
    );
  }

  return (
    <AppShell activeNav="profilo">
      <main
        style={{
          minHeight: '100vh',
          background: T.bg,
          color: T.text,
          fontFamily: FONT.sans,
          padding: '26px 18px 80px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 780,
            margin: '0 auto',
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <BackButton
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  window.history.length > 1
                ) {
                  router.back();
                } else {
                  void router.push('/profilo');
                }
              }}
            />
          </div>

          <header style={{ marginBottom: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                color: T.textFaint,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '.09em',
              }}
            >
              <Flag
                size={15}
                color={T.primary}
                weight="fill"
              />
              Sicurezza community
            </div>

            <h1
              style={{
                margin: '6px 0 5px',
                color: T.text,
                fontFamily: FONT.display,
                fontSize: 30,
              }}
            >
              Le mie segnalazioni
            </h1>

            <p
              style={{
                margin: 0,
                color: T.textMuted,
                fontSize: 12,
                lineHeight: 1.6,
                maxWidth: 620,
              }}
            >
              Qui puoi controllare lo stato delle segnalazioni che
              hai inviato.
            </p>
          </header>

          {error && (
            <div
              style={{
                marginBottom: 12,
                border: `1px solid ${C.error}45`,
                background: C.errorLight,
                color: C.error,
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
                border: `1px solid ${T.border}`,
                background: T.surface,
                padding: 34,
                textAlign: 'center',
                color: T.textFaint,
                fontSize: 12,
              }}
            >
              Caricamento segnalazioni…
            </div>
          ) : reports.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${T.border}`,
                background: T.surface,
                padding: 40,
                textAlign: 'center',
              }}
            >
              <Flag
                size={34}
                color={T.textFaint}
                weight="duotone"
              />

              <div
                style={{
                  color: T.text,
                  fontSize: 13,
                  fontWeight: 800,
                  marginTop: 8,
                }}
              >
                Nessuna segnalazione
              </div>

              <div
                style={{
                  color: T.textFaint,
                  fontSize: 10,
                  marginTop: 4,
                }}
              >
                Le segnalazioni che invii compariranno qui.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 9,
              }}
            >
              {reports.map((report) => {
                const meta = statusMeta(report.status);
                const StatusIcon = meta.Icon;

                return (
                  <article
                    key={report.id}
                    style={{
                      border: `1px solid ${T.border}`,
                      background: T.surface,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: T.textFaint,
                            fontSize: 9,
                            textTransform: 'uppercase',
                            letterSpacing: '.07em',
                            marginBottom: 4,
                          }}
                        >
                          {getTargetLabel(report)}
                        </div>

                        <div
                          style={{
                            color: T.text,
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {REASON_LABELS[report.reason]}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          color: meta.color,
                          border: `1px solid ${meta.color}45`,
                          background: meta.background,
                          padding: '5px 7px',
                          fontSize: 9,
                          fontWeight: 800,
                        }}
                      >
                        <StatusIcon
                          size={13}
                          weight="fill"
                        />
                        {meta.label}
                      </div>
                    </div>

                    {report.details && (
                      <p
                        style={{
                          color: T.textMuted,
                          fontSize: 10,
                          lineHeight: 1.55,
                          margin: '10px 0 0',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {report.details}
                      </p>
                    )}

                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 9,
                        borderTop: `1px solid ${T.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                        color: T.textFaint,
                        fontSize: 8,
                      }}
                    >
                      <span>
                        Inviata: {formatDate(report.created_at)}
                      </span>

                      {report.reviewed_at && (
                        <span>
                          Aggiornata: {formatDate(report.reviewed_at)}
                        </span>
                      )}
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
