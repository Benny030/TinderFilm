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
  Bell,
  FilmSlate,
  House,
  ArrowRight,
  Door,
  Star,
  Confetti,
  UsersThree,
  TrendUp,
  Sparkle,
  InstagramLogo,
  TiktokLogo,
  XLogo,
  Sun,
  Moon,
  FilmStrip,
  Heart,
  Clock,
  HandWavingIcon,
  Medal,
  Popcorn,
} from '@phosphor-icons/react';

// ─── Palette dark ──────────────────────────────────────────────────────────
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

// ─── Palette light ──────────────────────────────────────────────────────────
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

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const router = useRouter();
  const { currentUser, isGuest, isLoading, guestName, enterAsGuest } = useAuth();
  const supabase = useRef(createBrowserClient()).current;

  const [mounted, setMounted] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [trending, setTrending] = useState<TmdbMovie[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);

  // Stati per il biglietto
  const [ticketState, setTicketState] = useState<'hidden' | 'entering' | 'floating'>('hidden');

  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

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

  // ─── Effetti ──────────────────────────────────────────────────────────────

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
  }, [currentUser, isGuest, isLoading, router]);

  // Sequenza di animazione del biglietto
  useEffect(() => {
    if (!mounted) return;
    const timer1 = setTimeout(() => setTicketState('entering'), 300);
    const timer2 = setTimeout(() => setTicketState('floating'), 2800);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, [mounted]);

  // Caricamento film
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

  // Observer per rivelare gli elementi scroll
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

  const handleJoinByCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = normalizeRoomCode(codeInput);
    if (code.length < 4) { setCodeError('Codice non valido'); return; }
    setCodeError('');
    router.push(`/stanza?room=${code}`);
  };

  const trendingMovie = trending?.[0];

  if (isLoading && !loadingTimedOut) {
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
        <FilmStrip size={32} color={P.pink} weight="duotone" />
      </div>
    );
  }

  // Determina le classi del ticket
  const ticketClasses = ['land-ticket-stage'];
  if (ticketState === 'entering') {
    ticketClasses.push('ticket-visible', 'entering');
  } else if (ticketState === 'floating') {
    ticketClasses.push('ticket-visible', 'floating');
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');

        .landing-cine {
          --home-font: 'Inter', 'Helvetica Neue', sans-serif;
          --home-font-display: 'Playfair Display', Georgia, serif;
          --home-font-mono: 'JetBrains Mono', 'Courier New', monospace;
          --home-bg: #0a0806;
          --home-bg-soft: #14100e;
          --home-card: #1c1613;
          --home-card-hover: #241d19;
          --home-border: #2d221c;
          --home-gold: #f5b92f;
          --home-gold-soft: #ffd875;
          --home-gold-rgb: 245, 185, 47;
          --home-pink: #ed3d73;
          --home-pink-deep: #8e1740;
          --home-pink-rgb: 237, 61, 115;
          --home-text: #f0ebe6;
          --home-text-muted: #b5a89e;
          --home-text-faint: #7a6b60;
          font-family: var(--home-font);
          background: var(--home-bg);
          color: var(--home-text);
          min-height: 100vh;
          letter-spacing: -0.01em;
          overflow-x: hidden;
        }

        .landing-cine *,
        .landing-cine *::before,
        .landing-cine *::after {
          box-sizing: border-box;
        }
        .landing-cine button,
        .landing-cine input {
          border-radius: 0 !important;
        }
        .landing-cine ::selection {
          background: var(--home-pink);
          color: #fff;
        }

        /* ─── KEYFRAMES ──────────────────────────────────────────────────── */
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }

        @keyframes floatBreath {
          0%, 100% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
          30% {
            transform: translateY(-12px) rotate(1.2deg) scale(1.01);
          }
          60% {
            transform: translateY(-6px) rotate(-0.5deg) scale(0.99);
          }
        }

        @keyframes ticketLanding {
          0% {
            transform: scale(0.5) rotate(-15deg);
            opacity: 0;
            filter: blur(20px);
          }
          35% {
            transform: scale(1.08) rotate(3deg);
            opacity: 1;
            filter: blur(0);
          }
          60% {
            transform: scale(0.95) rotate(-1.5deg);
          }
          80% {
            transform: scale(1.02) rotate(0.8deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
            filter: blur(0);
          }
        }

        @keyframes ticketGlowPulse {
          0% {
            filter: drop-shadow(0 0 0 rgba(var(--home-gold-rgb), 0));
          }
          20% {
            filter: drop-shadow(0 0 100px rgba(var(--home-gold-rgb), 0.6)) drop-shadow(0 0 200px rgba(var(--home-pink-rgb), 0.3));
          }
          50% {
            filter: drop-shadow(0 0 40px rgba(var(--home-gold-rgb), 0.2)) drop-shadow(0 0 80px rgba(var(--home-pink-rgb), 0.1));
          }
          100% {
            filter: drop-shadow(0 12px 48px rgba(0,0,0,0.3));
          }
        }

        @keyframes flashPulse {
          0% { opacity: 0; transform: scale(0.8); }
          25% { opacity: 0.9; transform: scale(1.3); }
          50% { opacity: 0; transform: scale(1.8); }
          100% { opacity: 0; transform: scale(1.8); }
        }

        @keyframes particleFly {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx), var(--ty)) scale(0);
          }
        }

        @keyframes starFloat {
          0%, 100% {
            opacity: 0.2;
            transform: translate(0, 0) scale(0.5);
          }
          50% {
            opacity: 0.9;
            transform: translate(var(--sx), var(--sy)) scale(1.2);
          }
        }

        @keyframes textReveal {
          0% {
            opacity: 0;
            transform: translateY(30px) scale(0.96);
          }
          60% {
            opacity: 1;
            transform: translateY(-6px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* ─── SKELETON ───────────────────────────────────────────────────── */
        .skeleton {
          background: linear-gradient(90deg, var(--home-card) 25%, var(--home-card-hover) 50%, var(--home-card) 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s ease infinite;
        }

        /* ─── REVEAL (scroll) ──────────────────────────────────────────── */
        [data-reveal] {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        [data-reveal].visible {
          opacity: 1;
          transform: translateY(0);
        }
        [data-reveal].visible:nth-child(1) { transition-delay: 0.05s; }
        [data-reveal].visible:nth-child(2) { transition-delay: 0.10s; }
        [data-reveal].visible:nth-child(3) { transition-delay: 0.15s; }

        /* ─── NAV ────────────────────────────────────────────────────────── */
        .land-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(var(--home-border-rgb), 0.3);
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(var(--home-bg), 0.85);
          backdrop-filter: blur(8px);
          animation: textReveal 0.6s ease both;
          animation-delay: 0.1s;
        }
        .land-nav-logo {
          cursor: pointer;
          font-size: 22px;
          font-weight: 800;
          font-family: var(--home-font-display);
          letter-spacing: -0.02em;
          color: var(--home-text);
        }
        .land-nav-logo-text span { color: var(--home-pink); }
        .land-nav-links { display: flex; gap: 28px; }
        .land-nav-link {
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 500;
          color: var(--home-text-muted);
          cursor: pointer;
          font-family: var(--home-font);
          transition: color 0.2s;
          letter-spacing: 0.02em;
        }
        .land-nav-link:hover { color: var(--home-gold); }
        .land-nav-cta {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .land-nav-theme {
          width: 36px;
          height: 36px;
          background: var(--home-card);
          border: 1px solid var(--home-border);
          color: var(--home-text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.25s;
        }
        .land-nav-theme:hover { border-color: var(--home-gold); }
        .land-nav-ghost {
          background: transparent;
          border: none;
          color: var(--home-text-muted);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--home-font);
          padding: 8px 16px;
          transition: color 0.2s;
        }
        .land-nav-ghost:hover { color: var(--home-text); }
        .land-nav-primary {
          background: var(--home-gold);
          color: var(--home-bg);
          border: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--home-font);
          padding: 10px 22px;
          transition: background 0.25s, transform 0.15s;
          letter-spacing: 0.02em;
        }
        .land-nav-primary:hover {
          background: var(--home-gold-soft);
          transform: scale(1.02);
        }

        /* ─── HERO ───────────────────────────────────────────────────────── */
        .land-hero-wrap {
          position: relative;
          overflow: hidden;
          padding: 20px 24px 16px;
        }
        .land-filmstrip {
          display: flex;
          gap: 10px;
          padding: 4px 0;
          overflow: hidden;
          opacity: 0.04;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          pointer-events: none;
        }
        .land-sprocket {
          width: 5px;
          height: 12px;
          background: var(--home-text);
          flex-shrink: 0;
          border-radius: 1px;
        }
        .land-hero-glow {
          position: absolute;
          top: -20%;
          right: -10%;
          width: 60%;
          height: 80%;
          background: radial-gradient(ellipse, rgba(var(--home-pink-rgb), 0.08), transparent 70%);
          pointer-events: none;
        }

        .land-hero {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 40px;
          align-items: center;
          max-width: 1280px;
          margin: 0 auto;
          padding: 12px 0 20px;
        }

        .land-hero-text {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .land-hero-eyebrow {
          font-size: 11px;
          font-weight: 500;
          color: var(--home-text-faint);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
          opacity: 0;
          animation: textReveal 0.8s ease forwards;
          animation-delay: 0.3s;
        }
        .land-hero-h1 {
          font-family: var(--home-font-display);
          font-size: 48px;
          font-weight: 800;
          line-height: 1.08;
          color: var(--home-text);
          letter-spacing: -0.03em;
          margin: 0;
          opacity: 0;
          animation: textReveal 0.9s ease forwards;
          animation-delay: 0.4s;
        }
        .land-hero-h1 em {
          color: var(--home-gold);
          font-style: italic;
        }
        .land-hero-sub {
          font-size: 17px;
          color: var(--home-text-muted);
          line-height: 1.6;
          max-width: 480px;
          opacity: 0;
          animation: textReveal 0.8s ease forwards;
          animation-delay: 0.6s;
        }
        .land-hero-btns {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 6px;
          opacity: 0;
          animation: textReveal 0.8s ease forwards;
          animation-delay: 0.8s;
        }

        .land-btn-primary {
          background: var(--home-gold);
          color: var(--home-bg);
          border: none;
          padding: 14px 28px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--home-font);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 0.25s, transform 0.2s, box-shadow 0.3s;
          box-shadow: 0 4px 20px rgba(var(--home-gold-rgb), 0.25);
          letter-spacing: 0.02em;
        }
        .land-btn-primary:hover {
          background: var(--home-gold-soft);
          transform: scale(1.02);
          box-shadow: 0 8px 32px rgba(var(--home-gold-rgb), 0.35);
        }
        .land-btn-ghost {
          background: transparent;
          color: var(--home-text);
          border: 1.5px solid var(--home-border);
          padding: 13px 28px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--home-font);
          transition: border-color 0.25s, color 0.25s, transform 0.2s;
        }
        .land-btn-ghost:hover {
          border-color: var(--home-gold);
          color: var(--home-gold);
          transform: scale(1.02);
        }

        /* ─── TICKET ────────────────────────────────────────────────────── */
        .land-ticket-stage {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          opacity: 0;
          transform: scale(0.7) rotate(-10deg);
          filter: blur(10px);
          transition: none;
        }
        .land-ticket-stage.ticket-visible {
          opacity: 1;
          transform: scale(1) rotate(0deg);
          filter: blur(0);
        }
        .land-ticket-stage.entering {
          animation: ticketLanding 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards,
                     ticketGlowPulse 2.2s ease-in-out forwards;
        }
        .land-ticket-stage.floating {
          animation: floatBreath 4s ease-in-out infinite;
          filter: drop-shadow(0 12px 48px rgba(0,0,0,0.3));
        }
        .land-ticket-stage.floating .land-ticket-svg {
          animation: floatBreath 4s ease-in-out infinite;
        }

        .land-ticket-svg {
          width: 100%;
          height: auto;
          display: block;
          position: relative;
          z-index: 2;
        }

        /* Flash di luce */
        .land-ticket-flash {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(var(--home-gold-rgb), 0.6), transparent 70%);
          opacity: 0;
          pointer-events: none;
          border-radius: 20px;
          z-index: 4;
          animation: flashPulse 1.2s ease-out forwards;
          animation-delay: 0.7s;
        }

        /* Particelle esplosive */
        .particle-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: visible;
          z-index: 5;
        }
        .particle {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          top: 50%;
          left: 50%;
          opacity: 0;
          animation: particleFly 1.2s cubic-bezier(0, 0.8, 0.3, 1) forwards;
          animation-delay: 0.8s;
        }

        /* Stelle persistenti che orbitano */
        .star-container {
          position: absolute;
          inset: -40%;
          pointer-events: none;
          z-index: 1;
          overflow: visible;
        }
        .star {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--home-gold);
          box-shadow: 0 0 10px rgba(var(--home-gold-rgb), 0.6);
          opacity: 0;
          animation: starFloat 3s ease-in-out infinite;
        }

        /* ─── TRENDING ──────────────────────────────────────────────────── */
        .land-trending {
          padding: 8px 24px 20px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .land-trending-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .land-trending-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--home-text);
          display: flex;
          align-items: center;
          gap: 10px;
          letter-spacing: -0.02em;
        }
        .land-trending-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .land-trend-card {
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
          position: relative;
        }
        .land-trend-card:hover { transform: translateY(-6px); }
        .land-trend-poster {
          position: relative;
          aspect-ratio: 2/3;
          overflow: hidden;
          border: 1px solid var(--home-border);
          transition: border-color 0.3s;
          background: var(--home-card);
        }
        .land-trend-card:hover .land-trend-poster {
          border-color: rgba(var(--home-gold-rgb), 0.4);
        }
        .land-trend-poster img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .land-trend-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          width: 28px;
          height: 28px;
          background: var(--home-pink);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          box-shadow: 0 0 16px rgba(var(--home-pink-rgb), 0.25);
          border: 1px solid rgba(255,255,255,0.1);
          font-family: var(--home-font-mono);
        }
        .land-trend-badge.top {
          background: var(--home-gold);
          color: var(--home-bg);
          box-shadow: 0 0 16px rgba(var(--home-gold-rgb), 0.2);
        }
        .land-trend-top-tag {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: var(--home-gold);
          color: var(--home-bg);
          font-size: 7px;
          font-weight: 800;
          padding: 2px 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.9;
        }
        .land-trend-info { padding: 10px 4px 0; }
        .land-trend-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--home-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: -0.01em;
        }
        .land-trend-genre {
          font-size: 11px;
          color: var(--home-text-faint);
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .land-trend-rating {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
        }
        .land-trend-rating .stars {
          color: var(--home-gold);
          font-size: 10px;
          letter-spacing: 0.5px;
        }
        .land-trend-rating .num {
          font-size: 11px;
          color: var(--home-text-faint);
          font-weight: 600;
        }

        /* ─── FEATURES ──────────────────────────────────────────────────── */
        .land-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          padding: 18px 24px 10px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .land-feature-item {
          background: var(--home-card);
          border: 1px solid var(--home-border);
          padding: 18px 20px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
          transition: border-color 0.25s, transform 0.2s;
        }
        .land-feature-item:hover {
          border-color: rgba(var(--home-gold-rgb), 0.38);
          transform: translateY(-3px);
        }
        .land-feature-icon {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          background: rgba(var(--home-pink-rgb), 0.11);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s;
        }
        .land-feature-item:hover .land-feature-icon {
          background: rgba(var(--home-pink-rgb), 0.18);
        }
        .land-feature-title {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--home-text);
          margin-bottom: 2px;
          letter-spacing: -0.01em;
        }
        .land-feature-desc {
          font-size: 12px;
          color: var(--home-text-faint);
          line-height: 1.5;
        }

        .land-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(var(--home-border-rgb), 0.4), transparent);
          margin: 16px 24px 8px;
          max-width: 1280px;
          margin-left: auto;
          margin-right: auto;
        }

        /* ─── HOW IT WORKS ────────────────────────────────────────────── */
        .land-how {
          padding: 20px 24px 10px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .land-how-header { margin-bottom: 28px; }
        .land-how-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--home-text-faint);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          display: block;
          margin-bottom: 6px;
        }
        .land-how-h2 {
          font-family: var(--home-font-display);
          font-size: 32px;
          font-weight: 800;
          color: var(--home-text);
          letter-spacing: -0.02em;
          line-height: 1.12;
          margin: 0;
        }
        .land-how-h2 span { color: var(--home-gold); }

        .land-how-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .land-how-step {
          background: var(--home-card);
          border: 1px solid var(--home-border);
          padding: 24px 22px 22px;
          position: relative;
          transition: border-color 0.25s, transform 0.2s;
          overflow: hidden;
        }
        .land-how-step:hover {
          border-color: rgba(var(--home-gold-rgb), 0.38);
          transform: translateY(-4px);
        }
        .land-how-step::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid transparent;
          transition: border-color 0.3s ease;
          pointer-events: none;
        }
        .land-how-step:hover::after {
          border-color: rgba(var(--home-gold-rgb), 0.2);
        }
        .land-how-step-num {
          font-family: var(--home-font-mono);
          font-size: 32px;
          font-weight: 700;
          color: rgba(var(--home-pink-rgb), 0.2);
          letter-spacing: -0.03em;
          margin-bottom: 8px;
          line-height: 1;
        }
        .land-how-step-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .land-how-step-icon {
          width: 36px;
          height: 36px;
          background: rgba(var(--home-pink-rgb), 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .land-how-step-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--home-text);
          letter-spacing: -0.01em;
        }
        .land-how-step-desc {
          font-size: 13px;
          color: var(--home-text-muted);
          line-height: 1.6;
        }
        .land-how-step-tag {
          font-size: 11px;
          font-weight: 600;
          color: var(--home-gold);
          margin-top: 4px;
          letter-spacing: 0.02em;
        }

        /* ─── QUOTE ────────────────────────────────────────────────────── */
        .land-quote {
          padding: 28px 24px 16px;
          max-width: 1280px;
          margin: 0 auto;
          text-align: center;
        }
        .land-quote-text {
          font-family: var(--home-font-display);
          font-size: 26px;
          font-weight: 400;
          color: var(--home-text);
          line-height: 1.4;
          max-width: 720px;
          margin: 0 auto 12px;
          letter-spacing: -0.01em;
        }
        .land-quote-text em {
          color: var(--home-gold);
          font-style: italic;
        }
        .land-quote-author {
          font-size: 14px;
          color: var(--home-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        /* ─── FINAL CTA ────────────────────────────────────────────────── */
        .land-final {
          padding: 16px 24px 28px;
          max-width: 1280px;
          margin: 0 auto;
          text-align: center;
        }
        .land-final-h2 {
          font-family: var(--home-font-display);
          font-size: 34px;
          font-weight: 800;
          color: var(--home-text);
          letter-spacing: -0.02em;
          margin: 0 0 8px;
        }
        .land-final-p {
          font-size: 16px;
          color: var(--home-text-muted);
          max-width: 480px;
          margin: 0 auto 22px;
          line-height: 1.6;
        }

        /* ─── FOOTER ───────────────────────────────────────────────────── */
        .land-footer {
          border-top: 1px solid rgba(var(--home-border-rgb), 0.3);
          padding: 28px 24px 24px;
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .land-footer-logo {
          font-family: var(--home-font-display);
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--home-text);
        }
        .land-footer-logo span { color: var(--home-pink); }
        .land-footer-copy {
          font-size: 12.5px;
          color: var(--home-text-faint);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* ─── RESPONSIVE ────────────────────────────────────────────────── */
        @media (max-width: 1024px) {
          .land-hero {
            grid-template-columns: 1fr;
            gap: 28px;
            text-align: center;
          }
          .land-hero-sub { max-width: 100%; }
          .land-hero-btns { justify-content: center; }
          .land-trending-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .land-features { grid-template-columns: 1fr; gap: 14px; }
          .land-how-steps { grid-template-columns: 1fr; gap: 16px; }
          .land-how-h2 { font-size: 26px; }
          .land-quote-text { font-size: 20px; }
          .land-final-h2 { font-size: 26px; }
          .land-nav-links { display: none !important; }
          .land-ticket-stage { max-width: 400px; }
          .land-hero-h1 { font-size: 34px; }
          .land-hero-wrap { padding: 12px 16px 8px; }
          .land-trending { padding: 8px 16px 16px; }
          .land-features { padding: 12px 16px 8px; }
          .land-how { padding: 16px 16px 8px; }
          .land-quote { padding: 20px 16px 12px; }
          .land-final { padding: 12px 16px 20px; }
          .land-footer { padding: 20px 16px 16px; flex-direction: column; text-align: center; }
        }
        @media (max-width: 600px) {
          .land-nav { padding: 12px 16px; flex-wrap: wrap; gap: 8px; }
          .land-nav-logo { font-size: 18px; }
          .land-nav-cta { gap: 6px; }
          .land-nav-ghost { font-size: 12px; padding: 6px 12px; }
          .land-nav-primary { font-size: 12px; padding: 8px 16px; }
          .land-nav-theme { width: 32px; height: 32px; }
          .land-hero-h1 { font-size: 26px; }
          .land-hero-sub { font-size: 14px; }
          .land-hero-btns { flex-direction: column; align-items: center; }
          .land-btn-primary,
          .land-btn-ghost { width: 100%; justify-content: center; padding: 14px 20px; }
          .land-trending-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .land-trend-name { font-size: 12px; }
          .land-ticket-stage { max-width: 300px; }
          .land-how-h2 { font-size: 22px; }
          .land-quote-text { font-size: 17px; }
          .land-final-h2 { font-size: 22px; }
          .land-final-p { font-size: 14px; }
          .land-footer-logo { font-size: 17px; }
          .land-footer-copy { font-size: 11px; }
        }
      `}</style>

      <div className="landing-cine" style={{ ...homeThemeVars, opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease' }}>
        {/* ─── NAV ──────────────────────────────────────────────────────────── */}
        <nav className="land-nav">
          <div className="land-nav-logo" onClick={() => router.push('/')}>
            <span className="land-nav-logo-text">
              CINE<span style={{ color: P.pink }}>DATE</span>
            </span>
          </div>
          <div className="land-nav-links desktop-only">
            <button className="land-nav-link">Come funziona</button>
            <button className="land-nav-link">Recensioni</button>
            <button className="land-nav-link">Cinema vicino a te</button>
          </div>
          <div className="land-nav-cta">
            <button className="land-nav-theme" onClick={toggleTheme} title="Cambia tema">
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="land-nav-ghost" onClick={() => router.push('/auth')}>Accedi</button>
            <button className="land-nav-primary" onClick={() => router.push('/auth')}>Registrati</button>
          </div>
        </nav>

        {/* ─── HERO ─────────────────────────────────────────────────────────── */}
        <div className="land-hero-wrap">
          <div className="land-filmstrip">
            {[...Array(30)].map((_, i) => <div key={i} className="land-sprocket" />)}
          </div>
          <div className="land-hero-glow" />

          <section className="land-hero">
            <div className="land-hero-text">
              <span className="land-hero-eyebrow">
                <FilmStrip size={12} color={P.gold} weight="fill" />
                Biglietto n. 0042 — per chi ama il cinema in compagnia
              </span>
              <h1 className="land-hero-h1">
                Trova il film<br />
                <em>perfetto, insieme.</em>
              </h1>
              <p className="land-hero-sub">
                Scorri i film che ti incuriosiscono, trova il match in comune
                e iniziate subito la serata.
              </p>
              <div className="land-hero-btns">
                <button className="land-btn-primary" onClick={() => router.push('/auth')}>
                  Provalo gratis <ArrowRight size={14} weight="bold" />
                </button>
                <button className="land-btn-ghost" onClick={handleGuest}>
                  Entra come ospite
                </button>
              </div>
            </div>

            {/* ─── TICKET ───────────────────────────────────────────────────── */}
            <div className={ticketClasses.join(' ')}>
              {/* Flash di luce */}
              {ticketState === 'entering' && <div className="land-ticket-flash" />}

              {/* Particelle esplosive */}
              {ticketState === 'entering' && (
                <div className="particle-container">
                  {[...Array(16)].map((_, i) => {
                    const angle = (i / 16) * 360 + Math.random() * 20;
                    const distance = 80 + Math.random() * 80;
                    const tx = Math.cos(angle * Math.PI / 180) * distance;
                    const ty = Math.sin(angle * Math.PI / 180) * distance;
                    return (
                      <div
                        key={i}
                        className="particle"
                        style={{
                          '--tx': tx + 'px',
                          '--ty': ty + 'px',
                          background: i % 3 === 0 ? 'var(--home-gold)' : i % 3 === 1 ? 'var(--home-pink)' : 'var(--home-gold-soft)',
                          width: 4 + Math.random() * 10 + 'px',
                          height: 4 + Math.random() * 10 + 'px',
                          animationDelay: 0.7 + Math.random() * 0.4 + 's',
                          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                        } as React.CSSProperties}
                      />
                    );
                  })}
                </div>
              )}

              {/* Stelle persistenti che orbitano (solo dopo l'entrata) */}
              {ticketState !== 'hidden' && (
                <div className="star-container">
                  {[...Array(8)].map((_, i) => {
                    const angle = (i / 8) * 360;
                    const orbit = 120 + Math.sin(i * 1.5) * 30;
                    const sx = Math.cos(angle * Math.PI / 180) * orbit;
                    const sy = Math.sin(angle * Math.PI / 180) * orbit;
                    return (
                      <div
                        key={i}
                        className="star"
                        style={{
                          top: '50%',
                          left: '50%',
                          transform: `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`,
                          '--sx': (sx + (Math.random() - 0.5) * 40) + 'px',
                          '--sy': (sy + (Math.random() - 0.5) * 40) + 'px',
                          animationDelay: (i * 0.4) + 's',
                          animationDuration: (3 + Math.random() * 2) + 's',
                          width: 3 + Math.random() * 5 + 'px',
                          height: 3 + Math.random() * 5 + 'px',
                          opacity: 0.1 + Math.random() * 0.3,
                        } as React.CSSProperties}
                      />
                    );
                  })}
                </div>
              )}

              <svg
                className="land-ticket-svg"
                viewBox="0 0 2000 1000"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Biglietto sempre in stile carta bianca */}
                  <linearGradient id="land-paper" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff7e8" />
                    <stop offset="1" stopColor="#eadbc2" />
                  </linearGradient>
                  <clipPath id="land-ticket-clip">
                    <rect x="72" y="82" width="160" height="198" rx="6" />
                  </clipPath>
                </defs>

                <path
                  d="M35 28H825a22 22 0 0 1 22 22v82a28 28 0 0 0 0 56v112a22 22 0 0 1-22 22H35a22 22 0 0 1-22-22V188a28 28 0 0 0 0-56V50a22 22 0 0 1 22-22Z"
                  fill="url(#land-paper)"
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
                    clipPath="url(#land-ticket-clip)"
                    transform="scale(2)"
                  />
                ) : (
                  <>
                    <rect x="72" y="82" width="160" height="198" rx="6" fill={P.pink} opacity=".72" transform="scale(2)" />
                    <circle cx="152" cy="182" r="40" fill="#09080b" transform="scale(2)" />
                    <path d="M103 276c8-58 90-58 98 0" fill="#09080b" transform="scale(2)" />
                  </>
                )}

                <g fill="#171419" fontFamily="Arial, Helvetica, sans-serif" transform="scale(2)">
                  <text x="270" y="94" fontSize="31" fontWeight="800">
                    {trendingMovie?.title?.slice(0, 18) || 'OBSESSION'}
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

                <rect x="475" y="270" width="195" height="48" rx="9" fill={P.pink} transform="scale(2)" />
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

        {/* ─── TRENDING ────────────────────────────────────────────────────── */}
        <section className="land-trending">
          <div className="land-trending-head">
            <span className="land-trending-title">
              <Star size={18} color={P.gold} weight="fill" />
              In tendenza questa settimana
            </span>
          </div>

          <div className="land-trending-grid">
            {loadingTrending ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="land-trend-card" style={{ opacity: 0.5 }}>
                  <div className="skeleton" style={{ width: '100%', aspectRatio: '2/3' }} />
                  <div className="skeleton" style={{ width: '80%', height: '14px', marginTop: '10px' }} />
                  <div className="skeleton" style={{ width: '50%', height: '10px', marginTop: '6px' }} />
                </div>
              ))
            ) : (
              trending.slice(0, 4).map((movie, i) => {
                const rating = movie.rating || 0;
                const fullStars = Math.round(rating / 2);
                const starString = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars); 

                return (
                  <div
                    key={movie.id}
                    className="land-trend-card"
                    data-reveal
                    onClick={() => router.push(`/film/${movie.tmdb_id}`)}
                  >
                    <div className="land-trend-poster">
                      <img
                        src={movie.cover ?? 'https://placehold.co/148x222/1c1613/7a6b60?text=🎬'}
                        alt={movie.title}
                        loading="lazy"
                      />
                      <div className={`land-trend-badge`}>
                        {i + 1}
                      </div>
                      {i < 3 && <div className="land-trend-top-tag">Top</div>}
                    </div>
                    <div className="land-trend-info">
                      <div className="land-trend-name">{movie.title}</div>
                      <div className="land-trend-genre">{movie.genre?.split(',').slice(0, 2).join(', ') || ''}</div>
                      {movie.rating > 0 && (
                        <div className="land-trend-rating">
                          <span className="stars">{starString}</span>
                          <span className="num">{movie.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ─── FEATURES ────────────────────────────────────────────────────── */}
        <section className="land-features">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="land-feature-item" data-reveal>
                <div className="land-feature-icon">
                  <Icon size={22} weight="fill" color={P.pink} />
                </div>
                <div>
                  <div className="land-feature-title">{f.title}</div>
                  <div className="land-feature-desc">{f.desc}</div>
                </div>
              </div>
            );
          })}
        </section>

        <div className="land-divider" />

        {/* ─── HOW IT WORKS ────────────────────────────────────────────────── */}
        <section className="land-how">
          <div className="land-how-header">
            <span className="land-how-label">Come funziona</span>
            <h2 className="land-how-h2">
              Dal divano al film<br />
              in <span>tre mosse</span>
            </h2>
          </div>

          <div className="land-how-steps">
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
                <div key={step.num} className="land-how-step" data-reveal>
                  <div className="land-how-step-num">{step.num}</div>
                  <div className="land-how-step-content">
                    <span className="land-how-step-icon">
                      <StepIcon size={18} weight="fill" color={P.pink} />
                    </span>
                    <div className="land-how-step-title">{step.title}</div>
                    <div className="land-how-step-desc">{step.desc}</div>
                    <span className="land-how-step-tag">{step.tag}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── QUOTE ────────────────────────────────────────────────────────── */}
        <section className="land-quote" data-reveal>
          <p className="land-quote-text">
            "Abbiamo scoperto film che non avremmo mai trovato da soli.
            <em> E scegliere cosa guardare è diventato finalmente semplice</em>."
          </p>
          <div className="land-quote-author">
            — Giulia & Marco, Milano <Popcorn size={14} weight="fill" color={P.pink} />
          </div>
        </section>

        {/* ─── FINAL CTA ───────────────────────────────────────────────────── */}
        <section className="land-final" data-reveal>
          <h2 className="land-final-h2">Stasera cosa guardate?</h2>
          <p className="land-final-p">
            Create una stanza, scoprite nuovi film
            e trovate subito qualcosa da guardare insieme.
          </p>
          <button
            className="land-btn-primary"
            onClick={() => router.push('/auth')}
            style={{ width: 'auto', padding: '16px 44px' }}
          >
            Inizia adesso — è gratis <ArrowRight size={14} weight="bold" />
          </button>
        </section>

        {/* ─── FOOTER ───────────────────────────────────────────────────────── */}
        <footer className="land-footer">
          <div className="land-footer-logo">
            CINE<span style={{ color: P.pink }}>DATE</span>
          </div>
          <div className="land-footer-copy">
            © 2026 CineDate — Fatto con <Heart size={12} weight="fill" color={P.pink} /> per chi ama il cinema
          </div>
        </footer>
      </div>
    </>
  );
}