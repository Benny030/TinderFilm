'use client';

import { ArrowLeft, FilmSlate, Heart, Star } from '@phosphor-icons/react';

import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';
import type { ExtendedMovie, MatchEntry } from '@/types/stanza';

type Props = {
  matches: MatchEntry[];
  onBack: () => void;
  onOpenMovie: (movie: ExtendedMovie) => void;
};

export default function MatchesScreen({
  matches,
  onBack,
  onOpenMovie,
}: Props) {
  const { theme } = useTheme();
  const P = theme === 'dark' ? THEME.dark : THEME.light;

  return (
    <main
      className="cdr-matches"
      style={
        {
          '--cdr-matches-bg': P.bg,
          '--cdr-matches-soft': P.bgSoft,
          '--cdr-matches-surface': P.surface,
          '--cdr-matches-hover': P.surfaceHover,
          '--cdr-matches-border': P.border,
          '--cdr-matches-text': P.text,
          '--cdr-matches-muted': P.textMuted,
          '--cdr-matches-faint': P.textFaint,
          '--cdr-matches-pink': P.primary,
          '--cdr-matches-pink-deep': P.primaryDeep,
          '--cdr-matches-pink-glow': P.primaryGlow,
          '--cdr-matches-gold': P.accent,
          '--cdr-matches-gold-glow': P.accentGlow,
        } as React.CSSProperties
      }
    >
      <style>{`
        .cdr-matches {
          width: 100%;
          min-height: 100dvh;
          overflow-x: hidden;
          background: var(--cdr-matches-bg);
          color: var(--cdr-matches-text);
          font-family: ${FONT.sans};
        }

        .cdr-matches * {
          box-sizing: border-box;
        }

        .cdr-matches-shell {
          width: min(100%, 1120px);
          margin: 0 auto;
          padding: 22px 24px 56px;
        }

        .cdr-matches-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 24px;
        }

        .cdr-matches-back {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border: 1px solid var(--cdr-matches-border);
          border-radius: 0;
          background: transparent;
          color: var(--cdr-matches-muted);
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
          transition: 150ms ease;
        }

        .cdr-matches-back:hover {
          color: var(--cdr-matches-text);
          background: var(--cdr-matches-hover);
        }

        .cdr-matches-count {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 38px;
          padding: 7px 10px;
          border: 1px solid var(--cdr-matches-border);
          color: var(--cdr-matches-pink);
          font-size: 11px;
          font-weight: 850;
          background: var(--cdr-matches-surface);
        }

        .cdr-matches-intro {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          align-items: end;
          gap: 20px;
          margin-bottom: 22px;
        }

        .cdr-matches-kicker {
          margin-bottom: 7px;
          color: var(--cdr-matches-pink);
          font-size: 9px;
          font-weight: 850;
          letter-spacing: .11em;
          text-transform: uppercase;
        }

        .cdr-matches-title {
          margin: 0;
          font-family: ${FONT.display};
          font-size: clamp(34px, 5vw, 52px);
          line-height: .98;
          letter-spacing: -.035em;
        }

        .cdr-matches-subtitle {
          max-width: 620px;
          margin: 10px 0 0;
          color: var(--cdr-matches-muted);
          font-size: 12px;
          line-height: 1.58;
        }

        .cdr-matches-summary {
          min-width: 148px;
          padding: 12px 14px;
          border: 1px solid var(--cdr-matches-border);
          background: var(--cdr-matches-surface);
          text-align: right;
        }

        .cdr-matches-summary strong {
          display: block;
          font-family: ${FONT.display};
          color: var(--cdr-matches-pink);
          font-size: 28px;
          line-height: 1;
        }

        .cdr-matches-summary span {
          display: block;
          margin-top: 4px;
          color: var(--cdr-matches-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .cdr-matches-empty {
          min-height: 320px;
          display: grid;
          place-items: center;
          padding: 28px;
          border: 1px dashed var(--cdr-matches-border);
          background: var(--cdr-matches-surface);
          text-align: center;
        }

        .cdr-matches-empty-inner {
          max-width: 320px;
        }

        .cdr-matches-empty-icon {
          width: 54px;
          height: 54px;
          margin: 0 auto 12px;
          display: grid;
          place-items: center;
          border: 1px solid var(--cdr-matches-border);
          color: var(--cdr-matches-faint);
          background: var(--cdr-matches-soft);
        }

        .cdr-matches-empty strong {
          display: block;
          font-family: ${FONT.display};
          font-size: 22px;
          line-height: 1.1;
        }

        .cdr-matches-empty p {
          margin: 7px 0 0;
          color: var(--cdr-matches-muted);
          font-size: 11px;
          line-height: 1.5;
        }

        .cdr-matches-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0,1fr));
          gap: 14px;
        }

        .cdr-matches-card {
          position: relative;
          min-width: 0;
          padding: 0;
          overflow: hidden;
          border: 1px solid var(--cdr-matches-border);
          border-radius: 0;
          background: var(--cdr-matches-surface);
          color: var(--cdr-matches-text);
          text-align: left;
          cursor: pointer;
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            box-shadow 170ms ease;
        }

        .cdr-matches-card:hover {
          transform: translateY(-3px);
          border-color: var(--cdr-matches-pink);
          box-shadow: 0 14px 30px rgba(31,26,22,.10);
        }

        .cdr-matches-poster-wrap {
          position: relative;
          aspect-ratio: 2 / 3;
          overflow: hidden;
          background: var(--cdr-matches-soft);
        }

        .cdr-matches-poster {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform 260ms ease;
        }

        .cdr-matches-card:hover .cdr-matches-poster {
          transform: scale(1.025);
        }

        .cdr-matches-badge {
          position: absolute;
          left: 8px;
          bottom: 8px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 28px;
          padding: 5px 7px;
          border: 1px solid rgba(255,255,255,.3);
          background: rgba(8,6,5,.72);
          color: #fff;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          font-size: 9px;
          font-weight: 850;
        }

        .cdr-matches-body {
          min-width: 0;
          padding: 11px;
        }

        .cdr-matches-card-title {
          min-width: 0;
          min-height: 34px;
          color: var(--cdr-matches-text);
          font-size: 12px;
          line-height: 1.35;
          font-weight: 850;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        .cdr-matches-meta {
          margin-top: 8px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
          color: var(--cdr-matches-muted);
          font-size: 9px;
        }

        .cdr-matches-rating {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          color: var(--cdr-matches-gold);
          font-weight: 850;
        }

        .cdr-matches-open {
          margin-top: 10px;
          padding-top: 9px;
          border-top: 1px solid var(--cdr-matches-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: var(--cdr-matches-pink);
          font-size: 9px;
          font-weight: 850;
        }

        @media (max-width: 980px) {
          .cdr-matches-grid {
            grid-template-columns: repeat(4, minmax(0,1fr));
          }
        }

        @media (max-width: 760px) {
          .cdr-matches-shell {
            padding: 16px 14px 40px;
          }

          .cdr-matches-intro {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .cdr-matches-summary {
            width: 100%;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            text-align: left;
          }

          .cdr-matches-summary strong {
            font-size: 24px;
          }

          .cdr-matches-summary span {
            margin: 0;
          }

          .cdr-matches-grid {
            grid-template-columns: repeat(3, minmax(0,1fr));
            gap: 10px;
          }
        }

        @media (max-width: 560px) {
          .cdr-matches-shell {
            padding: 10px 8px 26px;
          }

          .cdr-matches-topbar {
            margin-bottom: 14px;
          }

          .cdr-matches-back,
          .cdr-matches-count {
            min-height: 34px;
            padding: 6px 8px;
            font-size: 9px;
          }

          .cdr-matches-title {
            font-size: 31px;
          }

          .cdr-matches-subtitle {
            margin-top: 7px;
            font-size: 10px;
          }

          .cdr-matches-summary {
            padding: 9px 10px;
          }

          .cdr-matches-summary strong {
            font-size: 21px;
          }

          .cdr-matches-summary span {
            font-size: 8px;
          }

          .cdr-matches-grid {
            grid-template-columns: repeat(2, minmax(0,1fr));
            gap: 8px;
          }

          .cdr-matches-body {
            padding: 9px;
          }

          .cdr-matches-card-title {
            min-height: 31px;
            font-size: 11px;
          }

          .cdr-matches-meta {
            margin-top: 6px;
            font-size: 8px;
          }

          .cdr-matches-open {
            margin-top: 8px;
            padding-top: 7px;
            font-size: 8px;
          }
        }

        @media (min-width: 381px) and (max-width: 460px) {
          .cdr-matches-shell {
            padding-inline: 8px;
          }

          .cdr-matches-title {
            font-size: 29px;
          }

          .cdr-matches-grid {
            grid-template-columns: repeat(2, minmax(0,1fr));
            gap: 7px;
          }

          .cdr-matches-badge {
            left: 6px;
            bottom: 6px;
            min-height: 24px;
            padding: 4px 6px;
            font-size: 8px;
          }
        }

        @media (max-width: 380px) {
          .cdr-matches-back span {
            display: none;
          }

          .cdr-matches-title {
            font-size: 27px;
          }

          .cdr-matches-grid {
            gap: 6px;
          }

          .cdr-matches-body {
            padding: 8px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cdr-matches-card,
          .cdr-matches-poster {
            transition: none !important;
          }
        }
      `}</style>

      <div className="cdr-matches-shell">
        <div className="cdr-matches-topbar">
          <button
            type="button"
            className="cdr-matches-back"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            <span>Torna allo swipe</span>
          </button>

          <div className="cdr-matches-count">
            <Heart
              size={15}
              weight={matches.length > 0 ? 'fill' : 'regular'}
            />
            {matches.length}
          </div>
        </div>

        <section className="cdr-matches-intro">
          <div>
            <div className="cdr-matches-kicker">Stanza Cinedate</div>
            <h1 className="cdr-matches-title">I vostri match</h1>
            <p className="cdr-matches-subtitle">
              Qui restano tutti i film che hanno ottenuto il consenso della
              stanza. Aprine uno per rivedere il match e decidere il prossimo
              passo.
            </p>
          </div>

          {matches.length > 0 && (
            <div className="cdr-matches-summary">
              <strong>{matches.length}</strong>
              <span>
                {matches.length === 1 ? 'film condiviso' : 'film condivisi'}
              </span>
            </div>
          )}
        </section>

        {matches.length === 0 ? (
          <section className="cdr-matches-empty">
            <div className="cdr-matches-empty-inner">
              <div className="cdr-matches-empty-icon">
                <FilmSlate size={28} weight="duotone" />
              </div>

              <strong>Nessun match ancora</strong>
              <p>
                Tornate allo swipe: appena il gruppo converge su un film,
                comparirà qui.
              </p>
            </div>
          </section>
        ) : (
          <section className="cdr-matches-grid">
            {matches.map((entry) => {
              const movie = entry.movie;

              return (
                <button
                  key={`${movie.id}-${entry.timestamp}`}
                  type="button"
                  className="cdr-matches-card"
                  onClick={() => onOpenMovie(movie)}
                >
                  <div className="cdr-matches-poster-wrap">
                    <img
                      className="cdr-matches-poster"
                      src={
                        movie.cover?.startsWith('http')
                          ? movie.cover
                          : ''
                      }
                      alt={movie.title}
                    />

                    <div className="cdr-matches-badge">
                      <Heart size={11} weight="fill" />
                      Match
                    </div>
                  </div>

                  <div className="cdr-matches-body">
                    <div className="cdr-matches-card-title">
                      {movie.title}
                    </div>

                    <div className="cdr-matches-meta">
                      {movie.year && <span>{movie.year}</span>}

                      {movie.genre && (
                        <span>· {movie.genre}</span>
                      )}

                      {(movie.rating ?? 0) > 0 && (
                        <span className="cdr-matches-rating">
                          <Star size={10} weight="fill" />
                          {(movie.rating as number).toFixed(1)}
                        </span>
                      )}
                    </div>

                    <div className="cdr-matches-open">
                      <span>Apri il match</span>
                      <Heart size={11} weight="fill" />
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
