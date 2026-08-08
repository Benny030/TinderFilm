import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key mancante' });

  try {
    // ─── Film + video (trailer) in una sola chiamata ──────────────────────
    const [movieRes, videosRes, similarRes, creditsRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=it-IT`),
      fetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${apiKey}&language=it-IT`),
      fetch(`https://api.themoviedb.org/3/movie/${id}/similar?api_key=${apiKey}&language=it-IT&page=1`),
      fetch(`https://api.themoviedb.org/3/movie/${id}/credits?api_key=${apiKey}&language=it-IT`),
    ]);

    if (!movieRes.ok) throw new Error(`TMDB movie error: ${movieRes.status}`);

    const movie = await movieRes.json();
    const videos = videosRes.ok ? await videosRes.json() : { results: [] };
    const similarData = similarRes.ok ? await similarRes.json() : { results: [] };
    const credits = creditsRes.ok ? await creditsRes.json() : { cast: [], crew: [] };

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
      release_date: movie.release_date ?? null,
      vote_count: movie.vote_count ?? 0,
      director: credits.crew?.find((person: any) => person.job === 'Director')?.name ?? null,
      cast: (credits.cast ?? []).slice(0, 6).map((person: any) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        profile: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
      })),
      similar: (similarData.results ?? []).slice(0, 12).map((item: any) => ({
        tmdb_id: item.id,
        title: item.title,
        year: item.release_date ? parseInt(item.release_date.split('-')[0]) : 0,
        cover: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
        rating: item.vote_average ?? 0,
      })),
    });
  } catch (err: any) {
    console.error('TMDB movie error:', err);
    return res.status(500).json({ error: err.message });
  }
}
