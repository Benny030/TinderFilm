'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FilmSlate,
  Sparkle,
  User,
  X,
} from '@phosphor-icons/react';

import { createBrowserClient } from '@/utils/supabase/browser';
import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';
import { setFavorite } from '@/utils/movieEntries';
import {
  moderateText,
  moderationMessage,
} from '@/utils/contentModeration';

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

type Step = 1 | 2 | 3 | 4 | 5;

type SearchMovie = {
  id: string;
  tmdb_id: number;
  title: string;
  year: number;
  genre: string;
  cover: string | null;
  rating: number;
};

type OnboardingDraft = {
  step: Step;
  username: string;
  favoriteGenres: string[];
  favoriteMovies: SearchMovie[];
  bio: string;
  useProviderAvatar: boolean;
};

function normalizeUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

function getStoragePath(userId: string, file: File) {
  const extension =
    file.name.split('.').pop()?.toLowerCase() || 'jpg';

  return `${userId}/${Date.now()}.${extension}`;
}

export default function UsernamePage() {
  const router = useRouter();
  const supabase = useRef(createBrowserClient()).current;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { theme } = useTheme();
  const T = theme === 'dark' ? THEME.dark : THEME.light;

  const [step, setStep] = useState<Step>(1);
  const [mounted, setMounted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [providerAvatar, setProviderAvatar] =
    useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] =
    useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameStatusMessage, setUsernameStatusMessage] =
    useState('');
  const [favoriteGenres, setFavoriteGenres] =
    useState<string[]>([]);
  const [bio, setBio] = useState('');

  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] =
    useState<SearchMovie[]>([]);
  const [favoriteMovies, setFavoriteMovies] =
    useState<SearchMovie[]>([]);
  const [movieSearching, setMovieSearching] =
    useState(false);
  const [suggestedMovies, setSuggestedMovies] =
    useState<SearchMovie[]>([]);
  const [suggestedMoviesLoading, setSuggestedMoviesLoading] =
    useState(false);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);
  const [useProviderAvatar, setUseProviderAvatar] =
    useState(true);

  const [error, setError] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] =
    useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setMounted(true),
      40
    );

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (
        previewUrl &&
        previewUrl.startsWith('blob:')
      ) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const checkSession = async () => {
      setIsChecking(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          void router.replace('/auth');
          return;
        }

        setUserId(user.id);
        setEmail(user.email ?? '');

        const metadataAvatar =
          typeof user.user_metadata?.avatar_url ===
          'string'
            ? user.user_metadata.avatar_url
            : typeof user.user_metadata?.picture ===
                'string'
              ? user.user_metadata.picture
              : null;

        setProviderAvatar(metadataAvatar);

        let draft: OnboardingDraft | null = null;

        try {
          const rawDraft = window.localStorage.getItem(
            `cinedate:onboarding:${user.id}`
          );

          if (rawDraft) {
            const parsed = JSON.parse(rawDraft);

            if (
              parsed &&
              typeof parsed === 'object'
            ) {
              draft = parsed as OnboardingDraft;
            }
          }
        } catch (draftError) {
          console.warn(
            'Onboarding draft restore failed:',
            draftError
          );
        }

        const { data, error: profileError } =
          await supabase
            .from('users')
            .select(
              'username,bio,avatar_url,favorite_genres'
            )
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        /*
         * Se il profilo è già completo non riapriamo
         * l'onboarding.
         */
        if (
          data?.username &&
          Array.isArray(data.favorite_genres) &&
          data.favorite_genres.length > 0
        ) {
          void router.replace('/home');
          return;
        }

        setUsername(
          typeof draft?.username === 'string'
            ? draft.username
            : data?.username ?? ''
        );

        setBio(
          typeof draft?.bio === 'string'
            ? draft.bio
            : data?.bio ?? ''
        );

        setFavoriteGenres(
          Array.isArray(draft?.favoriteGenres) &&
          draft.favoriteGenres.length > 0
            ? draft.favoriteGenres
            : Array.isArray(data?.favorite_genres)
              ? data.favorite_genres
              : []
        );

        setFavoriteMovies(
          Array.isArray(draft?.favoriteMovies)
            ? draft.favoriteMovies
            : []
        );

        if (draft?.useProviderAvatar === false) {
          setUseProviderAvatar(false);
        }

        if (data?.avatar_url) {
          setProviderAvatar(data.avatar_url);

          if (draft?.useProviderAvatar !== false) {
            setUseProviderAvatar(true);
          }
        }

        if (
          draft?.step &&
          [1, 2, 3, 4, 5].includes(draft.step)
        ) {
          setStep(draft.step);
        }

        setDraftReady(true);
      } catch (err) {
        console.error(
          'Onboarding session check failed:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Errore durante il caricamento del profilo.'
        );
      } finally {
        setIsChecking(false);
      }
    };

    void checkSession();
  }, [router, supabase]);

  useEffect(() => {
    if (
      !draftReady ||
      !userId ||
      isSaving
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const draft: OnboardingDraft = {
        step,
        username,
        favoriteGenres,
        favoriteMovies,
        bio,
        useProviderAvatar,
      };

      try {
        window.localStorage.setItem(
          `cinedate:onboarding:${userId}`,
          JSON.stringify(draft)
        );

        setDraftSavedAt(Date.now());
      } catch (draftError) {
        console.warn(
          'Onboarding draft save failed:',
          draftError
        );
      }
    }, 250);

    return () =>
      window.clearTimeout(timer);
  }, [
    draftReady,
    userId,
    isSaving,
    step,
    username,
    favoriteGenres,
    favoriteMovies,
    bio,
    useProviderAvatar,
  ]);

  useEffect(() => {
    const cleanUsername = normalizeUsername(username);

    if (
      step !== 1 ||
      cleanUsername.length < 3
    ) {
      setUsernameStatus('idle');
      setUsernameStatusMessage('');
      return;
    }

    const localModeration = moderateText(
      cleanUsername,
      'username'
    );

    if (!localModeration.allowed) {
      setUsernameStatus('taken');
      setUsernameStatusMessage(
        moderationMessage(
          localModeration,
          'username'
        )
      );
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        setUsernameStatus('checking');
        setUsernameStatusMessage(
          'Controllo disponibilità…'
        );

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
            `/api/profile/check-username?username=${encodeURIComponent(
              cleanUsername
            )}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              signal: controller.signal,
            }
          );

          const data = await response
            .json()
            .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data.error ||
                'Impossibile verificare lo username.'
            );
          }

          if (data.available) {
            setUsernameStatus('available');
            setUsernameStatusMessage(
              'Username disponibile'
            );
          } else {
            setUsernameStatus('taken');
            setUsernameStatusMessage(
              data.error ||
                'Username già in uso.'
            );
          }
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            err.name === 'AbortError'
          ) {
            return;
          }

          setUsernameStatus('taken');
          setUsernameStatusMessage(
            err instanceof Error
              ? err.message
              : 'Impossibile verificare lo username.'
          );
        }
      },
      350
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    step,
    username,
    supabase,
  ]);

  useEffect(() => {
    if (
      step !== 3 ||
      favoriteGenres.length < 3
    ) {
      return;
    }

    const controller = new AbortController();

    const loadSuggestions = async () => {
      setSuggestedMoviesLoading(true);

      try {
        const response = await fetch(
          `/api/profile/onboarding-movies?genres=${encodeURIComponent(
            favoriteGenres.join(',')
          )}`,
          {
            signal: controller.signal,
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error ||
              'Suggerimenti non disponibili.'
          );
        }

        const selectedIds = new Set(
          favoriteMovies.map(
            (movie) => movie.tmdb_id
          )
        );

        setSuggestedMovies(
          (
            Array.isArray(data.movies)
              ? data.movies
              : []
          ).filter(
            (movie: SearchMovie) =>
              !selectedIds.has(
                movie.tmdb_id
              )
          )
        );
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.name === 'AbortError'
        ) {
          return;
        }

        console.error(
          'Onboarding suggestions failed:',
          err
        );
      } finally {
        setSuggestedMoviesLoading(false);
      }
    };

    void loadSuggestions();

    return () => controller.abort();
  }, [
    step,
    favoriteGenres,
    favoriteMovies,
  ]);

  useEffect(() => {
    if (
      step !== 3 ||
      movieQuery.trim().length < 2
    ) {
      setMovieResults([]);
      setMovieSearching(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        setMovieSearching(true);

        try {
          const response = await fetch(
            `/api/tmdb/search?q=${encodeURIComponent(
              movieQuery.trim()
            )}`,
            {
              signal: controller.signal,
            }
          );

          const data = await response
            .json()
            .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data.error ||
                'Ricerca non disponibile.'
            );
          }

          const selectedIds = new Set(
            favoriteMovies.map(
              (movie) => movie.tmdb_id
            )
          );

          setMovieResults(
            (
              Array.isArray(data.movies)
                ? data.movies
                : []
            )
              .filter(
                (movie: SearchMovie) =>
                  !selectedIds.has(
                    movie.tmdb_id
                  )
              )
              .slice(0, 8)
          );
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            err.name === 'AbortError'
          ) {
            return;
          }

          console.error(
            'Onboarding movie search failed:',
            err
          );
        } finally {
          setMovieSearching(false);
        }
      },
      280
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    step,
    movieQuery,
    favoriteMovies,
  ]);

  const usernameModeration = moderateText(
    normalizeUsername(username),
    'username'
  );

  const usernameValid =
    usernameModeration.allowed &&
    usernameStatus === 'available';

  const canContinueGenres =
    favoriteGenres.length >= 3;

  const canContinueMovies =
    favoriteMovies.length >= 3;

  const visibleAvatar = previewUrl
    ? previewUrl
    : useProviderAvatar
      ? providerAvatar
      : null;

  const avatarInitial = useMemo(() => {
    const seed =
      normalizeUsername(username) ||
      email ||
      'utente';

    return seed.charAt(0).toUpperCase();
  }, [email, username]);

  const toggleGenre = (genre: string) => {
    setFavoriteGenres((current) =>
      current.includes(genre)
        ? current.filter(
            (item) => item !== genre
          )
        : [...current, genre]
    );

    setError('');
  };

  const handleAvatarChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (!allowed.includes(file.type)) {
      setError(
        'Formato immagine non supportato. Usa JPG, PNG, WEBP o GIF.'
      );
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        'L’immagine deve pesare meno di 5 MB.'
      );
      event.target.value = '';
      return;
    }

    if (
      previewUrl &&
      previewUrl.startsWith('blob:')
    ) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextPreview =
      URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(nextPreview);
    setUseProviderAvatar(false);
    setError('');
  };

  const removeCustomAvatar = () => {
    if (
      previewUrl &&
      previewUrl.startsWith('blob:')
    ) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl(null);
    setUseProviderAvatar(
      Boolean(providerAvatar)
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveProfile = async () => {
    if (!userId || isSaving) return;

    const cleanUsername =
      normalizeUsername(username);

    if (cleanUsername.length < 3) {
      setStep(1);
      setError(
        'Scegli un username di almeno 3 caratteri.'
      );
      return;
    }

    if (favoriteGenres.length < 3) {
      setStep(2);
      setError(
        'Scegli almeno 3 generi per costruire i tuoi primi consigli.'
      );
      return;
    }

    if (favoriteMovies.length < 3) {
      setStep(3);
      setError(
        'Scegli almeno 3 film che ami per rendere più precisi i tuoi primi consigli.'
      );
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      let avatarUrl: string | null =
        useProviderAvatar
          ? providerAvatar
          : null;

      if (selectedFile) {
        const path = getStoragePath(
          userId,
          selectedFile
        );

        const { error: uploadError } =
          await supabase.storage
            .from('avatars')
            .upload(path, selectedFile, {
              cacheControl: '3600',
              upsert: false,
            });

        if (uploadError) {
          throw uploadError;
        }

        const { data } =
          supabase.storage
            .from('avatars')
            .getPublicUrl(path);

        avatarUrl =
          data.publicUrl || null;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        throw new Error('Sessione non disponibile.');
      }

      /*
       * Salviamo prima i film preferiti. Se uno di questi
       * fallisce, il profilo non viene marcato come completo:
       * al refresh l'onboarding resta quindi recuperabile.
       */
      for (const movie of favoriteMovies) {
        await setFavorite(
          supabase,
          movie.tmdb_id,
          true
        );
      }

      const response = await fetch('/api/profile/onboarding', {
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
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          setStep(1);
        }

        throw new Error(
          data.error || 'Impossibile completare il profilo.'
        );
      }

      try {
        window.localStorage.removeItem(
          `cinedate:onboarding:${userId}`
        );
      } catch {
        // Nessun blocco: il profilo è già stato salvato.
      }

      await router.replace('/home');
    } catch (err) {
      console.error(
        'Onboarding profile save failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile completare il profilo.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: T.bg,
          color: T.textMuted,
          fontFamily: FONT.sans,
        }}
      >
        <FilmSlate
          size={40}
          color={T.primary}
          weight="duotone"
        />
      </div>
    );
  }

  const steps = [
    {
      n: 1,
      title: 'Il tuo nome',
    },
    {
      n: 2,
      title: 'I tuoi gusti',
    },
    {
      n: 3,
      title: 'Film che ami',
    },
    {
      n: 4,
      title: 'Raccontati',
    },
    {
      n: 5,
      title: 'La tua foto',
    },
  ];

  return (
    <main
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        fontFamily: FONT.sans,
        padding: '24px 16px 56px',
        opacity: mounted ? 1 : 0,
        transition: 'opacity .25s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 760,
          margin: '0 auto',
        }}
      >
        <header
          style={{
            borderBottom: `1px solid ${T.border}`,
            paddingBottom: 18,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              color: T.accent,
              fontSize: 9,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '.12em',
            }}
          >
            Benvenuto su Cinedate
          </div>

          <h1
            style={{
              margin: '5px 0 6px',
              fontFamily: FONT.display,
              fontSize: 'clamp(30px,7vw,42px)',
              lineHeight: 1,
            }}
          >
            Costruiamo il tuo profilo
          </h1>

          <p
            style={{
              margin: 0,
              color: T.textMuted,
              fontSize: 11.5,
              lineHeight: 1.6,
              maxWidth: 600,
            }}
          >
            Bastano pochi passaggi. Generi e film
            preferiti alimentano subito la sezione
            “Per te”.
          </p>

          {draftReady && (
            <div
              style={{
                marginTop: 7,
                color: T.textFaint,
                fontSize: 8.5,
                lineHeight: 1.4,
              }}
            >
              {draftSavedAt
                ? '✓ Progressi salvati automaticamente'
                : 'I progressi vengono salvati automaticamente'}
            </div>
          )}
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(5,minmax(0,1fr))',
            border: `1px solid ${T.border}`,
            marginBottom: 18,
          }}
        >
          {steps.map((item, index) => {
            const active = step === item.n;
            const complete = step > item.n;

            return (
              <div
                key={item.n}
                style={{
                  minHeight: 48,
                  padding: '8px 6px',
                  borderRight:
                    index < 4
                      ? `1px solid ${T.border}`
                      : undefined,
                  background: active
                    ? T.primaryGlow
                    : T.surface,
                  color: active
                    ? T.primary
                    : complete
                      ? T.accent
                      : T.textFaint,
                  display: 'grid',
                  placeItems: 'center',
                  textAlign: 'center',
                  fontSize: 8.5,
                  fontWeight: 800,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `1px solid ${
                      active
                        ? T.primary
                        : complete
                          ? T.accent
                          : T.border
                    }`,
                    display: 'grid',
                    placeItems: 'center',
                    marginBottom: 3,
                  }}
                >
                  {complete ? (
                    <Check
                      size={10}
                      weight="bold"
                    />
                  ) : (
                    item.n
                  )}
                </span>
                {item.title}
              </div>
            );
          })}
        </div>

        {error && (
          <div
            style={{
              border: `1px solid ${T.primary}50`,
              background: T.primaryGlow,
              color: T.primary,
              padding: '10px 11px',
              marginBottom: 12,
              fontSize: 10,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {step === 1 && (
          <section
            style={{
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: '22px 18px',
            }}
          >
            <User
              size={26}
              color={T.primary}
              weight="duotone"
            />

            <h2
              style={{
                margin: '10px 0 5px',
                fontFamily: FONT.display,
                fontSize: 23,
              }}
            >
              Come ti chiami su Cinedate?
            </h2>

            <p
              style={{
                margin: 0,
                color: T.textMuted,
                fontSize: 10.5,
                lineHeight: 1.55,
              }}
            >
              Sarà il nome che gli altri vedranno
              nelle stanze, nelle recensioni e nel
              tuo profilo.
            </p>

            <div
              style={{
                position: 'relative',
                marginTop: 18,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform:
                    'translateY(-50%)',
                  color: T.textFaint,
                  fontWeight: 800,
                }}
              >
                @
              </span>

              <input
                value={username}
                onChange={(event) => {
                  setUsername(
                    normalizeUsername(
                      event.target.value
                    )
                  );
                  setUsernameStatus('idle');
                  setUsernameStatusMessage('');
                  setError('');
                }}
                placeholder="username"
                maxLength={20}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1px solid ${
                    usernameValid
                      ? T.accent
                      : T.border
                  }`,
                  background: T.bgSoft,
                  color: T.text,
                  padding:
                    '12px 12px 12px 30px',
                  fontFamily: FONT.sans,
                  fontSize: 13,
                  fontWeight: 800,
                  outline: 'none',
                }}
              />
            </div>

            <div
              style={{
                marginTop: 6,
                color: T.textFaint,
                fontSize: 8.5,
              }}
            >
              Lettere minuscole, numeri e _
              · minimo 3 caratteri
            </div>

            {username.length > 0 &&
              usernameStatusMessage && (
                <div
                  style={{
                    marginTop: 5,
                    color:
                      usernameStatus === 'available'
                        ? T.accent
                        : usernameStatus === 'checking'
                          ? T.textFaint
                          : T.primary,
                    fontSize: 8.5,
                    lineHeight: 1.4,
                    fontWeight: 750,
                  }}
                >
                  {usernameStatus === 'available'
                    ? '✓ '
                    : usernameStatus === 'checking'
                      ? ''
                      : '× '}
                  {usernameStatusMessage}
                </div>
              )}

            <button
              type="button"
              disabled={!usernameValid}
              onClick={() => {
                if (
                  usernameStatus !== 'available'
                ) {
                  setError(
                    usernameStatusMessage ||
                      'Verifica prima che lo username sia disponibile.'
                  );
                  return;
                }

                setError('');
                setStep(2);
              }}
              style={{
                width: '100%',
                marginTop: 18,
                border: 0,
                background: usernameValid
                  ? T.primary
                  : T.border,
                color: usernameValid
                  ? '#fff'
                  : T.textFaint,
                padding: '11px 12px',
                cursor: usernameValid
                  ? 'pointer'
                  : 'default',
                fontFamily: FONT.sans,
                fontSize: 10,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              Continua
              <ArrowRight
                size={13}
                weight="bold"
              />
            </button>
          </section>
        )}

        {step === 2 && (
          <section
            style={{
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: '22px 18px',
            }}
          >
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                border: 0,
                background: 'transparent',
                color: T.textMuted,
                padding: 0,
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 9.5,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ArrowLeft
                size={12}
                weight="bold"
              />
              Indietro
            </button>

            <Sparkle
              size={27}
              color={T.accent}
              weight="fill"
              style={{ marginTop: 17 }}
            />

            <h2
              style={{
                margin: '9px 0 5px',
                fontFamily: FONT.display,
                fontSize: 23,
              }}
            >
              Cosa ti piace guardare?
            </h2>

            <p
              style={{
                margin: 0,
                color: T.textMuted,
                fontSize: 10.5,
                lineHeight: 1.55,
              }}
            >
              Scegli almeno 3 generi. Li
              useremo come primo segnale per
              costruire i tuoi consigli.
            </p>

            <div
              style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(120px,1fr))',
                borderTop: `1px solid ${T.border}`,
                borderLeft: `1px solid ${T.border}`,
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
                      border: 0,
                      borderRight: `1px solid ${T.border}`,
                      borderBottom: `1px solid ${T.border}`,
                      background: selected
                        ? T.accentGlow
                        : T.bg,
                      color: selected
                        ? T.accent
                        : T.textMuted,
                      padding: '10px 8px',
                      minHeight: 40,
                      cursor: 'pointer',
                      fontFamily: FONT.sans,
                      fontSize: 9.5,
                      fontWeight: 800,
                    }}
                  >
                    {selected ? '✓ ' : ''}
                    {genre}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 10,
                color: canContinueGenres
                  ? T.accent
                  : T.textFaint,
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {favoriteGenres.length} selezionati
              {favoriteGenres.length < 3
                ? ` · ne mancano ${
                    3 -
                    favoriteGenres.length
                  }`
                : ' · perfetto'}
            </div>

            <button
              type="button"
              disabled={!canContinueGenres}
              onClick={() => {
                setError('');
                setStep(3);
              }}
              style={{
                width: '100%',
                marginTop: 16,
                border: 0,
                background:
                  canContinueGenres
                    ? T.primary
                    : T.border,
                color: canContinueGenres
                  ? '#fff'
                  : T.textFaint,
                padding: '11px 12px',
                cursor: canContinueGenres
                  ? 'pointer'
                  : 'default',
                fontFamily: FONT.sans,
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              Continua
            </button>
          </section>
        )}


        {step === 3 && (
          <section
            style={{
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: '22px 18px',
            }}
          >
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                border: 0,
                background: 'transparent',
                color: T.textMuted,
                padding: 0,
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 9.5,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ArrowLeft
                size={12}
                weight="bold"
              />
              Indietro
            </button>

            <FilmSlate
              size={27}
              color={T.primary}
              weight="duotone"
              style={{ marginTop: 17 }}
            />

            <h2
              style={{
                margin: '9px 0 5px',
                fontFamily: FONT.display,
                fontSize: 23,
              }}
            >
              Quali film ami davvero?
            </h2>

            <p
              style={{
                margin: 0,
                color: T.textMuted,
                fontSize: 10.5,
                lineHeight: 1.55,
              }}
            >
              Scegline almeno 3. I preferiti sono segnali molto
              più forti dei soli generi e rendono il tuo primo
              “Per te” molto più preciso.
            </p>

            {favoriteMovies.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(92px,1fr))',
                  gap: 8,
                  marginTop: 16,
                }}
              >
                {favoriteMovies.map((movie) => (
                  <div
                    key={movie.tmdb_id}
                    style={{
                      position: 'relative',
                      border: `1px solid ${T.border}`,
                      background: T.bgSoft,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '2 / 3',
                        background: T.bg,
                        overflow: 'hidden',
                      }}
                    >
                      {movie.cover ? (
                        <img
                          src={movie.cover}
                          alt={movie.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'grid',
                            placeItems: 'center',
                            color: T.textFaint,
                          }}
                        >
                          <FilmSlate
                            size={22}
                            weight="duotone"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setFavoriteMovies((current) =>
                          current.filter(
                            (item) =>
                              item.tmdb_id !==
                              movie.tmdb_id
                          )
                        )
                      }
                      aria-label={`Rimuovi ${movie.title}`}
                      style={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        border: 0,
                        background: 'rgba(10,8,6,.82)',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <X size={11} weight="bold" />
                    </button>

                    <div
                      style={{
                        padding: '7px 7px 8px',
                        color: T.text,
                        fontSize: 9,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {movie.title}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    color: T.text,
                    fontSize: 10,
                    fontWeight: 850,
                  }}
                >
                  Scelti dai tuoi generi
                </div>

                <div
                  style={{
                    color: T.textFaint,
                    fontSize: 8.5,
                  }}
                >
                  Tocca un film per aggiungerlo
                </div>
              </div>

              {suggestedMoviesLoading ? (
                <div
                  style={{
                    borderTop: `1px solid ${T.border}`,
                    borderBottom: `1px solid ${T.border}`,
                    padding: '12px 0',
                    color: T.textFaint,
                    fontSize: 9,
                  }}
                >
                  Preparo qualche titolo…
                </div>
              ) : suggestedMovies.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(86px,1fr))',
                    gap: 7,
                  }}
                >
                  {suggestedMovies
                    .slice(0, 8)
                    .map((movie) => (
                      <button
                        key={movie.tmdb_id}
                        type="button"
                        onClick={() => {
                          setFavoriteMovies(
                            (current) => [
                              ...current,
                              movie,
                            ]
                          );

                          setSuggestedMovies(
                            (current) =>
                              current.filter(
                                (item) =>
                                  item.tmdb_id !==
                                  movie.tmdb_id
                              )
                          );

                          setError('');
                        }}
                        style={{
                          border: `1px solid ${T.border}`,
                          background: T.bgSoft,
                          color: T.text,
                          padding: 0,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: FONT.sans,
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '2 / 3',
                            background: T.bg,
                            overflow: 'hidden',
                          }}
                        >
                          {movie.cover ? (
                            <img
                              src={movie.cover}
                              alt=""
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'grid',
                                placeItems: 'center',
                                color: T.textFaint,
                              }}
                            >
                              <FilmSlate
                                size={18}
                                weight="duotone"
                              />
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            padding: '6px 6px 7px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 8.5,
                              fontWeight: 850,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {movie.title}
                          </div>

                          <div
                            style={{
                              marginTop: 2,
                              color: T.textFaint,
                              fontSize: 7.5,
                            }}
                          >
                            {movie.year || '—'}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              ) : null}
            </div>

            <div
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: `1px solid ${T.border}`,
              }}
            >
              <div
                style={{
                  color: T.text,
                  fontSize: 10,
                  fontWeight: 850,
                  marginBottom: 7,
                }}
              >
                Oppure cerca un film preciso
              </div>

              <div
                style={{
                  position: 'relative',
                }}
              >
              <input
                value={movieQuery}
                onChange={(event) => {
                  setMovieQuery(event.target.value);
                  setError('');
                }}
                placeholder="Cerca un film..."
                autoComplete="off"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1px solid ${T.border}`,
                  background: T.bgSoft,
                  color: T.text,
                  padding: '11px 12px',
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  outline: 'none',
                }}
              />
              </div>
            </div>

            {movieSearching && (
              <div
                style={{
                  marginTop: 8,
                  color: T.textFaint,
                  fontSize: 9,
                }}
              >
                Ricerca…
              </div>
            )}

            {movieResults.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  borderTop: `1px solid ${T.border}`,
                }}
              >
                {movieResults.map((movie) => (
                  <button
                    key={movie.tmdb_id}
                    type="button"
                    onClick={() => {
                      setFavoriteMovies((current) => [
                        ...current,
                        movie,
                      ]);
                      setMovieQuery('');
                      setMovieResults([]);
                      setError('');
                    }}
                    style={{
                      width: '100%',
                      border: 0,
                      borderBottom: `1px solid ${T.border}`,
                      background: 'transparent',
                      color: T.text,
                      padding: '8px 0',
                      display: 'grid',
                      gridTemplateColumns:
                        '38px minmax(0,1fr) auto',
                      gap: 9,
                      alignItems: 'center',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: FONT.sans,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 56,
                        background: T.bgSoft,
                        overflow: 'hidden',
                      }}
                    >
                      {movie.cover ? (
                        <img
                          src={movie.cover}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'grid',
                            placeItems: 'center',
                            color: T.textFaint,
                          }}
                        >
                          <FilmSlate size={15} />
                        </div>
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 10.5,
                          fontWeight: 850,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {movie.title}
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          color: T.textFaint,
                          fontSize: 8.5,
                        }}
                      >
                        {movie.year || '—'}
                        {movie.genre
                          ? ` · ${movie.genre}`
                          : ''}
                      </div>
                    </div>

                    <span
                      style={{
                        color: T.primary,
                        fontSize: 18,
                        fontWeight: 400,
                      }}
                    >
                      +
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: 10,
                color: canContinueMovies
                  ? T.accent
                  : T.textFaint,
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {favoriteMovies.length} selezionati
              {favoriteMovies.length < 3
                ? ` · ne mancano ${
                    3 - favoriteMovies.length
                  }`
                : ' · ottimo punto di partenza'}
            </div>

            <button
              type="button"
              disabled={!canContinueMovies}
              onClick={() => {
                setError('');
                setStep(4);
              }}
              style={{
                width: '100%',
                marginTop: 16,
                border: 0,
                background: canContinueMovies
                  ? T.primary
                  : T.border,
                color: canContinueMovies
                  ? '#fff'
                  : T.textFaint,
                padding: '11px 12px',
                cursor: canContinueMovies
                  ? 'pointer'
                  : 'default',
                fontFamily: FONT.sans,
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              Continua
            </button>
          </section>
        )}

        {step === 4 && (
          <section
            style={{
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: '22px 18px',
            }}
          >
            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                border: 0,
                background: 'transparent',
                color: T.textMuted,
                padding: 0,
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 9.5,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ArrowLeft
                size={12}
                weight="bold"
              />
              Indietro
            </button>

            <h2
              style={{
                margin: '18px 0 5px',
                fontFamily: FONT.display,
                fontSize: 23,
              }}
            >
              Racconta qualcosa di te
            </h2>

            <p
              style={{
                margin: 0,
                color: T.textMuted,
                fontSize: 10.5,
                lineHeight: 1.55,
              }}
            >
              È facoltativo, ma aiuta chi
              visita il tuo profilo a capire
              che tipo di spettatore sei.
            </p>

            <textarea
              value={bio}
              onChange={(event) =>
                setBio(
                  event.target.value.slice(
                    0,
                    240
                  )
                )
              }
              placeholder="Es. Divoro thriller, horror e fantascienza. Sempre disponibile per una maratona..."
              rows={5}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 16,
                resize: 'vertical',
                border: `1px solid ${T.border}`,
                background: T.bgSoft,
                color: T.text,
                padding: 12,
                outline: 'none',
                fontFamily: FONT.sans,
                fontSize: 11,
                lineHeight: 1.55,
              }}
            />

            <div
              style={{
                marginTop: 5,
                textAlign: 'right',
                color: T.textFaint,
                fontSize: 8.5,
              }}
            >
              {bio.length}/240
            </div>

            {bio.length > 0 &&
              !moderateText(bio, 'bio').allowed && (
                <div
                  style={{
                    marginTop: 5,
                    color: T.primary,
                    fontSize: 8.5,
                    lineHeight: 1.4,
                  }}
                >
                  {moderationMessage(
                    moderateText(bio, 'bio'),
                    'bio'
                  )}
                </div>
              )}

            <button
              type="button"
              onClick={() => {
                const result = moderateText(bio, 'bio');

                if (!result.allowed) {
                  setError(
                    moderationMessage(result, 'bio')
                  );
                  return;
                }

                setError('');
                setStep(5);
              }}
              style={{
                width: '100%',
                marginTop: 14,
                border: 0,
                background: T.primary,
                color: '#fff',
                padding: '11px 12px',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              Continua
            </button>
          </section>
        )}

        {step === 5 && (
          <section
            style={{
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: '22px 18px',
            }}
          >
            <button
              type="button"
              onClick={() => setStep(4)}
              style={{
                border: 0,
                background: 'transparent',
                color: T.textMuted,
                padding: 0,
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 9.5,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ArrowLeft
                size={12}
                weight="bold"
              />
              Indietro
            </button>

            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                marginTop: 18,
              }}
            >
              <div
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: '50%',
                  border: `1px solid ${T.border}`,
                  background: T.primaryGlow,
                  color: T.primary,
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: FONT.display,
                  fontSize: 34,
                  fontWeight: 800,
                }}
              >
                {visibleAvatar ? (
                  <img
                    src={visibleAvatar}
                    alt="Anteprima avatar"
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  avatarInitial
                )}
              </div>
            </div>

            <h2
              style={{
                margin: '15px 0 5px',
                textAlign: 'center',
                fontFamily: FONT.display,
                fontSize: 23,
              }}
            >
              Scegli la tua immagine
            </h2>

            <p
              style={{
                margin: '0 auto',
                maxWidth: 470,
                textAlign: 'center',
                color: T.textMuted,
                fontSize: 10.5,
                lineHeight: 1.55,
              }}
            >
              Puoi lasciare quella del tuo account,
              caricarne una nuova oppure usare
              semplicemente l’iniziale.
            </p>

            {selectedFile && (
              <div
                style={{
                  margin: '9px auto 0',
                  maxWidth: 470,
                  textAlign: 'center',
                  color: T.textFaint,
                  fontSize: 8.5,
                  lineHeight: 1.45,
                }}
              >
                La nuova foto viene caricata solo quando completi il profilo.
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />

            <div
              style={{
                marginTop: 17,
                display: 'grid',
                gridTemplateColumns:
                  providerAvatar
                    ? '1fr 1fr'
                    : '1fr',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                style={{
                  border: `1px solid ${T.primary}`,
                  background: T.primaryGlow,
                  color: T.primary,
                  padding: '10px 11px',
                  cursor: 'pointer',
                  fontFamily: FONT.sans,
                  fontSize: 9.5,
                  fontWeight: 850,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Camera
                  size={14}
                  weight="bold"
                />
                Carica nuova
              </button>

              {providerAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    removeCustomAvatar();
                    setUseProviderAvatar(true);
                  }}
                  style={{
                    border: `1px solid ${T.accent}`,
                    background: T.accentGlow,
                    color: T.accent,
                    padding: '10px 11px',
                    cursor: 'pointer',
                    fontFamily: FONT.sans,
                    fontSize: 9.5,
                    fontWeight: 850,
                  }}
                >
                  Usa foto account
                </button>
              )}
            </div>

            {(selectedFile ||
              visibleAvatar) && (
              <button
                type="button"
                onClick={() => {
                  removeCustomAvatar();
                  setUseProviderAvatar(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  margin: '10px auto 0',
                  border: 0,
                  background: 'transparent',
                  color: T.textFaint,
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: FONT.sans,
                  fontSize: 9,
                  fontWeight: 800,
                }}
              >
                <X
                  size={11}
                  weight="bold"
                />
                Usa solo iniziale
              </button>
            )}

            <div
              style={{
                marginTop: 18,
                border: `1px solid ${T.border}`,
                background: T.bgSoft,
                padding: 12,
              }}
            >
              <div
                style={{
                  color: T.accent,
                  fontSize: 8.5,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '.1em',
                }}
              >
                Il tuo profilo è pronto
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: T.text,
                  fontWeight: 850,
                  fontSize: 11,
                }}
              >
                @{normalizeUsername(username)}
              </div>

              <div
                style={{
                  marginTop: 4,
                  color: T.textMuted,
                  fontSize: 9.5,
                  lineHeight: 1.5,
                }}
              >
                {favoriteGenres
                  .slice(0, 5)
                  .join(' · ')}
                {favoriteGenres.length > 5
                  ? ` · +${
                      favoriteGenres.length - 5
                    }`
                  : ''}
              </div>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                void saveProfile()
              }
              style={{
                width: '100%',
                marginTop: 15,
                border: 0,
                background: isSaving
                  ? T.border
                  : T.primary,
                color: isSaving
                  ? T.textFaint
                  : '#fff',
                padding: '12px 12px',
                cursor: isSaving
                  ? 'wait'
                  : 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10.5,
                fontWeight: 900,
              }}
            >
              {isSaving
                ? 'Creazione profilo…'
                : 'Entra in Cinedate'}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
