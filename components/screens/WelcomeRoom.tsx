import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Check,
  Copy,
  Door,
  FilmSlate,
  Lock,
  LockOpen,
  ShareNetwork,
  Users,
  X,
} from '@phosphor-icons/react';

import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { C, FONT, R, THEME } from '@/styles/token';
import type { RoomUser } from '@/types';

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

function initials(name: string) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

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
  const P = theme === 'dark' ? THEME.dark : THEME.light;

  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const autoStartRef = useRef(false);
  const supabase = useMemo(() => createBrowserClient(), []);

  const participantCount = roomUsers.length;
  const availableSpots = Math.max(0, maxMembers - participantCount);
  const missingForStart = Math.max(0, minMembers - participantCount);
  const isGroup = maxMembers > 2;
  const isReady = participantCount >= minMembers;
  const isHost = currentUserId === hostActorId;
  const isPending = membershipStatus === 'pending';
  const isFinished = roomPhase === 'finished';
  const isExpired = roomPhase === 'expired';
  const sessionStarted =
    roomPhase === 'voting' ||
    roomPhase === 'matched' ||
    roomPhase === 'planning';

  const status = useMemo(() => {
    if (isExpired) {
      return {
        label: 'Stanza scaduta',
        detail: 'Questa stanza non è più attiva.',
        tone: 'muted',
      };
    }

    if (isFinished) {
      return {
        label: 'Stanza conclusa',
        detail: 'La sessione è terminata.',
        tone: 'muted',
      };
    }

    if (isPending) {
      return {
        label: 'Richiesta inviata',
        detail: 'L’host deve approvare il tuo ingresso.',
        tone: 'gold',
      };
    }

    if (roomPhase === 'planning') {
      return {
        label: 'Piano pronto',
        detail: 'Il film è stato scelto. Ora organizziamo la visione.',
        tone: 'pink',
      };
    }

    if (roomPhase === 'matched') {
      return {
        label: 'Match trovato',
        detail: 'Avete trovato un film in comune.',
        tone: 'pink',
      };
    }

    if (roomPhase === 'voting') {
      return {
        label: 'Votazione in corso',
        detail: 'La stanza è attiva: continua con gli swipe.',
        tone: 'pink',
      };
    }

    if (isRoomLocked) {
      return {
        label: 'Ingressi chiusi',
        detail: `${participantCount}/${maxMembers} partecipanti nella stanza.`,
        tone: 'gold',
      };
    }

    if (isReady) {
      return {
        label: 'Pronti a scegliere',
        detail: `${participantCount}/${maxMembers} partecipanti collegati.`,
        tone: 'pink',
      };
    }

    return {
      label: isGroup ? 'Aspettiamo il gruppo' : 'Aspettiamo il partner',
      detail: isGroup
        ? `Mancano ${missingForStart} ${missingForStart === 1 ? 'persona' : 'persone'} per iniziare.`
        : 'Condividi il codice per iniziare insieme.',
      tone: 'gold',
    };
  }, [
    isExpired,
    isFinished,
    isPending,
    roomPhase,
    isRoomLocked,
    participantCount,
    maxMembers,
    isReady,
    isGroup,
    missingForStart,
  ]);

  const primaryLabel =
    isPending
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
                    : 'In attesa dell’host';

  const primaryDisabled =
    isPending ||
    hostActionBusy ||
    isFinished ||
    isExpired ||
    (roomPhase === 'waiting' && !isHost);

  // Manteniamo sempre l'ultima versione di onEnter senza usarla come
  // dipendenza del timer: il parent può ricreare la callback a ogni render.
  const onEnterRef = useRef(onEnter);

  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  // Recupera le foto profilo reali degli utenti della stanza.
  // I guest non hanno una riga in public.users e continueranno a mostrare l'iniziale.
  useEffect(() => {
    let cancelled = false;

    const loadAvatars = async () => {
      const actorIds = Array.from(
        new Set(
          [...roomUsers, ...pendingRequests]
            .map((user) => user.id)
            .filter(Boolean)
        )
      );

      if (actorIds.length === 0) {
        if (!cancelled) setAvatarUrls({});
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, avatar_url')
        .in('id', actorIds);

      if (error) {
        console.warn('Impossibile caricare gli avatar della stanza:', error.message);
        return;
      }

      const next: Record<string, string> = {};

      for (const profile of data ?? []) {
        if (
          typeof profile.id === 'string' &&
          typeof profile.avatar_url === 'string' &&
          profile.avatar_url.trim()
        ) {
          next[profile.id] = profile.avatar_url.trim();
        }
      }

      // Fallback per il proprio account: se public.users non contiene ancora
      // avatar_url, proviamo l'avatar del provider (es. Google) dai metadata auth.
      if (!next[currentUserId]) {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData.user;

        if (authUser?.id === currentUserId) {
          const metadataAvatar =
            typeof authUser.user_metadata?.avatar_url === 'string'
              ? authUser.user_metadata.avatar_url.trim()
              : '';

          if (metadataAvatar) {
            next[currentUserId] = metadataAvatar;
          }
        }
      }

      if (!cancelled) {
        setAvatarUrls(next);
      }
    };

    void loadAvatars();

    return () => {
      cancelled = true;
    };
  }, [supabase, roomUsers, pendingRequests, currentUserId]);

  // Avvio automatico con countdown visibile di 5 secondi.
  // Il timer parte una sola volta quando la stanza diventa completa.
  useEffect(() => {
    const shouldShowAutoStart =
      roomPhase === 'waiting' &&
      membershipStatus === 'active' &&
      maxMembers > 0 &&
      participantCount >= maxMembers &&
      !isExpired &&
      !isFinished &&
      !autoStartRef.current;

    if (!shouldShowAutoStart) return;

    autoStartRef.current = true;
    setAutoStartCountdown(5);

    const startedAt = Date.now();
    const durationMs = 5000;

    const updateCountdown = () => {
      const elapsed = Date.now() - startedAt;
      const secondsLeft = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));

      setAutoStartCountdown(secondsLeft);

      if (secondsLeft <= 0) {
        window.clearInterval(interval);

        // Il countdown è visibile a tutti, ma solo l'host effettua
        // l'azione server che avvia davvero la votazione.
        if (isHost && !hostActionBusy) {
          window.setTimeout(() => {
            onEnterRef.current();
          }, 320);
        }
      }
    };

    const interval = window.setInterval(updateCountdown, 200);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    isHost,
    roomPhase,
    membershipStatus,
    maxMembers,
    participantCount,
    hostActionBusy,
    isExpired,
    isFinished,
  ]);

  useEffect(() => {
    if (roomPhase !== 'waiting' || participantCount < maxMembers) {
      autoStartRef.current = false;
      setAutoStartCountdown(null);
    }
  }, [roomPhase, participantCount, maxMembers]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleShare = async () => {
    const shareText = `Entra nella mia stanza Cinedate con il codice ${roomId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Cinedate',
          text: shareText,
        });
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
        return;
      }

      await navigator.clipboard.writeText(shareText);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      // L'utente può annullare la condivisione nativa.
    }
  };

  const vars = {
    '--cdr-room-bg': P.bg,
    '--cdr-room-soft': P.bgSoft,
    '--cdr-room-surface': P.surface,
    '--cdr-room-surface-hover': P.surfaceHover,
    '--cdr-room-border': P.border,
    '--cdr-room-text': P.text,
    '--cdr-room-muted': P.textMuted,
    '--cdr-room-faint': P.textFaint,
    '--cdr-room-pink': P.primary,
    '--cdr-room-pink-deep': P.primaryDeep,
    '--cdr-room-pink-glow': P.primaryGlow,
    '--cdr-room-gold': P.accent,
    '--cdr-room-gold-soft': P.accentSoft,
    '--cdr-room-gold-glow': P.accentGlow,
  } as CSSProperties;

  return (
    <>
      <style>{`
        .cdr-room-welcome {
          position: relative;
          min-height: 100%;
          padding: 22px 20px 34px;
          background: var(--cdr-room-bg);
          color: var(--cdr-room-text);
          font-family: ${FONT.sans};
        }

        .cdr-room-welcome * {
          box-sizing: border-box;
        }

        .cdr-room-welcome button,
        .cdr-room-welcome input {
          font-family: ${FONT.sans};
        }

        .cdr-room-shell {
          width: min(100%, 1120px);
          margin: 0 auto;
        }

        .cdr-room-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--cdr-room-muted);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .cdr-room-back:hover {
          color: var(--cdr-room-text);
        }

        .cdr-room-hero {
          display: grid;
          gap: 16px;
          margin: 24px 0 26px;
        }

        .cdr-room-eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--cdr-room-gold);
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .cdr-room-title {
          max-width: 780px;
          margin: 0;
          color: var(--cdr-room-text);
          font-family: ${FONT.display};
          font-size: clamp(34px, 7vw, 62px);
          line-height: .98;
          letter-spacing: -.035em;
        }

        .cdr-room-title em {
          color: var(--cdr-room-pink);
          font-style: italic;
          font-weight: 500;
        }

        .cdr-room-subtitle {
          max-width: 620px;
          margin: 0;
          color: var(--cdr-room-muted);
          font-size: 14px;
          line-height: 1.65;
        }

        .cdr-room-status {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border: 1px solid var(--cdr-room-border);
          border-radius: 6px;
          background: var(--cdr-room-surface);
          color: var(--cdr-room-muted);
          font-size: 11px;
          font-weight: 800;
        }

        .cdr-room-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--cdr-room-gold);
          box-shadow: 0 0 0 4px var(--cdr-room-gold-glow);
        }

        .cdr-room-status[data-tone="pink"] .cdr-room-status-dot {
          background: var(--cdr-room-pink);
          box-shadow: 0 0 0 4px var(--cdr-room-pink-glow);
        }

        .cdr-room-status[data-tone="muted"] .cdr-room-status-dot {
          background: var(--cdr-room-faint);
          box-shadow: none;
        }

        .cdr-room-grid {
          display: grid;
          gap: 18px;
        }

        .cdr-room-card {
          border: 1px solid var(--cdr-room-border);
          border-radius: 0px;
          background: var(--cdr-room-surface);
          overflow: hidden;
        }

        .cdr-room-card-main {
          padding: 20px;
        }

        .cdr-room-card-side {
          padding: 20px;
        }

        .cdr-room-card-label {
          color: var(--cdr-room-faint);
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .13em;
          text-transform: uppercase;
        }

        .cdr-room-code-wrap {
          margin-top: 12px;
          border-top: 1px solid var(--cdr-room-border);
          border-bottom: 1px solid var(--cdr-room-border);
          padding: 18px 0;
        }

        .cdr-room-code {
          color: var(--cdr-room-text);
          font-family: ${FONT.mono};
          font-size: clamp(30px, 8vw, 48px);
          font-weight: 800;
          letter-spacing: .1em;
          line-height: 1;
          word-break: break-word;
        }

        .cdr-room-code-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .cdr-room-mini-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 38px;
          padding: 8px 11px;
          border: 1px solid var(--cdr-room-border);
          border-radius: ${R.sm};
          background: transparent;
          color: var(--cdr-room-muted);
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: 160ms ease;
        }

        .cdr-room-mini-btn:hover {
          border-color: var(--cdr-room-gold);
          color: var(--cdr-room-text);
          background: var(--cdr-room-surface-hover);
        }

        .cdr-room-context {
          margin-top: 14px;
          color: var(--cdr-room-muted);
          font-size: 12px;
          line-height: 1.55;
        }

        .cdr-room-primary {
          width: 100%;
          min-height: 52px;
          margin-top: 18px;
          border: 0;
          border-radius: 0px;
          background: var(--cdr-room-pink);
          color: white;
          font-size: 14px;
          font-weight: 850;
          cursor: pointer;
          box-shadow: 0 10px 26px var(--cdr-room-pink-glow);
          transition: 160ms ease;
        }

        .cdr-room-primary:not(:disabled):hover {
          transform: translateY(-1px);
          background: var(--cdr-room-pink-deep);
        }

        .cdr-room-primary:disabled {
          cursor: not-allowed;
          box-shadow: none;
          opacity: .48;
        }

        .cdr-room-notice {
          margin-top: 12px;
          padding: 12px 13px;
          border-radius: ${R.sm};
          border: 1px solid var(--cdr-room-border);
          background: var(--cdr-room-soft);
          color: var(--cdr-room-muted);
          font-size: 12px;
          line-height: 1.55; 
          
        }

        .cdr-room-host-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        .cdr-room-secondary {
          min-height: 42px;
          padding: 9px 11px;
          border: 1px solid var(--cdr-room-border);
          border-radius: ${R.sm};
          background: transparent;
          color: var(--cdr-room-muted);
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .cdr-room-secondary:hover {
          background: var(--cdr-room-surface-hover);
          color: var(--cdr-room-text);
        }

        .cdr-room-secondary.danger:hover {
          border-color: ${C.error};
          color: ${C.error};
        }

        .cdr-room-error {
          margin-top: 10px;
          color: ${C.error};
          font-size: 12px;
          font-weight: 700;
        }

        .cdr-room-side-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--cdr-room-border);
        }

        .cdr-room-side-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--cdr-room-text);
          font-size: 13px;
          font-weight: 850;
        }

        .cdr-room-count {
          color: ${isReady ? 'var(--cdr-room-gold)' : 'var(--cdr-room-faint)'};
          font-size: 11px;
          font-weight: 800;
        }

        .cdr-room-users {
          display: grid;
          gap: 4px;
          margin-top: 10px;
        }

        .cdr-room-user {
          display: grid;
          grid-template-columns: 38px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 9px 0;
        }

        .cdr-room-avatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 10%; 
          background: var(--cdr-room-soft);
          color: var(--cdr-room-text);
          font-size: 13px;
          font-weight: 850;
        }

        .cdr-room-avatar.self {
          background: var(--cdr-room-pink);
          color: white;
        }

        .cdr-room-avatar.has-image {
          overflow: hidden;
          background: var(--cdr-room-soft);
        }

        .cdr-room-avatar-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cdr-room-user-name {
          color: var(--cdr-room-text);
          font-size: 13px;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cdr-room-user-meta {
          margin-top: 2px;
          color: var(--cdr-room-faint);
          font-size: 10px;
        }

        .cdr-room-host-badge {
          display: inline-block;
          margin-left: 6px;
          padding: 3px 5px;
          border-radius: 0px;
          background: var(--cdr-room-gold);
          color: var(--cdr-room-bg);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .05em;
          vertical-align: 1px;
        }

        .cdr-room-remove {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border: 1px solid var(--cdr-room-border);
          border-radius: 0%;
          background: transparent;
          color: var(--cdr-room-faint);
          cursor: pointer;
        }

        .cdr-room-remove:hover {
          color: ${C.error};
          border-color: ${C.error};
        }

        .cdr-room-waiting {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
          padding: 12px 0 2px;
          border-top: 1px solid var(--cdr-room-border);
          color: var(--cdr-room-faint);
          font-size: 11px;
        }

        .cdr-room-waiting-ring {
          width: 28px;
          height: 28px;
          border: 1px dashed var(--cdr-room-gold);
          border-radius: 10%;
          display: grid;
          place-items: center;
        }

        .cdr-room-waiting-ring::after {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 10%;
          background: var(--cdr-room-gold);
        }

        .cdr-room-pending {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid var(--cdr-room-border);
        }

        .cdr-room-pending-title {
          display: flex;
          justify-content: space-between;
          color: var(--cdr-room-text);
          font-size: 12px;
          font-weight: 850;
        }

        .cdr-room-request {
          display: grid;
          grid-template-columns: 34px 1fr auto;
          align-items: center;
          gap: 9px;
          padding: 10px 0;
        }

        .cdr-room-request-actions {
          display: flex;
          gap: 5px;
        }

        .cdr-room-request-btn {
          min-height: 32px;
          padding: 6px 8px;
          border-radius: ${R.sm};
          border: 1px solid var(--cdr-room-border);
          background: transparent;
          color: var(--cdr-room-muted);
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
        }

        .cdr-room-request-btn.accept {
          border-color: var(--cdr-room-gold);
          background: var(--cdr-room-gold);
          color: var(--cdr-room-bg);
        }

        .cdr-room-join {
          margin-top: 20px;
          padding-top: 22px;
          border-top: 1px solid var(--cdr-room-border);
        }

        .cdr-room-join-title {
          margin: 0 0 4px;
          color: var(--cdr-room-text);
          font-family: ${FONT.display};
          font-size: 20px;
        }

        .cdr-room-join-copy {
          margin: 0 0 14px;
          color: var(--cdr-room-faint);
          font-size: 11px;
        }

        .cdr-room-join-form {
          display: grid;
          gap: 8px;
        }

        .cdr-room-code-input {
          width: 100%;
          min-height: 48px;
          padding: 0 14px;
          border: 1px solid var(--cdr-room-border);
          border-radius: 0px;
          background: var(--cdr-room-surface);
          color: var(--cdr-room-text);
          font-family: ${FONT.mono};
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          outline: 0;
        }

        .cdr-room-code-input:focus {
          border-color: var(--cdr-room-pink);
          box-shadow: 0 0 0 3px var(--cdr-room-pink-glow);
        }

        .cdr-room-join-btn {
          width: 100%;
          height: 48px;
          min-height: 48px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid var(--cdr-room-pink);
          border-radius: 0px;
          background: transparent;
          color: var(--cdr-room-pink);
          font-size: 12px;
          font-weight: 850;
          line-height: 1;
          white-space: nowrap;
          vertical-align: middle;
          cursor: pointer;
        }

        .cdr-room-join-btn svg {
          display: block;
          flex: 0 0 auto;
        }

        .cdr-room-join-btn span {
          display: block;
          line-height: 1;
        }

        .cdr-room-join-btn:disabled {
          cursor: not-allowed;
          opacity: .35;
        }

        .cdr-room-countdown-backdrop {
          position: absolute;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(5, 4, 3, .72);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: cdr-room-countdown-fade .24s ease both;
        }

        .cdr-room-countdown-modal {
          position: relative;
          width: min(100%, 380px);
          padding: 30px 24px 24px;
          border: 1px solid var(--cdr-room-border);
          border-radius: 12px;
          background: var(--cdr-room-surface);
          text-align: center;
          box-shadow: 0 24px 70px rgba(0, 0, 0, .28);
          overflow: hidden;
          animation: cdr-room-countdown-pop .48s cubic-bezier(.18,.9,.25,1.08) both;
        }

        .cdr-room-countdown-modal::before,
        .cdr-room-countdown-modal::after {
          content: '';
          position: absolute;
          width: 52px;
          height: 1px;
          top: 18px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--cdr-room-gold),
            transparent
          );
          opacity: .65;
          animation: cdr-room-countdown-line 1.8s ease-in-out infinite alternate;
        }

        .cdr-room-countdown-modal::before {
          left: 18px;
        }

        .cdr-room-countdown-modal::after {
          right: 18px;
          animation-delay: .2s;
        }

        .cdr-room-countdown-kicker {
          color: var(--cdr-room-gold);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
          animation: cdr-room-countdown-rise .45s .08s ease both;
        }

        .cdr-room-countdown-number-wrap {
          position: relative;
          width: 150px;
          height: 150px;
          margin: 20px auto 18px;
          display: grid;
          place-items: center;
        }

        .cdr-room-countdown-number-wrap::before {
          content: '';
          position: absolute;
          inset: 15px;
          border-radius: 50%;
          background: var(--cdr-room-pink-glow);
          opacity: .5;
          animation: cdr-room-countdown-breathe 1s ease-in-out infinite;
        }

        .cdr-room-countdown-ring {
          position: absolute;
          inset: 0;
          border: 2px solid var(--cdr-room-border);
          border-radius: 50%;
          box-shadow:
            0 0 24px var(--cdr-room-pink-glow),
            inset 0 0 18px var(--cdr-room-gold-glow);
        }

        .cdr-room-countdown-ring::before {
          content: '';
          position: absolute;
          inset: -2px;
          border: 4px solid transparent;
          border-top-color: var(--cdr-room-pink);
          border-right-color: var(--cdr-room-pink);
          border-radius: 50%;
          filter: drop-shadow(0 0 5px var(--cdr-room-pink-glow));
          animation: cdr-room-countdown-orbit 1.05s linear infinite;
        }

        .cdr-room-countdown-ring::after {
          content: '';
          position: absolute;
          inset: 9px;
          border: 2px solid transparent;
          border-bottom-color: var(--cdr-room-gold);
          border-left-color: var(--cdr-room-gold);
          border-radius: 50%;
          opacity: .95;
          filter: drop-shadow(0 0 4px var(--cdr-room-gold-glow));
          animation: cdr-room-countdown-orbit-reverse 1.65s linear infinite;
        }

        .cdr-room-countdown-orbit-dot {
          position: absolute;
          inset: -7px;
          border-radius: 50%;
          animation: cdr-room-countdown-orbit-dot 1.05s linear infinite;
        }

        .cdr-room-countdown-orbit-dot::before {
          content: '';
          position: absolute;
          top: 1px;
          left: 50%;
          width: 10px;
          height: 10px;
          transform: translateX(-50%);
          border-radius: 50%;
          background: var(--cdr-room-gold);
          box-shadow:
            0 0 8px var(--cdr-room-gold),
            0 0 18px var(--cdr-room-pink);
        }

        .cdr-room-countdown-number-box {
          position: relative;
          z-index: 2;
          display: grid;
          justify-items: center;
          gap: 2px;
        }

        .cdr-room-countdown-number {
          color: var(--cdr-room-text);
          font-family: ${FONT.sans};
          font-size: 68px;
          font-weight: 800;
          letter-spacing: -.055em;
          line-height: .9;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 5px 22px rgba(0, 0, 0, .12);
          animation: cdr-room-countdown-tick .46s cubic-bezier(.16,.9,.28,1.12) both;
        }

        .cdr-room-countdown-unit {
          color: var(--cdr-room-muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          animation: cdr-room-countdown-unit .46s ease both;
        }

        .cdr-room-countdown-title {
          margin: 0;
          color: var(--cdr-room-text);
          font-family: ${FONT.display};
          font-size: 25px;
          line-height: 1.1;
          animation: cdr-room-countdown-rise .45s .14s ease both;
        }

        .cdr-room-countdown-copy {
          max-width: 290px;
          margin: 8px auto 0;
          color: var(--cdr-room-muted);
          font-size: 12px;
          line-height: 1.55;
          animation: cdr-room-countdown-rise .45s .2s ease both;
        }

        .cdr-room-countdown-progress {
          height: 3px;
          margin-top: 20px;
          background: var(--cdr-room-border);
          overflow: hidden;
        }

        .cdr-room-countdown-progress > span {
          display: block;
          width: 100%;
          height: 100%;
          transform-origin: left center;
          background: linear-gradient(
            90deg,
            var(--cdr-room-pink),
            var(--cdr-room-gold)
          );
          animation: cdr-room-countdown-progress 5s linear forwards;
        }

        @keyframes cdr-room-countdown-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes cdr-room-countdown-pop {
          0% {
            opacity: 0;
            transform: scale(.9) translateY(14px);
            filter: blur(8px);
          }
          65% {
            opacity: 1;
            transform: scale(1.018) translateY(-1px);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0);
          }
        }

        @keyframes cdr-room-countdown-rise {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes cdr-room-countdown-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes cdr-room-countdown-orbit-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes cdr-room-countdown-orbit-dot {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes cdr-room-countdown-breathe {
          0%, 100% {
            transform: scale(.94);
            opacity: .34;
          }
          50% {
            transform: scale(1.08);
            opacity: .72;
          }
        }

        @keyframes cdr-room-countdown-tick {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(.72);
          }
          68% {
            opacity: 1;
            transform: translateY(-2px) scale(1.08);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes cdr-room-countdown-unit {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: .9;
            transform: translateY(0);
          }
        }

        @keyframes cdr-room-countdown-line {
          from { opacity: .25; transform: scaleX(.7); }
          to { opacity: .75; transform: scaleX(1); }
        }

        @keyframes cdr-room-countdown-progress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .cdr-room-countdown-backdrop,
          .cdr-room-countdown-modal,
          .cdr-room-countdown-number,
          .cdr-room-countdown-ring,
          .cdr-room-countdown-kicker,
          .cdr-room-countdown-title,
          .cdr-room-countdown-copy,
          .cdr-room-countdown-number-wrap::before,
          .cdr-room-countdown-orbit-dot,
          .cdr-room-countdown-modal::before,
          .cdr-room-countdown-modal::after,
          .cdr-room-countdown-progress > span {
            animation: none !important;
          }
        }

        @media (min-width: 860px) {
          .cdr-room-welcome {
            padding: 34px 32px 48px;
          }

          .cdr-room-grid {
            grid-template-columns: minmax(0, 1.25fr) minmax(320px, .75fr);
            align-items: start;
          }

          .cdr-room-card-main,
          .cdr-room-card-side {
            padding: 26px;
          }

          .cdr-room-join-form {
            grid-template-columns: minmax(0, 1fr) 190px;
          }
        }

        @media (max-width: 520px) {
          .cdr-room-host-actions {
            grid-template-columns: 1fr;
          }

          .cdr-room-request {
            grid-template-columns: 34px 1fr;
          }

          .cdr-room-request-actions {
            grid-column: 1 / -1;
            padding-left: 43px;
          }
        }
      `}</style>

      <main className="cdr-room-welcome" style={vars}>
        {autoStartCountdown !== null && roomPhase === 'waiting' && (
          <div
            className="cdr-room-countdown-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Avvio automatico della votazione"
          >
            <div className="cdr-room-countdown-modal">
              <div className="cdr-room-countdown-kicker">Stanza completa</div>

              <div className="cdr-room-countdown-number-wrap">
                <div className="cdr-room-countdown-ring" aria-hidden="true" />
                <div className="cdr-room-countdown-orbit-dot" aria-hidden="true" />

                <div
                  key={autoStartCountdown}
                  className="cdr-room-countdown-number-box"
                  aria-live="polite"
                >
                  <div className="cdr-room-countdown-number">
                    {autoStartCountdown}
                  </div>
                  <div className="cdr-room-countdown-unit">
                    {autoStartCountdown === 1 ? 'secondo' : 'secondi'}
                  </div>
                </div>
              </div>

              <h2 className="cdr-room-countdown-title">Si parte!</h2>

              <p className="cdr-room-countdown-copy">
                Tutti i posti sono occupati. La votazione inizierà automaticamente.
              </p>

              <div className="cdr-room-countdown-progress" aria-hidden="true">
                <span />
              </div>
            </div>
          </div>
        )}

        <div className="cdr-room-shell">
          <button
            type="button"
            className="cdr-room-back"
            onClick={() => router.push('/crea-stanza')}
          >
            <ArrowLeft size={18} />
            Crea stanza
          </button>

          <section className="cdr-room-hero">
            <div className="cdr-room-eyebrow">
              <FilmSlate size={16} weight="fill" />
              Stanza attiva
            </div>

            <h1 className="cdr-room-title">
              Ciao @{currentUserName},<br />
              <em>scegliete insieme.</em>
            </h1>

            <p className="cdr-room-subtitle">
              Invita chi vuoi nella stanza, aspetta che il gruppo sia pronto e poi
              fate swipe sugli stessi film. Il primo match diventa il punto di partenza.
            </p>

            <div className="cdr-room-status" data-tone={status.tone}>
              <span className="cdr-room-status-dot" />
              {status.label}
            </div>
          </section>

          <div className="cdr-room-grid">
            <section className="cdr-room-card cdr-room-card-main">
              <div className="cdr-room-card-label">Codice stanza</div>

              <div className="cdr-room-code-wrap">
                <div className="cdr-room-code">{roomId}</div>

                <div className="cdr-room-code-actions">
                  <button
                    type="button"
                    className="cdr-room-mini-btn"
                    onClick={handleCopy}
                  >
                    {copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}
                    {copied ? 'Copiato' : 'Copia codice'}
                  </button>

                  <button
                    type="button"
                    className="cdr-room-mini-btn"
                    onClick={handleShare}
                  >
                    {shared ? <Check size={15} weight="bold" /> : <ShareNetwork size={15} />}
                    {shared ? 'Condiviso' : 'Condividi'}
                  </button>

                  {isHost && roomPhase === 'waiting' && (
                    <button
                      type="button"
                      className="cdr-room-mini-btn"
                      onClick={onToggleLock}
                      disabled={hostActionBusy}
                    >
                      {isRoomLocked ? <LockOpen size={15} /> : <Lock size={15} />}
                      {isRoomLocked ? 'Riapri ingressi' : 'Chiudi ingressi'}
                    </button>
                  )}
                </div>
              </div>

              <div className="cdr-room-context">
                {participantCount >= maxMembers && roomPhase === 'waiting'
                  ? 'Stanza completa · la votazione partirà automaticamente.'
                  : status.detail}
              </div>

              <button
                type="button"
                className="cdr-room-primary"
                onClick={onEnter}
                disabled={primaryDisabled}
              >
                {primaryLabel}
              </button>

              {isHost &&
                roomPhase === 'waiting' &&
                !isReady &&
                !isExpired && (
                  <div className="cdr-room-notice">
                    Servono almeno {minMembers} partecipanti per iniziare.
                    Al momento ne vediamo {participantCount}.
                  </div>
                )}

              {isPending && (
                <div className="cdr-room-notice">
                  Puoi restare qui: la stanza si aggiornerà appena l’host approverà
                  la tua richiesta.
                </div>
              )}

              {hostActionError && (
                <div className="cdr-room-error">{hostActionError}</div>
              )}

              {isHost && !isFinished && !isExpired && (
                <div className="cdr-room-host-actions">
                  <button
                    type="button"
                    className="cdr-room-secondary"
                    onClick={onToggleLock}
                    disabled={hostActionBusy || roomPhase !== 'waiting'}
                  >
                    {isRoomLocked ? 'Riapri ingressi' : 'Chiudi ingressi'}
                  </button>

                  <button
                    type="button"
                    className="cdr-room-secondary danger"
                    onClick={onFinishRoom}
                    disabled={hostActionBusy}
                  >
                    Chiudi stanza
                  </button>
                </div>
              )}
            </section>

            <aside className="cdr-room-card cdr-room-card-side">
              <div className="cdr-room-side-head">
                <div className="cdr-room-side-title">
                  <Users size={17} weight="fill" />
                  Partecipanti
                </div>

                <div className="cdr-room-count">
                  {participantCount}/{maxMembers}
                  {isRoomFull ? ' · completa' : ''}
                </div>
              </div>

              <div className="cdr-room-users">
                {roomUsers.length === 0 ? (
                  <div className="cdr-room-waiting">
                    Nessun partecipante visibile.
                  </div>
                ) : (
                  roomUsers.map((user) => {
                    const isSelf = user.id === currentUserId;
                    const userIsHost = user.id === hostActorId;

                    return (
                      <div className="cdr-room-user" key={user.id}>
                        <div
                          className={`cdr-room-avatar${isSelf ? ' self' : ''}${
                            avatarUrls[user.id] ? ' has-image' : ''
                          }`}
                        >
                          {avatarUrls[user.id] ? (
                            <img
                              className="cdr-room-avatar-img"
                              src={avatarUrls[user.id]}
                              alt={`Foto profilo di ${user.name}`}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            initials(user.name)
                          )}
                        </div>

                        <div>
                          <div className="cdr-room-user-name">
                            @{user.name}
                            {userIsHost && (
                              <span className="cdr-room-host-badge">HOST</span>
                            )}
                          </div>

                          <div className="cdr-room-user-meta">
                            {isSelf ? 'Tu' : 'Nella stanza'}
                          </div>
                        </div>

                        {isHost &&
                          !isSelf &&
                          !userIsHost &&
                          roomPhase === 'waiting' && (
                            <button
                              type="button"
                              className="cdr-room-remove"
                              title={`Rimuovi @${user.name}`}
                              disabled={hostActionBusy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Rimuovere @${user.name} dalla stanza?`
                                  )
                                ) {
                                  onRemoveParticipant(user.id);
                                }
                              }}
                            >
                              <X size={14} />
                            </button>
                          )}
                      </div>
                    );
                  })
                )}

                {availableSpots > 0 && !isExpired && (
                  <div className="cdr-room-waiting">
                    <span className="cdr-room-waiting-ring" />
                    <span>
                      {isReady
                        ? `${availableSpots} ${
                            availableSpots === 1
                              ? 'posto ancora disponibile'
                              : 'posti ancora disponibili'
                          }`
                        : isGroup
                          ? `In attesa di ${missingForStart} ${
                              missingForStart === 1 ? 'persona' : 'persone'
                            }`
                          : 'In attesa del partner'}
                    </span>
                  </div>
                )}
              </div>

              {isHost &&
                pendingRequests.length > 0 &&
                roomPhase === 'waiting' && (
                  <div className="cdr-room-pending">
                    <div className="cdr-room-pending-title">
                      <span>Richieste di ingresso</span>
                      <span>{pendingRequests.length}</span>
                    </div>

                    {pendingRequests.map((user) => (
                      <div className="cdr-room-request" key={user.id}>
                        <div
                          className={`cdr-room-avatar${
                            avatarUrls[user.id] ? ' has-image' : ''
                          }`}
                        >
                          {avatarUrls[user.id] ? (
                            <img
                              className="cdr-room-avatar-img"
                              src={avatarUrls[user.id]}
                              alt={`Foto profilo di ${user.name}`}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            initials(user.name)
                          )}
                        </div>

                        <div>
                          <div className="cdr-room-user-name">@{user.name}</div>
                          <div className="cdr-room-user-meta">
                            Vuole entrare nella stanza
                          </div>
                        </div>

                        <div className="cdr-room-request-actions">
                          <button
                            type="button"
                            className="cdr-room-request-btn"
                            onClick={() => onRejectParticipant(user.id)}
                            disabled={hostActionBusy}
                          >
                            Rifiuta
                          </button>

                          <button
                            type="button"
                            className="cdr-room-request-btn accept"
                            onClick={() => onApproveParticipant(user.id)}
                            disabled={hostActionBusy}
                          >
                            Accetta
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </aside>
          </div>

          <section className="cdr-room-join">
            <h2 className="cdr-room-join-title">Hai un altro codice?</h2>
            <p className="cdr-room-join-copy">
              Puoi passare direttamente a un’altra stanza senza tornare indietro.
            </p>

            <form className="cdr-room-join-form" onSubmit={onJoinByCode}>
              <input
                className="cdr-room-code-input"
                value={codeInput}
                onChange={(event) =>
                  setCodeInput(event.target.value.toUpperCase())
                }
                placeholder="ES. MAPLE-73"
                maxLength={10}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
              />

              <button
                type="submit"
                className="cdr-room-join-btn"
                disabled={codeInput.trim().length < 4}
              >
                <Door size={17} weight="fill" />
                <span>Entra con codice</span>
              </button>
            </form>

            {codeError && <div className="cdr-room-error">{codeError}</div>}
          </section>
        </div>
      </main>
    </>
  );
}
