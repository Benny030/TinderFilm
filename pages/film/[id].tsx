'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  getMovieEntry,
  setFavorite,
  setWatchlist,
  markWatched,
  clearWatched,
  ensureTmdbMovie,
  type UserMovieEntry,
} from '@/utils/movieEntries';
import {
  ArrowLeft, BookmarkSimple, CalendarBlank, CheckCircle, Clock,
  FilmSlate, Heart, PencilSimple, Play, Star, UserCircle, X
} from '@phosphor-icons/react';

// ─── Hook per media query ──────────────────────────────────────────────
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query, matches]);
  return matches;
}

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
  text: '#1f1a16',
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
  const { currentUser, isGuest } = useAuth();
  const supabase = useRef(createBrowserClient()).current;
  const isDark = theme === 'dark';
  const P = isDark ? D : L;
  const isMobile = useMediaQuery('(max-width: 640px)');

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSpoiler, setShowSpoiler] = useState(false);
  const [revealedCastIds, setRevealedCastIds] = useState<Set<number>>(new Set());

  const [entry, setEntry] = useState<UserMovieEntry | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryAction, setEntryAction] = useState<string | null>(null);
  const [entryError, setEntryError] = useState('');

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [publishRating, setPublishRating] = useState(true);
  const [savingReview, setSavingReview] = useState(false);

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

  useEffect(() => {
    if (!movie || !currentUser || currentUser.isGuest || isGuest) {
      setEntry(null);
      return;
    }

    const loadEntry = async () => {
      setEntryLoading(true);
      setEntryError('');

      try {
        const data = await getMovieEntry(supabase, movie.tmdb_id);
        setEntry(data);
        setReviewRating(data?.rating ?? null);
        setReviewText(data?.review_text ?? '');
      } catch (error: any) {
        console.error('Movie entry load failed:', error);
        setEntryError(error.message ?? 'Impossibile caricare il tuo stato per questo film.');
      } finally {
        setEntryLoading(false);
      }
    };

    void loadEntry();
  }, [movie, currentUser, isGuest, supabase]);

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

  const requireAccount = () => {
    if (!currentUser || currentUser.isGuest || isGuest) {
      router.push('/auth');
      return false;
    }
    return true;
  };

  const runEntryAction = async (
    action: string,
    operation: () => Promise<UserMovieEntry>
  ) => {
    if (!requireAccount()) return;
    setEntryAction(action);
    setEntryError('');
    try {
      const updated = await operation();
      setEntry(updated);
      setReviewRating(updated.rating ?? null);
      setReviewText(updated.review_text ?? '');
    } catch (error: any) {
      console.error(`Movie entry action failed (${action}):`, error);
      setEntryError(error.message ?? 'Impossibile aggiornare il film.');
    } finally {
      setEntryAction(null);
    }
  };

  const handleFavorite = () => {
    if (!movie) return;
    void runEntryAction('favorite', () =>
      setFavorite(supabase, movie.tmdb_id, !(entry?.is_favorite ?? false))
    );
  };

  const handleWatchlist = () => {
    if (!movie) return;
    void runEntryAction('watchlist', () =>
      setWatchlist(supabase, movie.tmdb_id, !(entry?.in_watchlist ?? false))
    );
  };

  const handleWatched = () => {
    if (!movie) return;
    void runEntryAction('watched', () =>
      entry?.watched_on
        ? clearWatched(supabase, movie.tmdb_id)
        : markWatched(supabase, movie.tmdb_id)
    );
  };

  const openReview = () => {
    if (!requireAccount()) return;
    setReviewRating(entry?.rating ?? null);
    setReviewText(entry?.review_text ?? '');
    setPublishRating(true);
    setEntryError('');
    setReviewOpen(true);
  };

  const saveReview = async () => {
    if (!movie || !currentUser || currentUser.isGuest || isGuest) return;

    const cleanText = reviewText.trim();
    if (cleanText.length > 3000) {
      setEntryError('La recensione può contenere massimo 3000 caratteri.');
      return;
    }

    setSavingReview(true);
    setEntryError('');

    try {
      const catalogMovie = await ensureTmdbMovie(supabase, movie.tmdb_id);
      const payload = {
        rating: reviewRating,
        review_text: cleanText || null,
        review_visibility: cleanText ? 'public' : 'private',
        rating_visibility:
          reviewRating !== null && publishRating ? 'public' : 'private',
      };

      const { data: existing, error: lookupError } = await supabase
        .from('user_movie_entries')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('movie_id', catalogMovie.id)
        .maybeSingle();

      if (lookupError) throw lookupError;

      let saved: UserMovieEntry | null = null;

      if (existing?.id) {
        const { data, error } = await supabase
          .from('user_movie_entries')
          .update(payload)
          .eq('id', existing.id)
          .eq('user_id', currentUser.id)
          .select('id,user_id,movie_id,rating,review_text,review_updated_at,is_favorite,in_watchlist,watched_on,created_at,updated_at')
          .single<UserMovieEntry>();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from('user_movie_entries')
          .insert({
            user_id: currentUser.id,
            movie_id: catalogMovie.id,
            ...payload,
          })
          .select('id,user_id,movie_id,rating,review_text,review_updated_at,is_favorite,in_watchlist,watched_on,created_at,updated_at')
          .single<UserMovieEntry>();
        if (error) throw error;
        saved = data;
      }

      setEntry(saved);
      setReviewOpen(false);
    } catch (error: any) {
      console.error('Review save failed:', error);
      setEntryError(error.message ?? 'Impossibile salvare la recensione.');
    } finally {
      setSavingReview(false);
    }
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
            height: isMobile ? 220 : 390,
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
              top: isMobile ? 10 : 18,
              left: isMobile ? 10 : 18,
              zIndex: 3,
              width: isMobile ? 34 : 42,
              height: isMobile ? 34 : 42,
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
            <ArrowLeft size={isMobile ? 18 : 21} />
          </button>

          <div
            style={{
              position: 'absolute',
              zIndex: 2,
              left: isMobile ? 16 : 'calc(50% - min(42%, 430px))',
              bottom: isMobile ? 24 : 42,
              color: '#fff',
              maxWidth: isMobile ? '90%' : 500,
            }}
          >
            <span style={{
              background: P.pinkGlow,
              color: P.pink,
              borderRadius: 999,
              padding: isMobile ? '3px 8px' : '5px 10px',
              fontSize: isMobile ? 10 : 12,
              fontWeight: 700,
              border: `1px solid ${P.pink}`,
            }}>
              {movie.genre || 'Film'}
            </span>
            <h1 style={{
              fontSize: isMobile ? 'clamp(24px, 8vw, 32px)' : 'clamp(30px, 4vw, 48px)',
              lineHeight: 1.04,
              margin: isMobile ? '6px 0' : '10px 0',
              letterSpacing: '-0.035em',
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              color: '#fff',
            }}>
              {movie.title}
            </h1>
            {movie.tagline && (
              <div style={{ fontStyle: 'italic', opacity: 0.9, fontSize: isMobile ? 13 : 15 }}>
                {movie.tagline}
              </div>
            )}
          </div>
        </section>

        <div style={{ maxWidth: 1060, margin: '-18px auto 0', position: 'relative', padding: isMobile ? '0 12px' : '0 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '190px minmax(0,1fr)',
            gap: isMobile ? 16 : 30,
            alignItems: 'start',
          }}>
            <img
              src={movie.cover || fallbackPoster}
              alt={`Locandina di ${movie.title}`}
              style={{
                width: isMobile ? 140 : 190,
                justifySelf: isMobile ? 'center' : 'start',
                borderRadius: 20,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                background: P.bgSoft,
              }}
            />
            <div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: isMobile ? '6px 12px' : '8px 18px',
                color: P.text,
                fontSize: isMobile ? 12 : 13,
                justifyContent: isMobile ? 'center' : 'flex-start',
              }}>
                {movie.year > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CalendarBlank size={isMobile ? 14 : 16} />
                    {movie.year}
                  </span>
                )}
                {movie.runtime && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={isMobile ? 14 : 16} />
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
                    <Star size={isMobile ? 14 : 16} weight="fill" />
                    {movie.rating.toFixed(1)}
                    <span style={{ color: P.textMuted, fontWeight: 400, fontSize: isMobile ? 11 : 13 }}>
                      ({movie.vote_count.toLocaleString('it-IT')} voti)
                    </span>
                  </span>
                )}
              </div>
              {movie.director && (
                <p style={{ color: P.textMuted, fontSize: isMobile ? 12 : 13, margin: '10px 0 0', textAlign: isMobile ? 'center' : 'left' }}>
                  Regia di <strong style={{ color: P.text }}>{movie.director}</strong>
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 16,
                  justifyContent: isMobile ? 'center' : 'flex-start',
                }}
              >
                <button
                  onClick={handleFavorite}
                  disabled={entryLoading || entryAction !== null}
                  style={{
                    border: `1px solid ${entry?.is_favorite ? P.pink : P.border}`,
                    background: entry?.is_favorite ? P.pinkGlow : P.card,
                    color: entry?.is_favorite ? P.pink : P.textMuted,
                    padding: '9px 12px',
                    cursor: entryAction ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: FONT_SANS,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  <Heart size={16} weight={entry?.is_favorite ? 'fill' : 'regular'} />
                  {entry?.is_favorite ? 'Preferito' : 'Preferiti'}
                </button>

                <button
                  onClick={handleWatchlist}
                  disabled={entryLoading || entryAction !== null}
                  style={{
                    border: `1px solid ${entry?.in_watchlist ? P.gold : P.border}`,
                    background: entry?.in_watchlist ? P.goldGlow : P.card,
                    color: entry?.in_watchlist ? P.gold : P.textMuted,
                    padding: '9px 12px',
                    cursor: entryAction ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: FONT_SANS,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  <BookmarkSimple size={16} weight={entry?.in_watchlist ? 'fill' : 'regular'} />
                  {entry?.in_watchlist ? 'In watchlist' : 'Watchlist'}
                </button>

                <button
                  onClick={handleWatched}
                  disabled={entryLoading || entryAction !== null}
                  style={{
                    border: `1px solid ${entry?.watched_on ? '#4ade80' : P.border}`,
                    background: entry?.watched_on ? 'rgba(74,222,128,0.10)' : P.card,
                    color: entry?.watched_on ? '#4ade80' : P.textMuted,
                    padding: '9px 12px',
                    cursor: entryAction ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: FONT_SANS,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  <CheckCircle size={16} weight={entry?.watched_on ? 'fill' : 'regular'} />
                  {entry?.watched_on ? 'Visto' : 'Segna visto'}
                </button>

                <button
                  onClick={openReview}
                  disabled={entryLoading}
                  style={{
                    border: `1px solid ${P.gold}`,
                    background: P.gold,
                    color: '#120d05',
                    padding: '9px 12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: FONT_SANS,
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  <PencilSimple size={16} weight="bold" />
                  {entry?.review_text || entry?.rating ? 'Modifica voto/recensione' : 'Vota / Recensisci'}
                </button>
              </div>

              {entry?.rating !== null && entry?.rating !== undefined && (
                <div style={{
                  marginTop: 10,
                  color: P.gold,
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  justifyContent: isMobile ? 'center' : 'flex-start',
                }}>
                  <Star size={14} weight="fill" />
                  Il tuo voto: {Number(entry.rating).toFixed(1)}/5
                </div>
              )}

              {entryError && (
                <div style={{
                  marginTop: 10,
                  padding: '9px 11px',
                  border: '1px solid rgba(251,113,133,0.28)',
                  background: 'rgba(251,113,133,0.07)',
                  color: '#fb7185',
                  fontSize: 11,
                  textAlign: isMobile ? 'center' : 'left',
                }}>
                  {entryError}
                </div>
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
                  marginTop: 14,
                  cursor: movie.trama_c ? 'pointer' : 'default',
                  overflow: 'hidden',
                  borderRadius: 12,
                }}
              >
                <p style={{
                  color: P.text,
                  fontSize: isMobile ? 14 : 15,
                  lineHeight: 1.7,
                  margin: 0,
                  filter: movie.trama_c && !showSpoiler ? 'blur(8px)' : 'none',
                  userSelect: movie.trama_c && !showSpoiler ? 'none' : 'text',
                  transition: 'filter 0.25s ease',
                  textAlign: isMobile ? 'center' : 'left',
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
                      padding: isMobile ? '6px 12px' : '8px 14px',
                      borderRadius: 5,
                      background: P.pink,
                      color: '#fff',
                      fontSize: isMobile ? 10 : 12,
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

          <section style={{ marginTop: 30 }}>
            <h2 style={{
              fontSize: isMobile ? 18 : 20,
              margin: '0 0 12px',
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
                minHeight: isMobile ? 120 : 190,
                border: `1.5px dashed ${P.border}`,
                borderRadius: 20,
                display: 'grid',
                placeItems: 'center',
                color: P.textMuted,
                textAlign: 'center',
                background: P.bgSoft,
              }}>
                <div>
                  <Play size={isMobile ? 24 : 32} color={P.pink} weight="fill" />
                  <p style={{ fontSize: isMobile ? 13 : 16 }}>Trailer non disponibile al momento.</p>
                </div>
              </div>
            )}
          </section>

          {movie.cast.length > 0 && (
            <section style={{ marginTop: 30 }}>
              <h2 style={{
                fontSize: isMobile ? 18 : 20,
                margin: '0 0 12px',
                color: P.text,
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
              }}>
                Nel cast
              </h2>
              <div style={{
                display: 'flex',
                gap: isMobile ? 10 : 14,
                overflowX: 'auto',
                padding: '2px 1px 9px',
                scrollbarWidth: 'none',
              }}>
                {movie.cast.map((person) => {
                  const isRevealed = revealedCastIds.has(person.id);
                  const size = isMobile ? 80 : 106;
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
                        minWidth: size,
                        maxWidth: size,
                        fontSize: isMobile ? 10 : 12,
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
                              width: size,
                              height: size,
                              objectFit: 'cover',
                              borderRadius: '50%',
                              background: P.bgSoft,
                              display: 'block',
                              marginBottom: 6,
                            }}
                          />
                        ) : (
                          <div style={{
                            width: size,
                            height: size,
                            borderRadius: '50%',
                            background: P.bgSoft,
                            display: 'grid',
                            placeItems: 'center',
                            marginBottom: 6,
                          }}>
                            <UserCircle size={isMobile ? 32 : 50} color={P.textFaint} />
                          </div>
                        )}
                        <strong style={{ display: 'block', color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: isMobile ? 10 : 12 }}>
                          {person.name}
                        </strong>
                        <span style={{ color: P.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', fontSize: isMobile ? 9 : 11 }}>
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
                            padding: isMobile ? '4px 6px' : '6px 9px',
                            borderRadius: 5,
                            background: P.pink,
                            color: '#fff',
                            fontSize: isMobile ? 8 : 10,
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
            <section style={{ marginTop: 30 }}>
              <h2 style={{
                fontSize: isMobile ? 18 : 20,
                margin: '0 0 12px',
                color: P.text,
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
              }}>
                Film simili
              </h2>
              <div style={{
                display: 'flex',
                gap: isMobile ? 10 : 14,
                overflowX: 'auto',
                padding: '2px 1px 9px',
                scrollbarWidth: 'none',
              }}>
                {movie.similar.map((item) => {
                  const width = isMobile ? 100 : 132;
                  return (
                    <button
                      key={item.tmdb_id}
                      onClick={() => router.push(`/film/${item.tmdb_id}`)}
                      style={{
                        minWidth: width,
                        width: width,
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
                          width: width,
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
                        marginTop: 6,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: P.text,
                        fontSize: isMobile ? 12 : 14,
                      }}>
                        {item.title}
                      </strong>
                      <span style={{ color: P.textMuted, fontSize: isMobile ? 10 : 12 }}>
                        {item.year || '—'}
                        {item.rating > 0 ? ` · ★ ${item.rating.toFixed(1)}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {reviewOpen && (
          <div
            onMouseDown={() => !savingReview && setReviewOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background: 'rgba(0,0,0,0.76)',
              backdropFilter: 'blur(6px)',
              display: 'grid',
              placeItems: 'center',
              padding: 18,
            }}
          >
            <div
              onMouseDown={(event) => event.stopPropagation()}
              style={{
                width: 'min(540px, 100%)',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: P.card,
                border: `1px solid ${P.border}`,
                boxShadow: '0 28px 90px rgba(0,0,0,0.55)',
                padding: 22,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, marginBottom: 18 }}>
                <div>
                  <div style={{ color: P.pink, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 800 }}>
                    {movie.title}
                  </div>
                  <h2 style={{ margin: '4px 0 0', color: P.text, fontFamily: FONT_DISPLAY, fontSize: 24 }}>
                    Voto e recensione
                  </h2>
                </div>
                <button
                  onClick={() => setReviewOpen(false)}
                  disabled={savingReview}
                  style={{ width: 32, height: 32, border: `1px solid ${P.border}`, background: P.bgSoft, color: P.textMuted, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: 10, color: P.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Il tuo voto
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4,1fr)' : 'repeat(6,1fr)', gap: 5, marginBottom: 16 }}>
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setReviewRating(value)}
                    style={{
                      height: 34,
                      border: `1px solid ${reviewRating === value ? P.gold : P.border}`,
                      background: reviewRating === value ? P.gold : P.bgSoft,
                      color: reviewRating === value ? '#120d05' : P.textMuted,
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: 10,
                    }}
                  >
                    {value}
                  </button>
                ))}
                <button
                  onClick={() => setReviewRating(null)}
                  style={{
                    height: 34,
                    border: `1px solid ${reviewRating === null ? P.gold : P.border}`,
                    background: reviewRating === null ? P.gold : P.bgSoft,
                    color: reviewRating === null ? '#120d05' : P.textMuted,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 10,
                  }}
                >
                  —
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: P.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                <span>Recensione</span>
                <span>{reviewText.length}/3000</span>
              </div>

              <textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value.slice(0, 3000))}
                rows={7}
                placeholder="Cosa ne pensi di questo film?"
                style={{
                  width: '100%',
                  resize: 'vertical',
                  minHeight: 130,
                  border: `1px solid ${P.border}`,
                  background: P.bgSoft,
                  color: P.text,
                  outline: 0,
                  padding: 12,
                  fontFamily: FONT_SANS,
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              />

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '14px 0', cursor: 'pointer' }}>
                <button
                  type="button"
                  onClick={() => setPublishRating((value) => !value)}
                  style={{
                    width: 20,
                    height: 20,
                    border: `1px solid ${publishRating ? P.gold : P.border}`,
                    background: publishRating ? P.gold : P.bgSoft,
                    color: '#120d05',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {publishRating && <CheckCircle size={13} weight="fill" />}
                </button>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <strong style={{ color: P.text, fontSize: 11 }}>
                    Mostra pubblicamente anche il voto
                  </strong>
                  <small style={{ color: P.textFaint, fontSize: 9, lineHeight: 1.45 }}>
                    La recensione viene pubblicata se scrivi del testo. Watchlist, preferiti e data di visione restano privati.
                  </small>
                </span>
              </label>

              {entryError && (
                <div style={{ marginBottom: 12, padding: '9px 11px', border: '1px solid rgba(251,113,133,0.28)', background: 'rgba(251,113,133,0.07)', color: '#fb7185', fontSize: 10 }}>
                  {entryError}
                </div>
              )}

              <button
                onClick={() => void saveReview()}
                disabled={savingReview}
                style={{
                  width: '100%',
                  border: `1px solid ${P.gold}`,
                  background: P.gold,
                  color: '#120d05',
                  padding: '11px 14px',
                  cursor: savingReview ? 'wait' : 'pointer',
                  opacity: savingReview ? 0.6 : 1,
                  fontWeight: 800,
                  fontFamily: FONT_SANS,
                  fontSize: 12,
                }}
              >
                {savingReview ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}