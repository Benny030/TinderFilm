import type { NextApiRequest, NextApiResponse } from 'next';

const GENRES: Record<number, string> = {
  28:'Azione',12:'Avventura',16:'Animazione',35:'Commedia',80:'Crime',99:'Documentario',
  18:'Dramma',10751:'Famiglia',14:'Fantasy',36:'Storia',27:'Horror',10402:'Musica',
  9648:'Mistero',10749:'Romantico',878:'Fantascienza',10770:'TV Movie',53:'Thriller',10752:'Guerra',37:'Western',
};

function mapMovie(m: any) {
  return {
    tmdb_id: Number(m.id),
    title: String(m.title || m.original_title || 'Senza titolo'),
    year: m.release_date ? Number(String(m.release_date).slice(0,4)) : null,
    cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    rating: Number(m.vote_average || 0),
    vote_count: Number(m.vote_count || 0),
    genre: Array.isArray(m.genre_ids) ? m.genre_ids.slice(0,2).map((id:number)=>GENRES[id]).filter(Boolean).join(', ') : '',
    overview: m.overview || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key mancante' });

  const q = String(req.query.q ?? '').trim();
  const mode = String(req.query.mode ?? 'trending');
  const page = Math.max(1, Math.min(500, Number(req.query.page ?? 1) || 1));
  const params = new URLSearchParams({ api_key: apiKey, language: 'it-IT', page: String(page) });
  let path = '/trending/movie/week';

  if (q) {
    path = '/search/movie';
    params.set('query', q);
    params.set('include_adult', 'false');
  } else if (mode === 'popular') path = '/movie/popular';
  else if (mode === 'top_rated') path = '/movie/top_rated';
  else if (mode === 'now_playing') { path = '/movie/now_playing'; params.set('region', 'IT'); }

  try {
    const response = await fetch(`https://api.themoviedb.org/3${path}?${params.toString()}`);
    if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
    const data = await response.json();
    const movies = (Array.isArray(data.results) ? data.results : []).filter((m:any)=>m?.id && m?.title).map(mapMovie);
    res.setHeader('Cache-Control', q ? 's-maxage=300, stale-while-revalidate=600' : 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ movies, page: Number(data.page || page), total_pages: Math.min(500, Number(data.total_pages || 1)), total_results: Number(data.total_results || movies.length) });
  } catch (error: any) {
    console.error('TMDB explore error:', error);
    return res.status(500).json({ error: error?.message || 'Errore TMDB' });
  }
}
