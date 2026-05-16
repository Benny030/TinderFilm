import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key mancante' });

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=it-IT`,
      { next: { revalidate: 3600 } } // cache 1 ora
    );

    if (!response.ok) throw new Error(`TMDB error: ${response.status}`);

    const data = await response.json();

    // ─── Normalizza i dati nel formato Movie del nostro DB ────────────────
    const movies = data.results.map((m: any) => ({
      id: `tmdb_${m.id}`,
      tmdb_id: m.id,
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.split('-')[0]) : 0,
      genre: m.genre_ids?.join(',') ?? '',
      cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
      trailer: null,
      trama_c: m.overview ?? null,
      trama_l: m.overview ?? null,
      rating: m.vote_average ?? 0,
      vote_count: m.vote_count ?? 0,
    }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ movies });
  } catch (err: any) {
    console.error('TMDB error:', err);
    return res.status(500).json({ error: err.message });
  }
}