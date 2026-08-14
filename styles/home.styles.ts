// ─── Palette dark "cinema elegante" ──────────────────────────────────────────
export const DARK = {
  bg:         '#0a0806',
  bgSoft:     '#14100e',
  card:       '#1c1613',
  cardHover:  '#241d19',
  border:     '#2d221c',
  gold:       '#f5b92f',
  goldSoft:   '#ffd875',
  goldGlow:   'rgba(245,185,47,0.12)',
  pink:       '#ed3d73',
  pinkDeep:   '#8e1740',
  pinkGlow:   'rgba(237,61,115,0.15)',
  text:       '#f0ebe6',
  textMuted:  '#b5a89e',
  textFaint:  '#7a6b60',
} as const;

// ─── Palette light "cinema elegante" ─────────────────────────────────────────
export const LIGHT = {
  bg:         '#f5efe8',
  bgSoft:     '#ece3d9',
  card:       '#ffffff',
  cardHover:  '#faf5ef',
  border:     '#d6cbbc',
  gold:       '#b8860b',
  goldSoft:   '#e8c84a',
  goldGlow:   'rgba(184,134,11,0.10)',
  pink:       '#b83060',
  pinkDeep:   '#8a1d44',
  pinkGlow:   'rgba(184,48,96,0.10)',
  text:       '#1f1a16',
  textMuted:  '#5c5248',
  textFaint:  '#8a7c6e',
} as const;

export type Palette = typeof DARK;

export const FONT         = "'Inter','Helvetica Neue',sans-serif";
export const FONT_DISPLAY = "'Playfair Display','Georgia',serif";
export const FONT_MONO    = "'JetBrains Mono','Courier New',monospace";

// ─── CSS generato in base alla palette ───────────────────────────────────────
export function buildHomeStyles(P: Palette): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

    *, *::before, *::after { box-sizing: border-box; }
    button, input { border-radius: 0 !important; }
    ::selection { background: ${P.pink}; color: #fff; }

    @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

    .skeleton {
      background: linear-gradient(90deg, ${P.card} 25%, ${P.cardHover} 50%, ${P.card} 75%);
      background-size: 400px 100%;
      animation: shimmer 1.4s ease infinite;
    }

    .animate-in { animation: fadeSlideUp 0.4s ease forwards; }
    .animate-in-delay-1 { animation-delay: 0.05s; opacity: 0; }
    .animate-in-delay-2 { animation-delay: 0.10s; opacity: 0; }
    .animate-in-delay-3 { animation-delay: 0.15s; opacity: 0; }

    .home-cine {
      font-family: ${FONT};
      background: ${P.bg};
      color: ${P.text};
      min-height: 100%;
      letter-spacing: -0.01em;
    }

    /* ── Film strip ── */
    .film-strip {
      display: flex; gap: 10px; padding: 4px 0;
      overflow: hidden; opacity: 0.05;
      position: absolute; left: 0; right: 0; pointer-events: none;
    }
    .film-strip .sprocket {
      width: 5px; height: 12px;
      background: ${P.text}; flex-shrink: 0; border-radius: 1px;
    }

    /* ── Ticket card ── */
    .ticket-card {
      background: ${P.card}; border: 1px solid ${P.border};
      position: relative;
      transition: transform 0.25s cubic-bezier(0.2,0,0,1), box-shadow 0.3s ease;
      cursor: pointer; overflow: hidden;
    }
    .ticket-card::after {
      content: ''; position: absolute; inset: 0;
      border: 1px solid transparent;
      transition: border-color 0.3s ease; pointer-events: none;
    }
    .ticket-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
    .ticket-card:hover::after { border-color: ${P.gold}60; }
    .ticket-card .ticket-tear {
      position: absolute; left: 50%; bottom: -1px;
      transform: translateX(-50%); width: 16px; height: 6px;
      background: ${P.bg}; border-radius: 50% 50% 0 0;
      border-left: 1px solid ${P.border}; border-right: 1px solid ${P.border};
      border-top: 1px solid ${P.border}; opacity: 0.6;
    }

    /* ── Movie card ── */
    .movie-card-scroll {
      flex-shrink: 0; width: 148px; cursor: pointer;
      transition: transform 0.25s cubic-bezier(0.2,0,0,1);
      position: relative;
    }
    .movie-card-scroll:hover { transform: translateY(-5px) scale(1.01); }
    .movie-card-scroll img {
      width: 100%; aspect-ratio: 2/3; object-fit: cover;
      background: ${P.card}; border: 1px solid ${P.border};
      transition: border-color 0.3s;
    }
    .movie-card-scroll:hover img { border-color: ${P.gold}70; }
    .movie-badge {
      position: absolute; top: 6px; left: 6px;
      width: 28px; height: 28px;
      background: ${P.pink}; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800;
      box-shadow: 0 0 16px ${P.pink}40;
      border: 1px solid rgba(255,255,255,0.12);
      font-family: ${FONT_MONO};
    }
    .movie-badge.top { background: ${P.gold}; color: ${P.bg}; box-shadow: 0 0 16px ${P.gold}30; }
    .movie-rating-stars { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
    .movie-rating-stars .stars { color: ${P.gold}; font-size: 10px; letter-spacing: 0.5px; }
    .movie-rating-stars .num { font-size: 11px; color: ${P.textFaint}; font-weight: 600; }

    /* ── Section ── */
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 16px; flex-wrap: wrap; gap: 8px;
    }
    .section-title {
      font-size: 16px; font-weight: 700; color: ${P.text};
      display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em;
    }
    .section-title .accent-line { width: 20px; height: 2px; background: ${P.gold}; display: inline-block; opacity: 0.7; }
    .section-link {
      font-size: 12.5px; color: ${P.gold}; font-weight: 600;
      background: none; border: none; cursor: pointer;
      font-family: ${FONT}; padding: 0;
      display: flex; align-items: center; gap: 4px;
      transition: color 0.2s, gap 0.2s; letter-spacing: 0.02em;
    }
    .section-link:hover { color: ${P.goldSoft}; gap: 8px; }

    .scroll-row {
      display: flex; gap: 16px; overflow-x: auto; padding-bottom: 12px;
      scrollbar-width: thin; scrollbar-color: ${P.gold}40 transparent;
    }
    .scroll-row::-webkit-scrollbar { height: 2px; }
    .scroll-row::-webkit-scrollbar-track { background: transparent; }
    .scroll-row::-webkit-scrollbar-thumb { background: ${P.gold}60; border-radius: 0; }

    /* ── Feature + suggestion ── */
    .feature-pill, .suggestion-card {
      background: ${P.card}; border: 1px solid ${P.border};
      padding: 16px 18px; display: flex; gap: 14px; align-items: flex-start;
      transition: border-color 0.25s, transform 0.2s;
    }
    .feature-pill:hover { border-color: ${P.gold}60; transform: translateY(-2px); }
    .feature-pill-icon, .suggestion-icon {
      width: 40px; height: 40px; flex-shrink: 0;
      background: ${P.pink}18;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.3s;
    }
    .feature-pill:hover .feature-pill-icon { background: ${P.pink}30; }
    .feature-pill-title { font-size: 13.5px; font-weight: 700; color: ${P.text}; margin-bottom: 2px; letter-spacing: -0.01em; }
    .feature-pill-desc { font-size: 12px; color: ${P.textFaint}; line-height: 1.5; }
    .suggestion-card { flex-direction: column; gap: 10px; cursor: default; transition: border-color 0.25s, transform 0.2s; }
    .suggestion-card:hover { border-color: ${P.gold}60; transform: translateY(-3px); }
    .suggestion-title { font-size: 14px; font-weight: 700; color: ${P.text}; margin-bottom: 2px; }
    .suggestion-desc { font-size: 12px; color: ${P.textFaint}; line-height: 1.5; }
    .suggestion-more {
      font-size: 12px; font-weight: 700; color: ${P.gold}; cursor: pointer;
      transition: color 0.2s, gap 0.2s;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .suggestion-more:hover { color: ${P.goldSoft}; gap: 8px; }

    /* ── Code input ── */
    .code-input {
      flex: 1; padding: 12px 16px; border: 1px solid ${P.border};
      font-size: 14px; font-family: ${FONT_MONO}; color: ${P.text};
      background: ${P.bgSoft}; outline: none; letter-spacing: 1.5px;
      transition: border-color 0.25s;
    }
    .code-input::placeholder { color: ${P.textFaint}; letter-spacing: 0.5px; font-family: ${FONT}; }
    .code-input:focus { border-color: ${P.gold}70; }
    .code-submit {
      padding: 12px 22px; background: ${P.gold}; color: ${P.bg};
      border: 1px solid ${P.gold}; font-size: 13.5px; font-weight: 700;
      cursor: pointer; font-family: ${FONT};
      transition: background 0.25s, transform 0.15s; letter-spacing: 0.03em;
    }
    .code-submit:hover { background: ${P.goldSoft}; transform: scale(1.02); }

    /* ── How row ── */
    .how-row {
      display: flex; align-items: center; gap: 14px; padding: 16px 0;
      border-bottom: 1px solid ${P.border}60;
    }
    .how-row:last-child { border-bottom: none; }
    .how-icon {
      width: 42px; height: 42px; flex-shrink: 0;
      background: ${P.pink}18;
      display: flex; align-items: center; justify-content: center;
    }
    .how-title { font-size: 14px; font-weight: 700; color: ${P.text}; letter-spacing: -0.01em; }
    .how-desc { font-size: 12.5px; color: ${P.textFaint}; margin-top: 2px; }

    /* ── Room card ── */
    .room-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; background: ${P.card}; border: 1px solid ${P.border}60;
      cursor: pointer; transition: border-color 0.25s, background 0.2s, transform 0.15s;
      margin-bottom: 8px;
    }
    .room-card:hover { border-color: ${P.gold}60; background: ${P.cardHover}; transform: translateX(4px); }
    .btn-enter {
      background: transparent; color: ${P.gold}; border: 1px solid ${P.gold}60;
      padding: 4px 16px; font-size: 11px; font-weight: 700;
      cursor: pointer; font-family: ${FONT};
      transition: background 0.2s, color 0.2s, transform 0.15s; letter-spacing: 0.04em;
    }
    .btn-enter:hover { background: ${P.gold}; color: ${P.bg}; transform: scale(1.05); }

    /* ── Footer ── */
    .footer-cine { border-top: 1px solid ${P.border}60; padding: 36px 20px 24px; position: relative; }
    .footer-cine::before {
      content: ''; position: absolute; top: -1px; left: 15%; right: 15%; height: 1px;
      background: linear-gradient(90deg, transparent, ${P.gold}30, transparent);
    }
    .footer-col-title {
      font-size: 12px; font-weight: 700; color: ${P.text};
      margin-bottom: 12px; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.7;
    }
    .footer-link { font-size: 12.5px; color: ${P.textFaint}; line-height: 2.2; cursor: pointer; transition: color 0.2s; }
    .footer-link:hover { color: ${P.gold}; }
    .footer-social {
      width: 34px; height: 34px; background: ${P.card}; border: 1px solid ${P.border}60;
      display: flex; align-items: center; justify-content: center;
      transition: border-color 0.25s, transform 0.2s; cursor: pointer;
    }
    .footer-social:hover { border-color: ${P.gold}70; transform: translateY(-2px); }

    /* ── Responsive ── */
    @media (min-width: 1024px) {
      .home-layout { display: grid; grid-template-columns: 1fr 320px; gap: 32px; padding: 20px 32px 32px; }
      .home-sidebar { display: flex; flex-direction: column; gap: 20px; }
      .home-main { min-width: 0; }
      .mobile-only { display: none !important; }
      .footer-cine { padding: 40px 40px 28px; }
      .footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 40px; }
    }
    @media (max-width: 1023px) {
      .home-layout { display: contents; }
      .home-sidebar { display: contents; }
      .home-main { display: contents; }
      .desktop-only { display: none !important; }
      .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    }
  `;
}