'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/router';
import {
  ArrowRight,
  Bell,
  BookmarkSimple,
  Camera,
  Check,
  CheckCircle,
  Eye,
  FilmSlate,
  Flag,
  FloppyDisk,
  GearSix,
  Gavel,
  Heart,
  LockKey,
  Prohibit,
  ShieldCheck,
  SignOut,
  Trash,
  Sparkle,
  Star,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { FONT, THEME } from '@/styles/token';
import {
  moderateText,
  moderationMessage,
} from '@/utils/contentModeration';

type Tab = 'attivita' | 'impostazioni';

function getPasswordChecks(password: string) {
  return [
    {
      label: '8+ caratteri',
      ok: password.length >= 8,
    },
    {
      label: 'Maiuscola',
      ok: /[A-Z]/.test(password),
    },
    {
      label: 'Minuscola',
      ok: /[a-z]/.test(password),
    },
    {
      label: 'Numero',
      ok: /[0-9]/.test(password),
    },
    {
      label: 'Simbolo',
      ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(
        password
      ),
    },
  ];
}

function isPasswordValid(password: string) {
  return getPasswordChecks(password).every(
    (check) => check.ok
  );
}


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
  'Azione',
  'Avventura',
  'Animazione',
  'Commedia',
  'Crime',
  'Documentario',
  'Dramma',
  'Famiglia',
  'Fantasy',
  'Guerra',
  'Horror',
  'Mistero',
  'Musica',
  'Romance',
  'Fantascienza',
  'Thriller',
  'Storia',
  'Western',
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

function SafeAvatar({
  src,
  initial,
  color,
  size,
}: {
  src: string | null;
  initial: string;
  color: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div
      className="cdr-profile-avatar"
      style={{
        width: size,
        height: size,
        background: src && !failed ? 'var(--cdr-profile-border)' : color,
      }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt="Avatar profilo"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </div>
  );
}

export default function ProfiloPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading, signOut } = useAuth();
  const supabase = useRef(createBrowserClient()).current;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { theme } = useTheme();
  const P = theme === 'dark' ? THEME.dark : THEME.light;

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

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authProvider, setAuthProvider] = useState<string>('email');

  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  const [deleteConfirmation, setDeleteConfirmation] =
    useState('');
  const [deletePassword, setDeletePassword] =
    useState('');
  const [deleteAccountOpen, setDeleteAccountOpen] =
    useState(false);
  const [deletingAccount, setDeletingAccount] =
    useState(false);

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
    if (!currentUser || isGuest) void router.replace('/auth');
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

        setAuthProvider(
          typeof user?.app_metadata?.provider === 'string'
            ? user.app_metadata.provider
            : 'email'
        );

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

      setFavoritesPublic(data?.favorites_visibility === 'public');
      setWatchlistPublic(data?.watchlist_visibility === 'public');
      setWatchedPublic(data?.watched_visibility === 'public');
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

        setNotifyNewFollower(data?.notify_new_follower ?? true);
        setNotifyReviewLike(data?.notify_review_like ?? true);
        setNotifyReviewComment(data?.notify_review_comment ?? true);
        setNotifyReportUpdates(data?.notify_report_updates ?? true);
      } catch (err) {
        console.error('Notification settings load failed:', err);
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

    const usernameModeration = moderateText(
      cleanUsername,
      'username'
    );

    if (!usernameModeration.allowed) {
      setError(
        moderationMessage(
          usernameModeration,
          'username'
        )
      );
      return;
    }

    const bioModeration = moderateText(
      bio,
      'bio'
    );

    if (!bioModeration.allowed) {
      setError(
        moderationMessage(
          bioModeration,
          'bio'
        )
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        throw new Error('Sessione non disponibile.');
      }

      const response = await fetch(
        '/api/profile/update',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            username: cleanUsername,
            bio: bio.trim(),
            favorite_genres: favoriteGenres,
            avatar_url: avatarUrl,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossibile salvare il profilo.'
        );
      }

      setUsername(cleanUsername);
      setMessage('Profilo salvato.');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Errore durante il salvataggio'
      );
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
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id);

      if (saveError) throw saveError;

      setAvatarUrl(publicUrl);
      setMessage('Avatar aggiornato.');
    } catch (err: any) {
      setError(err.message ?? 'Errore durante upload avatar');
    } finally {
      setUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const updateEmail = async () => {
    if (
      !currentUser ||
      currentUser.isGuest
    ) {
      return;
    }

    if (authProvider !== 'email') {
      setError(
        'L’email di questo account è gestita dal provider di accesso.'
      );
      return;
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanConfirmEmail =
      confirmEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanConfirmEmail) {
      setError(
        'Inserisci e conferma la nuova email.'
      );
      return;
    }

    if (cleanEmail !== cleanConfirmEmail) {
      setError(
        'Le nuove email non coincidono.'
      );
      return;
    }

    if (
      email &&
      cleanEmail === email.trim().toLowerCase()
    ) {
      setError(
        'La nuova email è uguale a quella attuale.'
      );
      return;
    }

    if (!emailPassword) {
      setError(
        'Inserisci la password attuale per confermare il cambio email.'
      );
      return;
    }

    setChangingEmail(true);
    setError('');
    setMessage('');

    try {
      if (!email) {
        throw new Error(
          'Email account non disponibile.'
        );
      }

      /*
       * Prima verifichiamo davvero la password attuale.
       * In questo modo una sessione lasciata aperta non basta
       * per cambiare l'indirizzo dell'account.
       */
      const { error: reauthError } =
        await supabase.auth.signInWithPassword({
          email,
          password: emailPassword,
        });

      if (reauthError) {
        throw new Error(
          'La password attuale non è corretta.'
        );
      }

      const { error: emailError } =
        await supabase.auth.updateUser(
          {
            email: cleanEmail,
          },
          {
            emailRedirectTo:
              `${window.location.origin}/auth/callback`,
          }
        );

      if (emailError) {
        throw emailError;
      }

      setNewEmail('');
      setConfirmEmail('');
      setEmailPassword('');

      setMessage(
        'Richiesta inviata. Controlla la nuova email e conferma il cambio.'
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile cambiare email.'
      );
    } finally {
      setChangingEmail(false);
    }
  };

  const updatePassword = async () => {
    const passwordChecks =
      getPasswordChecks(newPassword);

    if (
      authProvider === 'email' &&
      !currentPassword
    ) {
      setError(
        'Inserisci la password attuale.'
      );
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError(
        'Compila la nuova password e la conferma.'
      );
      return;
    }

    if (
      !passwordChecks.every(
        (check) => check.ok
      )
    ) {
      setError(
        'La nuova password non soddisfa tutti i requisiti.'
      );
      return;
    }

    if (
      authProvider === 'email' &&
      currentPassword === newPassword
    ) {
      setError(
        'La nuova password deve essere diversa da quella attuale.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        'Le password non coincidono.'
      );
      return;
    }

    setChangingPassword(true);
    setError('');
    setMessage('');

    try {
      /*
       * Per gli account email richiediamo una verifica reale
       * della password attuale prima di consentire il cambio.
       * Per gli account OAuth, invece, Supabase permette di
       * impostare una password Cinedate senza avere una
       * precedente password locale.
       */
      if (authProvider === 'email') {
        if (!email) {
          throw new Error(
            'Email account non disponibile.'
          );
        }

        const { error: reauthError } =
          await supabase.auth.signInWithPassword({
            email,
            password: currentPassword,
          });

        if (reauthError) {
          throw new Error(
            'La password attuale non è corretta.'
          );
        }
      }

      const { error: passwordError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (passwordError) {
        throw passwordError;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setMessage(
        authProvider === 'email'
          ? 'Password aggiornata.'
          : 'Password Cinedate impostata. Ora puoi accedere anche con email e password.'
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Errore durante il cambio password'
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
          { onConflict: 'user_id' }
        );

      if (settingsError) throw settingsError;

      setMessage('Preferenze notifiche salvate.');
    } catch (err: unknown) {
      console.error('Notification settings save failed:', err);
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
          { onConflict: 'user_id' }
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

  const deleteAccount = async () => {
    if (
      !currentUser ||
      currentUser.isGuest ||
      deletingAccount
    ) {
      return;
    }

    const cleanConfirmation =
      deleteConfirmation.trim().toLowerCase();

    if (
      cleanConfirmation !==
      username.trim().toLowerCase()
    ) {
      setError(
        'Scrivi esattamente il tuo username per confermare.'
      );
      return;
    }

    if (
      authProvider === 'email' &&
      !deletePassword
    ) {
      setError(
        'Inserisci la password attuale per confermare.'
      );
      return;
    }

    setDeletingAccount(true);
    setError('');
    setMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        throw new Error(
          'Sessione non disponibile.'
        );
      }

      const response = await fetch(
        '/api/account/delete',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            confirmation: cleanConfirmation,
            password:
              authProvider === 'email'
                ? deletePassword
                : undefined,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossibile eliminare l’account.'
        );
      }

      try {
        window.localStorage.removeItem(
          `cinedate:onboarding:${currentUser.id}`
        );
      } catch {
        // L'account è già stato eliminato.
      }

      await supabase.auth.signOut();

      window.location.href = '/';
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile eliminare l’account.'
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const openMovie = (entry: MovieEntryRow) => {
    const movie = getCatalogMovie(entry);

    if (movie?.provider === 'tmdb') {
      void router.push(`/film/${movie.provider_movie_id}`);
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
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: P.bg,
        }}
      >
        <FilmSlate size={42} color={P.primary} weight="duotone" />
      </div>
    );
  }

  const vars = {
    '--cdr-profile-bg': P.bg,
    '--cdr-profile-soft': P.bgSoft,
    '--cdr-profile-surface': P.surface,
    '--cdr-profile-hover': P.surfaceHover,
    '--cdr-profile-border': P.border,
    '--cdr-profile-text': P.text,
    '--cdr-profile-muted': P.textMuted,
    '--cdr-profile-faint': P.textFaint,
    '--cdr-profile-pink': P.primary,
    '--cdr-profile-pink-glow': P.primaryGlow,
    '--cdr-profile-gold': P.accent,
    '--cdr-profile-gold-glow': P.accentGlow,
  } as CSSProperties;

  const activitySections = [
    {
      key: 'favorites',
      libraryTab: 'preferiti',
      title: 'Preferiti',
      subtitle: 'I film che ami di più',
      icon: Heart,
      color: P.primary,
      background: P.primaryGlow,
      items: favorites,
      empty: 'Non hai ancora film preferiti.',
    },
    {
      key: 'watchlist',
      libraryTab: 'watchlist',
      title: 'Watchlist',
      subtitle: 'I prossimi film da vedere',
      icon: BookmarkSimple,
      color: P.accent,
      background: P.accentGlow,
      items: watchlist,
      empty: 'La tua watchlist è ancora vuota.',
    },
    {
      key: 'watched',
      libraryTab: 'visti',
      title: 'Visti',
      subtitle: 'I film che hai già guardato',
      icon: Eye,
      color: '#22c55e',
      background: 'rgba(34,197,94,.10)',
      items: watched,
      empty: 'Non hai ancora segnato film come visti.',
    },
    {
      key: 'reviews',
      libraryTab: 'recensioni',
      title: 'Voti e recensioni',
      subtitle: 'Le tue opinioni sui film',
      icon: Star,
      color: P.accent,
      background: P.accentGlow,
      items: reviewed,
      empty: 'Non hai ancora votato o recensito film.',
    },
  ];

  return (
    <AppShell activeNav="profilo">
      <main className="cdr-profile" style={vars}>
        <style>{`
          .cdr-profile {
            width:100%;
            min-height:100dvh;
            overflow-x:hidden;
            background:var(--cdr-profile-bg);
            color:var(--cdr-profile-text);
            font-family:${FONT.sans};
          }

          .cdr-profile * { box-sizing:border-box; }

          .cdr-profile-shell {
            width:min(100%,1040px);
            margin:0 auto;
            padding:22px 24px 56px;
          }

          .cdr-profile-hero {
            display:grid;
            grid-template-columns:auto minmax(0,1fr) auto;
            gap:16px;
            align-items:center;
            margin-bottom:18px;
          }

          .cdr-profile-avatar {
            overflow:hidden;
            flex:0 0 auto;
            border-radius:50%;
            display:grid;
            place-items:center;
            color:#fff;
            font-weight:900;
            font-size:22px;
          }

          .cdr-profile-avatar img {
            width:100%;
            height:100%;
            display:block;
            object-fit:cover;
          }

          .cdr-profile-kicker {
            color:var(--cdr-profile-pink);
            font-size:12px;
            font-weight:850;
            letter-spacing:.1em;
            text-transform:uppercase;
          }

          .cdr-profile-name {
            margin:3px 0 0;
            font-family:${FONT.display};
            font-size:38px;
            line-height:1;
            letter-spacing:-.025em;
          }

          .cdr-profile-bio {
            max-width:620px;
            margin:7px 0 0;
            color:var(--cdr-profile-muted);
            font-size:15px;
            line-height:1.55;
          }

          .cdr-profile-perte {
            min-height:38px;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:6px;
            padding:7px 10px;
            border:1px solid var(--cdr-profile-gold);
            background:var(--cdr-profile-gold-glow);
            color:var(--cdr-profile-gold);
            font-size:13px;
            font-weight:850;
            cursor:pointer;
          }

          .cdr-profile-overview {
            display:grid;
            grid-template-columns:1.25fr repeat(4,minmax(0,.65fr));
            gap:7px;
            margin-bottom:16px;
          }

          .cdr-profile-overview-main,
          .cdr-profile-stat {
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-surface);
          }

          .cdr-profile-overview-main {
            padding:14px;
          }

          .cdr-profile-overview-main strong {
            display:block;
            font-family:${FONT.display};
            font-size:23px;
          }

          .cdr-profile-overview-main span {
            display:block;
            margin-top:4px;
            color:var(--cdr-profile-muted);
            font-size:12px;
            line-height:1.5;
          }

          .cdr-profile-stat {
            min-height:76px;
            padding:11px;
            text-align:left;
            cursor:pointer;
          }

          .cdr-profile-stat b {
            display:block;
            font-size:24px;
            line-height:1;
          }

          .cdr-profile-stat span {
            display:block;
            margin-top:6px;
            color:var(--cdr-profile-muted);
            font-size:12px;
            font-weight:800;
          }

          .cdr-profile-tabs {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:0;
            margin-bottom:16px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
          }

          .cdr-profile-tabs button {
            min-height:42px;
            display:flex;
            align-items:center;
            justify-content:center;
            gap:6px;
            border:0;
            background:transparent;
            color:var(--cdr-profile-muted);
            font-size:13px;
            font-weight:850;
            cursor:pointer;
          }

          .cdr-profile-tabs button.active {
            background:var(--cdr-profile-surface);
            color:var(--cdr-profile-text);
          }

          .cdr-profile-stack {
            display:grid;
            gap:12px;
          }

          .cdr-profile-card {
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-surface);
            padding:16px;
          }

          .cdr-profile-card.gold {
            border-top:3px solid var(--cdr-profile-gold);
          }

          .cdr-profile-card-head {
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:12px;
            margin-bottom:12px;
          }

          .cdr-profile-card-kicker {
            display:flex;
            align-items:center;
            gap:6px;
            color:var(--cdr-profile-gold);
            font-size:11px;
            font-weight:850;
            letter-spacing:.08em;
            text-transform:uppercase;
          }

          .cdr-profile-card-title {
            margin:4px 0 0;
            font-family:${FONT.display};
            font-size:26px;
          }

          .cdr-profile-card-copy {
            margin:5px 0 0;
            color:var(--cdr-profile-muted);
            font-size:13px;
            line-height:1.55;
          }

          .cdr-profile-summary-grid {
            display:grid;
            grid-template-columns:repeat(4,minmax(0,1fr));
            gap:7px;
          }

          .cdr-profile-summary {
            min-height:70px;
            display:grid;
            grid-template-columns:34px minmax(0,1fr) auto;
            align-items:center;
            gap:8px;
            padding:9px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
            color:var(--cdr-profile-text);
            text-align:left;
            cursor:pointer;
          }

          .cdr-profile-summary-icon {
            width:34px;
            height:34px;
            display:grid;
            place-items:center;
          }

          .cdr-profile-summary strong {
            display:block;
            font-size:13px;
          }

          .cdr-profile-summary span {
            display:block;
            margin-top:2px;
            color:var(--cdr-profile-faint);
            font-size:11px;
          }

          .cdr-profile-summary b {
            font-size:18px;
          }

          .cdr-profile-taste-stats {
            display:grid;
            grid-template-columns:repeat(4,minmax(0,1fr));
            gap:7px;
            margin-top:12px;
          }

          .cdr-profile-taste-stat {
            padding:10px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
          }

          .cdr-profile-taste-stat b {
            display:block;
            font-size:20px;
          }

          .cdr-profile-taste-stat span {
            display:block;
            margin-top:3px;
            color:var(--cdr-profile-faint);
            font-size:11px;
          }

          .cdr-profile-taste-grid {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:8px;
            margin-top:10px;
          }

          .cdr-profile-taste-box {
            padding:10px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
          }

          .cdr-profile-taste-box strong {
            display:block;
            margin-bottom:6px;
            color:var(--cdr-profile-muted);
            font-size:10px;
            text-transform:uppercase;
            letter-spacing:.07em;
          }

          .cdr-profile-taste-list {
            display:flex;
            flex-wrap:wrap;
            gap:5px;
          }

          .cdr-profile-taste-list span {
            border:1px solid var(--cdr-profile-border);
            padding:4px 6px;
            color:var(--cdr-profile-text);
            font-size:11px;
          }

          .cdr-profile-rec-preview {
            display:grid;
            grid-template-columns:repeat(3,minmax(0,1fr));
            gap:7px;
            margin-top:10px;
          }

          .cdr-profile-rec {
            padding:9px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
          }

          .cdr-profile-rec strong {
            display:block;
            font-size:13px;
          }

          .cdr-profile-rec span {
            display:block;
            margin-top:4px;
            color:var(--cdr-profile-muted);
            font-size:11px;
            line-height:1.45;
          }

          .cdr-profile-library {
            display:grid;
            gap:10px;
          }

          .cdr-profile-library-head {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
          }

          .cdr-profile-library-title {
            display:flex;
            align-items:center;
            gap:8px;
          }

          .cdr-profile-library-title h2 {
            margin:0;
            font-family:${FONT.display};
            font-size:18px;
          }

          .cdr-profile-library-title span {
            display:block;
            margin-top:2px;
            color:var(--cdr-profile-faint);
            font-size:8px;
          }

          .cdr-profile-link {
            border:0;
            background:transparent;
            color:var(--cdr-profile-gold);
            font-size:12px;
            font-weight:850;
            cursor:pointer;
          }

          .cdr-profile-movies {
            display:flex;
            gap:10px;
            overflow-x:auto;
            padding-bottom:4px;
          }

          .cdr-profile-movie {
            width:112px;
            min-width:112px;
            padding:0;
            border:0;
            background:transparent;
            color:var(--cdr-profile-text);
            text-align:left;
            cursor:pointer;
          }

          .cdr-profile-movie-poster {
            width:112px;
            aspect-ratio:2/3;
            overflow:hidden;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
            position:relative;
          }

          .cdr-profile-movie-poster img {
            width:100%;
            height:100%;
            object-fit:cover;
          }

          .cdr-profile-rating {
            position:absolute;
            left:5px;
            bottom:5px;
            padding:3px 5px;
            background:rgba(0,0,0,.78);
            color:var(--cdr-profile-gold);
            font-size:11px;
            font-weight:850;
          }

          .cdr-profile-movie strong {
            display:block;
            margin-top:5px;
            overflow:hidden;
            font-size:9px;
            text-overflow:ellipsis;
            white-space:nowrap;
          }

          .cdr-profile-movie span {
            display:block;
            margin-top:2px;
            overflow:hidden;
            color:var(--cdr-profile-faint);
            font-size:7.5px;
            text-overflow:ellipsis;
            white-space:nowrap;
          }

          .cdr-profile-empty {
            min-height:84px;
            display:grid;
            place-items:center;
            padding:12px;
            border:1px dashed var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
            color:var(--cdr-profile-faint);
            text-align:center;
            font-size:12px;
          }

          .cdr-profile-settings-grid {
            display:grid;
            grid-template-columns:190px minmax(0,1fr);
            gap:18px;
          }

          .cdr-profile-avatar-pane {
            display:flex;
            flex-direction:column;
            align-items:center;
            gap:10px;
          }

          .cdr-profile-field {
            display:grid;
            gap:5px;
          }

          .cdr-profile-field label,
          .cdr-profile-label {
            color:var(--cdr-profile-muted);
            font-size:11px;
            font-weight:850;
            text-transform:uppercase;
            letter-spacing:.06em;
          }

          .cdr-profile-input,
          .cdr-profile-textarea {
            width:100%;
            padding:10px 11px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
            color:var(--cdr-profile-text);
            outline:0;
            font:inherit;
            font-size:14px;
          }

          .cdr-profile-textarea {
            min-height:95px;
            resize:vertical;
            line-height:1.5;
          }

          .cdr-profile-fields {
            display:grid;
            gap:10px;
          }

          .cdr-profile-genres {
            display:grid;
            grid-template-columns:repeat(4,minmax(0,1fr));
            gap:8px;
          }

          .cdr-profile-genre {
            min-height:48px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
            padding:10px 12px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-surface);
            color:var(--cdr-profile-muted);
            font-size:13px;
            font-weight:800;
            text-transform:capitalize;
            cursor:pointer;
            transition:border-color .16s ease, background .16s ease, color .16s ease;
          }

          .cdr-profile-genre:hover {
            border-color:var(--cdr-profile-pink);
            color:var(--cdr-profile-text);
          }

          .cdr-profile-genre.selected {
            border-color:var(--cdr-profile-pink);
            background:var(--cdr-profile-pink-glow);
            color:var(--cdr-profile-pink);
          }

          .cdr-profile-genre-check {
            width:20px;
            height:20px;
            flex:0 0 auto;
            display:grid;
            place-items:center;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
          }

          .cdr-profile-genre.selected .cdr-profile-genre-check {
            border-color:var(--cdr-profile-pink);
            background:var(--cdr-profile-pink);
            color:#fff;
          }

          .cdr-profile-action {
            min-height:36px;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:6px;
            padding:6px 10px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-surface);
            color:var(--cdr-profile-text);
            font-size:12px;
            font-weight:850;
            cursor:pointer;
          }

          .cdr-profile-action.primary {
            border-color:var(--cdr-profile-pink);
            background:var(--cdr-profile-pink);
            color:#fff;
          }

          .cdr-profile-action.gold {
            border-color:var(--cdr-profile-gold);
            background:var(--cdr-profile-gold-glow);
            color:var(--cdr-profile-gold);
          }

          .cdr-profile-action.danger {
            border-color:rgba(239,68,68,.4);
            background:rgba(239,68,68,.08);
            color:#ef4444;
          }

          .cdr-profile-password-grid {
            display:grid;
            grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
            gap:7px;
            align-items:start;
          }

          .cdr-profile-password-checks {
            grid-column:1 / -1;
            display:flex;
            gap:8px 12px;
            flex-wrap:wrap;
            margin-top:2px;
            color:var(--cdr-profile-faint);
            font-size:10px;
          }

          .cdr-profile-password-checks span.ok {
            color:var(--cdr-profile-gold);
          }

          .cdr-profile-toggle-list {
            display:grid;
            gap:6px;
          }

          .cdr-profile-toggle {
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:12px;
            align-items:center;
            padding:9px 10px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
          }

          .cdr-profile-toggle strong {
            display:block;
            font-size:13px;
          }

          .cdr-profile-toggle span {
            display:block;
            margin-top:2px;
            color:var(--cdr-profile-faint);
            font-size:11px;
            line-height:1.45;
          }

          .cdr-profile-toggle input {
            width:17px;
            height:17px;
            accent-color:var(--cdr-profile-pink);
          }

          .cdr-profile-setting-links {
            display:grid;
            gap:6px;
            margin-top:8px;
          }

          .cdr-profile-setting-link {
            width:100%;
            display:grid;
            grid-template-columns:32px minmax(0,1fr) auto;
            gap:9px;
            align-items:center;
            padding:9px;
            border:1px solid var(--cdr-profile-border);
            background:var(--cdr-profile-soft);
            color:var(--cdr-profile-text);
            text-align:left;
            cursor:pointer;
          }

          .cdr-profile-setting-link-icon {
            width:32px;
            height:32px;
            display:grid;
            place-items:center;
            background:var(--cdr-profile-pink-glow);
            color:var(--cdr-profile-pink);
          }

          .cdr-profile-setting-link strong {
            display:block;
            font-size:13px;
          }

          .cdr-profile-setting-link span {
            display:block;
            margin-top:2px;
            color:var(--cdr-profile-faint);
            font-size:11px;
          }

          .cdr-profile-status {
            padding:9px 10px;
            border:1px solid;
            font-size:12px;
            font-weight:750;
          }

          .cdr-profile-status.error {
            border-color:rgba(239,68,68,.32);
            background:rgba(239,68,68,.07);
            color:#ef4444;
          }

          .cdr-profile-status.success {
            border-color:rgba(34,197,94,.32);
            background:rgba(34,197,94,.07);
            color:#22c55e;
          }

          @media (max-width:900px) {
            .cdr-profile-genres {
              grid-template-columns:repeat(3,minmax(0,1fr));
            }

            .cdr-profile-overview {
              grid-template-columns:repeat(4,minmax(0,1fr));
            }
            .cdr-profile-overview-main {
              grid-column:1 / -1;
            }
            .cdr-profile-summary-grid {
              grid-template-columns:repeat(2,minmax(0,1fr));
            }
          }

          @media (max-width:720px) {
            .cdr-profile-shell {
              padding:12px 10px 78px;
            }

            .cdr-profile-hero {
              grid-template-columns:auto minmax(0,1fr);
            }

            .cdr-profile-perte {
              grid-column:1 / -1;
              width:100%;
            }

            .cdr-profile-overview {
              grid-template-columns:repeat(2,minmax(0,1fr));
            }

            .cdr-profile-settings-grid,
            .cdr-profile-password-grid,
            .cdr-profile-taste-grid,
            .cdr-profile-rec-preview {
              grid-template-columns:1fr;
            }

            .cdr-profile-genres {
              grid-template-columns:repeat(2,minmax(0,1fr));
            }

            .cdr-profile-summary-grid,
            .cdr-profile-taste-stats {
              grid-template-columns:repeat(2,minmax(0,1fr));
            }
          }

          @media (max-width:460px) {
            .cdr-profile-shell {
              padding-inline:8px;
            }

            .cdr-profile-name {
              font-size:29px;
            }

            .cdr-profile-bio {
              font-size:10px;
            }

            .cdr-profile-overview-main {
              padding:11px;
            }

            .cdr-profile-stat {
              min-height:66px;
              padding:9px;
            }

            .cdr-profile-stat b {
              font-size:21px;
            }

            .cdr-profile-card {
              padding:11px;
            }

            .cdr-profile-summary {
              grid-template-columns:30px minmax(0,1fr) auto;
              min-height:62px;
              padding:8px;
            }

            .cdr-profile-movie,
            .cdr-profile-movie-poster {
              width:100px;
              min-width:100px;
            }
          }
        `}</style>

        <div className="cdr-profile-shell">
          <header className="cdr-profile-hero">
            <SafeAvatar
              src={visibleAvatarUrl}
              initial={fallbackInitial}
              color={fallbackColor}
              size={62}
            />

            <div>
              <div className="cdr-profile-kicker">Il tuo profilo</div>
              <h1 className="cdr-profile-name">
                @{username || 'utente'}
              </h1>
              <p className="cdr-profile-bio">
                {bio.trim() ||
                  'Costruisci il tuo profilo cinematografico attraverso preferiti, voti, match e recensioni.'}
              </p>
            </div>

            <button
              type="button"
              className="cdr-profile-perte"
              onClick={() => router.push('/per-te')}
            >
              <Sparkle size={13} weight="fill" />
              I tuoi consigli
            </button>
          </header>

          <section className="cdr-profile-overview">
            <div className="cdr-profile-overview-main">
              <strong>La tua CineDate in breve</strong>
              <span>
                Tutto quello che hai salvato, visto e raccontato finora.
              </span>
            </div>

            {[
              ['Preferiti', favorites.length, P.primary, 'preferiti'],
              ['Watchlist', watchlist.length, P.accent, 'watchlist'],
              ['Visti', watched.length, '#22c55e', 'visti'],
              ['Recensioni', reviewed.length, P.accent, 'recensioni'],
            ].map(([label, value, color, tab]) => (
              <button
                type="button"
                key={String(label)}
                className="cdr-profile-stat"
                onClick={() =>
                  router.push(`/libreria?tab=${String(tab)}`)
                }
              >
                <b style={{ color: String(color) }}>{String(value)}</b>
                <span>{String(label)}</span>
              </button>
            ))}
          </section>

          <nav className="cdr-profile-tabs">
            <button
              type="button"
              className={activeTab === 'attivita' ? 'active' : ''}
              onClick={() => setActiveTab('attivita')}
            >
              <FilmSlate
                size={15}
                weight="fill"
                color={
                  activeTab === 'attivita' ? P.accent : P.textMuted
                }
              />
              Attività
            </button>

            <button
              type="button"
              className={activeTab === 'impostazioni' ? 'active' : ''}
              onClick={() => setActiveTab('impostazioni')}
            >
              <GearSix
                size={15}
                weight="fill"
                color={
                  activeTab === 'impostazioni'
                    ? P.primary
                    : P.textMuted
                }
              />
              Impostazioni
            </button>
          </nav>

          {activeTab === 'attivita' && (
            <div className="cdr-profile-stack">

              <section className="cdr-profile-card">
                <div className="cdr-profile-card-head">
                  <div>
                    <div className="cdr-profile-card-kicker">
                      Profilo pubblico
                    </div>
                    <h2 className="cdr-profile-card-title">
                      Identità su Cinedate
                    </h2>
                    <p className="cdr-profile-card-copy">
                      Avatar, username, bio e generi preferiti che gli altri utenti vedono.
                    </p>
                  </div>
                </div>

                <div className="cdr-profile-settings-grid">
                  <aside className="cdr-profile-avatar-pane">
                    <SafeAvatar
                      src={visibleAvatarUrl}
                      initial={fallbackInitial}
                      color={fallbackColor}
                      size={122}
                    />

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={uploadAvatar}
                      style={{ display: 'none' }}
                    />

                    <button
                      type="button"
                      className="cdr-profile-action"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Camera size={14} weight="bold" />
                      {uploading ? 'Upload...' : 'Cambia avatar'}
                    </button>
                  </aside>

                  <div className="cdr-profile-fields">
                    <div className="cdr-profile-field">
                      <label>Username</label>
                      <input
                        className="cdr-profile-input"
                        value={username}
                        onChange={(event) => {
                          setUsername(
                            normalizeUsername(event.target.value)
                          );
                          setMessage('');
                          setError('');
                        }}
                      />
                    </div>

                    <div className="cdr-profile-field">
                      <label>Email</label>
                      <input
                        className="cdr-profile-input"
                        value={email}
                        disabled
                      />
                    </div>

                    <div className="cdr-profile-field">
                      <label>Bio</label>
                      <textarea
                        className="cdr-profile-textarea"
                        value={bio}
                        maxLength={220}
                        onChange={(event) =>
                          setBio(event.target.value.slice(0, 220))
                        }
                      />
                    </div>

                    <div className="cdr-profile-field">
                      <div className="cdr-profile-label">
                        Generi preferiti
                      </div>
                      <div className="cdr-profile-genres">
                        {GENRES.map((genre) => {
                          const selected =
                            favoriteGenres.includes(genre);

                          return (
                            <button
                              type="button"
                              key={genre}
                              className={`cdr-profile-genre ${
                                selected ? 'selected' : ''
                              }`}
                              onClick={() => toggleGenre(genre)}
                            >
                              <span>{genre}</span>
                              <span className="cdr-profile-genre-check">
                                {selected && (
                                  <Check size={11} weight="bold" />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cdr-profile-action primary"
                      onClick={saveProfile}
                      disabled={saving || uploading}
                    >
                      <FloppyDisk size={14} weight="bold" />
                      {saving ? 'Salvataggio...' : 'Salva modifiche'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="cdr-profile-card gold">
                <div className="cdr-profile-card-head">
                  <div>
                    <div className="cdr-profile-card-kicker">
                      <Sparkle size={13} weight="fill" />
                      I tuoi gusti
                    </div>
                    <h2 className="cdr-profile-card-title">
                      Il tuo profilo cinematografico
                    </h2>
                    <p className="cdr-profile-card-copy">
                      Cinedate usa preferiti, voti, match, swipe e film
                      scelti nelle stanze per capire cosa proporti.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="cdr-profile-action gold"
                    onClick={() => router.push('/per-te')}
                  >
                    Vedi Per te
                    <ArrowRight size={11} />
                  </button>
                </div>

                {tasteLoading ? (
                  <div className="cdr-profile-empty">
                    Sto leggendo i tuoi gusti...
                  </div>
                ) : tasteMeta ? (
                  <>
                    <div className="cdr-profile-taste-stats">
                      {[
                        [
                          'Segnali forti',
                          tasteMeta.seeds_used,
                          P.primary,
                        ],
                        [
                          'Generi capiti',
                          tasteMeta.taste_genres ?? 0,
                          P.accent,
                        ],
                        [
                          'Attori ricorrenti',
                          tasteMeta.taste_actors ?? 0,
                          '#22c55e',
                        ],
                        [
                          'Film considerati',
                          tasteMeta.excluded_movies,
                          P.textMuted,
                        ],
                      ].map(([label, value, color]) => (
                        <div
                          key={String(label)}
                          className="cdr-profile-taste-stat"
                        >
                          <b style={{ color: String(color) }}>
                            {String(value)}
                          </b>
                          <span>{String(label)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="cdr-profile-taste-grid">
                      <div className="cdr-profile-taste-box">
                        <strong>Generi che tornano di più</strong>
                        <div className="cdr-profile-taste-list">
                          {(tasteMeta.top_genres ?? [])
                            .slice(0, 5)
                            .map((genre) => (
                              <span key={genre.id}>{genre.name}</span>
                            ))}
                          {(tasteMeta.top_genres?.length ?? 0) === 0 && (
                            <span>Ancora pochi segnali</span>
                          )}
                        </div>
                      </div>

                      <div className="cdr-profile-taste-box">
                        <strong>Attori ricorrenti</strong>
                        <div className="cdr-profile-taste-list">
                          {(tasteMeta.top_actors ?? [])
                            .slice(0, 5)
                            .map((actor) => (
                              <span key={actor.id}>{actor.name}</span>
                            ))}
                          {(tasteMeta.top_actors?.length ?? 0) === 0 && (
                            <span>Ancora pochi segnali</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {tastePreview.length > 0 && (
                      <div className="cdr-profile-rec-preview">
                        {tastePreview.map((item) => (
                          <button
                            type="button"
                            key={item.tmdb_id}
                            className="cdr-profile-rec"
                            onClick={() =>
                              router.push(`/film/${item.tmdb_id}`)
                            }
                            style={{
                              color: P.text,
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <strong>{item.title}</strong>
                            <span>{item.reason}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="cdr-profile-empty">
                    Aggiungi preferiti, voti e film visti per costruire
                    il tuo profilo cinematografico.
                  </div>
                )}
              </section>

              <section className="cdr-profile-card">
                <div className="cdr-profile-summary-grid">
                  {activitySections.map((section) => {
                    const Icon = section.icon;

                    return (
                      <button
                        type="button"
                        key={`summary-${section.key}`}
                        className="cdr-profile-summary"
                        onClick={() =>
                          router.push(
                            `/libreria?tab=${section.libraryTab}`
                          )
                        }
                      >
                        <div
                          className="cdr-profile-summary-icon"
                          style={{
                            color: section.color,
                            background: section.background,
                          }}
                        >
                          <Icon size={16} weight="fill" />
                        </div>

                        <div>
                          <strong>{section.title}</strong>
                          <span>{section.subtitle}</span>
                        </div>

                        <b style={{ color: section.color }}>
                          {section.items.length}
                        </b>
                      </button>
                    );
                  })}
                </div>
              </section>

              {movieEntriesLoading && (
                <div className="cdr-profile-empty">
                  Caricamento attività...
                </div>
              )}
            </div>
          )}

          {activeTab === 'impostazioni' && (
            <div className="cdr-profile-stack">
              <section className="cdr-profile-card">
                <div className="cdr-profile-card-head">
                  <div>
                    <div className="cdr-profile-card-kicker">
                      <LockKey size={12} weight="fill" />
                      Account
                    </div>
                    <h2 className="cdr-profile-card-title">
                      Email
                    </h2>
                    <p className="cdr-profile-card-copy">
                      {authProvider === 'email'
                        ? 'Cambia l’indirizzo usato per accedere a Cinedate.'
                        : `L’accesso è collegato a ${authProvider}. L’email principale è gestita dal provider.`}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    border: `1px solid ${P.border}`,
                    background: P.bgSoft,
                    padding: '10px 11px',
                    marginBottom: 9,
                  }}
                >
                  <div
                    style={{
                      color: P.textFaint,
                      fontSize: 8.5,
                      fontWeight: 850,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                    }}
                  >
                    Email attuale
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      color: P.text,
                      fontSize: 10.5,
                      fontWeight: 800,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {email || 'Non disponibile'}
                  </div>
                </div>

                {authProvider === 'email' ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit,minmax(180px,1fr))',
                      gap: 7,
                    }}
                  >
                    <input
                      className="cdr-profile-input"
                      type="email"
                      value={newEmail}
                      placeholder="Nuova email"
                      autoComplete="email"
                      onChange={(event) => {
                        setNewEmail(event.target.value);
                        setError('');
                      }}
                    />

                    <input
                      className="cdr-profile-input"
                      type="email"
                      value={confirmEmail}
                      placeholder="Conferma nuova email"
                      autoComplete="email"
                      onChange={(event) => {
                        setConfirmEmail(event.target.value);
                        setError('');
                      }}
                    />

                    <input
                      className="cdr-profile-input"
                      type="password"
                      value={emailPassword}
                      placeholder="Password attuale"
                      autoComplete="current-password"
                      onChange={(event) => {
                        setEmailPassword(event.target.value);
                        setError('');
                      }}
                    />

                    <button
                      type="button"
                      className="cdr-profile-action gold"
                      onClick={() =>
                        void updateEmail()
                      }
                      disabled={
                        changingEmail ||
                        !newEmail.trim() ||
                        !confirmEmail.trim() ||
                        !emailPassword ||
                        newEmail.trim().toLowerCase() !==
                          confirmEmail.trim().toLowerCase()
                      }
                    >
                      {changingEmail
                        ? 'Invio...'
                        : 'Cambia email'}
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      borderLeft: `2px solid ${P.accent}`,
                      background: P.accentGlow,
                      color: P.textMuted,
                      padding: '9px 11px',
                      fontSize: 9.5,
                      lineHeight: 1.55,
                    }}
                  >
                    Per modificare l’indirizzo principale,
                    usa le impostazioni del tuo account {authProvider}.
                  </div>
                )}
              </section>

              <section className="cdr-profile-card">
                <div className="cdr-profile-card-head">
                  <div>
                    <div className="cdr-profile-card-kicker">
                      <LockKey size={12} weight="fill" />
                      Sicurezza
                    </div>
                    <h2 className="cdr-profile-card-title">Password</h2>
                    <p className="cdr-profile-card-copy">
                      Modifica la password del tuo account.
                    </p>
                  </div>
                </div>

                <div className="cdr-profile-password-grid">
                  {authProvider === 'email' && (
                    <input
                      className="cdr-profile-input"
                      type="password"
                      value={currentPassword}
                      placeholder="Password attuale"
                      autoComplete="current-password"
                      onChange={(event) => {
                        setCurrentPassword(event.target.value);
                        setError('');
                      }}
                    />
                  )}

                  <input
                    className="cdr-profile-input"
                    type="password"
                    value={newPassword}
                    placeholder={
                      authProvider === 'email'
                        ? 'Nuova password'
                        : 'Imposta password Cinedate'
                    }
                    autoComplete="new-password"
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setError('');
                    }}
                  />

                  <input
                    className="cdr-profile-input"
                    type="password"
                    value={confirmPassword}
                    placeholder="Conferma password"
                    autoComplete="new-password"
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError('');
                    }}
                  />

                  <button
                    type="button"
                    className="cdr-profile-action gold"
                    onClick={updatePassword}
                    disabled={
                      changingPassword ||
                      !isPasswordValid(newPassword) ||
                      newPassword !== confirmPassword ||
                      (
                        authProvider === 'email' &&
                        !currentPassword
                      )
                    }
                  >
                    {changingPassword
                      ? '...'
                      : authProvider === 'email'
                        ? 'Aggiorna'
                        : 'Imposta'}
                  </button>

                  <div className="cdr-profile-password-checks">
                    {getPasswordChecks(newPassword).map(
                      (check) => (
                        <span
                          key={check.label}
                          className={
                            check.ok ? 'ok' : undefined
                          }
                        >
                          {check.ok ? '✓ ' : '· '}
                          {check.label}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {authProvider !== 'email' && (
                  <p
                    className="cdr-profile-card-copy"
                    style={{ marginTop: 9 }}
                  >
                    Il tuo accesso principale è tramite {authProvider}.
                    Se imposti una password, potrai accedere a Cinedate
                    anche usando email e password.
                  </p>
                )}
              </section>

              <section className="cdr-profile-card">
                <div className="cdr-profile-card-head">
                  <div>
                    <div className="cdr-profile-card-kicker">
                      <Bell size={12} weight="fill" />
                      Notifiche
                    </div>
                    <h2 className="cdr-profile-card-title">
                      Cosa vuoi ricevere
                    </h2>
                  </div>
                </div>

                <div className="cdr-profile-toggle-list">
                  {[
                    [
                      'Nuovi follower',
                      'Quando qualcuno inizia a seguirti.',
                      notifyNewFollower,
                      setNotifyNewFollower,
                    ],
                    [
                      'Like alle recensioni',
                      'Quando qualcuno mette like a una tua recensione.',
                      notifyReviewLike,
                      setNotifyReviewLike,
                    ],
                    [
                      'Commenti alle recensioni',
                      'Quando qualcuno commenta una tua recensione.',
                      notifyReviewComment,
                      setNotifyReviewComment,
                    ],
                    [
                      'Aggiornamenti segnalazioni',
                      'Quando cambia lo stato di una segnalazione.',
                      notifyReportUpdates,
                      setNotifyReportUpdates,
                    ],
                  ].map(([title, subtitle, checked, setter]) => (
                    <label
                      key={String(title)}
                      className="cdr-profile-toggle"
                    >
                      <div>
                        <strong>{String(title)}</strong>
                        <span>{String(subtitle)}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(checked)}
                        onChange={(event) =>
                          (
                            setter as React.Dispatch<
                              React.SetStateAction<boolean>
                            >
                          )(event.target.checked)
                        }
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  className="cdr-profile-action gold"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={() => void saveNotificationSettings()}
                  disabled={savingNotifications}
                >
                  {savingNotifications
                    ? 'Salvataggio...'
                    : 'Salva notifiche'}
                </button>
              </section>

              <section className="cdr-profile-card">
                <div className="cdr-profile-card-head">
                  <div>
                    <div className="cdr-profile-card-kicker">
                      <Prohibit size={12} weight="fill" />
                      Privacy e sicurezza
                    </div>
                    <h2 className="cdr-profile-card-title">
                      Visibilità e blocchi
                    </h2>
                  </div>
                </div>

                <div className="cdr-profile-toggle-list">
                  {[
                    [
                      'Preferiti pubblici',
                      'Permetti agli altri utenti di vedere i film che hai aggiunto ai Preferiti.',
                      favoritesPublic,
                      setFavoritesPublic,
                    ],
                    [
                      'Watchlist pubblica',
                      'Permetti agli altri utenti di vedere i film che vuoi guardare.',
                      watchlistPublic,
                      setWatchlistPublic,
                    ],
                    [
                      'Film visti pubblici',
                      'Permetti agli altri utenti di vedere quali film hai segnato come visti.',
                      watchedPublic,
                      setWatchedPublic,
                    ],
                  ].map(([title, subtitle, checked, setter]) => (
                    <label
                      key={String(title)}
                      className="cdr-profile-toggle"
                    >
                      <div>
                        <strong>{String(title)}</strong>
                        <span>{String(subtitle)}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(checked)}
                        onChange={(event) =>
                          (
                            setter as React.Dispatch<
                              React.SetStateAction<boolean>
                            >
                          )(event.target.checked)
                        }
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  className="cdr-profile-action"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={() => void savePrivacy()}
                  disabled={savingPrivacy}
                >
                  {savingPrivacy ? 'Salvataggio...' : 'Salva privacy'}
                </button>

                <div className="cdr-profile-setting-links">
                  <button
                    type="button"
                    className="cdr-profile-setting-link"
                    onClick={() =>
                      router.push('/impostazioni/utenti-bloccati')
                    }
                  >
                    <div
                      className="cdr-profile-setting-link-icon"
                      style={{
                        background: 'rgba(239,68,68,.08)',
                        color: '#ef4444',
                      }}
                    >
                      <Prohibit size={14} />
                    </div>
                    <div>
                      <strong>Utenti bloccati</strong>
                      <span>
                        Visualizza e gestisci gli account che hai
                        bloccato.
                      </span>
                    </div>
                    <ArrowRight size={12} />
                  </button>

                  <button
                    type="button"
                    className="cdr-profile-setting-link"
                    onClick={() =>
                      router.push('/impostazioni/segnalazioni')
                    }
                  >
                    <div className="cdr-profile-setting-link-icon">
                      <Flag size={14} weight="fill" />
                    </div>
                    <div>
                      <strong>Le mie segnalazioni</strong>
                      <span>
                        Controlla lo stato delle segnalazioni inviate.
                      </span>
                    </div>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </section>

              {isAdmin && (
                <section className="cdr-profile-card gold">
                  <div className="cdr-profile-card-head">
                    <div>
                      <div className="cdr-profile-card-kicker">
                        <ShieldCheck size={12} weight="fill" />
                        Moderazione
                      </div>
                      <h2 className="cdr-profile-card-title">
                        Strumenti amministratore
                      </h2>
                    </div>
                  </div>

                  <div className="cdr-profile-setting-links">
                    {[
                      [
                        'Gestisci segnalazioni',
                        'Apri il pannello di moderazione della community.',
                        '/admin/segnalazioni',
                        ShieldCheck,
                      ],
                      [
                        'Gestisci ricorsi',
                        'Valuta i ricorsi contro le sospensioni.',
                        '/admin/ricorsi',
                        Gavel,
                      ],
                      [
                        'Gestisci sospensioni',
                        'Visualizza le sospensioni attive e lo storico.',
                        '/admin/sospensioni',
                        WarningCircle,
                      ],
                    ].map(([title, subtitle, path, Icon]) => {
                      const IconComponent = Icon as typeof ShieldCheck;

                      return (
                        <button
                          type="button"
                          key={String(title)}
                          className="cdr-profile-setting-link"
                          onClick={() => router.push(String(path))}
                        >
                          <div
                            className="cdr-profile-setting-link-icon"
                            style={{
                              background: P.accentGlow,
                              color: P.accent,
                            }}
                          >
                            <IconComponent size={14} weight="fill" />
                          </div>
                          <div>
                            <strong>{String(title)}</strong>
                            <span>{String(subtitle)}</span>
                          </div>
                          <ArrowRight size={12} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <section
                className="cdr-profile-card"
                style={{
                  borderColor: `${P.primary}55`,
                }}
              >
                <div className="cdr-profile-card-head">
                  <div>
                    <div
                      className="cdr-profile-card-kicker"
                      style={{ color: P.primary }}
                    >
                      <Trash
                        size={12}
                        weight="fill"
                      />
                      Zona sensibile
                    </div>

                    <h2 className="cdr-profile-card-title">
                      Elimina account
                    </h2>

                    <p className="cdr-profile-card-copy">
                      Elimina definitivamente il tuo account Cinedate.
                      Questa operazione non può essere annullata.
                    </p>
                  </div>

                  {!deleteAccountOpen && (
                    <button
                      type="button"
                      className="cdr-profile-action danger"
                      onClick={() => {
                        setDeleteAccountOpen(true);
                        setDeleteConfirmation('');
                        setDeletePassword('');
                        setError('');
                      }}
                    >
                      <Trash
                        size={13}
                        weight="bold"
                      />
                      Elimina
                    </button>
                  )}
                </div>

                {deleteAccountOpen && (
                  <div
                    style={{
                      marginTop: 12,
                      border: `1px solid ${P.primary}45`,
                      background: P.primaryGlow,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        color: P.text,
                        fontSize: 10.5,
                        fontWeight: 850,
                        lineHeight: 1.5,
                      }}
                    >
                      Conferma eliminazione definitiva
                    </div>

                    <p
                      style={{
                        margin: '5px 0 11px',
                        color: P.textMuted,
                        fontSize: 9.5,
                        lineHeight: 1.55,
                      }}
                    >
                      Per continuare scrivi
                      {' '}
                      <strong style={{ color: P.primary }}>
                        @{username}
                      </strong>
                      {' '}
                      qui sotto
                      {authProvider === 'email'
                        ? ' e inserisci la password attuale.'
                        : '.'}
                    </p>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          authProvider === 'email'
                            ? 'repeat(auto-fit,minmax(180px,1fr))'
                            : '1fr',
                        gap: 7,
                      }}
                    >
                      <input
                        className="cdr-profile-input"
                        value={deleteConfirmation}
                        placeholder={`Scrivi ${username}`}
                        autoComplete="off"
                        onChange={(event) => {
                          setDeleteConfirmation(
                            event.target.value
                          );
                          setError('');
                        }}
                      />

                      {authProvider === 'email' && (
                        <input
                          className="cdr-profile-input"
                          type="password"
                          value={deletePassword}
                          placeholder="Password attuale"
                          autoComplete="current-password"
                          onChange={(event) => {
                            setDeletePassword(
                              event.target.value
                            );
                            setError('');
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 7,
                        marginTop: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        className="cdr-profile-action"
                        onClick={() => {
                          setDeleteAccountOpen(false);
                          setDeleteConfirmation('');
                          setDeletePassword('');
                          setError('');
                        }}
                        disabled={deletingAccount}
                      >
                        Annulla
                      </button>

                      <button
                        type="button"
                        className="cdr-profile-action danger"
                        onClick={() =>
                          void deleteAccount()
                        }
                        disabled={
                          deletingAccount ||
                          deleteConfirmation
                            .trim()
                            .toLowerCase() !==
                            username
                              .trim()
                              .toLowerCase() ||
                          (
                            authProvider === 'email' &&
                            !deletePassword
                          )
                        }
                      >
                        <Trash
                          size={13}
                          weight="bold"
                        />
                        {deletingAccount
                          ? 'Eliminazione...'
                          : 'Elimina definitivamente'}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="cdr-profile-card">
                <div className="cdr-profile-card-head">
                  <div>
                    <h2 className="cdr-profile-card-title">Sessione</h2>
                    <p className="cdr-profile-card-copy">
                      Disconnettiti da Cinedate su questo dispositivo.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="cdr-profile-action danger"
                    onClick={handleLogout}
                  >
                    <SignOut size={13} weight="bold" />
                    Logout
                  </button>
                </div>
              </section>

              {(error || message) && (
                <div
                  className={`cdr-profile-status ${
                    error ? 'error' : 'success'
                  }`}
                >
                  {error ? (
                    <Warning size={13} weight="fill" />
                  ) : (
                    <CheckCircle size={13} weight="fill" />
                  )}{' '}
                  {error || message}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
