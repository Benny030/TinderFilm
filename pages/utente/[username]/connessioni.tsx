'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  FilmSlate,
  UserCheck,
  UserPlus,
  UsersThree,
  Sparkle,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import BackButton from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { FONT, THEME } from '@/styles/token';

type Tab = 'follower' | 'seguiti';

type PublicUser = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_following: boolean;
  shared_genres?: string[];
  shared_genres_count?: number;
  shared_favorites_count?: number;
  shared_high_ratings_count?: number;
  compatibility_score?: number;
  follows_you?: boolean;
};

export default function UserConnectionsPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const T = theme === 'dark' ? THEME.dark : THEME.light;
  const supabase = useRef(createBrowserClient()).current;

  const username =
    typeof router.query.username === 'string'
      ? router.query.username
      : null;

  const queryTab =
    typeof router.query.tab === 'string'
      ? router.query.tab
      : null;

  const [tab, setTab] = useState<Tab>(
    queryTab === 'seguiti' ? 'seguiti' : 'follower'
  );
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sortByCompatibility, setSortByCompatibility] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      void router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (!router.isReady) return;

    const next =
      typeof router.query.tab === 'string'
        ? router.query.tab
        : null;

    setTab(next === 'seguiti' ? 'seguiti' : 'follower');
  }, [router.isReady, router.query.tab]);

  const loadUsers = async () => {
    if (!username || !currentUser || currentUser.isGuest) return;

    setLoading(true);
    setError('');

    try {
      const rpc =
        tab === 'follower'
          ? 'get_public_user_followers'
          : 'get_public_user_following';

      const { data, error: rpcError } = await supabase.rpc(rpc, {
        p_username: username,
        p_limit: 100,
        p_offset: 0,
      });

      if (rpcError) throw rpcError;

      const baseUsers = (data ?? []) as PublicUser[];
      const ids = baseUsers
        .map((user) => user.user_id)
        .filter((id) => id !== currentUser.id);

      let compatibilityMap = new Map<string, Partial<PublicUser>>();

      if (ids.length > 0) {
        const { data: compatibilityRows, error: compatibilityError } =
          await supabase.rpc('get_people_compatibilities', {
            p_user_ids: ids,
          });

        if (compatibilityError) {
          console.error(
            'Connections compatibility load failed:',
            compatibilityError
          );
        } else {
          compatibilityMap = new Map(
            ((compatibilityRows ?? []) as PublicUser[]).map((row) => [
              row.user_id,
              {
                shared_genres: Array.isArray(row.shared_genres)
                  ? row.shared_genres
                  : [],
                shared_genres_count: Number(row.shared_genres_count ?? 0),
                shared_favorites_count: Number(
                  row.shared_favorites_count ?? 0
                ),
                shared_high_ratings_count: Number(
                  row.shared_high_ratings_count ?? 0
                ),
                compatibility_score: Number(row.compatibility_score ?? 0),
                follows_you: Boolean(row.follows_you),
              },
            ])
          );
        }
      }

      setUsers(
        baseUsers.map((user) => ({
          ...user,
          ...(compatibilityMap.get(user.user_id) ?? {}),
        }))
      );
    } catch (err: any) {
      console.error('Connections load failed:', err);
      setError(err.message ?? 'Impossibile caricare gli utenti.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!router.isReady || !username || !currentUser || currentUser.isGuest) {
      return;
    }

    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, username, tab, currentUser]);

  const changeTab = (next: Tab) => {
    setTab(next);

    void router.replace(
      {
        pathname: `/utente/${username}/connessioni`,
        query: { tab: next },
      },
      undefined,
      { shallow: true }
    );
  };

  const toggleFollow = async (user: PublicUser) => {
    if (
      !currentUser ||
      currentUser.isGuest ||
      currentUser.id === user.user_id
    ) {
      return;
    }

    setBusyId(user.user_id);
    setError('');

    try {
      if (user.is_following) {
        const { error: deleteError } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', user.user_id);

        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .from('user_follows')
          .insert({
            follower_id: currentUser.id,
            following_id: user.user_id,
          });

        if (insertError) throw insertError;
      }

      setUsers((current) =>
        current.map((item) =>
          item.user_id === user.user_id
            ? {
                ...item,
                is_following: !item.is_following,
              }
            : item
        )
      );
    } catch (err: any) {
      console.error('Connection follow failed:', err);
      setError(err.message ?? 'Impossibile aggiornare il follow.');
    } finally {
      setBusyId(null);
    }
  };

  const visibleUsers = sortByCompatibility
    ? [...users].sort(
        (a, b) =>
          Number(b.compatibility_score ?? 0) -
          Number(a.compatibility_score ?? 0)
      )
    : users;

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
        <FilmSlate size={42} color={T.primary} weight="duotone" />
      </div>
    );
  }

  return (
    <AppShell activeNav="recensioni">
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
                } else if (username) {
                  void router.push(
                    `/utente/${encodeURIComponent(username)}`
                  );
                } else {
                  void router.push('/home');
                }
              }}
            />
          </div>

          <header
            style={{
              borderBottom: `1px solid ${T.border}`,
              paddingBottom: 17,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: T.accent,
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '.12em',
                fontWeight: 900,
              }}
            >
              <UsersThree size={13} weight="fill" />
              @{username}
            </div>

            <h1
              style={{
                margin: '5px 0 0',
                fontFamily: FONT.display,
                fontSize: 'clamp(30px,5vw,40px)',
                lineHeight: 1,
                color: T.text,
              }}
            >
              Connessioni
            </h1>
          </header>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              border: `1px solid ${T.border}`,
              marginBottom: 14,
            }}
          >
            <button
              type="button"
              onClick={() => changeTab('follower')}
              style={{
                border: 0,
                borderRight: `1px solid ${T.border}`,
                background:
                  tab === 'follower'
                    ? T.primaryGlow
                    : T.surface,
                color:
                  tab === 'follower'
                    ? T.primary
                    : T.textMuted,
                padding: '11px 12px',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10.5,
                fontWeight: 850,
              }}
            >
              Follower
            </button>

            <button
              type="button"
              onClick={() => changeTab('seguiti')}
              style={{
                border: 0,
                background:
                  tab === 'seguiti'
                    ? T.accentGlow
                    : T.surface,
                color:
                  tab === 'seguiti'
                    ? T.accent
                    : T.textMuted,
                padding: '11px 12px',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10.5,
                fontWeight: 850,
              }}
            >
              Seguiti
            </button>
          </div>

          {users.length > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  color: T.textFaint,
                  fontSize: 9.5,
                }}
              >
                {users.length}{' '}
                {tab === 'follower' ? 'follower' : 'profili seguiti'}
              </span>

              <button
                type="button"
                onClick={() =>
                  setSortByCompatibility((current) => !current)
                }
                style={{
                  border: 0,
                  background: 'transparent',
                  color: sortByCompatibility
                    ? T.accent
                    : T.textMuted,
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: FONT.sans,
                  fontSize: 9.5,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Sparkle
                  size={12}
                  weight={sortByCompatibility ? 'fill' : 'regular'}
                />
                {sortByCompatibility
                  ? 'Ordine originale'
                  : 'Più compatibili'}
              </button>
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 14,
                border: `1px solid ${T.primary}55`,
                background: T.primaryGlow,
                color: T.primary,
                padding: 12,
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
                padding: 34,
                color: T.textFaint,
                textAlign: 'center',
              }}
            >
              Caricamento…
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                borderTop: `1px solid ${T.border}`,
                borderBottom: `1px solid ${T.border}`,
                padding: 36,
                color: T.textFaint,
                textAlign: 'center',
                fontSize: 11,
              }}
            >
              {tab === 'follower'
                ? 'Questo utente non ha ancora follower.'
                : 'Questo utente non segue ancora nessuno.'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                borderTop: `1px solid ${T.border}`,
              }}
            >
              {visibleUsers.map((user) => {
                const isMe = currentUser.id === user.user_id;
                const busy = busyId === user.user_id;
                const compatibility = Number(
                  user.compatibility_score ?? 0
                );

                return (
                  <article
                    key={user.user_id}
                    className="cdr-connection-row"
                    style={{
                      borderBottom: `1px solid ${T.border}`,
                      padding: '13px 0',
                      display: 'grid',
                      gridTemplateColumns:
                        '48px minmax(0,1fr) auto',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void router.push(
                          `/utente/${encodeURIComponent(
                            user.username
                          )}`
                        )
                      }
                      aria-label={`Apri il profilo di ${user.username}`}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: `1px solid ${T.border}`,
                        background: T.primaryGlow,
                        color: T.primary,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 900,
                        fontFamily: FONT.sans,
                      }}
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={`Avatar di ${user.username}`}
                          referrerPolicy="no-referrer"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void router.push(
                          `/utente/${encodeURIComponent(
                            user.username
                          )}`
                        )
                      }
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        textAlign: 'left',
                        minWidth: 0,
                        cursor: 'pointer',
                        fontFamily: FONT.sans,
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          color: T.text,
                          fontSize: 12.5,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        @{user.username}
                      </strong>

                      <span
                        style={{
                          display: '-webkit-box',
                          color: T.textFaint,
                          fontSize: 9.5,
                          lineHeight: 1.45,
                          marginTop: 3,
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {user.bio?.trim() || 'Nessuna bio.'}
                      </span>

                      {(compatibility > 0 || user.follows_you) && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginTop: 6,
                            color: T.textFaint,
                            fontSize: 8.5,
                            fontWeight: 800,
                          }}
                        >
                          {compatibility > 0 && (
                            <span style={{ color: T.accent }}>
                              {Math.round(compatibility)}% compatibilità
                            </span>
                          )}

                          {compatibility > 0 && user.follows_you && (
                            <span>·</span>
                          )}

                          {user.follows_you && (
                            <span style={{ color: T.primary }}>
                              Ti segue
                            </span>
                          )}
                        </span>
                      )}
                    </button>

                    {!isMe && (
                      <button
                        type="button"
                        onClick={() => void toggleFollow(user)}
                        disabled={busy}
                        style={{
                          border: `1px solid ${
                            user.is_following
                              ? T.border
                              : T.primary
                          }`,
                          background: user.is_following
                            ? 'transparent'
                            : T.primary,
                          color: user.is_following
                            ? T.textMuted
                            : '#fff',
                          padding: '8px 10px',
                          cursor: busy ? 'wait' : 'pointer',
                          opacity: busy ? 0.6 : 1,
                          fontFamily: FONT.sans,
                          fontSize: 9,
                          fontWeight: 850,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.is_following ? (
                          <UserCheck size={13} weight="fill" />
                        ) : (
                          <UserPlus size={13} weight="bold" />
                        )}

                        {busy
                          ? '…'
                          : user.is_following
                            ? 'Segui già'
                            : 'Segui'}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <style>{`
          @media (max-width: 560px) {
            .cdr-connection-row {
              grid-template-columns: 44px minmax(0,1fr) !important;
            }

            .cdr-connection-row > button:last-child {
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
