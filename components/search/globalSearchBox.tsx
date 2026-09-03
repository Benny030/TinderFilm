"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { FilmSlate, MagnifyingGlass, User, X } from '@phosphor-icons/react';
import { useTheme } from '@/context/ThemeContext';

type MovieResult = {
  tmdb_id: number;
  title: string;
  year: number | null;
  cover: string | null;
};

type PersonResult = {
  tmdb_id: number;
  name: string;
  photo: string | null;
  known_for_department: string;
};

type Props = {
  variant?: 'hero' | 'compact';
  autoFocus?: boolean;
};

const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  border: '#2d221c',
  gold: '#f5b92f',
  pink: '#ed3d73',
  text: '#f0ebe6',
  muted: '#b5a89e',
  faint: '#7a6b60',
};

const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  border: '#d6cbbc',
  gold: '#b8860b',
  pink: '#b83060',
  text: '#1f1a16',
  muted: '#5c5248',
  faint: '#8a7c6e',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";

export default function GlobalSearchBox({
  variant = 'compact',
  autoFocus = false,
}: Props) {
  const router = useRouter();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;

  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<MovieResult[]>([]);
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const hero = variant === 'hero';

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('cinedate_recent_searches');
      const parsed = raw ? JSON.parse(raw) : [];
      setRecentSearches(Array.isArray(parsed) ? parsed.slice(0, 5) : []);
    } catch {
      setRecentSearches([]);
    }
  }, []);

  const rememberSearch = (value: string) => {
    const clean = value.trim();
    if (!clean) return;

    const next = [clean, ...recentSearches.filter((item) => item.toLowerCase() !== clean.toLowerCase())]
      .slice(0, 5);

    setRecentSearches(next);

    try {
      window.localStorage.setItem('cinedate_recent_searches', JSON.stringify(next));
    } catch {
      // localStorage non disponibile: la ricerca continua a funzionare.
    }
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    const q = query.trim();

    if (q.length < 2) {
      setMovies([]);
      setPeople([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          q,
          kind: 'all',
          page: '1',
        });

        const response = await fetch(`/api/tmdb/explore?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Ricerca non disponibile');
        }

        setMovies(Array.isArray(data.movies) ? data.movies.slice(0, 5) : []);
        setPeople(Array.isArray(data.people) ? data.people.slice(0, 4) : []);
        setOpen(true);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setMovies([]);
          setPeople([]);
        }
      } finally {
        setLoading(false);
      }
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const combinedResults = [
    ...movies.map((movie) => ({
      type: 'movie' as const,
      id: movie.tmdb_id,
    })),
    ...people.map((person) => ({
      type: 'person' as const,
      id: person.tmdb_id,
    })),
  ];

  const openResult = (index: number) => {
    const item = combinedResults[index];
    if (!item) return;

    rememberSearch(item.type === 'movie'
      ? movies.find((movie) => movie.tmdb_id === item.id)?.title ?? query
      : people.find((person) => person.tmdb_id === item.id)?.name ?? query
    );
    setOpen(false);

    if (item.type === 'movie') {
      router.push(`/film/${item.id}`);
    } else {
      router.push(`/persona/${item.id}`);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!open || combinedResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) =>
        current >= combinedResults.length - 1 ? 0 : current + 1
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? combinedResults.length - 1 : current - 1
      );
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      openResult(activeIndex);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = query.trim();

    if (q) rememberSearch(q);
    setOpen(false);

    if (!q) {
      router.push('/esplora');
      return;
    }

    router.push(`/esplora?q=${encodeURIComponent(q)}`);
  };

  const roleLabel = (department: string) => {
    if (department === 'Directing') return 'Regia';
    if (department === 'Acting') return 'Recitazione';
    if (department === 'Writing') return 'Sceneggiatura';
    return department || 'Cinema';
  };

  const hasResults = movies.length > 0 || people.length > 0;
  const showPanel = open && (query.trim().length >= 2 || recentSearches.length > 0);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <form
        onSubmit={submit}
        style={{
          display: 'grid',
          gridTemplateColumns: hero ? '1fr auto' : '1fr',
          gap: 8,
        }}
      >
        <div
          style={{
            height: hero ? 48 : 40,
            border: `1px solid ${showPanel ? P.gold : P.border}`,
            background: hero ? P.bg : P.card,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: hero ? '0 12px' : '0 10px',
            boxShadow: showPanel ? `0 0 0 3px ${P.gold}16` : 'none',
          }}
        >
          <MagnifyingGlass size={hero ? 18 : 16} color={P.gold} />
          <input
            autoFocus={autoFocus}
            value={query}
            onFocus={() => {
              if (query.trim().length >= 2 || recentSearches.length > 0) setOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder="Film, attore o regista..."
            aria-label="Cerca film, attori o registi"
            style={{
              width: '100%',
              minWidth: 0,
              border: 0,
              outline: 0,
              background: 'transparent',
              color: P.text,
              fontFamily: FONT,
              fontSize: hero ? 13 : 11.5,
              fontWeight: 650,
            }}
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setOpen(false);
              }}
              aria-label="Pulisci ricerca"
              style={{
                border: 0,
                background: 'transparent',
                color: P.faint,
                padding: 2,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {hero && (
          <button
            type="submit"
            style={{
              minWidth: 92,
              border: 0,
              background: P.gold,
              color: '#160f04',
              padding: '0 15px',
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Cerca
          </button>
        )}
      </form>

      {showPanel && (
        <div
          style={{
            position: 'absolute',
            zIndex: 150,
            top: hero ? 55 : 47,
            left: 0,
            right: 0,
            border: `1px solid ${P.border}`,
            background: P.card,
            boxShadow: '0 18px 45px rgba(0,0,0,.28)',
            maxHeight: hero ? 430 : 390,
            overflowY: 'auto',
          }}
        >
          {!query.trim() && recentSearches.length > 0 ? (
            <div>
              <div style={{
                padding:'10px 11px 6px',
                color:P.faint,
                fontSize:8.5,
                fontWeight:900,
                textTransform:'uppercase',
                letterSpacing:'.11em',
                fontFamily:FONT,
              }}>
                Ricerche recenti
              </div>
              {recentSearches.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    setOpen(true);
                  }}
                  style={{
                    width:'100%',
                    border:0,
                    borderTop:`1px solid ${P.border}`,
                    background:'transparent',
                    color:P.text,
                    padding:'10px 11px',
                    textAlign:'left',
                    cursor:'pointer',
                    fontFamily:FONT,
                    fontSize:11,
                    fontWeight:750,
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : loading ? (
            <div
              style={{
                padding: 14,
                color: P.muted,
                fontFamily: FONT,
                fontSize: 11,
              }}
            >
              Sto cercando…
            </div>
          ) : !hasResults ? (
            <div
              style={{
                padding: 14,
                color: P.muted,
                fontFamily: FONT,
                fontSize: 11,
              }}
            >
              Nessun risultato per “{query.trim()}”
            </div>
          ) : (
            <>
              {movies.length > 0 && (
                <div>
                  <div
                    style={{
                      padding: '9px 11px 6px',
                      color: P.faint,
                      fontSize: 8.5,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.11em',
                      fontFamily: FONT,
                    }}
                  >
                    Film
                  </div>

                  {movies.map((movie) => (
                    <button
                      key={`movie-${movie.tmdb_id}`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/film/${movie.tmdb_id}`);
                      }}
                      style={{
                        width: '100%',
                        border: 0,
                        borderTop: `1px solid ${P.border}`,
                        background: 'transparent',
                        color: P.text,
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 48,
                          flexShrink: 0,
                          background: P.bgSoft,
                          overflow: 'hidden',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {movie.cover ? (
                          <img
                            src={movie.cover}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <FilmSlate size={17} color={P.faint} />
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 850,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {movie.title}
                        </div>
                        <div style={{ color: P.faint, fontSize: 9.5, marginTop: 3 }}>
                          {movie.year || 'Anno n/d'} · Film
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {people.length > 0 && (
                <div>
                  <div
                    style={{
                      padding: '10px 11px 6px',
                      color: P.faint,
                      fontSize: 8.5,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.11em',
                      fontFamily: FONT,
                    }}
                  >
                    Persone
                  </div>

                  {people.map((person) => (
                    <button
                      key={`person-${person.tmdb_id}`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/persona/${person.tmdb_id}`);
                      }}
                      style={{
                        width: '100%',
                        border: 0,
                        borderTop: `1px solid ${P.border}`,
                        background: 'transparent',
                        color: P.text,
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: P.bgSoft,
                          overflow: 'hidden',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {person.photo ? (
                          <img
                            src={person.photo}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <User size={17} color={P.faint} />
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 850,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {person.name}
                        </div>
                        <div style={{ color: P.pink, fontSize: 9.5, marginTop: 3, fontWeight: 750 }}>
                          {roleLabel(person.known_for_department)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const q = query.trim();
                  setOpen(false);
                  router.push(`/esplora?q=${encodeURIComponent(q)}`);
                }}
                style={{
                  width: '100%',
                  border: 0,
                  borderTop: `1px solid ${P.border}`,
                  background: P.bgSoft,
                  color: P.gold,
                  padding: '10px 12px',
                  fontFamily: FONT,
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Vedi tutti i risultati →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
