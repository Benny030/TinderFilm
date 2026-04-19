'use client';

import { useState, useEffect } from 'react';
import type { GetServerSideProps } from 'next';

type Movie = {
  id: string | number;
  title: string;
  year: number;
  genre: string;
  cover: string | null;
  trailer: string | null;
};

type Props = {
  movies: Movie[];
};

export default function Home({ movies: initialMovies }: Props) {
  const [screen, setScreen] = useState<'landing' | 'swipe' | 'add' | 'matches'>('landing');
  const [currentUser, setCurrentUser] = useState<'p1' | 'p2' | null>(null);
  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [swipes, setSwipes] = useState<Record<string, { p1?: boolean; p2?: boolean }>>({});
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('2026');
  const [genre, setGenre] = useState('');
  const [cover, setCover] = useState('');
  const [trailer, setTrailer] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userNames = { p1: 'Partner A', p2: 'Partner B' };

  // Fetch swipes
  useEffect(() => {
    const loadSwipes = async () => {
      try {
        const res = await fetch('/api/swipes');
        if (res.ok) {
          const data = await res.json();
          const swipesMap: Record<string, { p1?: boolean; p2?: boolean }> = {};
          data.forEach((swipe: any) => {
            if (!swipesMap[swipe.movie_id]) swipesMap[swipe.movie_id] = {};
            swipesMap[swipe.movie_id].p1 = swipe.liked;
          });
          setSwipes(swipesMap);
        }
      } catch (error) {
        console.error('Error loading swipes:', error);
      }
    };
    loadSwipes();
  }, []);

  const handleAddMovie = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          year: Number(year),
          genre,
          cover: cover || null,
          trailer: trailer || null,
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        setStatusMessage(result.error || 'Errore');
      } else {
        setMovies((prev) => [result.movie as Movie, ...prev]);
        setStatusMessage('Film aggiunto! 🎬');
        resetForm();
        setTimeout(() => setStatusMessage(''), 2000);
      }
    } catch (error) {
      setStatusMessage('Errore: ' + (error instanceof Error ? error.message : 'sconosciuto'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setYear('2026');
    setGenre('');
    setCover('');
    setTrailer('');
  };

  const handleSwipe = async (movieId: string | number, liked: boolean) => {
    try {
      await fetch('/api/swipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId.toString(), liked, user: 'guest' }),
      });
      setSwipes((prev) => ({
        ...prev,
        [movieId]: { ...prev[movieId], p1: liked },
      }));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDeleteMovie = async (movieId: string | number) => {
    if (!window.confirm('Eliminare?')) return;
    try {
      const response = await fetch(`/api/movies/${movieId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setMovies((prev) => prev.filter((m) => m.id !== movieId));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getRemaining = () => movies.filter((m) => swipes[m.id]?.p1 === undefined);
  const getMatches = () => movies.filter((m) => swipes[m.id]?.p1 === true && swipes[m.id]?.p2 === true);

  // Landing
  if (screen === 'landing') {
    return (
      <div style={styles.screen}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>🎬</div>
          <div style={styles.logoName}>CineDate</div>
          <div style={styles.logoSub}>Scegliere il film della serata, insieme</div>
        </div>
        <div style={styles.partnerRow}>
          {(['p1', 'p2'] as const).map((p) => (
            <div
              key={p}
              style={styles.partnerCard}
              onClick={() => {
                setCurrentUser(p);
                setScreen('swipe');
              }}
            >
              <div style={styles.partnerIcon}>{p === 'p1' ? '🧑' : '🧑‍🦰'}</div>
              <div style={styles.partnerName}>{userNames[p]}</div>
              <div style={styles.partnerSub}>Sono io</div>
            </div>
          ))}
        </div>
        <div style={styles.footer}>
          <button style={styles.footerBtn} onClick={() => setScreen('add')}>
            ＋ Aggiungi Film
          </button>
        </div>
      </div>
    );
  }

  // Swipe
  if (screen === 'swipe') {
    const remaining = getRemaining();
    const currentMovie = remaining[0];

    if (remaining.length === 0) {
      return (
        <div style={styles.screen}>
          <div style={styles.header}>
            <button style={styles.headerBtn} onClick={() => setScreen('landing')}>
              ←
            </button>
            <span>{currentUser && userNames[currentUser]}</span>
            <button style={styles.headerBtn} onClick={() => setScreen('add')}>
              ＋
            </button>
          </div>
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🍿</div>
            <div style={styles.emptyTitle}>Hai visto tutto!</div>
            <div style={styles.emptySub}>Aggiungi altri film</div>
            <button style={styles.addBtn} onClick={() => setScreen('add')}>
              ＋ Aggiungi Film
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.headerBtn} onClick={() => setScreen('landing')}>
            ←
          </button>
          <span>{currentUser && userNames[currentUser]}</span>
          <button style={styles.matchPill} onClick={() => setScreen('matches')}>
            ❤ {getMatches().length}
          </button>
        </div>
        <div style={styles.cardZone}>
          {currentMovie && (
            <div style={styles.card}>
              <img
                src={currentMovie.cover || 'https://via.placeholder.com/300x420'}
                alt={currentMovie.title}
                style={styles.cardImage}
              />
              <div style={styles.cardGradient}></div>
              <div style={styles.cardInfo}>
                <div style={styles.cardTitle}>{currentMovie.title}</div>
                <div style={styles.cardMeta}>
                  {currentMovie.year} {currentMovie.genre && `• ${currentMovie.genre}`}
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={styles.actionRow}>
          <button
            style={{ ...styles.actionBtn, ...styles.passBtn }}
            onClick={() => handleSwipe(currentMovie.id, false)}
          >
            ✕
          </button>
          <button
            style={{ ...styles.actionBtn, ...styles.likeBtn }}
            onClick={() => handleSwipe(currentMovie.id, true)}
          >
            ❤
          </button>
        </div>
        <div style={styles.prog}>{remaining.length} film rimanenti</div>
      </div>
    );
  }

  // Add/Manage
  if (screen === 'add') {
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.headerBtn} onClick={() => setScreen(currentUser ? 'swipe' : 'landing')}>
            ←
          </button>
          <span>Aggiungi Film</span>
          <span></span>
        </div>
        <div style={styles.fbody}>
          <form onSubmit={handleAddMovie} style={styles.form}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo film" required style={styles.input} />
            <div style={styles.twoCol}>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" style={styles.input} />
              <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genere" style={styles.input} />
            </div>
            <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="URL copertina" style={styles.input} />
            <input value={trailer} onChange={(e) => setTrailer(e.target.value)} placeholder="URL trailer" style={styles.input} />
            <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
              {isSubmitting ? 'Salvataggio...' : '🎬 Aggiungi Film'}
            </button>
          </form>
          {statusMessage && <div style={styles.message}>{statusMessage}</div>}

          <div style={styles.divider} />

          <h3 style={styles.sectionTitle}>Film esistenti</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>Titolo</th>
                <th style={styles.tableHeader}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {movies.map((m) => (
                <tr key={m.id}>
                  <td style={styles.tableCell}>{m.title}</td>
                  <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                    <button style={styles.deleteBtn} onClick={() => handleDeleteMovie(m.id)}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Matches
  if (screen === 'matches') {
    const matched = getMatches();
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.headerBtn} onClick={() => setScreen('swipe')}>
            ←
          </button>
          <span>❤ I vostri Match</span>
          <span></span>
        </div>
        {matched.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>💔</div>
            <div style={styles.emptyTitle}>Nessun match</div>
          </div>
        ) : (
          <div style={styles.matchGrid}>
            {matched.map((m) => (
              <div key={m.id} style={styles.matchCard}>
                <img src={m.cover || 'https://via.placeholder.com/200x300'} alt={m.title} style={styles.matchImage} />
                <div style={styles.matchInfo}>
                  <div style={styles.matchTitle}>{m.title}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

const styles = {
  screen: { display: 'flex' as const, flexDirection: 'column' as const, height: '100vh', background: '#fff' },
  logo: { textAlign: 'center' as const, padding: '60px 24px', flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '20px' },
  logoIcon: { fontSize: '60px' },
  logoName: { fontSize: '32px', fontWeight: 'bold' as const, color: '#BA7517', letterSpacing: '3px' },
  logoSub: { fontSize: '14px', color: '#666' },
  partnerRow: { display: 'flex', gap: '20px', justifyContent: 'center', padding: '0 24px 40px', flexWrap: 'wrap' as const },
  partnerCard: { background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '12px', padding: '30px 20px', cursor: 'pointer', textAlign: 'center' as const, flex: '1 1 140px' },
  partnerIcon: { fontSize: '40px', marginBottom: '10px' },
  partnerName: { fontSize: '16px', fontWeight: '500' as const },
  partnerSub: { fontSize: '12px', color: '#999', marginTop: '5px' },
  footer: { padding: '20px 24px', borderTop: '1px solid #eee', textAlign: 'center' as const },
  footerBtn: { background: 'none', border: 'none', fontSize: '12px', color: '#666', cursor: 'pointer', textDecoration: 'underline' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #eee', background: '#fafafa' },
  headerBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '6px' },
  matchPill: { background: '#BA7517', color: '#fff', border: 'none', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '15px', textAlign: 'center' as const },
  emptyIcon: { fontSize: '60px' },
  emptyTitle: { fontSize: '20px', fontWeight: '500' as const },
  emptySub: { fontSize: '14px', color: '#999' },
  addBtn: { background: '#BA7517', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' },
  cardZone: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  card: { position: 'relative' as const, width: 'min(300px, 90%)', height: '400px', borderRadius: '16px', overflow: 'hidden', background: '#1a1a1a' },
  cardImage: { width: '100%', height: '100%', objectFit: 'cover' as const },
  cardGradient: { position: 'absolute' as const, inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.8) 100%)' },
  cardInfo: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, padding: '15px', color: '#fff' },
  cardTitle: { fontSize: '20px', fontWeight: '500' as const, marginBottom: '5px' },
  cardMeta: { fontSize: '12px', color: 'rgba(255,255,255,0.7)' },
  actionRow: { display: 'flex', gap: '30px', alignItems: 'center', justifyContent: 'center', padding: '15px 20px', borderTop: '1px solid #eee' },
  actionBtn: { width: '60px', height: '60px', borderRadius: '50%', border: '2px solid', fontSize: '20px', cursor: 'pointer', background: '#fff' },
  passBtn: { borderColor: '#FF4D6A', color: '#FF4D6A' },
  likeBtn: { borderColor: '#4ADE80', color: '#4ADE80' },
  prog: { textAlign: 'center' as const, fontSize: '12px', color: '#999', padding: '8px' },
  fbody: { padding: '20px', flex: 1, overflowY: 'auto' as const },
  form: { display: 'flex', flexDirection: 'column' as const, gap: '12px', marginBottom: '20px' },
  input: { padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontFamily: 'system-ui' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  submitBtn: { background: '#BA7517', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', cursor: 'pointer' },
  message: { padding: '12px', background: '#e6ffe6', border: '1px solid #4ADE80', borderRadius: '8px', color: '#0a7e0a', marginBottom: '20px' },
  divider: { borderTop: '1px solid #ddd', margin: '20px 0' },
  sectionTitle: { fontSize: '14px', color: '#BA7517', marginBottom: '12px', fontWeight: '500' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' },
  tableHeader: { textAlign: 'left' as const, padding: '10px', borderBottom: '1px solid #ddd', fontWeight: '500' as const, fontSize: '12px', color: '#666' },
  tableCell: { padding: '10px', borderBottom: '1px solid #f0f0f0' },
  deleteBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '5px' },
  matchGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '16px', flex: 1, overflowY: 'auto' as const },
  matchCard: { borderRadius: '12px', overflow: 'hidden', background: '#f9f9f9', border: '1px solid #ddd' },
  matchImage: { width: '100%', aspectRatio: '2/3', objectFit: 'cover' as const },
  matchInfo: { padding: '10px' },
  matchTitle: { fontSize: '14px', fontWeight: '500' as const },
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  let movies: Movie[] = [];
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();
    const { data: movieData } = await supabase.from('movies').select('*').order('id');
    movies = (movieData as Movie[]) || [];
  } catch (error) {
    console.error('Error:', error);
  }
  return { props: { movies } };
};
