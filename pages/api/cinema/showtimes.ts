import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const DAYS = 7;
const PAGE_SIZE = 1000;

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      'Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function groupFilms(rows: any[]) {
  const films = new Map<string, any>();

  for (const row of rows) {
    const filmKey = String(
      row.film_id ??
      row.tmdb_id ??
      row.film_title
    );

    if (!films.has(filmKey)) {
      films.set(filmKey, {
        id: row.film_id ?? row.tmdb_id ?? filmKey,
        title: row.film_title,
        posterUrl: row.poster_url ?? null,
        duration: row.duration ?? null,
        sessions: [],
      });
    }

    films.get(filmKey).sessions.push({
      id:
        row.session_id ??
        `${row.cinema_id}-${row.showing_date}-${filmKey}-${row.time}`,
      time: row.time,
      format: row.format ?? null,
      hall: row.hall ?? null,
      bookingUrl: row.booking_url ?? null,
    });
  }

  return [...films.values()];
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
    return res.status(400).json({
      error: 'cinemaId non valido',
    });
  }

  try {
    const supabase = getAdminSupabase();

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const dates = Array.from(
      { length: DAYS },
      (_, offset) => {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        return dateKey(d);
      }
    );

    const resultDays: Array<{
      date: string;
      films: any[];
    }> = [];

    const rowsByDate: Record<string, number> = {};

    // Recuperiamo anche il cinema per debug/coerenza.
    const { data: cinema, error: cinemaError } =
      await supabase
        .from('cinemas')
        .select('id, name, city, slug')
        .eq('id', cinemaId)
        .maybeSingle();

    if (cinemaError) {
      return res.status(500).json({
        error: cinemaError.message,
      });
    }

    for (const date of dates) {
      const allRows: any[] = [];

      for (let from = 0; ; from += PAGE_SIZE) {
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
          .eq('showing_date', date)
          .order('film_title', { ascending: true })
          .order('time', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          return res.status(500).json({
            error: error.message,
            cinema_id: cinemaId,
            date,
          });
        }

        const batch = data ?? [];
        allRows.push(...batch);

        if (batch.length < PAGE_SIZE) break;
      }

      rowsByDate[date] = allRows.length;

      resultDays.push({
        date,
        films: groupFilms(allRows),
      });
    }

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate'
    );

    return res.status(200).json({
      days: resultDays,
      meta: {
        source: 'service_role',
        cinema,
        cinema_id: cinemaId,
        requested_dates: dates,
        rows_by_date: rowsByDate,
      },
    });
  } catch (error) {
    console.error('Cinema showtimes API error:', error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Errore caricamento programmazione',
    });
  }
}