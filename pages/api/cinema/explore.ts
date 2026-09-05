import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

const PAGE_SIZE = 1000;
const MAX_ROWS = 15000;
const DAYS = 7;
const MAX_FILMS = 40;

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeShowingDate(value: unknown) {
  const raw = String(value ?? '').trim();

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const it = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (it) return `${it[3]}-${it[2]}-${it[1]}`;

  return '';
}

function normalizeTitle(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(2d|3d|4dx|imax|imax laser|screenx|dolby|dolby atmos|atmos|isense|original version|versione originale|vo|v o|ita|italiano|evento speciale)\b/g, ' ')
    .replace(/\b(sub ita|sottotitolato|anteprima|speciale|maratona)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchTitle(value: unknown) {
  let title = String(value ?? '').trim();

  // Suffix/provider metadata frequently appended by cinema feeds.
  title = title
    .replace(/\s+[|–—-]\s+(2d|3d|4dx|imax|screenx|isense|dolby.*|vo|v\.o\.|ita|italiano).*$/i, '')
    .replace(/\s+\((2d|3d|4dx|imax|screenx|isense|vo|v\.o\.|ita|italiano|.*atmos.*)\)\s*$/i, '')
    .trim();

  const normalized = normalizeTitle(title);
  return normalized || title;
}

function titleTokens(value: unknown) {
  return new Set(
    normalizeTitle(value)
      .split(' ')
      .filter((token) => token.length > 1)
  );
}

function titleScore(target: string, candidate: string) {
  const a = normalizeTitle(target);
  const b = normalizeTitle(candidate);

  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 88;

  const aTokens = titleTokens(a);
  const bTokens = titleTokens(b);

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let common = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) common += 1;
  }

  return Math.round(
    (common / Math.max(aTokens.size, bTokens.size)) * 80
  );
}

type ShowingRow = {
  cinema_id: number | null;
  film_id: string | number | null;
  tmdb_id: number | null;
  film_title: string | null;
  poster_url: string | null;
  duration: string | null;
  session_id: string | null;
  showing_date: string | null;
  time: string | null;
  hall: string | null;
  format: string | null;
  booking_url: string | null;
};

type AggregatedFilm = {
  key: string;
  tmdb_id: number | null;
  title: string;
  posterUrl: string | null;
  showingCount: number;
  cinemaIds: Set<number>;
  firstShowingDate: string;
};

async function resolveTmdbByTitle(title: string, apiKey: string) {
  const queries = [
    searchTitle(title),
    normalizeTitle(title),
    String(title ?? '').trim(),
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  let bestMovie: any = null;
  let bestScore = 0;

  for (const query of queries) {
    for (const language of ['it-IT', 'en-US']) {
      try {
        const params = new URLSearchParams({
          api_key: apiKey,
          language,
          region: 'IT',
          include_adult: 'false',
          query,
        });

        const response = await fetch(
          `https://api.themoviedb.org/3/search/movie?${params.toString()}`
        );

        if (!response.ok) continue;

        const data = await response.json();
        const results = Array.isArray(data?.results) ? data.results : [];

        for (const movie of results.slice(0, 10)) {
          const score = Math.max(
            titleScore(title, movie?.title ?? ''),
            titleScore(title, movie?.original_title ?? '')
          );

          if (score > bestScore) {
            bestScore = score;
            bestMovie = movie;
          }
        }

        if (bestScore >= 100) return bestMovie;
      } catch {
        // Prova la query/lingua successiva.
      }
    }
  }

  // Evitiamo associazioni casuali: sotto questa soglia il film resta unresolved.
  return bestScore >= 55 ? bestMovie : null;
}

async function fetchTmdbDetails(tmdbId: number, apiKey: string) {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${encodeURIComponent(apiKey)}&language=it-IT`
    );

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient();

    /*
     * IMPORTANT:
     * non filtriamo le date lato Supabase.
     *
     * Nella repo esistente showtimes.ts fa già la stessa scelta perché
     * showing_date può arrivare come date, timestamp o DD/MM/YYYY.
     * Lo normalizziamo qui dopo il fetch, così la sorgente resta compatibile
     * con The Space, UCI e futuri provider che alimentano cinema_showings.
     */
    const allRows: ShowingRow[] = [];

    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('cinema_showings')
        .select(`
          cinema_id,
          film_id,
          tmdb_id,
          film_title,
          poster_url,
          duration,
          session_id,
          showing_date,
          time,
          hall,
          format,
          booking_url
        `)
        .order('showing_date', { ascending: true })
        .order('film_title', { ascending: true })
        .order('time', { ascending: true })
        .range(from, to);

      if (error) throw error;

      const batch = (data ?? []) as ShowingRow[];
      allRows.push(...batch);

      if (batch.length < PAGE_SIZE) break;
    }

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const requestedDates = Array.from({ length: DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() + index);
      return dateKey(date);
    });

    const allowedDates = new Set(requestedDates);

    const weekRows = allRows.filter((row) =>
      allowedDates.has(normalizeShowingDate(row.showing_date))
    );

    const grouped = new Map<string, AggregatedFilm>();

    for (const row of weekRows) {
      const title = String(row.film_title ?? '').trim();
      if (!title) continue;

      const tmdbId = Number(row.tmdb_id);
      const validTmdbId = Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : null;

      /*
       * Chiave provider-agnostica:
       * - se il provider ci dà tmdb_id, usiamo quello;
       * - altrimenti usiamo un titolo normalizzato.
       *
       * Questo permette di aggregare The Space, UCI e futuri cinema
       * anche se le API non forniscono tutte lo stesso identificatore.
       */
      const key = validTmdbId
        ? `tmdb:${validTmdbId}`
        : `title:${normalizeTitle(title)}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          tmdb_id: validTmdbId,
          title,
          posterUrl: row.poster_url ?? null,
          showingCount: 0,
          cinemaIds: new Set<number>(),
          firstShowingDate: normalizeShowingDate(row.showing_date),
        });
      }

      const film = grouped.get(key)!;
      film.showingCount += 1;

      const cinemaId = Number(row.cinema_id);
      if (Number.isInteger(cinemaId) && cinemaId > 0) {
        film.cinemaIds.add(cinemaId);
      }

      if (!film.posterUrl && row.poster_url) {
        film.posterUrl = row.poster_url;
      }

      const showingDate = normalizeShowingDate(row.showing_date);
      if (
        showingDate &&
        (!film.firstShowingDate || showingDate < film.firstShowingDate)
      ) {
        film.firstShowingDate = showingDate;
      }
    }

    const seeds = [...grouped.values()]
      .sort((a, b) => {
        if (a.firstShowingDate !== b.firstShowingDate) {
          return a.firstShowingDate.localeCompare(b.firstShowingDate);
        }

        if (b.cinemaIds.size !== a.cinemaIds.size) {
          return b.cinemaIds.size - a.cinemaIds.size;
        }

        return b.showingCount - a.showingCount;
      })
      .slice(0, MAX_FILMS);

    const apiKey = process.env.TMDB_API_KEY;

    const movies = await Promise.all(
      seeds.map(async (seed) => {
        let resolvedTmdbId = seed.tmdb_id;
        let tmdbMovie: any = null;

        /*
         * Le API cinema possono non avere tmdb_id.
         * In quel caso risolviamo il film dal titolo e usiamo TMDB solo
         * come catalogo di metadati, non come fonte della programmazione.
         */
        if (!resolvedTmdbId && apiKey) {
          tmdbMovie = await resolveTmdbByTitle(seed.title, apiKey);
          const id = Number(tmdbMovie?.id);

          if (Number.isInteger(id) && id > 0) {
            resolvedTmdbId = id;
          }
        }

        if (!tmdbMovie && resolvedTmdbId && apiKey) {
          tmdbMovie = await fetchTmdbDetails(resolvedTmdbId, apiKey);
        }

        return {
          tmdb_id: resolvedTmdbId ?? 0,
          title: tmdbMovie?.title || seed.title,
          year: tmdbMovie?.release_date
            ? Number(String(tmdbMovie.release_date).slice(0, 4)) || null
            : null,
          cover: tmdbMovie?.poster_path
            ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
            : seed.posterUrl,
          rating: Number(tmdbMovie?.vote_average ?? 0),
          vote_count: Number(tmdbMovie?.vote_count ?? 0),
          genre:
            Array.isArray(tmdbMovie?.genres) && tmdbMovie.genres.length > 0
              ? tmdbMovie.genres[0]?.name
              : undefined,
          overview: tmdbMovie?.overview ?? null,
          cinema_count: seed.cinemaIds.size,
          showing_count: seed.showingCount,
          first_showing_date: seed.firstShowingDate,
          source: 'cinema_showings',
          in_cinema: true,
          provider_title: seed.title,
          tmdb_resolved: Boolean(resolvedTmdbId),
        };
      })
    );

    res.setHeader(
      'Cache-Control',
      's-maxage=300, stale-while-revalidate=600'
    );

    return res.status(200).json({
      movies,
      people: [],
      page: 1,
      total_pages: 1,
      source: 'cinema_showings',
      range: {
        from: requestedDates[0],
        to: requestedDates[requestedDates.length - 1],
      },
      debug: {
        total_rows: allRows.length,
        week_rows: weekRows.length,
        grouped_films: grouped.size,
        rows_without_tmdb_id: weekRows.filter((row) => {
          const id = Number(row.tmdb_id);
          return !Number.isInteger(id) || id <= 0;
        }).length,
        tmdb_api_configured: Boolean(apiKey),
        unresolved_titles: movies
          .filter((movie) => !movie.tmdb_resolved)
          .map((movie) => movie.provider_title)
          .slice(0, 30),
        date_samples: [
          ...new Set(
            allRows
              .map((row) => normalizeShowingDate(row.showing_date))
              .filter(Boolean)
          ),
        ].slice(0, 20),
      },
    });
  } catch (error: any) {
    console.error('Cinema explore error:', error);

    return res.status(500).json({
      error:
        error?.message ||
        'Errore caricamento programmazione cinema',
    });
  }
}
