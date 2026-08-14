'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { createBrowserClient } from '@/utils/supabase/browser';
import { useSwipe } from '@/hooks/useSwipe';
import { useAuth } from '@/hooks/useAuth';
import { normalizeRoomCode } from '@/utils/roomCode';
import { saveRecentRoom } from '@/utils/recentRoom';
import { fetchMoviesForRoom, seededShuffle } from '@/utils/tmdb';
import AppShell from '@/components/layout/AppShell';
import SwipeCard from '@/components/screens/SwipeCard';
import MatchScreen from '@/components/screens/MatchScreen';
import WelcomeRoom from '@/components/screens/WelcomeRoom';
import EmptyState from '@/components/screens/EmptyState';
import { C, TEXT, S } from '@/styles/token';
import { FilmSlate, ArrowLeft } from '@phosphor-icons/react';

import type { Movie, RoomUser, SwipeState, Props } from '@/types';
import type { ExtendedMovie, MatchEntry } from '@/types/stanza';

type Screen = 'welcome' | 'swipe' | 'match';

export default function StanzaPage({ movies: initialMovies, roomId }: Props) {
  const router = useRouter();
  const { currentUser, isGuest, isLoading, guestId, guestName } = useAuth();

  const [screen, setScreen]       = useState<Screen>('welcome');
  const [movies]                  = useState<ExtendedMovie[]>(initialMovies);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [swipes, setSwipes]       = useState<SwipeState>({});
  const [matches, setMatches]     = useState<MatchEntry[]>([]);
  const [lastMatch, setLastMatch] = useState<ExtendedMovie | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const channelRef = useRef<any>(null);
  const supabase   = useRef(createBrowserClient()).current;

  const userId      = currentUser?.id ?? guestId ?? '';
  const displayName = currentUser && !currentUser.isGuest ? currentUser.username : guestName ?? 'Ospite';
  const isLoggedIn  = !!currentUser && !currentUser.isGuest;

  // ── Redirect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!currentUser && !isGuest) router.replace('/auth');
  }, [currentUser, isGuest, isLoading]);

  // ── Salva stanza recente ─────────────────────────────────────────────────
  useEffect(() => {
    if (roomId) saveRecentRoom(roomId, roomUsers.length || 1);
  }, [roomId, roomUsers.length]);

  // ── Resetta flip al cambio film ──────────────────────────────────────────
  const remaining    = movies.filter((m) => swipes[m.id]?.[userId] === undefined);
  const currentMovie = remaining[0] ?? null;

  useEffect(() => { setIsFlipped(false); }, [currentMovie?.id]);

// ─── Sostituisci il destructuring di useSwipe ────────────────────────────────
const { card, isDragging, handleStart, handleMove, handleEnd, triggerSwipe } = useSwipe((liked) => {
  if (currentMovie) handleSwipe(currentMovie.id, liked);
});;

  // ── Global drag events ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent)  => handleMove(e.clientX);
    const onMouseUp   = ()               => handleEnd();
    const onTouchMove = (e: TouchEvent)  => { e.preventDefault(); handleMove(e.touches[0].clientX); };
    const onTouchEnd  = ()               => handleEnd();
    document.addEventListener('mousemove',  onMouseMove);
    document.addEventListener('mouseup',    onMouseUp);
    document.addEventListener('touchmove',  onTouchMove, { passive: false });
    document.addEventListener('touchend',   onTouchEnd);
    return () => {
      document.removeEventListener('mousemove',  onMouseMove);
      document.removeEventListener('mouseup',    onMouseUp);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onTouchEnd);
    };
  }, [isDragging]);

  // ── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !displayName) return;

    const channel = supabase.channel(`room-${roomId}`, {
      config: { presence: { key: userId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: RoomUser[] = Object.values(state)
        .flat()
        .map((p: any) => ({ id: p.userId, name: p.displayName }))
        .filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i)
        .slice(0, 2);
      setRoomUsers(users);
    });

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach((p: any) => {
        setRoomUsers((prev) => {
          if (prev.find((u) => u.id === p.userId)) return prev;
          return [...prev, { id: p.userId, name: p.displayName }].slice(0, 2);
        });
      });
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach((p: any) => {
        setRoomUsers((prev) => prev.filter((u) => u.id !== p.userId));
      });
    });

    channel.on('broadcast', { event: 'swipe' }, (event) => {
      const { movieId, liked, userId: uid } = (event as any).payload ?? {};
      if (!movieId || !uid) return;
      setSwipes((prev) => ({ ...prev, [movieId]: { ...(prev[movieId] ?? {}), [uid]: liked } }));
    });

    channel.on('broadcast', { event: 'match' }, (event) => {
      const { movieId } = (event as any).payload ?? {};
      const movie = movies.find((m) => m.id.toString() === movieId);
      if (!movie) return;
      setLastMatch(movie);
      setMatches((prev) => prev.find((e) => e.movie.id === movie.id) ? prev : [...prev, { movie, timestamp: Date.now() }]);
      setScreen('match');
    });

    channel.on('broadcast', { event: 'reset' }, () => {
      setSwipes({}); setMatches([]); setLastMatch(null); setScreen('swipe');
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId, displayName, joinedAt: Date.now() });
      }
    });

    channelRef.current = channel;
    return () => { channel.untrack(); channel.unsubscribe(); };
  }, [userId, displayName, roomId, movies]);

  // ── Swipe logic ──────────────────────────────────────────────────────────
  const handleSwipe = (movieId: string | number, liked: boolean) => {
    if (!userId) return;
    const key = movieId.toString();

    setSwipes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), [userId]: liked } }));

    const otherLiked = Object.entries(swipes[key] ?? {}).some(
      ([uid, val]) => uid !== userId && val === true
    );

    if (liked && otherLiked) {
      const movie = movies.find((m) => m.id.toString() === key);
      if (movie) {
        setLastMatch(movie);
        setMatches((prev) => prev.find((e) => e.movie.id === movie.id) ? prev : [...prev, { movie, timestamp: Date.now() }]);
        channelRef.current?.send({ type: 'broadcast', event: 'match', payload: { movieId: key } });
        setScreen('match');
      }
    }

    channelRef.current?.send({ type: 'broadcast', event: 'swipe', payload: { movieId: key, liked, userId, name: displayName } });
  };

  const handleReset = () => {
    if (!window.confirm('Ricominciare da capo? Tutti gli swipe verranno azzerati.')) return;
    setSwipes({}); setMatches([]); setLastMatch(null);
    channelRef.current?.send({ type: 'broadcast', event: 'reset', payload: {} });
    setScreen('swipe');
  };

  const handleJoinByCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = normalizeRoomCode(codeInput);
    if (code.length < 4) { setCodeError('Codice non valido'); return; }
    setCodeError('');
    router.push(`/stanza?room=${code}`);
  };

  if (isLoading || (!currentUser && !isGuest)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FilmSlate size={40} color={C.primary} weight="duotone" />
      </div>
    );
  }

  const roomUsersSorted = roomUsers.slice().sort((a) => (a.id === userId ? -1 : 1));
  const isRoomFull = roomUsers.length >= 2 && !roomUsers.find((u) => u.id === userId);

  return (
    <AppShell activeNav="stanze" hideNav={screen === 'swipe'}>
      <div style={{ height: screen === 'swipe' ? '100vh' : 'auto', display: 'flex', flexDirection: 'column' }}>

        {screen === 'welcome' && (
          <WelcomeRoom
            roomId={roomId}
            roomUsers={roomUsersSorted}
            currentUserId={userId}
            currentUserName={displayName}
            isRoomFull={isRoomFull}
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            codeError={codeError}
            onJoinByCode={handleJoinByCode}
            onEnter={() => setScreen('swipe')}
            onAddFilms={() => router.push('/home')}
            
          />
        )}

        {screen === 'swipe' && (
          currentMovie ? (
           // ─── Sostituisci la chiamata a SwipeCard ─────────────────────────────────────
            <SwipeCard
              movie={currentMovie}
              remainingCount={remaining.length}
              card={card}               // ← era dragOffset
              isDragging={isDragging}
              handleStart={handleStart}
              onSwipe={handleSwipe}
              triggerSwipe={triggerSwipe} // ← nuovo
              onFlip={() => setIsFlipped((v) => !v)}
              isFlipped={isFlipped}
              onMatches={() => { if (matches.length > 0) setScreen('match'); }}
              onBack={() => setScreen('welcome')}
              userName={displayName}
              matchCount={matches.length}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: `${S.md} ${S.md} ${S.sm}`, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => setScreen('welcome')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted, fontSize: TEXT.sm, fontFamily: 'inherit' }}
                >
                  <ArrowLeft size={18} /> Stanza
                </button>
              </div>
              <EmptyState onAddFilms={() => router.push('/home')} onReset={handleReset} />
            </div>
          )
        )}

        {screen === 'match' && lastMatch && (
          <MatchScreen
            match={lastMatch}
            allMatches={matches}
            onContinue={() => setScreen('swipe')}
            onReset={handleReset}
            isLoggedIn={isLoggedIn}
          />
        )}

      </div>
    </AppShell>
  );
}

// ── getServerSideProps ────────────────────────────────────────────────────────
export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  let roomId = query.room as string;
  if (!roomId) return { redirect: { destination: '/crea-stanza', permanent: false } };
  roomId = roomId.trim().toUpperCase();

  let mode     = (query.mode     as string) ?? null;
  let genres   = (query.genres   as string) ?? null;
  let yearFrom = (query.year_from as string) ?? null;
  let yearTo   = (query.year_to   as string) ?? null;

  if (!mode) {
    try {
      const { createClient } = await import('@/utils/supabase/server');
      const supabase = createClient();
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      if (data) { mode = data.mode; genres = data.genres; yearFrom = data.year_from?.toString() ?? null; yearTo = data.year_to?.toString() ?? null; }
    } catch { /* ignora */ }
  }

  mode = mode ?? 'trending';

  let movies: Movie[] = [];
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (apiKey) {
      movies = await fetchMoviesForRoom({ apiKey, mode: mode as any, genres, yearFrom, yearTo });
    }
    if (movies.length === 0) {
      const { createClient } = await import('@/utils/supabase/server');
      const supabase = createClient();
      const { data } = await supabase.from('movies').select('*');
      movies = (data as Movie[]) ?? [];
    }
    movies = seededShuffle(movies, roomId);
  } catch (err) {
    console.error('Room data load failed:', err);
  }

  return { props: { movies, roomId } };
};