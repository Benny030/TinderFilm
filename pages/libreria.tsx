'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { FONT, THEME } from '@/styles/token';
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
  const P = theme === 'dark' ? THEME.dark : THEME.light;
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
      void router.replace('/auth');
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
      void router.push(`/film/${movie.provider_movie_id}`);
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
          fontFamily: FONT.sans,
        }}
      >
        <FilmSlate size={42} color={P.primary} weight="duotone" />
      </div>
    );
  }

  const tabs: {
    id: Tab;
    label: string;
    description: string;
    icon: typeof Heart;
    tone: 'neutral' | 'pink' | 'gold' | 'green';
  }[] = [
    {
      id: 'generale',
      label: 'Tutto',
      description: 'La tua raccolta',
      icon: FilmSlate,
      tone: 'neutral',
    },
    {
      id: 'preferiti',
      label: 'Preferiti',
      description: 'Quelli che ami',
      icon: Heart,
      tone: 'pink',
    },
    {
      id: 'watchlist',
      label: 'Watchlist',
      description: 'Da vedere',
      icon: BookmarkSimple,
      tone: 'gold',
    },
    {
      id: 'visti',
      label: 'Visti',
      description: 'Già guardati',
      icon: Eye,
      tone: 'green',
    },
    {
      id: 'recensioni',
      label: 'Recensioni',
      description: 'Voti e opinioni',
      icon: Star,
      tone: 'gold',
    },
  ];

  return (
    <AppShell activeNav="libreria">
      <main
        className="cdr-library"
        style={
          {
            '--cdr-library-bg': P.bg,
            '--cdr-library-soft': P.bgSoft,
            '--cdr-library-surface': P.surface,
            '--cdr-library-hover': P.surfaceHover,
            '--cdr-library-border': P.border,
            '--cdr-library-text': P.text,
            '--cdr-library-muted': P.textMuted,
            '--cdr-library-faint': P.textFaint,
            '--cdr-library-pink': P.primary,
            '--cdr-library-pink-deep': P.primaryDeep,
            '--cdr-library-pink-glow': P.primaryGlow,
            '--cdr-library-gold': P.accent,
            '--cdr-library-gold-soft': P.accentSoft,
            '--cdr-library-gold-glow': P.accentGlow,
          } as React.CSSProperties
        }
      >
        <div className="cdr-library-shell">
          <header className="cdr-library-header">
            <div>
              <div className="cdr-library-kicker">
                <FilmSlate size={15} weight="fill" />
                La tua raccolta
              </div>

              <h1>Libreria</h1>
              <p>
                Film che hai salvato, visto, votato o recensito.
                Tutto in un posto, senza dover cercare ogni volta.
              </p>
            </div>

            <div className="cdr-library-total">
              <span>Totale</span>
              <strong>{counts.generale}</strong>
              <small>film nella tua libreria</small>
            </div>
          </header>

          <section className="cdr-library-tabs" aria-label="Sezioni libreria">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  data-active={active ? 'true' : 'false'}
                  data-tone={item.tone}
                  onClick={() => changeTab(item.id)}
                >
                  <Icon
                    size={19}
                    weight={active ? 'fill' : 'regular'}
                  />

                  <span className="cdr-library-tab-copy">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>

                  <span className="cdr-library-tab-count">
                    {counts[item.id]}
                  </span>
                </button>
              );
            })}
          </section>

          <section className="cdr-library-toolbar">
            <label className="cdr-library-search">
              <MagnifyingGlass size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cerca per titolo, genere, anno o recensione..."
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Pulisci ricerca"
                >
                  <X size={14} />
                </button>
              )}
            </label>

            <label className="cdr-library-sort">
              <SortAscending size={16} />
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as SortMode)
                }
              >
                <option value="recenti">Più recenti</option>
                <option value="titolo">Titolo</option>
                <option value="anno">Anno</option>
              </select>
            </label>
          </section>

          {error && (
            <div className="cdr-library-error">
              {error}
            </div>
          )}

          {loadingEntries ? (
            <div className="cdr-library-state">
              <FilmSlate size={28} weight="duotone" />
              <strong>Sto caricando la tua libreria</strong>
              <span>Un attimo...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="cdr-library-state">
              {tab === 'generale' && <FilmSlate size={28} />}
              {tab === 'preferiti' && <Heart size={28} />}
              {tab === 'watchlist' && <BookmarkSimple size={28} />}
              {tab === 'visti' && <Eye size={28} />}
              {tab === 'recensioni' && <Star size={28} />}

              <strong>
                {search ? 'Nessun risultato' : 'Ancora nessun film qui'}
              </strong>

              <span>
                {search
                  ? 'Prova con un altro titolo, genere o anno.'
                  : 'Apri la scheda di un film e aggiungilo alla tua raccolta.'}
              </span>
            </div>
          ) : (
            <>
              <div className="cdr-library-results-head">
                <div>
                  <strong>
                    {tabs.find((item) => item.id === tab)?.label}
                  </strong>
                  <span>
                    {filteredEntries.length}{' '}
                    {filteredEntries.length === 1 ? 'film' : 'film'}
                  </span>
                </div>
              </div>

              <div className="cdr-library-grid">
                {filteredEntries.map((entry) => {
                  const movie = getMovie(entry);
                  if (!movie) return null;

                  const busy = busyId === entry.id;

                  return (
                    <article
                      key={entry.id}
                      className="cdr-library-card"
                    >
                      <button
                        type="button"
                        className="cdr-library-poster"
                        onClick={() => openMovie(entry)}
                        disabled={movie.provider !== 'tmdb'}
                        aria-label={`Apri ${movie.title}`}
                      >
                        {movie.cover ? (
                          <img src={movie.cover} alt={movie.title} />
                        ) : (
                          <span className="cdr-library-poster-empty">
                            <FilmSlate size={34} />
                          </span>
                        )}

                        {entry.rating !== null && (
                          <span className="cdr-library-rating">
                            <Star size={12} weight="fill" />
                            {Number(entry.rating).toFixed(1)}
                          </span>
                        )}

                        <span className="cdr-library-poster-open">
                          Apri scheda
                        </span>
                      </button>

                      <div className="cdr-library-card-copy">
                        <div className="cdr-library-title-row">
                          <div>
                            <h2>{movie.title}</h2>
                            <p>
                              {[movie.year, movie.genre]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                        </div>

                        {tab === 'generale' && (
                          <div className="cdr-library-flags">
                            {entry.is_favorite && (
                              <span data-tone="pink">
                                <Heart size={12} weight="fill" />
                                Preferito
                              </span>
                            )}

                            {entry.in_watchlist && (
                              <span data-tone="gold">
                                <BookmarkSimple size={12} weight="fill" />
                                Watchlist
                              </span>
                            )}

                            {entry.watched_on && (
                              <span data-tone="green">
                                <CheckCircle size={12} weight="fill" />
                                Visto
                              </span>
                            )}

                            {(entry.rating !== null || entry.review_text) && (
                              <span data-tone="gold">
                                <Star size={12} weight="fill" />
                                Recensione
                              </span>
                            )}
                          </div>
                        )}

                        {tab === 'visti' && entry.watched_on && (
                          <div className="cdr-library-date">
                            <CheckCircle size={13} weight="fill" />
                            Visto il {formatDate(entry.watched_on)}
                          </div>
                        )}

                        {tab === 'recensioni' && entry.review_text && (
                          <p className="cdr-library-review">
                            {entry.review_text}
                          </p>
                        )}

                        <div className="cdr-library-actions">
                          {tab === 'generale' && (
                            <button
                              type="button"
                              onClick={() => openMovie(entry)}
                            >
                              Apri film
                            </button>
                          )}

                          {tab === 'preferiti' && (
                            <button
                              type="button"
                              data-tone="pink"
                              disabled={busy}
                              onClick={() =>
                                void patchEntry(entry, {
                                  is_favorite: false,
                                })
                              }
                            >
                              <Heart size={14} weight="fill" />
                              Rimuovi dai preferiti
                            </button>
                          )}

                          {tab === 'watchlist' && (
                            <>
                              <button
                                type="button"
                                data-tone="green"
                                disabled={busy}
                                onClick={() =>
                                  void patchEntry(entry, {
                                    watched_on: new Date()
                                      .toISOString()
                                      .slice(0, 10),
                                  })
                                }
                              >
                                <CheckCircle size={14} weight="fill" />
                                Segna come visto
                              </button>

                              <button
                                type="button"
                                className="cdr-library-icon-action"
                                disabled={busy}
                                onClick={() =>
                                  void patchEntry(entry, {
                                    in_watchlist: false,
                                  })
                                }
                                aria-label="Rimuovi dalla watchlist"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}

                          {tab === 'visti' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void patchEntry(entry, {
                                  watched_on: null,
                                })
                              }
                            >
                              Non più visto
                            </button>
                          )}

                          {tab === 'recensioni' && (
                            <button
                              type="button"
                              data-tone="gold"
                              onClick={() => openMovie(entry)}
                            >
                              <Star size={14} weight="fill" />
                              Modifica recensione
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <style jsx global>{`
          .cdr-library {
            min-height:100vh;
            background:var(--cdr-library-bg);
            color:var(--cdr-library-text);
            font-family:${FONT.sans};
            padding:30px 22px 88px;
          }

          .cdr-library-shell {
            width:min(1180px,100%);
            margin:0 auto;
          }

          .cdr-library-header {
            display:grid;
            grid-template-columns:minmax(0,1fr) 190px;
            gap:24px;
            align-items:end;
            margin-bottom:24px;
          }

          .cdr-library-kicker {
            display:flex;
            align-items:center;
            gap:8px;
            color:var(--cdr-library-gold);
            font-size:12px;
            font-weight:850;
            letter-spacing:.04em;
          }

          .cdr-library-header h1 {
            margin:8px 0 7px;
            font-family:${FONT.display};
            font-size:clamp(34px,5vw,52px);
            line-height:1;
            letter-spacing:-.025em;
          }

          .cdr-library-header p {
            max-width:620px;
            margin:0;
            color:var(--cdr-library-muted);
            font-size:15px;
            line-height:1.6;
          }

          .cdr-library-total {
            border-top:1px solid var(--cdr-library-border);
            padding-top:10px;
          }

          .cdr-library-total span,
          .cdr-library-total small {
            display:block;
            color:var(--cdr-library-faint);
            font-size:11px;
          }

          .cdr-library-total strong {
            display:block;
            margin:2px 0;
            font-family:${FONT.display};
            font-size:32px;
            line-height:1;
          }

          .cdr-library-tabs {
            display:grid;
            grid-template-columns:repeat(5,minmax(0,1fr));
            gap:8px;
            margin-bottom:14px;
          }

          .cdr-library-tabs > button {
            min-height:76px;
            display:grid;
            grid-template-columns:22px minmax(0,1fr) auto;
            gap:10px;
            align-items:center;
            padding:12px;
            border:1px solid var(--cdr-library-border);
            background:var(--cdr-library-surface);
            color:var(--cdr-library-muted);
            text-align:left;
            cursor:pointer;
            transition:border-color .16s ease, background .16s ease, transform .16s ease;
          }

          .cdr-library-tabs > button:hover {
            transform:translateY(-1px);
            border-color:var(--cdr-library-gold);
          }

          .cdr-library-tabs > button[data-active="true"] {
            border-color:var(--cdr-library-text);
            background:var(--cdr-library-soft);
            color:var(--cdr-library-text);
          }

          .cdr-library-tabs > button[data-active="true"][data-tone="pink"] {
            border-color:var(--cdr-library-pink);
            background:var(--cdr-library-pink-glow);
            color:var(--cdr-library-pink);
          }

          .cdr-library-tabs > button[data-active="true"][data-tone="gold"] {
            border-color:var(--cdr-library-gold);
            background:var(--cdr-library-gold-glow);
            color:var(--cdr-library-gold);
          }

          .cdr-library-tabs > button[data-active="true"][data-tone="green"] {
            border-color:#22c55e;
            background:rgba(34,197,94,.08);
            color:#22c55e;
          }

          .cdr-library-tab-copy {
            min-width:0;
          }

          .cdr-library-tab-copy strong,
          .cdr-library-tab-copy small {
            display:block;
          }

          .cdr-library-tab-copy strong {
            color:inherit;
            font-size:13px;
            line-height:1.2;
          }

          .cdr-library-tab-copy small {
            margin-top:3px;
            color:var(--cdr-library-faint);
            font-size:10px;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          }

          .cdr-library-tab-count {
            min-width:25px;
            text-align:right;
            color:var(--cdr-library-faint);
            font-size:11px;
            font-weight:850;
          }

          .cdr-library-toolbar {
            display:grid;
            grid-template-columns:minmax(0,1fr) 190px;
            gap:8px;
            margin-bottom:22px;
          }

          .cdr-library-search,
          .cdr-library-sort {
            min-height:46px;
            display:flex;
            align-items:center;
            border:1px solid var(--cdr-library-border);
            background:var(--cdr-library-soft);
            color:var(--cdr-library-faint);
          }

          .cdr-library-search {
            padding:0 12px;
          }

          .cdr-library-search input {
            min-width:0;
            flex:1;
            height:44px;
            padding:0 10px;
            border:0;
            outline:0;
            background:transparent;
            color:var(--cdr-library-text);
            font:inherit;
            font-size:13px;
          }

          .cdr-library-search button {
            width:30px;
            height:30px;
            display:grid;
            place-items:center;
            border:0;
            background:transparent;
            color:var(--cdr-library-faint);
            cursor:pointer;
          }

          .cdr-library-sort {
            padding-left:12px;
          }

          .cdr-library-sort select {
            flex:1;
            height:44px;
            border:0;
            outline:0;
            background:transparent;
            color:var(--cdr-library-muted);
            padding:0 10px;
            font:inherit;
            font-size:12px;
            cursor:pointer;
          }

          .cdr-library-error {
            margin-bottom:16px;
            padding:11px 13px;
            border:1px solid rgba(239,68,68,.35);
            background:rgba(239,68,68,.08);
            color:#ef4444;
            font-size:12px;
          }

          .cdr-library-state {
            min-height:260px;
            display:grid;
            place-items:center;
            align-content:center;
            gap:8px;
            border:1px solid var(--cdr-library-border);
            background:var(--cdr-library-surface);
            color:var(--cdr-library-faint);
            text-align:center;
            padding:34px;
          }

          .cdr-library-state strong {
            margin-top:3px;
            color:var(--cdr-library-text);
            font-family:${FONT.display};
            font-size:20px;
          }

          .cdr-library-state span {
            max-width:420px;
            font-size:12px;
            line-height:1.5;
          }

          .cdr-library-results-head {
            display:flex;
            align-items:end;
            justify-content:space-between;
            margin-bottom:12px;
          }

          .cdr-library-results-head strong,
          .cdr-library-results-head span {
            display:block;
          }

          .cdr-library-results-head strong {
            font-family:${FONT.display};
            font-size:22px;
          }

          .cdr-library-results-head span {
            margin-top:2px;
            color:var(--cdr-library-faint);
            font-size:11px;
          }

          .cdr-library-grid {
            display:grid;
            grid-template-columns:repeat(5,minmax(0,1fr));
            gap:14px;
          }

          .cdr-library-card {
            min-width:0;
            overflow:hidden;
            border:1px solid var(--cdr-library-border);
            background:var(--cdr-library-surface);
            transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
          }

          .cdr-library-card:hover {
            transform:translateY(-3px);
            border-color:var(--cdr-library-gold);
            box-shadow:0 10px 24px rgba(0,0,0,.08);
          }

          .cdr-library-poster {
            width:100%;
            aspect-ratio:2/3;
            position:relative;
            display:block;
            overflow:hidden;
            border:0;
            padding:0;
            background:var(--cdr-library-soft);
            cursor:pointer;
          }

          .cdr-library-poster:disabled {
            cursor:default;
          }

          .cdr-library-poster img {
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
            transition:transform .3s ease;
          }

          .cdr-library-card:hover .cdr-library-poster img {
            transform:scale(1.02);
          }

          .cdr-library-poster-empty {
            width:100%;
            height:100%;
            display:grid;
            place-items:center;
            color:var(--cdr-library-faint);
          }

          .cdr-library-rating {
            position:absolute;
            left:8px;
            bottom:8px;
            display:flex;
            align-items:center;
            gap:4px;
            padding:5px 7px;
            background:rgba(0,0,0,.82);
            color:#f5b92f;
            font-size:10px;
            font-weight:900;
          }

          .cdr-library-poster-open {
            position:absolute;
            inset:auto 8px 8px auto;
            padding:5px 7px;
            background:rgba(0,0,0,.74);
            color:#fff;
            font-size:9px;
            font-weight:800;
            opacity:0;
            transform:translateY(3px);
            transition:opacity .16s ease, transform .16s ease;
          }

          .cdr-library-card:hover .cdr-library-poster-open {
            opacity:1;
            transform:translateY(0);
          }

          .cdr-library-card-copy {
            padding:12px;
          }

          .cdr-library-title-row h2 {
            margin:0;
            font-family:${FONT.display};
            font-size:15px;
            line-height:1.25;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          }

          .cdr-library-title-row p {
            margin:4px 0 0;
            color:var(--cdr-library-faint);
            font-size:10px;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          }

          .cdr-library-flags {
            display:flex;
            flex-wrap:wrap;
            gap:5px;
            margin-top:9px;
          }

          .cdr-library-flags span {
            display:inline-flex;
            align-items:center;
            gap:4px;
            padding:3px 5px;
            border:1px solid var(--cdr-library-border);
            color:var(--cdr-library-muted);
            font-size:8px;
            font-weight:800;
          }

          .cdr-library-flags span[data-tone="pink"] {
            border-color:color-mix(in srgb, var(--cdr-library-pink) 35%, transparent);
            background:var(--cdr-library-pink-glow);
            color:var(--cdr-library-pink);
          }

          .cdr-library-flags span[data-tone="gold"] {
            border-color:color-mix(in srgb, var(--cdr-library-gold) 35%, transparent);
            background:var(--cdr-library-gold-glow);
            color:var(--cdr-library-gold);
          }

          .cdr-library-flags span[data-tone="green"] {
            border-color:rgba(34,197,94,.35);
            background:rgba(34,197,94,.08);
            color:#22c55e;
          }

          .cdr-library-date {
            display:flex;
            align-items:center;
            gap:5px;
            margin-top:8px;
            color:#22c55e;
            font-size:10px;
            font-weight:750;
          }

          .cdr-library-review {
            margin:9px 0 0;
            padding-left:9px;
            border-left:2px solid var(--cdr-library-gold);
            color:var(--cdr-library-muted);
            font-size:10.5px;
            line-height:1.5;
            display:-webkit-box;
            -webkit-line-clamp:4;
            -webkit-box-orient:vertical;
            overflow:hidden;
          }

          .cdr-library-actions {
            display:flex;
            gap:6px;
            margin-top:11px;
          }

          .cdr-library-actions button {
            min-height:34px;
            flex:1;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:5px;
            border:1px solid var(--cdr-library-border);
            background:var(--cdr-library-soft);
            color:var(--cdr-library-muted);
            font:inherit;
            font-size:9px;
            font-weight:850;
            cursor:pointer;
          }

          .cdr-library-actions button[data-tone="pink"] {
            border-color:color-mix(in srgb, var(--cdr-library-pink) 45%, transparent);
            background:var(--cdr-library-pink-glow);
            color:var(--cdr-library-pink);
          }

          .cdr-library-actions button[data-tone="gold"] {
            border-color:color-mix(in srgb, var(--cdr-library-gold) 45%, transparent);
            background:var(--cdr-library-gold-glow);
            color:var(--cdr-library-gold);
          }

          .cdr-library-actions button[data-tone="green"] {
            border-color:rgba(34,197,94,.4);
            background:rgba(34,197,94,.08);
            color:#22c55e;
          }

          .cdr-library-actions button:disabled {
            opacity:.55;
            cursor:wait;
          }

          .cdr-library-actions .cdr-library-icon-action {
            flex:0 0 36px;
          }

          @media (max-width:1020px) {
            .cdr-library-grid {
              grid-template-columns:repeat(4,minmax(0,1fr));
            }
          }

          @media (max-width:820px) {
            .cdr-library-tabs {
              grid-template-columns:repeat(3,minmax(0,1fr));
            }

            .cdr-library-grid {
              grid-template-columns:repeat(3,minmax(0,1fr));
            }
          }

          @media (max-width:640px) {
            .cdr-library {
              padding:22px 14px 88px;
            }

            .cdr-library-header {
              grid-template-columns:1fr;
              gap:14px;
              margin-bottom:18px;
            }

            .cdr-library-header h1 {
              font-size:36px;
            }

            .cdr-library-header p {
              font-size:13px;
              line-height:1.55;
            }

            .cdr-library-total {
              display:grid;
              grid-template-columns:auto auto 1fr;
              gap:8px;
              align-items:baseline;
              padding-top:9px;
            }

            .cdr-library-total strong {
              font-size:24px;
            }

            .cdr-library-total small {
              text-align:right;
            }

            .cdr-library-tabs {
              grid-template-columns:repeat(2,minmax(0,1fr));
            }

            .cdr-library-tabs > button:first-child {
              grid-column:1 / -1;
            }

            .cdr-library-toolbar {
              grid-template-columns:1fr;
            }

            .cdr-library-grid {
              grid-template-columns:repeat(2,minmax(0,1fr));
              gap:10px;
            }

            .cdr-library-card-copy {
              padding:10px;
            }

            .cdr-library-title-row h2 {
              font-size:14px;
            }

            .cdr-library-review {
              font-size:10px;
            }
          }

          @media (max-width:430px) {
            .cdr-library {
              padding-inline:12px;
            }

            .cdr-library-tabs > button {
              min-height:68px;
              padding:10px;
            }

            .cdr-library-tab-copy small {
              display:none;
            }

            .cdr-library-grid {
              gap:8px;
            }

            .cdr-library-actions button {
              min-height:32px;
              font-size:8.5px;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}
