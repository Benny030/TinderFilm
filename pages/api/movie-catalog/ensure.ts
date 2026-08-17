import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type SuccessResponse = {
  movie: {
    id: string;
    provider: 'tmdb';
    provider_movie_id: string;
    title: string;
    year: number | null;
    genre: string | null;
    cover: string | null;
    backdrop: string | null;
    trailer: string | null;
    trama_c: string | null;
    trama_l: string | null;
  };
};

type ErrorResponse = { error: string };

function getBearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
}

async function getTrailerUrl(tmdbId: number, apiKey: string) {
  for (const language of ['it-IT', 'en-US']) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${apiKey}&language=${language}`
      );
      if (!response.ok) continue;

      const data = await response.json();
      const trailer =
        data.results?.find(
          (video: any) =>
            video.type === 'Trailer' &&
            video.site === 'YouTube' &&
            video.official === true
        ) ??
        data.results?.find(
          (video: any) =>
            video.type === 'Trailer' &&
            video.site === 'YouTube'
        );

      if (trailer?.key) {
        return `https://www.youtube.com/watch?v=${trailer.key}`;
      }
    } catch {}
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tmdbApiKey = process.env.TMDB_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !tmdbApiKey) {
    console.error('movie-catalog/ensure: variabili ambiente mancanti');
    return res.status(500).json({ error: 'Configurazione server incompleta' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Sessione non valida' });
  }

  const tmdbId = Number(req.body?.tmdb_id);

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ error: 'tmdb_id non valido' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: existing, error: existingError } = await admin
      .from('movie_catalog')
      .select(
        'id,provider,provider_movie_id,title,year,genre,cover,backdrop,trailer,trama_c,trama_l'
      )
      .eq('provider', 'tmdb')
      .eq('provider_movie_id', String(tmdbId))
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return res.status(200).json({
        movie: existing as SuccessResponse['movie'],
      });
    }

    const movieResponse = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbApiKey}&language=it-IT`
    );

    if (movieResponse.status === 404) {
      return res.status(404).json({ error: 'Film TMDB non trovato' });
    }

    if (!movieResponse.ok) {
      throw new Error(`TMDB movie error: ${movieResponse.status}`);
    }

    const movie = await movieResponse.json();
    const trailer = await getTrailerUrl(tmdbId, tmdbApiKey);

    const parsedYear =
      typeof movie.release_date === 'string' && movie.release_date
        ? Number.parseInt(movie.release_date.split('-')[0], 10)
        : null;

    const genre =
      Array.isArray(movie.genres) && movie.genres.length > 0
        ? movie.genres
            .slice(0, 3)
            .map((item: any) => item.name)
            .filter(Boolean)
            .join(', ')
        : null;

    const catalogRow = {
      provider: 'tmdb',
      provider_movie_id: String(tmdbId),
      title: movie.title,
      year: parsedYear !== null && Number.isFinite(parsedYear) ? parsedYear : null,
      genre,
      cover: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      backdrop: movie.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
        : null,
      trailer,
      trama_c: movie.overview || null,
      trama_l: movie.overview || null,
      updated_at: new Date().toISOString(),
    };

    const { data: savedMovie, error: saveError } = await admin
      .from('movie_catalog')
      .upsert(catalogRow, {
        onConflict: 'provider,provider_movie_id',
      })
      .select(
        'id,provider,provider_movie_id,title,year,genre,cover,backdrop,trailer,trama_c,trama_l'
      )
      .single();

    if (saveError) throw saveError;

    return res.status(200).json({
      movie: savedMovie as SuccessResponse['movie'],
    });
  } catch (error) {
    console.error('movie-catalog/ensure error:', error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Errore durante la registrazione del film',
    });
  }
}