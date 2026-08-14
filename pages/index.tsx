'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { FONT, TEXT, S, SHADOW, C, R } from '@/styles/token';
import {
  Bell,
  FilmSlate,
  House,
  ArrowRight,
  Door,
  Star,
  Users,
  Sun,
  Moon,
  Confetti,
  Popcorn,
  Heart,
} from '@phosphor-icons/react';

// ─── Palette dark ───────────
const D = {
  bg: '#0a0908',
  bgSoft: '#120e10',
  card: '#1a1315',
  border: '#2a1c22',
  gold: '#f5b92f',
  goldSoft: '#ffd875',
  pink: '#ed3d73',
  pinkDeep: '#8e1740',
  paper: '#fff7e8',
  ink: '#171419',
  text: '#ffffff',
  textMuted: '#b9aeb0',
  textFaint: '#8a7f82',
};

// ─── Palette light ───────────
const L = {
  bg: '#faf7f2',
  bgSoft: '#f0ebe3',
  card: '#ffffff',
  border: '#ddd5c8',
  gold: '#c69214',
  goldSoft: '#f5d062',
  pink: '#c72c5c',
  pinkDeep: '#9c1d47',
  paper: '#fff7e8',
  ink: '#1f1b18',
  text: '#1f1b18',
  textMuted: '#5c5650',
  textFaint: '#8a8278',
};

const FEATURES = [
  { icon: Users, title: 'TROVA IL TUO MATCH', desc: 'Persone con i tuoi stessi gusti' },
  { icon: FilmSlate, title: 'SCOPRI COSA VEDERE', desc: 'Consigli su misura per te' },
  { icon: Confetti, title: 'VIVI IL CINEMA', desc: 'Insieme è meglio' },
];

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

export default function LandingPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const { enterAsGuest } = useAuth();

  const [trending, setTrending] = useState<TmdbMovie[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [ticketPhase, setTicketPhase] = useState<'entering' | 'floating'>('entering');
  const [isLightMode, setIsLightMode] = useState(false);

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
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const timeout = setTimeout(() => setLoadingTimedOut(true), 5000);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (currentUser || isGuest) {
      router.replace('/');
    }
  }, [currentUser, isGuest, isLoading]);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => setTicketPhase('floating'), 2000);
    return () => clearTimeout(timer);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const elements = document.querySelectorAll('[data-reveal]');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [mounted, trending]);

  const handleGuest = () => {
    enterAsGuest();
    window.location.href = '/home';
  };

  if (isLoading && !loadingTimedOut) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isLightMode ? L.bg : D.bg,
        }}
      >
        <FilmSlate size={32} color={isLightMode ? L.pink : D.pink} weight="fill" />
      </div>
    );
  }

  const trendingMovie = trending?.[0];

  return (
    <>
      <div className={`land ${isLightMode ? 'light-mode' : ''}`}>
        <nav className="nav">
          <div className="nav-logo" onClick={() => router.push('/')}>
            <span className="nav-logo-text">
              CINE<span style={{ color: isLightMode ? L.pink : D.pink }}>DATE</span>
            </span>
          </div>
          <div className="nav-links">
            <button className="nav-link">Come funziona</button>
            <button className="nav-link">Recensioni</button>
            <button className="nav-link">Cinema vicino a te</button>
          </div>
          <div className="nav-cta">
            <button
              className="btn-sm-ghost"
              onClick={() => setIsLightMode(!isLightMode)}
              title="Cambia tema"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="btn-sm-ghost" onClick={() => router.push('/auth')}>
              Accedi
            </button>
            <button className="btn-sm-primary" onClick={() => router.push('/auth')}>
              Registrati 
            </button>
          </div>
        </nav>

        <div className="hero-wrap">
          <div className="hero-filmstrip" />
          <div className="hero-glow" />

          <section className="hero" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease' }}>
            <div>
              <span className="hero-eyebrow">
                Biglietto n. 0042 — per chi ama il cinema in compagnia
              </span>
              <h1 className="hero-h1">
                Trova il film<br />
                perfetto, <em>insieme.</em>
              </h1>
              <p className="hero-sub">
                <em>Swipe i film e le serie</em> che ti incuriosiscono,
                trova il match in comune e iniziate subito la serata.
              </p>
              <div className="hero-btns">
                <button className="btn-hero-primary" onClick={() => router.push('/auth')}>
                  Provalo gratis <ArrowRight size={14} weight="bold" />
                </button>
                <button className="btn-hero-ghost" onClick={handleGuest}>
                  Entra come ospite
                </button>
              </div>
            </div>

            <div className={`ticket-stage ${ticketPhase}`}>
              <div className="ticket-sparkle" />
              {ticketPhase === 'entering' && <div className="ticket-sparkle-burst" />}

              <svg
                className="ticket-img"
                viewBox="0 0 2000 1000"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff7e8" />
                    <stop offset="1" stopColor="#eadbc2" />
                  </linearGradient>
                </defs>

                <path
                  d="M35 28H825a22 22 0 0 1 22 22v82a28 28 0 0 0 0 56v112a22 22 0 0 1-22 22H35a22 22 0 0 1-22-22V188a28 28 0 0 0 0-56V50a22 22 0 0 1 22-22Z"
                  fill="url(#paper)"
                  transform="scale(2.2)"
                />

                <path
                  d="M764 28v304"
                  stroke="#2a2220"
                  strokeWidth="2"
                  strokeDasharray="7 8"
                  opacity=".35"
                  transform="scale(2)"
                />

                <rect x="62" y="72" width="180" height="218" rx="9" fill="#260b18" transform="scale(2)" />

                {trendingMovie?.cover ? (
                  <image
                    href={trendingMovie.cover}
                    x="72" y="82" width="160" height="198"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="inset(0 round 6px)"
                    transform="scale(2)"
                  />
                ) : (
                  <>
                    <rect x="72" y="82" width="160" height="198" rx="6" fill="#ed1f61" opacity=".72" transform="scale(2)" />
                    <circle cx="152" cy="182" r="40" fill="#09080b" transform="scale(2)" />
                    <path d="M103 276c8-58 90-58 98 0" fill="#09080b" transform="scale(2)" />
                  </>
                )}

                <g fill="#171419" fontFamily="Arial, Helvetica, sans-serif" transform="scale(2)">
                  <text x="270" y="94" fontSize="31" fontWeight="800">
                    {trendingMovie?.title || 'OBSESSION'}
                  </text>
                  <text x="270" y="142" fontSize="18">▣ SALA 3</text>
                  <text x="405" y="142" fontSize="18">▣ OGGI 9 AGO</text>
                  <text x="610" y="142" fontSize="18">◷ 21:15</text>
                  <text x="270" y="180" fontSize="18">
                    ★ {trendingMovie?.rating?.toFixed(1) || '8.2'} · 106 MIN
                  </text>
                  <path d="M270 214H700" stroke="#5e5550" strokeWidth="2" strokeDasharray="7 8" opacity=".6" />
                  <text x="270" y="257" fontSize="17">POSTO F12 · VOI DUE</text>
                </g>

                <rect x="475" y="270" width="195" height="48" rx="9" fill="#ed3d73" transform="scale(2)" />
                <text x="572" y="301" textAnchor="middle" fill="white" fontFamily="Arial, Helvetica, sans-serif" fontSize="17" fontWeight="700" transform="scale(2)">♡ È UN MATCH</text>

                <g fill="#181417" transform="scale(2)">
                  <rect x="789" y="88" width="2" height="194" />
                  <rect x="796" y="88" width="5" height="194" />
                  <rect x="806" y="88" width="2" height="194" />
                  <rect x="813" y="88" width="6" height="194" />
                  <rect x="824" y="88" width="3" height="194" />
                  <rect x="835" y="88" width="4" height="194" />
                </g>
              </svg>
            </div>
          </section>
        </div>

        <section className="trending">
          <div style={{ padding: `${S.lg} ${S.md} ${S.sm}` }}>
            <div className="trending-head">
              <span className="trending-title">
                <Star size={18} color={L.gold } weight="fill" />
                In tendenza questa settimana
              </span>
            </div>
          </div>

          <div className="trending-grid">
            {trending.slice(0, 4).map((movie, i) => (
              <div
                key={i}
                className="trend-card"
                data-reveal="true"
                onClick={() => router.push(`/film/${movie.tmdb_id}`)}
              >
                <div className="trend-badge">{i + 1}</div>
                <div
                  className="trend-poster"
                  style={{
                    background: `linear-gradient(160deg , ${isLightMode ? L.bgSoft : D.bgSoft} 0%, ${isLightMode ? L.bgSoft : D.bgSoft} 40%, ${isLightMode ? L.pinkDeep : D.pinkDeep} 100%)`,
                  }}
                >
                  <img
                    src={movie.cover ?? 'https://placehold.co/120x180/f0f0f0/aaa?text=FILM'}
                    alt={movie.title}
                    loading="lazy"
                  />
                </div>
                <div className="trend-info">
                  <div className="trend-name">{movie.title}</div>
                  <div className="trend-genre">{movie.genre}</div>
                  <div className="trend-rating">
                    <Star size={12} weight="fill" style={{ display: 'inline', verticalAlign: 'middle' }} color={L.gold} /> {movie.rating.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="features">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="feature-item" data-reveal="true">
                <div className="feature-icon">
                  <Icon size={24} weight="fill" color={isLightMode ? L.pink : D.pink} />
                </div>
                <div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              </div>
            );
          })}
        </section>

        <img src="/assets/landing/divider.svg" alt="" className="section-divider" />

        <section className="how">
          <div className="how-header">
            <div className="how-label">Come funziona</div>
            <h2 className="how-h2">
              Dal divano al film<br />
              in <span>tre mosse</span>
            </h2>
          </div>

          <div className="how-steps">
            {[
              {
                num: '01',
                icon: House,
                title: 'Crea una stanza',
                desc: 'Crea una stanza e condividi il codice con chi vuoi. Nessun link complicato, nessun account obbligatorio — puoi entrare anche come ospite.',
                tag: 'Inizi in 30 secondi.',
              },
              {
                num: '02',
                icon: FilmSlate,
                title: 'Scorri i film',
                desc: 'Scegli i film che ti interessano in totale libertà. Quando i gusti coincidono, nasce il match.',
                tag: 'Tutto in modo anonimo.',
              },
              {
                num: '03',
                icon: Confetti,
                title: 'Trova il match',
                desc: 'Quando metti like allo stesso film, appare il match. Così trovi subito qualcosa che piace davvero a entrambi.',
                tag: 'Trovare qualcosa da guardare non è mai stato così semplice',
              },
            ].map((step) => {
              const StepIcon = step.icon;
              return (
                <div key={step.num} className="how-step" data-reveal="true">
                  <div className="how-step-num">{step.num}</div>
                  <div className="how-step-content">
                    <span className="how-step-icon">
                      <StepIcon size={20} weight="fill" color={isLightMode ? L.pink : D.pink} />
                    </span>
                    <div className="how-step-title">{step.title}</div>
                    <div className="how-step-desc">{step.desc}</div>
                    <span className="how-step-tag">{step.tag}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="quote-section" data-reveal="true">
          <p className="quote-text">
            "Abbiamo scoperto film che non avremmo mai trovato da soli.
            <em> E scegliere cosa guardare è diventato finalmente semplice</em>."
          </p>
          <div className="quote-author">
            — Giulia & Marco, Milano <Popcorn size={14} weight="fill" style={{ display: 'inline-block', verticalAlign: 'middle' }} color={isLightMode ? L.pink : D.pink} />
          </div>
        </section>

        <section className="final-cta" data-reveal="true">
          <h2>Stasera cosa guardate?</h2>
          <p>
            Create una stanza, scoprite nuovi film
            e trovate subito qualcosa da guardare insieme.
          </p>
          <button
            className="btn-hero-primary"
            onClick={() => router.push('/auth')}
            style={{ width: 'auto', padding: '16px 40px' }}
          >
            Inizia adesso — è gratis <ArrowRight size={14} weight="bold" />
          </button>
        </section>

        <footer className="footer">
          <div className="footer-logo">
            CINE<span style={{ color: isLightMode ? L.pink : D.pink }}>DATE</span>
          </div>
          <div className="footer-copy">
            © 2026 CineDate — Fatto con <Heart size={12} weight="fill" style={{ display: 'inline-block', verticalAlign: 'middle' }} color={isLightMode ? L.pink : D.pink} /> per chi ama il cinema
          </div>
        </footer>
      </div>
    </>
  );
}