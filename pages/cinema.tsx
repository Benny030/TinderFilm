'use client';

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  CircleNotch,
  Clock,
  FilmSlate,
  List,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  Sparkle,
  Ticket,
  X,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import BackButton from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';
import type { TheSpaceCinema } from '@/utils/cinema/theSpaceCinemasFIX';
import type { ShowtimeDay, ShowtimeFilm } from '@/types/index';

const CinemaMap = dynamic(
  () => import('@/components/cinema/CineMap'),
  { ssr: false }
);

type NearbyCinema = TheSpaceCinema & { distanceKm: number };
type View = 'map' | 'list';
type RadiusKm = 10 | 25 | 50;

const RADIUS_OPTIONS: RadiusKm[] = [10, 25, 50];
const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS_IT = [
  'gen',
  'feb',
  'mar',
  'apr',
  'mag',
  'giu',
  'lug',
  'ago',
  'set',
  'ott',
  'nov',
  'dic',
];

const SESSIONS_COLLAPSED_LIMIT = 4;

function formatDayLabel(
  dateStr: string,
  index: number
): { top: string; bottom: string } {
  const d = new Date(dateStr);

  if (index === 0) {
    return {
      top: 'Oggi',
      bottom: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`,
    };
  }

  if (index === 1) {
    return {
      top: 'Domani',
      bottom: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`,
    };
  }

  return {
    top: DAYS_IT[d.getDay()],
    bottom: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`,
  };
}

function parseSessionTags(format: string | null): string[] {
  if (!format) return [];

  return format
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function CinemaPage() {
  const router = useRouter();
  const { isLoading, currentUser, isGuest } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? THEME.dark : THEME.light;

  const targetMovieId =
    typeof router.query.movie === 'string' &&
    /^\d+$/.test(router.query.movie)
      ? Number(router.query.movie)
      : null;

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [showManual, setShowManual] = useState(false);

  const [cinemas, setCinemas] = useState<NearbyCinema[]>([]);
  const [loadingCinemas, setLoadingCinemas] = useState(false);
  const [radius, setRadius] = useState<RadiusKm>(25);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<View>('map');

  const [showtimes, setShowtimes] = useState<ShowtimeDay[]>([]);
  const [loadingShowtimes, setLoadingShowtimes] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [movieFocusLoading, setMovieFocusLoading] = useState(false);
  const [movieFocusTitle, setMovieFocusTitle] = useState<string | null>(
    null
  );
  const [activeFormatFilter, setActiveFormatFilter] =
    useState('Tutti');
  const [expandedFilms, setExpandedFilms] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (!isLoading && !currentUser && !isGuest) {
      void router.replace('/auth');
    }
  }, [isLoading, currentUser, isGuest, router]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setShowManual(true);
      return;
    }

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLat(position.coords.latitude);
        setUserLng(position.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        setGeoError('Geolocalizzazione non disponibile.');
        setShowManual(true);
        setGeoLoading(false);
      },
      { timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (userLat === null || userLng === null) return;

    let cancelled = false;

    const loadNearby = async () => {
      setLoadingCinemas(true);

      try {
        const response = await fetch(
          `/api/cinema/nearby?lat=${userLat}&lng=${userLng}&radius=${radius}`
        );
        const data = await response.json();

        if (cancelled) return;

        setCinemas(
          Array.isArray(data.cinemas) ? data.cinemas : []
        );
        setSelectedId(null);
        setShowtimes([]);
      } catch {
        if (!cancelled) setCinemas([]);
      } finally {
        if (!cancelled) setLoadingCinemas(false);
      }
    };

    void loadNearby();

    return () => {
      cancelled = true;
    };
  }, [userLat, userLng, radius]);

  useEffect(() => {
    if (
      !router.isReady ||
      !targetMovieId ||
      cinemas.length === 0
    ) {
      if (!targetMovieId) setMovieFocusTitle(null);
      return;
    }

    let cancelled = false;

    const focusMovie = async () => {
      setMovieFocusLoading(true);

      try {
        const response = await fetch(
          `/api/tmdb/movie/${targetMovieId}/availability`,
          { cache: 'no-store' }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error || 'Disponibilità film non caricabile'
          );
        }

        const availableCinemas = Array.isArray(data?.cinema?.cinemas)
          ? data.cinema.cinemas
          : [];

        const nearbyIds = new Set(
          cinemas.map((cinema) => Number(cinema.id))
        );

        const matchingNearby = availableCinemas.filter(
          (cinema: any) => nearbyIds.has(Number(cinema.id))
        );

        if (cancelled) return;

        if (matchingNearby.length === 0) {
          setMovieFocusTitle(null);
          return;
        }

        const nearestMatch = [...cinemas]
          .filter((cinema) =>
            matchingNearby.some(
              (match: any) =>
                Number(match.id) === Number(cinema.id)
            )
          )
          .sort((a, b) => a.distanceKm - b.distanceKm)[0];

        if (!nearestMatch) return;

        setSelectedId(nearestMatch.id);
        setView('map');
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

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;

    const loadShowtimes = async () => {
      setLoadingShowtimes(true);
      setShowtimes([]);
      setSelectedDay(0);
      setActiveFormatFilter('Tutti');
      setExpandedFilms({});

      try {
        const response = await fetch(
          `/api/cinema/showtimes?cinemaId=${selectedId}`
        );
        const data = await response.json();
        const days = Array.isArray(data.days) ? data.days : [];

        if (cancelled) return;

        setShowtimes(days);

        if (targetMovieId) {
          const dayIndex = days.findIndex(
            (day: any) =>
              Array.isArray(day.films) &&
              day.films.some(
                (film: any) =>
                  Number(film.tmdb_id) === targetMovieId
              )
          );

          if (dayIndex >= 0) {
            setSelectedDay(dayIndex);

            const focused = days[dayIndex].films.find(
              (film: any) =>
                Number(film.tmdb_id) === targetMovieId
            );

            setMovieFocusTitle(
              focused?.title ?? 'Film selezionato'
            );
          } else {
            setMovieFocusTitle(null);
          }
        }
      } catch {
        if (!cancelled) {
          setShowtimes([]);
          if (targetMovieId) setMovieFocusTitle(null);
        }
      } finally {
        if (!cancelled) setLoadingShowtimes(false);
      }
    };

    void loadShowtimes();

    return () => {
      cancelled = true;
    };
  }, [selectedId, targetMovieId]);

  const handleCitySearch = async () => {
    if (!cityInput.trim()) return;

    setGeoLoading(true);
    setGeoError('');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          `${cityInput}, Italia`
        )}&format=json&limit=1`,
        {
          headers: {
            'Accept-Language': 'it',
          },
        }
      );

      const data = await response.json();

      if (!data.length) {
        setGeoError('Città non trovata.');
        return;
      }

      setUserLat(Number.parseFloat(data[0].lat));
      setUserLng(Number.parseFloat(data[0].lon));
      setShowManual(false);
    } catch (error) {
      console.error(error);
      setGeoError('Errore durante la ricerca della città.');
    } finally {
      setGeoLoading(false);
    }
  };

  const selectedCinema = cinemas.find(
    (cinema) => cinema.id === selectedId
  );

  const closestCinema = useMemo(
    () =>
      [...cinemas].sort(
        (a, b) => a.distanceKm - b.distanceKm
      )[0] ?? null,
    [cinemas]
  );

  const todayFilms = showtimes[selectedDay]?.films ?? [];

  const filteredFilms = todayFilms
    .map((film) => ({
      ...film,
      sessions:
        activeFormatFilter === 'Tutti'
          ? film.sessions
          : film.sessions.filter((session) =>
              parseSessionTags(session.format).some((tag) =>
                tag
                  .toLowerCase()
                  .includes(activeFormatFilter.toLowerCase())
              )
            ),
    }))
    .filter((film) => film.sessions.length > 0);

  const displayFilms = targetMovieId
    ? filteredFilms.filter(
        (film: any) =>
          Number(film.tmdb_id) === targetMovieId
      )
    : filteredFilms;

  const dayFormatTags = Array.from(
    new Set(
      todayFilms.flatMap((film) =>
        film.sessions.flatMap((session) =>
          parseSessionTags(session.format)
        )
      )
    )
  ).slice(0, 6);

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

    /* aliases expected by CineMap */
    '--home-bg': P.bg,
    '--home-bg-soft': P.bgSoft,
    '--home-card': P.surface,
    '--home-card-hover': P.surfaceHover,
    '--home-border': P.border,
    '--home-gold': P.accent,
    '--home-gold-soft': P.accentSoft,
    '--home-pink': P.primary,
    '--home-pink-deep': P.primaryDeep,
    '--home-text': P.text,
    '--home-text-muted': P.textMuted,
    '--home-text-faint': P.textFaint,
    '--home-font': FONT.sans,
    '--home-font-display': FONT.display,
  } as CSSProperties;

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: P.bg,
        }}
      >
        <FilmSlate
          size={42}
          color={P.primary}
          weight="duotone"
        />
      </div>
    );
  }

  return (
    <AppShell activeNav="cinema">
      <main className="cdr-cinema" style={vars}>
        <style>{`
          @keyframes cdr-cinema-spin {
            to { transform:rotate(360deg); }
          }

          .cdr-cinema {
            min-height:100dvh;
            background:var(--cdr-cinema-bg);
            color:var(--cdr-cinema-text);
            font-family:${FONT.sans};
          }

          .cdr-cinema * { box-sizing:border-box; }

          .cdr-cinema-spin {
            animation:cdr-cinema-spin 1s linear infinite;
          }

          .cdr-cinema-shell {
            width:min(100%,1180px);
            margin:0 auto;
            padding:24px 28px 60px;
          }

          .cdr-cinema-header {
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:22px;
            align-items:end;
            margin-bottom:22px;
          }

          .cdr-cinema-kicker {
            display:flex;
            align-items:center;
            gap:7px;
            color:var(--cdr-cinema-gold);
            font-size:12px;
            font-weight:850;
            letter-spacing:.1em;
            text-transform:uppercase;
          }

          .cdr-cinema-title {
            margin:6px 0 0;
            max-width:780px;
            font-family:${FONT.display};
            font-size:42px;
            line-height:1.02;
            letter-spacing:-.035em;
          }

          .cdr-cinema-lead {
            max-width:760px;
            margin:8px 0 0;
            color:var(--cdr-cinema-muted);
            font-size:16px;
            line-height:1.55;
          }

          .cdr-cinema-location-state {
            min-width:210px;
            border-left:2px solid var(--cdr-cinema-gold);
            padding:4px 0 4px 14px;
          }

          .cdr-cinema-location-state strong {
            display:block;
            font-size:14px;
          }

          .cdr-cinema-location-state span {
            display:block;
            margin-top:3px;
            color:var(--cdr-cinema-muted);
            font-size:12px;
          }

          .cdr-cinema-location-change {
            margin-top:9px;
            padding:0;
            border:0;
            background:transparent;
            color:var(--cdr-cinema-pink);
            font:inherit;
            font-size:12px;
            font-weight:850;
            cursor:pointer;
          }

          .cdr-cinema-location-change:hover {
            text-decoration:underline;
          }

          .cdr-cinema-search {
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:8px;
            padding:14px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
            margin-bottom:18px;
          }

          .cdr-cinema-search-head {
            grid-column:1 / -1;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
          }

          .cdr-cinema-search-head strong {
            font-family:${FONT.display};
            font-size:19px;
          }

          .cdr-cinema-search-head span {
            color:var(--cdr-cinema-muted);
            font-size:12px;
          }

          .cdr-cinema-input {
            width:100%;
            min-height:44px;
            padding:0 13px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-soft);
            color:var(--cdr-cinema-text);
            font:inherit;
            font-size:14px;
            outline:0;
          }

          .cdr-cinema-action {
            min-height:44px;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:7px;
            padding:0 14px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
            color:var(--cdr-cinema-text);
            font:inherit;
            font-size:13px;
            font-weight:850;
            cursor:pointer;
          }

          .cdr-cinema-action.primary {
            border-color:var(--cdr-cinema-pink);
            background:var(--cdr-cinema-pink);
            color:#fff;
          }

          .cdr-cinema-action.gold {
            border-color:var(--cdr-cinema-gold);
            background:var(--cdr-cinema-gold-glow);
            color:var(--cdr-cinema-gold);
          }

          .cdr-cinema-notice {
            display:flex;
            align-items:center;
            gap:8px;
            padding:12px 14px;
            margin-bottom:16px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
            color:var(--cdr-cinema-muted);
            font-size:13px;
          }

          .cdr-cinema-dashboard {
            display:block;
          }

          .cdr-cinema-main {
            min-width:0;
            display:grid;
            gap:16px;
          }

          .cdr-cinema-sidebar {
            display:none;
          }

          .cdr-cinema-summary {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:8px;
          }

          .cdr-cinema-flow {
            display:grid;
            gap:16px;
          }

          .cdr-cinema-step {
            display:grid;
            grid-template-columns:34px minmax(0,1fr);
            gap:12px;
            align-items:start;
          }

          .cdr-cinema-step-index {
            width:34px;
            height:34px;
            display:grid;
            place-items:center;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-soft);
            color:var(--cdr-cinema-gold);
            font-weight:900;
            font-size:13px;
          }

          .cdr-cinema-step-copy strong {
            display:block;
            font-family:${FONT.display};
            font-size:21px;
            line-height:1.2;
          }

          .cdr-cinema-step-copy span {
            display:block;
            margin-top:3px;
            color:var(--cdr-cinema-muted);
            font-size:13px;
            line-height:1.45;
          }

          .cdr-cinema-section {
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
            padding:14px;
          }

          .cdr-cinema-choice-list {
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:8px;
          }

          .cdr-cinema-choice {
            min-height:116px;
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:12px;
            align-items:start;
            padding:13px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
            color:var(--cdr-cinema-text);
            text-align:left;
            cursor:pointer;
            transition:border-color .16s ease, transform .16s ease, background .16s ease;
          }

          .cdr-cinema-choice:hover {
            border-color:var(--cdr-cinema-gold);
            transform:translateY(-1px);
          }

          .cdr-cinema-choice.selected {
            border-color:var(--cdr-cinema-gold);
            background:var(--cdr-cinema-gold-glow);
          }

          .cdr-cinema-choice .name {
            font-size:15px;
            font-weight:850;
            line-height:1.3;
          }

          .cdr-cinema-choice .address {
            margin-top:4px;
            color:var(--cdr-cinema-muted);
            font-size:12px;
            line-height:1.4;
          }

          .cdr-cinema-choice .distance {
            color:var(--cdr-cinema-gold);
            font-size:13px;
            font-weight:900;
            white-space:nowrap;
          }

          .cdr-cinema-choice .cta {
            grid-column:1 / -1;
            display:flex;
            align-items:center;
            gap:5px;
            margin-top:4px;
            color:var(--cdr-cinema-pink);
            font-size:12px;
            font-weight:850;
          }

          .cdr-cinema-selected-strip {
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:12px;
            align-items:center;
            padding:12px 14px;
            border:1px solid var(--cdr-cinema-gold);
            background:var(--cdr-cinema-gold-glow);
          }

          .cdr-cinema-selected-strip strong {
            display:block;
            font-size:14px;
          }

          .cdr-cinema-selected-strip span {
            display:block;
            margin-top:2px;
            color:var(--cdr-cinema-muted);
            font-size:12px;
          }

          .cdr-cinema-inline-cta {
            margin-top:2px;
            padding:14px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-soft);
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:12px;
            align-items:center;
          }

          .cdr-cinema-inline-cta strong {
            display:block;
            font-family:${FONT.display};
            font-size:18px;
          }

          .cdr-cinema-inline-cta span {
            display:block;
            margin-top:3px;
            color:var(--cdr-cinema-muted);
            font-size:12px;
          }

          .cdr-cinema-summary-card {
            min-height:82px;
            padding:12px 14px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
            text-align:left;
          }

          button.cdr-cinema-summary-card {
            cursor:pointer;
          }

          .cdr-cinema-summary-label {
            color:var(--cdr-cinema-gold);
            font-size:11px;
            font-weight:850;
            letter-spacing:.08em;
            text-transform:uppercase;
          }

          .cdr-cinema-summary-card strong {
            display:block;
            margin-top:5px;
            font-family:${FONT.display};
            font-size:21px;
            line-height:1.2;
          }

          .cdr-cinema-summary-card span {
            display:block;
            margin-top:4px;
            color:var(--cdr-cinema-muted);
            font-size:12px;
          }

          .cdr-cinema-toolbar {
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:10px;
            align-items:center;
            padding:10px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
          }

          .cdr-cinema-radius {
            display:flex;
            flex-wrap:wrap;
            gap:5px;
          }

          .cdr-cinema-radius button,
          .cdr-cinema-view button,
          .cdr-cinema-filter {
            min-height:34px;
            padding:0 10px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
            color:var(--cdr-cinema-muted);
            font:inherit;
            font-size:12px;
            font-weight:800;
            cursor:pointer;
          }

          .cdr-cinema-radius button.active {
            border-color:var(--cdr-cinema-pink);
            background:var(--cdr-cinema-pink);
            color:#fff;
          }

          .cdr-cinema-view {
            display:flex;
          }

          .cdr-cinema-view button {
            display:flex;
            align-items:center;
            gap:5px;
          }

          .cdr-cinema-view button.active {
            border-color:var(--cdr-cinema-gold);
            background:var(--cdr-cinema-gold-glow);
            color:var(--cdr-cinema-gold);
          }

          .cdr-cinema-results {
            display:grid;
            gap:8px;
          }

          .cdr-cinema-map-wrap {
            min-height:330px;
            overflow:hidden;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-soft);
          }

          .cdr-cinema-map-wrap > * {
            width:100%;
          }

          .cdr-cinema-card {
            width:100%;
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:12px;
            align-items:center;
            padding:13px 14px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
            color:var(--cdr-cinema-text);
            text-align:left;
            cursor:pointer;
            transition:border-color .16s ease, background .16s ease;
          }

          .cdr-cinema-card:hover,
          .cdr-cinema-card.selected {
            border-color:var(--cdr-cinema-gold);
            background:var(--cdr-cinema-hover);
          }

          .cdr-cinema-card strong {
            display:block;
            font-size:15px;
          }

          .cdr-cinema-card span {
            display:block;
            margin-top:3px;
            color:var(--cdr-cinema-muted);
            font-size:12px;
            line-height:1.4;
          }

          .cdr-cinema-distance {
            color:var(--cdr-cinema-gold);
            font-size:13px;
            font-weight:850;
            white-space:nowrap;
          }

          .cdr-cinema-program {
            overflow:hidden;
            border:1px solid var(--cdr-cinema-gold);
            background:var(--cdr-cinema-surface);
          }

          .cdr-cinema-program-head {
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:14px;
            align-items:start;
            padding:16px;
            border-bottom:1px solid var(--cdr-cinema-border);
          }

          .cdr-cinema-program-head h2 {
            margin:0;
            font-family:${FONT.display};
            font-size:27px;
          }

          .cdr-cinema-program-head p {
            margin:4px 0 0;
            color:var(--cdr-cinema-muted);
            font-size:14px;
          }

          .cdr-cinema-close {
            width:34px;
            height:34px;
            display:grid;
            place-items:center;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-soft);
            color:var(--cdr-cinema-muted);
            cursor:pointer;
          }

          .cdr-cinema-focus {
            margin:14px 16px 0;
            padding:11px 12px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-soft);
          }

          .cdr-cinema-focus.active {
            border-color:var(--cdr-cinema-gold);
            background:var(--cdr-cinema-gold-glow);
          }

          .cdr-cinema-focus small {
            color:var(--cdr-cinema-gold);
            font-size:10px;
            font-weight:850;
            letter-spacing:.08em;
            text-transform:uppercase;
          }

          .cdr-cinema-focus strong {
            display:block;
            margin-top:4px;
            font-size:14px;
          }

          .cdr-cinema-days,
          .cdr-cinema-filters {
            display:flex;
            gap:6px;
            overflow-x:auto;
            scrollbar-width:none;
          }

          .cdr-cinema-days::-webkit-scrollbar,
          .cdr-cinema-filters::-webkit-scrollbar {
            display:none;
          }

          .cdr-cinema-days {
            padding:14px 16px 8px;
          }

          .cdr-cinema-day {
            min-width:78px;
            padding:9px 10px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
            color:var(--cdr-cinema-muted);
            text-align:center;
            cursor:pointer;
          }

          .cdr-cinema-day.active {
            border-color:var(--cdr-cinema-gold);
            background:var(--cdr-cinema-gold-glow);
            color:var(--cdr-cinema-text);
          }

          .cdr-cinema-day strong {
            display:block;
            font-size:13px;
          }

          .cdr-cinema-day span {
            display:block;
            margin-top:2px;
            font-size:11px;
          }

          .cdr-cinema-day small {
            display:block;
            margin-top:4px;
            color:var(--cdr-cinema-faint);
            font-size:10px;
          }

          .cdr-cinema-filters {
            padding:0 16px 8px;
          }

          .cdr-cinema-filter.active {
            border-color:var(--cdr-cinema-gold);
            color:var(--cdr-cinema-gold);
            background:var(--cdr-cinema-gold-glow);
          }

          .cdr-cinema-films {
            padding:2px 16px 16px;
          }

          .cdr-cinema-film {
            display:grid;
            grid-template-columns:82px minmax(0,1fr);
            gap:14px;
            padding:15px 0;
            border-bottom:1px solid var(--cdr-cinema-border);
          }

          .cdr-cinema-film:last-child {
            border-bottom:0;
          }

          .cdr-cinema-poster {
            width:82px;
            aspect-ratio:2/3;
            overflow:hidden;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-soft);
          }

          .cdr-cinema-poster img {
            width:100%;
            height:100%;
            object-fit:cover;
          }

          .cdr-cinema-film h3 {
            margin:0;
            font-family:${FONT.display};
            font-size:19px;
            line-height:1.2;
          }

          .cdr-cinema-duration {
            display:flex;
            align-items:center;
            gap:5px;
            margin-top:5px;
            color:var(--cdr-cinema-muted);
            font-size:12px;
          }

          .cdr-cinema-sessions {
            display:flex;
            flex-wrap:wrap;
            gap:7px;
            margin-top:10px;
          }

          .cdr-cinema-session {
            min-width:94px;
            min-height:48px;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            padding:6px 9px;
            border:1px solid var(--cdr-cinema-gold);
            background:var(--cdr-cinema-gold);
            color:var(--cdr-cinema-bg);
            text-decoration:none;
            font-weight:850;
          }

          .cdr-cinema-session strong {
            font-size:14px;
          }

          .cdr-cinema-session span {
            max-width:92px;
            overflow:hidden;
            margin-top:2px;
            font-size:9px;
            font-weight:700;
            opacity:.75;
            text-overflow:ellipsis;
            white-space:nowrap;
          }

          button.cdr-cinema-session {
            background:transparent;
            color:var(--cdr-cinema-gold);
            cursor:pointer;
          }

          .cdr-cinema-booking-note {
            display:flex;
            align-items:center;
            gap:7px;
            padding:10px 16px 16px;
            color:var(--cdr-cinema-muted);
            font-size:12px;
          }

          .cdr-cinema-side-card {
            padding:16px;
            border:1px solid var(--cdr-cinema-border);
            background:var(--cdr-cinema-surface);
          }

          .cdr-cinema-side-card.gold {
            border-top:3px solid var(--cdr-cinema-gold);
          }

          .cdr-cinema-side-card.pink {
            border-top:3px solid var(--cdr-cinema-pink);
          }

          .cdr-cinema-side-card h3 {
            margin:8px 0 0;
            font-family:${FONT.display};
            font-size:21px;
          }

          .cdr-cinema-side-card p {
            margin:7px 0 0;
            color:var(--cdr-cinema-muted);
            font-size:13px;
            line-height:1.5;
          }

          .cdr-cinema-side-meta {
            margin-top:12px;
            padding-top:10px;
            border-top:1px solid var(--cdr-cinema-border);
            color:var(--cdr-cinema-faint);
            font-size:11px;
            line-height:1.5;
          }

          .cdr-cinema-empty {
            min-height:120px;
            display:grid;
            place-items:center;
            padding:22px;
            border:1px dashed var(--cdr-cinema-border);
            background:var(--cdr-cinema-soft);
            color:var(--cdr-cinema-muted);
            text-align:center;
            font-size:13px;
            line-height:1.5;
          }

          @media (max-width:920px) {
            .cdr-cinema-choice-list {
              grid-template-columns:1fr;
            }
          }

          @media (max-width:720px) {
            .cdr-cinema-shell {
              padding:14px 10px 78px;
            }

            .cdr-cinema-header {
              grid-template-columns:1fr;
            }

            .cdr-cinema-title {
              font-size:34px;
            }

            .cdr-cinema-lead {
              font-size:14px;
            }

            .cdr-cinema-location-state {
              border-left:0;
              border-top:1px solid var(--cdr-cinema-border);
              padding:10px 0 0;
            }

            .cdr-cinema-search {
              grid-template-columns:1fr;
            }

            .cdr-cinema-search-head {
              display:block;
            }

            .cdr-cinema-search-head span {
              display:block;
              margin-top:3px;
            }

            .cdr-cinema-summary {
              grid-template-columns:1fr 1fr;
            }

            .cdr-cinema-toolbar {
              grid-template-columns:1fr;
            }

            .cdr-cinema-view {
              width:100%;
            }

            .cdr-cinema-view button {
              flex:1;
              justify-content:center;
            }

            .cdr-cinema-step {
              grid-template-columns:30px minmax(0,1fr);
              gap:9px;
            }

            .cdr-cinema-step-index {
              width:30px;
              height:30px;
            }

            .cdr-cinema-inline-cta {
              grid-template-columns:1fr;
            }
          }

          @media (max-width:460px) {
            .cdr-cinema-shell {
              padding-inline:8px;
            }

            .cdr-cinema-title {
              font-size:31px;
            }

            .cdr-cinema-summary {
              grid-template-columns:1fr;
            }

            .cdr-cinema-choice-list {
              grid-template-columns:1fr;
            }

            .cdr-cinema-choice {
              min-height:104px;
            }

            .cdr-cinema-film {
              grid-template-columns:68px minmax(0,1fr);
              gap:10px;
            }

            .cdr-cinema-poster {
              width:68px;
            }

            .cdr-cinema-film h3 {
              font-size:17px;
            }

            .cdr-cinema-session {
              min-width:84px;
            }
          }
        `}</style>

        <div className="cdr-cinema-shell">
          <BackButton
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                void router.push('/home');
              }
            }}
          />

          <header className="cdr-cinema-header">
            <div>
              <div className="cdr-cinema-kicker">
                <MapPin size={14} weight="fill" />
                Cinema
              </div>
              <h1 className="cdr-cinema-title">
                Trova il cinema giusto per stasera
              </h1>
              <p className="cdr-cinema-lead">
                Parti dai cinema più vicini, scegli quello che ti interessa e guarda subito film, orari e prenotazione.
              </p>
            </div>

            <div className="cdr-cinema-location-state">
              <strong>
                {userLat
                  ? 'Posizione impostata'
                  : geoLoading
                    ? 'Cerco la tua posizione'
                    : 'Posizione necessaria'}
              </strong>
              <span>
                {userLat
                  ? `${cinemas.length} cinema entro ${radius} km`
                  : 'Puoi usare la geolocalizzazione o cercare una città.'}
              </span>

              {userLat && (
                <button
                  type="button"
                  className="cdr-cinema-location-change"
                  onClick={() => {
                    setCityInput('');
                    setGeoError('');
                    setShowManual((current) => !current);
                  }}
                >
                  {showManual ? 'Chiudi ricerca città' : 'Cambia città'}
                </button>
              )}
            </div>
          </header>

          {geoLoading && (
            <div className="cdr-cinema-notice">
              <CircleNotch
                size={17}
                className="cdr-cinema-spin"
                color={P.accent}
              />
              {showManual
                ? 'Ricerca città in corso...'
                : 'Rilevamento posizione...'}
            </div>
          )}

          {(showManual || !userLat) && !geoLoading && (
            <section className="cdr-cinema-search">
              <div className="cdr-cinema-search-head">
                <strong>Cerca la tua città</strong>
                <span>
                  Useremo la posizione solo per ordinare i cinema
                  più vicini.
                </span>
              </div>

              <input
                className="cdr-cinema-input"
                value={cityInput}
                onChange={(event) =>
                  setCityInput(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleCitySearch();
                  }
                }}
                placeholder="Milano, Roma, Napoli..."
              />

              <button
                type="button"
                className="cdr-cinema-action primary"
                onClick={() => void handleCitySearch()}
              >
                <MagnifyingGlass size={15} weight="bold" />
                Cerca
              </button>

              {geoError && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    color: P.primary,
                    fontSize: 12,
                  }}
                >
                  {geoError}
                </div>
              )}
            </section>
          )}

          {userLat && (
            <div className="cdr-cinema-dashboard">
              <div className="cdr-cinema-main">
                <section className="cdr-cinema-summary">
                  <div className="cdr-cinema-summary-card">
                    <div className="cdr-cinema-summary-label">
                      Vicino a te
                    </div>
                    <strong>
                      {loadingCinemas
                        ? 'Cerco...'
                        : `${cinemas.length} cinema`}
                    </strong>
                    <span>entro {radius} km</span>
                  </div>

                  <button
                    type="button"
                    className="cdr-cinema-summary-card"
                    disabled={!closestCinema}
                    onClick={() => {
                      if (!closestCinema) return;
                      setSelectedId(closestCinema.id);
                    }}
                  >
                    <div className="cdr-cinema-summary-label">
                      Più vicino
                    </div>
                    <strong>
                      {closestCinema?.name ?? 'Nessun cinema'}
                    </strong>
                    <span>
                      {closestCinema
                        ? `${closestCinema.distanceKm} km · apri programmazione`
                        : 'Prova ad aumentare il raggio'}
                    </span>
                  </button>
                </section>

                <section className="cdr-cinema-toolbar">
                  <div className="cdr-cinema-radius">
                    {RADIUS_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={radius === option ? 'active' : ''}
                        onClick={() => setRadius(option)}
                      >
                        {option} km
                      </button>
                    ))}

                  </div>

                  <div className="cdr-cinema-view">
                    <button
                      type="button"
                      className={view === 'map' ? 'active' : ''}
                      onClick={() => setView('map')}
                    >
                      <MapTrifold size={14} />
                      Mappa
                    </button>
                    <button
                      type="button"
                      className={view === 'list' ? 'active' : ''}
                      onClick={() => setView('list')}
                    >
                      <List size={14} />
                      Lista
                    </button>
                  </div>
                </section>

                <div className="cdr-cinema-flow">
                  <div className="cdr-cinema-step">
                    <div className="cdr-cinema-step-index">1</div>
                    <div className="cdr-cinema-step-copy">
                      <strong>Scegli il cinema</strong>
                      <span>
                        Partiamo dai più vicini. Tocca un cinema per vedere subito la sua programmazione.
                      </span>
                    </div>
                  </div>

                  {loadingCinemas ? (
                    <div className="cdr-cinema-empty">
                      <div>
                        <CircleNotch
                          size={22}
                          className="cdr-cinema-spin"
                          color={P.accent}
                        />
                        <div style={{ marginTop: 8 }}>
                          Cerco cinema vicini...
                        </div>
                      </div>
                    </div>
                  ) : cinemas.length === 0 ? (
                    <div className="cdr-cinema-empty">
                      Nessun cinema trovato. Prova ad aumentare il raggio oppure cambia città.
                    </div>
                  ) : (
                    <>
                      {view === 'map' && (
                        <div className="cdr-cinema-map-wrap">
                          <CinemaMap
                            cinemas={cinemas}
                            userLat={userLat}
                            userLng={userLng!}
                            selectedId={selectedId}
                            onSelect={(id) =>
                              setSelectedId((previous) =>
                                previous === id ? null : id
                              )
                            }
                          />
                        </div>
                      )}

                      <div className="cdr-cinema-choice-list">
                        {cinemas.map((cinema) => (
                          <button
                            type="button"
                            key={cinema.id}
                            className={`cdr-cinema-choice ${
                              selectedId === cinema.id ? 'selected' : ''
                            }`}
                            onClick={() => {
                              setSelectedId(cinema.id);
                            }}
                          >
                            <div>
                              <div className="name">{cinema.name}</div>
                              <div className="address">
                                {[cinema.address, cinema.city]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            </div>

                            <div className="distance">
                              {cinema.distanceKm} km
                            </div>

                            <div className="cta">
                              Vedi programmazione
                              <ArrowRight size={12} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {selectedCinema && (
                    <div className="cdr-cinema-selected-strip">
                      <div>
                        <strong>{selectedCinema.name}</strong>
                        <span>
                          {selectedCinema.distanceKm} km · cinema selezionato
                        </span>
                      </div>

                      <button
                        type="button"
                        className="cdr-cinema-action"
                        onClick={() => {
                          setSelectedId(null);
                          setShowtimes([]);
                        }}
                      >
                        Cambia
                      </button>
                    </div>
                  )}

                  {selectedId && (
                    <>
                      <div className="cdr-cinema-step">
                        <div className="cdr-cinema-step-index">2</div>
                        <div className="cdr-cinema-step-copy">
                          <strong>Scegli giorno e film</strong>
                          <span>
                            La programmazione qui sotto arriva dal cinema selezionato.
                          </span>
                        </div>
                      </div>

                      <section className="cdr-cinema-program">
                        <div className="cdr-cinema-program-head">
                          <div>
                            <h2>{selectedCinema?.name}</h2>
                            <p>
                              Scegli un giorno, poi il film e infine l&apos;orario.
                            </p>
                          </div>

                          <button
                            type="button"
                            className="cdr-cinema-close"
                            onClick={() => {
                              setSelectedId(null);
                              setShowtimes([]);
                            }}
                            aria-label="Chiudi programmazione"
                          >
                            <X size={17} />
                          </button>
                        </div>

                        {loadingShowtimes ? (
                          <div className="cdr-cinema-empty">
                            <div>
                              <CircleNotch
                                size={22}
                                className="cdr-cinema-spin"
                                color={P.accent}
                              />
                              <div style={{ marginTop: 8 }}>
                                Carico la programmazione...
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {targetMovieId && (
                              <div
                                className={`cdr-cinema-focus ${
                                  movieFocusTitle ? 'active' : ''
                                }`}
                              >
                                <small>
                                  {movieFocusLoading
                                    ? 'Sto cercando...'
                                    : 'Film selezionato'}
                                </small>
                                <strong>
                                  {movieFocusTitle ??
                                    'Nessuna proiezione vicina trovata'}
                                </strong>

                                <button
                                  type="button"
                                  style={{
                                    marginTop: 7,
                                    border: 0,
                                    padding: 0,
                                    background: 'transparent',
                                    color: P.textMuted,
                                    fontSize: 11,
                                    cursor: 'pointer',
                                  }}
                                  onClick={() =>
                                    router.replace(
                                      '/cinema',
                                      undefined,
                                      { shallow: true }
                                    )
                                  }
                                >
                                  Mostra tutta la programmazione
                                </button>
                              </div>
                            )}

                            {showtimes.length > 0 ? (
                              <>
                                <div className="cdr-cinema-days">
                                  {showtimes.map((day, index) => {
                                    const label = formatDayLabel(
                                      day.date,
                                      index
                                    );

                                    return (
                                      <button
                                        type="button"
                                        key={day.date}
                                        className={`cdr-cinema-day ${
                                          selectedDay === index
                                            ? 'active'
                                            : ''
                                        }`}
                                        onClick={() => {
                                          setSelectedDay(index);
                                          setActiveFormatFilter('Tutti');
                                          setExpandedFilms({});
                                        }}
                                      >
                                        <strong>{label.top}</strong>
                                        <span>{label.bottom}</span>
                                        <small>
                                          {day.films.length} film
                                        </small>
                                      </button>
                                    );
                                  })}
                                </div>

                                {dayFormatTags.length > 0 && (
                                  <div className="cdr-cinema-filters">
                                    {['Tutti', ...dayFormatTags].map(
                                      (tag) => (
                                        <button
                                          type="button"
                                          key={tag}
                                          className={`cdr-cinema-filter ${
                                            activeFormatFilter === tag
                                              ? 'active'
                                              : ''
                                          }`}
                                          onClick={() => {
                                            setActiveFormatFilter(tag);
                                            setExpandedFilms({});
                                          }}
                                        >
                                          {tag}
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}

                                <div className="cdr-cinema-films">
                                  {displayFilms.length === 0 ? (
                                    <div className="cdr-cinema-empty">
                                      {targetMovieId
                                        ? 'Nessuna proiezione di questo film per il giorno selezionato.'
                                        : 'Nessuna programmazione per questo giorno.'}
                                    </div>
                                  ) : (
                                    displayFilms.map(
                                      (film: ShowtimeFilm) => {
                                        const key = String(film.id);
                                        const expanded =
                                          !!expandedFilms[key];
                                        const sessions = expanded
                                          ? film.sessions
                                          : film.sessions.slice(
                                              0,
                                              SESSIONS_COLLAPSED_LIMIT
                                            );

                                        return (
                                          <article
                                            key={film.id}
                                            className="cdr-cinema-film"
                                          >
                                            <div className="cdr-cinema-poster">
                                              {film.posterUrl ? (
                                                <img
                                                  src={film.posterUrl}
                                                  alt={film.title}
                                                />
                                              ) : (
                                                <div
                                                  style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                  }}
                                                >
                                                  <FilmSlate
                                                    size={24}
                                                    color={P.textFaint}
                                                  />
                                                </div>
                                              )}
                                            </div>

                                            <div>
                                              <h3>{film.title}</h3>

                                              {film.duration && (
                                                <div className="cdr-cinema-duration">
                                                  <Clock size={13} />
                                                  {film.duration}
                                                </div>
                                              )}

                                              <div className="cdr-cinema-sessions">
                                                {sessions.map(
                                                  (session) => {
                                                    const tags =
                                                      parseSessionTags(
                                                        session.format
                                                      );

                                                    return (
                                                      <a
                                                        key={
                                                          session.id ||
                                                          `${film.id}-${session.time}`
                                                        }
                                                        href={
                                                          session.bookingUrl
                                                        }
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="cdr-cinema-session"
                                                      >
                                                        <strong>
                                                          {session.time}
                                                        </strong>
                                                        {tags.length > 0 && (
                                                          <span>
                                                            {tags.join(' · ')}
                                                          </span>
                                                        )}
                                                      </a>
                                                    );
                                                  }
                                                )}

                                                {film.sessions.length >
                                                  SESSIONS_COLLAPSED_LIMIT && (
                                                  <button
                                                    type="button"
                                                    className="cdr-cinema-session"
                                                    aria-expanded={expanded}
                                                    onClick={() =>
                                                      setExpandedFilms(
                                                        (previous) => ({
                                                          ...previous,
                                                          [key]:
                                                            !previous[key],
                                                        })
                                                      )
                                                    }
                                                  >
                                                    <strong>
                                                      {expanded
                                                        ? 'Meno'
                                                        : `+${
                                                            film.sessions.length -
                                                            SESSIONS_COLLAPSED_LIMIT
                                                          }`}
                                                    </strong>
                                                    <span>
                                                      {expanded
                                                        ? 'riduci'
                                                        : 'altri orari'}
                                                    </span>
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          </article>
                                        );
                                      }
                                    )
                                  )}
                                </div>

                                {filteredFilms.length > 0 && (
                                  <div className="cdr-cinema-booking-note">
                                    <Sparkle
                                      size={14}
                                      color={P.accent}
                                      weight="fill"
                                    />
                                    Tocca un orario per aprire la prenotazione del cinema.
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="cdr-cinema-empty">
                                Nessuna programmazione disponibile per questo cinema nei prossimi giorni.
                              </div>
                            )}
                          </>
                        )}
                      </section>

                      <div className="cdr-cinema-step">
                        <div className="cdr-cinema-step-index">3</div>
                        <div className="cdr-cinema-step-copy">
                          <strong>Prenota oppure organizza insieme</strong>
                          <span>
                            Se vuoi scegliere il film con altre persone, crea una stanza partendo da qui.
                          </span>
                        </div>
                      </div>

                      <div className="cdr-cinema-inline-cta">
                        <div>
                          <strong>Il cinema è meglio insieme</strong>
                          <span>
                            Crea una stanza, invita le persone e arrivate al film con una scelta condivisa.
                          </span>
                        </div>

                        <button
                          type="button"
                          className="cdr-cinema-action primary"
                          onClick={() =>
                            router.push('/crea-stanza?tab=create')
                          }
                        >
                          Crea una stanza
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
