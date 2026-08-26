'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  CalendarBlank,
  CheckCircle,
  FilmSlate,
  MapPin,
  Play,
  Ticket,
  UsersThree,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';

const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  border: '#2d221c',
  gold: '#f5b92f',
  goldGlow: 'rgba(245,185,47,0.12)',
  pink: '#ed3d73',
  pinkGlow: 'rgba(237,61,115,0.15)',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
  success: '#4ade80',
};

const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  border: '#d6cbbc',
  gold: '#b8860b',
  goldGlow: 'rgba(184,134,11,0.10)',
  pink: '#b83060',
  pinkGlow: 'rgba(184,48,96,0.10)',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
  success: '#16a34a',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type RoomHistoryRow = {
  room_id: string;
  room_type: string | null;
  room_phase: 'waiting' | 'voting' | 'matched' | 'planning' | 'finished' | string;
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

function roomTypeLabel(type: string | null) {
  if (type === 'cinema_pair') return 'Cinema · Coppia';
  if (type === 'cinema_group') return 'Cinema · Gruppo';
  if (type === 'streaming') return 'Streaming';
  if (type === 'public') return 'Pubblica';
  return 'Stanza';
}

export default function StanzePage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const [rooms, setRooms] = useState<RoomHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'tutte' | 'attive' | 'concluse'>('tutte');

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      void router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const { data, error: rpcError } = await supabase.rpc(
          'get_my_room_history',
          { p_limit: 60 }
        );

        if (rpcError) throw rpcError;

        if (!cancelled) {
          setRooms(
            ((data ?? []) as RoomHistoryRow[]).map((room) => ({
              ...room,
              participant_count: Number(room.participant_count ?? 0),
              match_count: Number(room.match_count ?? 0),
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossibile caricare le tue stanze.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentUser, supabase]);

  const visibleRooms = useMemo(() => {
    if (filter === 'attive') {
      return rooms.filter((room) => room.room_phase !== 'finished');
    }

    if (filter === 'concluse') {
      return rooms.filter((room) => room.room_phase === 'finished');
    }

    return rooms;
  }, [filter, rooms]);

  const activeCount = rooms.filter((room) => room.room_phase !== 'finished').length;
  const finishedCount = rooms.filter((room) => room.room_phase === 'finished').length;

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
          background: P.bg,
          display: 'grid',
          placeItems: 'center',
          color: P.textMuted,
          fontFamily: FONT,
        }}
      >
        <FilmSlate size={40} color={P.pink} weight="duotone" />
      </div>
    );
  }

  return (
    <AppShell activeNav="stanze">
      <main
        style={{
          minHeight: '100vh',
          background: P.bg,
          color: P.text,
          fontFamily: FONT,
          padding: '24px 18px 80px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 980, margin: '0 auto' }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: 0,
              background: 'transparent',
              color: P.textMuted,
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 800,
              marginBottom: 18,
            }}
          >
            <ArrowLeft size={16} />
            Indietro
          </button>

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
                  color: P.gold,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '.1em',
                  fontWeight: 900,
                }}
              >
                Le tue sessioni
              </div>

              <h1
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 'clamp(28px,5vw,40px)',
                  margin: '5px 0 5px',
                  lineHeight: 1,
                }}
              >
                Stanze
              </h1>

              <p
                style={{
                  margin: 0,
                  color: P.textMuted,
                  fontSize: 12,
                }}
              >
                Rientra nelle stanze attive o rivedi i film scelti insieme.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/crea-stanza')}
              style={{
                border: `1px solid ${P.pink}`,
                background: P.pinkGlow,
                color: P.pink,
                padding: '9px 12px',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              Crea stanza
            </button>
          </header>

          <div
            style={{
              display: 'flex',
              gap: 7,
              overflowX: 'auto',
              paddingBottom: 5,
              marginBottom: 15,
            }}
          >
            {[
              { id: 'tutte', label: 'Tutte', count: rooms.length },
              { id: 'attive', label: 'In corso', count: activeCount },
              { id: 'concluse', label: 'Concluse', count: finishedCount },
            ].map((item) => {
              const active = filter === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setFilter(item.id as 'tutte' | 'attive' | 'concluse')
                  }
                  style={{
                    border: `1px solid ${active ? P.gold : P.border}`,
                    background: active ? P.goldGlow : P.card,
                    color: active ? P.gold : P.textMuted,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontSize: 10,
                    fontWeight: 850,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label} · {item.count}
                </button>
              );
            })}
          </div>

          {error && (
            <div
              style={{
                border: `1px solid ${P.pink}55`,
                background: P.pinkGlow,
                color: P.pink,
                padding: 12,
                marginBottom: 14,
                fontSize: 11,
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 35,
                textAlign: 'center',
                color: P.textFaint,
              }}
            >
              Caricamento stanze...
            </div>
          ) : visibleRooms.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: 38,
                textAlign: 'center',
                color: P.textFaint,
              }}
            >
              <FilmSlate size={32} weight="duotone" />
              <div style={{ color: P.text, fontWeight: 850, marginTop: 8 }}>
                Nessuna stanza qui
              </div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                Le stanze a cui partecipi compariranno in questa cronologia.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
                gap: 11,
              }}
            >
              {visibleRooms.map((room) => {
                const finished = room.room_phase === 'finished';
                const hasWinner = Boolean(room.selected_movie_id);
                const cinemaRoom =
                  room.room_type === 'cinema_pair' ||
                  room.room_type === 'cinema_group';

                const phaseLabel =
                  room.room_phase === 'waiting'
                    ? 'In attesa'
                    : room.room_phase === 'voting'
                    ? 'Swipe in corso'
                    : room.room_phase === 'planning'
                    ? 'Organizzazione cinema'
                    : room.room_phase === 'matched'
                    ? 'Film scelto'
                    : 'Conclusa';

                return (
                  <article
                    key={room.room_id}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
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
                        background: finished
                          ? P.success
                          : hasWinner
                          ? P.gold
                          : P.pink,
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
                            color: P.text,
                            fontWeight: 900,
                            fontSize: 14,
                            letterSpacing: '.04em',
                          }}
                        >
                          {room.room_id}
                        </div>

                        <div
                          style={{
                            color: P.textFaint,
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
                          border: `1px solid ${
                            finished ? `${P.success}55` : P.border
                          }`,
                          background: finished ? `${P.success}12` : P.bgSoft,
                          color: finished ? P.success : P.textMuted,
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
                        color: P.textMuted,
                        fontSize: 9,
                      }}
                    >
                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <UsersThree size={12} />
                        {room.participant_count} partecipanti
                      </span>

                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <FilmSlate size={12} />
                        {room.match_count} match
                      </span>

                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <CalendarBlank size={12} />
                        {formatDate(room.selected_movie_at || room.created_at)}
                      </span>
                    </div>

                    {hasWinner && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/film/${encodeURIComponent(room.selected_movie_id as string)}`)
                        }
                        style={{
                          width: '100%',
                          marginTop: 12,
                          border: `1px solid ${P.gold}45`,
                          background: P.goldGlow,
                          color: P.gold,
                          padding: 10,
                          cursor: 'pointer',
                          fontFamily: FONT,
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
                      (room.selected_cinema_name || room.selected_showtime_at) && (
                        <div
                          style={{
                            border: `1px solid ${P.border}`,
                            background: P.bgSoft,
                            padding: 9,
                            marginTop: 8,
                            color: P.textMuted,
                            fontSize: 9,
                            lineHeight: 1.5,
                          }}
                        >
                          {room.selected_cinema_name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <MapPin size={12} color={P.gold} />
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
                              <Ticket size={12} color={P.gold} />
                              {formatDateTime(room.selected_showtime_at)}
                            </div>
                          )}
                        </div>
                      )}

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          finished
                            ? `/stanze/${encodeURIComponent(room.room_id)}`
                            : `/stanza?room=${encodeURIComponent(room.room_id)}`
                        )
                      }
                      style={{
                        width: '100%',
                        marginTop: 10,
                        border: `1px solid ${finished ? P.border : P.pink}`,
                        background: finished ? P.bgSoft : P.pinkGlow,
                        color: finished ? P.textMuted : P.pink,
                        padding: '9px 10px',
                        cursor: 'pointer',
                        fontFamily: FONT,
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
                      {finished ? 'Rivedi risultato' : 'Rientra'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}