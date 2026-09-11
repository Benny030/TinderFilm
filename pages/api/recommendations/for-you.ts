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

type SeedGroup = 'personal' | 'rooms';

type Seed = {
  tmdbId: number;
  title: string | null;
  score: number;
  reasons: SeedReason[];
  group: SeedGroup;
};

type RecommendationSource =
  | 'favorite'
  | 'room'
  | 'cast'
  | 'profile_genre'
  | 'exploration';

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
  source: RecommendationSource;
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
  exploration: Recommendation[];
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
    source_mix?: {
      favorite: number;
      room: number;
      cast: number;
      profile_genre: number;
      exploration: number;
    };
  };
};

type ErrorResponse = {
  error: string;
};

type TasteDetails = {
  genres: number[];
  actors: number[];
  genreNames: Record<number, string>;
  actorNames: Record<number, string>;
};

type Candidate = {
  movie: any;
  score: number;
  source: RecommendationSource;
  basedOn: Array<{
    seed: Seed;
    weight: number;
  }>;
};

const MAX_PERSONAL_SEEDS = 6;
const MAX_ROOM_SEEDS = 4;
const MAX_RECOMMENDATIONS = 24;
const COLLECTION_SIZE = 8;

const SOURCE_QUOTAS: Record<
  RecommendationSource,
  number
> = {
  favorite: 9,
  room: 5,
  cast: 4,
  profile_genre: 6,
  exploration: 4,
};
const TMDB_CACHE_TTL_MS = 15 * 60 * 1000;

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

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const similarCache = new Map<number, CacheEntry<any[]>>();
const detailsCache = new Map<number, CacheEntry<TasteDetails>>();
const discoverGenreCache = new Map<string, CacheEntry<any[]>>();
const discoverCastCache = new Map<string, CacheEntry<any[]>>();
let trendingCache: CacheEntry<any[]> | null = null;

function getBearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
}

function parseTmdbMovieId(value: unknown): number | null {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0
  ) {
    return value;
  }

  const text = String(value ?? '').trim();

  if (!text) return null;

  if (/^\d+$/.test(text)) {
    const numeric = Number(text);

    return Number.isInteger(numeric) && numeric > 0
      ? numeric
      : null;
  }

  const match = text.match(/^tmdb_(\d+)$/i);

  if (!match) return null;

  const numeric = Number(match[1]);

  return Number.isInteger(numeric) && numeric > 0
    ? numeric
    : null;
}

function normalizeProfileGenre(value: string) {
  return value.trim().toLowerCase();
}

function recencyMultiplier(value: unknown): number {
  if (!value) return 1;

  const timestamp = new Date(String(value)).getTime();

  if (!Number.isFinite(timestamp)) return 1;

  const ageDays = Math.max(
    0,
    (Date.now() - timestamp) / 86_400_000,
  );

  if (ageDays <= 7) return 1.2;
  if (ageDays <= 30) return 1.12;
  if (ageDays <= 90) return 1.06;

  return 1;
}

function readCache<T>(
  cache: Map<string | number, CacheEntry<T>>,
  key: string | number,
): T | null {
  const cached = cache.get(key);

  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function writeCache<T>(
  cache: Map<string | number, CacheEntry<T>>,
  key: string | number,
  value: T,
) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + TMDB_CACHE_TTL_MS,
  });
}

function posterUrl(path: string | null | undefined) {
  return path
    ? `https://image.tmdb.org/t/p/w500${path}`
    : null;
}

function backdropUrl(path: string | null | undefined) {
  return path
    ? `https://image.tmdb.org/t/p/w780${path}`
    : null;
}

function addSeed(
  map: Map<number, Seed>,
  tmdbId: number | null,
  title: string | null,
  points: number,
  reason: SeedReason,
  group: SeedGroup,
) {
  if (!tmdbId || points <= 0) return;

  const current = map.get(tmdbId) ?? {
    tmdbId,
    title,
    score: 0,
    reasons: [],
    group,
  };

  current.score += points;

  if (!current.title && title) {
    current.title = title;
  }

  if (!current.reasons.includes(reason)) {
    current.reasons.push(reason);
  }

  if (group === 'personal') {
    current.group = 'personal';
  }

  map.set(tmdbId, current);
}

function seedReason(seed: Seed | undefined) {
  if (!seed) {
    return 'Scelto per i tuoi gusti';
  }

  if (seed.reasons.includes('explicit_more_like_this')) {
    return seed.title
      ? `Perché vuoi più film come ${seed.title}`
      : 'Basato sui feedback che hai dato';
  }

  if (seed.reasons.includes('favorite')) {
    return seed.title
      ? `Perché ami ${seed.title}`
      : 'Basato sui tuoi film preferiti';
  }

  if (seed.reasons.includes('high_rating')) {
    return seed.title
      ? `Perché hai apprezzato molto ${seed.title}`
      : 'Basato sui film che hai valutato meglio';
  }

  if (seed.reasons.includes('room_winner')) {
    return seed.title
      ? `Dopo la scelta di ${seed.title} in una stanza`
      : 'Basato sui film scelti nelle tue stanze';
  }

  if (seed.reasons.includes('room_match')) {
    return seed.title
      ? `Vicino a un tuo match: ${seed.title}`
      : 'Basato sui tuoi match';
  }

  if (seed.reasons.includes('room_like')) {
    return seed.title
      ? `Dopo il tuo swipe su ${seed.title}`
      : 'Basato sui tuoi swipe positivi';
  }

  if (seed.reasons.includes('watchlist')) {
    return seed.title
      ? `Potrebbe piacerti se ti interessa ${seed.title}`
      : 'Basato su un titolo della tua lista';
  }

  return 'Scelto per i tuoi gusti';
}

function qualityScore(movie: any) {
  const rating = Number(movie?.vote_average ?? 0);
  const votes = Number(movie?.vote_count ?? 0);
  const popularity = Number(movie?.popularity ?? 0);

  const ratingBoost =
    votes >= 500
      ? Math.max(0, rating - 6.2) * 0.7
      : votes >= 100
        ? Math.max(0, rating - 6.4) * 0.35
        : 0;

  const popularityBoost = Math.min(
    popularity / 140,
    1.2,
  );

  return ratingBoost + popularityBoost;
}

function movieIsUsable(movie: any) {
  const tmdbId = Number(movie?.id);

  return (
    Number.isInteger(tmdbId) &&
    tmdbId > 0 &&
    Boolean(movie?.title || movie?.original_title)
  );
}

async function fetchTmdbSimilar(
  tmdbId: number,
  apiKey: string,
) {
  const cached = readCache(
    similarCache as Map<string | number, CacheEntry<any[]>>,
    tmdbId,
  );

  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/recommendations?api_key=${encodeURIComponent(apiKey)}&language=it-IT&page=1`,
    );

    if (!response.ok) {
      const fallback = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}/similar?api_key=${encodeURIComponent(apiKey)}&language=it-IT&page=1`,
      );

      if (!fallback.ok) return [];

      const fallbackData = await fallback.json();
      const fallbackMovies = Array.isArray(fallbackData?.results)
        ? fallbackData.results
        : [];

      writeCache(
        similarCache as Map<string | number, CacheEntry<any[]>>,
        tmdbId,
        fallbackMovies,
      );

      return fallbackMovies;
    }

    const data = await response.json();
    const movies = Array.isArray(data?.results)
      ? data.results
      : [];

    writeCache(
      similarCache as Map<string | number, CacheEntry<any[]>>,
      tmdbId,
      movies,
    );

    return movies;
  } catch {
    return [];
  }
}

async function fetchMovieDetails(
  tmdbId: number,
  apiKey: string,
): Promise<TasteDetails> {
  const cached = readCache(
    detailsCache as Map<string | number, CacheEntry<TasteDetails>>,
    tmdbId,
  );

  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${encodeURIComponent(apiKey)}&language=it-IT&append_to_response=credits`,
    );

    if (!response.ok) {
      return {
        genres: [],
        actors: [],
        genreNames: {},
        actorNames: {},
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
              Number.isInteger(genre.id) &&
              genre.id > 0 &&
              Boolean(genre.name),
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
              Number.isInteger(person.id) &&
              person.id > 0 &&
              Boolean(person.name),
          )
      : [];

    const details: TasteDetails = {
      genres: genreRows.map(
        (genre: { id: number }) => genre.id,
      ),
      actors: actorRows.map(
        (person: { id: number }) => person.id,
      ),
      genreNames: Object.fromEntries(
        genreRows.map(
          (genre: { id: number; name: string }) => [
            genre.id,
            genre.name,
          ],
        ),
      ),
      actorNames: Object.fromEntries(
        actorRows.map(
          (person: { id: number; name: string }) => [
            person.id,
            person.name,
          ],
        ),
      ),
    };

    writeCache(
      detailsCache as Map<string | number, CacheEntry<TasteDetails>>,
      tmdbId,
      details,
    );

    return details;
  } catch {
    return {
      genres: [],
      actors: [],
      genreNames: {},
      actorNames: {},
    };
  }
}

async function fetchDiscoverByGenres(
  genreIds: number[],
  apiKey: string,
) {
  const ids = [...new Set(genreIds)]
    .filter(Number.isInteger)
    .slice(0, 4);

  if (ids.length === 0) return [];

  const key = ids.sort((a, b) => a - b).join('|');

  const cached = readCache(
    discoverGenreCache as Map<
      string | number,
      CacheEntry<any[]>
    >,
    key,
  );

  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: 'it-IT',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'vote_count.gte': '150',
      with_genres: ids.join('|'),
      page: '1',
    });

    const response = await fetch(
      `https://api.themoviedb.org/3/discover/movie?${params.toString()}`,
    );

    if (!response.ok) return [];

    const data = await response.json();
    const movies = Array.isArray(data?.results)
      ? data.results
      : [];

    writeCache(
      discoverGenreCache as Map<
        string | number,
        CacheEntry<any[]>
      >,
      key,
      movies,
    );

    return movies;
  } catch {
    return [];
  }
}

async function fetchDiscoverByCast(
  actorIds: number[],
  apiKey: string,
) {
  const ids = [...new Set(actorIds)]
    .filter(Number.isInteger)
    .slice(0, 2);

  if (ids.length === 0) return [];

  const key = ids.join('|');

  const cached = readCache(
    discoverCastCache as Map<
      string | number,
      CacheEntry<any[]>
    >,
    key,
  );

  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: 'it-IT',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'vote_count.gte': '100',
      with_cast: ids.join('|'),
      page: '1',
    });

    const response = await fetch(
      `https://api.themoviedb.org/3/discover/movie?${params.toString()}`,
    );

    if (!response.ok) return [];

    const data = await response.json();
    const movies = Array.isArray(data?.results)
      ? data.results
      : [];

    writeCache(
      discoverCastCache as Map<
        string | number,
        CacheEntry<any[]>
      >,
      key,
      movies,
    );

    return movies;
  } catch {
    return [];
  }
}

async function fetchTrending(apiKey: string) {
  if (
    trendingCache &&
    trendingCache.expiresAt > Date.now()
  ) {
    return trendingCache.value;
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${encodeURIComponent(apiKey)}&language=it-IT`,
    );

    if (!response.ok) return [];

    const data = await response.json();
    const movies = Array.isArray(data?.results)
      ? data.results
      : [];

    trendingCache = {
      value: movies,
      expiresAt:
        Date.now() + TMDB_CACHE_TTL_MS,
    };

    return movies;
  } catch {
    return [];
  }
}

function addCandidate(
  map: Map<number, Candidate>,
  movie: any,
  source: RecommendationSource,
  score: number,
  seed?: Seed,
) {
  if (!movieIsUsable(movie)) return;

  const tmdbId = Number(movie.id);

  const current = map.get(tmdbId);

  if (!current) {
    map.set(tmdbId, {
      movie,
      score,
      source,
      basedOn: seed
        ? [{ seed, weight: score }]
        : [],
    });

    return;
  }

  current.score += score;

  if (seed) {
    current.basedOn.push({
      seed,
      weight: score,
    });
  }

  if (
    source === 'favorite' &&
    current.source !== 'favorite'
  ) {
    current.source = 'favorite';
  } else if (
    source === 'room' &&
    current.source === 'exploration'
  ) {
    current.source = 'room';
  }
}

function candidateToRecommendation(
  candidate: Candidate,
  genreNames: Map<number, string>,
  actorNames: Map<number, string>,
  topActorIds: number[],
) : Recommendation {
  const movie = candidate.movie;

  const strongestSeed = [...candidate.basedOn]
    .sort((a, b) => b.weight - a.weight)[0]
    ?.seed;

  let reason = seedReason(strongestSeed);

  if (candidate.source === 'profile_genre') {
    const movieGenres = Array.isArray(movie?.genre_ids)
      ? movie.genre_ids
          .map(Number)
          .map((id: number) => genreNames.get(id))
          .filter(Boolean)
          .slice(0, 2)
      : [];

    reason =
      movieGenres.length > 0
        ? `Perché tra i tuoi gusti ci sono ${movieGenres.join(' e ')}`
        : 'Scelto dai generi che hai indicato';
  }

  if (candidate.source === 'cast') {
    const actor = topActorIds
      .map((id) => actorNames.get(id))
      .find(Boolean);

    reason = actor
      ? `Perché guardi spesso film con ${actor}`
      : 'Basato sugli attori che ricorrono nei tuoi gusti';
  }

  if (candidate.source === 'exploration') {
    reason =
      'Un titolo diverso dai tuoi soliti segnali, per allargare il tuo Per te';
  }

  const contributions = [...candidate.basedOn]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(({ seed, weight }) => ({
      tmdb_id: seed.tmdbId,
      title: seed.title,
      weight: Number(weight.toFixed(3)),
    }));

  return {
    tmdb_id: Number(movie.id),
    title: String(
      movie.title ??
        movie.original_title ??
        'Senza titolo',
    ),
    year:
      typeof movie.release_date === 'string' &&
      movie.release_date.length >= 4
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
    reason,
    source: candidate.source,
    based_on: contributions,
  };
}

function diversify(
  recommendations: Recommendation[],
  limit: number,
) {
  const output: Recommendation[] = [];
  const genreUsage = new Map<number, number>();

  for (const movie of recommendations) {
    if (output.length >= limit) break;

    const genres = movie.genre_ids;

    const overloaded =
      genres.length > 0 &&
      genres.every(
        (genreId) =>
          (genreUsage.get(genreId) ?? 0) >= 5,
      );

    if (overloaded && output.length < 12) {
      continue;
    }

    output.push(movie);

    for (const genreId of genres) {
      genreUsage.set(
        genreId,
        (genreUsage.get(genreId) ?? 0) + 1,
      );
    }
  }

  return output;
}

function mixSources(
  recommendations: Recommendation[],
  limit: number,
) {
  const selected: Recommendation[] = [];
  const selectedIds = new Set<number>();
  const sourceUsage = new Map<
    RecommendationSource,
    number
  >();

  const take = (
    movie: Recommendation,
    ignoreQuota = false,
  ) => {
    if (
      selected.length >= limit ||
      selectedIds.has(movie.tmdb_id)
    ) {
      return false;
    }

    const used =
      sourceUsage.get(movie.source) ?? 0;

    const quota =
      SOURCE_QUOTAS[movie.source];

    if (!ignoreQuota && used >= quota) {
      return false;
    }

    selected.push(movie);
    selectedIds.add(movie.tmdb_id);
    sourceUsage.set(
      movie.source,
      used + 1,
    );

    return true;
  };

  /*
   * Primo passaggio:
   * assicuriamo che il feed non sia composto quasi tutto
   * da una sola sorgente, anche quando quella sorgente ha
   * score leggermente superiori.
   */
  const sourceOrder: RecommendationSource[] = [
    'favorite',
    'profile_genre',
    'room',
    'cast',
    'exploration',
  ];

  for (const source of sourceOrder) {
    const sourceMovies =
      recommendations.filter(
        (movie) => movie.source === source,
      );

    const minimum =
      source === 'favorite'
        ? 4
        : source === 'profile_genre'
          ? 3
          : source === 'room'
            ? 2
            : source === 'cast'
              ? 2
              : 1;

    let added = 0;

    for (const movie of sourceMovies) {
      if (added >= minimum) break;

      if (take(movie)) {
        added += 1;
      }
    }
  }

  /*
   * Secondo passaggio:
   * riempiamo in ordine di score rispettando le quote.
   */
  for (const movie of recommendations) {
    if (selected.length >= limit) break;
    take(movie);
  }

  /*
   * Ultimo fallback:
   * se una sorgente non aveva abbastanza candidati, non lasciamo
   * buchi: riempiamo coi migliori rimanenti anche oltre quota.
   */
  for (const movie of recommendations) {
    if (selected.length >= limit) break;
    take(movie, true);
  }

  return selected;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    SuccessResponse | ErrorResponse
  >,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');

    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tmdbApiKey =
    process.env.TMDB_API_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !serviceRoleKey ||
    !tmdbApiKey
  ) {
    return res.status(500).json({
      error:
        'Configurazione server incompleta',
    });
  }

  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Autenticazione richiesta',
    });
  }

  const authClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } =
    await authClient.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({
      error: 'Sessione non valida',
    });
  }

  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  try {
    const personalSeedMap =
      new Map<number, Seed>();
    const roomSeedMap =
      new Map<number, Seed>();
    const excluded =
      new Set<number>();
    const explicitNegativeIds =
      new Set<number>();
    const roomNegativeIds =
      new Set<number>();

    const impressionMap =
      new Map<
        number,
        {
          count: number;
          lastSeenAt: string | null;
        }
      >();

    const genreWeights =
      new Map<number, number>();
    const actorWeights =
      new Map<number, number>();
    const genreNames =
      new Map<number, string>();
    const actorNames =
      new Map<number, string>();

    const { data: profileRow } =
      await admin
        .from('users')
        .select('favorite_genres')
        .eq('id', user.id)
        .maybeSingle();

    const profileGenres = Array.isArray(
      (profileRow as any)?.favorite_genres,
    )
      ? (profileRow as any).favorite_genres
          .map((genre: unknown) =>
            String(genre ?? '').trim(),
          )
          .filter(Boolean)
      : [];

    const profileGenreIds = profileGenres
      .map(
        (genre: string) =>
          PROFILE_GENRE_TO_TMDB[
            normalizeProfileGenre(genre)
          ],
      )
      .filter(
        (
          genreId: number | undefined,
        ): genreId is number =>
          Number.isInteger(genreId),
      );

    for (const genreId of profileGenreIds) {
      genreWeights.set(
        genreId,
        (genreWeights.get(genreId) ?? 0) + 2,
      );
    }

    const {
      data: impressionRows,
      error: impressionsError,
    } = await admin
      .from('user_recommendation_impressions')
      .select('tmdb_id, impression_count, last_seen_at')
      .eq('user_id', user.id)
      .order('last_seen_at', {
        ascending: false,
      })
      .limit(500);

    if (impressionsError) {
      /*
       * Durante il primo deploy la tabella potrebbe non essere
       * stata ancora creata: non blocchiamo tutto il Per te.
       */
      console.warn(
        'recommendation impressions unavailable:',
        impressionsError.message,
      );
    } else {
      for (const row of impressionRows ?? []) {
        const tmdbId = parseTmdbMovieId(
          (row as any).tmdb_id,
        );

        if (!tmdbId) continue;

        impressionMap.set(tmdbId, {
          count: Math.max(
            1,
            Number(
              (row as any)
                .impression_count ?? 1,
            ),
          ),
          lastSeenAt:
            typeof (row as any)
              .last_seen_at === 'string'
              ? (row as any)
                  .last_seen_at
              : null,
        });
      }
    }

    const {
      data: explicitFeedback,
      error: feedbackError,
    } = await admin
      .from('user_recommendation_feedback')
      .select(
        'tmdb_id, feedback, updated_at',
      )
      .eq('user_id', user.id)
      .order('updated_at', {
        ascending: false,
      })
      .limit(200);

    if (feedbackError) {
      throw feedbackError;
    }

    for (const row of explicitFeedback ?? []) {
      const tmdbId = parseTmdbMovieId(
        (row as any).tmdb_id,
      );

      if (!tmdbId) continue;

      excluded.add(tmdbId);

      if (
        (row as any).feedback ===
        'more_like_this'
      ) {
        addSeed(
          personalSeedMap,
          tmdbId,
          null,
          9 *
            recencyMultiplier(
              (row as any).updated_at,
            ),
          'explicit_more_like_this',
          'personal',
        );
      } else if (
        (row as any).feedback ===
        'not_for_me'
      ) {
        explicitNegativeIds.add(tmdbId);
      }
    }

    const {
      data: entries,
      error: entriesError,
    } = await admin
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

    if (entriesError) {
      throw entriesError;
    }

    for (const entry of entries ?? []) {
      const catalog = Array.isArray(
        (entry as any).movie_catalog,
      )
        ? (entry as any).movie_catalog[0]
        : (entry as any).movie_catalog;

      if (catalog?.provider !== 'tmdb') {
        continue;
      }

      const tmdbId = parseTmdbMovieId(
        catalog.provider_movie_id,
      );

      if (!tmdbId) continue;

      excluded.add(tmdbId);

      const recency = recencyMultiplier(
        (entry as any).updated_at,
      );

      if (
        (entry as any).is_favorite === true
      ) {
        addSeed(
          personalSeedMap,
          tmdbId,
          catalog.title ?? null,
          8 * recency,
          'favorite',
          'personal',
        );
      }

      const rating = Number(
        (entry as any).rating ?? 0,
      );

      if (rating >= 4.5) {
        addSeed(
          personalSeedMap,
          tmdbId,
          catalog.title ?? null,
          7 * recency,
          'high_rating',
          'personal',
        );
      } else if (rating >= 4) {
        addSeed(
          personalSeedMap,
          tmdbId,
          catalog.title ?? null,
          5 * recency,
          'high_rating',
          'personal',
        );
      }

      /*
       * Watchlist = interesse, non gradimento.
       * La lasciamo come segnale debolissimo e non la facciamo
       * mai dominare preferiti/voti/feedback esplicito.
       */
      if (
        (entry as any).in_watchlist === true &&
        !(entry as any).is_favorite &&
        rating < 4
      ) {
        addSeed(
          personalSeedMap,
          tmdbId,
          catalog.title ?? null,
          0.75 * recency,
          'watchlist',
          'personal',
        );
      }
    }

    const {
      data: swipes,
      error: swipesError,
    } = await admin
      .from('room_swipes')
      .select(
        'movie_id, liked, updated_at',
      )
      .eq('actor_id', user.id)
      .eq('actor_type', 'user')
      .order('updated_at', {
        ascending: false,
      })
      .limit(300);

    if (swipesError) {
      throw swipesError;
    }

    for (const swipe of swipes ?? []) {
      const tmdbId = parseTmdbMovieId(
        (swipe as any).movie_id,
      );

      if (!tmdbId) continue;

      excluded.add(tmdbId);

      if ((swipe as any).liked === true) {
        addSeed(
          roomSeedMap,
          tmdbId,
          null,
          1.5 *
            recencyMultiplier(
              (swipe as any).updated_at,
            ),
          'room_like',
          'rooms',
        );
      } else {
        roomNegativeIds.add(tmdbId);
      }
    }

    const { data: participantRows } =
      await admin
        .from('room_match_participants')
        .select('match_id')
        .eq('actor_id', user.id)
        .eq('actor_type', 'user')
        .limit(300);

    const matchIds = Array.from(
      new Set(
        (participantRows ?? [])
          .map(
            (row: any) => row.match_id,
          )
          .filter(Boolean),
      ),
    );

    if (matchIds.length > 0) {
      const { data: matchedRows } =
        await admin
          .from('room_matches')
          .select(
            'id, movie_id, created_at',
          )
          .in('id', matchIds);

      for (const match of matchedRows ?? []) {
        const tmdbId = parseTmdbMovieId(
          (match as any).movie_id,
        );

        if (!tmdbId) continue;

        addSeed(
          roomSeedMap,
          tmdbId,
          null,
          3 *
            recencyMultiplier(
              (match as any).created_at,
            ),
          'room_match',
          'rooms',
        );
      }
    }

    const { data: memberships } =
      await admin
        .from('room_participants')
        .select('room_id')
        .eq('actor_id', user.id)
        .eq('actor_type', 'user')
        .limit(300);

    const roomIds = Array.from(
      new Set(
        (memberships ?? [])
          .map(
            (row: any) => row.room_id,
          )
          .filter(Boolean),
      ),
    );

    if (roomIds.length > 0) {
      const { data: rooms } =
        await admin
          .from('rooms')
          .select(
            'id, selected_movie_id, selected_movie_at',
          )
          .in('id', roomIds)
          .not(
            'selected_movie_id',
            'is',
            null,
          );

      for (const room of rooms ?? []) {
        const tmdbId = parseTmdbMovieId(
          (room as any)
            .selected_movie_id,
        );

        if (!tmdbId) continue;

        excluded.add(tmdbId);

        addSeed(
          roomSeedMap,
          tmdbId,
          null,
          5 *
            recencyMultiplier(
              (room as any)
                .selected_movie_at,
            ),
          'room_winner',
          'rooms',
        );
      }
    }

    for (const tmdbId of explicitNegativeIds) {
      personalSeedMap.delete(tmdbId);
      roomSeedMap.delete(tmdbId);
      excluded.add(tmdbId);
    }

    for (const tmdbId of roomNegativeIds) {
      roomSeedMap.delete(tmdbId);
      excluded.add(tmdbId);
    }

    const personalSeeds = [
      ...personalSeedMap.values(),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PERSONAL_SEEDS);

    const roomSeeds = [
      ...roomSeedMap.values(),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ROOM_SEEDS);

    const allTasteSeeds = [
      ...personalSeeds,
      ...roomSeeds,
    ].slice(0, 8);

    if (allTasteSeeds.length > 0) {
      const detailsRows =
        await Promise.all(
          allTasteSeeds.map(
            async (seed) => ({
              seed,
              details:
                await fetchMovieDetails(
                  seed.tmdbId,
                  tmdbApiKey,
                ),
            }),
          ),
        );

      for (const {
        seed,
        details,
      } of detailsRows) {
        const base =
          seed.group === 'personal'
            ? seed.score
            : seed.score * 0.7;

        for (const genreId of details.genres) {
          genreWeights.set(
            genreId,
            (genreWeights.get(genreId) ?? 0) +
              base,
          );

          const name =
            details.genreNames[genreId];

          if (name) {
            genreNames.set(
              genreId,
              name,
            );
          }
        }

        for (const actorId of details.actors) {
          actorWeights.set(
            actorId,
            (actorWeights.get(actorId) ?? 0) +
              base * 0.45,
          );

          const name =
            details.actorNames[actorId];

          if (name) {
            actorNames.set(
              actorId,
              name,
            );
          }
        }
      }
    }

    /*
     * Profilo negativo: non penalizziamo un genere per un solo dislike.
     * Solo dopo almeno 3 segnali negativi sullo stesso genere applichiamo
     * una penalità leggera.
     */
    const recentNegativeIds = [
      ...explicitNegativeIds,
      ...roomNegativeIds,
    ].slice(0, 12);

    const negativeGenreCounts =
      new Map<number, number>();

    if (recentNegativeIds.length > 0) {
      const negativeDetails =
        await Promise.all(
          recentNegativeIds.map(
            (tmdbId) =>
              fetchMovieDetails(
                tmdbId,
                tmdbApiKey,
              ),
          ),
        );

      for (const details of negativeDetails) {
        for (const genreId of details.genres) {
          negativeGenreCounts.set(
            genreId,
            (negativeGenreCounts.get(
              genreId,
            ) ?? 0) + 1,
          );
        }
      }
    }

    const negativeGenrePenalty = (
      movie: any,
    ) => {
      const genres = Array.isArray(
        movie?.genre_ids,
      )
        ? movie.genre_ids.map(Number)
        : [];

      return genres.reduce(
        (total: number, genreId: number) => {
          const count =
            negativeGenreCounts.get(
              genreId,
            ) ?? 0;

          if (count < 3) {
            return total;
          }

          return (
            total +
            Math.min(
              (count - 2) * 0.35,
              1.4,
            )
          );
        },
        0,
      );
    };

    const impressionPenalty = (
      tmdbId: number,
    ) => {
      const impression =
        impressionMap.get(tmdbId);

      if (!impression) {
        return 0;
      }

      const lastSeen =
        impression.lastSeenAt
          ? new Date(
              impression.lastSeenAt,
            ).getTime()
          : NaN;

      const ageHours =
        Number.isFinite(lastSeen)
          ? Math.max(
              0,
              (Date.now() -
                lastSeen) /
                3_600_000,
            )
          : 9999;

      /*
       * Un film appena mostrato perde parecchia priorità.
       * Col passare dei giorni la penalità si attenua e
       * il titolo può tornare se continua ad essere molto affine.
       */
      let recencyPenalty = 0;

      if (ageHours < 6) {
        recencyPenalty = 5.5;
      } else if (ageHours < 24) {
        recencyPenalty = 4;
      } else if (ageHours < 72) {
        recencyPenalty = 2.6;
      } else if (ageHours < 168) {
        recencyPenalty = 1.4;
      } else if (ageHours < 336) {
        recencyPenalty = 0.6;
      }

      const repetitionPenalty =
        Math.min(
          Math.max(
            impression.count - 1,
            0,
          ) * 0.35,
          1.75,
        );

      return (
        recencyPenalty +
        repetitionPenalty
      );
    };

    const positiveGenreBoost = (
      movie: any,
    ) => {
      const genres = Array.isArray(
        movie?.genre_ids,
      )
        ? movie.genre_ids.map(Number)
        : [];

      return genres.reduce(
        (total: number, genreId: number) =>
          total +
          Math.min(
            (genreWeights.get(
              genreId,
            ) ?? 0) * 0.06,
            1.2,
          ),
        0,
      );
    };

    const candidateMap =
      new Map<number, Candidate>();

    const buildFromSeeds = async (
      seeds: Seed[],
      source: RecommendationSource,
    ) => {
      const lists = await Promise.all(
        seeds.map(
          async (seed) => ({
            seed,
            movies:
              await fetchTmdbSimilar(
                seed.tmdbId,
                tmdbApiKey,
              ),
          }),
        ),
      );

      for (const {
        seed,
        movies,
      } of lists) {
        for (
          let index = 0;
          index < movies.length;
          index += 1
        ) {
          const movie = movies[index];

          if (!movieIsUsable(movie)) {
            continue;
          }

          const tmdbId = Number(
            movie.id,
          );

          if (
            excluded.has(tmdbId) ||
            explicitNegativeIds.has(
              tmdbId,
            )
          ) {
            continue;
          }

          const rankFactor = Math.max(
            0.35,
            1 - index * 0.03,
          );

          const score =
            seed.score * rankFactor +
            qualityScore(movie) +
            positiveGenreBoost(movie) -
            negativeGenrePenalty(movie) -
            impressionPenalty(tmdbId);

          addCandidate(
            candidateMap,
            movie,
            source,
            score,
            seed,
          );
        }
      }
    };

    await Promise.all([
      buildFromSeeds(
        personalSeeds,
        'favorite',
      ),
      buildFromSeeds(
        roomSeeds,
        'room',
      ),
    ]);

    const topGenreIds = [
      ...genreWeights.entries(),
    ]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([genreId]) => genreId);

    const profileSourceGenreIds =
      topGenreIds.length > 0
        ? topGenreIds
        : profileGenreIds;

    if (
      profileSourceGenreIds.length > 0
    ) {
      const discovered =
        await fetchDiscoverByGenres(
          profileSourceGenreIds,
          tmdbApiKey,
        );

      for (const movie of discovered) {
        if (!movieIsUsable(movie)) {
          continue;
        }

        const tmdbId = Number(movie.id);

        if (
          excluded.has(tmdbId) ||
          explicitNegativeIds.has(
            tmdbId,
          )
        ) {
          continue;
        }

        const score =
          2.2 +
          qualityScore(movie) +
          positiveGenreBoost(movie) -
          negativeGenrePenalty(movie) -
          impressionPenalty(tmdbId);

        addCandidate(
          candidateMap,
          movie,
          'profile_genre',
          score,
        );
      }
    }

    const topActorIds = [
      ...actorWeights.entries(),
    ]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([actorId]) => actorId);

    if (topActorIds.length > 0) {
      const castMovies =
        await fetchDiscoverByCast(
          topActorIds,
          tmdbApiKey,
        );

      for (const movie of castMovies) {
        if (!movieIsUsable(movie)) {
          continue;
        }

        const tmdbId = Number(movie.id);

        if (
          excluded.has(tmdbId) ||
          explicitNegativeIds.has(
            tmdbId,
          )
        ) {
          continue;
        }

        const score =
          2.8 +
          qualityScore(movie) +
          positiveGenreBoost(movie) -
          negativeGenrePenalty(movie) -
          impressionPenalty(tmdbId);

        addCandidate(
          candidateMap,
          movie,
          'cast',
          score,
        );
      }
    }

    /*
     * Esplorazione controllata:
     * pochi titoli trending, mai più forti dei segnali personali.
     */
    const trending =
      await fetchTrending(tmdbApiKey);

    let explorationAdded = 0;

    for (const movie of trending) {
      if (explorationAdded >= 8) {
        break;
      }

      if (!movieIsUsable(movie)) {
        continue;
      }

      const tmdbId = Number(movie.id);

      if (
        excluded.has(tmdbId) ||
        explicitNegativeIds.has(
          tmdbId,
        ) ||
        candidateMap.has(tmdbId)
      ) {
        continue;
      }

      const score =
        0.8 +
        qualityScore(movie) * 0.65 +
        positiveGenreBoost(movie) * 0.35 -
        negativeGenrePenalty(movie) -
        impressionPenalty(tmdbId) * 0.8;

      addCandidate(
        candidateMap,
        movie,
        'exploration',
        score,
      );

      explorationAdded += 1;
    }

    const allRecommendations = [
      ...candidateMap.values(),
    ]
      .sort((a, b) => b.score - a.score)
      .map((candidate) =>
        candidateToRecommendation(
          candidate,
          genreNames,
          actorNames,
          topActorIds,
        ),
      );

    const recommendations =
      diversify(
        mixSources(
          allRecommendations,
          MAX_RECOMMENDATIONS,
        ),
        MAX_RECOMMENDATIONS,
      );

    /*
     * Collezioni vere: non derivano più dal testo di reason.
     * Ogni candidato viene assegnato alla sorgente che lo ha generato.
     */
    const collections: RecommendationCollections = {
      from_favorites:
        allRecommendations
          .filter(
            (movie) =>
              movie.source ===
              'favorite',
          )
          .slice(0, COLLECTION_SIZE),

      from_rooms:
        allRecommendations
          .filter(
            (movie) =>
              movie.source === 'room',
          )
          .slice(0, COLLECTION_SIZE),

      cast_affinity:
        allRecommendations
          .filter(
            (movie) =>
              movie.source === 'cast',
          )
          .slice(0, COLLECTION_SIZE),

      profile_genres:
        allRecommendations
          .filter(
            (movie) =>
              movie.source ===
              'profile_genre',
          )
          .slice(0, COLLECTION_SIZE),

      exploration:
        allRecommendations
          .filter(
            (movie) =>
              movie.source ===
              'exploration',
          )
          .slice(0, 6),
    };

    const feedbackMap: Record<
      number,
      'more_like_this' | 'not_for_me'
    > = {};

    for (const row of explicitFeedback ?? []) {
      const tmdbId = parseTmdbMovieId(
        (row as any).tmdb_id,
      );
      const feedback =
        (row as any).feedback;

      if (
        tmdbId &&
        (
          feedback ===
            'more_like_this' ||
          feedback ===
            'not_for_me'
        )
      ) {
        feedbackMap[tmdbId] =
          feedback;
      }
    }

    const topGenres = [
      ...genreWeights.entries(),
    ]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, weight]) => ({
        id,
        name:
          genreNames.get(id) ??
          profileGenres.find(
            (genre: string) =>
              PROFILE_GENRE_TO_TMDB[
                normalizeProfileGenre(
                  genre,
                )
              ] === id,
          ) ??
          `Genere ${id}`,
        weight: Number(
          weight.toFixed(2),
        ),
      }));

    const topActors = [
      ...actorWeights.entries(),
    ]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, weight]) => ({
        id,
        name:
          actorNames.get(id) ??
          `Attore ${id}`,
        weight: Number(
          weight.toFixed(2),
        ),
      }));

    const coldStartUsed =
      personalSeeds.length === 0 &&
      roomSeeds.length === 0 &&
      profileGenreIds.length > 0;

    const personalized =
      personalSeeds.length > 0 ||
      roomSeeds.length > 0 ||
      profileGenreIds.length > 0;

    res.setHeader(
      'Cache-Control',
      'private, no-store',
    );

    return res.status(200).json({
      recommendations,
      collections,
      feedback: feedbackMap,
      meta: {
        personalized,
        seeds_used:
          personalSeeds.length +
          roomSeeds.length,
        positive_signals:
          personalSeedMap.size +
          roomSeedMap.size,
        excluded_movies:
          excluded.size,
        negative_genres: [
          ...negativeGenreCounts.values(),
        ].filter(
          (count) => count >= 3,
        ).length,
        taste_genres:
          genreWeights.size,
        taste_actors:
          actorWeights.size,
        top_genres: topGenres,
        top_actors: topActors,
        profile_genres:
          profileGenres,
        cold_start_used:
          coldStartUsed,
        source_mix: {
          favorite: recommendations.filter(
            (movie) => movie.source === 'favorite',
          ).length,
          room: recommendations.filter(
            (movie) => movie.source === 'room',
          ).length,
          cast: recommendations.filter(
            (movie) => movie.source === 'cast',
          ).length,
          profile_genre: recommendations.filter(
            (movie) => movie.source === 'profile_genre',
          ).length,
          exploration: recommendations.filter(
            (movie) => movie.source === 'exploration',
          ).length,
        },
      },
    });
  } catch (error) {
    console.error(
      'recommendations/for-you v2 failed:',
      error,
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Impossibile creare i consigli personalizzati',
    });
  }
}
