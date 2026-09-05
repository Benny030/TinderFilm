'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  ArrowLeft,
  Ticket,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { useTheme } from '@/context/ThemeContext';
import type { ExtendedMovie } from '@/types/stanza';

type Showing = {
  session_id: string;
  showing_date: string;
  time: string;
  hall: string | null;
  format: string | null;
  booking_url: string | null;
};

type CinemaOption = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  distance_km: number | null;
  showings: Showing[];
};

type Props = {
  roomId: string;
  movie: ExtendedMovie;
  city?: string | null;
  cinemaName?: string | null;
  showtimeAt?: string | null;
  bookingUrl?: string | null;
  isHost: boolean;
  hostName?: string | null;
  saving: boolean;
  error: string;
  onSave: (payload: {
    cinemaName: string;
    showtimeAt: string;
    cinemaId?: number | null;
    showingId?: string | null;
    bookingUrl?: string | null;
  }) => void;
  onBack: () => void;
};

const D = {
  bg: '#0a0806',
  card: '#1c1613',
  border: '#2d221c',
  gold: '#f5b92f',
  pink: '#ed3d73',
  text: '#f0ebe6',
  muted: '#b5a89e',
};

const L = {
  bg: '#f5efe8',
  card: '#ffffff',
  border: '#d6cbbc',
  gold: '#b8860b',
  pink: '#b83060',
  text: '#1f1a16',
  muted: '#5c5248',
};

function combineLocalDateTime(date: string, time: string) {
  const normalizedTime = time.replace('.', ':').slice(0, 5);
  return `${date}T${normalizedTime}`;
}


function dayLabel(date: string) {
  const target = new Date(`${date}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (date === key(today)) return 'Oggi';
  if (date === key(tomorrow)) return 'Domani';

  return target.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
}

export default function CinemaPlanScreen({
  roomId,
  movie,
  city,
  cinemaName,
  showtimeAt,
  bookingUrl,
  isHost,
  hostName,
  saving,
  error,
  onSave,
  onBack,
}: Props) {
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;



  const [cinemas, setCinemas] = useState<CinemaOption[]>([]);
  const [showtimesLoading, setShowtimesLoading] = useState(false);
  const [showtimesError, setShowtimesError] = useState('');
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const confirmed = !!cinemaName && !!showtimeAt;

  const selectedCinema = useMemo(
    () => cinemas.find((cinema) => cinema.id === selectedCinemaId) ?? null,
    [cinemas, selectedCinemaId]
  );

  const availableDates = useMemo(() => {
    if (!selectedCinema) return [];

    return [...new Set(selectedCinema.showings.map((showing) => showing.showing_date))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [selectedCinema]);

  const visibleShowings = useMemo(() => {
    if (!selectedCinema || !selectedDate) return [];

    return selectedCinema.showings
      .filter((showing) => showing.showing_date === selectedDate)
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedCinema, selectedDate]);

  useEffect(() => {
    if (!roomId || !isHost) return;

    let cancelled = false;

    const loadShowtimes = async () => {
      setShowtimesLoading(true);
      setShowtimesError('');

      try {
        const tmdbId =
          typeof movie.tmdb_id === 'number'
            ? String(movie.tmdb_id)
            : String(movie.id).match(/^tmdb_(\d+)$/i)?.[1] ?? '';

        const params = new URLSearchParams({
          roomId,
          movieTitle: movie.title,
          days: '7',
        });

        if (tmdbId) {
          params.set('tmdbId', tmdbId);
        }

        const response = await fetch(
          `/api/rooms/showtimes?${params.toString()}`
        );

        const contentType = response.headers.get('content-type') || '';
        let data: any = null;

        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();

          throw new Error(
            response.status === 404
              ? 'API spettacoli non trovata. Controlla pages/api/rooms/showtimes.ts'
              : `Errore API spettacoli (${response.status})`
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.error || 'Impossibile caricare gli spettacoli'
          );
        }

        if (!cancelled) {
          const nextCinemas: CinemaOption[] = Array.isArray(data?.cinemas) ? data.cinemas : [];
          setCinemas(nextCinemas);

          if (nextCinemas.length > 0) {
            const firstCinema = nextCinemas[0];
            const firstDate = [...new Set(firstCinema.showings.map((showing) => showing.showing_date))]
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b))[0] ?? '';

            setSelectedCinemaId(firstCinema.id);
            setSelectedDate(firstDate);
          } else {
            setSelectedCinemaId(null);
            setSelectedDate('');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setShowtimesError(
            err instanceof Error ? err.message : 'Impossibile caricare gli spettacoli'
          );
        }
      } finally {
        if (!cancelled) setShowtimesLoading(false);
      }
    };

    void loadShowtimes();

    return () => {
      cancelled = true;
    };
  }, [roomId, isHost, movie.id, movie.tmdb_id, movie.title]);

  const saveRealShowing = (cinemaOption: CinemaOption, showing: Showing) => {
    const local = combineLocalDateTime(showing.showing_date, showing.time);
    const parsed = new Date(local);

    if (Number.isNaN(parsed.getTime())) return;

    onSave({
      cinemaName: cinemaOption.name,
      cinemaId: cinemaOption.id,
      showingId: showing.session_id,
      bookingUrl: showing.booking_url,
      showtimeAt: parsed.toISOString(),
    });
  };

  return (
    <>
      <style>{`
        .cinema-plan-page {
          min-height: 100vh;
          padding: 18px 16px 34px;
        }

        .cinema-plan-shell {
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
        }

        .cinema-plan-hero-grid {
          display: grid;
          grid-template-columns: 96px minmax(0,1fr);
          gap: 18px;
          align-items: center;
        }

        .cinema-plan-cinema-grid {
          display: grid;
          gap: 10px;
        }

        .cinema-plan-days {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .cinema-plan-times {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
          gap: 10px;
        }

        @media (min-width: 1024px) {
          .cinema-plan-page {
            padding: 32px 34px 48px;
          }

          .cinema-plan-shell {
            max-width: 1120px;
          }

          .cinema-plan-cinema-grid {
            grid-template-columns: repeat(2, minmax(0,1fr));
            gap: 12px;
          }

          .cinema-plan-times {
            grid-template-columns: repeat(4, minmax(0,1fr));
          }
        }

        @media (max-width: 640px) {
          .cinema-plan-page {
            padding: 14px 12px 28px;
          }

          .cinema-plan-hero-grid {
            grid-template-columns: 74px minmax(0,1fr);
            gap: 14px;
            align-items: start;
          }

          .cinema-plan-hero-poster {
            width: 74px !important;
            height: 111px !important;
            border-radius: 12px !important;
          }

          .cinema-plan-card {
            padding: 16px !important;
            border-radius: 16px !important;
          }

          .cinema-plan-days {
            display: grid;
            grid-template-columns: repeat(2, minmax(0,1fr));
          }

          .cinema-plan-day-btn {
            min-width: 0 !important;
            width: 100%;
          }

          .cinema-plan-times {
            grid-template-columns: repeat(2, minmax(0,1fr));
          }

          .cinema-plan-time-btn {
            min-width: 0 !important;
            width: 100%;
          }
        }
      `}</style>

      <div className="cinema-plan-page" style={{ background: P.bg, color: P.text }}>
        <div className="cinema-plan-shell">
        <button
          type="button"
          onClick={onBack}
          style={{ border: 0, background: 'transparent', color: P.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}
        >
          <ArrowLeft size={18} /> Torna ai match
        </button>

        <div
          className="cinema-plan-card"
          style={{
            background: P.card,
            border: `1px solid ${P.border}`,
            padding: 22,
            borderRadius: 20,
          }}
        >
          <div className="cinema-plan-hero-grid">
            <div
              className="cinema-plan-hero-poster"
              style={{
                width: 96,
                height: 144,
                borderRadius: 16,
                overflow: 'hidden',
                background: P.border,
                border: `1px solid ${P.border}`,
                flexShrink: 0,
              }}
            >
              {movie.cover?.startsWith('http') ? (
                <img
                  src={movie.cover}
                  alt={movie.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    placeItems: 'center',
                    color: P.muted,
                    fontSize: 11,
                    textAlign: 'center',
                    padding: 10,
                  }}
                >
                  Poster
                </div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: P.gold,
                  fontSize: 11,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '.12em',
                  marginBottom: 7,
                }}
              >
                <Ticket size={14} weight="duotone" />
                Film scelto
              </div>

              <div
                style={{
                  fontSize: 'clamp(24px, 4vw, 32px)',
                  fontWeight: 950,
                  letterSpacing: '-.03em',
                  lineHeight: 1.06,
                  color: P.text,
                }}
              >
                {movie.title}
              </div>

              <div
                style={{
                  color: P.muted,
                  fontSize: 13,
                  marginTop: 10,
                  lineHeight: 1.5,
                }}
              >
                Ora scegli il cinema, il giorno e l’orario migliore per il gruppo.
              </div>

              {city && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    marginTop: 12,
                    padding: '7px 10px',
                    border: `1px solid ${P.border}`,
                    borderRadius: 999,
                    color: P.text,
                    background: P.bg,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <MapPin size={14} color={P.gold} weight="fill" />
                  {city}
                </div>
              )}
            </div>
          </div>

          {confirmed && (
            <div style={{ marginTop: 22, borderTop: `1px solid ${P.border}`, paddingTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: P.gold, fontWeight: 800, marginBottom: 12 }}>
                <CheckCircle size={20} weight="fill" /> Piano del gruppo
              </div>
              <div className="cinema-plan-cinema-grid">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={18} color={P.pink} />
                  <span>{cinemaName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={18} color={P.gold} />
                  <span>{new Date(showtimeAt!).toLocaleDateString('it-IT')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={18} color={P.gold} />
                  <span>{new Date(showtimeAt!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {bookingUrl && (
                <button
                  type="button"
                  onClick={() => window.open(bookingUrl, '_blank', 'noopener,noreferrer')}
                  style={{ marginTop: 14, padding: '10px 12px', border: `1px solid ${P.gold}`, background: 'transparent', color: P.gold, cursor: 'pointer', fontWeight: 800 }}
                >
                  <ArrowSquareOut size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Apri prenotazione
                </button>
              )}
            </div>
          )}

          {isHost && (
            <div style={{ marginTop: 22, borderTop: `1px solid ${P.border}`, paddingTop: 18 }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                Cinema e orari disponibili
              </div>
              <div style={{ color: P.muted, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
                Ti mostro i cinema più vicini alla stanza e gli orari disponibili nei prossimi 7 giorni.
              </div>

              {showtimesLoading && (
                <div style={{ color: P.muted, padding: '10px 0' }}>
                  Cerco cinema vicini e orari disponibili...
                </div>
              )}

              {showtimesError && (
                <div style={{ color: P.pink, fontSize: 13, marginBottom: 12 }}>
                  {showtimesError}
                </div>
              )}

              {!showtimesLoading && cinemas.length > 0 && (
                <div style={{ display: 'grid', gap: 22, marginBottom: 20 }}>
                  {/* STEP 1 — CINEMA */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                        fontSize: 13,
                        fontWeight: 850,
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: P.gold,
                          color: P.bg,
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        1
                      </span>
                      Scegli il cinema
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      {cinemas.map((cinemaOption) => {
                        const active = selectedCinemaId === cinemaOption.id;
                        const dateCount = new Set(
                          cinemaOption.showings.map((showing) => showing.showing_date)
                        ).size;

                        return (
                          <button
                            key={cinemaOption.id}
                            type="button"
                            onClick={() => {
                              setSelectedCinemaId(cinemaOption.id);

                              const nextDate = [...new Set(
                                cinemaOption.showings.map((showing) => showing.showing_date)
                              )]
                                .filter(Boolean)
                                .sort((a, b) => a.localeCompare(b))[0] ?? '';

                              setSelectedDate(nextDate);
                            }}
                            style={{
                              width: '100%',
                              padding: '13px 14px',
                              border: `1px solid ${active ? P.gold : P.border}`,
                              background: active ? `${P.gold}14` : P.bg,
                              color: P.text,
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 850, display: 'flex', alignItems: 'center', gap: 7 }}>
                                <MapPin size={15} color={active ? P.gold : P.muted} />
                                {cinemaOption.name}
                              </div>
                              <div
                                style={{
                                  color: P.muted,
                                  fontSize: 11,
                                  marginTop: 4,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {cinemaOption.address || cinemaOption.city || 'Cinema disponibile'}
                                {' · '}
                                {dateCount} {dateCount === 1 ? 'giorno disponibile' : 'giorni disponibili'}
                              </div>
                            </div>

                            {cinemaOption.distance_km !== null && (
                              <div style={{ color: active ? P.gold : P.muted, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                {cinemaOption.distance_km} km
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 2 — GIORNO */}
                  {selectedCinema && availableDates.length > 0 && (
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 10,
                          fontSize: 13,
                          fontWeight: 850,
                        }}
                      >
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: P.gold,
                            color: P.bg,
                            fontSize: 11,
                            fontWeight: 900,
                          }}
                        >
                          2
                        </span>
                        Scegli il giorno
                      </div>

                      <div className="cinema-plan-days">
                        {availableDates.map((date) => {
                          const active = selectedDate === date;
                          const count = selectedCinema.showings.filter(
                            (showing) => showing.showing_date === date
                          ).length;

                          return (
                            <button
                              key={date}
                              type="button"
                              onClick={() => setSelectedDate(date)}
                              style={{
                                minWidth: 96,
                                padding: '10px 12px',
                                border: `1px solid ${active ? P.gold : P.border}`,
                                background: active ? P.gold : P.bg,
                                color: active ? P.bg : P.text,
                                cursor: 'pointer',
                                textAlign: 'center',
                              }}
                            >
                              <div style={{ fontWeight: 900, textTransform: 'capitalize', fontSize: 12 }}>
                                {dayLabel(date)}
                              </div>
                              <div style={{ fontSize: 10, marginTop: 3, opacity: active ? 0.78 : 0.62 }}>
                                {count} {count === 1 ? 'orario' : 'orari'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* STEP 3 — ORARIO */}
                  {selectedCinema && selectedDate && (
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 10,
                          fontSize: 13,
                          fontWeight: 850,
                        }}
                      >
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: P.gold,
                            color: P.bg,
                            fontSize: 11,
                            fontWeight: 900,
                          }}
                        >
                          3
                        </span>
                        Scegli l’orario
                      </div>

                      <div
                        style={{
                          border: `1px solid ${P.border}`,
                          background: P.bg,
                          padding: 12,
                        }}
                      >
                        <div style={{ color: P.muted, fontSize: 11, marginBottom: 10 }}>
                          <strong style={{ color: P.text }}>{selectedCinema.name}</strong>
                          {' · '}
                          <span style={{ textTransform: 'capitalize' }}>{dayLabel(selectedDate)}</span>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
                            gap: 8,
                          }}
                        >
                          {visibleShowings.map((showing) => (
                            <button
                              key={showing.session_id}
                              type="button"
                              onClick={() => saveRealShowing(selectedCinema, showing)}
                              disabled={saving}
                              style={{
                                padding: '12px 10px',
                                border: `1px solid ${P.border}`,
                                background: P.card,
                                color: P.text,
                                cursor: saving ? 'wait' : 'pointer',
                                textAlign: 'center',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  fontSize: 16,
                                  fontWeight: 900,
                                }}
                              >
                                <Ticket size={15} color={P.gold} />
                                {showing.time}
                              </div>

                              {(showing.format || showing.hall) && (
                                <div
                                  style={{
                                    color: P.muted,
                                    fontSize: 9,
                                    marginTop: 5,
                                    lineHeight: 1.3,
                                  }}
                                >
                                  {[showing.format, showing.hall]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!showtimesLoading && !showtimesError && cinemas.length === 0 && (
                <div
                  style={{
                    border: `1px dashed ${P.border}`,
                    padding: '18px 16px',
                    color: P.muted,
                    fontSize: 13,
                    lineHeight: 1.55,
                    textAlign: 'center',
                  }}
                >
                  Al momento non risultano spettacoli disponibili per <strong style={{ color: P.text }}>{movie.title}</strong>
                  {city ? ` nei cinema vicini a ${city}` : ' nei cinema vicini alla stanza'}.
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    Puoi tornare ai match e scegliere un altro film.
                  </div>
                </div>
              )}

              {error && (
                <div style={{ color: P.pink, fontSize: 13, marginTop: 12 }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {!confirmed && !isHost && (
            <div style={{ marginTop: 22, color: P.muted, textAlign: 'center', lineHeight: 1.5 }}>
              {hostName ? `${hostName} sta scegliendo cinema e orario…` : 'L’host sta scegliendo cinema e orario…'}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}