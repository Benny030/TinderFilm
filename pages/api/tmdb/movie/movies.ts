import type { NextApiRequest, NextApiResponse } from 'next';

const GENRE_MAP: Record<number, string> = {
  28: 'Azione', 12: 'Avventura', 16: 'Animazione',
  35: 'Commedia', 80: 'Crime', 99: 'Documentario',
  18: 'Dramma', 10751: 'Famiglia', 14: 'Fantasy',
  36: 'Storia', 27: 'Horror', 10402: 'Musica',
  9648: 'Mistero', 10749: 'Romantico', 878: 'Fantascienza',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'Guerra', 37: 'Western',
};

function formatMovie(m: any, trailerKey?: string | null) {
  const genre = m.genre_ids
    ?.slice(0, 2)
    .map((id: number) => GENRE_MAP[id] ?? '')
    .filter(Boolean)
    .join(', ') ?? m.genres?.map((g: any) => g.name).slice(0, 2).join(', ') ?? '';

  return {
    id: `tmdb_${m.id}`,
    tmdb_id: m.id,
    title: m.title,
    year: m.release_date ? parseInt(m.release_date.split('-')[0]) : 0,
    genre,
    cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
    trailer: trailerKey ? `https://www.youtube.com/watch?v=${trailerKey}` : null,
    trama_c: m.overview ?? null,
    trama_l: m.overview ?? null,
    rating: m.vote_average ?? 0,
    vote_count: m.vote_count ?? 0,
  };
}

async function getTrailer(movieId: number, apiKey: string): Promise<string | null> {
  try {
    // Prova italiano
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${apiKey}&language=it-IT`
    );
    if (res.ok) {
      const data = await res.json();
      const trailer = data.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
      if (trailer) return trailer.key;
    }
    // Fallback inglese
    const resEn = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${apiKey}&language=en-US`
    );
    if (resEn.ok) {
      const dataEn = await resEn.json();
      const trailer = dataEn.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
      if (trailer) return trailer.key;
    }
  } catch { /* ignora */ }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key mancante' });

  const { mode = 'trending', genres, year_from, year_to } = req.query;

  try {
    let url = '';
    const currentYear = new Date().getFullYear();

    switch (mode) {
      case 'trending':
        url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=it-IT`;
        break;

      case 'cinema':
        // Film attualmente nelle sale italiane
        url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=it-IT&region=IT`;
        break;

        case 'streaming':
          url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=it-IT&sort_by=popularity.desc&vote_count.gte=200&include_adult=false&watch_region=IT&watch_monetization_types=flatrate&with_watch_providers=8|9|337|350|119|109|531`;
          break;

      case 'discover':
        const params = new URLSearchParams({
          api_key: apiKey,
          language: 'it-IT',
          sort_by: 'popularity.desc',
          'vote_count.gte': '100',
        });
        if (genres) params.set('with_genres', (genres as string).replace(/,/g, '|'));
        if (year_from) params.set('primary_release_date.gte', `${year_from}-01-01`);
        if (year_to) params.set('primary_release_date.lte', `${year_to}-12-31`);
        url = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
        break;

      default:
        url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=it-IT`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
    const data = await response.json();

    // ─── Prendi trailer in parallelo (max 20 film) ─────────────────────────
    const results = data.results?.slice(0, 20) ?? [];
    const movies = await Promise.all(
      results.map(async (m: any) => {
        const trailerKey = await getTrailer(m.id, apiKey);
        return formatMovie(m, trailerKey);
      })
    );

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    return res.status(200).json({ movies, mode });
  } catch (err: any) {
    console.error('TMDB movies error:', err);
    return res.status(500).json({ error: err.message });
  }
}