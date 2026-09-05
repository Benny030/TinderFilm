import { createClient } from '@/utils/supabase/server';

export type AvailabilityProvider = {
  provider_id: number;
  name: string;
  logo: string | null;
};

export type AvailabilityCinema = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  showings: Array<{
    session_id: string | null;
    showing_date: string | null;
    time: string | null;
    format: string | null;
    booking_url: string | null;
  }>;
};

export type MovieAvailabilityData = {
  status:
    | 'cinema_and_streaming'
    | 'cinema_only'
    | 'streaming_only'
    | 'digital_only'
    | 'unavailable';
  cinema: {
    available: boolean;
    cinemas: AvailabilityCinema[];
    total_showings: number;
  };
  streaming: {
    available: boolean;
    flatrate: AvailabilityProvider[];
    free: AvailabilityProvider[];
    ads: AvailabilityProvider[];
    rent: AvailabilityProvider[];
    buy: AvailabilityProvider[];
    link: string | null;
  };
};

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeShowingDate(value: unknown) {
  const raw = String(value ?? '').trim();

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const it = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (it) return `${it[3]}-${it[2]}-${it[1]}`;

  return '';
}


function normalizeTitle(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(2d|3d|4dx|imax|screenx|isense|dolby|dolby atmos|atmos|vo|v o|ita|italiano|versione originale|original version|evento speciale|anteprima|maratona|sub ita|sottotitolato)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleScore(aValue: unknown, bValue: unknown) {
  const a = normalizeTitle(aValue);
  const b = normalizeTitle(bValue);

  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 90;

  const aTokens = new Set(a.split(' ').filter((token) => token.length > 1));
  const bTokens = new Set(b.split(' ').filter((token) => token.length > 1));

  let common = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) common += 1;
  }

  if (common === 0) return 0;

  return Math.round(
    (common / Math.max(aTokens.size, bTokens.size)) * 80
  );
}

async function getTmdbTitles(tmdbId: number, apiKey: string) {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${encodeURIComponent(apiKey)}&language=it-IT`
    );

    if (!response.ok) return [];

    const movie = await response.json();

    return [
      movie?.title,
      movie?.original_title,
    ]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function mapProviders(rows: any[] | undefined): AvailabilityProvider[] {
  return (Array.isArray(rows) ? rows : []).map((provider) => ({
    provider_id: Number(provider.provider_id),
    name: String(provider.provider_name || 'Provider'),
    logo: provider.logo_path
      ? `https://image.tmdb.org/t/p/w92${provider.logo_path}`
      : null,
  }));
}

export async function getMovieAvailability(
  tmdbId: number,
  options?: { includeCinemaDetails?: boolean }
): Promise<MovieAvailabilityData> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new Error('TMDB ID non valido');
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('TMDB API key mancante');
  }

  const includeCinemaDetails = options?.includeCinemaDetails ?? true;
  const supabase = createClient();

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const requestedDates = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() + index);
    return dateKey(date);
  });

  const allowedDates = new Set(requestedDates);

  const [providersResult, tmdbTitles, cinemaRowsResult] = await Promise.all([
    fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${encodeURIComponent(apiKey)}`
    ),
    getTmdbTitles(tmdbId, apiKey),
    supabase
      .from('cinema_showings')
      .select(`
        cinema_id,
        tmdb_id,
        film_title,
        session_id,
        showing_date,
        time,
        hall,
        format,
        booking_url
      `)
      .limit(5000),
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

  if (cinemaRowsResult.error) {
    throw cinemaRowsResult.error;
  }

  const showings = (cinemaRowsResult.data ?? []).filter((row: any) => {
    if (!allowedDates.has(normalizeShowingDate(row.showing_date))) {
      return false;
    }

    const rowTmdbId = Number(row.tmdb_id);

    if (Number.isInteger(rowTmdbId) && rowTmdbId > 0) {
      if (rowTmdbId === tmdbId) return true;
    }

    if (!row.film_title || tmdbTitles.length === 0) {
      return false;
    }

    return tmdbTitles.some(
      (title) => titleScore(row.film_title, title) >= 70
    );
  });

  const cinemaIds = [
    ...new Set(
      showings
        .map((row: any) => Number(row.cinema_id))
        .filter((id: number) => Number.isInteger(id) && id > 0)
    ),
  ];

  let cinemaRows: any[] = [];

  if (includeCinemaDetails && cinemaIds.length > 0) {
    const cinemasResult = await supabase
      .from('cinemas')
      .select('id, name, city, address')
      .in('id', cinemaIds);

    if (cinemasResult.error) throw cinemasResult.error;
    cinemaRows = cinemasResult.data ?? [];
  }

  const cinemaMap = new Map(
    cinemaRows.map((cinema: any) => [Number(cinema.id), cinema])
  );

  const byCinema = new Map<number, AvailabilityCinema>();

  if (includeCinemaDetails) {
    for (const showing of showings as any[]) {
      const cinema = cinemaMap.get(Number(showing.cinema_id));
      if (!cinema) continue;

      const id = Number(cinema.id);

      if (!byCinema.has(id)) {
        byCinema.set(id, {
          id,
          name: String(cinema.name || 'Cinema'),
          city: cinema.city ?? null,
          address: cinema.address ?? null,
          showings: [],
        });
      }

      byCinema.get(id)!.showings.push({
        session_id: showing.session_id ?? null,
        showing_date: showing.showing_date ?? null,
        time: showing.time ?? null,
        format: showing.format ?? null,
        booking_url: showing.booking_url ?? null,
      });
    }
  }

  const cinemas = [...byCinema.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'it')
  );

  const cinemaAvailable = showings.length > 0;
  const streamingAvailable =
    flatrate.length > 0 || free.length > 0 || ads.length > 0;
  const digitalAvailable = rent.length > 0 || buy.length > 0;

  let status: MovieAvailabilityData['status'] = 'unavailable';

  if (cinemaAvailable && streamingAvailable) status = 'cinema_and_streaming';
  else if (cinemaAvailable) status = 'cinema_only';
  else if (streamingAvailable) status = 'streaming_only';
  else if (digitalAvailable) status = 'digital_only';

  return {
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
  };
}