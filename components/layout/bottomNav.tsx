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
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={active ? activeColor : 'none'}
        stroke={active ? activeColor : color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
  },
  {
    id: 'stanze',
    label: 'Stanze',
    path: '/crea-stanza',
    icon: (active, color, activeColor) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? activeColor : color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'recensioni',
    label: 'Recensioni',
    path: '/recensioni',
    icon: (active, color, activeColor) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? activeColor : color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    id: 'cinema',
    label: 'Cinema',
    path: '/cinema',
    icon: (active, color, activeColor) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? activeColor : color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
    ),
  },
  {
    id: 'libreria',
    label: 'Libreria',
    path: '/libreria',
    icon: (active, color, activeColor) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? activeColor : color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
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
          gap: 3px;
          flex: 1;
          padding: 8px 4px;
          cursor: pointer;
          border: none;
          background: none;
          font-family: ${FONT.sans};
          position: relative;
          transition: opacity 0.15s ease, color 0.15s;
          -webkit-tap-highlight-color: transparent;
        }

        .nav-item:active {
          opacity: 0.7;
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
                  fontSize: TEXT.xs,
                  fontWeight: isActive ? '600' : '400',
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
                    bottom: '6px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
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