'use client';

import { useRef, useState } from 'react';

export function useSwipe(onSwipe: (liked: boolean) => void) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // ─── Refs per evitare stale closure nei global listener ───────────────────
  const isDraggingRef = useRef(false);
  const isSnappingRef = useRef(false);
  const startXRef = useRef(0);
  const dragOffsetRef = useRef(0);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);

  const handleStart = (clientX: number) => {
    isDraggingRef.current = true;
    isSnappingRef.current = false;
    startXRef.current = clientX;
    dragOffsetRef.current = 0;

    setIsDragging(true);
    setDragOffset(0);
    setLongPressProgress(0);
    setShowTrailer(false);

    longPressTimerRef.current = setTimeout(() => {
      setShowTrailer(true);
      setLongPressProgress(1);
    }, 3000);

    longPressIntervalRef.current = setInterval(() => {
      setLongPressProgress((p) => Math.min(p + 0.1, 1));
    }, 300);
  };

  const handleMove = (clientX: number) => {
    // ─── usa ref, non state (evita stale closure) ─────────────────────────
    if (!isDraggingRef.current || isSnappingRef.current) return;

    const offset = clientX - startXRef.current;
    const clamped = Math.max(-300, Math.min(300, offset));
    dragOffsetRef.current = clamped;

    // cancella long press se si muove
    if (Math.abs(clamped) > 20) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
      setLongPressProgress(0);
      setShowTrailer(false);
    }

    // snap anticipato oltre soglia
    if (Math.abs(clamped) > 80) {
      isSnappingRef.current = true;
      const target = Math.sign(clamped) * 120;
      setDragOffset(target);

      setTimeout(() => {
        handleEnd();
      }, 150);
    } else {
      setDragOffset(clamped);
    }
  };

  const handleEnd = () => {
    if (!isDraggingRef.current) return;

    const current = dragOffsetRef.current;
    const threshold = 60;

    if (current > threshold) onSwipe(true);
    else if (current < -threshold) onSwipe(false);

    // reset tutto
    isDraggingRef.current = false;
    isSnappingRef.current = false;
    dragOffsetRef.current = 0;

    setIsDragging(false);
    setDragOffset(0);
    setLongPressProgress(0);
    setShowTrailer(false);

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
  };

  return {
    dragOffset,
    isDragging,
    handleStart,
    handleMove,
    handleEnd,
    longPressProgress,
    showTrailer,
  };
}