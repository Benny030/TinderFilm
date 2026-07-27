'use client';

import { useState, useEffect } from 'react';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';
import { Ticket, MapPin, CircleNotch, FilmStrip } from '@phosphor-icons/react';

type Session = {
  time: string;
  bookingUrl: string;
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
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
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
          `/api/cinema/check-film?title=${encodeURIComponent(title)}&lat=${lat}&lng=${lng}&radius=50`
        );

        const data = await res.json();

        setShowings(data.showings ?? []);

      } catch {}

      setChecked(true);
      setLoading(false);
    };

    check();

  }, [filmTitle, tmdbTitle]);


  if (!loading && checked && showings.length === 0) return null;
  if (noLocation) return null;


  return (
    <div style={{ marginBottom: S.md }}>

      <div
        style={{
          fontSize: TEXT.base,
          fontWeight: '700',
          color: C.ink,
          marginBottom: S.sm,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <FilmStrip size={18} color={C.primary} weight="fill" />
        Al cinema vicino a te
      </div>


      {loading ? (

        <div
          style={{
            padding: S.md,
            background: C.bgSoft,
            borderRadius: R.md,
            display: 'flex',
            alignItems: 'center',
            gap: S.sm,
            fontSize: TEXT.sm,
            color: C.muted,
          }}
        >
          <CircleNotch
            size={16}
            color={C.muted}
            style={{ animation: 'spin 1s linear infinite' }}
          />

          Controllo cinema vicini...
        </div>

      ) : (

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: S.sm
          }}
        >

          {showings.map((s) => (

            <div
              key={s.cinemaId}
              style={{
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                borderRadius: R.lg,
                padding: S.md,
                boxShadow: SHADOW.sm,
              }}
            >

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: S.sm,
                }}
              >

                <div>

                  <div
                    style={{
                      fontSize: TEXT.sm,
                      fontWeight: '700',
                      color: C.ink
                    }}
                  >
                    🎬 {s.cinema}
                  </div>


                  <div
                    style={{
                      fontSize: TEXT.xs,
                      color: C.muted,
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <MapPin
                      size={11}
                      color={C.muted}
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
                    background: C.primary,
                    color: '#fff',
                    borderRadius: R.full,
                    padding: '7px 14px',
                    fontSize: TEXT.xs,
                    fontWeight: '700',
                    textDecoration: 'none',
                    fontFamily: FONT.sans,
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
                    flexWrap: 'wrap'
                  }}
                >

                  {s.sessions.map((session) => (

                    <a
                      key={session.time}
                      href={`https://www.thespacecinema.it${session.bookingUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '5px 12px',
                        background: C.primaryLight,
                        color: C.primary,
                        borderRadius: R.full,
                        fontSize: TEXT.xs,
                        fontWeight: '700',
                        textDecoration: 'none',
                        fontFamily: FONT.sans,
                        border: `1px solid #ffd0e0`,
                        transition: 'all .15s',
                      }}
                    >

                      🎟️ {session.time}

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