'use client';

import type { Movie } from '@/types';
import { styles } from '@/styles/appStyles';

type Props = {
  matched: Movie[];
  onBack: () => void;
};

export default function MatchesScreen({ matched, onBack }: Props) {
  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button style={styles.headerBtn} onClick={onBack}>←</button>
        <span style={styles.headerTitle}>❤ I vostri Match</span>
        <span />
      </div>
      {matched.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>💔</div>
          <div style={styles.emptyTitle}>Nessun match ancora</div>
          <div style={styles.emptySub}>Continuate a fare swipe!</div>
        </div>
      ) : (
        <div style={styles.matchGrid}>
          {matched.map((m) => (
            <div key={m.id} style={styles.matchCard}>
              <img
                src={m.cover?.startsWith('http') ? m.cover : 'https://via.placeholder.com/200x300'}
                style={styles.matchImage}
              />
              <div style={styles.matchInfo}>
                <div style={styles.matchTitle}>{m.title}</div>
                <div style={styles.matchSubtitle}>{m.year} · {m.genre}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}