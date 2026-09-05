import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length > 4 && right.includes(left)) return true;
  if (right.length > 4 && left.includes(right)) return true;

  const wordsA = left.split(' ').filter((word) => word.length > 2);
  const wordsB = right.split(' ').filter((word) => word.length > 2);
  const common = wordsA.filter((word) => wordsB.includes(word));

  return common.length >= Math.min(2, Math.min(wordsA.length, wordsB.length));
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeShowingDate(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;

  return localDateKey(parsed);
}

function allowedDateKeys(days: number): Set<string> {
  const result = new Set<string>();
  const now = new Date();

  for (let index = 0; index < days; index += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    result.add(localDateKey(date));
  }

  return result;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    title,
    lat,
    lng,
    radius = '25',
    days: requestedDays = '7',
  } = req.query;

  if (!title || !lat || !lng) {
    return res.status(400).json({
      error: 'title, lat, lng obbligatori',
    });
  }

  const userLat = Number(lat);
  const userLng = Number(lng);
  const radiusKm = Math.max(1, Math.min(Number(radius) || 25, 100));
  const days = Math.max(1, Math.min(Number(requestedDays) || 7, 14));
  const filmTitle = String(title);

  if (Number.isNaN(userLat) || Number.isNaN(userLng)) {
    return res.status(400).json({ error: 'Coordinate non valide' });
  }

  try {
    const supabase = createClient();

    const { data: cinemas, error: cinemaError } = await supabase
      .from('cinemas')
      .select('*');

    if (cinemaError) throw cinemaError;

    const nearbyCinemas = (cinemas ?? [])
      .filter(
        (cinema: any) =>
          typeof cinema.lat === 'number' &&
          typeof cinema.lng === 'number'
      )
      .map((cinema: any) => ({
        ...cinema,
        distanceKm: getDistanceKm(
          userLat,
          userLng,
          cinema.lat,
          cinema.lng
        ),
      }))
      .filter((cinema: any) => cinema.distanceKm <= radiusKm)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
      .slice(0, 8);

    if (nearbyCinemas.length === 0) {
      return res.status(200).json({
        inCinema: false,
        showings: [],
        filmTitle,
        days,
      });
    }

    const cinemaIds = nearbyCinemas.map((cinema: any) => cinema.id);
    const dateKeys = allowedDateKeys(days);

    /*
     * Evitiamo il filtro diretto su showing_date perché nel progetto
     * questa colonna può arrivare con formati date/timestamp differenti.
     * Leggiamo le proiezioni dei cinema vicini e normalizziamo in JS.
     */
    const { data: rows, error: showingsError } = await supabase
      .from('cinema_showings')
      .select('*')
      .in('cinema_id', cinemaIds);

    if (showingsError) throw showingsError;

    const usableRows = (rows ?? [])
      .map((row: any) => ({
        ...row,
        normalizedDate: normalizeShowingDate(row.showing_date),
      }))
      .filter(
        (row: any) =>
          row.normalizedDate &&
          dateKeys.has(row.normalizedDate) &&
          titlesMatch(row.film_title ?? '', filmTitle)
      );

    const showings = nearbyCinemas
      .map((cinema: any) => {
        const cinemaRows = usableRows.filter(
          (row: any) => row.cinema_id === cinema.id
        );

        const sessions = cinemaRows
          .map((row: any) => ({
            time: row.time ?? '',
            date: row.normalizedDate,
            bookingUrl: row.booking_url ?? '',
          }))
          .filter((session: any) => session.time && session.date)
          .sort((a: any, b: any) => {
            if (a.date !== b.date) {
              return a.date.localeCompare(b.date);
            }

            return String(a.time).localeCompare(String(b.time));
          });

        if (sessions.length === 0) return null;

        return {
          cinema: cinema.name,
          cinemaId: cinema.id,
          distanceKm: Math.round(cinema.distanceKm * 10) / 10,
          sessions,
          bookingUrl:
            sessions.find((session: any) => session.bookingUrl)?.bookingUrl ??
            '',
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

    return res.status(200).json({
      inCinema: showings.length > 0,
      showings,
      filmTitle,
      days,
    });
  } catch (error: any) {
    console.error('Cinema check-film error:', error);

    return res.status(500).json({
      error: error?.message ?? 'Errore cinema',
    });
  }
}
