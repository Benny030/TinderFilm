import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowClockwise,
  ArrowRight,
  Article,
  FilmSlate,
  Heart,
  MapPin,
  Play,
  Star,
  TelevisionSimple,
  Ticket,
  Trophy,
} from '@phosphor-icons/react';

import CinemaInSala from '@/components/cinema/CinemaInSala';
import { useTheme } from '@/context/ThemeContext';
import { FONT, R, THEME } from '@/styles/token';
import type {
  ExtendedMovie,
  MatchEntry,
  StreamingSource,
} from '@/types/stanza';

type Props = {
  match: ExtendedMovie;
  allMatches: MatchEntry[];
  onContinue: () => void;
  onReset: () => void;
  isLoggedIn: boolean;
  isHost?: boolean;
  selectedMovieId?: string | null;
  onSelectWinner?: (movieId: string) => void;
  selectingWinner?: boolean;
};

function PlatformRow({ s }: { s: StreamingSource }) {
  const { theme } = useTheme();
  const P = theme === 'dark' ? THEME.dark : THEME.light;

  const typeLabel =
    s.type === 'sub'
      ? "Incluso nell'abbonamento"
      : s.type === 'free'
        ? 'Gratuito'
        : s.type === 'rent'
          ? `Noleggio${s.price ? ` · €${s.price.toFixed(2)}` : ''}`
          : `Acquisto${s.price ? ` · €${s.price.toFixed(2)}` : ''}`;

  return (
    <button
      type="button"
      className="cdr-match-platform"
      onClick={() => s.url && window.open(s.url, '_blank')}
      disabled={!s.url}
      style={
        {
          '--cdr-platform-accent': s.color ?? P.primary,
        } as CSSProperties
      }
    >
      <div className="cdr-match-platform-left">
        <div
          className="cdr-match-platform-logo"
          style={{ background: s.color ?? P.bgSoft }}
        >
          {s.logoUrl ? (
            <img
              src={s.logoUrl}
              alt={s.name}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span>{s.name.slice(0, 3).toUpperCase()}</span>
          )}
        </div>

        <div className="cdr-match-platform-copy">
          <strong>{s.name}</strong>
          <span
            data-kind={
              s.type === 'sub' || s.type === 'free' ? 'included' : 'paid'
            }
          >
            {typeLabel}
          </span>
        </div>
      </div>

      {s.url && (
        <span className="cdr-match-platform-go">
          Guarda
          <ArrowRight size={13} weight="bold" />
        </span>
      )}
    </button>
  );
}

export default function MatchScreen({
  match,
  allMatches,
  onContinue,
  onReset,
  isLoggedIn,
  isHost = false,
  selectedMovieId = null,
  onSelectWinner,
  selectingWinner = false,
}: Props) {
  const { theme } = useTheme();
  const P = theme === 'dark' ? THEME.dark : THEME.light;
  const router = useRouter();

  const [sources, setSources] = useState<StreamingSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);

  useEffect(() => {
    const tmdbId = match.tmdb_id;

    if (!tmdbId) {
      setSources([]);
      setLoadingSources(false);
      return;
    }

    setLoadingSources(true);

    fetch(`/api/watchmode/${tmdbId}`)
      .then((response) => response.json())
      .then((data) => setSources(data.sources ?? []))
      .catch(() => setSources([]))
      .finally(() => setLoadingSources(false));
  }, [match.id, match.tmdb_id]);

  const subSources = sources.filter(
    (source) => source.type === 'sub' || source.type === 'free'
  );
  const rentSources = sources.filter(
    (source) => source.type === 'rent' || source.type === 'buy'
  );

  const isSelected = selectedMovieId === String(match.id);
  const canSelectWinner = isHost && !selectedMovieId && !!onSelectWinner;
  const detailMovieId = match.tmdb_id ? String(match.tmdb_id) : String(match.id);

  const vars = {
    '--cdr-match-bg': P.bg,
    '--cdr-match-soft': P.bgSoft,
    '--cdr-match-surface': P.surface,
    '--cdr-match-surface-hover': P.surfaceHover,
    '--cdr-match-border': P.border,
    '--cdr-match-text': P.text,
    '--cdr-match-muted': P.textMuted,
    '--cdr-match-faint': P.textFaint,
    '--cdr-match-pink': P.primary,
    '--cdr-match-pink-deep': P.primaryDeep,
    '--cdr-match-pink-glow': P.primaryGlow,
    '--cdr-match-gold': P.accent,
    '--cdr-match-gold-soft': P.accentSoft,
    '--cdr-match-gold-glow': P.accentGlow,
  } as CSSProperties;

  return (
    <main className="cdr-match" style={vars}>
      <style>{`
        .cdr-match {
          width: 100%;
          min-height: 100%;
          min-height: 100dvh;
          overflow-x: hidden;
          background: var(--cdr-match-bg);
          color: var(--cdr-match-text);
          font-family: ${FONT.sans};
        }

        .cdr-match * {
          box-sizing: border-box;
        }

        .cdr-match button {
          font-family: ${FONT.sans};
        }

        .cdr-match-hero {
          position: relative;
          overflow: hidden;
          min-height: clamp(180px, 24vw, 240px);
          display: grid;
          place-items: center;
          padding: clamp(30px, 5vw, 46px) 20px clamp(28px, 4vw, 38px);
          text-align: center;
          color: #fff;
          background:
            radial-gradient(circle at 50% 0%, rgba(255,255,255,.2), transparent 34%),
            linear-gradient(135deg, var(--cdr-match-pink), var(--cdr-match-pink-deep));
        }

        .cdr-match-hero::before,
        .cdr-match-hero::after {
          content: '';
          position: absolute;
          border: 1px solid rgba(255,255,255,.18);
          transform: rotate(45deg);
        }

        .cdr-match-hero::before {
          width: 180px;
          height: 180px;
          top: -110px;
          left: -80px;
        }

        .cdr-match-hero::after {
          width: 220px;
          height: 220px;
          right: -130px;
          bottom: -140px;
        }

        .cdr-match-hero-inner {
          position: relative;
          z-index: 1;
          width: min(100%, 620px);
          animation: cdr-match-hero-in .58s cubic-bezier(.2,.82,.2,1) both;
        }

        .cdr-match-heart {
          width: 58px;
          height: 58px;
          margin: 0 auto 14px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.3);
          background: rgba(255,255,255,.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          animation: cdr-match-heart-pop .72s .08s cubic-bezier(.2,1.3,.2,1) both;
        }

        .cdr-match-eyebrow {
          margin-bottom: 7px;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .14em;
          text-transform: uppercase;
          opacity: .78;
        }

        .cdr-match-title {
          margin: 0;
          font-family: ${FONT.display};
          font-size: clamp(34px, 6vw, 52px);
          line-height: .98;
          letter-spacing: -.035em;
        }

        .cdr-match-subtitle {
          margin: 11px auto 0;
          max-width: 520px;
          color: rgba(255,255,255,.82);
          font-size: 13px;
          line-height: 1.55;
        }

        .cdr-match-total {
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border: 1px solid rgba(255,255,255,.28);
          background: rgba(255,255,255,.1);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .02em;
        }

        .cdr-match-content {
          width: min(100%, 1120px);
          margin: 0 auto;
          padding: clamp(18px, 3vw, 28px) clamp(14px, 3vw, 28px) 136px;
        }

        .cdr-match-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(300px, .92fr);
          gap: clamp(14px, 2.2vw, 24px);
          align-items: start;
        }

        .cdr-match-stack {
          display: grid;
          gap: 18px;
        }

        .cdr-match-panel {
          border: 1px solid var(--cdr-match-border);
          background: var(--cdr-match-surface);
          box-shadow: 0 10px 30px rgba(31,26,22,.05);
        }

        .cdr-match-film {
          display: grid;
          grid-template-columns: clamp(104px, 12vw, 132px) minmax(0,1fr);
          gap: clamp(14px, 2vw, 20px);
          padding: clamp(14px, 2vw, 18px);
        }

        .cdr-match-poster {
          width: 100%;
          aspect-ratio: 2 / 3;
          display: block;
          object-fit: cover;
          min-width: 0;
          border: 1px solid var(--cdr-match-border);
          background: var(--cdr-match-soft);
        }

        .cdr-match-film-copy {
          min-width: 0;
          align-self: center;
        }

        .cdr-match-film-label {
          margin-bottom: 7px;
          color: var(--cdr-match-pink);
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .cdr-match-film-title {
          margin: 0;
          font-family: ${FONT.display};
          font-size: clamp(25px, 3.5vw, 36px);
          line-height: 1.02;
          letter-spacing: -.025em;
        }

        .cdr-match-meta {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          color: var(--cdr-match-muted);
          font-size: 11px;
        }

        .cdr-match-rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--cdr-match-gold);
          font-weight: 850;
        }

        .cdr-match-plot {
          margin: 13px 0 0;
          color: var(--cdr-match-muted);
          font-size: 12px;
          line-height: 1.68;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 4;
          overflow: hidden;
        }

        .cdr-match-film-actions {
          margin-top: 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          width: 100%;
        }

        .cdr-match-trailer,
        .cdr-match-detail {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border: 1px solid var(--cdr-match-pink);
          border-radius: 0;
          background: transparent;
          color: var(--cdr-match-pink);
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
          transition: 160ms ease;
        }

        .cdr-match-trailer:hover {
          background: var(--cdr-match-pink-glow);
          transform: translateY(-1px);
        }

        .cdr-match-detail {
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border: 1px solid var(--cdr-match-border);
          border-radius: 0;
          background: transparent;
          color: var(--cdr-match-text);
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
          transition: 160ms ease;
        }

        .cdr-match-detail:hover {
          background: var(--cdr-match-surface-hover);
          border-color: var(--cdr-match-text);
          transform: translateY(-1px);
        }

        .cdr-match-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--cdr-match-border);
          background: var(--cdr-match-soft);
        }

        .cdr-match-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cdr-match-section-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid currentColor;
          flex: 0 0 auto;
        }

        .cdr-match-section-icon.gold {
          color: var(--cdr-match-gold);
          background: var(--cdr-match-gold-glow);
        }

        .cdr-match-section-icon.pink {
          color: var(--cdr-match-pink);
          background: var(--cdr-match-pink-glow);
        }

        .cdr-match-section-copy strong {
          display: block;
          font-size: 13px;
          line-height: 1.2;
        }

        .cdr-match-section-copy span {
          display: block;
          margin-top: 3px;
          color: var(--cdr-match-muted);
          font-size: 10px;
          line-height: 1.35;
        }

        .cdr-match-section-body {
          padding: 14px;
        }

        .cdr-match-streaming {
          display: grid;
          gap: 8px;
        }

        .cdr-match-group-label {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
          color: var(--cdr-match-muted);
          font-size: 9px;
          font-weight: 850;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .cdr-match-group-label::before {
          content: '';
          width: 6px;
          height: 6px;
          background: currentColor;
        }

        .cdr-match-group-label.included {
          color: #22c55e;
        }

        .cdr-match-group-label.paid {
          color: var(--cdr-match-gold);
        }

        .cdr-match-platform {
          width: 100%;
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border: 1px solid var(--cdr-match-border);
          border-radius: 0;
          background: var(--cdr-match-bg);
          color: var(--cdr-match-text);
          text-align: left;
          cursor: pointer;
          transition: 160ms ease;
        }

        .cdr-match-platform:disabled {
          cursor: default;
        }

        .cdr-match-platform:not(:disabled):hover {
          border-color: var(--cdr-platform-accent);
          background: var(--cdr-match-surface-hover);
          transform: translateY(-1px);
        }

        .cdr-match-platform-left {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cdr-match-platform-logo {
          width: 48px;
          height: 34px;
          display: grid;
          place-items: center;
          overflow: hidden;
          flex: 0 0 auto;
          border: 1px solid var(--cdr-match-border);
          background: #fff !important;
          padding: 5px;
        }

        .cdr-match-platform-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: none;
        }

        .cdr-match-platform-logo span {
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
          color: #17130f;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: -.02em;
        }

        .cdr-match-platform-copy {
          min-width: 0;
        }

        .cdr-match-platform-copy strong {
          display: block;
          font-size: 12px;
        }

        .cdr-match-platform-copy span {
          display: block;
          margin-top: 2px;
          color: var(--cdr-match-muted);
          font-size: 10px;
        }

        .cdr-match-platform-copy span[data-kind="included"] {
          color: #22c55e;
        }

        .cdr-match-platform-copy span[data-kind="paid"] {
          color: var(--cdr-match-gold);
        }

        .cdr-match-platform-go {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--cdr-platform-accent);
          font-size: 10px;
          font-weight: 850;
        }

        .cdr-match-empty {
          min-height: 116px;
          display: grid;
          place-items: center;
          padding: 18px;
          border: 1px dashed var(--cdr-match-border);
          color: var(--cdr-match-muted);
          text-align: center;
          font-size: 11px;
          line-height: 1.5;
        }

        .cdr-match-empty svg {
          margin-bottom: 7px;
          color: var(--cdr-match-faint);
        }

        .cdr-match-skeleton {
          height: 58px;
          border: 1px solid var(--cdr-match-border);
          background:
            linear-gradient(
              90deg,
              var(--cdr-match-soft) 25%,
              var(--cdr-match-surface-hover) 50%,
              var(--cdr-match-soft) 75%
            );
          background-size: 400px 100%;
          animation: cdr-match-shimmer 1.3s ease infinite;
        }

        .cdr-match-divider {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--cdr-match-faint);
          font-size: 9px;
          margin: 4px 0;
        }

        .cdr-match-divider::before,
        .cdr-match-divider::after {
          content: '';
          flex: 1;
          border-top: 1px solid var(--cdr-match-border);
        }

        .cdr-match-actions {
          position: sticky;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          z-index: 20;
          border-top: 1px solid var(--cdr-match-border);
          background: color-mix(in srgb, var(--cdr-match-bg) 92%, transparent);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .cdr-match-actions-inner {
          width: min(100%, 1120px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1fr);
          gap: 9px;
          padding: 12px clamp(14px, 3vw, 28px) max(14px, env(safe-area-inset-bottom));
        }

        .cdr-match-selected {
          grid-column: 1 / -1;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px 12px;
          border: 1px solid var(--cdr-match-gold);
          background: var(--cdr-match-gold-glow);
          color: var(--cdr-match-gold);
          font-size: 11px;
          font-weight: 850;
        }

        .cdr-match-primary,
        .cdr-match-secondary,
        .cdr-match-winner {
          min-height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 0;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
          transition: 160ms ease;
        }

        .cdr-match-primary {
          border: 1px solid var(--cdr-match-pink);
          background: var(--cdr-match-pink);
          color: #fff;
          box-shadow: 0 8px 20px var(--cdr-match-pink-glow);
        }

        .cdr-match-primary:hover {
          background: var(--cdr-match-pink-deep);
          transform: translateY(-1px);
        }

        .cdr-match-secondary {
          border: 1px solid var(--cdr-match-border);
          background: transparent;
          color: var(--cdr-match-muted);
        }

        .cdr-match-secondary:hover {
          background: var(--cdr-match-surface-hover);
          color: var(--cdr-match-text);
        }

        .cdr-match-winner {
          grid-column: 1 / -1;
          border: 1px solid var(--cdr-match-gold);
          background: var(--cdr-match-gold);
          color: var(--cdr-match-bg);
        }

        .cdr-match-winner:disabled {
          cursor: wait;
          opacity: .68;
        }

        .cdr-match-note {
          padding-top: 2px;
          color: var(--cdr-match-faint);
          font-size: 9px;
          text-align: center;
          grid-column: 1 / -1;
        }

        @keyframes cdr-match-hero-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes cdr-match-heart-pop {
          0% {
            opacity: 0;
            transform: scale(.6) rotate(-8deg);
          }
          72% {
            opacity: 1;
            transform: scale(1.08) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0);
          }
        }

        @keyframes cdr-match-shimmer {
          from {
            background-position: -400px 0;
          }
          to {
            background-position: 400px 0;
          }
        }

        @media (max-width: 960px) {
          .cdr-match-grid {
            grid-template-columns: 1fr;
          }

          .cdr-match-stack {
            gap: 14px;
          }

          .cdr-match-content {
            width: min(100%, 760px);
          }
        }

        @media (max-width: 780px) {
          .cdr-match-hero {
            min-height: 190px;
            padding-inline: 16px;
          }

          .cdr-match-heart {
            width: 52px;
            height: 52px;
            margin-bottom: 11px;
          }

          .cdr-match-subtitle {
            max-width: 460px;
            font-size: 12px;
          }

          .cdr-match-content {
            padding: 16px 14px 128px;
          }

          .cdr-match-film {
            grid-template-columns: 94px minmax(0,1fr);
            gap: 14px;
            padding: 14px;
          }

          .cdr-match-film-title {
            font-size: clamp(22px, 6vw, 28px);
          }

          .cdr-match-plot {
            -webkit-line-clamp: 3;
          }

          .cdr-match-section-head {
            padding: 12px 13px;
          }

          .cdr-match-section-body {
            padding: 12px;
          }

          .cdr-match-actions-inner {
            padding: 10px 14px max(12px, env(safe-area-inset-bottom));
          }
        }

        @media (max-width: 560px) {
          .cdr-match-hero {
            min-height: 152px;
            padding: 20px 12px 18px;
          }

          .cdr-match-heart {
            width: 40px;
            height: 40px;
            margin-bottom: 8px;
          }

          .cdr-match-heart svg {
            width: 21px;
            height: 21px;
          }

          .cdr-match-eyebrow {
            margin-bottom: 4px;
            font-size: 8px;
          }

          .cdr-match-title {
            font-size: 31px;
          }

          .cdr-match-subtitle {
            margin-top: 6px;
            max-width: 330px;
            font-size: 10px;
            line-height: 1.4;
          }

          .cdr-match-total {
            margin-top: 9px;
            padding: 5px 8px;
            font-size: 9px;
          }

          .cdr-match-content {
            width: 100%;
            padding: 8px 8px 116px;
          }

          .cdr-match-grid,
          .cdr-match-stack {
            gap: 8px;
          }

          .cdr-match-panel {
            box-shadow: none;
          }

          .cdr-match-film {
            grid-template-columns: 86px minmax(0,1fr);
            gap: 10px;
            padding: 10px;
          }

          .cdr-match-film-label {
            margin-bottom: 4px;
            font-size: 8px;
            letter-spacing: .08em;
          }

          .cdr-match-film-title {
            font-size: 20px;
            line-height: 1.02;
          }

          .cdr-match-meta {
            margin-top: 5px;
            gap: 3px;
            font-size: 9px;
            line-height: 1.35;
          }

          .cdr-match-plot {
            display: none;
          }

          .cdr-match-film-actions {
            display: grid;
            grid-template-columns: minmax(0,1fr) minmax(0,1fr);
            gap: 5px;
            margin-top: 9px;
          }

          .cdr-match-trailer,
          .cdr-match-detail {
            width: 100%;
            min-width: 0;
            min-height: 34px;
            justify-content: center;
            padding: 6px 6px;
            font-size: 9px;
            white-space: nowrap;
          }

          .cdr-match-section-head {
            align-items: center;
            padding: 10px;
          }

          .cdr-match-section-title {
            gap: 8px;
          }

          .cdr-match-section-icon {
            width: 30px;
            height: 30px;
          }

          .cdr-match-section-copy strong {
            font-size: 12px;
          }

          .cdr-match-section-copy span {
            max-width: 220px;
            margin-top: 2px;
            font-size: 9px;
          }

          .cdr-match-section-body {
            padding: 9px;
          }

          .cdr-match-platform {
            min-height: 52px;
            gap: 8px;
            padding: 7px 8px;
          }

          .cdr-match-platform-left {
            gap: 8px;
          }

          .cdr-match-platform-logo {
            width: 42px;
            height: 30px;
            padding: 4px;
          }

          .cdr-match-platform-copy strong {
            font-size: 11px;
          }

          .cdr-match-platform-copy span {
            font-size: 9px;
          }

          .cdr-match-platform-go {
            display: none;
          }

          .cdr-match-empty {
            min-height: 88px;
            padding: 12px;
          }

          .cdr-match-actions-inner {
            grid-template-columns: minmax(0,1.25fr) minmax(0,.75fr);
            gap: 6px;
            padding: 7px 8px max(8px, env(safe-area-inset-bottom));
          }

          .cdr-match-winner,
          .cdr-match-selected,
          .cdr-match-note {
            grid-column: 1 / -1;
          }

          .cdr-match-primary,
          .cdr-match-secondary,
          .cdr-match-winner {
            min-height: 42px;
            padding: 7px 8px;
            font-size: 10px;
          }

          .cdr-match-selected {
            min-height: 38px;
            padding: 7px 8px;
            font-size: 10px;
          }

          .cdr-match-note {
            font-size: 8px;
          }
        }

        @media (min-width: 381px) and (max-width: 460px) {
          .cdr-match {
            min-height: 100dvh;
          }

          .cdr-match-hero {
            min-height: 138px;
            padding: 16px 12px 14px;
          }

          .cdr-match-heart {
            width: 36px;
            height: 36px;
            margin-bottom: 6px;
          }

          .cdr-match-heart svg {
            width: 19px;
            height: 19px;
          }

          .cdr-match-eyebrow {
            margin-bottom: 3px;
            font-size: 7px;
            letter-spacing: .12em;
          }

          .cdr-match-title {
            font-size: 29px;
            line-height: 1;
          }

          .cdr-match-subtitle {
            margin-top: 5px;
            max-width: 350px;
            font-size: 9px;
            line-height: 1.35;
          }

          .cdr-match-total {
            margin-top: 7px;
            padding: 4px 7px;
            font-size: 8px;
          }

          .cdr-match-content {
            width: 100%;
            padding: 6px 8px 104px;
          }

          .cdr-match-grid,
          .cdr-match-stack {
            gap: 7px;
          }

          .cdr-match-film {
            grid-template-columns: 82px minmax(0, 1fr);
            gap: 9px;
            padding: 9px;
          }

          .cdr-match-film-title {
            font-size: 19px;
            line-height: 1.02;
          }

          .cdr-match-meta {
            font-size: 9px;
            gap: 3px;
          }

          .cdr-match-film-actions {
            grid-template-columns: 1fr 1fr;
            gap: 5px;
            margin-top: 8px;
          }

          .cdr-match-trailer,
          .cdr-match-detail {
            min-height: 32px;
            padding: 5px 5px;
            font-size: 8.5px;
          }

          .cdr-match-section-head {
            padding: 8px 9px;
          }

          .cdr-match-section-icon {
            width: 28px;
            height: 28px;
          }

          .cdr-match-section-copy strong {
            font-size: 11px;
          }

          .cdr-match-section-copy span {
            max-width: 250px;
            font-size: 8.5px;
          }

          .cdr-match-section-body {
            padding: 8px;
          }

          .cdr-match-platform {
            min-height: 48px;
            padding: 6px 7px;
          }

          .cdr-match-platform-logo {
            width: 40px;
            height: 28px;
          }

          .cdr-match-platform-copy strong {
            font-size: 10px;
          }

          .cdr-match-platform-copy span {
            font-size: 8.5px;
          }

          .cdr-match-actions {
            position: sticky;
            bottom: 0;
          }

          .cdr-match-actions-inner {
            grid-template-columns: minmax(0, 1.28fr) minmax(0, .72fr);
            gap: 5px;
            padding: 6px 8px max(7px, env(safe-area-inset-bottom));
          }

          .cdr-match-primary,
          .cdr-match-secondary,
          .cdr-match-winner {
            min-height: 40px;
            padding: 6px 7px;
            font-size: 9px;
          }

          .cdr-match-selected {
            min-height: 34px;
            font-size: 9px;
          }

          .cdr-match-note {
            display: none;
          }
        }

        @media (max-width: 380px) {
          .cdr-match-hero {
            min-height: 144px;
            padding-inline: 10px;
          }

          .cdr-match-title {
            font-size: 29px;
          }

          .cdr-match-subtitle {
            max-width: 300px;
          }

          .cdr-match-content {
            padding-inline: 6px;
          }

          .cdr-match-film {
            grid-template-columns: 78px minmax(0,1fr);
            gap: 8px;
            padding: 8px;
          }

          .cdr-match-film-title {
            font-size: 18px;
          }

          .cdr-match-film-actions {
            grid-template-columns: 1fr;
          }

          .cdr-match-trailer,
          .cdr-match-detail {
            min-height: 32px;
          }

          .cdr-match-section-copy span {
            max-width: 180px;
          }

          .cdr-match-actions-inner {
            grid-template-columns: minmax(0,1.15fr) minmax(0,.85fr);
            padding-inline: 6px;
          }

          .cdr-match-primary,
          .cdr-match-secondary {
            font-size: 9px;
          }
        }

        @media (min-width: 400px) and (max-width: 460px) and (min-height: 850px) {
          .cdr-match-content {
            padding-top: 8px;
          }

          .cdr-match-film {
            grid-template-columns: 88px minmax(0, 1fr);
          }

          .cdr-match-film-title {
            font-size: 20px;
          }

          .cdr-match-section-body {
            padding: 9px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cdr-match-hero-inner,
          .cdr-match-heart,
          .cdr-match-skeleton {
            animation: none !important;
          }
        }
      `}</style>

      <section className="cdr-match-hero">
        <div className="cdr-match-hero-inner">
          <div className="cdr-match-heart">
            <Heart size={28} weight="fill" />
          </div>

          <div className="cdr-match-eyebrow">Cinedate Match</div>

          <h1 className="cdr-match-title">È un match.</h1>

          <p className="cdr-match-subtitle">
            Avete scelto entrambi <strong>{match.title}</strong>.
            Adesso resta solo da decidere come guardarlo.
          </p>

          {allMatches.length > 1 && (
            <div className="cdr-match-total">
              <Trophy size={14} weight="fill" />
              {allMatches.length} match totali
            </div>
          )}
        </div>
      </section>

      <div className="cdr-match-content">
        <div className="cdr-match-grid">
          <div className="cdr-match-stack">
            <section className="cdr-match-panel cdr-match-film">
              <img
                className="cdr-match-poster"
                src={match.cover?.startsWith('http') ? match.cover : ''}
                alt={match.title}
              />

              <div className="cdr-match-film-copy">
                <div className="cdr-match-film-label">La vostra scelta</div>

                <h2 className="cdr-match-film-title">{match.title}</h2>

                <div className="cdr-match-meta">
                  {match.year && <span>{match.year}</span>}
                  {match.genre && <span>· {match.genre}</span>}
                  {match.runtime && <span>· {match.runtime}</span>}

                  {(match.rating ?? 0) > 0 && (
                    <span className="cdr-match-rating">
                      <Star size={12} weight="fill" />
                      {(match.rating as number).toFixed(1)}
                    </span>
                  )}
                </div>

                {match.trama_c && (
                  <p className="cdr-match-plot">{match.trama_c}</p>
                )}

                <div className="cdr-match-film-actions">
                  {match.trailer && (
                    <button
                      type="button"
                      className="cdr-match-trailer"
                      onClick={() => window.open(match.trailer!, '_blank')}
                    >
                      <Play size={14} weight="fill" />
                      Guarda il trailer
                    </button>
                  )}

                  <button
                    type="button"
                    className="cdr-match-detail"
                    onClick={() => router.push(`/film/${encodeURIComponent(detailMovieId)}`)}
                  >
                    <Article size={14} weight="bold" />
                    Scheda film
                  </button>
                </div>
              </div>
            </section>

            <section className="cdr-match-panel">
              <div className="cdr-match-section-head">
                <div className="cdr-match-section-title">
                  <div className="cdr-match-section-icon gold">
                    <Ticket size={17} weight="duotone" />
                  </div>

                  <div className="cdr-match-section-copy">
                    <strong>Al cinema</strong>
                    <span>Cinema vicini e programmazione dei prossimi 7 giorni</span>
                  </div>
                </div>

                <MapPin size={16} color={P.accent} />
              </div>

              <div className="cdr-match-section-body">
                <CinemaInSala
                  filmTitle={match.title}
                  tmdbTitle={match.title}
                />
              </div>
            </section>
          </div>

          <div className="cdr-match-stack">
            <section className="cdr-match-panel">
              <div className="cdr-match-section-head">
                <div className="cdr-match-section-title">
                  <div className="cdr-match-section-icon pink">
                    <TelevisionSimple size={17} weight="fill" />
                  </div>

                  <div className="cdr-match-section-copy">
                    <strong>Dove guardarlo</strong>
                    <span>Streaming, noleggio e acquisto</span>
                  </div>
                </div>
              </div>

              <div className="cdr-match-section-body">
                {loadingSources ? (
                  <div className="cdr-match-streaming">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="cdr-match-skeleton" />
                    ))}
                  </div>
                ) : sources.length === 0 ? (
                  <div className="cdr-match-empty">
                    <div>
                      <TelevisionSimple size={27} weight="duotone" />
                      <div>Nessuna disponibilità streaming trovata</div>
                    </div>
                  </div>
                ) : (
                  <div className="cdr-match-streaming">
                    {subSources.length > 0 && (
                      <div>
                        <div className="cdr-match-group-label included">
                          Incluso o gratuito
                        </div>

                        <div className="cdr-match-streaming">
                          {subSources.map((source) => (
                            <PlatformRow key={source.name} s={source} />
                          ))}
                        </div>
                      </div>
                    )}

                    {subSources.length > 0 && rentSources.length > 0 && (
                      <div className="cdr-match-divider">oppure</div>
                    )}

                    {rentSources.length > 0 && (
                      <div>
                        <div className="cdr-match-group-label paid">
                          Noleggio o acquisto
                        </div>

                        <div className="cdr-match-streaming">
                          {rentSources.map((source) => (
                            <PlatformRow key={source.name} s={source} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="cdr-match-actions">
        <div className="cdr-match-actions-inner">
          {isSelected && (
            <div className="cdr-match-selected">
              <Trophy size={17} weight="fill" />
              Film scelto dal gruppo
            </div>
          )}

          {canSelectWinner && (
            <button
              type="button"
              className="cdr-match-winner"
              onClick={() => onSelectWinner?.(String(match.id))}
              disabled={selectingWinner}
            >
              <Trophy size={17} weight="fill" />
              {selectingWinner ? 'Salvataggio...' : 'Conferma questo film'}
            </button>
          )}

          <button
            type="button"
            className="cdr-match-primary"
            onClick={onContinue}
          >
            <FilmSlate size={17} weight="fill" />
            Continua a swipare
          </button>

          <button
            type="button"
            className="cdr-match-secondary"
            onClick={onReset}
          >
            <ArrowClockwise size={16} />
            Ricomincia
          </button>

          {!isLoggedIn && (
            <div className="cdr-match-note">
              Puoi continuare come ospite nella stanza corrente.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
