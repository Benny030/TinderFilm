'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  MagnifyingGlass,
  Sparkle,
  UserCheck,
  UserPlus,
  UsersThree,
  X,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';
import { createBrowserClient } from '@/utils/supabase/browser';

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

function UserAvatar({
  user,
  size = 48,
}: {
  user: PublicUser;
  size?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = user.username.charAt(0).toUpperCase();

  useEffect(() => {
    setImageFailed(false);
  }, [user.avatar_url]);

  const showImage = Boolean(user.avatar_url) && !imageFailed;

  return (
    <div
      className="cdr-people-avatar"
      style={{ width: size, height: size }}
      aria-label={`Avatar di ${user.username}`}
    >
      {showImage ? (
        <img
          src={user.avatar_url!}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function sharedReason(user: PublicUser) {
  if ((user.shared_favorites_count ?? 0) > 0) {
    return `${user.shared_favorites_count} preferiti in comune`;
  }

  if ((user.shared_high_ratings_count ?? 0) > 0) {
    return `${user.shared_high_ratings_count} film apprezzati da entrambi`;
  }

  return `${user.shared_genres_count ?? 0} gusti in comune`;
}

export default function PersonePage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? THEME.dark : THEME.light;
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
                shared_favorites_count: Number(
                  user.shared_favorites_count ?? 0
                ),
                shared_high_ratings_count: Number(
                  user.shared_high_ratings_count ?? 0
                ),
                compatibility_score: Number(
                  user.compatibility_score ?? 0
                ),
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

  const openUser = (username: string) => {
    void router.push(`/utente/${encodeURIComponent(username)}`);
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
          minHeight: '100dvh',
          background: P.bg,
          display: 'grid',
          placeItems: 'center',
          color: P.textMuted,
          fontFamily: FONT.sans,
        }}
      >
        Caricamento...
      </div>
    );
  }

  const vars = {
    '--cdr-people-bg': P.bg,
    '--cdr-people-soft': P.bgSoft,
    '--cdr-people-surface': P.surface,
    '--cdr-people-hover': P.surfaceHover,
    '--cdr-people-border': P.border,
    '--cdr-people-text': P.text,
    '--cdr-people-muted': P.textMuted,
    '--cdr-people-faint': P.textFaint,
    '--cdr-people-pink': P.primary,
    '--cdr-people-pink-glow': P.primaryGlow,
    '--cdr-people-gold': P.accent,
    '--cdr-people-gold-glow': P.accentGlow,
  } as CSSProperties;

  return (
    <AppShell activeNav="persone">
      <main className="cdr-people" style={vars}>
        <style>{`
          .cdr-people {
            width: 100%;
            min-height: 100dvh;
            overflow-x: hidden;
            background: var(--cdr-people-bg);
            color: var(--cdr-people-text);
            font-family: ${FONT.sans};
          }

          .cdr-people * {
            box-sizing: border-box;
          }

          .cdr-people-shell {
            width: min(100%, 1040px);
            margin: 0 auto;
            padding: 22px 24px 56px;
          }

          .cdr-people-back {
            min-height: 38px;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            margin-bottom: 18px;
            padding: 7px 10px;
            border: 1px solid var(--cdr-people-border);
            border-radius: 0;
            background: transparent;
            color: var(--cdr-people-muted);
            font-size: 11px;
            font-weight: 750;
            cursor: pointer;
          }

          .cdr-people-header {
            display: grid;
            grid-template-columns: minmax(0,1fr) minmax(280px,.72fr);
            align-items: end;
            gap: 28px;
            margin-bottom: 20px;
          }

          .cdr-people-kicker {
            display: flex;
            align-items: center;
            gap: 7px;
            margin-bottom: 7px;
            color: var(--cdr-people-pink);
            font-size: 9px;
            font-weight: 850;
            letter-spacing: .11em;
            text-transform: uppercase;
          }

          .cdr-people-title {
            margin: 0;
            font-family: ${FONT.display};
            font-size: clamp(36px, 5vw, 52px);
            line-height: .98;
            letter-spacing: -.035em;
          }

          .cdr-people-lead {
            max-width: 560px;
            margin: 10px 0 0;
            color: var(--cdr-people-muted);
            font-size: 11px;
            line-height: 1.55;
          }

          .cdr-people-search {
            height: 46px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 0 11px;
            border: 1px solid var(--cdr-people-border);
            background: var(--cdr-people-surface);
            color: var(--cdr-people-faint);
          }

          .cdr-people-search:focus-within {
            border-color: var(--cdr-people-pink);
            box-shadow: 0 0 0 2px var(--cdr-people-pink-glow);
          }

          .cdr-people-search input {
            min-width: 0;
            flex: 1;
            height: 100%;
            padding: 0;
            border: 0;
            outline: 0;
            background: transparent;
            color: var(--cdr-people-text);
            font: inherit;
            font-size: 11px;
          }

          .cdr-people-search button {
            width: 28px;
            height: 28px;
            display: grid;
            place-items: center;
            padding: 0;
            border: 0;
            background: transparent;
            color: var(--cdr-people-faint);
            cursor: pointer;
          }

          .cdr-people-section {
            margin-top: 16px;
          }

          .cdr-people-section-head {
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 9px;
          }

          .cdr-people-section-title {
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 12px;
            font-weight: 850;
          }

          .cdr-people-section-copy {
            color: var(--cdr-people-muted);
            font-size: 9px;
          }

          .cdr-people-suggestions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0,1fr));
            gap: 8px;
          }

          .cdr-people-suggestion {
            min-width: 0;
            display: grid;
            grid-template-columns: 46px minmax(0,1fr);
            gap: 9px;
            padding: 10px;
            border: 1px solid var(--cdr-people-border);
            background: var(--cdr-people-surface);
          }

          .cdr-people-avatar {
            flex: 0 0 auto;
            overflow: hidden;
            border-radius: 50%;
            display: grid;
            place-items: center;
            background: linear-gradient(135deg,var(--cdr-people-pink),#8e1740);
            color: #fff;
            font-size: 15px;
            font-weight: 900;
          }

          .cdr-people-avatar img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: cover;
          }

          .cdr-people-suggestion-main {
            min-width: 0;
          }

          .cdr-people-user-link {
            width: 100%;
            min-width: 0;
            padding: 0;
            border: 0;
            background: transparent;
            color: var(--cdr-people-text);
            text-align: left;
            cursor: pointer;
          }

          .cdr-people-username {
            overflow: hidden;
            font-size: 11px;
            font-weight: 850;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .cdr-people-reason {
            min-height: 27px;
            margin-top: 3px;
            color: var(--cdr-people-muted);
            font-size: 8px;
            line-height: 1.4;
          }

          .cdr-people-affinity {
            margin-top: 7px;
            color: var(--cdr-people-gold);
            font-size: 8px;
            font-weight: 850;
          }

          .cdr-people-genres {
            min-height: 17px;
            margin-top: 5px;
            color: var(--cdr-people-faint);
            font-size: 7.5px;
            line-height: 1.4;
          }

          .cdr-people-suggestion-actions {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 6px;
            margin-top: 1px;
          }

          .cdr-people-open,
          .cdr-people-follow {
            min-height: 32px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            padding: 5px 8px;
            border: 1px solid var(--cdr-people-border);
            background: var(--cdr-people-bg);
            color: var(--cdr-people-text);
            font-size: 8px;
            font-weight: 850;
            cursor: pointer;
          }

          .cdr-people-follow {
            border-color: var(--cdr-people-pink);
            background: var(--cdr-people-pink);
            color: #fff;
          }

          .cdr-people-follow[data-following="true"] {
            border-color: var(--cdr-people-border);
            background: var(--cdr-people-soft);
            color: var(--cdr-people-muted);
          }

          .cdr-people-results {
            display: grid;
            grid-template-columns: repeat(2, minmax(0,1fr));
            gap: 7px;
          }

          .cdr-people-row {
            min-width: 0;
            display: grid;
            grid-template-columns: 50px minmax(0,1fr) auto;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border: 1px solid var(--cdr-people-border);
            background: var(--cdr-people-surface);
            transition: 150ms ease;
          }

          .cdr-people-row:hover {
            border-color: var(--cdr-people-pink);
            background: var(--cdr-people-hover);
          }

          .cdr-people-bio {
            display: -webkit-box;
            margin-top: 3px;
            overflow: hidden;
            color: var(--cdr-people-faint);
            font-size: 8px;
            line-height: 1.4;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .cdr-people-followers {
            display: block;
            margin-top: 4px;
            color: var(--cdr-people-muted);
            font-size: 8px;
          }

          .cdr-people-row-follow {
            min-width: 76px;
            min-height: 34px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            padding: 6px 8px;
            border: 1px solid var(--cdr-people-pink);
            background: var(--cdr-people-pink);
            color: #fff;
            font-size: 8px;
            font-weight: 850;
            cursor: pointer;
          }

          .cdr-people-row-follow[data-following="true"] {
            border-color: var(--cdr-people-border);
            background: var(--cdr-people-soft);
            color: var(--cdr-people-muted);
          }

          .cdr-people-state {
            min-height: 160px;
            display: grid;
            place-items: center;
            padding: 20px;
            border: 1px dashed var(--cdr-people-border);
            background: var(--cdr-people-surface);
            color: var(--cdr-people-muted);
            text-align: center;
            font-size: 10px;
          }

          .cdr-people-error {
            margin: 10px 0;
            padding: 9px 10px;
            border: 1px solid rgba(239,68,68,.3);
            background: rgba(239,68,68,.07);
            color: #ef4444;
            font-size: 9px;
          }

          @media (max-width: 860px) {
            .cdr-people-header {
              grid-template-columns: 1fr;
              gap: 14px;
            }

            .cdr-people-suggestions {
              grid-template-columns: repeat(2,minmax(0,1fr));
            }

            .cdr-people-results {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 560px) {
            .cdr-people-shell {
              padding: 10px 8px 30px;
            }

            .cdr-people-back {
              min-height: 34px;
              margin-bottom: 12px;
              padding: 6px 8px;
              font-size: 9px;
            }

            .cdr-people-title {
              font-size: 31px;
            }

            .cdr-people-lead {
              margin-top: 7px;
              font-size: 9px;
            }

            .cdr-people-search {
              height: 42px;
            }

            .cdr-people-suggestions {
              grid-template-columns: 1fr;
              gap: 6px;
            }

            .cdr-people-suggestion {
              grid-template-columns: 42px minmax(0,1fr);
              padding: 9px;
            }

            .cdr-people-section-head {
              align-items: flex-start;
              flex-direction: column;
              gap: 3px;
            }

            .cdr-people-row {
              grid-template-columns: 44px minmax(0,1fr) auto;
              gap: 8px;
              padding: 8px;
            }

            .cdr-people-row-follow {
              min-width: 36px;
              width: 36px;
              padding: 0;
            }

            .cdr-people-row-follow span {
              display: none;
            }
          }

          @media (min-width: 381px) and (max-width: 460px) {
            .cdr-people-shell {
              padding-inline: 8px;
            }

            .cdr-people-title {
              font-size: 29px;
            }

            .cdr-people-suggestion {
              grid-template-columns: 44px minmax(0,1fr);
            }

            .cdr-people-row {
              grid-template-columns: 46px minmax(0,1fr) 36px;
            }
          }

          @media (max-width: 380px) {
            .cdr-people-back span {
              display: none;
            }

            .cdr-people-title {
              font-size: 28px;
            }
          }
        `}</style>

        <div className="cdr-people-shell">
          <button
            type="button"
            className="cdr-people-back"
            onClick={() => router.back()}
          >
            <ArrowLeft size={16} />
            <span>Indietro</span>
          </button>

          <header className="cdr-people-header">
            <div>
              <div className="cdr-people-kicker">
                <UsersThree size={15} weight="fill" />
                Community
              </div>

              <h1 className="cdr-people-title">Scopri persone</h1>

              <p className="cdr-people-lead">
                Trova persone con gusti cinematografici vicini ai tuoi,
                segui le loro recensioni e costruisci la tua community.
              </p>
            </div>

            <div className="cdr-people-search">
              <MagnifyingGlass size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca username o bio..."
              />
              {query && (
                <button
                  type="button"
                  aria-label="Pulisci ricerca"
                  onClick={() => setQuery('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </header>

          {error && <div className="cdr-people-error">{error}</div>}

          {!loadingSuggestions && suggestedUsers.length > 0 && (
            <section className="cdr-people-section">
              <div className="cdr-people-section-head">
                <div className="cdr-people-section-title">
                  <Sparkle
                    size={14}
                    weight="fill"
                    color={P.accent}
                  />
                  Compatibili con te
                </div>

                <div className="cdr-people-section-copy">
                  Suggerimenti basati sui gusti che avete in comune
                </div>
              </div>

              <div className="cdr-people-suggestions">
                {suggestedUsers.map((user) => {
                  const busy = busyId === user.user_id;

                  return (
                    <article
                      key={`suggested-${user.user_id}`}
                      className="cdr-people-suggestion"
                    >
                      <button
                        type="button"
                        className="cdr-people-user-link"
                        onClick={() => openUser(user.username)}
                        aria-label={`Apri profilo di ${user.username}`}
                      >
                        <UserAvatar user={user} size={46} />
                      </button>

                      <button
                        type="button"
                        className="cdr-people-user-link cdr-people-suggestion-main"
                        onClick={() => openUser(user.username)}
                      >
                        <div className="cdr-people-username">
                          @{user.username}
                        </div>

                        <div className="cdr-people-reason">
                          {sharedReason(user)}
                        </div>

                        <div className="cdr-people-affinity">
                          Affinità {user.compatibility_score ?? 0}
                        </div>

                        <div className="cdr-people-genres">
                          {(user.shared_genres ?? [])
                            .slice(0, 3)
                            .join(' · ')}
                        </div>
                      </button>

                      <div className="cdr-people-suggestion-actions">
                        <button
                          type="button"
                          className="cdr-people-open"
                          onClick={() => openUser(user.username)}
                        >
                          Vedi profilo
                        </button>

                        <button
                          type="button"
                          className="cdr-people-follow"
                          data-following={user.is_following}
                          disabled={busy}
                          onClick={() => void toggleFollow(user)}
                        >
                          {user.is_following ? (
                            <UserCheck size={12} weight="fill" />
                          ) : (
                            <UserPlus size={12} weight="bold" />
                          )}
                          {busy
                            ? '...'
                            : user.is_following
                              ? 'Segui già'
                              : 'Segui'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="cdr-people-section">
            <div className="cdr-people-section-head">
              <div className="cdr-people-section-title">
                <UsersThree
                  size={14}
                  weight="fill"
                  color={P.primary}
                />
                {query.trim() ? 'Risultati' : 'Persone'}
              </div>

              {!loading && (
                <div className="cdr-people-section-copy">
                  {users.length}{' '}
                  {users.length === 1 ? 'profilo' : 'profili'}
                </div>
              )}
            </div>

            {loading ? (
              <div className="cdr-people-state">Ricerca...</div>
            ) : users.length === 0 ? (
              <div className="cdr-people-state">
                Nessun utente trovato.
              </div>
            ) : (
              <div className="cdr-people-results">
                {users.map((user) => {
                  const busy = busyId === user.user_id;

                  return (
                    <article
                      key={user.user_id}
                      className="cdr-people-row"
                    >
                      <button
                        type="button"
                        className="cdr-people-user-link"
                        onClick={() => openUser(user.username)}
                        aria-label={`Apri profilo di ${user.username}`}
                      >
                        <UserAvatar user={user} size={50} />
                      </button>

                      <button
                        type="button"
                        className="cdr-people-user-link"
                        onClick={() => openUser(user.username)}
                      >
                        <strong className="cdr-people-username">
                          @{user.username}
                        </strong>

                        <span className="cdr-people-bio">
                          {user.bio?.trim() || 'Nessuna bio.'}
                        </span>

                        <span className="cdr-people-followers">
                          {user.followers_count}{' '}
                          {user.followers_count === 1
                            ? 'follower'
                            : 'follower'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="cdr-people-row-follow"
                        data-following={user.is_following}
                        disabled={busy}
                        onClick={() => void toggleFollow(user)}
                        title={
                          user.is_following
                            ? 'Non seguire più'
                            : 'Segui'
                        }
                      >
                        {user.is_following ? (
                          <UserCheck size={13} weight="fill" />
                        ) : (
                          <UserPlus size={13} weight="bold" />
                        )}
                        <span>
                          {busy
                            ? '...'
                            : user.is_following
                              ? 'Segui già'
                              : 'Segui'}
                        </span>
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}