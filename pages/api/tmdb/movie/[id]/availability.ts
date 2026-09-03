import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

const mapProviders = (rows: Provider[] | undefined) =>
  (Array.isArray(rows) ? rows : []).map((provider) => ({
    provider_id: Number(provider.provider_id),
    name: String(provider.provider_name || 'Provider'),
    logo: provider.logo_path
      ? `https://image.tmdb.org/t/p/w92${provider.logo_path}`
      : null,
  }));

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

  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const tmdbId = Number(rawId);

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ error: 'TMDB ID non valido' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TMDB API key mancante' });
  }

  try {
    const supabase = createClient();

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);

    const [providersResult, showingsResult] = await Promise.all([
      fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${encodeURIComponent(apiKey)}`
      ),
      supabase
        .from('cinema_showings')
        .select(`
          cinema_id,
          session_id,
          showing_date,
          time,
          hall,
          format,
          booking_url
        `)
        .eq('tmdb_id', tmdbId)
        .gte('showing_date', dateKey(today))
        .lte('showing_date', dateKey(end))
        .order('showing_date', { ascending: true })
        .order('time', { ascending: true })
        .limit(1000),
    ]);

    const providersData = providersResult.ok
      ? await providersResult.json()
      : { results: {} };

    const italy = providersData?.results?.IT ?? {};
    const flatrate = mapProviders(italy.flatrate);
    const free = mapProviders(italy.free);
    const ads = mapProviders(italy.ads);
    const rent = mapProviders(italy.rent);
    const buy = mapProviders(italy.buy);

    if (showingsResult.error) {
      throw showingsResult.error;
    }

    const showings = showingsResult.data ?? [];
    const cinemaIds = [
      ...new Set(
        showings
          .map((row: any) => Number(row.cinema_id))
          .filter((id: number) => Number.isFinite(id))
      ),
    ];

    let cinemaRows: any[] = [];
    if (cinemaIds.length > 0) {
      const cinemasResult = await supabase
        .from('cinemas')
        .select('id, name, city, address, lat, lng, slug')
        .in('id', cinemaIds);

      if (cinemasResult.error) throw cinemasResult.error;
      cinemaRows = cinemasResult.data ?? [];
    }

    const cinemaMap = new Map(
      cinemaRows.map((cinema: any) => [Number(cinema.id), cinema])
    );

    const byCinema = new Map<number, any>();

    for (const showing of showings as any[]) {
      const cinema = cinemaMap.get(Number(showing.cinema_id));
      if (!cinema) continue;

      if (!byCinema.has(Number(cinema.id))) {
        byCinema.set(Number(cinema.id), {
          id: Number(cinema.id),
          name: cinema.name,
          city: cinema.city,
          address: cinema.address,
          showings: [],
        });
      }

      byCinema.get(Number(cinema.id)).showings.push({
        session_id: showing.session_id,
        showing_date: showing.showing_date,
        time: showing.time,
        format: showing.format,
        booking_url: showing.booking_url,
      });
    }

    const cinemas = [...byCinema.values()].sort((a, b) => {
      const firstA = a.showings[0];
      const firstB = b.showings[0];
      return `${firstA?.showing_date ?? ''} ${firstA?.time ?? ''}`.localeCompare(
        `${firstB?.showing_date ?? ''} ${firstB?.time ?? ''}`
      );
    });

    const cinemaAvailable = cinemas.length > 0;
    const streamingAvailable =
      flatrate.length > 0 || free.length > 0 || ads.length > 0;
    const digitalAvailable = rent.length > 0 || buy.length > 0;

    let status:
      | 'cinema_and_streaming'
      | 'cinema_only'
      | 'streaming_only'
      | 'digital_only'
      | 'unavailable' = 'unavailable';

    if (cinemaAvailable && streamingAvailable) status = 'cinema_and_streaming';
    else if (cinemaAvailable) status = 'cinema_only';
    else if (streamingAvailable) status = 'streaming_only';
    else if (digitalAvailable) status = 'digital_only';

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

    return res.status(200).json({
      status,
      cinema: {
        available: cinemaAvailable,
        cinemas,
        total_showings: showings.length,
      },
      streaming: {
        available: streamingAvailable,
        flatrate,
        free,
        ads,
        rent,
        buy,
        link: typeof italy.link === 'string' ? italy.link : null,
      },
    });
  } catch (error: any) {
    console.error('Movie availability error:', error);
    return res.status(500).json({
      error: error?.message || 'Errore caricamento disponibilità',
    });
  }
}