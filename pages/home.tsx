'use client';

import { useEffect, useState, useRef, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/utils/supabase/browser';
import { normalizeRoomCode } from '@/utils/roomCode';
import AppShell from '@/components/layout/AppShell';
import GlobalSearchBox from '@/components/search/globalSearchBox';
import { useTheme } from '@/context/ThemeContext';

import {
  Bell, FilmSlate, House, ArrowRight,
  Door, Star, Confetti,
  UsersThree, TrendUp, Sparkle,
  InstagramLogo, TiktokLogo, XLogo,
  Sun, Moon, FilmStrip, MagnifyingGlass,
  Heart, Clock, HandWavingIcon, Medal,
  ThumbsUp, ThumbsDown,
  MapPin,
} from '@phosphor-icons/react';

// ─── Palette dark "cinema elegante" ──────────────────────────────────────
const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  cardHover: '#241d19',
  border: '#2d221c',
  gold: '#f5b92f',
  goldSoft: '#ffd875',
  goldGlow: 'rgba(245,185,47,0.12)',
  pink: '#ed3d73',
  pinkDeep: '#8e1740',
  pinkGlow: 'rgba(237,61,115,0.15)',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
  success: '#22c55e',
  purple: '#8b5cf6',
};

// ─── Palette light "cinema elegante" ──────────────────────────────────────
const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  cardHover: '#faf5ef',
  border: '#d6cbbc',
  gold: '#b8860b',
  goldSoft: '#e8c84a',
  goldGlow: 'rgba(184,134,11,0.10)',
  pink: '#b83060',
  pinkDeep: '#8a1d44',
  pinkGlow: 'rgba(184,48,96,0.10)',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
  success: '#16a34a',
  purple: '#7c3aed',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";
const FONT_MONO = "'JetBrains Mono','Courier New',monospace";

const convertHexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean;

  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `${r}, ${g}, ${b}`;
};

type TmdbMovie = {
  id: string;
  tmdb_id: number;
  title: string;
  year: number;
  genre: string;
  cover: string | null;
  backdrop: string | null;
  rating: number;
  vote_count: number;
  trama_c: string | null;
};


type PublicRoom = {
  id: string;
  mode?: string | null;
  room_type?: string | null;
  city?: string | null;
  province?: string | null;
  min_members?: number | null;
  max_members?: number | null;
  participant_count?: number | null;
  available_spots?: number | null;
  host_name?: string | null;
  created_at?: string | null;
};

type CommunityReview = {
  entry_id: string;
  provider: string;
  provider_movie_id: string;
  title: string;
  year: number | null;
  cover: string | null;
  rating: number | null;
  likes_count: number;
};

type SocialPerson = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  is_following: boolean;
  shared_genres?: string[];
  shared_genres_count?: number;
  shared_favorites_count?: number;
  shared_high_ratings_count?: number;
  compatibility_score?: number;
};

type RecommendationMovie = {
  tmdb_id: number;
  title: string;
  year: number | null;
  cover: string | null;
  rating: number;
  reason: string;
  score: number;
};


type RecommendationCollections = {
  from_favorites: RecommendationMovie[];
  from_rooms: RecommendationMovie[];
  cast_affinity: RecommendationMovie[];
  profile_genres: RecommendationMovie[];
};

type RecentFilm = {
  tmdb_id: number;
  title: string;
  year: number | null;
  cover: string | null;
};

const FEATURES = [
  { icon: UsersThree, title: 'Trova persone affini', desc: 'Scopri chi condivide davvero i tuoi gusti' },
  { icon: FilmSlate,  title: 'Scopri cosa vedere',   desc: 'Consigli che imparano da preferiti, voti e match' },
  { icon: Confetti,   title: 'Condividi il cinema',  desc: 'Stanze, recensioni, follow e notifiche in un solo posto' },
];

const SUGGESTIONS = [
  { key: 'similar', icon: UsersThree, title: 'Scopri altri film per te', desc: 'Apri il consiglio più adatto ai tuoi gusti' },
  { key: 'top', icon: TrendUp, title: 'Top del momento', desc: 'I film più popolari adesso' },
  { key: 'community', icon: Sparkle, title: 'Scelte della community', desc: 'I film più apprezzati dagli utenti' },
] as const;

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const router = useRouter();
  const { currentUser, isGuest, isLoading, guestName } = useAuth();
  const supabase = useRef(createBrowserClient()).current;

  const [trending, setTrending] = useState<TmdbMovie[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [loadingPublicRooms, setLoadingPublicRooms] = useState(true);
  const [similarPick, setSimilarPick] = useState<RecommendationMovie | null>(null);
  const [forYouMovies, setForYouMovies] = useState<RecommendationMovie[]>([]);
  const [recommendationCollections, setRecommendationCollections] =
    useState<RecommendationCollections>({
      from_favorites: [],
      from_rooms: [],
      cast_affinity: [],
      profile_genres: [],
    });
  const [communityPick, setCommunityPick] = useState<CommunityReview | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [recentFilms, setRecentFilms] = useState<RecentFilm[]>([]);
  const [mounted, setMounted] = useState(false);
  const [fallbackUsername, setFallbackUsername] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [socialPeople, setSocialPeople] = useState<SocialPerson[]>([]);
  const [loadingSocialPeople, setLoadingSocialPeople] = useState(false);

  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [recommendationFeedback, setRecommendationFeedback] = useState<
    Record<number, 'more_like_this' | 'not_for_me'>
  >({});
  const [feedbackBusyId, setFeedbackBusyId] = useState<number | null>(null);

  const displayName = currentUser && !currentUser.isGuest
    ? currentUser.username || fallbackUsername || '...'
    : guestName ?? 'Ospite';

  const firstName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) {
      setUnreadNotifications(0);
      return;
    }

    let cancelled = false;

    const loadUnreadNotifications = async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);

      if (!cancelled && !error) {
        setUnreadNotifications(count ?? 0);
      }
    };

    void loadUnreadNotifications();

    const channel = supabase
      .channel(`home-notifications-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          void loadUnreadNotifications();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [currentUser, supabase]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) {
      setSocialPeople([]);
      setLoadingSocialPeople(false);
      return;
    }

    let cancelled = false;

    const loadSocialPeople = async () => {
      setLoadingSocialPeople(true);

      try {
        const { data, error } = await supabase.rpc('get_people_suggestions', {
          p_limit: 8,
        });

        if (error) throw error;

        const people = ((data ?? []) as SocialPerson[])
          .map((person) => ({
            ...person,
            followers_count: Number(person.followers_count ?? 0),
            shared_genres_count: Number(person.shared_genres_count ?? 0),
            shared_favorites_count: Number(person.shared_favorites_count ?? 0),
            shared_high_ratings_count: Number(person.shared_high_ratings_count ?? 0),
            compatibility_score: Number(person.compatibility_score ?? 0),
            shared_genres: Array.isArray(person.shared_genres) ? person.shared_genres : [],
          }))
          .filter((person) => (person.compatibility_score ?? 0) > 0)
          .slice(0, 4);

        if (!cancelled) setSocialPeople(people);
      } catch (error) {
        console.error('Home social suggestions load failed:', error);
        if (!cancelled) setSocialPeople([]);
      } finally {
        if (!cancelled) setLoadingSocialPeople(false);
      }
    };

    void loadSocialPeople();

    return () => {
      cancelled = true;
    };
  }, [currentUser, supabase]);

  const homeThemeVars: CSSProperties = {
    ['--home-bg' as any]: P.bg,
    ['--home-bg-soft' as any]: P.bgSoft,
    ['--home-card' as any]: P.card,
    ['--home-card-hover' as any]: P.cardHover,
    ['--home-border' as any]: P.border,
    ['--home-border-rgb' as any]: convertHexToRgb(P.border),
    ['--home-gold' as any]: P.gold,
    ['--home-gold-soft' as any]: P.goldSoft,
    ['--home-gold-rgb' as any]: convertHexToRgb(P.gold),
    ['--home-pink' as any]: P.pink,
    ['--home-pink-deep' as any]: P.pinkDeep,
    ['--home-pink-rgb' as any]: convertHexToRgb(P.pink),
    ['--home-text' as any]: P.text,
    ['--home-text-muted' as any]: P.textMuted,
    ['--home-text-faint' as any]: P.textFaint,
  };

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser && !isGuest) router.replace('/auth');
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) {
      setProfileAvatarUrl(null);
      return;
    }

    const retry = async () => {
      const { data: byId, error: byIdError } = await supabase
        .from('users')
        .select('username,avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (byIdError) {
        console.error('Profile header load failed:', byIdError);
      }

      if (byId) {
        setProfileAvatarUrl(byId.avatar_url ?? null);

        if (byId.username) {
          setFallbackUsername(
            currentUser.username ? '' : byId.username
          );
          return;
        }
      }

      const { data: byEmail } = await supabase
        .from('users')
        .select('username,avatar_url')
        .eq('email', currentUser.email)
        .maybeSingle();

      if (byEmail) {
        setProfileAvatarUrl(byEmail.avatar_url ?? null);

        if (byEmail.username) {
          setFallbackUsername(
            currentUser.username ? '' : byEmail.username
          );
          return;
        }
      }

      router.replace('/username');
    };

    const timer = setTimeout(() => {
      retry().catch((err) => {
        console.error('Profile header retry failed:', err);
        router.replace('/username');
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [currentUser, router, supabase]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    try {
      const raw = window.localStorage.getItem('cinedate_recent_films');
      const parsed = raw ? JSON.parse(raw) : [];
      setRecentFilms(Array.isArray(parsed) ? parsed.slice(0, 6) : []);
    } catch {
      setRecentFilms([]);
    }
  }, [mounted]);

  useEffect(() => {
    const load = async () => {
      setLoadingTrending(true);
      try {
        const res = await fetch('/api/tmdb/trending');
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTrending(data.movies ?? []);
      } catch {
        console.error('Trending movies load failed');
      } finally {
        setLoadingTrending(false);
      }
    };
    load();
  }, []);


  useEffect(() => {
    if (isLoading) return;

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const loadPublicRooms = async (showLoader = false) => {
      if (showLoader) setLoadingPublicRooms(true);

      try {
        const params = new URLSearchParams({ filter: 'for_you' });

        if (currentUser && !currentUser.isGuest) {
          params.set('actorId', currentUser.id);
        }

        const response = await fetch(`/api/rooms/discover?${params.toString()}`, {
          cache: 'no-store',
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Impossibile caricare le stanze pubbliche');
        }

        if (!cancelled) {
          setPublicRooms(Array.isArray(data.rooms) ? data.rooms.slice(0, 6) : []);
        }
      } catch (error) {
        console.error('Public rooms load failed:', error);
        if (!cancelled && showLoader) setPublicRooms([]);
      } finally {
        if (!cancelled && showLoader) setLoadingPublicRooms(false);
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void loadPublicRooms(false);
      }, 180);
    };

    void loadPublicRooms(true);

    const channel = supabase
      .channel('home-public-rooms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants' }, scheduleRefresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [currentUser, isLoading, supabase]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) {
      setSimilarPick(null);
      setForYouMovies([]);
      setRecommendationCollections({
        from_favorites: [],
        from_rooms: [],
        cast_affinity: [],
        profile_genres: [],
      });
      setCommunityPick(null);
      return;
    }

    let cancelled = false;

    const loadSuggestions = async () => {
      setLoadingSuggestions(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const token = session?.access_token ?? null;

        const recommendationPromise = token
          ? fetch('/api/recommendations/for-you', {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }).then(async (response) => {
              const data = await response.json().catch(() => ({}));

              if (!response.ok) {
                throw new Error(
                  data.error || 'Impossibile caricare i consigli personalizzati'
                );
              }

              return data;
            })
          : Promise.resolve({ recommendations: [] });

        const reviewsPromise = supabase.rpc('get_public_reviews', {
          p_limit: 50,
          p_offset: 0,
        });

        const [recommendationData, reviewsResult] = await Promise.all([
          recommendationPromise,
          reviewsPromise,
        ]);

        if (!cancelled) {
          const recommendations = Array.isArray(recommendationData?.recommendations)
            ? recommendationData.recommendations
            : [];

          setForYouMovies(recommendations.slice(0, 10));
          setSimilarPick(recommendations[0] ?? null);

          setRecommendationCollections({
            from_favorites: Array.isArray(recommendationData?.collections?.from_favorites)
              ? recommendationData.collections.from_favorites
              : [],
            from_rooms: Array.isArray(recommendationData?.collections?.from_rooms)
              ? recommendationData.collections.from_rooms
              : [],
            cast_affinity: Array.isArray(recommendationData?.collections?.cast_affinity)
              ? recommendationData.collections.cast_affinity
              : [],
            profile_genres: Array.isArray(recommendationData?.collections?.profile_genres)
              ? recommendationData.collections.profile_genres
              : [],
          });

          setRecommendationFeedback(
            recommendationData?.feedback &&
              typeof recommendationData.feedback === 'object'
              ? recommendationData.feedback
              : {}
          );
        }

        if (!reviewsResult.error) {
          const reviews = ((reviewsResult.data ?? []) as CommunityReview[])
            .filter(
              (review) =>
                review.provider === 'tmdb' &&
                !!review.provider_movie_id
            )
            .map((review) => ({
              ...review,
              likes_count: Number(review.likes_count ?? 0),
            }))
            .sort((a, b) => {
              if (b.likes_count !== a.likes_count) {
                return b.likes_count - a.likes_count;
              }

              return Number(b.rating ?? 0) - Number(a.rating ?? 0);
            });

          if (!cancelled) {
            setCommunityPick(reviews[0] ?? null);
          }
        }
      } catch (error) {
        console.error('Home suggestions load failed:', error);

        if (!cancelled) {
          setSimilarPick(null);
          setForYouMovies([]);
          setRecommendationCollections({
            from_favorites: [],
            from_rooms: [],
            cast_affinity: [],
            profile_genres: [],
          });
          setCommunityPick(null);
        }
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    };

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [currentUser, supabase]);

  const handleCreateRoom = () => router.push('/crea-stanza?tab=create');
  const handleJoinRoom = () => router.push('/crea-stanza?tab=join');
  const handleEnterRoom = (roomId: string) => router.push(`/stanza?room=${roomId}`);


  const roomModeLabel = (room: PublicRoom) => {
    if (room.mode === 'cinema') return 'Cinema';
    if (room.mode === 'streaming') return 'Streaming';
    if (room.mode === 'trending') return 'Tendenza';
    if (room.mode === 'filter' || room.mode === 'discover') return 'Filtro';
    return 'Stanza';
  };

  const roomModeColor = (room: PublicRoom) => {
    if (room.mode === 'trending') return P.pink;
    if (room.mode === 'cinema') return P.gold;
    if (room.mode === 'streaming') return P.success;
    if (room.mode === 'filter' || room.mode === 'discover') return P.purple;
    return P.gold;
  };

  const favoriteDrivenMovies =
    recommendationCollections.from_favorites.slice(0, 5);

  const roomDrivenMovies =
    recommendationCollections.from_rooms.slice(0, 5);

  const actorDrivenMovies =
    recommendationCollections.cast_affinity.slice(0, 5);

  const profileGenreMovies =
    recommendationCollections.profile_genres.slice(0, 5);

  const renderMiniDiscoveryRow = (
    title: string,
    subtitle: string,
    movies: RecommendationMovie[],
    accent: string,
  ) => {
    if (movies.length === 0) return null;

    return (
      <section style={{ padding: '10px 20px 4px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                color: accent,
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '.1em',
              }}
            >
              {title}
            </div>
            <div
              style={{
                color: P.textFaint,
                fontSize: 11,
                marginTop: 3,
              }}
            >
              {subtitle}
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/per-te')}
            style={{
              border: 'none',
              background: 'transparent',
              color: P.textFaint,
              cursor: 'pointer',
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: 0,
            }}
          >
            Tutti
            <ArrowRight size={10} weight="bold" />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 9,
            overflowX: 'auto',
            paddingBottom: 6,
            scrollbarWidth: 'none',
          }}
        >
          {movies.map((movie) => (
            <button
              key={`${title}-${movie.tmdb_id}`}
              type="button"
              onClick={() => router.push(`/film/${movie.tmdb_id}`)}
              style={{
                flex: '0 0 clamp(112px, 12vw, 136px)',
                padding: 0,
                border: `1px solid ${P.border}`,
                background: P.card,
                color: P.text,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: FONT,
                overflow: 'hidden',
              }}
            >
              {movie.cover ? (
                <img
                  src={movie.cover}
                  alt={movie.title}
                  style={{
                    width: '100%',
                    aspectRatio: '2 / 3',
                    objectFit: 'cover',
                    display: 'block',
                    background: P.bgSoft,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '2 / 3',
                    background: P.bgSoft,
                    display: 'grid',
                    placeItems: 'center',
                    color: P.textFaint,
                  }}
                >
                  <FilmSlate size={24} weight="duotone" />
                </div>
              )}

              <div style={{ padding: '8px 8px 9px' }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 850,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {movie.title}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  };

  const sendRecommendationFeedback = async (
    movieId: number,
    feedback: 'more_like_this' | 'not_for_me',
  ) => {
    if (!currentUser || currentUser.isGuest) return;

    setFeedbackBusyId(movieId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error('Sessione non disponibile');

      const isUndo = recommendationFeedback[movieId] === feedback;

      const response = await fetch('/api/recommendations/feedback', {
        method: isUndo ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isUndo
            ? { tmdb_id: movieId }
            : { tmdb_id: movieId, feedback },
        ),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Impossibile salvare il feedback');
      }

      if (isUndo) {
        setRecommendationFeedback((current) => {
          const next = { ...current };
          delete next[movieId];
          return next;
        });
        return;
      }

      setRecommendationFeedback((current) => ({
        ...current,
        [movieId]: feedback,
      }));

      if (feedback === 'not_for_me') {
        setForYouMovies((current) =>
          current.filter((movie) => movie.tmdb_id !== movieId)
        );

        setRecommendationCollections((current) => ({
          from_favorites: current.from_favorites.filter(
            (movie) => movie.tmdb_id !== movieId
          ),
          from_rooms: current.from_rooms.filter(
            (movie) => movie.tmdb_id !== movieId
          ),
          cast_affinity: current.cast_affinity.filter(
            (movie) => movie.tmdb_id !== movieId
          ),
          profile_genres: current.profile_genres.filter(
            (movie) => movie.tmdb_id !== movieId
          ),
        }));
      }
    } catch (error) {
      console.error('Recommendation feedback failed:', error);
    } finally {
      setFeedbackBusyId(null);
    }
  };

  const handleSuggestionClick = (key: typeof SUGGESTIONS[number]['key']) => {
    if (key === 'similar') {
      if (similarPick?.tmdb_id) {
        router.push(`/film/${similarPick.tmdb_id}`);
        return;
      }

      if (trending[0]?.tmdb_id) {
        router.push(`/film/${trending[0].tmdb_id}`);
        return;
      }

      router.push('/film');
      return;
    }

    if (key === 'top') {
      if (trending[0]?.tmdb_id) {
        router.push(`/film/${trending[0].tmdb_id}`);
        return;
      }

      router.push('/home#trending');
      return;
    }

    if (communityPick?.provider_movie_id) {
      router.push(`/film/${communityPick.provider_movie_id}`);
      return;
    }

    router.push('/recensioni');
  };

  const suggestionHighlight = (key: typeof SUGGESTIONS[number]['key']) => {
    if (loadingSuggestions && key !== 'top') return 'Caricamento…';

    if (key === 'similar') {
      if (!similarPick) return 'Scopri un film per te';
      return similarPick.reason || similarPick.title;
    }

    if (key === 'top') {
      return trending[0]?.title ?? 'Guarda la classifica';
    }

    return communityPick?.title ?? 'Vai alla community';
  };


  const handleJoinByCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = normalizeRoomCode(codeInput);
    if (code.length < 4) { setCodeError('Codice non valido'); return; }
    setCodeError('');
    router.push(`/stanza?room=${code}`);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    isDown.current = true;
    startX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0);
    scrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
  };
  const onMouseLeave = () => { isDown.current = false; };
  const onMouseUp = () => { isDown.current = false; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  if (isLoading || (!currentUser && !isGuest)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.bg }}>
        <div className="loading-spinner">
          <FilmStrip size={48} color={P.pink} weight="duotone" />
        </div>
      </div>
    );
  }

  const removeRecentFilm = (tmdbId: number) => {
    const next = recentFilms.filter((film) => film.tmdb_id !== tmdbId);
    setRecentFilms(next);
    try {
      window.localStorage.setItem('cinedate_recent_films', JSON.stringify(next));
    } catch {}
  };

  const clearRecentFilms = () => {
    setRecentFilms([]);
    try {
      window.localStorage.removeItem('cinedate_recent_films');
    } catch {}
  };

  return (
    <>
      <AppShell activeNav="home">
        <div className="home-cine" style={{ ...homeThemeVars, opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}>

          {/* ─── HERO HEADER ──────────────────────────────────────────── */}
          <div style={{
            padding: '36px 20px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Film strip decoration (molto sottile) */}
            <div className="film-strip" style={{ top: 0 }}>
              {[...Array(30)].map((_, i) => (
                <div key={i} className="sprocket" />
              ))}
            </div>

            <div className="animate-in">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}>
                <FilmStrip size={14} color={P.gold} weight="fill" />
                <span style={{
                  fontSize: '11px',
                  color: P.textFaint,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: '500',
                }}>
                  {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>

              <div style={{
                fontFamily: FONT_DISPLAY,
                fontSize: '38px',
                fontWeight: '800',
                color: P.text,
                lineHeight: 1.15,
                marginBottom: '8px',
                letterSpacing: '-0.035em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                Ciao, {firstName}
                <HandWavingIcon
                  size={28}
                  color={P.gold}
                  weight="fill"
                  style={{ display: 'inline', verticalAlign: 'middle' }}
                />
              </div>

              <div style={{
                fontSize: '15px',
                color: P.textMuted,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}>
                <span>La tua serata inizia da qui</span>
                <span style={{
                  color: P.gold,
                  fontWeight: '700',
                  background: P.goldGlow,
                  padding: '2px 12px',
                  border: `1px solid ${P.gold}25`,
                  fontSize: '14px',
                }}>
                  film, persone e serate su misura
                </span> 
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }} className="animate-in">
              <button
                onClick={toggleTheme}
                style={{
                  width: '38px', height: '38px',
                  background: P.card,
                  border: `1px solid ${P.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  color: P.text,
                  transition: 'border-color 0.25s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.gold; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.border; }}
              >
                {isDark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                type="button"
                onClick={() => router.push('/notifiche')}
                aria-label="Notifiche"
                title="Notifiche"
                style={{
                  width: '38px', height: '38px',
                  background: P.card,
                  border: `1px solid ${unreadNotifications > 0 ? `${P.pink}70` : P.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.25s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = unreadNotifications > 0 ? P.pink : P.gold; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = unreadNotifications > 0 ? `${P.pink}70` : P.border; }}
              >
                <Bell
                  size={17}
                  color={unreadNotifications > 0 ? P.pink : P.textMuted}
                  weight={unreadNotifications > 0 ? 'fill' : 'regular'}
                />

                {unreadNotifications > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      minWidth: 18,
                      height: 18,
                      padding: '0 4px',
                      borderRadius: 999,
                      background: P.pink,
                      color: '#fff',
                      border: `2px solid ${P.bg}`,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 8,
                      lineHeight: 1,
                      fontWeight: 900,
                      fontFamily: FONT,
                    }}
                  >
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </button>
              <div
                onClick={() => router.push('/profilo')}
                style={{
                  width: '38px',
                  height: '38px',
                  background: P.pink + '22',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: '700',
                  color: P.pink,
                  cursor: 'pointer',
                  border: `1px solid ${P.pink}30`,
                  transition: 'border-color 0.25s, transform 0.2s',
                  overflow: 'hidden',
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = P.pink;
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = P.pink + '30';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {profileAvatarUrl ? (
                  <img
                    src={profileAvatarUrl}
                    alt="Avatar profilo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
            </div>
          </div>

          <div className="home-layout">
            <div className="home-main">

              {/* ─── RICERCA GLOBALE ───────────────────────────────────── */}
              <section
                style={{
                  padding: isGuest ? '8px 20px 18px' : '8px 20px 14px',
                }}
              >
                <div
                  style={{
                    border: `1px solid ${isGuest ? `${P.gold}90` : P.border}`,
                    background: isGuest ? P.bgSoft : P.card,
                    padding: isGuest ? '18px' : '14px',
                    boxShadow: isGuest
                      ? `0 10px 28px rgba(0,0,0,${isDark ? 0.18 : 0.05})`
                      : 'none',
                  }}
                >
                  <div
                    style={{
                      color: isGuest ? P.gold : P.pink,
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.12em',
                      marginBottom: 5,
                    }}
                  >
                    Cerca su CineDate
                  </div>

                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      color: P.text,
                      fontSize: isGuest ? 24 : 20,
                      fontWeight: 800,
                      letterSpacing: '-.02em',
                    }}
                  >
                    Cosa vuoi vedere?
                  </div>

                  <div
                    style={{
                      color: P.textFaint,
                      fontSize: 11,
                      marginTop: 4,
                      marginBottom: 11,
                    }}
                  >
                    Cerca un film, un attore o un regista.
                  </div>

                  <GlobalSearchBox variant="hero" />

                  <button
                    type="button"
                    onClick={() => router.push('/esplora')}
                    style={{
                      marginTop: 9,
                      border: 0,
                      background: 'transparent',
                      color: P.textMuted,
                      padding: 0,
                      fontFamily: FONT,
                      fontSize: 10,
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Esplora tutto <ArrowRight size={11} weight="bold" />
                  </button>
                </div>
              </section>


              {isGuest && (
                <section style={{ padding: '0 20px 18px' }}>
                  <div
                    style={{
                      color: P.textFaint,
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '.12em',
                      marginBottom: 8,
                    }}
                  >
                    Inizia da qui
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => router.push('/esplora?tab=trending')}
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.card,
                        color: P.text,
                        padding: '14px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      <MagnifyingGlass size={18} color={P.gold} />
                      <div style={{ fontSize: 12, fontWeight: 900, marginTop: 8 }}>
                        Cerca un film
                      </div>
                      <div style={{ fontSize: 9.5, color: P.textFaint, marginTop: 3, lineHeight: 1.4 }}>
                        Cerca titoli, attori e registi
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push('/cinema')}
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.card,
                        color: P.text,
                        padding: '14px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      <MapPin size={18} color={P.pink} weight="fill" />
                      <div style={{ fontSize: 12, fontWeight: 900, marginTop: 8 }}>
                        Trova un cinema
                      </div>
                      <div style={{ fontSize: 9.5, color: P.textFaint, marginTop: 3, lineHeight: 1.4 }}>
                        Film, sale e proiezioni
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push('/stanze')}
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.card,
                        color: P.text,
                        padding: '14px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      <UsersThree size={18} color={P.success} weight="fill" />
                      <div style={{ fontSize: 12, fontWeight: 900, marginTop: 8 }}>
                        Entra in una stanza
                      </div>
                      <div style={{ fontSize: 9.5, color: P.textFaint, marginTop: 3, lineHeight: 1.4 }}>
                        Entra e scegli insieme
                      </div>
                    </button>
                  </div>
                </section>
              )}

              {!isGuest && (
                <section style={{ padding:'0 20px 16px' }}>
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',
                    gap:8,
                  }}>
                    {([
                      { label:'Cerca', path:'/esplora', Icon:MagnifyingGlass, color:P.gold },
                      { label:'Per te', path:'/per-te', Icon:Sparkle, color:P.pink },
                      { label:'Stanze', path:'/stanze', Icon:UsersThree, color:P.success },
                      { label:'Cinema', path:'/cinema', Icon:MapPin, color:P.gold },
                    ]).map(({label,path,Icon,color})=>(
                      <button
                        key={String(label)}
                        type="button"
                        onClick={()=>router.push(path)}
                        style={{
                          border:`1px solid ${P.border}`,
                          background:P.card,
                          color:P.text,
                          padding:'11px 12px',
                          display:'flex',
                          alignItems:'center',
                          gap:8,
                          cursor:'pointer',
                          fontFamily:FONT,
                          fontSize:10.5,
                          fontWeight:850,
                          textAlign:'left',
                        }}
                      >
                        <Icon size={15} color={color} weight="fill" />
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* ─── FEATURE PILLS (desktop) ───────────────────────────── */}
              {!isGuest && (
              <div className="desktop-only" style={{
                padding: '2px 0 18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
              }}>
                {FEATURES.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.title} className={`feature-pill animate-in animate-in-delay-${i + 1}`}>
                      <div className="feature-pill-icon"><Icon size={19} color={P.pink} weight="fill" /></div>
                      <div>
                        <div className="feature-pill-title">{f.title}</div>
                        <div className="feature-pill-desc">{f.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {/* ─── CTA MOBILE: "Crea la tua serata" ────────────────── */}
              <div className="mobile-only" style={{ padding: '10px 20px 6px' }}>
                <div className="ticket-card" style={{
                  padding: '22px 20px',
                  background: `linear-gradient(145deg, ${P.pinkDeep} 0%, ${P.pink} 70%, ${P.pink}20 100%)`,
                  border: `1px solid ${P.pink}40`,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  flexWrap: 'wrap',
                }}>
                  <div style={{
                    fontSize: '32px',
                    width: '52px',
                    height: '52px',
                    background: 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0,
                  }}>
                    <FilmSlate size={26} color="#fff" weight="duotone" />
                  </div>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      fontFamily: FONT_DISPLAY,
                      marginBottom: '4px',
                      letterSpacing: '-0.01em',
                    }}>
                      Crea la tua serata perfetta
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.85, lineHeight: 1.5, marginBottom: '14px' }}>
                      Trova il film, invita i tuoi amici e goditi il cinema insieme.
                    </div>
                    <button
                      onClick={handleCreateRoom}
                      style={{
                        background: '#fff',
                        color: P.pinkDeep,
                        border: 'none',
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontFamily: FONT,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      Crea una stanza <ArrowRight size={14} weight="bold" />
                    </button>
                  </div>
                  <div className="ticket-tear" style={{ background: P.bg }} />
                </div>
              </div>

              {/* ─── CODICE STANZA (mobile) ───────────────────────────── */}
              <div className="mobile-only" style={{ padding: '8px 20px 4px' }}>
                <div className="ticket-card" style={{ padding: '18px 18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div className="how-icon"><Door size={18} color={P.pink} weight="fill" /></div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: P.text }}>Hai un codice stanza?</div>
                      <div style={{ fontSize: '12px', color: P.textFaint }}>Entra direttamente nella tua stanza</div>
                    </div>
                  </div>
                  <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="code-input"
                      value={codeInput}
                      onChange={(e) => { setCodeInput(e.target.value); setCodeError(''); }}
                      placeholder="Inserisci il codice"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <button type="submit" className="code-submit">Entra</button>
                  </form>
                  {codeError && <div style={{ fontSize: '11.5px', color: P.pink, marginTop: '8px' }}>{codeError}</div>}
                  <div className="ticket-tear" style={{ background: P.bg }} />
                </div>
              </div>

              {/* ─── PER TE ──────────────────────────────────────────── */}
              {!isGuest && (
                <section style={{ padding: '22px 20px 18px', margin: '4px 0 0', background: `linear-gradient(180deg, ${P.goldGlow} 0%, transparent 100%)`, borderTop: `1px solid ${P.gold}22`, borderBottom: `1px solid ${P.border}80` }}>
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
                          color: P.gold,
                          fontSize: 10,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '.12em',
                        }}
                      >
                        Per te
                      </div>

                      <div
                        style={{
                          color: P.text,
                          fontSize: 23,
                          fontWeight: 900,
                          letterSpacing: '-.02em',
                          marginTop: 4,
                        }}
                      >
                        Film scelti sui tuoi gusti
                      </div>

                      <div
                        style={{
                          color: P.textFaint,
                          fontSize: 11.5,
                          marginTop: 4,
                        }}
                      >
                        Una selezione personale costruita da preferiti, voti, match e stanze.
                      </div>
                    </div>

                    {forYouMovies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => router.push('/per-te')}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: P.gold,
                          fontSize: 10,
                          fontWeight: 850,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          fontFamily: FONT,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: 0,
                        }}
                      >
                        Vedi tutti
                        <ArrowRight size={11} weight="bold" />
                      </button>
                    )}
                  </div>

                  {loadingSuggestions ? (
                    <div style={{ display: 'flex', gap: 12, overflowX: 'hidden' }}>
                      {[1, 2, 3, 4, 5].map((item) => (
                        <div
                          key={item}
                          className="skeleton"
                          style={{ flex: '0 0 142px', height: 250 }}
                        />
                      ))}
                    </div>
                  ) : forYouMovies.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        overflowX: 'auto',
                        paddingBottom: 8,
                        scrollbarWidth: 'none',
                        scrollSnapType: 'x proximity',
                      }}
                    >
                      {forYouMovies.map((movie) => (
                        <div
                          key={movie.tmdb_id}
                                                    onClick={() => router.push(`/film/${movie.tmdb_id}`)}
                          style={{
                            flex: '0 0 clamp(128px, 15vw, 158px)',
                            scrollSnapAlign: 'start',
                            padding: 0,
                            border: `1px solid ${P.border}`,
                            background: P.card,
                            color: P.text,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: FONT,
                            overflow: 'hidden',
                          }}
                        >
                          {movie.cover ? (
                            <img
                              src={movie.cover}
                              alt={movie.title}
                              style={{
                                width: '100%',
                                aspectRatio: '2 / 3',
                                objectFit: 'cover',
                                display: 'block',
                                background: P.bgSoft,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                aspectRatio: '2 / 3',
                                display: 'grid',
                                placeItems: 'center',
                                color: P.textFaint,
                                background: P.bgSoft,
                              }}
                            >
                              <FilmSlate size={28} weight="duotone" />
                            </div>
                          )}

                          <div style={{ padding: '10px 10px 11px' }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 850,
                                lineHeight: 1.25,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {movie.title}
                            </div>

                            <div
                              style={{
                                color: P.textFaint,
                                fontSize: 10,
                                lineHeight: 1.35,
                                marginTop: 5,
                                minHeight: 27,
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {movie.reason || 'Scelto per i tuoi gusti'}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                marginTop: 8,
                              }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                aria-label="Più film così"
                                title="Più film così"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void sendRecommendationFeedback(
                                    movie.tmdb_id,
                                    'more_like_this'
                                  );
                                }}
                                disabled={feedbackBusyId === movie.tmdb_id}
                                style={{
                                  width: 28,
                                  height: 26,
                                  border: `1px solid ${
                                    recommendationFeedback[movie.tmdb_id] ===
                                    'more_like_this'
                                      ? P.gold
                                      : P.border
                                  }`,
                                  background:
                                    recommendationFeedback[movie.tmdb_id] ===
                                    'more_like_this'
                                      ? P.goldGlow
                                      : P.bgSoft,
                                  color:
                                    recommendationFeedback[movie.tmdb_id] ===
                                    'more_like_this'
                                      ? P.gold
                                      : P.textFaint,
                                  display: 'grid',
                                  placeItems: 'center',
                                  cursor:
                                    feedbackBusyId === movie.tmdb_id
                                      ? 'wait'
                                      : 'pointer',
                                }}
                              >
                                <ThumbsUp size={12} weight="duotone" />
                              </button>

                              <button
                                type="button"
                                aria-label="Non fa per me"
                                title="Non fa per me"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void sendRecommendationFeedback(
                                    movie.tmdb_id,
                                    'not_for_me'
                                  );
                                }}
                                disabled={feedbackBusyId === movie.tmdb_id}
                                style={{
                                  width: 28,
                                  height: 26,
                                  border: `1px solid ${P.border}`,
                                  background: P.bgSoft,
                                  color: P.textFaint,
                                  display: 'grid',
                                  placeItems: 'center',
                                  cursor:
                                    feedbackBusyId === movie.tmdb_id
                                      ? 'wait'
                                      : 'pointer',
                                }}
                              >
                                <ThumbsDown size={12} weight="duotone" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: `1px dashed ${P.border}`,
                        padding: '16px',
                        color: P.textFaint,
                        fontSize: 12,
                        textAlign: 'center',
                        background: P.bgSoft,
                      }}
                    >
                      Aggiungi preferiti, vota film o fai swipe nelle stanze per ricevere consigli più personali.
                    </div>
                  )}
                </section>
              )}

              {!isGuest && !loadingSuggestions && (
                <>
                  {renderMiniDiscoveryRow(
                    'Perché ti è piaciuto',
                    'Titoli costruiti sui tuoi preferiti e sulle valutazioni più alte',
                    favoriteDrivenMovies,
                    P.pink,
                  )}

                  {renderMiniDiscoveryRow(
                    'Dai tuoi match',
                    'Film vicini a ciò che hai apprezzato durante le stanze',
                    roomDrivenMovies,
                    P.gold,
                  )}

                  {renderMiniDiscoveryRow(
                    'Cast che torna nei tuoi gusti',
                    'Titoli con attori ricorrenti nei film che ami',
                    actorDrivenMovies,
                    P.success,
                  )}

                  {renderMiniDiscoveryRow(
                    'Dai generi che hai scelto',
                    'Un punto di partenza mentre TinderFilm impara meglio i tuoi gusti',
                    profileGenreMovies,
                    P.purple,
                  )}
                </>
              )}

              {/* ─── PERSONE AFFINI / SOCIAL ───────────────────────── */}
              {!isGuest && (
                <section style={{ padding: '22px 20px 20px', margin: '12px 20px 4px', background: P.bgSoft, border: `1px solid ${P.border}`, boxShadow: `0 14px 36px rgba(0,0,0,${isDark ? 0.16 : 0.05})` }}>
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
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          color: P.pink,
                          fontSize: 10,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '.12em',
                        }}
                      >
                        <UsersThree size={14} weight="fill" />
                        La tua community
                      </div>
                      <div
                        style={{
                          fontFamily: FONT_DISPLAY,
                          color: P.text,
                          fontSize: 21,
                          fontWeight: 800,
                          marginTop: 3,
                        }}
                      >
                        La tua cerchia CineDate
                      </div>
                      <div style={{ color: P.textFaint, fontSize: 12, marginTop: 3 }}>
                        Compatibilità calcolata da preferiti, voti alti e generi che avete in comune.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push('/persone')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: P.gold,
                        fontFamily: FONT,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Vedi persone <ArrowRight size={12} weight="bold" />
                    </button>
                  </div>

                  {loadingSocialPeople ? (
                    <div
                      style={{
                        border: `1px dashed ${P.border}`,
                        background: P.bgSoft,
                        color: P.textFaint,
                        padding: 18,
                        fontSize: 12,
                        textAlign: 'center',
                      }}
                    >
                      Cerco persone con gusti simili ai tuoi…
                    </div>
                  ) : socialPeople.length > 0 ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {socialPeople.map((person) => {
                        const commonSignal = (person.shared_favorites_count ?? 0) > 0
                          ? `${person.shared_favorites_count} preferiti in comune`
                          : (person.shared_high_ratings_count ?? 0) > 0
                            ? `${person.shared_high_ratings_count} film amati da entrambi`
                            : `${person.shared_genres_count ?? 0} gusti in comune`;

                        return (
                          <button
                            key={person.user_id}
                            type="button"
                            onClick={() => router.push(`/utente/${encodeURIComponent(person.username)}`)}
                            style={{
                              border: `1px solid ${P.border}`,
                              background: P.card,
                              color: P.text,
                              padding: 13,
                              fontFamily: FONT,
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              gap: 11,
                              minWidth: 0,
                              transition: 'transform .2s ease, border-color .2s ease, background .2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.borderColor = `${P.pink}70`;
                              e.currentTarget.style.background = P.cardHover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.borderColor = P.border;
                              e.currentTarget.style.background = P.card;
                            }}
                          >
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                flexShrink: 0,
                                borderRadius: '50%',
                                overflow: 'hidden',
                                border: `1px solid ${P.border}`,
                                background: P.bgSoft,
                                display: 'grid',
                                placeItems: 'center',
                                color: P.gold,
                                fontWeight: 900,
                              }}
                            >
                              {person.avatar_url ? (
                                <img
                                  src={person.avatar_url}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                person.username?.charAt(0).toUpperCase() || '?'
                              )}
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: 13,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  @{person.username}
                                </strong>
                                <span
                                  style={{
                                    border: `1px solid ${P.gold}55`,
                                    background: P.goldGlow,
                                    color: P.gold,
                                    padding: '3px 6px',
                                    fontSize: 9,
                                    fontWeight: 900,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {person.compatibility_score ?? 0}% affinità
                                </span>
                              </div>

                              <div style={{ color: P.textFaint, fontSize: 10.5, marginTop: 4 }}>
                                {commonSignal}
                              </div>

                              {(person.shared_genres?.length ?? 0) > 0 && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 7 }}>
                                  {person.shared_genres?.slice(0, 2).map((genre) => (
                                    <span
                                      key={`${person.user_id}-${genre}`}
                                      style={{
                                        border: `1px solid ${P.border}`,
                                        background: P.bgSoft,
                                        color: P.textMuted,
                                        padding: '2px 5px',
                                        fontSize: 8.5,
                                        fontWeight: 750,
                                      }}
                                    >
                                      {genre}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push('/persone')}
                      style={{
                        width: '100%',
                        border: `1px dashed ${P.border}`,
                        background: P.bgSoft,
                        color: P.textMuted,
                        padding: 16,
                        fontFamily: FONT,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Continua a votare film e aggiungere preferiti: useremo i tuoi gusti per trovare persone compatibili.
                    </button>
                  )}

                  <div
                    style={{
                      marginTop: 10,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => router.push('/recensioni')}
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.card,
                        color: P.text,
                        padding: '11px 12px',
                        fontFamily: FONT,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>Recensioni della community</span>
                      <Heart size={14} color={P.pink} weight="fill" />
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/notifiche')}
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.card,
                        color: P.text,
                        padding: '11px 12px',
                        fontFamily: FONT,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>{unreadNotifications > 0 ? `${unreadNotifications} notifiche da vedere` : 'Attività e notifiche'}</span>
                      <Bell size={14} color={unreadNotifications > 0 ? P.pink : P.gold} weight={unreadNotifications > 0 ? 'fill' : 'regular'} />
                    </button>
                  </div>
                </section>
              )}


              {isGuest && (
                <section style={{ padding: '2px 20px 18px' }}>
                  <div
                    style={{
                      border: `1px solid ${P.pink}55`,
                      background: P.pinkGlow,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        color: P.pink,
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '.12em',
                      }}
                    >
                      Community CineDate
                    </div>

                    <div
                      style={{
                        fontFamily: FONT_DISPLAY,
                        color: P.text,
                        fontSize: 19,
                        fontWeight: 800,
                        marginTop: 4,
                      }}
                    >
                      Non è solo un catalogo di film
                    </div>

                    <div
                      style={{
                        color: P.textMuted,
                        fontSize: 11,
                        lineHeight: 1.55,
                        marginTop: 5,
                      }}
                    >
                      Leggi cosa ne pensa la community, scopri persone con gusti simili
                      e scegli insieme cosa guardare.
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                        gap: 7,
                        marginTop: 13,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => router.push('/recensioni')}
                        style={{
                          border: `1px solid ${P.border}`,
                          background: P.card,
                          color: P.text,
                          padding: '10px 11px',
                          cursor: 'pointer',
                          fontFamily: FONT,
                          textAlign: 'left',
                        }}
                      >
                        <Heart size={15} color={P.pink} weight="fill" />
                        <div style={{ fontSize: 10.5, fontWeight: 850, marginTop: 5 }}>
                          Recensioni
                        </div>
                        <div style={{ fontSize: 9, color: P.textFaint, marginTop: 2 }}>
                          Guarda cosa piace agli altri
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push('/persone')}
                        style={{
                          border: `1px solid ${P.border}`,
                          background: P.card,
                          color: P.text,
                          padding: '10px 11px',
                          cursor: 'pointer',
                          fontFamily: FONT,
                          textAlign: 'left',
                        }}
                      >
                        <UsersThree size={15} color={P.gold} weight="fill" />
                        <div style={{ fontSize: 10.5, fontWeight: 850, marginTop: 5 }}>
                          Persone
                        </div>
                        <div style={{ fontSize: 9, color: P.textFaint, marginTop: 2 }}>
                          Trova utenti con gusti simili
                        </div>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push('/auth')}
                      style={{
                        marginTop: 11,
                        border: 0,
                        background: 'transparent',
                        color: P.pink,
                        padding: 0,
                        fontFamily: FONT,
                        fontSize: 10,
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      Crea un account per partecipare →
                    </button>
                  </div>
                </section>
              )}

              {recentFilms.length > 0 && (
                <section style={{ padding:'18px 20px 8px' }}>
                  <div className="section-header">
                    <span className="section-title">
                      <span className="accent-line" />
                      <FilmSlate size={17} color={P.gold} weight="fill" />
                      Riprendi da qui
                    </span>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <button
                        type="button"
                        onClick={clearRecentFilms}
                        style={{
                          border:0,background:'transparent',color:P.textFaint,
                          fontFamily:FONT,fontSize:9.5,fontWeight:800,cursor:'pointer',padding:0,
                        }}
                      >
                        Cancella
                      </button>
                      <button className="section-link" onClick={() => router.push('/esplora')}>
                        Esplora <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display:'grid',
                      gridTemplateColumns:'repeat(auto-fill,minmax(120px,150px))',
                      justifyContent:'start',
                      gap:10,
                    }}
                  >
                    {recentFilms.map((film) => (
                      <button
                        key={`recent-${film.tmdb_id}`}
                        type="button"
                        onClick={() => router.push(`/film/${film.tmdb_id}`)}
                        style={{
                          border:`1px solid ${P.border}`,
                          background:P.card,
                          color:P.text,
                          padding:0,
                          textAlign:'left',
                          cursor:'pointer',
                          fontFamily:FONT,
                          minWidth:0,
                          overflow:'hidden',
                        }}
                      >
                        <div style={{
                          aspectRatio:'2/3',
                          background:P.bgSoft,
                          overflow:'hidden',
                        }}>
                          {film.cover ? (
                            <img
                              src={film.cover}
                              alt={film.title}
                              style={{width:'100%',height:'100%',objectFit:'cover'}}
                            />
                          ) : (
                            <div style={{height:'100%',display:'grid',placeItems:'center'}}>
                              <FilmSlate size={26} color={P.textFaint}/>
                            </div>
                          )}
                        </div>
                        <div style={{padding:'8px 9px 9px'}}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeRecentFilm(film.tmdb_id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                removeRecentFilm(film.tmdb_id);
                              }
                            }}
                            style={{
                              color:P.textFaint,
                              fontSize:8.5,
                              fontWeight:800,
                              marginBottom:4,
                              cursor:'pointer',
                            }}
                          >
                            Rimuovi
                          </div>
                          <div style={{
                            fontSize:10.5,
                            fontWeight:850,
                            whiteSpace:'nowrap',
                            overflow:'hidden',
                            textOverflow:'ellipsis',
                          }}>
                            {film.title}
                          </div>
                          <div style={{fontSize:9,color:P.textFaint,marginTop:3}}>
                            {film.year || 'Anno n/d'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* ─── TRENDING MOVIES ──────────────────────────────────── */}
              <div id="trending" style={{ padding: '26px 20px 8px' }}>
                <div className="section-header">
                  <span className="section-title">
                    <span className="accent-line" />
                    <Star size={17} color={P.gold} weight="fill" />
                    In tendenza adesso
                  </span>
                  <button className="section-link" onClick={() => router.push('/esplora?tab=trending')}>Vedi tutti <ArrowRight size={13} /></button>
                </div>

                {loadingTrending ? (
                  <div className="scroll-row">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} style={{ flexShrink: 0, width: '148px' }}>
                        <div className="skeleton" style={{ width: '148px', height: '222px' }} />
                        <div className="skeleton" style={{ width: '100px', height: '12px', marginTop: '8px' }} />
                        <div className="skeleton" style={{ width: '56px', height: '10px', marginTop: '4px' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="scroll-row"
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseLeave}
                    onMouseUp={onMouseUp}
                    onMouseMove={onMouseMove}
                  >
                    {trending.map((movie, i) => {
                      const rating = movie.rating || 0;
                      const fullStars = Math.round(rating / 2);
                      const emptyStars = 5 - fullStars;
                      const starString = '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
                      const isTop = i < 3;

                   
                      return (
                        <div
                          key={movie.id}
                          className="movie-card-scroll"
                          onClick={() => router.push(`/film/${movie.tmdb_id}`)}
                        >
                          <div style={{ position: 'relative' }}>
                            <img
                              src={movie.cover ?? 'https://placehold.co/148x222/1c1613/7a6b60?text=🎬'}
                              alt={movie.title}
                              loading="lazy"
                            />
                            <div className={`movie-badge ${isTop ? 'top' : ''}`}>
                              { i + 1}
                            </div>
                            {isTop && (
                              <div style={{
                                position: 'absolute',
                                bottom: '6px',
                                right: '6px',
                                background: P.gold,
                                color: P.bg,
                                fontSize: '7px',
                                fontWeight: '800',
                                padding: '1px 8px',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                opacity: 0.9,
                              }}>
                                Top
                              </div>
                            )}
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            <div style={{
                              fontSize: '12.5px',
                              fontWeight: '600',
                              color: P.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              letterSpacing: '-0.01em',
                            }}>
                              {movie.title}
                            </div>
                            <div style={{ fontSize: '11px', color: P.textFaint }}>{movie.year}</div>
                            {movie.rating > 0 && (
                              <div className="movie-rating-stars">
                                <span className="stars">{starString}</span>
                                <span className="num">{movie.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>


              {/* ─── SPUNTI PER TE ────────────────────────────────────── */}
              <div style={{ padding: '24px 20px 8px' }}>
                <div className="section-header">
                  <div>
                    <span className="section-title">
                      <span className="accent-line" />
                      <Sparkle size={17} color={P.gold} weight="fill" />
                      Esplora ancora
                    </span>
                    <div style={{ fontSize: '12.5px', color: P.textFaint, marginTop: '2px' }}>
                      Quando vuoi esplorare oltre i tuoi consigli
                    </div>
                  </div> 
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
                  {SUGGESTIONS.map((s, i) => {
                    const Icon = s.icon;
                    const highlight = suggestionHighlight(s.key);

                    return (
                      <button
                        key={s.title}
                        type="button"
                        className={`suggestion-card animate-in animate-in-delay-${i + 1}`}
                        onClick={() => handleSuggestionClick(s.key)}
                        style={{
                          textAlign: 'left',
                          fontFamily: FONT,
                          cursor: 'pointer',
                        }}
                      >
                        <div className="suggestion-icon">
                          <Icon size={19} color={P.pink} weight="fill" />
                        </div>
                        <div>
                          <div className="suggestion-title">{s.title}</div>
                          <div className="suggestion-desc">{s.desc}</div>
                          <div
                            style={{
                              color: P.gold,
                              fontSize: '11.5px',
                              fontWeight: 750,
                              marginTop: '6px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 260,
                            }}
                          >
                            {highlight}
                          </div>
                        </div>
                        <span className="suggestion-more">
                          Apri <ArrowRight size={12} weight="bold" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── COME FUNZIONA (mobile) ──────────────────────────── */}
              <div className="mobile-only" style={{ padding: '16px 20px 4px' }}>
                <div className="section-header">
                  <span className="section-title">
                    <span className="accent-line" />
                    Come funziona
                  </span>
                  <button className="section-link">Vedi tutto <ArrowRight size={13} /></button>
                </div>
                <div className="ticket-card" style={{ padding: '2px 18px 18px' }}>
                  {FEATURES.map((f) => {
                    const Icon = f.icon;
                    return (
                      <div key={f.title} className="how-row">
                        <div className="how-icon"><Icon size={18} color={P.pink} weight="fill" /></div>
                        <div>
                          <div className="how-title">{f.title}</div>
                          <div className="how-desc">{f.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="ticket-tear" style={{ background: P.bg }} />
                </div>
              </div>

              {/* ─── BANNER FINALE ────────────────────────────────────── */}
              <div style={{ padding: '16px 20px 24px' }}>
                <div className="ticket-card" style={{
                  padding: '24px 22px',
                  background: `linear-gradient(130deg, ${P.pinkDeep} 0%, ${P.bg} 80%)`,
                  border: `1px solid ${P.pink}30`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  flexWrap: 'wrap',
                }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <FilmStrip size={26} color="#fff" weight="duotone" />
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '800',
                      fontFamily: FONT_DISPLAY,
                      color: '#fff',
                      marginBottom: '4px',
                      letterSpacing: '-0.01em',
                    }}>
                      Scegliete insieme
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.75)',
                      lineHeight: 1.6,
                      marginBottom: '14px',
                      maxWidth: '460px',
                    }}>
                      Crea una stanza e trasforma i gusti in una serata da condividere.
                    </div>
                    <button
                      onClick={handleCreateRoom}
                      style={{
                        background: P.gold,
                        color: P.bg,
                        border: 'none',
                        padding: '11px 22px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontFamily: FONT,
                        boxShadow: `0 4px 20px ${P.gold}30`,
                        transition: 'transform 0.2s, box-shadow 0.3s',
                        letterSpacing: '0.02em',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.boxShadow = `0 8px 28px ${P.gold}50`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = `0 4px 20px ${P.gold}30`;
                      }}
                    >
                      Crea una stanza
                    </button>
                  </div>
                  <div className="ticket-tear" style={{ background: P.bg }} />
                </div>
              </div>

            </div>

            {/* ─── SIDEBAR DESKTOP ────────────────────────────────────── */}
            <div className="home-sidebar desktop-only" style={{ paddingTop: '12px' }}>

              <button
                onClick={handleCreateRoom}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: P.gold,
                  color: P.bg,
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  boxShadow: `0 4px 16px ${P.gold}25`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'transform 0.2s, box-shadow 0.3s',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = `0 8px 28px ${P.gold}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = `0 4px 16px ${P.gold}25`;
                }}
              >
                <FilmSlate size={18} color={P.bg} weight="fill" /> Crea una stanza
              </button>

              <button
                onClick={handleJoinRoom}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: 'transparent',
                  color: P.gold,
                  border: `1.5px solid ${P.gold}60`,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  marginTop: '-8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.25s, color 0.25s, border-color 0.25s',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = P.gold + '15';
                  e.currentTarget.style.borderColor = P.gold;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = P.gold + '60';
                }}
              >
                <Door size={17} color={P.gold} weight="fill" /> Hai un codice? Entra
              </button>

              <div className="ticket-card" style={{ padding: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '13.5px',
                      fontWeight: '700',
                      color: P.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    <UsersThree size={16} color={P.gold} weight="fill" />
                    Entra in una stanza
                  </div>

                  {!loadingPublicRooms && publicRooms.length > 0 && (
                    <span
                      style={{
                        color: P.textFaint,
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {publicRooms.length} online
                    </span>
                  )}
                </div>

                {loadingPublicRooms ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="skeleton"
                        style={{ height: 58, width: '100%' }}
                      />
                    ))}
                  </div>
                ) : publicRooms.length === 0 ? (
                  <div
                    style={{
                      fontSize: '12px',
                      color: P.textFaint,
                      textAlign: 'center',
                      padding: '14px 4px',
                    }}
                  >
                    Nessuna stanza pubblica disponibile adesso
                  </div>
                ) : (
                  <>
                    {publicRooms.slice(0, 4).map((room) => {
                      const participants = Number(room.participant_count ?? 0);
                      const maxMembers = Number(room.max_members ?? 2);
                      const modeColor = roomModeColor(room);

                      return (
                        <div
                          key={room.id}
                          className="room-card"
                          onClick={() => handleEnterRoom(room.id)}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  background: `${modeColor}18`,
                                  border: `1px solid ${modeColor}35`,
                                  display: 'grid',
                                  placeItems: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <UsersThree size={14} color={modeColor} weight="fill" />
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 800,
                                    color: P.text,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <span style={{ color: modeColor }}>
                                    {roomModeLabel(room)}
                                  </span>
                                  <span style={{ color: P.textFaint }}> · </span>
                                  <span>{room.host_name || 'Utente'}</span>
                                </div>

                                <div
                                  style={{
                                    color: P.textFaint,
                                    fontSize: 10,
                                    marginTop: 2,
                                  }}
                                >
                                  {participants}/{maxMembers} partecipanti
                                  {room.city ? ` · ${room.city}` : ''}
                                </div>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn-enter"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEnterRoom(room.id);
                            }}
                          >
                            Entra
                          </button>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      className="section-link"
                      onClick={() => router.push('/stanze')}
                      style={{ marginTop: '8px', fontSize: '12px' }}
                    >
                      Vedi tutte le stanze <ArrowRight size={12} />
                    </button>
                  </>
                )}

                <div className="ticket-tear" style={{ background: P.bg }} />
              </div>

              {isGuest && (
                <div className="ticket-card" style={{
                  padding: '18px',
                  background: `linear-gradient(135deg, ${P.pinkDeep} 0%, ${P.pink} 100%)`,
                  border: `1px solid ${P.pink}30`,
                  color: '#fff',
                }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', fontFamily: FONT_DISPLAY, marginBottom: '4px' }}>
                    Registrati
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.85, lineHeight: 1.5, marginBottom: '14px' }}>
                    Salva i match e scrivi recensioni.
                  </div>
                  <button
                    onClick={() => router.push('/auth')}
                    style={{
                      background: '#fff',
                      color: P.pinkDeep,
                      border: 'none',
                      padding: '10px 18px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontFamily: FONT,
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    Crea account gratuito
                  </button>
                  <div className="ticket-tear" style={{ background: P.bg }} />
                </div>
              )}
            </div>
          </div>

          {/* ─── BANNER OSPITE (mobile) ────────────────────────────── */}
          {isGuest && (
            <div className="mobile-only" style={{ padding: '0 20px 20px' }}>
              <div className="ticket-card" style={{
                padding: '20px 18px',
                background: `linear-gradient(135deg, ${P.pinkDeep} 0%, ${P.pink} 100%)`,
                border: `1px solid ${P.pink}30`,
                color: '#fff',
              }}>
                <div style={{ fontSize: '16px', fontWeight: '800', fontFamily: FONT_DISPLAY, marginBottom: '4px' }}>
                  Registrati per fare di più
                </div>
                <div style={{ fontSize: '13px', opacity: 0.85, lineHeight: 1.5, marginBottom: '14px' }}>
                  Salva i match, scrivi recensioni e accedi alle stanze recenti.
                </div>
                <button
                  onClick={() => router.push('/auth')}
                  style={{
                    background: '#fff',
                    color: P.pinkDeep,
                    border: 'none',
                    padding: '10px 22px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontFamily: FONT,
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  Crea account gratuito
                </button>
                <div className="ticket-tear" style={{ background: P.bg }} />
              </div>
            </div>
          )}

          {/* ─── FOOTER ────────────────────────────────────────────────── */}
          {false && <div className="footer-cine">
            <div className="footer-grid">
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '800',
                  color: P.text,
                  marginBottom: '10px',
                  fontFamily: FONT_DISPLAY,
                  letterSpacing: '-0.01em',
                }}>
                  CINE<span style={{ color: P.pink }}>DATE</span>
                </div>
                <div style={{
                  fontSize: '12.5px',
                  color: P.textFaint,
                  lineHeight: 1.7,
                  maxWidth: '200px',
                  fontStyle: 'italic',
                }}>
                  "Il cinema, in compagnia. Trova il film perfetto, insieme."
                </div>
              </div>
              <div>
                <div className="footer-col-title">Navigazione</div>
                <div className="footer-link">Come funziona</div>
                <div className="footer-link">Recensioni</div>
                <div className="footer-link" onClick={() => router.push('/cinema')}>Cinema vicino a te</div>
              </div>
              <div>
                <div className="footer-col-title">Legal</div>
                <div className="footer-link">Termini di servizio</div>
                <div className="footer-link">Privacy policy</div>
                <div className="footer-link">Cookie policy</div>
              </div>
              <div>
                <div className="footer-col-title">Seguici</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div className="footer-social"><InstagramLogo size={15} color={P.textMuted} /></div>
                  <div className="footer-social"><TiktokLogo size={15} color={P.textMuted} /></div>
                  <div className="footer-social"><XLogo size={15} color={P.textMuted} /></div>
                </div>
                <div style={{ marginTop: '16px', fontSize: '11px', color: P.textFaint, lineHeight: 1.6 }}>
                  <Heart size={12} color={P.pink} weight="fill" style={{ display: 'inline', marginRight: '4px' }} />
                  Fatto con passione per chi ama il cinema
                </div>
              </div>
            </div>
            <div style={{
              fontSize: '11px',
              color: P.textFaint,
              textAlign: 'center',
              marginTop: '28px',
              letterSpacing: '0.04em',
              borderTop: `1px solid ${P.border}30`,
              paddingTop: '18px',
            }}>
              © 2026 CineDate — Tutti i diritti riservati
            </div>
          </div>}

        </div>
      </AppShell>
    </>
  );
}