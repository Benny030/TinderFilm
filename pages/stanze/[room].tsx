'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  CheckCircle,
  FilmSlate,
  MapPin,
  Medal,
  Ticket,
  User,
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

type RoomDetail = {
  room: {
    id: string;
    room_type: string | null;
    room_phase: string;
    selected_movie_id: string | null;
    selected_movie_at: string | null;
    city: string | null;
    selected_cinema_name: string | null;
    selected_showtime_at: string | null;
    selected_booking_url: string | null;
    created_at: string;
    host_actor_id: string | null;
  };
  participants: Array<{
    actor_id: string;
    actor_type: string;
    display_name: string;
    role: string;
    membership_status: string;
    joined_at: string;
  }>;
  matches: Array<{
    id: string;
    movie_id: string;
    matched_members: number | null;
    total_members: number | null;
    match_percent: number | null;
    created_at: string;
    is_winner: boolean;
  }>;
};

function formatDateTime(value: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StanzaRisultatoPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const roomId =
    typeof router.query.room === 'string'
      ? router.query.room.trim().toUpperCase()
      : '';

  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      void router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (!router.isReady || !roomId || !currentUser || currentUser.isGuest) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const { data, error: rpcError } = await supabase.rpc(
          'get_room_history_detail',
          { p_room_id: roomId }
        );

        if (rpcError) throw rpcError;

        if (!cancelled) {
          setDetail(data as RoomDetail);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossibile caricare il riepilogo della stanza.'
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
  }, [router.isReady, roomId, currentUser, supabase]);

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
        <FilmSlate size={42} color={P.pink} weight="duotone" />
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
            onClick={() => router.push('/stanze')}
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
            Le mie stanze
          </button>

          {loading ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 36,
                textAlign: 'center',
                color: P.textFaint,
              }}
            >
              Caricamento riepilogo...
            </div>
          ) : error ? (
            <div
              style={{
                border: `1px solid ${P.pink}55`,
                background: P.pinkGlow,
                color: P.pink,
                padding: 14,
              }}
            >
              {error}
            </div>
          ) : detail ? (
            <>
              <header
                style={{
                  border: `1px solid ${P.border}`,
                  background: P.card,
                  padding: 20,
                  marginBottom: 14,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 3,
                    background:
                      detail.room.room_phase === 'finished'
                        ? P.success
                        : P.gold,
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: P.gold,
                        textTransform: 'uppercase',
                        letterSpacing: '.1em',
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      Riepilogo stanza
                    </div>

                    <h1
                      style={{
                        margin: '5px 0 4px',
                        fontFamily: FONT_DISPLAY,
                        fontSize: 'clamp(27px,5vw,38px)',
                      }}
                    >
                      {detail.room.id}
                    </h1>

                    <div
                      style={{
                        color: P.textMuted,
                        fontSize: 11,
                      }}
                    >
                      Creata il {formatDateTime(detail.room.created_at)}
                    </div>
                  </div>

                  <span
                    style={{
                      alignSelf: 'flex-start',
                      border: `1px solid ${
                        detail.room.room_phase === 'finished'
                          ? `${P.success}55`
                          : P.border
                      }`,
                      background:
                        detail.room.room_phase === 'finished'
                          ? `${P.success}12`
                          : P.bgSoft,
                      color:
                        detail.room.room_phase === 'finished'
                          ? P.success
                          : P.textMuted,
                      padding: '6px 9px',
                      fontSize: 9,
                      fontWeight: 850,
                    }}
                  >
                    {detail.room.room_phase === 'finished'
                      ? 'Conclusa'
                      : detail.room.room_phase}
                  </span>
                </div>
              </header>

              {detail.room.selected_movie_id && (
                <section
                  style={{
                    border: `1px solid ${P.gold}55`,
                    background: P.goldGlow,
                    padding: 16,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      color: P.gold,
                      fontSize: 10,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                    }}
                  >
                    <Medal size={16} weight="fill" />
                    Film scelto
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/film/${encodeURIComponent(
                          detail.room.selected_movie_id as string
                        )}`
                      )
                    }
                    style={{
                      marginTop: 10,
                      width: '100%',
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      color: P.text,
                      padding: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: FONT,
                      fontWeight: 850,
                    }}
                  >
                    Apri il film scelto
                  </button>

                  {(detail.room.selected_cinema_name ||
                    detail.room.selected_showtime_at) && (
                    <div
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.bgSoft,
                        padding: 10,
                        marginTop: 8,
                        fontSize: 10,
                        color: P.textMuted,
                      }}
                    >
                      {detail.room.selected_cinema_name && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 5,
                            alignItems: 'center',
                          }}
                        >
                          <MapPin size={13} color={P.gold} />
                          {detail.room.selected_cinema_name}
                        </div>
                      )}

                      {detail.room.selected_showtime_at && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 5,
                            alignItems: 'center',
                            marginTop: 4,
                          }}
                        >
                          <Ticket size={13} color={P.gold} />
                          {formatDateTime(detail.room.selected_showtime_at)}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(280px,1fr))',
                  gap: 12,
                }}
              >
                <section
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.card,
                    padding: 15,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      color: P.gold,
                      fontSize: 10,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      marginBottom: 10,
                    }}
                  >
                    <UsersThree size={15} weight="fill" />
                    Partecipanti
                  </div>

                  <div style={{ display: 'grid', gap: 7 }}>
                    {detail.participants.map((participant) => (
                      <div
                        key={`${participant.actor_type}-${participant.actor_id}`}
                        style={{
                          border: `1px solid ${P.border}`,
                          background: P.bgSoft,
                          padding: 9,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            display: 'grid',
                            placeItems: 'center',
                            background: P.card,
                            color: P.textMuted,
                          }}
                        >
                          <User size={15} weight="duotone" />
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 850,
                              color: P.text,
                            }}
                          >
                            {participant.display_name || 'Utente'}
                          </div>

                          <div
                            style={{
                              color: P.textFaint,
                              fontSize: 8,
                              marginTop: 2,
                            }}
                          >
                            {participant.role === 'host'
                              ? 'Host'
                              : 'Partecipante'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.card,
                    padding: 15,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      color: P.gold,
                      fontSize: 10,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      marginBottom: 10,
                    }}
                  >
                    <FilmSlate size={15} weight="fill" />
                    Match della sessione
                  </div>

                  {detail.matches.length === 0 ? (
                    <div
                      style={{
                        border: `1px dashed ${P.border}`,
                        background: P.bgSoft,
                        padding: 18,
                        textAlign: 'center',
                        color: P.textFaint,
                        fontSize: 10,
                      }}
                    >
                      Nessun match registrato.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 7 }}>
                      {detail.matches.map((match) => (
                        <button
                          key={match.id}
                          type="button"
                          onClick={() =>
                            router.push(
                              `/film/${encodeURIComponent(match.movie_id)}`
                            )
                          }
                          style={{
                            width: '100%',
                            border: `1px solid ${
                              match.is_winner ? P.gold : P.border
                            }`,
                            background:
                              match.is_winner ? P.goldGlow : P.bgSoft,
                            color: P.text,
                            padding: 9,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: FONT,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 8,
                              alignItems: 'center',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 850,
                              }}
                            >
                              Film {match.movie_id}
                            </span>

                            {match.is_winner && (
                              <CheckCircle
                                size={14}
                                color={P.gold}
                                weight="fill"
                              />
                            )}
                          </div>

                          <div
                            style={{
                              color: P.textFaint,
                              fontSize: 8,
                              marginTop: 3,
                            }}
                          >
                            {match.matched_members ?? 0}/
                            {match.total_members ?? 0} partecipanti
                            {match.match_percent !== null
                              ? ` · ${Math.round(match.match_percent)}%`
                              : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}