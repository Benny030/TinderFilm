'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from './bottomNav';
import AppFooter from './AppFooter';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { FONT, TEXT, S, R } from '@/styles/token';
import type { Icon } from '@phosphor-icons/react';
import {
  House,
  FilmSlate,
  ChatCircle,
  MapPin,
  Books,
  Bell,
  UserPlus,
  SignOut,
  List,
  X,
  WarningCircle,
} from '@phosphor-icons/react';

// ─── Palette dark "cinema elegante" (dalla home) ─────────────────────────
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

// ─── Palette light "cinema elegante" (dalla home) ─────────────────────────
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

type Props = {
  children: React.ReactNode;
  activeNav: 'home' | 'stanze' | 'recensioni' | 'cinema' | 'libreria' | 'profilo';
  hideNav?: boolean;
};

type NavItem = {
  id: string;
  label: string;
  icon: Icon;
  path: string;
  comingSoon?: boolean;
};

type ActiveSuspension = {
  suspension_id: string;
  reason: string;
  suspended_until: string;
  created_at: string;
};

type SuspensionAppeal = {
  appeal_id: string;
  suspension_id: string;
  text: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
};

type NotificationToast = {
  id: string;
  message: string;
  actorUsername: string | null;
  type: 'new_follower' | 'review_like' | 'review_comment' | 'report_resolved' | 'report_dismissed' | 'appeal_accepted' | 'appeal_rejected';
  reviewEntryId: string | null;
  reportId: string | null;
  appealId: string | null;
};

const navItems: NavItem[] = [
  { id: 'home',       label: 'Home',       icon: House,      path: '/home' },
  { id: 'stanze',     label: 'Stanze',     icon: FilmSlate,  path: '/crea-stanza' },
  { id: 'recensioni', label: 'Recensioni', icon: ChatCircle, path: '/recensioni' },
  { id: 'cinema',     label: 'Cinema',     icon: MapPin,     path: '/cinema' },
  { id: 'libreria',   label: 'Libreria',   icon: Books,      path: '/libreria' },
];


function useUnreadNotifications() {
  const { currentUser } = useAuth();
  const supabase = useRef(createBrowserClient()).current;

  const [count, setCount] = useState(0);

  // Ogni istanza del hook deve avere un topic Realtime diverso.
  // AppShell, SidebarDesktop e MobileDrawer possono essere montati insieme.
  const channelIdRef = useRef(
    `notifications-badge-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { count: unread, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);

      if (!cancelled && !error) {
        setCount(unread ?? 0);
      }
    };

    void load();

    const channel = supabase
      .channel(
        `${channelIdRef.current}-${currentUser.id}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [currentUser, supabase]);

  return count;
}

export default function AppShell({ children, activeNav, hideNav = false }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationToast, setNotificationToast] =
    useState<NotificationToast | null>(null);

  const router = useRouter();

  const [activeSuspension, setActiveSuspension] =
    useState<ActiveSuspension | null>(null);
  const [suspensionChecked, setSuspensionChecked] =
    useState(false);

  const [suspensionAppeal, setSuspensionAppeal] =
    useState<SuspensionAppeal | null>(null);
  const [appealText, setAppealText] = useState('');
  const [appealSaving, setAppealSaving] = useState(false);
  const [appealError, setAppealError] = useState('');
  const { currentUser } = useAuth();
  const supabase = useRef(createBrowserClient()).current;
  const toastTimerRef = useRef<number | null>(null);
  const unreadNotifications = useUnreadNotifications();

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) {
      setActiveSuspension(null);
      setSuspensionAppeal(null);
      setSuspensionChecked(true);
      return;
    }

    let cancelled = false;

    const loadSuspension = async () => {
      setSuspensionChecked(false);

      try {
        const { data, error } = await supabase.rpc(
          'get_my_active_suspension'
        );

        if (cancelled) return;

        if (error) {
          console.error('Suspension check failed:', error);
          setActiveSuspension(null);
          setSuspensionAppeal(null);
          return;
        }

        const row =
          Array.isArray(data) && data.length > 0
            ? (data[0] as ActiveSuspension)
            : null;

        setActiveSuspension(row);

        if (!row) {
          setSuspensionAppeal(null);
          return;
        }

        const {
          data: appealData,
          error: appealLoadError,
        } = await supabase.rpc(
          'get_my_suspension_appeal',
          {
            p_suspension_id: row.suspension_id,
          }
        );

        if (cancelled) return;

        if (appealLoadError) {
          console.error(
            'Suspension appeal load failed:',
            appealLoadError
          );
          setSuspensionAppeal(null);
          return;
        }

        const appealRow =
          Array.isArray(appealData) &&
          appealData.length > 0
            ? (appealData[0] as SuspensionAppeal)
            : null;

        setSuspensionAppeal(appealRow);
      } catch (error) {
        if (!cancelled) {
          console.error('Suspension check failed:', error);
          setActiveSuspension(null);
          setSuspensionAppeal(null);
        }
      } finally {
        if (!cancelled) {
          setSuspensionChecked(true);
        }
      }
    };

    void loadSuspension();

    const timer = window.setInterval(() => {
      void loadSuspension();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentUser, supabase]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) {
      setNotificationToast(null);
      return;
    }

    const channel = supabase
      .channel(`notification-toast-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        async (payload) => {
          if (router.pathname === '/notifiche') return;

          const row = payload.new as {
            id: string;
            actor_user_id: string | null;
            type: 'new_follower' | 'review_like' | 'review_comment' | 'report_resolved' | 'report_dismissed' | 'appeal_accepted' | 'appeal_rejected';
            review_entry_id: string | null;
            report_id: string | null;
            appeal_id: string | null;
          };

          let actorUsername: string | null = null;

          if (
            row.actor_user_id &&
            row.type !== 'report_resolved' &&
            row.type !== 'report_dismissed' &&
            row.type !== 'appeal_accepted' &&
            row.type !== 'appeal_rejected'
          ) {
            const { data } = await supabase
              .from('users')
              .select('username')
              .eq('id', row.actor_user_id)
              .maybeSingle();

            actorUsername =
              typeof data?.username === 'string'
                ? data.username
                : null;
          }

          const actorLabel = actorUsername
            ? `@${actorUsername}`
            : 'Qualcuno';

          let message =
            row.type === 'new_follower'
              ? `${actorLabel} ha iniziato a seguirti.`
              : row.type === 'review_comment'
              ? `${actorLabel} ha commentato la tua recensione.`
              : row.type === 'report_resolved'
              ? 'La tua segnalazione è stata risolta.'
              : row.type === 'report_dismissed'
              ? 'La tua segnalazione è stata archiviata.'
              : row.type === 'appeal_accepted'
              ? 'Il tuo ricorso è stato accettato.'
              : row.type === 'appeal_rejected'
              ? 'Il tuo ricorso è stato rifiutato.'
              : `${actorLabel} ha messo like alla tua recensione.`;

          if (
            (row.type === 'review_like' ||
              row.type === 'review_comment') &&
            row.review_entry_id
          ) {
            const { data } = await supabase.rpc(
              'get_notification_review_targets',
              {
                p_entry_ids: [row.review_entry_id],
              }
            );

            const target =
              Array.isArray(data) && data.length > 0
                ? data[0]
                : null;

            if (
              target &&
              typeof target.title === 'string' &&
              target.title.trim()
            ) {
              message =
                row.type === 'review_comment'
                  ? `${actorLabel} ha commentato la tua recensione di “${target.title}”.`
                  : `${actorLabel} ha messo like alla tua recensione di “${target.title}”.`;
            }
          }

          setNotificationToast({
            id: row.id,
            message,
            actorUsername,
            type: row.type,
            reviewEntryId: row.review_entry_id,
            reportId: row.report_id ?? null,
            appealId: row.appeal_id ?? null,
          });

          if (toastTimerRef.current !== null) {
            window.clearTimeout(toastTimerRef.current);
          }

          toastTimerRef.current = window.setTimeout(() => {
            setNotificationToast(null);
            toastTimerRef.current = null;
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);

      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [currentUser, router.pathname, supabase]);

  const bg = isDark ? D.bg : '#f0ebe3'; // sfondo esterno light più caldo
  const contentBg = isDark ? D.bg : '#ffffff';
  const border = isDark ? D.border : '#d6cbbc';

  const submitSuspensionAppeal = async () => {
    if (
      !activeSuspension ||
      !currentUser ||
      currentUser.isGuest ||
      suspensionAppeal ||
      appealSaving
    ) {
      return;
    }

    const cleanText = appealText.trim();

    if (cleanText.length < 10) {
      setAppealError(
        'Scrivi almeno 10 caratteri per spiegare il ricorso.'
      );
      return;
    }

    setAppealSaving(true);
    setAppealError('');

    try {
      const { error } = await supabase
        .from('suspension_appeals')
        .insert({
          suspension_id: activeSuspension.suspension_id,
          user_id: currentUser.id,
          text: cleanText,
        });

      if (error) throw error;

      const {
        data,
        error: loadError,
      } = await supabase.rpc(
        'get_my_suspension_appeal',
        {
          p_suspension_id: activeSuspension.suspension_id,
        }
      );

      if (loadError) throw loadError;

      const appealRow =
        Array.isArray(data) && data.length > 0
          ? (data[0] as SuspensionAppeal)
          : null;

      setSuspensionAppeal(appealRow);
      setAppealText('');
    } catch (error: unknown) {
      console.error(
        'Suspension appeal create failed:',
        error
      );

      setAppealError(
        error instanceof Error
          ? error.message
          : 'Impossibile inviare il ricorso.'
      );
    } finally {
      setAppealSaving(false);
    }
  };

  if (
    suspensionChecked &&
    activeSuspension &&
    currentUser &&
    !currentUser.isGuest
  ) {
    const suspendedUntil = new Date(
      activeSuspension.suspended_until
    ).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div
        style={{
          minHeight: '100vh',
          background: theme === 'dark' ? '#0a0806' : '#f5efe8',
          color: theme === 'dark' ? '#f0ebe6' : '#1f1a16',
          display: 'grid',
          placeItems: 'center',
          padding: 20,
          fontFamily: "'Inter','Helvetica Neue',sans-serif",
        }}
      >
        <div
          style={{
            width: 'min(560px,100%)',
            border: `1px solid ${
              theme === 'dark' ? '#2d221c' : '#d6cbbc'
            }`,
            background: theme === 'dark' ? '#1c1613' : '#ffffff',
            padding: 28,
            textAlign: 'center',
            boxShadow: '0 22px 60px rgba(0,0,0,.22)',
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              margin: '0 auto 14px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              background: 'rgba(239,68,68,.10)',
              color: '#ef4444',
            }}
          >
            <WarningCircle size={30} weight="fill" />
          </div>

          <div
            style={{
              color: '#ef4444',
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.09em',
              marginBottom: 5,
            }}
          >
            Account sospeso
          </div>

          <h1
            style={{
              margin: 0,
              fontFamily: "'Playfair Display','Georgia',serif",
              fontSize: 28,
            }}
          >
            Accesso temporaneamente limitato
          </h1>

          <p
            style={{
              margin: '12px auto 0',
              maxWidth: 440,
              color: theme === 'dark' ? '#b5a89e' : '#5c5248',
              fontSize: 12,
              lineHeight: 1.65,
            }}
          >
            Il tuo account è stato temporaneamente sospeso dalla
            moderazione di CineDate.
          </p>

          <div
            style={{
              marginTop: 18,
              border: `1px solid ${
                theme === 'dark' ? '#2d221c' : '#d6cbbc'
              }`,
              background: theme === 'dark' ? '#14100e' : '#ece3d9',
              padding: 14,
              textAlign: 'left',
            }}
          >
            <div
              style={{
                color: theme === 'dark' ? '#7a6b60' : '#8a7c6e',
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 5,
              }}
            >
              Motivo
            </div>

            <div
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {activeSuspension.reason}
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              color: theme === 'dark' ? '#b5a89e' : '#5c5248',
              fontSize: 11,
            }}
          >
            La sospensione termina il{' '}
            <strong
              style={{
                color: theme === 'dark' ? '#f5b92f' : '#b8860b',
              }}
            >
              {suspendedUntil}
            </strong>
          </div>

          <div
            style={{
              marginTop: 18,
              border: `1px solid ${
                theme === 'dark' ? '#2d221c' : '#d6cbbc'
              }`,
              background:
                theme === 'dark' ? '#14100e' : '#ece3d9',
              padding: 14,
              textAlign: 'left',
            }}
          >
            <div
              style={{
                color:
                  theme === 'dark' ? '#7a6b60' : '#8a7c6e',
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 7,
              }}
            >
              Ricorso
            </div>

            {suspensionAppeal ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginBottom: 8,
                  }}
                >
                  <strong
                    style={{
                      fontSize: 11,
                    }}
                  >
                    {suspensionAppeal.status === 'pending'
                      ? 'In attesa di revisione'
                      : suspensionAppeal.status === 'accepted'
                      ? 'Ricorso accettato'
                      : 'Ricorso rifiutato'}
                  </strong>

                  <span
                    style={{
                      fontSize: 9,
                      color:
                        suspensionAppeal.status === 'accepted'
                          ? '#22c55e'
                          : suspensionAppeal.status === 'rejected'
                          ? '#ef4444'
                          : theme === 'dark'
                          ? '#f5b92f'
                          : '#b8860b',
                    }}
                  >
                    {suspensionAppeal.status === 'pending'
                      ? 'PENDING'
                      : suspensionAppeal.status === 'accepted'
                      ? 'ACCETTATO'
                      : 'RIFIUTATO'}
                  </span>
                </div>

                <p
                  style={{
                    margin: 0,
                    color:
                      theme === 'dark' ? '#b5a89e' : '#5c5248',
                    fontSize: 10,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {suspensionAppeal.text}
                </p>

                {suspensionAppeal.admin_note && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 9,
                      borderTop: `1px solid ${
                        theme === 'dark' ? '#2d221c' : '#d6cbbc'
                      }`,
                    }}
                  >
                    <div
                      style={{
                        color:
                          theme === 'dark'
                            ? '#7a6b60'
                            : '#8a7c6e',
                        fontSize: 8,
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      Nota della moderazione
                    </div>

                    <div
                      style={{
                        color:
                          theme === 'dark'
                            ? '#b5a89e'
                            : '#5c5248',
                        fontSize: 10,
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {suspensionAppeal.admin_note}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <textarea
                  value={appealText}
                  maxLength={2000}
                  onChange={(event) =>
                    setAppealText(event.target.value)
                  }
                  placeholder="Spiega perché ritieni che la sospensione debba essere riesaminata..."
                  style={{
                    width: '100%',
                    minHeight: 110,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    border: `1px solid ${
                      theme === 'dark' ? '#2d221c' : '#d6cbbc'
                    }`,
                    background:
                      theme === 'dark' ? '#0a0806' : '#f5efe8',
                    color:
                      theme === 'dark' ? '#f0ebe6' : '#1f1a16',
                    padding: 10,
                    outline: 0,
                    fontFamily: 'inherit',
                    fontSize: 10,
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginTop: 6,
                    color:
                      theme === 'dark' ? '#7a6b60' : '#8a7c6e',
                    fontSize: 8,
                  }}
                >
                  <span>Un solo ricorso per sospensione.</span>
                  <span>{appealText.length}/2000</span>
                </div>

                {appealError && (
                  <div
                    style={{
                      marginTop: 8,
                      color: '#ef4444',
                      fontSize: 9,
                    }}
                  >
                    {appealError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={
                    appealSaving ||
                    appealText.trim().length < 10
                  }
                  onClick={() =>
                    void submitSuspensionAppeal()
                  }
                  style={{
                    marginTop: 10,
                    width: '100%',
                    border: '1px solid #ef4444',
                    background: 'transparent',
                    color: '#ef4444',
                    padding: '9px 12px',
                    cursor: appealSaving ? 'wait' : 'pointer',
                    opacity: appealSaving ? 0.55 : 1,
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    fontSize: 10,
                  }}
                >
                  {appealSaving
                    ? 'Invio ricorso...'
                    : 'Invia ricorso'}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push('/profilo?tab=impostazioni')}
            style={{
              marginTop: 20,
              border: `1px solid ${
                theme === 'dark' ? '#2d221c' : '#d6cbbc'
              }`,
              background: 'transparent',
              color: theme === 'dark' ? '#f0ebe6' : '#1f1a16',
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 800,
              fontFamily: 'inherit',
              fontSize: 10,
            }}
          >
            Vai alle impostazioni
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        .app-desktop-bg {
          min-height: 100vh;
          background: ${bg};
          font-family: ${FONT.sans};
          letter-spacing: -0.01em;
        }
        .app-inner {
          margin: 0 auto;
          background: ${contentBg};
          min-height: 100vh;
          position: relative;
        }
        .app-mobile-topbar { display: none; }

        /* Sharp corners per tutti i bottoni e input (stile home) */
        .app-desktop-bg button,
        .app-desktop-bg input { 
        }

        @media (max-width: 1023px) {
          .app-inner { max-width: 480px; }
          .app-sidebar { display: none !important; }
          .app-mobile-topbar {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 20px; border-bottom: 1px solid ${border};
            position: sticky; top: 0; z-index: 40;
            background: ${isDark ? 'rgba(10,8,6,.92)' : 'rgba(255,255,255,.92)'};
            backdrop-filter: blur(10px);
          }
        }
        @media (min-width: 1024px) {
          .app-desktop-bg { background: ${isDark ? D.bg : '#f0ebe3'}; }
          .app-inner {
            max-width: 1900px; min-height: 100vh;
            display: grid; grid-template-columns: 240px 1fr;
            gap: 0; background: transparent;
          }
          .app-sidebar { display: flex !important; }
          .app-bottom-nav { display: none !important; }
          .app-content { background: ${contentBg}; min-height: 100vh; overflow-y: auto; }
        }

        .app-drawer-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.6);
          z-index: 90; opacity: 0; pointer-events: none; transition: opacity .2s;
        }
        .app-drawer-overlay.open { opacity: 1; pointer-events: auto; }
        .app-drawer {
          position: fixed; top: 0; left: 0; bottom: 0; width: 264px;
          background: ${contentBg}; border-right: 1px solid ${border};
          z-index: 91; transform: translateX(-100%); transition: transform .25s ease;
          display: flex; flex-direction: column; padding: 20px 16px;
        }
        .app-drawer.open { transform: translateX(0); }
      `}</style>

      <div className="app-desktop-bg">
        <div className="app-inner">
          <SidebarDesktop activeNav={activeNav} />

          <div className="app-content">
            {/* Barra mobile: logo + hamburger */}
            <div className="app-mobile-topbar">
              <span style={{ fontSize: '17px', fontWeight: 800, color: P.text, letterSpacing: '.3px' }}>
                CINE<span style={{ color: P.pink }}>DATE</span>
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                {activeNav !== 'home' && (
                  <button
                    type="button"
                    onClick={() => router.push('/notifiche')}
                    aria-label="Notifiche"
                    title="Notifiche"
                    style={{
                      width: '36px',
                      height: '36px',
                      background: P.card,
                      border: `1px solid ${
                        unreadNotifications > 0
                          ? `${P.pink}70`
                          : border
                      }`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <Bell
                      size={18}
                      color={
                        unreadNotifications > 0
                          ? P.pink
                          : P.text
                      }
                      weight={
                        unreadNotifications > 0
                          ? 'fill'
                          : 'regular'
                      }
                    />

                    {unreadNotifications > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -5,
                          right: -5,
                          minWidth: 18,
                          height: 18,
                          padding: '0 4px',
                          borderRadius: 999,
                          background: P.pink,
                          color: '#fff',
                          border: `2px solid ${
                            isDark ? D.bg : '#ffffff'
                          }`,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 8,
                          lineHeight: 1,
                          fontWeight: 900,
                          fontFamily: FONT.sans,
                        }}
                      >
                        {unreadNotifications > 99
                          ? '99+'
                          : unreadNotifications}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Apri menu"
                  style={{
                    width: '36px',
                    height: '36px',
                    background: P.card,
                    border: `1px solid ${border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <List size={18} color={P.text} weight="bold" />
                </button>
              </div>
            </div>

            {children}
            <AppFooter />

            {!hideNav && (
              <div className="app-bottom-nav">
                <BottomNav activeId={activeNav} />
              </div>
            )}
          </div>
        </div>
      </div>

      {notificationToast && (
        <button
          type="button"
          onClick={() => {
            setNotificationToast(null);

            if (
              notificationToast.type === 'new_follower' &&
              notificationToast.actorUsername
            ) {
              router.push(
                `/utente/${encodeURIComponent(
                  notificationToast.actorUsername
                )}`
              );
              return;
            }

            if (
              notificationToast.reviewEntryId &&
              notificationToast.type === 'review_comment'
            ) {
              router.push(
                `/recensioni?review=${encodeURIComponent(
                  notificationToast.reviewEntryId
                )}&comments=1`
              );
              return;
            }

            if (
              notificationToast.reviewEntryId &&
              notificationToast.type === 'review_like'
            ) {
              router.push(
                `/recensioni?review=${encodeURIComponent(
                  notificationToast.reviewEntryId
                )}`
              );
              return;
            }

            if (
              notificationToast.type === 'report_resolved' ||
              notificationToast.type === 'report_dismissed'
            ) {
              router.push('/impostazioni/segnalazioni');
              return;
            }

            if (
              notificationToast.type === 'appeal_accepted' ||
              notificationToast.type === 'appeal_rejected'
            ) {
              router.push('/profilo?tab=impostazioni');
              return;
            }

            router.push('/notifiche');
          }}
          style={{
            position: 'fixed',
            right: 18,
            bottom: 18,
            zIndex: 150,
            width: 'min(360px, calc(100vw - 36px))',
            border: `1px solid ${P.pink}65`,
            background: isDark
              ? 'rgba(28,22,19,.97)'
              : 'rgba(255,255,255,.98)',
            color: P.text,
            padding: '12px 13px',
            display: 'grid',
            gridTemplateColumns: '34px minmax(0,1fr)',
            gap: 10,
            alignItems: 'center',
            textAlign: 'left',
            cursor: 'pointer',
            boxShadow: '0 16px 40px rgba(0,0,0,.28)',
            backdropFilter: 'blur(12px)',
            fontFamily: FONT.sans,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              background:
                notificationToast.type === 'new_follower'
                  ? P.pinkGlow
                  : P.goldGlow,
              color:
                notificationToast.type === 'new_follower'
                  ? P.pink
                  : P.gold,
            }}
          >
            {notificationToast.type === 'new_follower' ? (
              <UserPlus size={17} weight="fill" />
            ) : (
              <Bell size={17} weight="fill" />
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: P.textFaint,
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 3,
                fontWeight: 800,
              }}
            >
              Nuova notifica
            </div>

            <div
              style={{
                color: P.text,
                fontSize: 11,
                lineHeight: 1.45,
                fontWeight: 600,
              }}
            >
              {notificationToast.message}
            </div>
          </div>
        </button>
      )}

      <div className={`app-drawer-overlay${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} activeNav={activeNav} />
    </>
  );
}

// ─── Drawer mobile ───────────────
function MobileDrawer({ open, onClose, activeNav }: { open: boolean; onClose: () => void; activeNav: string }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const router = useRouter();
  const { currentUser, isGuest, guestName, signOut } = useAuth();
  const displayName = currentUser && !currentUser.isGuest ? currentUser.username : guestName ?? 'Ospite';
  const unreadNotifications = useUnreadNotifications();

  return (
    <div className={`app-drawer${open ? ' open' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <span style={{ fontSize: '17px', fontWeight: '800', color: P.text, letterSpacing: '.3px' }}>
          CINE<span style={{ color: P.pink }}>DATE</span>
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <X size={20} color={P.textMuted} />
        </button>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { if (!item.comingSoon) { router.push(item.path); onClose(); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 10px',
                background: isActive ? P.pinkGlow : 'transparent',
                color: isActive ? P.pink : item.comingSoon ? P.textFaint : P.textMuted,
                fontSize: '15px', fontWeight: isActive ? 700 : 500,
                cursor: item.comingSoon ? 'default' : 'pointer',
                fontFamily: FONT.sans, textAlign: 'left', width: '100%',
                border: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!item.comingSoon) {
                  e.currentTarget.style.background = P.pinkGlow;
                  e.currentTarget.style.color = P.pink;
                }
              }}
              onMouseLeave={(e) => {
                if (!item.comingSoon) {
                  e.currentTarget.style.background = isActive ? P.pinkGlow : 'transparent';
                  e.currentTarget.style.color = isActive ? P.pink : item.comingSoon ? P.textFaint : P.textMuted;
                }
              }}
            >
              <Icon size={19} weight="fill" />
              {item.label}
              {item.comingSoon && (
                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', background: P.pinkGlow, color: P.pink, borderRadius: '999px', padding: '2px 8px' }}>
                  presto
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {!isGuest && (
        <button
          type="button"
          onClick={() => {
            router.push('/notifiche');
            onClose();
          }}
          style={{
            width: '100%',
            border: `1px solid ${P.border}`,
            background: P.card,
            color: P.textMuted,
            padding: '10px 11px',
            marginTop: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            fontFamily: FONT.sans,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <Bell
            size={17}
            color={unreadNotifications > 0 ? P.pink : P.textMuted}
            weight={unreadNotifications > 0 ? 'fill' : 'regular'}
          />
          Notifiche

          {unreadNotifications > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                minWidth: 20,
                height: 20,
                padding: '0 5px',
                borderRadius: 999,
                background: P.pink,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 9,
                fontWeight: 900,
              }}
            >
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>
      )}

      <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: '14px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={() => {
            if (!isGuest) {
              router.push('/profilo');
              onClose();
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'none',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: isGuest ? 'default' : 'pointer',
            fontFamily: FONT.sans,
          }}
        >
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: P.pinkGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: P.pink, flexShrink: 0 }}>
            {displayName?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{displayName}</div>
            <div style={{ fontSize: '11px', color: P.textFaint }}>{isGuest ? 'Ospite' : 'Profilo e impostazioni'}</div>
          </div>
        </button>

        <button onClick={() => signOut()} aria-label="Esci" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: .7 }}>
          <SignOut size={17} color={P.textMuted} />
        </button>
      </div>
    </div>
  );
}

// ─── SIDEBAR DESKTOP ─────────────────────────────
function SidebarDesktop({ activeNav }: { activeNav: string }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const router = useRouter();
  const { currentUser, isGuest, guestName, signOut } = useAuth();
  const displayName = currentUser && !currentUser.isGuest ? currentUser.username : guestName ?? 'Ospite';
  const unreadNotifications = useUnreadNotifications();

  return (
    <div
      className="app-sidebar"
      style={{
        flexDirection: 'column', padding: `${S.xl} ${S.md}`,
        borderRight: `1px solid ${P.border}`, background: P.bg,
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div
        onClick={() => router.push('/home')}
        style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.xl, cursor: 'pointer', padding: `0 ${S.sm}` }}
      >
        <span style={{ fontSize: TEXT.md, fontWeight: '800', color: P.text, letterSpacing: '.3px' }}>
          CINE<span style={{ color: P.pink }}>DATE</span>
        </span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { if (!item.comingSoon) router.push(item.path); }}
              style={{
                display: 'flex', alignItems: 'center', gap: S.sm,
                padding: `12px ${S.sm}`,
                background: isActive ? P.pinkGlow : 'transparent',
                color: isActive ? P.pink : item.comingSoon ? P.textFaint : P.textMuted,
                fontSize: TEXT.base, fontWeight: isActive ? '600' : '400',
                cursor: item.comingSoon ? 'default' : 'pointer',
                fontFamily: 'inherit', textAlign: 'left', width: '100%',
                border: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!item.comingSoon) {
                  e.currentTarget.style.background = P.pinkGlow;
                  e.currentTarget.style.color = P.pink;
                }
              }}
              onMouseLeave={(e) => {
                if (!item.comingSoon) {
                  e.currentTarget.style.background = isActive ? P.pinkGlow : 'transparent';
                  e.currentTarget.style.color = isActive ? P.pink : item.comingSoon ? P.textFaint : P.textMuted;
                }
              }}
            >
              <span style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                <Icon size={20} weight="fill" />
              </span>
              {item.label}
              {item.comingSoon && (
                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', background: P.pinkGlow, color: P.pink, borderRadius: '999px', padding: '2px 8px' }}>
                  presto
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {!isGuest && (
        <button
          type="button"
          onClick={() => router.push('/notifiche')}
          title="Notifiche"
          style={{
            width: '100%',
            border: `1px solid ${P.border}`,
            background: P.card,
            color: P.textMuted,
            padding: '9px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'inherit',
            fontSize: TEXT.sm,
            fontWeight: 700,
          }}
        >
          <Bell
            size={17}
            color={unreadNotifications > 0 ? P.pink : P.textMuted}
            weight={unreadNotifications > 0 ? 'fill' : 'regular'}
          />

          <span>Notifiche</span>

          {unreadNotifications > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                minWidth: 20,
                height: 20,
                padding: '0 5px',
                borderRadius: 999,
                background: P.pink,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 9,
                fontWeight: 900,
              }}
            >
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>
      )}

      <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: S.md, marginTop: S.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, padding: S.sm, borderRadius: R.md }}>
          <button
            type="button"
            onClick={() => {
              if (!isGuest) router.push('/profilo');
            }}
            title={isGuest ? undefined : 'Apri profilo e impostazioni'}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: S.sm,
              padding: 0,
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: isGuest ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: P.pinkGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TEXT.base, fontWeight: '700', color: P.pink, flexShrink: 0 }}>
              {displayName?.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{displayName}</div>
              <div style={{ fontSize: TEXT.xs, color: P.textFaint }}>{isGuest ? 'Ospite' : 'Profilo e impostazioni'}</div>
            </div>
          </button>

          <button onClick={() => signOut()} title="Esci" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '4px' }}>
            <SignOut size={18} color={P.textMuted} />
          </button>
        </div>
      </div>
    </div>
  );
}