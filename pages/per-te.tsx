'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  FilmSlate,
  Sparkle,
  Star,
  TrendUp,
  ThumbsUp,
  ThumbsDown,
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
  based_on: Array<{
    tmdb_id: number;
    title: string | null;
    weight: number;
  }>;
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

export default function PerTePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const T = theme === 'dark' ? THEME.dark : THEME.light;
  const { currentUser, isGuest, isLoading } = useAuth();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [movies, setMovies] = useState<RecommendationMovie[]>([]);
  const [meta, setMeta] = useState<RecommendationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackByMovie, setFeedbackByMovie] = useState<
    Record<number, 'more_like_this' | 'not_for_me'>
  >({});
  const [feedbackBusyId, setFeedbackBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      setLoading(false);
      setMovies([]);
      setMeta(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const token = session?.access_token;

        if (!token) {
          throw new Error('Sessione non disponibile');
        }

        const response = await fetch('/api/recommendations/for-you', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error || 'Impossibile caricare i consigli'
          );
        }

        if (!cancelled) {
          setMovies(
            Array.isArray(data.recommendations)
              ? data.recommendations
              : []
          );
          setMeta(data.meta ?? null);
          setFeedbackByMovie(
            data.feedback && typeof data.feedback === 'object'
              ? data.feedback
              : {}
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossibile caricare i consigli'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isGuest, isLoading, supabase]);

  const sendFeedback = async (
    movieId: number,
    feedback: 'more_like_this' | 'not_for_me'
  ) => {
    setFeedbackBusyId(movieId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        throw new Error('Sessione non disponibile');
      }

      const isUndo =
        feedbackByMovie[movieId] === feedback;

      const response = await fetch(
        '/api/recommendations/feedback',
        {
          method: isUndo ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            isUndo
              ? { tmdb_id: movieId }
              : { tmdb_id: movieId, feedback }
          ),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossibile salvare il feedback'
        );
      }

      if (isUndo) {
        setFeedbackByMovie((current) => {
          const next = { ...current };
          delete next[movieId];
          return next;
        });
        return;
      }

      setFeedbackByMovie((current) => ({
        ...current,
        [movieId]: feedback,
      }));

      if (feedback === 'not_for_me') {
        setMovies((current) =>
          current.filter(
            (movie) => movie.tmdb_id !== movieId
          )
        );
      }
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

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: T.bg,
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
            maxWidth: 1180,
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
                } else {
                  void router.push('/home');
                }
              }}
            />
          </div>

          <section
            style={{
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: 20,
              marginBottom: 20,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: T.accent,
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                color: T.accent,
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
              }}
            >
              <Sparkle
                size={14}
                weight="fill"
              />
              Per te
            </div>

            <h1
              style={{
                margin: '7px 0 0',
                fontFamily: FONT.display,
                fontSize: 'clamp(30px,5vw,44px)',
                lineHeight: 1,
                letterSpacing: '-.025em',
              }}
            >
              Film scelti sui tuoi gusti
            </h1>

            <p
              style={{
                margin: '10px 0 0',
                color: T.textMuted,
                fontSize: 12.5,
                maxWidth: 720,
                lineHeight: 1.6,
              }}
            >
              I consigli cambiano con preferiti, voti, match,
              swipe e scelte fatte nelle stanze.
            </p>
 
            {meta?.cold_start_used &&
              (meta.profile_genres?.length ?? 0) > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    borderLeft: `2px solid ${T.accent}`,
                    background: T.accentGlow,
                    padding: '10px 12px',
                    color: T.textMuted,
                    fontSize: 10.5,
                    lineHeight: 1.55,
                  }}
                >
                  Sto iniziando dai generi che hai scelto nel
                  profilo:{' '}
                  <strong style={{ color: T.accent }}>
                    {meta.profile_genres
                      ?.slice(0, 4)
                      .join(' · ')}
                  </strong>
                  . Più usi Cinedate, più questi consigli
                  diventano precisi.
                </div>
              )}
          </section>

          {meta &&
            !loading &&
            !error && (
              <section
                style={{
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  padding: 14,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: T.primary,
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '.11em',
                      }}
                    >
                      Il tuo profilo gusti
                    </div>

                    <div
                      style={{
                        color: T.text,
                        fontFamily: FONT.display,
                        fontSize: 18,
                        fontWeight: 800,
                        marginTop: 3,
                      }}
                    >
                      {meta.personalized
                        ? 'Consigli costruiti sui tuoi gusti'
                        : 'Stiamo ancora imparando cosa ti piace'}
                    </div>

                    <div
                      style={{
                        color: T.textMuted,
                        fontSize: 10,
                        marginTop: 4,
                      }}
                    >
                      {meta.positive_signals ?? 0} segnali
                      positivi · {meta.seeds_used ?? 0} film usati
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 7,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void router.push(
                          '/libreria?tab=preferiti'
                        )
                      }
                      style={{
                        border: `1px solid ${T.border}`,
                        background: T.bgSoft,
                        color: T.text,
                        padding: '7px 9px',
                        fontFamily: FONT.sans,
                        fontSize: 9.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Preferiti
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void router.push('/profilo')
                      }
                      style={{
                        border: `1px solid ${T.border}`,
                        background: T.bgSoft,
                        color: T.text,
                        padding: '7px 9px',
                        fontFamily: FONT.sans,
                        fontSize: 9.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Profilo gusti
                    </button>
                  </div>
                </div>

                {meta.top_genres &&
                  meta.top_genres.length > 0 && (
                    <div
                      style={{
                        marginTop: 13,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 8.5,
                          color: T.textFaint,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '.09em',
                          marginBottom: 7,
                        }}
                      >
                        Generi che pesano di più
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 9,
                          flexWrap: 'wrap',
                          color: T.textMuted,
                          fontSize: 9.5,
                          fontWeight: 800,
                        }}
                      >
                        {meta.top_genres
                          .slice(0, 5)
                          .map((genre, index) => (
                            <span key={genre.id}>
                              {index > 0 ? '· ' : ''}
                              {genre.name}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                {meta.top_actors &&
                  meta.top_actors.length > 0 && (
                    <div
                      style={{
                        marginTop: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 8.5,
                          color: T.textFaint,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '.09em',
                          marginBottom: 7,
                        }}
                      >
                        Attori ricorrenti
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 9,
                          flexWrap: 'wrap',
                          color: T.textMuted,
                          fontSize: 9.5,
                          fontWeight: 800,
                        }}
                      >
                        {meta.top_actors
                          .slice(0, 5)
                          .map((actor, index) => (
                            <span key={actor.id}>
                              {index > 0 ? '· ' : ''}
                              {actor.name}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
              </section>
            )}

          {loading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(150px,1fr))',
                gap: 12,
              }}
            >
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    minHeight: 300,
                  }}
                />
              ))}
            </div>
          ) : error ? (
            <div
              style={{
                border: `1px solid ${T.primary}55`,
                background: T.primaryGlow,
                padding: 16,
                color: T.primary,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          ) : movies.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${T.border}`,
                background: T.surface,
                padding: 30,
                textAlign: 'center',
                color: T.textMuted,
              }}
            >
              <TrendUp
                size={30}
                color={T.accent}
                weight="duotone"
              />

              <div
                style={{
                  fontWeight: 850,
                  marginTop: 10,
                  color: T.text,
                }}
              >
                Il tuo profilo gusti è ancora vuoto
              </div>

              <div
                style={{
                  fontSize: 11,
                  marginTop: 5,
                  lineHeight: 1.5,
                }}
              >
                Aggiungi preferiti, vota film o partecipa alle
                stanze per ricevere consigli più personali.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(170px,1fr))',
                gap: 14,
              }}
            >
              {movies.map((movie) => {
                const moreLikeThis =
                  feedbackByMovie[movie.tmdb_id] ===
                  'more_like_this';

                const busy =
                  feedbackBusyId === movie.tmdb_id;

                return (
                  <article
                    key={movie.tmdb_id}
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
                        display: 'block',
                        width: '100%',
                        border: 0,
                        padding: 0,
                        background: 'transparent',
                        color: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: FONT.sans,
                      }}
                    >
                      {movie.cover ? (
                        <img
                          src={movie.cover}
                          alt={movie.title}
                          style={{
                            width: '100%',
                            aspectRatio: '2 / 3',
                            objectFit: 'cover',
                            display: 'block',
                            background: T.bgSoft,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '2 / 3',
                            background: T.bgSoft,
                            display: 'grid',
                            placeItems: 'center',
                            color: T.textFaint,
                          }}
                        >
                          <FilmSlate
                            size={30}
                            weight="duotone"
                          />
                        </div>
                      )}

                      <div
                        style={{
                          padding: '10px 10px 11px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
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
                            marginTop: 5,
                            color: T.accent,
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          <Star
                            size={12}
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
                            marginTop: 7,
                            color: T.textFaint,
                            fontSize: 10,
                            lineHeight: 1.45,
                            minHeight: 43,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {movie.reason}
                        </div>
                      </div>
                    </button>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        borderTop: `1px solid ${T.border}`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void sendFeedback(
                            movie.tmdb_id,
                            'more_like_this'
                          )
                        }
                        disabled={busy}
                        style={{
                          border: 0,
                          borderRight: `1px solid ${T.border}`,
                          background: moreLikeThis
                            ? T.accentGlow
                            : 'transparent',
                          color: moreLikeThis
                            ? T.accent
                            : T.textMuted,
                          padding: '8px 6px',
                          cursor: busy
                            ? 'wait'
                            : 'pointer',
                          fontFamily: FONT.sans,
                          fontSize: 9,
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                        }}
                      >
                        <ThumbsUp
                          size={12}
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
                        onClick={() =>
                          void sendFeedback(
                            movie.tmdb_id,
                            'not_for_me'
                          )
                        }
                        disabled={busy}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: T.textFaint,
                          padding: '8px 6px',
                          cursor: busy
                            ? 'wait'
                            : 'pointer',
                          fontFamily: FONT.sans,
                          fontSize: 9,
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                        }}
                      >
                        <ThumbsDown
                          size={12}
                          weight="duotone"
                        />
                        Non fa per me
                      </button>
                    </div>
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
