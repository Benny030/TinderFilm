import { useState, useEffect } from 'react';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';
import {
  FilmSlate, Heart, ArrowRight, Trophy,
  Play, TelevisionSimple, ArrowClockwise, Star,
} from '@phosphor-icons/react';
import type { ExtendedMovie, StreamingSource, MatchEntry } from '@/types/stanza';
import CinemaInSala from '@/components/cinema/CinemaInSala';

type Props = {
  match: ExtendedMovie;
  allMatches: MatchEntry[];
  onContinue: () => void;
  onReset: () => void;
  isLoggedIn: boolean;
};

function PlatformRow({ s }: { s: StreamingSource }) {
  return (
    <div
      onClick={() => s.url && window.open(s.url, '_blank')}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', background: C.bg,
        border: `1.5px solid ${C.border}`, borderRadius: R.md,
        cursor: s.url ? 'pointer' : 'default',
        transition: 'border-color .15s, box-shadow .15s',
      }}
      onMouseEnter={(e) => {
        if (s.url) {
          (e.currentTarget as HTMLElement).style.borderColor = s.color ?? C.primary;
          (e.currentTarget as HTMLElement).style.boxShadow = SHADOW.sm;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = C.border;
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '44px', height: '30px', borderRadius: R.xs,
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
          <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>{s.name}</div>
          <div style={{ fontSize: TEXT.xs, fontWeight: '500', color: s.type === 'sub' || s.type === 'free' ? C.success : '#f59e0b' }}>
            {s.type === 'sub'  && "Incluso nell'abbonamento"}
            {s.type === 'free' && 'Gratuito'}
            {s.type === 'rent' && `Noleggio${s.price ? ` · €${s.price.toFixed(2)}` : ''}`}
            {s.type === 'buy'  && `Acquisto${s.price ? ` · €${s.price.toFixed(2)}` : ''}`}
          </div>
        </div>
      </div>
      {s.url && (
        <div style={{ fontSize: TEXT.xs, fontWeight: '700', color: s.color ?? C.primary, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          Guarda <ArrowRight size={12} color={s.color ?? C.primary} weight="bold" />
        </div>
      )}
    </div>
  );
}

export default function MatchScreen({ match, allMatches, onContinue, onReset, isLoggedIn }: Props) {
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
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, #c0254f 100%)`,
        padding: `${S.lg} ${S.md}`, textAlign: 'center', color: '#fff',
      }}>
        <div style={{ fontSize: '36px', marginBottom: S.xs }}>🎉</div>
        <div style={{ fontSize: TEXT.xl, fontWeight: '800', marginBottom: '4px' }}>È un match!</div>
        <div style={{ fontSize: TEXT.sm, opacity: 0.85 }}>
          Vi piace entrambi <strong>{match.title}</strong>
        </div>
        {allMatches.length > 1 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.2)', borderRadius: R.full,
            padding: '5px 14px', marginTop: S.sm, fontSize: TEXT.xs, fontWeight: '600',
          }}>
            <Trophy size={14} color="#fff" weight="fill" />
            {allMatches.length} match in questa sessione
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: S.md }}>

        {/* Film card */}
        <div style={{
          display: 'flex', gap: S.md, background: C.bgSoft,
          borderRadius: R.lg, padding: S.md, marginBottom: S.md,
          border: `1.5px solid ${C.border}`,
        }}>
          <img
            src={match.cover?.startsWith('http') ? match.cover : ''}
            alt={match.title}
            style={{ width: '80px', height: '120px', objectFit: 'cover', borderRadius: R.sm, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: TEXT.md, fontWeight: '800', color: C.ink, marginBottom: '4px' }}>{match.title}</div>
            <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '6px' }}>
              {match.year} · {match.genre}{match.runtime && ` · ${match.runtime}`}
            </div>
            {(match.rating ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <Star size={12} color="#f59e0b" weight="fill" />
                <span style={{ fontSize: TEXT.xs, fontWeight: '700', color: '#f59e0b' }}>
                  {(match.rating as number).toFixed(1)}
                </span>
              </div>
            )}
            {match.trama_c && (
              <div style={{
                fontSize: TEXT.xs, color: C.muted, lineHeight: 1.6,
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
                  marginTop: S.sm, display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: C.primaryLight, color: C.primary, border: 'none',
                  borderRadius: R.full, padding: '7px 14px',
                  fontSize: TEXT.xs, fontWeight: '600', cursor: 'pointer', fontFamily: FONT.sans,
                }}
              >
                <Play size={14} weight="fill" /> Trailer
              </button>
            )}
          </div>
        </div>
        {/* ── Al cinema vicino a te ── */}
        <CinemaInSala
          filmTitle={match.title}
          tmdbTitle={match.title}
        />
        {/* Dove guardarlo */}
        <div style={{ marginBottom: S.md }}>
          <div style={{ fontSize: TEXT.base, fontWeight: '700', color: C.ink, marginBottom: S.sm, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TelevisionSimple size={18} color={C.primary} weight="fill" />
            Dove guardarlo
          </div>

          {loadingSources ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: '60px', borderRadius: R.md, background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease infinite' }} />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div style={{ padding: S.md, background: C.bgSoft, borderRadius: R.md, textAlign: 'center', fontSize: TEXT.sm, color: C.muted, border: `1.5px dashed ${C.border}` }}>
              <TelevisionSimple size={28} color={C.faint} weight="duotone" style={{ marginBottom: '8px' }} />
              <div>Nessuna disponibilità streaming trovata</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
              {subSources.length > 0 && (
                <div>
                  <div style={{ fontSize: TEXT.xs, fontWeight: '700', color: C.success, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.success }} />
                    Incluso nel tuo abbonamento
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {subSources.map((s) => <PlatformRow key={s.name} s={s} />)}
                  </div>
                </div>
              )}
              {subSources.length > 0 && rentSources.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, margin: '4px 0' }}>
                  <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
                  <span style={{ fontSize: TEXT.xs, color: C.faint }}>oppure</span>
                  <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
                </div>
              )}
              {rentSources.length > 0 && (
                <div>
                  <div style={{ fontSize: TEXT.xs, fontWeight: '700', color: '#f59e0b', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
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
          <div style={{ marginBottom: S.md }}>
            <button
              onClick={() => setShowMatches((v) => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '12px 16px',
                background: C.bgSoft, border: `1.5px solid ${C.border}`,
                borderRadius: R.md, cursor: 'pointer', fontFamily: FONT.sans,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>
                <Trophy size={16} color={C.primary} weight="fill" />
                Tutti i match ({allMatches.length})
              </span>
              <ArrowRight size={16} color={C.muted} style={{ transform: showMatches ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {showMatches && (
              <div style={{ border: `1.5px solid ${C.border}`, borderTop: 'none', borderRadius: `0 0 ${R.md} ${R.md}`, overflow: 'hidden' }}>
                {allMatches.map((entry, i) => (
                  <div key={entry.movie.id} style={{
                    display: 'flex', alignItems: 'center', gap: S.sm,
                    padding: '10px 16px',
                    borderBottom: i < allMatches.length - 1 ? `1px solid ${C.border}` : 'none',
                    background: entry.movie.id === match.id ? C.primaryLight : C.bg,
                  }}>
                    <img src={entry.movie.cover?.startsWith('http') ? entry.movie.cover : ''} style={{ width: '36px', height: '54px', objectFit: 'cover', borderRadius: R.xs, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: C.ink }}>{entry.movie.title}</div>
                      <div style={{ fontSize: TEXT.xs, color: C.muted }}>{entry.movie.year} · {entry.movie.genre}</div>
                    </div>
                    {entry.movie.id === match.id && (
                      <div style={{ marginLeft: 'auto', fontSize: TEXT.xs, color: C.primary, fontWeight: '600' }}>Ultimo ❤️</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Azioni bottom */}
      <div style={{ padding: S.md, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: S.sm, background: C.bg }}>
        <button
          onClick={onContinue}
          style={{
            width: '100%', padding: '15px', background: C.primary, color: '#fff',
            border: 'none', borderRadius: R.full, fontSize: TEXT.base, fontWeight: '700',
            cursor: 'pointer', fontFamily: FONT.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: `0 4px 16px rgba(232,56,109,.3)`,
          }}
        >
          <FilmSlate size={18} color="#fff" weight="fill" />
          Continua a swipare
        </button>
        <button
          onClick={onReset}
          style={{
            width: '100%', padding: '13px', background: 'transparent', color: C.muted,
            border: `1.5px solid ${C.border}`, borderRadius: R.full,
            fontSize: TEXT.base, fontWeight: '500', cursor: 'pointer', fontFamily: FONT.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <ArrowClockwise size={16} color={C.muted} />
          Ricomincia da capo
        </button>
      </div>
    </div>
  );
}