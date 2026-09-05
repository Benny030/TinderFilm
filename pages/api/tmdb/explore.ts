import type { NextApiRequest, NextApiResponse } from 'next';

const GENRES: Record<number, string> = {
  28:'Azione',12:'Avventura',16:'Animazione',35:'Commedia',80:'Crime',99:'Documentario',
  18:'Dramma',10751:'Famiglia',14:'Fantasy',36:'Storia',27:'Horror',10402:'Musica',
  9648:'Mistero',10749:'Romantico',878:'Fantascienza',10770:'TV Movie',53:'Thriller',10752:'Guerra',37:'Western',
};

function mapMovie(m: any) {
  const releaseDate =
    typeof m.release_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.release_date)
      ? m.release_date
      : null;

  return {
    tmdb_id: Number(m.id),
    title: String(m.title || m.original_title || 'Senza titolo'),
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    release_date: releaseDate,
    cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    rating: Number(m.vote_average || 0),
    vote_count: Number(m.vote_count || 0),
    genre: Array.isArray(m.genre_ids)
      ? m.genre_ids.slice(0, 2).map((id:number) => GENRES[id]).filter(Boolean).join(', ')
      : '',
    overview: m.overview || null,
  };
}

function mapPerson(p: any) {
  return {
    tmdb_id: Number(p.id),
    name: String(p.name || 'Senza nome'),
    photo: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
    known_for_department: String(p.known_for_department || ''),
    known_for: (Array.isArray(p.known_for) ? p.known_for : [])
      .filter((x:any) => x?.media_type === 'movie' && x?.id && x?.title)
      .slice(0, 4)
      .map(mapMovie),
  };
}

function todayKey() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key mancante' });

  const q = String(req.query.q ?? '').trim();
  const mode = String(req.query.mode ?? 'trending');
  const kind = ['all','movie','person'].includes(String(req.query.kind))
    ? String(req.query.kind)
    : 'all';
  const page = Math.max(1, Math.min(500, Number(req.query.page ?? 1) || 1));

  const params = new URLSearchParams({
    api_key: apiKey,
    language: 'it-IT',
    page: String(page),
  });

  try {
    if (q) {
      params.set('query', q);
      params.set('include_adult', 'false');

      const path =
        kind === 'movie'
          ? '/search/movie'
          : kind === 'person'
            ? '/search/person'
            : '/search/multi';

      const response = await fetch(`https://api.themoviedb.org/3${path}?${params}`);

      if (!response.ok) throw new Error(`TMDB error: ${response.status}`);

      const data = await response.json();
      const results = Array.isArray(data.results) ? data.results : [];

      const movies =
        kind === 'person'
          ? []
          : results
              .filter((x:any) =>
                kind === 'movie'
                  ? x?.id && x?.title
                  : x?.media_type === 'movie' && x?.id && x?.title
              )
              .map(mapMovie);

      const people =
        kind === 'movie'
          ? []
          : results
              .filter((x:any) =>
                kind === 'person'
                  ? x?.id && x?.name
                  : x?.media_type === 'person' && x?.id && x?.name
              )
              .map(mapPerson);

      return res.status(200).json({
        movies,
        people,
        page: Number(data.page || page),
        total_pages: Math.min(500, Number(data.total_pages || 1)),
      });
    }

    if (kind === 'person') {
      const response = await fetch(`https://api.themoviedb.org/3/person/popular?${params}`);

      if (!response.ok) throw new Error(`TMDB error: ${response.status}`);

      const data = await response.json();

      return res.status(200).json({
        movies: [],
        people: (Array.isArray(data.results) ? data.results : [])
          .filter((person: any) => person?.id && person?.name)
          .map(mapPerson),
        page: Number(data.page || page),
        total_pages: Math.min(500, Number(data.total_pages || 1)),
      });
    }

    let path = '/trending/movie/week';

    if (mode === 'popular') path = '/movie/popular';
    else if (mode === 'top_rated') path = '/movie/top_rated';
    else if (mode === 'now_playing') {
      path = '/movie/now_playing';
      params.set('region', 'IT');
    } else if (mode === 'upcoming') {
      path = '/movie/upcoming';
      params.set('region', 'IT');
    }

    const response = await fetch(`https://api.themoviedb.org/3${path}?${params}`);

    if (!response.ok) throw new Error(`TMDB error: ${response.status}`);

    const data = await response.json();

    let movies = (data.results ?? [])
      .filter((m:any) => m?.id && m?.title)
      .map(mapMovie);

    if (mode === 'upcoming') {
      const today = todayKey();

      movies = movies
        .filter((movie:any) => !movie.release_date || movie.release_date >= today)
        .sort((a:any, b:any) => {
          if (!a.release_date && !b.release_date) return 0;
          if (!a.release_date) return 1;
          if (!b.release_date) return -1;
          return a.release_date.localeCompare(b.release_date);
        });
    }

    return res.status(200).json({
      movies,
      people: [],
      page: Number(data.page || page),
      total_pages: Math.min(500, Number(data.total_pages || 1)),
    });
  } catch (error:any) {
    console.error('TMDB global search error:', error);
    return res.status(500).json({
      error: error?.message || 'Errore TMDB',
    });
  }
}
