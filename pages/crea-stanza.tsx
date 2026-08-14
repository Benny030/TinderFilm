'use client';

import { useState, useEffect, type FormEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { generateRoomCode, normalizeRoomCode } from '@/utils/roomCode';
import { useTheme } from '@/context/ThemeContext';
import {
  FilmSlate,
  Television,
  Ticket,
  Funnel,
  TrendUp,
  ArrowRight,
  ArrowLeft,
  Check,
  Warning,
  Door,
  Plus,
  Users,
  Armchair,
  Popcorn,
  InstagramLogo,
  TiktokLogo,
  XLogo,
  Heart,
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
  success: '#22c55e',
  purple: '#8b5cf6',
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
  success: '#16a34a',
  purple: '#7c3aed',
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
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
};

const GENRES = [
  { id: 28, label: 'Azione', emoji: '💥' },
  { id: 12, label: 'Avventura', emoji: '🗺️' },
  { id: 16, label: 'Animazione', emoji: '🎨' },
  { id: 35, label: 'Commedia', emoji: '😂' },
  { id: 80, label: 'Crime', emoji: '🔫' },
  { id: 18, label: 'Dramma', emoji: '🎭' },
  { id: 10751, label: 'Famiglia', emoji: '👨‍👩‍👧' },
  { id: 14, label: 'Fantasy', emoji: '🧙' },
  { id: 27, label: 'Horror', emoji: '👻' },
  { id: 10749, label: 'Romantico', emoji: '❤️' },
  { id: 878, label: 'Fantascienza', emoji: '🚀' },
  { id: 53, label: 'Thriller', emoji: '😰' },
  { id: 99, label: 'Documentario', emoji: '📽️' },
  { id: 10402, label: 'Musica', emoji: '🎵' },
];

type Mode = 'trending' | 'cinema' | 'streaming' | 'discover';
type Tab = 'create' | 'join';
type Step = 1 | 2;

export default function CreaStanzaPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;
  const [mounted, setMounted] = useState(false);
  const currentYear = new Date().getFullYear();

  // ─── Tab principale: crea vs entra ───────────────────────────────────────
  const [tab, setTab] = useState<Tab>('create');

  // ─── Legge ?tab=join dalla URL ───────────────────────────────────────────
  useEffect(() => {
    if (!router.isReady) return;
    const requestedTab = router.query.tab;
    if (requestedTab === 'join') {
      setTab('join');
    } else {
      setTab('create');
    }
  }, [router.isReady, router.query.tab]);

  // ─── Join by code ─────────────────────────────────────────────────────────
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  // ─── Crea stanza ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [yearFromStr, setYearFromStr] = useState('2010');
  const [yearToStr, setYearToStr] = useState(String(currentYear));
  const [yearError, setYearError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const yearFrom = parseInt(yearFromStr) || 1900;
  const yearTo = parseInt(yearToStr) || currentYear;

  useEffect(() => {
    setMounted(true);
  }, []);

  const validateYears = (): boolean => {
    if (yearFromStr.length !== 4 || yearToStr.length !== 4) {
      setYearError('Inserisci anni a 4 cifre');
      return false;
    }
    if (yearFrom < 1900 || yearFrom > currentYear + 1) {
      setYearError(`Anno "dal" deve essere tra 1900 e ${currentYear}`);
      return false;
    }
    if (yearTo < 1900 || yearTo > currentYear + 1) {
      setYearError(`Anno "al" deve essere tra 1900 e ${currentYear + 1}`);
      return false;
    }
    if (yearFrom > yearTo) {
      setYearError('L\'anno "dal" non può essere maggiore dell\'anno "al"');
      return false;
    }
    setYearError('');
    return true;
  };

  const toggleGenre = (id: number) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(codeInput);
    if (code.length < 4) {
      setCodeError('Codice non valido');
      return;
    }
    setCodeError('');
    router.push(`/stanza?room=${code}`);
  };

  const handleCreate = async () => {
    if (mode === 'discover' && !validateYears()) return;
    setIsCreating(true);
    const roomId = generateRoomCode();
    try {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: roomId,
          mode: mode!,
          genres: selectedGenres.length > 0 ? selectedGenres.join(',') : null,
          year_from: mode === 'discover' ? yearFrom : null,
          year_to: mode === 'discover' ? yearTo : null,
        }),
      });
    } catch (err) {
      console.error('Room configuration save failed:', err);
    }
    const params = new URLSearchParams({ room: roomId, mode: mode! });
    if (mode === 'discover') {
      if (selectedGenres.length > 0) params.set('genres', selectedGenres.join(','));
      params.set('year_from', yearFrom.toString());
      params.set('year_to', yearTo.toString());
    }
    router.push(`/stanza?${params.toString()}`);
  };

  const switchToCreate = () => {
    setTab('create');
    setStep(1);
  };
  const switchToJoin = () => {
    setTab('join');
    setStep(1);
  };
  const handleCreateAction = () => {
    if (!mode) return;
    if (mode === 'discover') {
      setStep(2);
      return;
    }
    handleCreate();
  };

  const modeCards = [
    { id: 'trending' as Mode, icon: <TrendUp size={26} color={P.pink} weight="duotone" />, title: 'In tendenza', desc: 'I più popolari questa settimana.', badge: '🔥 Hot', color: P.pink },
    { id: 'cinema' as Mode, icon: <Ticket size={26} color={P.gold} weight="duotone" />, title: 'Al cinema', desc: 'Nelle sale italiane adesso.', badge: '🎟️ Ora al cinema', color: P.gold },
    { id: 'streaming' as Mode, icon: <Television size={26} color={P.success} weight="duotone" />, title: 'In streaming', desc: 'Su Netflix, Prime, Disney+ e altri.', badge: '📺 Subito disponibile', color: P.success },
    { id: 'discover' as Mode, icon: <Funnel size={26} color={P.purple} weight="duotone" />, title: 'Filtri personalizzati', desc: 'Scegli genere, anno e molto altro.', badge: '⚙️ Personalizzato', color: P.purple },
  ];

  const pageThemeVars: CSSProperties = {
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }

        .crea-stanza-page {
          --home-font: 'Inter','Helvetica Neue',sans-serif;
          --home-font-display: 'Playfair Display',Georgia,serif;
          --home-font-mono: 'JetBrains Mono','Courier New',monospace;
          font-family: var(--home-font);
          background: var(--home-bg);
          color: var(--home-text);
          min-height: 100%;
          letter-spacing: -0.01em;
        }
        .crea-stanza-page *,
        .crea-stanza-page *::before,
        .crea-stanza-page *::after {
          box-sizing: border-box;
        }
        .crea-stanza-page button,
        .crea-stanza-page input {
          border-radius: 0 !important;
          font-family: var(--home-font);
        }
        .crea-stanza-page ::selection {
          background: var(--home-pink);
          color: #fff;
        }

        /* Layout principale */
        .main-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 20px 64px;
        }
        @media (max-width: 768px) {
          .main-container { padding: 16px; }
        }

        /* Header */
        .page-title {
          font-family: var(--home-font-display);
          font-size: 32px;
          font-weight: 800;
          color: var(--home-text);
          letter-spacing: -0.02em;
        }

        /* Ticket card base */
        .ticket-card {
          background: var(--home-card);
          border: 1px solid var(--home-border);
          position: relative;
          transition: transform 0.25s cubic-bezier(0.2,0,0,1), box-shadow 0.3s ease;
          cursor: pointer;
          overflow: hidden;
        }
        .ticket-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid transparent;
          transition: border-color 0.3s ease;
          pointer-events: none;
        }
        .ticket-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .ticket-card:hover::after {
          border-color: rgba(var(--home-gold-rgb), 0.38);
        }
        .ticket-tear {
          position: absolute;
          left: 50%;
          bottom: -1px;
          transform: translateX(-50%);
          width: 16px;
          height: 6px;
          background: var(--home-bg);
          border-radius: 50% 50% 0 0;
          border-left: 1px solid var(--home-border);
          border-right: 1px solid var(--home-border);
          border-top: 1px solid var(--home-border);
          opacity: 0.6;
        }

        /* Tab switcher */
        .tab-switcher {
          display: flex;
          align-items: center;
          background: var(--home-card);
          border: 1px solid var(--home-border);
          padding: 4px;
          gap: 4px;
        }
        .tab-switch-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px;
          font-weight: 600;
          font-size: 14px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          gap: 8px;
          color: var(--home-text-muted);
          background: transparent;
        }
        .tab-switch-btn.active {
          background: var(--home-gold);
          color: var(--home-bg);
        }

        /* Feature columns */
        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          margin-bottom: 40px;
          border-top: 1px solid var(--home-border);
          border-bottom: 1px solid var(--home-border);
          padding: 24px 0;
        }
        .feature-col {
          display: flex;
          gap: 16px;
        }

        /* Cards grid */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        .card-item {
          position: relative;
          background: var(--home-card);
          padding: 24px;
          cursor: pointer;
          overflow: hidden;
          border: 1px solid var(--home-border);
          transition: all 0.2s;
          min-height: 180px;
        }
        .card-item.selected {
          border-width: 2px;
        }
        .card-blur-bg {
          position: absolute;
          right: -30px;
          top: -30px;
          width: 150px;
          height: 150px;
          filter: blur(70px);
          opacity: 0.2;
          z-index: 0;
        }
        .card-icon-bg {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.1;
          z-index: 1;
          pointer-events: none;
        }
        .card-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .card-check {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
        }

        /* Banner */
        .banner-container {
          background: linear-gradient(130deg, var(--home-pink-deep) 0%, var(--home-bg) 80%);
          border: 1px solid rgba(var(--home-pink-rgb), 0.3);
          padding: 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
        }
        .banner-left {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .banner-icon-wrap {
          color: #fff;
          background: var(--home-pink);
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .banner-btn {
          display: flex;
          align-items: center;
          padding: 12px 24px;
          border: none;
          font-weight: bold;
          font-size: 14px;
          cursor: pointer;
          transition: 0.2s;
          background: var(--home-gold);
          color: var(--home-bg);
        }
        .banner-btn:disabled {
          background: var(--home-border);
          color: var(--home-text-faint);
          cursor: not-allowed;
        }

        /* Forms */
        .join-wrapper {
          display: flex;
          justify-content: center;
          padding: 40px 0;
        }
        .join-form,
        .step2-container {
          background: var(--home-card);
          border: 1px solid var(--home-border);
          padding: 32px;
          max-width: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .code-input {
          padding: 16px;
          border: 1px solid var(--home-border);
          font-size: 24px;
          font-family: var(--home-font-mono);
          color: var(--home-text);
          background: var(--home-bg-soft);
          outline: none;
          width: 100%;
          text-align: center;
          letter-spacing: 6px;
          font-weight: 800;
          text-transform: uppercase;
          transition: border-color 0.15s;
        }
        .code-input:focus {
          border-color: var(--home-gold);
        }
        .year-input {
          padding: 12px 14px;
          border: 1px solid var(--home-border);
          font-size: 15px;
          font-family: var(--home-font-mono);
          color: var(--home-text);
          background: var(--home-bg-soft);
          outline: none;
          width: 100%;
          text-align: center;
          letter-spacing: 2px;
          font-weight: 700;
          transition: border-color 0.15s;
        }
        .year-input:focus {
          border-color: var(--home-gold);
        }
        .genre-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 8px 14px;
          border: 1px solid var(--home-border);
          background: transparent;
          cursor: pointer;
          font-size: 13px;
          font-family: var(--home-font);
          color: var(--home-text-muted);
          transition: all 0.15s;
          font-weight: 500;
        }
        .genre-chip:hover {
          border-color: var(--home-gold);
          color: var(--home-gold);
        }
        .genre-chip.selected {
          border-color: var(--home-gold);
          background: var(--home-gold);
          color: var(--home-bg);
          font-weight: 600;
        }

        .btn-primary {
          width: 100%;
          padding: 16px;
          border: none;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--home-font);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.15s;
        }
        .btn-primary:disabled {
          background: var(--home-border);
          color: var(--home-text-faint);
          cursor: not-allowed;
        }
        .btn-primary:not(:disabled):hover {
          opacity: 0.9;
        }

        /* Footer */
        .footer-cine {
          border-top: 1px solid rgba(var(--home-border-rgb), 0.38);
          padding: 36px 20px 24px;
          position: relative;
          margin-top: auto;
        }
        .footer-cine::before {
          content: '';
          position: absolute;
          top: -1px;
          left: 15%;
          right: 15%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(var(--home-gold-rgb), 0.2), transparent);
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.5fr;
          gap: 40px;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .footer-col-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--home-text);
          margin-bottom: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.7;
        }
        .footer-link {
          font-size: 12.5px;
          color: var(--home-text-faint);
          line-height: 2.2;
          cursor: pointer;
          transition: color 0.2s;
        }
        .footer-link:hover {
          color: var(--home-gold);
        }
        .footer-social {
          width: 34px;
          height: 34px;
          background: var(--home-card);
          border: 1px solid rgba(var(--home-border-rgb), 0.38);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.25s, transform 0.2s;
          cursor: pointer;
        }
        .footer-social:hover {
          border-color: rgba(var(--home-gold-rgb), 0.44);
          transform: translateY(-2px);
        }

        @media (max-width: 1024px) {
          .header-actions { margin-top: 0; }
          .feature-col { flex-direction: column; gap: 8px; }
        }
        @media (max-width: 768px) {
          .header-top {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 24px;
          }
          .header-actions { width: 100%; }
          .tab-switcher { width: 100%; }
          .tab-switch-btn { flex: 1; }
          .feature-grid { grid-template-columns: 1fr; gap: 16px; padding: 16px 0; border: none; }
          .feature-col { flex-direction: row; gap: 12px; border-right: none !important; border-bottom: 1px solid var(--home-border); padding: 0 0 16px 0 !important; }
          .feature-col:last-child { border-bottom: none; padding-bottom: 0 !important; }
          .cards-grid { grid-template-columns: 1fr; }
          .banner-container { flex-direction: column; align-items: flex-start; gap: 20px; }
          .banner-left { flex-direction: row; }
          .banner-btn { width: 100%; justify-content: center; }
          .join-form, .step2-container { padding: 24px; }
        }
        @media (max-width: 480px) {
          .main-container { padding: 16px; }
          .banner-left { flex-direction: column; align-items: flex-start; text-align: left; }
          .join-form, .step2-container { padding: 20px; }
          .tab-switch-btn { padding: 8px 12px; font-size: 13px; }
          .footer-grid { grid-template-columns: 1fr; gap: 24px; }
        }
      `}</style>

      <AppShell activeNav="stanze">
        <div className="crea-stanza-page" style={{ ...pageThemeVars, opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}>
          <div className="main-container">
            {/* HEADER */}
            <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <button
                  onClick={() => router.push('/home')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: P.textMuted,
                    fontWeight: 500,
                    marginBottom: '12px',
                    fontSize: '15px',
                  }}
                >
                  <ArrowLeft size={20} style={{ marginRight: '6px' }} />
                  Home
                </button>
                <div className="page-title">Crea una stanza</div>
              </div>
              <div className="header-actions">
                <div className="tab-switcher">
                  <button
                    onClick={switchToJoin}
                    className={`tab-switch-btn ${tab === 'join' ? 'active' : ''}`}
                  >
                    <Door size={18} weight={tab === 'join' ? 'fill' : 'duotone'} />
                    Entra
                  </button>
                  <button
                    onClick={switchToCreate}
                    className={`tab-switch-btn ${tab === 'create' ? 'active' : ''}`}
                  >
                    <Plus size={18} weight={tab === 'create' ? 'fill' : 'duotone'} />
                    Crea
                  </button>
                </div>
              </div>
            </div>

            {/* TAB: ENTRA CON CODICE */}
            {tab === 'join' && (
              <div className="join-wrapper">
                <form onSubmit={handleJoin} className="join-form ticket-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Door size={28} color={P.gold} weight="duotone" />
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: P.text }}>Entra con codice</div>
                      <div style={{ fontSize: '14px', color: P.textMuted }}>Inserisci il codice della stanza</div>
                    </div>
                  </div>
                  <input
                    className="code-input"
                    value={codeInput}
                    onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
                    placeholder="MAPLE-73"
                    maxLength={10}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {codeError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: P.pink }}>
                      <Warning size={16} color={P.pink} weight="fill" />
                      {codeError}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={codeInput.trim().length < 4}
                    style={{
                      background: codeInput.trim().length < 4 ? P.border : P.gold,
                      color: codeInput.trim().length < 4 ? P.textFaint : P.bg,
                    }}
                  >
                    <Door size={18} color={codeInput.trim().length < 4 ? P.textFaint : P.bg} weight="fill" />
                    Entra nella stanza
                  </button>
                  <div className="ticket-tear" style={{ background: P.bg }} />
                </form>
              </div>
            )}

            {/* TAB: CREA STANZA — STEP 1 */}
            {tab === 'create' && step === 1 && (
              <>
                {/* Feature Columns */}
                <div className="feature-grid">
                  <div className="feature-col" style={{ paddingRight: '24px', borderRight: `1px solid ${P.border}` }}>
                    <div style={{ color: P.pink }}>
                      <Users size={32} weight="duotone" />
                    </div>
                    <div>
                      <div style={{ color: P.text, fontWeight: 600, fontSize: '16px' }}>Trova il tuo match</div>
                      <div style={{ color: P.textMuted, fontSize: '14px' }}>Persone con i tuoi stessi gusti</div>
                    </div>
                  </div>
                  <div className="feature-col" style={{ padding: '0 24px', borderRight: `1px solid ${P.border}` }}>
                    <div style={{ color: P.purple }}>
                      <FilmSlate size={32} weight="duotone" />
                    </div>
                    <div>
                      <div style={{ color: P.text, fontWeight: 600, fontSize: '16px' }}>Scopri cosa vedere</div>
                      <div style={{ color: P.textMuted, fontSize: '14px' }}>Consigli su misura per te</div>
                    </div>
                  </div>
                  <div className="feature-col" style={{ paddingLeft: '24px' }}>
                    <div style={{ color: P.gold }}>
                      <Armchair size={32} weight="duotone" />
                    </div>
                    <div>
                      <div style={{ color: P.text, fontWeight: 600, fontSize: '16px' }}>Vivi il cinema</div>
                      <div style={{ color: P.textMuted, fontSize: '14px' }}>Insieme è meglio</div>
                    </div>
                  </div>
                </div>

                {/* 2x2 Cards Grid */}
                <div className="cards-grid">
                  {modeCards.map((card) => {
                    const themeColor = card.color;
                    return (
                      <div
                        key={card.id}
                        onClick={() => setMode(card.id)}
                        className={`card-item ${mode === card.id ? 'selected' : ''}`}
                        style={{ borderColor: mode === card.id ? themeColor : undefined }}
                      >
                        <div className="card-blur-bg" style={{ background: themeColor }} />
                        <div className="card-icon-bg">
                          {card.id === 'trending' && <TrendUp size={120} weight="duotone" color={themeColor} />}
                          {card.id === 'cinema' && <Ticket size={120} weight="duotone" color={themeColor} />}
                          {card.id === 'streaming' && <Television size={120} weight="duotone" color={themeColor} />}
                          {card.id === 'discover' && <Funnel size={120} weight="duotone" color={themeColor} />}
                        </div>
                        <div className="card-content">
                          <div style={{ color: themeColor, marginBottom: '12px' }}>{card.icon}</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: P.text }}>{card.title}</div>
                          <div style={{ fontSize: '14px', color: P.textMuted, marginTop: '8px', lineHeight: '1.5' }}>{card.desc}</div>
                          <div style={{ marginTop: '16px', fontSize: '13px', fontWeight: '600', color: themeColor }}>{card.badge}</div>
                        </div>
                        {mode === card.id && (
                          <div className="card-check" style={{ background: themeColor }}>
                            <Check size={14} color="#000" weight="bold" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Banner */}
                <div className="banner-container">
                  <div className="banner-left">
                    <div className="banner-icon-wrap">
                      <Popcorn size={32} weight="duotone" color="#fff" />
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '20px' }}>Il cinema è meglio insieme</div>
                      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', marginTop: '4px' }}>
                        Crea una stanza, invita i tuoi amici e iniziate subito a guardare qualcosa di straordinario.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCreateAction}
                    disabled={!mode || isCreating}
                    className="banner-btn"
                  >
                    <Plus size={20} style={{ marginRight: '8px' }} color={(!mode || isCreating) ? P.textFaint : P.bg} />
                    Crea una stanza
                  </button>
                </div>
              </>
            )}

            {/* TAB: CREA STANZA — STEP 2 */}
            {tab === 'create' && step === 2 && (
              <div className="step2-container ticket-card">
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: P.text, marginBottom: '24px' }}>
                  Filtri avanzati
                </div>

                {/* Generi */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: P.text, marginBottom: '12px' }}>
                    Generi
                    <span style={{ fontSize: '14px', color: P.textMuted, fontWeight: '400', marginLeft: '8px' }}>
                      (opzionale — vuoto = tutti)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {GENRES.map((g) => (
                      <button
                        key={g.id}
                        className={`genre-chip${selectedGenres.includes(g.id) ? ' selected' : ''}`}
                        onClick={() => toggleGenre(g.id)}
                      >
                        <span>{g.emoji}</span>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Anni */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: P.text, marginBottom: '12px' }}>
                    Periodo di uscita
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: P.textMuted, marginBottom: '6px', textAlign: 'center' }}>Dal</div>
                      <input
                        type="number"
                        className="year-input"
                        value={yearFromStr}
                        onChange={(e) => { setYearFromStr(e.target.value); setYearError(''); }}
                        onBlur={validateYears}
                        min={1900}
                        max={currentYear}
                        placeholder="2000"
                      />
                    </div>
                    <div style={{ fontSize: '16px', color: P.textMuted, paddingTop: '16px', textAlign: 'center' }}>→</div>
                    <div>
                      <div style={{ fontSize: '12px', color: P.textMuted, marginBottom: '6px', textAlign: 'center' }}>Al</div>
                      <input
                        type="number"
                        className="year-input"
                        value={yearToStr}
                        onChange={(e) => { setYearToStr(e.target.value); setYearError(''); if (parseInt(e.target.value) < yearFrom) setYearError('L\'anno "al" non può essere minore dell\'anno "dal"'); }}
                        onBlur={validateYears}
                        min={yearFrom}
                        max={currentYear + 1}
                        placeholder={String(currentYear)}
                      />
                    </div>
                  </div>
                  {yearError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '14px', color: P.pink }}>
                      <Warning size={16} color={P.pink} weight="fill" />
                      {yearError}
                    </div>
                  )}
                </div>

                {/* Riepilogo */}
                <div style={{ background: P.bgSoft, border: `1px solid ${P.border}`, padding: '16px', marginBottom: '24px', fontSize: '14px', color: P.textMuted, lineHeight: '1.8' }}>
                  <div style={{ fontWeight: '700', color: P.text, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FilmSlate size={18} color={P.gold} weight="duotone" />
                    Riepilogo stanza
                  </div>
                  <div>
                    🎬 {selectedGenres.length === 0 ? 'Tutti i generi' : selectedGenres.map(id => { const g = GENRES.find(g => g.id === id); return `${g?.emoji} ${g?.label}`; }).join(', ')}
                  </div>
                  <div>📅 Dal {yearFrom} al {yearTo}</div>
                </div>

                <button
                  className="btn-primary"
                  disabled={!!yearError || isCreating}
                  onClick={handleCreate}
                  style={{ background: isCreating ? P.border : P.gold, color: isCreating ? P.textFaint : P.bg }}
                >
                  {isCreating ? (
                    '⏳ Creazione...'
                  ) : (
                    <>
                      <FilmSlate size={20} color={P.bg} weight="fill" />
                      Crea stanza
                    </>
                  )}
                </button>
                <div className="ticket-tear" style={{ background: P.bg }} />
              </div>
            )}

            {/* FOOTER (disattivato) */}
            {false && <div className="footer-cine" style={{ marginTop: 'auto' }}>
              <div className="footer-grid">
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: P.text, marginBottom: '10px', fontFamily: FONT_DISPLAY, letterSpacing: '-0.01em' }}>
                    CINE<span style={{ color: P.pink }}>DATE</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: P.textFaint, lineHeight: 1.7, maxWidth: '200px', fontStyle: 'italic' }}>
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
              <div style={{ fontSize: '11px', color: P.textFaint, textAlign: 'center', marginTop: '28px', letterSpacing: '0.04em', borderTop: `1px solid ${P.border}30`, paddingTop: '18px' }}>
                © 2026 CineDate — Tutti i diritti riservati
              </div>
            </div>}
          </div>
        </div>
      </AppShell>
    </>
  );
}