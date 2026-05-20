'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { createBrowserClient } from '@/utils/supabase/browser';
import { useSwipe } from '@/hooks/useSwipe';
import { useAuth } from '@/hooks/useAuth';
import { normalizeRoomCode, generateRoomCode } from '@/utils/roomCode';
import { saveRecentRoom } from '@/utils/recentRoom';
import AppShell from '@/components/layout/AppShell';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';

import {
  FilmSlate, Heart, X, ArrowLeft, ArrowRight,
  Users, Info, Play, Trophy, Door,
   Ticket, TelevisionSimple,
  ShareNetwork, ArrowClockwise, Star,
} from '@phosphor-icons/react';

import type { Movie, RoomUser, SwipeState, Props } from '@/types';
import type { JsonMovieRow } from '@/types';

// ─── Tipo film TMDB esteso ────────────────────────────────────────────────────
type ExtendedMovie = Movie & {
  tmdb_id?: number;
  backdrop?: string | null;
  rating?: number;
  runtime?: string | null;
  tagline?: string | null;
};

// ─── Aggiorna il tipo StreamingSource per includere logoUrl e color ───────────
type StreamingSource = {
  name: string;
  type: 'sub' | 'rent' | 'buy' | 'free';
  price?: number;
  url?: string;
  logo: string;
  logoUrl?: string;
  color?: string;
};

type MatchEntry = {
  movie: ExtendedMovie;
  timestamp: number;
};

// ─── Schermata swipe ──────────────────────────────────────────────────────────
type SwipeScreenProps = {
  movie: ExtendedMovie;
  remainingCount: number;
  dragOffset: number;
  isDragging: boolean;
  handleStart: (x: number) => void;
  onSwipe: (id: string | number, liked: boolean) => void;
  onFlip: () => void;
  isFlipped: boolean;
  onReset: () => void;
  onMatches: () => void;
  onBack: () => void;
  userName: string;
  matchCount: number;
};

function SwipeCard({
  movie, remainingCount, dragOffset, isDragging,
  handleStart, onSwipe, onFlip, isFlipped,
  onReset, onMatches, onBack, userName, matchCount,
}: SwipeScreenProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${S.md} ${S.md} ${S.sm}`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted, fontSize: TEXT.sm, fontFamily: FONT.sans }}
        >
          <ArrowLeft size={18} /> Stanza
        </button>

        <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>
          @{userName}
        </div>

        <button
          onClick={onMatches}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: matchCount > 0 ? C.primaryLight : C.bgSoft,
            border: 'none', borderRadius: R.full,
            padding: '7px 14px', cursor: 'pointer',
            fontSize: TEXT.xs, fontWeight: '700',
            color: matchCount > 0 ? C.primary : C.muted,
            fontFamily: FONT.sans,
          }}
        >
          <Heart size={14} weight={matchCount > 0 ? 'fill' : 'regular'} />
          {matchCount > 0 ? matchCount : 'Match'}
        </button>
      </div>

      {/* ── Card zone ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: S.md,
        touchAction: 'none', position: 'relative',
      }}>
        {/* Counter */}
        <div style={{
          position: 'absolute', top: S.sm, right: S.md,
          fontSize: TEXT.xs, color: C.muted,
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <FilmSlate size={12} color={C.muted} />
          {remainingCount} {remainingCount === 1 ? 'rimasto' : 'rimasti'}
        </div>

        {/* Card wrapper */}
        <div
          style={{
            transform: `translateX(${isFlipped ? 0 : dragOffset}px) rotate(${isFlipped ? 0 : dragOffset * 0.12}deg)`,
            transition: isDragging && !isFlipped ? 'none' : 'transform 0.3s ease',
            perspective: '1000px',
            width: 'min(300px, 88vw)',
            height: 'min(440px, 65vh)',
            touchAction: 'none',
            userSelect: 'none',
          }}
          onMouseDown={(e) => { if (isFlipped) return; e.preventDefault(); handleStart(e.clientX); }}
          onTouchStart={(e) => { if (isFlipped) return; handleStart(e.touches[0].clientX); }}
        >
          {/* Inner flip */}
          <div style={{
            width: '100%', height: '100%',
            position: 'relative', transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1)',
          }}>

            {/* ── FRONTE ── */}
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              backfaceVisibility: 'hidden',
              borderRadius: R.xl, overflow: 'hidden',
              boxShadow: SHADOW.xl,
              background: C.bgSoft,
            }}>
              {/* Poster */}
              <img
                src={movie.cover?.startsWith('http') ? movie.cover : 'https://placehold.co/300x440/f8f8f8/aaa?text=🎬'}
                alt={movie.title}
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Gradient bottom */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.85) 100%)',
                padding: `${S.xl} ${S.md} ${S.md}`,
              }}>
                <div style={{ color: '#fff', fontSize: TEXT.md, fontWeight: '800', marginBottom: '4px' }}>
                  {movie.title}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: TEXT.xs, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{movie.year}</span>
                  {movie.runtime && <><span>·</span><span>{movie.runtime}</span></>}
                  <span>·</span><span>{movie.genre}</span>
                </div>
                {(movie as any).rating > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <Star size={12} color="#f59e0b" weight="fill" />
                    <span style={{ color: '#f59e0b', fontSize: TEXT.xs, fontWeight: '700' }}>
                      {((movie as any).rating as number).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* Info button */}
              <button
                onClick={(e) => { e.stopPropagation(); onFlip(); }}
                style={{
                  position: 'absolute', top: S.sm, right: S.sm,
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Info size={18} color="#fff" weight="bold" />
              </button>

              {/* Swipe overlay */}
              {Math.abs(dragOffset) > 30 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: dragOffset > 0
                    ? 'rgba(34,197,94,0.35)'
                    : 'rgba(239,68,68,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: R.xl,
                  opacity: Math.min(Math.abs(dragOffset) / 100, 1),
                }}>
                  <div style={{
                    background: dragOffset > 0 ? '#22c55e' : '#ef4444',
                    borderRadius: R.full, padding: '10px 24px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: SHADOW.lg,
                  }}>
                    {dragOffset > 0
                      ? <Heart size={24} color="#fff" weight="fill" />
                      : <X size={24} color="#fff" weight="bold" />
                    }
                    <span style={{ color: '#fff', fontWeight: '800', fontSize: TEXT.md, letterSpacing: '1px' }}>
                      {dragOffset > 0 ? 'MI PIACE' : 'PASSO'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── RETRO ── */}
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: R.xl, overflow: 'hidden',
              background: C.bg, border: `1.5px solid ${C.border}`,
              boxShadow: SHADOW.xl,
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Backdrop sfocato come sfondo */}
              {movie.backdrop && (
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `url(${movie.backdrop})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  opacity: 0.08,
                }} />
              )}

              {/* Contenuto retro */}
              <div style={{
                position: 'relative', flex: 1,
                display: 'flex', flexDirection: 'column',
                padding: S.md, overflowY: 'auto',
              }}>
                {/* Chiudi */}
                <button
                  onClick={(e) => { e.stopPropagation(); onFlip(); }}
                  style={{
                    alignSelf: 'flex-end', background: C.bgSoft,
                    border: 'none', borderRadius: '50%',
                    width: '32px', height: '32px',
                    cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: S.sm,
                  }}
                >
                  <X size={16} color={C.muted} />
                </button>

                {/* Poster piccolo + info */}
                <div style={{ display: 'flex', gap: S.sm, marginBottom: S.md }}>
                  <img
                    src={movie.cover?.startsWith('http') ? movie.cover : ''}
                    style={{ width: '70px', height: '105px', objectFit: 'cover', borderRadius: R.sm, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: TEXT.base, fontWeight: '800', color: C.ink, lineHeight: 1.2, marginBottom: '6px' }}>
                      {movie.title}
                    </div>
                    <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '4px' }}>
                      {movie.year} · {movie.genre}
                    </div>
                    {movie.runtime && (
                      <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '4px' }}>
                        ⏱ {movie.runtime}
                      </div>
                    )}
                    {(movie as any).rating > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={12} color="#f59e0b" weight="fill" />
                        <span style={{ fontSize: TEXT.xs, fontWeight: '700', color: '#f59e0b' }}>
                          {((movie as any).rating as number).toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tagline */}
                {movie.tagline && (
                  <div style={{
                    fontSize: TEXT.xs, fontStyle: 'italic',
                    color: C.primary, marginBottom: S.sm,
                    padding: `${S.xs} ${S.sm}`,
                    background: C.primaryLight, borderRadius: R.sm,
                    borderLeft: `3px solid ${C.primary}`,
                  }}>
                    "{movie.tagline}"
                  </div>
                )}

                {/* Trama */}
                <div style={{ fontSize: TEXT.sm, color: C.muted, lineHeight: 1.7 }}>
                  {movie.trama_c ?? 'Trama non disponibile.'}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Azioni ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: S.xl, padding: `${S.sm} ${S.md} ${S.lg}`,
        borderTop: `1px solid ${C.border}`,
        background: C.bg,
      }}>
        <button
          onClick={() => onSwipe(movie.id, false)}
          style={{
            width: '64px', height: '64px', borderRadius: '50%',
            border: `2px solid #fee2e2`, background: '#fff',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: SHADOW.sm, transition: 'all .15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
        >
          <X size={28} color="#ef4444" weight="bold" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: TEXT.xs, color: C.faint, marginBottom: '2px' }}>Passo</div>
          <div style={{ width: '2px', height: '20px', background: C.border, margin: '0 auto' }} />
          <div style={{ fontSize: TEXT.xs, color: C.faint, marginTop: '2px' }}>Mi piace</div>
        </div>

        <button
          onClick={() => onSwipe(movie.id, true)}
          style={{
            width: '64px', height: '64px', borderRadius: '50%',
            border: `2px solid #dcfce7`, background: '#fff',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: SHADOW.sm, transition: 'all .15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#dcfce7'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
        >
          <Heart size={28} color="#22c55e" weight="fill" />
        </button>
      </div>
    </div>
  );
}

// ─── Schermata Match ──────────────────────────────────────────────────────────
type MatchScreenProps = {
  match: ExtendedMovie;
  allMatches: MatchEntry[];
  onContinue: () => void;
  onReset: () => void;
  isLoggedIn: boolean;
};

function MatchScreen({ match, allMatches, onContinue, onReset, isLoggedIn }: MatchScreenProps) {
  const [sources, setSources] = useState<StreamingSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [showMatches, setShowMatches] = useState(false);

  useEffect(() => {
  const tmdbId = (match as any).tmdb_id;
  
  // ─── Debug: vedi cosa arriva ──────────────────────────────────────────
  console.log('Match movie:', match.title, '| tmdb_id:', tmdbId);
  
  if (!tmdbId) {
    console.warn('tmdb_id mancante nel film — WatchMode non può cercare');
    setSources([]);
    setLoadingSources(false);
    return;
  }

  setLoadingSources(true);
  fetch(`/api/watchmode/${tmdbId}`)
    .then((r) => {
      console.log('WatchMode status:', r.status);
      return r.json();
    })
    .then((d) => {
      console.log('WatchMode sources:', d.sources);
      setSources(d.sources ?? []);
    })
    .catch((err) => {
      console.error('WatchMode error:', err);
      setSources([]);
    })
    .finally(() => setLoadingSources(false));
}, [match.id]);

  const typeLabel = { sub: 'Abbonamento', rent: 'Noleggio', buy: 'Acquisto', free: 'Gratis' };
  const typeColor = { sub: C.success, rent: '#f59e0b', buy: C.muted, free: C.primary };

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg,
    }}>

      {/* ── Header match ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, #c0254f 100%)`,
        padding: `${S.lg} ${S.md}`,
        textAlign: 'center', color: '#fff',
      }}>
        <div style={{ fontSize: '36px', marginBottom: S.xs }}>🎉</div>
        <div style={{ fontSize: TEXT.xl, fontWeight: '800', marginBottom: '4px' }}>
          È un match!
        </div>
        <div style={{ fontSize: TEXT.sm, opacity: 0.85 }}>
          Vi piace entrambi <strong>{match.title}</strong>
        </div>

        {/* Counter match */}
        {allMatches.length > 1 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.2)', borderRadius: R.full,
            padding: '5px 14px', marginTop: S.sm,
            fontSize: TEXT.xs, fontWeight: '600',
          }}>
            <Trophy size={14} color="#fff" weight="fill" />
            {allMatches.length} match in questa sessione
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: S.md }}>

        {/* ── Film card ── */}
        <div style={{
          display: 'flex', gap: S.md,
          background: C.bgSoft, borderRadius: R.lg,
          padding: S.md, marginBottom: S.md,
          border: `1.5px solid ${C.border}`,
        }}>
          <img
            src={match.cover?.startsWith('http') ? match.cover : ''}
            alt={match.title}
            style={{ width: '80px', height: '120px', objectFit: 'cover', borderRadius: R.sm, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: TEXT.md, fontWeight: '800', color: C.ink, marginBottom: '4px' }}>
              {match.title}
            </div>
            <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '6px' }}>
              {match.year} · {match.genre}
              {match.runtime && ` · ${match.runtime}`}
            </div>
            {(match as any).rating > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <Star size={12} color="#f59e0b" weight="fill" />
                <span style={{ fontSize: TEXT.xs, fontWeight: '700', color: '#f59e0b' }}>
                  {((match as any).rating as number).toFixed(1)}
                </span>
              </div>
            )}
            {match.trama_c && (
              <div style={{
                fontSize: TEXT.xs, color: C.muted, lineHeight: 1.6,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any,
              }}>
                {match.trama_c}
              </div>
            )}

            {/* Trailer button */}
            {match.trailer && (
              <button
                onClick={() => window.open(match.trailer!, '_blank')}
                style={{
                  marginTop: S.sm, display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: C.primaryLight, color: C.primary, border: 'none',
                  borderRadius: R.full, padding: '7px 14px',
                  fontSize: TEXT.xs, fontWeight: '600', cursor: 'pointer',
                  fontFamily: FONT.sans,
                }}
              >
                <Play size={14} weight="fill" /> Trailer
              </button>
            )}
          </div>
        </div>

        {/* ── Dove guardarlo ── */}
      <div style={{ marginBottom: S.md }}>
        <div style={{
          fontSize: TEXT.base, fontWeight: '700', color: C.ink,
          marginBottom: S.sm, display: 'flex', alignItems: 'center', gap: '8px',
        }}>
           <TelevisionSimple size={18} color={C.primary} weight="fill" />
            Dove guardarlo
          </div>

          {loadingSources ? (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          height: '60px', borderRadius: R.md,
          background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
          backgroundSize: '400px 100%',
          animation: 'shimmer 1.4s ease infinite',
        }} />
      ))}
    </div> ) : sources.length === 0 ? (
    <div style={{
      padding: S.md, background: C.bgSoft,
      borderRadius: R.md, textAlign: 'center',
      fontSize: TEXT.sm, color: C.muted,
      border: `1.5px dashed ${C.border}`,
    }}>
              <TelevisionSimple size={28} color={C.faint} weight="duotone" style={{ marginBottom: '8px' }} />
      <div>Nessuna disponibilità streaming trovata</div>
    </div>
           ) : (() => {
    // ─── Dividi per categoria ─────────────────────────────────────────────
    const subSources  = sources.filter((s) => s.type === 'sub' || s.type === 'free');
    const rentSources = sources.filter((s) => s.type === 'rent' || s.type === 'buy');

    const PlatformRow = ({ s }: { s: StreamingSource }) => (
      <div
        key={s.name}
        onClick={() => s.url && window.open(s.url, '_blank')}
        style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          background: C.bg,
          border: `1.5px solid ${C.border}`,
          borderRadius: R.md,
          cursor: s.url ? 'pointer' : 'default',
          transition: 'border-color .15s, box-shadow .15s',
        }}
        onMouseEnter={(e) => {
          if (s.url) {
            (e.currentTarget as HTMLElement).style.borderColor = s.color ?? C.primary;
            (e.currentTarget as HTMLElement).style.boxShadow = SHADOW.sm;
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = C.border;
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logo piattaforma */}
          <div style={{
            width: '44px', height: '30px',
            borderRadius: R.xs,
            background: s.color ?? '#f0f0f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            {s.logoUrl ? (
              <img
                src={s.logoUrl}
                alt={s.name}
                style={{
                  width: '36px', height: '24px',
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)', // bianco su sfondo colorato
                }}
                onError={(e) => {
                  // fallback emoji se immagine non carica
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  (e.currentTarget.parentElement as HTMLElement).innerHTML = `<span style="font-size:16px">${s.logo}</span>`;
                }}
              />
            ) : (
              <span style={{ fontSize: '16px' }}>{s.logo}</span>
            )}
          </div>

          <div>
            <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>
              {s.name}
            </div>
            <div style={{
              fontSize: TEXT.xs, fontWeight: '500',
              color: s.type === 'sub' || s.type === 'free'
                ? C.success
                : '#f59e0b',
            }}>
              {s.type === 'sub'  && 'Incluso nell\'abbonamento'}
              {s.type === 'free' && 'Gratuito'}
              {s.type === 'rent' && `Noleggio${s.price ? ` · €${s.price.toFixed(2)}` : ''}`}
              {s.type === 'buy'  && `Acquisto${s.price ? ` · €${s.price.toFixed(2)}` : ''}`}
            </div>
          </div>
        </div>

        {s.url && (
          <div style={{
            fontSize: TEXT.xs, fontWeight: '700',
            color: s.color ?? C.primary,
            display: 'flex', alignItems: 'center', gap: '4px',
            flexShrink: 0,
          }}>
            Guarda
            <ArrowRight size={12} color={s.color ?? C.primary} weight="bold" />
          </div>
        )}
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>

        {/* ── Abbonamento / Gratuito ── */}
        {subSources.length > 0 && (
          <div>
            <div style={{
              fontSize: TEXT.xs, fontWeight: '700',
              color: C.success, letterSpacing: '0.8px',
              textTransform: 'uppercase', marginBottom: '8px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.success }} />
              Incluso nel tuo abbonamento
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {subSources.map((s) => <PlatformRow key={s.name} s={s} />)}
            </div>
          </div>
        )}

        {/* ── Divider ── */}
        {subSources.length > 0 && rentSources.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, margin: '4px 0' }}>
            <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
            <span style={{ fontSize: TEXT.xs, color: C.faint }}>oppure</span>
            <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
          </div>
        )}

        {/* ── Noleggio / Acquisto ── */}
        {rentSources.length > 0 && (
          <div>
            <div style={{
              fontSize: TEXT.xs, fontWeight: '700',
              color: '#f59e0b', letterSpacing: '0.8px',
              textTransform: 'uppercase', marginBottom: '8px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
              Noleggio o acquisto
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rentSources.map((s) => <PlatformRow key={s.name} s={s} />)}
            </div>
          </div>
        )}

      </div>
    );
  })()}
</div>

        {/* ── Lista match sessione (solo utenti registrati) ── */}
        {isLoggedIn && allMatches.length > 1 && (
          <div style={{ marginBottom: S.md }}>
            <button
              onClick={() => setShowMatches((v) => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '12px 16px',
                background: C.bgSoft, border: `1.5px solid ${C.border}`,
                borderRadius: R.md, cursor: 'pointer',
                fontFamily: FONT.sans,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>
                <Trophy size={16} color={C.primary} weight="fill" />
                Tutti i match ({allMatches.length})
              </span>
              <ArrowRight
                size={16} color={C.muted}
                style={{ transform: showMatches ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}
              />
            </button>

            {showMatches && (
              <div style={{
                border: `1.5px solid ${C.border}`, borderTop: 'none',
                borderRadius: `0 0 ${R.md} ${R.md}`,
                overflow: 'hidden',
              }}>
                {allMatches.map((entry, i) => (
                  <div
                    key={entry.movie.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: S.sm,
                      padding: '10px 16px',
                      borderBottom: i < allMatches.length - 1 ? `1px solid ${C.border}` : 'none',
                      background: entry.movie.id === match.id ? C.primaryLight : C.bg,
                    }}
                  >
                    <img
                      src={entry.movie.cover?.startsWith('http') ? entry.movie.cover : ''}
                      style={{ width: '36px', height: '54px', objectFit: 'cover', borderRadius: R.xs, flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>
                        {entry.movie.title}
                      </div>
                      <div style={{ fontSize: TEXT.xs, color: C.muted }}>
                        {entry.movie.year} · {entry.movie.genre}
                      </div>
                    </div>
                    {entry.movie.id === match.id && (
                      <div style={{
                        marginLeft: 'auto', fontSize: TEXT.xs,
                        color: C.primary, fontWeight: '600',
                      }}>
                        Ultimo ❤️
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Azioni bottom ── */}
      <div style={{
        padding: S.md, borderTop: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', gap: S.sm,
        background: C.bg,
      }}>
        <button
          onClick={onContinue}
          style={{
            width: '100%', padding: '15px',
            background: C.primary, color: '#fff',
            border: 'none', borderRadius: R.full,
            fontSize: TEXT.base, fontWeight: '700',
            cursor: 'pointer', fontFamily: FONT.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: `0 4px 16px rgba(232,56,109,.3)`,
          }}
        >
          <FilmSlate size={18} color="#fff" weight="fill" />
          Continua a swipare
        </button>

        <button
          onClick={onReset}
          style={{
            width: '100%', padding: '13px',
            background: 'transparent', color: C.muted,
            border: `1.5px solid ${C.border}`, borderRadius: R.full,
            fontSize: TEXT.base, fontWeight: '500',
            cursor: 'pointer', fontFamily: FONT.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <ArrowClockwise size={16} color={C.muted} />
          Ricomincia da capo
        </button>
      </div>
    </div>
  );
}

// ─── Schermata welcome stanza ─────────────────────────────────────────────────
type WelcomeProps = {
  roomId: string;
  roomUsers: RoomUser[];
  currentUserId: string;
  currentUserName: string;
  isRoomFull: boolean;
  codeInput: string;
  setCodeInput: (v: string) => void;
  codeError: string;
  onJoinByCode: (e: FormEvent<HTMLFormElement>) => void;
  onEnter: () => void;
  onAddFilms: () => void;
};

function WelcomeRoom({
  roomId, roomUsers, currentUserId, currentUserName,
  isRoomFull, codeInput, setCodeInput, codeError,
  onJoinByCode, onEnter, onAddFilms,
}: WelcomeProps) {
  return (
    <div style={{ padding: S.md, display: 'flex', flexDirection: 'column', gap: S.md }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Door size={12} color={C.muted} /> Stanza
          </div>
          <div style={{ fontSize: TEXT.xl, fontWeight: '800', color: C.ink }}>
            Ciao, <span style={{ color: C.primary }}>@{currentUserName}</span> 👋
          </div>
        </div>
        <button
          onClick={onAddFilms}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: C.bgSoft, border: `1.5px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          ⚙️
        </button>
      </div>

      {/* La tua stanza */}
      <div style={{
        background: C.primaryLight, borderRadius: R.lg,
        padding: S.lg, border: `1.5px solid #ffd0e0`,
        display: 'flex', flexDirection: 'column', gap: S.sm,
      }}>
        <div style={{ fontSize: TEXT.xs, fontWeight: '700', color: C.primary, letterSpacing: '1px', textTransform: 'uppercase' }}>
          La tua stanza
        </div>
        <div style={{
          fontSize: '28px', fontWeight: '800', color: C.primary,
          letterSpacing: '4px', textAlign: 'center',
          fontFamily: FONT.mono, background: '#fff',
          borderRadius: R.md, padding: S.md,
          boxShadow: SHADOW.sm,
        }}>
          {roomId}
        </div>
        <div style={{ fontSize: TEXT.xs, color: C.primary, textAlign: 'center', opacity: 0.8 }}>
          Condividi questo codice con il tuo partner
        </div>
        <button
          onClick={onEnter}
          disabled={isRoomFull}
          style={{
            width: '100%', padding: '14px',
            background: isRoomFull ? C.faint : C.primary,
            color: '#fff', border: 'none', borderRadius: R.full,
            fontSize: TEXT.base, fontWeight: '700',
            cursor: isRoomFull ? 'not-allowed' : 'pointer',
            fontFamily: FONT.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <FilmSlate size={18} color="#fff" weight="fill" />
          {isRoomFull ? 'Stanza piena' : 'Entra nella stanza'}
        </button>
      </div>

      {/* Partecipanti */}
      <div style={{
        background: C.bg, borderRadius: R.lg,
        border: `1.5px solid ${C.border}`, padding: S.md,
      }}>
        <div style={{ fontSize: TEXT.sm, fontWeight: '700', color: C.ink, marginBottom: S.sm, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={16} color={C.primary} weight="fill" />
          Partecipanti
        </div>
        {roomUsers.length === 0 ? (
          <div style={{ fontSize: TEXT.sm, color: C.muted }}>Nessuno ancora...</div>
        ) : (
          roomUsers.map((u) => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: S.sm,
              padding: '8px 0',
              borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: u.id === currentUserId ? C.primaryLight : C.bgSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: TEXT.sm, fontWeight: '700',
                color: u.id === currentUserId ? C.primary : C.muted,
              }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>
                  @{u.name}
                </div>
                {u.id === currentUserId && (
                  <div style={{ fontSize: TEXT.xs, color: C.primary }}>Tu</div>
                )}
              </div>
            </div>
          ))
        )}
        {roomUsers.length === 1 && (
          <div style={{ fontSize: TEXT.xs, color: C.muted, marginTop: S.sm, fontStyle: 'italic' }}>
            In attesa del partner...
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
        <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
        <span style={{ fontSize: TEXT.xs, color: C.faint }}>oppure entra in un'altra stanza</span>
        <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
      </div>

      {/* Form codice */}
      <form onSubmit={onJoinByCode} style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="Inserisci codice (es. MAPLE-73)"
          maxLength={10}
          style={{
            padding: '13px 16px', border: `1.5px solid ${C.border}`,
            borderRadius: R.md, fontSize: TEXT.base,
            fontFamily: FONT.mono, color: C.ink,
            background: C.bg, outline: 'none',
            textAlign: 'center', letterSpacing: '3px',
            fontWeight: '700', textTransform: 'uppercase',
            width: '100%',
          }}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
        {codeError && (
          <div style={{ fontSize: TEXT.xs, color: C.error, textAlign: 'center' }}>
            ⚠️ {codeError}
          </div>
        )}
        <button
          type="submit"
          disabled={codeInput.trim().length < 4}
          style={{
            width: '100%', padding: '13px',
            background: C.bgSoft, color: C.ink,
            border: `1.5px solid ${C.border}`,
            borderRadius: R.full, fontSize: TEXT.base,
            fontWeight: '600', cursor: codeInput.trim().length < 4 ? 'not-allowed' : 'pointer',
            fontFamily: FONT.sans, opacity: codeInput.trim().length < 4 ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <Door size={18} color={C.muted} weight="fill" />
          Entra con codice
        </button>
      </form>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onAddFilms, onReset }: { onAddFilms: () => void; onReset: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: S.xl, textAlign: 'center', gap: S.md,
    }}>
      <FilmSlate size={64} color={C.faint} weight="duotone" />
      <div style={{ fontSize: TEXT.lg, fontWeight: '700', color: C.ink }}>
        Hai visto tutto!
      </div>
      <div style={{ fontSize: TEXT.sm, color: C.muted, lineHeight: 1.6 }}>
        Hai swipato tutti i film disponibili.<br />
        Aggiungi altri film o ricomincia da capo.
      </div>
      <button
        onClick={onAddFilms}
        style={{
          padding: '12px 28px', background: C.primary,
          color: '#fff', border: 'none', borderRadius: R.full,
          fontSize: TEXT.sm, fontWeight: '600',
          cursor: 'pointer', fontFamily: FONT.sans,
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        <Ticket size={16} color="#fff" weight="fill" />
        Aggiungi film
      </button>
      <button
        onClick={onReset}
        style={{
          padding: '10px 24px', background: 'transparent',
          color: C.muted, border: `1.5px solid ${C.border}`,
          borderRadius: R.full, fontSize: TEXT.sm,
          cursor: 'pointer', fontFamily: FONT.sans,
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        <ArrowClockwise size={16} color={C.muted} />
        Ricomincia
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGINA PRINCIPALE
// ─────────────────────────────────────────────

export default function StanzaPage({ movies: initialMovies, roomId }: Props) {
  const router = useRouter();
  const { currentUser, isGuest, isLoading, guestId, guestName } = useAuth();

  // ── Schermata corrente ────────────────────────────────────────────────────
  type Screen = 'welcome' | 'swipe' | 'match' | 'add';
  const [screen, setScreen] = useState<Screen>('welcome');

  // ── Film ──────────────────────────────────────────────────────────────────
  const [movies, setMovies] = useState<ExtendedMovie[]>(initialMovies);

  // ── Stanza ────────────────────────────────────────────────────────────────
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  // ── Swipe ─────────────────────────────────────────────────────────────────
  const [swipes, setSwipes] = useState<SwipeState>({});
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [lastMatch, setLastMatch] = useState<ExtendedMovie | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const channelRef = useRef<any>(null);
  const supabase = useRef(createBrowserClient()).current;

  // ── Identità ──────────────────────────────────────────────────────────────
  const userId: string = currentUser?.id ?? guestId ?? '';
  const displayName: string = currentUser && !currentUser.isGuest
    ? currentUser.username
    : guestName ?? 'Ospite';
  const isLoggedIn = !!currentUser && !currentUser.isGuest;


  
  // ── Redirect ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!currentUser && !isGuest) router.replace('/auth');
  }, [currentUser, isGuest, isLoading]);

  // ── Salva stanza recente ──────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    saveRecentRoom(roomId, roomUsers.length || 1);
  }, [roomId, roomUsers.length]);

 
  // ── Swipe gesture ─────────────────────────────────────────────────────────
  const { dragOffset, isDragging, handleStart, handleMove, handleEnd } = useSwipe((liked) => {
    if (!currentMovie) return;
    handleSwipe(currentMovie.id, liked);
  });

  

  // ── Global drag events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX); };
    const onTouchEnd = () => handleEnd();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging]);

  // ── Realtime channel ──────────────────────────────────────────────────────
useEffect(() => {
  if (!userId || !displayName) return;

  const channel = supabase.channel(`room-${roomId}`, {
    config: { presence: { key: userId } },
  });

  // ─── PRESENCE: traccia chi è online ──────────────────────────────────────
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const users: RoomUser[] = Object.values(state)
      .flat()
      .map((p: any) => ({ id: p.userId, name: p.displayName }))
      .filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i) // deduplica
      .slice(0, 2);
    setRoomUsers(users);
  });

  channel.on('presence', { event: 'join' }, ({ newPresences }) => {
    newPresences.forEach((p: any) => {
      setRoomUsers((prev) => {
        if (prev.find((u) => u.id === p.userId)) return prev;
        return [...prev, { id: p.userId, name: p.displayName }].slice(0, 2);
      });
    });
  });

  channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
    leftPresences.forEach((p: any) => {
      setRoomUsers((prev) => prev.filter((u) => u.id !== p.userId));
    });
  });

  // ─── BROADCAST: swipe, match, reset ──────────────────────────────────────
  channel.on('broadcast', { event: 'swipe' }, (event) => {
    const { movieId, liked, userId: uid } = (event as any).payload ?? {};
    if (!movieId || !uid) return;
    setSwipes((prev) => {
      const current = prev[movieId] ?? {};
      return { ...prev, [movieId]: { ...current, [uid]: liked } };
    });
  });

  channel.on('broadcast', { event: 'match' }, (event) => {
    const { movieId } = (event as any).payload ?? {};
    const movie = movies.find((m) => m.id.toString() === movieId);
    if (!movie) return;
    setLastMatch(movie);
    setMatches((prev) => {
      if (prev.find((e) => e.movie.id === movie.id)) return prev;
      return [...prev, { movie, timestamp: Date.now() }];
    });
    setScreen('match');
  });

  channel.on('broadcast', { event: 'reset' }, () => {
    setSwipes({});
    setMatches([]);
    setLastMatch(null);
    setScreen('swipe');
  });

  const subscribe = async () => {
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // ─── Track presence con i tuoi dati ────────────────────────────
        await channel.track({
          userId,
          displayName,
          joinedAt: Date.now(),
        });
      }
    });
  };
  subscribe();

  channelRef.current = channel;
  return () => {
    channel.untrack();
    channel.unsubscribe();
  };
}, [userId, displayName, roomId, movies]);
  // ── Swipe logic ───────────────────────────────────────────────────────────
  const remaining = movies.filter((m) => swipes[m.id]?.[userId] === undefined);
  const currentMovie = remaining[0] ?? null;

  const handleSwipe = (movieId: string | number, liked: boolean) => {
    if (!userId) return;
    const key = movieId.toString();

    setSwipes((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [userId]: liked },
    }));

    const otherLiked = Object.entries(swipes[key] ?? {}).some(
      ([uid, val]) => uid !== userId && val === true
    );

    if (liked && otherLiked) {
      const movie = movies.find((m) => m.id.toString() === key);
      if (movie) {
        setLastMatch(movie);
        setMatches((prev) => {
          if (prev.find((e) => e.movie.id === movie.id)) return prev;
          return [...prev, { movie, timestamp: Date.now() }];
        });
        channelRef.current?.send({
          type: 'broadcast', event: 'match',
          payload: { movieId: key },
        });
        setScreen('match');
      }
    }

    channelRef.current?.send({
      type: 'broadcast', event: 'swipe',
      payload: { movieId: key, liked, userId, name: displayName },
    });
  };

  const handleReset = () => {
    if (!window.confirm('Ricominciare da capo? Tutti gli swipe verranno azzerati.')) return;
    setSwipes({});
    setMatches([]);
    setLastMatch(null);
    channelRef.current?.send({ type: 'broadcast', event: 'reset', payload: {} });
    setScreen('swipe');
  };

  const handleJoinByCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = normalizeRoomCode(codeInput);
    if (code.length < 4) { setCodeError('Codice non valido'); return; }
    setCodeError('');
    router.push(`/stanza?room=${code}`);
  };

// ─── Resetta il flip quando cambia film ──────────────────────────────────────
useEffect(() => {
  setIsFlipped(false);
}, [currentMovie?.id]);
  // ── Caricamento ───────────────────────────────────────────────────────────
  if (isLoading || (!currentUser && !isGuest)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FilmSlate size={40} color={C.primary} weight="duotone" />
      </div>
    );
  }

  const roomUsersSorted = roomUsers.slice().sort((a) => (a.id === userId ? -1 : 1));
  const isRoomFull = roomUsers.length >= 2 && !roomUsers.find((u) => u.id === userId);
  return (
    <AppShell activeNav="stanze" hideNav={screen === 'swipe'}>
      <div style={{ height: screen === 'swipe' ? '100vh' : 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── WELCOME ─────────────────────────────────────────────────── */}
        {screen === 'welcome' && (
          <WelcomeRoom
            roomId={roomId}
            roomUsers={roomUsersSorted}
            currentUserId={userId}
            currentUserName={displayName}
            isRoomFull={isRoomFull}
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            codeError={codeError}
            onJoinByCode={handleJoinByCode}
            onEnter={() => setScreen('swipe')}
            onAddFilms={() => router.push('/home')}
          />
        )}

        {/* ── SWIPE ───────────────────────────────────────────────────── */}
        {screen === 'swipe' && (
          currentMovie ? (
            <SwipeCard
              movie={currentMovie}
              remainingCount={remaining.length}
              dragOffset={dragOffset}
              isDragging={isDragging}
              handleStart={handleStart}
              onSwipe={handleSwipe}
              onFlip={() => setIsFlipped((v) => !v)}
              isFlipped={isFlipped}
              onReset={handleReset}
              onMatches={() => setScreen('match')}
              onBack={() => setScreen('welcome')}
              userName={displayName}
              matchCount={matches.length}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: `${S.md} ${S.md} ${S.sm}`, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => setScreen('welcome')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted, fontSize: TEXT.sm, fontFamily: FONT.sans }}
                >
                  <ArrowLeft size={18} /> Stanza
                </button>
              </div>
              <EmptyState
                onAddFilms={() => router.push('/home')}
                onReset={handleReset}
              />
            </div>
          )
        )}

        {/* ── MATCH ───────────────────────────────────────────────────── */}
        {screen === 'match' && lastMatch && (
          <MatchScreen
            match={lastMatch}
            allMatches={matches}
            onContinue={() => setScreen('swipe')}
            onReset={handleReset}
            isLoggedIn={isLoggedIn}
          />
        )}

      </div>
    </AppShell>
  );
}

// ─── Server side props ────────────────────────────────────────────────────────
// ─── Aggiorna getServerSideProps ─────────────────────────────────────────────
export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  let roomId = query.room as string;

  if (!roomId) {
    return {
      redirect: { destination: `/crea-stanza`, permanent: false },
    };
  }

  roomId = roomId.trim().toUpperCase();

  // ─── Legge mode/filters dalla query O dal DB se non presenti ─────────────
  let mode = (query.mode as string) ?? null;
  let genres = (query.genres as string) ?? null;
  let yearFrom = (query.year_from as string) ?? null;
  let yearTo = (query.year_to as string) ?? null;

  // ─── Se mode non è nella query, cerca la config salvata su Supabase ──────
  if (!mode) {
    try {
      const { createClient } = await import('@/utils/supabase/server');
      const supabase = createClient();
      const { data: roomConfig } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomConfig) {
        mode = roomConfig.mode;
        genres = roomConfig.genres;
        yearFrom = roomConfig.year_from?.toString() ?? null;
        yearTo = roomConfig.year_to?.toString() ?? null;
      }
    } catch { /* ignora, usa default */ }
  }

  mode = mode ?? 'trending';

  let movies: Movie[] = [];
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (apiKey) {
      const currentYear = new Date().getFullYear();
      let tmdbUrl = '';

      if (mode === 'trending') {
        tmdbUrl = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=it-IT`;
      } else if (mode === 'cinema') {
        tmdbUrl = `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=it-IT&region=IT`;
      } else if (mode === 'streaming') {
        tmdbUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=it-IT&sort_by=popularity.desc&vote_count.gte=200&with_watch_providers=8|9|337|350|119|109|531&watch_region=IT`;
      } else if (mode === 'discover') {
        const params = new URLSearchParams({
          api_key: apiKey,
          language: 'it-IT',
          sort_by: 'popularity.desc',
          'vote_count.gte': '100',
        });
        if (genres) params.set('with_genres', genres.replace(/,/g, '|'));
        if (yearFrom) params.set('primary_release_date.gte', `${yearFrom}-01-01`);
        if (yearTo) params.set('primary_release_date.lte', `${yearTo}-12-31`);
        tmdbUrl = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
      }

      const genreMapLocal: Record<number, string> = {
        28: 'Azione', 12: 'Avventura', 16: 'Animazione',
        35: 'Commedia', 80: 'Crime', 99: 'Documentario',
        18: 'Dramma', 10751: 'Famiglia', 14: 'Fantasy',
        36: 'Storia', 27: 'Horror', 10402: 'Musica',
        9648: 'Mistero', 10749: 'Romantico', 878: 'Fantascienza',
        10770: 'TV Movie', 53: 'Thriller', 10752: 'Guerra', 37: 'Western',
      };

      const trendingRes = await fetch(tmdbUrl);
      if (trendingRes.ok) {
        const trendingData = await trendingRes.json();

        const tmdbMovies = await Promise.all(
          (trendingData.results ?? []).slice(0, 20).map(async (m: any) => {
            try {
              let trailerUrl: string | null = null;
              const videoRes = await fetch(
                `https://api.themoviedb.org/3/movie/${m.id}/videos?api_key=${apiKey}&language=it-IT`
              );
              if (videoRes.ok) {
                const videoData = await videoRes.json();
                let trailer = videoData.results?.find(
                  (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
                );
                if (!trailer) {
                  const videoResEn = await fetch(
                    `https://api.themoviedb.org/3/movie/${m.id}/videos?api_key=${apiKey}&language=en-US`
                  );
                  if (videoResEn.ok) {
                    const videoDataEn = await videoResEn.json();
                    trailer = videoDataEn.results?.find(
                      (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
                    );
                  }
                }
                if (trailer) trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
              }

              const genre = m.genre_ids
                ?.slice(0, 2)
                .map((id: number) => genreMapLocal[id] ?? '')
                .filter(Boolean)
                .join(', ') ?? '';

              return {
                id: `tmdb_${m.id}`,
                tmdb_id: m.id,
                title: m.title,
                year: m.release_date ? parseInt(m.release_date.split('-')[0]) : 0,
                genre,
                cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
                backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
                trailer: trailerUrl,
                trama_c: m.overview ?? null,
                trama_l: m.overview ?? null,
                rating: m.vote_average ?? 0,
              } as Movie;
            } catch { return null; }
          })
        );

        movies = tmdbMovies.filter(Boolean) as Movie[];
      }
    }

    if (movies.length === 0) {
      const { createClient } = await import('@/utils/supabase/server');
      const supabase = createClient();
      const { data } = await supabase.from('movies').select('*');
      movies = (data as Movie[]) ?? [];
    }


  // ─── Sostituisci il sort attuale con questo ───────────────────────────────────
  // Seeded random: stesso roomId → stesso ordine casuale per tutti
  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  const seed = roomId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  movies = movies.sort(() => rng() - 0.5);


  } catch (err) {
    console.error('Error:', err);
  }

  return { props: { movies, roomId } };
};