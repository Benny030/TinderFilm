import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key mancante' });

  try {
    // ─── Film + video (trailer) in una sola chiamata ──────────────────────
    const [movieRes, videosRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=it-IT`),
      fetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${apiKey}&language=it-IT`),
    ]);

    if (!movieRes.ok) throw new Error(`TMDB movie error: ${movieRes.status}`);

    const movie = await movieRes.json();
    const videos = videosRes.ok ? await videosRes.json() : { results: [] };

    // ─── Trova trailer YouTube ufficiale ──────────────────────────────────
    const trailer = videos.results?.find(
      (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
    ) ?? videos.results?.[0];

    const trailerUrl = trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null;

    // ─── Generi come stringa leggibile ────────────────────────────────────
    const genres = movie.genres?.map((g: any) => g.name).join(', ') ?? '';

    // ─── Runtime formattato ───────────────────────────────────────────────
    const runtime = movie.runtime
      ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}min`
      : null;

    return res.status(200).json({
      id: `tmdb_${movie.id}`,
      tmdb_id: movie.id,
      title: movie.title,
      year: movie.release_date ? parseInt(movie.release_date.split('-')[0]) : 0,
      genre: genres,
      cover: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
      trailer: trailerUrl,
      trama_c: movie.overview ?? null,
      trama_l: movie.overview ?? null,
      rating: movie.vote_average ?? 0,
      runtime,
      tagline: movie.tagline ?? null,
    });
  } catch (err: any) {
    console.error('TMDB movie error:', err);
    return res.status(500).json({ error: err.message });
  }
}