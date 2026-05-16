'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { C, R, FONT, TEXT, S, SHADOW } from '@/styles/token';

export default function LandingPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const { enterAsGuest } = useAuth();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isLoading) return;
    if (currentUser || isGuest) router.replace('/');
  }, [currentUser, isGuest, isLoading]);

  
  const handleGuest = () => {
    enterAsGuest();
    window.location.href = '/home';
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '32px' }}>🎬</span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes wiggle {
          0%,100% { transform: rotate(-2deg); }
          50%     { transform: rotate(2deg); }
        }

        body { overflow-x: hidden; }

        .land { font-family: ${FONT.sans}; background: #fff; color: ${C.ink}; }

        /* ── Navbar ── */
        .nav {
          position: sticky; top: 0; z-index: 99;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; height: 60px;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid #f0f0f0;
        }
        .nav-logo { display: flex; align-items: center; gap: 8px; cursor: pointer; text-decoration: none; }
        .nav-logo-text { font-size: 17px; font-weight: 800; letter-spacing: 0.5px; }
        .nav-links { display: flex; gap: 28px; }
        .nav-link {
          font-size: 14px; color: #666; background: none; border: none;
          cursor: pointer; font-family: ${FONT.sans}; padding: 0;
          transition: color .15s;
        }
        .nav-link:hover { color: ${C.ink}; }
        .nav-cta { display: flex; gap: 10px; align-items: center; }
        .btn-sm-ghost {
          font-size: 14px; color: ${C.ink}; background: none; border: none;
          cursor: pointer; font-family: ${FONT.sans}; padding: 7px 14px;
        }
        .btn-sm-primary {
          font-size: 14px; font-weight: 600; color: #fff;
          background: ${C.primary}; border: none; border-radius: 999px;
          cursor: pointer; font-family: ${FONT.sans}; padding: 8px 20px;
          transition: opacity .15s;
        }
        .btn-sm-primary:hover { opacity: .88; }

        /* ── Hero ── */
        .hero {
          max-width: 1160px; margin: 0 auto;
          padding: 80px 32px 60px;
          display: grid; grid-template-columns: 1fr 420px;
          gap: 64px; align-items: center;
        }
        .hero-eyebrow {
          display: inline-block;
          font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
          text-transform: uppercase; color: ${C.primary};
          margin-bottom: 20px;
        }
        .hero-h1 {
          font-size: clamp(38px, 5vw, 60px);
          font-weight: 800; line-height: 1.08;
          letter-spacing: -1.5px; color: ${C.ink};
          margin-bottom: 22px;
        }
        .hero-h1 em {
          font-style: normal; color: ${C.primary};
          /* sottolineatura disegnata a mano */
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='8'%3E%3Cpath d='M2 6 Q50 2 100 5 Q150 8 198 4' stroke='%23E8386D' stroke-width='2.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: repeat-x;
          background-position: 0 100%;
          background-size: 200px 8px;
          padding-bottom: 6px;
        }
        .hero-sub {
          font-size: 17px; color: #555; line-height: 1.65;
          max-width: 480px; margin-bottom: 36px;
        }
        .hero-btns { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 52px; }
        .btn-hero-primary {
          background: ${C.primary}; color: #fff; border: none;
          border-radius: 999px; padding: 16px 36px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          font-family: ${FONT.sans};
          box-shadow: 0 6px 24px rgba(232,56,109,.32);
          transition: transform .15s, box-shadow .15s;
        }
        .btn-hero-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(232,56,109,.4); }
        .btn-hero-ghost {
          background: #fff; color: ${C.ink};
          border: 1.5px solid #e0e0e0; border-radius: 999px;
          padding: 15px 28px; font-size: 15px; font-weight: 500;
          cursor: pointer; font-family: ${FONT.sans};
          transition: border-color .15s;
        }
        .btn-hero-ghost:hover { border-color: ${C.primary}; color: ${C.primary}; }

        /* ── Pill stats ── */
        .stats-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .stat-pill {
          display: flex; align-items: center; gap: 8px;
          background: #f8f8f8; border-radius: 999px;
          padding: 8px 16px; font-size: 13px;
        }
        .stat-pill-num { font-weight: 700; color: ${C.ink}; }
        .stat-pill-label { color: #777; }

        /* ── Auth card ── */
        .auth-card {
          background: #fff; border-radius: 24px;
          padding: 32px 28px;
          box-shadow: 0 8px 40px rgba(0,0,0,.10), 0 1px 0 rgba(0,0,0,.04);
          border: 1px solid #f0f0f0;
        }
        .auth-card-title { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .auth-card-sub { font-size: 13px; color: #888; margin-bottom: 22px; }
        .auth-field {
          display: flex; align-items: center; gap: 10px;
          border: 1.5px solid #ebebeb; border-radius: 12px;
          padding: 13px 16px; margin-bottom: 10px;
          font-size: 14px; color: #aaa; cursor: pointer;
          transition: border-color .15s;
        }
        .auth-field:hover { border-color: ${C.primary}; }
        .auth-submit {
          width: 100%; padding: 14px;
          background: ${C.primary}; color: #fff; border: none;
          border-radius: 999px; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: ${FONT.sans}; margin-top: 4px;
          transition: opacity .15s;
        }
        .auth-submit:hover { opacity: .9; }
        .auth-divider {
          display: flex; align-items: center; gap: 10px;
          margin: 18px 0; font-size: 12px; color: #bbb;
        }
        .auth-divider::before, .auth-divider::after {
          content: ''; flex: 1; border-top: 1px solid #ebebeb;
        }
        .auth-social {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 12px; border: 1.5px solid #ebebeb;
          border-radius: 999px; font-size: 14px; font-weight: 500;
          cursor: pointer; font-family: ${FONT.sans};
          background: #fff; color: ${C.ink}; margin-bottom: 8px;
          transition: background .15s;
        }
        .auth-social:hover { background: #f8f8f8; }
        .auth-switch { font-size: 12px; color: #999; text-align: center; margin-top: 16px; }
        .auth-switch span { color: ${C.primary}; font-weight: 600; cursor: pointer; }

        /* ── Proof strip ── */
        .proof {
          background: ${C.primaryLight}; border-top: 1px solid #ffd6e3;
          border-bottom: 1px solid #ffd6e3;
          padding: 18px 32px;
          display: flex; align-items: center; justify-content: center;
          gap: 40px; flex-wrap: wrap;
        }
        .proof-item { font-size: 13px; color: ${C.primary}; font-weight: 600; display: flex; align-items: center; gap: 6px; }

        /* ── How ── */
        .how { max-width: 1160px; margin: 0 auto; padding: 80px 32px; }
        .how-header { margin-bottom: 52px; }
        .how-label { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.primary}; margin-bottom: 12px; }
        .how-h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; letter-spacing: -1px; line-height: 1.1; }
        .how-h2 span { color: ${C.primary}; }

        /* Layout editoriale — NON grid simmetrica */
        .how-steps { display: flex; flex-direction: column; gap: 0; }
        .how-step {
          display: grid; grid-template-columns: 80px 1fr;
          gap: 28px; padding: 36px 0;
          border-bottom: 1px solid #f0f0f0;
          align-items: start;
        }
        .how-step:last-child { border-bottom: none; }
        .how-step-num {
          font-size: 56px; font-weight: 800; color: #f0f0f0;
          line-height: 1; font-variant-numeric: tabular-nums;
          user-select: none;
        }
        .how-step-content { padding-top: 4px; }
        .how-step-icon { font-size: 28px; margin-bottom: 10px; display: block; }
        .how-step-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
        .how-step-desc { font-size: 15px; color: #666; line-height: 1.6; max-width: 540px; }
        .how-step-tag {
          display: inline-flex; margin-top: 12px;
          background: ${C.primaryLight}; color: ${C.primary};
          border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 600;
        }

        /* ── Quote ── */
        .quote-section {
          background: ${C.ink}; color: #fff;
          padding: 72px 32px; text-align: center;
        }
        .quote-text {
          font-size: clamp(22px, 3.5vw, 36px); font-weight: 700;
          line-height: 1.3; max-width: 700px; margin: 0 auto 20px;
          letter-spacing: -0.5px;
        }
        .quote-text em { font-style: normal; color: ${C.primary}; }
        .quote-author { font-size: 13px; color: #888; }

        /* ── Final CTA ── */
        .final-cta {
          max-width: 600px; margin: 0 auto;
          padding: 80px 32px; text-align: center;
        }
        .final-cta h2 {
          font-size: clamp(28px, 4vw, 42px); font-weight: 800;
          letter-spacing: -1px; margin-bottom: 14px;
        }
        .final-cta p { font-size: 16px; color: #666; line-height: 1.6; margin-bottom: 36px; }

        /* ── Footer ── */
        .footer {
          border-top: 1px solid #f0f0f0; padding: 28px 32px;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 12px;
        }
        .footer-logo { font-size: 15px; font-weight: 800; }
        .footer-copy { font-size: 12px; color: #aaa; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .hero {
            grid-template-columns: 1fr;
            padding: 48px 20px 40px;
            gap: 40px;
          }
          .hero-h1 { letter-spacing: -0.5px; }
          .auth-card { order: -1; }
          .how { padding: 60px 20px; }
          .how-step { grid-template-columns: 52px 1fr; gap: 16px; }
          .how-step-num { font-size: 40px; }
          .proof { gap: 20px; padding: 18px 20px; }
          .footer { flex-direction: column; align-items: center; text-align: center; }
          .final-cta { padding: 60px 20px; }
          .quote-section { padding: 52px 20px; }
        }
      `}</style>

      <div className="land">

        {/* ── NAVBAR ────────────────────────────────────────────────────── */}
        <nav className="nav">
          <div className="nav-logo" onClick={() => router.push('/')}>
            <span style={{ fontSize: '22px' }}>🎬</span>
            <span className="nav-logo-text">
              CINE<span style={{ color: C.primary }}>DATE</span>
            </span>
          </div>
          <div className="nav-links">
            <button className="nav-link">Come funziona</button>
            <button className="nav-link">Recensioni</button>
            <button className="nav-link">Cinema vicino a te</button>
          </div>
          <div className="nav-cta">
            <button className="btn-sm-ghost" onClick={() => router.push('/auth')}>Accedi</button>
            <button className="btn-sm-primary" onClick={() => router.push('/auth')}>Registrati</button>
          </div>
        </nav>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section
          className="hero"
          style={{
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        >
          {/* Sinistra */}
          <div>
            <span className="hero-eyebrow">Per chi ama il cinema in compagnia</span>

            <h1 className="hero-h1">
              Trova il film<br />
              perfetto,{' '}
              <em>insieme.</em>
            </h1>

            <p className="hero-sub">
             Il modo più semplice per trovare qualcosa da guardare insieme.
              <em> Swipate film e serie che vi incuriosiscono</em>, trovate i match
              in comune e iniziate subito la serata
            </p>

            <div className="hero-btns">
              <button className="btn-hero-primary" onClick={() => router.push('/auth')}>
                Provalo gratis →
              </button>
              <button className="btn-hero-ghost" onClick={handleGuest}>
                Entra come ospite
              </button>
            </div>

            <div className="stats-row">
              {[
                { num: '0', label: 'film disponibili' },
                { num: '0', label: 'stanze create' },
                { num: '0', label: 'valutazione media' },
              ].map((s) => (
                <div key={s.label} className="stat-pill">
                  <span className="stat-pill-num">{s.num}</span>
                  <span className="stat-pill-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auth card destra */}
          <div
            className="auth-card"
            style={{
              animation: mounted ? 'fadeUp 0.5s ease 0.15s both' : 'none',
              boxShadow: SHADOW.xxxl,
            }}
          >
            {/* Tab switcher */}
            <div style={{ display: 'flex', borderRadius: '999px', overflow: 'hidden', border: '1.5px solid #ebebeb', marginBottom: '24px' }}>
              {[
                { label: 'Accedi', active: false },
                { label: 'Registrati', active: true },
              ].map((t) => (
                <button
                  key={t.label}
                  onClick={() => router.push('/auth')}
                  style={{
                    flex: 1, padding: '10px', border: 'none',
                    background: t.active ? C.primary : '#fff',
                    color: t.active ? '#fff' : '#999',
                    fontSize: '14px', fontWeight: '600',
                    cursor: 'pointer', fontFamily: FONT.sans,
                    transition: 'all .2s',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="auth-card-title">Crea il tuo account</div>
            <div className="auth-card-sub">Inizia la tua avventura su CineDate</div>

            {[
              { icon: '👤', text: 'Nome' },
              { icon: '✉️', text: 'Email' },
              { icon: '🔒', text: 'Password' },
            ].map((f) => (
              <div key={f.text} className="auth-field" onClick={() => router.push('/auth')}>
                <span>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}

            <button className="auth-submit" onClick={() => router.push('/auth')}>
              Registrati
            </button>

            <div className="auth-divider">oppure</div>

            <button className="auth-social" onClick={() => router.push('/auth')}>
              <svg width="16" height="16" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
              </svg>
              Continua con Google
            </button>

            <button className="auth-social" onClick={handleGuest}>
              👤 Accedi come ospite
            </button>

            <div className="auth-switch">
              Hai già un account?{' '}
              <span onClick={() => router.push('/auth')}>Accedi</span>
            </div>
          </div>
        </section>

        {/* ── PROOF STRIP ───────────────────────────────────────────────── */}
        <div className="proof">
          {[
            { icon: '🏠', text: 'Stanze private tra amici o in coppia' },
            { icon: '❤️', text: 'Match su film e serie' },
            { icon: '▶️', text: 'Trailer e streaming integrati' },
            { icon: '📍', text: 'Cinema vicino a te con offerte dedicate' } 
          ].map((p) => (
            <div key={p.text} className="proof-item">
              <span>{p.icon}</span>
              <span>{p.text}</span>
            </div>
          ))}
        </div>

        {/* ── COME FUNZIONA ─────────────────────────────────────────────── */}
        <section className="how">
          <div className="how-header">
            <div className="how-label">Come funziona</div>
            <h2 className="how-h2">
              Dal divano al film<br />
              in <span>tre mosse</span>
            </h2>
          </div>

          <div className="how-steps">
            {[
              {
                num: '01',
                icon: '🏠',
                title: 'Crei una stanza',
                desc: 'Create una stanza e condividete il codice con chi volete. Niente link, niente account obbligatorio — si può entrare anche come ospite.',
                tag: '30 secondi per iniziare',
              },
              {
                num: '02',
                icon: '🎬',
                title: 'Swipate i film (separatamente)',
                desc: 'Ognuno sceglie in autonomia i film che gli interessano. Quando i gusti si incrociano, nasce il match.',
                tag: 'Completamente anonimo',
              },
              {
                num: '03',
                icon: '🎉',
                title: 'Appare il match',
                desc: 'Quando entrambi mettete like allo stesso film, compare il match. Quando arriva il match, avete trovato qualcosa che piace davvero a entrambi.',
                tag: 'Trovare qualcosa da guardare non è mai stato così semplice',
              },
            ].map((step) => (
              <div key={step.num} className="how-step">
                <div className="how-step-num">{step.num}</div>
                <div className="how-step-content">
                  <span className="how-step-icon">{step.icon}</span>
                  <div className="how-step-title">{step.title}</div>
                  <div className="how-step-desc">{step.desc}</div>
                  <span className="how-step-tag">{step.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── QUOTE ─────────────────────────────────────────────────────── */}
        <section className="quote-section">
          <p className="quote-text">
           "Abbiamo scoperto film che non avremmo mai trovato da soli.  <em> E scegliere cosa guardare è diventato finalmente semplice</em>."
          </p>
          <div className="quote-author">— Giulia & Marco, Milano 🍿</div>
        </section>

        {/* ── CTA FINALE ────────────────────────────────────────────────── */}
        <section className="final-cta">
          <h2>Stasera cosa guardate?</h2>
          <p>
            Create una stanza, scoprite nuovi film
            e trovate subito qualcosa da guardare insieme.
          </p>
          <button
            className="btn-hero-primary"
            onClick={() => router.push('/auth')}
            style={{ width: 'auto', padding: '16px 40px' }}
          >
            Inizia adesso — è gratis
          </button>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <footer className="footer">
          <div className="footer-logo">
            🎬 CINE<span style={{ color: C.primary }}>DATE</span>
          </div>
          <div className="footer-copy">
            © 2026 CineDate — Fatto con ❤️ per chi ama il cinema
          </div>
        </footer>

      </div>
    </>
  );
}