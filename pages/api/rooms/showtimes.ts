import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

function normalizeTitle(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const r = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dateKey(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
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

function titleMatches(candidateTitle: string, wantedTitle: string) {
  const candidate = normalizeTitle(candidateTitle);
  const wanted = normalizeTitle(wantedTitle);

  if (!candidate || !wanted) return false;
  if (candidate === wanted) return true;
  if (candidate.includes(wanted) || wanted.includes(candidate)) return true;

  const stop = new Set([
    'il','lo','la','i','gli','le','un','uno','una',
    'di','del','dello','della','dei','degli','delle',
    'da','in','con','su','per','the','and','of',
  ]);

  const a = candidate
    .split(' ')
    .filter((word) => word.length >= 3 && !stop.has(word));

  const b = wanted
    .split(' ')
    .filter((word) => word.length >= 3 && !stop.has(word));

  const common = a.filter((word) => b.includes(word));

  return common.length >= Math.min(2, a.length, b.length);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const roomId = String(
      firstQueryValue(req.query.roomId) ?? ''
    )
      .trim()
      .toUpperCase();

    const movieTitle = String(
      firstQueryValue(req.query.movieTitle) ?? ''
    ).trim();

    const rawTmdbId = firstQueryValue(req.query.tmdbId);
    const tmdbId =
      typeof rawTmdbId === 'string' && /^\d+$/.test(rawTmdbId)
        ? Number(rawTmdbId)
        : null;

    const requestedDays = Math.min(
      14,
      Math.max(
        1,
        Number.parseInt(
          String(firstQueryValue(req.query.days) ?? '7'),
          10
        ) || 7
      )
    );

    if (!roomId) {
      return res.status(400).json({ error: 'roomId obbligatorio' });
    }

    if (!movieTitle && !tmdbId) {
      return res.status(400).json({
        error: 'movieTitle o tmdbId obbligatorio',
      });
    }

    const supabase = createClient();

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select(`
        id,
        room_type,
        city,
        latitude,
        longitude,
        radius_km
      `)
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) {
      return res.status(500).json({ error: roomError.message });
    }

    if (!room) {
      return res.status(404).json({ error: 'Stanza non trovata' });
    }

    if (!['cinema_pair', 'cinema_group'].includes(room.room_type)) {
      return res.status(409).json({
        error: 'Questa non è una stanza cinema',
      });
    }

    const { data: cinemas, error: cinemasError } = await supabase
      .from('cinemas')
      .select('id, name, city, address, lat, lng, slug');

    if (cinemasError) {
      return res.status(500).json({ error: cinemasError.message });
    }

    const roomLat =
      room.latitude == null ? null : Number(room.latitude);
    const roomLng =
      room.longitude == null ? null : Number(room.longitude);

    const hasCoords =
      roomLat !== null &&
      roomLng !== null &&
      Number.isFinite(roomLat) &&
      Number.isFinite(roomLng);

    const radiusKm = Math.max(
      1,
      Number(room.radius_km ?? 25)
    );

    let nearbyCinemas: any[] = [];

    if (hasCoords) {
      nearbyCinemas = (cinemas ?? [])
        .filter((cinema: any) => {
          if (cinema.lat == null || cinema.lng == null) return false;

          return (
            Number.isFinite(Number(cinema.lat)) &&
            Number.isFinite(Number(cinema.lng))
          );
        })
        .map((cinema: any) => ({
          ...cinema,
          distanceKm: haversineKm(
            roomLat as number,
            roomLng as number,
            Number(cinema.lat),
            Number(cinema.lng),
          ),
        }))
        .filter(
          (cinema: any) => cinema.distanceKm <= radiusKm
        )
        .sort(
          (a: any, b: any) =>
            a.distanceKm - b.distanceKm
        );
    }

    // Fallback per cinema senza coordinate.
    if (nearbyCinemas.length === 0 && room.city) {
      const wantedCity = normalizeTitle(room.city);

      nearbyCinemas = (cinemas ?? [])
        .filter((cinema: any) => {
          const cinemaCity = normalizeTitle(cinema.city ?? '');

          return (
            cinemaCity &&
            (
              cinemaCity === wantedCity ||
              cinemaCity.includes(wantedCity) ||
              wantedCity.includes(cinemaCity)
            )
          );
        })
        .map((cinema: any) => ({
          ...cinema,
          distanceKm: null,
        }));
    }

    if (nearbyCinemas.length === 0) {
      return res.status(200).json({
        movie: { title: movieTitle, tmdb_id: tmdbId },
        cinemas: [],
        meta: { reason: 'no_nearby_cinemas' },
      });
    }

    const cinemaIds = nearbyCinemas.map(
      (cinema: any) => cinema.id
    );

    /*
     * Anche qui niente filtro data SQL:
     * leggiamo a pagine le proiezioni dei cinema vicini,
     * poi filtriamo esattamente i prossimi N giorni in JS.
     */
    const allRows: any[] = [];
    const PAGE_SIZE = 1000;
    const MAX_ROWS = 10000;

    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('cinema_showings')
        .select(`
          cinema_id,
          film_id,
          tmdb_id,
          film_title,
          poster_url,
          duration,
          session_id,
          showing_date,
          time,
          hall,
          format,
          booking_url
        `)
        .in('cinema_id', cinemaIds)
        .order('showing_date', { ascending: true })
        .order('time', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const batch = data ?? [];
      allRows.push(...batch);

      if (batch.length < PAGE_SIZE) break;
    }

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const requestedDates = Array.from(
      { length: requestedDays },
      (_, index) => {
        const date = new Date(today);
        date.setDate(date.getDate() + index);
        return dateKey(date);
      }
    );

    const allowedDates = new Set(requestedDates);

    const weekRows = allRows.filter((row: any) =>
      allowedDates.has(normalizeShowingDate(row.showing_date))
    );

    const matchingRows = weekRows.filter((row: any) => {
      if (
        tmdbId &&
        row.tmdb_id != null &&
        Number(row.tmdb_id) === tmdbId
      ) {
        return true;
      }

      return titleMatches(
        row.film_title ?? '',
        movieTitle
      );
    });

    const cinemaMap = new Map(
      nearbyCinemas.map((cinema: any) => [
        String(cinema.id),
        cinema,
      ])
    );

    const grouped = new Map<string, any>();

    for (const row of matchingRows) {
      const cinema = cinemaMap.get(String(row.cinema_id));
      if (!cinema) continue;

      const key = String(cinema.id);

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: cinema.id,
          name: cinema.name,
          city: cinema.city ?? null,
          address: cinema.address ?? null,
          distance_km:
            typeof cinema.distanceKm === 'number'
              ? Math.round(cinema.distanceKm * 10) / 10
              : null,
          showings: [],
        });
      }

      grouped.get(key).showings.push({
        session_id:
          row.session_id ??
          `${row.cinema_id}-${row.showing_date}-${row.time}`,
        showing_date: normalizeShowingDate(row.showing_date),
        time: row.time,
        hall: row.hall ?? null,
        format: row.format ?? null,
        booking_url: row.booking_url ?? null,
      });
    }

    const result = [...grouped.values()]
      .map((cinema: any) => ({
        ...cinema,
        showings: cinema.showings.sort(
          (a: any, b: any) =>
            `${a.showing_date} ${a.time}`.localeCompare(
              `${b.showing_date} ${b.time}`
            )
        ),
      }))
      .sort((a: any, b: any) => {
        if (
          typeof a.distance_km === 'number' &&
          typeof b.distance_km === 'number'
        ) {
          return a.distance_km - b.distance_km;
        }

        return String(a.name).localeCompare(
          String(b.name),
          'it'
        );
      });

    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json({
      movie: { title: movieTitle, tmdb_id: tmdbId },
      cinemas: result,
      meta: {
        requested_dates: requestedDates,
        total_rows_nearby: allRows.length,
        week_rows: weekRows.length,
        matched_showings: matchingRows.length,
        matched_dates: [
          ...new Set(
            matchingRows.map((row: any) =>
              normalizeShowingDate(row.showing_date)
            )
          ),
        ].filter(Boolean),
      },
    });
  } catch (error) {
    console.error('Room cinema showtimes error:', error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Errore durante il caricamento degli spettacoli',
    });
  }
}