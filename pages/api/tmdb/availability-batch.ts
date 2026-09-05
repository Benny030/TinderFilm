import type { NextApiRequest, NextApiResponse } from 'next';
import { getMovieAvailability } from '@/utils/movieAvailability';

const MAX_IDS = 24;

function uniqueProviderNames(groups: Array<Array<{ name: string }>>) {
  return [
    ...new Set(
      groups
        .flat()
        .map((provider) => String(provider?.name ?? '').trim())
        .filter(Boolean)
    ),
  ];
}

function cinemaLabel(name: string) {
  const normalized = name.toLowerCase();

  if (normalized.includes('uci')) return 'UCI';
  if (normalized.includes('space')) return 'The Space';

  return name;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    const pairs = await Promise.all(
      uniqueIds.map(async (tmdbId) => {
        try {
          const data = await getMovieAvailability(tmdbId, {
            includeCinemaDetails: true,
          });

          const streamingProviders = uniqueProviderNames([
            data.streaming.flatrate,
            data.streaming.free,
            data.streaming.ads,
          ]);

          const digitalProviders = uniqueProviderNames([
            data.streaming.rent,
            data.streaming.buy,
          ]);

          const cinemaNames = [
            ...new Set(
              data.cinema.cinemas
                .map((cinema) => cinemaLabel(cinema.name))
                .filter(Boolean)
            ),
          ];

          return [
            tmdbId,
            {
              status: data.status,
              cinema: data.cinema.available,
              streaming: data.streaming.available,
              digital:
                data.streaming.rent.length > 0 ||
                data.streaming.buy.length > 0,
              cinema_names: cinemaNames,
              streaming_providers: streamingProviders,
              digital_providers: digitalProviders,
            },
          ] as const;
        } catch {
          return [
            tmdbId,
            {
              status: 'unavailable',
              cinema: false,
              streaming: false,
              digital: false,
              cinema_names: [],
              streaming_providers: [],
              digital_providers: [],
            },
          ] as const;
        }
      })
    );

    res.setHeader(
      'Cache-Control',
      's-maxage=600, stale-while-revalidate=1200'
    );

    return res.status(200).json({
      availability: Object.fromEntries(pairs),
    });
  } catch (error: any) {
    console.error('Availability batch error:', error);

    return res.status(500).json({
      error: error?.message || 'Errore disponibilità batch',
    });
  }
}
