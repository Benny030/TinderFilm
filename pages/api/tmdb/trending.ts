import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key mancante' });

  try {
    // ─── Trending settimana ────────────────────────────────────────────────
    const trendingRes = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=it-IT`
    );
    if (!trendingRes.ok) throw new Error(`TMDB error: ${trendingRes.status}`);
    const trendingData = await trendingRes.json();

    // ─── Per ogni film prendi anche i video (trailer) in parallelo ─────────
    const movies = await Promise.all(
      trendingData.results.slice(0, 20).map(async (m: any) => {
        try {
          const videoRes = await fetch(
            `https://api.themoviedb.org/3/movie/${m.id}/videos?api_key=${apiKey}&language=it-IT`
          );
          const videoData = videoRes.ok ? await videoRes.json() : { results: [] };

          // Cerca trailer italiano, fallback inglese
          let trailer = videoData.results?.find(
            (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
          );
          if (!trailer) {
            // prova in inglese
            const videoResEn = await fetch(
              `https://api.themoviedb.org/3/movie/${m.id}/videos?api_key=${apiKey}&language=en-US`
            );
            const videoDataEn = videoResEn.ok ? await videoResEn.json() : { results: [] };
            trailer = videoDataEn.results?.find(
              (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
            );
          }

          const trailerUrl = trailer
            ? `https://www.youtube.com/watch?v=${trailer.key}`
            : null;

          // ─── Generi leggibili ────────────────────────────────────────────
          const genreMap: Record<number, string> = {
            28: 'Azione', 12: 'Avventura', 16: 'Animazione',
            35: 'Commedia', 80: 'Crime', 99: 'Documentario',
            18: 'Dramma', 10751: 'Famiglia', 14: 'Fantasy',
            36: 'Storia', 27: 'Horror', 10402: 'Musica',
            9648: 'Mistero', 10749: 'Romantico', 878: 'Fantascienza',
            10770: 'TV Movie', 53: 'Thriller', 10752: 'Guerra', 37: 'Western',
          };
          const genre = m.genre_ids
            ?.slice(0, 2)
            .map((id: number) => genreMap[id] ?? '')
            .filter(Boolean)
            .join(', ') ?? '';

          return {
            id: `tmdb_${m.id}`,
            tmdb_id: m.id,
            title: m.title,
            year: m.release_date ? parseInt(m.release_date.split('-')[0]) : 0,
            genre,
            cover: m.poster_path
              ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
              : null,
            backdrop: m.backdrop_path
              ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}`
              : null,
            trailer: trailerUrl,
            trama_c: m.overview ?? null,
            trama_l: m.overview ?? null,
            rating: m.vote_average ?? 0,
            vote_count: m.vote_count ?? 0,
          };
        } catch {
          return null;
        }
      })
    );

    const filtered = movies.filter(Boolean);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ movies: filtered });
  } catch (err: any) {
    console.error('TMDB trending error:', err);
    return res.status(500).json({ error: err.message });
  }
}