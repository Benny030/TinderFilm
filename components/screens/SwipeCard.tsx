'use client';

import { type CSSProperties } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { FilmSlate, Heart, X, ArrowLeft, Info, Star } from '@phosphor-icons/react';
import type { ExtendedMovie } from '@/types/stanza';
import { THROW_DURATION, SNAP_DURATION, type CardState } from '@/hooks/useSwipe';

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
};

const FONT_SANS = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";
const FONT_MONO = "'JetBrains Mono','Courier New',monospace";

const convertHexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean;
  const value = Number.parseInt(full, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
};

type Props = {
  movie: ExtendedMovie;
  nextMovies?: ExtendedMovie[];
  remainingCount: number;
  card: CardState;
  isDragging: boolean;
  handleStart: (x: number) => void;
  onSwipe: (id: string | number, liked: boolean) => void;
  triggerSwipe: (liked: boolean) => void;
  onFlip: () => void;
  isFlipped: boolean;
  onMatches: () => void;
  onBack: () => void;
  userName: string;
  matchCount: number;
};

export default function SwipeCard({
  movie, nextMovies = [], remainingCount, card, isDragging,
  handleStart, onSwipe, triggerSwipe, onFlip, isFlipped,
  onMatches, onBack, userName, matchCount,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  // ── Transition dinamica in base allo stato ────────────────────────────────
  const cardTransition = (() => {
    if (isDragging)       return 'none';
    if (card.isFlying)    return `transform ${THROW_DURATION}ms cubic-bezier(0.18, 0.84, 0.24, 1), opacity ${Math.round(THROW_DURATION * 0.72)}ms cubic-bezier(0.4, 0, 1, 1), filter ${THROW_DURATION}ms ease`;
    if (card.isSnapping)  return `transform ${SNAP_DURATION}ms cubic-bezier(0.22, 1.45, 0.36, 1), opacity ${SNAP_DURATION}ms ease, filter ${SNAP_DURATION}ms ease`;
    return 'none';
  })();

  // ── Overlay intensità ─────────────────────────────────────────────────────
  const absX = Math.abs(card.x);
  const dragProgress = Math.min(absX / 110, 1);
  const commitProgress = Math.min(Math.max((absX - 24) / 78, 0), 1);
  const overlayOpacity = Math.pow(commitProgress, 0.82);
  const showOverlay = !isFlipped && absX > 16;
  const likingRight = card.x > 0;
  const cardScale = card.isFlying
    ? 1.075
    : isDragging
      ? 1 + Math.sin(dragProgress * Math.PI * 0.5) * 0.035
      : 1;
  const dynamicRotate = card.rotate * (1 + dragProgress * 0.14);
  const liftY = card.isFlying ? -10 : isDragging ? -4 * dragProgress : 0;
  const swipeGlow = absX > 36
    ? likingRight
      ? `drop-shadow(0 18px ${20 + dragProgress * 18}px rgba(34,197,94,${0.14 + dragProgress * 0.24}))`
      : `drop-shadow(0 18px ${20 + dragProgress * 18}px rgba(239,68,68,${0.14 + dragProgress * 0.24}))`
    : 'drop-shadow(0 10px 22px rgba(0,0,0,.12))';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: FONT_SANS }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        @keyframes heartBeat {
          0% { transform: scale(1); }
          45% { transform: scale(1.32); }
          100% { transform: scale(1.08); }
        }

        @keyframes badgePop {
          0% { transform: scale(.82); }
          60% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        @keyframes floatHeart {
          0% {
            transform: translateY(10px) scale(.5);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(-50px) scale(1.2);
            opacity: 0;
          }
        }

        @keyframes shake {
          from { transform: translateX(-2px) rotate(-2deg); }
          to { transform: translateX(2px) rotate(2deg); }
        }

        @keyframes cardPulse {
          from { filter: brightness(1); }
          to { filter: brightness(1.08); }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 8px',
        borderBottom: `1px solid ${P.border}`,
        background: P.bg,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            color: P.textMuted, fontSize: '13px', fontFamily: FONT_SANS,
          }}
        >
          <ArrowLeft size={18} /> Stanza
        </button>
        <div style={{ fontSize: '13px', fontWeight: '600', color: P.text }}>@{userName}</div>
        <button
          onClick={onMatches}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: matchCount > 0 ? P.pinkGlow : P.bgSoft,
            border: `1px solid ${matchCount > 0 ? P.pink : P.border}`,
            padding: '7px 14px', cursor: 'pointer',
            fontSize: '11px', fontWeight: '700',
            color: matchCount > 0 ? P.pink : P.textMuted,
            fontFamily: FONT_SANS,
          }}
        >
          <Heart size={14} weight={matchCount > 0 ? 'fill' : 'regular'} />
          {matchCount > 0 ? matchCount : 'Match'}
        </button>
      </div>

      {/* ── Card zone ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '16px',
        touchAction: 'none', position: 'relative',
        overflow: 'hidden', background: P.bg,
      }}>
        {/* Counter */}
        <div style={{
          position: 'absolute', top: '8px', right: '16px',
          fontSize: '11px', color: P.textMuted,
          display: 'flex', alignItems: 'center', gap: '4px',
          zIndex: 1,
        }}>
          <FilmSlate size={12} color={P.textMuted} />
          {remainingCount} {remainingCount === 1 ? 'rimasto' : 'rimasti'}
        </div>

        {/* ── Mazzo: carta attiva + prossime carte ── */}
        <div style={{
          position: 'relative',
          width: 'min(300px, 88vw)',
          height: 'min(440px, 65vh)',
          marginBottom: '46px',
          isolation: 'isolate',
        }}>
          {nextMovies.slice(0, 3).map((next, index) => {
            const depth = index + 1;
            const baseScale = 1 - depth * 0.035;
            const baseY = depth * 16;
            const targetScale = index === 0 ? 1 : 1 - index * 0.035;
            const targetY = index * 16;

            // Il mazzo resta discreto durante il drag:
            // avanza solo leggermente, così la carta sotto non sembra "evidenziata".
            const deckProgress = Math.min(dragProgress * 0.18, 0.18);
            const scale = baseScale + (targetScale - baseScale) * deckProgress;
            const y = baseY + (targetY - baseY) * deckProgress;

            return (
              <div
                key={next.id}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 8 - index,
                  overflow: 'hidden',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  background: P.bgSoft,
                  border: `1px solid ${P.border}`,
                  boxShadow: `0 ${10 + depth * 2}px ${26 + depth * 6}px rgba(0,0,0,${0.14 - index * 0.02})`,
                  transformOrigin: '50% 0%',
                  transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
                  opacity: 0.78 - index * 0.12,
                  filter: `brightness(${0.82 - index * 0.05}) saturate(${0.88 - index * 0.05})`,
                  transition: isDragging
                    ? 'none'
                    : `transform ${SNAP_DURATION}ms cubic-bezier(0.22, 1.25, 0.36, 1), opacity ${SNAP_DURATION}ms ease, filter ${SNAP_DURATION}ms ease`,
                  willChange: 'transform',
                }}
              >
                <img
                  src={next.cover?.startsWith('http')
                    ? next.cover
                    : 'https://placehold.co/300x440/f8f8f8/aaa?text=🎬'}
                  alt=""
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(to bottom, rgba(0,0,0,${0.03 + index * 0.03}), rgba(0,0,0,${0.12 + index * 0.04}))`,
                }} />
              </div>
            );
          })}

          {/* ── Carta attiva ── */}
          <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            width: '100%',
            height: '100%',
            touchAction: 'none',
            userSelect: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            transform: isFlipped
              ? 'translate3d(0,0,0) rotate(0deg)'
              : `translate3d(${card.x}px, ${liftY}px, 0) rotate(${dynamicRotate}deg) scale(${cardScale})`,
            opacity: card.opacity,
            transition: isFlipped ? 'none' : cardTransition,
            willChange: 'transform, opacity, filter',
            filter: swipeGlow,
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
              overflow: 'hidden',
              boxShadow: `0 8px 32px rgba(0,0,0,0.2)`,
              background: P.bgSoft,
              border: `1px solid ${P.border}`,
            }}>
              <img
                src={movie.cover?.startsWith('http') ? movie.cover : 'https://placehold.co/300x440/f8f8f8/aaa?text=🎬'}
                alt={movie.title}
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Gradient info */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent 15%, rgba(0,0,0,0.9) 100%)',
                padding: '32px 16px 16px',
              }}>
                <div style={{ color: '#fff', fontSize: '17px', fontWeight: '800', marginBottom: '4px' }}>
                  {movie.title}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{movie.year}</span>
                  {movie.runtime && <><span>·</span><span>{movie.runtime}</span></>}
                  <span>·</span><span>{movie.genre}</span>
                </div>
                {(movie.rating ?? 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <Star size={12} color={P.gold} weight="fill" />
                    <span style={{ color: P.gold, fontSize: '11px', fontWeight: '700' }}>
                      {(movie.rating as number).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* Info button */}
              <button
                onClick={(e) => { e.stopPropagation(); onFlip(); }}
                style={{
                  position: 'absolute', top: '8px', right: '8px',
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Info size={18} color="#fff" weight="bold" />
              </button>

              {/* ── Swipe overlay con badge ── */}
              {showOverlay && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: likingRight
                    ? `radial-gradient(circle at 28% 45%, rgba(34,197,94,${0.14 + overlayOpacity * 0.22}), rgba(34,197,94,${0.04 + overlayOpacity * 0.09}) 55%, transparent 78%)`
                    : `radial-gradient(circle at 72% 45%, rgba(239,68,68,${0.14 + overlayOpacity * 0.22}), rgba(239,68,68,${0.04 + overlayOpacity * 0.09}) 55%, transparent 78%)`,
                  opacity: overlayOpacity,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: isDragging ? 'none' : 'opacity 0.1s',
                }}>
                  <div style={{
                    background: likingRight ? 'rgba(34,197,94,.94)' : 'rgba(239,68,68,.94)',
                    border: '1px solid rgba(255,255,255,.28)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '999px', padding: '11px 28px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    boxShadow: likingRight
                      ? `0 12px 34px rgba(34,197,94,${0.18 + overlayOpacity * 0.28})`
                      : `0 12px 34px rgba(239,68,68,${0.18 + overlayOpacity * 0.28})`,
                    transform: `translateY(${-6 * overlayOpacity}px) scale(${0.82 + overlayOpacity * 0.18}) rotate(${likingRight ? -7 : 7}deg)`,
                    animation: overlayOpacity > 0.92 ? 'badgePop .22s cubic-bezier(.2,.9,.3,1)' : 'none',
                    transition: isDragging ? 'none' : 'transform 0.12s ease',
                  }}>
                    {likingRight
                      ? <Heart size={26} color="#fff" weight="fill" style={{ animation: overlayOpacity > 0.7 ? 'heartBeat .52s ease-in-out infinite' : 'none' }} />
                      : <X size={26} color="#fff" weight="bold" style={{ animation: overlayOpacity > 0.7 ? 'shake .14s ease-in-out infinite alternate' : 'none' }} />
                    }
                    <span style={{ color: '#fff', fontWeight: '800', fontSize: '15px', letterSpacing: '1.5px' }}>
                      {likingRight ? 'MI PIACE' : 'PASSO'}
                    </span>
                    {likingRight && overlayOpacity > 0.96 && (
                      <span style={{
                        position: 'absolute',
                        animation: 'floatHeart .8s ease-out forwards',
                        fontSize: '32px',
                        pointerEvents: 'none',
                      }}>
                        💖
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── RETRO ── */}
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              overflow: 'hidden',
              background: P.card, border: `1px solid ${P.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              display: 'flex', flexDirection: 'column',
            }}>
              {movie.backdrop && (
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `url(${movie.backdrop})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  opacity: 0.08,
                }} />
              )}
              <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onFlip(); }}
                  style={{
                    alignSelf: 'flex-end', background: P.bgSoft, border: `1px solid ${P.border}`,
                    width: '32px', height: '32px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '8px', borderRadius: 0,
                  }}
                >
                  <X size={16} color={P.textMuted} />
                </button>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <img src={movie.cover?.startsWith('http') ? movie.cover : ''} style={{ width: '70px', height: '105px', objectFit: 'cover', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: P.text, lineHeight: 1.2, marginBottom: '6px' }}>{movie.title}</div>
                    <div style={{ fontSize: '11px', color: P.textMuted, marginBottom: '4px' }}>{movie.year} · {movie.genre}</div>
                    {movie.runtime && <div style={{ fontSize: '11px', color: P.textMuted, marginBottom: '4px' }}>⏱ {movie.runtime}</div>}
                    {(movie.rating ?? 0) > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={12} color={P.gold} weight="fill" />
                        <span style={{ fontSize: '11px', fontWeight: '700', color: P.gold }}>{(movie.rating as number).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
                {movie.tagline && (
                  <div style={{
                    fontSize: '11px', fontStyle: 'italic', color: P.pink,
                    marginBottom: '8px', padding: '4px 8px',
                    background: P.pinkGlow, borderLeft: `3px solid ${P.pink}`,
                  }}>
                    "{movie.tagline}"
                  </div>
                )}
                <div style={{ fontSize: '13px', color: P.textMuted, lineHeight: 1.7 }}>
                  {movie.trama_c ?? 'Trama non disponibile.'}
                </div>
              </div>
            </div>
            </div>
      </div>
        </div>
      </div>

      {/* ── Azioni ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '32px', padding: '8px 16px 24px',
        borderTop: `1px solid ${P.border}`, background: P.bg,
      }}>
        <button
          onClick={() => triggerSwipe(false)}
          style={{
            width: '64px', height: '64px', borderRadius: '50%',
            border: `2px solid ${isDark ? '#3a2d26' : '#f0dcd0'}`,
            background: P.bg,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all .15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = P.bg; }}
        >
          <X size={28} color="#ef4444" weight="bold" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: P.textFaint, marginBottom: '2px' }}>Passo</div>
          <div style={{ width: '2px', height: '20px', background: P.border, margin: '0 auto' }} />
          <div style={{ fontSize: '11px', color: P.textFaint, marginTop: '2px' }}>Mi piace</div>
        </div>

        <button
          onClick={() => triggerSwipe(true)}
          style={{
            width: '64px', height: '64px', borderRadius: '50%',
            border: `2px solid ${isDark ? '#3a2d26' : '#f0dcd0'}`,
            background: P.bg,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all .15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = P.bg; }}
        >
          <Heart size={28} color="#22c55e" weight="fill" />
        </button>
      </div>
    </div>
  );
}