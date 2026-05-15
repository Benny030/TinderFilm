'use client';

import { C, FONT } from '@/styles/token';
import BottomNav from  './bottomNav';

type Props = {
  children: React.ReactNode;
  activeNav: 'home' | 'stanze' | 'recensioni' | 'cinema' | 'profilo';
  // ─── opzionale: nasconde bottom nav (es. durante swipe fullscreen) ────────
  hideNav?: boolean;
};

export default function AppShell({ children, activeNav, hideNav = false }: Props) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F8F8',
      fontFamily: FONT.sans,
      color: '#1A1A1A',
      // ─── max width su desktop: simula schermo mobile centrato ─────────────
      maxWidth: '480px',
      margin: '0 auto',
      position: 'relative', 
    }}>
      {children}
      {!hideNav && <BottomNav activeId={activeNav} />}
    </div>
  );
}