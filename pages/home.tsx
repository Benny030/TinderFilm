'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/utils/supabase/browser';
import { generateRoomCode } from '@/utils/roomCode';
import AppShell from '@/components/layout/AppShell';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';
import type { Movie } from '@/types';

type RecentRoom = {
  id: string;
  memberCount: number;
  lastUsed: string;
};

export default function HomePage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading, guestName } = useAuth();
  const supabase = useRef(createBrowserClient()).current;

  const [topMovies, setTopMovies] = useState<Movie[]>([]);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [mounted, setMounted] = useState(false);

  // ─── Nome da mostrare ─────────────────────────────────────────────────────
  const displayName = currentUser && !currentUser.isGuest
    ? currentUser.username
    : guestName ?? 'Ospite';

  const firstName = displayName.split(/(?=[A-Z])/)[0]; // per ospiti tipo "fluffyCookie" → "fluffy"

  // ─── Redirect se non autenticato ─────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!currentUser && !isGuest) router.replace('/auth');
  }, [currentUser, isGuest, isLoading]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ─── Carica film più votati (più like negli swipe) ────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingMovies(true);
      try {
        const { data } = await supabase.from('movies').select('*').limit(8);
        if (data) setTopMovies(data as Movie[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMovies(false);
      }
    };
    load();
  }, []);

  // ─── Stanze recenti da localStorage ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('cineDateRecentRooms');
    if (stored) {
      try {
        setRecentRooms(JSON.parse(stored));
      } catch { /* ignora */ }
    }
  }, []);

  // ─── Crea nuova stanza ────────────────────────────────────────────────────
  const handleCreateRoom = () => {
    const code = generateRoomCode();
    router.push(`/stanza?room=${code}`);
  };

  // ─── Entra in stanza esistente ────────────────────────────────────────────
  const handleEnterRoom = (roomId: string) => {
    router.push(`/stanza?room=${roomId}`);
  };

  if (isLoading || (!currentUser && !isGuest)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '32px' }}>🎬</span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .home-movie-card {
          flex-shrink: 0;
          width: 110px;
          cursor: pointer;
          transition: transform .2s;
        }
        .home-movie-card:hover { transform: translateY(-4px); }
        .home-movie-card img {
          width: 100%; aspect-ratio: 2/3;
          object-fit: cover; border-radius: ${R.md};
          background: ${C.bgSoft};
          box-shadow: ${SHADOW.sm};
        }
        .home-room-card {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          background: ${C.bg};
          border: 1.5px solid ${C.border};
          border-radius: ${R.md};
          cursor: pointer;
          transition: border-color .15s, box-shadow .15s;
        }
        .home-room-card:hover {
          border-color: ${C.primary};
          box-shadow: ${SHADOW.sm};
        }
        .btn-enter {
          background: ${C.primaryLight};
          color: ${C.primary};
          border: none; border-radius: ${R.full};
          padding: 7px 16px; font-size: ${TEXT.sm};
          font-weight: 600; cursor: pointer;
          font-family: ${FONT.sans};
          transition: background .15s;
          white-space: nowrap;
        }
        .btn-enter:hover { background: #ffd0e0; }
        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
        }
        .section-title { font-size: ${TEXT.md}; font-weight: 700; color: ${C.ink}; }
        .section-link {
          font-size: ${TEXT.sm}; color: ${C.primary}; font-weight: 600;
          background: none; border: none; cursor: pointer;
          font-family: ${FONT.sans}; padding: 0;
        }
        .scroll-row {
          display: flex; gap: 12px;
          overflow-x: auto; padding-bottom: 4px;
          scrollbar-width: none;
        }
        .scroll-row::-webkit-scrollbar { display: none; }
      `}</style>

      <AppShell activeNav="home">
        <div
            style={{
                opacity: mounted ? 1 : 0,
                transition: 'opacity 0.3s ease',
            }}>
             <div className="home-desktop-grid">


                {/* ── Colonna principale ─────────────────────────────────────────── */}
                <div className="home-desktop-main">

                    {/* ── HEADER ────────────────────────────────────────────────────── */}
                    <div style={{
                        padding: `${S.lg} ${S.md} ${S.sm}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div>
                        <div style={{ fontSize: TEXT.sm, color: C.muted, marginBottom: '2px' }}>
                            Ciao {firstName}! 👋
                        </div>
                        <div style={{ fontSize: TEXT.xl, fontWeight: '800', color: C.ink, lineHeight: 1.2 }}>
                            Pronto a trovare<br />
                            il film <span style={{ color: C.primary }}>perfetto?</span>
                        </div>
                        </div>

                        {/* Avatar / notifiche */}
                        <div style={{ display: 'flex', gap: S.sm, alignItems: 'center' }}>
                        <button style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: C.bgSoft, border: `1px solid ${C.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '18px',
                        }}>
                            🔔
                        </button>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: C.primaryLight,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: TEXT.base, fontWeight: '700', color: C.primary,
                            cursor: 'pointer',
                        }}
                            onClick={() => router.push('/profilo')}
                        >
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                        </div>
                    </div>

                
             {/* ── Colonna laterale desktop ───────────────────────────────────── */}
    <div className="home-desktop-side">

      {/* Stanze recenti — su desktop vanno nella sidebar */}
      {recentRooms.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: R.lg,
          border: `1.5px solid ${C.border}`,
          padding: S.md, display: 'none',  // visibile solo su desktop via CSS
        }}
          className="home-side-card"
        >
          <div className="section-title" style={{ marginBottom: S.sm }}>
            Stanze recenti
          </div>
          {recentRooms.slice(0, 3).map((room) => (
            <div key={room.id} className="home-room-card" onClick={() => handleEnterRoom(room.id)}
              style={{ marginBottom: S.xs }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
                <span style={{ fontSize: '20px' }}>🎬</span>
                <span style={{ fontSize: TEXT.sm, fontWeight: '600', fontFamily: FONT.mono }}>
                  {room.id}
                </span>
              </div>
              <button className="btn-enter">Entra</button>
            </div>
          ))}
        </div>
      )}

      {/* Banner ospite — su desktop nella sidebar */}
      {isGuest && (
        <div style={{
          background: `linear-gradient(135deg, ${C.primary} 0%, #c0254f 100%)`,
          borderRadius: R.lg, padding: S.lg, color: '#fff',
          display: 'flex', flexDirection: 'column', gap: S.sm,
        }}>
          <div style={{ fontSize: TEXT.base, fontWeight: '700' }}>
            Registrati per fare di più 🚀
          </div>
          <div style={{ fontSize: TEXT.sm, opacity: 0.85, lineHeight: 1.5 }}>
            Salva i match, scrivi recensioni e accedi alle stanze recenti.
          </div>
          <button
            onClick={() => router.push('/auth')}
            style={{
              background: '#fff', color: C.primary, border: 'none',
              borderRadius: R.full, padding: '10px 20px',
              fontSize: TEXT.sm, fontWeight: '700',
              cursor: 'pointer', fontFamily: FONT.sans,
              alignSelf: 'flex-start',
            }}
          >
            Crea account gratuito
          </button>
          
        </div>
      )}

    </div>
                </div>
          {/* ── CTA PRINCIPALE ────────────────────────────────────────────── */}
          <div style={{ padding: `${S.sm} ${S.md}` }}>
            <button
              onClick={handleCreateRoom}
              style={{
                width: '100%', padding: '16px',
                background: C.primary, color: '#fff',
                border: 'none', borderRadius: R.full,
                fontSize: TEXT.base, fontWeight: '700',
                cursor: 'pointer', fontFamily: FONT.sans,
                boxShadow: `0 4px 20px rgba(232,56,109,.3)`,
                transition: 'opacity .15s',
                marginBottom: S.sm,
              }}
            >
              🎬 Crea o entra in una stanza
            </button>

            <button
              onClick={() => router.push('/auth')}
              style={{
                width: '100%', padding: '14px',
                background: 'transparent', color: C.primary,
                border: `1.5px solid ${C.primary}`,
                borderRadius: R.full,
                fontSize: TEXT.base, fontWeight: '600',
                cursor: 'pointer', fontFamily: FONT.sans,
              }}
            >
              Accedi come ospite
            </button>
          </div>

          {/* ── STANZE RECENTI ────────────────────────────────────────────── */}
          {recentRooms.length > 0 && (
            <div style={{ padding: `${S.lg} ${S.md} ${S.sm}` }}>
              <div className="section-header">
                <span className="section-title">Le stanze recenti</span>
                <button className="section-link">Vedi tutte →</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
                {recentRooms.slice(0, 3).map((room) => (
                  <div key={room.id} className="home-room-card" onClick={() => handleEnterRoom(room.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: R.sm,
                        background: C.primaryLight,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px',
                      }}>
                        🎬
                      </div>
                      <div>
                        <div style={{ fontSize: TEXT.base, fontWeight: '600', color: C.ink, fontFamily: FONT.mono }}>
                          {room.id}
                        </div>
                        <div style={{ fontSize: TEXT.xs, color: C.muted, marginTop: '2px' }}>
                          {room.memberCount} {room.memberCount === 1 ? 'membro' : 'membri'}
                        </div>
                      </div>
                    </div>
                    <button className="btn-enter">Entra</button>
                  </div>
                ))}
              </div>
            </div>
            
          )}

          {/* ── Stato vuoto stanze ────────────────────────────────────────── */}
          {recentRooms.length === 0 && (
            <div style={{ padding: `${S.lg} ${S.md} ${S.sm}` }}>
              <div className="section-header">
                <span className="section-title">Le stanze recenti</span>
              </div>
              <div style={{
                padding: S.lg, background: C.bgSoft,
                borderRadius: R.md, textAlign: 'center',
                border: `1.5px dashed ${C.border}`,
              }}>
                <div style={{ fontSize: '28px', marginBottom: S.sm }}>🏠</div>
                <div style={{ fontSize: TEXT.sm, color: C.muted, lineHeight: 1.6 }}>
                  Non hai ancora stanze recenti.<br />
                  Creane una e invita il tuo partner!
                </div>
              </div>
            </div>
          )}

          {/* ── FILM PIÙ VOTATI ───────────────────────────────────────────── */}
          <div style={{ padding: `${S.lg} ${S.md} ${S.sm}` }}>
            <div className="section-header">
              <span className="section-title">I film più votati oggi</span>
              <button className="section-link">Vedi tutti →</button>
            </div>

            {loadingMovies ? (
              <div style={{ display: 'flex', gap: '12px', overflow: 'hidden' }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{
                    flexShrink: 0, width: '110px',
                    height: '165px', borderRadius: R.md,
                    background: C.bgSoft,
                    animation: 'pulse 1.5s ease infinite',
                  }} />
                ))}
              </div>
            ) : (
              <div className="scroll-row">
                {topMovies.map((movie, i) => (
                  <div key={movie.id} className="home-movie-card">
                    <div style={{ position: 'relative' }}>
                      <img
                        src={movie.cover?.startsWith('http') ? movie.cover : 'https://placehold.co/110x165/f8f8f8/aaa?text=🎬'}
                        alt={movie.title}
                        loading="lazy"
                      />
                      {/* Badge posizione */}
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
                      <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                        {movie.year} · {movie.genre}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── BANNER OSPITE ─────────────────────────────────────────────── */}
          {isGuest && (
            <div style={{ padding: `0 ${S.md}` }}>
              <div style={{
                background: `linear-gradient(135deg, ${C.primary} 0%, #c0254f 100%)`,
                borderRadius: R.lg, padding: S.lg, color: '#fff',
                display: 'flex', flexDirection: 'column', gap: S.sm,
              }}>
                <div style={{ fontSize: TEXT.md, fontWeight: '700' }}>
                  Registrati per fare di più 🚀
                </div>
                <div style={{ fontSize: TEXT.sm, opacity: 0.85, lineHeight: 1.5 }}>
                  Salva i match, scrivi recensioni e accedi alle stanze recenti.
                </div>
                <button
                  onClick={() => router.push('/auth')}
                  style={{
                    background: '#fff', color: C.primary,
                    border: 'none', borderRadius: R.full,
                    padding: '11px 24px', fontSize: TEXT.sm,
                    fontWeight: '700', cursor: 'pointer',
                    fontFamily: FONT.sans, alignSelf: 'flex-start',
                    marginTop: S.xs,
                  }}
                >
                  Crea account gratuito
                </button>
              </div>
            </div>
            
          )}
</div>
        </div>
      </AppShell>
    </>
  );
}