'use client';

import { useRouter } from 'next/router';
import { C, FONT, TEXT, SHADOW, BOTTOM_NAV_HEIGHT } from '@/styles/token';

type NavItem = {
  id: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  path: string;
  comingSoon?: boolean;
};

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/home',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? C.primary : 'none'} stroke={active ? C.primary : C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    ),
  },
  {
    id: 'stanze',
    label: 'Stanze',
    path: '/home',   // per ora punta a home, poi avrà pagina dedicata
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    id: 'recensioni',
    label: 'Recensioni',
    path: '/recensioni',
    comingSoon: true,
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    id: 'cinema',
    label: 'Cinema',
    path: '/cinema',
    comingSoon: true,
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
        <line x1="7" y1="2" x2="7" y2="22"/>
        <line x1="17" y1="2" x2="17" y2="22"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <line x1="2" y1="7" x2="7" y2="7"/>
        <line x1="2" y1="17" x2="7" y2="17"/>
        <line x1="17" y1="17" x2="22" y2="17"/>
        <line x1="17" y1="7" x2="22" y2="7"/>
      </svg>
    ),
  },
  {
    id: 'profilo',
    label: 'Profilo',
    path: '/profilo',
    comingSoon: true,
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? C.primary : 'none'} stroke={active ? C.primary : C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

type Props = {
  activeId: string;
};

export default function BottomNav({ activeId }: Props) {
  const router = useRouter();

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
          transition: opacity 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .nav-item:active { opacity: 0.7; }
        .nav-item.disabled { cursor: default; opacity: 0.4; }
        .coming-soon-badge {
          position: absolute;
          top: 4px;
          right: calc(50% - 18px);
          background: ${C.primary};
          color: white;
          font-size: 8px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 999px;
          line-height: 1.4;
          letter-spacing: 0.3px;
        }
      `}</style>

      {/* ─── Spacer per non coprire contenuto ────────────────────────────── */}
      <div style={{ height: BOTTOM_NAV_HEIGHT }} />

      {/* ─── Bar fissa in basso ───────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: BOTTOM_NAV_HEIGHT,
        background: C.bg,
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'stretch',
        boxShadow: `0 -2px 16px rgba(0,0,0,0.06)`,
        zIndex: 100,
        // ─── Safe area iPhone ─────────────────────────────────────────────
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {navItems.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item${item.comingSoon ? ' disabled' : ''}`}
              onClick={() => {
                if (item.comingSoon) return;
                router.push(item.path);
              }}
            >
              {/* Badge coming soon */}
              {item.comingSoon && (
                <span className="coming-soon-badge">presto</span>
              )}

              {/* Icona */}
              {item.icon(isActive)}

              {/* Label */}
              <span style={{
                fontSize: TEXT.xs,
                fontWeight: isActive ? '600' : '400',
                color: isActive ? C.primary : C.faint,
                lineHeight: 1,
              }}>
                {item.label}
              </span>

              {/* Dot attivo */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: '6px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: C.primary,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}