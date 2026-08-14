'use client';

import { type CSSProperties } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { FilmSlate, Heart, X, ArrowLeft, Info, Star } from '@phosphor-icons/react';
import type { ExtendedMovie } from '@/types/stanza';
import type { CardState } from '@/hooks/useSwipe';

const THROW_DURATION = 650;
const SNAP_DURATION  = 520;

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
  movie, remainingCount, card, isDragging,
  handleStart, onSwipe, triggerSwipe, onFlip, isFlipped,
  onMatches, onBack, userName, matchCount,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  // ── Transition dinamica in base allo stato ────────────────────────────────
  const cardTransition = (() => {
    if (isDragging)       return 'none';
    if (card.isFlying)    return `transform ${THROW_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${THROW_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), filter ${THROW_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    if (card.isSnapping)  return `transform ${SNAP_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${SNAP_DURATION}ms ease`;
    return 'none';
  })();

  // ── Overlay intensità ─────────────────────────────────────────────────────
  const overlayOpacity = Math.min(Math.abs(card.x) / 80, 1);
  const showOverlay    = !isFlipped && Math.abs(card.x) > 20;
  const likingRight    = card.x > 0;
  const dragProgress   = Math.min(Math.abs(card.x) / 120, 1);
  const cardScale      = card.isFlying ? 1.12 : isDragging ? 1 + dragProgress * 0.06 : 1;
  const dynamicRotate  = card.rotate * (1 + dragProgress * 0.45);
  const swipeGlow      = Math.abs(card.x) > 90
    ? likingRight
      ? 'drop-shadow(0 0 25px rgba(34,197,94,.7))'
      : 'drop-shadow(0 0 25px rgba(239,68,68,.7))'
    : 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: FONT_SANS }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        @keyframes heartBeat {
          from { transform: scale(1); }
          to { transform: scale(1.25); }
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
          from { transform: translateX(-3px); }
          to { transform: translateX(3px); }
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

        {/* ── Card fisica ── */}
        <div
          style={{
            width: 'min(300px, 88vw)',
            height: 'min(440px, 65vh)',
            touchAction: 'none',
            userSelect: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            transform: isFlipped
              ? 'translateX(0) rotate(0deg)'
              : `translateX(${card.x}px) rotate(${dynamicRotate}deg) scale(${cardScale})`,
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
                  background: likingRight ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
                  opacity: overlayOpacity,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: isDragging ? 'none' : 'opacity 0.1s',
                }}>
                  <div style={{
                    background: likingRight ? '#22c55e' : '#ef4444',
                    borderRadius: '999px', padding: '10px 28px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    transform: `scale(${0.8 + overlayOpacity * 0.35}) rotate(${likingRight ? -8 : 8}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.1s',
                  }}>
                    {likingRight
                      ? <Heart size={26} color="#fff" weight="fill" style={{ animation: 'heartBeat .55s ease-in-out infinite alternate' }} />
                      : <X size={26} color="#fff" weight="bold" style={{ animation: 'shake .16s ease-in-out infinite alternate' }} />
                    }
                    <span style={{ color: '#fff', fontWeight: '800', fontSize: '15px', letterSpacing: '1.5px' }}>
                      {likingRight ? 'MI PIACE' : 'PASSO'}
                    </span>
                    {likingRight && overlayOpacity > 0.85 && (
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