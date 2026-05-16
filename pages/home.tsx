'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { generateRoomCode } from '@/utils/roomCode';
import { getRecentRooms, type RecentRoom } from '@/utils/recentRoom';
import AppShell from '@/components/layout/AppShell';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';

import {
  Bell, FilmSlate, House, ArrowRight,
  Door, Star, Users, SignIn,
} from '@phosphor-icons/react';

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

export default function HomePage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading, guestName } = useAuth();

  const [trending, setTrending] = useState<TmdbMovie[]>([]);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [mounted, setMounted] = useState(false);

  const displayName = currentUser && !currentUser.isGuest
    ? currentUser.username
    : guestName ?? 'Ospite';

  const firstName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser && !isGuest) router.replace('/auth');
  }, [currentUser, isGuest, isLoading]);

  useEffect(() => {
    setMounted(true);
    setRecentRooms(getRecentRooms());
  }, []);

  // ─── Carica trending TMDB ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingTrending(true);
      try {
        const res = await fetch('/api/tmdb/trending');
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTrending(data.movies ?? []);
      } catch {
        console.error('Errore caricamento trending');
      } finally {
        setLoadingTrending(false);
      }
    };
    load();
  }, []);

  const handleCreateRoom = () => {
    const code = generateRoomCode();
    router.push(`/stanza?room=${code}`);
  };

  const handleEnterRoom = (roomId: string) => {
    router.push(`/stanza?room=${roomId}`);
  };
  // ─── Drag to scroll su desktop ────────────────────────────────────────────────
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FilmSlate size={40} color={C.primary} weight="duotone" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s ease infinite;
          border-radius: ${R.md};
        }
        .movie-card-scroll {
          flex-shrink: 0;
          width: 120px;
          cursor: pointer;
          transition: transform .2s;
        }
        .movie-card-scroll:hover { transform: translateY(-4px); }
        .movie-card-scroll img {
          width: 100%; aspect-ratio: 2/3;
          object-fit: cover; border-radius: ${R.md};
          box-shadow: ${SHADOW.sm};
          background: #f0f0f0;
        }
        .room-card {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          background: ${C.bg};
          border: 1.5px solid ${C.border};
          border-radius: ${R.md};
          cursor: pointer;
          transition: border-color .15s, box-shadow .15s;
          margin-bottom: 10px;
        }
        .room-card:hover { border-color: ${C.primary}; box-shadow: ${SHADOW.sm}; }
        .btn-enter {
          background: ${C.primaryLight};
          color: ${C.primary};
          border: none; border-radius: ${R.full};
          padding: 7px 16px; font-size: ${TEXT.sm};
          font-weight: 600; cursor: pointer;
          font-family: ${FONT.sans};
          white-space: nowrap;
          display: flex; align-items: center; gap: 4px;
          transition: background .15s;
        }
        .btn-enter:hover { background: #ffd0e0; }
        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px;
        }
        .section-title {
          font-size: ${TEXT.md}; font-weight: 700; color: ${C.ink};
          display: flex; align-items: center; gap: 8px;
        }
        .section-link {
          font-size: ${TEXT.sm}; color: ${C.primary}; font-weight: 600;
          background: none; border: none; cursor: pointer;
          font-family: ${FONT.sans}; padding: 0;
          display: flex; align-items: center; gap: 4px;
        }
        .scroll-row {
          display: flex;
          gap: 14px;
          overflow-x: auto; 
          padding-bottom: 8px;
          scrollbar-width: none;
        }
        .scroll-row::-webkit-scrollbar { display: none; }
        .rating-badge {
          display: inline-flex; 
          align-items: center;
           gap: 3px;
          font-size: 11px; 
          font-weight: 700;
           color: #f59e0b;
          margin-top: 3px;
        }
        @media (min-width: 1024px) {
          .home-layout {
            display: grid;
            grid-template-columns: 1fr 300px;
            gap: 32px;
            padding: 32px;
          }
          .home-sidebar { display: flex; flex-direction: column; gap: 24px; }
          .home-main { min-width: 0; }
          .mobile-only { display: none !important; }
        }
        @media (max-width: 1023px) {
          .home-layout { display: contents; }
          .home-sidebar { display: contents; }
          .home-main { display: contents; }
          .desktop-only { display: none !important; }
        }
        @media (min-width: 1024px) {
            .scroll-row {
            overflow-x: auto !important;
            cursor: grab;

            }
            .scroll-row:active {
              cursor: grabbing;
            }
          }
      `}</style>

      <AppShell activeNav="home">
        <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.3s ease' }}>

          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div style={{
            padding: `${S.lg} ${S.md} ${S.sm}`,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: TEXT.sm, color: C.muted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <House size={14} color={C.muted} weight="fill" />
                Home
              </div>
              <div style={{ fontSize: TEXT.xl, fontWeight: '800', color: C.ink, lineHeight: 1.2 }}>
                Ciao {firstName}! 👋
              </div>
              <div style={{ fontSize: TEXT.base, color: C.muted, marginTop: '2px' }}>
                Pronto a trovare il film <span style={{ color: C.primary, fontWeight: '600' }}>perfetto?</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: C.bgSoft, border: `1.5px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <Bell size={18} color={C.muted} weight="regular" />
              </button>
              <div
                onClick={() => router.push('/profilo')}
                style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: C.primaryLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: TEXT.md, fontWeight: '700', color: C.primary,
                  cursor: 'pointer',
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          <div className="home-layout">

            {/* ── COLONNA PRINCIPALE ────────────────────────────────────── */}
            <div className="home-main">

              {/* CTA stanza */}
              <div style={{ padding: `${S.sm} ${S.md}` }} className="mobile-only">
                <button
                  onClick={handleCreateRoom}
                  style={{
                    width: '100%', padding: '16px',
                    background: C.primary, color: '#fff',
                    border: 'none', borderRadius: R.full,
                    fontSize: TEXT.base, fontWeight: '700',
                    cursor: 'pointer', fontFamily: FONT.sans,
                    boxShadow: `0 4px 20px rgba(232,56,109,.3)`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '10px',
                    marginBottom: '10px',
                  }}
                >
                  <FilmSlate size={20} color="#fff" weight="fill" />
                  Crea o entra in una stanza
                </button>

                {isGuest && (
                  <button
                    onClick={() => router.push('/auth')}
                    style={{
                      width: '100%', padding: '14px',
                      background: 'transparent', color: C.primary,
                      border: `1.5px solid ${C.primary}`,
                      borderRadius: R.full, fontSize: TEXT.base,
                      fontWeight: '600', cursor: 'pointer',
                      fontFamily: FONT.sans,
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '8px',
                    }}
                  >
                    <SignIn size={18} color={C.primary} />
                    Accedi o registrati
                  </button>
                )}
              </div>

              {/* Stanze recenti — mobile */}
              <div style={{ padding: `${S.lg} ${S.md} ${S.sm}` }} className="mobile-only">
                <div className="section-header">
                  <span className="section-title">
                    <Door size={18} color={C.primary} weight="fill" />
                    Stanze recenti
                  </span>
                  {recentRooms.length > 0 && (
                    <button className="section-link">
                      Vedi tutte <ArrowRight size={14} />
                    </button>
                  )}
                </div>

                {recentRooms.length === 0 ? (
                  <div style={{
                    padding: S.lg, background: C.bgSoft,
                    borderRadius: R.md, textAlign: 'center',
                    border: `1.5px dashed ${C.border}`,
                  }}>
                    <FilmSlate size={32} color={C.faint} weight="duotone" style={{ marginBottom: S.sm }} />
                    <div style={{ fontSize: TEXT.sm, color: C.muted, lineHeight: 1.6 }}>
                      Nessuna stanza recente.<br />Creane una!
                    </div>
                  </div>
                ) : (
                  recentRooms.slice(0, 3).map((room) => (
                    <div key={room.id} className="room-card" onClick={() => handleEnterRoom(room.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
                        <div style={{
                          width: '42px', height: '42px', borderRadius: R.sm,
                          background: C.primaryLight,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <FilmSlate size={20} color={C.primary} weight="duotone" />
                        </div>
                        <div>
                          <div style={{ fontSize: TEXT.sm, fontWeight: '700', color: C.ink, fontFamily: FONT.mono, letterSpacing: '1px' }}>
                            {room.id}
                          </div>
                          <div style={{ fontSize: TEXT.xs, color: C.muted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={12} color={C.muted} />
                            {room.memberCount} {room.memberCount === 1 ? 'membro' : 'membri'}
                          </div>
                        </div>
                      </div>
                      <button className="btn-enter">
                        Entra <ArrowRight size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Film trending TMDB */}
              <div style={{ padding: `${S.lg} ${S.md} ${S.sm}` }}>
                <div className="section-header">
                  <span className="section-title">
                    <Star size={18} color={C.primary} weight="fill" />
                    In tendenza questa settimana
                  </span>
                  <button className="section-link">
                    Vedi tutti <ArrowRight size={14} />
                  </button>
                </div>

                {loadingTrending ? (
                  <div
                    className="scroll-row"
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseLeave}
                    onMouseUp={onMouseUp}
                    onMouseMove={onMouseMove}
                  >
                    
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} style={{ flexShrink: 0, width: '120px' }}>
                        <div className="skeleton" style={{ width: '120px', height: '180px' }} />
                        <div className="skeleton" style={{ width: '80px', height: '12px', marginTop: '8px' }} />
                        <div className="skeleton" style={{ width: '50px', height: '10px', marginTop: '4px' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="scroll-row">
                    {trending.map((movie, i) => (
                      <div
                        key={movie.id}
                        className="movie-card-scroll"
                        onClick={() => router.push(`/stanza?room=${generateRoomCode()}`)}
                      >
                        <div style={{ position: 'relative' }}>
                          <img
                            src={movie.cover ?? 'https://placehold.co/120x180/f0f0f0/aaa?text=🎬'}
                            alt={movie.title}
                            loading="lazy"
                          />
                          {/* Badge top 3 */}
                          {i < 3 && (
                            <div style={{
                              position: 'absolute', top: '6px', left: '6px',
                              background: C.primary, color: '#fff',
                              borderRadius: R.full, width: '22px', height: '22px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', fontWeight: '800',
                            }}>
                              {i + 1}
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          <div style={{
                            fontSize: '12px', fontWeight: '600', color: C.ink,
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {movie.title}
                          </div>
                          <div style={{ fontSize: '11px', color: C.muted }}>
                            {movie.year}
                          </div>
                          {movie.rating > 0 && (
                            <div className="rating-badge">
                              <Star size={10} color="#f59e0b" weight="fill" />
                              {movie.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* ── SIDEBAR DESKTOP ───────────────────────────────────────── */}
            <div className="home-sidebar desktop-only">

              {/* CTA stanza */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={handleCreateRoom}
                  style={{
                    width: '100%', padding: '14px',
                    background: C.primary, color: '#fff',
                    border: 'none', borderRadius: R.full,
                    fontSize: TEXT.sm, fontWeight: '700',
                    cursor: 'pointer', fontFamily: FONT.sans,
                    boxShadow: `0 4px 16px rgba(232,56,109,.25)`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '8px',
                  }}
                >
                  <FilmSlate size={18} color="#fff" weight="fill" />
                  Crea una stanza
                </button>
              </div>

              {/* Stanze recenti desktop */}
              <div style={{
                background: C.bg, borderRadius: R.lg,
                border: `1.5px solid ${C.border}`, padding: S.md,
              }}>
                <div className="section-header" style={{ marginBottom: S.sm }}>
                  <span style={{ fontSize: TEXT.base, fontWeight: '700', color: C.ink, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Door size={16} color={C.primary} weight="fill" />
                    Stanze recenti
                  </span>
                </div>

                {recentRooms.length === 0 ? (
                  <div style={{ fontSize: TEXT.xs, color: C.muted, textAlign: 'center', padding: `${S.sm} 0` }}>
                    Nessuna stanza recente
                  </div>
                ) : (
                  recentRooms.slice(0, 4).map((room) => (
                    <div
                      key={room.id}
                      className="room-card"
                      onClick={() => handleEnterRoom(room.id)}
                      style={{ marginBottom: '8px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FilmSlate size={18} color={C.primary} weight="duotone" />
                        <span style={{ fontSize: TEXT.xs, fontWeight: '700', fontFamily: FONT.mono, letterSpacing: '1px' }}>
                          {room.id}
                        </span>
                      </div>
                      <button className="btn-enter" style={{ padding: '5px 12px', fontSize: '11px' }}>
                        Entra
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Banner ospite desktop */}
              {isGuest && (
                <div style={{
                  background: `linear-gradient(135deg, ${C.primary} 0%, #c0254f 100%)`,
                  borderRadius: R.lg, padding: S.md, color: '#fff',
                }}>
                  <div style={{ fontSize: TEXT.base, fontWeight: '700', marginBottom: '6px' }}>
                    Registrati 🚀
                  </div>
                  <div style={{ fontSize: TEXT.xs, opacity: 0.85, lineHeight: 1.5, marginBottom: S.sm }}>
                    Salva i match e scrivi recensioni.
                  </div>
                  <button
                    onClick={() => router.push('/auth')}
                    style={{
                      background: '#fff', color: C.primary, border: 'none',
                      borderRadius: R.full, padding: '9px 18px',
                      fontSize: TEXT.xs, fontWeight: '700',
                      cursor: 'pointer', fontFamily: FONT.sans,
                    }}
                  >
                    Crea account gratuito
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* Banner ospite mobile */}
          {isGuest && (
            <div style={{ padding: `0 ${S.md} ${S.lg}` }} className="mobile-only">
              <div style={{
                background: `linear-gradient(135deg, ${C.primary} 0%, #c0254f 100%)`,
                borderRadius: R.lg, padding: S.lg, color: '#fff',
              }}>
                <div style={{ fontSize: TEXT.md, fontWeight: '700', marginBottom: '6px' }}>
                  Registrati per fare di più 🚀
                </div>
                <div style={{ fontSize: TEXT.sm, opacity: 0.85, lineHeight: 1.5, marginBottom: S.md }}>
                  Salva i match, scrivi recensioni e accedi alle stanze recenti.
                </div>
                <button
                  onClick={() => router.push('/auth')}
                  style={{
                    background: '#fff', color: C.primary, border: 'none',
                    borderRadius: R.full, padding: '11px 24px',
                    fontSize: TEXT.sm, fontWeight: '700',
                    cursor: 'pointer', fontFamily: FONT.sans,
                  }}
                >
                  Crea account gratuito
                </button>
              </div>
            </div>
          )}

        </div>
      </AppShell>
    </>
  );
}