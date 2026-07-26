import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';
import { FilmSlate, Heart, X, ArrowLeft, Info, Star } from '@phosphor-icons/react';
import type { ExtendedMovie } from '@/types/stanza';
import type { CardState } from '@/hooks/useSwipe';

const THROW_DURATION = 420;
const SNAP_DURATION  = 380;

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

  // ── Transition dinamica in base allo stato ────────────────────────────────
  const cardTransition = (() => {
    if (isDragging)       return 'none';
    if (card.isFlying)    return `transform ${THROW_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${THROW_DURATION}ms ease`;
    if (card.isSnapping)  return `transform ${SNAP_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${SNAP_DURATION}ms ease`;
    return 'none';
  })();

  // ── Overlay intensità ─────────────────────────────────────────────────────
  const overlayOpacity = Math.min(Math.abs(card.x) / 80, 1);
  const showOverlay    = !isFlipped && Math.abs(card.x) > 20;
  const likingRight    = card.x > 0;

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
        <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>@{userName}</div>
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
        overflow: 'hidden',
      }}>

        {/* Counter */}
        <div style={{
          position: 'absolute', top: S.sm, right: S.md,
          fontSize: TEXT.xs, color: C.muted,
          display: 'flex', alignItems: 'center', gap: '4px',
          zIndex: 1,
        }}>
          <FilmSlate size={12} color={C.muted} />
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
            // ── Fisica ──────────────────────────────────────────────────────
            transform: isFlipped
              ? 'translateX(0) rotate(0deg)'
              : `translateX(${card.x}px) rotate(${card.rotate}deg)`,
            opacity: card.opacity,
            transition: isFlipped ? 'none' : cardTransition,
            willChange: 'transform, opacity',
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
              boxShadow: SHADOW.xl, background: C.bgSoft,
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
                {(movie.rating ?? 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <Star size={12} color="#f59e0b" weight="fill" />
                    <span style={{ color: '#f59e0b', fontSize: TEXT.xs, fontWeight: '700' }}>
                      {(movie.rating as number).toFixed(1)}
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
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Info size={18} color="#fff" weight="bold" />
              </button>

              {/* ── Swipe overlay con badge ── */}
              {showOverlay && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: R.xl,
                  background: likingRight ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
                  opacity: overlayOpacity,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: isDragging ? 'none' : 'opacity 0.1s',
                }}>
                  <div style={{
                    background: likingRight ? '#22c55e' : '#ef4444',
                    borderRadius: R.full, padding: '10px 28px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    boxShadow: SHADOW.lg,
                    transform: `scale(${0.8 + overlayOpacity * 0.2})`,
                    transition: isDragging ? 'none' : 'transform 0.1s',
                  }}>
                    {likingRight
                      ? <Heart size={26} color="#fff" weight="fill" />
                      : <X size={26} color="#fff" weight="bold" />
                    }
                    <span style={{ color: '#fff', fontWeight: '800', fontSize: TEXT.md, letterSpacing: '1.5px' }}>
                      {likingRight ? 'MI PIACE' : 'PASSO'}
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
              boxShadow: SHADOW.xl, display: 'flex', flexDirection: 'column',
            }}>
              {movie.backdrop && (
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `url(${movie.backdrop})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  opacity: 0.08,
                }} />
              )}
              <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', padding: S.md, overflowY: 'auto' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onFlip(); }}
                  style={{ alignSelf: 'flex-end', background: C.bgSoft, border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: S.sm }}
                >
                  <X size={16} color={C.muted} />
                </button>
                <div style={{ display: 'flex', gap: S.sm, marginBottom: S.md }}>
                  <img src={movie.cover?.startsWith('http') ? movie.cover : ''} style={{ width: '70px', height: '105px', objectFit: 'cover', borderRadius: R.sm, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: TEXT.base, fontWeight: '800', color: C.ink, lineHeight: 1.2, marginBottom: '6px' }}>{movie.title}</div>
                    <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '4px' }}>{movie.year} · {movie.genre}</div>
                    {movie.runtime && <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '4px' }}>⏱ {movie.runtime}</div>}
                    {(movie.rating ?? 0) > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={12} color="#f59e0b" weight="fill" />
                        <span style={{ fontSize: TEXT.xs, fontWeight: '700', color: '#f59e0b' }}>{(movie.rating as number).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
                {movie.tagline && (
                  <div style={{ fontSize: TEXT.xs, fontStyle: 'italic', color: C.primary, marginBottom: S.sm, padding: `${S.xs} ${S.sm}`, background: C.primaryLight, borderRadius: R.sm, borderLeft: `3px solid ${C.primary}` }}>
                    "{movie.tagline}"
                  </div>
                )}
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
        borderTop: `1px solid ${C.border}`, background: C.bg,
      }}>
        <button
          onClick={() => triggerSwipe(false)}
          style={{
            width: '64px', height: '64px', borderRadius: '50%',
            border: '2px solid #fee2e2', background: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
          onClick={() => triggerSwipe(true)}
          style={{
            width: '64px', height: '64px', borderRadius: '50%',
            border: '2px solid #dcfce7', background: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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