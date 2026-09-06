'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  CalendarBlank,
  FilmSlate,
  FunnelSimple,
  MagnifyingGlass,
  MapPin,
  Star,
  UserCircle,
  X,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import BackButton from '@/components/ui/BackButton';
import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) =>
      setMatches(event.matches);

    media.addEventListener('change', listener);

    return () =>
      media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

type ActorMovie = {
  tmdb_id: number;
  title: string;
  character: string;
  year: number;
  rating: number;
  cover: string | null;
};

type ActorDetail = {
  id: number;
  name: string;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  known_for: string | null;
  profile: string | null;
  movies: ActorMovie[];
};

type SortMode =
  | 'popular'
  | 'recent'
  | 'oldest'
  | 'rating';

const fallbackPoster =
  'https://placehold.co/342x513/F4EEE6/6E6258?text=Film';

export default function ActorDetailPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const T = theme === 'dark' ? THEME.dark : THEME.light;

  const isMobile = useMediaQuery('(max-width: 640px)');

  const [actor, setActor] = useState<ActorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const MOVIES_PER_PAGE = 12;

  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] =
    useState<SortMode>('popular');
  const [selectedDecade, setSelectedDecade] =
    useState<string>('all');
  const [onlyWithCharacter, setOnlyWithCharacter] =
    useState(false);

  const actorId =
    typeof router.query.id === 'string'
      ? router.query.id
      : null;

  useEffect(() => {
    if (!actorId) return;

    const loadActor = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/tmdb/person/${actorId}`
        );

        if (!response.ok) {
          throw new Error('Attore non trovato');
        }

        const data = await response.json();

        setActor(data);
        setCurrentPage(1);
        setSearch('');
        setSortMode('popular');
        setSelectedDecade('all');
        setOnlyWithCharacter(false);
      } catch (error) {
        console.error(error);
        setActor(null);
      } finally {
        setLoading(false);
      }
    };

    void loadActor();
  }, [actorId]);

  const formatDate = (value: string | null) => {
    if (!value) return null;

    const date = new Date(`${value}T00:00:00`);

    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const decades = useMemo(() => {
    if (!actor) return [];

    const values = actor.movies
      .map((movie) => movie.year)
      .filter((year) => year > 0)
      .map((year) => Math.floor(year / 10) * 10);

    return Array.from(new Set(values)).sort(
      (a, b) => b - a
    );
  }, [actor]);

  const filteredMovies = useMemo(() => {
    if (!actor) return [];

    let movies = [...actor.movies];

    const cleanSearch = search.trim().toLowerCase();

    if (cleanSearch) {
      movies = movies.filter((movie) =>
        movie.title.toLowerCase().includes(cleanSearch)
      );
    }

    if (selectedDecade !== 'all') {
      const decade = Number(selectedDecade);

      movies = movies.filter(
        (movie) =>
          movie.year >= decade &&
          movie.year <= decade + 9
      );
    }

    if (onlyWithCharacter) {
      movies = movies.filter((movie) =>
        movie.character?.trim()
      );
    }

    switch (sortMode) {
      case 'recent':
        movies.sort(
          (a, b) =>
            (b.year || 0) - (a.year || 0)
        );
        break;

      case 'oldest':
        movies.sort((a, b) => {
          const yearA = a.year || 9999;
          const yearB = b.year || 9999;
          return yearA - yearB;
        });
        break;

      case 'rating':
        movies.sort(
          (a, b) =>
            (b.rating || 0) - (a.rating || 0)
        );
        break;

      case 'popular':
      default:
        break;
    }

    return movies;
  }, [
    actor,
    search,
    selectedDecade,
    onlyWithCharacter,
    sortMode,
  ]);

  const hasActiveFilters =
    search.trim() !== '' ||
    sortMode !== 'popular' ||
    selectedDecade !== 'all' ||
    onlyWithCharacter;

  const resetFilters = () => {
    setSearch('');
    setSortMode('popular');
    setSelectedDecade('all');
    setOnlyWithCharacter(false);
    setCurrentPage(1);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredMovies.length / MOVIES_PER_PAGE
    )
  );

  const startIndex =
    (currentPage - 1) * MOVIES_PER_PAGE;

  const visibleMovies = filteredMovies.slice(
    startIndex,
    startIndex + MOVIES_PER_PAGE
  );

  if (loading) {
    return (
      <AppShell activeNav="home">
        <div
          style={{
            minHeight: '70vh',
            display: 'grid',
            placeItems: 'center',
            background: T.bg,
            color: T.textMuted,
            fontFamily: FONT.sans,
          }}
        >
          <FilmSlate
            size={38}
            color={T.primary}
            weight="duotone"
          />
        </div>
      </AppShell>
    );
  }

  if (!actor) {
    return (
      <AppShell activeNav="home">
        <div
          style={{
            minHeight: '70vh',
            display: 'grid',
            placeItems: 'center',
            background: T.bg,
            color: T.textMuted,
            fontFamily: FONT.sans,
            padding: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <UserCircle
              size={42}
              color={T.textFaint}
              weight="duotone"
            />

            <p
              style={{
                margin: '10px 0 0',
                fontSize: 12,
              }}
            >
              Non siamo riusciti a trovare questa persona.
            </p>

            <button
              type="button"
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  window.history.length > 1
                ) {
                  router.back();
                } else {
                  void router.push('/esplora');
                }
              }}
              style={{
                marginTop: 14,
                border: `1px solid ${T.primary}`,
                background: T.primaryGlow,
                color: T.primary,
                padding: '9px 12px',
                cursor: 'pointer',
                fontWeight: 850,
                fontFamily: FONT.sans,
                fontSize: 10,
              }}
            >
              Torna indietro
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeNav="home">
      <main
        style={{
          minHeight: '100vh',
          background: T.bg,
          color: T.text,
          fontFamily: FONT.sans,
          paddingBottom: 90,
        }}
      >
        <section
          style={{
            borderBottom: `1px solid ${T.border}`,
            background: T.bgSoft,
          }}
        >
          <div
            style={{
              maxWidth: 1060,
              margin: '0 auto',
              padding: isMobile
                ? '18px 16px 30px'
                : '24px 24px 38px',
            }}
          >
            <div
              style={{
                marginBottom: isMobile ? 18 : 24,
              }}
            >
              <BackButton
                onClick={() => {
                  if (
                    typeof window !== 'undefined' &&
                    window.history.length > 1
                  ) {
                    router.back();
                  } else {
                    void router.push('/esplora');
                  }
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile
                  ? '1fr'
                  : '240px minmax(0,1fr)',
                gap: isMobile ? 22 : 38,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  placeItems: isMobile
                    ? 'center'
                    : 'start',
                }}
              >
                {actor.profile ? (
                  <img
                    src={actor.profile}
                    alt={actor.name}
                    style={{
                      width: isMobile ? 170 : 240,
                      height: isMobile ? 220 : 320,
                      objectFit: 'cover',
                      display: 'block',
                      border: `1px solid ${T.border}`,
                      background: T.surface,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: isMobile ? 170 : 240,
                      height: isMobile ? 220 : 320,
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <UserCircle
                      size={isMobile ? 72 : 96}
                      color={T.textFaint}
                      weight="duotone"
                    />
                  </div>
                )}
              </div>

              <div
                style={{
                  textAlign: isMobile
                    ? 'center'
                    : 'left',
                }}
              >
                {actor.known_for && (
                  <div
                    style={{
                      color: T.primary,
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.12em',
                    }}
                  >
                    {actor.known_for}
                  </div>
                )}

                <h1
                  style={{
                    margin: '6px 0 12px',
                    fontFamily: FONT.display,
                    fontSize: isMobile
                      ? 'clamp(32px,10vw,44px)'
                      : 'clamp(44px,5vw,64px)',
                    lineHeight: 1,
                    letterSpacing: '-.03em',
                    color: T.text,
                  }}
                >
                  {actor.name}
                </h1>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: isMobile
                      ? 'center'
                      : 'flex-start',
                    gap: '8px 16px',
                    color: T.textMuted,
                    fontSize: 11,
                  }}
                >
                  {actor.birthday && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <CalendarBlank
                        size={13}
                        color={T.accent}
                      />
                      {formatDate(actor.birthday)}
                    </span>
                  )}

                  {actor.place_of_birth && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <MapPin
                        size={13}
                        color={T.primary}
                      />
                      {actor.place_of_birth}
                    </span>
                  )}

                  {actor.deathday && (
                    <span>
                      † {formatDate(actor.deathday)}
                    </span>
                  )}
                </div>

                {actor.biography && (
                  <p
                    style={{
                      margin: '16px 0 0',
                      color: T.textMuted,
                      fontSize: 12,
                      lineHeight: 1.65,
                      maxWidth: 720,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {actor.biography}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            maxWidth: 1060,
            margin: '0 auto',
            padding: isMobile
              ? '24px 16px 0'
              : '30px 24px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 14,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <div>
              <div
                style={{
                  color: T.accent,
                  fontSize: 9,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '.12em',
                }}
              >
                Filmografia
              </div>

              <h2
                style={{
                  margin: '3px 0 0',
                  fontFamily: FONT.display,
                  fontSize: 26,
                }}
              >
                Film
              </h2>
            </div>

            <div
              style={{
                color: T.textFaint,
                fontSize: 9.5,
              }}
            >
              {filteredMovies.length} risultati
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: 12,
              marginBottom: 16,
              display: 'grid',
              gridTemplateColumns: isMobile
                ? '1fr'
                : 'minmax(220px,1.4fr) repeat(3,minmax(140px,.7fr)) auto',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
              }}
            >
              <MagnifyingGlass
                size={14}
                color={T.textFaint}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cerca nella filmografia"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1px solid ${T.border}`,
                  background: T.bg,
                  color: T.text,
                  padding: '9px 30px 9px 31px',
                  fontFamily: FONT.sans,
                  fontSize: 10,
                  outline: 'none',
                }}
              />

              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCurrentPage(1);
                  }}
                  aria-label="Cancella ricerca"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 0,
                    background: 'transparent',
                    color: T.textFaint,
                    padding: 0,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <select
              value={sortMode}
              onChange={(event) => {
                setSortMode(
                  event.target.value as SortMode
                );
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                border: `1px solid ${T.border}`,
                background: T.bg,
                color: T.textMuted,
                padding: '9px 10px',
                fontFamily: FONT.sans,
                fontSize: 10,
                outline: 'none',
              }}
            >
              <option value="popular">
                Popolarità
              </option>
              <option value="recent">
                Più recenti
              </option>
              <option value="oldest">
                Più vecchi
              </option>
              <option value="rating">
                Voto più alto
              </option>
            </select>

            <select
              value={selectedDecade}
              onChange={(event) => {
                setSelectedDecade(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                border: `1px solid ${T.border}`,
                background: T.bg,
                color: T.textMuted,
                padding: '9px 10px',
                fontFamily: FONT.sans,
                fontSize: 10,
                outline: 'none',
              }}
            >
              <option value="all">
                Tutti gli anni
              </option>

              {decades.map((decade) => (
                <option
                  key={decade}
                  value={decade}
                >
                  Anni {decade}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setOnlyWithCharacter(
                  (current) => !current
                );
                setCurrentPage(1);
              }}
              style={{
                border: `1px solid ${
                  onlyWithCharacter
                    ? T.primary
                    : T.border
                }`,
                background: onlyWithCharacter
                  ? T.primaryGlow
                  : T.bg,
                color: onlyWithCharacter
                  ? T.primary
                  : T.textMuted,
                padding: '9px 10px',
                fontFamily: FONT.sans,
                fontSize: 9.5,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <FunnelSimple
                size={12}
                weight={
                  onlyWithCharacter
                    ? 'fill'
                    : 'regular'
                }
              />
              Ruoli
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: T.textFaint,
                  padding: '8px 2px',
                  fontFamily: FONT.sans,
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Reimposta
              </button>
            )}
          </div>

          {visibleMovies.length === 0 ? (
            <div
              style={{
                borderTop: `1px solid ${T.border}`,
                borderBottom: `1px solid ${T.border}`,
                padding: 32,
                textAlign: 'center',
                color: T.textFaint,
                fontSize: 11,
              }}
            >
              Nessun film corrisponde ai filtri.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile
                  ? 'repeat(2,minmax(0,1fr))'
                  : 'repeat(4,minmax(0,1fr))',
                gap: isMobile ? 10 : 14,
              }}
            >
              {visibleMovies.map((movie) => (
                <article
                  key={`${movie.tmdb_id}-${movie.character}`}
                  style={{
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      void router.push(
                        `/film/${movie.tmdb_id}`
                      )
                    }
                    style={{
                      width: '100%',
                      border: 0,
                      padding: 0,
                      background: 'transparent',
                      color: T.text,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: FONT.sans,
                    }}
                  >
                    <img
                      src={
                        movie.cover || fallbackPoster
                      }
                      alt={movie.title}
                      style={{
                        width: '100%',
                        aspectRatio: '2 / 3',
                        objectFit: 'cover',
                        display: 'block',
                        background: T.bgSoft,
                      }}
                    />

                    <div
                      style={{
                        padding: '9px 9px 10px',
                      }}
                    >
                      <div
                        style={{
                          color: T.text,
                          fontSize: 11,
                          fontWeight: 850,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {movie.title}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          marginTop: 4,
                          color: T.accent,
                          fontSize: 9,
                          fontWeight: 800,
                        }}
                      >
                        <Star
                          size={10}
                          weight="fill"
                        />
                        {movie.rating
                          ? movie.rating.toFixed(1)
                          : '—'}

                        {movie.year
                          ? ` · ${movie.year}`
                          : ''}
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          color: T.textFaint,
                          fontSize: 9,
                          lineHeight: 1.4,
                          minHeight: 26,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {movie.character?.trim()
                          ? movie.character
                          : 'Ruolo non disponibile'}
                      </div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div
              style={{
                marginTop: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.max(1, page - 1)
                  )
                }
                style={{
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  color: T.textMuted,
                  padding: '8px 10px',
                  fontFamily: FONT.sans,
                  fontSize: 9.5,
                  fontWeight: 800,
                  cursor:
                    currentPage <= 1
                      ? 'default'
                      : 'pointer',
                  opacity:
                    currentPage <= 1 ? 0.45 : 1,
                }}
              >
                Precedente
              </button>

              <span
                style={{
                  color: T.textFaint,
                  fontSize: 9.5,
                }}
              >
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(
                      totalPages,
                      page + 1
                    )
                  )
                }
                style={{
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  color: T.textMuted,
                  padding: '8px 10px',
                  fontFamily: FONT.sans,
                  fontSize: 9.5,
                  fontWeight: 800,
                  cursor:
                    currentPage >= totalPages
                      ? 'default'
                      : 'pointer',
                  opacity:
                    currentPage >= totalPages
                      ? 0.45
                      : 1,
                }}
              >
                Successiva
              </button>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
