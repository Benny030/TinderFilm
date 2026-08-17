'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Flag,
  HourglassMedium,
  ShieldCheck,
  Trash,
  UserCircle,
  WarningCircle,
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

type ReportStatus =
  | 'pending'
  | 'reviewing'
  | 'resolved'
  | 'dismissed';

type AdminReport = {
  report_id: string;

  reporter_user_id: string;
  reporter_username: string | null;

  target_type: 'user' | 'review' | 'comment' | 'unknown';
  target_user_id: string | null;
  target_username: string | null;

  review_entry_id: string | null;
  review_title: string | null;

  comment_id: string | null;
  comment_text: string | null;

  reason: string;
  details: string | null;
  status: ReportStatus;

  created_at: string;
  reviewed_at: string | null;
};

const FILTERS: Array<{
  key: 'all' | ReportStatus;
  label: string;
}> = [
  { key: 'all', label: 'Tutte' },
  { key: 'pending', label: 'In attesa' },
  { key: 'reviewing', label: 'In revisione' },
  { key: 'resolved', label: 'Risolte' },
  { key: 'dismissed', label: 'Archiviate' },
];

const REASON_LABELS: Record<string, string> = {
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

export default function AdminSegnalazioniPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();

  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [filter, setFilter] =
    useState<'all' | ReportStatus>('pending');

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyReportId, setBusyReportId] =
    useState<string | null>(null);

  const [suspendReport, setSuspendReport] =
    useState<AdminReport | null>(null);

  const [suspendDuration, setSuspendDuration] =
    useState('24');

  const [suspendReason, setSuspendReason] =
    useState('');

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
      setError('');

      try {
        const {
          data,
          error: adminError,
        } = await supabase.rpc(
          'is_current_user_admin'
        );

        if (adminError) throw adminError;

        const allowed =
          data === true;

        setIsAdmin(allowed);

        if (!allowed) {
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error(
          'Admin permission check failed:',
          err
        );

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

  const loadReports = async () => {
    if (!currentUser || currentUser.isGuest || !isAdmin) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const {
        data,
        error: reportsError,
      } = await supabase.rpc(
        'admin_get_content_reports',
        {
          p_status:
            filter === 'all'
              ? null
              : filter,
          p_limit: 100,
          p_offset: 0,
        }
      );

      if (reportsError) {
        throw reportsError;
      }

      setReports(
        (data ?? []) as AdminReport[]
      );
    } catch (err: unknown) {
      console.error(
        'Admin reports load failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile caricare le segnalazioni.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;

    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, filter]);

  const updateStatus = async (
    reportId: string,
    status: ReportStatus
  ) => {
    if (
      !currentUser ||
      currentUser.isGuest ||
      !isAdmin ||
      busyReportId
    ) {
      return;
    }

    setBusyReportId(reportId);
    setError('');

    try {
      const {
        error: updateError,
      } = await supabase.rpc(
        'admin_update_content_report_status',
        {
          p_report_id: reportId,
          p_status: status,
        }
      );

      if (updateError) {
        throw updateError;
      }

      await loadReports();
    } catch (err: unknown) {
      console.error(
        'Admin report status update failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile aggiornare la segnalazione.'
      );
    } finally {
      setBusyReportId(null);
    }
  };

  const suspendReportedUser = async () => {
    if (
      !suspendReport ||
      !currentUser ||
      currentUser.isGuest ||
      !isAdmin ||
      busyReportId
    ) {
      return;
    }

    const hours = Number(suspendDuration);
    const cleanReason = suspendReason.trim();

    if (!Number.isFinite(hours) || hours < 1) {
      setError('Seleziona una durata valida.');
      return;
    }

    if (cleanReason.length < 3) {
      setError('Inserisci un motivo di almeno 3 caratteri.');
      return;
    }

    const confirmed = window.confirm(
      `Vuoi sospendere @${suspendReport.target_username || 'utente'} per ${hours} ore?`
    );

    if (!confirmed) return;

    setBusyReportId(suspendReport.report_id);
    setError('');

    try {
      const { error: suspensionError } = await supabase.rpc(
        'admin_suspend_reported_user',
        {
          p_report_id: suspendReport.report_id,
          p_hours: hours,
          p_reason: cleanReason,
        }
      );

      if (suspensionError) {
        throw suspensionError;
      }

      setSuspendReport(null);
      setSuspendDuration('24');
      setSuspendReason('');

      await loadReports();
    } catch (err: unknown) {
      console.error(
        'Admin user suspension failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile sospendere questo utente.'
      );
    } finally {
      setBusyReportId(null);
    }
  };

  const removeReportedContent = async (
    report: AdminReport
  ) => {
    if (
      !currentUser ||
      currentUser.isGuest ||
      !isAdmin ||
      busyReportId
    ) {
      return;
    }

    if (
      report.target_type !== 'review' &&
      report.target_type !== 'comment'
    ) {
      return;
    }

    const label =
      report.target_type === 'review'
        ? 'questa recensione'
        : 'questo commento';

    const confirmed = window.confirm(
      `Vuoi rimuovere definitivamente ${label}? La segnalazione verrà segnata come risolta.`
    );

    if (!confirmed) return;

    setBusyReportId(report.report_id);
    setError('');

    try {
      const functionName =
        report.target_type === 'review'
          ? 'admin_remove_reported_review'
          : 'admin_remove_reported_comment';

      const { error: removeError } = await supabase.rpc(
        functionName,
        {
          p_report_id: report.report_id,
        }
      );

      if (removeError) throw removeError;

      await loadReports();
    } catch (err: unknown) {
      console.error(
        'Admin content removal failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile rimuovere il contenuto segnalato.'
      );
    } finally {
      setBusyReportId(null);
    }
  };

  const statusMeta = (
    status: ReportStatus
  ) => {
    if (status === 'reviewing') {
      return {
        label: 'In revisione',
        color: P.gold,
        Icon: HourglassMedium,
      };
    }

    if (status === 'resolved') {
      return {
        label: 'Risolta',
        color: P.success,
        Icon: CheckCircle,
      };
    }

    if (status === 'dismissed') {
      return {
        label: 'Archiviata',
        color: P.textFaint,
        Icon: XCircle,
      };
    }

    return {
      label: 'In attesa',
      color: P.pink,
      Icon: Clock,
    };
  };

  const counts = useMemo(() => {
    return reports.reduce(
      (acc, report) => {
        acc[report.status] += 1;
        return acc;
      },
      {
        pending: 0,
        reviewing: 0,
        resolved: 0,
        dismissed: 0,
      }
    );
  }, [reports]);

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
          color: P.textMuted,
          display: 'grid',
          placeItems: 'center',
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
              onClick={() =>
                router.back()
              }
              style={{
                border: 0,
                background:
                  'transparent',
                color:
                  P.textMuted,
                padding: 0,
                cursor:
                  'pointer',
                display:
                  'inline-flex',
                alignItems:
                  'center',
                gap: 6,
                marginBottom:
                  18,
                fontFamily:
                  FONT,
              }}
            >
              <ArrowLeft size={16} />
              Indietro
            </button>

            <div
              style={{
                border:
                  `1px solid ${P.border}`,
                background:
                  P.card,
                padding:
                  40,
                textAlign:
                  'center',
              }}
            >
              <ShieldCheck
                size={42}
                color={
                  P.textFaint
                }
                weight="duotone"
              />

              <h1
                style={{
                  fontFamily:
                    FONT_DISPLAY,
                  margin:
                    '10px 0 6px',
                  fontSize:
                    25,
                }}
              >
                Accesso non autorizzato
              </h1>

              <p
                style={{
                  margin:
                    0,
                  color:
                    P.textMuted,
                  fontSize:
                    11,
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
            maxWidth: 1050,
            margin: '0 auto',
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.back()
            }
            style={{
              border: 0,
              background:
                'transparent',
              color:
                P.textMuted,
              padding: 0,
              cursor:
                'pointer',
              display:
                'inline-flex',
              alignItems:
                'center',
              gap: 6,
              marginBottom:
                18,
              fontWeight:
                700,
              fontFamily:
                FONT,
            }}
          >
            <ArrowLeft size={16} />
            Indietro
          </button>

          <header
            style={{
              marginBottom:
                18,
            }}
          >
            <div
              style={{
                display:
                  'flex',
                alignItems:
                  'center',
                gap:
                  7,
                color:
                  P.textFaint,
                fontSize:
                  10,
                textTransform:
                  'uppercase',
                letterSpacing:
                  '.09em',
              }}
            >
              <ShieldCheck
                size={16}
                color={P.pink}
                weight="fill"
              />
              Moderazione
            </div>

            <h1
              style={{
                margin:
                  '6px 0 5px',
                color:
                  P.text,
                fontFamily:
                  FONT_DISPLAY,
                fontSize:
                  31,
              }}
            >
              Segnalazioni
            </h1>

            <p
              style={{
                margin:
                  0,
                color:
                  P.textMuted,
                fontSize:
                  12,
                lineHeight:
                  1.6,
              }}
            >
              Gestisci le segnalazioni inviate dalla community.
            </p>
          </header>

          {error && (
            <div
              style={{
                marginBottom:
                  12,
                border:
                  `1px solid ${P.error}45`,
                background:
                  'rgba(239,68,68,.08)',
                color:
                  P.error,
                padding:
                  11,
                fontSize:
                  11,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display:
                'flex',
              gap:
                5,
              overflowX:
                'auto',
              marginBottom:
                16,
              paddingBottom:
                2,
            }}
          >
            {FILTERS.map(
              (item) => {
                const active =
                  filter ===
                  item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setFilter(
                        item.key
                      )
                    }
                    style={{
                      border:
                        `1px solid ${
                          active
                            ? P.pink
                            : P.border
                        }`,
                      background:
                        active
                          ? P.pink
                          : P.card,
                      color:
                        active
                          ? '#fff'
                          : P.textMuted,
                      padding:
                        '9px 12px',
                      cursor:
                        'pointer',
                      fontSize:
                        10,
                      fontWeight:
                        800,
                      fontFamily:
                        FONT,
                      whiteSpace:
                        'nowrap',
                    }}
                  >
                    {item.label}
                  </button>
                );
              }
            )}
          </div>

          {filter === 'all' && (
            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  'repeat(4,minmax(0,1fr))',
                gap:
                  8,
                marginBottom:
                  16,
              }}
              className="admin-report-stats"
            >
              {[
                {
                  label:
                    'In attesa',
                  value:
                    counts.pending,
                  color:
                    P.pink,
                },
                {
                  label:
                    'In revisione',
                  value:
                    counts.reviewing,
                  color:
                    P.gold,
                },
                {
                  label:
                    'Risolte',
                  value:
                    counts.resolved,
                  color:
                    P.success,
                },
                {
                  label:
                    'Archiviate',
                  value:
                    counts.dismissed,
                  color:
                    P.textFaint,
                },
              ].map(
                (item) => (
                  <div
                    key={item.label}
                    style={{
                      border:
                        `1px solid ${P.border}`,
                      background:
                        P.card,
                      padding:
                        12,
                    }}
                  >
                    <strong
                      style={{
                        display:
                          'block',
                        color:
                          item.color,
                        fontSize:
                          20,
                      }}
                    >
                      {item.value}
                    </strong>

                    <span
                      style={{
                        display:
                          'block',
                        color:
                          P.textFaint,
                        fontSize:
                          9,
                        marginTop:
                          3,
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          {loading ? (
            <div
              style={{
                border:
                  `1px solid ${P.border}`,
                background:
                  P.card,
                padding:
                  35,
                color:
                  P.textFaint,
                textAlign:
                  'center',
                fontSize:
                  11,
              }}
            >
              Caricamento segnalazioni...
            </div>
          ) : reports.length ===
            0 ? (
            <div
              style={{
                border:
                  `1px dashed ${P.border}`,
                background:
                  P.card,
                padding:
                  40,
                textAlign:
                  'center',
              }}
            >
              <Flag
                size={35}
                color={
                  P.textFaint
                }
                weight="duotone"
              />

              <div
                style={{
                  color:
                    P.text,
                  fontSize:
                    13,
                  fontWeight:
                    800,
                  marginTop:
                    8,
                }}
              >
                Nessuna segnalazione
              </div>
            </div>
          ) : (
            <div
              style={{
                display:
                  'grid',
                gap:
                  10,
              }}
            >
              {reports.map(
                (report) => {
                  const meta =
                    statusMeta(
                      report.status
                    );

                  const StatusIcon =
                    meta.Icon;

                  const busy =
                    busyReportId ===
                    report.report_id;

                  return (
                    <article
                      key={
                        report.report_id
                      }
                      style={{
                        border:
                          `1px solid ${P.border}`,
                        background:
                          P.card,
                        padding:
                          15,
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'flex-start',
                          justifyContent:
                            'space-between',
                          gap:
                            14,
                          flexWrap:
                            'wrap',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color:
                                P.textFaint,
                              fontSize:
                                9,
                              textTransform:
                                'uppercase',
                              letterSpacing:
                                '.07em',
                            }}
                          >
                            {report.target_type ===
                            'user'
                              ? 'Profilo'
                              : report.target_type ===
                                'review'
                              ? 'Recensione'
                              : report.target_type ===
                                'comment'
                              ? 'Commento'
                              : 'Contenuto'}
                          </div>

                          <h2
                            style={{
                              margin:
                                '4px 0 0',
                              color:
                                P.text,
                              fontSize:
                                15,
                            }}
                          >
                            {REASON_LABELS[
                              report.reason
                            ] ??
                              report.reason}
                          </h2>
                        </div>

                        <div
                          style={{
                            display:
                              'inline-flex',
                            alignItems:
                              'center',
                            gap:
                              5,
                            color:
                              meta.color,
                            border:
                              `1px solid ${meta.color}45`,
                            background:
                              `${meta.color}10`,
                            padding:
                              '5px 7px',
                            fontSize:
                              9,
                            fontWeight:
                              800,
                          }}
                        >
                          <StatusIcon
                            size={13}
                            weight="fill"
                          />
                          {meta.label}
                        </div>
                      </div>

                      <div
                        style={{
                          display:
                            'grid',
                          gridTemplateColumns:
                            'repeat(2,minmax(0,1fr))',
                          gap:
                            8,
                          marginTop:
                            12,
                        }}
                        className="admin-report-info-grid"
                      >
                        <div
                          style={{
                            border:
                              `1px solid ${P.border}`,
                            background:
                              P.bgSoft,
                            padding:
                              10,
                          }}
                        >
                          <div
                            style={{
                              color:
                                P.textFaint,
                              fontSize:
                                8,
                              textTransform:
                                'uppercase',
                              marginBottom:
                                4,
                            }}
                          >
                            Segnalato da
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                report.reporter_username
                              ) {
                                void router.push(
                                  `/utente/${encodeURIComponent(
                                    report.reporter_username
                                  )}`
                                );
                              }
                            }}
                            style={{
                              border:
                                0,
                              padding:
                                0,
                              background:
                                'transparent',
                              color:
                                P.text,
                              cursor:
                                report.reporter_username
                                  ? 'pointer'
                                  : 'default',
                              fontFamily:
                                FONT,
                              fontSize:
                                10,
                              fontWeight:
                                800,
                            }}
                          >
                            @
                            {report.reporter_username ||
                              'utente'}
                          </button>
                        </div>

                        <div
                          style={{
                            border:
                              `1px solid ${P.border}`,
                            background:
                              P.bgSoft,
                            padding:
                              10,
                          }}
                        >
                          <div
                            style={{
                              color:
                                P.textFaint,
                              fontSize:
                                8,
                              textTransform:
                                'uppercase',
                              marginBottom:
                                4,
                            }}
                          >
                            Utente segnalato
                          </div>

                          {report.target_username ? (
                            <button
                              type="button"
                              onClick={() =>
                                void router.push(
                                  `/utente/${encodeURIComponent(
                                    report.target_username!
                                  )}`
                                )
                              }
                              style={{
                                border:
                                  0,
                                padding:
                                  0,
                                background:
                                  'transparent',
                                color:
                                  P.text,
                                cursor:
                                  'pointer',
                                fontFamily:
                                  FONT,
                                fontSize:
                                  10,
                                fontWeight:
                                  800,
                              }}
                            >
                              @
                              {
                                report.target_username
                              }
                            </button>
                          ) : (
                            <span
                              style={{
                                color:
                                  P.textFaint,
                                fontSize:
                                  10,
                              }}
                            >
                              Non disponibile
                            </span>
                          )}
                        </div>
                      </div>

                      {report.review_title && (
                        <div
                          style={{
                            marginTop:
                              8,
                            border:
                              `1px solid ${P.border}`,
                            background:
                              P.bgSoft,
                            padding:
                              10,
                          }}
                        >
                          <div
                            style={{
                              color:
                                P.textFaint,
                              fontSize:
                                8,
                              textTransform:
                                'uppercase',
                              marginBottom:
                                4,
                            }}
                          >
                            Film
                          </div>

                          <div
                            style={{
                              color:
                                P.text,
                              fontSize:
                                10,
                              fontWeight:
                                800,
                            }}
                          >
                            {
                              report.review_title
                            }
                          </div>
                        </div>
                      )}

                      {report.comment_text && (
                        <div
                          style={{
                            marginTop:
                              8,
                            border:
                              `1px solid ${P.border}`,
                            background:
                              P.bgSoft,
                            padding:
                              10,
                          }}
                        >
                          <div
                            style={{
                              color:
                                P.textFaint,
                              fontSize:
                                8,
                              textTransform:
                                'uppercase',
                              marginBottom:
                                5,
                            }}
                          >
                            Commento segnalato
                          </div>

                          <p
                            style={{
                              margin:
                                0,
                              color:
                                P.textMuted,
                              fontSize:
                                10,
                              lineHeight:
                                1.55,
                              whiteSpace:
                                'pre-wrap',
                            }}
                          >
                            {
                              report.comment_text
                            }
                          </p>
                        </div>
                      )}

                      {report.details && (
                        <div
                          style={{
                            marginTop:
                              8,
                          }}
                        >
                          <div
                            style={{
                              color:
                                P.textFaint,
                              fontSize:
                                8,
                              textTransform:
                                'uppercase',
                              marginBottom:
                                4,
                            }}
                          >
                            Dettagli
                          </div>

                          <p
                            style={{
                              margin:
                                0,
                              color:
                                P.textMuted,
                              fontSize:
                                10,
                              lineHeight:
                                1.55,
                              whiteSpace:
                                'pre-wrap',
                            }}
                          >
                            {
                              report.details
                            }
                          </p>
                        </div>
                      )}

                      <div
                        style={{
                          marginTop:
                            11,
                          paddingTop:
                            10,
                          borderTop:
                            `1px solid ${P.border}`,
                          display:
                            'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'space-between',
                          gap:
                            10,
                          flexWrap:
                            'wrap',
                        }}
                      >
                        <div
                          style={{
                            color:
                              P.textFaint,
                            fontSize:
                              8,
                          }}
                        >
                          {formatDate(
                            report.created_at
                          )}
                        </div>

                        <div
                          style={{
                            display:
                              'flex',
                            gap:
                              6,
                            flexWrap:
                              'wrap',
                          }}
                        >
                          {report.target_user_id &&
                            report.status !== 'resolved' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setSuspendReport(report);
                                  setSuspendDuration('24');
                                  setSuspendReason(
                                    `Violazione delle regole della community: ${
                                      REASON_LABELS[report.reason] ??
                                      report.reason
                                    }`
                                  );
                                }}
                                style={{
                                  border: `1px solid ${P.error}`,
                                  background: 'transparent',
                                  color: P.error,
                                  padding: '7px 9px',
                                  cursor: busy ? 'wait' : 'pointer',
                                  fontSize: 9,
                                  fontWeight: 800,
                                  fontFamily: FONT,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <WarningCircle
                                  size={12}
                                  weight="bold"
                                />
                                Sospendi utente
                              </button>
                            )}

                          {(report.target_type === 'review' ||
                            report.target_type === 'comment') &&
                            report.status !== 'resolved' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void removeReportedContent(report)
                                }
                                style={{
                                  border: `1px solid ${P.error}`,
                                  background: 'rgba(239,68,68,.08)',
                                  color: P.error,
                                  padding: '7px 9px',
                                  cursor: busy ? 'wait' : 'pointer',
                                  fontSize: 9,
                                  fontWeight: 800,
                                  fontFamily: FONT,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <Trash size={12} weight="bold" />
                                {report.target_type === 'review'
                                  ? 'Rimuovi recensione'
                                  : 'Rimuovi commento'}
                              </button>
                            )}

                          {report.status !==
                            'reviewing' && (
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                void updateStatus(
                                  report.report_id,
                                  'reviewing'
                                )
                              }
                              style={{
                                border:
                                  `1px solid ${P.gold}`,
                                background:
                                  'transparent',
                                color:
                                  P.gold,
                                padding:
                                  '7px 9px',
                                cursor:
                                  busy
                                    ? 'wait'
                                    : 'pointer',
                                fontSize:
                                  9,
                                fontWeight:
                                  800,
                                fontFamily:
                                  FONT,
                              }}
                            >
                              In revisione
                            </button>
                          )}

                          {report.status !==
                            'resolved' && (
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                void updateStatus(
                                  report.report_id,
                                  'resolved'
                                )
                              }
                              style={{
                                border:
                                  `1px solid ${P.success}`,
                                background:
                                  'transparent',
                                color:
                                  P.success,
                                padding:
                                  '7px 9px',
                                cursor:
                                  busy
                                    ? 'wait'
                                    : 'pointer',
                                fontSize:
                                  9,
                                fontWeight:
                                  800,
                                fontFamily:
                                  FONT,
                              }}
                            >
                              Risolta
                            </button>
                          )}

                          {report.status !==
                            'dismissed' && (
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                void updateStatus(
                                  report.report_id,
                                  'dismissed'
                                )
                              }
                              style={{
                                border:
                                  `1px solid ${P.border}`,
                                background:
                                  'transparent',
                                color:
                                  P.textMuted,
                                padding:
                                  '7px 9px',
                                cursor:
                                  busy
                                    ? 'wait'
                                    : 'pointer',
                                fontSize:
                                  9,
                                fontWeight:
                                  800,
                                fontFamily:
                                  FONT,
                              }}
                            >
                              Archivia
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </div>

        {suspendReport && (
          <div
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSuspendReport(null);
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
              role="dialog"
              aria-modal="true"
              aria-label="Sospendi utente"
              style={{
                width: 'min(480px,100%)',
                border: `1px solid ${P.border}`,
                background: P.card,
                color: P.text,
                padding: 18,
                boxShadow: '0 24px 70px rgba(0,0,0,.42)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      color: P.error,
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      marginBottom: 4,
                    }}
                  >
                    Moderazione account
                  </div>

                  <h2
                    style={{
                      margin: 0,
                      fontFamily: FONT_DISPLAY,
                      fontSize: 21,
                    }}
                  >
                    Sospendi utente
                  </h2>

                  <div
                    style={{
                      color: P.textMuted,
                      fontSize: 10,
                      marginTop: 5,
                    }}
                  >
                    @{suspendReport.target_username || 'utente'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSuspendReport(null)}
                  style={{
                    width: 32,
                    height: 32,
                    border: `1px solid ${P.border}`,
                    background: P.bgSoft,
                    color: P.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              <label
                style={{
                  display: 'block',
                  color: P.textFaint,
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  marginBottom: 6,
                }}
              >
                Durata
              </label>

              <select
                value={suspendDuration}
                onChange={(event) =>
                  setSuspendDuration(event.target.value)
                }
                style={{
                  width: '100%',
                  border: `1px solid ${P.border}`,
                  background: P.bgSoft,
                  color: P.text,
                  padding: '10px 11px',
                  marginBottom: 13,
                  outline: 0,
                  fontFamily: FONT,
                }}
              >
                <option value="1">1 ora</option>
                <option value="6">6 ore</option>
                <option value="24">24 ore</option>
                <option value="72">3 giorni</option>
                <option value="168">7 giorni</option>
                <option value="720">30 giorni</option>
                <option value="2160">90 giorni</option>
                <option value="8760">1 anno</option>
              </select>

              <label
                style={{
                  display: 'block',
                  color: P.textFaint,
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  marginBottom: 6,
                }}
              >
                Motivo
              </label>

              <textarea
                value={suspendReason}
                maxLength={500}
                onChange={(event) =>
                  setSuspendReason(event.target.value)
                }
                placeholder="Motivo della sospensione..."
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
                  textAlign: 'right',
                  color: P.textFaint,
                  fontSize: 8,
                  marginTop: 4,
                }}
              >
                {suspendReason.length}/500
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSuspendReport(null)}
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
                  disabled={
                    busyReportId === suspendReport.report_id ||
                    suspendReason.trim().length < 3
                  }
                  onClick={() =>
                    void suspendReportedUser()
                  }
                  style={{
                    border: `1px solid ${P.error}`,
                    background: P.error,
                    color: '#fff',
                    padding: '10px 12px',
                    cursor:
                      busyReportId === suspendReport.report_id
                        ? 'wait'
                        : 'pointer',
                    opacity:
                      busyReportId === suspendReport.report_id
                        ? 0.55
                        : 1,
                    fontFamily: FONT,
                    fontWeight: 800,
                  }}
                >
                  {busyReportId === suspendReport.report_id
                    ? 'Sospensione...'
                    : 'Conferma sospensione'}
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx global>{`
          @media (max-width: 720px) {
            .admin-report-stats,
            .admin-report-info-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}