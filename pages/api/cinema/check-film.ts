import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(t: string): string {
  return t.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.length > 4 && nb.includes(na)) return true;
  if (nb.length > 4 && na.includes(nb)) return true;
  const wordsA = na.split(' ').filter((w) => w.length > 2);
  const wordsB = nb.split(' ').filter((w) => w.length > 2);
  const common = wordsA.filter((w) => wordsB.includes(w));
  return common.length >= Math.min(2, Math.min(wordsA.length, wordsB.length));
}

function todayKey(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { title, lat, lng, radius = '25' } = req.query;
  if (!title || !lat || !lng) return res.status(400).json({ error: 'title, lat, lng obbligatori' });

  const userLat = parseFloat(lat as string);
  const userLng = parseFloat(lng as string);
  const radiusKm = parseInt(radius as string) || 25;
  const filmTitle = title as string;

  try {
    const supabase = createClient();

    const { data: cinemas, error: cinemaError } = await supabase.from('cinemas').select('*');
    if (cinemaError) throw cinemaError;

    const nearbyCinemas = (cinemas ?? [])
      .map((c: any) => ({ ...c, distanceKm: getDistanceKm(userLat, userLng, c.lat, c.lng) }))
      .filter((c: any) => c.distanceKm <= radiusKm)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
      .slice(0, 5);

    if (nearbyCinemas.length === 0) {
      return res.status(200).json({ inCinema: false, showings: [], filmTitle });
    }

    const cinemaIds = nearbyCinemas.map((c: any) => c.id);
    const today = todayKey();

    const { data: rows, error: showingsError } = await supabase
      .from('cinema_showings')
      .select('*')
      .in('cinema_id', cinemaIds)
      .eq('showing_date', today);

    if (showingsError) throw showingsError;

 
const showings: Array<{
  cinema: string;
  cinemaId: number;
  distanceKm: number;
  sessions: {
    time: string;
    date: string;
    bookingUrl: string;
  }[];
}> = [];

for (const cinema of nearbyCinemas) {
  const cinemaRows = (rows ?? []).filter(
    (r: any) => r.cinema_id === cinema.id
  );

  const matchRows = cinemaRows.filter(
    (r: any) => titlesMatch(r.film_title ?? '', filmTitle)
  );

  if (matchRows.length === 0) continue;

  const sessions = matchRows
    .map((r: any) => ({
      time: r.time,
      date: r.showing_date,
      bookingUrl: r.booking_url,
    }))
    .filter((s: any) => s.time)
    .slice(0, 5);

  showings.push({
    cinema: cinema.name,
    cinemaId: cinema.id,
    distanceKm: Math.round(cinema.distanceKm * 10) / 10,
    sessions,
  });
}

showings.sort((a, b) => a.distanceKm - b.distanceKm);

return res.status(200).json({
  inCinema: showings.length > 0,
  showings,
  filmTitle,
});
 

  } catch (err: any) {
    console.error('Cinema check-film (Supabase) error:', err);
    return res.status(500).json({ error: err.message });
  }
}