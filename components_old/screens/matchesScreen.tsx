'use client';

import { ArrowLeft, Heart, FilmSlate } from '@phosphor-icons/react';
import { useTheme } from '@/context/ThemeContext';
import type { ExtendedMovie, MatchEntry } from '@/types/stanza';

const D = {
  bg: '#0a0806',
  card: '#1c1613',
  border: '#2d221c',
  gold: '#f5b92f',
  pink: '#ed3d73',
  text: '#f0ebe6',
  muted: '#b5a89e',
  faint: '#7a6b60',
};

const L = {
  bg: '#f5efe8',
  card: '#ffffff',
  border: '#d6cbbc',
  gold: '#b8860b',
  pink: '#b83060',
  text: '#1f1a16',
  muted: '#5c5248',
  faint: '#8a7c6e',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const DISPLAY = "'Playfair Display','Georgia',serif";

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
  const P = theme === 'dark' ? D : L;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: P.bg,
        color: P.text,
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: '0 auto',
          padding: '22px 18px 60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              border: 0,
              background: 'transparent',
              color: P.muted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
              fontFamily: FONT,
            }}
          >
            <ArrowLeft size={19} />
            Torna allo swipe
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              color: matches.length > 0 ? P.pink : P.muted,
              fontWeight: 850,
              fontSize: 13,
            }}
          >
            <Heart
              size={18}
              weight={matches.length > 0 ? 'fill' : 'regular'}
            />
            {matches.length}
          </div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: DISPLAY,
              fontSize: 29,
              fontWeight: 800,
            }}
          >
            <Heart size={28} color={P.pink} weight="fill" />
            I vostri Match
          </div>

          <div
            style={{
              color: P.muted,
              fontSize: 13,
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Tutti i film che hanno raggiunto il consenso della stanza.
            Aprine uno per vedere i dettagli.
          </div>
        </div>

        {matches.length === 0 ? (
          <div
            style={{
              minHeight: 300,
              border: `1px dashed ${P.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 24,
              color: P.muted,
            }}
          >
            <FilmSlate size={38} color={P.faint} weight="duotone" />
            <div
              style={{
                color: P.text,
                fontWeight: 800,
                marginTop: 10,
              }}
            >
              Nessun match ancora
            </div>
            <div style={{ fontSize: 13, marginTop: 5 }}>
              Continuate a fare swipe.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 16,
            }}
          >
            {matches.map((entry) => {
              const movie = entry.movie;

              return (
                <button
                  key={movie.id}
                  type="button"
                  onClick={() => onOpenMovie(movie)}
                  style={{
                    padding: 0,
                    background: P.card,
                    border: `1px solid ${P.border}`,
                    color: P.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: FONT,
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={
                      movie.cover?.startsWith('http')
                        ? movie.cover
                        : ''
                    }
                    alt={movie.title}
                    style={{
                      width: '100%',
                      aspectRatio: '2 / 3',
                      objectFit: 'cover',
                      display: 'block',
                      background: P.border,
                    }}
                  />

                  <div style={{ padding: 12 }}>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.3,
                        fontWeight: 850,
                      }}
                    >
                      {movie.title}
                    </div>

                    <div
                      style={{
                        marginTop: 7,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        color: P.pink,
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      <Heart size={12} weight="fill" />
                      Match
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}