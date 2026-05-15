'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { C, R, FONT, TEXT, S, SHADOW, BP, btn } from '@/styles/token';

export default function LandingPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ─── Se già loggato o ospite → vai a /home ────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (currentUser || isGuest) {
      router.replace('/');
    }
  }, [currentUser, isGuest, isLoading]);

  if (!isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ fontSize: '32px' }}>🎬</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        .land-nav-link {
          font-size: ${TEXT.sm};
          color: ${C.muted};
          text-decoration: none;
          font-family: ${FONT.sans};
          cursor: pointer;
          background: none;
          border: none;
          padding: 4px 0;
          transition: color 0.15s;
        }
        .land-nav-link:hover { color: ${C.ink}; }
        .land-hero-btn-primary {
          background: ${C.primary};
          color: white;
          border: none;
          border-radius: ${R.full};
          padding: 16px 32px;
          font-size: ${TEXT.base};
          font-weight: 700;
          cursor: pointer;
          font-family: ${FONT.sans};
          transition: opacity 0.15s, transform 0.15s;
          box-shadow: 0 4px 20px rgba(232,56,109,0.35);
        }
        .land-hero-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .land-hero-btn-secondary {
          background: ${C.bg};
          color: ${C.primary};
          border: 2px solid ${C.primary};
          border-radius: ${R.full};
          padding: 14px 32px;
          font-size: ${TEXT.base};
          font-weight: 600;
          cursor: pointer;
          font-family: ${FONT.sans};
          transition: background 0.15s;
        }
        .land-hero-btn-secondary:hover { background: ${C.primaryFaint}; }
        .land-feature-card {
          background: ${C.bg};
          border: 1.5px solid ${C.border};
          border-radius: ${R.lg};
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .land-feature-card:hover {
          box-shadow: ${SHADOW.md};
          transform: translateY(-2px);
        }
        .land-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        @media (max-width: ${BP.tablet}) {
          .land-hero-grid { grid-template-columns: 1fr !important; }
          .land-nav-links { display: none !important; }
          .land-features-grid { grid-template-columns: 1fr !important; }
          .land-stats-row { gap: 24px !important; }
          .land-hero-text { text-align: center; }
          .land-hero-btns { justify-content: center !important; }
          .land-auth-card { margin-top: 0 !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT.sans }}>

        {/* ─── NAVBAR ───────────────────────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.border}`,
          padding: `0 ${S.lg}`,
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, cursor: 'pointer' }} onClick={() => router.push('/')}>
              <span style={{ fontSize: '24px' }}>🎬</span>
              <span style={{ fontSize: TEXT.md, fontWeight: '800', color: C.ink }}>
                CINE<span style={{ color: C.primary }}>DATE</span>
              </span>
            </div>

            {/* Links desktop */}
            <div className="land-nav-links" style={{ display: 'flex', alignItems: 'center', gap: S.lg }}>
              <button className="land-nav-link">Home</button>
              <button className="land-nav-link">Come funziona</button>
              <button className="land-nav-link">Recensioni</button>
              <button className="land-nav-link">Cinema vicino a te</button>
            </div>

            {/* CTA desktop */}
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
              <button
                className="land-nav-link"
                style={{ padding: '8px 16px' }}
                onClick={() => router.push('/auth')}
              >
                Accedi
              </button>
              <button
                onClick={() => router.push('/auth')}
                style={{
                  background: C.primary, color: C.white, border: 'none',
                  borderRadius: R.full, padding: '9px 20px',
                  fontSize: TEXT.sm, fontWeight: '600', cursor: 'pointer',
                  fontFamily: FONT.sans,
                }}
              >
                Registrati
              </button>
            </div>
          </div>
        </nav>

        {/* ─── HERO ─────────────────────────────────────────────────────────── */}
        <section style={{
          
          maxWidth: '1200px', margin: '0 auto',
          padding: `${S.xxl} ${S.lg}`,
       }}>
          <div
            className="land-hero-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr',
              gap: S.xxl,
              alignItems: 'center',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            {/* ─── Testo sinistra ──────────────────────────────────────────── */}
            <div className="land-hero-text">
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: S.xs,
                background: C.primaryLight, color: C.primary,
                borderRadius: R.full, padding: '6px 14px',
                fontSize: TEXT.xs, fontWeight: '600',
                marginBottom: S.md,
              }}>
                🎉 Nuovo modo di scegliere film
              </div>

              <h1 style={{
                fontSize: 'clamp(32px, 5vw, 52px)',
                fontWeight: '800', color: C.ink,
                lineHeight: '1.15', marginBottom: S.md,
              }}>
                Trova il film perfetto,{' '}
                <span style={{ color: C.primary }}>insieme.</span>
              </h1>

              <p style={{
                fontSize: TEXT.md, color: C.muted,
                lineHeight: '1.7', marginBottom: S.xl,
                maxWidth: '460px',
              }}>
                Entra in una stanza, scopri nuovi film e guarda solo quelli che vi piacciono davvero — in coppia o con gli amici.
              </p>

              {/* Feature bullets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm, marginBottom: S.xl }}>
                {[
                  { icon: '🏠', text: 'Stanze private tra amici o in coppia' },
                  { icon: '❤️', text: 'Match sui film, non sulle persone' },
                  { icon: '▶️', text: 'Trailer, dove guardarlo e recensioni' },
                  { icon: '📍', text: 'Cinema vicino a te e vantaggi esclusivi' },
                ].map((f) => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: S.sm, fontSize: TEXT.base, color: C.muted }}>
                    <span style={{ fontSize: '18px' }}>{f.icon}</span>
                    {f.text}
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="land-stats-row" style={{ display: 'flex', gap: S.xl, marginBottom: S.xl }}>
                {[
                  { value: '0', label: 'Film disponibili' },
                  { value: '0', label: 'Stanze create' },
                  { value: '0', label: 'Utenti felici' },
                ].map((s) => (
                  <div key={s.label} className="land-stat">
                    <span style={{ fontSize: TEXT.xl, fontWeight: '800', color: C.ink }}>{s.value}</span>
                    <span style={{ fontSize: TEXT.xs, color: C.muted }}>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="land-hero-btns" style={{ display: 'flex', gap: S.sm, flexWrap: 'wrap' }}>
                <button className="land-hero-btn-primary" onClick={() => router.push('/auth')}>
                  Inizia gratis
                </button>
                <button className="land-hero-btn-secondary" onClick={() => router.push('/auth')}>
                  Scopri come funziona
                </button>
              </div>
            </div>

            {/* ─── Auth card destra ─────────────────────────────────────────── */}
            <div
              className="land-auth-card"
              style={{
                background: C.bg, borderRadius: R.xl,
                padding: S.xl, boxShadow: SHADOW.xl,
                border: `1px solid ${C.border}`,
                animation: mounted ? 'fadeUp 0.6s ease 0.2s both' : 'none',
              }}
            >
              {/* Tab */}
              <div style={{ display: 'flex', borderRadius: R.full, overflow: 'hidden', border: `1.5px solid ${C.border}`, marginBottom: S.lg }}>
                {(['Accedi', 'Registrati'] as const).map((label) => (
                  <button
                    key={label}
                    onClick={() => router.push('/auth')} 
                    style={{
                      flex: 1, padding: '11px', border: 'none',
                      background: label === 'Accedi' ? C.bg : C.primary,
                      color: label === 'Accedi' ? C.muted : C.white,
                      fontSize: TEXT.sm, fontWeight: '600',
                      cursor: 'pointer', fontFamily: FONT.sans,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: TEXT.lg, fontWeight: '700', color: C.ink, marginBottom: S.xs }}>
                Crea il tuo account
              </div>
              <div style={{ fontSize: TEXT.sm, color: C.muted, marginBottom: S.lg }}>
                Inizia la tua avventura su CineDate
              </div>

              {/* Campi placeholder */}
              {[
                { icon: '👤', placeholder: 'Nome' },
                { icon: '✉️', placeholder: 'Email' },
                { icon: '🔒', placeholder: 'Password' },
              ].map((f) => (
                <div
                  key={f.placeholder}
                  onClick={() => router.push('/auth')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: S.sm,
                    border: `1.5px solid ${C.border}`, borderRadius: R.md,
                    padding: '13px 16px', marginBottom: S.sm,
                    cursor: 'pointer', color: C.faint, fontSize: TEXT.base,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <span>{f.icon}</span>
                  <span>{f.placeholder}</span>
                </div>
              ))}

              <button
                onClick={() => router.push('/auth')}
                style={{ ...btn.primary, marginBottom: S.md }}
              >
                Registrati
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.md }}>
                <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
                <span style={{ fontSize: TEXT.xs, color: C.faint }}>oppure</span>
                <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
              </div>

              {/* Social buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
                <button
                  onClick={() => router.push('/auth')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: S.sm, padding: '13px', borderRadius: R.full,
                    border: `1.5px solid ${C.border}`, background: C.bg,
                    fontSize: TEXT.sm, fontWeight: '500', cursor: 'pointer',
                    fontFamily: FONT.sans, color: C.ink,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
                  </svg>
                  Continua con Google
                </button>

                <button
                  onClick={() => router.push('/auth')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: S.sm, padding: '13px', borderRadius: R.full,
                    border: `1.5px solid ${C.border}`, background: C.bg,
                    fontSize: TEXT.sm, fontWeight: '500', cursor: 'pointer',
                    fontFamily: FONT.sans, color: C.ink,
                  }}
                >
                  Accedi come ospite
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: S.md, fontSize: TEXT.xs, color: C.faint }}>
                Hai già un account?{' '}
                <span
                  onClick={() => router.push('/auth')}
                  style={{ color: C.primary, fontWeight: '600', cursor: 'pointer' }}
                >
                  Accedi
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* ─── COME FUNZIONA ────────────────────────────────────────────────── */}
        <section style={{ background: C.bgSoft, padding: `${S.xxl} ${S.lg}` }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: S.xl }}>
              <h2 style={{ fontSize: TEXT.xxl, fontWeight: '800', color: C.ink, marginBottom: S.sm }}>
                Come funziona
              </h2>
              <p style={{ fontSize: TEXT.base, color: C.muted }}>
                Tre semplici passi per trovare il film perfetto
              </p>
            </div>

            <div
              className="land-features-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: S.lg }}
            >
              {[
                { step: '1', icon: '🏠', title: 'Crea una stanza', desc: 'Crea una stanza privata e condividi il codice con il tuo partner o gli amici.' },
                { step: '2', icon: '🎬', title: 'Swipa i film', desc: 'Scorri i film e metti like a quelli che ti piacciono. Nessuno vede le scelte degli altri.' },
                { step: '3', icon: '❤️', title: 'Trova il match', desc: 'Quando entrambi mettete like allo stesso film — è un match! Stasera avete il film.' },
              ].map((f) => (
                <div key={f.step} className="land-feature-card">
                  <div style={{
                    width: '40px', height: '40px', borderRadius: R.full,
                    background: C.primaryLight, color: C.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: TEXT.base, fontWeight: '800',
                  }}>
                    {f.step}
                  </div>
                  <div style={{ fontSize: '28px' }}>{f.icon}</div>
                  <div style={{ fontSize: TEXT.md, fontWeight: '700', color: C.ink }}>{f.title}</div>
                  <div style={{ fontSize: TEXT.sm, color: C.muted, lineHeight: '1.6' }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA FINALE ───────────────────────────────────────────────────── */}
        <section style={{ padding: `${S.xxl} ${S.lg}`, textAlign: 'center' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: TEXT.xxl, fontWeight: '800', color: C.ink, marginBottom: S.md }}>
              Pronto a trovare il film perfetto?
            </h2>
            <p style={{ fontSize: TEXT.base, color: C.muted, marginBottom: S.xl, lineHeight: '1.6' }}>
              Unisciti a migliaia di coppie e amici che usano CineDate ogni sera.
            </p>
            <div style={{ display: 'flex', gap: S.sm, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="land-hero-btn-primary" onClick={() => router.push('/auth')}>
                Inizia gratis — è subito
              </button>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ───────────────────────────────────────────────────────── */}
        <footer style={{
          borderTop: `1px solid ${C.border}`,
          padding: `${S.lg} ${S.lg}`,
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.sm, marginBottom: S.sm }}>
            <span style={{ fontSize: '20px' }}>🎬</span>
            <span style={{ fontSize: TEXT.base, fontWeight: '800', color: C.ink }}>
              CINE<span style={{ color: C.primary }}>DATE</span>
            </span>
          </div>
          <div style={{ fontSize: TEXT.xs, color: C.faint }}>
            © 2026 CineDate. Fatto con ❤️ per chi ama il cinema.
          </div>
        </footer>

      </div>
    </>
  );
}