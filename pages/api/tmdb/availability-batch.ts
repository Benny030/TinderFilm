import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

const MAX_IDS = 24;

const dateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TMDB API key mancante' });
  }

  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, MAX_IDS);

  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    return res.status(200).json({ availability: {} });
  }

  try {
    const supabase = createClient();

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const end = new Date(today);
    end.setDate(end.getDate() + 7);

    const cinemaPromise = supabase
      .from('cinema_showings')
      .select('tmdb_id')
      .in('tmdb_id', uniqueIds)
      .gte('showing_date', dateKey(today))
      .lte('showing_date', dateKey(end));

    const providersPromise = Promise.all(
      uniqueIds.map(async (tmdbId) => {
        try {
          const response = await fetch(
            `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${encodeURIComponent(apiKey)}`
          );

          if (!response.ok) {
            return [tmdbId, { streaming: false, digital: false }] as const;
          }

          const data = await response.json();
          const italy = data?.results?.IT ?? {};

          const streaming =
            (Array.isArray(italy.flatrate) && italy.flatrate.length > 0) ||
            (Array.isArray(italy.free) && italy.free.length > 0) ||
            (Array.isArray(italy.ads) && italy.ads.length > 0);

          const digital =
            streaming ||
            (Array.isArray(italy.rent) && italy.rent.length > 0) ||
            (Array.isArray(italy.buy) && italy.buy.length > 0);

          return [tmdbId, { streaming, digital }] as const;
        } catch {
          return [tmdbId, { streaming: false, digital: false }] as const;
        }
      })
    );

    const [cinemaResult, providerPairs] = await Promise.all([
      cinemaPromise,
      providersPromise,
    ]);

    if (cinemaResult.error) {
      throw cinemaResult.error;
    }

    const cinemaIds = new Set(
      (cinemaResult.data ?? [])
        .map((row: any) => Number(row.tmdb_id))
        .filter((id: number) => Number.isInteger(id) && id > 0)
    );

    const providerMap = new Map(providerPairs);

    const availability = Object.fromEntries(
      uniqueIds.map((tmdbId) => {
        const provider = providerMap.get(tmdbId) ?? {
          streaming: false,
          digital: false,
        };

        return [
          tmdbId,
          {
            cinema: cinemaIds.has(tmdbId),
            streaming: provider.streaming,
            digital: provider.digital,
          },
        ];
      })
    );

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

    return res.status(200).json({ availability });
  } catch (error: any) {
    console.error('Availability batch error:', error);

    return res.status(500).json({
      error: error?.message || 'Errore disponibilità batch',
    });
  }
}
