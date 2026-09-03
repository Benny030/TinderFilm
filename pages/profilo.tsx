'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/utils/supabase/browser';
import { useTheme } from '@/context/ThemeContext';
import {
  Bell,
  BookmarkSimple,
  Camera,
  Check,
  CheckCircle,
  Eye,
  FilmSlate,
  Flag,
  Gavel,
  FloppyDisk,
  GearSix,
  Heart,
  LockKey,
  Prohibit,
  ShieldCheck,
  WarningCircle,
  SignOut,
  Star,
  User,
  Warning,
  Sparkle,
  ArrowRight,
  TrendUp,
} from '@phosphor-icons/react';

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
  error: '#ef4444',
  success: '#22c55e',
};

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
  error: '#dc2626',
  success: '#16a34a',
};

const FONT_SANS = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";
const FONT_MONO = "'JetBrains Mono','Courier New',monospace";

type Tab = 'attivita' | 'impostazioni';

type ProfileRow = {
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  favorite_genres: string[] | null;
};

type CatalogMovie = {
  id: string;
  provider: string;
  provider_movie_id: string;
  title: string;
  year: number | null;
  genre: string | null;
  cover: string | null;
};

type MovieEntryRow = {
  id: string;
  rating: number | null;
  review_text: string | null;
  is_favorite: boolean;
  in_watchlist: boolean;
  watched_on: string | null;
  updated_at: string;
  movie_catalog: CatalogMovie | CatalogMovie[] | null;
};


type TasteMeta = {
  personalized: boolean;
  seeds_used: number;
  positive_signals: number;
  excluded_movies: number;
  negative_genres?: number;
  taste_genres?: number;
  taste_actors?: number;
  top_genres?: Array<{
    id: number;
    name: string;
    weight: number;
  }>;
  top_actors?: Array<{
    id: number;
    name: string;
    weight: number;
  }>;
};

type TasteRecommendation = {
  tmdb_id: number;
  title: string;
  reason: string;
};

const GENRES = [
  'horror',
  'azione',
  'comedy',
  'drama',
  'thriller',
  'sci-fi',
  'romance',
];

const avatarColors = [
  '#E8386D',
  '#5BBEC8',
  '#8B5CF6',
  '#F59E0B',
  '#22C55E',
  '#EF4444',
];

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

function getFallbackColor(seed: string) {
  const sum = seed
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return avatarColors[sum % avatarColors.length];
}

function getStoragePath(userId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  return `${userId}/${Date.now()}.${extension}`;
}

function getCatalogMovie(row: MovieEntryRow) {
  return Array.isArray(row.movie_catalog)
    ? row.movie_catalog[0] ?? null
    : row.movie_catalog;
}

export default function ProfiloPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading, signOut } = useAuth();
  const supabase = useRef(createBrowserClient()).current;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const [activeTab, setActiveTab] = useState<Tab>('attivita');

  const [profileLoading, setProfileLoading] = useState(true);
  const [movieEntriesLoading, setMovieEntriesLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [googleAvatarUrl, setGoogleAvatarUrl] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [favoritesPublic, setFavoritesPublic] = useState(false);
  const [watchlistPublic, setWatchlistPublic] = useState(false);
  const [watchedPublic, setWatchedPublic] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const [notifyNewFollower, setNotifyNewFollower] = useState(true);
  const [notifyReviewLike, setNotifyReviewLike] = useState(true);
  const [notifyReviewComment, setNotifyReviewComment] = useState(true);
  const [notifyReportUpdates, setNotifyReportUpdates] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [movieEntries, setMovieEntries] = useState<MovieEntryRow[]>([]);
  const [tasteMeta, setTasteMeta] = useState<TasteMeta | null>(null);
  const [tastePreview, setTastePreview] = useState<TasteRecommendation[]>([]);
  const [tasteLoading, setTasteLoading] = useState(true);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser || isGuest) router.replace('/auth');
  }, [currentUser, isGuest, isLoading, router]);


  useEffect(() => {
    if (!currentUser || currentUser.isGuest) {
      setTasteMeta(null);
      setTastePreview([]);
      setTasteLoading(false);
      return;
    }

    let cancelled = false;

    const loadTasteProfile = async () => {
      setTasteLoading(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const token = session?.access_token;
        if (!token) throw new Error('Sessione non disponibile');

        const response = await fetch('/api/recommendations/for-you', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error || 'Impossibile caricare il profilo gusti'
          );
        }

        if (!cancelled) {
          setTasteMeta(data.meta ?? null);
          setTastePreview(
            Array.isArray(data.recommendations)
              ? data.recommendations.slice(0, 3)
              : []
          );
        }
      } catch (err) {
        console.error('Taste profile load failed:', err);

        if (!cancelled) {
          setTasteMeta(null);
          setTastePreview([]);
        }
      } finally {
        if (!cancelled) setTasteLoading(false);
      }
    };

    void loadTasteProfile();

    return () => {
      cancelled = true;
    };
  }, [currentUser, supabase]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    const loadProfile = async () => {
      setProfileLoading(true);
      setError('');

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const metadataAvatar =
          typeof user?.user_metadata?.avatar_url === 'string'
            ? user.user_metadata.avatar_url
            : typeof user?.user_metadata?.picture === 'string'
            ? user.user_metadata.picture
            : null;

        setGoogleAvatarUrl(metadataAvatar);

        const { data, error: profileError } = await supabase
          .from('users')
          .select('username,email,avatar_url,bio,favorite_genres')
          .eq('id', currentUser.id)
          .maybeSingle<ProfileRow>();

        if (profileError) throw profileError;

        setUsername(data?.username ?? currentUser.username ?? '');
        setEmail(data?.email ?? currentUser.email ?? '');
        setAvatarUrl(data?.avatar_url ?? null);
        setBio(data?.bio ?? '');
        setFavoriteGenres(
          Array.isArray(data?.favorite_genres)
            ? data.favorite_genres
            : []
        );
      } catch (err: any) {
        setError(
          err.message ?? 'Errore durante il caricamento del profilo'
        );
      } finally {
        setProfileLoading(false);
      }
    };

    void loadProfile();
  }, [currentUser, supabase]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    const loadPrivacy = async () => {
      const { data, error: privacyError } = await supabase
        .from('user_privacy_settings')
        .select(
          'favorites_visibility,watchlist_visibility,watched_visibility'
        )
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (privacyError) {
        console.error('Privacy settings load failed:', privacyError);
        return;
      }

      setFavoritesPublic(
        data?.favorites_visibility === 'public'
      );

      setWatchlistPublic(
        data?.watchlist_visibility === 'public'
      );

      setWatchedPublic(
        data?.watched_visibility === 'public'
      );
    };

    void loadPrivacy();
  }, [currentUser, supabase]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    const loadNotificationSettings = async () => {
      try {
        const { data, error: settingsError } = await supabase
          .from('user_notification_settings')
          .select(
            'notify_new_follower,notify_review_like,notify_review_comment,notify_report_updates'
          )
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (settingsError) {
          console.error(
            'Notification settings load failed:',
            settingsError
          );
          return;
        }

        setNotifyNewFollower(
          data?.notify_new_follower ?? true
        );
        setNotifyReviewLike(
          data?.notify_review_like ?? true
        );
        setNotifyReviewComment(
          data?.notify_review_comment ?? true
        );
        setNotifyReportUpdates(
          data?.notify_report_updates ?? true
        );
      } catch (err) {
        console.error(
          'Notification settings load failed:',
          err
        );
      }
    };

    void loadNotificationSettings();
  }, [currentUser, supabase]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    const checkAdmin = async () => {
      try {
        const { data, error: adminError } = await supabase.rpc(
          'is_current_user_admin'
        );

        if (adminError) {
          console.error('Admin check failed:', adminError);
          setIsAdmin(false);
          return;
        }

        setIsAdmin(data === true);
      } catch (err) {
        console.error('Admin check failed:', err);
        setIsAdmin(false);
      }
    };

    void checkAdmin();
  }, [currentUser, supabase]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    const loadMovieEntries = async () => {
      setMovieEntriesLoading(true);

      try {
        const { data, error: entriesError } = await supabase
          .from('user_movie_entries')
          .select(`
            id,
            rating,
            review_text,
            is_favorite,
            in_watchlist,
            watched_on,
            updated_at,
            movie_catalog (
              id,
              provider,
              provider_movie_id,
              title,
              year,
              genre,
              cover
            )
          `)
          .eq('user_id', currentUser.id)
          .order('updated_at', { ascending: false });

        if (entriesError) throw entriesError;

        setMovieEntries((data ?? []) as MovieEntryRow[]);
      } catch (err) {
        console.error('Movie entries load failed:', err);
      } finally {
        setMovieEntriesLoading(false);
      }
    };

    void loadMovieEntries();
  }, [currentUser, supabase]);

  const visibleAvatarUrl = avatarUrl || googleAvatarUrl;
  const fallbackSeed = username || email || 'utente';
  const fallbackInitial = fallbackSeed.charAt(0).toUpperCase();
  const fallbackColor = useMemo(
    () => getFallbackColor(fallbackSeed),
    [fallbackSeed]
  );

  const favorites = movieEntries.filter((entry) => entry.is_favorite);
  const watchlist = movieEntries.filter((entry) => entry.in_watchlist);
  const watched = movieEntries.filter((entry) => entry.watched_on);
  const reviewed = movieEntries.filter(
    (entry) => entry.review_text || entry.rating !== null
  );

  const toggleGenre = (genre: string) => {
    setFavoriteGenres((current) =>
      current.includes(genre)
        ? current.filter((item) => item !== genre)
        : [...current, genre]
    );

    setMessage('');
  };

  const saveProfile = async () => {
    if (!currentUser || currentUser.isGuest) return;

    const cleanUsername = normalizeUsername(username);

    if (cleanUsername.length < 3) {
      setError('Username: minimo 3 caratteri.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error: saveError } = await supabase
        .from('users')
        .update({
          username: cleanUsername,
          avatar_url: avatarUrl,
          bio: bio.trim(),
          favorite_genres: favoriteGenres,
        })
        .eq('id', currentUser.id);

      if (saveError) {
        if (saveError.code === '23505') {
          setError('Username già in uso, scegline un altro.');
          return;
        }

        throw saveError;
      }

      setUsername(cleanUsername);
      setMessage('Profilo salvato.');
    } catch (err: any) {
      setError(err.message ?? 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file || !currentUser || currentUser.isGuest) return;

    if (!file.type.startsWith('image/')) {
      setError('Carica un file immagine.');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const path = getStoragePath(currentUser.id, file);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const publicUrl = data.publicUrl;

      const { error: saveError } = await supabase
        .from('users')
        .update({
          avatar_url: publicUrl,
        })
        .eq('id', currentUser.id);

      if (saveError) throw saveError;

      setAvatarUrl(publicUrl);
      setMessage('Avatar aggiornato.');
    } catch (err: any) {
      setError(err.message ?? 'Errore durante upload avatar');
    } finally {
      setUploading(false);

      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const updatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Compila entrambi i campi password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('La password deve avere almeno 8 caratteri.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }

    setChangingPassword(true);
    setError('');
    setMessage('');

    try {
      const { error: passwordError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (passwordError) throw passwordError;

      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password aggiornata.');
    } catch (err: any) {
      setError(
        err.message ?? 'Errore durante il cambio password'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const saveNotificationSettings = async () => {
    if (!currentUser || currentUser.isGuest) return;

    setSavingNotifications(true);
    setError('');
    setMessage('');

    try {
      const { error: settingsError } = await supabase
        .from('user_notification_settings')
        .upsert(
          {
            user_id: currentUser.id,
            notify_new_follower: notifyNewFollower,
            notify_review_like: notifyReviewLike,
            notify_review_comment: notifyReviewComment,
            notify_report_updates: notifyReportUpdates,
          },
          {
            onConflict: 'user_id',
          }
        );

      if (settingsError) throw settingsError;

      setMessage('Preferenze notifiche salvate.');
    } catch (err: unknown) {
      console.error(
        'Notification settings save failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Errore durante il salvataggio delle notifiche.'
      );
    } finally {
      setSavingNotifications(false);
    }
  };

  const savePrivacy = async () => {
    if (!currentUser || currentUser.isGuest) return;

    setSavingPrivacy(true);
    setError('');
    setMessage('');

    try {
      const { error: privacyError } = await supabase
        .from('user_privacy_settings')
        .upsert(
          {
            user_id: currentUser.id,
            favorites_visibility: favoritesPublic
              ? 'public'
              : 'private',
            watchlist_visibility: watchlistPublic
              ? 'public'
              : 'private',
            watched_visibility: watchedPublic
              ? 'public'
              : 'private',
          },
          {
            onConflict: 'user_id',
          }
        );

      if (privacyError) throw privacyError;

      setMessage('Impostazioni privacy salvate.');
    } catch (err: unknown) {
      console.error('Privacy settings save failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Errore durante il salvataggio della privacy.'
      );
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const openMovie = (entry: MovieEntryRow) => {
    const movie = getCatalogMovie(entry);

    if (movie?.provider === 'tmdb') {
      router.push(`/film/${movie.provider_movie_id}`);
    }
  };

  if (
    isLoading ||
    profileLoading ||
    !currentUser ||
    isGuest
  ) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: P.bg,
        }}
      >
        <FilmSlate size={42} color={P.pink} weight="duotone" />
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    padding: '13px 16px',
    border: `1px solid ${P.border}`,
    borderRadius: 0,
    fontSize: '15px',
    fontFamily: FONT_SANS,
    color: P.text,
    background: P.bgSoft,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const activitySections = [
    {
      key: 'favorites',
      libraryTab: 'preferiti',
      title: 'Preferiti',
      subtitle: 'I film che ami di più',
      icon: Heart,
      color: P.pink,
      background: P.pinkGlow,
      items: favorites,
      empty: 'Non hai ancora film preferiti.',
    },
    {
      key: 'watchlist',
      libraryTab: 'watchlist',
      title: 'Watchlist',
      subtitle: 'I prossimi film da vedere',
      icon: BookmarkSimple,
      color: P.gold,
      background: P.goldGlow,
      items: watchlist,
      empty: 'La tua watchlist è ancora vuota.',
    },
    {
      key: 'watched',
      libraryTab: 'visti',
      title: 'Visti',
      subtitle: 'I film che hai già guardato',
      icon: Eye,
      color: P.success,
      background: 'rgba(34,197,94,0.10)',
      items: watched,
      empty: 'Non hai ancora segnato film come visti.',
    },
    {
      key: 'reviews',
      libraryTab: 'recensioni',
      title: 'Voti e recensioni',
      subtitle: 'Le tue opinioni sui film',
      icon: Star,
      color: P.gold,
      background: P.goldGlow,
      items: reviewed,
      empty: 'Non hai ancora votato o recensito film.',
    },
  ];

  return (
    <AppShell activeNav="profilo">
      <main
        style={{
          minHeight: '100vh',
          background: P.bg,
          padding: '26px 16px 70px',
          fontFamily: FONT_SANS,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1040,
            margin: '0 auto',
          }}
        >
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 20,
              alignItems: 'center',
              marginBottom: 22,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: visibleAvatarUrl
                    ? P.border
                    : fallbackColor,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontSize: 23,
                  fontWeight: 900,
                }}
              >
                {visibleAvatarUrl ? (
                  <img
                    src={visibleAvatarUrl}
                    alt="Avatar profilo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  fallbackInitial
                )}
              </div>

              <div>
                <div
                  style={{
                    color: P.textFaint,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '.09em',
                  }}
                >
                  Il tuo profilo
                </div>

                <h1
                  style={{
                    margin: '3px 0 0',
                    color: P.text,
                    fontFamily: FONT_DISPLAY,
                    fontSize: 30,
                  }}
                >
                  @{username || 'utente'}
                </h1>
              </div>
            </div>
          </header>
          <section
            style={{
              border: `1px solid ${P.border}`,
              background: P.bgSoft,
              padding: 16,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: 12,
                flexWrap: 'wrap',
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
                  }}
                >
                  La tua attività
                </div>
                <div
                  style={{
                    color: P.text,
                    fontFamily: FONT_DISPLAY,
                    fontSize: 21,
                    fontWeight: 800,
                    marginTop: 3,
                  }}
                >
                  La tua CineDate in breve
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/per-te')}
                style={{
                  border: `1px solid ${P.gold}`,
                  background: P.goldGlow,
                  color: P.gold,
                  padding: '8px 11px',
                  fontFamily: FONT_SANS,
                  fontSize: 10,
                  fontWeight: 850,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Sparkle size={13} weight="fill" />
                I tuoi consigli
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
                gap: 8,
              }}
            >
              {[
                { label: 'Preferiti', value: favorites.length, color: P.pink, tab: 'preferiti' },
                { label: 'Watchlist', value: watchlist.length, color: P.gold, tab: 'watchlist' },
                { label: 'Visti', value: watched.length, color: P.success, tab: 'visti' },
                { label: 'Recensioni', value: reviewed.length, color: P.gold, tab: 'recensioni' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(`/libreria?tab=${item.tab}`)}
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.card,
                    color: P.text,
                    padding: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: FONT_SANS,
                  }}
                >
                  <div
                    style={{
                      color: item.color,
                      fontSize: 21,
                      fontWeight: 900,
                    }}
                  >
                    {item.value}
                  </div>
                  <div
                    style={{
                      color: P.textMuted,
                      fontSize: 9.5,
                      fontWeight: 800,
                      marginTop: 3,
                    }}
                  >
                    {item.label}
                  </div>
                </button>
              ))}
            </div>
          </section>


          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              background: P.bgSoft,
              border: `1px solid ${P.border}`,
              marginBottom: 22,
            }}
          >
            <button
              onClick={() => setActiveTab('attivita')}
              style={{
                flex: 1,
                border: 0,
                background:
                  activeTab === 'attivita'
                    ? P.card
                    : 'transparent',
                color:
                  activeTab === 'attivita'
                    ? P.text
                    : P.textMuted,
                padding: '12px 14px',
                cursor: 'pointer',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                boxShadow:
                  activeTab === 'attivita'
                    ? '0 2px 10px rgba(0,0,0,.14)'
                    : 'none',
              }}
            >
              <FilmSlate
                size={17}
                color={
                  activeTab === 'attivita'
                    ? P.gold
                    : P.textMuted
                }
                weight="fill"
              />
              Attività
            </button>

            <button
              onClick={() => setActiveTab('impostazioni')}
              style={{
                flex: 1,
                border: 0,
                background:
                  activeTab === 'impostazioni'
                    ? P.card
                    : 'transparent',
                color:
                  activeTab === 'impostazioni'
                    ? P.text
                    : P.textMuted,
                padding: '12px 14px',
                cursor: 'pointer',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                boxShadow:
                  activeTab === 'impostazioni'
                    ? '0 2px 10px rgba(0,0,0,.14)'
                    : 'none',
              }}
            >
              <GearSix
                size={17}
                color={
                  activeTab === 'impostazioni'
                    ? P.pink
                    : P.textMuted
                }
                weight="fill"
              />
              Impostazioni
            </button>
          </div>

          {activeTab === 'attivita' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <section
                style={{
                  background: P.card,
                  border: `1px solid ${P.border}`,
                  padding: 20,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 3,
                    background: P.gold,
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        color: P.gold,
                        fontSize: 10,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '.11em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Sparkle size={14} weight="fill" />
                      I tuoi gusti
                    </div>

                    <div
                      style={{
                        color: P.text,
                        fontFamily: FONT_DISPLAY,
                        fontSize: 24,
                        fontWeight: 800,
                        marginTop: 6,
                      }}
                    >
                      Il tuo profilo cinematografico
                    </div>

                    <div
                      style={{
                        color: P.textMuted,
                        fontSize: 12,
                        lineHeight: 1.5,
                        marginTop: 6,
                        maxWidth: 620,
                      }}
                    >
                      TinderFilm usa preferiti, voti, match, swipe e film scelti nelle stanze per capire cosa proporti.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/per-te')}
                    style={{
                      border: `1px solid ${P.gold}`,
                      background: P.goldGlow,
                      color: P.gold,
                      padding: '9px 11px',
                      cursor: 'pointer',
                      fontFamily: FONT_SANS,
                      fontSize: 11,
                      fontWeight: 850,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Vedi il tuo Per te
                    <ArrowRight size={13} weight="bold" />
                  </button>
                </div>

                {tasteLoading ? (
                  <div
                    style={{
                      marginTop: 16,
                      color: P.textFaint,
                      fontSize: 12,
                    }}
                  >
                    Sto leggendo i tuoi gusti...
                  </div>
                ) : tasteMeta ? (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit,minmax(130px,1fr))',
                        gap: 8,
                        marginTop: 16,
                      }}
                    >
                      {[
                        {
                          label: 'Segnali forti',
                          value: tasteMeta.seeds_used,
                          color: P.pink,
                        },
                        {
                          label: 'Generi capiti',
                          value: tasteMeta.taste_genres ?? 0,
                          color: P.gold,
                        },
                        {
                          label: 'Attori ricorrenti',
                          value: tasteMeta.taste_actors ?? 0,
                          color: P.success,
                        },
                        {
                          label: 'Film già considerati',
                          value: tasteMeta.excluded_movies,
                          color: P.textMuted,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          style={{
                            border: `1px solid ${P.border}`,
                            background: P.bgSoft,
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              color: item.color,
                              fontFamily: FONT_MONO,
                              fontSize: 20,
                              fontWeight: 900,
                            }}
                          >
                            {item.value}
                          </div>
                          <div
                            style={{
                              color: P.textFaint,
                              fontSize: 10,
                              marginTop: 4,
                            }}
                          >
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {((tasteMeta.top_genres?.length ?? 0) > 0 ||
                      (tasteMeta.top_actors?.length ?? 0) > 0) && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit,minmax(220px,1fr))',
                          gap: 10,
                          marginTop: 14,
                        }}
                      >
                        {(tasteMeta.top_genres?.length ?? 0) > 0 && (
                          <div
                            style={{
                              border: `1px solid ${P.border}`,
                              background: P.bgSoft,
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                color: P.textFaint,
                                fontSize: 10,
                                textTransform: 'uppercase',
                                letterSpacing: '.08em',
                                fontWeight: 850,
                              }}
                            >
                              Generi che tornano di più
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                                marginTop: 9,
                              }}
                            >
                              {tasteMeta.top_genres?.map((genre, index) => (
                                <span
                                  key={genre.id}
                                  style={{
                                    border: `1px solid ${
                                      index === 0 ? P.gold : P.border
                                    }`,
                                    background:
                                      index === 0 ? P.goldGlow : P.card,
                                    color:
                                      index === 0 ? P.gold : P.textMuted,
                                    padding: '6px 8px',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  {genre.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {(tasteMeta.top_actors?.length ?? 0) > 0 && (
                          <div
                            style={{
                              border: `1px solid ${P.border}`,
                              background: P.bgSoft,
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                color: P.textFaint,
                                fontSize: 10,
                                textTransform: 'uppercase',
                                letterSpacing: '.08em',
                                fontWeight: 850,
                              }}
                            >
                              Attori ricorrenti
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                                marginTop: 9,
                              }}
                            >
                              {tasteMeta.top_actors?.map((actor, index) => (
                                <span
                                  key={actor.id}
                                  style={{
                                    border: `1px solid ${
                                      index === 0 ? P.pink : P.border
                                    }`,
                                    background:
                                      index === 0 ? P.pinkGlow : P.card,
                                    color:
                                      index === 0 ? P.pink : P.textMuted,
                                    padding: '6px 8px',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  {actor.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {tastePreview.length > 0 && (
                      <div
                        style={{
                          marginTop: 14,
                          borderTop: `1px solid ${P.border}`,
                          paddingTop: 12,
                        }}
                      >
                        <div
                          style={{
                            color: P.textFaint,
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '.08em',
                            marginBottom: 8,
                          }}
                        >
                          Alcuni consigli per te
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          {tastePreview.map((movie) => (
                            <button
                              key={movie.tmdb_id}
                              type="button"
                              onClick={() =>
                                router.push(`/film/${movie.tmdb_id}`)
                              }
                              style={{
                                border: `1px solid ${P.border}`,
                                background: P.bgSoft,
                                color: P.text,
                                padding: '8px 10px',
                                cursor: 'pointer',
                                fontFamily: FONT_SANS,
                                fontSize: 11,
                                fontWeight: 750,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                              title={movie.reason}
                            >
                              <TrendUp
                                size={13}
                                color={P.gold}
                                weight="duotone"
                              />
                              {movie.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      marginTop: 16,
                      border: `1px dashed ${P.border}`,
                      background: P.bgSoft,
                      padding: 14,
                      color: P.textMuted,
                      fontSize: 12,
                    }}
                  >
                    Usa preferiti, voti e stanze per costruire il tuo profilo gusti.
                  </div>
                )}
              </section>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(190px,1fr))',
                  gap: 12,
                }}
              >
                {activitySections.map((section) => {
                  const Icon = section.icon;

                  return (
                    <button
                      type="button"
                      key={`summary-${section.key}`}
                      onClick={() =>
                        router.push(`/libreria?tab=${section.libraryTab}`)
                      }
                      style={{
                        width: '100%',
                        background: P.card,
                        border: `1px solid ${P.border}`,
                        padding: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: FONT_SANS,
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          display: 'grid',
                          placeItems: 'center',
                          background: section.background,
                          color: section.color,
                          flexShrink: 0,
                        }}
                      >
                        <Icon
                          size={20}
                          weight="fill"
                        />
                      </div>

                      <div>
                        <div
                          style={{
                            color: P.text,
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          {section.title}
                        </div>

                        <div
                          style={{
                            color: P.textFaint,
                            fontSize: 10,
                            marginTop: 2,
                          }}
                        >
                          {section.subtitle}
                        </div>
                      </div>

                      <div
                        style={{
                          marginLeft: 'auto',
                          color: section.color,
                          fontFamily: FONT_MONO,
                          fontWeight: 900,
                          fontSize: 20,
                        }}
                      >
                        {section.items.length}
                      </div>
                    </button>
                  );
                })}
              </div>

              {movieEntriesLoading ? (
                <div
                  style={{
                    padding: 30,
                    color: P.textFaint,
                    textAlign: 'center',
                  }}
                >
                  Caricamento attività...
                </div>
              ) : (
                activitySections.map((section) => {
                  const Icon = section.icon;

                  return (
                    <section
                      key={section.key}
                      style={{
                        background: P.card,
                        border: `1px solid ${P.border}`,
                        padding: 20,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 14,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            display: 'grid',
                            placeItems: 'center',
                            background: section.background,
                            color: section.color,
                          }}
                        >
                          <Icon size={18} weight="fill" />
                        </div>

                        <div>
                          <h2
                            style={{
                              margin: 0,
                              color: P.text,
                              fontFamily: FONT_DISPLAY,
                              fontSize: 19,
                            }}
                          >
                            {section.title}
                          </h2>

                          <div
                            style={{
                              color: P.textFaint,
                              fontSize: 10,
                              marginTop: 2,
                            }}
                          >
                            {section.subtitle}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/libreria?tab=${section.libraryTab}`)
                          }
                          style={{
                            marginLeft: 'auto',
                            border: 0,
                            background: 'transparent',
                            color: section.color,
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontFamily: FONT_SANS,
                          }}
                        >
                          Vedi tutti
                        </button>
                      </div>

                      {section.items.length === 0 ? (
                        <div
                          style={{
                            border: `1px dashed ${P.border}`,
                            background: P.bgSoft,
                            color: P.textFaint,
                            padding: 22,
                            textAlign: 'center',
                            fontSize: 12,
                          }}
                        >
                          {section.empty}
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            gap: 14,
                            overflowX: 'auto',
                            paddingBottom: 6,
                          }}
                        >
                          {section.items
                            .slice(0, 14)
                            .map((entry) => {
                              const movie =
                                getCatalogMovie(entry);

                              if (!movie) return null;

                              return (
                                <button
                                  key={`${section.key}-${entry.id}`}
                                  onClick={() =>
                                    openMovie(entry)
                                  }
                                  style={{
                                    width: 126,
                                    minWidth: 126,
                                    padding: 0,
                                    border: 0,
                                    background:
                                      'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    color: P.text,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 126,
                                      aspectRatio: '2/3',
                                      border: `1px solid ${P.border}`,
                                      background: P.bgSoft,
                                      overflow: 'hidden',
                                      position: 'relative',
                                    }}
                                  >
                                    {movie.cover ? (
                                      <img
                                        src={movie.cover}
                                        alt={movie.title}
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit:
                                            'cover',
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          display: 'grid',
                                          placeItems:
                                            'center',
                                        }}
                                      >
                                        🎬
                                      </div>
                                    )}

                                    {section.key ===
                                      'reviews' &&
                                      entry.rating !==
                                        null && (
                                        <div
                                          style={{
                                            position:
                                              'absolute',
                                            bottom: 6,
                                            left: 6,
                                            background:
                                              'rgba(0,0,0,.78)',
                                            color: P.gold,
                                            padding:
                                              '4px 6px',
                                            fontSize: 10,
                                            fontWeight: 800,
                                            display: 'flex',
                                            alignItems:
                                              'center',
                                            gap: 3,
                                          }}
                                        >
                                          <Star
                                            size={10}
                                            weight="fill"
                                          />
                                          {Number(
                                            entry.rating
                                          ).toFixed(1)}
                                        </div>
                                      )}
                                  </div>

                                  <strong
                                    style={{
                                      display: 'block',
                                      marginTop: 7,
                                      color: P.text,
                                      fontSize: 11,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow:
                                        'ellipsis',
                                    }}
                                  >
                                    {movie.title}
                                  </strong>

                                  <span
                                    style={{
                                      display: 'block',
                                      marginTop: 3,
                                      color: P.textFaint,
                                      fontSize: 9,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow:
                                        'ellipsis',
                                    }}
                                  >
                                    {[
                                      movie.year,
                                      movie.genre,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </section>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'impostazioni' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <section
                style={{
                  background: P.card,
                  border: `1px solid ${P.border}`,
                  padding: 22,
                  display: 'grid',
                  gridTemplateColumns:
                    '220px minmax(0,1fr)',
                  gap: 24,
                }}
                className="profile-settings-grid"
              >
                <aside
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 130,
                      height: 130,
                      borderRadius: '50%',
                      background: visibleAvatarUrl
                        ? P.border
                        : fallbackColor,
                      overflow: 'hidden',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                      fontSize: 46,
                      fontWeight: 900,
                    }}
                  >
                    {visibleAvatarUrl ? (
                      <img
                        src={visibleAvatarUrl}
                        alt="Avatar profilo"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      fallbackInitial
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={uploadAvatar}
                    style={{ display: 'none' }}
                  />

                  <button
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={uploading}
                    style={{
                      background: P.pinkGlow,
                      color: P.pink,
                      border: `1px solid ${P.pink}35`,
                      padding: '9px 13px',
                      cursor: 'pointer',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <Camera size={16} weight="bold" />
                    {uploading
                      ? 'Upload...'
                      : 'Cambia avatar'}
                  </button>
                </aside>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 15,
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        color: P.textMuted,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        fontWeight: 800,
                      }}
                    >
                      Username
                    </span>
                    <input
                      value={username}
                      onChange={(event) => {
                        setUsername(
                          normalizeUsername(
                            event.target.value
                          )
                        );
                        setMessage('');
                        setError('');
                      }}
                      style={inputStyle}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        color: P.textMuted,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        fontWeight: 800,
                      }}
                    >
                      Email
                    </span>
                    <input
                      value={email}
                      disabled
                      style={{
                        ...inputStyle,
                        color: P.textFaint,
                        cursor: 'not-allowed',
                      }}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        color: P.textMuted,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        fontWeight: 800,
                      }}
                    >
                      Bio
                    </span>
                    <textarea
                      value={bio}
                      onChange={(event) =>
                        setBio(
                          event.target.value.slice(
                            0,
                            220
                          )
                        )
                      }
                      rows={4}
                      style={{
                        ...inputStyle,
                        resize: 'vertical',
                        lineHeight: 1.5,
                      }}
                    />
                  </label>

                  <div>
                    <div
                      style={{
                        color: P.textMuted,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        fontWeight: 800,
                        marginBottom: 7,
                      }}
                    >
                      Generi preferiti
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 7,
                      }}
                    >
                      {GENRES.map((genre) => {
                        const selected =
                          favoriteGenres.includes(genre);

                        return (
                          <button
                            key={genre}
                            type="button"
                            onClick={() =>
                              toggleGenre(genre)
                            }
                            style={{
                              border: `1px solid ${
                                selected
                                  ? P.pink
                                  : P.border
                              }`,
                              background: selected
                                ? P.pinkGlow
                                : 'transparent',
                              color: selected
                                ? P.pink
                                : P.textMuted,
                              padding: '8px 11px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {selected && (
                              <Check
                                size={11}
                                weight="bold"
                                style={{
                                  marginRight: 4,
                                }}
                              />
                            )}
                            {genre}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={saveProfile}
                    disabled={saving || uploading}
                    style={{
                      background: P.pink,
                      color: '#fff',
                      border: 0,
                      padding: '12px 16px',
                      cursor: 'pointer',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                    }}
                  >
                    <FloppyDisk
                      size={17}
                      weight="bold"
                    />
                    {saving
                      ? 'Salvataggio...'
                      : 'Salva modifiche'}
                  </button>
                </div>
              </section>

              <section
                style={{
                  background: P.card,
                  border: `1px solid ${P.border}`,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      background: P.goldGlow,
                      color: P.gold,
                    }}
                  >
                    <LockKey size={17} weight="fill" />
                  </div>
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        color: P.text,
                        fontFamily: FONT_DISPLAY,
                        fontSize: 18,
                      }}
                    >
                      Password
                    </h2>
                    <div
                      style={{
                        color: P.textFaint,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      Modifica la password del tuo account.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(2,minmax(0,1fr))',
                    gap: 10,
                  }}
                  className="password-grid"
                >
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.target.value)
                    }
                    placeholder="Nuova password"
                    style={inputStyle}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    placeholder="Conferma password"
                    style={inputStyle}
                  />
                </div>

                <button
                  onClick={updatePassword}
                  disabled={changingPassword}
                  style={{
                    marginTop: 10,
                    border: `1px solid ${P.gold}`,
                    background: P.goldGlow,
                    color: P.gold,
                    padding: '10px 13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {changingPassword
                    ? 'Aggiornamento...'
                    : 'Aggiorna password'}
                </button>
              </section>

              <section
                style={{
                  background: P.card,
                  border: `1px solid ${P.border}`,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      background: P.goldGlow,
                      color: P.gold,
                    }}
                  >
                    <Bell size={17} weight="fill" />
                  </div>

                  <div>
                    <h2
                      style={{
                        margin: 0,
                        color: P.text,
                        fontFamily: FONT_DISPLAY,
                        fontSize: 18,
                      }}
                    >
                      Notifiche
                    </h2>

                    <div
                      style={{
                        color: P.textFaint,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      Scegli quali aggiornamenti vuoi ricevere.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  {[
                    {
                      key: 'followers',
                      title: 'Nuovi follower',
                      subtitle:
                        'Ricevi una notifica quando qualcuno inizia a seguirti.',
                      checked: notifyNewFollower,
                      onChange: setNotifyNewFollower,
                    },
                    {
                      key: 'likes',
                      title: 'Like alle recensioni',
                      subtitle:
                        'Ricevi una notifica quando qualcuno mette like a una tua recensione.',
                      checked: notifyReviewLike,
                      onChange: setNotifyReviewLike,
                    },
                    {
                      key: 'comments',
                      title: 'Commenti alle recensioni',
                      subtitle:
                        'Ricevi una notifica quando qualcuno commenta una tua recensione.',
                      checked: notifyReviewComment,
                      onChange: setNotifyReviewComment,
                    },
                    {
                      key: 'reports',
                      title: 'Aggiornamenti segnalazioni',
                      subtitle:
                        'Ricevi una notifica quando una tua segnalazione viene risolta o archiviata.',
                      checked: notifyReportUpdates,
                      onChange: setNotifyReportUpdates,
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.bgSoft,
                        padding: '12px 13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: P.text,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {item.title}
                        </div>

                        <div
                          style={{
                            color: P.textFaint,
                            fontSize: 9,
                            lineHeight: 1.5,
                            marginTop: 3,
                          }}
                        >
                          {item.subtitle}
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) =>
                          item.onChange(event.target.checked)
                        }
                        style={{
                          width: 17,
                          height: 17,
                          accentColor: P.gold,
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void saveNotificationSettings()
                  }
                  disabled={savingNotifications}
                  style={{
                    width: '100%',
                    border: `1px solid ${P.gold}`,
                    background: P.goldGlow,
                    color: P.gold,
                    padding: '10px 13px',
                    marginTop: 12,
                    cursor: savingNotifications
                      ? 'wait'
                      : 'pointer',
                    opacity: savingNotifications ? 0.55 : 1,
                    fontFamily: FONT_SANS,
                    fontWeight: 800,
                    fontSize: 11,
                  }}
                >
                  {savingNotifications
                    ? 'Salvataggio...'
                    : 'Salva notifiche'}
                </button>
              </section>

              <section
                style={{
                  background: P.card,
                  border: `1px solid ${P.border}`,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      background: P.pinkGlow,
                      color: P.pink,
                    }}
                  >
                    <Prohibit size={17} weight="fill" />
                  </div>

                  <div>
                    <h2
                      style={{
                        margin: 0,
                        color: P.text,
                        fontFamily: FONT_DISPLAY,
                        fontSize: 18,
                      }}
                    >
                      Privacy e sicurezza
                    </h2>

                    <div
                      style={{
                        color: P.textFaint,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      Gestisci blocchi e interazioni con altri utenti.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {[
                    {
                      key: 'favorites',
                      title: 'Preferiti pubblici',
                      subtitle:
                        'Permetti agli altri utenti di vedere i film che hai aggiunto ai Preferiti.',
                      checked: favoritesPublic,
                      onChange: setFavoritesPublic,
                    },
                    {
                      key: 'watchlist',
                      title: 'Watchlist pubblica',
                      subtitle:
                        'Permetti agli altri utenti di vedere i film che vuoi guardare.',
                      checked: watchlistPublic,
                      onChange: setWatchlistPublic,
                    },
                    {
                      key: 'watched',
                      title: 'Film visti pubblici',
                      subtitle:
                        'Permetti agli altri utenti di vedere quali film hai segnato come visti.',
                      checked: watchedPublic,
                      onChange: setWatchedPublic,
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.bgSoft,
                        padding: '12px 13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: P.text,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {item.title}
                        </div>

                        <div
                          style={{
                            color: P.textFaint,
                            fontSize: 9,
                            lineHeight: 1.5,
                            marginTop: 3,
                          }}
                        >
                          {item.subtitle}
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) =>
                          item.onChange(event.target.checked)
                        }
                        style={{
                          width: 17,
                          height: 17,
                          accentColor: P.pink,
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void savePrivacy()}
                  disabled={savingPrivacy}
                  style={{
                    width: '100%',
                    border: `1px solid ${P.pink}`,
                    background: P.pinkGlow,
                    color: P.pink,
                    padding: '10px 13px',
                    marginBottom: 12,
                    cursor: savingPrivacy ? 'wait' : 'pointer',
                    opacity: savingPrivacy ? 0.55 : 1,
                    fontFamily: FONT_SANS,
                    fontWeight: 800,
                    fontSize: 11,
                  }}
                >
                  {savingPrivacy
                    ? 'Salvataggio...'
                    : 'Salva privacy'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push('/impostazioni/utenti-bloccati')
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${P.border}`,
                    background: P.bgSoft,
                    color: P.text,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    fontFamily: FONT_SANS,
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(239,68,68,.08)',
                        color: P.error,
                        flexShrink: 0,
                      }}
                    >
                      <Prohibit size={16} weight="bold" />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          marginBottom: 3,
                          color: P.text,
                        }}
                      >
                        Utenti bloccati
                      </div>

                      <div
                        style={{
                          color: P.textMuted,
                          fontSize: 10,
                          lineHeight: 1.5,
                        }}
                      >
                        Visualizza e gestisci gli account che hai bloccato.
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      color: P.textFaint,
                      fontSize: 20,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ›
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push('/impostazioni/segnalazioni')
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${P.border}`,
                    background: P.bgSoft,
                    color: P.text,
                    padding: '14px 16px',
                    marginTop: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    fontFamily: FONT_SANS,
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        display: 'grid',
                        placeItems: 'center',
                        background: P.pinkGlow,
                        color: P.pink,
                        flexShrink: 0,
                      }}
                    >
                      <Flag size={16} weight="fill" />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          marginBottom: 3,
                          color: P.text,
                        }}
                      >
                        Le mie segnalazioni
                      </div>

                      <div
                        style={{
                          color: P.textMuted,
                          fontSize: 10,
                          lineHeight: 1.5,
                        }}
                      >
                        Controlla lo stato delle segnalazioni inviate.
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      color: P.textFaint,
                      fontSize: 20,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ›
                  </span>
                </button>
              </section>

              {isAdmin && (
                <section
                  style={{
                    background: P.card,
                    border: `1px solid ${P.gold}35`,
                    padding: 22,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        display: 'grid',
                        placeItems: 'center',
                        background: P.goldGlow,
                        color: P.gold,
                      }}
                    >
                      <ShieldCheck size={17} weight="fill" />
                    </div>

                    <div>
                      <h2
                        style={{
                          margin: 0,
                          color: P.text,
                          fontFamily: FONT_DISPLAY,
                          fontSize: 18,
                        }}
                      >
                        Moderazione
                      </h2>

                      <div
                        style={{
                          color: P.textFaint,
                          fontSize: 10,
                          marginTop: 2,
                        }}
                      >
                        Strumenti riservati agli amministratori.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push('/admin/segnalazioni')
                    }
                    style={{
                      width: '100%',
                      border: `1px solid ${P.border}`,
                      background: P.bgSoft,
                      color: P.text,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontFamily: FONT_SANS,
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          display: 'grid',
                          placeItems: 'center',
                          background: P.goldGlow,
                          color: P.gold,
                          flexShrink: 0,
                        }}
                      >
                        <ShieldCheck size={16} weight="fill" />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            marginBottom: 3,
                            color: P.text,
                          }}
                        >
                          Gestisci segnalazioni
                        </div>

                        <div
                          style={{
                            color: P.textMuted,
                            fontSize: 10,
                            lineHeight: 1.5,
                          }}
                        >
                          Apri il pannello di moderazione della community.
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        color: P.textFaint,
                        fontSize: 20,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ›
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push('/admin/ricorsi')
                    }
                    style={{
                      width: '100%',
                      border: `1px solid ${P.border}`,
                      background: P.bgSoft,
                      color: P.text,
                      padding: '14px 16px',
                      marginTop: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontFamily: FONT_SANS,
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          display: 'grid',
                          placeItems: 'center',
                          background: P.goldGlow,
                          color: P.gold,
                          flexShrink: 0,
                        }}
                      >
                        <Gavel size={16} weight="fill" />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            marginBottom: 3,
                            color: P.text,
                          }}
                        >
                          Gestisci ricorsi
                        </div>

                        <div
                          style={{
                            color: P.textMuted,
                            fontSize: 10,
                            lineHeight: 1.5,
                          }}
                        >
                          Valuta i ricorsi contro le sospensioni.
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        color: P.textFaint,
                        fontSize: 20,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ›
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push('/admin/sospensioni')
                    }
                    style={{
                      width: '100%',
                      border: `1px solid ${P.border}`,
                      background: P.bgSoft,
                      color: P.text,
                      padding: '14px 16px',
                      marginTop: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontFamily: FONT_SANS,
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          display: 'grid',
                          placeItems: 'center',
                          background: 'rgba(239,68,68,.08)',
                          color: P.error,
                          flexShrink: 0,
                        }}
                      >
                        <WarningCircle size={16} weight="fill" />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            marginBottom: 3,
                            color: P.text,
                          }}
                        >
                          Gestisci sospensioni
                        </div>

                        <div
                          style={{
                            color: P.textMuted,
                            fontSize: 10,
                            lineHeight: 1.5,
                          }}
                        >
                          Visualizza le sospensioni attive e lo storico.
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        color: P.textFaint,
                        fontSize: 20,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ›
                    </span>
                  </button>
                </section>
              )}

              <section
                style={{
                  background: P.card,
                  border: `1px solid ${P.error}35`,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        color: P.text,
                        fontSize: 15,
                      }}
                    >
                      Sessione
                    </h2>
                    <p
                      style={{
                        color: P.textFaint,
                        fontSize: 11,
                        margin: '4px 0 0',
                      }}
                    >
                      Disconnettiti da CineDate su questo dispositivo.
                    </p>
                  </div>

                  <button
                    onClick={handleLogout}
                    style={{
                      background:
                        'rgba(239,68,68,.08)',
                      color: P.error,
                      border: `1px solid ${P.error}45`,
                      padding: '10px 14px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <SignOut size={17} weight="bold" />
                    Logout
                  </button>
                </div>
              </section>

              {(error || message) && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 14px',
                    color: error ? P.error : P.success,
                    background: error
                      ? 'rgba(239,68,68,.08)'
                      : 'rgba(34,197,94,.08)',
                    border: `1px solid ${
                      error ? P.error : P.success
                    }35`,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {error ? (
                    <Warning size={17} weight="fill" />
                  ) : (
                    <CheckCircle
                      size={17}
                      weight="fill"
                    />
                  )}
                  {error || message}
                </div>
              )}
            </div>
          )}
        </div>

        <style jsx global>{`
          @media (max-width: 720px) {
            .profile-settings-grid {
              grid-template-columns: 1fr !important;
            }

            .password-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}