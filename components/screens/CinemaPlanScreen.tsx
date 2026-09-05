'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowSquareOut,
  Calendar,
  CheckCircle,
  CircleNotch,
  Clock,
  MapPin,
  Ticket,
} from '@phosphor-icons/react';

import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';
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

function combineLocalDateTime(date: string, time: string) {
  const normalizedTime = time.replace('.', ':').slice(0, 5);
  return `${date}T${normalizedTime}`;
}

function dayParts(date: string) {
  const target = new Date(`${date}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

  const weekday =
    date === key(today)
      ? 'Oggi'
      : date === key(tomorrow)
        ? 'Domani'
        : new Intl.DateTimeFormat('it-IT', { weekday: 'short' })
            .format(target)
            .replace('.', '');

  const day = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
  }).format(target);

  const month = new Intl.DateTimeFormat('it-IT', {
    month: 'short',
  })
    .format(target)
    .replace('.', '');

  return { weekday, day, month };
}

function formatConfirmedDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function formatConfirmedTime(value: string) {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
  const P = theme === 'dark' ? THEME.dark : THEME.light;

  const [cinemas, setCinemas] = useState<CinemaOption[]>([]);
  const [showtimesLoading, setShowtimesLoading] = useState(false);
  const [showtimesError, setShowtimesError] = useState('');
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState('');

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

        if (tmdbId) params.set('tmdbId', tmdbId);

        const response = await fetch(
          `/api/rooms/showtimes?${params.toString()}`
        );

        const contentType = response.headers.get('content-type') || '';
        let data: any = null;

        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          await response.text();

          throw new Error(
            response.status === 404
              ? 'API spettacoli non trovata. Controlla pages/api/rooms/showtimes.ts'
              : `Errore API spettacoli (${response.status})`
          );
        }

        if (!response.ok) {
          throw new Error(data?.error || 'Impossibile caricare gli spettacoli');
        }

        if (!cancelled) {
          const nextCinemas: CinemaOption[] = Array.isArray(data?.cinemas)
            ? data.cinemas
            : [];

          setCinemas(nextCinemas);

          if (nextCinemas.length > 0) {
            const firstCinema = nextCinemas[0];
            const firstDate =
              [
                ...new Set(
                  firstCinema.showings.map((showing) => showing.showing_date)
                ),
              ]
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
            err instanceof Error
              ? err.message
              : 'Impossibile caricare gli spettacoli'
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

  const selectCinema = (cinemaOption: CinemaOption) => {
    setSelectedCinemaId(cinemaOption.id);

    const nextDate =
      [
        ...new Set(
          cinemaOption.showings.map((showing) => showing.showing_date)
        ),
      ]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))[0] ?? '';

    setSelectedDate(nextDate);
  };

  const saveRealShowing = (
    cinemaOption: CinemaOption,
    showing: Showing
  ) => {
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

  const vars = {
    '--cdr-plan-bg': P.bg,
    '--cdr-plan-soft': P.bgSoft,
    '--cdr-plan-surface': P.surface,
    '--cdr-plan-hover': P.surfaceHover,
    '--cdr-plan-border': P.border,
    '--cdr-plan-text': P.text,
    '--cdr-plan-muted': P.textMuted,
    '--cdr-plan-faint': P.textFaint,
    '--cdr-plan-pink': P.primary,
    '--cdr-plan-pink-deep': P.primaryDeep,
    '--cdr-plan-pink-glow': P.primaryGlow,
    '--cdr-plan-gold': P.accent,
    '--cdr-plan-gold-soft': P.accentSoft,
    '--cdr-plan-gold-glow': P.accentGlow,
  } as CSSProperties;

  return (
    <main className="cdr-plan" style={vars}>
      <style>{`
        .cdr-plan {
          width: 100%;
          min-height: 100dvh;
          overflow-x: hidden;
          background: var(--cdr-plan-bg);
          color: var(--cdr-plan-text);
          font-family: ${FONT.sans};
        }

        .cdr-plan * {
          box-sizing: border-box;
        }

        .cdr-plan-shell {
          width: min(100%, 1120px);
          margin: 0 auto;
          padding: 20px 24px 54px;
        }

        .cdr-plan-back {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 14px;
          padding: 7px 10px;
          border: 1px solid var(--cdr-plan-border);
          border-radius: 0;
          background: transparent;
          color: var(--cdr-plan-muted);
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
          transition: 150ms ease;
        }

        .cdr-plan-back:hover {
          color: var(--cdr-plan-text);
          background: var(--cdr-plan-hover);
        }

        .cdr-plan-hero {
          display: grid;
          grid-template-columns: 112px minmax(0,1fr);
          gap: 18px;
          align-items: center;
          padding: 16px;
          border: 1px solid var(--cdr-plan-border);
          background: var(--cdr-plan-surface);
        }

        .cdr-plan-poster {
          width: 112px;
          aspect-ratio: 2 / 3;
          overflow: hidden;
          border: 1px solid var(--cdr-plan-border);
          background: var(--cdr-plan-soft);
        }

        .cdr-plan-poster img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .cdr-plan-poster-fallback {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          padding: 10px;
          color: var(--cdr-plan-muted);
          font-size: 10px;
          text-align: center;
        }

        .cdr-plan-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          color: var(--cdr-plan-gold);
          font-size: 9px;
          font-weight: 850;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .cdr-plan-title {
          margin: 0;
          font-family: ${FONT.display};
          font-size: clamp(30px, 4.4vw, 46px);
          line-height: .98;
          letter-spacing: -.035em;
        }

        .cdr-plan-lead {
          max-width: 620px;
          margin: 9px 0 0;
          color: var(--cdr-plan-muted);
          font-size: 11px;
          line-height: 1.55;
        }

        .cdr-plan-city {
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 30px;
          padding: 5px 8px;
          border: 1px solid var(--cdr-plan-border);
          background: var(--cdr-plan-bg);
          color: var(--cdr-plan-text);
          font-size: 9px;
          font-weight: 800;
        }

        .cdr-plan-confirmed {
          margin-top: 12px;
          border: 1px solid var(--cdr-plan-gold);
          background: var(--cdr-plan-gold-glow);
        }

        .cdr-plan-confirmed-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--cdr-plan-border);
          color: var(--cdr-plan-gold);
          font-size: 11px;
          font-weight: 850;
        }

        .cdr-plan-confirmed-grid {
          display: grid;
          grid-template-columns: 1.3fr .8fr .6fr auto;
          gap: 8px;
          align-items: center;
          padding: 10px 12px;
        }

        .cdr-plan-confirmed-item {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--cdr-plan-text);
          font-size: 10px;
          font-weight: 750;
        }

        .cdr-plan-booking {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px 9px;
          border: 1px solid var(--cdr-plan-gold);
          background: transparent;
          color: var(--cdr-plan-gold);
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .cdr-plan-workspace {
          margin-top: 12px;
          display: grid;
          grid-template-columns: minmax(250px,.82fr) minmax(0,1.18fr);
          gap: 12px;
          align-items: start;
        }

        .cdr-plan-panel {
          border: 1px solid var(--cdr-plan-border);
          background: var(--cdr-plan-surface);
        }

        .cdr-plan-panel-head {
          padding: 11px 12px;
          border-bottom: 1px solid var(--cdr-plan-border);
        }

        .cdr-plan-panel-head strong {
          display: block;
          font-size: 12px;
        }

        .cdr-plan-panel-head span {
          display: block;
          margin-top: 3px;
          color: var(--cdr-plan-muted);
          font-size: 9px;
          line-height: 1.45;
        }

        .cdr-plan-panel-body {
          padding: 10px;
        }

        .cdr-plan-step-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 850;
        }

        .cdr-plan-step-number {
          width: 22px;
          height: 22px;
          flex: 0 0 auto;
          display: inline-grid;
          place-items: center;
          background: var(--cdr-plan-gold);
          color: var(--cdr-plan-bg);
          font-size: 9px;
          font-weight: 900;
        }

        .cdr-plan-cinema-list {
          display: grid;
          gap: 6px;
        }

        .cdr-plan-cinema {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 9px;
          align-items: center;
          padding: 9px 10px;
          border: 1px solid var(--cdr-plan-border);
          background: var(--cdr-plan-bg);
          color: var(--cdr-plan-text);
          text-align: left;
          cursor: pointer;
          transition: 150ms ease;
        }

        .cdr-plan-cinema[data-active="true"] {
          border-color: var(--cdr-plan-gold);
          background: var(--cdr-plan-gold-glow);
        }

        .cdr-plan-cinema:hover {
          background: var(--cdr-plan-hover);
        }

        .cdr-plan-cinema-name {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 850;
        }

        .cdr-plan-cinema-meta {
          margin-top: 3px;
          overflow: hidden;
          color: var(--cdr-plan-muted);
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cdr-plan-distance {
          color: var(--cdr-plan-muted);
          font-size: 8px;
          font-weight: 850;
          white-space: nowrap;
        }

        .cdr-plan-cinema[data-active="true"] .cdr-plan-distance {
          color: var(--cdr-plan-gold);
        }

        .cdr-plan-right {
          display: grid;
          gap: 12px;
        }

        .cdr-plan-days {
          display: grid;
          grid-template-columns: repeat(7, minmax(62px,1fr));
          gap: 5px;
          overflow-x: auto;
          scrollbar-width: none;
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
        }

        .cdr-plan-days::-webkit-scrollbar {
          display: none;
        }

        .cdr-plan-day {
          min-width: 62px;
          min-height: 58px;
          scroll-snap-align: start;
          display: grid;
          place-items: center;
          gap: 1px;
          padding: 6px 4px;
          border: 1px solid var(--cdr-plan-border);
          background: var(--cdr-plan-bg);
          color: var(--cdr-plan-muted);
          cursor: pointer;
        }

        .cdr-plan-day[data-active="true"] {
          border-color: var(--cdr-plan-gold);
          background: var(--cdr-plan-gold);
          color: var(--cdr-plan-bg);
        }

        .cdr-plan-day-week {
          font-size: 8px;
          font-weight: 850;
          text-transform: capitalize;
        }

        .cdr-plan-day-number {
          font-family: ${FONT.display};
          font-size: 18px;
          line-height: 1;
          font-weight: 700;
        }

        .cdr-plan-day-month {
          font-size: 7px;
          opacity: .72;
        }

        .cdr-plan-times {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 6px;
        }

        .cdr-plan-time {
          min-height: 58px;
          display: grid;
          place-items: center;
          gap: 3px;
          padding: 8px;
          border: 1px solid var(--cdr-plan-border);
          background: var(--cdr-plan-bg);
          color: var(--cdr-plan-text);
          cursor: pointer;
          transition: 150ms ease;
        }

        .cdr-plan-time:hover {
          border-color: var(--cdr-plan-gold);
          background: var(--cdr-plan-gold-glow);
        }

        .cdr-plan-time-main {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 14px;
          font-weight: 900;
        }

        .cdr-plan-time-meta {
          color: var(--cdr-plan-muted);
          font-size: 7px;
          text-align: center;
        }

        .cdr-plan-state {
          min-height: 126px;
          display: grid;
          place-items: center;
          padding: 16px;
          border: 1px dashed var(--cdr-plan-border);
          background: var(--cdr-plan-bg);
          color: var(--cdr-plan-muted);
          text-align: center;
          font-size: 10px;
          line-height: 1.5;
        }

        .cdr-plan-state-inner {
          display: grid;
          justify-items: center;
          gap: 8px;
          max-width: 360px;
        }

        .cdr-plan-error {
          margin-top: 8px;
          color: var(--cdr-plan-pink);
          font-size: 9px;
          line-height: 1.45;
        }

        .cdr-plan-waiting {
          margin-top: 12px;
          min-height: 150px;
          display: grid;
          place-items: center;
          padding: 18px;
          border: 1px solid var(--cdr-plan-border);
          background: var(--cdr-plan-surface);
          text-align: center;
        }

        .cdr-plan-waiting strong {
          display: block;
          font-family: ${FONT.display};
          font-size: 21px;
        }

        .cdr-plan-waiting span {
          display: block;
          margin-top: 6px;
          color: var(--cdr-plan-muted);
          font-size: 10px;
        }

        @keyframes cdr-plan-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
          .cdr-plan-workspace {
            grid-template-columns: 1fr;
          }

          .cdr-plan-cinema-list {
            grid-template-columns: repeat(2, minmax(0,1fr));
          }
        }

        @media (max-width: 640px) {
          .cdr-plan-shell {
            padding: 10px 8px 28px;
          }

          .cdr-plan-back {
            min-height: 34px;
            margin-bottom: 8px;
            padding: 6px 8px;
            font-size: 9px;
          }

          .cdr-plan-hero {
            grid-template-columns: 82px minmax(0,1fr);
            gap: 10px;
            padding: 9px;
          }

          .cdr-plan-poster {
            width: 82px;
          }

          .cdr-plan-title {
            font-size: 23px;
          }

          .cdr-plan-kicker {
            margin-bottom: 4px;
            font-size: 7px;
          }

          .cdr-plan-lead {
            margin-top: 6px;
            font-size: 9px;
            line-height: 1.42;
          }

          .cdr-plan-city {
            min-height: 26px;
            margin-top: 7px;
            padding: 4px 6px;
            font-size: 8px;
          }

          .cdr-plan-confirmed-grid {
            grid-template-columns: 1fr 1fr;
          }

          .cdr-plan-booking {
            grid-column: 1 / -1;
            width: 100%;
          }

          .cdr-plan-workspace {
            margin-top: 8px;
            gap: 8px;
          }

          .cdr-plan-panel-head {
            padding: 9px;
          }

          .cdr-plan-panel-head strong {
            font-size: 11px;
          }

          .cdr-plan-panel-head span {
            font-size: 8px;
          }

          .cdr-plan-panel-body {
            padding: 8px;
          }

          .cdr-plan-cinema-list {
            grid-template-columns: 1fr;
            gap: 5px;
          }

          .cdr-plan-cinema {
            padding: 8px;
          }

          .cdr-plan-days {
            grid-template-columns: repeat(7, 56px);
            gap: 4px;
          }

          .cdr-plan-day {
            min-width: 56px;
            min-height: 52px;
            padding: 5px 3px;
          }

          .cdr-plan-day-number {
            font-size: 16px;
          }

          .cdr-plan-times {
            grid-template-columns: repeat(2, minmax(0,1fr));
            gap: 5px;
          }

          .cdr-plan-time {
            min-height: 52px;
            padding: 6px;
          }

          .cdr-plan-time-main {
            font-size: 13px;
          }
        }

        @media (min-width: 381px) and (max-width: 460px) {
          .cdr-plan-shell {
            padding-inline: 8px;
          }

          .cdr-plan-hero {
            grid-template-columns: 78px minmax(0,1fr);
          }

          .cdr-plan-poster {
            width: 78px;
          }

          .cdr-plan-title {
            font-size: 22px;
          }

          .cdr-plan-lead {
            max-width: 290px;
          }

          .cdr-plan-days {
            grid-template-columns: repeat(7, 54px);
          }

          .cdr-plan-day {
            min-width: 54px;
            min-height: 50px;
          }
        }

        @media (max-width: 380px) {
          .cdr-plan-back span {
            display: none;
          }

          .cdr-plan-hero {
            grid-template-columns: 72px minmax(0,1fr);
            gap: 8px;
            padding: 8px;
          }

          .cdr-plan-poster {
            width: 72px;
          }

          .cdr-plan-title {
            font-size: 20px;
          }

          .cdr-plan-lead {
            font-size: 8.5px;
          }

          .cdr-plan-confirmed-grid {
            grid-template-columns: 1fr;
          }

          .cdr-plan-times {
            grid-template-columns: repeat(2, minmax(0,1fr));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cdr-plan-back,
          .cdr-plan-cinema,
          .cdr-plan-time {
            transition: none !important;
          }
        }
      `}</style>

      <div className="cdr-plan-shell">
        <button type="button" className="cdr-plan-back" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Torna ai match</span>
        </button>

        <section className="cdr-plan-hero">
          <div className="cdr-plan-poster">
            {movie.cover?.startsWith('http') ? (
              <img src={movie.cover} alt={movie.title} />
            ) : (
              <div className="cdr-plan-poster-fallback">Poster</div>
            )}
          </div>

          <div>
            <div className="cdr-plan-kicker">
              <Ticket size={12} weight="duotone" />
              Film scelto
            </div>

            <h1 className="cdr-plan-title">{movie.title}</h1>

            <p className="cdr-plan-lead">
              Il film è deciso. Ora trasformate il match in un appuntamento:
              scegli cinema, giorno e orario.
            </p>

            {city && (
              <div className="cdr-plan-city">
                <MapPin size={12} weight="fill" color={P.accent} />
                {city}
              </div>
            )}
          </div>
        </section>

        {confirmed && (
          <section className="cdr-plan-confirmed">
            <div className="cdr-plan-confirmed-head">
              <CheckCircle size={17} weight="fill" />
              Piano del gruppo confermato
            </div>

            <div className="cdr-plan-confirmed-grid">
              <div className="cdr-plan-confirmed-item">
                <MapPin size={14} color={P.primary} />
                <span>{cinemaName}</span>
              </div>

              <div className="cdr-plan-confirmed-item">
                <Calendar size={14} color={P.accent} />
                <span>{formatConfirmedDate(showtimeAt!)}</span>
              </div>

              <div className="cdr-plan-confirmed-item">
                <Clock size={14} color={P.accent} />
                <span>{formatConfirmedTime(showtimeAt!)}</span>
              </div>

              {bookingUrl && (
                <button
                  type="button"
                  className="cdr-plan-booking"
                  onClick={() =>
                    window.open(
                      bookingUrl,
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                >
                  <ArrowSquareOut size={13} />
                  Prenota
                </button>
              )}
            </div>
          </section>
        )}

        {isHost ? (
          <section className="cdr-plan-workspace">
            <div className="cdr-plan-panel">
              <div className="cdr-plan-panel-head">
                <strong>1. Scegli il cinema</strong>
                <span>
                  Cinema disponibili per questo film, ordinati dalla stanza.
                </span>
              </div>

              <div className="cdr-plan-panel-body">
                {showtimesLoading ? (
                  <div className="cdr-plan-state">
                    <div className="cdr-plan-state-inner">
                      <CircleNotch
                        size={20}
                        style={{
                          animation: 'cdr-plan-spin 1s linear infinite',
                        }}
                      />
                      Cerco cinema e spettacoli disponibili…
                    </div>
                  </div>
                ) : showtimesError ? (
                  <div className="cdr-plan-state">
                    <div className="cdr-plan-state-inner">
                      <MapPin size={22} weight="duotone" />
                      {showtimesError}
                    </div>
                  </div>
                ) : cinemas.length === 0 ? (
                  <div className="cdr-plan-state">
                    <div className="cdr-plan-state-inner">
                      <Ticket size={22} weight="duotone" />
                      Nessuno spettacolo trovato per {movie.title}
                      {city ? ` vicino a ${city}` : ' vicino alla stanza'}.
                    </div>
                  </div>
                ) : (
                  <div className="cdr-plan-cinema-list">
                    {cinemas.map((cinemaOption) => {
                      const active =
                        selectedCinemaId === cinemaOption.id;

                      const dateCount = new Set(
                        cinemaOption.showings.map(
                          (showing) => showing.showing_date
                        )
                      ).size;

                      return (
                        <button
                          key={cinemaOption.id}
                          type="button"
                          className="cdr-plan-cinema"
                          data-active={active}
                          onClick={() => selectCinema(cinemaOption)}
                        >
                          <div>
                            <div className="cdr-plan-cinema-name">
                              <MapPin
                                size={12}
                                color={
                                  active ? P.accent : P.textMuted
                                }
                              />
                              <span>{cinemaOption.name}</span>
                            </div>

                            <div className="cdr-plan-cinema-meta">
                              {cinemaOption.address ||
                                cinemaOption.city ||
                                'Cinema disponibile'}
                              {' · '}
                              {dateCount}{' '}
                              {dateCount === 1
                                ? 'giorno'
                                : 'giorni'}
                            </div>
                          </div>

                          {cinemaOption.distance_km !== null && (
                            <div className="cdr-plan-distance">
                              {cinemaOption.distance_km} km
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {error && (
                  <div className="cdr-plan-error">{error}</div>
                )}
              </div>
            </div>

            <div className="cdr-plan-right">
              <div className="cdr-plan-panel">
                <div className="cdr-plan-panel-head">
                  <strong>2. Scegli il giorno</strong>
                  <span>
                    La programmazione disponibile per il cinema selezionato.
                  </span>
                </div>

                <div className="cdr-plan-panel-body">
                  {!selectedCinema || availableDates.length === 0 ? (
                    <div className="cdr-plan-state">
                      <div className="cdr-plan-state-inner">
                        <Calendar size={22} weight="duotone" />
                        Seleziona prima un cinema.
                      </div>
                    </div>
                  ) : (
                    <div className="cdr-plan-days">
                      {availableDates.map((date) => {
                        const active = selectedDate === date;
                        const parts = dayParts(date);

                        return (
                          <button
                            key={date}
                            type="button"
                            className="cdr-plan-day"
                            data-active={active}
                            onClick={() => setSelectedDate(date)}
                          >
                            <span className="cdr-plan-day-week">
                              {parts.weekday}
                            </span>
                            <span className="cdr-plan-day-number">
                              {parts.day}
                            </span>
                            <span className="cdr-plan-day-month">
                              {parts.month}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="cdr-plan-panel">
                <div className="cdr-plan-panel-head">
                  <strong>3. Scegli l’orario</strong>
                  <span>
                    Confermando un orario aggiorni il piano della stanza.
                  </span>
                </div>

                <div className="cdr-plan-panel-body">
                  {!selectedCinema || !selectedDate ? (
                    <div className="cdr-plan-state">
                      <div className="cdr-plan-state-inner">
                        <Clock size={22} weight="duotone" />
                        Scegli cinema e giorno per vedere gli orari.
                      </div>
                    </div>
                  ) : visibleShowings.length === 0 ? (
                    <div className="cdr-plan-state">
                      <div className="cdr-plan-state-inner">
                        <Clock size={22} weight="duotone" />
                        Nessun orario disponibile per questa giornata.
                      </div>
                    </div>
                  ) : (
                    <div className="cdr-plan-times">
                      {visibleShowings.map((showing) => (
                        <button
                          key={showing.session_id}
                          type="button"
                          className="cdr-plan-time"
                          disabled={saving}
                          onClick={() =>
                            saveRealShowing(selectedCinema, showing)
                          }
                        >
                          <div className="cdr-plan-time-main">
                            <Ticket
                              size={13}
                              color={P.accent}
                              weight="fill"
                            />
                            {showing.time}
                          </div>

                          {(showing.format || showing.hall) && (
                            <div className="cdr-plan-time-meta">
                              {[showing.format, showing.hall]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {saving && (
                    <div
                      style={{
                        marginTop: 8,
                        color: P.textMuted,
                        fontSize: 9,
                      }}
                    >
                      Salvo il piano della stanza…
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : !confirmed ? (
          <section className="cdr-plan-waiting">
            <div>
              <strong>Il piano sta prendendo forma</strong>
              <span>
                {hostName
                  ? `${hostName} sta scegliendo cinema e orario…`
                  : 'L’host sta scegliendo cinema e orario…'}
              </span>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
