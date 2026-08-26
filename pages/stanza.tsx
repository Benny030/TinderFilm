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
import MatchesScreen from '@/components/screens/matchesScreen';
import CinemaPlanScreen from '@/components/screens/CinemaPlanScreen';
import WelcomeRoom from '@/components/screens/WelcomeRoom';
import EmptyState from '@/components/screens/EmptyState';
import { C, TEXT, S } from '@/styles/token';
import { FilmSlate, ArrowLeft } from '@phosphor-icons/react';

import type { Movie, RoomUser, SwipeState, Props } from '@/types';
import type { ExtendedMovie, MatchEntry } from '@/types/stanza';

type Screen = 'welcome' | 'swipe' | 'matches' | 'match' | 'plan';

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
  const isHistoryMode = router.query.history === '1';

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
  const nextMovies   = remaining.slice(1, 4);

  useEffect(() => { setIsFlipped(false); }, [currentMovie?.id]);

// ─── Sostituisci il destructuring di useSwipe ────────────────────────────────
const { card, isDragging, handleStart, handleMove, handleEnd, triggerSwipe } = useSwipe((liked) => {
  if (currentMovie) void handleSwipe(currentMovie.id, liked);
});

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

  // ── Bootstrap V2: stanza, partecipanti, swipe e match ────────────────────────
  const [minMembers, setMinMembers] = useState(2);
  const [maxMembers, setMaxMembers] = useState(2);
  const [roomType, setRoomType] = useState<string>('private');
  const [hostActorId, setHostActorId] = useState<string | null>(null);
  const [roomPhase, setRoomPhase] = useState<'waiting' | 'voting' | 'matched' | 'planning' | 'finished'>('waiting');
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [roomCity, setRoomCity] = useState<string | null>(null);
  const [selectedCinemaName, setSelectedCinemaName] = useState<string | null>(null);
  const [selectedShowtimeAt, setSelectedShowtimeAt] = useState<string | null>(null);
  const [selectedBookingUrl, setSelectedBookingUrl] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState('');
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [hostActionError, setHostActionError] = useState('');
  const [hostActionBusy, setHostActionBusy] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<'pending' | 'active'>('active');
  const [pendingRequests, setPendingRequests] = useState<RoomUser[]>([]);
  const [joinError, setJoinError] = useState('');

  const actorType: 'user' | 'guest' = isLoggedIn ? 'user' : 'guest';

  const rebuildStateFromServer = async () => {
    if (!roomId) return;

    const [roomRes, participantsRes, swipeRes] = await Promise.all([
      fetch(`/api/rooms?id=${encodeURIComponent(roomId)}`),
      fetch(`/api/room-participants?roomId=${encodeURIComponent(roomId)}`),
      fetch(`/api/swipes?roomId=${encodeURIComponent(roomId)}`),
    ]);

    if (roomRes.ok) {
      const room = await roomRes.json();
      setMinMembers(Number(room.min_members) || 2);
      setMaxMembers(Number(room.max_members) || 2);
      setRoomType(typeof room.room_type === 'string' ? room.room_type : 'private');
      setHostActorId(typeof room.host_actor_id === 'string' ? room.host_actor_id : null);
      setRoomPhase(
        ['waiting', 'voting', 'matched', 'planning', 'finished'].includes(room.room_phase)
          ? room.room_phase
          : 'waiting'
      );
      setSelectedMovieId(
        typeof room.selected_movie_id === 'string' ? room.selected_movie_id : null
      );
      setRoomCity(typeof room.city === 'string' ? room.city : null);
      setSelectedCinemaName(
        typeof room.selected_cinema_name === 'string' ? room.selected_cinema_name : null
      );
      setSelectedShowtimeAt(
        typeof room.selected_showtime_at === 'string' ? room.selected_showtime_at : null
      );
      setSelectedBookingUrl(
        typeof room.selected_booking_url === 'string' ? room.selected_booking_url : null
      );
      setIsRoomLocked(Boolean(room.is_locked));

      const resolvedHostId = typeof room.host_actor_id === 'string' ? room.host_actor_id : null;
      if (resolvedHostId === userId) {
        const pendingRes = await fetch(
          `/api/room-participants?roomId=${encodeURIComponent(roomId)}&pending=1&requesterId=${encodeURIComponent(userId)}`
        );
        if (pendingRes.ok) {
          const pending = await pendingRes.json();
          setPendingRequests((pending ?? []).map((p: any) => ({
            id: p.actor_id,
            name: p.display_name || (p.actor_type === 'guest' ? 'Ospite' : 'Utente'),
          })));
        }
      } else {
        setPendingRequests([]);
      }
    }

    if (participantsRes.ok) {
      const participants = await participantsRes.json();
      const activeParticipants = participants ?? [];

      setRoomUsers(activeParticipants.map((p: any) => ({
        id: p.actor_id,
        name: p.display_name || (p.actor_type === 'guest' ? 'Ospite' : 'Utente'),
      })));

      // Se il server ci vede tra gli active, l'ingresso è effettivamente valido.
      // Questo aggiorna subito il client dopo l'approvazione dell'host.
      if (activeParticipants.some((p: any) => p.actor_id === userId)) {
        setMembershipStatus('active');
      }
    }

    if (swipeRes.ok) {
      const data = await swipeRes.json();
      const nextSwipes: SwipeState = {};

      for (const row of data.swipes ?? []) {
        const movieKey = String(row.movie_id);
        nextSwipes[movieKey] = {
          ...(nextSwipes[movieKey] ?? {}),
          [row.actor_id]: row.liked,
        };
      }
      setSwipes(nextSwipes);

      const nextMatches: MatchEntry[] = (data.matches ?? [])
        .map((row: any) => {
          const movie = movies.find((m) => String(m.id) === String(row.movie_id));
          return movie ? { movie, timestamp: new Date(row.created_at).getTime() } : null;
        })
        .filter(Boolean) as MatchEntry[];

      setMatches(nextMatches);
      setLastMatch(nextMatches.length > 0 ? nextMatches[nextMatches.length - 1].movie : null);
    }
  };

  useEffect(() => {
    if (isLoading || !userId || !displayName || !roomId) return;

    let cancelled = false;

    const joinAndLoad = async () => {
      setJoinError('');

      const joinRes = await fetch('/api/room-participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, actorId: userId, actorType, displayName }),
      });

      if (!joinRes.ok) {
        const body = await joinRes.json().catch(() => ({}));
        if (!cancelled) setJoinError(body.error || 'Impossibile entrare nella stanza');
        return;
      }

      const joinBody = await joinRes.json().catch(() => ({}));
      const nextMembershipStatus =
        joinBody?.participant?.membership_status === 'pending' ? 'pending' : 'active';

      if (!cancelled) {
        setMembershipStatus(nextMembershipStatus);
        await rebuildStateFromServer();

        // Ridondanza voluta: chi entra da /stanze può completare il POST
        // prima che il proprio canale realtime sia pronto. Se il canale è già
        // disponibile avvisiamo subito l'host; altrimenti il polling copre il race.
        channelRef.current?.send({
          type: 'broadcast',
          event: 'participants_changed',
          payload: { actorId: userId },
        });
      }
    };

    void joinAndLoad();
    return () => { cancelled = true; };
  }, [isLoading, userId, displayName, roomId, actorType]);

  // ── Realtime: eventi veloci, DB come fonte di verità ────────────────────────
  useEffect(() => {
    if (!userId || !displayName) return;

    const channel = supabase.channel(`room-${roomId}`, {
      config: { presence: { key: userId } },
    });

    channel.on('broadcast', { event: 'participants_changed' }, () => {
      void rebuildStateFromServer();
    });

    channel.on('broadcast', { event: 'room_state_changed' }, async (event) => {
      const action = (event as any).payload?.action;

      await rebuildStateFromServer();

      if (action === 'start_voting') {
        setScreen('swipe');
        return;
      }

      if (action === 'select_winner') {
        // Il server ha già salvato selected_movie_id e room_phase = matched.
        // Portiamo tutti i partecipanti fuori dallo swipe.
        const { data: freshRoom } = await supabase
          .from('rooms')
          .select('room_type, selected_movie_id, room_phase')
          .eq('id', roomId)
          .maybeSingle();

        if (freshRoom?.selected_movie_id) {
          setSelectedMovieId(String(freshRoom.selected_movie_id));

          if (
            freshRoom.room_type === 'cinema_pair' ||
            freshRoom.room_type === 'cinema_group'
          ) {
            setScreen('plan');
          } else {
            const winnerMovie = movies.find(
              (movie) =>
                String(movie.id) === String(freshRoom.selected_movie_id)
            );

            if (winnerMovie) {
              setLastMatch(winnerMovie);
            }

            setScreen('match');
          }
        }

        return;
      }

      if (action === 'plan_saved') {
        setScreen('plan');
        return;
      }

      if (action === 'finish_room') {
        setScreen('welcome');
      }
    });

    channel.on('broadcast', { event: 'swipe' }, (event) => {
      const { movieId, liked, userId: uid } = (event as any).payload ?? {};
      if (!movieId || !uid) return;
      const key = String(movieId);
      setSwipes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), [uid]: liked } }));
    });

    channel.on('broadcast', { event: 'match' }, (event) => {
      const { movieId } = (event as any).payload ?? {};
      const movie = movies.find((m) => String(m.id) === String(movieId));
      if (!movie) return;

      setLastMatch(movie);
      setMatches((prev) =>
        prev.some((entry) => String(entry.movie.id) === String(movie.id))
          ? prev
          : [...prev, { movie, timestamp: Date.now() }]
      );
      setScreen('match');
    });

    channel.on('broadcast', { event: 'match_removed' }, (event) => {
      const { movieId } = (event as any).payload ?? {};
      if (!movieId) return;
      const key = String(movieId);
      setMatches((prev) => prev.filter((entry) => String(entry.movie.id) !== key));
      setLastMatch((prev) => prev && String(prev.id) === key ? null : prev);
    });

    channel.on('broadcast', { event: 'reset' }, () => {
      setSwipes({});
      setMatches([]);
      setLastMatch(null);
      setScreen('swipe');
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId, displayName, joinedAt: Date.now() });
        await channel.send({ type: 'broadcast', event: 'participants_changed', payload: {} });
      }
    });

    channelRef.current = channel;
    return () => {
      void channel.untrack();
      void channel.unsubscribe();
    };
  }, [userId, displayName, roomId, movies]);

  // Durante la sala d'attesa il DB è la fonte di verità.
  // Questo evita che un evento realtime perso lasci l'host con un conteggio vecchio.
  useEffect(() => {
    if (!roomId || roomPhase !== 'waiting') return;

    const timer = window.setInterval(() => {
      void rebuildStateFromServer();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [roomId, roomPhase, userId]);

  async function runHostAction(
    action: 'lock' | 'unlock' | 'start_voting' | 'select_winner' | 'finish_room' | 'remove_member' | 'approve_member' | 'reject_member',
    targetActorId?: string,
    movieId?: string,
  ) {
    if (!userId || userId !== hostActorId) return;

    setHostActionBusy(true);
    setHostActionError('');

    try {
      const response = await fetch('/api/room-host-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          requesterId: userId,
          action,
          targetActorId,
          movieId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Azione host non riuscita');
      }

      await rebuildStateFromServer();

      if (action === 'select_winner' && movieId) {
        setSelectedMovieId(movieId);
        setRoomPhase('matched');

        if (roomType === 'cinema_pair' || roomType === 'cinema_group') {
          setScreen('plan');
        } else {
          const winnerMovie = movies.find(
            (movie) => String(movie.id) === String(movieId)
          );

          if (winnerMovie) {
            setLastMatch(winnerMovie);
          }

          setScreen('match');
        }
      }

      channelRef.current?.send({
        type: 'broadcast',
        event: ['remove_member', 'approve_member', 'reject_member'].includes(action)
          ? 'participants_changed'
          : 'room_state_changed',
        payload: { action, targetActorId: targetActorId ?? null },
      });

      if (action === 'start_voting') {
        setScreen('swipe');
      }
    } catch (error) {
      setHostActionError(error instanceof Error ? error.message : 'Azione host non riuscita');
    } finally {
      setHostActionBusy(false);
    }
  }

  const handleEnterRoom = () => {
    if (roomPhase === 'finished') {
      if (
        selectedMovieId &&
        (roomType === 'cinema_pair' || roomType === 'cinema_group')
      ) {
        setScreen('plan');
        return;
      }

      if (selectedMovieId) {
        const winnerMovie = movies.find(
          (movie) => String(movie.id) === String(selectedMovieId)
        );

        if (winnerMovie) {
          setLastMatch(winnerMovie);
          setScreen('match');
          return;
        }
      }

      setScreen('welcome');
      return;
    }

    if (roomPhase === 'planning') {
      setScreen('plan');
      return;
    }

    if (roomPhase === 'matched') {
      if (selectedMovieId && (roomType === 'cinema_pair' || roomType === 'cinema_group')) {
        setScreen('plan');
      } else {
        setScreen('match');
      }
      return;
    }

    if (roomPhase === 'voting') {
      setScreen('swipe');
      return;
    }

    if (roomPhase === 'waiting' && userId === hostActorId) {
      void runHostAction('start_voting');
    }
  };

  useEffect(() => {
    if (!isHistoryMode || roomPhase !== 'finished' || !selectedMovieId) {
      return;
    }

    if (roomType === 'cinema_pair' || roomType === 'cinema_group') {
      setScreen('plan');
      return;
    }

    const winnerMovie = movies.find(
      (movie) => String(movie.id) === String(selectedMovieId)
    );

    if (winnerMovie) {
      setLastMatch(winnerMovie);
      setScreen('match');
    }
  }, [
    isHistoryMode,
    roomPhase,
    selectedMovieId,
    roomType,
    movies,
  ]);


  async function saveCinemaPlan(payload: {
    cinemaName: string;
    showtimeAt: string;
    cinemaId?: number | null;
    showingId?: string | null;
    bookingUrl?: string | null;
  }) {
    if (!userId || userId !== hostActorId || !selectedMovieId) return;

    const parsed = new Date(payload.showtimeAt);
    if (Number.isNaN(parsed.getTime())) {
      setPlanError('Data o orario non validi');
      return;
    }

    setPlanSaving(true);
    setPlanError('');

    try {
      const response = await fetch('/api/rooms/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          requesterId: userId,
          cinemaName: payload.cinemaName,
          showtimeAt: parsed.toISOString(),
          cinemaId: payload.cinemaId ?? null,
          showingId: payload.showingId ?? null,
          bookingUrl: payload.bookingUrl ?? null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Salvataggio del piano non riuscito');
      }

      setSelectedCinemaName(data.plan?.selected_cinema_name ?? payload.cinemaName);
      setSelectedShowtimeAt(data.plan?.selected_showtime_at ?? parsed.toISOString());
      setSelectedBookingUrl(data.plan?.selected_booking_url ?? payload.bookingUrl ?? null);
      setRoomPhase('planning');

      channelRef.current?.send({
        type: 'broadcast',
        event: 'room_state_changed',
        payload: { action: 'plan_saved' },
      });
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Salvataggio del piano non riuscito');
    } finally {
      setPlanSaving(false);
    }
  }

  async function handleSwipe(movieId: string | number, liked: boolean) {
    if (!userId) return;
    const key = String(movieId);

    setSwipes((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [userId]: liked },
    }));

    try {
      const response = await fetch('/api/swipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId, movie_id: key, liked, actorId: userId, actorType, displayName,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Errore durante lo swipe');

      channelRef.current?.send({
        type: 'broadcast', event: 'swipe',
        payload: { movieId: key, liked, userId, name: displayName },
      });

      const movie = movies.find((m) => String(m.id) === key);
      if (data.matched && movie) {
        setLastMatch(movie);
        setMatches((prev) =>
          prev.some((entry) => String(entry.movie.id) === key)
            ? prev
            : [...prev, { movie, timestamp: Date.now() }]
        );
        channelRef.current?.send({ type: 'broadcast', event: 'match', payload: { movieId: key } });
        setScreen('match');
      } else {
        setMatches((prev) => prev.filter((entry) => String(entry.movie.id) !== key));
        channelRef.current?.send({ type: 'broadcast', event: 'match_removed', payload: { movieId: key } });
      }
    } catch (error) {
      console.error('Swipe save failed:', error);
      await rebuildStateFromServer();
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Ricominciare da capo? Tutti gli swipe della stanza verranno azzerati.')) return;

    const response = await fetch('/api/swipes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error('Room reset failed:', body.error || response.statusText);
      return;
    }

    setSwipes({});
    setMatches([]);
    setLastMatch(null);
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

  if (joinError) {
    return (
      <AppShell activeNav="stanze">
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: S.xl }}>
          <div style={{ maxWidth: 520, textAlign: 'center', color: C.ink }}>
            <FilmSlate size={44} color={C.primary} weight="duotone" />
            <div style={{ marginTop: S.md, fontSize: TEXT.lg, fontWeight: 700 }}>Impossibile entrare nella stanza</div>
            <div style={{ marginTop: S.sm, color: C.muted }}>{joinError}</div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (isLoading || (!currentUser && !isGuest)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FilmSlate size={40} color={C.primary} weight="duotone" />
      </div>
    );
  }

  const roomUsersSorted = roomUsers.slice().sort((a) => (a.id === userId ? -1 : 1));
  const isRoomFull = roomUsers.length >= maxMembers && !roomUsers.find((u) => u.id === userId);

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
            minMembers={minMembers}
            maxMembers={maxMembers}
            hostActorId={hostActorId}
            roomPhase={roomPhase}
            isRoomLocked={isRoomLocked}
            hostActionBusy={hostActionBusy}
            hostActionError={hostActionError}
            membershipStatus={membershipStatus}
            pendingRequests={pendingRequests}
            onToggleLock={() => void runHostAction(isRoomLocked ? 'unlock' : 'lock')}
            onRemoveParticipant={(actorId) => void runHostAction('remove_member', actorId)}
            onApproveParticipant={(actorId) => void runHostAction('approve_member', actorId)}
            onRejectParticipant={(actorId) => void runHostAction('reject_member', actorId)}
            onFinishRoom={() => {
              if (window.confirm('Chiudere definitivamente questa stanza?')) {
                void runHostAction('finish_room');
              }
            }}
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            codeError={codeError}
            onJoinByCode={handleJoinByCode}
            onEnter={handleEnterRoom}
            onAddFilms={() => router.push('/home')}
            
          />
        )}

        {screen === 'swipe' && (
          currentMovie ? (
           // ─── Sostituisci la chiamata a SwipeCard ─────────────────────────────────────
            <SwipeCard
              movie={currentMovie}
              nextMovies={nextMovies}
              
              remainingCount={remaining.length}
              card={card}               // ← era dragOffset
              isDragging={isDragging}
              handleStart={handleStart}
              onSwipe={handleSwipe}
              triggerSwipe={triggerSwipe} // ← nuovo
              onFlip={() => setIsFlipped((v) => !v)}
              isFlipped={isFlipped}
              onMatches={() => setScreen('matches')}
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

        {screen === 'matches' && (
          <MatchesScreen
            matches={matches}
            onBack={() => setScreen('swipe')}
            onOpenMovie={(movie: ExtendedMovie) => {
              setLastMatch(movie);
              setScreen('match');
            }}
          />
        )}

        {screen === 'match' && lastMatch && (
          <MatchScreen
            match={lastMatch}
            allMatches={matches}
            onContinue={() => {
              if (roomPhase === 'finished') {
                void router.push('/stanze');
                return;
              }

              if (
                selectedMovieId &&
                (roomType === 'cinema_pair' || roomType === 'cinema_group')
              ) {
                setScreen('plan');
              } else {
                setScreen('swipe');
              }
            }}
            onReset={handleReset}
            isLoggedIn={isLoggedIn}
            isHost={userId === hostActorId}
            selectedMovieId={selectedMovieId}
            selectingWinner={hostActionBusy}
            onSelectWinner={(movieId: string) =>
              void runHostAction('select_winner', undefined, movieId)
            }
          />
        )}

        {screen === 'plan' && selectedMovieId && (
          (() => {
            const selectedMovie = movies.find((m) => String(m.id) === String(selectedMovieId));
            if (!selectedMovie) return null;

            return (
              <CinemaPlanScreen
                roomId={roomId}
                movie={selectedMovie}
                city={roomCity}
                cinemaName={selectedCinemaName}
                showtimeAt={selectedShowtimeAt}
                bookingUrl={selectedBookingUrl}
                isHost={userId === hostActorId}
                saving={planSaving}
                error={planError}
                onSave={(payload) => void saveCinemaPlan(payload)}
                onBack={() => setScreen('match')}
              />
            );
          })()
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