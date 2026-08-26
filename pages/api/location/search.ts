import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawCity = Array.isArray(req.query.city) ? req.query.city[0] : req.query.city;
  const city = typeof rawCity === 'string' ? rawCity.trim() : '';

  if (!city) {
    return res.status(400).json({ error: 'city obbligatoria' });
  }

  try {
    const params = new URLSearchParams({
      q: `${city}, Italia`,
      format: 'json',
      limit: '1',
      countrycodes: 'it',
      addressdetails: '1',
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'CineDate/1.0',
          'Accept-Language': 'it-IT,it;q=0.9',
        },
      }
    );

    if (!response.ok) {
      return res.status(502).json({ error: 'Geocoding non disponibile' });
    }

    const data = await response.json();
    const first = Array.isArray(data) ? data[0] : null;

    if (!first) {
      return res.status(404).json({ error: 'Città non trovata' });
    }

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(422).json({ error: 'Coordinate non valide' });
    }

    return res.status(200).json({
      city,
      latitude,
      longitude,
      display_name: first.display_name ?? null,
      province:
        first.address?.province ??
        first.address?.county ??
        first.address?.state_district ??
        null,
      country_code: String(first.address?.country_code ?? 'it').toUpperCase(),
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Errore durante il geocoding',
    });
  }
}