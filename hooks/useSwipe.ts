'use client';

import { useRef, useState } from 'react';

export function useSwipe(onSwipe: (liked: boolean) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const dragOffsetRef = useRef(0);
  const [startX, setStartX] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);

  // long press
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleStart = (clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
    setIsSnapping(false);

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
    if (!isDragging || isSnapping) return;

    const offset = clientX - startX;
    const clamped = Math.max(-300, Math.min(300, offset));
    dragOffsetRef.current = clamped;

    const threshold = 100;
    const snapThreshold = 50;

    // cancella long press se muovi
    if (Math.abs(clamped) > 20) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
      setLongPressProgress(0);
      setShowTrailer(false);
    }

    if (Math.abs(clamped) > snapThreshold) {
      const target = Math.sign(clamped) * threshold;
      setDragOffset(target);
      setIsSnapping(true);

      setTimeout(() => {
        handleEnd();
        setIsSnapping(false);
      }, 200);
    } else {
      setDragOffset(clamped);
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;

    const threshold = 60;
    const current = dragOffsetRef.current;

    if (current > threshold) {
      onSwipe(true);
    } else if (current < -threshold) {
      onSwipe(false);
    }

    setIsDragging(false);
    setDragOffset(0);
    dragOffsetRef.current = 0;
    setIsSnapping(false);

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);

    setLongPressProgress(0);
    setShowTrailer(false);
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