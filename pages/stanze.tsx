'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  CalendarBlank,
  CheckCircle,
  FilmSlate,
  MapPin,
  Play,
  Ticket,
  UsersThree,
  ArrowsClockwise,
  Broadcast,
  Archive,
  ArrowRight,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import BackButton from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { FONT, THEME } from '@/styles/token';

type RoomHistoryRow = {
  room_id: string;
  room_type: string | null;
  room_phase:
    | 'waiting'
    | 'voting'
    | 'matched'
    | 'planning'
    | 'finished'
    | 'expired'
    | string;
  role: string | null;
  membership_status: string | null;
  host_actor_id: string | null;
  selected_movie_id: string | null;
  selected_movie_at: string | null;
  city: string | null;
  selected_cinema_name: string | null;
  selected_showtime_at: string | null;
  selected_booking_url: string | null;
  created_at: string;
  participant_count: number;
  match_count: number;
};

type PublicRoom = {
  id: string;
  mode?: string | null;
  room_type?: string | null;
  city?: string | null;
  province?: string | null;
  min_members?: number | null;
  max_members?: number | null;
  participant_count?: number | null;
  available_spots?: number | null;
  host_name?: string | null;
  host_actor_id?: string | null;
  requires_approval?: boolean;
  created_at?: string | null;
};

type ViewMode = 'live' | 'archiviate';

function formatDate(value: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roomTypeLabel(type: string | null | undefined) {
  if (type === 'cinema_pair') return 'Cinema · Coppia';
  if (type === 'cinema_group') return 'Cinema · Gruppo';
  if (type === 'streaming') return 'Streaming';
  if (type === 'public') return 'Pubblica';
  return 'Stanza';
}

function publicRoomModeLabel(room: PublicRoom) {
  if (room.mode === 'cinema') return 'Cinema';
  if (room.mode === 'streaming') return 'Streaming';
  if (room.mode === 'trending') return 'Tendenza';
  if (room.mode === 'filter' || room.mode === 'discover') return 'Filtro';
  return roomTypeLabel(room.room_type);
}

export default function StanzePage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const T = theme === 'dark' ? THEME.dark : THEME.light;
  const supabase = useRef(createBrowserClient()).current;

  const [view, setView] = useState<ViewMode>('live');

  const [liveRooms, setLiveRooms] = useState<PublicRoom[]>([]);
  const [historyRooms, setHistoryRooms] = useState<RoomHistoryRow[]>([]);

  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      void router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    let cancelled = false;
    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
    let requestRunning = false;

    const loadEverything = async (showLoader = false) => {
      if (requestRunning) return;
      requestRunning = true;

      if (showLoader) {
        setLoadingLive(true);
        setLoadingHistory(true);
      } else {
        setRefreshing(true);
      }

      try {
        /*
         * LIVE:
         * usiamo la stessa discovery della Home.
         * Non passiamo actorId apposta: qui vogliamo mostrare davvero tutte
         * le stanze pubbliche online, comprese quelle create dall'utente.
         *
         * L'endpoint considera online soltanto stanze:
         * - room_phase = waiting
         * - non bloccate
         * - pubbliche
         * - con partecipanti visti negli ultimi 45 secondi
         * - non piene
         */
        const livePromise = fetch('/api/rooms/discover?filter=for_you', {
          cache: 'no-store',
        }).then(async (response) => {
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data.error || 'Impossibile caricare le stanze online.'
            );
          }

          return Array.isArray(data.rooms) ? (data.rooms as PublicRoom[]) : [];
        });

        /*
         * ARCHIVIO:
         * questa è la vecchia lista "In corso": è la cronologia personale
         * restituita da get_my_room_history, quindi la trattiamo come archivio.
         */
        const historyPromise = supabase.rpc('get_my_room_history', {
          p_limit: 60,
        });

        const [liveResult, historyResult] = await Promise.all([
          livePromise,
          historyPromise,
        ]);

        if (historyResult.error) throw historyResult.error;

        if (!cancelled) {
          const normalizedLive = liveResult
            .filter((room) => room.id)
            .filter(
              (room, index, all) =>
                all.findIndex((candidate) => candidate.id === room.id) === index
            )
            .sort(
              (a, b) =>
                new Date(b.created_at || 0).getTime() -
                new Date(a.created_at || 0).getTime()
            );

          const normalizedHistory = (
            (historyResult.data ?? []) as RoomHistoryRow[]
          )
            .map((room) => ({
              ...room,
              participant_count: Number(room.participant_count ?? 0),
              match_count: Number(room.match_count ?? 0),
            }))
            .filter(
              (room, index, all) =>
                all.findIndex(
                  (candidate) => candidate.room_id === room.room_id
                ) === index
            )
            .sort(
              (a, b) =>
                new Date(b.selected_movie_at || b.created_at).getTime() -
                new Date(a.selected_movie_at || a.created_at).getTime()
            );

          setLiveRooms(normalizedLive);
          setHistoryRooms(normalizedHistory);
          setLastRefreshAt(new Date());
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossibile aggiornare le stanze.'
          );
        }
      } finally {
        requestRunning = false;

        if (!cancelled) {
          setLoadingLive(false);
          setLoadingHistory(false);
          setRefreshing(false);
        }
      }
    };

    const scheduleRealtimeRefresh = () => {
      if (realtimeTimer) clearTimeout(realtimeTimer);

      realtimeTimer = setTimeout(() => {
        void loadEverything(false);
      }, 180);
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadEverything(false);
      }
    };

    void loadEverything(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadEverything(false);
      }
    }, 5000);

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    const channel = supabase
      .channel(`stanze-live-page-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        scheduleRealtimeRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_participants' },
        scheduleRealtimeRefresh
      )
      .subscribe();

    return () => {
      cancelled = true;

      if (realtimeTimer) clearTimeout(realtimeTimer);

      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [currentUser, supabase]);

  const archivedRooms = useMemo(
    () =>
      historyRooms.filter(
        (room) =>
          room.room_phase !== 'expired' ||
          Boolean(room.selected_movie_id) ||
          room.match_count > 0
      ),
    [historyRooms]
  );

  if (
    isLoading ||
    !currentUser ||
    currentUser.isGuest ||
    isGuest
  ) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: T.bg,
          display: 'grid',
          placeItems: 'center',
          color: T.textMuted,
          fontFamily: FONT.sans,
        }}
      >
        <FilmSlate size={40} color={T.primary} weight="duotone" />
      </div>
    );
  }

  return (
    <AppShell activeNav="stanze">
      <main
        style={{
          minHeight: '100vh',
          background: T.bg,
          color: T.text,
          fontFamily: FONT.sans,
          padding: '24px 18px 80px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 980,
            margin: '0 auto',
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <BackButton
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  window.history.length > 1
                ) {
                  router.back();
                } else {
                  void router.push('/home');
                }
              }}
            />
          </div>

          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 18,
              flexWrap: 'wrap',
              marginBottom: 18,
            }}
          >
            <div>
              <div
                style={{
                  color: T.accent,
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: '.12em',
                  fontWeight: 900,
                }}
              >
                Guarda insieme
              </div>

              <h1
                style={{
                  fontFamily: FONT.display,
                  fontSize: 'clamp(30px,5vw,42px)',
                  margin: '5px 0',
                  lineHeight: 1,
                }}
              >
                Stanze
              </h1>

              <p
                style={{
                  margin: 0,
                  color: T.textMuted,
                  fontSize: 12,
                }}
              >
                Entra nelle stanze realmente online oppure riapri il tuo archivio.
              </p>

              <div
                style={{
                  marginTop: 7,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: T.textFaint,
                  fontSize: 9,
                }}
              >
                <ArrowsClockwise
                  size={11}
                  color={refreshing ? T.primary : T.textFaint}
                />

                {refreshing
                  ? 'Aggiornamento…'
                  : `Live ogni 5 secondi${
                      lastRefreshAt
                        ? ` · ${lastRefreshAt.toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}`
                        : ''
                    }`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void router.push('/crea-stanza')}
              style={{
                border: `1px solid ${T.primary}`,
                background: T.primaryGlow,
                color: T.primary,
                padding: '9px 12px',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              Crea stanza
            </button>
          </header>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
              gap: 8,
              marginBottom: 17,
            }}
          >
            <button
              type="button"
              onClick={() => setView('live')}
              style={{
                minHeight: 54,
                border: `1px solid ${
                  view === 'live' ? T.primary : T.border
                }`,
                background:
                  view === 'live' ? T.primaryGlow : T.surface,
                color:
                  view === 'live' ? T.primary : T.textMuted,
                padding: '10px 12px',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 11.5,
                  fontWeight: 900,
                }}
              >
                <Broadcast size={15} weight="fill" />
                In corso
                <span style={{ marginLeft: 'auto' }}>
                  {liveRooms.length}
                </span>
              </span>

              <span
                style={{
                  display: 'block',
                  marginTop: 3,
                  fontSize: 9,
                  color:
                    view === 'live' ? T.primary : T.textFaint,
                }}
              >
                Stanze pubbliche davvero online
              </span>
            </button>

            <button
              type="button"
              onClick={() => setView('archiviate')}
              style={{
                minHeight: 54,
                border: `1px solid ${
                  view === 'archiviate' ? T.accent : T.border
                }`,
                background:
                  view === 'archiviate' ? T.accentGlow : T.surface,
                color:
                  view === 'archiviate' ? T.accent : T.textMuted,
                padding: '10px 12px',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 11.5,
                  fontWeight: 900,
                }}
              >
                <Archive size={15} weight="fill" />
                Archiviate
                <span style={{ marginLeft: 'auto' }}>
                  {archivedRooms.length}
                </span>
              </span>

              <span
                style={{
                  display: 'block',
                  marginTop: 3,
                  fontSize: 9,
                  color:
                    view === 'archiviate'
                      ? T.accent
                      : T.textFaint,
                }}
              >
                Le stanze a cui hai partecipato
              </span>
            </button>
          </div>

          {error && (
            <div
              style={{
                border: `1px solid ${T.primary}55`,
                background: T.primaryGlow,
                color: T.primary,
                padding: 12,
                marginBottom: 14,
                fontSize: 11,
              }}
            >
              {error}
            </div>
          )}

          {view === 'live' ? (
            <>
              {loadingLive ? (
                <div
                  style={{
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    padding: 35,
                    textAlign: 'center',
                    color: T.textFaint,
                  }}
                >
                  Cerco le stanze online…
                </div>
              ) : liveRooms.length === 0 ? (
                <div
                  style={{
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    padding: 38,
                    textAlign: 'center',
                    color: T.textFaint,
                  }}
                >
                  <Broadcast size={34} weight="duotone" />

                  <div
                    style={{
                      color: T.text,
                      fontWeight: 850,
                      marginTop: 8,
                    }}
                  >
                    Nessuna stanza online adesso
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    Quando qualcuno apre una stanza pubblica comparirà qui entro pochi secondi.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(280px,1fr))',
                    gap: 11,
                  }}
                >
                  {liveRooms.map((room) => {
                    const participants = Number(
                      room.participant_count ?? 0
                    );
                    const maxMembers = Number(
                      room.max_members ?? 2
                    );
                    const available = Number(
                      room.available_spots ??
                        Math.max(0, maxMembers - participants)
                    );

                    return (
                      <article
                        key={room.id}
                        style={{
                          border: `1px solid ${T.border}`,
                          background: T.surface,
                          padding: 15,
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 3,
                            height: '100%',
                            background: T.primary,
                          }}
                        />

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 10,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                color: T.text,
                                fontWeight: 900,
                                fontSize: 14,
                              }}
                            >
                              {room.host_name || 'Utente'}
                            </div>

                            <div
                              style={{
                                marginTop: 3,
                                color: T.textFaint,
                                fontSize: 9,
                              }}
                            >
                              {publicRoomModeLabel(room)}
                              {room.city ? ` · ${room.city}` : ''}
                            </div>
                          </div>

                          <span
                            style={{
                              border: `1px solid ${T.primary}40`,
                              background: T.primaryGlow,
                              color: T.primary,
                              padding: '4px 7px',
                              fontSize: 8,
                              fontWeight: 900,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Broadcast size={9} weight="fill" />
                            Online
                          </span>
                        </div>

                        <div
                          style={{
                            marginTop: 13,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 10,
                            color: T.textMuted,
                            fontSize: 9,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              gap: 4,
                              alignItems: 'center',
                            }}
                          >
                            <UsersThree size={12} />
                            {participants}/{maxMembers} partecipanti
                          </span>

                          <span>
                            {available}{' '}
                            {available === 1
                              ? 'posto libero'
                              : 'posti liberi'}
                          </span>

                          {room.created_at && (
                            <span
                              style={{
                                display: 'inline-flex',
                                gap: 4,
                                alignItems: 'center',
                              }}
                            >
                              <CalendarBlank size={12} />
                              {formatDate(room.created_at)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void router.push(
                              `/stanza?room=${encodeURIComponent(room.id)}`
                            )
                          }
                          style={{
                            width: '100%',
                            marginTop: 13,
                            border: `1px solid ${T.primary}`,
                            background: T.primaryGlow,
                            color: T.primary,
                            padding: '10px 11px',
                            cursor: 'pointer',
                            fontFamily: FONT.sans,
                            fontSize: 10,
                            fontWeight: 900,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          Entra nella stanza
                          <ArrowRight size={12} weight="bold" />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {loadingHistory ? (
                <div
                  style={{
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    padding: 35,
                    textAlign: 'center',
                    color: T.textFaint,
                  }}
                >
                  Carico il tuo archivio…
                </div>
              ) : archivedRooms.length === 0 ? (
                <div
                  style={{
                    border: `1px solid ${T.border}`,
                    background: T.surface,
                    padding: 38,
                    textAlign: 'center',
                    color: T.textFaint,
                  }}
                >
                  <Archive size={32} weight="duotone" />

                  <div
                    style={{
                      color: T.text,
                      fontWeight: 850,
                      marginTop: 8,
                    }}
                  >
                    Archivio vuoto
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    Qui ritroverai le stanze a cui hai partecipato.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(280px,1fr))',
                    gap: 11,
                  }}
                >
                  {archivedRooms.map((room) => {
                    const finished =
                      room.room_phase === 'finished';
                    const hasWinner =
                      Boolean(room.selected_movie_id);
                    const cinemaRoom =
                      room.room_type === 'cinema_pair' ||
                      room.room_type === 'cinema_group';

                    const phaseLabel =
                      room.room_phase === 'waiting'
                        ? 'Creata'
                        : room.room_phase === 'voting'
                          ? 'Votazione'
                          : room.room_phase === 'planning'
                            ? 'Organizzazione'
                            : room.room_phase === 'matched'
                              ? 'Film scelto'
                              : room.room_phase === 'expired'
                                ? 'Scaduta'
                                : 'Conclusa';

                    const stateColor = finished
                      ? '#22c55e'
                      : hasWinner
                        ? T.accent
                        : T.textFaint;

                    return (
                      <article
                        key={room.room_id}
                        style={{
                          border: `1px solid ${T.border}`,
                          background: T.surface,
                          padding: 15,
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 3,
                            height: '100%',
                            background: stateColor,
                          }}
                        />

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 10,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                color: T.text,
                                fontWeight: 900,
                                fontSize: 14,
                                letterSpacing: '.04em',
                              }}
                            >
                              {room.room_id}
                            </div>

                            <div
                              style={{
                                color: T.textFaint,
                                fontSize: 9,
                                marginTop: 3,
                              }}
                            >
                              {roomTypeLabel(room.room_type)}
                              {room.role === 'host' ? ' · Host' : ''}
                            </div>
                          </div>

                          <span
                            style={{
                              border: `1px solid ${stateColor}40`,
                              background: `${stateColor}12`,
                              color: stateColor,
                              padding: '4px 7px',
                              fontSize: 8,
                              fontWeight: 850,
                            }}
                          >
                            {phaseLabel}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 10,
                            flexWrap: 'wrap',
                            marginTop: 13,
                            color: T.textMuted,
                            fontSize: 9,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              gap: 4,
                              alignItems: 'center',
                            }}
                          >
                            <UsersThree size={12} />
                            {room.participant_count} partecipanti
                          </span>

                          <span
                            style={{
                              display: 'inline-flex',
                              gap: 4,
                              alignItems: 'center',
                            }}
                          >
                            <FilmSlate size={12} />
                            {room.match_count} match
                          </span>

                          <span
                            style={{
                              display: 'inline-flex',
                              gap: 4,
                              alignItems: 'center',
                            }}
                          >
                            <CalendarBlank size={12} />
                            {formatDate(
                              room.selected_movie_at || room.created_at
                            )}
                          </span>
                        </div>

                        {hasWinner && (
                          <button
                            type="button"
                            onClick={() =>
                              void router.push(
                                `/film/${encodeURIComponent(
                                  room.selected_movie_id as string
                                )}`
                              )
                            }
                            style={{
                              width: '100%',
                              marginTop: 12,
                              border: `1px solid ${T.accent}45`,
                              background: T.accentGlow,
                              color: T.accent,
                              padding: 10,
                              cursor: 'pointer',
                              fontFamily: FONT.sans,
                              fontSize: 10,
                              fontWeight: 850,
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 7,
                            }}
                          >
                            <CheckCircle size={15} weight="fill" />
                            Film scelto · apri dettaglio
                          </button>
                        )}

                        {cinemaRoom &&
                          (room.selected_cinema_name ||
                            room.selected_showtime_at) && (
                            <div
                              style={{
                                border: `1px solid ${T.border}`,
                                background: T.bgSoft,
                                padding: 9,
                                marginTop: 8,
                                color: T.textMuted,
                                fontSize: 9,
                                lineHeight: 1.5,
                              }}
                            >
                              {room.selected_cinema_name && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                >
                                  <MapPin size={12} color={T.accent} />
                                  {room.selected_cinema_name}
                                </div>
                              )}

                              {room.selected_showtime_at && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    marginTop: 3,
                                  }}
                                >
                                  <Ticket size={12} color={T.accent} />
                                  {formatDateTime(
                                    room.selected_showtime_at
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                        <button
                          type="button"
                          onClick={() =>
                            void router.push(
                              finished
                                ? `/stanze/${encodeURIComponent(
                                    room.room_id
                                  )}`
                                : `/stanza?room=${encodeURIComponent(
                                    room.room_id
                                  )}`
                            )
                          }
                          style={{
                            width: '100%',
                            marginTop: 10,
                            border: `1px solid ${T.border}`,
                            background: T.bgSoft,
                            color: T.textMuted,
                            padding: '9px 10px',
                            cursor: 'pointer',
                            fontFamily: FONT.sans,
                            fontSize: 10,
                            fontWeight: 900,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          {finished ? (
                            <CheckCircle size={14} weight="duotone" />
                          ) : (
                            <Play size={14} weight="fill" />
                          )}

                          {finished ? 'Rivedi risultato' : 'Apri archivio'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}
