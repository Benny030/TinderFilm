'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';
import {
  MapPin, MagnifyingGlass, FilmSlate, Ticket,
  MapTrifold, List, X, CircleNotch,
} from '@phosphor-icons/react';
import type { TheSpaceCinema } from '@/utils/cinema/theSpaceCinemas';
import type { ShowtimeDay, ShowtimeFilm } from '@/pages/api/cinema/showtimes';

// ─── Leaflet solo client-side ─────────────────────────────────────────────────
const CinemaMap = dynamic(() => import('@/components/cinema/CineMap'), { ssr: false });

type NearbyCinema = TheSpaceCinema & { distanceKm: number };
type View = 'map' | 'list';
type RadiusKm = 10 | 25 | 50;

const RADIUS_OPTIONS: RadiusKm[] = [10, 25, 50];

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAYS_IT[d.getDay()]} ${d.getDate()} ${MONTHS_IT[d.getMonth()]}`;
}

export default function CinemaPage() {
  const router = useRouter();
  const { isLoading, currentUser, isGuest } = useAuth();

  // ─── Stato geo ────────────────────────────────────────────────────────────
  const [userLat, setUserLat]       = useState<number | null>(null);
  const [userLng, setUserLng]       = useState<number | null>(null);
  const [geoError, setGeoError]     = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [cityInput, setCityInput]   = useState('');
  const [showManual, setShowManual] = useState(false);

  // ─── Cinema ───────────────────────────────────────────────────────────────
  const [cinemas, setCinemas]           = useState<NearbyCinema[]>([]);
  const [loadingCinemas, setLoadingCinemas] = useState(false);
  const [radius, setRadius]             = useState<RadiusKm>(25);
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [view, setView]                 = useState<View>('map');

  // ─── Programmazione ───────────────────────────────────────────────────────
  const [showtimes, setShowtimes]         = useState<ShowtimeDay[]>([]);
  const [loadingShowtimes, setLoadingShowtimes] = useState(false);
  const [selectedDay, setSelectedDay]     = useState(0);

  // ─── Redirect se non autenticato ─────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !currentUser && !isGuest) router.replace('/auth');
  }, [isLoading, currentUser, isGuest]);

  // ─── Geolocalizzazione automatica ────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setShowManual(true); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        setGeoError('Geolocalizzazione non disponibile');
        setShowManual(true);
        setGeoLoading(false);
      },
      { timeout: 8000 }
    );
  }, []);

  // ─── Cerca cinema quando cambiano coordinate o raggio ────────────────────
  useEffect(() => {
    if (userLat === null || userLng === null) return;
    setLoadingCinemas(true);
    fetch(`/api/cinema/nearby?lat=${userLat}&lng=${userLng}&radius=${radius}`)
      .then((r) => r.json())
      .then((d) => { setCinemas(d.cinemas ?? []); setSelectedId(null); setShowtimes([]); })
      .catch(() => setCinemas([]))
      .finally(() => setLoadingCinemas(false));
  }, [userLat, userLng, radius]);

  // ─── Carica programmazione quando si seleziona un cinema ─────────────────
  useEffect(() => {
    if (!selectedId) return;
    setLoadingShowtimes(true);
    setShowtimes([]);
    setSelectedDay(0);
    fetch(`/api/cinema/showtimes?cinemaId=${selectedId}`)
      .then((r) => r.json())
      .then((d) => setShowtimes(d.days ?? []))
      .catch(() => setShowtimes([]))
      .finally(() => setLoadingShowtimes(false));
  }, [selectedId]);

  // ─── Geocoding manuale (Nominatim) ───────────────────────────────────────
const handleCitySearch = async () => {
  if (!cityInput.trim()) return;

  console.log("Cerco:", cityInput);

  setGeoLoading(true);
  setGeoError("");

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityInput + ", Italia")}&format=json&limit=1`,
      { headers: { "Accept-Language": "it" } }
    );

    const data = await res.json();

    console.log(data);

    if (!data.length) {
      setGeoError("Città non trovata");
      return;
    }

    setUserLat(parseFloat(data[0].lat));
    setUserLng(parseFloat(data[0].lon));

    console.log(data[0].lat, data[0].lon);

    setShowManual(false);
  } catch (e) {
    console.error(e);
    setGeoError("Errore ricerca città");
  } finally {
    setGeoLoading(false);
  }
};
  const selectedCinema = cinemas.find((c) => c.id === selectedId);
  const todayFilms     = showtimes[selectedDay]?.films ?? [];

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FilmSlate size={40} color={C.primary} weight="duotone" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
        .day-tab {
          padding: 8px 14px; border: none; border-radius: ${R.full};
          font-size: ${TEXT.xs}; font-weight: 600; cursor: pointer;
          font-family: ${FONT.sans}; white-space: nowrap;
          transition: all .15s;
        }
        .day-tab.active { background: ${C.primary}; color: #fff; }
        .day-tab.inactive { background: ${C.bgSoft}; color: ${C.muted}; }
        .day-tab.inactive:hover { background: ${C.border}; }
        .cinema-card {
          padding: ${S.md}; border-radius: ${R.lg};
          border: 2px solid ${C.border}; background: ${C.bg};
          cursor: pointer; transition: all .15s;
        }
        .cinema-card:hover { border-color: ${C.primary}; box-shadow: ${SHADOW.sm}; }
        .cinema-card.selected { border-color: ${C.primary}; background: ${C.primaryFaint}; }
        .session-chip {
          padding: 6px 12px; border-radius: ${R.full};
          background: ${C.bgSoft}; border: 1.5px solid ${C.border};
          font-size: ${TEXT.xs}; font-weight: 700; color: ${C.ink};
          cursor: pointer; transition: all .15s; text-decoration: none;
          display: inline-block;
        }
        .session-chip:hover { background: ${C.primary}; color: #fff; border-color: ${C.primary}; }
        .scroll-x { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .scroll-x::-webkit-scrollbar { display: none; }
      `}</style>

      <AppShell activeNav="cinema">
        <div style={{ padding: S.md, paddingBottom: '32px', maxWidth: '700px', margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: S.lg }}>
            <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={13} color={C.muted} weight="fill" /> Cinema
            </div>
            <div style={{ fontSize: TEXT.xl, fontWeight: '800', color: C.ink }}>
              Cinema vicino a te
            </div>
            <div style={{ fontSize: TEXT.sm, color: C.muted, marginTop: '2px' }}>
              The Space Cinema — programmazione settimana
            </div>
          </div>

          {/* ── Stato geolocalizzazione ── */}
          {geoLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, padding: S.md, background: C.primaryLight, borderRadius: R.md, marginBottom: S.md, fontSize: TEXT.sm, color: C.primary }}>
              <CircleNotch size={18} color={C.primary} className="spin" />
              {showManual ? 'Ricerca in corso...' : 'Rilevamento posizione...'}
            </div>
          )}

          {/* ── Input manuale città ── */}
          {showManual && !geoLoading && (
            <div style={{ marginBottom: S.lg, background: C.bgSoft, borderRadius: R.lg, padding: S.md }}>
              <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: C.ink, marginBottom: S.sm }}>
                📍 Inserisci la tua città
              </div>
              <div style={{ display: 'flex', gap: S.sm }}>
                <input
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCitySearch(); }}
                  placeholder="es. Milano, Roma, Napoli..."
                  style={{
                    flex: 1, padding: '11px 14px',
                    border: `1.5px solid ${C.border}`, borderRadius: R.md,
                    fontSize: TEXT.sm, fontFamily: FONT.sans,
                    color: C.ink, background: C.bg, outline: 'none',
                  }}
                />
                <button
                  onClick={handleCitySearch}
                  style={{
                    padding: '11px 16px', background: C.primary, color: '#fff',
                    border: 'none', borderRadius: R.md, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: TEXT.sm, fontWeight: '600', fontFamily: FONT.sans,
                  }}
                >
                  <MagnifyingGlass size={16} color="#fff" weight="bold" />
                  Cerca
                </button>
              </div>
              {geoError && (
                <div style={{ fontSize: TEXT.xs, color: C.error, marginTop: '8px' }}>⚠️ {geoError}</div>
              )}
              {userLat && (
                <div style={{ fontSize: TEXT.xs, color: C.success, marginTop: '8px' }}>
                  ✅ Posizione impostata
                </div>
              )}
            </div>
          )}

          {/* ── Posizione trovata — pulsante per cambiarla ── */}
          {userLat && !showManual && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md }}>
              <div style={{ fontSize: TEXT.xs, color: C.success, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={13} color={C.success} weight="fill" />
                Posizione rilevata automaticamente
              </div>
              <button
                onClick={() => setShowManual(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: TEXT.xs, color: C.muted, fontFamily: FONT.sans }}
              >
                Cambia →
              </button>
            </div>
          )}

          {userLat && (
            <>
              {/* ── Filtri: raggio + vista ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md, flexWrap: 'wrap', gap: S.sm }}>
                {/* Raggio */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRadius(r)}
                      className={`day-tab ${radius === r ? 'active' : 'inactive'}`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
                {/* Vista mappa / lista */}
                <div style={{ display: 'flex', gap: '4px', background: C.bgSoft, borderRadius: R.full, padding: '3px' }}>
                  <button
                    onClick={() => setView('map')}
                    style={{ padding: '6px 14px', border: 'none', borderRadius: R.full, cursor: 'pointer', background: view === 'map' ? C.primary : 'transparent', color: view === 'map' ? '#fff' : C.muted, fontSize: TEXT.xs, fontWeight: '600', fontFamily: FONT.sans, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <MapTrifold size={14} /> Mappa
                  </button>
                  <button
                    onClick={() => setView('list')}
                    style={{ padding: '6px 14px', border: 'none', borderRadius: R.full, cursor: 'pointer', background: view === 'list' ? C.primary : 'transparent', color: view === 'list' ? '#fff' : C.muted, fontSize: TEXT.xs, fontWeight: '600', fontFamily: FONT.sans, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <List size={14} /> Lista
                  </button>
                </div>
              </div>

              {/* ── Loading cinema ── */}
              {loadingCinemas && (
                <div style={{ textAlign: 'center', padding: S.xl, color: C.muted, fontSize: TEXT.sm }}>
                  <CircleNotch size={24} color={C.primary} className="spin" style={{ marginBottom: S.sm }} />
                  <div>Cerco cinema vicini...</div>
                </div>
              )}

              {/* ── Nessun cinema trovato ── */}
              {!loadingCinemas && cinemas.length === 0 && (
                <div style={{ textAlign: 'center', padding: S.xl, background: C.bgSoft, borderRadius: R.lg }}>
                  <div style={{ fontSize: '32px', marginBottom: S.sm }}>🎬</div>
                  <div style={{ fontSize: TEXT.base, fontWeight: '700', color: C.ink }}>Nessun cinema trovato</div>
                  <div style={{ fontSize: TEXT.sm, color: C.muted, marginTop: S.xs }}>
                    Prova ad aumentare il raggio di ricerca
                  </div>
                </div>
              )}

              {/* ── MAPPA ── */}
              {!loadingCinemas && cinemas.length > 0 && view === 'map' && (
                <div style={{ marginBottom: S.md }}>
                  <CinemaMap
                    cinemas={cinemas}
                    userLat={userLat!}
                    userLng={userLng!}
                    selectedId={selectedId}
                    onSelect={(id) => setSelectedId((prev) => prev === id ? null : id)}
                  />
                  {/* Lista sotto la mappa */}
                  <div style={{ marginTop: S.sm, display: 'flex', flexDirection: 'column', gap: S.sm }}>
                    {cinemas.map((c) => (
                      <div
                        key={c.id}
                        className={`cinema-card${selectedId === c.id ? ' selected' : ''}`}
                        onClick={() => setSelectedId((prev) => prev === c.id ? null : c.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: TEXT.base, fontWeight: '700', color: C.ink }}>{c.name}</div>
                            <div style={{ fontSize: TEXT.xs, color: C.muted, marginTop: '2px' }}>{c.address}</div>
                          </div>
                          <div style={{ fontSize: TEXT.xs, fontWeight: '700', color: C.primary, background: C.primaryLight, borderRadius: R.full, padding: '4px 10px', flexShrink: 0, marginLeft: S.sm }}>
                            {c.distanceKm} km
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── LISTA ── */}
              {!loadingCinemas && cinemas.length > 0 && view === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm, marginBottom: S.md }}>
                  {cinemas.map((c) => (
                    <div
                      key={c.id}
                      className={`cinema-card${selectedId === c.id ? ' selected' : ''}`}
                      onClick={() => setSelectedId((prev) => prev === c.id ? null : c.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: TEXT.base, fontWeight: '700', color: C.ink }}>{c.name}</div>
                          <div style={{ fontSize: TEXT.xs, color: C.muted, marginTop: '2px' }}>{c.address}, {c.city}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, marginLeft: S.sm }}>
                          <div style={{ fontSize: TEXT.xs, fontWeight: '700', color: C.primary, background: C.primaryLight, borderRadius: R.full, padding: '4px 10px' }}>
                            {c.distanceKm} km
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── PROGRAMMAZIONE cinema selezionato ── */}
              {selectedId && (
                <div style={{ background: C.bg, borderRadius: R.lg, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>

                  {/* Header programmazione */}
                  <div style={{ padding: S.md, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: TEXT.base, fontWeight: '800', color: C.ink }}>{selectedCinema?.name}</div>
                      <div style={{ fontSize: TEXT.xs, color: C.muted }}>Programmazione prossimi 7 giorni</div>
                    </div>
                    <button
                      onClick={() => { setSelectedId(null); setShowtimes([]); }}
                      style={{ background: C.bgSoft, border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={16} color={C.muted} />
                    </button>
                  </div>

                  {loadingShowtimes ? (
                    <div style={{ textAlign: 'center', padding: S.xl, color: C.muted }}>
                      <CircleNotch size={24} color={C.primary} className="spin" />
                      <div style={{ fontSize: TEXT.sm, marginTop: S.sm }}>Carico programmazione...</div>
                    </div>
                  ) : (
                    <>
                      {/* Selezione giorno */}
                      <div style={{ padding: `${S.sm} ${S.md}`, borderBottom: `1px solid ${C.border}` }}>
                        <div className="scroll-x">
                          {showtimes.map((day, i) => (
                            <button
                              key={day.date}
                              onClick={() => setSelectedDay(i)}
                              className={`day-tab ${selectedDay === i ? 'active' : 'inactive'}`}
                            >
                              {i === 0 ? 'Oggi' : i === 1 ? 'Domani' : formatDate(day.date)}
                              {day.films.length > 0 && (
                                <span style={{ marginLeft: '4px', opacity: 0.7 }}>({day.films.length})</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Film del giorno */}
                      <div style={{ padding: S.md, display: 'flex', flexDirection: 'column', gap: S.md }}>
                        {todayFilms.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: S.lg, color: C.muted, fontSize: TEXT.sm }}>
                            Nessuna programmazione per questo giorno
                          </div>
                        ) : (
                          todayFilms.map((film: ShowtimeFilm) => (
                            <div key={film.id} style={{ display: 'flex', gap: S.sm }}>
                              {/* Poster */}
                              {film.posterUrl ? (
                                <img src={film.posterUrl} alt={film.title} style={{ width: '56px', height: '84px', objectFit: 'cover', borderRadius: R.sm, flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: '56px', height: '84px', background: C.bgSoft, borderRadius: R.sm, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <FilmSlate size={20} color={C.faint} />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: TEXT.sm, fontWeight: '700', color: C.ink, marginBottom: '4px' }}>{film.title}</div>
                                {film.duration && (
                                  <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '8px' }}>⏱ {film.duration}</div>
                                )}
                                {/* Orari */}
                                <div className="scroll-x">
  {film.sessions.map((session) => {
    return (
      <a
        key={session.id}
        href={session.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="session-chip"
      >
        🎟️ {session.time}
        {session.format && (
          <span style={{ opacity: 0.6, marginLeft: "4px" }}>
            · {session.format}
          </span>
        )}
      </a>
    );
  })}
</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
    </>
  );
}