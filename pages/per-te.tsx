'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import {
  ArrowClockwise,
  FilmSlate,
  Sparkle,
  Star,
  ThumbsDown,
  ThumbsUp,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import BackButton from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { FONT, THEME } from '@/styles/token';

type RecommendationMovie = {
  tmdb_id: number;
  title: string;
  year: number | null;
  cover: string | null;
  backdrop: string | null;
  rating: number;
  vote_count: number;
  genre_ids: number[];
  score: number;
  reason: string;
  source?:
    | 'favorite'
    | 'room'
    | 'cast'
    | 'profile_genre'
    | 'exploration';
  based_on: Array<{
    tmdb_id: number;
    title: string | null;
    weight: number;
  }>;
};

type RecommendationCollections = {
  from_favorites: RecommendationMovie[];
  from_rooms: RecommendationMovie[];
  cast_affinity: RecommendationMovie[];
  profile_genres: RecommendationMovie[];
  exploration?: RecommendationMovie[];
};

type RecommendationMeta = {
  personalized: boolean;
  seeds_used: number;
  positive_signals: number;
  excluded_movies: number;
  negative_genres?: number;
  taste_genres?: number;
  taste_actors?: number;
  top_genres?: Array<{
    id: number;
    name: string;
    weight: number;
  }>;
  top_actors?: Array<{
    id: number;
    name: string;
    weight: number;
  }>;
  profile_genres?: string[];
  cold_start_used?: boolean;
};

type FeedbackMap = Record<
  number,
  'more_like_this' | 'not_for_me'
>;

type SectionKey =
  | 'from_favorites'
  | 'from_rooms'
  | 'profile_genres'
  | 'cast_affinity'
  | 'exploration';

const SECTION_COPY: Record<
  SectionKey,
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  from_favorites: {
    eyebrow: 'Dal tuo gusto',
    title: 'Se ti sono piaciuti questi...',
    description:
      'Consigli costruiti sui film che hai davvero amato, valutato bene o segnato con “Più così”.',
  },
  from_rooms: {
    eyebrow: 'Cinema sociale',
    title: 'Dalle tue stanze',
    description:
      'Titoli vicini ai match, agli swipe positivi e ai film scelti insieme agli altri.',
  },
  profile_genres: {
    eyebrow: 'Affinità',
    title: 'Dentro i tuoi generi',
    description:
      'Una selezione che parte dai generi che hai scelto e da quelli che Cinedate sta imparando.',
  },
  cast_affinity: {
    eyebrow: 'Volti ricorrenti',
    title: 'Con attori che tornano nei tuoi gusti',
    description:
      'Film costruiti intorno agli interpreti che ricorrono nei titoli che apprezzi di più.',
  },
  exploration: {
    eyebrow: 'Fuori rotta',
    title: 'Qualcosa di diverso',
    description:
      'Pochi titoli fuori dal tuo percorso abituale, per evitare che il tuo Per te diventi prevedibile.',
  },
};

function PosterCard({
  movie,
  feedback,
  busy,
  learning,
  onOpen,
  onFeedback,
  T,
}: {
  movie: RecommendationMovie;
  feedback:
    | 'more_like_this'
    | 'not_for_me'
    | undefined;
  busy: boolean;
  learning: boolean;
  onOpen: () => void;
  onFeedback: (
    feedback:
      | 'more_like_this'
      | 'not_for_me'
  ) => void;
  T: (typeof THEME)[keyof typeof THEME];
}) {
  const moreLikeThis =
    feedback === 'more_like_this';

  return (
    <article
      className="cdr-perte-card"
      style={{
        width: 154,
        transition:
          'transform 220ms cubic-bezier(.2,.7,.2,1), opacity 180ms ease, filter 220ms ease',
        scrollSnapAlign: 'start',
        flex: '0 0 154px',
        minWidth: 0,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={(event) => {
          const article =
            event.currentTarget.closest(
              '.cdr-perte-card'
            ) as HTMLElement | null;

          if (article) {
            article.style.transform =
              'translateY(-7px) scale(1.015)';
            article.style.opacity = '1';
            article.style.filter =
              'drop-shadow(0 10px 18px rgba(0,0,0,.12))';

            const image =
              article.querySelector('img') as HTMLElement | null;

            if (image) {
              image.style.transform =
                'scale(1.045)';
            }
          }
        }}
        onMouseLeave={(event) => {
          const article =
            event.currentTarget.closest(
              '.cdr-perte-card'
            ) as HTMLElement | null;

          if (article) {
            article.style.transform =
              'translateY(0)';
            article.style.opacity = '1';
            article.style.filter = 'none';

            const image =
              article.querySelector('img') as HTMLElement | null;

            if (image) {
              image.style.transform =
                'scale(1)';
            }
          }
        }}
        style={{
          display: 'block',
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
        <div
          style={{
            width: '100%',
            aspectRatio: '2 / 3',
            overflow: 'hidden',
            background: T.bgSoft,
            border: `1px solid ${T.border}`,
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
                transition:
                  'transform 240ms ease',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                color: T.textFaint,
              }}
            >
              <FilmSlate
                size={28}
                weight="duotone"
              />
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            fontWeight: 900,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {movie.title}
        </div>

        <div
          style={{
            marginTop: 3,
            color: T.textFaint,
            fontSize: 8.8,
            lineHeight: 1.35,
          }}
        >
          {movie.year ?? '—'}
          {' · '}
          <span
            style={{
              color: T.accent,
              fontWeight: 850,
            }}
          >
            ★{' '}
            {movie.rating
              ? movie.rating.toFixed(1)
              : '—'}
          </span>
        </div>
      </button>

      <div
        style={{
          marginTop: 7,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderTop: `1px solid ${T.border}`,
          opacity: .9,
        }}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onFeedback('more_like_this')
          }
          onMouseEnter={(event) => {
            event.currentTarget.style.transform =
              'translateY(-1px)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform =
              'translateY(0)';
          }}
          style={{
            border: 0,
            borderRight: `1px solid ${T.border}`,
            background: 'transparent',
            color: moreLikeThis
              ? T.accent
              : T.textFaint,
            padding: '7px 4px 0',
            cursor: busy ? 'wait' : 'pointer',
            fontFamily: FONT.sans,
            fontSize: 8.1,
            fontWeight: 850,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition:
              'transform 150ms ease, color 150ms ease',
          }}
        >
          <ThumbsUp
            size={10}
            weight={
              moreLikeThis
                ? 'fill'
                : 'duotone'
            }
          />
          Più così
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onFeedback('not_for_me')
          }
          onMouseEnter={(event) => {
            event.currentTarget.style.transform =
              'translateY(-1px)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform =
              'translateY(0)';
          }}
          style={{
            border: 0,
            background: 'transparent',
            color: T.textFaint,
            padding: '7px 4px 0',
            cursor: busy ? 'wait' : 'pointer',
            fontFamily: FONT.sans,
            fontSize: 8.1,
            fontWeight: 850,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition:
              'transform 150ms ease, color 150ms ease',
          }}
        >
          <ThumbsDown
            size={10}
            weight="duotone"
          />
          Non fa per me
        </button>
      </div>
    </article>
  );
}

export default function PerTePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const T =
    theme === 'dark'
      ? THEME.dark
      : THEME.light;

  const {
    currentUser,
    isGuest,
    isLoading,
  } = useAuth();

  const supabase = useMemo(
    () => createBrowserClient(),
    []
  );

  const recordedGenerationRef =
    useRef<number>(-1);

  const [movies, setMovies] =
    useState<RecommendationMovie[]>([]);
  const [collections, setCollections] =
    useState<RecommendationCollections>({
      from_favorites: [],
      from_rooms: [],
      cast_affinity: [],
      profile_genres: [],
      exploration: [],
    });
  const [meta, setMeta] =
    useState<RecommendationMeta | null>(null);
  const [feedbackByMovie, setFeedbackByMovie] =
    useState<FeedbackMap>({});
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [feedbackBusyId, setFeedbackBusyId] =
    useState<number | null>(null);
  const [learningMovieId, setLearningMovieId] =
    useState<number | null>(null);
  const [recommendationGeneration, setRecommendationGeneration] =
    useState(0);
  const [error, setError] =
    useState('');

  const loadRecommendations =
    useCallback(
      async (soft = false) => {
        if (
          !currentUser ||
          currentUser.isGuest ||
          isGuest
        ) {
          setMovies([]);
          setCollections({
            from_favorites: [],
            from_rooms: [],
            cast_affinity: [],
            profile_genres: [],
            exploration: [],
          });
          setMeta(null);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        soft
          ? setRefreshing(true)
          : setLoading(true);

        setError('');

        try {
          const {
            data: { session },
          } =
            await supabase.auth.getSession();

          const token =
            session?.access_token;

          if (!token) {
            throw new Error(
              'Sessione non disponibile'
            );
          }

          const response = await fetch(
            '/api/recommendations/for-you',
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: 'no-store',
            }
          );

          const data = await response
            .json()
            .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data.error ||
                'Impossibile caricare i consigli'
            );
          }

          setMovies(
            Array.isArray(
              data.recommendations
            )
              ? data.recommendations
              : []
          );

          setCollections({
            from_favorites:
              Array.isArray(
                data.collections
                  ?.from_favorites
              )
                ? data.collections
                    .from_favorites
                : [],
            from_rooms:
              Array.isArray(
                data.collections
                  ?.from_rooms
              )
                ? data.collections
                    .from_rooms
                : [],
            cast_affinity:
              Array.isArray(
                data.collections
                  ?.cast_affinity
              )
                ? data.collections
                    .cast_affinity
                : [],
            profile_genres:
              Array.isArray(
                data.collections
                  ?.profile_genres
              )
                ? data.collections
                    .profile_genres
                : [],
            exploration:
              Array.isArray(
                data.collections
                  ?.exploration
              )
                ? data.collections
                    .exploration
                : [],
          });

          setFeedbackByMovie(
            data.feedback &&
              typeof data.feedback ===
                'object'
              ? data.feedback
              : {}
          );

          setMeta(data.meta ?? null);
          setRecommendationGeneration(
            (current) => current + 1
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossibile caricare i consigli'
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        currentUser,
        isGuest,
        supabase,
      ]
    );

  useEffect(() => {
    if (isLoading) return;

    void loadRecommendations();
  }, [
    isLoading,
    loadRecommendations,
  ]);

  useEffect(() => {
    if (
      recommendationGeneration <= 0 ||
      recommendationGeneration ===
        recordedGenerationRef.current ||
      !currentUser ||
      currentUser.isGuest ||
      isGuest ||
      movies.length === 0
    ) {
      return;
    }

    recordedGenerationRef.current =
      recommendationGeneration;

    const visibleIds = Array.from(
      new Set(
        [
          movies[0]?.tmdb_id,
          ...(
            collections.from_favorites ??
            []
          )
            .slice(0, 6)
            .map(
              (movie) =>
                movie.tmdb_id,
            ),
          ...(
            collections.from_rooms ??
            []
          )
            .slice(0, 4)
            .map(
              (movie) =>
                movie.tmdb_id,
            ),
          ...(
            collections.profile_genres ??
            []
          )
            .slice(0, 4)
            .map(
              (movie) =>
                movie.tmdb_id,
            ),
          ...(
            collections.cast_affinity ??
            []
          )
            .slice(0, 4)
            .map(
              (movie) =>
                movie.tmdb_id,
            ),
          ...(
            collections.exploration ??
            []
          )
            .slice(0, 3)
            .map(
              (movie) =>
                movie.tmdb_id,
            ),
        ].filter(
          (
            value
          ): value is number =>
            Number.isInteger(value) &&
            Number(value) > 0,
        ),
      ),
    ).slice(0, 24);

    if (visibleIds.length === 0) {
      return;
    }

    const record = async () => {
      try {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        const token =
          session?.access_token;

        if (!token) return;

        await fetch(
          '/api/recommendations/impressions',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              tmdb_ids: visibleIds,
            }),
            keepalive: true,
          },
        );
      } catch (error) {
        /*
         * La memoria esposizioni migliora il feed ma non
         * deve mai bloccare l'esperienza principale.
         */
        console.warn(
          'Recommendation impression recording failed:',
          error,
        );
      }
    };

    const timer =
      window.setTimeout(
        () => {
          void record();
        },
        1400,
      );

    return () =>
      window.clearTimeout(timer);
  }, [
    recommendationGeneration,
    movies,
    collections,
    currentUser,
    isGuest,
    supabase,
  ]);

  const sendFeedback = async (
    movieId: number,
    feedback:
      | 'more_like_this'
      | 'not_for_me'
  ) => {
    if (feedbackBusyId !== null) {
      return;
    }

    setFeedbackBusyId(movieId);
    setError('');

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      const token =
        session?.access_token;

      if (!token) {
        throw new Error(
          'Sessione non disponibile'
        );
      }

      const isUndo =
        feedbackByMovie[movieId] ===
        feedback;

      const response = await fetch(
        '/api/recommendations/feedback',
        {
          method: isUndo
            ? 'DELETE'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            isUndo
              ? { tmdb_id: movieId }
              : {
                  tmdb_id: movieId,
                  feedback,
                }
          ),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossibile salvare il feedback'
        );
      }

      if (isUndo) {
        setFeedbackByMovie(
          (current) => {
            const next = {
              ...current,
            };
            delete next[movieId];
            return next;
          }
        );
        return;
      }

      setFeedbackByMovie(
        (current) => ({
          ...current,
          [movieId]: feedback,
        })
      );

      if (
        feedback === 'not_for_me'
      ) {
        setMovies((current) =>
          current.filter(
            (movie) =>
              movie.tmdb_id !==
              movieId
          )
        );

        setCollections(
          (current) => {
            const clean = (
              list:
                | RecommendationMovie[]
                | undefined
            ) =>
              (list ?? []).filter(
                (movie) =>
                  movie.tmdb_id !==
                  movieId
              );

            return {
              from_favorites: clean(
                current.from_favorites
              ),
              from_rooms: clean(
                current.from_rooms
              ),
              cast_affinity: clean(
                current.cast_affinity
              ),
              profile_genres: clean(
                current.profile_genres
              ),
              exploration: clean(
                current.exploration
              ),
            };
          }
        );
      }

      /*
       * Il feedback non deve sembrare un semplice "like".
       * Dopo Più così / Non fa per me chiediamo subito al motore
       * di ricalcolare le proposte con il nuovo segnale.
       */
      setLearningMovieId(movieId);

      window.setTimeout(() => {
        void loadRecommendations(true).finally(() => {
          setLearningMovieId(null);
        });
      }, 220);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile salvare il feedback'
      );
    } finally {
      setFeedbackBusyId(null);
    }
  };

  const hero =
    movies[0] ?? null;

  const heroFeedback = hero
    ? feedbackByMovie[hero.tmdb_id]
    : undefined;

  const sectionKeys: SectionKey[] = [
    'from_favorites',
    'from_rooms',
    'profile_genres',
    'cast_affinity',
    'exploration',
  ];

  const visibleSections =
    sectionKeys
      .map((key) => ({
        key,
        items: (
          collections[key] ?? []
        ).filter(
          (movie) =>
            !hero ||
            movie.tmdb_id !==
              hero.tmdb_id
        ),
      }))
      .filter(
        (section) =>
          section.items.length > 0
      );

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: T.bg,
          display: 'grid',
          placeItems: 'center',
          color: T.text,
          fontFamily: FONT.sans,
        }}
      >
        <FilmSlate
          size={42}
          color={T.primary}
          weight="duotone"
        />
      </div>
    );
  }

  return (
    <AppShell activeNav="per-te">
      <style>{`
        @keyframes cdrPerTeFadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes cdrPerTeHeroIn {
          from {
            opacity: 0;
            transform: scale(1.018);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes cdrPerTeBackdropIn {
          from {
            opacity: 0;
            transform: scale(1.06);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes cdrPerTeShimmer {
          0% {
            transform: translateX(-140%);
          }
          100% {
            transform: translateX(240%);
          }
        }

        @keyframes cdrPerTeFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes cdrPerTePulseSoft {
          0%, 100% {
            opacity: .55;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes cdrPerTeRevealRight {
          from {
            opacity: 0;
            transform: translateX(22px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes cdrPerTeGlowSweep {
          0% {
            transform: translateX(-120%);
            opacity: 0;
          }
          20% {
            opacity: .35;
          }
          60% {
            opacity: .18;
          }
          100% {
            transform: translateX(180%);
            opacity: 0;
          }
        }

        @keyframes cdrPerTeRefreshIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(.992);
            filter: blur(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes cdrPerTeHeroSwap {
          0% {
            opacity: 0;
            transform: translateX(20px) scale(.99);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes cdrPerTeLearnFlash {
          0% {
            box-shadow: 0 0 0 0 rgba(245,185,47,.0);
          }
          35% {
            box-shadow: 0 0 0 6px rgba(245,185,47,.10);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(245,185,47,.0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cdr-perte-animate,
          .cdr-perte-hero,
          .cdr-perte-backdrop,
          .cdr-perte-card,
          .cdr-perte-float,
          .cdr-perte-reveal-right,
          .cdr-perte-glow,
          .cdr-perte-refresh {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
      <main
        style={{
          minHeight: '100vh',
          background: T.bg,
          color: T.text,
          fontFamily: FONT.sans,
          padding:
            '24px 18px 88px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1180,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'space-between',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <BackButton
              onClick={() => {
                if (
                  typeof window !==
                    'undefined' &&
                  window.history
                    .length > 1
                ) {
                  router.back();
                } else {
                  void router.push(
                    '/home'
                  );
                }
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {learningMovieId !== null && (
                <div
                  className="cdr-perte-animate"
                  style={{
                    color: T.accent,
                    fontSize: 8.5,
                    fontWeight: 850,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    animation:
                      'cdrPerTeFadeUp 220ms ease both',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: T.accent,
                      display: 'inline-block',
                      animation:
                        'cdrPerTePulseSoft 650ms ease-in-out infinite',
                    }}
                  />
                  Sto aggiornando i tuoi gusti
                </div>
              )}

            {currentUser &&
              !currentUser.isGuest &&
              !isGuest && (
                <button
                  type="button"
                  onClick={() =>
                    void loadRecommendations(
                      true
                    )
                  }
                  disabled={refreshing}
                  style={{
                    border: 0,
                    background:
                      'transparent',
                    color:
                      refreshing
                        ? T.textFaint
                        : T.textMuted,
                    padding: 0,
                    cursor:
                      refreshing
                        ? 'wait'
                        : 'pointer',
                    fontFamily:
                      FONT.sans,
                    fontSize: 9,
                    fontWeight: 850,
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      animation:
                        refreshing
                          ? 'cdrPerTePulseSoft 800ms ease-in-out infinite'
                          : 'none',
                    }}
                  >
                    <ArrowClockwise
                      size={12}
                      weight="bold"
                    />
                  </span>
                  {refreshing
                    ? 'Aggiorno…'
                    : 'Aggiorna'}
                </button>
              )}
            </div>
          </div>

          <header
            className="cdr-perte-animate"
            style={{
              marginBottom: 22,
              animation:
                'cdrPerTeFadeUp 520ms cubic-bezier(.2,.7,.2,1) both',
            }}
          >
            <div
              style={{
                color: T.primary,
                fontSize: 9,
                fontWeight: 900,
                letterSpacing:
                  '.12em',
                textTransform:
                  'uppercase',
                display: 'flex',
                alignItems:
                  'center',
                gap: 6,
              }}
            >
              <span
                className="cdr-perte-float"
                style={{
                  display: 'inline-flex',
                  animation:
                    'cdrPerTeFloat 2400ms ease-in-out infinite',
                }}
              >
                <Sparkle
                  size={13}
                  weight="fill"
                />
              </span>
              Per te
            </div>

            <h1
              style={{
                margin:
                  '5px 0 0',
                fontFamily:
                  FONT.display,
                fontSize:
                  'clamp(34px,5vw,52px)',
                lineHeight: .96,
                letterSpacing:
                  '-.035em',
              }}
            >
              Film scelti per te.
            </h1>


          </header>

          {!currentUser ||
          currentUser.isGuest ||
          isGuest ? (
            <section
              style={{
                border: `1px solid ${T.border}`,
                background:
                  T.surface,
                padding: 22,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily:
                    FONT.display,
                  fontSize: 24,
                }}
              >
                Accedi per avere il
                tuo Per te
              </h2>

              <p
                style={{
                  margin:
                    '7px 0 0',
                  color:
                    T.textMuted,
                  fontSize: 10.5,
                  lineHeight: 1.6,
                }}
              >
                Preferiti, voti e
                stanze diventano i
                segnali con cui
                Cinedate costruisce
                i tuoi consigli.
              </p>

              <button
                type="button"
                onClick={() =>
                  void router.push(
                    '/auth'
                  )
                }
                style={{
                  marginTop: 14,
                  border: 0,
                  background:
                    T.primary,
                  color: '#fff',
                  padding:
                    '10px 14px',
                  cursor: 'pointer',
                  fontFamily:
                    FONT.sans,
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                Accedi
              </button>
            </section>
          ) : error ? (
            <div
              style={{
                border: `1px solid ${T.primary}55`,
                background:
                  T.primaryGlow,
                color:
                  T.primary,
                padding: 14,
                fontSize: 10.5,
              }}
            >
              {error}
            </div>
          ) : hero ? (
            <>
              <section
                key={`hero-${hero.tmdb_id}-${recommendationGeneration}`}
                className="cdr-perte-hero"
                style={{
                  position:
                    'relative',
                  animation:
                    recommendationGeneration > 1
                      ? 'cdrPerTeHeroSwap 520ms cubic-bezier(.2,.7,.2,1) both'
                      : 'cdrPerTeHeroIn 520ms cubic-bezier(.2,.7,.2,1) both',
                  overflow: 'hidden',
                  minHeight: 360,
                  border: `1px solid ${T.border}`,
                  background:
                    T.surface,
                  marginBottom: 34,
                }}
              >
                {hero.backdrop ? (
                  <img
                    src={hero.backdrop}
                    alt=""
                    className="cdr-perte-backdrop"
                    style={{
                      position:
                        'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit:
                        'cover',
                      display:
                        'block',
                      animation:
                        'cdrPerTeBackdropIn 900ms cubic-bezier(.2,.7,.2,1) both, cdrPerTeFloat 7000ms 1000ms ease-in-out infinite',
                    }}
                  />
                ) : hero.cover ? (
                  <img
                    src={hero.cover}
                    alt=""
                    className="cdr-perte-backdrop"
                    style={{
                      position:
                        'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit:
                        'cover',
                      filter:
                        'blur(10px)',
                      transform:
                        'scale(1.08)',
                      opacity: .72,
                      animation:
                        'cdrPerTeBackdropIn 900ms cubic-bezier(.2,.7,.2,1) both',
                    }}
                  />
                ) : null}

                <div
                  aria-hidden="true"
                  style={{
                    position:
                      'absolute',
                    inset: 0,
                    background:
                      theme === 'dark'
                        ? 'linear-gradient(90deg, rgba(10,8,6,.98) 0%, rgba(10,8,6,.90) 38%, rgba(10,8,6,.35) 72%, rgba(10,8,6,.12) 100%)'
                        : 'linear-gradient(90deg, rgba(245,239,232,.98) 0%, rgba(245,239,232,.92) 40%, rgba(245,239,232,.48) 70%, rgba(245,239,232,.16) 100%)',
                  }}
                />

                <div
                  className="cdr-perte-animate"
                  style={{
                    position:
                      'relative',
                    zIndex: 1,
                    animation:
                      'cdrPerTeFadeUp 520ms 90ms ease both',
                    width: '100%',
                    maxWidth: 520,
                    padding:
                      '36px 30px 30px',
                    boxSizing:
                      'border-box',
                  }}
                >
                  <div
                    className="cdr-perte-animate"
                    style={{
                      color:
                        T.accent,
                      animation:
                        'cdrPerTeFadeUp 420ms 120ms ease both',
                      fontSize: 8.5,
                      fontWeight: 900,
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '.12em',
                    }}
                  >
                    In primo piano
                  </div>

                  <h2
                    className="cdr-perte-animate"
                    style={{
                      margin:
                        '7px 0 6px',
                      fontFamily:
                        FONT.display,
                      fontSize:
                        'clamp(28px,4vw,40px)',
                      lineHeight: .98,
                      letterSpacing:
                        '-.035em',
                      animation:
                        'cdrPerTeFadeUp 500ms 170ms cubic-bezier(.2,.7,.2,1) both',
                    }}
                  >
                    {hero.title}
                  </h2>

                  <div
                    className="cdr-perte-reveal-right"
                    style={{
                      color:
                        T.textMuted,
                      fontSize: 10,
                      fontWeight: 750,
                      animation:
                        'cdrPerTeRevealRight 450ms 230ms ease both',
                    }}
                  >
                    {hero.year ?? '—'}
                    {' · '}
                    <span
                      style={{
                        color:
                          T.accent,
                      }}
                    >
                      ★{' '}
                      {hero.rating
                        ? hero.rating.toFixed(
                            1
                          )
                        : '—'}
                    </span>
                  </div>

                  <div
                    className="cdr-perte-animate"
                    style={{
                      marginTop: 13,
                      color: T.textMuted,
                      animation:
                        'cdrPerTeFadeUp 460ms 280ms ease both',
                      fontSize: 10.5,
                      lineHeight: 1.55,
                      maxWidth: 450,
                    }}
                  >
                    {hero.reason}
                  </div>

                  <div
                    className="cdr-perte-animate"
                    style={{
                      marginTop: 20,
                      animation:
                        'cdrPerTeFadeUp 460ms 340ms ease both',
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void router.push(
                          `/film/${hero.tmdb_id}`
                        )
                      }
                      onMouseEnter={(event) => {
                        event.currentTarget.style.transform =
                          'translateY(-1px)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.transform =
                          'translateY(0)';
                      }}
                      style={{
                        border: 0,
                        background:
                          T.primary,
                        color: '#fff',
                        padding:
                          '9px 12px',
                        cursor:
                          'pointer',
                        fontFamily:
                          FONT.sans,
                        fontSize: 9.5,
                        fontWeight: 900,
                        transition:
                          'transform 160ms ease, opacity 160ms ease',
                      }}
                    >
                      Scheda film
                    </button>

                    <button
                      type="button"
                      disabled={
                        feedbackBusyId ===
                        hero.tmdb_id
                      }
                      onClick={() =>
                        void sendFeedback(
                          hero.tmdb_id,
                          'more_like_this'
                        )
                      }
                      style={{
                        border: `1px solid ${T.border}`,
                        background:
                          heroFeedback ===
                          'more_like_this'
                            ? T.accentGlow
                            : T.surface,
                        animation:
                          learningMovieId === hero.tmdb_id &&
                          heroFeedback === 'more_like_this'
                            ? 'cdrPerTeLearnFlash 700ms ease both'
                            : 'none',
                        color:
                          heroFeedback ===
                          'more_like_this'
                            ? T.accent
                            : T.text,
                        padding:
                          '9px 11px',
                        cursor:
                          'pointer',
                        fontFamily:
                          FONT.sans,
                        fontSize: 9.2,
                        fontWeight: 850,
                        display: 'flex',
                        alignItems:
                          'center',
                        gap: 5,
                      }}
                    >
                      <ThumbsUp
                        size={11}
                        weight={
                          heroFeedback ===
                          'more_like_this'
                            ? 'fill'
                            : 'duotone'
                        }
                      />
                      Più così
                    </button>

                    <button
                      type="button"
                      disabled={
                        feedbackBusyId ===
                        hero.tmdb_id
                      }
                      onClick={() =>
                        void sendFeedback(
                          hero.tmdb_id,
                          'not_for_me'
                        )
                      }
                      style={{
                        border: 0,
                        background:
                          'transparent',
                        color:
                          T.textMuted,
                        padding:
                          '9px 5px',
                        cursor:
                          'pointer',
                        fontFamily:
                          FONT.sans,
                        fontSize: 9.2,
                        fontWeight: 850,
                        display: 'flex',
                        alignItems:
                          'center',
                        gap: 5,
                      }}
                    >
                      <ThumbsDown
                        size={11}
                        weight="duotone"
                      />
                      Non fa per me
                    </button>
                  </div>
                </div>
              </section>

              <div
                key={`sections-${recommendationGeneration}`}
                className="cdr-perte-refresh"
                style={{
                  display: 'grid',
                  gap: 28,
                  animation:
                    recommendationGeneration > 1
                      ? 'cdrPerTeRefreshIn 480ms cubic-bezier(.2,.7,.2,1) both'
                      : 'none',
                }}
              >
                {visibleSections.map(
                  (
                    {
                      key,
                      items,
                    },
                    sectionIndex
                  ) => {
                    const copy =
                      SECTION_COPY[key];

                    return (
                      <section
                        key={key}
                        className="cdr-perte-animate"
                        style={{
                          animation:
                            `cdrPerTeFadeUp 460ms ${120 + sectionIndex * 70}ms ease both`,
                        }}
                      >
                        <div
                          className="cdr-perte-reveal-right"
                          style={{
                            marginBottom: 11,
                            animation:
                              `cdrPerTeRevealRight 460ms ${170 + sectionIndex * 70}ms ease both`,
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            alignItems:
                              'flex-end',
                            gap: 16,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                color:
                                  key ===
                                    'from_rooms' ||
                                  key ===
                                    'exploration'
                                    ? T.primary
                                    : T.accent,
                                fontSize: 8.3,
                                fontWeight:
                                  900,
                                textTransform:
                                  'uppercase',
                                letterSpacing:
                                  '.11em',
                              }}
                            >
                              {
                                copy.eyebrow
                              }
                            </div>

                            <h3
                              style={{
                                margin:
                                  '3px 0 0',
                                fontFamily:
                                  FONT.display,
                                fontSize:
                                  20,
                                lineHeight:
                                  1.05,
                              }}
                            >
                              {
                                copy.title
                              }
                            </h3>

                            <p
                              style={{
                                margin:
                                  '5px 0 0',
                                color:
                                  T.textMuted,
                                fontSize:
                                  9.5,
                                lineHeight:
                                  1.5,
                                maxWidth:
                                  650,
                              }}
                            >
                              {
                                copy.description
                              }
                            </p>
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              'flex',
                            gap: 12,
                            overflowX:
                              'auto',
                            paddingBottom:
                              5,
                            scrollbarWidth:
                              'thin',
                            scrollBehavior:
                              'smooth',
                            scrollSnapType:
                              'x proximity',
                          }}
                        >
                          {items
                            .slice(0, 8)
                            .map(
                              (
                                movie,
                                movieIndex
                              ) => (
                                <div
                                  key={movie.tmdb_id}
                                  className="cdr-perte-animate"
                                  style={{
                                    animation:
                                      `cdrPerTeFadeUp 420ms ${220 + sectionIndex * 70 + movieIndex * 45}ms ease both`,
                                  }}
                                >
                                <PosterCard
                                  movie={
                                    movie
                                  }
                                  feedback={
                                    feedbackByMovie[
                                      movie
                                        .tmdb_id
                                    ]
                                  }
                                  busy={
                                    feedbackBusyId ===
                                    movie
                                      .tmdb_id
                                  }
                                  learning={
                                    learningMovieId ===
                                    movie.tmdb_id
                                  }
                                  onOpen={() =>
                                    void router.push(
                                      `/film/${movie.tmdb_id}`
                                    )
                                  }
                                  onFeedback={(
                                    feedback
                                  ) =>
                                    void sendFeedback(
                                      movie.tmdb_id,
                                      feedback
                                    )
                                  }
                                  T={T}
                                />
                                </div>
                              )
                            )}
                        </div>
                      </section>
                    );
                  }
                )}
              </div>
            </>
          ) : (
            <section
              style={{
                border: `1px dashed ${T.border}`,
                background:
                  T.surface,
                padding: 28,
                textAlign: 'center',
              }}
            >
              <FilmSlate
                size={30}
                color={T.accent}
                weight="duotone"
              />

              <h2
                style={{
                  margin:
                    '10px 0 5px',
                  fontFamily:
                    FONT.display,
                  fontSize: 22,
                }}
              >
                Il tuo Per te deve
                ancora prendere forma
              </h2>

              <p
                style={{
                  margin:
                    '0 auto',
                  maxWidth: 520,
                  color:
                    T.textMuted,
                  fontSize: 10.5,
                  lineHeight: 1.6,
                }}
              >
                Aggiungi qualche
                preferito, dai dei voti
                e usa le stanze: sono i
                segnali più forti per
                costruire consigli
                davvero personali.
              </p>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
