'use client';

import { C, FONT } from '@/styles/token';
import BottomNav from './bottomNav';

type Props = {
  children: React.ReactNode;
  activeNav: 'home' | 'stanze' | 'recensioni' | 'cinema' | 'profilo';
  hideNav?: boolean;
};

export default function AppShell({ children, activeNav, hideNav = false }: Props) {
  return (
    <>
      <style>{`
        .app-desktop-bg {
          min-height: 100vh;
          background: #F0F0F0;
          font-family: ${FONT.sans};
        }

        /* ── Mobile: colonna centrata ── */
        .app-inner {
          margin: 0 auto;
          background: #fff;
          min-height: 100vh;
          position: relative;
        }

        /* ── Desktop: sidebar + contenuto ── */
        @media (min-width: 1024px) {
          .app-desktop-bg {
            background: #F4F4F4;
          }
          .app-inner {
            max-width: 1200px;
            min-height: 100vh;
            display: grid;
            grid-template-columns: 240px 1fr;
            grid-template-rows: 1fr;
            background: transparent;
            gap: 0;
          }
          .app-sidebar {
            display: flex !important;
          }
          .app-bottom-nav {
            display: none !important;
          }
          .app-content {
            background: #fff;
            border-radius: 0;
            min-height: 100vh;
            overflow-y: auto;
          }
        }

        @media (max-width: 1023px) {
          .app-inner {
            max-width: 480px;
          }
          .app-sidebar {
            display: none !important;
          }
        }
      `}</style>

      <div className="app-desktop-bg">
        <div className="app-inner">

          {/* ── SIDEBAR DESKTOP ─────────────────────────────────────────── */}
          <SidebarDesktop activeNav={activeNav} />

          {/* ── CONTENUTO ───────────────────────────────────────────────── */}
          <div className="app-content">
            {children}
            {!hideNav && (
              <div className="app-bottom-nav">
                <BottomNav activeId={activeNav} />
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Sidebar solo desktop ─────────────────────────────────────────────────────
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { C as Colors, TEXT, S, R } from '@/styles/token';

type NavItem = {
  id: string;
  label: string;
  icon: string;
  path: string;
  comingSoon?: boolean;
};

const navItems: NavItem[] = [
  { id: 'home',        label: 'Home',        icon: '🏠', path: '/home' },
  { id: 'stanze',      label: 'Stanze',      icon: '🎬', path: '/home' },
  { id: 'recensioni',  label: 'Recensioni',  icon: '💬', path: '/recensioni', comingSoon: true },
  { id: 'cinema',      label: 'Cinema',      icon: '📍', path: '/cinema',     comingSoon: true },
  { id: 'profilo',     label: 'Profilo',     icon: '👤', path: '/profilo',    comingSoon: true },
];

function SidebarDesktop({ activeNav }: { activeNav: string }) {
  const router = useRouter();
  const { currentUser, isGuest, guestName, signOut } = useAuth();

  const displayName = currentUser && !currentUser.isGuest
    ? currentUser.username
    : guestName ?? 'Ospite';

  return (
    <div
      className="app-sidebar"
      style={{
        flexDirection: 'column',
        padding: `${S.xl} ${S.md}`,
        borderRight: `1px solid #EEEEEE`,
        background: '#fff',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div
        onClick={() => router.push('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: S.sm,
          marginBottom: S.xl, cursor: 'pointer', padding: `0 ${S.sm}`,
        }}
      >
        <span style={{ fontSize: '22px' }}>🎬</span>
        <span style={{ fontSize: TEXT.md, fontWeight: '800' }}>
          CINE<span style={{ color: Colors.primary }}>DATE</span>
        </span>
      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { if (!item.comingSoon) router.push(item.path); }}
              style={{
                display: 'flex', alignItems: 'center', gap: S.sm,
                padding: `12px ${S.sm}`,
                borderRadius: R.md,
                border: 'none',
                background: isActive ? Colors.primaryLight : 'transparent',
                color: isActive ? Colors.primary : item.comingSoon ? '#BBBBBB' : '#444',
                fontSize: TEXT.base,
                fontWeight: isActive ? '600' : '400',
                cursor: item.comingSoon ? 'default' : 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                width: '100%',
                transition: 'background .15s',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>
                {item.icon}
              </span>
              {item.label}
              {item.comingSoon && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '10px', fontWeight: '700',
                  background: Colors.primaryLight,
                  color: Colors.primary,
                  borderRadius: '999px',
                  padding: '2px 8px',
                }}>
                  presto
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Profilo utente in basso */}
      <div style={{
        borderTop: '1px solid #EEEEEE',
        paddingTop: S.md,
        marginTop: S.md,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: S.sm,
          padding: S.sm, borderRadius: R.md,
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: Colors.primaryLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: TEXT.base, fontWeight: '700', color: Colors.primary,
            flexShrink: 0,
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{
              fontSize: TEXT.sm, fontWeight: '600', color: '#1A1A1A',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              @{displayName}
            </div>
            <div style={{ fontSize: TEXT.xs, color: '#AAAAAA' }}>
              {isGuest ? 'Ospite' : 'Utente'}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Esci"
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '16px',
              opacity: 0.4, padding: '4px',
              transition: 'opacity .15s',
            }}
          >
            🚪
          </button>
        </div>
      </div>
    </div>
  );
}