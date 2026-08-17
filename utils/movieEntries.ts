import type { SupabaseClient } from '@supabase/supabase-js';

export type UserMovieEntry = {
  id: string;
  user_id: string;
  movie_id: string;
  rating: number | null;
  review_text: string | null;
  review_updated_at: string | null;
  is_favorite: boolean;
  in_watchlist: boolean;
  watched_on: string | null;
  created_at: string;
  updated_at: string;
};

type CatalogMovie = {
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

type EnsureResponse = {
  movie?: CatalogMovie;
  error?: string;
};

type EntryPatch = Partial<
  Pick<
    UserMovieEntry,
    'rating' | 'review_text' | 'is_favorite' | 'in_watchlist' | 'watched_on'
  >
>;

async function getAuthenticatedUser(
  supabase: SupabaseClient
): Promise<{ userId: string; accessToken: string }> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.user || !session.access_token) {
    throw new Error('Devi accedere per salvare film e recensioni.');
  }

  return {
    userId: session.user.id,
    accessToken: session.access_token,
  };
}

export async function ensureTmdbMovie(
  supabase: SupabaseClient,
  tmdbId: number
): Promise<CatalogMovie> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new Error('TMDB id non valido.');
  }

  const { accessToken } = await getAuthenticatedUser(supabase);

  const response = await fetch('/api/movie-catalog/ensure', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      tmdb_id: tmdbId,
    }),
  });

  const data = (await response.json()) as EnsureResponse;

  if (!response.ok || !data.movie) {
    throw new Error(data.error || 'Impossibile registrare il film.');
  }

  return data.movie;
}

async function upsertMovieEntry(
  supabase: SupabaseClient,
  tmdbId: number,
  patch: EntryPatch
): Promise<UserMovieEntry> {
  const { userId } = await getAuthenticatedUser(supabase);
  const movie = await ensureTmdbMovie(supabase, tmdbId);

  const { data, error } = await supabase
    .from('user_movie_entries')
    .upsert(
      {
        user_id: userId,
        movie_id: movie.id,
        ...patch,
      },
      {
        onConflict: 'user_id,movie_id',
      }
    )
    .select(
      'id,user_id,movie_id,rating,review_text,review_updated_at,is_favorite,in_watchlist,watched_on,created_at,updated_at'
    )
    .single<UserMovieEntry>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Stato film non salvato.');
  }

  return data;
}

export async function getMovieEntry(
  supabase: SupabaseClient,
  tmdbId: number
): Promise<UserMovieEntry | null> {
  const { userId } = await getAuthenticatedUser(supabase);
  const movie = await ensureTmdbMovie(supabase, tmdbId);

  const { data, error } = await supabase
    .from('user_movie_entries')
    .select(
      'id,user_id,movie_id,rating,review_text,review_updated_at,is_favorite,in_watchlist,watched_on,created_at,updated_at'
    )
    .eq('user_id', userId)
    .eq('movie_id', movie.id)
    .maybeSingle<UserMovieEntry>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function setFavorite(
  supabase: SupabaseClient,
  tmdbId: number,
  value: boolean
) {
  return upsertMovieEntry(supabase, tmdbId, {
    is_favorite: value,
  });
}

export async function setWatchlist(
  supabase: SupabaseClient,
  tmdbId: number,
  value: boolean
) {
  return upsertMovieEntry(supabase, tmdbId, {
    in_watchlist: value,
  });
}

export async function markWatched(
  supabase: SupabaseClient,
  tmdbId: number,
  watchedOn?: string
) {
  const date = watchedOn ?? new Date().toISOString().slice(0, 10);

  return upsertMovieEntry(supabase, tmdbId, {
    watched_on: date,
  });
}

export async function clearWatched(
  supabase: SupabaseClient,
  tmdbId: number
) {
  return upsertMovieEntry(supabase, tmdbId, {
    watched_on: null,
  });
}

export async function setRating(
  supabase: SupabaseClient,
  tmdbId: number,
  rating: number | null
) {
  if (
    rating !== null &&
    (
      rating < 0.5 ||
      rating > 5 ||
      !Number.isInteger(rating * 2)
    )
  ) {
    throw new Error('Il voto deve essere compreso tra 0.5 e 5, a mezze stelle.');
  }

  return upsertMovieEntry(supabase, tmdbId, {
    rating,
  });
}

export async function saveReview(
  supabase: SupabaseClient,
  tmdbId: number,
  text: string | null
) {
  const normalized = text?.trim() || null;

  if (normalized && normalized.length > 3000) {
    throw new Error('La recensione può contenere massimo 3000 caratteri.');
  }

  return upsertMovieEntry(supabase, tmdbId, {
    review_text: normalized,
  });
}

export async function saveRatingAndReview(
  supabase: SupabaseClient,
  tmdbId: number,
  rating: number | null,
  text: string | null
) {
  if (
    rating !== null &&
    (
      rating < 0.5 ||
      rating > 5 ||
      !Number.isInteger(rating * 2)
    )
  ) {
    throw new Error('Il voto deve essere compreso tra 0.5 e 5, a mezze stelle.');
  }

  const normalized = text?.trim() || null;

  if (normalized && normalized.length > 3000) {
    throw new Error('La recensione può contenere massimo 3000 caratteri.');
  }

  return upsertMovieEntry(supabase, tmdbId, {
    rating,
    review_text: normalized,
  });
}