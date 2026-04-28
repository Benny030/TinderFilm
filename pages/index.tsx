'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { GetServerSideProps } from 'next';

import { createBrowserClient } from '@/utils/supabase/browser';
import { useSwipe } from '@/hooks/useSwipe';
import { useRoom } from '@/hooks/useRoom';
import { styles } from '@/styles/appStyles';
import WelcomeScreen from '@/components/screens/welcomeScreen';
import SwipeScreen from '@/components/screens/swipeScreen';
import MatchesScreen from '@/components/screens/matchesScreen';
import FinalMatchScreen from '@/components/screens/finalmatchescreen';
import AddFilmScreen from '@/components/screens/addFilmscreen';
import AdminGate from '@/components/screens/adminGate';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

import { JsonMovieRow, Movie , RoomUser , SwipeState , Props} from '@/types';



// ─────────────────────────────────────────────
// COMPONENTE PRINCIPALE
// ─────────────────────────────────────────────

export default function Home({ movies: initialMovies, roomId }: Props) {

  // ───── NAVIGAZIONE APP ─────
  const [screen, setScreen] = useState<'welcome' | 'swipe' | 'add' | 'matches'>('welcome');

  // ───── DATI FILM ─────
  const [movies, setMovies] = useState<Movie[]>(initialMovies);

  // ───── STANZA ─────  (rimane nel page, è stato condiviso tra canale e UI)
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);

  // ───── SWIPE & MATCH ─────
  const [swipes, setSwipes] = useState<SwipeState>({});
  const [finalMatch, setFinalMatch] = useState<Movie | null>(null);
  const [matchPopup, setMatchPopup] = useState<Movie | null>(null);
 
  // ───── STATO ADMIN ──────────────────────────────────────────────────────────
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);

  // ───── FORM AGGIUNTA FILM ─────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');
  const [cover, setCover] = useState('');
  const [trailer, setTrailer] = useState('');
  const [tramaCorta, setTramaCorta] = useState('');
  const [tramaLunga, setTramaLunga] = useState('');

  // ───── REFS ─────
  const channelRef = useRef<any>(null);
  const supabase = useRef(createBrowserClient()).current;

  // ───── USE ROOM (solo identità utente) ───────────────────────────────────────
  const {
    currentUserId,
    currentUserName,
    nameInput,
    setNameInput,
    isJoining,
    copyMessage,
    statusMessage,
    setStatusMessage,
    handleJoinRoom,
    handleCopyLink,
  } = useRoom({
    roomId,
    onJoined: () => setScreen('swipe'),
  });

  // ───── Valori derivati stanza (calcolati qui, dove vive roomUsers) ────────────
  const roomUsersSorted = roomUsers
    .slice()
    .sort((a) => (a.id === currentUserId ? -1 : 1));
  const isRoomFull =
    roomUsers.length >= 2 && !roomUsers.find((u) => u.id === currentUserId);

  // ───── Helper: aggiungi utente alla stanza ───────────────────────────────────
  const addUserToRoom = (id: string, name: string) => {
    setRoomUsers((prev) => {
      if (prev.find((u) => u.id === id)) return prev;
      return [...prev, { id, name }].slice(0, 2);
    });
  };

  // ───── Quando l'utente fa join, aggiunge se stesso alla lista locale ─────────
  useEffect(() => {
    if (!currentUserId || !currentUserName) return;
    addUserToRoom(currentUserId, currentUserName);
  }, [currentUserId, currentUserName]);

  // ───── GESTURE SWIPE ─────
  const { dragOffset, isDragging, handleStart, handleMove, handleEnd } = useSwipe((liked) => {
    if (!currentMovie) return;
    handleSwipe(currentMovie.id, liked);
  });

  // ───── GLOBAL DRAG EVENTS ─────
  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX); };
    const onTouchEnd = () => handleEnd();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging]);

  // ───── REALTIME CHANNEL ─────
  useEffect(() => {
    if (!currentUserId || !currentUserName) return;

    const channel = supabase.channel(`room-${roomId}`);

    channel.on('broadcast', { event: 'join' }, (event) => {
      const { id, name } = (event as any).payload ?? {};
      if (id && name) addUserToRoom(id, name);
    });

    channel.on('broadcast', { event: 'swipe' }, (event) => {
      const { movieId, liked, userId, name } = (event as any).payload ?? {};
      if (!movieId || !userId) return;
      addUserToRoom(userId, name);
      setSwipes((prev) => {
        const current = prev[movieId] ?? {};
        return { ...prev, [movieId]: { ...current, [userId]: liked } };
      });
    });

    channel.on('broadcast', { event: 'match' }, (event) => {
      const { movieId } = (event as any).payload ?? {};
      const movie = movies.find((m) => m.id.toString() === movieId);
      if (!movie) return;
      setFinalMatch(movie);
      setMatchPopup(movie);
    });

    channel.on('broadcast', { event: 'reset' }, () => {
      setSwipes({});
      setFinalMatch(null);
      setMatchPopup(null);
      if (screen !== 'add') setScreen('swipe');
    });

    const subscribeChannel = async () => {
      await channel.subscribe();
      (channel as any).send({
        type: 'broadcast',
        event: 'join',
        payload: { id: currentUserId, name: currentUserName },
      });
    };
    subscribeChannel();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [currentUserId, currentUserName, roomId, supabase, movies, screen]);

  // ─────────────────────────────────────────────
  // HANDLERS FILM
  // ─────────────────────────────────────────────

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
          trama_c: tramaCorta.trim() || null,
          trama_l: tramaLunga.trim() || null,
        }),
      });
      if (!response.ok) throw new Error('Errore durante il salvataggio!');
      const newMovie: Movie = await response.json();
      setMovies((prev) => [newMovie, ...prev]);
      setTitle(''); setYear(''); setGenre(''); setCover(''); setTrailer(''); setTramaCorta(''); setTramaLunga('');
      setStatusMessage('Film aggiunto!');
    } catch (error) {
      console.error(error);
      setStatusMessage('Errore durante l aggiunta del film!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMovie = async (movieId: string | number) => {
    try {
      const response = await fetch(`/api/movies/${movieId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Errore durante l eliminazione');
      setMovies((prev) => prev.filter((m) => m.id.toString() !== movieId.toString()));
    } catch (error) {
      console.error(error);
      setStatusMessage('Errore durante l eliminazione del film!');
    }
  };


// ─── handler bulk import ─────────────────────────────────────────────────────
const handleBulkImport = async (rows: JsonMovieRow[]) => {
  let ok = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: row.title,
          year: Number(row.year),
          genre: row.genre,
          cover: row.cover ?? null,
          trailer: row.trailer ?? null,
          trama_c: row.trama_c ?? null,
          trama_l: row.trama_l ?? null,
        }),
      });
      if (!response.ok) { errors++; continue; }
      const newMovie: Movie = await response.json();
      setMovies((prev) => [newMovie, ...prev]);
      ok++;
    } catch { errors++; }
  }
  return { ok, errors };
};

  // ─────────────────────────────────────────────
  // SWIPE LOGIC
  // ─────────────────────────────────────────────

  const getRemaining = () => {
    if (finalMatch) return [finalMatch];
    if (!currentUserId) return movies;
    return movies.filter((m) => swipes[m.id]?.[currentUserId] === undefined);
  };
  const remaining = getRemaining();
  const currentMovie = remaining[0] || null;

  const getMatches = () =>
    movies.filter((m) => {
      const likeCount = Object.values(swipes[m.id] ?? {}).filter(Boolean).length;
      return likeCount >= 2;
    });

  const handleSwipe = (movieId: string | number, liked: boolean) => {
    if (!currentUserId || !currentUserName || finalMatch) return;
    const movieKey = movieId.toString();

    setSwipes((prev) => {
      const current = prev[movieKey] ?? {};
      return { ...prev, [movieKey]: { ...current, [currentUserId]: liked } };
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

  // ─── handler modifica film ────────────────────────────────────────────────────
const handleEditMovie = async (movieId: string | number, data: Partial<Movie>) => {
  try {
    const response = await fetch(`/api/movies/${movieId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Errore durante la modifica');
    const updated: Movie = await response.json();
    setMovies((prev) => prev.map((m) => (m.id === movieId ? updated : m)));
  } catch (error) {
    console.error(error);
    setStatusMessage('Errore durante la modifica del film!');
  }
};
  // ─────────────────────────────────────────────
  // RENDER SCHERMATE
  // ─────────────────────────────────────────────

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        roomId={roomId}
        nameInput={nameInput}
        setNameInput={setNameInput}
        onJoin={handleJoinRoom}
        onShare={handleCopyLink}
        onAddFilms={() => setScreen('add')}
        roomUsers={roomUsersSorted}
        currentUserId={currentUserId}
        isJoining={isJoining}
        isRoomFull={isRoomFull}
        statusMessage={statusMessage}
        copyMessage={copyMessage}
        styles={styles}
      />
    );
  }

  if (finalMatch) {
    return (
      <FinalMatchScreen
        movie={finalMatch}
        onReset={handleResetSwipes}
        onBack={() => setScreen('swipe')}
        setMatchPopup={setMatchPopup}
        matchPopup={matchPopup}
        finalMatch={finalMatch}
        onShare={handleCopyLink}
        styles={styles}
      />
    );
  }

  if (screen === 'swipe') {
    return (
      <SwipeScreen
        currentMovie={currentMovie}
        remainingCount={remaining.length}
        onSwipe={handleSwipe}
        dragOffset={dragOffset}
        isDragging={isDragging}
        handleStart={handleStart}
        handleMove={handleMove}
        handleEnd={handleEnd}
        handleResetSwipes={handleResetSwipes}
        onReset={handleResetSwipes}
        onOpenMatches={() => setScreen('matches')}
        goBack={() => setScreen('welcome')}
        onAddFilms={() => setScreen('add')}
        currentUserName={currentUserName}
        styles={styles}
      />
    );
  }

  if (screen === 'add') {
    // Mostra il gate se non ancora autenticato come admin
  if (!isAdminAuthed) {
    return (
      <AdminGate
        onSuccess={() => setIsAdminAuthed(true)}
        onBack={() => setScreen('welcome')}
      />
    );
  }
  return (
    <AddFilmScreen
      title={title} setTitle={setTitle}
      year={year} setYear={setYear}
      genre={genre} setGenre={setGenre}
      cover={cover} setCover={setCover}
      trailer={trailer} setTrailer={setTrailer}
      tramaCorta={tramaCorta} setTramaCorta={setTramaCorta}
      tramaLunga={tramaLunga} setTramaLunga={setTramaLunga}
      isSubmitting={isSubmitting}
      statusMessage={statusMessage}
      movies={movies}
      onSubmit={handleAddMovie}
      onDelete={handleDeleteMovie}
      onEdit={handleEditMovie}
      onBulkImport={handleBulkImport}
      onBack={() => { setIsAdminAuthed(false); setScreen('welcome'); }}
    />
  );
}

  if (screen === 'matches') {
    return (
      <MatchesScreen
        matched={getMatches()}
        onBack={() => setScreen('swipe')}
        styles={styles}
      />
    );
  }

  return null;
}

// ─────────────────────────────────────────────
// SERVER SIDE PROPS 
// ─────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  let roomId = query.room as string;
  if (!roomId) {
    const { randomUUID } = await import('crypto');
    roomId = randomUUID();
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
    movies = movies.sort(() => Math.random() - 0.5);
  } catch (error) {
    console.error('Error:', error);
  }
  return { props: { movies, roomId } };
};