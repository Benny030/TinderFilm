'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from './bottomNav';
import AppFooter from './AppFooter';
import { useTheme } from '@/context/ThemeContext';
import { FONT, TEXT, S, R } from '@/styles/token';
import type { Icon } from '@phosphor-icons/react';
import {
  House, FilmSlate, ChatCircle, MapPin, User, SignOut, List, X,
} from '@phosphor-icons/react';

// ─── Palette dark "cinema elegante" (dalla home) ─────────────────────────
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

// ─── Palette light "cinema elegante" (dalla home) ─────────────────────────
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

type Props = {
  children: React.ReactNode;
  activeNav: 'home' | 'stanze' | 'recensioni' | 'cinema' | 'profilo';
  hideNav?: boolean;
};

type NavItem = {
  id: string;
  label: string;
  icon: Icon;
  path: string;
  comingSoon?: boolean;
};

const navItems: NavItem[] = [
  { id: 'home',       label: 'Home',       icon: House,      path: '/home' },
  { id: 'stanze',     label: 'Stanze',     icon: FilmSlate,  path: '/crea-stanza' },
  { id: 'recensioni', label: 'Recensioni', icon: ChatCircle, path: '/recensioni', comingSoon: true },
  { id: 'cinema',     label: 'Cinema',     icon: MapPin,     path: '/cinema' },
  { id: 'profilo',    label: 'Profilo',    icon: User,       path: '/profilo' },
];

export default function AppShell({ children, activeNav, hideNav = false }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const bg = isDark ? D.bg : '#f0ebe3'; // sfondo esterno light più caldo
  const contentBg = isDark ? D.bg : '#ffffff';
  const border = isDark ? D.border : '#d6cbbc';

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        .app-desktop-bg {
          min-height: 100vh;
          background: ${bg};
          font-family: ${FONT.sans};
          letter-spacing: -0.01em;
        }
        .app-inner {
          margin: 0 auto;
          background: ${contentBg};
          min-height: 100vh;
          position: relative;
        }
        .app-mobile-topbar { display: none; }

        /* Sharp corners per tutti i bottoni e input (stile home) */
        .app-desktop-bg button,
        .app-desktop-bg input { 
        }

        @media (max-width: 1023px) {
          .app-inner { max-width: 480px; }
          .app-sidebar { display: none !important; }
          .app-mobile-topbar {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 20px; border-bottom: 1px solid ${border};
            position: sticky; top: 0; z-index: 40;
            background: ${isDark ? 'rgba(10,8,6,.92)' : 'rgba(255,255,255,.92)'};
            backdrop-filter: blur(10px);
          }
        }
        @media (min-width: 1024px) {
          .app-desktop-bg { background: ${isDark ? D.bg : '#f0ebe3'}; }
          .app-inner {
            max-width: 1900px; min-height: 100vh;
            display: grid; grid-template-columns: 240px 1fr;
            gap: 0; background: transparent;
          }
          .app-sidebar { display: flex !important; }
          .app-bottom-nav { display: none !important; }
          .app-content { background: ${contentBg}; min-height: 100vh; overflow-y: auto; }
        }

        .app-drawer-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.6);
          z-index: 90; opacity: 0; pointer-events: none; transition: opacity .2s;
        }
        .app-drawer-overlay.open { opacity: 1; pointer-events: auto; }
        .app-drawer {
          position: fixed; top: 0; left: 0; bottom: 0; width: 264px;
          background: ${contentBg}; border-right: 1px solid ${border};
          z-index: 91; transform: translateX(-100%); transition: transform .25s ease;
          display: flex; flex-direction: column; padding: 20px 16px;
        }
        .app-drawer.open { transform: translateX(0); }
      `}</style>

      <div className="app-desktop-bg">
        <div className="app-inner">
          <SidebarDesktop activeNav={activeNav} />

          <div className="app-content">
            {/* Barra mobile: logo + hamburger */}
            <div className="app-mobile-topbar">
              <span style={{ fontSize: '17px', fontWeight: 800, color: P.text, letterSpacing: '.3px' }}>
                CINE<span style={{ color: P.pink }}>DATE</span>
              </span>
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Apri menu"
                style={{
                  width: '36px', height: '36px',
                  background: P.card,
                  border: `1px solid ${border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <List size={18} color={P.text} weight="bold" />
              </button>
            </div>

            {children}
            <AppFooter />

            {!hideNav && (
              <div className="app-bottom-nav">
                <BottomNav activeId={activeNav} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`app-drawer-overlay${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} activeNav={activeNav} />
    </>
  );
}

// ─── Drawer mobile ───────────────
function MobileDrawer({ open, onClose, activeNav }: { open: boolean; onClose: () => void; activeNav: string }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const router = useRouter();
  const { currentUser, isGuest, guestName, signOut } = useAuth();
  const displayName = currentUser && !currentUser.isGuest ? currentUser.username : guestName ?? 'Ospite';

  return (
    <div className={`app-drawer${open ? ' open' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <span style={{ fontSize: '17px', fontWeight: '800', color: P.text, letterSpacing: '.3px' }}>
          CINE<span style={{ color: P.pink }}>DATE</span>
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <X size={20} color={P.textMuted} />
        </button>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { if (!item.comingSoon) { router.push(item.path); onClose(); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 10px',
                background: isActive ? P.pinkGlow : 'transparent',
                color: isActive ? P.pink : item.comingSoon ? P.textFaint : P.textMuted,
                fontSize: '15px', fontWeight: isActive ? 700 : 500,
                cursor: item.comingSoon ? 'default' : 'pointer',
                fontFamily: FONT.sans, textAlign: 'left', width: '100%',
                border: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!item.comingSoon) {
                  e.currentTarget.style.background = P.pinkGlow;
                  e.currentTarget.style.color = P.pink;
                }
              }}
              onMouseLeave={(e) => {
                if (!item.comingSoon) {
                  e.currentTarget.style.background = isActive ? P.pinkGlow : 'transparent';
                  e.currentTarget.style.color = isActive ? P.pink : item.comingSoon ? P.textFaint : P.textMuted;
                }
              }}
            >
              <Icon size={19} weight="fill" />
              {item.label}
              {item.comingSoon && (
                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', background: P.pinkGlow, color: P.pink, borderRadius: '999px', padding: '2px 8px' }}>
                  presto
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: '14px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: P.pinkGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: P.pink, flexShrink: 0 }}>
          {displayName?.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{displayName}</div>
          <div style={{ fontSize: '11px', color: P.textFaint }}>{isGuest ? 'Ospite' : 'Utente'}</div>
        </div>
        <button onClick={() => signOut()} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: .7 }}>
          <SignOut size={17} color={P.textMuted} />
        </button>
      </div>
    </div>
  );
}

// ─── SIDEBAR DESKTOP ─────────────────────────────
function SidebarDesktop({ activeNav }: { activeNav: string }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const router = useRouter();
  const { currentUser, isGuest, guestName, signOut } = useAuth();
  const displayName = currentUser && !currentUser.isGuest ? currentUser.username : guestName ?? 'Ospite';

  return (
    <div
      className="app-sidebar"
      style={{
        flexDirection: 'column', padding: `${S.xl} ${S.md}`,
        borderRight: `1px solid ${P.border}`, background: P.bg,
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div
        onClick={() => router.push('/home')}
        style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.xl, cursor: 'pointer', padding: `0 ${S.sm}` }}
      >
        <span style={{ fontSize: TEXT.md, fontWeight: '800', color: P.text, letterSpacing: '.3px' }}>
          CINE<span style={{ color: P.pink }}>DATE</span>
        </span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { if (!item.comingSoon) router.push(item.path); }}
              style={{
                display: 'flex', alignItems: 'center', gap: S.sm,
                padding: `12px ${S.sm}`,
                background: isActive ? P.pinkGlow : 'transparent',
                color: isActive ? P.pink : item.comingSoon ? P.textFaint : P.textMuted,
                fontSize: TEXT.base, fontWeight: isActive ? '600' : '400',
                cursor: item.comingSoon ? 'default' : 'pointer',
                fontFamily: 'inherit', textAlign: 'left', width: '100%',
                border: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!item.comingSoon) {
                  e.currentTarget.style.background = P.pinkGlow;
                  e.currentTarget.style.color = P.pink;
                }
              }}
              onMouseLeave={(e) => {
                if (!item.comingSoon) {
                  e.currentTarget.style.background = isActive ? P.pinkGlow : 'transparent';
                  e.currentTarget.style.color = isActive ? P.pink : item.comingSoon ? P.textFaint : P.textMuted;
                }
              }}
            >
              <span style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                <Icon size={20} weight="fill" />
              </span>
              {item.label}
              {item.comingSoon && (
                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', background: P.pinkGlow, color: P.pink, borderRadius: '999px', padding: '2px 8px' }}>
                  presto
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: S.md, marginTop: S.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, padding: S.sm, borderRadius: R.md }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: P.pinkGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TEXT.base, fontWeight: '700', color: P.pink, flexShrink: 0 }}>
            {displayName?.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: TEXT.sm, fontWeight: '600', color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{displayName}</div>
            <div style={{ fontSize: TEXT.xs, color: P.textFaint }}>{isGuest ? 'Ospite' : 'Utente'}</div>
          </div>
          <button onClick={() => signOut()} title="Esci" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '4px' }}>
            <SignOut size={18} color={P.textMuted} />
          </button>
        </div>
      </div>
    </div>
  );
}