import type { NextApiRequest, NextApiResponse } from 'next';
import { THE_SPACE_CINEMAS } from '@/utils/cinema/thespaceCinemas';

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(t: string): string {
  return t.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuovi accenti
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Match parziale: uno contiene l'altro (utile per sottotitoli tipo "Spider-Man: Brand New Day")
  if (na.length > 4 && nb.includes(na)) return true;
  if (nb.length > 4 && na.includes(nb)) return true;
  // Match prime parole significative
  const wordsA = na.split(' ').filter((w) => w.length > 2);
  const wordsB = nb.split(' ').filter((w) => w.length > 2);
  const common = wordsA.filter((w) => wordsB.includes(w));
  return common.length >= Math.min(2, Math.min(wordsA.length, wordsB.length));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { title, lat, lng, radius = '25' } = req.query;
  if (!title || !lat || !lng) return res.status(400).json({ error: 'title, lat, lng obbligatori' });

  const userLat  = parseFloat(lat as string);
  const userLng  = parseFloat(lng as string);
  const radiusKm = parseInt(radius as string) || 25;
  const filmTitle = title as string;

  // ─── Cinema entro il raggio, ordinati per distanza ───────────────────────
  const nearbyCinemas = THE_SPACE_CINEMAS
    .map((c) => ({ ...c, distanceKm: getDistanceKm(userLat, userLng, c.lat, c.lng) }))
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);

  if (nearbyCinemas.length === 0) {
    return res.status(200).json({ inCinema: false, showings: [], filmTitle });
  }

  const today   = new Date().toISOString().split('T')[0] + 'T00:00:00';
  const showings: Array<{
    cinema: string;
    cinemaId: number;
    distanceKm: number;
    sessions: string[];
    bookingUrl: string;
  }> = [];

  await Promise.all(
    nearbyCinemas.map(async (cinema) => {
      try {
        const url = `https://www.thespacecinema.it/api/microservice/showings/cinemas/${cinema.id}/films?showingDate=${today}&minEmbargoLevel=3&includesSession=true`;
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        });
        if (!response.ok) return;

        const data: any[] = await response.json();
        if (!Array.isArray(data)) return;

        const match = data.find((f: any) =>
          titlesMatch(f.title ?? f.name ?? '', filmTitle)
        );

        if (match) {
          const sessions = (match.sessions ?? match.showings ?? [])
            .map((s: any) => {
              const t = s.showingTime ?? s.time ?? s.startTime ?? '';
              // normalizza formato ore "HH:MM"
              return t.length > 5 ? t.slice(11, 16) : t;
            })
            .filter(Boolean)
            .slice(0, 5);

          showings.push({
            cinema:     cinema.name,
            cinemaId:   cinema.id,
            distanceKm: Math.round(cinema.distanceKm * 10) / 10,
            sessions,
            bookingUrl: `https://www.thespacecinema.it/cinema/${cinema.slug}/acquisto-biglietti`,
          });
        }
      } catch { /* continua */ }
    })
  );

  // ─── Ordina per distanza ──────────────────────────────────────────────────
  showings.sort((a, b) => a.distanceKm - b.distanceKm);

  return res.status(200).json({
    inCinema: showings.length > 0,
    showings,
    filmTitle,
  });
}