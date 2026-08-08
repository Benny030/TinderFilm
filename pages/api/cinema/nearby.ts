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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lng, radius = '25' } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat e lng obbligatori' });

  const userLat = parseFloat(lat as string);
  const userLng = parseFloat(lng as string);
  const radiusKm = parseInt(radius as string) || 25;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from('cinemas').select('*');
    if (error) throw error;

    const nearby = (data ?? [])
      .map((c: any) => ({
        ...c,
        distanceKm: Math.round(getDistanceKm(userLat, userLng, c.lat, c.lng) * 10) / 10,
      }))
      .filter((c: any) => c.distanceKm <= radiusKm)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ cinemas: nearby });
  } catch (err: any) {
    console.error('Cinema nearby (Supabase) error:', err);
    return res.status(500).json({ error: err.message });
  }
}