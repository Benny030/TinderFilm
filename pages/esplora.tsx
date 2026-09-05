"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import BackButton from '@/components/ui/BackButton';
import { useTheme } from '@/context/ThemeContext';
import { THEME, FONT } from '@/styles/token';
import {
  FilmSlate, FunnelSimple, MagnifyingGlass,
  Star, X, TrendUp, CalendarBlank, Trophy, Sparkle, User,
} from '@phosphor-icons/react';

type Mode = 'trending' | 'popular' | 'top_rated' | 'now_playing' | 'upcoming';
type SearchKind = 'all' | 'movie' | 'person';
type Movie = {
  tmdb_id: number;
  title: string;
  year: number | null;
  release_date?: string | null;
  cover: string | null;
  rating: number;
  vote_count: number;
  genre?: string;
  overview?: string | null;
  in_cinema?: boolean;
  cinema_count?: number;
  showing_count?: number;
};

type MovieAvailabilityHint = {
  status?:
    | 'cinema_and_streaming'
    | 'cinema_only'
    | 'streaming_only'
    | 'digital_only'
    | 'unavailable';
  cinema: boolean;
  streaming: boolean;
  digital: boolean;
  cinema_names?: string[];
  streaming_providers?: string[];
  digital_providers?: string[];
};
type Person = {
  tmdb_id: number; name: string; photo: string | null;
  known_for_department: string; known_for: Movie[];
};


function formatReleaseDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function releaseBadge(value?: string | null) {
  if (!value) return null;

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diffDays = Math.round(
    (date.getTime() - today.getTime()) / 86400000
  );

  if (diffDays === 0) return 'Oggi';
  if (diffDays === 1) return 'Domani';
  if (diffDays > 1 && diffDays <= 7) return `Tra ${diffDays} giorni`;

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
  })
    .format(date)
    .replace('.', '')
    .toUpperCase();
}

const tabs: { id: Mode; label: string; icon: any }[] = [
  { id: 'trending', label: 'In tendenza', icon: TrendUp },
  { id: 'popular', label: 'Popolari', icon: Sparkle },
  { id: 'top_rated', label: 'Più votati', icon: Trophy },
  { id: 'now_playing', label: 'Al cinema', icon: CalendarBlank },
  { id: 'upcoming', label: 'Prossimamente', icon: CalendarBlank },
];

export default function EsploraFilmPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const T = theme === 'dark' ? THEME.dark : THEME.light;
  const P = {
    ...T,
    card: T.surface,
    cardHover: T.surfaceHover,
    gold: T.accent,
    goldSoft: T.accent,
    pink: T.primary,
  };
  const [mode, setMode] = useState<Mode>('trending');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('all');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [availabilityHints, setAvailabilityHints] = useState<Record<number, MovieAvailabilityHint>>({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all'|'cinema'|'streaming'|'digital'>('all');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [year, setYear] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    const tab = String(router.query.tab ?? 'trending');
    if (['trending','popular','top_rated','now_playing','upcoming'].includes(tab)) setMode(tab as Mode);
    const q = String(router.query.q ?? '').trim();
    if (q) setQuery(q);
  }, [router.isReady, router.query.tab, router.query.q]);

  useEffect(() => {
    if (!router.isReady) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(''); setPage(1);
      try {
        const params = new URLSearchParams({ page: '1', mode, kind });
        if (query.trim()) params.set('q', query.trim());

        const useCinemaProgramming =
          mode === 'now_playing' &&
          !query.trim() &&
          kind !== 'person';

        const endpoint = useCinemaProgramming
          ? '/api/cinema/explore'
          : `/api/tmdb/explore?${params}`;

        const res = await fetch(endpoint, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Impossibile caricare i film');
        setMovies(Array.isArray(data.movies) ? data.movies : []);
        setPeople(Array.isArray(data.people) ? data.people : []);
        setTotalPages(Math.max(1, Number(data.total_pages ?? 1)));
      } catch (e: any) {
        if (e?.name !== 'AbortError') { setMovies([]); setPeople([]); setError(e?.message || 'Qualcosa è andato storto'); }
      } finally { setLoading(false); }
    }, query.trim() ? 320 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [router.isReady, mode, kind, query]);


  useEffect(() => {
    const ids = [...new Set(movies.map((movie) => movie.tmdb_id))]
      .filter((id) => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
      setAvailabilityHints({});
      setAvailabilityLoading(false);
      return;
    }

    let cancelled = false;

    const loadAvailabilityHints = async () => {
      setAvailabilityLoading(true);

      try {
        const chunks: number[][] = [];
        for (let index = 0; index < ids.length; index += 24) {
          chunks.push(ids.slice(index, index + 24));
        }

        const results = await Promise.all(
          chunks.map(async (chunk) => {
            const response = await fetch(
              `/api/tmdb/availability-batch?ids=${chunk.join(',')}`,
              { cache: 'no-store' }
            );

            const data = await response.json().catch(() => ({}));
            if (!response.ok) return {};

            return data.availability ?? {};
          })
        );

        if (!cancelled) {
          const merged = Object.assign({}, ...results) as Record<number, MovieAvailabilityHint>;

          for (const movie of movies) {
            if (!movie.in_cinema) continue;

            const id = Number(movie.tmdb_id);
            if (!Number.isInteger(id) || id <= 0) continue;

            merged[id] = {
              ...merged[id],
              cinema: true,
              streaming: merged[id]?.streaming ?? false,
              digital: merged[id]?.digital ?? false,
              cinema_names: merged[id]?.cinema_names ?? [],
              streaming_providers: merged[id]?.streaming_providers ?? [],
              digital_providers: merged[id]?.digital_providers ?? [],
            };
          }

          setAvailabilityHints(merged);
        }
      } catch {
        if (!cancelled) setAvailabilityHints({});
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    };

    void loadAvailabilityHints();

    return () => {
      cancelled = true;
    };
  }, [movies]);

  const visibleMovies = useMemo(() => movies.filter((m) => {
    if (minRating && Number(m.rating || 0) < minRating) return false;
    if (year && Number(m.year) !== Number(year)) return false;

    const hint = availabilityHints[m.tmdb_id];
    if (availabilityFilter === 'cinema' && !hint?.cinema) return false;
    if (availabilityFilter === 'streaming' && !hint?.streaming) return false;
    if (availabilityFilter === 'digital' && !hint?.digital) return false;

    return true;
  }), [movies, minRating, year, availabilityHints, availabilityFilter]);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    const next = page + 1; setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(next), mode, kind });
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/tmdb/explore?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Errore');
      const incoming: Movie[] = Array.isArray(data.movies) ? data.movies : [];
      const incomingPeople: Person[] = Array.isArray(data.people) ? data.people : [];
      setPeople(old => [...old, ...incomingPeople.filter(p => !old.some(x => x.tmdb_id === p.tmdb_id))]);
      setMovies((old) => [...old, ...incoming.filter((m) => !old.some((x) => x.tmdb_id === m.tmdb_id))]);
      setPage(next); setTotalPages(Math.max(1, Number(data.total_pages ?? totalPages)));
    } catch { setError(kind === 'person' ? 'Non riesco a caricare altre persone.' : 'Non riesco a caricare altri risultati.'); }
    finally { setLoadingMore(false); }
  };

  const heading = query.trim()
    ? `Risultati per “${query.trim()}”`
    : kind === 'person'
      ? 'Persone popolari'
      : mode === 'upcoming'
        ? 'Le prossime uscite'
        : tabs.find(t => t.id === mode)?.label ?? 'Esplora';

  const resultCount =
    kind === 'person'
      ? people.length
      : visibleMovies.length + (kind === 'all' ? people.length : 0);

  const loadMoreLabel =
    kind === 'person'
      ? 'Carica altre persone'
      : kind === 'all'
        ? 'Carica altri risultati'
        : 'Carica altri film';

  return (
    <AppShell activeNav="esplora">
      <main className="explore-page" style={{ background: P.bg, color: P.text }}>
        <style>{`
          .explore-page {
            min-height: 100vh;
            font-family: ${FONT.sans};
            padding: 34px 38px 80px;
          }

          .explore-wrap {
            max-width: 1180px;
            margin: 0 auto;
          }

          .explore-back {
            margin-bottom: 22px;
          }

          .explore-hero {
            margin-bottom: 26px;
          }

          .explore-kicker {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: ${P.pink};
            font-size: 10px;
            font-weight: 900;
            letter-spacing: .16em;
            text-transform: uppercase;
            margin-bottom: 10px;
          }

          .explore-kicker::before {
            content: '';
            width: 18px;
            height: 2px;
            background: ${P.pink};
          }

          .explore-title {
            margin: 0;
            max-width: 700px;
            font-family: ${FONT.display};
            font-size: clamp(36px, 4.7vw, 56px);
            line-height: 1;
            font-weight: 800;
            letter-spacing: -.04em;
          }

          .explore-sub {
            max-width: 610px;
            margin: 12px 0 0;
            color: ${P.textMuted};
            font-size: 13.5px;
            line-height: 1.65;
          }

          .search-panel {
            border: 1px solid ${P.border};
            background: ${P.surface};
            padding: 12px;
            border-radius: 0;
            box-shadow: 0 10px 35px rgba(0,0,0,.08);
          }

          .search-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
          }

          .search-box {
            min-height: 56px;
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 0 16px;
            border: 1px solid ${P.border};
            background: ${P.bgSoft};
            border-radius: 8px;
            transition: border-color .2s ease, box-shadow .2s ease, background .2s ease;
          }

          .search-box:focus-within {
            border-color: ${P.gold};
            background: ${P.surface};
            box-shadow: 0 0 0 3px ${P.gold}18;
          }

          .search-box input {
            width: 100%;
            min-width: 0;
            border: 0;
            outline: 0;
            background: transparent;
            color: ${P.text};
            font: 650 14px ${FONT.sans};
          }

          .search-box input::placeholder {
            color: ${P.textFaint};
            font-weight: 500;
          }

          .clear-search {
            width: 30px;
            height: 30px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            border: 0;
            background: transparent;
            color: ${P.textFaint};
            cursor: pointer;
            border-radius: 8px;
          }

          .clear-search:hover {
            color: ${P.text};
            background: ${P.surfaceHover};
          }

          .filter-button {
            min-width: 112px;
            min-height: 56px;
            border: 1px solid ${filtersOpen ? P.gold : P.border};
            background: ${filtersOpen ? `${P.gold}12` : P.bgSoft};
            color: ${filtersOpen ? P.gold : P.text};
            padding: 0 15px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 8px;
            font: 800 11px ${FONT.sans};
            cursor: pointer;
            transition: border-color .2s ease, color .2s ease, background .2s ease;
          }

          .filter-button:hover {
            border-color: ${P.gold};
          }

          .filter-count {
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            display: inline-grid;
            place-items: center;
            border-radius: 999px;
            background: ${P.gold};
            color: ${P.bg};
            font-size: 9px;
            font-weight: 900;
          }

          .search-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            margin-top: 11px;
          }

          .kind-switch {
            display: inline-flex;
            gap: 4px;
            padding: 4px;
            border: 1px solid ${P.border};
            background: ${P.bgSoft};
            border-radius: 10px;
            overflow-x: auto;
            scrollbar-width: none;
          }

          .kind-switch::-webkit-scrollbar {
            display: none;
          }

          .kind-button {
            border: 0;
            background: transparent;
            color: ${P.textMuted};
            padding: 8px 11px;
            border-radius: 999px;
            font: 800 10.5px ${FONT.sans};
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            white-space: nowrap;
          }

          .kind-button.active {
            color: ${P.text};
            background: ${P.surface};
            box-shadow: 0 1px 5px rgba(0,0,0,.08);
          }

          .search-hint {
            color: ${P.textFaint};
            font-size: 10.5px;
            text-align: right;
          }

          .discovery-tabs {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            scrollbar-width: none;
            margin-top: 16px;
            padding: 2px 0 3px;
          }

          .discovery-tabs::-webkit-scrollbar {
            display: none;
          }

          .discovery-tab {
            flex: 0 0 auto;
            border: 1px solid ${P.border};
            background: transparent;
            color: ${P.textMuted};
            padding: 10px 13px;
            border-radius: 999px;
            font: 800 10.5px ${FONT.sans};
            display: inline-flex;
            align-items: center;
            gap: 7px;
            cursor: pointer;
            white-space: nowrap;
            transition: border-color .2s ease, color .2s ease, background .2s ease;
          }

          .discovery-tab:hover {
            border-color: ${P.gold}90;
            color: ${P.text};
          }

          .discovery-tab.active {
            border-color: ${P.gold};
            color: ${P.gold};
            background: ${P.gold}10;
          }

          .filters {
            margin-top: 12px;
            padding: 14px;
            border: 1px solid ${P.border};
            background: ${P.bgSoft};
            border-radius: 12px;
          }

          .filters-grid {
            display: grid;
            grid-template-columns: 160px 170px minmax(0, 1fr) auto;
            gap: 12px;
            align-items: end;
          }

          .filter label {
            display: block;
            margin-bottom: 6px;
            color: ${P.textFaint};
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .1em;
            text-transform: uppercase;
          }

          .filter select {
            width: 100%;
            height: 40px;
            border: 1px solid ${P.border};
            background: ${P.surface};
            color: ${P.text};
            padding: 0 11px;
            border-radius: 9px;
            outline: 0;
            font: 650 11px ${FONT.sans};
          }

          .availability-filter {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            scrollbar-width: none;
          }

          .availability-filter::-webkit-scrollbar {
            display: none;
          }

          .availability-button {
            height: 40px;
            border: 1px solid ${P.border};
            background: ${P.surface};
            color: ${P.textMuted};
            padding: 0 11px;
            border-radius: 999px;
            font: 800 10px ${FONT.sans};
            cursor: pointer;
            white-space: nowrap;
          }

          .availability-button.active {
            border-color: ${P.gold};
            color: ${P.gold};
            background: ${P.gold}10;
          }

          .reset-filter {
            height: 40px;
            border: 0;
            background: transparent;
            color: ${P.pink};
            padding: 0 8px;
            font: 850 10px ${FONT.sans};
            cursor: pointer;
            white-space: nowrap;
          }

          .release-badge {
            position: absolute;
            left: 8px;
            bottom: 8px;
            z-index: 2;
            padding: 5px 7px;
            border: 1px solid ${P.gold}80;
            border-radius: 6px;
            background: ${P.bg}e8;
            color: ${P.gold};
            font: 850 8.5px ${FONT.sans};
            letter-spacing: .02em;
            backdrop-filter: blur(8px);
          }

          .results-head {
            display: flex;
            justify-content: space-between;
            align-items: end;
            gap: 18px;
            margin: 34px 0 17px;
          }

          .results-kicker {
            color: ${P.textFaint};
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .14em;
            text-transform: uppercase;
            margin-bottom: 6px;
          }

          .results-title {
            font-family: ${FONT.display};
            font-size: 26px;
            line-height: 1.08;
            font-weight: 800;
            letter-spacing: -.025em;
          }

          .count {
            color: ${P.textFaint};
            font-size: 10px;
            font-weight: 750;
            white-space: nowrap;
          }

          .people-section {
            margin-bottom: 30px;
          }

          .people-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0,1fr));
            gap: 10px;
          }

          .person-card {
            min-width: 0;
            border: 1px solid ${P.border};
            background: ${P.surface};
            color: ${P.text};
            padding: 12px;
            display: flex;
            gap: 11px;
            align-items: center;
            text-align: left;
            border-radius: 12px;
            cursor: pointer;
            font-family: ${FONT.sans};
            transition: transform .2s ease, border-color .2s ease, background .2s ease;
          }

          .person-card:hover {
            transform: translateY(-2px);
            border-color: ${P.gold}70;
            background: ${P.surfaceHover};
          }

          .person-avatar {
            width: 52px;
            height: 52px;
            flex: 0 0 auto;
            overflow: hidden;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: ${P.bgSoft};
          }

          .person-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .person-name {
            font-size: 13px;
            font-weight: 850;
          }

          .person-role {
            margin-top: 3px;
            color: ${P.pink};
            font-size: 9.5px;
            font-weight: 850;
          }

          .person-known {
            margin-top: 4px;
            color: ${P.textFaint};
            font-size: 9.5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(5, minmax(0,1fr));
            gap: 28px 16px;
          }

          .movie {
            min-width: 0;
            padding: 0;
            border: 0;
            background: transparent;
            color: ${P.text};
            text-align: left;
            cursor: pointer;
            font-family: ${FONT.sans};
          }

          .poster {
            position: relative;
            aspect-ratio: 2/3;
            overflow: hidden;
            border: 1px solid ${P.border};
            background: ${P.bgSoft};
            border-radius: 12px;
            transition: transform .23s ease, border-color .23s ease, box-shadow .23s ease;
          }

          .movie:hover .poster {
            transform: translateY(-4px);
            border-color: ${P.gold}80;
            box-shadow: 0 14px 34px rgba(0,0,0,.19);
          }

          .poster img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            transition: transform .3s ease;
          }

          .movie:hover .poster img {
            transform: scale(1.025);
          }

          .poster::after {
            content: '';
            position: absolute;
            inset: 48% 0 0;
            pointer-events: none;
            background: linear-gradient(180deg, transparent, rgba(0,0,0,.15));
            opacity: 0;
            transition: opacity .2s ease;
          }

          .movie:hover .poster::after {
            opacity: 1;
          }

          .rating {
            position: absolute;
            right: 8px;
            bottom: 8px;
            z-index: 2;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 5px 7px;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 8px;
            background: rgba(8,7,6,.82);
            backdrop-filter: blur(8px);
            color: #fff;
            font-size: 9.5px;
            font-weight: 850;
          }

          .movie-title {
            margin-top: 10px;
            color: ${P.text};
            font-size: 12.5px;
            font-weight: 850;
            line-height: 1.25;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .meta {
            margin-top: 4px;
            color: ${P.textFaint};
            font-size: 10px;
            line-height: 1.3;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .availability-row {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
            margin-top: 7px;
          }

          .availability-chip {
            padding: 4px 6px;
            border: 1px solid ${P.border};
            background: ${P.surface};
            color: ${P.textMuted};
            border-radius: 6px;
            font-size: 8.5px;
            font-weight: 850;
            white-space: nowrap;
          }

          .availability-chip.cinema {
            border-color: ${P.gold}80;
            color: ${P.gold};
            background: ${P.gold}0d;
          }

          .availability-chip.streaming {
            border-color: ${P.pink}70;
            color: ${P.pink};
            background: ${P.pink}0a;
          }

          .empty {
            grid-column: 1/-1;
            padding: 54px 20px;
            border: 1px dashed ${P.border};
            background: ${P.bgSoft};
            border-radius: 14px;
            text-align: center;
            color: ${P.textMuted};
            font-size: 12px;
          }

          .load {
            display: block;
            margin: 34px auto 0;
            padding: 11px 20px;
            border: 1px solid ${P.gold};
            background: transparent;
            color: ${P.gold};
            border-radius: 10px;
            font: 850 10.5px ${FONT.sans};
            cursor: pointer;
          }

          .load:hover {
            background: ${P.gold}0d;
          }

          @media (max-width: 1120px) {
            .grid {
              grid-template-columns: repeat(4, minmax(0,1fr));
            }

            .people-grid {
              grid-template-columns: repeat(2, minmax(0,1fr));
            }

            .filters-grid {
              grid-template-columns: repeat(2, minmax(0,1fr));
            }
          }

          @media (max-width: 760px) {
            .explore-back {
              display: none;
            }

            .explore-page {
              padding: 22px 20px 92px;
            }

            .explore-title {
              font-size: 39px;
            }

            .explore-sub {
              font-size: 12.5px;
            }

            .search-panel {
              padding: 9px;
              border-radius: 0;
            }

            .search-row {
              grid-template-columns: 1fr auto;
            }

            .filter-button {
              min-width: 56px;
              width: 56px;
              padding: 0;
            }

            .filter-button span.label {
              display: none;
            }

            .search-meta {
              align-items: flex-start;
              flex-direction: column;
            }

            .search-hint {
              display: none;
            }

            .filters-grid {
              grid-template-columns: 1fr;
            }

            .results-head {
              margin-top: 28px;
              align-items: flex-start;
            }

            .results-title {
              font-size: 23px;
            }

            .grid {
              grid-template-columns: repeat(3, minmax(0,1fr));
              gap: 22px 10px;
            }

            .people-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 410px) {
            .grid {
              grid-template-columns: repeat(2, minmax(0,1fr));
            }

            .count {
              display: none;
            }
          }
        `}</style>

        <div className="explore-wrap">
          <div className="explore-back">
            <BackButton onClick={() => router.back()} />
          </div>

          <header className="explore-hero">
            <div className="explore-kicker">Esplora CineDate</div>
            <h1 className="explore-title">Trova il prossimo film.</h1>
            <p className="explore-sub">
              {mode === 'now_playing' && !query.trim() && kind !== 'person'
                ? 'Film realmente presenti nella programmazione cinema raccolta da CineDate nei prossimi giorni.'
                : 'Cerca un titolo, un attore o un regista. Oppure lasciati guidare dai film che stanno facendo parlare tutti.'}
            </p>
          </header>

          <section className="search-panel" aria-label="Ricerca e filtri">
            <div className="search-row">
              <div className="search-box">
                <MagnifyingGlass size={20} color={P.gold} />
                <input
                  autoFocus={false}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    kind === 'movie'
                      ? 'Cerca un film...'
                      : kind === 'person'
                        ? 'Cerca un attore o regista...'
                        : 'Cerca film, attori o registi...'
                  }
                />
                {query && (
                  <button
                    className="clear-search"
                    onClick={() => setQuery('')}
                    aria-label="Pulisci ricerca"
                    type="button"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button
                className="filter-button"
                onClick={() => setFiltersOpen((value) => !value)}
                aria-label="Filtri"
                aria-expanded={filtersOpen}
                type="button"
              >
                <FunnelSimple size={18} weight={filtersOpen ? 'fill' : 'regular'} />
                <span className="label">Filtri</span>
                {(minRating > 0 || year || availabilityFilter !== 'all') && (
                  <span className="filter-count">
                    {Number(minRating > 0) + Number(Boolean(year)) + Number(availabilityFilter !== 'all')}
                  </span>
                )}
              </button>
            </div>

            <div className="search-meta">
              <div className="kind-switch" aria-label="Tipo di ricerca">
                {([
                  ['all', 'Tutto'],
                  ['movie', 'Film'],
                  ['person', 'Persone'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`kind-button${kind === id ? ' active' : ''}`}
                    onClick={() => setKind(id)}
                  >
                    {id === 'movie' ? <FilmSlate size={13} /> : id === 'person' ? <User size={13} /> : <Sparkle size={13} />}
                    {label}
                  </button>
                ))}
              </div>

              <div className="search-hint">
                {query.trim()
                  ? 'I risultati si aggiornano mentre scrivi'
                  : 'Scegli una categoria o cerca direttamente'}
              </div>
            </div>

            {filtersOpen && kind !== 'person' && (
              <div className="filters">
                <div className="filters-grid">
                  <div className="filter">
                    <label>Voto minimo</label>
                    <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                      <option value={0}>Qualsiasi</option>
                      <option value={6}>6+</option>
                      <option value={7}>7+</option>
                      <option value={8}>8+</option>
                    </select>
                  </div>

                  <div className="filter">
                    <label>Anno</label>
                    <select value={year} onChange={(e) => setYear(e.target.value)}>
                      <option value="">Tutti gli anni</option>
                      {Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter">
                    <label>Dove guardarlo</label>
                    <div className="availability-filter">
                      {([
                        ['all', 'Tutti'],
                        ['cinema', 'Cinema'],
                        ['streaming', 'Streaming'],
                        ['digital', 'Digitale'],
                      ] as const).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={`availability-button${availabilityFilter === id ? ' active' : ''}`}
                          onClick={() => setAvailabilityFilter(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(minRating > 0 || year || availabilityFilter !== 'all') && (
                    <button
                      className="reset-filter"
                      type="button"
                      onClick={() => {
                        setMinRating(0);
                        setYear('');
                        setAvailabilityFilter('all');
                      }}
                    >
                      Azzera filtri
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {!query.trim() && kind !== 'person' && (
            <nav className="discovery-tabs" aria-label="Categorie film">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`discovery-tab${active ? ' active' : ''}`}
                    onClick={() => {
                      setQuery('');
                      setMode(tab.id);
                      void router.replace(
                        { pathname: '/esplora', query: { tab: tab.id } },
                        undefined,
                        { shallow: true }
                      );
                    }}
                  >
                    <Icon size={14} weight={active ? 'fill' : 'regular'} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          )}
<div className="results-head">
            <div>
              <div className="results-kicker">
                {query.trim()
                  ? 'Risultati di ricerca'
                  : kind === 'person'
                    ? 'Persone'
                    : mode === 'upcoming'
                      ? 'In arrivo'
                      : 'Scopri'}
              </div>
              <div className="results-title">{heading}</div>
            </div>
            <div className="count">
              {loading ? 'Caricamento…' : `${resultCount} risultati`}
            </div>
          </div>

          {!loading && people.length > 0 && (
            <section className="people-section">
              <div className="people-grid">
                {people.map((person) => (
                  <button
                    key={person.tmdb_id}
                    className="person-card"
                    onClick={() => router.push(`/persona/${person.tmdb_id}`)}
                    type="button"
                  >
                    <div className="person-avatar">
                      {person.photo ? (
                        <img src={person.photo} alt={person.name} />
                      ) : (
                        <User size={22} color={P.textFaint} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="person-name">{person.name}</div>
                      <div className="person-role">
                        {person.known_for_department === 'Directing'
                          ? 'Regia'
                          : person.known_for_department === 'Acting'
                            ? 'Recitazione'
                            : person.known_for_department || 'Cinema'}
                      </div>
                      {person.known_for.length > 0 && (
                        <div className="person-known">
                          Conosciuto per: {person.known_for.slice(0, 3).map((movie) => movie.title).join(', ')}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {kind !== 'person' && (
          <div className="grid">
            {loading ? (
              Array.from({ length: 10 }, (_, i) => (
                <div key={i}>
                  <div className="poster" style={{ opacity: .45 }} />
                  <div style={{ height: 10, background: P.bgSoft, marginTop: 9, width: '74%', borderRadius: 6 }} />
                  <div style={{ height: 8, background: P.bgSoft, marginTop: 6, width: '45%', borderRadius: 6 }} />
                </div>
              ))
            ) : error ? (
              <div className="empty">{error}</div>
            ) : visibleMovies.length === 0 ? (
              <div className="empty">
                <FilmSlate size={30} weight="duotone" color={P.gold} />
                <div style={{ marginTop: 10, fontWeight: 850, color: P.text }}>
                  Nessun film trovato
                </div>
                <div style={{ marginTop: 5 }}>
                  Prova un altro titolo o modifica i filtri.
                </div>
              </div>
            ) : (
              visibleMovies.map((movie) => {
                const validTmdbId =
                  Number.isInteger(Number(movie.tmdb_id)) &&
                  Number(movie.tmdb_id) > 0;

                const hint = availabilityHints[movie.tmdb_id];

                const availability = {
                  cinema:
                    Boolean(movie.in_cinema) ||
                    Boolean(hint?.cinema),
                  streaming: hint?.streaming ?? false,
                  digital: hint?.digital ?? false,
                  cinemaNames: hint?.cinema_names ?? [],
                  streamingProviders: hint?.streaming_providers ?? [],
                  digitalProviders: hint?.digital_providers ?? [],
                };

                const cinemaBadges =
                  mode === 'upcoming' && availability.cinema
                    ? availability.cinemaNames.length > 0
                      ? availability.cinemaNames
                          .slice(0, 2)
                          .map((cinemaName) => `Già prenotabile nei cinema (${cinemaName})`)
                      : ['Già prenotabile al cinema']
                    : availability.cinemaNames.length > 0
                      ? availability.cinemaNames.slice(0, 2)
                      : availability.cinema
                        ? ['Cinema']
                        : [];

                const streamingBadges =
                  availability.streamingProviders.length > 0
                    ? availability.streamingProviders.slice(0, 2)
                    : availability.streaming
                      ? ['Streaming']
                      : [];

                const digitalBadges =
                  !availability.streaming &&
                  availability.digitalProviders.length > 0
                    ? availability.digitalProviders.slice(0, 1)
                    : !availability.streaming && availability.digital
                      ? ['Noleggio / acquisto']
                      : [];

                const extraAvailabilityCount =
                  Math.max(0, availability.cinemaNames.length - cinemaBadges.length) +
                  Math.max(0, availability.streamingProviders.length - streamingBadges.length) +
                  Math.max(0, availability.digitalProviders.length - digitalBadges.length);

                return (
                  <button
                    key={`${movie.tmdb_id}-${movie.title}`}
                    className="movie"
                    onClick={() => {
                      if (validTmdbId) {
                        void router.push(`/film/${movie.tmdb_id}`);
                      }
                    }}
                    type="button"
                    aria-disabled={!validTmdbId}
                    title={!validTmdbId ? 'Scheda film in aggiornamento' : undefined}
                    style={!validTmdbId ? { cursor: 'default' } : undefined}
                  >
                    <div className="poster">
                      {movie.cover ? (
                        <img src={movie.cover} alt={movie.title} loading="lazy" />
                      ) : (
                        <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: P.textFaint }}>
                          <FilmSlate size={30} />
                        </div>
                      )}
                      <div className="rating">
                        <Star size={10} weight="fill" color={P.gold} />
                        {Number(movie.rating || 0).toFixed(1)}
                      </div>

                      {mode === 'upcoming' && movie.release_date && (
                        <div className="release-badge">
                          {releaseBadge(movie.release_date)}
                        </div>
                      )}
                    </div>

                    <div className="movie-title">{movie.title}</div>
                    <div className="meta">
                      {mode === 'upcoming'
                        ? formatReleaseDate(movie.release_date) || movie.year || 'Data n/d'
                        : movie.year || 'Anno n/d'}
                      {movie.genre ? ` · ${movie.genre}` : ''}
                    </div>

                    <div className="availability-row">
                      {cinemaBadges.map((label) => (
                        <span
                          key={`cinema-${label}`}
                          className="availability-chip cinema"
                        >
                          {label}
                        </span>
                      ))}

                      {streamingBadges.map((label) => (
                        <span
                          key={`streaming-${label}`}
                          className="availability-chip streaming"
                        >
                          {label}
                        </span>
                      ))}

                      {digitalBadges.map((label) => (
                        <span
                          key={`digital-${label}`}
                          className="availability-chip"
                        >
                          {label}
                        </span>
                      ))}

                      {extraAvailabilityCount > 0 && (
                        <span className="availability-chip">
                          +{extraAvailabilityCount}
                        </span>
                      )}

                      {!availabilityLoading &&
                        cinemaBadges.length === 0 &&
                        streamingBadges.length === 0 &&
                        digitalBadges.length === 0 &&
                        mode === 'upcoming' && (
                          <span className="availability-chip upcoming">
                            Prossimamente
                          </span>
                        )}

                      {!availabilityLoading &&
                        cinemaBadges.length === 0 &&
                        streamingBadges.length === 0 &&
                        digitalBadges.length === 0 &&
                        mode !== 'upcoming' && (
                          <span className="availability-chip">
                            Nessuna disponibilità rilevata
                          </span>
                        )}

                      {!validTmdbId && (
                        <span className="availability-chip">
                          Scheda in aggiornamento
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          )}

          {!loading && !error && kind === 'person' && people.length === 0 && (
            <div className="empty">
              <User size={30} weight="duotone" color={P.pink} />
              <div style={{ marginTop: 10, fontWeight: 850, color: P.text }}>
                Nessuna persona trovata
              </div>
              <div style={{ marginTop: 5 }}>
                Prova a cercare un altro attore o regista.
              </div>
            </div>
          )}

          {!loading && !error && page < totalPages && (
            <button
              className="load"
              onClick={loadMore}
              disabled={loadingMore}
              type="button"
            >
              {loadingMore ? 'Caricamento…' : loadMoreLabel}
            </button>
          )}
        </div>
      </main>
    </AppShell>
  );
}
