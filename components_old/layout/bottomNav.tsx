'use client';

import { useRouter } from 'next/router';
import { useTheme } from '@/context/ThemeContext';
import { FONT, TEXT, BOTTOM_NAV_HEIGHT } from '@/styles/token';

// Palette dark
const D = {
  bg: '#0a0908',
  border: '#2a1c22',
  pink: '#ed3d73',
  gold: '#f5b92f',
  faint: '#8a7f82',
  text: '#ffffff',
};

// Palette light
const L = {
  bg: '#faf7f2',
  border: '#ddd5c8',
  pink: '#c72c5c',
  gold: '#c69214',
  faint: '#8a8278',
  text: '#1f1b18',
};

type NavItem = {
  id: string;
  label: string;
  icon: (
    active: boolean,
    color: string,
    activeColor: string
  ) => React.ReactNode;
  path: string;
  comingSoon?: boolean;
};

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/home',
    icon: (active, color, activeColor) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? activeColor : 'none'} stroke={active ? activeColor : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
  },
  {
    id: 'esplora',
    label: 'Esplora',
    path: '/esplora',
    icon: (active, color, activeColor) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? activeColor : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
  {
    id: 'stanze',
    label: 'Stanze',
    path: '/crea-stanza',
    icon: (active, color, activeColor) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? activeColor : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 2v4M16 2v4M3 9h18" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'recensioni',
    label: 'Community',
    path: '/recensioni',
    icon: (active, color, activeColor) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? activeColor : 'none'} stroke={active ? activeColor : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
  {
    id: 'cinema',
    label: 'Cinema',
    path: '/cinema',
    icon: (active, color, activeColor) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? activeColor : 'none'} stroke={active ? activeColor : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s7-4.35 7-12a7 7 0 10-14 0c0 7.65 7 12 7 12z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
];

type Props = {
  activeId: string;
};

export default function BottomNav({ activeId }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const router = useRouter();

  const bg = isDark ? D.bg : '#ffffff';
  const border = isDark ? D.border : L.border;
  const faint = isDark ? D.faint : L.faint;
  const active = isDark ? D.pink : L.pink;
  const gold = isDark ? D.gold : L.gold;

  return (
    <>
      <style>{`
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex: 1;
          padding: 7px 2px 10px;
          cursor: pointer;
          border: none;
          background: none;
          font-family: ${FONT.sans};
          position: relative;
          transition: transform 0.15s ease, opacity 0.15s ease, color 0.15s;
          -webkit-tap-highlight-color: transparent;
        }

        .nav-item:active {
          opacity: 0.78;
          transform: translateY(1px);
        }

        .nav-item.disabled {
          cursor: default;
          opacity: 0.4;
        }

        .nav-item:not(.disabled):hover {
          color: ${gold};
        }

        .nav-item:not(.disabled):hover svg {
          stroke: ${gold} !important;
          fill: ${gold} !important;
        }

        .coming-soon-badge {
          position: absolute;
          top: 4px;
          right: calc(50% - 18px);
          background: ${active};
          color: white;
          font-size: 8px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 999px;
          line-height: 1.4;
          letter-spacing: 0.3px;
        }
      `}</style>

      <div style={{ height: BOTTOM_NAV_HEIGHT }} />

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: BOTTOM_NAV_HEIGHT,
          background: bg,
          borderTop: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'stretch',
          boxShadow: isDark
            ? '0 -2px 20px rgba(0,0,0,.4)'
            : '0 -2px 16px rgba(0,0,0,0.04)',
          zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {navItems.map((item) => {
          const isActive = activeId === item.id;

          return (
            <button
              key={item.id}
              className={`nav-item${item.comingSoon ? ' disabled' : ''}`}
              onClick={() => {
                if (!item.comingSoon) {
                  router.push(item.path);
                }
              }}
            >
              {item.comingSoon && (
                <span className="coming-soon-badge">
                  presto
                </span>
              )}

              {item.icon(isActive, faint, active)}

              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? '800' : '500',
                  color: isActive ? active : faint,
                  lineHeight: 1,
                }}
              >
                {item.label}
              </span>

              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '4px',
                    width: '16px',
                    height: '3px',
                    borderRadius: '999px',
                    background: active,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}