'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { GetServerSideProps } from 'next';
import { createBrowserClient } from '@/utils/supabase/browser';

type Movie = {
  id: string | number;
  title: string;
  year: number;
  genre: string;
  cover: string | null;
  trailer: string | null;
};

type RoomUser = {
  id: string;
  name: string;
};

type SwipeState = Record<string, Record<string, boolean>>;

type Props = {
  movies: Movie[];
  roomId: string;
};

const LOCAL_STORAGE_PREFIX = 'cineDateUser:';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function Home({ movies: initialMovies, roomId }: Props) {
  const [screen, setScreen] = useState<'welcome' | 'swipe' | 'add' | 'matches'>('welcome');
  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [swipes, setSwipes] = useState<SwipeState>({});
  const [finalMatch, setFinalMatch] = useState<Movie | null>(null);
  const [matchPopup, setMatchPopup] = useState<Movie | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');
  const [cover, setCover] = useState('');
  const [trailer, setTrailer] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = useRef(0);
  const [startX, setStartX] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [showTrailerButton, setShowTrailerButton] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const channelRef = useRef<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const supabase = useRef(createBrowserClient()).current;

  const roomUsersSorted = roomUsers.slice().sort((a, b) => (a.id === currentUserId ? -1 : 1));
  const isRoomFull = roomUsers.length >= 2 && !roomUsers.find((u) => u.id === currentUserId);
  const roomUsersText = roomUsersSorted.map((user) => user.name).join(' e ');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${roomId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed?.name) {
          setCurrentUserId(parsed.id);
          setCurrentUserName(parsed.name);
          setNameInput(parsed.name);
          setScreen('swipe');
          setRoomUsers((prev) => {
            const existing = prev.find((u) => u.id === parsed.id);
            if (existing) return prev;
            return [{ id: parsed.id, name: parsed.name }, ...prev].slice(0, 2);
          });
        }
      } catch {
        // ignore
      }
    }
  }, [roomId]);

  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleGlobalMouseUp = () => {
      handleEnd();
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };

    const handleGlobalTouchEnd = () => {
      handleEnd();
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, dragOffset, startX]);

  useEffect(() => {
    if (!currentUserId || !currentUserName) return;

    const channel = supabase.channel(`room-${roomId}`);

    channel.on('broadcast', { event: 'join' }, (event) => {
      const payload = (event as any).payload as { id: string; name: string };
      const { id, name } = payload || {};
      if (!id || !name) return;
      setRoomUsers((prev) => {
        const exists = prev.find((user) => user.id === id);
        if (exists) return prev;
        const next = [...prev, { id, name }];
        return next.slice(0, 2);
      });
    });

    channel.on('broadcast', { event: 'swipe' }, (event) => {
      const payload = (event as any).payload as { movieId: string; liked: boolean; userId: string; name: string };
      const { movieId, liked, userId, name } = payload || {};
      if (!movieId || !userId) return;
      setRoomUsers((prev) => {
        if (prev.some((u) => u.id === userId)) return prev;
        return [...prev, { id: userId, name }].slice(0, 2);
      });
      setSwipes((prev) => {
        const current = prev[movieId] ?? {};
        return { ...prev, [movieId]: { ...current, [userId]: liked } };
      });
    });

    channel.on('broadcast', { event: 'match' }, (event) => {
      const payload = (event as any).payload as { movieId: string };
      const { movieId } = payload || {};
      const movie = movies.find((m) => m.id.toString() === movieId);
      if (!movie) return;
      setFinalMatch(movie);
      setMatchPopup(movie);
    });

    channel.on('broadcast', { event: 'reset' }, () => {
      setSwipes({});
      setFinalMatch(null);
      setMatchPopup(null);
      if (screen !== 'add') {
        setScreen('swipe');
      }
    });

    const subscribeChannel = async () => {
      await channel.subscribe();
      (channel as any).send({ type: 'broadcast', event: 'join', payload: { id: currentUserId, name: currentUserName } });
    };
    subscribeChannel();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, currentUserName, roomId, supabase, movies, screen]);

  const saveLocalUser = (id: string, name: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${roomId}`, JSON.stringify({ id, name }));
    }
  };

  const handleJoinRoom = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!nameInput.trim()) {
      setStatusMessage('Inserisci un nome valido');
      return;
    }

    setIsJoining(true);
    const id = currentUserId || generateUUID();
    setCurrentUserId(id);
    setCurrentUserName(nameInput.trim());
    saveLocalUser(id, nameInput.trim());
    setRoomUsers((prev) => {
      const exists = prev.find((u) => u.id === id);
      if (exists) return prev;
      return [{ id, name: nameInput.trim() }, ...prev].slice(0, 2);
    });
    setScreen('swipe');
    setStatusMessage('');
    setIsJoining(false);
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CineDate - Stanza condivisa',
          text: 'Unisciti alla mia stanza per scegliere un film insieme!',
          url: url,
        });
        setCopyMessage('Condiviso!');
        setTimeout(() => setCopyMessage(''), 2000);
      } catch (error) {
        // User cancelled or error
        setCopyMessage('Condivisione annullata');
        setTimeout(() => setCopyMessage(''), 2000);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopyMessage('Link copiato!');
        setTimeout(() => setCopyMessage(''), 2000);
      } catch {
        // Fallback: show the link
        alert(`Copia questo link: ${url}`);
        setCopyMessage('Link mostrato');
        setTimeout(() => setCopyMessage(''), 2000);
      }
    }
  };

  const handleAddMovie = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !year.trim() || !genre.trim()) {
      setStatusMessage('Compila titolo, anno e genere');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          year: Number(year),
          genre: genre.trim(),
          cover: cover.trim() || null,
          trailer: trailer.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }
      const newMovie: Movie = await response.json();
      setMovies((prev) => [newMovie, ...prev]);
      setTitle('');
      setYear('');
      setGenre('');
      setCover('');
      setTrailer('');
      setStatusMessage('Film aggiunto!');
    } catch (error) {
      console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
      console.log("KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY)
      console.error(error);
      setStatusMessage('Errore durante l aggiunta del film');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMovie = async (movieId: string | number) => {
    try {
      const response = await fetch(`/api/movies/${movieId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Errore durante l eliminazione');
      }
      setMovies((prev) => prev.filter((movie) => movie.id.toString() !== movieId.toString()));
    } catch (error) {
      console.error(error);
      setStatusMessage('Errore durante l eliminazione del film');
    }
  };

  const handleStart = (clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
    setIsSnapping(false);
    setShowTrailerButton(false);
    setLongPressProgress(0);
    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      setShowTrailerButton(true);
      setLongPressProgress(1);
      if (longPressIntervalRef.current) {
        clearInterval(longPressIntervalRef.current);
        longPressIntervalRef.current = null;
      }
    }, 3000);
    // Start progress update
    longPressIntervalRef.current = setInterval(() => {
      setLongPressProgress((prev) => Math.min(prev + 0.1, 1));
    }, 300);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || isSnapping) return;
    const offset = clientX - startX;
    const clampedOffset = Math.max(-300, Math.min(300, offset));
    dragOffsetRef.current = clampedOffset;
    const snapThreshold = 50;
    const threshold = 100;
    // Cancel long press if user moves significantly
    if (Math.abs(clampedOffset) > 20 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      if (longPressIntervalRef.current) {
        clearInterval(longPressIntervalRef.current);
        longPressIntervalRef.current = null;
      }
      setShowTrailerButton(false);
      setLongPressProgress(0);
    }
    if (Math.abs(clampedOffset) > snapThreshold) {
      const target = Math.sign(clampedOffset) * threshold;
      setDragOffset(target);
      setIsSnapping(true);
      setTimeout(() => {
        handleEnd();
        setIsSnapping(false);
      }, 200); // faster snap
    } else {
      setDragOffset(clampedOffset);
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    const threshold = 60;
    const currentOffset = dragOffsetRef.current;
    if (currentOffset > threshold) {
      handleSwipe(currentMovie.id, true); // like
    } else if (currentOffset < -threshold) {
      handleSwipe(currentMovie.id, false); // pass
    }
    setIsDragging(false);
    setDragOffset(0);
    dragOffsetRef.current = 0;
    setIsSnapping(false);
    setShowTrailerButton(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
    setLongPressProgress(0);
  };

  const getRemaining = () => {
    if (finalMatch) return [finalMatch];
    if (!currentUserId) return movies;
    return movies.filter((m) => swipes[m.id]?.[currentUserId] === undefined);
  };

  const getMatches = () => {
    return movies.filter((m) => {
      const movieSwipes = swipes[m.id] || {};
      const likeCount = Object.values(movieSwipes).filter(Boolean).length;
      return likeCount >= 2;
    });
  };

  const handleSwipe = (movieId: string | number, liked: boolean) => {
    if (!currentUserId || !currentUserName) return;
    if (finalMatch) return;
    const movieKey = movieId.toString();

    setSwipes((prev) => {
      const current = prev[movieKey] ?? {};
      const next = { ...prev, [movieKey]: { ...current, [currentUserId]: liked } };
      return next;
    });

    const roomHasOtherLike = Object.entries(swipes[movieKey] ?? {}).some(
      ([userId, value]) => userId !== currentUserId && value === true
    );

    if (liked && roomHasOtherLike) {
      const movie = movies.find((m) => m.id.toString() === movieKey);
      if (movie) {
        setFinalMatch(movie);
        setMatchPopup(movie);
        channelRef.current?.send({ type: 'broadcast', event: 'match', payload: { movieId: movieKey } });
      }
    }

    channelRef.current?.send({
      type: 'broadcast',
      event: 'swipe',
      payload: { movieId: movieKey, liked, userId: currentUserId, name: currentUserName },
    });
  };

  const handleResetSwipes = () => {
    if (!window.confirm('Reimpostare tutti gli swipe e i match?')) return;
    setSwipes({});
    setFinalMatch(null);
    setMatchPopup(null);
    channelRef.current?.send({ type: 'broadcast', event: 'reset', payload: {} });
    setScreen('swipe');
  };

  const triggerFinalMatch = (movie: Movie) => {
    setFinalMatch(movie);
    setMatchPopup(movie);
  };

  const remaining = getRemaining();
  const currentMovie = remaining[0];

  if (screen === 'welcome') {
    return (
      <div style={styles.screen}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>🎬</div>
          <div style={styles.logoName}>CineDate</div>
          <div style={styles.logoSub}>Condividi la stanza e scegli il film in coppia</div>
          <div style={styles.roomCode}>Stanza: {roomId.slice(0, 8)}...</div>
          <button style={styles.shareBtn} onClick={handleCopyLink}>
            Condividi stanza
          </button>
          {copyMessage ? <div style={styles.copyInfo}>{copyMessage}</div> : null}
        </div>
        <form onSubmit={handleJoinRoom} style={styles.joinForm}>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Il tuo nome"
            style={styles.input}
            maxLength={20}
          />
          <button type="submit" disabled={isJoining || isRoomFull} style={styles.submitBtn}>
            {isRoomFull ? 'Stanza piena' : 'Entra nella stanza'}
          </button>
          {statusMessage ? <div style={styles.message}>{statusMessage}</div> : null}
        </form>
        <div style={styles.statusCard}>
          <div style={styles.statusTitle}>Partecipanti</div>
          {roomUsersSorted.length === 0 ? (
            <div style={styles.statusText}>Nessuno ancora in stanza</div>
          ) : (
            roomUsersSorted.map((user) => (
              <div key={user.id} style={styles.statusText}>
                {user.name} {user.id === currentUserId ? '(tu)' : ''}
              </div>
            ))
          )}
          {roomUsersSorted.length === 1 && <div style={styles.pendingText}>In attesa del secondo partner...</div>}
        </div>
      </div>
    );
  }

  if (finalMatch) {
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.headerBtn} onClick={() => setScreen('welcome')}>
            ←
          </button>
          <span>Match finale</span>
          <button style={styles.headerBtn} onClick={handleCopyLink}>
            ↗
          </button>
        </div>
        <div style={styles.matchFull}> 
          <div style={styles.matchBadge}>MATCH!</div>
          <img
            src={finalMatch.cover && finalMatch.cover.startsWith('http') ? finalMatch.cover : 'https://via.placeholder.com/300x420'}
            alt={finalMatch.title}
            style={styles.matchImageLarge}
          />
          <div style={styles.matchTitleLarge}>{finalMatch.title}</div>
          <div style={styles.matchMeta}>{finalMatch.year} • {finalMatch.genre}</div>
          <button
            style={styles.watchBtn}
            onClick={() => finalMatch.trailer && window.open(finalMatch.trailer, '_blank')}
          >
            Guarda trailer
          </button>
          <button style={styles.resetBtn} onClick={handleResetSwipes}>
            Nuova scelta
          </button>
        </div>
        {matchPopup && (
          <div style={styles.popupOverlay}>
            <div style={styles.popupCard}>
              <div style={styles.popupTitle}>MATCH!</div>
              <div style={styles.popupMovie}>{matchPopup.title}</div>
              <button style={styles.watchBtn} onClick={() => finalMatch?.trailer && window.open(finalMatch.trailer, '_blank')}>
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

  if (screen === 'swipe') {
    if (remaining.length === 0) {
      return (
        <div style={styles.screen}>
          <div style={styles.header}>
            <button style={styles.headerBtn} onClick={() => setScreen('welcome')}>
              ←
            </button>
            <span>{currentUserName}</span>
            <button style={styles.headerBtn} onClick={() => setScreen('add')}>
              ＋
            </button>
          </div>
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🍿</div>
            <div style={styles.emptyTitle}>Hai visto tutto!</div>
            <div style={styles.emptySub}>Aggiungi altri film o attendi il partner</div>
            <button style={styles.addBtn} onClick={() => setScreen('add')}>
              ＋ Aggiungi Film
            </button>
            <div style={styles.resetRow}>
              <button style={styles.resetBtn} onClick={handleResetSwipes}>
                ↻ Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.headerBtn} onClick={() => setScreen('welcome')}>
            ←
          </button>
          <span>{currentUserName}</span>
          <button style={styles.matchPill} onClick={() => setScreen('matches')}>
            ❤ {Object.values(swipes).filter((vote) => Object.values(vote).filter(Boolean).length >= 2).length}
          </button>
        </div>
        <div style={styles.cardZone}>
          {currentMovie && (
            <div
              ref={cardRef}
              style={{
                ...styles.card,
                transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.15}deg) scale(${1 - Math.abs(dragOffset) * 0.001})`,
                transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                cursor: isDragging ? 'grabbing' : 'grab',
                willChange: 'transform',
              }}
              onTouchStart={(e) => handleStart(e.touches[0].clientX)}
              onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }}
              onTouchEnd={handleEnd}
              onMouseDown={(e) => handleStart(e.clientX)}
              onMouseMove={(e) => handleMove(e.clientX)}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
            >
              <img
                src={currentMovie.cover && currentMovie.cover.startsWith('http') ? currentMovie.cover : 'https://via.placeholder.com/300x420'}
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
              {Math.abs(dragOffset) > 30 && (
                <div
                  style={{
                    ...styles.swipeOverlay,
                    backgroundColor: dragOffset > 0 ? 'rgba(74, 222, 128, 0.8)' : 'rgba(255, 77, 106, 0.8)',
                    opacity: Math.min(Math.abs(dragOffset) / 120, 1),
                  }}
                >
                  <div style={styles.swipeText}>
                    {dragOffset > 0 ? 'LIKE' : 'PASS'}
                  </div>
                </div>
              )}
              {longPressProgress > 0 && longPressProgress < 1 && (
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${longPressProgress * 100}%`,
                    }}
                  />
                </div>
              )}
              {showTrailerButton && currentMovie?.trailer && (
                <div style={styles.trailerOverlay}>
                  <button
                    style={styles.trailerButton}
                    onClick={() => {
                      if (currentMovie?.trailer) {
                        window.open(currentMovie.trailer, '_blank');
                      }
                      setShowTrailerButton(false);
                    }}
                  >
                    🎬 Guarda Trailer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={styles.actionRow}>
          <button style={{ ...styles.actionBtn, ...styles.passBtn }} onClick={() => handleSwipe(currentMovie.id, false)}>
            ✕
          </button>
          <button style={{ ...styles.actionBtn, ...styles.likeBtn }} onClick={() => handleSwipe(currentMovie.id, true)}>
            ❤
          </button>
        </div>
        <div style={styles.resetRow}>
          <button style={styles.resetBtn} onClick={handleResetSwipes}>
            ↻ Reset
          </button>
        </div>
        <div style={styles.prog}>{remaining.length} film rimanenti</div>
      </div>
    );
  }

  if (screen === 'add') {
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.headerBtn} onClick={() => setScreen('swipe')}>
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
                <img src={m.cover && m.cover.startsWith('http') ? m.cover : 'https://via.placeholder.com/200x300'} alt={m.title} style={styles.matchImage} />
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
  screen: { display: 'flex' as const, flexDirection: 'column' as const, height: '100vh', background: '#FBF0B7' },
  logo: { textAlign: 'center' as const, padding: '40px 24px', flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '20px' },
  logoIcon: { fontSize: 'clamp(40px, 15vw, 60px)' },
  logoName: { fontSize: 'clamp(24px, 8vw, 32px)', fontWeight: 'bold' as const, color: '#FFB8C3', letterSpacing: '3px' },
  logoSub: { fontSize: '14px', color: '#C5E8EB' },
  roomCode: { fontSize: '12px', color: '#FFB8C3', marginTop: '10px', fontFamily: 'monospace' },
  shareBtn: { background: '#FFB8C3', color: '#fff', border: 'none', borderRadius: '999px', padding: '12px 20px', fontSize: '14px', cursor: 'pointer' },
  copyInfo: { fontSize: '12px', color: '#555', marginTop: '10px' },
  joinForm: { display: 'grid', gap: '12px', padding: '0 24px 24px' },
  statusCard: { background: '#F8D2D7', borderRadius: '16px', padding: '16px', border: '1px solid #C5E8EB', margin: '0 24px 24px' },
  statusTitle: { fontSize: '16px', fontWeight: '600' as const, marginBottom: '8px' },
  statusText: { fontSize: '14px', lineHeight: '1.5', color: '#555' },
  pendingText: { fontSize: '14px', color: '#FFB8C3' },
  matchFull: { fontWeight: '700' as const, color: '#C5E8EB' },
  matchBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFB8C3', color: '#fff', padding: '8px 12px', borderRadius: '999px', fontSize: '12px', marginTop: '10px' },
  matchImageLarge: { width: '100%', maxHeight: '320px', objectFit: 'cover' as const, borderRadius: '16px', marginBottom: '18px' },
  matchTitleLarge: { fontSize: '22px', fontWeight: '700' as const, marginBottom: '10px' },
  matchMeta: { fontSize: '14px', color: '#666', marginBottom: '20px' },
  watchBtn: { background: '#C5E8EB', color: '#333', border: 'none', borderRadius: '12px', padding: '12px 20px', fontSize: '14px', cursor: 'pointer' },
  popupOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 30 },
  popupCard: { background: '#FBF0B7', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 24px 60px rgba(0,0,0,0.12)' },
  popupTitle: { fontSize: '20px', fontWeight: '700' as const, marginBottom: '12px' },
  popupMovie: { fontSize: '16px', color: '#333', marginBottom: '18px' },
  popupClose: { background: 'none', border: 'none', fontSize: '14px', color: '#666', cursor: 'pointer', marginTop: '18px' },
  partnerRow: { display: 'flex', gap: '20px', justifyContent: 'center', padding: '0 24px 40px', flexWrap: 'wrap' as const },
  partnerCard: { background: '#F8D2D7', border: '1px solid #C5E8EB', borderRadius: '12px', padding: '30px 20px', cursor: 'pointer', textAlign: 'center' as const, flex: '1 1 140px' },
  partnerIcon: { fontSize: '40px', marginBottom: '10px' },
  partnerName: { fontSize: '16px', fontWeight: '500' as const },
  partnerSub: { fontSize: '12px', color: '#999', marginTop: '5px' },
  footer: { padding: '20px 24px', borderTop: '1px solid #C5E8EB', textAlign: 'center' as const },
  footerBtn: { background: 'none', border: 'none', fontSize: '12px', color: '#333', cursor: 'pointer', textDecoration: 'underline' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #C5E8EB', background: '#F8D2D7' },
  headerBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '6px' },
  matchPill: { background: '#B3FBB7', color: '#333', border: 'none', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '15px', textAlign: 'center' as const },
  emptyIcon: { fontSize: '60px' },
  emptyTitle: { fontSize: '20px', fontWeight: '500' as const },
  emptySub: { fontSize: '14px', color: '#999' },
  addBtn: { background: '#B3FBB7', color: '#333', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' },
  cardZone: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  card: { position: 'relative' as const, width: 'min(300px, 90vw)', height: 'min(400px, 70vh)', borderRadius: '16px', overflow: 'hidden', background: '#C5E8EB' },
  cardImage: { width: '100%', height: '100%', objectFit: 'cover' as const },
  cardGradient: { position: 'absolute' as const, inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.8) 100%)' },
  cardInfo: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, padding: '15px', color: '#fff' },
  cardTitle: { fontSize: 'clamp(16px, 5vw, 20px)', fontWeight: '500' as const, marginBottom: '5px' },
  cardMeta: { fontSize: '12px', color: 'rgba(255,255,255,0.7)' },
  swipeOverlay: { position: 'absolute' as const, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' },
  swipeText: { fontSize: '32px', fontWeight: 'bold' as const, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
  trailerOverlay: { position: 'absolute' as const, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', borderRadius: '16px' },
  trailerButton: { background: '#FFB8C3', color: '#333', border: 'none', borderRadius: '12px', padding: '12px 20px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' },
  progressBar: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.6)', borderRadius: '0 0 16px 16px' },
  progressFill: { height: '100%', background: '#FFB8C3', borderRadius: '0 0 16px 0', transition: 'width 0.3s ease' },
  actionRow: { display: 'flex', gap: '30px', alignItems: 'center', justifyContent: 'center', padding: '15px 20px', borderTop: '1px solid #eee' },
  actionBtn: { width: '60px', height: '60px', borderRadius: '50%', border: '2px solid', fontSize: '20px', cursor: 'pointer', background: '#fff' },
  passBtn: { borderColor: '#F8D2D7', color: '#F8D2D7' },
  likeBtn: { borderColor: '#B3FBB7', color: '#39B54A' },
  resetRow: { display: 'flex', justifyContent: 'center', padding: '10px 20px' },
  resetBtn: { background: '#C5E8EB', color: '#333', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer' },
  prog: { textAlign: 'center' as const, fontSize: '12px', color: '#999', padding: '8px' },
  fbody: { padding: '20px', flex: 1, overflowY: 'auto' as const },
  form: { display: 'flex', flexDirection: 'column' as const, gap: '12px', marginBottom: '20px' },
  input: { padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontFamily: 'system-ui' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  submitBtn: { background: '#FFB8C3', color: '#333', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', cursor: 'pointer' },
  message: { padding: '12px', background: '#B3FBB7', border: '1px solid #C5E8EB', borderRadius: '8px', color: '#333', marginBottom: '20px' },
  divider: { borderTop: '1px solid #C5E8EB', margin: '20px 0' },
  sectionTitle: { fontSize: '14px', color: '#C5E8EB', marginBottom: '12px', fontWeight: '500' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' },
  tableHeader: { textAlign: 'left' as const, padding: '10px', borderBottom: '1px solid #C5E8EB', fontWeight: '500' as const, fontSize: '12px', color: '#333' },
  tableCell: { padding: '10px', borderBottom: '1px solid #F8D2D7' },
  deleteBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '5px' },
  matchGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '16px', flex: 1, overflowY: 'auto' as const },
  matchCard: { borderRadius: '12px', overflow: 'hidden', background: '#F8D2D7', border: '1px solid #C5E8EB' },
  matchImage: { width: '100%', aspectRatio: '2/3', objectFit: 'cover' as const },
  matchInfo: { padding: '10px' },
  matchTitle: { fontSize: '14px', fontWeight: '500' as const },
};

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  let roomId = query.room as string;
  if (!roomId) {
    // Genera nuovo roomId
    const { randomUUID } = await import('crypto');
    roomId = randomUUID();
    // Redirect a ?room=roomId
    return {
      redirect: {
        destination: `?room=${roomId}`,
        permanent: false,
      },
    };
  }

  let movies: Movie[] = [];
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();
    const { data: movieData, error } = await supabase.from('movies').select('*');
    movies = (movieData as Movie[]) || [];
    // If no movies exist yet, seed defaults
    if (movies.length === 0) {
      const defaultMovies = [
        { title: 'The Shawshank Redemption', year: 1994, genre: 'Drama', cover: 'https://m.media-amazon.com/images/M/MV5BNDE3ODcxYzMtY2YzZC00NmNlLWJiNDMtZDViZWM2MzIxZDYwXkEyXkFqcGdeQXVyNjAwNDUxODI@._V1_.jpg', trailer: 'https://www.youtube.com/watch?v=6hB3S9bIaco' },
        { title: 'The Godfather', year: 1972, genre: 'Crime', cover: 'https://m.media-amazon.com/images/M/MV5BM2MyNjYxNmUtYTAwNi00MTYxLWJmNWYtYzZlODY3ZTk3OTFlXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg', trailer: 'https://www.youtube.com/watch?v=sY1S34973zI' },
        { title: 'The Dark Knight', year: 2008, genre: 'Action', cover: 'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg', trailer: 'https://www.youtube.com/watch?v=EXeTwQWrcwY' },
        { title: 'Pulp Fiction', year: 1994, genre: 'Crime', cover: 'https://m.media-amazon.com/images/M/MV5BNGNhMDIzZTUtNTBlZi00MTRlLWFjM2ItYzViMjE3YzI5MjljXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg', trailer: 'https://www.youtube.com/watch?v=s7EdQ4FqbhY' },
        { title: 'Forrest Gump', year: 1994, genre: 'Drama', cover: 'https://m.media-amazon.com/images/M/MV5BNWIwODRlZTUtY2U3ZS00Yzg1LWJhNzYtMmZiYmEyNmU1NjMzXkEyXkFqcGdeQXVyMTQxNzMzNDI@._V1_.jpg', trailer: 'https://www.youtube.com/watch?v=bLvqoHBptjg' },
      ];
      for (const movie of defaultMovies) {
        const newMovie = {
          id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          }),
          ...movie,
        };
        await supabase.from('movies').insert(newMovie);
        movies.push(newMovie as Movie);
      }
    }
    // Shuffle the movies array
    movies = movies.sort(() => Math.random() - 0.5);
  } catch (error) {
    console.error('Error:', error);
  }
  return { props: { movies, roomId } };
};
