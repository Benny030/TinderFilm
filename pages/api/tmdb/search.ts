import type { NextApiRequest, NextApiResponse } from 'next';

const GENRE_MAP: Record<number, string> = {
  28: 'Azione',
  12: 'Avventura',
  16: 'Animazione',
  35: 'Commedia',
  80: 'Crime',
  99: 'Documentario',
  18: 'Dramma',
  10751: 'Famiglia',
  14: 'Fantasy',
  36: 'Storia',
  27: 'Horror',
  10402: 'Musica',
  9648: 'Mistero',
  10749: 'Romantico',
  878: 'Fantascienza',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'Guerra',
  37: 'Western',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'TMDB API key mancante' });
  }

  const query =
    typeof req.query.q === 'string'
      ? req.query.q.trim()
      : '';

  if (query.length < 2) {
    return res.status(200).json({ movies: [] });
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: 'it-IT',
      query,
      include_adult: 'false',
      page: '1',
    });

    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`TMDB search error: ${response.status}`);
    }

    const data = await response.json();

    const movies = (data.results ?? [])
      .slice(0, 12)
      .map((movie: any) => ({
        id: `tmdb_${movie.id}`,
        tmdb_id: movie.id,
        title: movie.title,
        year: movie.release_date
          ? Number.parseInt(movie.release_date.split('-')[0], 10)
          : 0,
        genre:
          movie.genre_ids
            ?.slice(0, 2)
            .map((id: number) => GENRE_MAP[id] ?? '')
            .filter(Boolean)
            .join(', ') ?? '',
        cover: movie.poster_path
          ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
          : null,
        rating: movie.vote_average ?? 0,
      }));

    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json({ movies });
  } catch (error) {
    console.error('TMDB search error:', error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Errore ricerca TMDB',
    });
  }
}