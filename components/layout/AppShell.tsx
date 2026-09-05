'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from './bottomNav';
import AppFooter from './AppFooter';
import { useTheme } from '@/context/ThemeContext';
import GlobalSearchBox from '@/components/search/globalSearchBox';
import { FONT, TEXT, S, THEME, MOTION } from '@/styles/token';
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
  activeNav:
    | 'home'
    | 'esplora'
    | 'per-te'
    | 'persone'
    | 'stanze'
    | 'recensioni'
    | 'cinema'
    | 'libreria'
    | 'profilo';
  hideNav?: boolean;
};

type NavItem = {
  id: string;
  label: string;
  icon: Icon;
  path: string;
  group: 'scopri' | 'social' | 'personale';
  comingSoon?: boolean;
};

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: House,
    path: '/home',
    group: 'scopri',
  },
  {
    id: 'esplora',
    label: 'Esplora',
    icon: MagnifyingGlass,
    path: '/esplora',
    group: 'scopri',
  },
  {
    id: 'per-te',
    label: 'Per te',
    icon: Sparkle,
    path: '/per-te',
    group: 'scopri',
  },
  {
    id: 'persone',
    label: 'Persone',
    icon: UsersThree,
    path: '/persone',
    group: 'social',
  },
  {
    id: 'recensioni',
    label: 'Community',
    icon: ChatCircle,
    path: '/recensioni',
    group: 'social',
  },
  {
    id: 'stanze',
    label: 'Stanze',
    icon: FilmSlate,
    path: '/crea-stanza',
    group: 'social',
  },
  {
    id: 'cinema',
    label: 'Cinema',
    icon: MapPin,
    path: '/cinema',
    group: 'scopri',
  },
  {
    id: 'libreria',
    label: 'Libreria',
    icon: Books,
    path: '/libreria',
    group: 'personale',
  },
  {
    id: 'profilo',
    label: 'Profilo',
    icon: User,
    path: '/profilo',
    group: 'personale',
  },
];

const groups: {
  id: NavItem['group'];
  label: string;
}[] = [
  { id: 'scopri', label: 'Scopri' },
  { id: 'social', label: 'Insieme' },
  { id: 'personale', label: 'Tu' },
];

function useShellTheme() {
  const { theme } = useTheme();

  return {
    isDark: theme === 'dark',
    P: theme === 'dark' ? THEME.dark : THEME.light,
  };
}

export default function AppShell({
  children,
  activeNav,
  hideNav = false,
}: Props) {
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

        .app-mobile-topbar {
          display: none;
        }

        .app-sidebar {
          scrollbar-width: thin;
          scrollbar-color: ${P.border} transparent;
        }

        .app-sidebar::-webkit-scrollbar {
          width: 5px;
        }

        .app-sidebar::-webkit-scrollbar-thumb {
          background: ${P.border};
        }

        @media (max-width: 1023px) {
          .app-inner {
            max-width: 480px;
          }

          .app-sidebar {
            display: none !important;
          }

          .app-mobile-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 13px 16px;
            border-bottom: 1px solid ${P.border};
            position: sticky;
            top: 0;
            z-index: 40;
            background: ${
              isDark
                ? 'rgba(10,8,6,.94)'
                : 'rgba(255,255,255,.94)'
            };
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
          }
        }

        @media (min-width: 1024px) {
          .app-inner {
            max-width: 1900px;
            min-height: 100vh;
            display: grid;
            grid-template-columns: 248px minmax(0, 1fr);
            gap: 0;
            background: transparent;
          }

          .app-sidebar {
            display: flex !important;
          }

          .app-bottom-nav {
            display: none !important;
          }

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

        .app-drawer-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }

        .app-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 278px;
          background: ${P.surface};
          border-right: 1px solid ${P.border};
          z-index: 91;
          transform: translateX(-100%);
          transition: transform ${MOTION.base};
          display: flex;
          flex-direction: column;
          padding: 18px 14px;
        }

        .app-drawer.open {
          transform: translateX(0);
        }

        .cdr-shell-nav-button {
          position: relative;
        }

        .cdr-shell-nav-button::before {
          content: '';
          position: absolute;
          left: 0;
          top: 7px;
          bottom: 7px;
          width: 2px;
          background: transparent;
          transition: background ${MOTION.fast};
        }

        .cdr-shell-nav-button[data-active='true']::before {
          background: ${P.primary};
        }
      `}</style>

      <div className="app-desktop-bg">
        <div className="app-inner">
          <SidebarDesktop activeNav={activeNav} />

          <div className="app-content">
            <div className="app-mobile-topbar">
              <BrandMark
                color={P.text}
                accent={P.primary}
                compact
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <ShellIconButton
                  label="Cerca film, attori o registi"
                  onClick={() =>
                    void router.push('/esplora')
                  }
                  border={P.border}
                  background={P.surface}
                >
                  <MagnifyingGlass
                    size={18}
                    color={P.accent}
                    weight="bold"
                  />
                </ShellIconButton>

                <ShellIconButton
                  label="Apri menu"
                  onClick={() =>
                    setDrawerOpen(true)
                  }
                  border={P.border}
                  background={P.surface}
                >
                  <List
                    size={18}
                    color={P.text}
                    weight="bold"
                  />
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
        className={`app-drawer-overlay${
          drawerOpen ? ' open' : ''
        }`}
        onClick={() =>
          setDrawerOpen(false)
        }
      />

      <MobileDrawer
        open={drawerOpen}
        onClose={() =>
          setDrawerOpen(false)
        }
        activeNav={activeNav}
      />
    </>
  );
}

function BrandMark({
  color,
  accent,
  compact = false,
}: {
  color: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          fontFamily: FONT.display,
          fontSize: compact ? 19 : 24,
          fontWeight: 800,
          color,
          letterSpacing: '-.025em',
        }}
      >
        CINE
        <span style={{ color: accent }}>
          DATE
        </span>
      </span>

      {!compact && (
        <span
          style={{
            marginTop: 5,
            color: accent,
            fontFamily: FONT.sans,
            fontSize: 8,
            fontWeight: 850,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
          }}
        >
          guarda · scegli · insieme
        </span>
      )}
    </div>
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
  const isActive =
    activeNav === item.id;
  const Icon = item.icon;

  return (
    <button
      className="cdr-shell-nav-button"
      data-active={
        isActive ? 'true' : 'false'
      }
      type="button"
      onClick={() => {
        if (!item.comingSoon) {
          onNavigate(item.path);
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns:
          '26px minmax(0,1fr) auto',
        alignItems: 'center',
        gap: 10,
        minHeight: 42,
        padding: '9px 10px 9px 13px',
        background: isActive
          ? P.primaryGlow
          : 'transparent',
        color: isActive
          ? P.primary
          : item.comingSoon
          ? P.textFaint
          : P.textMuted,
        fontSize: 13,
        fontWeight: isActive
          ? 800
          : 600,
        cursor: item.comingSoon
          ? 'default'
          : 'pointer',
        fontFamily: FONT.sans,
        textAlign: 'left',
        width: '100%',
        border: 'none',
        transition: `background ${MOTION.fast}, color ${MOTION.fast}`,
      }}
      onMouseEnter={(event) => {
        if (
          !item.comingSoon &&
          !isActive
        ) {
          event.currentTarget.style.background =
            P.surfaceHover;
          event.currentTarget.style.color =
            P.text;
        }
      }}
      onMouseLeave={(event) => {
        if (!item.comingSoon) {
          event.currentTarget.style.background =
            isActive
              ? P.primaryGlow
              : 'transparent';

          event.currentTarget.style.color =
            isActive
              ? P.primary
              : P.textMuted;
        }
      }}
    >
      <span
        style={{
          width: 26,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Icon
          size={19}
          weight={
            isActive
              ? 'fill'
              : 'regular'
          }
        />
      </span>

      <span>{item.label}</span>

      {item.comingSoon && (
        <span
          style={{
            color: P.textFaint,
            fontSize: 8,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '.06em',
          }}
        >
          presto
        </span>
      )}
    </button>
  );
}

function NavGroup({
  label,
  items,
  activeNav,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  activeNav: string;
  onNavigate: (path: string) => void;
}) {
  const { P } = useShellTheme();

  return (
    <section>
      <div
        style={{
          margin: '0 11px 7px',
          color: P.textFaint,
          fontSize: 8.5,
          fontWeight: 900,
          letterSpacing: '.13em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 2,
        }}
      >
        {items.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            activeNav={activeNav}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

function UserSummary({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { P } = useShellTheme();
  const {
    currentUser,
    isGuest,
    guestName,
    signOut,
  } = useAuth();

  const router = useRouter();

  const displayName =
    currentUser &&
    !currentUser.isGuest
      ? currentUser.username
      : guestName ?? 'Ospite';

  return (
    <div
      style={{
        borderTop: `1px solid ${P.border}`,
        paddingTop: compact
          ? 13
          : 14,
        marginTop: compact
          ? 14
          : 16,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            '36px minmax(0,1fr) 30px',
          alignItems: 'center',
          gap: 9,
          padding: compact
            ? '4px 2px 0'
            : '7px 6px 0',
        }}
      >
        <button
          type="button"
          onClick={() =>
            void router.push(
              isGuest
                ? '/auth'
                : '/profilo'
            )
          }
          aria-label={
            isGuest
              ? 'Accedi'
              : 'Apri profilo'
          }
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: `1px solid ${P.border}`,
            background: P.primaryGlow,
            display: 'grid',
            placeItems: 'center',
            color: P.primary,
            fontSize: 13,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {displayName
            ?.charAt(0)
            .toUpperCase()}
        </button>

        <button
          type="button"
          onClick={() =>
            void router.push(
              isGuest
                ? '/auth'
                : '/profilo'
            )
          }
          style={{
            minWidth: 0,
            border: 0,
            background: 'transparent',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: FONT.sans,
          }}
        >
          <span
            style={{
              display: 'block',
              color: P.text,
              fontSize: 11.5,
              fontWeight: 800,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            @{displayName}
          </span>

          <span
            style={{
              display: 'block',
              marginTop: 2,
              color: P.textFaint,
              fontSize: 8.5,
              fontWeight: 600,
            }}
          >
            {isGuest
              ? 'Ospite'
              : 'Profilo Cinedate'}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            void signOut()
          }
          title="Esci"
          aria-label="Esci"
          style={{
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            color: P.textFaint,
            padding: 0,
          }}
        >
          <SignOut
            size={16}
            weight="bold"
          />
        </button>
      </div>
    </div>
  );
}

function MobileDrawer({
  open,
  onClose,
  activeNav,
}: {
  open: boolean;
  onClose: () => void;
  activeNav: string;
}) {
  const { P } = useShellTheme();
  const router = useRouter();

  return (
    <div
      className={`app-drawer${
        open ? ' open' : ''
      }`}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            'space-between',
          paddingBottom: 15,
          marginBottom: 14,
          borderBottom: `1px solid ${P.border}`,
        }}
      >
        <BrandMark
          color={P.text}
          accent={P.primary}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi menu"
          style={{
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            background:
              'transparent',
            border: 0,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <X
            size={19}
            color={P.textMuted}
          />
        </button>
      </div>

      <div
        style={{
          marginBottom: 18,
        }}
      >
        <GlobalSearchBox variant="compact" />
      </div>

      <nav
        style={{
          display: 'grid',
          gap: 20,
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {groups.map((group) => (
          <NavGroup
            key={group.id}
            label={group.label}
            items={navItems.filter(
              (item) =>
                item.group ===
                group.id
            )}
            activeNav={activeNav}
            onNavigate={(path) => {
              void router.push(path);
              onClose();
            }}
          />
        ))}
      </nav>

      <UserSummary compact />
    </div>
  );
}

function SidebarDesktop({
  activeNav,
}: {
  activeNav: string;
}) {
  const { P } = useShellTheme();
  const router = useRouter();

  return (
    <aside
      className="app-sidebar"
      style={{
        flexDirection: 'column',
        borderRight: `1px solid ${P.border}`,
        background: P.bg,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '26px 18px 20px',
          borderBottom: `1px solid ${P.border}`,
        }}
      >
        <button
          type="button"
          onClick={() =>
            void router.push('/home')
          }
          aria-label="Vai alla Home"
          style={{
            display: 'block',
            width: '100%',
            cursor: 'pointer',
            padding: 0,
            background: 'transparent',
            border: 'none',
            textAlign: 'left',
          }}
        >
          <BrandMark
            color={P.text}
            accent={P.primary}
          />
        </button>
      </div>

      <div
        style={{
          padding: '16px 14px 8px',
        }}
      >
        <GlobalSearchBox variant="compact" />
      </div>

      <nav
        style={{
          display: 'grid',
          gap: 20,
          flex: 1,
          padding: '10px 12px 14px',
        }}
      >
        {groups.map((group) => (
          <NavGroup
            key={group.id}
            label={group.label}
            items={navItems.filter(
              (item) =>
                item.group ===
                group.id
            )}
            activeNav={activeNav}
            onNavigate={(path) =>
              void router.push(path)
            }
          />
        ))}
      </nav>

      <div
        style={{
          padding: '0 12px 18px',
        }}
      >
        <UserSummary />
      </div>
    </aside>
  );
}
