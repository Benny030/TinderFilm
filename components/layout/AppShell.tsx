'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from './bottomNav';
import AppFooter from './AppFooter';
import { useTheme } from '@/context/ThemeContext';
import GlobalSearchBox from '@/components/search/globalSearchBox';
import { FONT, TEXT, S, R, THEME, MOTION } from '@/styles/token';
import type { Icon } from '@phosphor-icons/react';
import {
  House,
  FilmSlate,
  ChatCircle,
  MapPin,
  User,
  SignOut,
  List,
  X,
  Sparkle,
  UsersThree,
  Books,
  MagnifyingGlass,
} from '@phosphor-icons/react';

type Props = {
  children: React.ReactNode;
  activeNav: 'home' | 'esplora' | 'per-te' | 'persone' | 'stanze' | 'recensioni' | 'cinema' | 'libreria' | 'profilo';
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
  { id: 'home', label: 'Home', icon: House, path: '/home' },
  { id: 'esplora', label: 'Esplora', icon: MagnifyingGlass, path: '/esplora' },
  { id: 'per-te', label: 'Per te', icon: Sparkle, path: '/per-te' },
  { id: 'persone', label: 'Persone', icon: UsersThree, path: '/persone' },
  { id: 'recensioni', label: 'Community', icon: ChatCircle, path: '/recensioni' },
  { id: 'stanze', label: 'Stanze', icon: FilmSlate, path: '/crea-stanza' },
  { id: 'cinema', label: 'Cinema', icon: MapPin, path: '/cinema' },
  { id: 'libreria', label: 'Libreria', icon: Books, path: '/libreria' },
  { id: 'profilo', label: 'Profilo', icon: User, path: '/profilo' },
];

function useShellTheme() {
  const { theme } = useTheme();
  return {
    isDark: theme === 'dark',
    P: theme === 'dark' ? THEME.dark : THEME.light,
  };
}

export default function AppShell({ children, activeNav, hideNav = false }: Props) {
  const router = useRouter();
  const { isDark, P } = useShellTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        .app-desktop-bg {
          min-height: 100vh;
          background: ${P.bgSoft};
          font-family: ${FONT.sans};
          letter-spacing: -0.01em;
          color: ${P.text};
        }

        .app-inner {
          margin: 0 auto;
          background: ${P.surface};
          min-height: 100vh;
          position: relative;
        }

        .app-content {
          min-width: 0;
          background: ${P.surface};
        }

        .app-mobile-topbar { display: none; }

        @media (max-width: 1023px) {
          .app-inner { max-width: 480px; }
          .app-sidebar { display: none !important; }
          .app-mobile-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            border-bottom: 1px solid ${P.border};
            position: sticky;
            top: 0;
            z-index: 40;
            background: ${isDark ? 'rgba(10,8,6,.92)' : 'rgba(255,255,255,.92)'};
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
          }
        }

        @media (min-width: 1024px) {
          .app-inner {
            max-width: 1900px;
            min-height: 100vh;
            display: grid;
            grid-template-columns: 240px minmax(0, 1fr);
            gap: 0;
            background: transparent;
          }
          .app-sidebar { display: flex !important; }
          .app-bottom-nav { display: none !important; }
          .app-content {
            background: ${P.surface};
            min-height: 100vh;
            overflow-y: auto;
          }
        }

        .app-drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.6);
          z-index: 90;
          opacity: 0;
          pointer-events: none;
          transition: opacity ${MOTION.base};
        }
        .app-drawer-overlay.open { opacity: 1; pointer-events: auto; }

        .app-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 264px;
          background: ${P.surface};
          border-right: 1px solid ${P.border};
          z-index: 91;
          transform: translateX(-100%);
          transition: transform ${MOTION.base};
          display: flex;
          flex-direction: column;
          padding: 20px 16px;
        }
        .app-drawer.open { transform: translateX(0); }
      `}</style>

      <div className="app-desktop-bg">
        <div className="app-inner">
          <SidebarDesktop activeNav={activeNav} />

          <div className="app-content">
            <div className="app-mobile-topbar">
              <BrandMark color={P.text} accent={P.primary} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShellIconButton
                  label="Cerca film, attori o registi"
                  onClick={() => router.push('/esplora')}
                  border={P.border}
                  background={P.surface}
                >
                  <MagnifyingGlass size={18} color={P.accent} weight="bold" />
                </ShellIconButton>
                <ShellIconButton
                  label="Apri menu"
                  onClick={() => setDrawerOpen(true)}
                  border={P.border}
                  background={P.surface}
                >
                  <List size={18} color={P.text} weight="bold" />
                </ShellIconButton>
              </div>
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

      <div
        className={`app-drawer-overlay${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} activeNav={activeNav} />
    </>
  );
}

function BrandMark({ color, accent }: { color: string; accent: string }) {
  return (
    <span style={{ fontSize: TEXT.md, fontWeight: 800, color, letterSpacing: '.3px' }}>
      CINE<span style={{ color: accent }}>DATE</span>
    </span>
  );
}

function ShellIconButton({
  label,
  onClick,
  border,
  background,
  children,
}: {
  label: string;
  onClick: () => void;
  border: string;
  background: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: R.md,
        background,
        border: `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: `transform ${MOTION.fast}, background ${MOTION.fast}`,
      }}
    >
      {children}
    </button>
  );
}

function NavButton({
  item,
  activeNav,
  onNavigate,
}: {
  item: NavItem;
  activeNav: string;
  onNavigate: (path: string) => void;
}) {
  const { P } = useShellTheme();
  const isActive = activeNav === item.id;
  const Icon = item.icon;

  return (
    <button
      key={item.id}
      onClick={() => { if (!item.comingSoon) onNavigate(item.path); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 12px',
        marginTop: item.id === 'cinema' ? 10 : undefined,
        borderRadius: R.md,
        background: isActive ? P.primaryGlow : 'transparent',
        color: isActive ? P.primary : item.comingSoon ? P.textFaint : P.textMuted,
        fontSize: TEXT.base,
        fontWeight: isActive ? 700 : 500,
        cursor: item.comingSoon ? 'default' : 'pointer',
        fontFamily: FONT.sans,
        textAlign: 'left',
        width: '100%',
        border: 'none',
        transition: `background ${MOTION.fast}, color ${MOTION.fast}`,
      }}
      onMouseEnter={(e) => {
        if (!item.comingSoon) {
          e.currentTarget.style.background = P.primaryGlow;
          e.currentTarget.style.color = P.primary;
        }
      }}
      onMouseLeave={(e) => {
        if (!item.comingSoon) {
          e.currentTarget.style.background = isActive ? P.primaryGlow : 'transparent';
          e.currentTarget.style.color = isActive ? P.primary : P.textMuted;
        }
      }}
    >
      <span style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
        <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
      </span>
      {item.label}
      {item.comingSoon && (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 700,
            background: P.primaryGlow,
            color: P.primary,
            borderRadius: R.full,
            padding: '2px 8px',
          }}
        >
          presto
        </span>
      )}
    </button>
  );
}

function UserSummary({ compact = false }: { compact?: boolean }) {
  const { P } = useShellTheme();
  const { currentUser, isGuest, guestName, signOut } = useAuth();
  const displayName = currentUser && !currentUser.isGuest ? currentUser.username : guestName ?? 'Ospite';

  return (
    <div
      style={{
        borderTop: `1px solid ${P.border}`,
        paddingTop: compact ? 14 : S.md,
        marginTop: compact ? 14 : S.md,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: compact ? 34 : 36,
          height: compact ? 34 : 36,
          borderRadius: '50%',
          background: P.primaryGlow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: TEXT.base,
          fontWeight: 700,
          color: P.primary,
          flexShrink: 0,
        }}
      >
        {displayName?.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: TEXT.sm,
            fontWeight: 600,
            color: P.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          @{displayName}
        </div>
        <div style={{ fontSize: TEXT.xs, color: P.textFaint }}>{isGuest ? 'Ospite' : 'Utente'}</div>
      </div>
      <button
        type="button"
        onClick={() => signOut()}
        title="Esci"
        aria-label="Esci"
        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.65, padding: 4 }}
      >
        <SignOut size={18} color={P.textMuted} />
      </button>
    </div>
  );
}

function MobileDrawer({ open, onClose, activeNav }: { open: boolean; onClose: () => void; activeNav: string }) {
  const { P } = useShellTheme();
  const router = useRouter();

  return (
    <div className={`app-drawer${open ? ' open' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.lg }}>
        <BrandMark color={P.text} accent={P.primary} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi menu"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <X size={20} color={P.textMuted} />
        </button>
      </div>

      <div style={{ margin: `0 0 ${S.md}` }}>
        <GlobalSearchBox variant="compact" />
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {navItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            activeNav={activeNav}
            onNavigate={(path) => {
              router.push(path);
              onClose();
            }}
          />
        ))}
      </nav>

      <UserSummary compact />
    </div>
  );
}

function SidebarDesktop({ activeNav }: { activeNav: string }) {
  const { P } = useShellTheme();
  const router = useRouter();

  return (
    <aside
      className="app-sidebar"
      style={{
        flexDirection: 'column',
        padding: `${S.xl} ${S.md}`,
        borderRight: `1px solid ${P.border}`,
        background: P.bg,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <button
        type="button"
        onClick={() => router.push('/home')}
        aria-label="Vai alla Home"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: S.sm,
          marginBottom: S.xl,
          cursor: 'pointer',
          padding: `0 ${S.sm}`,
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
        }}
      >
        <BrandMark color={P.text} accent={P.primary} />
      </button>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {navItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            activeNav={activeNav}
            onNavigate={(path) => router.push(path)}
          />
        ))}
      </nav>

      <UserSummary />
    </aside>
  );
}
