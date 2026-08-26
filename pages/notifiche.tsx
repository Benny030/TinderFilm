'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  UserCheck,
  ChatCircle,
  Flag,
  UsersThree,
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
  type: 'new_follower' | 'review_like' | 'review_comment' | 'report_resolved' | 'report_dismissed';
  review_entry_id: string | null;
  report_id: string | null;
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

type NotificationFilter = 'tutte' | 'non_lette' | 'social' | 'sistema';

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
  const [filter, setFilter] = useState<NotificationFilter>('tutte');
  const [followingActorIds, setFollowingActorIds] = useState<Set<string>>(new Set());
  const [followBusyActorId, setFollowBusyActorId] = useState<string | null>(null);

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
          .select('id,user_id,actor_user_id,type,review_entry_id,report_id,is_read,created_at')
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

        if (actorIds.length > 0) {
          const { data: followingRows, error: followingError } = await supabase
            .from('user_follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', actorIds);

          if (!followingError) {
            setFollowingActorIds(
              new Set(
                (followingRows ?? [])
                  .map((row) => row.following_id)
                  .filter((id): id is string => typeof id === 'string')
              )
            );
          }
        } else {
          setFollowingActorIds(new Set());
        }
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

  const toggleFollowBack = async (
    actorUserId: string,
    notificationId: string,
  ) => {
    if (!currentUser || currentUser.isGuest) return;

    setFollowBusyActorId(actorUserId);

    try {
      const alreadyFollowing = followingActorIds.has(actorUserId);

      if (alreadyFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', actorUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({
            follower_id: currentUser.id,
            following_id: actorUserId,
          });

        if (error) throw error;
      }

      setFollowingActorIds((current) => {
        const next = new Set(current);

        if (alreadyFollowing) next.delete(actorUserId);
        else next.add(actorUserId);

        return next;
      });

      const target = notifications.find((item) => item.id === notificationId);
      if (target) await markRead(target);
    } catch (error) {
      console.error('Follow back failed:', error);
    } finally {
      setFollowBusyActorId(null);
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

  const socialCount = notifications.filter((item) =>
    ['new_follower', 'review_like', 'review_comment'].includes(item.type)
  ).length;

  const systemCount = notifications.filter((item) =>
    ['report_resolved', 'report_dismissed'].includes(item.type)
  ).length;

  const visibleNotifications = useMemo(() => {
    if (filter === 'non_lette') {
      return notifications.filter((item) => !item.is_read);
    }

    if (filter === 'social') {
      return notifications.filter((item) =>
        ['new_follower', 'review_like', 'review_comment'].includes(item.type)
      );
    }

    if (filter === 'sistema') {
      return notifications.filter((item) =>
        ['report_resolved', 'report_dismissed'].includes(item.type)
      );
    }

    return notifications;
  }, [filter, notifications]);

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

          <div
            style={{
              display: 'flex',
              gap: 7,
              overflowX: 'auto',
              paddingBottom: 4,
              marginBottom: 14,
              scrollbarWidth: 'none',
            }}
          >
            {[
              {
                id: 'tutte',
                label: 'Tutte',
                count: notifications.length,
                icon: Bell,
                color: P.textMuted,
              },
              {
                id: 'non_lette',
                label: 'Non lette',
                count: unreadCount,
                icon: Check,
                color: P.pink,
              },
              {
                id: 'social',
                label: 'Social',
                count: socialCount,
                icon: UsersThree,
                color: P.gold,
              },
              {
                id: 'sistema',
                label: 'Sistema',
                count: systemCount,
                icon: Flag,
                color: P.textFaint,
              },
            ].map((item) => {
              const active = filter === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setFilter(item.id as NotificationFilter)
                  }
                  style={{
                    border: `1px solid ${
                      active ? item.color : P.border
                    }`,
                    background: active ? P.bgSoft : P.card,
                    color: active ? item.color : P.textMuted,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={13} weight={active ? 'fill' : 'regular'} />
                  {item.label}
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      padding: '0 4px',
                      display: 'grid',
                      placeItems: 'center',
                      background: active ? P.card : P.bgSoft,
                      color: active ? item.color : P.textFaint,
                      fontSize: 8,
                    }}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

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
          ) : visibleNotifications.length === 0 ? (
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
              <div>
                {filter === 'non_lette'
                  ? 'Non hai notifiche non lette.'
                  : filter === 'social'
                  ? 'Non hai ancora attività social.'
                  : filter === 'sistema'
                  ? 'Non hai aggiornamenti di sistema.'
                  : 'Non hai ancora notifiche.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {visibleNotifications.map((notification) => {
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

                return (
                  <article
                    key={notification.id}
                    onClick={() => void openNotification(notification)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void openNotification(notification);
                      }
                    }}
                    role="button"
                    tabIndex={0}
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
                        {isReportResolved ? (
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

                    {isFollow &&
                      notification.actor_user_id &&
                      currentUser.id !== notification.actor_user_id && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleFollowBack(
                              notification.actor_user_id as string,
                              notification.id
                            );
                          }}
                          disabled={
                            followBusyActorId === notification.actor_user_id
                          }
                          style={{
                            border: `1px solid ${
                              followingActorIds.has(
                                notification.actor_user_id
                              )
                                ? P.border
                                : P.pink
                            }`,
                            background: followingActorIds.has(
                              notification.actor_user_id
                            )
                              ? P.bgSoft
                              : 'rgba(237,61,115,.08)',
                            color: followingActorIds.has(
                              notification.actor_user_id
                            )
                              ? P.textMuted
                              : P.pink,
                            padding: '6px 8px',
                            cursor:
                              followBusyActorId ===
                              notification.actor_user_id
                                ? 'wait'
                                : 'pointer',
                            fontFamily: FONT,
                            fontSize: 8,
                            fontWeight: 850,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {followingActorIds.has(
                            notification.actor_user_id
                          ) ? (
                            <UserCheck size={11} weight="fill" />
                          ) : (
                            <UserPlus size={11} weight="bold" />
                          )}
                          {followingActorIds.has(
                            notification.actor_user_id
                          )
                            ? 'Segui già'
                            : 'Ricambia'}
                        </button>
                      )}

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
                      {isReportResult ? (
                        <Bell size={15} weight="fill" />
                      ) : isFollow ? (
                        <UserPlus size={15} weight="fill" />
                      ) : isComment ? (
                        <Bell size={15} weight="fill" />
                      ) : (
                        <Heart size={15} weight="fill" />
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