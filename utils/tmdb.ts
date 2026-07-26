import type { Movie } from '@/types';

const GENRE_MAP: Record<number, string> = {
  28: 'Azione', 12: 'Avventura', 16: 'Animazione',
  35: 'Commedia', 80: 'Crime', 99: 'Documentario',
  18: 'Dramma', 10751: 'Famiglia', 14: 'Fantasy',
  36: 'Storia', 27: 'Horror', 10402: 'Musica',
  9648: 'Mistero', 10749: 'Romantico', 878: 'Fantascienza',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'Guerra', 37: 'Western',
};

async function getTrailerUrl(movieId: number, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${apiKey}&language=it-IT`
    );
    if (res.ok) {
      const data = await res.json();
      const trailer = data.results?.find(
        (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
      );
      if (trailer) return `https://www.youtube.com/watch?v=${trailer.key}`;
    }
    // Fallback inglese
    const resEn = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${apiKey}&language=en-US`
    );
    if (resEn.ok) {
      const dataEn = await resEn.json();
      const trailer = dataEn.results?.find(
        (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
      );
      if (trailer) return `https://www.youtube.com/watch?v=${trailer.key}`;
    }
  } catch { /* ignora */ }
  return null;
}

function formatMovie(m: any, trailerUrl: string | null): Movie {
  const genre = m.genre_ids
    ?.slice(0, 2)
    .map((id: number) => GENRE_MAP[id] ?? '')
    .filter(Boolean)
    .join(', ') ?? '';

  return {
    id: `tmdb_${m.id}`,
    tmdb_id: m.id,
    title: m.title,
    year: m.release_date ? parseInt(m.release_date.split('-')[0]) : 0,
    genre,
    cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
    trailer: trailerUrl,
    trama_c: m.overview ?? null,
    trama_l: m.overview ?? null,
    rating: m.vote_average ?? 0,
  } as Movie;
}

export type RoomMode = 'trending' | 'cinema' | 'streaming' | 'discover';

export async function fetchMoviesForRoom(opts: {
  apiKey: string;
  mode: RoomMode;
  genres?: string | null;
  yearFrom?: string | null;
  yearTo?: string | null;
}): Promise<Movie[]> {
  const { apiKey, mode, genres, yearFrom, yearTo } = opts;
  let tmdbUrl = '';

  if (mode === 'trending') {
    tmdbUrl = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=it-IT`;
  } else if (mode === 'cinema') {
    tmdbUrl = `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=it-IT&region=IT`;
  } else if (mode === 'streaming') {
    tmdbUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=it-IT&sort_by=popularity.desc&vote_count.gte=200&with_watch_providers=8|9|337|350|119|109|531&watch_region=IT`;
  } else if (mode === 'discover') {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: 'it-IT',
      sort_by: 'popularity.desc',
      'vote_count.gte': '100',
    });
    if (genres) params.set('with_genres', genres.replace(/,/g, '|'));
    if (yearFrom) params.set('primary_release_date.gte', `${yearFrom}-01-01`);
    if (yearTo) params.set('primary_release_date.lte', `${yearTo}-12-31`);
    tmdbUrl = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
  }

  const res = await fetch(tmdbUrl);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  const data = await res.json();

  const movies = await Promise.all(
    (data.results ?? []).slice(0, 20).map(async (m: any) => {
      try {
        const trailerUrl = await getTrailerUrl(m.id, apiKey);
        return formatMovie(m, trailerUrl);
      } catch { return null; }
    })
  );

  return movies.filter(Boolean) as Movie[];
}

export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let s = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rng = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
  return [...arr].sort(() => rng() - 0.5);
}