import type { NextApiRequest, NextApiResponse } from 'next';
import { THE_SPACE_CINEMAS } from '@/utils/cinema/theSpaceCinemas';
import { fetchTheSpace } from '@/utils/cinema/theSpaceFetcher';

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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);

  console.log('🔤 confronto titoli:', { a, b, na, nb });

  if (na === nb) return true;
  if (na.length > 4 && nb.includes(na)) return true;
  if (nb.length > 4 && na.includes(nb)) return true;

  const wordsA = na.split(' ').filter((w) => w.length > 2);
  const wordsB = nb.split(' ').filter((w) => w.length > 2);

  const common = wordsA.filter((w) => wordsB.includes(w));

  console.log('🔎 parole comuni:', common);

  return common.length >= Math.min(2, Math.min(wordsA.length, wordsB.length));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  console.log('🎬 API chiamata');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, lat, lng, radius = '25' } = req.query;

  console.log('📥 Parametri ricevuti:', {
    title,
    lat,
    lng,
    radius
  });

  if (!title || !lat || !lng) {
    return res.status(400).json({ error: 'title, lat, lng obbligatori' });
  }

  const userLat = parseFloat(lat as string);
  const userLng = parseFloat(lng as string);
  const radiusKm = parseInt(radius as string) || 25;
  const filmTitle = title as string;

  const nearbyCinemas = THE_SPACE_CINEMAS
    .map((c) => ({
      ...c,
      distanceKm: getDistanceKm(userLat, userLng, c.lat, c.lng)
    }))
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);

  console.log('🏢 Cinema trovati:', nearbyCinemas.map(c => ({
    id: c.id,
    name: c.name,
    distance: c.distanceKm
  })));

  if (nearbyCinemas.length === 0) {
    return res.status(200).json({
      inCinema: false,
      showings: [],
      filmTitle
    });
  }

  const now = new Date();

  const today =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;

  console.log('📅 Data richiesta:', today);

  const showings: Array<{
    cinema: string;
    cinemaId: number;
    distanceKm: number;
    sessions: {
      time: string;
      bookingUrl: string;
    }[];
  }> = [];

  await Promise.all(
    nearbyCinemas.map(async (cinema) => {

      try {

        const url =
          `https://www.thespacecinema.it/api/microservice/showings/cinemas/${cinema.id}/films?showingDate=${today}&minEmbargoLevel=3&includesSession=true`;

        console.log('🌐 Chiamata The Space:', url);

        const response: any = await fetchTheSpace(url);

        const data = response?.result ?? [];

        console.log('📦 Film trovati:', data.length);

        const match = data.find((f: any) =>
          titlesMatch(f.filmTitle ?? '', filmTitle)
        );

        console.log('🎯 Match:', {
          cinema: cinema.name,
          trovato: !!match,
          film: match?.filmTitle
        });


        if (!match) return;


        const sessions = (match.showingGroups ?? [])
          .flatMap((group: any) => group.sessions ?? [])
          .map((s: any) => {

            console.log('🕒 Sessione:', {
              id: s.sessionId,
              startTime: s.startTime,
              bookingUrl: s.bookingUrl
            });

            return {
              time: s.startTime
                ? s.startTime.slice(11, 16)
                : '',
              bookingUrl:
                `${s.bookingUrl}`
            };
          })
          .filter((s: any) => s.time)
          .slice(0, 5);


        console.log('✅ Sessioni finali:', sessions);


        showings.push({
          cinema: cinema.name,
          cinemaId: cinema.id,
          distanceKm: Math.round(cinema.distanceKm * 10) / 10,
          sessions
        });


      } catch (err) {
        console.error(`❌ Errore cinema ${cinema.id}:`, err);
      }

    })
  );


  showings.sort((a, b) => a.distanceKm - b.distanceKm);


  console.log('🏁 Risultato finale:', showings);


  return res.status(200).json({
    inCinema: showings.length > 0,
    showings,
    filmTitle,
  });
}