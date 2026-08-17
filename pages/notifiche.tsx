'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  Bell,
  Check,
  Heart,
  UserPlus,
} from '@phosphor-icons/react';

const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  border: '#2d221c',
  pink: '#ed3d73',
  gold: '#f5b92f',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
};

const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  border: '#d6cbbc',
  pink: '#b83060',
  gold: '#b8860b',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  type: 'new_follower' | 'review_like' | 'review_comment' | 'report_resolved' | 'report_dismissed' | 'appeal_accepted' | 'appeal_rejected';
  review_entry_id: string | null;
  report_id: string | null;
  appeal_id: string | null;
  is_read: boolean;
  created_at: string;
};

type Actor = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type ReviewTarget = {
  entry_id: string;
  provider: string;
  provider_movie_id: string;
  title: string;
};

type DisplayNotification = NotificationRow & {
  actor: Actor | null;
  review: ReviewTarget | null;
};

function relativeDate(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} min fa`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;

  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function NotifichePage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      void router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const { data: rows, error: notificationsError } = await supabase
          .from('notifications')
          .select('id,user_id,actor_user_id,type,review_entry_id,is_read,created_at')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (notificationsError) throw notificationsError;

        const raw = (rows ?? []) as NotificationRow[];

        const actorIds = Array.from(
          new Set(
            raw
              .map((item) => item.actor_user_id)
              .filter((value): value is string => Boolean(value))
          )
        );

        const reviewIds = Array.from(
          new Set(
            raw
              .map((item) => item.review_entry_id)
              .filter((value): value is string => Boolean(value))
          )
        );

        let actors: Actor[] = [];
        let reviewTargets: ReviewTarget[] = [];

        if (actorIds.length > 0) {
          const { data, error: actorError } = await supabase
            .from('users')
            .select('id,username,avatar_url')
            .in('id', actorIds);

          if (actorError) throw actorError;
          actors = (data ?? []) as Actor[];
        }

        if (reviewIds.length > 0) {
          const { data, error: reviewError } = await supabase
            .rpc('get_notification_review_targets', {
              p_entry_ids: reviewIds,
            });

          if (reviewError) throw reviewError;
          reviewTargets = (data ?? []) as ReviewTarget[];
        }

        const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
        const reviewMap = new Map(
          reviewTargets.map((review) => [review.entry_id, review])
        );

        setNotifications(
          raw.map((item) => ({
            ...item,
            actor: item.actor_user_id
              ? actorMap.get(item.actor_user_id) ?? null
              : null,
            review: item.review_entry_id
              ? reviewMap.get(item.review_entry_id) ?? null
              : null,
          }))
        );
      } catch (err: unknown) {
        console.error('Notifications load failed:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare le notifiche.'
        );
      } finally {
        setLoading(false);
      }
    };

    void load();

    const channel = supabase
      .channel(`notifications-page-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          if (!cancelled) {
            void load();
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [currentUser, supabase]);

  const markRead = async (notification: DisplayNotification) => {
    if (notification.is_read || !currentUser || currentUser.isGuest) return;

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id)
      .eq('user_id', currentUser.id);

    if (!updateError) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true }
            : item
        )
      );
    }
  };

  const openNotification = async (notification: DisplayNotification) => {
    await markRead(notification);

    if (notification.type === 'new_follower' && notification.actor?.username) {
      void router.push(
        `/utente/${encodeURIComponent(notification.actor.username)}`
      );
      return;
    }

    if (
      notification.type === 'report_resolved' ||
      notification.type === 'report_dismissed'
    ) {
      void router.push('/impostazioni/segnalazioni');
      return;
    }

    if (
      notification.type === 'appeal_accepted' ||
      notification.type === 'appeal_rejected'
    ) {
      void router.push('/profilo?tab=impostazioni');
      return;
    }

    if (
      notification.type === 'review_like' &&
      notification.review_entry_id
    ) {
      void router.push(
        `/recensioni?review=${encodeURIComponent(
          notification.review_entry_id
        )}`
      );
      return;
    }

    if (
      notification.type === 'review_comment' &&
      notification.review_entry_id
    ) {
      void router.push(
        `/recensioni?review=${encodeURIComponent(
          notification.review_entry_id
        )}&comments=1`
      );
    }
  };

  const markAllRead = async () => {
    if (!currentUser || currentUser.isGuest) return;

    setMarkingAll(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);

      if (updateError) throw updateError;

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
        }))
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile segnare le notifiche come lette.'
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.is_read).length;

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

  return (
    <AppShell activeNav="home">
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
            maxWidth: 760,
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
            }}
          >
            <ArrowLeft size={16} />
            Indietro
          </button>

          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 16,
              marginBottom: 18,
              flexWrap: 'wrap',
            }}
          >
            <div>
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
                <Bell size={16} color={P.pink} weight="fill" />
                Attività
              </div>

              <h1
                style={{
                  margin: '6px 0 4px',
                  color: P.text,
                  fontFamily: FONT_DISPLAY,
                  fontSize: 30,
                }}
              >
                Notifiche
              </h1>

              <p
                style={{
                  color: P.textMuted,
                  fontSize: 12,
                  margin: 0,
                }}
              >
                {unreadCount > 0
                  ? `${unreadCount} ${unreadCount === 1 ? 'notifica non letta' : 'notifiche non lette'}`
                  : 'Sei in pari con tutto.'}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={markingAll}
                style={{
                  border: `1px solid ${P.border}`,
                  background: P.card,
                  color: P.textMuted,
                  padding: '9px 11px',
                  cursor: markingAll ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                <Check size={14} weight="bold" />
                Segna tutte lette
              </button>
            )}
          </header>

          {error && (
            <div
              style={{
                marginBottom: 12,
                border: '1px solid rgba(239,68,68,.3)',
                background: 'rgba(239,68,68,.08)',
                color: '#fb7185',
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
                padding: 32,
                textAlign: 'center',
                color: P.textFaint,
              }}
            >
              Caricamento notifiche...
            </div>
          ) : notifications.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: 38,
                textAlign: 'center',
                color: P.textFaint,
                fontSize: 12,
              }}
            >
              <Bell size={30} style={{ marginBottom: 8 }} />
              <div>Non hai ancora notifiche.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {notifications.map((notification) => {
                const actorName =
                  notification.actor?.username || 'Un utente';

                const isFollow =
                  notification.type === 'new_follower';

                const isComment =
                  notification.type === 'review_comment';

                const isReportResolved =
                  notification.type === 'report_resolved';

                const isReportDismissed =
                  notification.type === 'report_dismissed';

                const isReportResult =
                  isReportResolved || isReportDismissed;

                const isAppealAccepted =
                  notification.type === 'appeal_accepted';

                const isAppealRejected =
                  notification.type === 'appeal_rejected';

                const isAppealResult =
                  isAppealAccepted || isAppealRejected;

                const isSystemNotification =
                  isReportResult || isAppealResult;

                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => void openNotification(notification)}
                    style={{
                      width: '100%',
                      border: `1px solid ${
                        notification.is_read ? P.border : `${P.pink}55`
                      }`,
                      background: notification.is_read
                        ? P.card
                        : theme === 'dark'
                        ? 'rgba(237,61,115,.07)'
                        : 'rgba(184,48,96,.06)',
                      padding: 12,
                      display: 'grid',
                      gridTemplateColumns: '44px minmax(0,1fr) auto',
                      gap: 11,
                      alignItems: 'center',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: P.bgSoft,
                        overflow: 'hidden',
                        display: 'grid',
                        placeItems: 'center',
                        color: P.pink,
                        fontWeight: 900,
                      }}
                    >
                      {notification.actor?.avatar_url ? (
                        <img
                          src={notification.actor.avatar_url}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        actorName.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: P.text,
                          fontSize: 11,
                          lineHeight: 1.45,
                        }}
                      >
                        <strong>@{actorName}</strong>{' '}
                        {isAppealAccepted ? (
                          'Il tuo ricorso è stato accettato.'
                        ) : isAppealRejected ? (
                          'Il tuo ricorso è stato rifiutato.'
                        ) : isReportResolved ? (
                          'La tua segnalazione è stata risolta.'
                        ) : isReportDismissed ? (
                          'La tua segnalazione è stata archiviata.'
                        ) : isFollow ? (
                          'ha iniziato a seguirti.'
                        ) : isComment ? (
                          <>
                            ha commentato la tua recensione
                            {notification.review?.title
                              ? ` di “${notification.review.title}”.`
                              : '.'}
                          </>
                        ) : (
                          <>
                            ha messo mi piace alla tua recensione
                            {notification.review?.title
                              ? ` di “${notification.review.title}”.`
                              : '.'}
                          </>
                        )}
                      </div>

                      <div
                        style={{
                          color: P.textFaint,
                          fontSize: 9,
                          marginTop: 4,
                        }}
                      >
                        {relativeDate(notification.created_at)}
                      </div>
                    </div>

                    <div
                      style={{
                        width: 30,
                        height: 30,
                        display: 'grid',
                        placeItems: 'center',
                        background: isFollow
                          ? 'rgba(237,61,115,.10)'
                          : 'rgba(245,185,47,.10)',
                        color: isFollow ? P.pink : P.gold,
                      }}
                    >
                      {isSystemNotification ? (
                        <Bell size={15} weight="fill" />
                      ) : isFollow ? (
                        <UserPlus size={15} weight="fill" />
                      ) : isComment ? (
                        <Bell size={15} weight="fill" />
                      ) : (
                        <Heart size={15} weight="fill" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}