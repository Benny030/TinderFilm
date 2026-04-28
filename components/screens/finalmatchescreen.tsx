'use client';

import { SetStateAction } from "react";



type Movie = {
  id: string | number;
  title: string;
  year: number;
  genre: string;
  cover: string | null;
  trailer: string | null;
};

type Props = {
  movie: Movie;
  onReset: () => void;
  onBack: () => void;
  onShare: () => void;
  setMatchPopup: React.Dispatch<React.SetStateAction<Movie | null>>;
  matchPopup: Movie | null;
  finalMatch: Movie | null;
  styles: any;
};

export default function FinalMatchScreen({
  movie,
  onReset,
  onBack,
  onShare,
  setMatchPopup,
  matchPopup,
  finalMatch,
  styles,
}: Props) {
  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button style={styles.headerBtn} onClick={onBack}>
          ←
        </button>

        <span style={styles.headerTitle}>Match finale</span>

        <button style={styles.headerBtn} onClick={onShare}>
          ↗
        </button>
      </div>

      <div style={styles.matchFullWrapper}>
        <div style={styles.matchBadge}>🎉 MATCH!</div>

        <img
          src={
            movie.cover?.startsWith('http')
              ? movie.cover
              : 'https://via.placeholder.com/300x420'
          }
          style={styles.matchImageLarge}
        />

        <div style={styles.matchTitleLarge}>{movie.title}</div>

        <div style={styles.matchMeta}>
          {movie.year} • {movie.genre}
        </div>

        <button
          style={styles.watchBtn}
          onClick={() => movie.trailer && window.open(movie.trailer, '_blank')}
        >
          Guarda trailer
        </button>

        <button style={styles.resetBtn} onClick={onReset}>
          ↻ Nuova scelta
        </button>
      </div>
       {matchPopup && (
          <div style={styles.popupOverlay}>
            <div style={styles.popupCard}>
              <div style={styles.popupTitle}>🎉 MATCH!</div>
              <div style={styles.popupMovie}>{matchPopup.title}</div>
              <button
                style={styles.watchBtn}
                onClick={() => finalMatch?.trailer && window.open(finalMatch.trailer, '_blank')}
              >
                Guarda trailer
              </button>
              <button style={styles.popupClose} onClick={() => setMatchPopup(null)}>
                Chiudi
              </button>
            </div>
          </div>
        )}
    </div>
  );
}