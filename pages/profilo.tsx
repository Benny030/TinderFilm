'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/utils/supabase/browser';
import { C, R, FONT, TEXT, S, SHADOW, input } from '@/styles/token';
import {
  Camera,
  Check,
  FilmSlate,
  FloppyDisk,
  SignOut,
  User,
  Warning,
} from '@phosphor-icons/react';

type ProfileRow = {
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  favorite_genres: string[] | null;
};

const GENRES = ['horror', 'azione', 'comedy', 'drama', 'thriller', 'sci-fi', 'romance'];

const avatarColors = ['#E8386D', '#5BBEC8', '#8B5CF6', '#F59E0B', '#22C55E', '#EF4444'];

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

function getFallbackColor(seed: string) {
  const sum = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[sum % avatarColors.length];
}

function getStoragePath(userId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  return `${userId}/${Date.now()}.${extension}`;
}

export default function ProfiloPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading, signOut } = useAuth();
  const supabase = useRef(createBrowserClient()).current;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [googleAvatarUrl, setGoogleAvatarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser || isGuest) router.replace('/auth');
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    const loadProfile = async () => {
      setProfileLoading(true);
      setError('');

      try {
        const { data: { user } } = await supabase.auth.getUser();
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
        setFavoriteGenres(Array.isArray(data?.favorite_genres) ? data.favorite_genres : []);
      } catch (err: any) {
        setError(err.message ?? 'Errore durante il caricamento del profilo');
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [currentUser, supabase]);

  const visibleAvatarUrl = avatarUrl || googleAvatarUrl;
  const fallbackSeed = username || email || 'utente';
  const fallbackInitial = fallbackSeed.charAt(0).toUpperCase();
  const fallbackColor = useMemo(() => getFallbackColor(fallbackSeed), [fallbackSeed]);

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
      const { error: saveError } = await supabase.from('users').upsert({
        id: currentUser.id,
        email,
        username: cleanUsername,
        avatar_url: avatarUrl,
        bio: bio.trim(),
        favorite_genres: favoriteGenres,
      });

      if (saveError) {
        if (saveError.code === '23505') {
          setError('Username gia in uso, scegline un altro.');
          return;
        }
        throw saveError;
      }

      setUsername(cleanUsername);
      setMessage('Profilo salvato.');
      await supabase.auth.refreshSession();
    } catch (err: any) {
      setError(err.message ?? 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
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
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const { error: saveError } = await supabase.from('users').upsert({
        id: currentUser.id,
        email,
        username: normalizeUsername(username) || currentUser.username,
        avatar_url: publicUrl,
        bio: bio.trim(),
        favorite_genres: favoriteGenres,
      });

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

  const handleLogout = async () => {
    await signOut();
  };

  if (isLoading || profileLoading || !currentUser || isGuest) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FilmSlate size={42} color={C.primary} weight="duotone" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .profile-page {
          min-height: 100vh;
          background: ${C.bgSoft};
          padding: ${S.lg} ${S.md};
          font-family: ${FONT.sans};
        }
        .profile-wrap {
          width: 100%;
          max-width: 920px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }
        .profile-panel {
          background: ${C.bg};
          border: 1.5px solid ${C.border};
          border-radius: ${R.lg};
          box-shadow: ${SHADOW.sm};
        }
        .profile-main {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 22px;
          padding: ${S.lg};
        }
        .profile-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .profile-label {
          font-size: ${TEXT.xs};
          color: ${C.muted};
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0;
        }
        .profile-input:focus, .profile-textarea:focus {
          border-color: ${C.primary};
        }
        .genre-chip {
          border: 1.5px solid ${C.border};
          background: ${C.bg};
          color: ${C.muted};
          border-radius: ${R.full};
          padding: 10px 14px;
          font-size: ${TEXT.sm};
          font-weight: 700;
          font-family: ${FONT.sans};
          cursor: pointer;
          transition: background .15s, border-color .15s, color .15s;
        }
        .genre-chip.active {
          background: ${C.primaryLight};
          border-color: ${C.primary};
          color: ${C.primary};
        }
        .profile-action {
          border: none;
          border-radius: ${R.full};
          padding: 13px 18px;
          font-size: ${TEXT.sm};
          font-weight: 800;
          font-family: ${FONT.sans};
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity .15s, transform .15s;
        }
        .profile-action:hover {
          transform: translateY(-1px);
        }
        .profile-action:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
        }
        @media (max-width: 720px) {
          .profile-page {
            padding: ${S.lg} ${S.md} ${S.sm};
          }
          .profile-main {
            grid-template-columns: 1fr;
            padding: ${S.md};
          }
        }
      `}</style>

      <AppShell activeNav="profilo">
        <main className="profile-page">
          <div className="profile-wrap">
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: S.md, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: TEXT.sm, color: C.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} color={C.muted} weight="fill" />
                  Profilo
                </div>
                <h1 style={{ fontSize: TEXT.xxl, color: C.ink, marginTop: '6px', lineHeight: 1.15 }}>
                  @{username || 'utente'}
                </h1>
                <p style={{ color: C.muted, fontSize: TEXT.base, marginTop: '6px', lineHeight: 1.5 }}>
                  Identita, bio e preferenze film.
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="profile-action"
                style={{ background: C.bg, color: C.error, border: `1.5px solid ${C.errorLight}` }}
              >
                <SignOut size={18} weight="bold" />
                Logout
              </button>
            </header>

            <section className="profile-panel profile-main">
              <aside style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: S.md }}>
                <div
                  style={{
                    width: '148px',
                    height: '148px',
                    borderRadius: '50%',
                    background: visibleAvatarUrl ? C.borderSoft : fallbackColor,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '52px',
                    fontWeight: 900,
                    boxShadow: SHADOW.md,
                  }}
                >
                  {visibleAvatarUrl ? (
                    <img
                      src={visibleAvatarUrl}
                      alt="Avatar profilo"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="profile-action"
                  style={{ background: C.primaryLight, color: C.primary }}
                >
                  <Camera size={18} weight="bold" />
                  {uploading ? 'Upload...' : 'Cambia avatar'}
                </button>

                <div style={{ textAlign: 'center', maxWidth: '220px' }}>
                  <div style={{ fontSize: TEXT.sm, color: C.ink, fontWeight: 800 }}>
                    {email}
                  </div>

                </div>
              </aside>

              <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
                <label className="profile-field">
                  <span className="profile-label">Username</span>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: C.muted,
                        fontWeight: 800,
                      }}
                    >
                      @
                    </span>
                    <input
                      className="profile-input"
                      value={username}
                      onChange={(event) => {
                        setUsername(normalizeUsername(event.target.value));
                        setMessage('');
                        setError('');
                      }}
                      minLength={3}
                      maxLength={20}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      style={{ ...input.base, paddingLeft: '32px', fontWeight: 800 }}
                    />
                  </div>
                </label>

                <label className="profile-field">
                  <span className="profile-label">Email</span>
                  <input
                    value={email}
                    disabled
                    style={{ ...input.base, color: C.muted, background: C.bgSoft }}
                  />
                </label>

                <label className="profile-field">
                  <span className="profile-label">Bio</span>
                  <textarea
                    className="profile-textarea"
                    value={bio}
                    onChange={(event) => {
                      setBio(event.target.value.slice(0, 220));
                      setMessage('');
                    }}
                    placeholder="Racconta che tipo di film cerchi..."
                    rows={5}
                    style={{
                      ...input.base,
                      minHeight: '126px',
                      resize: 'vertical',
                      lineHeight: 1.55,
                    }}
                  />
                  <span style={{ fontSize: TEXT.xs, color: C.faint, alignSelf: 'flex-end' }}>
                    {bio.length}/220
                  </span>
                </label>

                <div className="profile-field">
                  <span className="profile-label">Generi preferiti</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px' }}>
                    {GENRES.map((genre) => {
                      const selected = favoriteGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`genre-chip${selected ? ' active' : ''}`}
                        >
                          {selected && <Check size={13} weight="bold" style={{ marginRight: '5px', verticalAlign: '-2px' }} />}
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(error || message) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: R.md,
                      padding: '12px 14px',
                      fontSize: TEXT.sm,
                      color: error ? C.error : C.success,
                      background: error ? C.errorLight : C.successLight,
                      fontWeight: 700,
                    }}
                  >
                    {error ? <Warning size={17} weight="fill" /> : <Check size={17} weight="bold" />}
                    {error || message}
                  </div>
                )}

                <button
                  onClick={saveProfile}
                  disabled={saving || uploading}
                  className="profile-action"
                  style={{ background: C.primary, color: '#fff', boxShadow: '0 4px 16px rgba(232,56,109,.25)' }}
                >
                  <FloppyDisk size={18} weight="bold" />
                  {saving ? 'Salvataggio...' : 'Salva profilo'}
                </button>
              </div>
            </section>
          </div>
        </main>
      </AppShell>
    </>
  );
}
