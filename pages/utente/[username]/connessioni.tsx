'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  FilmSlate,
  UserCheck,
  UserPlus,
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
  const P = theme === 'dark' ? D : L;
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
      router.replace('/auth');
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
          background: P.bg,
          display: 'grid',
          placeItems: 'center',
          color: P.textMuted,
          fontFamily: FONT,
        }}
      >
        <FilmSlate size={42} color={P.pink} weight="duotone" />
      </div>
    );
  }

  return (
    <AppShell activeNav="recensioni">
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
            onClick={() => router.back()}
            style={{
              border: 0,
              background: 'transparent',
              color: P.textMuted,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontWeight: 700,
              marginBottom: 18,
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
              <UsersThree size={15} weight="fill" color={P.pink} />
              @{username}
            </div>

            <h1
              style={{
                margin: '6px 0 0',
                fontFamily: FONT_DISPLAY,
                fontSize: 30,
                color: P.text,
              }}
            >
              Connessioni
            </h1>
          </header>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 5,
              padding: 4,
              background: P.bgSoft,
              border: `1px solid ${P.border}`,
              marginBottom: 16,
            }}
          >
            <button
              onClick={() => changeTab('follower')}
              style={{
                border: 0,
                background:
                  tab === 'follower'
                    ? P.card
                    : 'transparent',
                color:
                  tab === 'follower'
                    ? P.pink
                    : P.textMuted,
                padding: '11px 12px',
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              Follower
            </button>

            <button
              onClick={() => changeTab('seguiti')}
              style={{
                border: 0,
                background:
                  tab === 'seguiti'
                    ? P.card
                    : 'transparent',
                color:
                  tab === 'seguiti'
                    ? P.gold
                    : P.textMuted,
                padding: '11px 12px',
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              Seguiti
            </button>
          </div>

          {users.length > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 12,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setSortByCompatibility((current) => !current)
                }
                style={{
                  border: `1px solid ${
                    sortByCompatibility ? P.gold : P.border
                  }`,
                  background: sortByCompatibility ? `${P.gold}12` : P.card,
                  color: sortByCompatibility ? P.gold : P.textMuted,
                  padding: '7px 9px',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  fontSize: 9,
                  fontWeight: 800,
                }}
              >
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
                border: '1px solid rgba(239,68,68,.3)',
                background: 'rgba(239,68,68,.08)',
                color: '#fb7185',
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
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 34,
                color: P.textFaint,
                textAlign: 'center',
              }}
            >
              Caricamento...
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: 36,
                color: P.textFaint,
                textAlign: 'center',
                fontSize: 12,
              }}
            >
              {tab === 'follower'
                ? 'Questo utente non ha ancora follower.'
                : 'Questo utente non segue ancora nessuno.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {visibleUsers.map((user) => {
                const isMe = currentUser.id === user.user_id;
                const busy = busyId === user.user_id;

                return (
                  <article
                    key={user.user_id}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      padding: 12,
                      display: 'grid',
                      gridTemplateColumns:
                        '46px minmax(0,1fr) auto',
                      gap: 11,
                      alignItems: 'center',
                    }}
                  >
                    <button
                      onClick={() =>
                        router.push(
                          `/utente/${encodeURIComponent(user.username)}`
                        )
                      }
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: 0,
                        background: P.bgSoft,
                        color: P.pink,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 900,
                      }}
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
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
                      onClick={() =>
                        router.push(
                          `/utente/${encodeURIComponent(user.username)}`
                        )
                      }
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        textAlign: 'left',
                        minWidth: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          color: P.text,
                          fontSize: 12,
                        }}
                      >
                        @{user.username}
                      </strong>

                      <span
                        style={{
                          display: '-webkit-box',
                          color: P.textFaint,
                          fontSize: 9,
                          lineHeight: 1.4,
                          marginTop: 3,
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {user.bio?.trim() || 'Nessuna bio.'}
                      </span>

                      <div
                        style={{
                          display: 'flex',
                          gap: 5,
                          flexWrap: 'wrap',
                          marginTop: 6,
                        }}
                      >
                        {(user.compatibility_score ?? 0) > 0 && (
                          <span
                            style={{
                              border: `1px solid ${P.gold}55`,
                              background: `${P.gold}12`,
                              color: P.gold,
                              padding: '3px 6px',
                              fontSize: 8,
                              fontWeight: 850,
                            }}
                          >
                            Compatibilità {user.compatibility_score}
                          </span>
                        )}

                        {user.follows_you && (
                          <span
                            style={{
                              border: `1px solid ${P.pink}55`,
                              background: `${P.pink}10`,
                              color: P.pink,
                              padding: '3px 6px',
                              fontSize: 8,
                              fontWeight: 850,
                            }}
                          >
                            Ti segue
                          </span>
                        )}
                      </div>
                    </button>

                    {!isMe && (
                      <button
                        onClick={() => void toggleFollow(user)}
                        disabled={busy}
                        style={{
                          border: `1px solid ${
                            user.is_following
                              ? P.border
                              : P.pink
                          }`,
                          background: user.is_following
                            ? P.bgSoft
                            : P.pink,
                          color: user.is_following
                            ? P.textMuted
                            : '#fff',
                          padding: '8px 10px',
                          cursor: busy ? 'wait' : 'pointer',
                          opacity: busy ? 0.6 : 1,
                          fontSize: 9,
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        {user.is_following ? (
                          <UserCheck size={13} weight="fill" />
                        ) : (
                          <UserPlus size={13} weight="bold" />
                        )}

                        {busy
                          ? '...'
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
      </main>
    </AppShell>
  );
}