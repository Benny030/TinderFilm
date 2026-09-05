

import { type CSSProperties, type FormEvent, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '@/context/ThemeContext';
import { FilmSlate, Users, Door, Copy, Share, Check, ArrowLeft, Lock, LockOpen, X } from '@phosphor-icons/react';
import type { RoomUser } from '@/types';

// ─── Palette dark "cinema elegante" ──────────────────────────────────────
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
  codeBg: '#090706',
  badgeBg: '#1f1812',
  badgeBorder: '#3a2d26',
};

// ─── Palette light "cinema elegante" ──────────────────────────────────────
const L = {
  bg: '#f5efe8',
  bgSoft: '#faf6f0',
  card: '#ffffff',
  cardHover: '#f8f2ea',
  border: '#d6cbbc',
  gold: '#b8860b',
  goldSoft: '#e9c55a',
  goldGlow: 'rgba(184,134,11,0.10)',
  pink: '#b83060',
  pinkDeep: '#7d1f43',
  pinkGlow: 'rgba(184,48,96,0.12)',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
  codeBg: '#efe7dd',
  badgeBg: '#f4e6d8',
  badgeBorder: '#e3cbb5',
};

const FONT_SANS = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";
const FONT_MONO = "'JetBrains Mono','Courier New',monospace";

const convertHexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean;

  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `${r}, ${g}, ${b}`;
};

type Props = {
  roomId: string;
  roomUsers: RoomUser[];
  currentUserId: string;
  currentUserName: string;
  isRoomFull: boolean;
  minMembers: number;
  maxMembers: number;
  hostActorId: string | null;
  roomPhase: 'waiting' | 'voting' | 'matched' | 'planning' | 'finished' | 'expired';
  isRoomLocked: boolean;
  hostActionBusy: boolean;
  hostActionError: string;
  membershipStatus: 'pending' | 'active';
  pendingRequests: RoomUser[];
  onToggleLock: () => void;
  onRemoveParticipant: (actorId: string) => void;
  onApproveParticipant: (actorId: string) => void;
  onRejectParticipant: (actorId: string) => void;
  onFinishRoom: () => void;
  codeInput: string;
  setCodeInput: (v: string) => void;
  codeError: string;
  onJoinByCode: (e: FormEvent<HTMLFormElement>) => void;
  onEnter: () => void;
  onAddFilms: () => void;
};

export default function WelcomeRoom({
  roomId,
  roomUsers,
  currentUserId,
  currentUserName,
  isRoomFull,
  minMembers,
  maxMembers,
  hostActorId,
  roomPhase,
  isRoomLocked,
  hostActionBusy,
  hostActionError,
  membershipStatus,
  pendingRequests,
  onToggleLock,
  onRemoveParticipant,
  onApproveParticipant,
  onRejectParticipant,
  onFinishRoom,
  codeInput,
  setCodeInput,
  codeError,
  onJoinByCode,
  onEnter,
}: Props) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeValid = codeInput.trim().length >= 4;
  const participantCount = roomUsers.length;
  const availableSpots = Math.max(0, maxMembers - participantCount);
  const isGroup = maxMembers > 2;
  const isGroupReady = participantCount >= minMembers;
  const isHost = currentUserId === hostActorId;
  const sessionStarted = roomPhase === 'voting' || roomPhase === 'matched' || roomPhase === 'planning';
  const isPending = membershipStatus === 'pending';
  const isFinished = roomPhase === 'finished';
  const isExpired = roomPhase === 'expired';

  const userRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevUserIds = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ============================================================
  // FUNZIONE DI DIGITAZIONE DEL NOME
  // ============================================================
  const typeName = (nameEl: HTMLElement, originalText: string) => {
    if (nameEl.dataset.typing === 'true') return;

    nameEl.dataset.typing = 'true';
    nameEl.textContent = '';
    nameEl.style.overflow = 'hidden';
    nameEl.style.whiteSpace = 'nowrap';
    nameEl.style.display = 'inline-block';
    nameEl.style.borderRight = `1.5px solid ${P.gold}`;

    let index = 0;

    const baseDelay =
      originalText.length <= 5 ? 70 :
      originalText.length <= 10 ? 46 : 32;

    const totalTypingMs = baseDelay * originalText.length + 220;

    const typeInterval = window.setInterval(() => {
      if (index < originalText.length) {
        nameEl.textContent += originalText.charAt(index);
        index++;
      } else {
        window.clearInterval(typeInterval);

        window.setTimeout(() => {
          nameEl.style.borderRight = 'none';
          nameEl.dataset.typing = 'false';
        }, 200);
      }
    }, baseDelay);

    window.setTimeout(() => {
      window.clearInterval(typeInterval);

      if (nameEl) {
        nameEl.textContent = originalText;
        nameEl.style.borderRight = 'none';
        nameEl.dataset.typing = 'false';
      }
    }, totalTypingMs);
  };

  // ============================================================
  // ANIMAZIONE NUOVO UTENTE
  // ============================================================
  const animateNewUser = (userId: string, delay = 0) => {
    const userEl = userRefs.current.get(userId);
    if (!userEl) return;

    const avatar = userEl.querySelector('.wr-avatar') as HTMLElement | null;
    const nameEl = userEl.querySelector('.wr-user-name') as HTMLElement | null;
    const originalText = nameEl?.textContent || '';

    userEl.classList.add('wr-user--new');

    userEl.animate(
      [
        {
          opacity: 0,
          transform: 'translateY(18px) scale(0.96)',
          filter: 'blur(4px)',
        },
        {
          opacity: 1,
          transform: 'translateY(0) scale(1)',
          filter: 'blur(0)',
        },
      ],
      {
        duration: 560,
        delay,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both',
      }
    );

    if (avatar) {
      avatar.animate(
        [
          {
            transform: 'scale(0.2) rotate(-8deg)',
            opacity: 0,
            boxShadow: '0 0 0 rgba(237, 61, 115, 0)',
          },
          {
            transform: 'scale(1.18) rotate(4deg)',
            opacity: 1,
            boxShadow: `0 0 24px ${P.pinkGlow}`,
            offset: 0.6,
          },
          {
            transform: 'scale(1) rotate(0deg)',
            opacity: 1,
            boxShadow: '0 0 0 rgba(237, 61, 115, 0)',
          },
        ],
        {
          duration: 680,
          delay: delay + 100,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          fill: 'both',
        }
      );
    }

    if (nameEl && originalText) {
      window.setTimeout(() => {
        typeName(nameEl, originalText);
      }, delay + 260);
    }

    window.setTimeout(() => {
      userEl.classList.remove('wr-user--new');
    }, delay + 1700);
  };

  // ============================================================
  // RILEVAMENTO NUOVI UTENTI
  // ============================================================
  useEffect(() => {
    const currentIds = new Set(roomUsers.map((u) => u.id));

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevUserIds.current = currentIds;
      return;
    }

    const prevIds = prevUserIds.current;

    const newIds = roomUsers
      .map((user) => user.id)
      .filter((id) => !prevIds.has(id));

    prevUserIds.current = currentIds;

    if (newIds.length === 0) return;

    const timers: number[] = [];

    newIds.forEach((newId, index) => {
      const delay = index * 180;

      timers.push(
        window.setTimeout(() => {
          animateNewUser(newId, delay);
        }, 50)
      );
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [roomUsers]);

  const cssVars = {
    '--wr-bg': P.bg,
    '--wr-bg-soft': P.bgSoft,
    '--wr-card': P.card,
    '--wr-card-hover': P.cardHover,
    '--wr-border': P.border,
    '--wr-gold': P.gold,
    '--wr-gold-soft': P.goldSoft,
    '--wr-gold-glow': P.goldGlow,
    '--wr-gold-rgb': convertHexToRgb(P.gold),
    '--wr-pink': P.pink,
    '--wr-pink-deep': P.pinkDeep,
    '--wr-pink-glow': P.pinkGlow,
    '--wr-pink-rgb': convertHexToRgb(P.pink),
    '--wr-text': P.text,
    '--wr-muted': P.textMuted,
    '--wr-faint': P.textFaint,
    '--wr-code-bg': P.codeBg,
    '--wr-badge-bg': P.badgeBg,
    '--wr-badge-border': P.badgeBorder,
    '--home-font': FONT_SANS,
    '--home-font-display': FONT_DISPLAY,
    '--home-font-mono': FONT_MONO,
  } as CSSProperties;

  const handleBack = () => router.push('/home');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      // ignore
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        @keyframes wr-fadeInUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes wr-pulse {
          0% { text-shadow: 0 0 8px var(--wr-pink-glow), 0 0 20px transparent; }
          50% {
            text-shadow: 0 0 24px var(--wr-pink-glow), 0 0 60px var(--wr-pink);
            color: var(--wr-gold-soft);
          }
          100% { text-shadow: 0 0 8px var(--wr-pink-glow), 0 0 20px transparent; }
        }

        @keyframes wr-breathe {
          0% { transform: scale(1); box-shadow: 0 8px 30px var(--wr-pink-glow); }
          50% { transform: scale(1.02); box-shadow: 0 12px 40px var(--wr-pink-glow); }
          100% { transform: scale(1); box-shadow: 0 8px 30px var(--wr-pink-glow); }
        }

        @keyframes wr-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes wr-sparkle {
          0%, 100% { transform: scale(0.8); opacity: 0.4; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        @keyframes wr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes wr-check-rotate {
          0% { transform: scale(0) rotate(-90deg); opacity: 0; }
          60% { transform: scale(1.3) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }

        @keyframes wr-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }

        @keyframes wr-user-glow {
          0% { opacity: 0; transform: scale(0.92); }
          30% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.06); }
        }

        .wr-root {
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: var(--wr-bg);
          max-width: 100%;
          margin: 0;
          font-family: var(--home-font);
          letter-spacing: -0.01em;
        }

        .wr-root button,
        .wr-root input {
          border-radius: 0 !important;
          font-family: var(--home-font);
        }

        .wr-root ::selection {
          background: var(--wr-pink);
          color: #fff;
        }

        @media (min-width: 1024px) {
          .wr-root {
            padding: 40px 32px;
          }
        }

        .wr-header {
          animation: wr-fadeInUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .wr-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          padding: 0;
          color: var(--wr-muted);
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 12px;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .wr-breadcrumb:hover {
          color: var(--wr-gold);
        }

        .wr-title-row {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .wr-title {
          font-family: var(--home-font-display);
          font-size: 32px;
          font-weight: 800;
          color: var(--wr-text);
          letter-spacing: -0.02em;
          margin: 0;
        }

        .wr-title span {
          background: #fff;
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: wr-gradient-shift 4s ease-in-out infinite;
        }

        .wr-sub {
          font-size: 15px;
          color: var(--wr-muted);
          margin: 4px 0 0;
        }

        .wr-sub span {
          color: var(--wr-gold);
          font-weight: 700;
        }

        .wr-card {
          background: var(--wr-card);
          border: 1px solid var(--wr-border);
          position: relative;
          overflow: hidden;
          transition:
            transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.3s ease,
            border-color 0.25s;
        }

        .wr-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid transparent;
          transition: border-color 0.3s ease;
          pointer-events: none;
        }

        .wr-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px var(--wr-gold-glow);
        }

        .wr-card:hover::after {
          border-color: rgba(var(--wr-gold-rgb), 0.38);
        }

        .ticket-tear {
          position: absolute;
          left: 50%;
          bottom: -1px;
          transform: translateX(-50%);
          width: 16px;
          height: 6px;
          background: var(--wr-bg);
          border-radius: 50% 50% 0 0;
          border-left: 1px solid var(--wr-border);
          border-right: 1px solid var(--wr-border);
          border-top: 1px solid var(--wr-border);
          opacity: 0.6;
          pointer-events: none;
          z-index: 2;
        }

        .wr-card--code {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          animation: wr-fadeInUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
        }

        .wr-card--users {
          padding: 20px 24px;
          animation: wr-fadeInUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
        }

        .wr-card-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--wr-muted);
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .wr-code-box {
          display: flex;
          align-items: center;
          background: var(--wr-code-bg);
          border: 1px solid var(--wr-border);
          padding: 6px;
          gap: 4px;
          transition: border-color 0.3s ease;
        }

        .wr-code-box:hover {
          border-color: var(--wr-gold);
        }

        .wr-code {
          flex: 1;
          font-size: 30px;
          font-weight: 700;
          color: var(--wr-pink);
          letter-spacing: 8px;
          text-align: center;
          font-family: var(--home-font-mono);
          padding: 16px 0;
          animation: wr-pulse 3s ease-in-out infinite;
        }

        .wr-copy-btn {
          background: var(--wr-bg-soft);
          border: 1px solid var(--wr-border);
          padding: 10px 18px;
          color: var(--wr-muted);
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .wr-copy-btn:hover {
          color: var(--wr-gold);
          border-color: var(--wr-gold);
          transform: scale(1.02);
        }

        .wr-copy-btn:active {
          transform: scale(0.96);
        }

        .wr-hint {
          font-size: 13px;
          color: var(--wr-faint);
          text-align: center;
          opacity: 0.9;
          margin: 0;
        }

        .wr-enter-btn {
          width: 100%;
          padding: 16px;
          background: var(--wr-pink);
          color: #ffffff;
          border: none;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 8px 30px var(--wr-pink-glow);
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          animation: wr-breathe 2.5s ease-in-out infinite;
        }

        .wr-enter-btn:not(:disabled):hover {
          background: var(--wr-pink-deep);
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 14px 40px var(--wr-pink-glow);
          animation: none;
        }

        .wr-enter-btn:disabled {
          background: var(--wr-bg-soft);
          box-shadow: none;
          opacity: 0.6;
          cursor: not-allowed;
          animation: none;
        }

        .wr-enter-btn svg {
          transition: transform 0.3s ease;
        }

        .wr-enter-btn:not(:disabled):hover svg {
          transform: rotate(-8deg) scale(1.1);
        }

        .wr-users-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .wr-users-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--wr-muted);
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wr-users-label svg {
          color: var(--wr-gold);
        }

        .wr-share-btn {
          color: var(--wr-muted);
          font-size: 13px;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: color 0.2s ease, transform 0.2s ease;
        }

        .wr-share-btn:hover {
          color: var(--wr-gold);
          transform: scale(1.05);
        }

        .wr-user-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .wr-empty {
          font-size: 14px;
          color: var(--wr-muted);
        }

        .wr-user {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 0;
          position: relative;
          transition: all 0.2s ease;
        }

        .wr-user--new::before {
          content: '';
          position: absolute;
          inset: -6px -10px;
          border-radius: 14px;
          background: radial-gradient(
            circle at 20% 50%,
            var(--wr-pink-glow),
            transparent 70%
          );
          opacity: 0;
          pointer-events: none;
          z-index: 0;
          animation: wr-user-glow 1.6s ease-out both;
        }

        .wr-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--wr-bg-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          color: var(--wr-text);
          transition: transform 0.2s ease;
          position: relative;
          z-index: 1;
        }

        .wr-avatar--self {
          background: var(--wr-pink);
          color: #ffffff;
        }

        .wr-user-name {
          font-size: 15px;
          font-weight: 500;
          color: var(--wr-text);
          position: relative;
          display: inline-block;
          z-index: 1;
        }

        .wr-you {
          font-size: 12px;
          color: var(--wr-gold);
          font-weight: 600;
          margin-top: 2px;
        }

        .wr-waiting {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-top: 14px;
          border-top: 1px solid var(--wr-border);
        }

        .wr-waiting-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 2px dashed var(--wr-gold);
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          animation: wr-spin 2.5s linear infinite;
        }

        .wr-waiting-dot {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--wr-gold-glow);
          animation: wr-sparkle 1.2s ease-in-out infinite;
        }

        .wr-waiting-text {
          font-size: 14px;
          color: var(--wr-faint);
          font-style: italic;
        }

        .wr-divider {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 4px 0;
          animation: wr-fadeInUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
        }

        .wr-divider::before,
        .wr-divider::after {
          content: '';
          flex: 1;
          border-top: 1px solid var(--wr-border);
        }

        .wr-divider span {
          font-size: 13px;
          color: var(--wr-muted);
          white-space: nowrap;
        }

        .wr-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: wr-fadeInUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both;
        }

        .wr-form-row {
          display: flex;
          gap: 12px;
          width: 100%;
        }

        .wr-code-input {
          flex: 1;
          min-width: 0;
          padding: 16px 20px;
          border: 1px solid var(--wr-border);
          font-size: 15px;
          font-family: var(--home-font-mono);
          color: var(--wr-text);
          background: var(--wr-bg-soft);
          outline: none;
          text-align: center;
          letter-spacing: 5px;
          font-weight: 600;
          text-transform: uppercase;
          caret-color: var(--wr-pink);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .wr-code-input:focus {
          border-color: var(--wr-pink);
          box-shadow: 0 0 0 4px var(--wr-pink-glow);
        }

        .wr-code-input::placeholder {
          letter-spacing: 1px;
          font-weight: 400;
          color: var(--wr-faint);
        }

        .wr-code-submit {
          padding: 0 32px;
          background: var(--wr-gold);
          color: #000000;
          border: none;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .wr-code-submit:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .wr-code-submit:not(:disabled):hover {
          background: var(--wr-gold-soft);
          transform: scale(1.02);
          box-shadow: 0 4px 16px var(--wr-gold-glow);
        }

        .wr-code-submit:active {
          transform: scale(0.96);
        }

        .wr-error {
          font-size: 13px;
          color: var(--wr-pink);
          text-align: center;
          margin-top: -8px;
          font-weight: 500;
          animation: wr-shake 0.4s ease both;
        }

        .wr-outline-btn {
          width: 100%;
          padding: 15px;
          background: transparent;
          color: var(--wr-pink);
          border: 1.5px solid var(--wr-pink);
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .wr-outline-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .wr-outline-btn:not(:disabled):hover {
          background: var(--wr-pink-glow);
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 6px 20px var(--wr-pink-glow);
        }

        .wr-outline-btn:active {
          transform: scale(0.97);
        }

        .wr-check-icon {
          animation: wr-check-rotate 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        .wr-breadcrumb:focus-visible,
        .wr-copy-btn:focus-visible,
        .wr-enter-btn:focus-visible,
        .wr-share-btn:focus-visible,
        .wr-code-input:focus-visible,
        .wr-code-submit:focus-visible,
        .wr-outline-btn:focus-visible {
          outline: 2px solid var(--wr-gold);
          outline-offset: 2px;
        }
      `}</style>

      <div className="wr-root" style={{ ...cssVars, opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        <header className="wr-header">
          <button
            type="button"
            className="wr-breadcrumb"
            onClick={() => router.push('/crea-stanza')}
          >
            <ArrowLeft size={20} style={{ marginRight: '6px' }} />
            Crea stanza
          </button>

          <div className="wr-title-row">
            <h1 className="wr-title">
              Ciao, <span>@{currentUserName}</span>
            </h1>
          </div>

          <p className="wr-sub">
            Pronto per il tuo <span>film perfetto</span>?
          </p>
        </header>

        <section className="wr-card wr-card--code">
          <div className="wr-card-label">La tua stanza</div>

          <div className="wr-code-box">
            <div className="wr-code">{roomId}</div>

            <button
              type="button"
              className="wr-copy-btn"
              onClick={handleCopy}
              aria-label={copied ? 'Codice copiato' : 'Copia codice stanza'}
            >
              {copied ? (
                <Check size={18} weight="bold" className="wr-check-icon" />
              ) : (
                <Copy size={18} />
              )}

              <span>{copied ? 'Copiato!' : 'Copia codice'}</span>
            </button>
          </div>

          <p className="wr-hint">
            {isExpired
              ? 'Questa stanza è scaduta perché è rimasta vuota troppo a lungo'
              : sessionStarted
                ? 'La votazione è iniziata · nuovi ingressi chiusi'
                : isRoomLocked
                  ? `Ingressi chiusi · ${participantCount}/${maxMembers} partecipanti`
                  : isGroup
                    ? `Condividi il codice con il gruppo · ${participantCount}/${maxMembers} partecipanti`
                    : 'Condividi questo codice con il tuo partner'}
          </p>

          <button
            type="button"
            className="wr-enter-btn"
            onClick={onEnter}
            disabled={
              isPending ||
              hostActionBusy ||
              isFinished ||
              isExpired ||
              (roomPhase === 'waiting' && !isHost)
            }
          >
            <FilmSlate size={20} weight="fill" />
            <span>
              {isPending
                ? 'Richiesta inviata'
                : hostActionBusy
                  ? 'Operazione in corso...'
                  : isExpired
                    ? 'Stanza scaduta'
                    : isFinished
                      ? 'Stanza conclusa'
                      : roomPhase === 'planning'
                      ? 'Vedi il piano dell’uscita'
                      : roomPhase === 'matched'
                        ? 'Vedi il film scelto'
                        : roomPhase === 'voting'
                          ? 'Entra nella votazione'
                          : isHost
                            ? 'Avvia la votazione'
                            : 'In attesa che l’host avvii la votazione'}
            </span>
          </button>

          {isHost && roomPhase === 'waiting' && !isGroupReady && (
            <div style={{
              marginTop: '8px',
              color: P.textMuted,
              fontSize: '12px',
              textAlign: 'center',
              lineHeight: 1.45,
            }}>
              Il server controllerà i partecipanti al momento dell’avvio · {participantCount}/{minMembers} visibili ora
            </div>
          )}

          {isPending && (
            <div style={{
              marginTop: '10px',
              padding: '12px 14px',
              border: `1px solid ${P.border}`,
              background: P.bgSoft,
              color: P.textMuted,
              fontSize: '13px',
              lineHeight: 1.55,
              textAlign: 'center',
            }}>
              L’host deve accettare la tua richiesta prima che tu possa partecipare alla stanza.
            </div>
          )}

          {isHost && roomPhase !== 'finished' && roomPhase !== 'expired' && (
            <button
              type="button"
              onClick={onFinishRoom}
              disabled={hostActionBusy}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '11px 14px',
                background: 'transparent',
                color: P.textMuted,
                border: `1px solid ${P.border}`,
                cursor: hostActionBusy ? 'not-allowed' : 'pointer',
                fontFamily: FONT_SANS,
                fontWeight: 700,
              }}
            >
              Chiudi stanza
            </button>
          )}

          {hostActionError && (
            <div style={{ color: P.pink, fontSize: '13px', textAlign: 'center' }}>
              {hostActionError}
            </div>
          )}

          {isHost && roomPhase === 'waiting' && (
            <button
              type="button"
              onClick={onToggleLock}
              disabled={hostActionBusy}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '12px 14px',
                background: 'transparent',
                color: isRoomLocked ? P.pink : P.textMuted,
                border: `1px solid ${isRoomLocked ? P.pink : P.border}`,
                cursor: hostActionBusy ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: FONT_SANS,
                fontWeight: 700,
              }}
            >
              {isRoomLocked ? <Lock size={17} /> : <LockOpen size={17} />}
              {isRoomLocked ? 'Riapri ingressi' : 'Chiudi ingressi'}
            </button>
          )}
          <div className="ticket-tear" />
        </section>

        <section className="wr-card wr-card--users" ref={cardRef}>
          <div className="wr-users-header">
            <div className="wr-users-label">
              <Users size={18} weight="fill" />
              Partecipanti
            </div>

            <div style={{ marginLeft: 'auto', marginRight: '10px', fontSize: '12px', fontWeight: 700, color: isGroupReady ? P.gold : P.textMuted }}>
              {participantCount}/{maxMembers} · {isGroupReady ? 'Gruppo pronto' : `Minimo ${minMembers}`}
            </div>

            <button
              type="button"
              className="wr-share-btn"
              title="Condividi stanza"
            >
              <Share size={16} />
              Condividi
            </button>
          </div>

          <div className="wr-user-list">
            {roomUsers.length === 0 ? (
              <div className="wr-empty">
                Nessuno ancora...
              </div>
            ) : (
              roomUsers.map((u) => (
                <div
                  key={u.id}
                  ref={(el) => {
                    if (el) {
                      userRefs.current.set(u.id, el);
                    } else {
                      userRefs.current.delete(u.id);
                    }
                  }}
                  className="wr-user"
                >
                  <div
                    className={`wr-avatar${
                      u.id === currentUserId ? ' wr-avatar--self' : ''
                    }`}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div className="wr-user-name">
                        @{u.name}
                      </div>
                      {u.id === hostActorId && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          color: P.bg,
                          background: P.gold,
                          padding: '3px 6px',
                          borderRadius: '999px',
                          lineHeight: 1,
                        }}>
                          HOST
                        </span>
                      )}
                    </div>

                    {u.id === currentUserId && (
                      <div className="wr-you">
                        Tu
                      </div>
                    )}
                  </div>

                  {isHost && u.id !== currentUserId && u.id !== hostActorId && roomPhase === 'waiting' && (
                    <button
                      type="button"
                      title={`Rimuovi @${u.name}`}
                      onClick={() => {
                        if (window.confirm(`Rimuovere @${u.name} dalla stanza?`)) {
                          onRemoveParticipant(u.id);
                        }
                      }}
                      disabled={hostActionBusy}
                      style={{
                        marginLeft: 'auto',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: `1px solid ${P.border}`,
                        background: 'transparent',
                        color: P.textMuted,
                        cursor: hostActionBusy ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))
            )}

            {availableSpots > 0 && !isExpired && (
              <div className="wr-waiting">
                <div className="wr-waiting-avatar">
                  <div className="wr-waiting-dot" />
                </div>

                <div className="wr-waiting-text">
                  {isGroup
                    ? (isGroupReady
                        ? `${availableSpots} ${availableSpots === 1 ? 'posto disponibile' : 'posti disponibili'}`
                        : `In attesa di ${Math.max(0, minMembers - participantCount)} ${Math.max(0, minMembers - participantCount) === 1 ? 'persona' : 'persone'} per essere pronti...`)
                    : 'In attesa del partner...'}
                </div>
              </div>
            )}
          </div>
          <div className="ticket-tear" />
        </section>

        {isHost && pendingRequests.length > 0 && roomPhase === 'waiting' && (
          <section className="wr-card wr-card--users">
            <div className="wr-users-header">
              <div className="wr-users-label">
                <Users size={18} weight="fill" />
                Richieste di partecipazione
              </div>
              <div style={{ fontSize: '12px', color: P.pink, fontWeight: 800 }}>
                {pendingRequests.length}
              </div>
            </div>

            <div className="wr-user-list">
              {pendingRequests.map((u) => (
                <div key={u.id} className="wr-user">
                  <div className="wr-avatar">
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div className="wr-user-name">@{u.name}</div>
                    <div style={{ color: P.textFaint, fontSize: '11px', marginTop: '2px' }}>
                      Vuole entrare nella stanza
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onRejectParticipant(u.id)}
                      disabled={hostActionBusy}
                      style={{
                        padding: '7px 10px',
                        border: `1px solid ${P.border}`,
                        background: 'transparent',
                        color: P.textMuted,
                        cursor: hostActionBusy ? 'not-allowed' : 'pointer',
                        fontFamily: FONT_SANS,
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      Rifiuta
                    </button>

                    <button
                      type="button"
                      onClick={() => onApproveParticipant(u.id)}
                      disabled={hostActionBusy}
                      style={{
                        padding: '7px 10px',
                        border: `1px solid ${P.gold}`,
                        background: P.gold,
                        color: P.bg,
                        cursor: hostActionBusy ? 'not-allowed' : 'pointer',
                        fontFamily: FONT_SANS,
                        fontSize: '11px',
                        fontWeight: 800,
                      }}
                    >
                      Accetta
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="ticket-tear" />
          </section>
        )}

        <div className="wr-divider">
          <span>oppure entra in un'altra stanza</span>
        </div>

        <form className="wr-form" onSubmit={onJoinByCode}>
          <div className="wr-form-row">
            <input
              className="wr-code-input"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="INSCRISCI CODICE (ES. MAPLE-73)"
              maxLength={10}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {codeError && (
            <div className="wr-error">
              ⚠️ {codeError}
            </div>
          )}

          <button
            type="submit"
            className="wr-outline-btn"
            disabled={!codeValid}
          >
            <Door size={20} weight="fill" />
            <span>Entra con codice</span>
          </button>
        </form>
      </div>
    </>
  );
}