'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import {
  Ticket,
  MapPin,
  CircleNotch,
  FilmStrip,
} from '@phosphor-icons/react';

// ─── Palette dark "cinema elegante" ──────────────────────────────────────
const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  cardHover: '#241d19',
  border: '#2d221c',
  gold: '#f5b92f',
  goldSoft: '#ffd875',
  goldGlow: 'rgba(245,185,47,0.12)',
  pink: '#ed3d73',
  pinkDeep: '#8e1740',
  pinkGlow: 'rgba(237,61,115,0.15)',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
};

// ─── Palette light "cinema elegante" ──────────────────────────────────────
const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  cardHover: '#faf5ef',
  border: '#d6cbbc',
  gold: '#b8860b',
  goldSoft: '#e8c84a',
  goldGlow: 'rgba(184,134,11,0.10)',
  pink: '#b83060',
  pinkDeep: '#8a1d44',
  pinkGlow: 'rgba(184,48,96,0.10)',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
};

const FONT_SANS = "'Inter','Helvetica Neue',sans-serif";

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
  bookingUrl: string;
};

type Props = {
  filmTitle: string;
  tmdbTitle?: string;
};

export default function CinemaInSala({ filmTitle, tmdbTitle }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const [showings, setShowings] = useState<Showing[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [noLocation, setNoLocation] = useState(false);

  useEffect(() => {
    const check = async () => {
      setLoading(true);

      let lat: number | null = null;
      let lng: number | null = null;

      const cached = sessionStorage.getItem('cineDateUserCoords');

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          lat = parsed.lat;
          lng = parsed.lng;
        } catch {}
      }

      if (lat === null && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>(
            (resolve, reject) =>
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                { timeout: 5000 }
              )
          );

          lat = pos.coords.latitude;
          lng = pos.coords.longitude;

          sessionStorage.setItem(
            'cineDateUserCoords',
            JSON.stringify({ lat, lng })
          );
        } catch {}
      }

      if (lat === null || lng === null) {
        setNoLocation(true);
        setLoading(false);
        return;
      }

      try {
        const title = tmdbTitle ?? filmTitle;

        const res = await fetch(
          `/api/cinema/check-film?title=${encodeURIComponent(
            title
          )}&lat=${lat}&lng=${lng}&radius=50`
        );

        const data = await res.json();

        setShowings(data.showings ?? []);
      } catch {}

      setChecked(true);
      setLoading(false);
    };

    check();
  }, [filmTitle, tmdbTitle]);

  // Formatta la data: 2026-08-09 → 9 agosto
  const formatDate = (date: string) => {
    if (!date) return '';

    const parsed = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: 'long',
    }).format(parsed);
  };

  if (!loading && checked && showings.length === 0) return null;
  if (noLocation) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div
        style={{
          fontSize: '15px',
          fontWeight: '700',
          color: P.text,
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: FONT_SANS,
        }}
      >
        <FilmStrip size={18} color={P.pink} weight="fill" />
        Al cinema vicino a te
      </div>

      {loading ? (
        <div
          style={{
            padding: '16px',
            background: P.card,
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: P.textMuted,
            fontFamily: FONT_SANS,
          }}
        >
          <CircleNotch
            size={16}
            color={P.textMuted}
            style={{ animation: 'spin 1s linear infinite' }}
          />

          Controllo cinema vicini...
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {showings.map((s) => (
            <div
              key={s.cinemaId}
              style={{
                background: P.card,
                border: `1px solid ${P.border}`,
                borderRadius: 0,
                padding: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                fontFamily: FONT_SANS,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: P.text,
                    }}
                  >
                    🎬 {s.cinema}
                  </div>

                  <div
                    style={{
                      fontSize: '11px',
                      color: P.textMuted,
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <MapPin
                      size={11}
                      color={P.textMuted}
                      weight="fill"
                    />

                    {s.distanceKm} km da te
                  </div>
                </div>

                <a
                  href={s.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: P.pink,
                    color: '#fff',
                    borderRadius: 0,
                    padding: '7px 14px',
                    fontSize: '11px',
                    fontWeight: '700',
                    textDecoration: 'none',
                    fontFamily: FONT_SANS,
                    flexShrink: 0,
                  }}
                >
                  <Ticket
                    size={13}
                    color="#fff"
                    weight="fill"
                  />

                  Biglietti
                </a>
              </div>

              {s.sessions.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  {s.sessions.map((session) => (
                    <a
                      key={`${session.date}-${session.time}`}
                      href={session.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '5px 12px',
                        background: P.pinkGlow,
                        color: P.pink,
                        borderRadius: 0,
                        fontSize: '11px',
                        fontWeight: '700',
                        textDecoration: 'none',
                        fontFamily: FONT_SANS,
                        border: `1px solid ${P.pink}`,
                        transition: 'all .15s',
                      }}
                    >
                      🎟️ {session.time}
                      {session.date && ` · ${formatDate(session.date)}`}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}