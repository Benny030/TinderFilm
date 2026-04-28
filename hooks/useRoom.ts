import { useState, useEffect, type FormEvent } from 'react';

const LOCAL_STORAGE_PREFIX = 'cineDateUser:';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type UseRoomOptions = {
  roomId: string;
  onJoined?: () => void;
};

export function useRoom({ roomId, onJoined }: UseRoomOptions) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // ─── Ripristino utente da localStorage ───────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${roomId}`);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.id && parsed?.name) {
        setCurrentUserId(parsed.id);
        setCurrentUserName(parsed.name);
        setNameInput(parsed.name);
        onJoined?.();
      }
    } catch {}
  }, [roomId]);

  // ─── Join stanza ─────────────────────────────────────────────────────────────
  const handleJoinRoom = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!nameInput.trim()) {
      setStatusMessage('Inserisci un nome valido!');
      return;
    }
    setIsJoining(true);
    const id = currentUserId || generateUUID();
    const name = nameInput.trim();
    setCurrentUserId(id);
    setCurrentUserName(name);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        `${LOCAL_STORAGE_PREFIX}${roomId}`,
        JSON.stringify({ id, name })
      );
    }
    setStatusMessage('');
    setIsJoining(false);
    onJoined?.();
  };

  // ─── Condividi link ───────────────────────────────────────────────────────────
  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'CineDate - Stanza condivisa',
          text: 'Unisciti alla mia stanza per scegliere un film insieme!',
          url,
        });
        setCopyMessage('Condiviso!');
      } else {
        await navigator.clipboard.writeText(url);
        setCopyMessage('Link copiato!');
      }
    } catch {
      setCopyMessage('Condivisione annullata');
    } finally {
      setTimeout(() => setCopyMessage(''), 2000);
    }
  };

  return {
    currentUserId,
    currentUserName,
    nameInput,
    setNameInput,
    isJoining,
    copyMessage,
    statusMessage,
    setStatusMessage,
    handleJoinRoom,
    handleCopyLink,
  };
}