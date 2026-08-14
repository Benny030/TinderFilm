'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/utils/supabase/browser';
import { useTheme } from '@/context/ThemeContext';
import {
  Camera,
  Check,
  FilmSlate,
  FloppyDisk,
  SignOut,
  User,
  Warning,
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
  error: '#ef4444',
  success: '#22c55e',
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
  error: '#dc2626',
  success: '#16a34a',
};

const FONT_SANS = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";
const FONT_MONO = "'JetBrains Mono','Courier New',monospace";

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.bg }}>
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
    transition: 'border-color 0.15s ease',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <AppShell activeNav="profilo">
        <main style={{
          minHeight: '100vh',
          background: P.bgSoft,
          padding: '24px 16px',
          fontFamily: FONT_SANS,
        }}>
          <div style={{
            width: '100%',
            maxWidth: 920,
            margin: '0 auto',
            display: 'grid',
            gap: 18,
          }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '13px', color: P.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} color={P.textMuted} weight="fill" />
                  Profilo
                </div>
                <h1 style={{
                  fontSize: '32px',
                  color: P.text,
                  marginTop: '6px',
                  lineHeight: 1.15,
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                }}>
                  @{username || 'utente'}
                </h1>
                <p style={{ color: P.textMuted, fontSize: '15px', marginTop: '6px', lineHeight: 1.5 }}>
                  Identita, bio e preferenze film.
                </p>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  background: P.card,
                  color: P.error,
                  border: `1px solid ${P.error}40`,
                  borderRadius: 0,
                  padding: '13px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: FONT_SANS,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 0.15s, transform 0.15s',
                }}
              >
                <SignOut size={18} weight="bold" />
                Logout
              </button>
            </header>

            <section style={{
              background: P.card,
              border: `1px solid ${P.border}`,
              borderRadius: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'grid',
              gridTemplateColumns: '260px 1fr',
              gap: 22,
              padding: 24,
            }}>
              <aside style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: '148px',
                    height: '148px',
                    borderRadius: '50%',
                    background: visibleAvatarUrl ? P.border : fallbackColor,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '52px',
                    fontWeight: 900,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
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
                  style={{
                    background: P.pinkGlow,
                    color: P.pink,
                    border: 'none',
                    borderRadius: 0,
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: FONT_SANS,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'opacity 0.15s, transform 0.15s',
                  }}
                >
                  <Camera size={18} weight="bold" />
                  {uploading ? 'Upload...' : 'Cambia avatar'}
                </button>

                <div style={{ textAlign: 'center', maxWidth: 220 }}>
                  <div style={{ fontSize: '13px', color: P.text, fontWeight: 700 }}>
                    {email}
                  </div>
                </div>
              </aside>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontSize: '11px', color: P.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                    Username
                  </span>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: P.textMuted,
                        fontWeight: 800,
                        fontFamily: FONT_SANS,
                      }}
                    >
                      @
                    </span>
                    <input
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
                      style={{
                        ...inputStyle,
                        paddingLeft: '32px',
                        fontWeight: 800,
                      }}
                    />
                  </div>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontSize: '11px', color: P.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                    Email
                  </span>
                  <input
                    value={email}
                    disabled
                    style={{
                      ...inputStyle,
                      color: P.textMuted,
                      background: P.bgSoft,
                      cursor: 'not-allowed',
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontSize: '11px', color: P.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                    Bio
                  </span>
                  <textarea
                    value={bio}
                    onChange={(event) => {
                      setBio(event.target.value.slice(0, 220));
                      setMessage('');
                    }}
                    placeholder="Racconta che tipo di film cerchi..."
                    rows={5}
                    style={{
                      ...inputStyle,
                      minHeight: '126px',
                      resize: 'vertical',
                      lineHeight: 1.55,
                    }}
                  />
                  <span style={{ fontSize: '11px', color: P.textFaint, alignSelf: 'flex-end' }}>
                    {bio.length}/220
                  </span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontSize: '11px', color: P.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                    Generi preferiti
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                    {GENRES.map((genre) => {
                      const selected = favoriteGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          style={{
                            border: `1px solid ${selected ? P.pink : P.border}`,
                            background: selected ? P.pinkGlow : 'transparent',
                            color: selected ? P.pink : P.textMuted,
                            borderRadius: 0,
                            padding: '10px 14px',
                            fontSize: '13px',
                            fontWeight: 700,
                            fontFamily: FONT_SANS,
                            cursor: 'pointer',
                            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          {selected && <Check size={13} weight="bold" style={{ marginRight: 5, verticalAlign: -2 }} />}
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
                      gap: 8,
                      borderRadius: 0,
                      padding: '12px 14px',
                      fontSize: '13px',
                      color: error ? P.error : P.success,
                      background: error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                      fontWeight: 700,
                      border: `1px solid ${error ? P.error : P.success}40`,
                    }}
                  >
                    {error ? <Warning size={17} weight="fill" /> : <Check size={17} weight="bold" />}
                    {error || message}
                  </div>
                )}

                <button
                  onClick={saveProfile}
                  disabled={saving || uploading}
                  style={{
                    background: P.pink,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 0,
                    padding: '13px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: FONT_SANS,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: `0 4px 16px ${P.pinkGlow}`,
                    transition: 'opacity 0.15s, transform 0.15s',
                  }}
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