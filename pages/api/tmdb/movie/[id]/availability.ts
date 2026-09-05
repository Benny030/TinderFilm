import type { NextApiRequest, NextApiResponse } from 'next';
import { getMovieAvailability } from '@/utils/movieAvailability';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawId = Array.isArray(req.query.id)
    ? req.query.id[0]
    : req.query.id;

  const tmdbId = Number(rawId);

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ error: 'TMDB ID non valido' });
  }

  try {
    const availability = await getMovieAvailability(tmdbId, {
      includeCinemaDetails: true,
    });

    res.setHeader(
      'Cache-Control',
      's-maxage=900, stale-while-revalidate=1800'
    );

    return res.status(200).json(availability);
  } catch (error: any) {
    console.error('Movie availability error:', error);

    return res.status(500).json({
      error: error?.message || 'Errore caricamento disponibilità',
    });
  }
}
