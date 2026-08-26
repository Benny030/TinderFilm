import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawLat = Array.isArray(req.query.lat) ? req.query.lat[0] : req.query.lat;
  const rawLon = Array.isArray(req.query.lon) ? req.query.lon[0] : req.query.lon;
  const lat = Number(rawLat);
  const lon = Number(rawLon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Coordinate non valide' });
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '10',
      'accept-language': 'it',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        // Identifica l'app come richiesto dalla policy del servizio pubblico.
        'User-Agent': 'CineDate/1.0',
        'Accept-Language': 'it',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Servizio di localizzazione non disponibile' });
    }

    const data = await response.json();
    const address = data?.address ?? {};

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      null;

    const province =
      address['ISO3166-2-lvl6']?.split('-').pop() ||
      address.county ||
      address.state_district ||
      null;

    const countryCode =
      typeof address.country_code === 'string'
        ? address.country_code.toUpperCase()
        : 'IT';

    if (!city) {
      return res.status(404).json({ error: 'Comune non riconosciuto dalla posizione' });
    }

    return res.status(200).json({
      city,
      province,
      country_code: countryCode,
      latitude: lat,
      longitude: lon,
      attribution: '© OpenStreetMap contributors',
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Errore di localizzazione',
    });
  }
}