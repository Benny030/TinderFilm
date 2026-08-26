import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type SeedReason =
  | 'favorite'
  | 'high_rating'
  | 'watchlist'
  | 'room_like'
  | 'room_match'
  | 'room_winner'
  | 'explicit_more_like_this';

type Seed = {
  tmdbId: number;
  title: string | null;
  score: number;
  reasons: SeedReason[];
};


type TasteProfile = {
  genreWeights: Map<number, number>;
  actorWeights: Map<number, number>;
  genreNames: Map<number, string>;
  actorNames: Map<number, string>;
};

type Recommendation = {
  tmdb_id: number;
  title: string;
  year: number | null;
  cover: string | null;
  backdrop: string | null;
  rating: number;
  vote_count: number;
  genre_ids: number[];
  score: number;
  reason: string;
  based_on: Array<{
    tmdb_id: number;
    title: string | null;
    weight: number;
  }>;
};

type RecommendationCollections = {
  from_favorites: Recommendation[];
  from_rooms: Recommendation[];
  cast_affinity: Recommendation[];
  profile_genres: Recommendation[];
};

type SuccessResponse = {
  recommendations: Recommendation[];
  collections: RecommendationCollections;
  feedback: Record<number, 'more_like_this' | 'not_for_me'>;
  meta: {
    personalized: boolean;
    seeds_used: number;
    positive_signals: number;
    excluded_movies: number;
    negative_genres: number;
    taste_genres: number;
    taste_actors: number;
    top_genres: Array<{
      id: number;
      name: string;
      weight: number;
    }>;
    top_actors: Array<{
      id: number;
      name: string;
      weight: number;
    }>;
    profile_genres: string[];
    cold_start_used: boolean;
  };
};

type ErrorResponse = { error: string };

const MAX_SEEDS = 8;
const MAX_RECOMMENDATIONS = 20;
const MAX_NEGATIVE_PROFILE_MOVIES = 12;
const MAX_ACTOR_CANDIDATES = 18;
const TMDB_CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const similarCache = new Map<number, CacheEntry<any[]>>();
const tasteDetailsCache = new Map<
  number,
  CacheEntry<{
    genres: number[];
    actors: number[];
    genreNames: Record<number, string>;
    actorNames: Record<number, string>;
  }>
>();
let trendingCache: CacheEntry<any[]> | null = null;

function readCache<T>(cache: Map<number, CacheEntry<T>>, key: number): T | null {
  const cached = cache.get(key);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function recencyMultiplier(value: unknown): number {
  if (!value) return 1;

  const timestamp = new Date(String(value)).getTime();
  if (!Number.isFinite(timestamp)) return 1;

  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);

  if (ageDays <= 7) return 1.25;
  if (ageDays <= 30) return 1.15;
  if (ageDays <= 90) return 1.08;
  if (ageDays <= 180) return 1.03;
  return 1;
}

const PROFILE_GENRE_TO_TMDB: Record<string, number> = {
  azione: 28,
  action: 28,
  avventura: 12,
  adventure: 12,
  animazione: 16,
  animation: 16,
  commedia: 35,
  comedy: 35,
  crime: 80,
  documentario: 99,
  documentary: 99,
  drama: 18,
  dramma: 18,
  famiglia: 10751,
  family: 10751,
  fantasy: 14,
  storia: 36,
  history: 36,
  horror: 27,
  musica: 10402,
  music: 10402,
  mistero: 9648,
  mystery: 9648,
  romance: 10749,
  romantico: 10749,
  'sci-fi': 878,
  fantascienza: 878,
  thriller: 53,
  guerra: 10752,
  war: 10752,
  western: 37,
};

function normalizeProfileGenre(value: string) {
  return value.trim().toLowerCase();
}

function getBearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
}

function parseTmdbMovieId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  if (/^\\d+$/.test(text)) {
    const numeric = Number(text);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }

  const match = text.match(/^tmdb_(\\d+)$/i);
  if (!match) return null;

  const numeric = Number(match[1]);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function posterUrl(path: string | null | undefined) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
}

function backdropUrl(path: string | null | undefined) {
  return path ? `https://image.tmdb.org/t/p/w780${path}` : null;
}

function addSeed(
  map: Map<number, Seed>,
  tmdbId: number | null,
  title: string | null,
  points: number,
  reason: SeedReason,
) {
  if (!tmdbId || points <= 0) return;

  const current = map.get(tmdbId) ?? {
    tmdbId,
    title,
    score: 0,
    reasons: [],
  };

  current.score += points;
  if (!current.title && title) current.title = title;
  if (!current.reasons.includes(reason)) current.reasons.push(reason);

  map.set(tmdbId, current);
}

function recommendationReason(seed: Seed | undefined) {
  if (!seed) return 'Scelto per i tuoi gusti';

  if (seed.reasons.includes('explicit_more_like_this')) {
    return seed.title
      ? `Perché hai chiesto più film come ${seed.title}`
      : 'Basato sui feedback che hai dato ai consigli';
  }

  if (seed.reasons.includes('favorite')) {
    return seed.title
      ? `Perché hai messo ${seed.title} tra i preferiti`
      : 'Basato sui tuoi preferiti';
  }

  if (seed.reasons.includes('high_rating')) {
    return seed.title
      ? `Perché hai dato un voto alto a ${seed.title}`
      : 'Basato sui film che hai valutato meglio';
  }

  if (seed.reasons.includes('room_winner')) {
    return seed.title
      ? `Perché avete scelto ${seed.title} in una stanza`
      : 'Basato sui film scelti nelle tue stanze';
  }

  if (seed.reasons.includes('room_match')) {
    return seed.title
      ? `Simile a un tuo match: ${seed.title}`
      : 'Basato sui tuoi match';
  }

  if (seed.reasons.includes('room_like')) {
    return seed.title
      ? `Perché hai apprezzato ${seed.title} durante uno swipe`
      : 'Basato sui tuoi swipe positivi';
  }

  if (seed.reasons.includes('watchlist')) {
    return seed.title
      ? `Simile a ${seed.title}, che vuoi vedere`
      : 'Basato sulla tua lista Da vedere';
  }

  return 'Scelto per i tuoi gusti';
}

async function fetchTmdbSimilar(tmdbId: number, apiKey: string) {
  const cached = readCache(similarCache, tmdbId);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/similar?api_key=${encodeURIComponent(apiKey)}&language=it-IT&page=1`,
    );

    if (!response.ok) return [];

    const data = await response.json();
    const movies = Array.isArray(data?.results) ? data.results : [];

    similarCache.set(tmdbId, {
      value: movies,
      expiresAt: Date.now() + TMDB_CACHE_TTL_MS,
    });

    return movies;
  } catch {
    return [];
  }
}

async function fetchTrending(apiKey: string) {
  if (trendingCache && trendingCache.expiresAt > Date.now()) {
    return trendingCache.value;
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${encodeURIComponent(apiKey)}&language=it-IT`,
    );

    if (!response.ok) return [];

    const data = await response.json();
    const movies = Array.isArray(data?.results) ? data.results : [];

    trendingCache = {
      value: movies,
      expiresAt: Date.now() + TMDB_CACHE_TTL_MS,
    };

    return movies;
  } catch {
    return [];
  }
}

async function fetchDiscoverByGenres(
  genreIds: number[],
  apiKey: string,
) {
  if (genreIds.length === 0) return [];

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(apiKey)}&language=it-IT&sort_by=popularity.desc&include_adult=false&vote_count.gte=80&with_genres=${genreIds.join('|')}&page=1`,
    );

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch {
    return [];
  }
}

async function fetchTmdbTasteDetails(tmdbId: number, apiKey: string) {
  const cached = readCache(tasteDetailsCache, tmdbId);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${encodeURIComponent(apiKey)}&language=it-IT&append_to_response=credits`,
    );

    if (!response.ok) {
      return {
        genres: [] as number[],
        actors: [] as number[],
        genreNames: {} as Record<number, string>,
        actorNames: {} as Record<number, string>,
      };
    }

    const data = await response.json();

    const genreRows = Array.isArray(data?.genres)
      ? data.genres
          .map((genre: any) => ({
            id: Number(genre?.id),
            name: String(genre?.name ?? '').trim(),
          }))
          .filter(
            (genre: { id: number; name: string }) =>
              Number.isInteger(genre.id) && genre.id > 0 && !!genre.name,
          )
      : [];

    const actorRows = Array.isArray(data?.credits?.cast)
      ? data.credits.cast
          .slice(0, 8)
          .map((person: any) => ({
            id: Number(person?.id),
            name: String(person?.name ?? '').trim(),
          }))
          .filter(
            (person: { id: number; name: string }) =>
              Number.isInteger(person.id) && person.id > 0 && !!person.name,
          )
      : [];

    const details = {
      genres: genreRows.map((genre: { id: number }) => genre.id),
      actors: actorRows.map((person: { id: number }) => person.id),
      genreNames: Object.fromEntries(
        genreRows.map((genre: { id: number; name: string }) => [
          genre.id,
          genre.name,
        ]),
      ) as Record<number, string>,
      actorNames: Object.fromEntries(
        actorRows.map((person: { id: number; name: string }) => [
          person.id,
          person.name,
        ]),
      ) as Record<number, string>,
    };

    tasteDetailsCache.set(tmdbId, {
      value: details,
      expiresAt: Date.now() + TMDB_CACHE_TTL_MS,
    });

    return details;
  } catch {
    return {
      genres: [] as number[],
      actors: [] as number[],
      genreNames: {} as Record<number, string>,
      actorNames: {} as Record<number, string>,
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tmdbApiKey = process.env.TMDB_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !tmdbApiKey) {
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const seedMap = new Map<number, Seed>();
    const excluded = new Set<number>();
    const negativeSwipeIds = new Set<number>();
    const negativeGenreWeights = new Map<number, number>();
    const tasteProfile: TasteProfile = {
      genreWeights: new Map<number, number>(),
      actorWeights: new Map<number, number>(),
      genreNames: new Map<number, string>(),
      actorNames: new Map<number, string>(),
    };

    const { data: profileRow } = await admin
      .from('users')
      .select('favorite_genres')
      .eq('id', user.id)
      .maybeSingle();

    const profileGenres = Array.isArray((profileRow as any)?.favorite_genres)
      ? (profileRow as any).favorite_genres
          .map((genre: unknown) => String(genre ?? '').trim())
          .filter(Boolean)
      : [];

    const profileGenreIds = profileGenres
      .map((genre: string) => PROFILE_GENRE_TO_TMDB[normalizeProfileGenre(genre)])
      .filter((genreId: number | undefined): genreId is number =>
        Number.isInteger(genreId),
      );

    // I generi dichiarati nel profilo sono un segnale leggero:
    // servono soprattutto per il cold start, ma non devono superare
    // preferiti, voti o feedback espliciti.
    for (const genreId of profileGenreIds) {
      tasteProfile.genreWeights.set(
        genreId,
        (tasteProfile.genreWeights.get(genreId) ?? 0) + 2.5,
      );
    }

    const { data: explicitFeedback, error: explicitFeedbackError } = await admin
      .from('user_recommendation_feedback')
      .select('tmdb_id, feedback, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (explicitFeedbackError) throw explicitFeedbackError;

    for (const row of explicitFeedback ?? []) {
      const tmdbId = parseTmdbMovieId((row as any).tmdb_id);
      if (!tmdbId) continue;

      excluded.add(tmdbId);

      if ((row as any).feedback === 'more_like_this') {
        const feedbackRecency = recencyMultiplier((row as any).updated_at);
        addSeed(
          seedMap,
          tmdbId,
          null,
          8 * feedbackRecency,
          'explicit_more_like_this',
        );
      } else if ((row as any).feedback === 'not_for_me') {
        negativeSwipeIds.add(tmdbId);
      }
    }

    const { data: entries, error: entriesError } = await admin
      .from('user_movie_entries')
      .select(`
        rating,
        is_favorite,
        in_watchlist,
        watched_on,
        updated_at,
        movie_catalog (
          provider,
          provider_movie_id,
          title
        )
      `)
      .eq('user_id', user.id);

    if (entriesError) throw entriesError;

    for (const entry of entries ?? []) {
      const catalog = Array.isArray((entry as any).movie_catalog)
        ? (entry as any).movie_catalog[0]
        : (entry as any).movie_catalog;

      if (catalog?.provider !== 'tmdb') continue;

      const tmdbId = parseTmdbMovieId(catalog.provider_movie_id);
      if (!tmdbId) continue;

      const entryRecency = recencyMultiplier((entry as any).updated_at);

      excluded.add(tmdbId);

      if ((entry as any).is_favorite === true) {
        addSeed(seedMap, tmdbId, catalog.title ?? null, 6 * entryRecency, 'favorite');
      }

      const rating = Number((entry as any).rating ?? 0);

      if (rating >= 4.5) {
        addSeed(seedMap, tmdbId, catalog.title ?? null, 6 * entryRecency, 'high_rating');
      } else if (rating >= 4) {
        addSeed(seedMap, tmdbId, catalog.title ?? null, 5 * entryRecency, 'high_rating');
      } else if (rating >= 3.5) {
        addSeed(seedMap, tmdbId, catalog.title ?? null, 3 * entryRecency, 'high_rating');
      }

      if ((entry as any).in_watchlist === true) {
        addSeed(seedMap, tmdbId, catalog.title ?? null, 2 * entryRecency, 'watchlist');
      }
    }

    const { data: swipes, error: swipesError } = await admin
      .from('room_swipes')
      .select('movie_id, liked, updated_at')
      .eq('actor_id', user.id)
      .eq('actor_type', 'user')
      .order('updated_at', { ascending: false })
      .limit(300);

    if (swipesError) throw swipesError;

    for (const swipe of swipes ?? []) {
      const tmdbId = parseTmdbMovieId((swipe as any).movie_id);
      if (!tmdbId) continue;

      excluded.add(tmdbId);

      if ((swipe as any).liked === true) {
        const swipeRecency = recencyMultiplier((swipe as any).updated_at);
        addSeed(seedMap, tmdbId, null, 2 * swipeRecency, 'room_like');
      } else {
        negativeSwipeIds.add(tmdbId);
      }
    }

    const { data: participantRows } = await admin
      .from('room_match_participants')
      .select('match_id')
      .eq('actor_id', user.id)
      .eq('actor_type', 'user')
      .limit(300);

    const matchIds = Array.from(
      new Set(
        (participantRows ?? [])
          .map((row: any) => row.match_id)
          .filter(Boolean),
      ),
    );

    if (matchIds.length > 0) {
      const { data: matchedRows } = await admin
        .from('room_matches')
        .select('id, movie_id, created_at')
        .in('id', matchIds);

      for (const match of matchedRows ?? []) {
        const tmdbId = parseTmdbMovieId((match as any).movie_id);
        if (!tmdbId) continue;

        const matchRecency = recencyMultiplier((match as any).created_at);
        addSeed(seedMap, tmdbId, null, 2 * matchRecency, 'room_match');
      }
    }

    const { data: memberships } = await admin
      .from('room_participants')
      .select('room_id')
      .eq('actor_id', user.id)
      .eq('actor_type', 'user')
      .limit(300);

    const roomIds = Array.from(
      new Set(
        (memberships ?? [])
          .map((row: any) => row.room_id)
          .filter(Boolean),
      ),
    );

    if (roomIds.length > 0) {
      const { data: rooms } = await admin
        .from('rooms')
        .select('id, selected_movie_id, selected_movie_at')
        .in('id', roomIds)
        .not('selected_movie_id', 'is', null);

      for (const room of rooms ?? []) {
        const tmdbId = parseTmdbMovieId((room as any).selected_movie_id);
        if (!tmdbId) continue;

        const winnerRecency = recencyMultiplier((room as any).selected_movie_at);
        addSeed(seedMap, tmdbId, null, 4 * winnerRecency, 'room_winner');
        excluded.add(tmdbId);
      }
    }

    for (const tmdbId of negativeSwipeIds) {
      seedMap.delete(tmdbId);
      excluded.add(tmdbId);
    }

    // Costruiamo un profilo negativo leggero dai dislike recenti.
    // Limitiamo il campione per evitare troppe chiamate a TMDB e per non
    // far pesare per sempre vecchi swipe negativi.
    const recentNegativeIds = [...negativeSwipeIds].slice(
      0,
      MAX_NEGATIVE_PROFILE_MOVIES,
    );

    if (recentNegativeIds.length > 0) {
      const negativeDetails = await Promise.all(
        recentNegativeIds.map((tmdbId) =>
          fetchTmdbTasteDetails(tmdbId, tmdbApiKey),
        ),
      );

      for (const details of negativeDetails) {
        for (const genreId of details.genres) {
          negativeGenreWeights.set(
            genreId,
            (negativeGenreWeights.get(genreId) ?? 0) + 1,
          );
        }
      }
    }

    const seeds = [...seedMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SEEDS);

    // Profilo gusti positivo: generi + attori dei seed migliori.
    // Limitiamo ai seed principali per contenere le chiamate a TMDB.
    if (seeds.length > 0) {
      const tasteDetails = await Promise.all(
        seeds.map(async (seed) => ({
          seed,
          details: await fetchTmdbTasteDetails(seed.tmdbId, tmdbApiKey),
        })),
      );

      for (const { seed, details } of tasteDetails) {
        const seedWeight = Math.max(1, seed.score);

        for (const genreId of details.genres) {
          tasteProfile.genreWeights.set(
            genreId,
            (tasteProfile.genreWeights.get(genreId) ?? 0) + seedWeight,
          );

          const genreName = details.genreNames[genreId];
          if (genreName) tasteProfile.genreNames.set(genreId, genreName);
        }

        for (const actorId of details.actors) {
          tasteProfile.actorWeights.set(
            actorId,
            (tasteProfile.actorWeights.get(actorId) ?? 0) + seedWeight * 0.65,
          );

          const actorName = details.actorNames[actorId];
          if (actorName) tasteProfile.actorNames.set(actorId, actorName);
        }
      }
    }

    const candidateMap = new Map<
      number,
      {
        movie: any;
        score: number;
        seedContributions: Array<{ seed: Seed; weight: number }>;
        actorIds?: number[];
      }
    >();

    if (seeds.length > 0) {
      const similarLists = await Promise.all(
        seeds.map(async (seed) => ({
          seed,
          movies: await fetchTmdbSimilar(seed.tmdbId, tmdbApiKey),
        })),
      );

      for (const { seed, movies } of similarLists) {
        for (let index = 0; index < movies.length; index += 1) {
          const movie = movies[index];
          const tmdbId = Number(movie?.id);

          if (!Number.isInteger(tmdbId) || tmdbId <= 0) continue;
          if (excluded.has(tmdbId)) continue;
          if (!movie?.title) continue;

          const rankFactor = Math.max(0.35, 1 - index * 0.025);
          const popularityBoost = Math.min(Number(movie.popularity ?? 0) / 100, 1.5);
          const qualityBoost =
            Number(movie.vote_count ?? 0) >= 100
              ? Math.max(0, (Number(movie.vote_average ?? 0) - 6) * 0.35)
              : 0;

          const genrePenalty = Array.isArray(movie.genre_ids)
            ? movie.genre_ids.reduce((total: number, genreId: number) => {
                const dislikesForGenre = negativeGenreWeights.get(Number(genreId)) ?? 0;

                if (dislikesForGenre <= 1) return total;
                return total + Math.min((dislikesForGenre - 1) * 0.55, 2.2);
              }, 0)
            : 0;

          const positiveGenreBoost = Array.isArray(movie.genre_ids)
            ? movie.genre_ids.reduce((total: number, genreId: number) => {
                const weight = tasteProfile.genreWeights.get(Number(genreId)) ?? 0;
                return total + Math.min(weight * 0.08, 1.4);
              }, 0)
            : 0;

          const contribution =
            seed.score * rankFactor +
            popularityBoost +
            qualityBoost +
            positiveGenreBoost -
            genrePenalty;

          const current = candidateMap.get(tmdbId) ?? {
            movie,
            score: 0,
            seedContributions: [],
          };

          current.score += contribution;
          current.seedContributions.push({
            seed,
            weight: contribution,
          });

          candidateMap.set(tmdbId, current);
        }
      }
    }

    // Attori: controlliamo solo i candidati più forti, così non moltiplichiamo
    // troppo le chiamate API. L'overlap del cast diventa un boost aggiuntivo.
    const coldStartUsed = seeds.length === 0 && profileGenreIds.length > 0;

    if (candidateMap.size < 8 && profileGenreIds.length > 0) {
      const discovered = await fetchDiscoverByGenres(
        profileGenreIds.slice(0, 4),
        tmdbApiKey,
      );

      for (const movie of discovered) {
        const tmdbId = Number(movie?.id);

        if (!Number.isInteger(tmdbId) || tmdbId <= 0) continue;
        if (excluded.has(tmdbId) || candidateMap.has(tmdbId)) continue;
        if (!movie?.title) continue;

        const genreBoost = Array.isArray(movie.genre_ids)
          ? movie.genre_ids.reduce((total: number, genreId: number) => {
              const weight = tasteProfile.genreWeights.get(Number(genreId)) ?? 0;
              return total + Math.min(weight * 0.45, 2.4);
            }, 0)
          : 0;

        candidateMap.set(tmdbId, {
          movie,
          score:
            genreBoost +
            Math.min(Number(movie.popularity ?? 0) / 90, 1.8) +
            Math.max(0, (Number(movie.vote_average ?? 0) - 6) * 0.25),
          seedContributions: [],
        });
      }
    }

    const actorCandidatePool = [...candidateMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ACTOR_CANDIDATES);

    await Promise.all(
      actorCandidatePool.map(async (candidate) => {
        const tmdbId = Number(candidate.movie?.id);
        if (!Number.isInteger(tmdbId) || tmdbId <= 0) return;

        const details = await fetchTmdbTasteDetails(tmdbId, tmdbApiKey);
        candidate.actorIds = details.actors;

        const actorBoost = details.actors.reduce(
          (total: number, actorId: number) => {
            const weight = tasteProfile.actorWeights.get(actorId) ?? 0;
            return total + Math.min(weight * 0.05, 1.2);
          },
          0,
        );

        candidate.score += Math.min(actorBoost, 3.2);
      }),
    );

    const sortedCandidates = [...candidateMap.values()]
      .sort((a, b) => {
        const aCrossSeed = Math.max(0, a.seedContributions.length - 1) * 2.5;
        const bCrossSeed = Math.max(0, b.seedContributions.length - 1) * 2.5;

        return b.score + bCrossSeed - (a.score + aCrossSeed);
      });

    // Un po' di diversità: evitiamo che i primi 20 siano quasi tutti
    // dello stesso genere pur mantenendo lo score come criterio principale.
    const genreUsage = new Map<number, number>();
    const ranked: typeof sortedCandidates = [];

    for (const candidate of sortedCandidates) {
      if (ranked.length >= MAX_RECOMMENDATIONS) break;

      const genres = Array.isArray(candidate.movie?.genre_ids)
        ? candidate.movie.genre_ids.map(Number).filter(Number.isFinite)
        : [];

      const overloaded =
        genres.length > 0 &&
        genres.every((genreId: number) => (genreUsage.get(genreId) ?? 0) >= 6);

      if (overloaded && ranked.length < 12) {
        continue;
      }

      ranked.push(candidate);

      for (const genreId of genres) {
        genreUsage.set(genreId, (genreUsage.get(genreId) ?? 0) + 1);
      }
    }

    const personalized =
      ranked.length > 0 && (seeds.length > 0 || profileGenreIds.length > 0);

    if (ranked.length < 8) {
      const trending = await fetchTrending(tmdbApiKey);

      for (const movie of trending) {
        const tmdbId = Number(movie?.id);
        if (!Number.isInteger(tmdbId) || tmdbId <= 0) continue;
        if (excluded.has(tmdbId) || candidateMap.has(tmdbId)) continue;

        candidateMap.set(tmdbId, {
          movie,
          score: Number(movie.popularity ?? 0) / 20,
          seedContributions: [],
        });
      }

      const fallbackRanked = [...candidateMap.values()]
        .sort((a, b) => {
          const aCrossSeed = Math.max(0, a.seedContributions.length - 1) * 2.5;
          const bCrossSeed = Math.max(0, b.seedContributions.length - 1) * 2.5;

          return b.score + bCrossSeed - (a.score + aCrossSeed);
        })
        .slice(0, MAX_RECOMMENDATIONS);

      ranked.splice(0, ranked.length, ...fallbackRanked);
    }

    const topGenreIds = [...tasteProfile.genreWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([genreId]) => genreId);

    const topActorIds = [...tasteProfile.actorWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([actorId]) => actorId);

    const topGenres = [...tasteProfile.genreWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, weight]) => ({
        id,
        name: tasteProfile.genreNames.get(id) ?? `Genere ${id}`,
        weight: Number(weight.toFixed(2)),
      }));

    const topActors = [...tasteProfile.actorWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, weight]) => ({
        id,
        name: tasteProfile.actorNames.get(id) ?? `Attore ${id}`,
        weight: Number(weight.toFixed(2)),
      }));

    const recommendations: Recommendation[] = ranked.map((candidate) => {
      const movie = candidate.movie;

      const strongestContribution = candidate.seedContributions
        .slice()
        .sort((a, b) => b.weight - a.weight)[0];

      return {
        tmdb_id: Number(movie.id),
        title: String(movie.title),
        year:
          typeof movie.release_date === 'string' && movie.release_date.length >= 4
            ? Number(movie.release_date.slice(0, 4))
            : null,
        cover: posterUrl(movie.poster_path),
        backdrop: backdropUrl(movie.backdrop_path),
        rating: Number(movie.vote_average ?? 0),
        vote_count: Number(movie.vote_count ?? 0),
        genre_ids: Array.isArray(movie.genre_ids)
          ? movie.genre_ids.map(Number).filter(Number.isFinite)
          : [],
        score: Number(candidate.score.toFixed(3)),
        reason: (() => {
          const candidateGenres = Array.isArray(movie.genre_ids)
            ? movie.genre_ids.map(Number)
            : [];

          const genreOverlap = candidateGenres.some((genreId: number) =>
            topGenreIds.includes(genreId),
          );

          const actorOverlap = Array.isArray(candidate.actorIds)
            ? candidate.actorIds.some((actorId: number) =>
                topActorIds.includes(actorId),
              )
            : false;

          if (actorOverlap && strongestContribution) {
            return `${recommendationReason(strongestContribution.seed)} · cast affine ai tuoi gusti`;
          }

          if (genreOverlap && strongestContribution) {
            return `${recommendationReason(strongestContribution.seed)} · genere affine ai tuoi gusti`;
          }

          if (strongestContribution) {
            return recommendationReason(strongestContribution.seed);
          }

          if (coldStartUsed && profileGenres.length > 0) {
            return `Perché hai indicato ${profileGenres
              .slice(0, 2)
              .join(' e ')} tra i tuoi generi preferiti`;
          }

          return 'Tra i film più interessanti del momento';
        })(),
        based_on: candidate.seedContributions
          .slice()
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 3)
          .map(({ seed, weight }) => ({
            tmdb_id: seed.tmdbId,
            title: seed.title,
            weight: Number(weight.toFixed(2)),
          })),
      };
    });

    const collections: RecommendationCollections = {
      from_favorites: recommendations
        .filter((movie) => {
          const reason = movie.reason.toLowerCase();
          return (
            reason.includes('preferit') ||
            reason.includes('voto alto') ||
            reason.includes('valutat') ||
            reason.includes('più film come')
          );
        })
        .slice(0, 8),

      from_rooms: recommendations
        .filter((movie) => {
          const reason = movie.reason.toLowerCase();
          return (
            reason.includes('match') ||
            reason.includes('stanza') ||
            reason.includes('swipe')
          );
        })
        .slice(0, 8),

      cast_affinity: recommendations
        .filter((movie) =>
          movie.reason.toLowerCase().includes('cast affine'),
        )
        .slice(0, 8),

      profile_genres: recommendations
        .filter((movie) =>
          movie.reason.toLowerCase().includes('hai indicato'),
        )
        .slice(0, 8),
    };

    const feedbackMap: Record<
      number,
      'more_like_this' | 'not_for_me'
    > = {};

    for (const row of explicitFeedback ?? []) {
      const tmdbId = parseTmdbMovieId((row as any).tmdb_id);
      const feedback = (row as any).feedback;

      if (
        tmdbId &&
        (feedback === 'more_like_this' || feedback === 'not_for_me')
      ) {
        feedbackMap[tmdbId] = feedback;
      }
    }

    res.setHeader('Cache-Control', 'private, no-store');

    return res.status(200).json({
      recommendations,
      collections,
      feedback: feedbackMap,
      meta: {
        personalized,
        seeds_used: seeds.length,
        positive_signals: seedMap.size,
        excluded_movies: excluded.size,
        negative_genres: negativeGenreWeights.size,
        taste_genres: tasteProfile.genreWeights.size,
        taste_actors: tasteProfile.actorWeights.size,
        top_genres: topGenres,
        top_actors: topActors,
        profile_genres: profileGenres,
        cold_start_used: coldStartUsed,
      },
    });
  } catch (error) {
    console.error('recommendations/for-you failed:', error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Impossibile creare i consigli personalizzati',
    });
  }
}
