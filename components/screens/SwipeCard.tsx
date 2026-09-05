'use client';

import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  FilmSlate,
  Heart,
  Info,
  Play,
  Star,
  X,
} from '@phosphor-icons/react';

import { useTheme } from '@/context/ThemeContext';
import { FONT, R, THEME } from '@/styles/token';
import type { ExtendedMovie } from '@/types/stanza';
import {
  SNAP_DURATION,
  THROW_DURATION,
  type CardState,
} from '@/hooks/useSwipe';

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

const fallbackPoster =
  'https://placehold.co/600x900/f5efe8/8a7c6e?text=CINEDATE';

const TRAILER_HOLD_MS = 720;

function getYouTubeEmbedUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    let videoId = '';

    if (url.hostname.includes('youtu.be')) {
      videoId = url.pathname.replace(/^\//, '').split('/')[0] ?? '';
    } else if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/embed/')[1]?.split('/')[0] ?? '';
      } else {
        videoId = url.searchParams.get('v') ?? '';
      }
    }

    if (!videoId) return null;

    return `https://www.youtube.com/embed/${encodeURIComponent(
      videoId
    )}?autoplay=1&mute=0&playsinline=1&rel=0&controls=1&modestbranding=1`;
  } catch {
    return null;
  }
}

export default function SwipeCard({
  movie,
  nextMovies = [],
  remainingCount,
  card,
  isDragging,
  handleStart,
  triggerSwipe,
  onFlip,
  isFlipped,
  onMatches,
  onBack,
  userName,
  matchCount,
}: Props) {
  const { theme } = useTheme();
  const P = theme === 'dark' ? THEME.dark : THEME.light;

  const trailerEmbedUrl = useMemo(
    () => getYouTubeEmbedUrl(movie.trailer),
    [movie.trailer]
  );
  const [isHoldingTrailer, setIsHoldingTrailer] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isTrailerClosing, setIsTrailerClosing] = useState(false);
  const holdStartedAtRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const holdFrameRef = useRef<number | null>(null);

  const clearTrailerHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdFrameRef.current !== null) {
      window.cancelAnimationFrame(holdFrameRef.current);
      holdFrameRef.current = null;
    }
    setIsHoldingTrailer(false);
    setHoldProgress(0);
  };

  const closeTrailer = () => {
    if (!isTrailerOpen || isTrailerClosing) return;

    setIsTrailerClosing(true);

    window.setTimeout(() => {
      setIsTrailerOpen(false);
      setIsTrailerClosing(false);
    }, 420);
  };

  const startTrailerHold = () => {
    if (!trailerEmbedUrl || isTrailerOpen || card.isFlying) return;

    clearTrailerHold();
    setIsHoldingTrailer(true);
    holdStartedAtRef.current = performance.now();

    const animateProgress = () => {
      const elapsed = performance.now() - holdStartedAtRef.current;
      const progress = Math.min(elapsed / TRAILER_HOLD_MS, 1);
      setHoldProgress(progress);

      if (progress < 1) {
        holdFrameRef.current = window.requestAnimationFrame(animateProgress);
      }
    };

    holdFrameRef.current = window.requestAnimationFrame(animateProgress);
    holdTimerRef.current = window.setTimeout(() => {
      setHoldProgress(1);
      setIsHoldingTrailer(false);

      // Chiudiamo il gesto di swipe PRIMA di aprire il trailer,
      // così la card non resta agganciata al puntatore.
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      document.dispatchEvent(new Event('touchend', { bubbles: true }));

      window.requestAnimationFrame(() => {
        setIsTrailerClosing(false);
        setIsTrailerOpen(true);
        if (navigator.vibrate) navigator.vibrate(18);
      });
    }, TRAILER_HOLD_MS);
  };

  useEffect(() => {
    if (Math.abs(card.x) > 10 && !isTrailerOpen) {
      clearTrailerHold();
    }
  }, [card.x, isTrailerOpen]);

  useEffect(() => {
    setIsTrailerOpen(false);
    setIsTrailerClosing(false);
    clearTrailerHold();
  }, [movie.id]);

  useEffect(() => {
    if (isFlipped) {
      clearTrailerHold();
    }
  }, [isFlipped]);

  useEffect(() => {
    return () => clearTrailerHold();
  }, []);

  useEffect(() => {
    if (!isTrailerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTrailer();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isTrailerOpen, isTrailerClosing]);

  const cardTransition = (() => {
    if (isDragging) return 'none';

    if (card.isFlying) {
      return `transform ${THROW_DURATION}ms cubic-bezier(.18,.84,.24,1),
        opacity ${Math.round(THROW_DURATION * 0.72)}ms cubic-bezier(.4,0,1,1),
        filter ${THROW_DURATION}ms ease`;
    }

    if (card.isSnapping) {
      return `transform ${SNAP_DURATION}ms cubic-bezier(.22,1.35,.36,1),
        opacity ${SNAP_DURATION}ms ease,
        filter ${SNAP_DURATION}ms ease`;
    }

    return 'none';
  })();

  const absX = Math.abs(card.x);
  const dragProgress = Math.min(absX / 110, 1);
  const commitProgress = Math.min(Math.max((absX - 22) / 78, 0), 1);
  const overlayOpacity = Math.pow(commitProgress, 0.82);
  const showOverlay = !isFlipped && absX > 14;
  const likingRight = card.x > 0;

  const cardScale = card.isFlying
    ? 1.065
    : isDragging
      ? 1 + Math.sin(dragProgress * Math.PI * 0.5) * 0.025
      : 1;

  const dynamicRotate = card.rotate * (1 + dragProgress * 0.12);
  const liftY = card.isFlying ? -8 : isDragging ? -3 * dragProgress : 0;

  const swipeShadow =
    absX > 34
      ? likingRight
        ? `drop-shadow(0 18px ${24 + dragProgress * 14}px rgba(237,61,115,${
            0.15 + dragProgress * 0.2
          }))`
        : `drop-shadow(0 18px ${24 + dragProgress * 14}px rgba(31,26,22,${
            0.16 + dragProgress * 0.15
          }))`
      : 'drop-shadow(0 14px 28px rgba(31,26,22,.14))';

  const vars = {
    '--cdr-swipe-bg': P.bg,
    '--cdr-swipe-soft': P.bgSoft,
    '--cdr-swipe-surface': P.surface,
    '--cdr-swipe-surface-hover': P.surfaceHover,
    '--cdr-swipe-border': P.border,
    '--cdr-swipe-text': P.text,
    '--cdr-swipe-muted': P.textMuted,
    '--cdr-swipe-faint': P.textFaint,
    '--cdr-swipe-pink': P.primary,
    '--cdr-swipe-pink-deep': P.primaryDeep,
    '--cdr-swipe-pink-glow': P.primaryGlow,
    '--cdr-swipe-gold': P.accent,
    '--cdr-swipe-gold-soft': P.accentSoft,
    '--cdr-swipe-gold-glow': P.accentGlow,
  } as CSSProperties;

  return (
    <main className="cdr-swipe" style={vars}>
      <style>{`
        .cdr-swipe {
          min-height: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--cdr-swipe-bg);
          color: var(--cdr-swipe-text);
          font-family: ${FONT.sans};
          overflow: hidden;
        }

        .cdr-swipe * {
          box-sizing: border-box;
        }

        .cdr-swipe button {
          font-family: ${FONT.sans};
        }

        .cdr-swipe-header {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          min-height: 64px;
          padding: 10px 20px;
          border-bottom: 1px solid var(--cdr-swipe-border);
          background: var(--cdr-swipe-bg);
        }

        .cdr-swipe-back {
          justify-self: start;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 0;
          border: 0;
          background: transparent;
          color: var(--cdr-swipe-muted);
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .cdr-swipe-back:hover {
          color: var(--cdr-swipe-text);
        }

        .cdr-swipe-user {
          color: var(--cdr-swipe-text);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: -.01em;
          white-space: nowrap;
        }

        .cdr-swipe-matches {
          justify-self: end;
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 7px 11px;
          border: 1px solid var(--cdr-swipe-border);
          border-radius: ${R.sm};
          background: transparent;
          color: var(--cdr-swipe-muted);
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
          transition: 160ms ease;
        }

        .cdr-swipe-matches[data-active="true"] {
          border-color: var(--cdr-swipe-pink);
          color: var(--cdr-swipe-pink);
          background: var(--cdr-swipe-pink-glow);
        }

        .cdr-swipe-matches:hover {
          color: var(--cdr-swipe-text);
          background: var(--cdr-swipe-surface-hover);
        }

        .cdr-swipe-stage {
          position: relative;
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 34px 20px 24px;
          touch-action: none;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 50% 34%,
              var(--cdr-swipe-gold-glow),
              transparent 34%
            ),
            var(--cdr-swipe-bg);
        }

        .cdr-swipe-progress {
          position: absolute;
          top: 12px;
          left: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: var(--cdr-swipe-faint);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: .03em;
        }

        .cdr-swipe-progress-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .cdr-swipe-progress-line {
          flex: 1;
          height: 1px;
          background: var(--cdr-swipe-border);
        }

        .cdr-swipe-deck {
          position: relative;
          width: min(360px, 88vw);
          height: min(540px, 68vh);
          isolation: isolate;
        }

        .cdr-swipe-deck-card {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          user-select: none;
          border: 1px solid var(--cdr-swipe-border);
          border-radius: ${R.md};
          background: var(--cdr-swipe-soft);
          transform-origin: 50% 0%;
          will-change: transform;
        }

        .cdr-swipe-deck-card img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .cdr-swipe-deck-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,.03),
            rgba(0,0,0,.18)
          );
        }

        .cdr-swipe-active {
          position: absolute;
          inset: 0;
          z-index: 10;
          width: 100%;
          height: 100%;
          touch-action: none;
          user-select: none;
          will-change: transform, opacity, filter;
        }

        .cdr-swipe-inner {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
        }

        .cdr-swipe-face {
          position: absolute;
          inset: 0;
          overflow: hidden;
          backface-visibility: hidden;
          border: 1px solid var(--cdr-swipe-border);
          border-radius: ${R.md};
          background: var(--cdr-swipe-surface);
          box-shadow: 0 18px 46px rgba(31,26,22,.16);
        }

        .cdr-swipe-poster {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .cdr-swipe-front-gradient {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              to top,
              rgba(8,6,5,.94) 0%,
              rgba(8,6,5,.58) 25%,
              rgba(8,6,5,.08) 52%,
              transparent 72%
            );
          pointer-events: none;
        }

        .cdr-swipe-film-info {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 22px 20px 20px;
          color: #fff;
          pointer-events: none;
        }

        .cdr-swipe-film-title {
          margin: 0;
          font-family: ${FONT.display};
          font-size: clamp(25px, 6vw, 34px);
          line-height: 1.02;
          letter-spacing: -.025em;
        }

        .cdr-swipe-meta {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          color: rgba(255,255,255,.72);
          font-size: 10px;
          font-weight: 650;
        }

        .cdr-swipe-rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--cdr-swipe-gold-soft);
          font-weight: 850;
        }

        .cdr-swipe-info {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 3;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.34);
          border-radius: ${R.sm};
          background: rgba(12,10,8,.35);
          color: #fff;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          cursor: pointer;
          transition: 160ms ease;
        }

        .cdr-swipe-info:hover {
          background: rgba(12,10,8,.58);
          transform: translateY(-1px);
        }

        .cdr-swipe-overlay {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          pointer-events: none;
        }

        .cdr-swipe-verdict {
          min-width: 138px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 12px 18px;
          border: 2px solid currentColor;
          border-radius: ${R.sm};
          background: rgba(8,6,5,.72);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: .1em;
          box-shadow: 0 16px 42px rgba(0,0,0,.2);
        }

        .cdr-swipe-verdict.like {
          color: #fff;
          border-color: var(--cdr-swipe-pink);
          background: rgba(237,61,115,.88);
        }

        .cdr-swipe-verdict.pass {
          border-color: rgba(255,255,255,.82);
        }

        .cdr-swipe-back-face {
          transform: rotateY(180deg);
        }

        .cdr-swipe-backdrop {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: .07;
          filter: saturate(.8);
        }

        .cdr-swipe-details {
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 18px;
          overflow-y: auto;
        }

        .cdr-swipe-details-close {
          align-self: flex-end;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid var(--cdr-swipe-border);
          border-radius: ${R.sm};
          background: transparent;
          color: var(--cdr-swipe-muted);
          cursor: pointer;
        }

        .cdr-swipe-details-head {
          display: grid;
          grid-template-columns: 76px 1fr;
          gap: 14px;
          align-items: start;
          margin: 14px 0 18px;
        }

        .cdr-swipe-details-poster {
          width: 76px;
          aspect-ratio: 2 / 3;
          object-fit: cover;
          border: 1px solid var(--cdr-swipe-border);
        }

        .cdr-swipe-details-title {
          margin: 0;
          font-family: ${FONT.display};
          color: var(--cdr-swipe-text);
          font-size: 22px;
          line-height: 1.05;
        }

        .cdr-swipe-details-meta {
          margin-top: 8px;
          color: var(--cdr-swipe-muted);
          font-size: 10px;
          line-height: 1.6;
        }

        .cdr-swipe-details-rating {
          margin-top: 8px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--cdr-swipe-gold);
          font-size: 11px;
          font-weight: 850;
        }

        .cdr-swipe-tagline {
          margin: 0 0 14px;
          padding: 10px 12px;
          border-left: 3px solid var(--cdr-swipe-pink);
          background: var(--cdr-swipe-pink-glow);
          color: var(--cdr-swipe-pink);
          font-family: ${FONT.display};
          font-size: 13px;
          font-style: italic;
          line-height: 1.45;
        }

        .cdr-swipe-plot {
          margin: 0;
          color: var(--cdr-swipe-muted);
          font-size: 12px;
          line-height: 1.72;
        }

        .cdr-swipe-actions {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px;
          padding: 12px 20px 22px;
          border-top: 1px solid var(--cdr-swipe-border);
          background: var(--cdr-swipe-bg);
        }

        .cdr-swipe-action {
          min-height: 52px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 10px 16px;
          border-radius: ${R.sm};
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          transition: 160ms ease;
        }

        .cdr-swipe-action.pass {
          border: 1px solid var(--cdr-swipe-border);
          background: transparent;
          color: var(--cdr-swipe-muted);
        }

        .cdr-swipe-action.pass:hover {
          background: var(--cdr-swipe-surface-hover);
          color: var(--cdr-swipe-text);
        }

        .cdr-swipe-action.like {
          border: 1px solid var(--cdr-swipe-pink);
          background: var(--cdr-swipe-pink);
          color: #fff;
          box-shadow: 0 8px 20px var(--cdr-swipe-pink-glow);
        }

        .cdr-swipe-action.like:hover {
          background: var(--cdr-swipe-pink-deep);
          transform: translateY(-1px);
        }

        .cdr-swipe-deck {
          transition:
            width .48s cubic-bezier(.2,.82,.2,1),
            height .48s cubic-bezier(.2,.82,.2,1),
            transform .48s cubic-bezier(.2,.82,.2,1);
        }

        .cdr-swipe-deck[data-trailer-open="true"] {
          width: min(760px, 92vw);
          height: min(428px, 52vw, 58vh);
          transform: translateY(-2px);
        }

        .cdr-swipe-active {
          transition:
            border-radius .42s ease,
            box-shadow .42s ease;
        }

        .cdr-swipe-deck[data-trailer-open="true"] .cdr-swipe-face,
        .cdr-swipe-deck[data-trailer-open="true"] .cdr-swipe-active {
          border-radius: ${R.md};
        }

        .cdr-swipe-trailer-hint {
          position: absolute;
          left: 50%;
          top: 12px;
          z-index: 5;
          transform: translateX(-50%);
          width: min(210px, calc(100% - 108px));
          min-width: 160px;
          display: grid;
          gap: 7px;
          padding: 9px 11px;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: ${R.sm};
          background: rgba(8,6,5,.48);
          color: rgba(255,255,255,.88);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          pointer-events: none;
          opacity: .92;
          transition: opacity 160ms ease, transform 160ms ease;
        }

        .cdr-swipe-trailer-hint[data-holding="true"] {
          opacity: 1;
          transform: translateX(-50%) translateY(-2px);
        }

        .cdr-swipe-trailer-hint-top {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .02em;
        }

        .cdr-swipe-hold-track {
          height: 2px;
          background: rgba(255,255,255,.24);
          overflow: hidden;
        }

        .cdr-swipe-hold-fill {
          height: 100%;
          transform-origin: left center;
          background: linear-gradient(
            90deg,
            var(--cdr-swipe-pink),
            var(--cdr-swipe-gold)
          );
          box-shadow: 0 0 12px var(--cdr-swipe-pink);
        }

        .cdr-swipe-trailer-shell {
          position: absolute;
          inset: 0;
          z-index: 30;
          overflow: hidden;
          border: 1px solid var(--cdr-swipe-border);
          border-radius: ${R.md};
          background: #050403;
          box-shadow: 0 24px 70px rgba(0,0,0,.34);
          animation: cdr-swipe-trailer-reveal .46s cubic-bezier(.2,.82,.2,1) both;
        }

        .cdr-swipe-trailer-shell.is-closing {
          pointer-events: none;
          animation: cdr-swipe-trailer-hide .42s cubic-bezier(.4,0,.3,1) both;
        }

        .cdr-swipe-trailer-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.05);
        }

        .cdr-swipe-trailer-frame {
          width: 100%;
          height: 100%;
          display: block;
          border: 0;
          background: #050403;
        }

        .cdr-swipe-trailer-topbar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 4;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,.74),
            rgba(0,0,0,.18),
            transparent
          );
          pointer-events: none;
        }

        .cdr-swipe-trailer-title {
          min-width: 0;
          color: white;
          font-family: ${FONT.display};
          font-size: clamp(15px, 3vw, 20px);
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 0 2px 14px rgba(0,0,0,.45);
        }

        .cdr-swipe-trailer-close {
          flex: 0 0 auto;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.34);
          border-radius: ${R.sm};
          background: rgba(0,0,0,.48);
          color: white;
          cursor: pointer;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          pointer-events: auto;
        }

        .cdr-swipe-trailer-close:hover {
          background: rgba(0,0,0,.72);
        }

        .cdr-swipe-trailer-caption {
          position: absolute;
          left: 12px;
          bottom: 10px;
          z-index: 4;
          padding: 7px 9px;
          border-left: 2px solid var(--cdr-swipe-pink);
          background: rgba(0,0,0,.48);
          color: rgba(255,255,255,.86);
          font-size: 9px;
          font-weight: 750;
          letter-spacing: .02em;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          pointer-events: none;
        }

        .cdr-swipe-stage[data-trailer-open="true"] {
          background:
            radial-gradient(
              circle at 50% 44%,
              var(--cdr-swipe-pink-glow),
              transparent 42%
            ),
            var(--cdr-swipe-bg);
        }

        .cdr-swipe-stage[data-trailer-open="true"] .cdr-swipe-progress {
          opacity: .45;
        }

        .cdr-swipe-actions[data-trailer-open="true"],
        .cdr-swipe-actions[data-flipped="true"] {
          opacity: .42;
          pointer-events: none;
          filter: saturate(.65);
        }

        .cdr-swipe-actions[data-flipped="true"] .cdr-swipe-action {
          cursor: default;
        }

        @keyframes cdr-swipe-trailer-reveal {
          0% {
            opacity: 0;
            transform: scale(.92);
            filter: blur(5px);
          }
          70% {
            opacity: 1;
            transform: scale(1.012);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
        }

        @keyframes cdr-swipe-trailer-hide {
          0% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
          30% {
            opacity: 1;
            transform: scale(1.008);
            filter: blur(0);
          }
          100% {
            opacity: 0;
            transform: scale(.92);
            filter: blur(5px);
          }
        }

        @media (max-width: 640px) {
          .cdr-swipe {
            height: 100dvh;
            min-height: 100dvh;
            overflow: hidden;
          }

          .cdr-swipe-header {
            min-height: 56px;
            padding: 8px 14px;
          }

          .cdr-swipe-stage {
            flex: 1 1 0;
            min-height: 0;
            align-items: center;
            justify-content: center;
            padding: 30px 12px 12px;
            overflow: hidden;
          }

          .cdr-swipe-progress {
            top: 9px;
            left: 14px;
            right: 14px;
          }

          /*
           * In portrait la card viene dimensionata anche in base all'altezza
           * disponibile, non solo alla larghezza dello schermo.
           * In questo modo rimane sempre dentro la viewport e centrata.
           */
          .cdr-swipe-deck {
            width: min(84vw, 40dvh);
            height: auto;
            aspect-ratio: 2 / 3;
            flex: 0 0 auto;
          }

          /*
           * Il trailer conserva l'animazione originale del deck:
           * la stessa card passa dal portrait al 16:9 restando centrata
           * nell'area disponibile.
           */
          .cdr-swipe-deck[data-trailer-open="true"] {
            width: 94vw;
            height: auto;
            aspect-ratio: 16 / 9;
            transform: translateY(0);
          }

          .cdr-swipe-actions {
            flex: 0 0 auto;
            gap: 8px;
            padding: 10px 14px max(12px, env(safe-area-inset-bottom));
          }

          .cdr-swipe-action {
            min-height: 48px;
          }

          .cdr-swipe-trailer-caption {
            display: none;
          }

          .cdr-swipe-trailer-hint {
            top: 10px;
            width: min(190px, calc(100% - 100px));
          }
        }

        @media (min-width: 760px) {
          .cdr-swipe-header {
            padding-inline: 32px;
          }

          .cdr-swipe-stage {
            padding: 44px 32px 28px;
          }

          .cdr-swipe-progress {
            left: 32px;
            right: 32px;
          }

          .cdr-swipe-actions {
            width: min(100%, 560px);
            margin: 0 auto;
            padding: 14px 0 26px;
            border-top: 0;
          }
        }

        @media (max-height: 720px) {
          .cdr-swipe-stage {
            padding-top: 28px;
          }

          .cdr-swipe-actions {
            padding-bottom: 14px;
          }
        }

        @media (max-height: 720px) and (min-width: 641px) {
          .cdr-swipe-deck {
            height: min(460px, 62vh);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cdr-swipe *,
          .cdr-swipe *::before,
          .cdr-swipe *::after {
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <header className="cdr-swipe-header">
        <button type="button" className="cdr-swipe-back" onClick={onBack}>
          <ArrowLeft size={17} />
          Stanza
        </button>

        <div className="cdr-swipe-user">@{userName}</div>

        <button
          type="button"
          className="cdr-swipe-matches"
          data-active={matchCount > 0}
          onClick={onMatches}
        >
          <Heart size={14} weight={matchCount > 0 ? 'fill' : 'regular'} />
          {matchCount > 0 ? `${matchCount} match` : 'Match'}
        </button>
      </header>

      <section className="cdr-swipe-stage" data-trailer-open={isTrailerOpen}>
        <div className="cdr-swipe-progress">
          <span className="cdr-swipe-progress-label">
            <FilmSlate size={12} />
            Scegliete insieme
          </span>
          <span className="cdr-swipe-progress-line" />
          <span>
            {remainingCount} {remainingCount === 1 ? 'film' : 'film'}
          </span>
        </div>

        <div className="cdr-swipe-deck" data-trailer-open={isTrailerOpen}>
          {nextMovies.slice(0, 3).map((next, index) => {
            const depth = index + 1;
            const baseScale = 1 - depth * 0.032;
            const baseY = depth * 13;
            const targetScale = index === 0 ? 1 : 1 - index * 0.032;
            const targetY = index * 13;
            const deckProgress = Math.min(dragProgress * 0.18, 0.18);
            const scale =
              baseScale + (targetScale - baseScale) * deckProgress;
            const y = baseY + (targetY - baseY) * deckProgress;

            return (
              <div
                key={next.id}
                className="cdr-swipe-deck-card"
                aria-hidden="true"
                style={{
                  zIndex: 8 - index,
                  transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
                  opacity: 0.76 - index * 0.12,
                  filter: `brightness(${0.86 - index * 0.05}) saturate(${
                    0.9 - index * 0.05
                  })`,
                  boxShadow: `0 ${10 + depth * 2}px ${
                    26 + depth * 5
                  }px rgba(31,26,22,${0.13 - index * 0.02})`,
                  transition: isDragging
                    ? 'none'
                    : `transform ${SNAP_DURATION}ms cubic-bezier(.22,1.25,.36,1), opacity ${SNAP_DURATION}ms ease`,
                }}
              >
                <img
                  src={
                    next.cover?.startsWith('http')
                      ? next.cover
                      : fallbackPoster
                  }
                  alt=""
                  draggable={false}
                />
                <div className="cdr-swipe-deck-shade" />
              </div>
            );
          })}

          <div
            className="cdr-swipe-active"
            style={{
              cursor: isFlipped
                ? 'default'
                : isDragging
                  ? 'grabbing'
                  : 'grab',
              transform: isFlipped
                ? 'translate3d(0,0,0) rotate(0deg)'
                : `translate3d(${card.x}px, ${liftY}px, 0) rotate(${dynamicRotate}deg) scale(${cardScale})`,
              opacity: card.opacity,
              transition: isFlipped ? 'none' : cardTransition,
              filter: swipeShadow,
            }}
            onMouseDown={(event) => {
              if (isFlipped || isTrailerOpen || isTrailerClosing) return;
              event.preventDefault();
              startTrailerHold();
              handleStart(event.clientX);
            }}
            onTouchStart={(event) => {
              if (isFlipped || isTrailerOpen || isTrailerClosing) return;
              startTrailerHold();
              handleStart(event.touches[0].clientX);
            }}
            onMouseUp={() => {
              if (!isTrailerOpen) clearTrailerHold();
            }}
            onTouchEnd={() => {
              if (!isTrailerOpen) clearTrailerHold();
            }}
          >
            <div
              className="cdr-swipe-inner"
              style={{
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition:
                  'transform .5s cubic-bezier(.4,.2,.2,1)',
              }}
            >
              <article className="cdr-swipe-face">
                <img
                  className="cdr-swipe-poster"
                  src={
                    movie.cover?.startsWith('http')
                      ? movie.cover
                      : fallbackPoster
                  }
                  alt={movie.title}
                  draggable={false}
                />

                <div className="cdr-swipe-front-gradient" />

                <button
                  type="button"
                  className="cdr-swipe-info"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFlip();
                  }}
                  aria-label={`Dettagli di ${movie.title}`}
                  disabled={isTrailerOpen || isTrailerClosing || isFlipped}
                >
                  <Info size={18} weight="bold" />
                </button>

                <div className="cdr-swipe-film-info">
                  <h1 className="cdr-swipe-film-title">{movie.title}</h1>

                  <div className="cdr-swipe-meta">
                    {movie.year && <span>{movie.year}</span>}
                    {movie.runtime && <span>· {movie.runtime}</span>}
                    {movie.genre && <span>· {movie.genre}</span>}
                    {(movie.rating ?? 0) > 0 && (
                      <span className="cdr-swipe-rating">
                        <Star size={12} weight="fill" />
                        {(movie.rating as number).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                {trailerEmbedUrl && !isTrailerOpen && !showOverlay && (
                  <div
                    className="cdr-swipe-trailer-hint"
                    data-holding={isHoldingTrailer}
                    aria-hidden="true"
                  >
                    <div className="cdr-swipe-trailer-hint-top">
                      <Play size={12} weight="fill" />
                      {isHoldingTrailer
                        ? 'Continua a tenere premuto'
                        : 'Tieni premuto per il trailer'}
                    </div>

                    <div className="cdr-swipe-hold-track">
                      <div
                        className="cdr-swipe-hold-fill"
                        style={{ transform: `scaleX(${holdProgress})` }}
                      />
                    </div>
                  </div>
                )}

                {showOverlay && (
                  <div
                    className="cdr-swipe-overlay"
                    style={{
                      opacity: overlayOpacity,
                      background: likingRight
                        ? `radial-gradient(circle at 28% 45%, rgba(237,61,115,${
                            0.12 + overlayOpacity * 0.2
                          }), transparent 68%)`
                        : `radial-gradient(circle at 72% 45%, rgba(10,8,6,${
                            0.12 + overlayOpacity * 0.26
                          }), transparent 68%)`,
                    }}
                  >
                    <div
                      className={`cdr-swipe-verdict ${
                        likingRight ? 'like' : 'pass'
                      }`}
                      style={{
                        transform: `translateY(${
                          -5 * overlayOpacity
                        }px) scale(${0.9 + overlayOpacity * 0.1}) rotate(${
                          likingRight ? -5 : 5
                        }deg)`,
                      }}
                    >
                      {likingRight ? (
                        <Heart size={22} weight="fill" />
                      ) : (
                        <X size={22} weight="bold" />
                      )}
                      {likingRight ? 'MI PIACE' : 'PASSO'}
                    </div>
                  </div>
                )}
              </article>

              <article className="cdr-swipe-face cdr-swipe-back-face">
                {movie.backdrop && (
                  <div
                    className="cdr-swipe-backdrop"
                    style={{ backgroundImage: `url(${movie.backdrop})` }}
                  />
                )}

                <div className="cdr-swipe-details">
                  <button
                    type="button"
                    className="cdr-swipe-details-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      onFlip();
                    }}
                    aria-label="Chiudi dettagli"
                  >
                    <X size={16} />
                  </button>

                  <div className="cdr-swipe-details-head">
                    <img
                      className="cdr-swipe-details-poster"
                      src={
                        movie.cover?.startsWith('http')
                          ? movie.cover
                          : fallbackPoster
                      }
                      alt=""
                    />

                    <div>
                      <h2 className="cdr-swipe-details-title">
                        {movie.title}
                      </h2>

                      <div className="cdr-swipe-details-meta">
                        {movie.year}
                        {movie.genre ? ` · ${movie.genre}` : ''}
                        {movie.runtime ? ` · ${movie.runtime}` : ''}
                      </div>

                      {(movie.rating ?? 0) > 0 && (
                        <div className="cdr-swipe-details-rating">
                          <Star size={13} weight="fill" />
                          {(movie.rating as number).toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>

                  {movie.tagline && (
                    <p className="cdr-swipe-tagline">“{movie.tagline}”</p>
                  )}

                  <p className="cdr-swipe-plot">
                    {movie.trama_c ?? 'Trama non disponibile.'}
                  </p>
                </div>
              </article>
            </div>
          </div>

          {isTrailerOpen && trailerEmbedUrl && (
            <div
              className={`cdr-swipe-trailer-shell${
                isTrailerClosing ? ' is-closing' : ''
              }`}
              role="dialog"
              aria-label={`Trailer di ${movie.title}`}
            >
              <iframe
                className="cdr-swipe-trailer-frame"
                src={trailerEmbedUrl}
                title={`Trailer di ${movie.title}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />

              <div className="cdr-swipe-trailer-topbar">
                <div className="cdr-swipe-trailer-title">{movie.title}</div>

                <button
                  type="button"
                  className="cdr-swipe-trailer-close"
                  onClick={closeTrailer}
                  aria-label="Chiudi trailer"
                >
                  <X size={17} weight="bold" />
                </button>
              </div>

              <div className="cdr-swipe-trailer-caption">
                Trailer con audio · chiudi per tornare allo swipe
              </div>
            </div>
          )}
        </div>
      </section>

      <footer
        className="cdr-swipe-actions"
        data-trailer-open={isTrailerOpen || isTrailerClosing}
        data-flipped={isFlipped}
      >
        <button
          type="button"
          className="cdr-swipe-action pass"
          onClick={() => triggerSwipe(false)}
          disabled={isTrailerOpen || isTrailerClosing || isFlipped}
        >
          <X size={19} weight="bold" />
          Passo
        </button>

        <button
          type="button"
          className="cdr-swipe-action like"
          onClick={() => triggerSwipe(true)}
          disabled={isTrailerOpen || isTrailerClosing}
        >
          <Heart size={19} weight="fill" />
          Mi piace
        </button>
      </footer>
    </main>
  );
}
