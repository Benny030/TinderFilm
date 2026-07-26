'use client';

import { useRef, useState, useCallback } from 'react';

const THROW_DISTANCE  = 1200;
const THROW_DURATION  = 420;
const SNAP_DURATION   = 380;
const ROTATION_FACTOR = 0.12;
const MAX_ROTATION    = 22;
const DRAG_THRESHOLD  = 100;

export type CardState = {
  x:          number;
  rotate:     number;
  opacity:    number;
  isFlying:   boolean;
  isSnapping: boolean;
};

const IDLE: CardState = { x: 0, rotate: 0, opacity: 1, isFlying: false, isSnapping: false };

export function useSwipe(onSwipe: (liked: boolean) => void) {
  const [card, setCard]           = useState<CardState>(IDLE);
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const lockedRef     = useRef(false);
  const startXRef     = useRef(0);
  const currentXRef   = useRef(0);
  const rafRef        = useRef<number>(0);

  const longPressTimerRef    = useRef<NodeJS.Timeout | null>(null);
  const longPressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [showTrailer, setShowTrailer]             = useState(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current)    clearTimeout(longPressTimerRef.current);
    if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
    setLongPressProgress(0);
    setShowTrailer(false);
  }, []);

  // ── Lancio fuori schermo ──────────────────────────────────────────────────
  const flyOut = useCallback((direction: 'left' | 'right') => {
    lockedRef.current = true;
    const sign = direction === 'right' ? 1 : -1;

    setCard({
      x:          sign * THROW_DISTANCE,
      rotate:     sign * (MAX_ROTATION + 8),
      opacity:    0,
      isFlying:   true,
      isSnapping: false,
    });

    setTimeout(() => {
      onSwipe(direction === 'right');
      setCard(IDLE);
      lockedRef.current = false;
    }, THROW_DURATION);
  }, [onSwipe]);

  // ── Ritorno elastico al centro ────────────────────────────────────────────
  const snapBack = useCallback(() => {
    setCard({ x: 0, rotate: 0, opacity: 1, isFlying: false, isSnapping: true });
    setTimeout(() => setCard(IDLE), SNAP_DURATION);
  }, []);

  // ── START ─────────────────────────────────────────────────────────────────
  const handleStart = useCallback((clientX: number) => {
    if (lockedRef.current) return;
    isDraggingRef.current = true;
    startXRef.current     = clientX;
    currentXRef.current   = 0;
    setIsDragging(true);
    setCard(IDLE);
    clearLongPress();

    longPressTimerRef.current = setTimeout(() => {
      setShowTrailer(true);
      setLongPressProgress(1);
    }, 3000);
    longPressIntervalRef.current = setInterval(() => {
      setLongPressProgress((p) => Math.min(p + 0.1, 1));
    }, 300);
  }, [clearLongPress]);

  // ── MOVE — via rAF per 60fps ──────────────────────────────────────────────
  const handleMove = useCallback((clientX: number) => {
    if (!isDraggingRef.current || lockedRef.current) return;

    const offset = clientX - startXRef.current;
    currentXRef.current = offset;

    if (Math.abs(offset) > 10) clearLongPress();

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rotate  = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, offset * ROTATION_FACTOR));
      const opacity = Math.max(0.7, 1 - Math.abs(offset) / (DRAG_THRESHOLD * 3));
      setCard({ x: offset, rotate, opacity, isFlying: false, isSnapping: false });
    });
  }, [clearLongPress]);

  // ── END ───────────────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    clearLongPress();
    cancelAnimationFrame(rafRef.current);

    const offset = currentXRef.current;
    currentXRef.current = 0;

    if (offset > DRAG_THRESHOLD)       flyOut('right');
    else if (offset < -DRAG_THRESHOLD) flyOut('left');
    else                               snapBack();
  }, [flyOut, snapBack, clearLongPress]);

  // ── Swipe programmático (bottoni ❤/✕) ────────────────────────────────────
  const triggerSwipe = useCallback((liked: boolean) => {
    if (lockedRef.current) return;
    flyOut(liked ? 'right' : 'left');
  }, [flyOut]);

  return {
    card,
    isDragging,
    handleStart,
    handleMove,
    handleEnd,
    triggerSwipe,
    longPressProgress,
    showTrailer,
  };
}