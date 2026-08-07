import type { NextApiRequest, NextApiResponse } from 'next';
import { THE_SPACE_CINEMAS } from '@/utils/cinema/theSpaceCinemas';

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lng, radius = '25' } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat e lng obbligatori' });

  const userLat = parseFloat(lat as string);
  const userLng = parseFloat(lng as string);
  const radiusKm = parseInt(radius as string) || 25;

  const nearby = THE_SPACE_CINEMAS
    .map((c) => ({ ...c, distanceKm: Math.round(getDistanceKm(userLat, userLng, c.lat, c.lng) * 10) / 10 }))
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ cinemas: nearby });
}