import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

export type ShowtimeSession = {
  id: string;
  time: string;
  hall: string | null;
  format: string | null;
  bookingUrl: string;
};

export type ShowtimeFilm = {
  id: string;
  title: string;
  posterUrl: string | null;
  duration: string | null;
  sessions: ShowtimeSession[];
};

export type ShowtimeDay = {
  date: string;
  films: ShowtimeFilm[];
};

function dateKeyFor(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cinemaId = String(req.query.cinemaId ?? '');
  if (!cinemaId) return res.status(400).json({ error: 'cinemaId obbligatorio' });

  try {
    const supabase = createClient();
    const dateKeys = Array.from({ length: 7 }, (_, i) => dateKeyFor(i));

    const { data, error } = await supabase
      .from('cinema_showings')
      .select('*')
      .eq('cinema_id', Number(cinemaId))
      .in('showing_date', dateKeys)
      .order('showing_date', { ascending: true })
      .order('time', { ascending: true });

    if (error) throw error;

    const rows = data ?? [];

    const days: ShowtimeDay[] = dateKeys.map((dateKey) => {
      const rowsForDay = rows.filter((r: any) => r.showing_date === dateKey);

      const filmsMap = new Map<string, ShowtimeFilm>();
      for (const r of rowsForDay) {
        const filmKey = String(r.film_id);
        if (!filmsMap.has(filmKey)) {
          filmsMap.set(filmKey, {
            id: filmKey,
            title: r.film_title,
            posterUrl: r.poster_url ?? null,
            duration: r.duration ?? null,
            sessions: [],
          });
        }
        filmsMap.get(filmKey)!.sessions.push({
          id: String(r.session_id ?? r.id),
          time: r.time,
          hall: r.hall ?? null,
          format: r.format ?? null,
          bookingUrl: r.booking_url,
        });
      }

      return { date: dateKey, films: Array.from(filmsMap.values()) };
    });

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    return res.status(200).json({ cinemaId, days });
  } catch (err: any) {
    console.error('Cinema showtimes (Supabase) error:', err);
    return res.status(500).json({ error: err.message ?? 'Errore interno' });
  }
}