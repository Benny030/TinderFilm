'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import AppShell from '@/components/layout/AppShell';
import { generateRoomCode } from '@/utils/roomCode';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';
import {
  FilmSlate, Television, Ticket, Funnel,
  TrendUp, ArrowRight, ArrowLeft, Check,
  Warning,
} from '@phosphor-icons/react';

const GENRES = [
  { id: 28,    label: 'Azione',       emoji: '💥' },
  { id: 12,    label: 'Avventura',    emoji: '🗺️' },
  { id: 16,    label: 'Animazione',   emoji: '🎨' },
  { id: 35,    label: 'Commedia',     emoji: '😂' },
  { id: 80,    label: 'Crime',        emoji: '🔫' },
  { id: 18,    label: 'Dramma',       emoji: '🎭' },
  { id: 10751, label: 'Famiglia',     emoji: '👨‍👩‍👧' },
  { id: 14,    label: 'Fantasy',      emoji: '🧙' },
  { id: 27,    label: 'Horror',       emoji: '👻' },
  { id: 10749, label: 'Romantico',    emoji: '❤️' },
  { id: 878,   label: 'Fantascienza', emoji: '🚀' },
  { id: 53,    label: 'Thriller',     emoji: '😰' },
  { id: 99,    label: 'Documentario', emoji: '📽️' },
  { id: 10402, label: 'Musica',       emoji: '🎵' },
];

type Mode = 'trending' | 'cinema' | 'streaming' | 'discover';

export default function CreaStanzaPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<Mode | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);

  // ─── Anni come stringa per permettere input libero ──────────────────────
  const [yearFromStr, setYearFromStr] = useState('2010');
  const [yearToStr, setYearToStr] = useState(String(currentYear));
  const [yearError, setYearError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const yearFrom = parseInt(yearFromStr) || 1900;
  const yearTo = parseInt(yearToStr) || currentYear;

  const validateYears = (): boolean => {
    if (yearFromStr.length !== 4 || yearToStr.length !== 4) {
      setYearError('Inserisci anni a 4 cifre');
      return false;
    }
    if (yearFrom < 1900 || yearFrom > currentYear) {
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

  const handleCreate = async () => {
    if (mode === 'discover' && !validateYears()) return;

    setIsCreating(true);
    const roomId = generateRoomCode();

    try {
      // ─── Salva config su Supabase ───────────────────────────────────────
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
      console.error('Errore salvataggio config stanza:', err);
      // continua comunque
    }

    // ─── Naviga alla stanza con tutti i params ────────────────────────────
    const params = new URLSearchParams({ room: roomId, mode: mode! });
    if (mode === 'discover') {
      if (selectedGenres.length > 0) params.set('genres', selectedGenres.join(','));
      params.set('year_from', yearFrom.toString());
      params.set('year_to', yearTo.toString());
    }

    router.push(`/stanza?${params.toString()}`);
  };

  const modeCards = [
    {
      id: 'trending' as Mode,
      icon: <TrendUp size={28} color={C.primary} weight="duotone" />,
      title: 'In tendenza',
      desc: 'I più popolari di questa settimana.',
      badge: '🔥 Hot',
    },
    {
      id: 'cinema' as Mode,
      icon: <Ticket size={28} color="#f59e0b" weight="duotone" />,
      title: 'Al cinema',
      desc: 'Attualmente nelle sale italiane.',
      badge: '🎟️ Ora al cinema',
    },
    {
      id: 'streaming' as Mode,
      icon: <Television size={28} color={C.success} weight="duotone" />,
      title: 'In streaming',
      desc: 'Su Netflix, Prime, Disney+ e altri.',
      badge: '📺 Subito disponibile',
    },
    {
      id: 'discover' as Mode,
      icon: <Funnel size={28} color="#8b5cf6" weight="duotone" />,
      title: 'Filtri personalizzati',
      desc: 'Genere, anno e molto altro.',
      badge: '⚙️ Personalizzato',
    },
  ];

  return (
    <>
      <style>{`
        .mode-card {
          border: 2px solid ${C.border};
          border-radius: ${R.lg};
          padding: ${S.md};
          cursor: pointer;
          transition: all .15s;
          background: ${C.bg};
          display: flex;
          flex-direction: column;
          gap: 8px;
          position: relative;
        }
        .mode-card:hover { border-color: ${C.primary}; transform: translateY(-2px); box-shadow: ${SHADOW.sm}; }
        .mode-card.selected { border-color: ${C.primary}; background: ${C.primaryFaint ?? '#fff4f7'}; }
        .genre-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 14px; border-radius: ${R.full};
          border: 1.5px solid ${C.border}; background: ${C.bg};
          cursor: pointer; font-size: ${TEXT.sm};
          font-family: ${FONT.sans}; color: ${C.muted};
          transition: all .15s; font-weight: 500;
        }
        .genre-chip:hover { border-color: ${C.primary}; color: ${C.primary}; }
        .genre-chip.selected { border-color: ${C.primary}; background: ${C.primaryLight}; color: ${C.primary}; font-weight: 600; }
        .year-input {
          padding: 12px 14px;
          border: 1.5px solid ${C.border};
          border-radius: ${R.md};
          font-size: ${TEXT.base};
          font-family: ${FONT.mono};
          color: ${C.ink};
          background: ${C.bg};
          outline: none;
          width: 100%;
          text-align: center;
          letter-spacing: 2px;
          font-weight: 700;
          transition: border-color .15s;
        }
        .year-input:focus { border-color: ${C.primary}; }
        .year-input.error { border-color: ${C.error}; }
      `}</style>

      <AppShell activeNav="stanze">
        <div style={{ padding: S.md, maxWidth: '600px', margin: '0 auto', paddingBottom: '32px' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.lg }}>
            <button
              onClick={() => step === 2 ? setStep(1) : router.back()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <ArrowLeft size={20} color={C.muted} />
            </button>
            <div>
              <div style={{ fontSize: TEXT.xs, color: C.muted }}>
                Passo {step} di {mode === 'discover' ? 2 : 1}
              </div>
              <div style={{ fontSize: TEXT.lg, fontWeight: '800', color: C.ink }}>
                {step === 1 ? 'Che tipo di stanza?' : 'Filtri avanzati'}
              </div>
            </div>
          </div>

          {/* ── Step 1 ── */}
          {step === 1 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.sm, marginBottom: S.lg }}>
                {modeCards.map((card) => (
                  <div
                    key={card.id}
                    className={`mode-card${mode === card.id ? ' selected' : ''}`}
                    onClick={() => setMode(card.id)}
                  >
                    {mode === card.id && (
                      <div style={{
                        position: 'absolute', top: S.sm, right: S.sm,
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: C.primary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check size={13} color="#fff" weight="bold" />
                      </div>
                    )}
                    {card.icon}
                    <div style={{ fontSize: TEXT.sm, fontWeight: '700', color: C.ink }}>{card.title}</div>
                    <div style={{ fontSize: TEXT.xs, color: C.muted, lineHeight: 1.5 }}>{card.desc}</div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: C.primary }}>{card.badge}</div>
                  </div>
                ))}
              </div>

              {mode && (
                <div style={{
                  background: C.primaryLight, borderRadius: R.md,
                  padding: S.md, marginBottom: S.lg,
                  fontSize: TEXT.sm, color: C.primary,
                  display: 'flex', alignItems: 'center', gap: S.sm,
                }}>
                  <FilmSlate size={18} color={C.primary} weight="duotone" />
                  <div>
                    {mode === 'trending' && 'I 20 film più popolari di questa settimana'}
                    {mode === 'cinema' && 'Film attualmente nelle sale italiane'}
                    {mode === 'streaming' && 'Film disponibili su Netflix, Prime, Disney+ e altri in Italia'}
                    {mode === 'discover' && 'Filtra per genere e anno nel passo successivo'}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (!mode) return;
                  if (mode === 'discover') { setStep(2); return; }
                  handleCreate();
                }}
                disabled={!mode || isCreating}
                style={{
                  width: '100%', padding: '16px',
                  background: mode ? C.primary : C.border,
                  color: '#fff', border: 'none', borderRadius: R.full,
                  fontSize: TEXT.base, fontWeight: '700',
                  cursor: mode ? 'pointer' : 'not-allowed',
                  fontFamily: FONT.sans,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.sm,
                  boxShadow: mode ? `0 4px 16px rgba(232,56,109,.3)` : 'none',
                  opacity: isCreating ? 0.7 : 1,
                }}
              >
                {isCreating ? '⏳ Creazione...' : mode === 'discover' ? (
                  <><span>Avanti</span><ArrowRight size={18} color="#fff" /></>
                ) : (
                  <><FilmSlate size={18} color="#fff" weight="fill" /> Crea stanza</>
                )}
              </button>
            </>
          )}

          {/* ── Step 2: filtri discover ── */}
          {step === 2 && (
            <>
              {/* Generi */}
              <div style={{ marginBottom: S.lg }}>
                <div style={{ fontSize: TEXT.base, fontWeight: '700', color: C.ink, marginBottom: S.xs }}>
                  Generi
                  <span style={{ fontSize: TEXT.xs, color: C.muted, fontWeight: '400', marginLeft: S.xs }}>
                    (opzionale)
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.xs }}>
                  {GENRES.map((g) => (
                    <button
                      key={g.id}
                      className={`genre-chip${selectedGenres.includes(g.id) ? ' selected' : ''}`}
                      onClick={() => toggleGenre(g.id)}
                    >
                      <span>{g.emoji}</span>
                      {g.label}
                      {selectedGenres.includes(g.id) && (
                        <Check size={12} color={C.primary} weight="bold" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anno — input libero con validazione ─────────────────────── */}
              <div style={{ marginBottom: S.lg }}>
                <div style={{ fontSize: TEXT.base, fontWeight: '700', color: C.ink, marginBottom: S.sm }}>
                  Periodo di uscita
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: S.sm, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '6px', textAlign: 'center' }}>Dal</div>
                    <input
                      type="number"
                      className={`year-input${yearError ? ' error' : ''}`}
                      value={yearFromStr}
                      onChange={(e) => {
                        setYearFromStr(e.target.value);
                        setYearError('');
                      }}
                      onBlur={validateYears}
                      min={1900}
                      max={currentYear}
                      placeholder="1990"
                    />
                  </div>

                  <div style={{ fontSize: TEXT.sm, color: C.muted, textAlign: 'center', paddingTop: '20px' }}>
                    →
                  </div>

                  <div>
                    <div style={{ fontSize: TEXT.xs, color: C.muted, marginBottom: '6px', textAlign: 'center' }}>Al</div>
                    <input
                      type="number"
                      className={`year-input${yearError ? ' error' : ''}`}
                      value={yearToStr}
                      onChange={(e) => {
                        setYearToStr(e.target.value);
                        setYearError('');
                        // ─── Validazione live: anno "al" non può essere < anno "dal"
                        const to = parseInt(e.target.value);
                        if (to < yearFrom) {
                          setYearError('L\'anno "al" non può essere minore dell\'anno "dal"');
                        }
                      }}
                      onBlur={validateYears}
                      min={yearFrom}
                      max={currentYear + 1}
                      placeholder={String(currentYear)}
                    />
                  </div>
                </div>

                {/* Errore anni */}
                {yearError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    marginTop: S.sm, fontSize: TEXT.xs, color: C.error,
                  }}>
                    <Warning size={14} color={C.error} weight="fill" />
                    {yearError}
                  </div>
                )}

                {/* Slider visivo range */}
                {!yearError && yearFromStr.length === 4 && yearToStr.length === 4 && (
                  <div style={{
                    marginTop: S.sm, padding: '8px 12px',
                    background: C.bgSoft, borderRadius: R.sm,
                    fontSize: TEXT.xs, color: C.muted, textAlign: 'center',
                  }}>
                    Film dal <strong style={{ color: C.ink }}>{yearFrom}</strong> al{' '}
                    <strong style={{ color: C.ink }}>{yearTo}</strong>
                    {' '}({yearTo - yearFrom + 1} anni di cinema)
                  </div>
                )}
              </div>

              {/* Riepilogo */}
              <div style={{
                background: C.bgSoft, borderRadius: R.md,
                padding: S.md, marginBottom: S.lg,
                fontSize: TEXT.sm, color: C.muted, lineHeight: 1.8,
              }}>
                <div style={{ fontWeight: '700', color: C.ink, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FilmSlate size={16} color={C.primary} weight="duotone" />
                  Riepilogo stanza
                </div>
                <div>
                  🎬 {selectedGenres.length === 0
                    ? 'Tutti i generi'
                    : selectedGenres.map((id) => GENRES.find((g) => g.id === id)?.emoji + ' ' + GENRES.find((g) => g.id === id)?.label).join(', ')
                  }
                </div>
                <div>📅 Dal {yearFrom} al {yearTo}</div>
              </div>

              <button
                onClick={handleCreate}
                disabled={!!yearError || isCreating}
                style={{
                  width: '100%', padding: '16px',
                  background: yearError ? C.border : C.primary,
                  color: '#fff', border: 'none', borderRadius: R.full,
                  fontSize: TEXT.base, fontWeight: '700',
                  cursor: yearError ? 'not-allowed' : 'pointer',
                  fontFamily: FONT.sans,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.sm,
                  boxShadow: !yearError ? `0 4px 16px rgba(232,56,109,.3)` : 'none',
                  opacity: isCreating ? 0.7 : 1,
                }}
              >
                {isCreating ? '⏳ Creazione...' : <><FilmSlate size={18} color="#fff" weight="fill" /> Crea stanza</>}
              </button>
            </>
          )}
        </div>
      </AppShell>
    </>
  );
}