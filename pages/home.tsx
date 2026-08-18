'use client';

import { useEffect, useState, useRef, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/utils/supabase/browser';
import { getRecentRooms, type RecentRoom } from '@/utils/recentRoom';
import { normalizeRoomCode } from '@/utils/roomCode';
import AppShell from '@/components/layout/AppShell';
import { useTheme } from '@/context/ThemeContext';

import {
  Bell, FilmSlate, House, ArrowRight,
  Door, Star, Confetti,
  UsersThree, TrendUp, Sparkle,
  InstagramLogo, TiktokLogo, XLogo,
  Sun, Moon, FilmStrip,
  Heart, Clock, HandWavingIcon, Medal,
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

const FEATURES = [
  { icon: UsersThree, title: 'Trova il tuo match', desc: 'Persone con i tuoi stessi gusti' },
  { icon: FilmSlate,  title: 'Scopri cosa vedere', desc: 'Consigli su misura per te' },
  { icon: Confetti,   title: 'Vivi il cinema',      desc: 'Insieme è meglio' },
];

const SUGGESTIONS = [
  { icon: UsersThree, title: 'Film simili a quelli che ami', desc: 'Altri titoli che potrebbero piacerti' },
  { icon: TrendUp,     title: 'Top del momento',              desc: 'I film più votati della community' },
  { icon: Sparkle,     title: 'Scelte della community',       desc: 'I consigli più popolari degli utenti' },
];

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const router = useRouter();
  const { currentUser, isGuest, isLoading, guestName } = useAuth();
  const supabase = useRef(createBrowserClient()).current;

  const [trending, setTrending] = useState<TmdbMovie[]>([]);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [fallbackUsername, setFallbackUsername] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

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
    setRecentRooms(getRecentRooms());
  }, []);

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

  const handleCreateRoom = () => router.push('/crea-stanza?tab=create');
  const handleJoinRoom = () => router.push('/crea-stanza?tab=join');
  const handleEnterRoom = (roomId: string) => router.push(`/stanza?room=${roomId}`);

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

  return (
    <>
      <AppShell activeNav="home">
        <div className="home-cine" style={{ ...homeThemeVars, opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}>

          {/* ─── HERO HEADER ──────────────────────────────────────────── */}
          <div style={{
            padding: '28px 20px 16px',
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
                fontSize: '32px',
                fontWeight: '800',
                color: P.text,
                lineHeight: 1.15,
                marginBottom: '4px',
                letterSpacing: '-0.02em',
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
                <span>Pronto per il tuo</span>
                <span style={{
                  color: P.gold,
                  fontWeight: '700',
                  background: P.goldGlow,
                  padding: '2px 12px',
                  border: `1px solid ${P.gold}25`,
                  fontSize: '14px',
                }}>
                  film perfetto
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

              {/* ─── FEATURE PILLS (desktop) ───────────────────────────── */}
              <div className="desktop-only" style={{
                padding: '8px 0 8px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '14px',
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
                    🎬
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

              {/* ─── TRENDING MOVIES ──────────────────────────────────── */}
              <div style={{ padding: '18px 20px 6px' }}>
                <div className="section-header">
                  <span className="section-title">
                    <span className="accent-line" />
                    <Star size={17} color={P.gold} weight="fill" />
                    In tendenza questa settimana
                  </span>
                  <button className="section-link">Vedi tutti <ArrowRight size={13} /></button>
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

              {/* ─── SPUNTI PER TE ────────────────────────────────────── */}
              <div style={{ padding: '16px 20px 4px' }}>
                <div className="section-header">
                  <div>
                    <span className="section-title">
                      <span className="accent-line" />
                      <Sparkle size={17} color={P.gold} weight="fill" />
                      Spunti per te
                    </span>
                    <div style={{ fontSize: '12.5px', color: P.textFaint, marginTop: '2px' }}>
                      Scopri nuove idee in base ai tuoi gusti
                    </div>
                  </div> 
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
                  {SUGGESTIONS.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.title} className={`suggestion-card animate-in animate-in-delay-${i + 1}`}>
                        <div className="suggestion-icon"><Icon size={19} color={P.pink} weight="fill" /></div>
                        <div>
                          <div className="suggestion-title">{s.title}</div>
                          <div className="suggestion-desc">{s.desc}</div>
                        </div>
                        <span className="suggestion-more">
                          Scopri di più <ArrowRight size={12} weight="bold" />
                        </span>
                      </div>
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
                    🍿
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
                      Il cinema è meglio insieme
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.75)',
                      lineHeight: 1.6,
                      marginBottom: '14px',
                      maxWidth: '460px',
                    }}>
                      Crea una stanza, invita i tuoi amici e iniziate subito a guardare qualcosa di straordinario.
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
                <div style={{
                  fontSize: '13.5px',
                  fontWeight: '700',
                  color: P.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  letterSpacing: '-0.01em',
                }}>
                  <Clock size={16} color={P.gold} weight="fill" />
                  Stanze recenti
                </div>

                {recentRooms.length === 0 ? (
                  <div style={{
                    fontSize: '12px',
                    color: P.textFaint,
                    textAlign: 'center',
                    padding: '12px 0',
                    fontStyle: 'italic',
                  }}>
                    Nessuna stanza recente
                  </div>
                ) : (
                  <>
                    {recentRooms.slice(0, 4).map((room) => (
                      <div key={room.id} className="room-card" onClick={() => handleEnterRoom(room.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            background: P.pink + '18',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <FilmSlate size={14} color={P.pink} weight="fill" />
                          </div>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            fontFamily: FONT_MONO,
                            letterSpacing: '1px',
                            color: P.text,
                          }}>
                            {room.id}
                          </span>
                        </div>
                        <button className="btn-enter">Entra</button>
                      </div>
                    ))}
                    <button className="section-link" style={{ marginTop: '6px', fontSize: '12px' }}>
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
                    Registrati 🚀
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
                  Registrati per fare di più 🚀
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