'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  BookmarkSimple,
  CheckCircle,
  Eye,
  FilmSlate,
  Heart,
  MagnifyingGlass,
  SortAscending,
  Star,
  X,
} from '@phosphor-icons/react';

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
  pinkGlow: 'rgba(237,61,115,0.15)',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
  success: '#22c55e',
  danger: '#ef4444',
};

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
  pinkGlow: 'rgba(184,48,96,0.10)',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
  success: '#16a34a',
  danger: '#dc2626',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type Tab = 'generale' | 'preferiti' | 'watchlist' | 'visti' | 'recensioni';
type SortMode = 'recenti' | 'titolo' | 'anno';

type CatalogMovie = {
  id: string;
  provider: string;
  provider_movie_id: string;
  title: string;
  year: number | null;
  genre: string | null;
  cover: string | null;
};

type MovieEntry = {
  id: string;
  user_id: string;
  movie_id: string;
  rating: number | null;
  review_text: string | null;
  review_updated_at: string | null;
  is_favorite: boolean;
  in_watchlist: boolean;
  watched_on: string | null;
  created_at: string;
  updated_at: string;
  movie_catalog: CatalogMovie | CatalogMovie[] | null;
};

function getMovie(entry: MovieEntry) {
  return Array.isArray(entry.movie_catalog)
    ? entry.movie_catalog[0] ?? null
    : entry.movie_catalog;
}

function formatDate(value: string | null) {
  if (!value) return '';

  return new Date(`${value}T00:00:00`).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function LibreriaPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const [entries, setEntries] = useState<MovieEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recenti');

  const queryTab =
    typeof router.query.tab === 'string'
      ? router.query.tab
      : null;

  const initialTab: Tab =
    queryTab === 'generale' ||
    queryTab === 'watchlist' ||
    queryTab === 'visti' ||
    queryTab === 'recensioni' ||
    queryTab === 'preferiti'
      ? queryTab
      : 'generale';

  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (!router.isReady) return;

    const next =
      typeof router.query.tab === 'string'
        ? router.query.tab
        : null;

    if (
      next === 'generale' ||
      next === 'preferiti' ||
      next === 'watchlist' ||
      next === 'visti' ||
      next === 'recensioni'
    ) {
      setTab(next);
    } else if (!next) {
      setTab('generale');
    }
  }, [router.isReady, router.query.tab]);

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  const loadEntries = async () => {
    if (!currentUser || currentUser.isGuest) return;

    setLoadingEntries(true);
    setError('');

    try {
      const { data, error: entriesError } = await supabase
        .from('user_movie_entries')
        .select(`
          id,
          user_id,
          movie_id,
          rating,
          review_text,
          review_updated_at,
          is_favorite,
          in_watchlist,
          watched_on,
          created_at,
          updated_at,
          movie_catalog (
            id,
            provider,
            provider_movie_id,
            title,
            year,
            genre,
            cover
          )
        `)
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

      if (entriesError) throw entriesError;

      setEntries((data ?? []) as MovieEntry[]);
    } catch (err: any) {
      console.error('Library load failed:', err);
      setError(err.message ?? 'Impossibile caricare la libreria.');
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const meaningfulEntries = entries.filter(
    (entry) =>
      entry.is_favorite ||
      entry.in_watchlist ||
      Boolean(entry.watched_on) ||
      Boolean(entry.review_text) ||
      entry.rating !== null
  );

  const counts = {
    generale: meaningfulEntries.length,
    preferiti: entries.filter((entry) => entry.is_favorite).length,
    watchlist: entries.filter((entry) => entry.in_watchlist).length,
    visti: entries.filter((entry) => entry.watched_on).length,
    recensioni: entries.filter(
      (entry) => entry.review_text || entry.rating !== null
    ).length,
  };

  const filteredEntries = useMemo(() => {
    let base = entries.filter((entry) => {
      if (tab === 'generale') {
        return (
          entry.is_favorite ||
          entry.in_watchlist ||
          Boolean(entry.watched_on) ||
          Boolean(entry.review_text) ||
          entry.rating !== null
        );
      }

      if (tab === 'preferiti') return entry.is_favorite;
      if (tab === 'watchlist') return entry.in_watchlist;
      if (tab === 'visti') return Boolean(entry.watched_on);

      return Boolean(entry.review_text) || entry.rating !== null;
    });

    const needle = search.trim().toLowerCase();

    if (needle) {
      base = base.filter((entry) => {
        const movie = getMovie(entry);
        if (!movie) return false;

        return [
          movie.title,
          movie.genre ?? '',
          movie.year?.toString() ?? '',
          entry.review_text ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      });
    }

    return [...base].sort((a, b) => {
      const movieA = getMovie(a);
      const movieB = getMovie(b);

      if (sort === 'titolo') {
        return (movieA?.title ?? '').localeCompare(
          movieB?.title ?? '',
          'it'
        );
      }

      if (sort === 'anno') {
        return (movieB?.year ?? 0) - (movieA?.year ?? 0);
      }

      return (
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime()
      );
    });
  }, [entries, search, sort, tab]);

  const changeTab = (next: Tab) => {
    setTab(next);

    void router.replace(
      {
        pathname: '/libreria',
        query: { tab: next },
      },
      undefined,
      { shallow: true }
    );
  };

  const patchEntry = async (
    entry: MovieEntry,
    patch: Partial<
      Pick<
        MovieEntry,
        'is_favorite' | 'in_watchlist' | 'watched_on'
      >
    >
  ) => {
    if (!currentUser || currentUser.isGuest) return;

    setBusyId(entry.id);
    setError('');

    try {
      const { data, error: updateError } = await supabase
        .from('user_movie_entries')
        .update(patch)
        .eq('id', entry.id)
        .eq('user_id', currentUser.id)
        .select(`
          id,
          user_id,
          movie_id,
          rating,
          review_text,
          review_updated_at,
          is_favorite,
          in_watchlist,
          watched_on,
          created_at,
          updated_at,
          movie_catalog (
            id,
            provider,
            provider_movie_id,
            title,
            year,
            genre,
            cover
          )
        `)
        .single();

      if (updateError) throw updateError;

      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? (data as MovieEntry)
            : item
        )
      );
    } catch (err: any) {
      console.error('Library entry update failed:', err);
      setError(err.message ?? 'Impossibile aggiornare il film.');
    } finally {
      setBusyId(null);
    }
  };

  const openMovie = (entry: MovieEntry) => {
    const movie = getMovie(entry);

    if (movie?.provider === 'tmdb') {
      router.push(`/film/${movie.provider_movie_id}`);
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
          display: 'grid',
          placeItems: 'center',
          background: P.bg,
          color: P.textMuted,
          fontFamily: FONT,
        }}
      >
        <FilmSlate size={42} color={P.pink} weight="duotone" />
      </div>
    );
  }

  const tabs: {
    id: Tab;
    label: string;
    icon: typeof Heart;
    color: string;
  }[] = [
    {
      id: 'generale',
      label: 'Generale',
      icon: FilmSlate,
      color: P.text,
    },
    {
      id: 'preferiti',
      label: 'Preferiti',
      icon: Heart,
      color: P.pink,
    },
    {
      id: 'watchlist',
      label: 'Watchlist',
      icon: BookmarkSimple,
      color: P.gold,
    },
    {
      id: 'visti',
      label: 'Visti',
      icon: Eye,
      color: P.success,
    },
    {
      id: 'recensioni',
      label: 'Voti e recensioni',
      icon: Star,
      color: P.gold,
    },
  ];

  return (
    <AppShell activeNav="libreria">
      <main
        style={{
          minHeight: '100vh',
          background: P.bg,
          color: P.text,
          fontFamily: FONT,
          padding: '28px 18px 80px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1120,
            margin: '0 auto',
          }}
        >
          <header style={{ marginBottom: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: P.textMuted,
                fontSize: 12,
              }}
            >
              <FilmSlate size={16} weight="fill" color={P.gold} />
              La tua raccolta
            </div>

            <h1
              style={{
                margin: '7px 0 5px',
                color: P.text,
                fontFamily: FONT_DISPLAY,
                fontSize: 'clamp(28px,4vw,38px)',
              }}
            >
              Libreria
            </h1>

            <p
              style={{
                color: P.textMuted,
                fontSize: 13,
                margin: 0,
              }}
            >
              Tutti i film che hai salvato, visto, votato o recensito.
            </p>
          </header>

          <div
            className="library-tabs"
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(5,minmax(0,1fr))',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => changeTab(item.id)}
                  style={{
                    border: `1px solid ${
                      active ? item.color : P.border
                    }`,
                    background: active
                      ? item.id === 'generale'
                        ? P.bgSoft
                        : item.id === 'preferiti'
                        ? P.pinkGlow
                        : item.id === 'visti'
                        ? 'rgba(34,197,94,.10)'
                        : P.goldGlow
                      : P.card,
                    color: active
                      ? item.color
                      : P.textMuted,
                    minHeight: 74,
                    padding: '12px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                  }}
                >
                  <Icon
                    size={20}
                    weight={active ? 'fill' : 'regular'}
                    style={{ flexShrink: 0 }}
                  />

                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: 'block',
                        color: active
                          ? item.color
                          : P.text,
                        fontSize: 12,
                      }}
                    >
                      {item.label}
                    </strong>

                    <span
                      style={{
                        display: 'block',
                        color: P.textFaint,
                        fontSize: 10,
                        marginTop: 3,
                      }}
                    >
                      {counts[item.id]} film
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="library-toolbar"
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 42,
                display: 'flex',
                alignItems: 'center',
                border: `1px solid ${P.border}`,
                background: P.bgSoft,
                padding: '0 12px',
                color: P.textFaint,
              }}
            >
              <MagnifyingGlass size={17} />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Cerca nella tua libreria..."
                style={{
                  flex: 1,
                  height: '100%',
                  background: 'transparent',
                  border: 0,
                  outline: 0,
                  color: P.text,
                  padding: '0 9px',
                  fontFamily: FONT,
                }}
              />

              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Pulisci ricerca"
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: P.textFaint,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div
              style={{
                height: 42,
                display: 'flex',
                alignItems: 'center',
                border: `1px solid ${P.border}`,
                background: P.bgSoft,
                paddingLeft: 11,
                color: P.textFaint,
              }}
            >
              <SortAscending size={16} />
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as SortMode)
                }
                style={{
                  height: '100%',
                  border: 0,
                  outline: 0,
                  background: P.bgSoft,
                  color: P.textMuted,
                  padding: '0 11px 0 7px',
                  fontFamily: FONT,
                  cursor: 'pointer',
                }}
              >
                <option value="recenti">Più recenti</option>
                <option value="titolo">Titolo</option>
                <option value="anno">Anno</option>
              </select>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                border: `1px solid ${P.danger}45`,
                background: 'rgba(239,68,68,.08)',
                color: P.danger,
                padding: '11px 13px',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {loadingEntries ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 34,
                textAlign: 'center',
                color: P.textFaint,
                fontSize: 12,
              }}
            >
              Caricamento libreria...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: '46px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  margin: '0 auto 12px',
                  background: P.bgSoft,
                  display: 'grid',
                  placeItems: 'center',
                  color: P.textFaint,
                }}
              >
                {tab === 'generale' && (
                  <FilmSlate size={24} />
                )}
                {tab === 'preferiti' && (
                  <Heart size={24} />
                )}
                {tab === 'watchlist' && (
                  <BookmarkSimple size={24} />
                )}
                {tab === 'visti' && (
                  <Eye size={24} />
                )}
                {tab === 'recensioni' && (
                  <Star size={24} />
                )}
              </div>

              <strong
                style={{
                  display: 'block',
                  color: P.text,
                  fontSize: 14,
                }}
              >
                Nessun film qui
              </strong>

              <span
                style={{
                  display: 'block',
                  color: P.textFaint,
                  fontSize: 11,
                  marginTop: 5,
                }}
              >
                {search
                  ? 'Nessun risultato corrisponde alla ricerca.'
                  : 'Apri un film e aggiungilo da lì.'}
              </span>
            </div>
          ) : (
            <div className="library-grid">
              {filteredEntries.map((entry) => {
                const movie = getMovie(entry);
                if (!movie) return null;

                const busy = busyId === entry.id;

                return (
                  <article
                    key={entry.id}
                    className="library-card"
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      overflow: 'hidden',
                      minWidth: 0,
                    }}
                  >
                    <button
                      onClick={() => openMovie(entry)}
                      style={{
                        width: '100%',
                        aspectRatio: '2/3',
                        border: 0,
                        padding: 0,
                        background: P.bgSoft,
                        cursor:
                          movie.provider === 'tmdb'
                            ? 'pointer'
                            : 'default',
                        position: 'relative',
                        display: 'block',
                      }}
                    >
                      {movie.cover ? (
                        <img
                          src={movie.cover}
                          alt={movie.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            height: '100%',
                            display: 'grid',
                            placeItems: 'center',
                            color: P.textFaint,
                            fontSize: 30,
                          }}
                        >
                          🎬
                        </div>
                      )}

                      {entry.rating !== null && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 8,
                            bottom: 8,
                            background:
                              'rgba(0,0,0,.82)',
                            color: P.gold,
                            padding: '5px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontWeight: 800,
                            fontSize: 10,
                          }}
                        >
                          <Star size={11} weight="fill" />
                          {Number(entry.rating).toFixed(1)}
                        </div>
                      )}
                    </button>

                    <div style={{ padding: 11 }}>
                      <strong
                        style={{
                          display: 'block',
                          color: P.text,
                          fontSize: 12,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {movie.title}
                      </strong>

                      <span
                        style={{
                          display: 'block',
                          color: P.textFaint,
                          fontSize: 9,
                          marginTop: 3,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {[movie.year, movie.genre]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>

                      {tab === 'generale' && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            marginTop: 7,
                          }}
                        >
                          {entry.is_favorite && (
                            <span
                              style={{
                                padding: '3px 5px',
                                background: P.pinkGlow,
                                color: P.pink,
                                border: `1px solid ${P.pink}35`,
                                fontSize: 8,
                                fontWeight: 800,
                              }}
                            >
                              ♥ Preferito
                            </span>
                          )}

                          {entry.in_watchlist && (
                            <span
                              style={{
                                padding: '3px 5px',
                                background: P.goldGlow,
                                color: P.gold,
                                border: `1px solid ${P.gold}35`,
                                fontSize: 8,
                                fontWeight: 800,
                              }}
                            >
                              🔖 Watchlist
                            </span>
                          )}

                          {entry.watched_on && (
                            <span
                              style={{
                                padding: '3px 5px',
                                background: 'rgba(34,197,94,.08)',
                                color: P.success,
                                border: `1px solid ${P.success}35`,
                                fontSize: 8,
                                fontWeight: 800,
                              }}
                            >
                              ✓ Visto
                            </span>
                          )}

                          {(entry.rating !== null || entry.review_text) && (
                            <span
                              style={{
                                padding: '3px 5px',
                                background: P.goldGlow,
                                color: P.gold,
                                border: `1px solid ${P.gold}35`,
                                fontSize: 8,
                                fontWeight: 800,
                              }}
                            >
                              ★ Voto/recensione
                            </span>
                          )}
                        </div>
                      )}

                      {tab === 'visti' &&
                        entry.watched_on && (
                          <span
                            style={{
                              display: 'block',
                              color: P.success,
                              fontSize: 9,
                              fontWeight: 700,
                              marginTop: 6,
                            }}
                          >
                            Visto il{' '}
                            {formatDate(entry.watched_on)}
                          </span>
                        )}

                      {tab === 'recensioni' &&
                        entry.review_text && (
                          <p
                            style={{
                              color: P.textMuted,
                              fontSize: 9,
                              lineHeight: 1.45,
                              margin: '7px 0 0',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient:
                                'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {entry.review_text}
                          </p>
                        )}

                      <div
                        style={{
                          display: 'flex',
                          gap: 5,
                          marginTop: 9,
                        }}
                      >
                        {tab === 'generale' && (
                          <button
                            onClick={() => openMovie(entry)}
                            style={{
                              flex: 1,
                              border: `1px solid ${P.border}`,
                              background: P.bgSoft,
                              color: P.textMuted,
                              padding: '7px 5px',
                              cursor: 'pointer',
                              fontSize: 9,
                              fontWeight: 800,
                            }}
                          >
                            Apri film
                          </button>
                        )}

                        {tab === 'preferiti' && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void patchEntry(entry, {
                                is_favorite: false,
                              })
                            }
                            style={{
                              flex: 1,
                              border: `1px solid ${P.pink}50`,
                              background: P.pinkGlow,
                              color: P.pink,
                              padding: '7px 5px',
                              cursor: busy
                                ? 'wait'
                                : 'pointer',
                              fontSize: 9,
                              fontWeight: 800,
                            }}
                          >
                            <Heart
                              size={12}
                              weight="fill"
                              style={{
                                verticalAlign: -2,
                                marginRight: 4,
                              }}
                            />
                            Rimuovi
                          </button>
                        )}

                        {tab === 'watchlist' && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void patchEntry(entry, {
                                  watched_on:
                                    new Date()
                                      .toISOString()
                                      .slice(0, 10),
                                })
                              }
                              style={{
                                flex: 1,
                                border: `1px solid ${P.success}50`,
                                background:
                                  'rgba(34,197,94,.08)',
                                color: P.success,
                                padding: '7px 5px',
                                cursor: busy
                                  ? 'wait'
                                  : 'pointer',
                                fontSize: 9,
                                fontWeight: 800,
                              }}
                            >
                              <CheckCircle
                                size={12}
                                weight="fill"
                                style={{
                                  verticalAlign: -2,
                                  marginRight: 4,
                                }}
                              />
                              Visto
                            </button>

                            <button
                              disabled={busy}
                              onClick={() =>
                                void patchEntry(entry, {
                                  in_watchlist: false,
                                })
                              }
                              aria-label="Rimuovi dalla watchlist"
                              style={{
                                width: 34,
                                border: `1px solid ${P.border}`,
                                background: P.bgSoft,
                                color: P.textFaint,
                                cursor: busy
                                  ? 'wait'
                                  : 'pointer',
                              }}
                            >
                              <X size={13} />
                            </button>
                          </>
                        )}

                        {tab === 'visti' && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void patchEntry(entry, {
                                watched_on: null,
                              })
                            }
                            style={{
                              flex: 1,
                              border: `1px solid ${P.border}`,
                              background: P.bgSoft,
                              color: P.textMuted,
                              padding: '7px 5px',
                              cursor: busy
                                ? 'wait'
                                : 'pointer',
                              fontSize: 9,
                              fontWeight: 800,
                            }}
                          >
                            Non visto
                          </button>
                        )}

                        {tab === 'recensioni' && (
                          <button
                            onClick={() => openMovie(entry)}
                            style={{
                              flex: 1,
                              border: `1px solid ${P.gold}55`,
                              background: P.goldGlow,
                              color: P.gold,
                              padding: '7px 5px',
                              cursor: 'pointer',
                              fontSize: 9,
                              fontWeight: 800,
                            }}
                          >
                            Modifica
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <style jsx global>{`
          .library-grid {
            display: grid;
            grid-template-columns:
              repeat(auto-fill,minmax(150px,1fr));
            gap: 14px;
          }

          .library-card {
            transition:
              transform .18s ease,
              border-color .18s ease;
          }

          .library-card:hover {
            transform: translateY(-3px);
            border-color: ${P.gold}55 !important;
          }

          @media (max-width: 720px) {
            .library-tabs {
              grid-template-columns:
                repeat(2,minmax(0,1fr)) !important;
            }

            .library-tabs > button:first-child {
              grid-column: 1 / -1;
            }

            .library-toolbar {
              align-items: stretch !important;
              flex-direction: column;
            }

            .library-grid {
              grid-template-columns:
                repeat(2,minmax(0,1fr));
              gap: 10px;
            }
          }

          @media (max-width: 380px) {
            .library-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}