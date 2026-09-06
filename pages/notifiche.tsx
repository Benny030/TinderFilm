'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Bell,
  Check,
  Heart,
  UserPlus,
  UserCheck,
  ChatCircle,
  Flag,
  UsersThree,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import BackButton from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { FONT, THEME } from '@/styles/token';

type NotificationRow = {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  type:
    | 'new_follower'
    | 'review_like'
    | 'review_comment'
    | 'report_resolved'
    | 'report_dismissed';
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
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
  }

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
  const T = theme === 'dark' ? THEME.dark : THEME.light;
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
          const { data, error: reviewError } = await supabase.rpc(
            'get_notification_review_targets',
            { p_entry_ids: reviewIds }
          );

          if (reviewError) throw reviewError;
          reviewTargets = (data ?? []) as ReviewTarget[];
        }

        const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
        const reviewMap = new Map(
          reviewTargets.map((review) => [review.entry_id, review])
        );

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
          if (!cancelled) void load();
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

    if (notification.type === 'review_like' && notification.review_entry_id) {
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
    notificationId: string
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
    } catch (followError) {
      console.error('Follow back failed:', followError);
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
          background: T.bg,
          display: 'grid',
          placeItems: 'center',
          color: T.textMuted,
          fontFamily: FONT.sans,
        }}
      >
        <Bell size={38} color={T.primary} weight="duotone" />
      </div>
    );
  }

  const filters: Array<{
    id: NotificationFilter;
    label: string;
    count: number;
    icon: typeof Bell;
    color: string;
  }> = [
    {
      id: 'tutte',
      label: 'Tutte',
      count: notifications.length,
      icon: Bell,
      color: T.textMuted,
    },
    {
      id: 'non_lette',
      label: 'Non lette',
      count: unreadCount,
      icon: Check,
      color: T.primary,
    },
    {
      id: 'social',
      label: 'Social',
      count: socialCount,
      icon: UsersThree,
      color: T.accent,
    },
    {
      id: 'sistema',
      label: 'Sistema',
      count: systemCount,
      icon: Flag,
      color: T.textFaint,
    },
  ];

  return (
    <AppShell activeNav="home">
      <main
        style={{
          minHeight: '100vh',
          background: T.bg,
          color: T.text,
          fontFamily: FONT.sans,
          padding: '24px 18px 80px',
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
                  void router.push('/home');
                }
              }}
            />
          </div>

          <header
            style={{
              borderBottom: `1px solid ${T.border}`,
              paddingBottom: 18,
              marginBottom: 15,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: T.accent,
                  fontSize: 9,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '.12em',
                }}
              >
                <Bell size={13} color={T.primary} weight="fill" />
                Attività
              </div>

              <h1
                style={{
                  margin: '5px 0 5px',
                  color: T.text,
                  fontFamily: FONT.display,
                  fontSize: 'clamp(30px,5vw,40px)',
                  lineHeight: 1,
                }}
              >
                Notifiche
              </h1>

              <p
                style={{
                  color: T.textMuted,
                  fontSize: 11,
                  margin: 0,
                }}
              >
                {unreadCount > 0
                  ? `${unreadCount} ${
                      unreadCount === 1
                        ? 'notifica non letta'
                        : 'notifiche non lette'
                    }`
                  : 'Sei in pari con tutto.'}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={markingAll}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: T.textMuted,
                  padding: 0,
                  cursor: markingAll ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: FONT.sans,
                  fontSize: 9.5,
                  fontWeight: 800,
                }}
              >
                <Check size={13} weight="bold" />
                {markingAll ? 'Aggiornamento…' : 'Segna tutte lette'}
              </button>
            )}
          </header>

          <div
            className="cdr-notification-filters"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
              border: `1px solid ${T.border}`,
              marginBottom: 16,
            }}
          >
            {filters.map((item, index) => {
              const active = filter === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  style={{
                    border: 0,
                    borderRight:
                      index < 3
                        ? `1px solid ${T.border}`
                        : undefined,
                    background: active
                      ? item.id === 'non_lette'
                        ? T.primaryGlow
                        : item.id === 'social'
                        ? T.accentGlow
                        : T.bgSoft
                      : T.surface,
                    color: active ? item.color : T.textMuted,
                    minHeight: 48,
                    padding: '9px 8px',
                    cursor: 'pointer',
                    fontFamily: FONT.sans,
                    fontSize: 9.5,
                    fontWeight: 850,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <Icon
                    size={12}
                    weight={active ? 'fill' : 'regular'}
                  />
                  {item.label}
                  <span
                    style={{
                      color: active ? item.color : T.textFaint,
                      fontSize: 8,
                      fontWeight: 900,
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
                border: `1px solid ${T.primary}55`,
                background: T.primaryGlow,
                color: T.primary,
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
                borderTop: `1px solid ${T.border}`,
                borderBottom: `1px solid ${T.border}`,
                padding: 32,
                textAlign: 'center',
                color: T.textFaint,
              }}
            >
              Caricamento notifiche…
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div
              style={{
                borderTop: `1px solid ${T.border}`,
                borderBottom: `1px solid ${T.border}`,
                padding: '34px 0',
                textAlign: 'center',
                color: T.textFaint,
                fontSize: 11,
              }}
            >
              <Bell size={29} style={{ marginBottom: 8 }} />
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
            <div
              style={{
                display: 'grid',
                borderTop: `1px solid ${T.border}`,
              }}
            >
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

                const alreadyFollowing =
                  notification.actor_user_id
                    ? followingActorIds.has(
                        notification.actor_user_id
                      )
                    : false;

                return (
                  <article
                    key={notification.id}
                    onClick={() =>
                      void openNotification(notification)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' ||
                        event.key === ' '
                      ) {
                        event.preventDefault();
                        void openNotification(notification);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="cdr-notification-row"
                    style={{
                      position: 'relative',
                      width: '100%',
                      borderBottom: `1px solid ${T.border}`,
                      background: notification.is_read
                        ? 'transparent'
                        : T.primaryGlow,
                      padding: '13px 0',
                      display: 'grid',
                      gridTemplateColumns:
                        '46px minmax(0,1fr) auto',
                      gap: 12,
                      alignItems: 'center',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: FONT.sans,
                    }}
                  >
                    {!notification.is_read && (
                      <div
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: -18,
                          width: 2,
                          background: T.primary,
                        }}
                      />
                    )}

                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: '50%',
                        border: `1px solid ${T.border}`,
                        background: isReportResult
                          ? T.bgSoft
                          : T.primaryGlow,
                        overflow: 'hidden',
                        display: 'grid',
                        placeItems: 'center',
                        color: isReportResult
                          ? T.accent
                          : T.primary,
                        fontWeight: 900,
                      }}
                    >
                      {isReportResult ? (
                        <Flag size={18} weight="duotone" />
                      ) : notification.actor?.avatar_url ? (
                        <img
                          src={notification.actor.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
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
                          color: T.text,
                          fontSize: 11.5,
                          lineHeight: 1.5,
                        }}
                      >
                        {isReportResolved ? (
                          <>
                            <strong>Segnalazione risolta.</strong>{' '}
                            Abbiamo completato la verifica.
                          </>
                        ) : isReportDismissed ? (
                          <>
                            <strong>Segnalazione archiviata.</strong>{' '}
                            La verifica è stata conclusa.
                          </>
                        ) : isFollow ? (
                          <>
                            <strong>@{actorName}</strong>{' '}
                            ha iniziato a seguirti.
                          </>
                        ) : isComment ? (
                          <>
                            <strong>@{actorName}</strong>{' '}
                            ha commentato la tua recensione
                            {notification.review?.title
                              ? ` di “${notification.review.title}”.`
                              : '.'}
                          </>
                        ) : (
                          <>
                            <strong>@{actorName}</strong>{' '}
                            ha messo mi piace alla tua recensione
                            {notification.review?.title
                              ? ` di “${notification.review.title}”.`
                              : '.'}
                          </>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          marginTop: 4,
                          color: T.textFaint,
                          fontSize: 9,
                        }}
                      >
                        <span>
                          {relativeDate(notification.created_at)}
                        </span>

                        {!notification.is_read && (
                          <>
                            <span>·</span>
                            <span
                              style={{
                                color: T.primary,
                                fontWeight: 850,
                              }}
                            >
                              nuova
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                      }}
                    >
                      {isFollow &&
                        notification.actor_user_id &&
                        currentUser.id !==
                          notification.actor_user_id && (
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
                              followBusyActorId ===
                              notification.actor_user_id
                            }
                            style={{
                              border: `1px solid ${
                                alreadyFollowing
                                  ? T.border
                                  : T.primary
                              }`,
                              background: alreadyFollowing
                                ? 'transparent'
                                : T.primary,
                              color: alreadyFollowing
                                ? T.textMuted
                                : '#fff',
                              padding: '7px 9px',
                              cursor:
                                followBusyActorId ===
                                notification.actor_user_id
                                  ? 'wait'
                                  : 'pointer',
                              fontFamily: FONT.sans,
                              fontSize: 8.5,
                              fontWeight: 850,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {alreadyFollowing ? (
                              <UserCheck size={11} weight="fill" />
                            ) : (
                              <UserPlus size={11} weight="bold" />
                            )}

                            {alreadyFollowing
                              ? 'Segui già'
                              : 'Ricambia'}
                          </button>
                        )}

                      <div
                        aria-hidden="true"
                        style={{
                          width: 30,
                          height: 30,
                          display: 'grid',
                          placeItems: 'center',
                          color: isReportResult
                            ? T.accent
                            : isComment
                            ? T.accent
                            : T.primary,
                        }}
                      >
                        {isReportResult ? (
                          <Flag size={15} weight="fill" />
                        ) : isFollow ? (
                          <UserPlus size={15} weight="fill" />
                        ) : isComment ? (
                          <ChatCircle size={15} weight="fill" />
                        ) : (
                          <Heart size={15} weight="fill" />
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <style>{`
          @media (max-width: 620px) {
            .cdr-notification-filters {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .cdr-notification-filters > button:nth-child(2) {
              border-right: 0 !important;
            }

            .cdr-notification-filters > button:nth-child(-n + 2) {
              border-bottom: 1px solid ${T.border} !important;
            }

            .cdr-notification-row {
              grid-template-columns: 42px minmax(0, 1fr) !important;
            }

            .cdr-notification-row > div:last-child {
              grid-column: 2;
              justify-self: start;
              margin-top: -2px;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}
