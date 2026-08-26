'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  MagnifyingGlass,
  UserCheck,
  UserPlus,
  UsersThree,
  Sparkle,
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

type PublicUser = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  is_following: boolean;
  shared_genres?: string[];
  shared_genres_count?: number;
  shared_favorites_count?: number;
  shared_high_ratings_count?: number;
  compatibility_score?: number;
};

export default function PersonePage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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

    const loadSuggestions = async () => {
      setLoadingSuggestions(true);

      try {
        const { data, error: rpcError } = await supabase.rpc(
          'get_people_suggestions',
          { p_limit: 12 }
        );

        if (rpcError) throw rpcError;

        if (!cancelled) {
          setSuggestedUsers(
            ((data ?? []) as PublicUser[])
              .map((user) => ({
                ...user,
                followers_count: Number(user.followers_count ?? 0),
                shared_genres_count: Number(user.shared_genres_count ?? 0),
                shared_favorites_count: Number(user.shared_favorites_count ?? 0),
                shared_high_ratings_count: Number(user.shared_high_ratings_count ?? 0),
                compatibility_score: Number(user.compatibility_score ?? 0),
                shared_genres: Array.isArray(user.shared_genres)
                  ? user.shared_genres
                  : [],
              }))
              .filter((user) => (user.compatibility_score ?? 0) > 0)
              .slice(0, 6)
          );
        }
      } catch (err) {
        console.error('People suggestions load failed:', err);
        if (!cancelled) setSuggestedUsers([]);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    };

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [currentUser, supabase]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const { data, error: rpcError } = await supabase.rpc(
          'search_public_users',
          {
            p_query: query.trim(),
            p_limit: 40,
            p_offset: 0,
          }
        );

        if (rpcError) throw rpcError;

        setUsers(
          ((data ?? []) as PublicUser[]).map((user) => ({
            ...user,
            followers_count: Number(user.followers_count ?? 0),
          }))
        );
      } catch (err: unknown) {
        console.error('User search failed:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile cercare gli utenti.'
        );
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, currentUser, supabase]);

  const toggleFollow = async (user: PublicUser) => {
    if (!currentUser || currentUser.isGuest) return;

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

      const updateFollowState = (current: PublicUser[]) =>
        current.map((item) =>
          item.user_id === user.user_id
            ? {
                ...item,
                is_following: !item.is_following,
                followers_count: Math.max(
                  0,
                  item.followers_count + (item.is_following ? -1 : 1)
                ),
              }
            : item
        );

      setUsers(updateFollowState);
      setSuggestedUsers(updateFollowState);
    } catch (err: unknown) {
      console.error('Follow from people page failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile aggiornare il follow.'
      );
    } finally {
      setBusyId(null);
    }
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
    <AppShell activeNav="persone">
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
              <UsersThree size={16} color={P.pink} weight="fill" />
              Community
            </div>

            <h1
              style={{
                margin: '6px 0 5px',
                color: P.text,
                fontFamily: FONT_DISPLAY,
                fontSize: 30,
              }}
            >
              Scopri persone
            </h1>

            <p
              style={{
                color: P.textMuted,
                fontSize: 12,
                margin: 0,
              }}
            >
              Cerca utenti da seguire e scopri le loro recensioni.
            </p>
          </header>

          {!loadingSuggestions && suggestedUsers.length > 0 && (
            <section
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  color: P.gold,
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '.09em',
                  marginBottom: 10,
                }}
              >
                <Sparkle size={14} weight="fill" />
                Compatibili con te
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                  gap: 10,
                }}
              >
                {suggestedUsers.map((user) => (
                  <div
                    key={`suggested-${user.user_id}`}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.bgSoft,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/utente/${encodeURIComponent(user.username)}`)
                      }
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        cursor: 'pointer',
                        minWidth: 0,
                        flex: 1,
                        textAlign: 'left',
                        fontFamily: FONT,
                      }}
                    >
                      <div
                        style={{
                          color: P.text,
                          fontSize: 12,
                          fontWeight: 850,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        @{user.username}
                      </div>

                      <div
                        style={{
                          color: P.textFaint,
                          fontSize: 10,
                          marginTop: 3,
                          lineHeight: 1.4,
                        }}
                      >
                        {(user.shared_favorites_count ?? 0) > 0
                          ? `${user.shared_favorites_count} preferiti in comune`
                          : (user.shared_high_ratings_count ?? 0) > 0
                          ? `${user.shared_high_ratings_count} film valutati bene da entrambi`
                          : `${user.shared_genres_count ?? 0} gusti in comune`}
                      </div>

                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          marginTop: 7,
                          border: `1px solid ${P.gold}55`,
                          background: P.gold + '12',
                          color: P.gold,
                          padding: '3px 6px',
                          fontSize: 9,
                          fontWeight: 850,
                        }}
                      >
                        Compatibilità {user.compatibility_score ?? 0}
                      </div>

                      {(user.shared_genres?.length ?? 0) > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 5,
                            flexWrap: 'wrap',
                            marginTop: 7,
                          }}
                        >
                          {user.shared_genres?.slice(0, 3).map((genre) => (
                            <span
                              key={`${user.user_id}-${genre}`}
                              style={{
                                border: `1px solid ${P.border}`,
                                color: P.gold,
                                background: P.card,
                                padding: '3px 6px',
                                fontSize: 9,
                                fontWeight: 800,
                              }}
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleFollow(user)}
                      disabled={busyId === user.user_id}
                      style={{
                        width: 36,
                        height: 36,
                        border: `1px solid ${
                          user.is_following ? P.gold : P.border
                        }`,
                        background: user.is_following ? P.gold + '18' : P.card,
                        color: user.is_following ? P.gold : P.textMuted,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: busyId === user.user_id ? 'wait' : 'pointer',
                        flexShrink: 0,
                      }}
                      title={user.is_following ? 'Non seguire più' : 'Segui'}
                    >
                      {user.is_following ? (
                        <UserCheck size={16} weight="duotone" />
                      ) : (
                        <UserPlus size={16} weight="duotone" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div
            style={{
              height: 44,
              border: `1px solid ${P.border}`,
              background: P.bgSoft,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              color: P.textFaint,
              marginBottom: 14,
            }}
          >
            <MagnifyingGlass size={17} />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca username o bio..."
              style={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                border: 0,
                outline: 0,
                background: 'transparent',
                color: P.text,
                padding: '0 9px',
                fontFamily: FONT,
              }}
            />
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
                padding: 30,
                textAlign: 'center',
                color: P.textFaint,
                fontSize: 12,
              }}
            >
              Ricerca...
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: 34,
                textAlign: 'center',
                color: P.textFaint,
                fontSize: 12,
              }}
            >
              Nessun utente trovato.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {users.map((user) => {
                const busy = busyId === user.user_id;

                return (
                  <article
                    key={user.user_id}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      padding: 12,
                      display: 'grid',
                      gridTemplateColumns: '48px minmax(0,1fr) auto',
                      gap: 11,
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void router.push(
                          `/utente/${encodeURIComponent(user.username)}`
                        )
                      }
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: 0,
                        padding: 0,
                        overflow: 'hidden',
                        background: P.bgSoft,
                        color: P.pink,
                        fontWeight: 900,
                        cursor: 'pointer',
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
                      type="button"
                      onClick={() =>
                        void router.push(
                          `/utente/${encodeURIComponent(user.username)}`
                        )
                      }
                      style={{
                        minWidth: 0,
                        border: 0,
                        padding: 0,
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: FONT,
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
                          marginTop: 3,
                          color: P.textFaint,
                          fontSize: 9,
                          lineHeight: 1.4,
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {user.bio?.trim() || 'Nessuna bio.'}
                      </span>

                      <span
                        style={{
                          display: 'block',
                          marginTop: 4,
                          color: P.textMuted,
                          fontSize: 9,
                        }}
                      >
                        {user.followers_count}{' '}
                        {user.followers_count === 1 ? 'follower' : 'follower'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleFollow(user)}
                      disabled={busy}
                      style={{
                        border: `1px solid ${
                          user.is_following ? P.border : P.pink
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontFamily: FONT,
                        fontSize: 9,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
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