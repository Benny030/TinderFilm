'use client';

import { useState } from 'react';
import type { Movie } from '@/types';
import { styles } from '@/styles/appStyles';

type Props = {
  currentMovie: Movie | null;
  remainingCount: number;
  onSwipe: (movieId: string | number, liked: boolean) => void;
  dragOffset: number;
  isDragging: boolean;
  handleStart: (x: number) => void;
  // ─── handleMove e handleEnd rimossi: gestiti dal global listener in index ───
  onReset: () => void;           // ─── unico prop per reset (era duplicato con handleResetSwipes) ───
  onOpenMatches: () => void;
  goBack: () => void;
  onAddFilms: () => void;
  currentUserName: string;
};

export default function SwipeScreen({
  currentMovie, remainingCount, onSwipe,
  dragOffset, isDragging, handleStart,
  onReset, onOpenMatches, goBack, onAddFilms, currentUserName,
}: Props) {
  const [isFlipped, setIsFlipped] = useState(false);

  if (!currentMovie) {
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.headerBtn} onClick={goBack}>←</button>
          <span style={styles.headerTitle}>{currentUserName}</span>
          <button style={styles.headerBtn} onClick={onAddFilms}>＋</button>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🍿</div>
          <div style={styles.emptyTitle}>Hai visto tutto!</div>
          <div style={styles.emptySub}>Aggiungi altri film o attendi il partner</div>
          <button style={styles.addBtn} onClick={onAddFilms}>＋ Aggiungi Film</button>
          <div style={styles.resetRow}>
            <button style={styles.resetBtn} onClick={onReset}>↻ Reset</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.screen, touchAction: 'none' }}>
      <div style={styles.header}>
        <button style={styles.headerBtn} onClick={goBack}>←</button>
        <span style={styles.headerTitle}>{currentUserName}</span>
        <button style={styles.matchPill} onClick={onOpenMatches}>❤</button>
      </div>

      <div style={styles.cardZone}>
        <div
          style={{
            transform: `translateX(${isFlipped ? 0 : dragOffset}px) rotate(${isFlipped ? 0 : dragOffset * 0.15}deg)`,
            transition: isDragging && !isFlipped ? 'none' : 'transform 0.3s ease',
            perspective: '1000px',
            width: 'min(300px, 88vw)',
            height: 'min(420px, 68vh)',
            touchAction: 'none',
            userSelect: 'none',
          }}
          onMouseDown={(e) => { if (isFlipped) return; e.preventDefault(); handleStart(e.clientX); }}
          onTouchStart={(e) => { if (isFlipped) return; handleStart(e.touches[0].clientX); }}
        >
          <div style={{
            width: '100%', height: '100%',
            position: 'relative', transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1)',
          }}>

            {/* ── FRONTE ── */}
            <div style={{ ...styles.card, ...styles.cardFace }}>
              <button
                style={styles.cardBtnInfo}
                onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
              >
                ⓘ
              </button>
              <img
                src={currentMovie.cover?.startsWith('http') ? currentMovie.cover : 'https://placehold.in/300x420'}
                style={styles.cardImage}
                draggable={false}
              />
              <div style={styles.cardInfo}>
                <div style={styles.cardTitle}>{currentMovie.title}</div>
                <div style={styles.cardMeta}>{currentMovie.year} • {currentMovie.genre}</div>
              </div>
              {Math.abs(dragOffset) > 30 && (
                <div style={{
                  ...styles.swipeOverlay,
                  background: dragOffset > 0 ? 'rgba(158,230,164,0.45)' : 'rgba(244,184,200,0.45)',
                  opacity: Math.min(Math.abs(dragOffset) / 120, 1),
                }}>
                  <div style={styles.swipeText}>{dragOffset > 0 ? 'LIKE' : 'PASS'}</div>
                </div>
              )}
            </div>

            {/* ── RETRO ── */}
            <div style={{ ...styles.card, ...styles.cardFaceBack }}>
              <button
                style={styles.cardBtnInfo}
                onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
              >
                ✕
              </button>
              <div style={styles.cardBackContent}>
                <div style={styles.cardBackTitle}>{currentMovie.title}</div>
                <div style={styles.cardBackMeta}>{currentMovie.year} • {currentMovie.genre}</div>
                <div style={styles.cardBackDivider} />
                <div style={styles.cardBackPlot}>
                  {currentMovie.trama_c ?? 'Trama non disponibile.'}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div style={{
        ...styles.actionRow,
        opacity: isFlipped ? 0.35 : 1,
        pointerEvents: isFlipped ? 'none' : 'auto',
      }}>
        <button style={{ ...styles.actionBtn, ...styles.passBtn }} onClick={() => onSwipe(currentMovie.id, false)}>✕</button>
        <button style={{ ...styles.actionBtn, ...styles.likeBtn }} onClick={() => onSwipe(currentMovie.id, true)}>❤</button>
      </div>

      <div style={styles.resetRow}>
        <button style={styles.resetBtn} onClick={onReset}>Reset</button>
      </div>
      <div style={styles.prog}>{remainingCount} film rimanenti</div>
    </div>
  );
}