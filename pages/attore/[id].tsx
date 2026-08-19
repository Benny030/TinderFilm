'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useTheme } from '@/context/ThemeContext';
import {
  ArrowLeft,
  CalendarBlank,
  FilmSlate,
  FunnelSimple,
  MagnifyingGlass,
  MapPin,
  Star,
  UserCircle,
  X,
} from '@phosphor-icons/react';

// ─── Hook media query ──────────────────────────────────────────────────
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = (event: MediaQueryListEvent) =>
      setMatches(event.matches);

    media.addEventListener('change', listener);

    return () =>
      media.removeEventListener('change', listener);
  }, [query, matches]);

  return matches;
}

// ─── Palette dark ──────────────────────────────────────────────────────
const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  cardHover: '#241d19',
  border: '#2d221c',
  gold: '#f5b92f',
  goldSoft: '#ffd875',
  pink: '#ed3d73',
  pinkGlow: 'rgba(237,61,115,0.15)',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
};

// ─── Palette light ─────────────────────────────────────────────────────
const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  cardHover: '#faf5ef',
  border: '#d6cbbc',
  gold: '#b8860b',
  goldSoft: '#e8c84a',
  pink: '#b83060',
  pinkGlow: 'rgba(184,48,96,0.10)',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
};

const FONT_SANS =
  "'Inter','Helvetica Neue',sans-serif";

const FONT_DISPLAY =
  "'Playfair Display','Georgia',serif";

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

  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const isMobile =
    useMediaQuery('(max-width: 640px)');

  const [actor, setActor] =
    useState<ActorDetail | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [currentPage, setCurrentPage] =
    useState(1);

  const MOVIES_PER_PAGE = 12;

  // ─── Filtri filmografia ──────────────────────────────────────────────
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

  const formatDate = (
    value: string | null
  ) => {
    if (!value) return null;

    const date = new Date(
      `${value}T00:00:00`
    );

    return date.toLocaleDateString(
      'it-IT',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  };

  const decades = useMemo(() => {
    if (!actor) return [];

    const values = actor.movies
      .map((movie) => movie.year)
      .filter((year) => year > 0)
      .map(
        (year) =>
          Math.floor(year / 10) * 10
      );

    return Array.from(new Set(values))
      .sort((a, b) => b - a);
  }, [actor]);

  const filteredMovies = useMemo(() => {
    if (!actor) return [];

    let movies = [...actor.movies];

    const cleanSearch =
      search.trim().toLowerCase();

    if (cleanSearch) {
      movies = movies.filter((movie) =>
        movie.title
          .toLowerCase()
          .includes(cleanSearch)
      );
    }

    if (selectedDecade !== 'all') {
      const decade =
        Number(selectedDecade);

      movies = movies.filter(
        (movie) =>
          movie.year >= decade &&
          movie.year <= decade + 9
      );
    }

    if (onlyWithCharacter) {
      movies = movies.filter(
        (movie) =>
          movie.character?.trim()
      );
    }

    switch (sortMode) {
      case 'recent':
        movies.sort(
          (a, b) =>
            (b.year || 0) -
            (a.year || 0)
        );
        break;

      case 'oldest':
        movies.sort((a, b) => {
          const yearA =
            a.year || 9999;

          const yearB =
            b.year || 9999;

          return yearA - yearB;
        });
        break;

      case 'rating':
        movies.sort(
          (a, b) =>
            (b.rating || 0) -
            (a.rating || 0)
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

  const totalPages = Math.ceil(
    filteredMovies.length / MOVIES_PER_PAGE
  );

  const startIndex =
    (currentPage - 1) * MOVIES_PER_PAGE;

  const endIndex =
    startIndex + MOVIES_PER_PAGE;

  const visibleMovies =
    filteredMovies.slice(
      startIndex,
      endIndex
    );

  if (loading) {
    return (
      <AppShell activeNav="home">
        <div
          style={{
            minHeight: '70vh',
            display: 'grid',
            placeItems: 'center',
            background: P.bg,
            color: P.textMuted,
            fontFamily: FONT_SANS,
          }}
        >
          <FilmSlate
            size={38}
            color={P.pink}
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
            background: P.bg,
            color: P.textMuted,
            fontFamily: FONT_SANS,
            padding: 20,
          }}
        >
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <p>
              Non siamo riusciti a trovare questa persona.
            </p>

            <button
              onClick={() => router.back()}
              style={{
                marginTop: 14,
                border: 0,
                background: P.pink,
                color: '#fff',
                padding: '10px 16px',
                cursor: 'pointer',
                fontWeight: 800,
                fontFamily: FONT_SANS,
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
          background: P.bg,
          color: P.text,
          fontFamily: FONT_SANS,
          paddingBottom: 90,
        }}
      >
        <section
          style={{
            minHeight: isMobile
              ? 360
              : 430,
            position: 'relative',
            overflow: 'hidden',
            borderBottom:
              `1px solid ${P.border}`,
            background: isDark
              ? `
                radial-gradient(
                  circle at 15% 30%,
                  rgba(237,61,115,0.16),
                  transparent 35%
                ),
                radial-gradient(
                  circle at 80% 20%,
                  rgba(245,185,47,0.10),
                  transparent 30%
                ),
                ${P.bgSoft}
              `
              : `
                radial-gradient(
                  circle at 15% 30%,
                  rgba(184,48,96,0.10),
                  transparent 35%
                ),
                radial-gradient(
                  circle at 80% 20%,
                  rgba(184,134,11,0.08),
                  transparent 30%
                ),
                ${P.bgSoft}
              `,
          }}
        >
          <button
            onClick={() => router.back()}
            aria-label="Torna indietro"
            style={{
              position: 'absolute',
              top: isMobile ? 12 : 20,
              left: isMobile ? 12 : 20,
              zIndex: 3,
              width: isMobile ? 36 : 42,
              height: isMobile ? 36 : 42,
              border: `1px solid ${P.border}`,
              borderRadius: '50%',
              background: isDark
                ? 'rgba(10,8,6,0.76)'
                : 'rgba(255,255,255,0.82)',
              color: P.text,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}
          >
            <ArrowLeft
              size={isMobile ? 18 : 21}
            />
          </button>

          <div
            style={{
              maxWidth: 1060,
              margin: '0 auto',
              padding: isMobile
                ? '72px 16px 32px'
                : '70px 24px 42px',
              display: 'grid',
              gridTemplateColumns: isMobile
                ? '1fr'
                : '240px minmax(0,1fr)',
              alignItems: 'center',
              gap: isMobile ? 22 : 42,
            }}
          >
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {actor.profile ? (
                <img
                  src={actor.profile}
                  alt={actor.name}
                  style={{
                    width: isMobile
                      ? 180
                      : 330,
                    height: isMobile
                      ? 180
                      : 330,
                    borderRadius: '0%',
                    objectFit: 'cover',
                    display: 'block',
                    border:
                      `3px solid ${P.pink}`,
                    boxShadow:
                      '0 18px 45px rgba(0,0,0,0.28)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: isMobile
                      ? 180
                      : 230,
                    height: isMobile
                      ? 180
                      : 230,
                    borderRadius: '50%',
                    background: P.card,
                    border:
                      `2px solid ${P.border}`,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <UserCircle
                    size={isMobile ? 80 : 110}
                    color={P.textFaint}
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
                <span
                  style={{
                    display: 'inline-block',
                    padding: '5px 10px',
                    borderRadius: 999,
                    border:
                      `1px solid ${P.pink}`,
                    background: P.pinkGlow,
                    color: P.pink,
                    fontWeight: 800,
                    fontSize: 11,
                    textTransform:
                      'uppercase',
                    letterSpacing: '.06em',
                  }}
                >
                  {actor.known_for}
                </span>
              )}

              <h1
                style={{
                  margin: '10px 0 14px',
                  fontFamily: FONT_DISPLAY,
                  fontSize: isMobile
                    ? 'clamp(30px, 10vw, 44px)'
                    : 'clamp(42px, 5vw, 64px)',
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  fontWeight: 800,
                  color: P.text,
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
                  color: P.textMuted,
                  fontSize: isMobile
                    ? 12
                    : 13,
                }}
              >
                {actor.birthday && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <CalendarBlank size={16} />
                    {formatDate(actor.birthday)}
                  </span>
                )}

                {actor.place_of_birth && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <MapPin size={16} />
                    {actor.place_of_birth}
                  </span>
                )}
              </div>

              {actor.deathday && (
                <div
                  style={{
                    marginTop: 8,
                    color: P.textMuted,
                    fontSize: 12,
                  }}
                >
                  Deceduto il{' '}
                  {formatDate(actor.deathday)}
                </div>
              )}

              {actor.biography && (
                <p
                  style={{
                    margin:
                      '20px 0 0',
                    maxWidth: 680,
                    color: P.text,
                    fontSize: isMobile
                      ? 14
                      : 15,
                    lineHeight: 1.7,
                  }}
                >
                  {actor.biography}
                </p>
              )}
            </div>
          </div>
        </section>

        <section
          style={{
            maxWidth: 1060,
            margin: '0 auto',
            padding: isMobile
              ? '30px 12px 0'
              : '38px 24px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent:
                'space-between',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div>
              <span
                style={{
                  color: P.pink,
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform:
                    'uppercase',
                  letterSpacing: '.12em',
                }}
              >
                Filmografia
              </span>

              <h2
                style={{
                  margin: '4px 0 0',
                  fontFamily:
                    FONT_DISPLAY,
                  fontSize: isMobile
                    ? 23
                    : 30,
                  color: P.text,
                }}
              >
                Film con {actor.name}
              </h2>
            </div>

            <span
              style={{
                color: P.textMuted,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {filteredMovies.length}{' '}
              {filteredMovies.length === 1
                ? 'risultato'
                : 'risultati'}
            </span>
          </div>

          <div
            style={{
              border:
                `1px solid ${P.border}`,
              background: P.card,
              borderRadius: 0,
              padding: isMobile
                ? 12
                : 14,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                color: P.textMuted,
                fontSize: 10,
                fontWeight: 800,
                textTransform:
                  'uppercase',
                letterSpacing: '.08em',
                marginBottom: 11,
              }}
            >
              <FunnelSimple
                size={15}
                color={P.pink}
                weight="bold"
              />

              Filtra filmografia
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile
                  ? '1fr'
                  : 'minmax(240px, 1.6fr) minmax(170px, .8fr) minmax(150px, .7fr)',
                gap: 10,
              }}
            >
              <div
                style={{
                  position: 'relative',
                }}
              >
                <MagnifyingGlass
                  size={16}
                  color={P.textFaint}
                  style={{
                    position: 'absolute',
                    left: 11,
                    top: '50%',
                    transform:
                      'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                />

                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(
                      event.target.value
                    );
                    setCurrentPage(1);
                  }}
                  placeholder="Cerca un film..."
                  style={{
                    width: '100%',
                    height: 40,
                    border:
                      `1px solid ${P.border}`,
                    borderRadius: 9,
                    background: P.bgSoft,
                    color: P.text,
                    outline: 0,
                    padding:
                      '0 36px 0 35px',
                    fontFamily:
                      FONT_SANS,
                    fontSize: 12,
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
                      right: 7,
                      top: '50%',
                      transform:
                        'translateY(-50%)',
                      width: 26,
                      height: 26,
                      border: 0,
                      borderRadius: '50%',
                      background:
                        'transparent',
                      color: P.textMuted,
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
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
                    event.target
                      .value as SortMode
                  );
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  height: 40,
                  border:
                    `1px solid ${P.border}`,
                  borderRadius: 9,
                  background: P.bgSoft,
                  color: P.text,
                  outline: 0,
                  padding: '0 10px',
                  fontFamily:
                    FONT_SANS,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <option value="popular">
                  Più popolari
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
                  height: 40,
                  border:
                    `1px solid ${P.border}`,
                  borderRadius: 9,
                  background: P.bgSoft,
                  color: P.text,
                  outline: 0,
                  padding: '0 10px',
                  fontFamily:
                    FONT_SANS,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <option value="all">
                  Tutti gli anni
                </option>

                {decades.map(
                  (decade) => (
                    <option
                      key={decade}
                      value={decade}
                    >
                      {decade}–{decade + 9}
                    </option>
                  )
                )}
              </select>
            </div>

            <div
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setOnlyWithCharacter(
                    (value) => !value
                  );
                  setCurrentPage(1);
                }}
                style={{
                  border: `1px solid ${
                    onlyWithCharacter
                      ? P.pink
                      : P.border
                  }`,
                  background:
                    onlyWithCharacter
                      ? P.pinkGlow
                      : P.bgSoft,
                  color:
                    onlyWithCharacter
                      ? P.pink
                      : P.textMuted,
                  padding: '7px 10px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily:
                    FONT_SANS,
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {onlyWithCharacter
                  ? '✓ '
                  : ''}
                Con personaggio
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    border: 0,
                    background:
                      'transparent',
                    color: P.pink,
                    padding: '7px 5px',
                    cursor: 'pointer',
                    fontFamily:
                      FONT_SANS,
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  Reset filtri
                </button>
              )}
            </div>
          </div>

          {filteredMovies.length > 0 ? (
            <>
              <div
                style={{
                  display: 'grid',

                  gridTemplateColumns:
                    isMobile
                      ? 'repeat(2, minmax(0,1fr))'
                      : 'repeat(6, minmax(0,1fr))',

                  gap: isMobile
                    ? 14
                    : 18,
                }}
              >
                {visibleMovies.map(
                  (movie) => (
                    <button
                      key={movie.tmdb_id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/film/${movie.tmdb_id}`
                        )
                      }
                      style={{
                        border: 0,
                        background:
                          'transparent',
                        padding: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily:
                          FONT_SANS,
                        color: P.text,
                        minWidth: 0,
                        transition:
                          'transform 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform =
                          'translateY(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform =
                          'translateY(0)';
                      }}
                    >
                      <img
                        src={
                          movie.cover ||
                          fallbackPoster
                        }
                        alt={movie.title}
                        style={{
                          width: '100%',
                          aspectRatio: '2 / 3',
                          objectFit: 'cover',
                          display: 'block',
                          borderRadius: 14,
                          background: P.bgSoft,
                          boxShadow:
                            '0 6px 18px rgba(0,0,0,0.16)',
                        }}
                      />

                      <strong
                        style={{
                          display: 'block',
                          marginTop: 7,
                          fontSize: isMobile
                            ? 12
                            : 13,
                          color: P.text,
                          overflow: 'hidden',
                          textOverflow:
                            'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {movie.title}
                      </strong>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          marginTop: 3,
                          color: P.textMuted,
                          fontSize: isMobile
                            ? 10
                            : 11,
                        }}
                      >
                        <span>
                          {movie.year ||
                            '—'}
                        </span>

                        {movie.rating > 0 && (
                          <>
                            <span>·</span>

                            <Star
                              size={11}
                              color={P.gold}
                              weight="fill"
                            />

                            <span
                              style={{
                                color:
                                  P.gold,
                              }}
                            >
                              {movie.rating.toFixed(
                                1
                              )}
                            </span>
                          </>
                        )}
                      </div>

                      {movie.character && (
                        <span
                          style={{
                            display:
                              'block',
                            marginTop: 3,
                            color:
                              P.textFaint,
                            fontSize:
                              isMobile
                                ? 9
                                : 10,
                            overflow:
                              'hidden',
                            textOverflow:
                              'ellipsis',
                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          {movie.character}
                        </span>
                      )}
                    </button>
                  )
                )}
              </div>

              {totalPages > 1 && (
                <div
                  style={{
                    marginTop: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.max(1, page - 1)
                      )
                    }
                    style={{
                      width: 36,
                      height: 36,
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      color:
                        currentPage === 1
                          ? P.textFaint
                          : P.text,
                      cursor:
                        currentPage === 1
                          ? 'default'
                          : 'pointer',
                      opacity:
                        currentPage === 1
                          ? 0.45
                          : 1,
                      fontFamily: FONT_SANS,
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    ‹
                  </button>

                  {Array.from(
                    { length: totalPages },
                    (_, index) => index + 1
                  )
                    .filter((page) => {
                      if (totalPages <= 7) {
                        return true;
                      }

                      if (currentPage <= 4) {
                        return page <= 5;
                      }

                      if (
                        currentPage >=
                        totalPages - 3
                      ) {
                        return (
                          page >=
                          totalPages - 4
                        );
                      }

                      return (
                        page >=
                          currentPage - 2 &&
                        page <=
                          currentPage + 2
                      );
                    })
                    .map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() =>
                          setCurrentPage(page)
                        }
                        style={{
                          minWidth: 36,
                          height: 36,
                          padding: '0 10px',

                          border:
                            page === currentPage
                              ? `1px solid ${P.pink}`
                              : `1px solid ${P.border}`,

                          background:
                            page === currentPage
                              ? P.pink
                              : P.card,

                          color:
                            page === currentPage
                              ? '#fff'
                              : P.text,

                          cursor: 'pointer',
                          fontFamily:
                            FONT_SANS,
                          fontWeight: 800,
                          fontSize: 11,
                          transition:
                            'all 0.15s ease',
                        }}
                      >
                        {page}
                      </button>
                    ))}

                  <button
                    type="button"
                    disabled={
                      currentPage ===
                      totalPages
                    }
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                      )
                    }
                    style={{
                      width: 36,
                      height: 36,
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      color:
                        currentPage ===
                        totalPages
                          ? P.textFaint
                          : P.text,
                      cursor:
                        currentPage ===
                        totalPages
                          ? 'default'
                          : 'pointer',
                      opacity:
                        currentPage ===
                        totalPages
                          ? 0.45
                          : 1,
                      fontFamily:
                        FONT_SANS,
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                minHeight: 190,
                display: 'grid',
                placeItems: 'center',
                border:
                  `1px dashed ${P.border}`,
                borderRadius: 16,
                background: P.bgSoft,
                color: P.textMuted,
                textAlign: 'center',
                padding: 20,
              }}
            >
              <div>
                <FilmSlate
                  size={30}
                  color={P.textFaint}
                  weight="duotone"
                />

                <p
                  style={{
                    margin:
                      '10px 0 0',
                    fontSize: 13,
                  }}
                >
                  Nessun film corrisponde ai filtri.
                </p>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    style={{
                      marginTop: 12,
                      border:
                        `1px solid ${P.pink}`,
                      background:
                        P.pinkGlow,
                      color: P.pink,
                      padding:
                        '8px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontFamily:
                        FONT_SANS,
                      fontWeight: 800,
                      fontSize: 11,
                    }}
                  >
                    Azzera filtri
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}