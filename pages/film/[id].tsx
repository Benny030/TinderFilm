'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, CalendarBlank, Clock, FilmSlate, Play, Star, UserCircle } from '@phosphor-icons/react';

// ─── Palette dark "cinema elegante" ──────────────────────────────────────
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
  pinkDeep: '#8e1740',
  pinkGlow: 'rgba(237,61,115,0.15)',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
  overlayDark: 'rgba(10,8,6,0.74)',
  overlayMid: 'rgba(10,8,6,0.26)',
  overlayLight: 'rgba(10,8,6,0.04)',
};

// ─── Palette light "cinema elegante" ──────────────────────────────────────
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
  pinkDeep: '#8a1d44',
  pinkGlow: 'rgba(184,48,96,0.10)',
  text: '#1f1a16',        // ora usato per anno, durata, voto
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
  overlayDark: 'rgba(31,26,22,0.74)',
  overlayMid: 'rgba(31,26,22,0.26)',
  overlayLight: 'rgba(31,26,22,0.04)',
};

const FONT_SANS = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type SimilarMovie = { tmdb_id: number; title: string; year: number; cover: string | null; rating: number };
type CastMember = { id: number; name: string; character: string; profile: string | null };
type MovieDetail = {
  tmdb_id: number; title: string; year: number; genre: string; cover: string | null; backdrop: string | null;
  trailer: string | null; trama_c: string | null; rating: number; vote_count: number; runtime: string | null;
  tagline: string | null; director: string | null; cast: CastMember[]; similar: SimilarMovie[];
};

const fallbackPoster = 'https://placehold.co/342x513/F4EEE6/6E6258?text=Film';

export default function FilmDetailPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSpoiler, setShowSpoiler] = useState(false);
  const [revealedCastIds, setRevealedCastIds] = useState<Set<number>>(new Set());
  const movieId = typeof router.query.id === 'string' ? router.query.id : null;

  useEffect(() => {
    if (!movieId) return;
    const loadMovie = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/tmdb/movie/${movieId}`);
        if (!response.ok) throw new Error('Film non trovato');
        setMovie(await response.json());
      } catch (error) {
        console.error(error);
        setMovie(null);
      } finally {
        setLoading(false);
      }
    };
    loadMovie();
  }, [movieId]);

  const trailerKey = movie?.trailer ? new URL(movie.trailer).searchParams.get('v') : null;

  const toggleCastReveal = (id: number) => {
    setRevealedCastIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <AppShell activeNav="home">
        <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', color: P.textMuted, background: P.bg, fontFamily: FONT_SANS }}>
          <FilmSlate size={38} color={P.pink} weight="duotone" />
        </div>
      </AppShell>
    );
  }

  if (!movie) {
    return (
      <AppShell activeNav="home">
        <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', color: P.textMuted, background: P.bg, fontFamily: FONT_SANS }}>
          <div style={{ textAlign: 'center' }}>
            <p>Non siamo riusciti a trovare questo film.</p>
            <button
              onClick={() => router.push('/home')}
              style={{
                marginTop: 16,
                padding: '10px 20px',
                background: P.pink,
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT_SANS,
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 0,
              }}
            >
              Torna alla home
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const heroBackground = movie.backdrop
    ? `linear-gradient(90deg, ${P.overlayDark} 0%, ${P.overlayMid} 60%, ${P.overlayLight} 100%), linear-gradient(0deg, ${P.bg} 0%, transparent 42%), url(${movie.backdrop})`
    : `linear-gradient(90deg, ${P.overlayDark} 0%, ${P.overlayMid} 60%, ${P.overlayLight} 100%), linear-gradient(0deg, ${P.bg} 0%, transparent 42%)`;

  return (
    <AppShell activeNav="home">
      <main style={{ paddingBottom: 96, background: P.bg, fontFamily: FONT_SANS, minHeight: '100vh', color: P.text }}>
        <section
          style={{
            height: 390,
            position: 'relative',
            background: heroBackground,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <button
            onClick={() => router.back()}
            aria-label="Torna indietro"
            style={{
              position: 'absolute',
              top: 18,
              left: 18,
              zIndex: 3,
              width: 42,
              height: 42,
              border: 0,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.72)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ArrowLeft size={21} />
          </button>

          <div
            style={{
              position: 'absolute',
              zIndex: 2,
              left: 'calc(50% - min(42%, 430px))',
              bottom: 42,
              color: '#fff',
              maxWidth: 500,
            }}
          >
            <span style={{
              background: P.pinkGlow,
              color: P.pink,
              borderRadius: 999,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 700,
              border: `1px solid ${P.pink}`,
            }}>
              {movie.genre || 'Film'}
            </span>
            <h1 style={{
              fontSize: 'clamp(30px, 4vw, 48px)',
              lineHeight: 1.04,
              margin: '10px 0',
              letterSpacing: '-0.035em',
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              color: '#fff',
            }}>
              {movie.title}
            </h1>
            {movie.tagline && (
              <div style={{ fontStyle: 'italic', opacity: 0.9, fontSize: 15 }}>
                {movie.tagline}
              </div>
            )}
          </div>
        </section>

        <div style={{ maxWidth: 1060, margin: '-18px auto 0', position: 'relative', padding: '0 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '190px minmax(0,1fr)',
            gap: 30,
            alignItems: 'start',
          }}>
            <img
              src={movie.cover || fallbackPoster}
              alt={`Locandina di ${movie.title}`}
              style={{
                width: 190,
                borderRadius: 20,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                background: P.bgSoft,
              }}
            />
            <div>
              {/* Qui ho cambiato color: P.textMuted → P.text per i valori */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px 18px',
                color: P.text,          // <--- ora usa P.text (scuro in light mode)
                fontSize: 13,
              }}>
                {movie.year > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CalendarBlank size={16} />
                    {movie.year}
                  </span>
                )}
                {movie.runtime && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={16} />
                    {movie.runtime}
                  </span>
                )}
                {movie.rating > 0 && (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    color: P.gold,
                    fontWeight: 700,
                  }}>
                    <Star size={16} weight="fill" />
                    {movie.rating.toFixed(1)}
                    <span style={{ color: P.textMuted, fontWeight: 400 }}>
                      ({movie.vote_count.toLocaleString('it-IT')} voti)
                    </span>
                  </span>
                )}
              </div>
              {movie.director && (
                <p style={{ color: P.textMuted, fontSize: 13, margin: '15px 0 0' }}>
                  Regia di <strong style={{ color: P.text }}>{movie.director}</strong>
                </p>
              )}
              <div
                onClick={() => movie.trama_c && setShowSpoiler((value) => !value)}
                role={movie.trama_c ? 'button' : undefined}
                tabIndex={movie.trama_c ? 0 : undefined}
                onKeyDown={(e) => {
                  if (movie.trama_c && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setShowSpoiler((value) => !value);
                  }
                }}
                aria-label={movie.trama_c ? (showSpoiler ? 'Nascondi spoiler' : 'Mostra trama') : undefined}
                style={{
                  position: 'relative',
                  marginTop: 16,
                  cursor: movie.trama_c ? 'pointer' : 'default',
                  overflow: 'hidden',
                  borderRadius: 12,
                }}
              >
                <p style={{
                  color: P.text,
                  fontSize: 15,
                  lineHeight: 1.7,
                  margin: 0,
                  filter: movie.trama_c && !showSpoiler ? 'blur(8px)' : 'none',
                  userSelect: movie.trama_c && !showSpoiler ? 'none' : 'text',
                  transition: 'filter 0.25s ease',
                }}>
                  {movie.trama_c || 'La trama non è ancora disponibile.'}
                </p>

                {movie.trama_c && !showSpoiler && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: isDark
                      ? 'rgba(10,8,6,0.28)'
                      : 'rgba(245,239,232,0.35)',
                    backdropFilter: 'blur(2px)',
                  }}>
                    <span style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      background: P.pink,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    }}>
                      👁 Clicca per mostrare la trama
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <section style={{ marginTop: 38 }}>
            <h2 style={{
              fontSize: 20,
              margin: '0 0 15px',
              color: P.text,
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
            }}>
              Trailer
            </h2>
            {trailerKey ? (
              <iframe
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  border: 0,
                  borderRadius: 20,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  background: '#201B18',
                }}
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}`}
                title={`Trailer di ${movie.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div style={{
                minHeight: 190,
                border: `1.5px dashed ${P.border}`,
                borderRadius: 20,
                display: 'grid',
                placeItems: 'center',
                color: P.textMuted,
                textAlign: 'center',
                background: P.bgSoft,
              }}>
                <div>
                  <Play size={32} color={P.pink} weight="fill" />
                  <p>Trailer non disponibile al momento.</p>
                </div>
              </div>
            )}
          </section>

          {movie.cast.length > 0 && (
            <section style={{ marginTop: 38 }}>
              <h2 style={{
                fontSize: 20,
                margin: '0 0 15px',
                color: P.text,
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
              }}>
                Nel cast
              </h2>
              <div style={{
                display: 'flex',
                gap: 14,
                overflowX: 'auto',
                padding: '2px 1px 9px',
                scrollbarWidth: 'none',
              }}>
                {movie.cast.map((person) => {
                  const isRevealed = revealedCastIds.has(person.id);
                  return (
                    <div
                      key={person.id}
                      onClick={() => toggleCastReveal(person.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleCastReveal(person.id);
                        }
                      }}
                      style={{
                        minWidth: 106,
                        maxWidth: 106,
                        fontSize: 12,
                        color: P.text,
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 12,
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                      }}
                      title="Clicca per mostrare/nascondere"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.03)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <div
                        style={{
                          filter: isRevealed ? 'none' : 'blur(8px)',
                          transition: 'filter 0.3s ease',
                        }}
                      >
                        {person.profile ? (
                          <img
                            src={person.profile}
                            alt={person.name}
                            style={{
                              width: 106,
                              height: 106,
                              objectFit: 'cover',
                              borderRadius: '50%',
                              background: P.bgSoft,
                              display: 'block',
                              marginBottom: 8,
                            }}
                          />
                        ) : (
                          <div style={{
                            width: 106,
                            height: 106,
                            borderRadius: '50%',
                            background: P.bgSoft,
                            display: 'grid',
                            placeItems: 'center',
                            marginBottom: 8,
                          }}>
                            <UserCircle size={50} color={P.textFaint} />
                          </div>
                        )}
                        <strong style={{ display: 'block', color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {person.name}
                        </strong>
                        <span style={{ color: P.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {person.character}
                        </span>
                      </div>

                      {!isRevealed && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'grid',
                            placeItems: 'center',
                            background: isDark
                              ? 'rgba(10,8,6,0.28)'
                              : 'rgba(245,239,232,0.35)',
                            pointerEvents: 'none',
                            transition: 'opacity 0.3s ease',
                            borderRadius: 12,
                          }}
                        >
                          <span style={{
                            padding: '6px 9px',
                            borderRadius: 999,
                            background: P.pink,
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 800,
                            textAlign: 'center',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                          }}>
                            👁 Mostra
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {movie.similar.length > 0 && (
            <section style={{ marginTop: 38 }}>
              <h2 style={{
                fontSize: 20,
                margin: '0 0 15px',
                color: P.text,
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
              }}>
                Film simili
              </h2>
              <div style={{
                display: 'flex',
                gap: 14,
                overflowX: 'auto',
                padding: '2px 1px 9px',
                scrollbarWidth: 'none',
              }}>
                {movie.similar.map((item) => (
                  <button
                    key={item.tmdb_id}
                    onClick={() => router.push(`/film/${item.tmdb_id}`)}
                    style={{
                      minWidth: 132,
                      width: 132,
                      cursor: 'pointer',
                      border: 0,
                      padding: 0,
                      background: 'none',
                      textAlign: 'left',
                      fontFamily: FONT_SANS,
                      color: P.text,
                    }}
                  >
                    <img
                      src={item.cover || fallbackPoster}
                      alt={`Locandina di ${item.title}`}
                      style={{
                        width: 132,
                        aspectRatio: '2/3',
                        objectFit: 'cover',
                        borderRadius: 14,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        display: 'block',
                        transition: 'transform 0.18s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    />
                    <strong style={{
                      display: 'block',
                      marginTop: 8,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: P.text,
                    }}>
                      {item.title}
                    </strong>
                    <span style={{ color: P.textMuted, fontSize: 12 }}>
                      {item.year || '—'}
                      {item.rating > 0 ? ` · ★ ${item.rating.toFixed(1)}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}   