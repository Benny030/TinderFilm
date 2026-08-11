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
  SignIn,
  Sun,
  Moon,
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
  { icon: '👥', title: 'TROVA IL TUO MATCH', desc: 'Persone con i tuoi stessi gusti' },
  { icon: '🎬', title: 'SCOPRI COSA VEDERE', desc: 'Consigli su misura per te' },
  { icon: '📣', title: 'VIVI IL CINEMA', desc: 'Insieme è meglio' },
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
        <span style={{ fontSize: '32px' }}>🎬</span>
      </div>
    );
  }

  const trendingMovie = trending?.[0];

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drift { from { background-position: 0 0; } to { background-position: -930px 0; } }
        @keyframes float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          50%      { transform: translate3d(0, -7px, 0) rotate(0.25deg); }
        }
        @keyframes breathe {
          0%, 100% { opacity: .55; }
          50%      { opacity: 0.1; }
        }
        @keyframes scale {
          0%, 100% { scale: 1; }
          50%      { scale: 1.015; }
        }

        @keyframes ticketPeel {
          0% { transform: translateX(130%) rotate(-8deg) scale(0.75); opacity: 0; }
          50% { transform: translateX(-3%) rotate(3deg) scale(1.04); opacity: 1; }
          70% { transform: translateX(0) rotate(-0.5deg) scale(0.98); }
          85% { transform: translateX(0) rotate(0.5deg) scale(1.01); }
          100% { transform: translateX(0) rotate(2.5deg) scale(1); }
        }
        @keyframes floatTicket {
          0%, 100% { transform: rotate(2.5deg) translateY(0); }
          50%      { transform: rotate(1.5deg) translateY(-10px); }
        }
        @keyframes sparkleBurst {
          0% { transform: scale(0); opacity: 0; }
          30% { transform: scale(1.8); opacity: 1; }
          70% { transform: scale(2.2); opacity: 0.6; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes sparklePulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        /* ── DARK MODE (default) ── */
        .land {
          font-family: ${FONT.sans};
          background: ${D.bg};
          color: ${D.text};
        }

        [data-reveal] {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        [data-reveal].visible {
          opacity: 1;
          transform: translateY(0);
        }

        .trending-grid > .trend-card[data-reveal]:nth-child(1) { transition-delay: 0s; }
        .trending-grid > .trend-card[data-reveal]:nth-child(2) { transition-delay: 0.1s; }
        .trending-grid > .trend-card[data-reveal]:nth-child(3) { transition-delay: 0.2s; }
        .trending-grid > .trend-card[data-reveal]:nth-child(4) { transition-delay: 0.3s; }

        .features > .feature-item[data-reveal]:nth-child(1) { transition-delay: 0s; }
        .features > .feature-item[data-reveal]:nth-child(2) { transition-delay: 0.15s; }
        .features > .feature-item[data-reveal]:nth-child(3) { transition-delay: 0.3s; }

        .how-steps > .how-step[data-reveal]:nth-child(1) { transition-delay: 0s; }
        .how-steps > .how-step[data-reveal]:nth-child(2) { transition-delay: 0.2s; }
        .how-steps > .how-step[data-reveal]:nth-child(3) { transition-delay: 0.4s; }

        .nav {
          position: sticky; top: 0; z-index: 99;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; height: 68px;
          background: rgba(10,9,8,0.85);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid ${D.border};
        }
        .nav-logo { display: flex; align-items: center; gap: 8px; cursor: pointer; text-decoration: none; }
        .nav-logo-text { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; color: ${D.text}; }
        .nav-links { display: flex; gap: 32px; }
        .nav-link {
          font-size: 14px; color: ${D.textMuted}; background: none; border: none;
          cursor: pointer; font-family: ${FONT.sans}; padding: 0;
          transition: color .15s;
        }
        .nav-link:hover { color: ${D.text}; }
        .nav-cta { display: flex; gap: 10px; align-items: center; }
        .btn-sm-ghost {
          font-size: 14px; font-weight: 600; color: ${D.text}; background: none;
          border: 1.5px solid ${D.border}; border-radius: 3.5px;
          cursor: pointer; font-family: ${FONT.sans}; padding: 9px 18px;
          transition: border-color .15s;
        }
        .btn-sm-ghost:hover { border-color: ${D.gold}; }
        .btn-sm-primary {
          font-size: 14px; font-weight: 700; color: ${D.ink};
          background: ${D.gold}; border: none; border-radius: 3.5px;
          cursor: pointer; font-family: ${FONT.sans}; padding: 9px 20px;
          transition: opacity .15s;
        }
        .btn-sm-primary:hover { opacity: .88; }

        .hero-wrap { position: relative; overflow: hidden; }

        .hero-filmstrip {
          position: absolute;
          top: 13px; left: 0; right: 0;
          width: 100%; height: 100%;
          background-image: url('/assets/landing/filmstrip-removebg-preview.png');
          background-repeat: repeat-x;
          background-size: 930px 390px;
          background-position: 0 0;
          pointer-events: none;
          opacity: .62;
          will-change: background-position, transform, opacity;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
          animation: drift 36s linear infinite,
                     float 8s ease-in-out infinite,
                     breathe 6s ease-in-out infinite,
                     scale 12s ease-in-out infinite;
        }

        .hero-glow {
          position: absolute; top: -120px; right: -120px; width: 560px; height: 560px;
          background: radial-gradient(circle, rgba(237,61,115,.35), transparent 70%);
          filter: blur(10px); pointer-events: none;
        }
        .hero {
          position: relative; max-width: 1220px; margin: 0 auto;
          padding: 72px 32px 64px;
          display: grid; grid-template-columns: 1fr 480px;
          gap: 56px; align-items: center;
        }
        .hero-eyebrow {
          display: inline-block;
          font-size: 12px; font-weight: 700; letter-spacing: 2px;
          text-transform: uppercase; color: ${D.gold};
          margin-bottom: 22px; font-family: 'Courier New', monospace;
        }
        .hero-h1 {
          font-size: clamp(38px, 5vw, 60px);
          font-weight: 800; line-height: 1.06;
          letter-spacing: -1px; color: ${D.text};
          margin-bottom: 22px;
        }
        .hero-h1 em { font-style: normal; color: ${D.pink}; }
        .hero-sub {
          font-size: 17px; color: ${D.textMuted}; line-height: 1.65;
          max-width: 480px; margin-bottom: 36px;
        }
        .hero-sub em { font-style: normal; color: ${D.text}; }
        .hero-btns { display: flex; gap: 12px; flex-wrap: wrap; }
        .hero-btns .btn-hero-primary,
        .hero-btns .btn-hero-ghost { justify-content: center; }
        .btn-hero-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: ${D.gold}; color: ${D.ink}; border: none;
          border-radius: 3.5px; padding: 16px 30px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          font-family: ${FONT.sans};
          box-shadow: 0 25px 30px rgba(245,185,47,.28);
          transition: transform .15s, box-shadow .15s;
        }
        .btn-hero-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(245,185,47,.36); }
        .btn-hero-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent; color: ${D.text};
          border: 1.5px solid ${D.border}; border-radius: 3.5px;
          padding: 15px 26px; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: ${FONT.sans};
          transition: border-color .15s, background .15s;
        }
        .btn-hero-ghost:hover { border-color: ${D.gold}; background: rgba(245,185,47,.06); }

        .ticket-stage {
          position: relative;
          height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ticket-stage.entering { animation: ticketPeel 2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards; }
        .ticket-stage.floating { animation: floatTicket 6s ease-in-out infinite; }

        .ticket-img {
          width: 100%;
          max-width: 520px;
          height: auto;
          transform: scale(1.35);
          transform-origin: center center;
          filter: drop-shadow(0 24px 60px rgba(237, 61, 115, .28));
          will-change: transform;
          max-height: 100%;
        }

        .ticket-sparkle {
          position: absolute;
          left: -16%;
          top: 36.5%;
          width: 18px;
          height: 18px;
          background: ${D.gold};
          border-radius: 50%;
          box-shadow: 0 0 22px 6px rgba(245,185,47,.8);
          animation: sparklePulse 2s ease-in-out infinite;
          pointer-events: none;
          z-index: 1;
        }
        .ticket-sparkle-burst {
          position: absolute;
          left: -18%;
          top: 36.5%;
          width: 18px;
          height: 18px;
          background: ${D.gold};
          border-radius: 50%;
          box-shadow: 0 0 22px 6px rgba(245,185,47,.8);
          animation: sparkleBurst 1.8s ease-out forwards;
          pointer-events: none;
          z-index: 2;
        }

        .trending { max-width: 1220px; margin: 0 auto; padding: 56px 32px 40px; border-top: 1px solid ${D.border}; }
        .trending-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26px; flex-wrap: wrap; gap: 10px; }
        .trending-title { font-size: 13px; font-weight: 800; letter-spacing: 1.5px; color: ${D.text}; gap: 6px; display: inline-flex; align-items: center; }
        .trending-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .trend-card {
          position: relative; background: ${D.card}; border: 1px solid ${D.border};
          border-radius: 16px; padding: 14px; display: flex; gap: 12px; align-items: center;
          transition: border-color .15s, transform .15s;
        }
        .trend-card:hover { border-color: ${D.pink}; transform: translateY(-2px); }
        .trend-badge {
          position: absolute; top: -10px; left: -10px; width: 32px; height: 32px;
          border-radius: 50%; background: ${D.gold}; border: 2px solid ${D.goldSoft};
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 800; color: ${D.ink};
          box-shadow: 0 4px 10px rgba(0,0,0,.35); font-family: ${FONT.sans};
        }
        .trend-poster {
          width: 56px; height: 78px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        .trend-poster img {
          width: 100%; aspect-ratio: 1.9/3;
          object-fit: cover; border-radius: ${R.md};
          box-shadow: ${SHADOW.sm};
        }
        .trend-info { min-width: 0; }
        .trend-name { font-size: 13px; font-weight: 800; letter-spacing: .3px; color: ${D.text}; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .trend-genre { font-size: 11px; color: ${D.textFaint}; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .trend-rating { font-size: 12px; font-weight: 700; color: ${D.gold}; }

        .features {
          max-width: 1220px; margin: 0 auto;
          padding: 56px 32px;
          display: flex; align-items: center; justify-content: center; gap: 56px; flex-wrap: wrap;
          border-top: 1px solid ${D.border};
        }
        .feature-item { display: flex; align-items: center; gap: 12px; }
        .feature-icon {
          width: 42px; height: 42px; border-radius: 50%;
          background: rgba(237,61,115,.12); border: 1px solid rgba(237,61,115,.35);
          display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
        }
        .feature-title { font-size: 13px; font-weight: 800; letter-spacing: .4px; color: ${D.text}; }
        .feature-desc { font-size: 12px; color: ${D.textFaint}; }

        .section-divider { display: block; width: 100%; height: 24px; opacity: .8; }

        .how { max-width: 1160px; margin: 0 auto; padding: 72px 32px; }
        .how-header { margin-bottom: 48px; }
        .how-label { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: ${D.gold}; margin-bottom: 12px; }
        .how-h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; letter-spacing: -1px; line-height: 1.1; color: ${D.text}; }
        .how-h2 span { color: ${D.pink}; }

        .how-steps { display: flex; flex-direction: column; gap: 0; }
        .how-step {
          display: grid; grid-template-columns: 80px 1fr;
          gap: 28px; padding: 32px 0;
          border-bottom: 1px solid ${D.border};
          align-items: start;
        }
        .how-step:last-child { border-bottom: none; }
        .how-step-num {
          font-size: 52px; font-weight: 800; color: ${D.gold};
          -webkit-text-stroke: 1px ${D.gold};
          line-height: 1; font-variant-numeric: tabular-nums; user-select: none;
        }
        .how-step-content { padding-top: 4px; }
        .how-step-icon { font-size: 26px; margin-bottom: 10px; display: block; }
        .how-step-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: ${D.text}; }
        .how-step-desc { font-size: 15px; color: ${D.textMuted}; line-height: 1.6; max-width: 540px; }
        .how-step-tag {
          display: inline-flex; margin-top: 12px;
          background: rgba(237,61,115,.12); color: ${D.pink};
          border: 1px solid rgba(237,61,115,.3);
          border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 600;
        }

        .quote-section { background: ${D.bgSoft}; padding: 72px 32px; text-align: center; }
        .quote-text {
          font-size: clamp(22px, 3.5vw, 36px); font-weight: 700; color: ${D.text};
          line-height: 1.3; max-width: 700px; margin: 0 auto 20px; letter-spacing: -0.5px;
        }
        .quote-text em { font-style: normal; color: ${D.pink}; }
        .quote-author { font-size: 13px; color: ${D.textFaint}; }

        .final-cta { max-width: 600px; margin: 0 auto; padding: 80px 32px; text-align: center; }
        .final-cta h2 { font-size: clamp(28px, 4vw, 42px); font-weight: 800; letter-spacing: -1px; margin-bottom: 14px; color: ${D.text}; }
        .final-cta p { font-size: 16px; color: ${D.textMuted}; line-height: 1.6; margin-bottom: 36px; }

        .footer {
          border-top: 1px solid ${D.border}; padding: 28px 32px;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 12px;
        }
        .footer-logo { font-size: 15px; font-weight: 800; color: ${D.text}; }
        .footer-copy { font-size: 12px; color: ${D.textFaint}; }

        /* ── LIGHT MODE overrides (più pulito) ── */
        .land.light-mode {
          background: ${L.bg};
          color: ${L.text};
        }
        .light-mode .nav {
          background: rgba(250,247,242,0.9);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid ${L.border};
        }
        .light-mode .nav-logo-text { color: ${L.text}; }
        .light-mode .nav-link { color: ${L.textMuted}; }
        .light-mode .nav-link:hover { color: ${L.text}; }
        .light-mode .btn-sm-ghost {
          color: ${L.text};
          border-color: ${L.border};
        }
        .light-mode .btn-sm-ghost:hover { border-color: ${L.gold}; }
        .light-mode .btn-sm-primary {
          background: ${L.gold};
          color: ${L.ink};
        }
        .light-mode .hero-eyebrow { color: ${L.gold}; }
        .light-mode .hero-h1 { color: ${L.text}; }
        .light-mode .hero-h1 em { color: ${L.pink}; }
        .light-mode .hero-sub { color: ${L.textMuted}; }
        .light-mode .hero-sub em { color: ${L.text}; }
        .light-mode .btn-hero-primary {
          background: ${L.gold};
          color: ${L.ink};
          box-shadow: 0 20px 25px rgba(198,146,20,.25);
        }
        .light-mode .btn-hero-ghost {
          color: ${L.text};
          border-color: ${L.border};
        }
        .light-mode .btn-hero-ghost:hover { border-color: ${L.gold}; background: rgba(198,146,20,.06); }
        .light-mode .trending { border-top-color: ${L.border}; }
        .light-mode .trending-title { color: ${L.text}; }
        .light-mode .trend-card {
          background: ${L.card};
          border-color: ${L.border};
        }
        .light-mode .trend-card:hover { border-color: ${L.pink}; }
        .light-mode .trend-name { color: ${L.text}; }
        .light-mode .trend-genre { color: ${L.textFaint}; }
        .light-mode .trend-rating { color: ${L.gold}; }
        .light-mode .features { border-top-color: ${L.border}; }
        .light-mode .feature-icon {
          background: rgba(199,44,92,.08);
          border-color: rgba(199,44,92,.3);
        }
        .light-mode .feature-title { color: ${L.text}; }
        .light-mode .feature-desc { color: ${L.textFaint}; }
        .light-mode .how-label { color: ${L.gold}; }
        .light-mode .how-h2 { color: ${L.text}; }
        .light-mode .how-h2 span { color: ${L.pink}; }
        .light-mode .how-step {
          border-bottom-color: ${L.border};
        }
        .light-mode .how-step-num { color: ${L.gold}; -webkit-text-stroke-color: ${L.gold}; }
        .light-mode .how-step-title { color: ${L.text}; }
        .light-mode .how-step-desc { color: ${L.textMuted}; }
        .light-mode .how-step-tag {
          background: rgba(199,44,92,.08);
          color: ${L.pink};
          border-color: rgba(199,44,92,.25);
        }
        .light-mode .quote-section { background: ${L.bgSoft}; }
        .light-mode .quote-text { color: ${L.text}; }
        .light-mode .quote-text em { color: ${L.pink}; }
        .light-mode .quote-author { color: ${L.textFaint}; }
        .light-mode .final-cta h2 { color: ${L.text}; }
        .light-mode .final-cta p { color: ${L.textMuted}; }
        .light-mode .footer {
          border-top-color: ${L.border};
        }
        .light-mode .footer-logo { color: ${L.text}; }
        .light-mode .footer-copy { color: ${L.textFaint}; }
        .light-mode .ticket-sparkle { background: ${L.gold}; box-shadow: 0 0 22px 6px rgba(198,146,20,.6); }
        .light-mode .ticket-sparkle-burst { background: ${L.gold}; box-shadow: 0 0 22px 6px rgba(198,146,20,.6); }

        /* Nascondi pellicola e riduci bagliore in light mode */
        .light-mode .hero-filmstrip {
          display: none;
        }
        .light-mode .hero-glow {
          background: radial-gradient(circle, rgba(199,44,92,.12), transparent 70%);
        }
        .light-mode .ticket-img {
          filter: drop-shadow(0 18px 40px rgba(199, 44, 92, .12));
        }

        /* ── Responsive (invariato) ── */
        @media (max-width: 900px) {
          .trending-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 768px) {
          .nav { padding: 0 20px; height: 60px; }
          .nav-links { display: none; }
          .nav-cta { gap: 8px; }
          .btn-sm-ghost, .btn-sm-primary { padding: 8px 14px; font-size: 13px; }

          .hero { grid-template-columns: 1fr; padding: 32px 20px 28px; gap: 28px; }
          .hero-eyebrow { font-size: 11px; letter-spacing: 1.2px; margin-bottom: 16px; }
          .hero-h1 { margin-bottom: 16px; }
          .hero-sub { font-size: 15.5px; margin-bottom: 26px; max-width: 100%; }
          .hero-btns { flex-direction: column; }
          .hero-btns .btn-hero-primary, .hero-btns .btn-hero-ghost { width: 100%; }

          .hero-filmstrip { top: 52px; height: 150px; opacity: .45; }

          .ticket-stage { order: -1; height: auto; min-height: 220px; padding: 8px 0 4px; }
          .ticket-img { transform: scale(1); max-width: 100%; }
          .ticket-sparkle, .ticket-sparkle-burst { left: -5%; top: 35%; }

          .trending { padding: 40px 20px 32px; }
          .trending-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .trend-card { padding: 11px; gap: 10px; border-radius: 12px; }
          .trend-poster { width: 48px; height: 68px; }
          .trend-name { font-size: 12px; }

          .features { flex-direction: column; align-items: flex-start; gap: 18px; padding: 40px 20px; }

          .how { padding: 48px 20px; }
          .how-header { margin-bottom: 32px; }
          .how-step { grid-template-columns: 44px 1fr; gap: 14px; padding: 24px 0; }
          .how-step-num { font-size: 34px; }
          .how-step-title { font-size: 18px; }
          .how-step-desc { font-size: 14px; }

          .quote-section { padding: 44px 20px; }
          .quote-text { font-size: 22px; }

          .final-cta { padding: 48px 20px; }
          .final-cta .btn-hero-primary { width: 100%; }

          .footer { flex-direction: column; align-items: center; text-align: center; padding: 22px 20px; gap: 8px; }
        }

        @media (max-width: 480px) {
          .nav-logo-text { font-size: 16px; }
          .btn-sm-ghost { display: none; }
          .btn-sm-primary { padding: 8px 12px; font-size: 12.5px; }

          .hero { padding: 24px 16px 24px; }
          .hero-eyebrow { font-size: 10px; }
          .hero-sub { font-size: 14.5px; }
          .btn-hero-primary, .btn-hero-ghost { padding: 14px 22px; font-size: 14px; }

          .hero-filmstrip { top: 46px; height: 120px; opacity: .35; }

          .ticket-stage { min-height: 190px; }
          .ticket-sparkle, .ticket-sparkle-burst { width: 12px; height: 12px; left: -0.5%; top: 34%; }

          .trending-grid { grid-template-columns: 1fr; }
          .trend-card { padding: 10px; }

          .feature-item { gap: 10px; }
          .feature-icon { width: 36px; height: 36px; font-size: 15px; }
          .feature-title { font-size: 12px; }
          .feature-desc { font-size: 11px; }

          .how-step-num { font-size: 28px; }
          .quote-text { font-size: 19px; }
          .final-cta h2 { font-size: 26px; }
        }
      `}</style>

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
              Registrati →
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
                  Provalo gratis →
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
                <Star size={18} color={isLightMode ? L.gold : C.primary} weight="fill" />
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
                    src={movie.cover ?? 'https://placehold.co/120x180/f0f0f0/aaa?text=🎬'}
                    alt={movie.title}
                    loading="lazy"
                  />
                </div>
                <div className="trend-info">
                  <div className="trend-name">{movie.title}</div>
                  <div className="trend-genre">{movie.genre}</div>
                  <div className="trend-rating">★ {movie.rating.toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="features">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-item" data-reveal="true">
              <div className="feature-icon">{f.icon}</div>
              <div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
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
                icon: '🏠',
                title: 'Crea una stanza',
                desc: 'Crea una stanza e condividi il codice con chi vuoi. Nessun link complicato, nessun account obbligatorio — puoi entrare anche come ospite.',
                tag: 'Inizi in 30 secondi.',
              },
              {
                num: '02',
                icon: '🎬',
                title: 'Scorri i film',
                desc: 'Scegli i film che ti interessano in totale libertà. Quando i gusti coincidono, nasce il match.',
                tag: 'Tutto in modo anonimo.',
              },
              {
                num: '03',
                icon: '🎉',
                title: 'Trova il match',
                desc: 'Quando metti like allo stesso film, appare il match. Così trovi subito qualcosa che piace davvero a entrambi.',
                tag: 'Trovare qualcosa da guardare non è mai stato così semplice',
              },
            ].map((step) => (
              <div key={step.num} className="how-step" data-reveal="true">
                <div className="how-step-num">{step.num}</div>
                <div className="how-step-content">
                  <span className="how-step-icon">{step.icon}</span>
                  <div className="how-step-title">{step.title}</div>
                  <div className="how-step-desc">{step.desc}</div>
                  <span className="how-step-tag">{step.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="quote-section" data-reveal="true">
          <p className="quote-text">
            "Abbiamo scoperto film che non avremmo mai trovato da soli.
            <em> E scegliere cosa guardare è diventato finalmente semplice</em>."
          </p>
          <div className="quote-author">— Giulia & Marco, Milano 🍿</div>
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
            Inizia adesso — è gratis
          </button>
        </section>

        <footer className="footer">
          <div className="footer-logo">
            CINE<span style={{ color: isLightMode ? L.pink : D.pink }}>DATE</span>
          </div>
          <div className="footer-copy">
            © 2026 CineDate — Fatto con ❤️ per chi ama il cinema
          </div>
        </footer>
      </div>
    </>
  );
}