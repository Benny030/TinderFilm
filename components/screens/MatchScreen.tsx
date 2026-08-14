import { useState, useEffect, type CSSProperties } from 'react';
import { useTheme } from '@/context/ThemeContext';
import {
  FilmSlate, Heart, ArrowRight, Trophy,
  Play, TelevisionSimple, ArrowClockwise, Star,
} from '@phosphor-icons/react';
import type { ExtendedMovie, StreamingSource, MatchEntry } from '@/types/stanza';
import CinemaInSala from '@/components/cinema/CinemaInSala';

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
};

const FONT_SANS = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type Props = {
  match: ExtendedMovie;
  allMatches: MatchEntry[];
  onContinue: () => void;
  onReset: () => void;
  isLoggedIn: boolean;
};

function PlatformRow({ s }: { s: StreamingSource }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  return (
    <div
      onClick={() => s.url && window.open(s.url, '_blank')}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', background: P.bg,
        border: `1px solid ${P.border}`,
        cursor: s.url ? 'pointer' : 'default',
        transition: 'border-color .15s, box-shadow .15s',
        borderRadius: 0,
      }}
      onMouseEnter={(e) => {
        if (s.url) {
          e.currentTarget.style.borderColor = s.color ?? P.pink;
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = P.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '44px', height: '30px', borderRadius: 0,
          background: s.color ?? '#f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {s.logoUrl ? (
            <img
              src={s.logoUrl}
              alt={s.name}
              style={{ width: '36px', height: '24px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                (e.currentTarget.parentElement as HTMLElement).innerHTML = `<span style="font-size:16px">${s.logo}</span>`;
              }}
            />
          ) : (
            <span style={{ fontSize: '16px' }}>{s.logo}</span>
          )}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: P.text }}>{s.name}</div>
          <div style={{ fontSize: '11px', fontWeight: '500', color: s.type === 'sub' || s.type === 'free' ? '#22c55e' : P.gold }}>
            {s.type === 'sub'  && "Incluso nell'abbonamento"}
            {s.type === 'free' && 'Gratuito'}
            {s.type === 'rent' && `Noleggio${s.price ? ` · €${s.price.toFixed(2)}` : ''}`}
            {s.type === 'buy'  && `Acquisto${s.price ? ` · €${s.price.toFixed(2)}` : ''}`}
          </div>
        </div>
      </div>
      {s.url && (
        <div style={{ fontSize: '11px', fontWeight: '700', color: s.color ?? P.pink, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          Guarda <ArrowRight size={12} color={s.color ?? P.pink} weight="bold" />
        </div>
      )}
    </div>
  );
}

export default function MatchScreen({ match, allMatches, onContinue, onReset, isLoggedIn }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const [sources, setSources] = useState<StreamingSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [showMatches, setShowMatches] = useState(false);

  useEffect(() => {
    const tmdbId = match.tmdb_id;
    if (!tmdbId) { setSources([]); setLoadingSources(false); return; }

    setLoadingSources(true);
    fetch(`/api/watchmode/${tmdbId}`)
      .then((r) => r.json())
      .then((d) => setSources(d.sources ?? []))
      .catch(() => setSources([]))
      .finally(() => setLoadingSources(false));
  }, [match.id]);

  const subSources  = sources.filter((s) => s.type === 'sub' || s.type === 'free');
  const rentSources = sources.filter((s) => s.type === 'rent' || s.type === 'buy');

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: P.bg, fontFamily: FONT_SANS }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${P.pink} 0%, ${P.pinkDeep} 100%)`,
        padding: '24px 16px', textAlign: 'center', color: '#fff',
      }}>
        <div style={{ fontSize: '36px', marginBottom: '4px' }}>🎉</div>
        <div style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px', fontFamily: FONT_DISPLAY }}>È un match!</div>
        <div style={{ fontSize: '13px', opacity: 0.85 }}>
          Vi piace entrambi <strong>{match.title}</strong>
        </div>
        {allMatches.length > 1 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.2)', borderRadius: 0,
            padding: '5px 14px', marginTop: '8px', fontSize: '11px', fontWeight: '600',
          }}>
            <Trophy size={14} color="#fff" weight="fill" />
            {allMatches.length} match in questa sessione
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Film card */}
        <div style={{
          display: 'flex', gap: '16px', background: P.card,
          borderRadius: 0, padding: '16px', marginBottom: '16px',
          border: `1px solid ${P.border}`,
        }}>
          <img
            src={match.cover?.startsWith('http') ? match.cover : ''}
            alt={match.title}
            style={{ width: '80px', height: '120px', objectFit: 'cover', borderRadius: 0, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: '800', color: P.text, marginBottom: '4px' }}>{match.title}</div>
            <div style={{ fontSize: '11px', color: P.textMuted, marginBottom: '6px' }}>
              {match.year} · {match.genre}{match.runtime && ` · ${match.runtime}`}
            </div>
            {(match.rating ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <Star size={12} color={P.gold} weight="fill" />
                <span style={{ fontSize: '11px', fontWeight: '700', color: P.gold }}>
                  {(match.rating as number).toFixed(1)}
                </span>
              </div>
            )}
            {match.trama_c && (
              <div style={{
                fontSize: '11px', color: P.textMuted, lineHeight: 1.6,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any,
              }}>
                {match.trama_c}
              </div>
            )}
            {match.trailer && (
              <button
                onClick={() => window.open(match.trailer!, '_blank')}
                style={{
                  marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: P.pinkGlow, color: P.pink, border: `1px solid ${P.pink}`,
                  borderRadius: 0, padding: '7px 14px',
                  fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: FONT_SANS,
                }}
              >
                <Play size={14} weight="fill" /> Trailer
              </button>
            )}
          </div>
        </div>

        {/* ── Al cinema vicino a te ── */}
        <CinemaInSala filmTitle={match.title} tmdbTitle={match.title} />

        {/* Dove guardarlo */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: P.text, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TelevisionSimple size={18} color={P.pink} weight="fill" />
            Dove guardarlo
          </div>

          {loadingSources ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: '60px', borderRadius: 0, background: `linear-gradient(90deg, ${P.bgSoft} 25%, ${P.cardHover} 50%, ${P.bgSoft} 75%)`, backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease infinite' }} />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div style={{ padding: '16px', background: P.card, borderRadius: 0, textAlign: 'center', fontSize: '13px', color: P.textMuted, border: `1px dashed ${P.border}` }}>
              <TelevisionSimple size={28} color={P.textFaint} weight="duotone" style={{ marginBottom: '8px' }} />
              <div>Nessuna disponibilità streaming trovata</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {subSources.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#22c55e', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                    Incluso nel tuo abbonamento
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {subSources.map((s) => <PlatformRow key={s.name} s={s} />)}
                  </div>
                </div>
              )}
              {subSources.length > 0 && rentSources.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                  <div style={{ flex: 1, borderTop: `1px solid ${P.border}` }} />
                  <span style={{ fontSize: '11px', color: P.textFaint }}>oppure</span>
                  <div style={{ flex: 1, borderTop: `1px solid ${P.border}` }} />
                </div>
              )}
              {rentSources.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: P.gold, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: P.gold }} />
                    Noleggio o acquisto
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rentSources.map((s) => <PlatformRow key={s.name} s={s} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lista match sessione */}
        {isLoggedIn && allMatches.length > 1 && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => setShowMatches((v) => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '12px 16px',
                background: P.card, border: `1px solid ${P.border}`,
                borderRadius: 0, cursor: 'pointer', fontFamily: FONT_SANS,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: P.text }}>
                <Trophy size={16} color={P.pink} weight="fill" />
                Tutti i match ({allMatches.length})
              </span>
              <ArrowRight size={16} color={P.textMuted} style={{ transform: showMatches ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {showMatches && (
              <div style={{ border: `1px solid ${P.border}`, borderTop: 'none', overflow: 'hidden', borderRadius: 0 }}>
                {allMatches.map((entry, i) => (
                  <div key={entry.movie.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 16px',
                    borderBottom: i < allMatches.length - 1 ? `1px solid ${P.border}` : 'none',
                    background: entry.movie.id === match.id ? P.pinkGlow : P.bg,
                  }}>
                    <img src={entry.movie.cover?.startsWith('http') ? entry.movie.cover : ''} style={{ width: '36px', height: '54px', objectFit: 'cover', borderRadius: 0, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: P.text }}>{entry.movie.title}</div>
                      <div style={{ fontSize: '11px', color: P.textMuted }}>{entry.movie.year} · {entry.movie.genre}</div>
                    </div>
                    {entry.movie.id === match.id && (
                      <div style={{ marginLeft: 'auto', fontSize: '11px', color: P.pink, fontWeight: '600' }}>Ultimo ❤️</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Azioni bottom */}
      <div style={{ padding: '16px', borderTop: `1px solid ${P.border}`, display: 'flex', flexDirection: 'column', gap: '8px', background: P.bg }}>
        <button
          onClick={onContinue}
          style={{
            width: '100%', padding: '15px', background: P.pink, color: '#fff',
            border: 'none', borderRadius: 0, fontSize: '15px', fontWeight: '700',
            cursor: 'pointer', fontFamily: FONT_SANS,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: `0 4px 16px ${P.pinkGlow}`,
          }}
        >
          <FilmSlate size={18} color="#fff" weight="fill" />
          Continua a swipare
        </button>
        <button
          onClick={onReset}
          style={{
            width: '100%', padding: '13px', background: 'transparent', color: P.textMuted,
            border: `1.5px solid ${P.border}`, borderRadius: 0,
            fontSize: '15px', fontWeight: '500', cursor: 'pointer', fontFamily: FONT_SANS,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <ArrowClockwise size={16} color={P.textMuted} />
          Ricomincia da capo
        </button>
      </div>
    </div>
  );
}