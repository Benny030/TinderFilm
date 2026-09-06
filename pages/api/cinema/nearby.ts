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

function validCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lng, radius = '25' } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat e lng obbligatori' });

  const userLat = Number.parseFloat(lat as string);
  const userLng = Number.parseFloat(lng as string);

  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    return res.status(400).json({ error: 'Coordinate non valide' });
  }

  const radiusValue = Array.isArray(radius) ? radius[0] : radius;
  const showAll = String(radiusValue).toLowerCase() === 'all';
  const parsedRadius = Number.parseInt(String(radiusValue), 10);
  const radiusKm = Number.isFinite(parsedRadius) ? parsedRadius : 25;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from('cinemas').select('*');
    if (error) throw error;

    const cinemas = (data ?? [])
      .map((cinema: any) => {
        const cinemaLat = Number(cinema.lat);
        const cinemaLng = Number(cinema.lng);
        const hasCoordinates =
          validCoordinate(cinemaLat) && validCoordinate(cinemaLng);

        return {
          ...cinema,
          lat: hasCoordinates ? cinemaLat : null,
          lng: hasCoordinates ? cinemaLng : null,
          distanceKm: hasCoordinates
            ? Math.round(getDistanceKm(userLat, userLng, cinemaLat, cinemaLng) * 10) / 10
            : null,
        };
      })
      .filter((cinema: any) => {
        if (showAll) return true;
        return cinema.distanceKm !== null && cinema.distanceKm <= radiusKm;
      })
      .sort((a: any, b: any) => {
        if (a.distanceKm === null && b.distanceKm === null) {
          return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'it');
        }
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ cinemas });
  } catch (err: any) {
    console.error('Cinema nearby (Supabase) error:', err);
    return res.status(500).json({ error: err.message });
  }
}