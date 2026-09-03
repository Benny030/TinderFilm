'use client';

import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
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

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";
const FONT_MONO = "'JetBrains Mono','Courier New',monospace";

const convertHexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean;

  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `${r}, ${g}, ${b}`;
};

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
  const { theme } = useTheme();
  const targetMovieId =
    typeof router.query.movie === 'string' && /^\d+$/.test(router.query.movie)
      ? Number(router.query.movie)
      : null;
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const [mounted, setMounted] = useState(false);

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
  const [movieFocusLoading, setMovieFocusLoading] = useState(false);
  const [movieFocusTitle, setMovieFocusTitle] = useState<string | null>(null);
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

  // ─── Deep-link dalla scheda film ──────────────────────────────────────────
  useEffect(() => {
    if (!router.isReady || !targetMovieId || cinemas.length === 0) {
      if (!targetMovieId) setMovieFocusTitle(null);
      return;
    }

    let cancelled = false;

    const focusMovie = async () => {
      setMovieFocusLoading(true);

      try {
        const response = await fetch(`/api/tmdb/movie/${targetMovieId}/availability`, {
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(data.error || 'Disponibilità film non caricabile');

        const availableCinemas = Array.isArray(data?.cinema?.cinemas)
          ? data.cinema.cinemas
          : [];

        const nearbyIds = new Set(cinemas.map((cinema) => Number(cinema.id)));
        const matchingNearby = availableCinemas.filter((cinema: any) =>
          nearbyIds.has(Number(cinema.id))
        );

        if (cancelled) return;

        if (matchingNearby.length === 0) {
          setMovieFocusTitle(null);
          return;
        }

        const nearestMatch = [...cinemas]
          .filter((cinema) =>
            matchingNearby.some((match: any) => Number(match.id) === Number(cinema.id))
          )
          .sort((a, b) => a.distanceKm - b.distanceKm)[0];

        if (!nearestMatch) return;

        setSelectedId(nearestMatch.id);
        setView('list');
      } catch (error) {
        console.error('Movie cinema focus failed:', error);
        if (!cancelled) setMovieFocusTitle(null);
      } finally {
        if (!cancelled) setMovieFocusLoading(false);
      }
    };

    void focusMovie();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, targetMovieId, cinemas]);

  // ─── Carica programmazione quando si seleziona un cinema ─────────────────
  useEffect(() => {
    if (!selectedId) return;
    setLoadingShowtimes(true);
    setShowtimes([]);
    setSelectedDay(0);
    fetch(`/api/cinema/showtimes?cinemaId=${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        const days = Array.isArray(d.days) ? d.days : [];
        setShowtimes(days);

        if (targetMovieId) {
          const dayIndex = days.findIndex((day: any) =>
            Array.isArray(day.films) &&
            day.films.some((film: any) => Number(film.tmdb_id) === targetMovieId)
          );

          if (dayIndex >= 0) {
            setSelectedDay(dayIndex);
            const focused = days[dayIndex].films.find(
              (film: any) => Number(film.tmdb_id) === targetMovieId
            );
            setMovieFocusTitle(focused?.title ?? 'Film selezionato');
          } else {
            setMovieFocusTitle(null);
          }
        }
      })
      .catch(() => {
        setShowtimes([]);
        if (targetMovieId) setMovieFocusTitle(null);
      })
      .finally(() => setLoadingShowtimes(false));
  }, [selectedId, targetMovieId]);

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

  // Mounted for opacity transition
  useEffect(() => {
    setMounted(true);
  }, []);

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

  const displayFilms = targetMovieId
    ? filteredFilms.filter((film: any) => Number(film.tmdb_id) === targetMovieId)
    : filteredFilms;


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

  const cinemaThemeVars: CSSProperties = {
    ['--home-bg' as any]: P.bg,
    ['--home-bg-soft' as any]: P.bgSoft,
    ['--home-card' as any]: P.card,
    ['--home-card-hover' as any]: P.cardHover,
    ['--home-border' as any]: P.border,
    ['--home-border-rgb' as any]: convertHexToRgb(P.border),
    ['--home-gold' as any]: P.gold,
    ['--home-gold-soft' as any]: P.goldSoft,
    ['--home-gold-rgb' as any]: convertHexToRgb(P.gold),
    ['--home-pink' as any]: P.pink,
    ['--home-pink-deep' as any]: P.pinkDeep,
    ['--home-pink-rgb' as any]: convertHexToRgb(P.pink),
    ['--home-text' as any]: P.text,
    ['--home-text-muted' as any]: P.textMuted,
    ['--home-text-faint' as any]: P.textFaint,
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.bg }}>
        <div className="loading-spinner">
          <FilmSlate size={40} color={P.pink} weight="duotone" />
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .loading-spinner { animation: pulse 1.4s ease-in-out infinite; }

        .cinema-page {
          --home-font: 'Inter','Helvetica Neue',sans-serif;
          --home-font-display: 'Playfair Display',Georgia,serif;
          --home-font-mono: 'JetBrains Mono','Courier New',monospace;
          font-family: var(--home-font);
          background: var(--home-bg);
          color: var(--home-text);
          min-height: 100%;
          letter-spacing: -0.01em;
        }

        .cinema-page *,
        .cinema-page *::before,
        .cinema-page *::after {
          box-sizing: border-box;
        }

        .cinema-page button,
        .cinema-page input {
          border-radius: 0 !important;
          font-family: var(--home-font);
        }

        .cinema-page ::selection {
          background: var(--home-pink);
          color: #fff;
        }

        /* Layout principale */
        .cinema-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 32px;
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 20px;
          align-items: start;
        }
        @media (max-width: 1023px) {
          .cinema-layout {
            grid-template-columns: 1fr;
            gap: 20px;
            padding: 16px;
          }
          .cinema-sidebar {
            display: none;
          }
        }

        /* Header */
        .cinema-header-title {
          font-family: var(--home-font-display);
          font-size: 32px;
          font-weight: 800;
          color: var(--home-text);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }

        /* Card generica */
        .cinema-card {
          background: var(--home-card);
          border: 1px solid var(--home-border);
          padding: 16px;
          cursor: pointer;
          transition: border-color 0.25s, transform 0.2s;
          position: relative;
        }
        .cinema-card:hover {
          border-color: rgba(var(--home-gold-rgb), 0.38);
          transform: translateY(-2px);
        }
        .cinema-card.selected {
          border-color: var(--home-gold);
          box-shadow: 0 0 0 1px var(--home-gold) inset;
        }

        /* Day nav */
        .day-nav-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 2px 2px 6px;
          scrollbar-width: none;
        }
        .day-nav-scroll::-webkit-scrollbar { display: none; }
        .day-nav-card {
          flex-shrink: 0;
          min-width: 72px;
          padding: 12px 8px;
          border: 1.5px solid var(--home-border);
          background: var(--home-card);
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          gap: 2px;
          align-items: center;
          border-radius: 0;
          font-family: var(--home-font);
        }
        .day-nav-card:hover { border-color: var(--home-gold); }
        .day-nav-card.active {
          border-color: var(--home-gold);
          background: var(--home-card);
          box-shadow: 0 0 0 1px var(--home-gold) inset;
        }
        .day-nav-top { font-size: 13px; font-weight: 700; color: var(--home-text-muted); }
        .day-nav-card.active .day-nav-top { color: var(--home-text); }
        .day-nav-bottom { font-size: 11px; color: var(--home-text-faint); }
        .day-nav-card.active .day-nav-bottom { color: var(--home-text-muted); }
        .day-nav-count { font-size: 10px; color: var(--home-text-faint); margin-top: 1px; }
        .day-nav-card.active .day-nav-count { color: var(--home-text-muted); }

        /* Filter bar */
        .filter-scroll {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }
        .filter-scroll::-webkit-scrollbar { display: none; }
        .filter-chip {
          flex-shrink: 0;
          padding: 6px 14px;
          border: 1.5px solid var(--home-border);
          background: var(--home-card);
          font-size: 11px;
          font-weight: 600;
          color: var(--home-text-muted);
          font-family: var(--home-font);
          white-space: nowrap;
          transition: all 0.15s;
          cursor: pointer;
          border-radius: 0;
        }
        .filter-chip:hover { border-color: var(--home-text-muted); }

        /* Film row */
        .film-row {
          display: flex;
          gap: 16px;
          padding: 16px 0;
          border-bottom: 1px solid var(--home-border);
        }
        .film-row:last-child { border-bottom: none; }
        .film-poster {
          width: 72px;
          height: 100px;
          border-radius: 0;
          object-fit: cover;
          flex-shrink: 0;
          background: var(--home-card);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        /* Sessions grid */
        .sessions-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .session-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 12px;
          border: none;
          background: var(--home-gold);
          cursor: pointer;
          text-decoration: none;
          transition: all 0.15s;
          flex: 0 0 96px;      /* larghezza fissa */
          width: 96px;         /* larghezza fissa */
          min-width: 96px;     /* sicurezza */
          max-width: 96px;     /* sicurezza */
          border-radius: 0;
        }
        .session-btn:hover { background: var(--home-gold-soft); transform: translateY(-1px); }
        .session-time {
          font-size: 14px;
          font-weight: 800;
          color: var(--home-bg);
          font-family: var(--home-font);
          letter-spacing: 0.2px;
          font-variant-numeric: tabular-nums;
        }
        .session-tag {
          font-size: 10px;
          color: rgba(0,0,0,0.7);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          opacity: 0.7;
        }
        .session-btn.expand-btn {
          background: transparent;
          border: 1px solid var(--home-border);
          color: var(--home-text-muted);
        }
        .session-btn.expand-btn:hover {
          background: var(--home-card-hover);
          border-color: var(--home-gold);
          color: var(--home-gold);
        }

        /* Radius tabs */
        .day-tab {
          padding: 6px 16px;
          border: 1px solid var(--home-border);
          border-radius: 0;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--home-font);
          white-space: nowrap;
          transition: all 0.15s;
          background: transparent;
          color: var(--home-text-muted);
        }
        .day-tab:hover { border-color: var(--home-text-muted); color: var(--home-text); }
        .day-tab.active {
          background: var(--home-pink);
          border-color: var(--home-pink);
          color: #fff;
          box-shadow: 0 4px 14px rgba(var(--home-pink-rgb), 0.3);
        }

        /* Ticket card (sidebar) */
        .ticket-card {
          background: var(--home-card);
          border: 1px solid var(--home-border);
          position: relative;
          transition: transform 0.25s cubic-bezier(0.2,0,0,1), box-shadow 0.3s ease;
          cursor: pointer;
          overflow: hidden;
          padding: 20px;
        }
        .ticket-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid transparent;
          transition: border-color 0.3s ease;
          pointer-events: none;
        }
        .ticket-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .ticket-card:hover::after {
          border-color: rgba(var(--home-gold-rgb), 0.38);
        }
        .ticket-tear {
          position: absolute;
          left: 50%;
          bottom: -1px;
          transform: translateX(-50%);
          width: 16px;
          height: 6px;
          background: var(--home-bg);
          border-radius: 50% 50% 0 0;
          border-left: 1px solid var(--home-border);
          border-right: 1px solid var(--home-border);
          border-top: 1px solid var(--home-border);
          opacity: 0.6;
        }

        .sidebar-title {
          font-size: 18px;
          font-weight: 800;
          font-family: var(--home-font-display);
          color: var(--home-text);
          margin-bottom: 8px;
          letter-spacing: -0.01em;
        }
        .sidebar-text {
          font-size: 13px;
          color: var(--home-text-muted);
          line-height: 1.5;
        }
        .sidebar-button {
          margin-top: 16px;
          padding: 10px 20px;
          background: var(--home-gold);
          color: var(--home-bg);
          border: none;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          font-family: var(--home-font);
          transition: background 0.25s, transform 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .sidebar-button:hover {
          background: var(--home-gold-soft);
          transform: scale(1.02);
        }
        .sidebar-button-outline {
          margin-top: 16px;
          padding: 10px 20px;
          background: transparent;
          color: var(--home-gold);
          border: 1px solid var(--home-gold);
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          font-family: var(--home-font);
          transition: background 0.25s, color 0.25s;
        }
        .sidebar-button-outline:hover {
          background: var(--home-gold);
          color: var(--home-bg);
        }
      `}</style>

      <AppShell activeNav="cinema">
        <div className="cinema-page" style={{ ...cinemaThemeVars, opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}>
          <div className="cinema-layout">
            {/* ─── COLONNA CENTRALE ── */}
            <div style={{ minWidth: 0 }}>
              {/* Header */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', color: P.textFaint, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  <MapPin size={13} color={P.gold} weight="fill" /> Cinema
                </div>
                <div className="cinema-header-title">
                  Cosa c'è al cinema?
                </div>
                <div style={{ fontSize: '15px', color: P.textMuted, marginTop: '4px', lineHeight: 1.5 }}>
                  Trova i cinema vicini, scegli il giorno e controlla subito film, orari e biglietti.
                </div>
              </div>

              {/* Stato geolocalizzazione */}
              {geoLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', background: P.card, border: `1px solid ${P.border}`, marginBottom: '16px', fontSize: '13px', color: P.gold }}>
                  <CircleNotch size={18} color={P.gold} className="spin" />
                  {showManual ? 'Ricerca in corso...' : 'Rilevamento posizione...'}
                </div>
              )}

              {/* Input manuale città */}
              {showManual && !geoLoading && (
                <div style={{ marginBottom: '24px', background: P.card, border: `1px solid ${P.border}`, padding: '20px', position: 'relative' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: P.text, marginBottom: '8px' }}>
                    📍 Inserisci la tua città
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCitySearch(); }}
                      placeholder="es. Milano, Roma, Napoli..."
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: `1.5px solid ${P.border}`,
                        fontSize: '14px',
                        fontFamily: FONT,
                        color: P.text,
                        background: P.bgSoft,
                        outline: 'none',
                        borderRadius: 0,
                      }}
                    />
                    <button
                      onClick={handleCitySearch}
                      style={{
                        padding: '12px 20px',
                        background: P.pink,
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        fontFamily: FONT,
                        borderRadius: 0,
                      }}
                    >
                      <MagnifyingGlass size={16} color="#fff" weight="bold" />
                      Cerca
                    </button>
                  </div>
                  {geoError && (
                    <div style={{ fontSize: '12px', color: P.pink, marginTop: '8px' }}>⚠️ {geoError}</div>
                  )}
                  {userLat && (
                    <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '8px' }}>
                      ✅ Posizione impostata
                    </div>
                  )}
                  <div className="ticket-tear" style={{ background: P.bg }} />
                </div>
              )}

              {/* Posizione trovata */}
              {userLat && !showManual && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} color="#22c55e" weight="fill" />
                    Posizione rilevata automaticamente
                  </div>
                  <button
                    onClick={() => setShowManual(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: P.textMuted, fontFamily: FONT, textDecoration: 'underline' }}
                  >
                    Cambia
                  </button>
                </div>
              )}

              {userLat && !loadingCinemas && cinemas.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 8,
                    marginBottom: 18,
                  }}
                >
                  <div style={{ border: `1px solid ${P.border}`, background: P.card, padding: 14 }}>
                    <div style={{ color: P.textFaint, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                      Vicino a te
                    </div>
                    <div style={{ color: P.text, fontSize: 20, fontWeight: 900, marginTop: 4 }}>
                      {cinemas.length} cinema
                    </div>
                    <div style={{ color: P.textMuted, fontSize: 10, marginTop: 3 }}>
                      entro {radius} km
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const closest = [...cinemas].sort((a, b) => a.distanceKm - b.distanceKm)[0];
                      if (closest) {
                        setSelectedId(closest.id);
                        setView('list');
                      }
                    }}
                    style={{
                      border: `1px solid ${P.gold}`,
                      background: P.goldGlow,
                      color: P.text,
                      padding: 14,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    <div style={{ color: P.gold, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                      Più vicino
                    </div>
                    <div style={{ color: P.text, fontSize: 13, fontWeight: 900, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[...cinemas].sort((a, b) => a.distanceKm - b.distanceKm)[0]?.name}
                    </div>
                    <div style={{ color: P.textMuted, fontSize: 10, marginTop: 3 }}>
                      {[...cinemas].sort((a, b) => a.distanceKm - b.distanceKm)[0]?.distanceKm} km · Vedi programmazione
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push('/esplora?tab=now_playing')}
                    style={{
                      border: `1px solid ${P.pink}70`,
                      background: P.pinkGlow,
                      color: P.text,
                      padding: 14,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    <div style={{ color: P.pink, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                      Film
                    </div>
                    <div style={{ color: P.text, fontSize: 13, fontWeight: 900, marginTop: 4 }}>
                      Ora al cinema
                    </div>
                    <div style={{ color: P.textMuted, fontSize: 10, marginTop: 3 }}>
                      Sfoglia le uscite attuali
                    </div>
                  </button>
                </div>
              )}

              {userLat && (
                <>
                  {/* Filtri: raggio + vista */}
                  <div style={{ fontSize: 10, color: P.textFaint, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
                    Scegli distanza e vista
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {RADIUS_OPTIONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setRadius(r)}
                          className={`day-tab ${radius === r ? 'active' : ''}`}
                        >
                          {r} km
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', background: P.card, padding: '4px', border: `1px solid ${P.border}` }}>
                      <button
                        onClick={() => setView('map')}
                        style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', background: view === 'map' ? P.gold : 'transparent', color: view === 'map' ? P.bg : P.textMuted, fontSize: '13px', fontWeight: '600', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s', borderRadius: 0 }}
                      >
                        <MapTrifold size={16} weight={view === 'map' ? 'fill' : 'regular'} /> Mappa
                      </button>
                      <button
                        onClick={() => setView('list')}
                        style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', background: view === 'list' ? P.gold : 'transparent', color: view === 'list' ? P.bg : P.textMuted, fontSize: '13px', fontWeight: '600', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s', borderRadius: 0 }}
                      >
                        <List size={16} weight={view === 'list' ? 'fill' : 'regular'} /> Lista
                      </button>
                    </div>
                  </div>

                  {/* Loading cinema */}
                  {loadingCinemas && (
                    <div style={{ textAlign: 'center', padding: '32px', color: P.textMuted, fontSize: '13px' }}>
                      <CircleNotch size={24} color={P.gold} className="spin" style={{ marginBottom: '8px' }} />
                      <div>Cerco cinema vicini...</div>
                    </div>
                  )}

                  {/* Nessun cinema trovato */}
                  {!loadingCinemas && cinemas.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', background: P.card, border: `1px solid ${P.border}`, position: 'relative' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎬</div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: P.text }}>Nessun cinema trovato</div>
                      <div style={{ fontSize: '13px', color: P.textMuted, marginTop: '4px' }}>
                        Prova ad aumentare il raggio di ricerca
                      </div>
                      <div className="ticket-tear" style={{ background: P.bg }} />
                    </div>
                  )}

                  {/* MAPPA */}
                  {!loadingCinemas && cinemas.length > 0 && view === 'map' && (
                    <div style={{ marginBottom: '24px' }}>
                      <div>
                        <CinemaMap
                          cinemas={cinemas}
                          userLat={userLat!}
                          userLng={userLng!}
                          selectedId={selectedId}
                          onSelect={(id) => setSelectedId((prev) => prev === id ? null : id)}
                        />
                      </div>
                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {cinemas.map((c) => (
                          <div
                            key={c.id}
                            className={`cinema-card${selectedId === c.id ? ' selected' : ''}`}
                            onClick={() => setSelectedId((prev) => prev === c.id ? null : c.id)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontSize: '15px', fontWeight: '700', color: P.text }}>{c.name}</div>
                                <div style={{ fontSize: '12px', color: P.textFaint, marginTop: '2px' }}>{c.address}</div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: P.gold }}>
                                  {c.distanceKm} km
                                </div>
                                <div style={{ fontSize: '9px', color: P.textFaint, marginTop: 3 }}>
                                  Vedi orari
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LISTA */}
                  {!loadingCinemas && cinemas.length > 0 && view === 'list' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                      {cinemas.map((c) => (
                        <div
                          key={c.id}
                          className={`cinema-card${selectedId === c.id ? ' selected' : ''}`}
                          onClick={() => setSelectedId((prev) => prev === c.id ? null : c.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: '15px', fontWeight: '700', color: P.text }}>{c.name}</div>
                              <div style={{ fontSize: '12px', color: P.textFaint, marginTop: '2px' }}>{c.address}, {c.city}</div>
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: P.gold, flexShrink: 0, marginLeft: '8px' }}>
                              {c.distanceKm} km
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PROGRAMMAZIONE cinema selezionato */}
                  {selectedId && (
                    <div style={{ background: P.card, border: `1.5px solid ${P.gold}`, overflow: 'hidden', position: 'relative' }}>
                      {/* Header programmazione */}
                      <div style={{ padding: '20px', borderBottom: `1px solid ${P.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: '800', color: P.text, fontFamily: FONT_DISPLAY }}>{selectedCinema?.name}</div>
                          <div style={{ fontSize: '12px', color: P.textMuted, marginTop: '4px' }}>Scegli il giorno e poi l'orario</div>
                        </div>
                        <button
                          onClick={() => { setSelectedId(null); setShowtimes([]); }}
                          style={{ background: P.cardHover, border: 'none', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: P.textMuted }}
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {loadingShowtimes ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: P.textMuted }}>
                          <CircleNotch size={24} color={P.gold} className="spin" />
                          <div style={{ fontSize: '13px', marginTop: '12px' }}>Carico programmazione...</div>
                        </div>
                      ) : (
                        <>
                          {targetMovieId && (
                            <div style={{ padding: '16px 20px 0' }}>
                              <div style={{
                                border: `1px solid ${movieFocusTitle ? P.gold : P.border}`,
                                background: movieFocusTitle ? P.goldGlow : P.bgSoft,
                                padding: '12px 13px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{
                                    color: movieFocusTitle ? P.gold : P.textFaint,
                                    fontSize: 9,
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    letterSpacing: '.1em',
                                  }}>
                                    {movieFocusLoading ? 'Sto cercando…' : 'Film selezionato'}
                                  </div>
                                  <div style={{
                                    color: P.text,
                                    fontSize: 13,
                                    fontWeight: 900,
                                    marginTop: 3,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}>
                                    {movieFocusTitle ?? 'Nessuna proiezione vicina trovata'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => router.replace('/cinema', undefined, { shallow: true })}
                                  style={{
                                    border: 0,
                                    background: 'transparent',
                                    color: P.textMuted,
                                    fontFamily: FONT,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                  }}
                                >
                                  Mostra tutti
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Navigazione date */}
                          <div style={{ padding: '20px 20px 12px' }}>
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
                                      {day.films.length} film
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Filtri formato/lingua */}
                          {dayFormatTags.length > 0 && (
                            <div style={{ padding: '0 20px 12px' }}>
                              <div className="filter-scroll">
                                <button
                                  type="button"
                                  onClick={() => { setActiveFormatFilter('Tutti'); setExpandedFilms({}); }}
                                  className="filter-chip"
                                  style={{
                                    background: activeFormatFilter === 'Tutti' ? P.cardHover : P.card,
                                    color: activeFormatFilter === 'Tutti' ? P.text : P.textMuted,
                                    borderColor: activeFormatFilter === 'Tutti' ? P.gold : P.border,
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
                                      background: activeFormatFilter === tag ? P.cardHover : P.card,
                                      color: activeFormatFilter === tag ? P.text : P.textMuted,
                                      borderColor: activeFormatFilter === tag ? P.gold : P.border,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Film del giorno */}
                          <div style={{ padding: '0 20px 20px' }}>
                            {displayFilms.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '24px', color: P.textMuted, fontSize: '13px' }}>
                                {targetMovieId
                                  ? 'Nessuna proiezione di questo film per il giorno selezionato'
                                  : 'Nessuna programmazione per questo giorno'}
                              </div>
                            ) : (
                              displayFilms.map((film: ShowtimeFilm) => (
                                <div key={film.id} className="film-row">
                                  {film.posterUrl ? (
                                    <img src={film.posterUrl} alt={film.title} className="film-poster" />
                                  ) : (
                                    <div className="film-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.card }}>
                                      <FilmSlate size={24} color={P.textFaint} />
                                    </div>
                                  )}

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: P.text, lineHeight: 1.25, marginBottom: '4px' }}>
                                      {film.title}
                                    </div>
                                    {film.duration && (
                                      <div style={{
                                        fontSize: '12px', color: P.textMuted, marginBottom: '12px',
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                      }}>
                                        <Clock size={12} color={P.textMuted} />
                                        {film.duration}
                                      </div>
                                    )}

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
                                          className="session-btn expand-btn"
                                          aria-expanded={!!expandedFilms[String(film.id)]}
                                        >
                                          <span className="session-time" style={{ fontSize: '12px', color: 'inherit' }}>
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

                          {/* Nota selezione */}
                          {filteredFilms.length > 0 && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '8px 20px 20px',
                              fontSize: '12px', color: P.textMuted,
                            }}>
                              <Sparkle size={14} color={P.gold} weight="fill" />
                              Seleziona un orario per proseguire con la prenotazione
                            </div>
                          )}
                        </>
                      )}
                      <div className="ticket-tear" style={{ background: P.bg }} />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ─── SIDEBAR DESTRA ── */}
            <div className="cinema-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="ticket-card">
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>🍿</div>
                <div className="sidebar-title">Il cinema è meglio insieme</div>
                <div className="sidebar-text">
                  Crea una stanza, invita i tuoi amici e inizia subito a guardare insieme.
                </div>
                <button className="sidebar-button" onClick={() => router.push('/crea-stanza?tab=create')}>
                  Crea una stanza →
                </button>
                <div className="ticket-tear" style={{ background: P.bg }} />
              </div>

            </div>
          </div>
        </div>
      </AppShell>
    </>
  );
}