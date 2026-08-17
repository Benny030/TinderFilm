'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

export const THROW_DURATION = 520;
export const SNAP_DURATION = 440;

const BASE_THROW_DISTANCE = 1200;
const ROTATION_FACTOR = 0.095;
const MAX_ROTATION = 18;
const DRAG_THRESHOLD = 92;
const FLICK_VELOCITY = 0.48; // px/ms
const DEAD_ZONE = 4;
const LONG_PRESS_MS = 3000;

export type CardState = {
  x: number;
  rotate: number;
  opacity: number;
  isFlying: boolean;
  isSnapping: boolean;
};

const IDLE: CardState = {
  x: 0,
  rotate: 0,
  opacity: 1,
  isFlying: false,
  isSnapping: false,
};

export function useSwipe(onSwipe: (liked: boolean) => void) {
  const [card, setCard] = useState<CardState>(IDLE);
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const lockedRef = useRef(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const previousXRef = useRef(0);
  const previousTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);

  const clearAnimationFrame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const clearLongPress = useCallback((hideTrailer = true) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }

    setLongPressProgress(0);
    if (hideTrailer) setShowTrailer(false);
  }, []);

  const getThrowDistance = useCallback(() => {
    if (typeof window === 'undefined') return BASE_THROW_DISTANCE;
    return Math.max(BASE_THROW_DISTANCE, window.innerWidth * 1.35);
  }, []);

  // Lancio fuori schermo con distanza e rotazione coerenti con la velocità del gesto.
  const flyOut = useCallback((direction: 'left' | 'right', releaseVelocity = 0) => {
    if (lockedRef.current) return;

    lockedRef.current = true;
    isDraggingRef.current = false;
    setIsDragging(false);
    clearLongPress();
    clearAnimationFrame();

    const sign = direction === 'right' ? 1 : -1;
    const speedBoost = Math.min(Math.abs(releaseVelocity) * 180, 90);
    const distance = getThrowDistance() + speedBoost;
    const exitRotation = Math.min(31, 23 + Math.abs(releaseVelocity) * 7);

    setCard({
      x: sign * distance,
      rotate: sign * exitRotation,
      opacity: 0,
      isFlying: true,
      isSnapping: false,
    });

    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => {
      onSwipe(direction === 'right');
      setCard(IDLE);
      lockedRef.current = false;
      releaseTimerRef.current = null;
    }, THROW_DURATION);
  }, [clearAnimationFrame, clearLongPress, getThrowDistance, onSwipe]);

  // Rientro "springy" al centro. Il cubic-bezier del componente crea l'overshoot.
  const snapBack = useCallback(() => {
    setCard({
      x: 0,
      rotate: 0,
      opacity: 1,
      isFlying: false,
      isSnapping: true,
    });

    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => {
      setCard(IDLE);
      releaseTimerRef.current = null;
    }, SNAP_DURATION);
  }, []);

  const handleStart = useCallback((clientX: number) => {
    if (lockedRef.current) return;

    clearAnimationFrame();
    clearLongPress();

    const now = performance.now();
    isDraggingRef.current = true;
    startXRef.current = clientX;
    currentXRef.current = 0;
    previousXRef.current = clientX;
    previousTimeRef.current = now;
    velocityRef.current = 0;

    setIsDragging(true);
    setCard(IDLE);

    longPressTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current || Math.abs(currentXRef.current) > 10) return;
      setShowTrailer(true);
      setLongPressProgress(1);
    }, LONG_PRESS_MS);

    longPressIntervalRef.current = setInterval(() => {
      setLongPressProgress((progress) => Math.min(progress + 0.05, 1));
    }, LONG_PRESS_MS / 20);
  }, [clearAnimationFrame, clearLongPress]);

  // requestAnimationFrame evita update React multipli nello stesso frame.
  // La velocità viene filtrata per rendere affidabile il "flick" veloce.
  const handleMove = useCallback((clientX: number) => {
    if (!isDraggingRef.current || lockedRef.current) return;

    const now = performance.now();
    const dt = Math.max(now - previousTimeRef.current, 1);
    const instantVelocity = (clientX - previousXRef.current) / dt;
    velocityRef.current = velocityRef.current * 0.72 + instantVelocity * 0.28;
    previousXRef.current = clientX;
    previousTimeRef.current = now;

    let offset = clientX - startXRef.current;
    if (Math.abs(offset) < DEAD_ZONE) offset = 0;
    currentXRef.current = offset;

    if (Math.abs(offset) > 10) clearLongPress();

    clearAnimationFrame();
    rafRef.current = requestAnimationFrame(() => {
      const distance = Math.abs(offset);
      const direction = Math.sign(offset);

      // Più morbida al centro, più "decisa" vicino alla soglia.
      const easedDistance = distance < 40
        ? distance * 0.9
        : 36 + (distance - 40) * 1.025;
      const visualX = direction * easedDistance;

      const thresholdProgress = Math.min(distance / DRAG_THRESHOLD, 1);
      const rotate = Math.max(
        -MAX_ROTATION,
        Math.min(MAX_ROTATION, visualX * ROTATION_FACTOR * (0.88 + thresholdProgress * 0.18)),
      );

      // Non facciamo svanire troppo la card durante il drag: il fade vero avviene in uscita.
      const opacity = 1 - Math.min(distance / 900, 0.12);

      setCard({
        x: visualX,
        rotate,
        opacity,
        isFlying: false,
        isSnapping: false,
      });

      rafRef.current = null;
    });
  }, [clearAnimationFrame, clearLongPress]);

  const handleEnd = useCallback(() => {
    if (!isDraggingRef.current || lockedRef.current) return;

    isDraggingRef.current = false;
    setIsDragging(false);
    clearLongPress();
    clearAnimationFrame();

    const offset = currentXRef.current;
    const velocity = velocityRef.current;
    currentXRef.current = 0;
    velocityRef.current = 0;

    // Uno swipe può partire sia per distanza sia per flick rapido.
    const passedDistance = Math.abs(offset) >= DRAG_THRESHOLD;
    const passedVelocity = Math.abs(velocity) >= FLICK_VELOCITY && Math.abs(offset) >= 28;

    if (passedDistance || passedVelocity) {
      const direction = (passedVelocity ? velocity : offset) > 0 ? 'right' : 'left';
      flyOut(direction, velocity);
      return;
    }

    snapBack();
  }, [clearAnimationFrame, clearLongPress, flyOut, snapBack]);

  const triggerSwipe = useCallback((liked: boolean) => {
    if (lockedRef.current) return;
    flyOut(liked ? 'right' : 'left', liked ? 0.7 : -0.7);
  }, [flyOut]);

  useEffect(() => {
    return () => {
      clearAnimationFrame();
      clearLongPress();
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, [clearAnimationFrame, clearLongPress]);

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