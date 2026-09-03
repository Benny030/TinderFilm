'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  FilmSlate,
  Sparkle,
  Star,
  TrendUp,
  ThumbsUp,
  ThumbsDown,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';

const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  border: '#2d221c',
  gold: '#f5b92f',
  goldGlow: 'rgba(245,185,47,0.12)',
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
  goldGlow: 'rgba(184,134,11,0.10)',
  pink: '#b83060',
  text: '#1f1a16',
  muted: '#5c5248',
  faint: '#8a7c6e',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";

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
  const P = theme === 'dark' ? D : L;
  const { currentUser, isGuest, isLoading } = useAuth();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [movies, setMovies] = useState<RecommendationMovie[]>([]);
  const [meta, setMeta] = useState<RecommendationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackByMovie, setFeedbackByMovie] = useState<Record<number, 'more_like_this' | 'not_for_me'>>({});
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
          throw new Error(data.error || 'Impossibile caricare i consigli');
        }

        if (!cancelled) {
          setMovies(Array.isArray(data.recommendations) ? data.recommendations : []);
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
              : 'Impossibile caricare i consigli',
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
    feedback: 'more_like_this' | 'not_for_me',
  ) => {
    setFeedbackBusyId(movieId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error('Sessione non disponibile');

      const isUndo = feedbackByMovie[movieId] === feedback;

      const response = await fetch('/api/recommendations/feedback', {
        method: isUndo ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isUndo
            ? { tmdb_id: movieId }
            : { tmdb_id: movieId, feedback },
        ),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Impossibile salvare il feedback');
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
          current.filter((movie) => movie.tmdb_id !== movieId)
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile salvare il feedback',
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
          background: P.bg,
          color: P.text,
          fontFamily: FONT,
        }}
      >
        <FilmSlate size={42} color={P.pink} weight="duotone" />
      </div>
    );
  }

  return (
    <AppShell activeNav="home">
      <div
        style={{
          minHeight: '100vh',
          background: P.bg,
          color: P.text,
          fontFamily: FONT,
        }}
      >
        <style>{`
          .fy-shell {
            max-width: 1180px;
            margin: 0 auto;
            padding: 24px 20px 70px;
          }

          .fy-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0,1fr));
            gap: 14px;
          }

          .fy-card {
            background: var(--fy-card);
            border: 1px solid var(--fy-border);
            cursor: pointer;
            padding: 0;
            color: inherit;
            text-align: left;
            font-family: inherit;
            transition: transform .2s ease, border-color .2s ease;
            overflow: hidden;
          }

          .fy-card:hover {
            transform: translateY(-3px);
            border-color: var(--fy-gold);
          }

          .fy-poster {
            width: 100%;
            aspect-ratio: 2 / 3;
            object-fit: cover;
            display: block;
            background: var(--fy-soft);
          }

          @media (min-width: 720px) {
            .fy-grid {
              grid-template-columns: repeat(3, minmax(0,1fr));
            }
          }

          @media (min-width: 1024px) {
            .fy-shell {
              padding: 30px 28px 80px;
            }

            .fy-grid {
              grid-template-columns: repeat(5, minmax(0,1fr));
              gap: 16px;
            }
          }

          @media (max-width: 540px) {
            .fy-shell {
              padding: 16px 12px 60px;
            }

            .fy-grid {
              gap: 10px;
            }
          }
        `}</style>

        <div
          className="fy-shell"
          style={{
            ['--fy-card' as any]: P.card,
            ['--fy-border' as any]: P.border,
            ['--fy-gold' as any]: P.gold,
            ['--fy-soft' as any]: P.bgSoft,
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: 'none',
              background: 'transparent',
              color: P.muted,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 800,
              padding: 0,
              marginBottom: 20,
            }}
          >
            <ArrowLeft size={17} />
            Indietro
          </button>

          <section
            style={{
              border: `1px solid ${P.border}`,
              background: P.card,
              padding: 20,
              marginBottom: 22,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '0 auto auto 0',
                width: '100%',
                height: 3,
                background: P.gold,
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                color: P.gold,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
              }}
            >
              <Sparkle size={15} weight="fill" />
              Per te
            </div>

            <h1
              style={{
                margin: '8px 0 0',
                fontSize: 'clamp(28px,5vw,42px)',
                lineHeight: 1,
                letterSpacing: '-.04em',
              }}
            >
              Film scelti sui tuoi gusti
            </h1>

            <p
              style={{
                margin: '10px 0 0',
                color: P.muted,
                fontSize: 13,
                maxWidth: 680,
                lineHeight: 1.55,
              }}
            >
              I consigli cambiano con preferiti, voti, match, swipe e scelte fatte nelle stanze.
            </p>

            {meta && (
              <div
                style={{
                  marginTop: 16,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.bgSoft,
                    padding: '6px 9px',
                    fontSize: 10,
                    fontWeight: 800,
                    color: P.muted,
                  }}
                >
                  {meta.seeds_used} segnali forti
                </span>

                <span
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.bgSoft,
                    padding: '6px 9px',
                    fontSize: 10,
                    fontWeight: 800,
                    color: P.muted,
                  }}
                >
                  {meta.taste_genres ?? 0} generi capiti
                </span>

                <span
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.bgSoft,
                    padding: '6px 9px',
                    fontSize: 10,
                    fontWeight: 800,
                    color: P.muted,
                  }}
                >
                  {meta.taste_actors ?? 0} attori ricorrenti
                </span>
              </div>
            )}
            {meta?.cold_start_used &&
              (meta.profile_genres?.length ?? 0) > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    border: `1px solid ${P.gold}`,
                    background: P.goldGlow,
                    padding: 12,
                    color: P.muted,
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  Sto iniziando dai generi che hai scelto nel profilo:
                  <strong style={{ color: P.gold }}>
                    {' '}
                    {meta.profile_genres?.slice(0, 4).join(' · ')}
                  </strong>
                  . Più usi TinderFilm, più questi consigli diventeranno precisi.
                </div>
              )}

            {meta &&
              ((meta.top_genres?.length ?? 0) > 0 ||
                (meta.top_actors?.length ?? 0) > 0) && (
                <div
                  style={{
                    marginTop: 14,
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(220px,1fr))',
                    gap: 10,
                  }}
                >
                  {(meta.top_genres?.length ?? 0) > 0 && (
                    <div
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.bgSoft,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          color: P.faint,
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '.08em',
                          fontWeight: 850,
                        }}
                      >
                        I tuoi generi
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginTop: 8,
                        }}
                      >
                        {meta.top_genres?.map((genre, index) => (
                          <span
                            key={genre.id}
                            style={{
                              border: `1px solid ${
                                index === 0 ? P.gold : P.border
                              }`,
                              background:
                                index === 0 ? P.goldGlow : P.card,
                              color: index === 0 ? P.gold : P.muted,
                              padding: '6px 8px',
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            {genre.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(meta.top_actors?.length ?? 0) > 0 && (
                    <div
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.bgSoft,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          color: P.faint,
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '.08em',
                          fontWeight: 850,
                        }}
                      >
                        Attori ricorrenti
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginTop: 8,
                        }}
                      >
                        {meta.top_actors?.map((actor, index) => (
                          <span
                            key={actor.id}
                            style={{
                              border: `1px solid ${
                                index === 0 ? P.pink : P.border
                              }`,
                              background:
                                index === 0 ? 'rgba(237,61,115,0.12)' : P.card,
                              color: index === 0 ? P.pink : P.muted,
                              padding: '6px 8px',
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            {actor.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

          </section>

          {meta && !loading && !error && (
            <section
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div
                    style={{
                      color: P.pink,
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.11em',
                    }}
                  >
                    Il tuo profilo gusti
                  </div>
                  <div style={{ color: P.text, fontSize: 16, fontWeight: 900, marginTop: 3 }}>
                    {meta.personalized
                      ? 'Consigli costruiti sui tuoi gusti'
                      : 'Stiamo ancora imparando cosa ti piace'}
                  </div>
                  <div style={{ color: P.muted, fontSize: 10, marginTop: 4 }}>
                    {meta.positive_signals ?? 0} segnali positivi · {meta.seeds_used ?? 0} film usati
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => router.push('/libreria?tab=preferiti')}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.bgSoft,
                      color: P.text,
                      padding: '7px 9px',
                      fontFamily: FONT,
                      fontSize: 9.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Preferiti
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/profilo')}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.bgSoft,
                      color: P.text,
                      padding: '7px 9px',
                      fontFamily: FONT,
                      fontSize: 9.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Profilo gusti
                  </button>
                </div>
              </div>

              {meta.top_genres && meta.top_genres.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: 8.5,
                      color: P.faint,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.09em',
                      marginBottom: 6,
                    }}
                  >
                    Generi che pesano di più
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {meta.top_genres.slice(0, 5).map((genre) => (
                      <span
                        key={genre.id}
                        style={{
                          border: `1px solid ${P.border}`,
                          background: P.bgSoft,
                          color: P.muted,
                          padding: '5px 7px',
                          fontSize: 9.5,
                          fontWeight: 750,
                        }}
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {loading ? (
  

          <div className="fy-grid">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.card,
                    aspectRatio: '2 / 3.7',
                  }}
                />
              ))}
            </div>
          ) : error ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 18,
                color: P.pink,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : movies.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: 24,
                textAlign: 'center',
                color: P.muted,
              }}
            >
              <TrendUp size={28} color={P.gold} weight="duotone" />
              <div style={{ fontWeight: 850, marginTop: 10, color: P.text }}>
                Il tuo profilo gusti è ancora vuoto
              </div>
              <div style={{ fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
                Aggiungi preferiti, vota film o partecipa alle stanze per ricevere consigli più personali.
              </div>
            </div>
          ) : (
            <div className="fy-grid">
              {movies.map((movie) => (
                <div
                  key={movie.tmdb_id}
                  className="fy-card"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/film/${movie.tmdb_id}`)}
                    style={{
                      display: 'block',
                      width: '100%',
                      border: 0,
                      padding: 0,
                      background: 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                  {movie.cover ? (
                    <img
                      src={movie.cover}
                      alt={movie.title}
                      className="fy-poster"
                    />
                  ) : (
                    <div
                      className="fy-poster"
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        color: P.faint,
                      }}
                    >
                      <FilmSlate size={30} weight="duotone" />
                    </div>
                  )}

                  <div style={{ padding: '10px 10px 12px' }}>
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
                        color: P.gold,
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      <Star size={12} weight="fill" />
                      {movie.rating ? movie.rating.toFixed(1) : '—'}
                      {movie.year ? ` · ${movie.year}` : ''}
                    </div>

                    <div
                      style={{
                        marginTop: 7,
                        color: P.faint,
                        fontSize: 10,
                        lineHeight: 1.4,
                        minHeight: 42,
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
                      gap: 6,
                      padding: '0 10px 10px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void sendFeedback(movie.tmdb_id, 'more_like_this')
                      }
                      disabled={feedbackBusyId === movie.tmdb_id}
                      style={{
                        border: `1px solid ${
                          feedbackByMovie[movie.tmdb_id] === 'more_like_this'
                            ? P.gold
                            : P.border
                        }`,
                        background:
                          feedbackByMovie[movie.tmdb_id] === 'more_like_this'
                            ? P.goldGlow
                            : P.bgSoft,
                        color:
                          feedbackByMovie[movie.tmdb_id] === 'more_like_this'
                            ? P.gold
                            : P.muted,
                        padding: '7px 6px',
                        cursor:
                          feedbackBusyId === movie.tmdb_id
                            ? 'wait'
                            : 'pointer',
                        fontFamily: FONT,
                        fontSize: 9.5,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}
                    >
                      <ThumbsUp size={12} weight="duotone" />
                      Più così
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void sendFeedback(movie.tmdb_id, 'not_for_me')
                      }
                      disabled={feedbackBusyId === movie.tmdb_id}
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.bgSoft,
                        color: P.faint,
                        padding: '7px 6px',
                        cursor:
                          feedbackBusyId === movie.tmdb_id
                            ? 'wait'
                            : 'pointer',
                        fontFamily: FONT,
                        fontSize: 9.5,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}
                    >
                      <ThumbsDown size={12} weight="duotone" />
                      Non fa per me
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
