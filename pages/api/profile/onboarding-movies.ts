import type { NextApiRequest, NextApiResponse } from 'next';

const GENRE_TO_TMDB: Record<string, number> = {
  Azione: 28,
  Avventura: 12,
  Animazione: 16,
  Commedia: 35,
  Crime: 80,
  Documentario: 99,
  Dramma: 18,
  Famiglia: 10751,
  Fantasy: 14,
  Guerra: 10752,
  Horror: 27,
  Mistero: 9648,
  Musica: 10402,
  Romance: 10749,
  Fantascienza: 878,
  Thriller: 53,
  Storia: 36,
  Western: 37,
};

const GENRE_LABELS: Record<number, string> = {
  28: 'Azione',
  12: 'Avventura',
  16: 'Animazione',
  35: 'Commedia',
  80: 'Crime',
  99: 'Documentario',
  18: 'Dramma',
  10751: 'Famiglia',
  14: 'Fantasy',
  10752: 'Guerra',
  27: 'Horror',
  9648: 'Mistero',
  10402: 'Musica',
  10749: 'Romance',
  878: 'Fantascienza',
  53: 'Thriller',
  36: 'Storia',
  37: 'Western',
};

function mapMovie(movie: any) {
  return {
    id: `tmdb_${movie.id}`,
    tmdb_id: Number(movie.id),
    title: String(
      movie.title ||
        movie.original_title ||
        'Senza titolo'
    ),
    year:
      typeof movie.release_date === 'string' &&
      movie.release_date.length >= 4
        ? Number(movie.release_date.slice(0, 4))
        : 0,
    genre: Array.isArray(movie.genre_ids)
      ? movie.genre_ids
          .slice(0, 2)
          .map(
            (id: number) =>
              GENRE_LABELS[id] ?? ''
          )
          .filter(Boolean)
          .join(', ')
      : '',
    cover: movie.poster_path
      ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
      : null,
    rating: Number(movie.vote_average || 0),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Metodo non consentito.',
    });
  }

  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'TMDB API key mancante.',
    });
  }

  const genres = String(
    req.query.genres ?? ''
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 6);

  const genreIds = Array.from(
    new Set(
      genres
        .map((genre) => GENRE_TO_TMDB[genre])
        .filter(
          (value): value is number =>
            typeof value === 'number'
        )
    )
  );

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: 'it-IT',
      include_adult: 'false',
      sort_by: 'popularity.desc',
      'vote_count.gte': '250',
      page: '1',
    });

    if (genreIds.length > 0) {
      /*
       * OR tra i generi: evita di restringere troppo il catalogo
       * quando l'utente ne sceglie 3 o più durante l'onboarding.
       */
      params.set(
        'with_genres',
        genreIds.join('|')
      );
    }

    const response = await fetch(
      `https://api.themoviedb.org/3/discover/movie?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(
        `TMDB discover error: ${response.status}`
      );
    }

    const data = await response.json();

    const movies = (
      Array.isArray(data.results)
        ? data.results
        : []
    )
      .filter(
        (movie: any) =>
          movie?.id &&
          movie?.title &&
          movie?.poster_path
      )
      .slice(0, 16)
      .map(mapMovie);

    res.setHeader(
      'Cache-Control',
      'private, max-age=300'
    );

    return res.status(200).json({
      movies,
    });
  } catch (error) {
    console.error(
      'Onboarding movie suggestions failed:',
      error
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Impossibile caricare i suggerimenti.',
    });
  }
}
