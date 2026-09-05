'use client';

import { useRouter } from 'next/router';
import { useTheme } from '@/context/ThemeContext';
import { FONT, BOTTOM_NAV_HEIGHT, THEME, MOTION, R, SHADOW } from '@/styles/token';
import { House, MagnifyingGlass, FilmSlate, ChatCircle, MapPin } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

type NavItem = {
  id: string;
  label: string;
  icon: Icon;
  path: string;
  comingSoon?: boolean;
};

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', path: '/home', icon: House },
  { id: 'esplora', label: 'Esplora', path: '/esplora', icon: MagnifyingGlass },
  { id: 'stanze', label: 'Stanze', path: '/crea-stanza', icon: FilmSlate },
  { id: 'recensioni', label: 'Community', path: '/recensioni', icon: ChatCircle },
  { id: 'cinema', label: 'Cinema', path: '/cinema', icon: MapPin },
];

type Props = {
  activeId: string;
};

export default function BottomNav({ activeId }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? THEME.dark : THEME.light;
  const router = useRouter();

  return (
    <>
      <style>{`
        .cinedate-bottom-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex: 1;
          padding: 7px 2px 10px;
          cursor: pointer;
          border: none;
          background: transparent;
          font-family: ${FONT.sans};
          position: relative;
          transition: transform ${MOTION.fast}, opacity ${MOTION.fast}, color ${MOTION.fast};
          -webkit-tap-highlight-color: transparent;
        }
        .cinedate-bottom-nav-item:active {
          opacity: .78;
          transform: translateY(1px);
        }
        .cinedate-bottom-nav-item.disabled {
          cursor: default;
          opacity: .4;
        }
        .cinedate-bottom-nav-item:not(.disabled):hover { color: ${P.accent}; }
      `}</style>

      <div style={{ height: BOTTOM_NAV_HEIGHT }} />

      <nav
        aria-label="Navigazione principale"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: BOTTOM_NAV_HEIGHT,
          background: isDark ? 'rgba(28,22,19,.96)' : 'rgba(255,255,255,.96)',
          borderTop: `1px solid ${P.border}`,
          display: 'flex',
          alignItems: 'stretch',
          boxShadow: isDark ? '0 -8px 28px rgba(0,0,0,.28)' : SHADOW.sm,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {navItems.map((item) => {
          const isActive = activeId === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              className={`cinedate-bottom-nav-item${item.comingSoon ? ' disabled' : ''}`}
              onClick={() => { if (!item.comingSoon) router.push(item.path); }}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.comingSoon && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 'calc(50% - 18px)',
                    background: P.primary,
                    color: '#fff',
                    fontSize: 8,
                    fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: R.full,
                  }}
                >
                  presto
                </span>
              )}

              <Icon
                size={22}
                weight={isActive ? 'fill' : 'regular'}
                color={isActive ? P.primary : P.textFaint}
              />

              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 800 : 500,
                  color: isActive ? P.primary : P.textFaint,
                  lineHeight: 1,
                }}
              >
                {item.label}
              </span>

              {isActive && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    width: 16,
                    height: 3,
                    borderRadius: R.full,
                    background: P.primary,
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
