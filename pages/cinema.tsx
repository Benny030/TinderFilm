'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';
import {
  MapPin, MagnifyingGlass, FilmSlate, Ticket,
  MapTrifold, List, X, CircleNotch, Clock, Sparkle,
} from '@phosphor-icons/react';
import type { TheSpaceCinema } from '@/utils/cinema/theSpaceCinemasFIX';
import type { ShowtimeDay, ShowtimeFilm } from '@/types/index';

// ─── Leaflet solo client-side ─────────────────────────────────────────────────
const CinemaMap = dynamic(() => import('@/components/cinema/CineMap'), { ssr: false });

type NearbyCinema = TheSpaceCinema & { distanceKm: number };
type View = 'map' | 'list';
type RadiusKm = 10 | 25 | 50;

const RADIUS_OPTIONS: RadiusKm[] = [10, 25, 50];

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const SESSIONS_COLLAPSED_LIMIT = 3;

function formatDayLabel(dateStr: string, index: number): { top: string; bottom: string } {
  const d = new Date(dateStr);
  if (index === 0) return { top: 'Oggi', bottom: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}` };
  if (index === 1) return { top: 'Domani', bottom: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}` };
  return { top: DAYS_IT[d.getDay()], bottom: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}` };
}

// ─── Estrae i tag (Laser, 2D, 3D, ITA, OV...) dal campo format libero della sessione ──
function parseSessionTags(format: string | null): string[] {
  if (!format) return [];
  return format.split(',').map((t) => t.trim()).filter(Boolean);
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
  const [activeFormatFilter, setActiveFormatFilter] = useState('Tutti');
  const [expandedFilms, setExpandedFilms] = useState<Record<string, boolean>>({});

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

    setGeoLoading(true);
    setGeoError("");

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityInput + ", Italia")}&format=json&limit=1`,
        { headers: { "Accept-Language": "it" } }
      );

      const data = await res.json();

      if (!data.length) {
        setGeoError("Città non trovata");
        return;
      }

      setUserLat(parseFloat(data[0].lat));
      setUserLng(parseFloat(data[0].lon));
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

  const filteredFilms = todayFilms
    .map((film) => ({
      ...film,
      sessions: activeFormatFilter === 'Tutti'
        ? film.sessions
        : film.sessions.filter((session) =>
            parseSessionTags(session.format).some((tag) =>
              tag.toLowerCase().includes(activeFormatFilter.toLowerCase())
            )
          ),
    }))
    .filter((film) => film.sessions.length > 0);

  const toggleFilmExpanded = (filmId: string | number) => {
    const key = String(filmId);
    setExpandedFilms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Set di tutti i tag formato/lingua presenti nel giorno selezionato (solo visivo) ──
  const dayFormatTags = Array.from(
    new Set(
      todayFilms.flatMap((f) => f.sessions.flatMap((s) => parseSessionTags(s.format)))
    )
  ).slice(0, 6);

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

        /* ── Day nav ── */
        .day-nav-scroll {
          display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 6px;
          scrollbar-width: none;
        }
        .day-nav-scroll::-webkit-scrollbar { display: none; }
        .day-nav-card {
          flex-shrink: 0; min-width: 68px;
          padding: 10px 6px; border-radius: ${R.md};
          border: 1.5px solid ${C.border}; background: ${C.bg};
          cursor: pointer; text-align: center;
          transition: all .15s;
          display: flex; flex-direction: column; gap: 2px; align-items: center;
        }
        .day-nav-card:hover { border-color: ${C.primary}; }
        .day-nav-card.active {
          background: ${C.primary}; border-color: ${C.primary};
          box-shadow: 0 4px 14px rgba(232,56,109,.28);
        }
        .day-nav-top { font-size: ${TEXT.sm}; font-weight: 700; color: ${C.ink}; }
        .day-nav-card.active .day-nav-top { color: #fff; }
        .day-nav-bottom { font-size: ${TEXT.xs}; color: ${C.muted}; }
        .day-nav-card.active .day-nav-bottom { color: rgba(255,255,255,0.85); }
        .day-nav-count { font-size: 10px; color: ${C.faint}; margin-top: 1px; }
        .day-nav-card.active .day-nav-count { color: rgba(255,255,255,0.7); }

        /* ── Filter bar ── */
        .filter-scroll {
          display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px;
          scrollbar-width: none;
        }
        .filter-scroll::-webkit-scrollbar { display: none; }
        .filter-chip {
          flex-shrink: 0; padding: 6px 13px; border-radius: ${R.full};
          border: 1.5px solid ${C.border}; background: ${C.bg};
          font-size: ${TEXT.xs}; font-weight: 600; color: ${C.muted};
          font-family: ${FONT.sans}; white-space: nowrap;
        }

        /* ── Film row ── */
        .film-row {
          display: flex; gap: ${S.md};
          padding: ${S.md} 0;
          border-bottom: 1px solid ${C.borderSoft};
        }
        .film-row:last-child { border-bottom: none; }
        .film-poster {
          width: 64px; height: 92px; border-radius: ${R.sm};
          object-fit: cover; flex-shrink: 0; background: ${C.bgSoft};
          box-shadow: ${SHADOW.sm};
        }

        /* ── Sessions grid ── */
        .sessions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
          gap: 8px;
        }
        .session-btn {
          display: flex; flex-direction: column; align-items: center;
          gap: 2px; padding: 8px 6px;
          border-radius: ${R.sm}; border: 1.5px solid ${C.border};
          background: ${C.bg}; cursor: pointer; text-decoration: none;
          transition: all .12s;
        }
        .session-btn:hover {
          border-color: ${C.primary}; background: ${C.primaryFaint};
          transform: translateY(-1px);
        }
        .session-time {
          font-size: ${TEXT.sm}; font-weight: 800; color: ${C.ink};
          font-family: ${FONT.sans}; letter-spacing: 0.2px;
        }
        .session-btn:hover .session-time { color: ${C.primary}; }
        .session-tag {
          font-size: 10px; color: ${C.faint}; font-weight: 500;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
        }

        .cinema-card {
          padding: ${S.md}; border-radius: ${R.lg};
          border: 1.5px solid ${C.border}; background: ${C.bg};
          cursor: pointer; transition: all .15s;
        }
        .cinema-card:hover { border-color: ${C.primary}; box-shadow: ${SHADOW.sm}; }
        .cinema-card.selected { border-color: ${C.primary}; background: ${C.primaryFaint}; }

        .day-tab {
          padding: 8px 14px; border: none; border-radius: ${R.full};
          font-size: ${TEXT.xs}; font-weight: 600; cursor: pointer;
          font-family: ${FONT.sans}; white-space: nowrap;
          transition: all .15s;
        }
        .day-tab.active { background: ${C.primary}; color: #fff; }
        .day-tab.inactive { background: ${C.bgSoft}; color: ${C.muted}; }
        .day-tab.inactive:hover { background: ${C.border}; }
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
                  <div style={{ padding: S.md, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: TEXT.base, fontWeight: '800', color: C.ink }}>{selectedCinema?.name}</div>
                      <div style={{ fontSize: TEXT.xs, color: C.muted, marginTop: '2px' }}>Programmazione prossimi 7 giorni</div>
                    </div>
                    <button
                      onClick={() => { setSelectedId(null); setShowtimes([]); }}
                      style={{ background: C.bgSoft, border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
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
                      {/* ── Navigazione date — card moderne con giorno + data ── */}
                      <div style={{ padding: `${S.md} ${S.md} ${S.sm}` }}>
                        <div className="day-nav-scroll">
                          {showtimes.map((day, i) => {
                            const label = formatDayLabel(day.date, i);
                            const isActive = selectedDay === i;
                            return (
                              <button
                                key={day.date}
                                onClick={() => { setSelectedDay(i); setActiveFormatFilter('Tutti'); setExpandedFilms({}); }}
                                className={`day-nav-card${isActive ? ' active' : ''}`}
                              >
                                <span className="day-nav-top">{label.top}</span>
                                <span className="day-nav-bottom">{label.bottom}</span>
                                <span className="day-nav-count">
                                  {day.films.length} {day.films.length === 1 ? 'film' : 'film'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── Barra filtri formato/lingua (riepilogo visivo del giorno) ── */}
                      {dayFormatTags.length > 0 && (
                        <div style={{ padding: `0 ${S.md} ${S.sm}` }}>
                          <div className="filter-scroll">
                            <button
                              type="button"
                              onClick={() => { setActiveFormatFilter('Tutti'); setExpandedFilms({}); }}
                              className="filter-chip"
                              style={{
                                background: activeFormatFilter === 'Tutti' ? C.ink : C.bg,
                                color: activeFormatFilter === 'Tutti' ? '#fff' : C.muted,
                                borderColor: activeFormatFilter === 'Tutti' ? C.ink : C.border,
                                cursor: 'pointer',
                              }}
                            >
                              Tutti
                            </button>
                            {dayFormatTags.map((tag) => (
                              <button
                                type="button"
                                key={tag}
                                onClick={() => { setActiveFormatFilter(tag); setExpandedFilms({}); }}
                                className="filter-chip"
                                style={{
                                  background: activeFormatFilter === tag ? C.ink : C.bg,
                                  color: activeFormatFilter === tag ? '#fff' : C.muted,
                                  borderColor: activeFormatFilter === tag ? C.ink : C.border,
                                  cursor: 'pointer',
                                }}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Film del giorno ── */}
                      <div style={{ padding: `0 ${S.md} ${S.md}` }}>
                        {filteredFilms.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: S.lg, color: C.muted, fontSize: TEXT.sm }}>
                            Nessuna programmazione per questo giorno
                          </div>
                        ) : (
                          filteredFilms.map((film: ShowtimeFilm) => (
                            <div key={film.id} className="film-row">
                              {/* Poster */}
                              {film.posterUrl ? (
                                <img src={film.posterUrl} alt={film.title} className="film-poster" />
                              ) : (
                                <div className="film-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <FilmSlate size={22} color={C.faint} />
                                </div>
                              )}

                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Titolo + durata: gerarchia forte */}
                                <div style={{ fontSize: TEXT.base, fontWeight: '800', color: C.ink, lineHeight: 1.25, marginBottom: '4px' }}>
                                  {film.title}
                                </div>
                                {film.duration && (
                                  <div style={{
                                    fontSize: TEXT.xs, color: C.muted, marginBottom: S.sm,
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                  }}>
                                    <Clock size={11} color={C.muted} />
                                    {film.duration}
                                  </div>
                                )}

                                {/* Orari — elemento principale, griglia cliccabile */}
                                <div className="sessions-grid">
                                  {(expandedFilms[String(film.id)] ? film.sessions : film.sessions.slice(0, SESSIONS_COLLAPSED_LIMIT)).map((session) => {
                                    const tags = parseSessionTags(session.format);
                                    return (
                                      <a
                                        key={session.id || `${film.id}-${session.time}`}
                                        href={session.bookingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="session-btn"
                                      >
                                        <span className="session-time">{session.time}</span>
                                        {tags.length > 0 && (
                                          <span className="session-tag">{tags.join(' · ')}</span>
                                        )}
                                      </a>
                                    );
                                  })}
                                  {film.sessions.length > SESSIONS_COLLAPSED_LIMIT && (
                                    <button
                                      type="button"
                                      onClick={() => toggleFilmExpanded(film.id)}
                                      className="session-btn"
                                      aria-expanded={!!expandedFilms[String(film.id)]}
                                      style={{ color: C.primary, fontFamily: FONT.sans }}
                                    >
                                      <span className="session-time" style={{ color: C.primary, fontSize: TEXT.xs }}>
                                        {expandedFilms[String(film.id)] ? 'Meno ↑' : 'Altro ↓'}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* ── Nota selezione (coerente con riferimento visivo) ── */}
                      {filteredFilms.length > 0 && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: `${S.sm} ${S.md} ${S.md}`,
                          fontSize: TEXT.xs, color: C.muted,
                        }}>
                          <Sparkle size={13} color={C.primary} weight="fill" />
                          Seleziona un orario per proseguire con la prenotazione
                        </div>
                      )}
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
