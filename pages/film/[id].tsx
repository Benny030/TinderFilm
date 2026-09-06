'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import BackButton from '@/components/ui/BackButton';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/utils/supabase/browser';
import { FONT, THEME } from '@/styles/token';
import {
  getMovieEntry,
  setFavorite,
  setWatchlist,
  markWatched,
  clearWatched,
  ensureTmdbMovie,
  type UserMovieEntry,
} from '@/utils/movieEntries';
import {
  BookmarkSimple,
  CalendarBlank,
  CheckCircle,
  Clock,
  FilmSlate,
  Heart,
  PencilSimple,
  MapPin,
  TelevisionSimple,
  ArrowRight,
  Trash,
  Play,
  Star,
  UserCircle,
  X,
  ShareNetwork,
} from '@phosphor-icons/react';

// ─── Hook per media query ──────────────────────────────────────────────

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    const sync = () =>
      setMatches(media.matches);

    sync();

    media.addEventListener('change', sync);

    return () =>
      media.removeEventListener('change', sync);
  }, [query]);

  return matches;
}

function getYouTubeKey(url?: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace(/^\//, '') || null;
    }

    if (
      parsed.hostname.includes('youtube.com') ||
      parsed.hostname.includes('youtube-nocookie.com')
    ) {
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1]?.split('/')[0] || null;
      }

      return parsed.searchParams.get('v');
    }
  } catch {
    return null;
  }

  return null;
}

// ─── Cinedate design system ────────────────────────────────────────────
//
// Manteniamo la struttura originale della pagina e adattiamo i token
// condivisi alle chiavi già usate nel componente.

const D = {
  bg: THEME.dark.bg,
  bgSoft: THEME.dark.bgSoft,
  card: THEME.dark.surface,
  cardHover: THEME.dark.surfaceHover,
  border: THEME.dark.border,

  gold: THEME.dark.accent,
  goldSoft: THEME.dark.accentSoft,
  goldGlow: THEME.dark.accentGlow,

  pink: THEME.dark.primary,
  pinkDeep: THEME.dark.primaryDeep,
  pinkGlow: THEME.dark.primaryGlow,

  text: THEME.dark.text,
  textMuted: THEME.dark.textMuted,
  textFaint: THEME.dark.textFaint,

  overlayDark: 'rgba(10,8,6,0.78)',
  overlayMid: 'rgba(10,8,6,0.32)',
  overlayLight: 'rgba(10,8,6,0.05)',
};

const L = {
  bg: THEME.light.bg,
  bgSoft: THEME.light.bgSoft,
  card: THEME.light.surface,
  cardHover: THEME.light.surfaceHover,
  border: THEME.light.border,

  gold: THEME.light.accent,
  goldSoft: THEME.light.accentSoft,
  goldGlow: THEME.light.accentGlow,

  pink: THEME.light.primary,
  pinkDeep: THEME.light.primaryDeep,
  pinkGlow: THEME.light.primaryGlow,

  text: THEME.light.text,
  textMuted: THEME.light.textMuted,
  textFaint: THEME.light.textFaint,

  overlayDark: 'rgba(31,26,22,0.76)',
  overlayMid: 'rgba(31,26,22,0.28)',
  overlayLight: 'rgba(31,26,22,0.04)',
};

const FONT_SANS = FONT.sans;
const FONT_DISPLAY = FONT.display;

type SimilarMovie = {
  tmdb_id: number;
  title: string;
  year: number;
  cover: string | null;
  rating: number;
};

type CastMember = {
  id: number;
  name: string;
  character: string;
  profile: string | null;
  order?: number;
};

type MovieDetail = {
  tmdb_id: number;
  title: string;
  year: number;
  genre: string;

  cover: string | null;
  backdrop: string | null;
  trailer: string | null;

  trama_c: string | null;

  rating: number;
  vote_count: number;

  runtime: string | null;
  tagline: string | null;

  director: string | null;
  director_id: number | null;

  cast: CastMember[];
  similar: SimilarMovie[];
};

type WatchProvider = {
  provider_id: number;
  name: string;
  logo: string | null;
  url?: string | null;
};

type CommunityReview = {
  entry_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
  review_text: string | null;
  likes_count: number;
  review_updated_at: string | null;
};

type CinemaShowing = {
  session_id: string;
  showing_date: string;
  time: string;
  format: string | null;
  booking_url: string | null;
};

type CinemaAvailability = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  showings: CinemaShowing[];
};

type Availability = {
  status:
    | 'cinema_and_streaming'
    | 'cinema_only'
    | 'streaming_only'
    | 'digital_only'
    | 'unavailable';

  cinema: {
    available: boolean;
    cinemas: CinemaAvailability[];
    total_showings: number;
  };

  streaming: {
    available: boolean;
    flatrate: WatchProvider[];
    free: WatchProvider[];
    ads: WatchProvider[];
    rent: WatchProvider[];
    buy: WatchProvider[];
    link: string | null;
  };
};

const fallbackPoster =
  'https://placehold.co/342x513/F4EEE6/6E6258?text=Film';

export default function FilmDetailPage() {
  const router = useRouter();

  const { theme } = useTheme();

  const {
    currentUser,
    isGuest,
  } = useAuth();

  const supabase =
    useRef(createBrowserClient()).current;

  const isDark =
    theme === 'dark';

  const P =
    isDark ? D : L;

  const isMobile =
    useMediaQuery('(max-width: 640px)');

  // ─────────────────────────────────────────────
  // FILM
  // ─────────────────────────────────────────────

  const [
    movie,
    setMovie,
  ] = useState<MovieDetail | null>(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  // ─────────────────────────────────────────────
  // DISPONIBILITÀ
  // ─────────────────────────────────────────────

  const [
    availability,
    setAvailability,
  ] = useState<Availability | null>(null);

  const [
    availabilityLoading,
    setAvailabilityLoading,
  ] = useState(false);


  const [
    userPosition,
    setUserPosition,
  ] = useState<{ latitude: number; longitude: number } | null>(null);

  const [
    userArea,
    setUserArea,
  ] = useState<string | null>(null);

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);

  const [
    locationError,
    setLocationError,
  ] = useState('');

  // ─────────────────────────────────────────────
  // SPOILER
  // ─────────────────────────────────────────────

  const [
    showSpoiler,
    setShowSpoiler,
  ] = useState(false);

  // ─────────────────────────────────────────────
  // CAST
  // ─────────────────────────────────────────────

  const [
    showCast,
    setShowCast,
  ] = useState(false);

  const [
    castPage,
    setCastPage,
  ] = useState(1);

  const CAST_PER_PAGE = 6;

  // ─────────────────────────────────────────────
  // STREAMING
  // ─────────────────────────────────────────────

  const [
    showAllStreaming,
    setShowAllStreaming,
  ] = useState(false);

  const STREAMING_INITIAL_LIMIT = 4;

  // ─────────────────────────────────────────────
  // LIBRERIA
  // ─────────────────────────────────────────────

  const [
    entry,
    setEntry,
  ] = useState<UserMovieEntry | null>(null);

  const [
    entryLoading,
    setEntryLoading,
  ] = useState(false);

  const [
    entryAction,
    setEntryAction,
  ] = useState<string | null>(null);

  const [
    entryError,
    setEntryError,
  ] = useState('');

  // ─────────────────────────────────────────────
  // RECENSIONE
  // ─────────────────────────────────────────────

  const [
    reviewOpen,
    setReviewOpen,
  ] = useState(false);

  const [
    reviewRating,
    setReviewRating,
  ] = useState<number | null>(null);

  const [
    reviewText,
    setReviewText,
  ] = useState('');

  const [
    publishRating,
    setPublishRating,
  ] = useState(true);

  const [
    savingReview,
    setSavingReview,
  ] = useState(false);

  const [
    reviewHoverRating,
    setReviewHoverRating,
  ] = useState<number | null>(null);

  const [communityReviews, setCommunityReviews] = useState<CommunityReview[]>([]);
  const [communityReviewsLoading, setCommunityReviewsLoading] = useState(false);

  const movieId =
    typeof router.query.id === 'string'
      ? router.query.id
      : null;

  // ─────────────────────────────────────────────
  // CARICAMENTO FILM
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!movieId) return;

    const loadMovie = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/tmdb/movie/${movieId}`
        );

        if (!response.ok) {
          throw new Error(
            'Film non trovato'
          );
        }

        const data =
          await response.json();

        setMovie(data);
      } catch (error) {
        console.error(error);

        setMovie(null);
      } finally {
        setLoading(false);
      }
    };

    void loadMovie();
  }, [movieId]);

  // ─────────────────────────────────────────────
  // FILM RECENTI
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!movie) return;

    const recentItem = {
      tmdb_id: movie.tmdb_id,
      title: movie.title,
      year: movie.year,
      cover: movie.cover,
    };

    try {
      const raw =
        window.localStorage.getItem(
          'cinedate_recent_films'
        );

      const parsed =
        raw
          ? JSON.parse(raw)
          : [];

      const list =
        Array.isArray(parsed)
          ? parsed
          : [];

      const next = [
        recentItem,

        ...list.filter(
          (item: any) =>
            Number(item?.tmdb_id) !==
            movie.tmdb_id
        ),
      ].slice(0, 8);

      window.localStorage.setItem(
        'cinedate_recent_films',
        JSON.stringify(next)
      );
    } catch {
      // La pagina resta utilizzabile.
    }
  }, [movie]);

  // ─────────────────────────────────────────────
  // RESET CAMBIO FILM
  // ─────────────────────────────────────────────

  useEffect(() => {
    setCastPage(1);

    setShowCast(false);

    setShowAllStreaming(false);

    setReviewHoverRating(null);

    setShowSpoiler(false);
  }, [movie?.tmdb_id]);

  // ─────────────────────────────────────────────
  // DISPONIBILITÀ
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!movieId) return;

    let cancelled = false;

    const loadAvailability = async () => {
      setAvailabilityLoading(true);

      try {
        const response = await fetch(
          `/api/tmdb/movie/${encodeURIComponent(
            movieId
          )}/availability`,
          {
            cache: 'no-store',
          }
        );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error ||
              'Disponibilità non caricabile'
          );
        }

        if (!cancelled) {
          setAvailability(data);
        }
      } catch (error) {
        console.error(
          'Movie availability load failed:',
          error
        );

        if (!cancelled) {
          setAvailability(null);
        }
      } finally {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [movieId]);


  // ─────────────────────────────────────────────
  // CINEMA VICINO A TE
  // ─────────────────────────────────────────────

  const normalizePlace = (value?: string | null) =>
    (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const distanceKm = (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
  ) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
  };

  const requestUserLocation = async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError('La geolocalizzazione non è disponibile su questo dispositivo.');
      return;
    }

    setLocationLoading(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setUserPosition(coords);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=it`,
            { headers: { Accept: 'application/json' } }
          );

          if (response.ok) {
            const data = await response.json();
            const address = data?.address ?? {};
            const area =
              address.city ??
              address.town ??
              address.village ??
              address.municipality ??
              address.county ??
              null;

            setUserArea(area);
          }
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationLoading(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Posizione non autorizzata.'
            : 'Non riesco a rilevare la tua posizione.'
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  };

  useEffect(() => {
    if (
      !availability?.cinema.available ||
      typeof navigator === 'undefined' ||
      !('permissions' in navigator) ||
      !navigator.geolocation
    ) {
      return;
    }

    let cancelled = false;

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((permission) => {
        if (!cancelled && permission.state === 'granted' && !userPosition) {
          void requestUserLocation();
        }
      })
      .catch(() => {
        // Su alcuni browser Permissions API non espone geolocation.
      });

    return () => {
      cancelled = true;
    };
  }, [availability?.cinema.available, userPosition]);

  // ─────────────────────────────────────────────
  // ENTRY UTENTE
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (
      !movie ||
      !currentUser ||
      currentUser.isGuest ||
      isGuest
    ) {
      setEntry(null);

      return;
    }

    const loadEntry = async () => {
      setEntryLoading(true);

      setEntryError('');

      try {
        const data =
          await getMovieEntry(
            supabase,
            movie.tmdb_id
          );

        setEntry(data);

        setReviewRating(
          data?.rating ?? null
        );

        setReviewText(
          data?.review_text ?? ''
        );
      } catch (error: any) {
        console.error(
          'Movie entry load failed:',
          error
        );

        setEntryError(
          error.message ??
            'Impossibile caricare il tuo stato per questo film.'
        );
      } finally {
        setEntryLoading(false);
      }
    };

    void loadEntry();
  }, [
    movie,
    currentUser,
    isGuest,
    supabase,
  ]);

  // ─────────────────────────────────────────────
  // RECENSIONI COMMUNITY
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!movie?.tmdb_id) return;

    let cancelled = false;

    const loadCommunityReviews = async () => {
      setCommunityReviewsLoading(true);

      try {
        const { data, error } = await supabase.rpc('get_public_reviews', {
          p_limit: 100,
          p_offset: 0,
        });

        if (error) throw error;

        const rows = (Array.isArray(data) ? data : []) as any[];

        const reviews = rows
          .filter((row) => {
            const provider = String(row.provider ?? '').toLowerCase();
            const providerMovieId = String(row.provider_movie_id ?? '');

            return (
              provider === 'tmdb' &&
              providerMovieId === String(movie.tmdb_id) &&
              typeof row.review_text === 'string' &&
              row.review_text.trim().length > 0
            );
          })
          .map((row) => ({
            entry_id: String(row.entry_id ?? row.id ?? ''),
            user_id: String(row.user_id ?? ''),
            username: String(row.username ?? 'Utente CineDate'),
            avatar_url: row.avatar_url ?? null,
            rating:
              row.rating === null || row.rating === undefined
                ? null
                : Number(row.rating),
            review_text: row.review_text ?? null,
            likes_count: Number(row.likes_count ?? 0),
            review_updated_at:
              row.review_updated_at ?? row.updated_at ?? null,
          }))
          .slice(0, 6);

        if (!cancelled) setCommunityReviews(reviews);
      } catch (error) {
        console.error('Community reviews load failed:', error);
        if (!cancelled) setCommunityReviews([]);
      } finally {
        if (!cancelled) setCommunityReviewsLoading(false);
      }
    };

    void loadCommunityReviews();

    return () => {
      cancelled = true;
    };
  }, [movie?.tmdb_id, supabase]);

  // ─────────────────────────────────────────────
  // TRAILER
  // ─────────────────────────────────────────────

  const trailerKey =
    getYouTubeKey(
      movie?.trailer
    );

  // ─────────────────────────────────────────────
  // ACCOUNT
  // ─────────────────────────────────────────────

  const requireAccount = () => {
    if (
      !currentUser ||
      currentUser.isGuest ||
      isGuest
    ) {
      router.push('/auth');

      return false;
    }

    return true;
  };

  const runEntryAction = async (
    action: string,
    operation: () =>
      Promise<UserMovieEntry>
  ) => {
    if (!requireAccount()) {
      return;
    }

    setEntryAction(action);

    setEntryError('');

    try {
      const updated =
        await operation();

      setEntry(updated);

      setReviewRating(
        updated.rating ?? null
      );

      setReviewText(
        updated.review_text ?? ''
      );
    } catch (error: any) {
      console.error(
        `Movie entry action failed (${action}):`,
        error
      );

      setEntryError(
        error.message ??
          'Impossibile aggiornare il film.'
      );
    } finally {
      setEntryAction(null);
    }
  };

  const handleFavorite = () => {
    if (!movie) return;

    void runEntryAction(
      'favorite',
      () =>
        setFavorite(
          supabase,
          movie.tmdb_id,
          !(entry?.is_favorite ?? false)
        )
    );
  };

  const handleWatchlist = () => {
    if (!movie) return;

    void runEntryAction(
      'watchlist',
      () =>
        setWatchlist(
          supabase,
          movie.tmdb_id,
          !(entry?.in_watchlist ?? false)
        )
    );
  };

  const handleWatched = () => {
    if (!movie) return;

    void runEntryAction(
      'watched',
      () =>
        entry?.watched_on
          ? clearWatched(
              supabase,
              movie.tmdb_id
            )
          : markWatched(
              supabase,
              movie.tmdb_id
            )
    );
  };

  // ─────────────────────────────────────────────
  // RECENSIONE
  // ─────────────────────────────────────────────

  const openReview = () => {
    if (!requireAccount()) {
      return;
    }

    setReviewRating(
      entry?.rating ?? null
    );

    setReviewText(
      entry?.review_text ?? ''
    );

    setPublishRating(true);

    setReviewHoverRating(null);

    setEntryError('');

    setReviewOpen(true);
  };

  const saveReview = async () => {
    if (
      !movie ||
      !currentUser ||
      currentUser.isGuest ||
      isGuest
    ) {
      return;
    }

    const cleanText =
      reviewText.trim();

    if (cleanText.length > 3000) {
      setEntryError(
        'La recensione può contenere massimo 3000 caratteri.'
      );

      return;
    }

    setSavingReview(true);

    setEntryError('');

    try {
      const catalogMovie =
        await ensureTmdbMovie(
          supabase,
          movie.tmdb_id
        );

      const payload = {
        rating:
          reviewRating,

        review_text:
          cleanText || null,

        review_visibility:
          cleanText
            ? 'public'
            : 'private',

        rating_visibility:
          reviewRating !== null &&
          publishRating
            ? 'public'
            : 'private',
      };

      const {
        data: existing,
        error: lookupError,
      } = await supabase
        .from('user_movie_entries')
        .select('id')
        .eq(
          'user_id',
          currentUser.id
        )
        .eq(
          'movie_id',
          catalogMovie.id
        )
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      let saved:
        | UserMovieEntry
        | null = null;

      if (existing?.id) {
        const {
          data,
          error,
        } = await supabase
          .from('user_movie_entries')
          .update(payload)
          .eq('id', existing.id)
          .eq(
            'user_id',
            currentUser.id
          )
          .select(
            'id,user_id,movie_id,rating,review_text,review_updated_at,is_favorite,in_watchlist,watched_on,created_at,updated_at'
          )
          .single<UserMovieEntry>();

        if (error) {
          throw error;
        }

        saved = data;
      } else {
        const {
          data,
          error,
        } = await supabase
          .from('user_movie_entries')
          .insert({
            user_id:
              currentUser.id,

            movie_id:
              catalogMovie.id,

            ...payload,
          })
          .select(
            'id,user_id,movie_id,rating,review_text,review_updated_at,is_favorite,in_watchlist,watched_on,created_at,updated_at'
          )
          .single<UserMovieEntry>();

        if (error) {
          throw error;
        }

        saved = data;
      }

      setEntry(saved);

      setReviewOpen(false);
    } catch (error: any) {
      console.error(
        'Review save failed:',
        error
      );

      setEntryError(
        error.message ??
          'Impossibile salvare la recensione.'
      );
    } finally {
      setSavingReview(false);
    }
  };

  const removeReview = async () => {
    if (
      !entry ||
      !currentUser ||
      currentUser.isGuest ||
      isGuest
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        'Vuoi rimuovere il voto e la recensione? Preferiti, Watchlist e stato Visto resteranno invariati.'
      );

    if (!confirmed) {
      return;
    }

    setSavingReview(true);

    setEntryError('');

    try {
      const {
        data,
        error,
      } = await supabase
        .from('user_movie_entries')
        .update({
          rating: null,

          review_text: null,

          review_visibility:
            'private',

          rating_visibility:
            'private',
        })
        .eq('id', entry.id)
        .eq(
          'user_id',
          currentUser.id
        )
        .select(
          'id,user_id,movie_id,rating,review_text,review_updated_at,is_favorite,in_watchlist,watched_on,created_at,updated_at'
        )
        .single<UserMovieEntry>();

      if (error) {
        throw error;
      }

      setEntry(data);

      setReviewRating(null);

      setReviewText('');

      setPublishRating(true);

      setReviewOpen(false);
    } catch (error: any) {
      console.error(
        'Review remove failed:',
        error
      );

      setEntryError(
        error.message ??
          'Impossibile rimuovere voto e recensione.'
      );
    } finally {
      setSavingReview(false);
    }
  };

  // ─────────────────────────────────────────────
  // PROVIDER STREAMING
  // ─────────────────────────────────────────────

  const getProviderTargetUrl = (
    provider: WatchProvider
  ) => {
    if (provider.url) {
      return provider.url;
    }

    const title =
      encodeURIComponent(
        [
          movie?.title ?? '',
          movie?.year || '',
        ]
          .filter(Boolean)
          .join(' ')
      );

    const name =
      provider.name.toLowerCase();

    if (
      name.includes('netflix')
    ) {
      return `https://www.netflix.com/search?q=${title}`;
    }

    if (
      name.includes('prime') ||
      name.includes('amazon')
    ) {
      return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${title}`;
    }

    if (
      name.includes('disney')
    ) {
      return `https://www.disneyplus.com/search?q=${title}`;
    }

    if (
      name.includes('apple')
    ) {
      return `https://tv.apple.com/search?term=${title}`;
    }

    if (
      name.includes('paramount')
    ) {
      return `https://www.paramountplus.com/it/search/?q=${title}`;
    }

    if (
      name.includes('mubi')
    ) {
      return `https://mubi.com/it/search/films?query=${title}`;
    }

    if (
      name.includes('rakuten')
    ) {
      return `https://www.rakuten.tv/it/search?q=${title}`;
    }

    if (
      name.includes('chili')
    ) {
      return `https://it.chili.com/search?q=${title}`;
    }

    if (
      name === 'now' ||
      name.includes('now tv')
    ) {
      return `https://www.nowtv.it/cerca.html?search=${title}`;
    }

    if (
      name.includes('sky')
    ) {
      return `https://www.sky.it/cerca?query=${title}`;
    }

    if (
      name.includes('google')
    ) {
      return `https://play.google.com/store/search?q=${title}&c=movies`;
    }

    if (
      name.includes('microsoft')
    ) {
      return `https://www.microsoft.com/it-it/search/shop/movies?q=${title}`;
    }

    return null;
  };

  // ─────────────────────────────────────────────
  // CAST
  // ─────────────────────────────────────────────

  const orderedCast =
    [...(movie?.cast ?? [])]
      .sort(
        (a, b) => {
          const orderA =
            a.order ??
            Number.MAX_SAFE_INTEGER;

          const orderB =
            b.order ??
            Number.MAX_SAFE_INTEGER;

          return orderA - orderB;
        }
      );

  const castTotalPages =
    Math.max(
      1,
      Math.ceil(
        orderedCast.length /
          CAST_PER_PAGE
      )
    );

  useEffect(() => {
    setCastPage(
      (page) =>
        Math.min(
          Math.max(1, page),
          castTotalPages
        )
    );
  }, [castTotalPages]);

  const castStartIndex =
    (castPage - 1) *
    CAST_PER_PAGE;

  const visibleCast =
    orderedCast.slice(
      castStartIndex,
      castStartIndex +
        CAST_PER_PAGE
    );

  // ─────────────────────────────────────────────
  // STREAMING COMPATTO
  // ─────────────────────────────────────────────

  const streamingGroups =
    availability
      ? [
          {
            key:
              'flatrate',

            label:
              'Abbonamento',

            providers:
              availability
                .streaming
                .flatrate,
          },

          {
            key:
              'free',

            label:
              'Gratis',

            providers:
              availability
                .streaming
                .free,
          },

          {
            key:
              'ads',

            label:
              'Con pubblicità',

            providers:
              availability
                .streaming
                .ads,
          },

          {
            key:
              'rent',

            label:
              'Noleggio',

            providers:
              availability
                .streaming
                .rent,
          },

          {
            key:
              'buy',

            label:
              'Acquisto',

            providers:
              availability
                .streaming
                .buy,
          },
        ].filter(
          (group) =>
            group.providers.length >
            0
        )
      : [];

  const allStreamingOptions =
    streamingGroups.flatMap(
      (group) =>
        group.providers.map(
          (provider) => ({
            ...provider,

            categoryKey:
              group.key,

            categoryLabel:
              group.label,
          })
        )
    );

  const visibleStreamingOptions =
    showAllStreaming
      ? allStreamingOptions
      : allStreamingOptions.slice(
          0,
          STREAMING_INITIAL_LIMIT
        );

  const hiddenStreamingCount =
    Math.max(
      0,

      allStreamingOptions.length -
        STREAMING_INITIAL_LIMIT
    );

  // ─────────────────────────────────────────────
  // FILM SIMILI
  // ─────────────────────────────────────────────
  //
  // L'API ordina già i risultati usando segnali molto
  // più forti (saga, keyword, generi, cast, regista,
  // recommendations TMDB). Qui NON li riordiniamo per
  // anno o voto, altrimenti perderemmo quella coerenza.

  const smartSimilar =
    Array.from(
      new Map(
        (movie?.similar ?? [])
          .filter(
            (item) =>
              item.tmdb_id !==
                movie?.tmdb_id &&
              Boolean(item.cover)
          )
          .map(
            (item) =>
              [
                item.tmdb_id,
                item,
              ] as const
          )
      ).values()
    ).slice(0, 18);


  const cinemasByProximity = availability?.cinema.cinemas
    ? availability.cinema.cinemas
        .map((cinema, originalIndex) => {
          const hasCoordinates =
            userPosition &&
            typeof cinema.latitude === 'number' &&
            typeof cinema.longitude === 'number';

          const distance = hasCoordinates
            ? distanceKm(userPosition, {
                latitude: cinema.latitude as number,
                longitude: cinema.longitude as number,
              })
            : null;

          const normalizedArea = normalizePlace(userArea);
          const normalizedCinemaCity = normalizePlace(cinema.city);
          const normalizedCinemaAddress = normalizePlace(cinema.address);

          const sameArea = Boolean(
            normalizedArea &&
              (normalizedCinemaCity.includes(normalizedArea) ||
                normalizedArea.includes(normalizedCinemaCity) ||
                normalizedCinemaAddress.includes(normalizedArea))
          );

          return {
            ...cinema,
            _distanceKm: distance,
            _sameArea: sameArea,
            _originalIndex: originalIndex,
          };
        })
        .sort((a, b) => {
          if (a._distanceKm !== null && b._distanceKm !== null) {
            return a._distanceKm - b._distanceKm;
          }

          if (a._distanceKm !== null) return -1;
          if (b._distanceKm !== null) return 1;

          if (a._sameArea !== b._sameArea) {
            return a._sameArea ? -1 : 1;
          }

          return a._originalIndex - b._originalIndex;
        })
    : [];

  const hasCinemaLocationSuggestion =
    Boolean(userPosition || userArea) &&
    cinemasByProximity.some(
      (cinema) => cinema._distanceKm !== null || cinema._sameArea
    );

  // ─────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell activeNav="home">
        <div
          style={{
            minHeight:
              '70vh',

            display:
              'grid',

            placeItems:
              'center',

            color:
              P.textMuted,

            background:
              P.bg,

            fontFamily:
              FONT_SANS,
          }}
        >
          <FilmSlate
            size={38}
            color={P.pink}
            weight="duotone"
          />
        </div>
      </AppShell>
    );
  }

  // ─────────────────────────────────────────────
  // FILM NON TROVATO
  // ─────────────────────────────────────────────

  if (!movie) {
    return (
      <AppShell activeNav="home">
        <div
          style={{
            minHeight:
              '70vh',

            display:
              'grid',

            placeItems:
              'center',

            color:
              P.textMuted,

            background:
              P.bg,

            fontFamily:
              FONT_SANS,
          }}
        >
          <div
            style={{
              textAlign:
                'center',
            }}
          >
            <p>
              Non siamo riusciti a
              trovare questo film.
            </p>

            <button
              onClick={() =>
                router.push(
                  '/home'
                )
              }
              style={{
                marginTop: 16,

                padding:
                  '10px 20px',

                background:
                  P.pink,

                color:
                  '#fff',

                border:
                  'none',

                cursor:
                  'pointer',

                fontFamily:
                  FONT_SANS,

                fontWeight: 700,

                fontSize: 14,

                borderRadius: 0,
              }}
            >
              Torna alla home
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─────────────────────────────────────────────
  // HERO
  // ─────────────────────────────────────────────

  const heroBackground =
    movie.backdrop
      ? `linear-gradient(90deg, ${P.overlayDark} 0%, ${P.overlayMid} 60%, ${P.overlayLight} 100%), linear-gradient(0deg, ${P.bg} 0%, transparent 42%), url(${movie.backdrop})`
      : `linear-gradient(90deg, ${P.overlayDark} 0%, ${P.overlayMid} 60%, ${P.overlayLight} 100%), linear-gradient(0deg, ${P.bg} 0%, transparent 42%)`;

  // ─────────────────────────────────────────────
  // CONDIVISIONE
  // ─────────────────────────────────────────────

  const shareMovie = async () => {
    const url =
      typeof window !==
      'undefined'
        ? `${window.location.origin}/film/${movie.tmdb_id}`
        : '';

    const payload = {
      title:
        movie.title,

      text:
        `Guarda ${movie.title} su CineDate`,

      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(
          payload
        );

        return;
      }

      await navigator.clipboard.writeText(
        url
      );

      window.alert(
        'Link copiato'
      );
    } catch {
      // L'utente può chiudere il pannello.
    }
  };

  return (
    <AppShell activeNav="home">
      <main
        className="cdr-film-cinedate-scope"
        style={{
          paddingBottom: 96,

          background:
            P.bg,

          fontFamily:
            FONT_SANS,

          minHeight:
            '100vh',

          color:
            P.text,
        }}
      >
        {/* ───────────────── HERO ───────────────── */}

        <section
          style={{
            height:
              isMobile
                ? 220
                : 390,

            position:
              'relative',

            background:
              heroBackground,

            backgroundSize:
              'cover',

            backgroundPosition:
              'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: isMobile ? 10 : 18,
              left: isMobile ? 10 : 18,
              zIndex: 3,
            }}
          >
            <BackButton
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  window.history.length > 1
                ) {
                  router.back();
                } else {
                  void router.push('/home');
                }
              }}
            />
          </div>

          <div
            style={{
              position:
                'absolute',

              zIndex: 2,

              left:
                isMobile
                  ? 16
                  : 'calc(50% - min(42%, 430px))',

              bottom:
                isMobile
                  ? 24
                  : 42,

              color:
                '#fff',

              maxWidth:
                isMobile
                  ? '90%'
                  : 500,
            }}
          >
            <span
              style={{
                background:
                  P.pinkGlow,

                color:
                  P.pink,

                borderRadius: 3,

                padding:
                  isMobile
                    ? '3px 8px'
                    : '5px 10px',

                fontSize:
                  isMobile
                    ? 11
                    : 12,

                fontWeight: 800,

                border:
                  `1px solid ${P.pink}`,
              }}
            >
              {movie.genre ||
                'Film'}
            </span>

            <h1
              style={{
                fontSize:
                  isMobile
                    ? 'clamp(24px, 8vw, 32px)'
                    : 'clamp(30px, 4vw, 48px)',

                lineHeight: 1.04,

                margin:
                  isMobile
                    ? '6px 0'
                    : '10px 0',

                letterSpacing:
                  '-0.035em',

                fontFamily:
                  FONT_DISPLAY,

                fontWeight: 800,

                color:
                  '#fff',
              }}
            >
              {movie.title}
            </h1>

            {movie.tagline && (
              <div
                style={{
                  fontStyle:
                    'italic',

                  opacity: 0.9,

                  fontSize:
                    isMobile
                      ? 13
                      : 15,
                }}
              >
                {movie.tagline}
              </div>
            )}
          </div>
        </section>

        {/* ───────────────── CONTENT ───────────────── */}

        <div
          style={{
            maxWidth: 1060,

            margin:
              '-18px auto 0',

            position:
              'relative',

            padding:
              isMobile
                ? '0 12px'
                : '0 24px',
          }}
        >
          {/* ───────────────── MAIN INFO ───────────────── */}

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                isMobile
                  ? '1fr'
                  : '190px minmax(0,1fr)',

              gap:
                isMobile
                  ? 16
                  : 30,

              alignItems:
                'start',
            }}
          >
            <img
              src={
                movie.cover ||
                fallbackPoster
              }
              alt={`Locandina di ${movie.title}`}
              style={{
                width:
                  isMobile
                    ? 140
                    : 190,

                justifySelf:
                  isMobile
                    ? 'center'
                    : 'start',

                borderRadius: 8,

                boxShadow:
                  '0 12px 34px rgba(0,0,0,0.18)',

                background:
                  P.bgSoft,
              }}
            />

            <div
              style={{
                minWidth: 0,

                maxWidth: 720,
              }}
            >
              {/* METADATA */}

              <div
                style={{
                  display:
                    'flex',

                  flexWrap:
                    'wrap',

                  gap:
                    isMobile
                      ? '6px 12px'
                      : '8px 18px',

                  color:
                    P.text,

                  fontSize:
                    isMobile
                      ? 12
                      : 13,

                  justifyContent:
                    isMobile
                      ? 'center'
                      : 'flex-start',
                }}
              >
                {movie.year >
                  0 && (
                  <span
                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      gap: 5,
                    }}
                  >
                    <CalendarBlank
                      size={
                        isMobile
                          ? 14
                          : 16
                      }
                    />

                    {movie.year}
                  </span>
                )}

                {movie.runtime && (
                  <span
                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      gap: 5,
                    }}
                  >
                    <Clock
                      size={
                        isMobile
                          ? 14
                          : 16
                      }
                    />

                    {movie.runtime}
                  </span>
                )}

                {movie.rating >
                  0 && (
                  <span
                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      gap: 5,

                      color:
                        P.gold,

                      fontWeight: 700,
                    }}
                  >
                    <Star
                      size={
                        isMobile
                          ? 14
                          : 16
                      }
                      weight="fill"
                    />

                    {movie.rating.toFixed(
                      1
                    )}

                    <span
                      style={{
                        color:
                          P.textMuted,

                        fontWeight: 400,

                        fontSize:
                          isMobile
                            ? 11
                            : 13,
                      }}
                    >
                      (
                      {movie.vote_count.toLocaleString(
                        'it-IT'
                      )}{' '}
                      voti)
                    </span>
                  </span>
                )}
              </div>

              {/* REGISTA */}

              {movie.director && (
                <p
                  style={{
                    color:
                      P.textMuted,

                    fontSize:
                      isMobile
                        ? 12
                        : 13,

                    margin:
                      '10px 0 0',

                    textAlign:
                      isMobile
                        ? 'center'
                        : 'left',
                  }}
                >
                  Regia di{' '}

                  {movie.director_id ? (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/persona/${movie.director_id}`
                        )
                      }
                      style={{
                        border: 0,

                        background:
                          'transparent',

                        color:
                          P.text,

                        padding: 0,

                        fontFamily:
                          FONT_SANS,

                        fontSize:
                          'inherit',

                        fontWeight: 850,

                        cursor:
                          'pointer',

                        textDecoration:
                          'underline',

                        textUnderlineOffset: 3,
                      }}
                    >
                      {movie.director}
                    </button>
                  ) : (
                    <strong
                      style={{
                        color:
                          P.text,
                      }}
                    >
                      {movie.director}
                    </strong>
                  )}
                </p>
              )}

              {/* SHARE */}

              <button
                type="button"
                onClick={() =>
                  void shareMovie()
                }
                aria-label="Condividi film"
                title="Condividi"
                style={{
                  marginTop: 14,

                  width: 34,

                  height: 34,

                  borderRadius:
                    '50%',

                  border:
                    `1px solid ${P.border}`,

                  background:
                    P.card,

                  color:
                    P.textMuted,

                  display:
                    'grid',

                  placeItems:
                    'center',

                  cursor:
                    'pointer',
                }}
              >
                <ShareNetwork
                  size={15}
                />
              </button>

              {!isGuest &&
                currentUser &&
                !currentUser.isGuest && (
                  <div
                    style={{
                      marginTop: 16,

                      marginBottom:
                        -7,

                      color:
                        P.textFaint,

                      fontSize: 8.5,

                      fontWeight: 900,

                      textTransform:
                        'uppercase',

                      letterSpacing:
                        '.1em',

                      textAlign:
                        isMobile
                          ? 'center'
                          : 'left',
                    }}
                  >
                    La tua libreria
                  </div>
                )}

              {/* ACTIONS */}

              <div
                style={{
                  display:
                    'flex',

                  flexWrap:
                    'wrap',

                  gap: 8,

                  marginTop: 16,

                  justifyContent:
                    isMobile
                      ? 'center'
                      : 'flex-start',
                }}
              >
                <button
                  onClick={
                    handleFavorite
                  }
                  disabled={
                    entryLoading ||
                    entryAction !==
                      null
                  }
                  style={{
                    border:
                      `1px solid ${
                        entry?.is_favorite
                          ? P.pink
                          : P.border
                      }`,

                    background:
                      entry?.is_favorite
                        ? P.pinkGlow
                        : P.card,

                    color:
                      entry?.is_favorite
                        ? P.pink
                        : P.textMuted,

                    padding:
                      '9px 12px',

                    cursor:
                      entryAction
                        ? 'wait'
                        : 'pointer',

                    display:
                      'inline-flex',

                    alignItems:
                      'center',

                    gap: 6,

                    fontFamily:
                      FONT_SANS,

                    fontWeight: 700,

                    fontSize: 12,
                  }}
                >
                  <Heart
                    size={16}
                    weight={
                      entry?.is_favorite
                        ? 'fill'
                        : 'regular'
                    }
                  />

                  {entry?.is_favorite
                    ? 'Preferito'
                    : 'Preferiti'}
                </button>

                <button
                  onClick={
                    handleWatchlist
                  }
                  disabled={
                    entryLoading ||
                    entryAction !==
                      null
                  }
                  style={{
                    border:
                      `1px solid ${
                        entry?.in_watchlist
                          ? P.gold
                          : P.border
                      }`,

                    background:
                      entry?.in_watchlist
                        ? P.goldGlow
                        : P.card,

                    color:
                      entry?.in_watchlist
                        ? P.gold
                        : P.textMuted,

                    padding:
                      '9px 12px',

                    cursor:
                      entryAction
                        ? 'wait'
                        : 'pointer',

                    display:
                      'inline-flex',

                    alignItems:
                      'center',

                    gap: 6,

                    fontFamily:
                      FONT_SANS,

                    fontWeight: 700,

                    fontSize: 12,
                  }}
                >
                  <BookmarkSimple
                    size={16}
                    weight={
                      entry?.in_watchlist
                        ? 'fill'
                        : 'regular'
                    }
                  />

                  {entry?.in_watchlist
                    ? 'In watchlist'
                    : 'Watchlist'}
                </button>

                <button
                  onClick={
                    handleWatched
                  }
                  disabled={
                    entryLoading ||
                    entryAction !==
                      null
                  }
                  style={{
                    border:
                      `1px solid ${
                        entry?.watched_on
                          ? '#4ade80'
                          : P.border
                      }`,

                    background:
                      entry?.watched_on
                        ? 'rgba(74,222,128,0.10)'
                        : P.card,

                    color:
                      entry?.watched_on
                        ? '#4ade80'
                        : P.textMuted,

                    padding:
                      '9px 12px',

                    cursor:
                      entryAction
                        ? 'wait'
                        : 'pointer',

                    display:
                      'inline-flex',

                    alignItems:
                      'center',

                    gap: 6,

                    fontFamily:
                      FONT_SANS,

                    fontWeight: 700,

                    fontSize: 12,
                  }}
                >
                  <CheckCircle
                    size={16}
                    weight={
                      entry?.watched_on
                        ? 'fill'
                        : 'regular'
                    }
                  />

                  {entry?.watched_on
                    ? 'Visto'
                    : 'Segna visto'}
                </button>

                <button
                  onClick={
                    openReview
                  }
                  disabled={
                    entryLoading
                  }
                  style={{
                    border:
                      `1px solid ${P.gold}`,

                    background:
                      P.gold,

                    color:
                      '#120d05',

                    padding:
                      '9px 12px',

                    cursor:
                      'pointer',

                    display:
                      'inline-flex',

                    alignItems:
                      'center',

                    gap: 6,

                    fontFamily:
                      FONT_SANS,

                    fontWeight: 800,

                    fontSize: 12,
                  }}
                >
                  <PencilSimple
                    size={16}
                    weight="bold"
                  />

                  {entry?.review_text ||
                  entry?.rating
                    ? 'Modifica voto/recensione'
                    : 'Vota / Recensisci'}
                </button>
              </div>

              {entry?.rating !==
                null &&
                entry?.rating !==
                  undefined && (
                  <div
                    style={{
                      marginTop: 10,

                      color:
                        P.gold,

                      fontSize: 12,

                      fontWeight: 700,

                      display:
                        'flex',

                      alignItems:
                        'center',

                      gap: 5,

                      justifyContent:
                        isMobile
                          ? 'center'
                          : 'flex-start',
                    }}
                  >
                    <Star
                      size={14}
                      weight="fill"
                    />

                    Il tuo voto:{' '}

                    {Number(
                      entry.rating
                    ).toFixed(1)}
                    /5
                  </div>
                )}

              {entryError && (
                <div
                  style={{
                    marginTop: 10,

                    padding:
                      '9px 11px',

                    border:
                      '1px solid rgba(251,113,133,0.28)',

                    background:
                      'rgba(251,113,133,0.07)',

                    color:
                      '#fb7185',

                    fontSize: 11,

                    textAlign:
                      isMobile
                        ? 'center'
                        : 'left',
                  }}
                >
                  {entryError}
                </div>
              )}

              {/* TRAMA */}

              <div
                onClick={() =>
                  movie.trama_c &&
                  setShowSpoiler(
                    (value) =>
                      !value
                  )
                }
                role={
                  movie.trama_c
                    ? 'button'
                    : undefined
                }
                tabIndex={
                  movie.trama_c
                    ? 0
                    : undefined
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    movie.trama_c &&
                    (event.key ===
                      'Enter' ||
                      event.key ===
                        ' ')
                  ) {
                    event.preventDefault();

                    setShowSpoiler(
                      (value) =>
                        !value
                    );
                  }
                }}
                aria-label={
                  movie.trama_c
                    ? showSpoiler
                      ? 'Nascondi spoiler'
                      : 'Mostra trama'
                    : undefined
                }
                style={{
                  position:
                    'relative',

                  marginTop: 14,

                  cursor:
                    movie.trama_c
                      ? 'pointer'
                      : 'default',

                  overflow:
                    'hidden',

                  borderRadius: 8,
                }}
              >
                <p
                  style={{
                    color:
                      P.text,

                    fontSize:
                      isMobile
                        ? 14
                        : 15.5,

                    lineHeight: 1.72,

                    margin: 0,

                    filter:
                      movie.trama_c &&
                      !showSpoiler
                        ? 'blur(8px)'
                        : 'none',

                    userSelect:
                      movie.trama_c &&
                      !showSpoiler
                        ? 'none'
                        : 'text',

                    transition:
                      'filter 0.25s ease',

                    textAlign:
                      isMobile
                        ? 'center'
                        : 'left',
                  }}
                >
                  {movie.trama_c ||
                    'La trama non è ancora disponibile.'}
                </p>

                {movie.trama_c &&
                  !showSpoiler && (
                    <div
                      style={{
                        position:
                          'absolute',

                        inset: 0,

                        display:
                          'grid',

                        placeItems:
                          'center',

                        background:
                          isDark
                            ? 'rgba(10,8,6,0.28)'
                            : 'rgba(245,239,232,0.35)',

                        backdropFilter:
                          'blur(2px)',
                      }}
                    >
                      <span
                        style={{
                          padding:
                            isMobile
                              ? '6px 12px'
                              : '8px 14px',

                          borderRadius: 5,

                          background:
                            P.pink,

                          color:
                            '#fff',

                          fontSize:
                            isMobile
                              ? 10
                              : 12,

                          fontWeight: 800,

                          letterSpacing:
                            '0.02em',

                          boxShadow:
                            '0 4px 16px rgba(0,0,0,0.18)',
                        }}
                      >
                        👁 Clicca per
                        mostrare la trama
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* ───────────────── DOVE GUARDARLO ───────────────── */}

          <section
            id="availability-section"
            style={{
              marginTop: 34,
            }}
          >
            <div
              style={{
                display:
                  'flex',

                alignItems:
                  'flex-end',

                justifyContent:
                  'space-between',

                gap: 12,

                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    color:
                      P.pink,

                    fontSize: 9,

                    fontWeight: 900,

                    textTransform:
                      'uppercase',

                    letterSpacing:
                      '.12em',

                    marginBottom: 4,
                  }}
                >
                  Disponibilità
                </div>

                <h2
                  style={{
                    fontSize:
                      isMobile
                        ? 20
                        : 23,

                    margin: 0,

                    color:
                      P.text,

                    fontFamily:
                      FONT_DISPLAY,

                    fontWeight: 800,
                  }}
                >
                  Dove guardarlo
                </h2>
              </div>

              {!availabilityLoading &&
                availability && (
                  <span
                    style={{
                      color:
                        P.textFaint,

                      fontSize: 10,

                      fontWeight: 750,
                    }}
                  >
                    Italia
                  </span>
                )}
            </div>

            {availabilityLoading ? (
              <div
                style={{
                  border:
                    `1px solid ${P.border}`,

                  background:
                    P.card,

                  padding: 18,

                  color:
                    P.textMuted,

                  fontSize: 12,
                }}
              >
                Controllo cinema e
                streaming…
              </div>
            ) : !availability ? (
              <div
                style={{
                  border:
                    `1px dashed ${P.border}`,

                  background:
                    P.bgSoft,

                  padding: 18,

                  color:
                    P.textMuted,

                  fontSize: 12,
                }}
              >
                Non riesco a
                verificare la
                disponibilità in
                questo momento.
              </div>
            ) : (
              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    isMobile
                      ? '1fr'
                      : '1fr 1fr',

                  gap: 12,
                }}
              >
                {/* CINEMA */}

                <div
                  style={{
                    border:
                      `1px solid ${
                        availability
                          .cinema
                          .available
                          ? P.gold
                          : P.border
                      }`,

                    background:
                      availability
                        .cinema
                        .available
                        ? P.goldGlow
                        : P.card,

                    padding:
                      isMobile
                        ? 15
                        : 18,
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      gap: 8,
                    }}
                  >
                    <FilmSlate
                      size={19}
                      weight={
                        availability
                          .cinema
                          .available
                          ? 'fill'
                          : 'regular'
                      }
                      color={
                        availability
                          .cinema
                          .available
                          ? P.gold
                          : P.textFaint
                      }
                    />

                    <div>
                      <div
                        style={{
                          fontSize: 13,

                          fontWeight: 900,

                          color:
                            P.text,
                        }}
                      >
                        Al cinema
                      </div>

                      <div
                        style={{
                          fontSize: 10,

                          color:
                            P.textFaint,

                          marginTop: 2,
                        }}
                      >
                        {availability
                          .cinema
                          .available
                          ? `${availability.cinema.total_showings} proiezioni trovate`
                          : 'Non risulta nella programmazione sincronizzata'}
                      </div>
                    </div>
                  </div>

                  {availability
                    .cinema
                    .available && (
                    <>
                      {!userPosition && !userArea && (
                        <button
                          type="button"
                          onClick={() => void requestUserLocation()}
                          disabled={locationLoading}
                          style={{
                            marginTop: 12,
                            border: `1px solid ${P.border}`,
                            background: P.card,
                            color: locationLoading ? P.textFaint : P.gold,
                            padding: '8px 10px',
                            fontFamily: FONT_SANS,
                            fontSize: 9.5,
                            fontWeight: 850,
                            cursor: locationLoading ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <MapPin size={12} />
                          {locationLoading ? 'Cerco la tua zona…' : 'Mostra il cinema più vicino'}
                        </button>
                      )}

                      {locationError && (
                        <div
                          style={{
                            marginTop: 8,
                            color: P.textFaint,
                            fontSize: 8.5,
                          }}
                        >
                          {locationError}
                        </div>
                      )}

                      <div
                        style={{
                          display:
                            'grid',

                          gap: 7,

                          marginTop: 13,
                        }}
                      >
                        {cinemasByProximity
                          .slice(
                            0,
                            3
                          )
                          .map(
                            (
                              cinema
                            ) => (
                              <div
                                key={
                                  cinema.id
                                }
                                style={{
                                  borderTop:
                                    `1px solid ${P.border}`,

                                  paddingTop: 8,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 11,

                                    fontWeight: 850,

                                    color:
                                      P.text,

                                    display:
                                      'flex',

                                    alignItems:
                                      'center',

                                    gap: 5,
                                  }}
                                >
                                  <MapPin
                                    size={12}
                                    color={
                                      P.gold
                                    }
                                  />

                                  {cinema.name}

                                  {hasCinemaLocationSuggestion &&
                                    cinemasByProximity[0]?.id === cinema.id && (
                                      <span
                                        style={{
                                          marginLeft: 'auto',
                                          color: P.gold,
                                          fontSize: 8,
                                          fontWeight: 900,
                                          textTransform: 'uppercase',
                                          letterSpacing: '.06em',
                                        }}
                                      >
                                        Più vicino a te
                                      </span>
                                    )}
                                </div>

                                <div
                                  style={{
                                    fontSize: 9.5,

                                    color:
                                      P.textFaint,

                                    marginTop: 3,
                                  }}
                                >
                                  {[
                                    cinema._distanceKm !== null
                                      ? `${cinema._distanceKm.toFixed(1)} km`
                                      : cinema._sameArea
                                        ? 'Nella tua zona'
                                        : cinema.city,

                                    cinema.showings[
                                      0
                                    ]
                                      ?.showing_date,

                                    cinema.showings[
                                      0
                                    ]
                                      ?.time,
                                  ]
                                    .filter(
                                      Boolean
                                    )
                                    .join(
                                      ' · '
                                    )}
                                </div>
                              </div>
                            )
                          )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/cinema?movie=${movie.tmdb_id}`
                          )
                        }
                        style={{
                          marginTop: 13,

                          border: 0,

                          padding: 0,

                          background:
                            'transparent',

                          color:
                            P.gold,

                          display:
                            'inline-flex',

                          alignItems:
                            'center',

                          gap: 5,

                          fontFamily:
                            FONT_SANS,

                          fontSize: 10,

                          fontWeight: 850,

                          cursor:
                            'pointer',
                        }}
                      >
                        Vedi cinema e
                        orari

                        <ArrowRight
                          size={12}
                          weight="bold"
                        />
                      </button>
                    </>
                  )}
                </div>

                {/* STREAMING */}

                <div
                  style={{
                    border:
                      `1px solid ${
                        availability
                          .streaming
                          .available
                          ? P.pink
                          : P.border
                      }`,

                    background:
                      availability
                        .streaming
                        .available
                        ? P.pinkGlow
                        : P.card,

                    padding:
                      isMobile
                        ? 15
                        : 18,
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      gap: 8,
                    }}
                  >
                    <TelevisionSimple
                      size={19}
                      weight={
                        availability
                          .streaming
                          .available
                          ? 'fill'
                          : 'regular'
                      }
                      color={
                        availability
                          .streaming
                          .available
                          ? P.pink
                          : P.textFaint
                      }
                    />

                    <div>
                      <div
                        style={{
                          fontSize: 13,

                          fontWeight: 900,

                          color:
                            P.text,
                        }}
                      >
                        Streaming
                      </div>

                      <div
                        style={{
                          fontSize: 10,

                          color:
                            P.textFaint,

                          marginTop: 2,
                        }}
                      >
                        {availability
                          .streaming
                          .available
                          ? 'Disponibile con abbonamento, gratis o con pubblicità'
                          : availability
                                .streaming
                                .rent
                                .length >
                                0 ||
                              availability
                                .streaming
                                .buy
                                .length >
                                0
                            ? 'Disponibile solo a noleggio o acquisto'
                            : 'Nessun provider italiano trovato'}
                      </div>
                    </div>
                  </div>

                  {allStreamingOptions.length >
                    0 && (
                    <div
                      style={{
                        display:
                          'grid',

                        gap: 8,

                        marginTop: 14,
                      }}
                    >
                      {visibleStreamingOptions.map(
                        (
                          provider,
                          index
                        ) => {
                          const providerUrl =
                            getProviderTargetUrl(
                              provider
                            );

                          const previousCategory =
                            index >
                            0
                              ? visibleStreamingOptions[
                                  index -
                                    1
                                ]
                                  .categoryKey
                              : null;

                          const showCategory =
                            provider.categoryKey !==
                            previousCategory;

                          return (
                            <div
                              key={`${provider.categoryKey}-${provider.provider_id}`}
                            >
                              {showCategory && (
                                <div
                                  style={{
                                    color:
                                      P.textFaint,

                                    fontSize: 8,

                                    fontWeight: 900,

                                    textTransform:
                                      'uppercase',

                                    letterSpacing:
                                      '.09em',

                                    marginTop:
                                      index ===
                                      0
                                        ? 0
                                        : 8,

                                    marginBottom: 6,
                                  }}
                                >
                                  {
                                    provider.categoryLabel
                                  }
                                </div>
                              )}

                              <button
                                type="button"
                                disabled={
                                  !providerUrl
                                }
                                onClick={() => {
                                  if (
                                    !providerUrl
                                  ) {
                                    return;
                                  }

                                  window.open(
                                    providerUrl,
                                    '_blank',
                                    'noopener,noreferrer'
                                  );
                                }}
                                style={{
                                  width:
                                    '100%',

                                  minHeight: 48,

                                  border:
                                    `1px solid ${P.border}`,

                                  borderRadius: 6,

                                  background:
                                    P.bgSoft,

                                  color:
                                    P.text,

                                  padding:
                                    '8px 10px',

                                  display:
                                    'flex',

                                  alignItems:
                                    'center',

                                  justifyContent:
                                    'space-between',

                                  gap: 10,

                                  textAlign:
                                    'left',

                                  fontFamily:
                                    FONT_SANS,

                                  cursor:
                                    providerUrl
                                      ? 'pointer'
                                      : 'default',

                                  opacity:
                                    providerUrl
                                      ? 1
                                      : 0.55,
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      'flex',

                                    alignItems:
                                      'center',

                                    gap: 10,

                                    minWidth: 0,
                                  }}
                                >
                                  {provider.logo && (
                                    <img
                                      src={
                                        provider.logo
                                      }
                                      alt=""
                                      style={{
                                        width: 30,

                                        height: 30,

                                        objectFit:
                                          'cover',

                                        borderRadius: 5,

                                        flexShrink: 0,
                                      }}
                                    />
                                  )}

                                  <div
                                    style={{
                                      minWidth: 0,
                                    }}
                                  >
                                    <div
                                      style={{
                                        color:
                                          P.text,

                                        fontSize: 11,

                                        fontWeight: 850,

                                        overflow:
                                          'hidden',

                                        textOverflow:
                                          'ellipsis',

                                        whiteSpace:
                                          'nowrap',
                                      }}
                                    >
                                      {
                                        provider.name
                                      }
                                    </div>

                                    <div
                                      style={{
                                        marginTop: 2,

                                        color:
                                          P.textFaint,

                                        fontSize: 9,
                                      }}
                                    >
                                      {providerUrl
                                        ? `Apri su ${provider.name}`
                                        : 'Link non disponibile'}
                                    </div>
                                  </div>
                                </div>

                                {providerUrl && (
                                  <ArrowRight
                                    size={13}
                                    color={
                                      P.pink
                                    }
                                    weight="bold"
                                  />
                                )}
                              </button>
                            </div>
                          );
                        }
                      )}

                      {allStreamingOptions.length >
                        STREAMING_INITIAL_LIMIT && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowAllStreaming(
                              (
                                value
                              ) =>
                                !value
                            )
                          }
                          style={{
                            marginTop: 3,

                            width:
                              '100%',

                            border:
                              `1px solid ${P.border}`,

                            borderRadius: 6,

                            background:
                              P.card,

                            color:
                              P.textMuted,

                            padding:
                              '10px 12px',

                            fontFamily:
                              FONT_SANS,

                            fontSize: 10,

                            fontWeight: 850,

                            cursor:
                              'pointer',
                          }}
                        >
                          {showAllStreaming
                            ? 'Mostra meno'
                            : `Altro · ${hiddenStreamingCount} opzioni`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ───────────────── RECENSIONI COMMUNITY ───────────────── */}

          <section id="community-section" style={{ marginTop: 30 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    color: P.pink,
                    fontSize: 9,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '.12em',
                    marginBottom: 4,
                  }}
                >
                  Community
                </div>

                <h2
                  style={{
                    margin: 0,
                    color: P.text,
                    fontFamily: FONT_DISPLAY,
                    fontSize: isMobile ? 20 : 23,
                    fontWeight: 800,
                  }}
                >
                  Recensioni degli utenti
                </h2>
              </div>

              {communityReviews.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/recensioni?movie=${movie.tmdb_id}&q=${encodeURIComponent(movie.title)}`
                    )
                  }
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: P.pink,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: FONT_SANS,
                    fontSize: 10,
                    fontWeight: 850,
                    cursor: 'pointer',
                  }}
                >
                  Vedi tutte
                  <ArrowRight size={12} weight="bold" />
                </button>
              )}
            </div>

            {communityReviewsLoading ? (
              <div
                style={{
                  border: `1px solid ${P.border}`,
                  background: P.card,
                  padding: 18,
                  color: P.textMuted,
                  fontSize: 12,
                }}
              >
                Carico le recensioni…
              </div>
            ) : communityReviews.length === 0 ? (
              <div
                style={{
                  border: `1px solid ${P.border}`,
                  background: P.card,
                  padding: isMobile ? 16 : 18,
                }}
              >
                <div
                  style={{
                    color: P.text,
                    fontFamily: FONT_DISPLAY,
                    fontSize: 16,
                    fontWeight: 800,
                  }}
                >
                  Ancora nessuna recensione
                </div>
                <div
                  style={{
                    marginTop: 4,
                    color: P.textMuted,
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  Puoi essere tra i primi a lasciare un'opinione su {movie.title}.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {communityReviews.map((review) => (
                  <article
                    key={review.entry_id || `${review.user_id}-${review.username}`}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      padding: isMobile ? 14 : '16px 18px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          flexShrink: 0,
                          overflow: 'hidden',
                          borderRadius: '50%',
                          border: `1px solid ${P.border}`,
                          background: P.bgSoft,
                          display: 'grid',
                          placeItems: 'center',
                          color: P.textMuted,
                          fontWeight: 900,
                          fontSize: 13,
                        }}
                      >
                        {review.avatar_url ? (
                          <img
                            src={review.avatar_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        ) : (
                          review.username.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <button
                          type="button"
                          onClick={() =>
                            review.username &&
                            router.push(
                              `/utente/${encodeURIComponent(review.username)}`
                            )
                          }
                          style={{
                            border: 0,
                            background: 'transparent',
                            padding: 0,
                            color: P.text,
                            fontFamily: FONT_SANS,
                            fontSize: 15,
                            fontWeight: 900,
                            cursor: review.user_id ? 'pointer' : 'default',
                          }}
                        >
                          @{review.username}
                        </button>

                        {review.rating !== null && (
                          <div
                            style={{
                              marginTop: 3,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              color: P.gold,
                              fontSize: 12,
                              fontWeight: 850,
                            }}
                          >
                            <Star size={11} weight="fill" />
                            {review.rating.toFixed(1)}/5
                          </div>
                        )}
                      </div>

                      {review.likes_count > 0 && (
                        <div
                          style={{
                            color: P.textFaint,
                            fontSize: 15,
                            fontWeight: 750,
                          }}
                        >
                          {review.likes_count} ♥
                        </div>
                      )}
                    </div>

                    <p
                      style={{
                        margin: '12px 0 0',
                        paddingLeft: 12,
                        borderLeft: `2px solid ${P.pink}`,
                        color: P.text,
                        fontSize: isMobile ? 12.5 : 13.5,
                        lineHeight: 1.62,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {review.review_text}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ───────────────── TRAILER ───────────────── */}

          <section
            style={{
              marginTop: 30,
            }}
          >
            <h2
              style={{
                fontSize:
                  isMobile
                    ? 18
                    : 20,

                margin:
                  '0 0 12px',

                color:
                  P.text,

                fontFamily:
                  FONT_DISPLAY,

                fontWeight: 800,
              }}
            >
              Trailer
            </h2>

            {trailerKey ? (
              <iframe
                style={{
                  width:
                    '100%',

                  aspectRatio:
                    '16/9',

                  border: 0,

                  borderRadius: 8,

                  boxShadow:
                    '0 10px 28px rgba(0,0,0,0.16)',

                  background:
                    '#201B18',
                }}
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}`}
                title={`Trailer di ${movie.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div
                style={{
                  minHeight:
                    isMobile
                      ? 120
                      : 190,

                  border:
                    `1.5px dashed ${P.border}`,

                  borderRadius: 8,

                  display:
                    'grid',

                  placeItems:
                    'center',

                  color:
                    P.textMuted,

                  textAlign:
                    'center',

                  background:
                    P.bgSoft,
                }}
              >
                <div>
                  <Play
                    size={
                      isMobile
                        ? 24
                        : 32
                    }
                    color={
                      P.pink
                    }
                    weight="fill"
                  />

                  <p
                    style={{
                      fontSize:
                        isMobile
                          ? 13
                          : 16,
                    }}
                  >
                    Trailer non
                    disponibile al
                    momento.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ───────────────── CAST ───────────────── */}

          {orderedCast.length >
            0 && (
            <section
              style={{
                marginTop: 36,
              }}
            >
              <div
                style={{
                  display:
                    'flex',

                  alignItems:
                    'flex-end',

                  justifyContent:
                    'space-between',

                  gap: 14,

                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      color:
                        P.textFaint,

                      fontSize: 8.5,

                      fontWeight: 900,

                      textTransform:
                        'uppercase',

                      letterSpacing:
                        '.11em',

                      marginBottom: 4,
                    }}
                  >
                    Attori e
                    personaggi
                  </div>

                  <h2
                    style={{
                      fontSize:
                        isMobile
                          ? 20
                          : 23,

                      margin: 0,

                      color:
                        P.text,

                      fontFamily:
                        FONT_DISPLAY,

                      fontWeight: 800,
                    }}
                  >
                    Nel cast
                  </h2>
                </div>

                <button
                  type="button"
                  aria-pressed={showCast}
                  aria-label={
                    showCast
                      ? 'Nascondi tutto il cast'
                      : 'Mostra tutto il cast'
                  }
                  onClick={() =>
                    setShowCast(
                      (value) =>
                        !value
                    )
                  }
                  style={{
                    border:
                      `1px solid ${
                        showCast
                          ? P.pink
                          : P.border
                      }`,

                    borderRadius: 6,

                    background:
                      showCast
                        ? P.pinkGlow
                        : P.card,

                    color:
                      showCast
                        ? P.pink
                        : P.textMuted,

                    padding:
                      isMobile
                        ? '8px 9px'
                        : '9px 12px',

                    cursor:
                      'pointer',

                    fontFamily:
                      FONT_SANS,

                    fontSize: 10,

                    fontWeight: 850,

                    whiteSpace:
                      'nowrap',
                  }}
                >
                  {showCast
                    ? 'Nascondi cast'
                    : 'Mostra cast'}
                </button>
              </div>

              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    isMobile
                      ? 'repeat(2, minmax(0, 1fr))'
                      : 'repeat(6, minmax(0, 1fr))',

                  gap:
                    isMobile
                      ? 12
                      : 14,
                }}
              >
                {visibleCast.map(
                  (person) => (
                    <button
                      key={
                        person.id
                      }
                      type="button"
                      onClick={() => {
                        if (
                          showCast
                        ) {
                          router.push(
                            `/persona/${person.id}`
                          );
                        }
                      }}
                      disabled={
                        !showCast
                      }
                      style={{
                        minWidth: 0,

                        padding: 0,

                        border: 0,

                        background:
                          'transparent',

                        textAlign:
                          'left',

                        fontFamily:
                          FONT_SANS,

                        color:
                          P.text,

                        cursor:
                          showCast
                            ? 'pointer'
                            : 'default',

                        opacity: 1,
                      }}
                    >
                      <div
                        style={{
                          position:
                            'relative',

                          width:
                            '100%',

                          aspectRatio:
                            '1 / 1',

                          overflow:
                            'hidden',

                          borderRadius: 8,

                          background:
                            P.bgSoft,

                          border:
                            `1px solid ${P.border}`,
                        }}
                      >
                        {person.profile ? (
                          <img
                            src={
                              person.profile
                            }
                            alt={
                              showCast
                                ? person.name
                                : ''
                            }
                            style={{
                              width:
                                '100%',

                              height:
                                '100%',

                              objectFit:
                                'cover',

                              display:
                                'block',

                              filter:
                                showCast
                                  ? 'none'
                                  : 'blur(11px)',

                              transform:
                                showCast
                                  ? 'scale(1)'
                                  : 'scale(1.08)',

                              transition:
                                'filter .25s ease, transform .25s ease',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width:
                                '100%',

                              height:
                                '100%',

                              display:
                                'grid',

                              placeItems:
                                'center',

                              filter:
                                showCast
                                  ? 'none'
                                  : 'blur(8px)',

                              background:
                                P.bgSoft,
                            }}
                          >
                            <UserCircle
                              size={
                                isMobile
                                  ? 42
                                  : 46
                              }
                              color={
                                P.textFaint
                              }
                            />
                          </div>
                        )}

                        {!showCast && (
                          <div
                            style={{
                              position:
                                'absolute',

                              inset: 0,

                              display:
                                'grid',

                              placeItems:
                                'center',

                              background:
                                isDark
                                  ? 'rgba(10,8,6,.18)'
                                  : 'rgba(245,239,232,.18)',

                              pointerEvents:
                                'none',
                            }}
                          >
                            <span
                              style={{
                                padding:
                                  '6px 8px',

                                borderRadius: 6,

                                background:
                                  P.card,

                                border:
                                  `1px solid ${P.border}`,

                                color:
                                  P.textMuted,

                                fontSize: 8.5,

                                fontWeight: 850,
                              }}
                            >
                              Cast nascosto
                            </span>
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: 8,

                          filter:
                            showCast
                              ? 'none'
                              : 'blur(7px)',

                          userSelect:
                            showCast
                              ? 'auto'
                              : 'none',

                          transition:
                            'filter .25s ease',
                        }}
                      >
                        <strong
                          style={{
                            display:
                              'block',

                            color:
                              P.text,

                            fontSize:
                              isMobile
                                ? 11
                                : 12,

                            lineHeight: 1.3,

                            overflow:
                              'hidden',

                            textOverflow:
                              'ellipsis',

                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          {person.name}
                        </strong>

                        <span
                          style={{
                            display:
                              'block',

                            marginTop: 3,

                            color:
                              P.textMuted,

                            fontSize:
                              isMobile
                                ? 9
                                : 10,

                            lineHeight: 1.35,

                            overflow:
                              'hidden',

                            textOverflow:
                              'ellipsis',

                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          {person.character}
                        </span>
                      </div>
                    </button>
                  )
                )}
              </div>

              {castTotalPages >
                1 && (
                <div
                  style={{
                    marginTop: 18,

                    paddingTop: 14,

                    borderTop:
                      `1px solid ${P.border}`,

                    display:
                      'flex',

                    alignItems:
                      'center',

                    justifyContent:
                      'space-between',

                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    disabled={
                      !showCast ||
                      castPage ===
                      1
                    }
                    onClick={() =>
                      setCastPage(
                        (page) =>
                          Math.max(
                            1,
                            page - 1
                          )
                      )
                    }
                    style={{
                      border:
                        `1px solid ${P.border}`,

                      borderRadius: 6,

                      background:
                        P.card,

                      color:
                        !showCast ||
                        castPage ===
                        1
                          ? P.textFaint
                          : P.text,

                      padding:
                        '9px 12px',

                      fontFamily:
                        FONT_SANS,

                      fontSize: 10,

                      fontWeight: 850,

                      cursor:
                        !showCast ||
                        castPage ===
                        1
                          ? 'default'
                          : 'pointer',

                      opacity:
                        !showCast ||
                        castPage ===
                        1
                          ? 0.35
                          : 1,
                    }}
                  >
                    ← Precedente
                  </button>

                  <div
                    style={{
                      textAlign:
                        'center',
                    }}
                  >
                    <div
                      style={{
                        color:
                          P.text,

                        fontSize: 10,

                        fontWeight: 850,
                      }}
                    >
                      {castPage} /{' '}
                      {castTotalPages}
                    </div>

                    <div
                      style={{
                        color:
                          P.textFaint,

                        fontSize: 8.5,

                        marginTop: 2,
                      }}
                    >
                      {orderedCast.length}{' '}
                      persone nel cast
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={
                      !showCast ||
                      castPage ===
                      castTotalPages
                    }
                    onClick={() =>
                      setCastPage(
                        (page) =>
                          Math.min(
                            castTotalPages,
                            page + 1
                          )
                      )
                    }
                    style={{
                      border:
                        `1px solid ${P.border}`,

                      borderRadius: 6,

                      background:
                        P.card,

                      color:
                        !showCast ||
                        castPage ===
                        castTotalPages
                          ? P.textFaint
                          : P.text,

                      padding:
                        '9px 12px',

                      fontFamily:
                        FONT_SANS,

                      fontSize: 10,

                      fontWeight: 850,

                      cursor:
                        !showCast ||
                        castPage ===
                        castTotalPages
                          ? 'default'
                          : 'pointer',

                      opacity:
                        !showCast ||
                        castPage ===
                        castTotalPages
                          ? 0.35
                          : 1,
                    }}
                  >
                    Successiva →
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ───────────────── FILM SIMILI ───────────────── */}

          {smartSimilar.length >
            0 && (
            <section
              style={{
                marginTop: 30,
              }}
            >
              <div
                style={{
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    color:
                      P.textFaint,

                    fontSize: 8.5,

                    fontWeight: 900,

                    textTransform:
                      'uppercase',

                    letterSpacing:
                      '.1em',

                    marginBottom: 4,
                  }}
                >
                  Potrebbero piacerti
                </div>

                <h2
                  style={{
                    fontSize:
                      isMobile
                        ? 18
                        : 20,

                    margin: 0,

                    color:
                      P.text,

                    fontFamily:
                      FONT_DISPLAY,

                    fontWeight: 800,
                  }}
                >
                  Film simili
                </h2>
              </div>

              <div
                style={{
                  display:
                    'flex',

                  gap:
                    isMobile
                      ? 10
                      : 14,

                  overflowX:
                    'auto',

                  padding:
                    '2px 1px 9px',

                  scrollbarWidth:
                    'none',

                  scrollSnapType:
                    'x proximity',

                  WebkitOverflowScrolling:
                    'touch',
                }}
              >
                {smartSimilar.map(
                  (item) => {
                    const width =
                      isMobile
                        ? 100
                        : 132;

                    return (
                      <button
                        key={
                          item.tmdb_id
                        }
                        onClick={() =>
                          router.push(
                            `/film/${item.tmdb_id}`
                          )
                        }
                        style={{
                          minWidth:
                            width,

                          width,

                          cursor:
                            'pointer',

                          border: 0,

                          padding: 0,

                          background:
                            'none',

                          textAlign:
                            'left',

                          fontFamily:
                            FONT_SANS,

                          color:
                            P.text,

                          scrollSnapAlign:
                            'start',
                        }}
                      >
                        <img
                          src={
                            item.cover ||
                            fallbackPoster
                          }
                          alt={`Locandina di ${item.title}`}
                          style={{
                            width,

                            aspectRatio:
                              '2/3',

                            objectFit:
                              'cover',

                            borderRadius: 8,

                            boxShadow:
                              '0 6px 18px rgba(0,0,0,0.12)',

                            display:
                              'block',

                            transition:
                              'transform 0.18s',
                          }}
                          onMouseEnter={(
                            event
                          ) => {
                            event.currentTarget.style.transform =
                              'translateY(-4px)';
                          }}
                          onMouseLeave={(
                            event
                          ) => {
                            event.currentTarget.style.transform =
                              'translateY(0)';
                          }}
                        />

                        <strong
                          style={{
                            marginTop: 6,

                            overflow:
                              'hidden',

                            display:
                              '-webkit-box',

                            WebkitLineClamp: 2,

                            WebkitBoxOrient:
                              'vertical',

                            minHeight:
                              isMobile
                                ? 30
                                : 34,

                            lineHeight: 1.2,

                            color:
                              P.text,

                            fontSize:
                              isMobile
                                ? 12
                                : 14,
                          }}
                        >
                          {item.title}
                        </strong>

                        <span
                          style={{
                            color:
                              P.textMuted,

                            fontSize:
                              isMobile
                                ? 10
                                : 12,
                          }}
                        >
                          {item.year ||
                            '—'}

                          {item.rating >
                          0
                            ? ` · ★ ${item.rating.toFixed(
                                1
                              )}`
                            : ''}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </section>
          )}
        </div>

        {/* ───────────────── MODALE RECENSIONE ───────────────── */}

        {reviewOpen && (
          <div
            onMouseDown={() =>
              !savingReview &&
              setReviewOpen(
                false
              )
            }
            style={{
              position:
                'fixed',

              inset: 0,

              zIndex: 10000,

              background:
                'rgba(0,0,0,0.76)',

              backdropFilter:
                'blur(6px)',

              display:
                'grid',

              placeItems:
                'center',

              padding: 18,
            }}
          >
            <div
              onMouseDown={(
                event
              ) =>
                event.stopPropagation()
              }
              style={{
                width:
                  'min(540px, 100%)',

                maxHeight:
                  '90vh',

                overflowY:
                  'auto',

                background:
                  P.card,

                border:
                  `1px solid ${P.border}`,

                boxShadow:
                  '0 28px 90px rgba(0,0,0,0.55)',

                padding: 22,
              }}
            >
              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'space-between',

                  gap: 18,

                  marginBottom: 18,
                }}
              >
                <div>
                  <div
                    style={{
                      color:
                        P.pink,

                      fontSize: 9,

                      textTransform:
                        'uppercase',

                      letterSpacing:
                        '.12em',

                      fontWeight: 800,
                    }}
                  >
                    {movie.title}
                  </div>

                  <h2
                    style={{
                      margin:
                        '4px 0 0',

                      color:
                        P.text,

                      fontFamily:
                        FONT_DISPLAY,

                      fontSize: 24,
                    }}
                  >
                    Voto e recensione
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setReviewOpen(
                      false
                    )
                  }
                  disabled={
                    savingReview
                  }
                  style={{
                    width: 32,

                    height: 32,

                    border:
                      `1px solid ${P.border}`,

                    background:
                      P.bgSoft,

                    color:
                      P.textMuted,

                    display:
                      'grid',

                    placeItems:
                      'center',

                    cursor:
                      'pointer',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* STELLE */}

              <div
                style={{
                  border:
                    `1px solid ${P.border}`,

                  background:
                    P.bgSoft,

                  padding:
                    isMobile
                      ? 14
                      : 16,

                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    display:
                      'flex',

                    alignItems:
                      'center',

                    justifyContent:
                      'space-between',

                    gap: 12,

                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 9,

                        color:
                          P.textFaint,

                        fontWeight: 900,

                        textTransform:
                          'uppercase',

                        letterSpacing:
                          '.08em',
                      }}
                    >
                      Il tuo voto
                    </div>

                    <div
                      style={{
                        marginTop: 3,

                        color:
                          P.text,

                        fontSize: 12,

                        fontWeight: 800,
                      }}
                    >
                      Scegli da 0,5 a
                      5 stelle
                    </div>
                  </div>

                  <div
                    style={{
                      minWidth: 52,

                      height: 42,

                      border:
                        `1px solid ${P.border}`,

                      background:
                        P.card,

                      display:
                        'grid',

                      placeItems:
                        'center',

                      color:
                        reviewRating !==
                        null
                          ? P.gold
                          : P.textFaint,

                      fontSize: 14,

                      fontWeight: 900,
                    }}
                  >
                    {reviewRating !==
                    null
                      ? reviewRating.toFixed(
                          1
                        )
                      : '—'}
                  </div>
                </div>

                <div
                  onMouseLeave={() =>
                    setReviewHoverRating(
                      null
                    )
                  }
                  style={{
                    display:
                      'flex',

                    alignItems:
                      'center',

                    gap:
                      isMobile
                        ? 5
                        : 8,
                  }}
                >
                  {[
                    1,
                    2,
                    3,
                    4,
                    5,
                  ].map(
                    (
                      starIndex
                    ) => {
                      const activeRating =
                        reviewHoverRating ??
                        reviewRating ??
                        0;

                      const fillPercent =
                        Math.max(
                          0,

                          Math.min(
                            100,

                            (activeRating -
                              (starIndex -
                                1)) *
                              100
                          )
                        );

                      const chooseRating =
                        (
                          event: React.MouseEvent<HTMLButtonElement>
                        ) => {
                          const rect =
                            event.currentTarget.getBoundingClientRect();

                          const half =
                            event.clientX -
                              rect.left <
                            rect.width /
                              2;

                          return half
                            ? starIndex -
                                0.5
                            : starIndex;
                        };

                      const buttonSize =
                        isMobile
                          ? 42
                          : 48;

                      const starSize =
                        isMobile
                          ? 35
                          : 40;

                      return (
                        <button
                          key={
                            starIndex
                          }
                          type="button"
                          aria-label={`Vota ${starIndex} stelle`}
                          onMouseMove={(
                            event
                          ) =>
                            setReviewHoverRating(
                              chooseRating(
                                event
                              )
                            )
                          }
                          onClick={(
                            event
                          ) => {
                            setReviewRating(
                              chooseRating(
                                event
                              )
                            );

                            setReviewHoverRating(
                              null
                            );
                          }}
                          onKeyDown={(
                            event
                          ) => {
                            if (
                              event.key ===
                                'ArrowRight' ||
                              event.key ===
                                'ArrowUp'
                            ) {
                              event.preventDefault();

                              setReviewRating(
                                (
                                  value
                                ) =>
                                  Math.min(
                                    5,

                                    (value ??
                                      0) +
                                      0.5
                                  )
                              );
                            }

                            if (
                              event.key ===
                                'ArrowLeft' ||
                              event.key ===
                                'ArrowDown'
                            ) {
                              event.preventDefault();

                              setReviewRating(
                                (
                                  value
                                ) =>
                                  Math.max(
                                    0.5,

                                    (value ??
                                      1) -
                                      0.5
                                  )
                              );
                            }
                          }}
                          style={{
                            position:
                              'relative',

                            width:
                              buttonSize,

                            height:
                              buttonSize,

                            border: 0,

                            background:
                              'transparent',

                            padding: 0,

                            cursor:
                              'pointer',

                            flexShrink: 0,
                          }}
                        >
                          <Star
                            size={
                              starSize
                            }
                            color={
                              P.textFaint
                            }
                            weight="regular"
                            style={{
                              position:
                                'absolute',

                              inset: 0,

                              margin:
                                'auto',
                            }}
                          />

                          <span
                            style={{
                              position:
                                'absolute',

                              inset: 0,

                              overflow:
                                'hidden',

                              width:
                                `${fillPercent}%`,

                              pointerEvents:
                                'none',
                            }}
                          >
                            <Star
                              size={
                                starSize
                              }
                              color={
                                P.gold
                              }
                              weight="fill"
                              style={{
                                position:
                                  'absolute',

                                left:
                                  buttonSize /
                                    2 -
                                  starSize /
                                    2,

                                top:
                                  buttonSize /
                                    2 -
                                  starSize /
                                    2,
                              }}
                            />
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                <div
                  style={{
                    marginTop: 11,

                    display:
                      'flex',

                    alignItems:
                      'center',

                    justifyContent:
                      'space-between',

                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      color:
                        P.textFaint,

                      fontSize: 9,

                      lineHeight: 1.4,
                    }}
                  >
                    Puoi assegnare
                    anche mezze
                    stelle.
                  </span>

                  {reviewRating !==
                    null && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewRating(
                          null
                        );

                        setReviewHoverRating(
                          null
                        );
                      }}
                      style={{
                        border:
                          `1px solid ${P.border}`,

                        background:
                          P.card,

                        color:
                          P.textMuted,

                        padding:
                          '7px 9px',

                        fontFamily:
                          FONT_SANS,

                        fontSize: 9,

                        fontWeight: 800,

                        cursor:
                          'pointer',
                      }}
                    >
                      Rimuovi voto
                    </button>
                  )}
                </div>
              </div>

              {/* TESTO RECENSIONE */}

              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'space-between',

                  fontSize: 10,

                  color:
                    P.textMuted,

                  fontWeight: 800,

                  textTransform:
                    'uppercase',

                  letterSpacing:
                    '.06em',

                  marginBottom: 8,
                }}
              >
                <span>
                  Recensione
                </span>

                <span>
                  {reviewText.length}
                  /3000
                </span>
              </div>

              <textarea
                value={
                  reviewText
                }
                onChange={(
                  event
                ) =>
                  setReviewText(
                    event.target.value.slice(
                      0,
                      3000
                    )
                  )
                }
                rows={7}
                placeholder="Cosa ne pensi di questo film?"
                style={{
                  width:
                    '100%',

                  resize:
                    'vertical',

                  minHeight: 130,

                  border:
                    `1px solid ${P.border}`,

                  background:
                    P.bgSoft,

                  color:
                    P.text,

                  outline: 0,

                  padding: 12,

                  fontFamily:
                    FONT_SANS,

                  fontSize: 13,

                  lineHeight: 1.55,
                }}
              />

              {/* PUBBLICAZIONE VOTO */}

              <label
                style={{
                  display:
                    'flex',

                  alignItems:
                    'flex-start',

                  gap: 10,

                  margin:
                    '14px 0',

                  cursor:
                    'pointer',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setPublishRating(
                      (value) =>
                        !value
                    )
                  }
                  style={{
                    width: 20,

                    height: 20,

                    border:
                      `1px solid ${
                        publishRating
                          ? P.gold
                          : P.border
                      }`,

                    background:
                      publishRating
                        ? P.gold
                        : P.bgSoft,

                    color:
                      '#120d05',

                    display:
                      'grid',

                    placeItems:
                      'center',

                    cursor:
                      'pointer',

                    flexShrink: 0,
                  }}
                >
                  {publishRating && (
                    <CheckCircle
                      size={13}
                      weight="fill"
                    />
                  )}
                </button>

                <span
                  style={{
                    display:
                      'flex',

                    flexDirection:
                      'column',

                    gap: 3,
                  }}
                >
                  <strong
                    style={{
                      color:
                        P.text,

                      fontSize: 11,
                    }}
                  >
                    Mostra
                    pubblicamente
                    anche il voto
                  </strong>

                  <small
                    style={{
                      color:
                        P.textFaint,

                      fontSize: 9,

                      lineHeight: 1.45,
                    }}
                  >
                    La recensione
                    viene pubblicata
                    se scrivi del
                    testo. Watchlist,
                    preferiti e data
                    di visione restano
                    privati.
                  </small>
                </span>
              </label>

              {entryError && (
                <div
                  style={{
                    marginBottom: 12,

                    padding:
                      '9px 11px',

                    border:
                      '1px solid rgba(251,113,133,0.28)',

                    background:
                      'rgba(251,113,133,0.07)',

                    color:
                      '#fb7185',

                    fontSize: 10,
                  }}
                >
                  {entryError}
                </div>
              )}

              {/* BOTTONI MODALE */}

              <div
                style={{
                  display:
                    'flex',

                  gap: 8,

                  alignItems:
                    'stretch',
                }}
              >
                {(entry?.review_text ||
                  entry?.rating !==
                    null) && (
                  <button
                    type="button"
                    onClick={() =>
                      void removeReview()
                    }
                    disabled={
                      savingReview
                    }
                    style={{
                      border:
                        '1px solid rgba(239,68,68,.45)',

                      background:
                        'rgba(239,68,68,.08)',

                      color:
                        '#ef4444',

                      padding:
                        '11px 12px',

                      cursor:
                        savingReview
                          ? 'wait'
                          : 'pointer',

                      opacity:
                        savingReview
                          ? 0.6
                          : 1,

                      fontWeight: 800,

                      fontFamily:
                        FONT_SANS,

                      fontSize: 11,

                      display:
                        'inline-flex',

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      gap: 6,

                      whiteSpace:
                        'nowrap',
                    }}
                  >
                    <Trash
                      size={15}
                      weight="bold"
                    />

                    Rimuovi
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    void saveReview()
                  }
                  disabled={
                    savingReview
                  }
                  style={{
                    flex: 1,

                    border:
                      `1px solid ${P.gold}`,

                    background:
                      P.gold,

                    color:
                      '#120d05',

                    padding:
                      '11px 14px',

                    cursor:
                      savingReview
                        ? 'wait'
                        : 'pointer',

                    opacity:
                      savingReview
                        ? 0.6
                        : 1,

                    fontWeight: 800,

                    fontFamily:
                      FONT_SANS,

                    fontSize: 12,
                  }}
                >
                  {savingReview
                    ? 'Salvataggio...'
                    : 'Salva'}
                </button>
              </div>
            </div>
          </div>
        )}
        <style>{`
          .cdr-film-cinedate-scope ::selection {
            background: ${P.pinkGlow};
            color: ${P.text};
          }
        `}</style>
      </main>
    </AppShell>
  );
}