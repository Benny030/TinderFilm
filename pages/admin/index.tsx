'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  CaretRight,
  ClockCounterClockwise,
  Flag,
  Gavel,
  ShieldCheck,
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

type ModerationSummary = {
  pending_reports: number;
  reviewing_reports: number;
  resolved_reports: number;
  dismissed_reports: number;

  pending_appeals: number;
  accepted_appeals: number;
  rejected_appeals: number;

  active_suspensions: number;
  expired_or_lifted_suspensions: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();

  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<ModerationSummary | null>(null);

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

        if (!allowed) {
          setSummary(null);
          return;
        }

        const { data, error: summaryError } = await supabase.rpc(
          'admin_get_moderation_summary'
        );

        if (summaryError) throw summaryError;

        const row =
          Array.isArray(data) && data.length > 0
            ? (data[0] as ModerationSummary)
            : null;

        setSummary(
          row
            ? {
                pending_reports: Number(row.pending_reports ?? 0),
                reviewing_reports: Number(row.reviewing_reports ?? 0),
                resolved_reports: Number(row.resolved_reports ?? 0),
                dismissed_reports: Number(row.dismissed_reports ?? 0),
                pending_appeals: Number(row.pending_appeals ?? 0),
                accepted_appeals: Number(row.accepted_appeals ?? 0),
                rejected_appeals: Number(row.rejected_appeals ?? 0),
                active_suspensions: Number(row.active_suspensions ?? 0),
                expired_or_lifted_suspensions: Number(
                  row.expired_or_lifted_suspensions ?? 0
                ),
              }
            : null
        );
      } catch (err: unknown) {
        console.error('Admin dashboard load failed:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare la dashboard.'
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
                  margin: '10px 0 6px',
                  fontFamily: FONT_DISPLAY,
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

  const sections = [
    {
      title: 'Segnalazioni',
      description: 'Contenuti e profili segnalati dalla community.',
      path: '/admin/segnalazioni',
      Icon: Flag,
      accent: P.pink,
      primary: summary?.pending_reports ?? 0,
      primaryLabel: 'in attesa',
      secondary: summary?.reviewing_reports ?? 0,
      secondaryLabel: 'in revisione',
    },
    {
      title: 'Ricorsi',
      description: 'Ricorsi inviati dagli utenti sospesi.',
      path: '/admin/ricorsi',
      Icon: Gavel,
      accent: P.gold,
      primary: summary?.pending_appeals ?? 0,
      primaryLabel: 'da valutare',
      secondary: summary?.accepted_appeals ?? 0,
      secondaryLabel: 'accettati',
    },
    {
      title: 'Sospensioni',
      description: 'Account sospesi e storico delle sanzioni.',
      path: '/admin/sospensioni',
      Icon: WarningCircle,
      accent: P.error,
      primary: summary?.active_suspensions ?? 0,
      primaryLabel: 'attive',
      secondary: summary?.expired_or_lifted_suspensions ?? 0,
      secondaryLabel: 'terminate',
    },
    {
      title: 'Storico azioni',
      description: 'Registro delle principali azioni effettuate dagli amministratori.',
      path: '/admin/audit',
      Icon: ClockCounterClockwise,
      accent: P.textMuted,
      primary: 0,
      primaryLabel: 'registro',
      secondary: 0,
      secondaryLabel: 'audit',
    },
  ];

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
            maxWidth: 1000,
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

          <header
            style={{
              marginBottom: 20,
            }}
          >
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
              <ShieldCheck size={16} color={P.gold} weight="fill" />
              Area amministrazione
            </div>

            <h1
              style={{
                margin: '6px 0 5px',
                fontFamily: FONT_DISPLAY,
                fontSize: 32,
              }}
            >
              Moderazione CineDate
            </h1>

            <p
              style={{
                margin: 0,
                color: P.textMuted,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Panoramica degli elementi che richiedono attenzione.
            </p>
          </header>

          {error && (
            <div
              style={{
                marginBottom: 14,
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
              Caricamento dashboard...
            </div>
          ) : (
            <div
              className="admin-dashboard-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
                gap: 12,
              }}
            >
              {sections.map((section) => {
                const Icon = section.Icon;

                return (
                  <button
                    key={section.path}
                    type="button"
                    onClick={() => void router.push(section.path)}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      color: P.text,
                      padding: 18,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: FONT,
                      minHeight: 220,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          display: 'grid',
                          placeItems: 'center',
                          background: `${section.accent}12`,
                          color: section.accent,
                        }}
                      >
                        <Icon size={20} weight="fill" />
                      </div>

                      <CaretRight
                        size={17}
                        color={P.textFaint}
                      />
                    </div>

                    <h2
                      style={{
                        margin: '16px 0 5px',
                        fontFamily: FONT_DISPLAY,
                        fontSize: 21,
                      }}
                    >
                      {section.title}
                    </h2>

                    <p
                      style={{
                        margin: 0,
                        color: P.textMuted,
                        fontSize: 10,
                        lineHeight: 1.55,
                      }}
                    >
                      {section.description}
                    </p>

                    {section.path === '/admin/audit' ? (
                      <div
                        style={{
                          marginTop: 'auto',
                          paddingTop: 18,
                          color: P.textFaint,
                          fontSize: 9,
                          lineHeight: 1.5,
                        }}
                      >
                        Apri il registro completo delle azioni di moderazione.
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: 'auto',
                          paddingTop: 18,
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 7,
                        }}
                      >
                        <div
                          style={{
                            border: `1px solid ${P.border}`,
                            background: P.bgSoft,
                            padding: 9,
                          }}
                        >
                          <strong
                            style={{
                              display: 'block',
                              color: section.accent,
                              fontSize: 20,
                            }}
                          >
                            {section.primary}
                          </strong>

                          <span
                            style={{
                              color: P.textFaint,
                              fontSize: 8,
                            }}
                          >
                            {section.primaryLabel}
                          </span>
                        </div>

                        <div
                          style={{
                            border: `1px solid ${P.border}`,
                            background: P.bgSoft,
                            padding: 9,
                          }}
                        >
                          <strong
                            style={{
                              display: 'block',
                              color: P.text,
                              fontSize: 20,
                            }}
                          >
                            {section.secondary}
                          </strong>

                          <span
                            style={{
                              color: P.textFaint,
                              fontSize: 8,
                            }}
                          >
                            {section.secondaryLabel}
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <style jsx global>{`
          @media (max-width: 1050px) {
            .admin-dashboard-grid {
              grid-template-columns: repeat(2, minmax(0,1fr)) !important;
            }
          }

          @media (max-width: 650px) {
            .admin-dashboard-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}