import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

const PAGE_SIZE = 1000;
const MAX_ROWS = 10000;
const DAYS = 7;

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeShowingDate(value: unknown) {
  const raw = String(value ?? '').trim();

  // date / timestamp ISO
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  // eventuale formato DD/MM/YYYY
  const it = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (it) return `${it[3]}-${it[2]}-${it[1]}`;

  return '';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawCinemaId = Array.isArray(req.query.cinemaId)
    ? req.query.cinemaId[0]
    : req.query.cinemaId;

  const cinemaId = Number(rawCinemaId);

  if (!Number.isFinite(cinemaId)) {
    return res.status(400).json({ error: 'cinemaId non valido' });
  }

  try {
    const supabase = createClient();

    /*
     * Non applichiamo più gte/lte lato Supabase.
     * Leggiamo tutte le proiezioni del cinema a pagine da 1000:
     * - niente truncation silenziosa a 1000 righe
     * - niente problemi di confronto date/timestamp
     */
    const allRows: any[] = [];

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
        .eq('cinema_id', cinemaId)
        .order('showing_date', { ascending: true })
        .order('film_title', { ascending: true })
        .order('time', { ascending: true })
        .range(from, to);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const batch = data ?? [];
      allRows.push(...batch);

      if (batch.length < PAGE_SIZE) break;
    }

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const requestedDates = Array.from({ length: DAYS }, (_, index) => {
      const d = new Date(today);
      d.setDate(d.getDate() + index);
      return dateKey(d);
    });

    const allowedDates = new Set(requestedDates);

    const weekRows = allRows.filter((row: any) =>
      allowedDates.has(normalizeShowingDate(row.showing_date))
    );

    const filmsByDay = new Map<string, Map<string, any>>(
      requestedDates.map((date) => [date, new Map()])
    );

    for (const row of weekRows) {
      const day = normalizeShowingDate(row.showing_date);
      const films = filmsByDay.get(day);
      if (!films) continue;

      const filmKey = String(
        row.film_id ??
        row.tmdb_id ??
        row.film_title
      );

      if (!films.has(filmKey)) {
        films.set(filmKey, {
          id: row.film_id ?? row.tmdb_id ?? filmKey,
          tmdb_id: row.tmdb_id ?? null,
          title: row.film_title,
          posterUrl: row.poster_url ?? null,
          duration: row.duration ?? null,
          sessions: [],
        });
      }

      films.get(filmKey).sessions.push({
        id:
          row.session_id ??
          `${cinemaId}-${day}-${filmKey}-${row.time}`,
        time: row.time,
        format: row.format ?? null,
        hall: row.hall ?? null,
        bookingUrl: row.booking_url ?? null,
      });
    }

    const days = requestedDates.map((date) => ({
      date,
      films: [...(filmsByDay.get(date)?.values() ?? [])],
    }));

    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json({
      days,
      meta: {
        cinema_id: cinemaId,
        total_rows_for_cinema: allRows.length,
        week_rows: weekRows.length,
        dates_in_database: [
          ...new Set(
            allRows
              .map((row: any) => normalizeShowingDate(row.showing_date))
              .filter(Boolean)
          ),
        ].sort(),
        requested_dates: requestedDates,
        rows_by_requested_date: Object.fromEntries(
          requestedDates.map((date) => [
            date,
            weekRows.filter(
              (row: any) =>
                normalizeShowingDate(row.showing_date) === date
            ).length,
          ])
        ),
      },
    });
  } catch (error) {
    console.error('Cinema weekly showtimes error:', error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Errore caricamento programmazione',
    });
  }
}
