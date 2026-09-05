'use client';

import { useRouter } from 'next/router';
import {
  Heart,
  InstagramLogo,
  TiktokLogo,
  XLogo,
} from '@phosphor-icons/react';
import { useTheme } from '@/context/ThemeContext';

const DARK = {
  bg: '#0a0806',
  card: '#1c1613',
  border: '#2d221c',
  gold: '#f5b92f',
  pink: '#ed3d73',
  text: '#f0ebe6',
  muted: '#b5a89e',
  faint: '#7a6b60',
};

const LIGHT = {
  bg: '#f5efe8',
  card: '#ffffff',
  border: '#d6cbbc',
  gold: '#b8860b',
  pink: '#b83060',
  text: '#1f1a16',
  muted: '#5c5248',
  faint: '#8a7c6e',
};

export default function AppFooter() {
  const router = useRouter();
  const { theme } = useTheme();
  const P = theme === 'dark' ? DARK : LIGHT;

  const css = {
    '--footer-bg': P.bg,
    '--footer-card': P.card,
    '--footer-border': P.border,
    '--footer-gold': P.gold,
    '--footer-pink': P.pink,
    '--footer-text': P.text,
    '--footer-muted': P.muted,
    '--footer-faint': P.faint,
  } as React.CSSProperties;

  return (
    <footer className="app-footer" style={css}>
      <div className="app-footer-grid">
        <div>
          <div className="app-footer-logo">
            CINE<span>DATE</span>
          </div>

          <p>
            “Il cinema, in compagnia. Trova il film perfetto, insieme.”
          </p>
        </div>

        <div>
          <h2>Navigazione</h2>

          <button onClick={() => router.push('/home')}>
            Come funziona
          </button>

          <button onClick={() => router.push('/recensioni')}>
            Recensioni
          </button>

          <button onClick={() => router.push('/cinema')}>
            Cinema vicino a te
          </button>

          <button onClick={() => router.push('/profilo')}>
            Profilo
          </button>
        </div>

        <div>
          <h2>Legal</h2>
          <span>Termini di servizio</span>
          <span>Privacy policy</span>
          <span>Cookie policy</span>
        </div>

        <div>
          <h2>Seguici</h2>

          <div className="app-footer-socials">
            <i>
              <InstagramLogo size={15} color={P.muted} />
            </i>

            <i>
              <TiktokLogo size={15} color={P.muted} />
            </i>

            <i>
              <XLogo size={15} color={P.muted} />
            </i>
          </div>

          <small>
            <Heart size={12} weight="fill" />
            Fatto con passione per chi ama il cinema
          </small>
        </div>
      </div>

      <div className="app-footer-copy">
        © 2026 CineDate — Tutti i diritti riservati
      </div>

      <style jsx>{`
        .app-footer {
          background: var(--footer-bg);
          border-top: 1px solid var(--footer-border);
          color: var(--footer-faint);
          padding: 36px 20px 24px;
          position: relative;
        }

        .app-footer::before {
          content: '';
          position: absolute;
          top: -1px;
          left: 15%;
          right: 15%;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--footer-gold),
            transparent
          );
          opacity: 0.3;
        }

        .app-footer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          max-width: 1200px;
          margin: auto;
        }

        .app-footer-logo {
          color: var(--footer-text);
          font: 800 16px 'Playfair Display', Georgia, serif;
          margin-bottom: 10px;
        }

        .app-footer-logo span,
        small :global(svg) {
          color: var(--footer-pink);
        }

        p {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.7;
          max-width: 200px;
          font-style: italic;
        }

        h2 {
          color: var(--footer-text);
          font-size: 12px;
          margin: 0 0 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.7;
        }

        button,
        span {
          display: block;
          color: var(--footer-faint);
          font: inherit;
          font-size: 12.5px;
          line-height: 2.2;
        }

        button {
          border: 0;
          padding: 0;
          background: none;
          text-align: left;
          cursor: pointer;
          transition: color 0.2s;
        }

        button:hover {
          color: var(--footer-gold);
        }

        .app-footer-socials {
          display: flex;
          gap: 8px;
        }

        i {
          width: 34px;
          height: 34px;
          background: var(--footer-card);
          border: 1px solid var(--footer-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-style: normal;
          transition: border-color 0.2s, transform 0.2s;
        }

        i:hover {
          border-color: var(--footer-gold);
          transform: translateY(-2px);
        }

        small {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 16px;
          font-size: 11px;
          line-height: 1.6;
        }

        .app-footer-copy {
          max-width: 1200px;
          margin: 28px auto 0;
          padding-top: 18px;
          border-top: 1px solid var(--footer-border);
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.04em;
        }

        @media (min-width: 1024px) {
          .app-footer {
            padding: 40px 40px 28px;
          }

          .app-footer-grid {
            grid-template-columns: 1.6fr 1fr 1fr 1fr;
            gap: 40px;
          }
        }

        @media (max-width: 480px) {
          .app-footer-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </footer>
  );
}