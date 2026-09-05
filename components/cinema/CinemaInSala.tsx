'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  CalendarBlank,
  CircleNotch,
  MapPin,
  Ticket,
} from '@phosphor-icons/react';

import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';

type Session = {
  time: string;
  bookingUrl: string;
  date: string;
};

type Showing = {
  cinema: string;
  cinemaId: number;
  distanceKm: number;
  sessions: Session[];
  bookingUrl?: string;
};

type Props = {
  filmTitle: string;
  tmdbTitle?: string;
};

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildSevenDays() {
  const days: Array<{
    key: string;
    weekday: string;
    day: string;
    month: string;
  }> = [];

  const now = new Date();

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + index);

    days.push({
      key: localDateKey(date),
      weekday:
        index === 0
          ? 'Oggi'
          : new Intl.DateTimeFormat('it-IT', {
              weekday: 'short',
            })
              .format(date)
              .replace('.', ''),
      day: new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
      }).format(date),
      month: new Intl.DateTimeFormat('it-IT', {
        month: 'short',
      })
        .format(date)
        .replace('.', ''),
    });
  }

  return days;
}

export default function CinemaInSala({ filmTitle, tmdbTitle }: Props) {
  const { theme } = useTheme();
  const P = theme === 'dark' ? THEME.dark : THEME.light;

  const days = useMemo(() => buildSevenDays(), []);
  const [selectedDay, setSelectedDay] = useState(days[0]?.key ?? '');
  const [showings, setShowings] = useState<Showing[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [noLocation, setNoLocation] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      setLoading(true);
      setChecked(false);
      setNoLocation(false);

      let lat: number | null = null;
      let lng: number | null = null;

      const cached = sessionStorage.getItem('cineDateUserCoords');

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          lat = Number(parsed.lat);
          lng = Number(parsed.lng);
        } catch {}
      }

      if (
        (lat === null || Number.isNaN(lat) || lng === null || Number.isNaN(lng)) &&
        navigator.geolocation
      ) {
        try {
          const pos = await new Promise<GeolocationPosition>(
            (resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 6000,
                maximumAge: 10 * 60 * 1000,
              })
          );

          lat = pos.coords.latitude;
          lng = pos.coords.longitude;

          sessionStorage.setItem(
            'cineDateUserCoords',
            JSON.stringify({ lat, lng })
          );
        } catch {}
      }

      if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
        if (!cancelled) {
          setNoLocation(true);
          setLoading(false);
          setChecked(true);
        }
        return;
      }

      try {
        const title = tmdbTitle ?? filmTitle;
        const response = await fetch(
          `/api/cinema/check-film?title=${encodeURIComponent(
            title
          )}&lat=${lat}&lng=${lng}&radius=50&days=7`
        );

        const data = await response.json();

        if (!cancelled) {
          setShowings(data.showings ?? []);
        }
      } catch {
        if (!cancelled) setShowings([]);
      } finally {
        if (!cancelled) {
          setChecked(true);
          setLoading(false);
        }
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, [filmTitle, tmdbTitle]);

  const dayShowings = useMemo(
    () =>
      showings
        .map((showing) => ({
          ...showing,
          sessions: showing.sessions.filter(
            (session) => session.date === selectedDay
          ),
        }))
        .filter((showing) => showing.sessions.length > 0),
    [selectedDay, showings]
  );

  const sessionsPerDay = useMemo(() => {
    const counts = new Map<string, number>();

    for (const showing of showings) {
      for (const session of showing.sessions) {
        counts.set(session.date, (counts.get(session.date) ?? 0) + 1);
      }
    }

    return counts;
  }, [showings]);

  const vars = {
    '--cdr-cinema-bg': P.bg,
    '--cdr-cinema-soft': P.bgSoft,
    '--cdr-cinema-surface': P.surface,
    '--cdr-cinema-hover': P.surfaceHover,
    '--cdr-cinema-border': P.border,
    '--cdr-cinema-text': P.text,
    '--cdr-cinema-muted': P.textMuted,
    '--cdr-cinema-faint': P.textFaint,
    '--cdr-cinema-pink': P.primary,
    '--cdr-cinema-pink-glow': P.primaryGlow,
    '--cdr-cinema-gold': P.accent,
    '--cdr-cinema-gold-glow': P.accentGlow,
  } as CSSProperties;

  return (
    <div className="cdr-cinema-week" style={vars}>
      <style>{`
        .cdr-cinema-week {
          width: 100%;
          color: var(--cdr-cinema-text);
          font-family: ${FONT.sans};
        }

        .cdr-cinema-week * {
          box-sizing: border-box;
        }

        .cdr-cinema-days {
          display: grid;
          grid-template-columns: repeat(7, minmax(70px, 1fr));
          gap: 6px;
          margin-bottom: 12px;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
        }

        .cdr-cinema-days::-webkit-scrollbar {
          display: none;
        }

        .cdr-cinema-day {
          min-width: 70px;
          min-height: 62px;
          scroll-snap-align: start;
          display: grid;
          place-items: center;
          gap: 2px;
          padding: 7px 5px;
          border: 1px solid var(--cdr-cinema-border);
          border-radius: 0;
          background: var(--cdr-cinema-bg);
          color: var(--cdr-cinema-muted);
          cursor: pointer;
          transition: 150ms ease;
        }

        .cdr-cinema-day:hover {
          background: var(--cdr-cinema-hover);
          color: var(--cdr-cinema-text);
        }

        .cdr-cinema-day[data-active="true"] {
          border-color: var(--cdr-cinema-pink);
          background: var(--cdr-cinema-pink-glow);
          color: var(--cdr-cinema-pink);
        }

        .cdr-cinema-day-week {
          font-size: 9px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .cdr-cinema-day-date {
          font-family: ${FONT.display};
          font-size: 19px;
          line-height: 1;
          font-weight: 700;
        }

        .cdr-cinema-day-month {
          font-size: 9px;
          color: var(--cdr-cinema-faint);
        }

        .cdr-cinema-day-dot {
          width: 4px;
          height: 4px;
          background: var(--cdr-cinema-gold);
          opacity: 0;
        }

        .cdr-cinema-day[data-has-sessions="true"] .cdr-cinema-day-dot {
          opacity: 1;
        }

        .cdr-cinema-loading,
        .cdr-cinema-empty,
        .cdr-cinema-location {
          min-height: 104px;
          display: grid;
          place-items: center;
          padding: 18px;
          border: 1px dashed var(--cdr-cinema-border);
          background: var(--cdr-cinema-bg);
          color: var(--cdr-cinema-muted);
          text-align: center;
          font-size: 11px;
          line-height: 1.5;
        }

        .cdr-cinema-loading-inner,
        .cdr-cinema-empty-inner {
          display: grid;
          justify-items: center;
          gap: 8px;
        }

        .cdr-cinema-list {
          display: grid;
          gap: 8px;
        }

        .cdr-cinema-card {
          border: 1px solid var(--cdr-cinema-border);
          background: var(--cdr-cinema-bg);
          padding: 12px;
        }

        .cdr-cinema-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 11px;
        }

        .cdr-cinema-name {
          font-size: 12px;
          font-weight: 850;
          line-height: 1.3;
        }

        .cdr-cinema-distance {
          margin-top: 4px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--cdr-cinema-muted);
          font-size: 10px;
        }

        .cdr-cinema-booking {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 10px;
          border: 1px solid var(--cdr-cinema-pink);
          background: var(--cdr-cinema-pink);
          color: #fff;
          text-decoration: none;
          font-size: 10px;
          font-weight: 850;
          white-space: nowrap;
        }

        .cdr-cinema-times {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .cdr-cinema-time {
          min-width: 54px;
          min-height: 31px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 9px;
          border: 1px solid var(--cdr-cinema-border);
          background: var(--cdr-cinema-surface);
          color: var(--cdr-cinema-text);
          text-decoration: none;
          font-size: 10px;
          font-weight: 850;
          transition: 150ms ease;
        }

        .cdr-cinema-time:hover {
          border-color: var(--cdr-cinema-pink);
          color: var(--cdr-cinema-pink);
          background: var(--cdr-cinema-pink-glow);
        }

        @keyframes cdr-cinema-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 760px) {
          .cdr-cinema-days {
            grid-template-columns: repeat(7, 72px);
            margin-right: -12px;
            padding-right: 12px;
            padding-bottom: 3px;
          }

          .cdr-cinema-card {
            padding: 11px;
          }
        }

        @media (max-width: 520px) {
          .cdr-cinema-days {
            grid-template-columns: repeat(7, 58px);
            gap: 4px;
            margin: 0 -1px 9px;
            padding: 0 1px 3px;
          }

          .cdr-cinema-day {
            min-width: 58px;
            min-height: 52px;
            padding: 5px 3px;
          }

          .cdr-cinema-day-week {
            font-size: 8px;
          }

          .cdr-cinema-day-date {
            font-size: 16px;
          }

          .cdr-cinema-day-month {
            font-size: 8px;
          }

          .cdr-cinema-card {
            padding: 9px;
          }

          .cdr-cinema-card-head {
            align-items: center;
            gap: 7px;
            margin-bottom: 8px;
          }

          .cdr-cinema-name {
            font-size: 10px;
          }

          .cdr-cinema-distance {
            margin-top: 2px;
            font-size: 9px;
          }

          .cdr-cinema-booking {
            min-height: 30px;
            padding: 5px 7px;
            font-size: 8px;
          }

          .cdr-cinema-times {
            gap: 4px;
          }

          .cdr-cinema-time {
            min-width: 48px;
            min-height: 28px;
            padding: 4px 7px;
            font-size: 9px;
          }

          .cdr-cinema-loading,
          .cdr-cinema-empty,
          .cdr-cinema-location {
            min-height: 88px;
            padding: 12px;
            font-size: 10px;
          }
        }

        @media (min-width: 381px) and (max-width: 460px) {
          .cdr-cinema-days {
            grid-template-columns: repeat(7, 54px);
            gap: 4px;
            margin: 0 -1px 8px;
            padding: 0 1px 3px;
          }

          .cdr-cinema-day {
            min-width: 54px;
            min-height: 49px;
            padding: 4px 3px;
          }

          .cdr-cinema-day-week {
            font-size: 7px;
          }

          .cdr-cinema-day-date {
            font-size: 15px;
          }

          .cdr-cinema-day-month {
            font-size: 7px;
          }

          .cdr-cinema-card {
            padding: 8px;
          }

          .cdr-cinema-card-head {
            margin-bottom: 7px;
          }

          .cdr-cinema-name {
            max-width: 250px;
            font-size: 10px;
          }

          .cdr-cinema-distance {
            font-size: 8.5px;
          }

          .cdr-cinema-booking {
            min-height: 28px;
            padding: 5px 7px;
            font-size: 8px;
          }

          .cdr-cinema-times {
            gap: 4px;
          }

          .cdr-cinema-time {
            min-width: 46px;
            min-height: 27px;
            padding: 4px 6px;
            font-size: 8.5px;
          }
        }

        @media (max-width: 360px) {
          .cdr-cinema-days {
            grid-template-columns: repeat(7, 56px);
          }

          .cdr-cinema-day {
            min-width: 56px;
          }

          .cdr-cinema-card-head {
            flex-direction: column;
            align-items: stretch;
          }

          .cdr-cinema-booking {
            width: 100%;
          }
        }

      `}</style>

      <div className="cdr-cinema-days" aria-label="Programmazione dei prossimi sette giorni">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            className="cdr-cinema-day"
            data-active={selectedDay === day.key}
            data-has-sessions={(sessionsPerDay.get(day.key) ?? 0) > 0}
            onClick={() => setSelectedDay(day.key)}
          >
            <span className="cdr-cinema-day-week">{day.weekday}</span>
            <span className="cdr-cinema-day-date">{day.day}</span>
            <span className="cdr-cinema-day-month">{day.month}</span>
            <span className="cdr-cinema-day-dot" />
          </button>
        ))}
      </div>

      {loading ? (
        <div className="cdr-cinema-loading">
          <div className="cdr-cinema-loading-inner">
            <CircleNotch
              size={20}
              style={{ animation: 'cdr-cinema-spin 1s linear infinite' }}
            />
            Cerco cinema e programmazione vicino a te…
          </div>
        </div>
      ) : noLocation ? (
        <div className="cdr-cinema-location">
          <div className="cdr-cinema-empty-inner">
            <MapPin size={23} weight="duotone" />
            Abilita la posizione per vedere i cinema più vicini.
          </div>
        </div>
      ) : checked && dayShowings.length === 0 ? (
        <div className="cdr-cinema-empty">
          <div className="cdr-cinema-empty-inner">
            <CalendarBlank size={23} weight="duotone" />
            Nessuna proiezione trovata per questa giornata.
          </div>
        </div>
      ) : (
        <div className="cdr-cinema-list">
          {dayShowings.map((showing) => {
            const defaultBooking =
              showing.sessions.find((session) => session.bookingUrl)?.bookingUrl ??
              showing.bookingUrl;

            return (
              <article key={showing.cinemaId} className="cdr-cinema-card">
                <div className="cdr-cinema-card-head">
                  <div>
                    <div className="cdr-cinema-name">{showing.cinema}</div>

                    <div className="cdr-cinema-distance">
                      <MapPin size={11} weight="fill" />
                      {showing.distanceKm} km da te
                    </div>
                  </div>

                  {defaultBooking && (
                    <a
                      className="cdr-cinema-booking"
                      href={defaultBooking}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Ticket size={13} weight="fill" />
                      Biglietti
                    </a>
                  )}
                </div>

                <div className="cdr-cinema-times">
                  {showing.sessions.map((session) => (
                    <a
                      key={`${session.date}-${session.time}-${session.bookingUrl}`}
                      className="cdr-cinema-time"
                      href={session.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {session.time}
                    </a>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
