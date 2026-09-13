import {
  useEffect,
  useLayoutEffect,
} from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@/hooks/useAuth';
import { normalizeRoomCode } from '@/utils/roomCode';

const STORAGE_KEY =
  'cinedate:pending-room-return';

const MAX_AGE_MS =
  24 * 60 * 60 * 1000;

type PendingRoomReturn = {
  path: string;
  createdAt: number;
};

const useBrowserLayoutEffect =
  typeof window !== 'undefined'
    ? useLayoutEffect
    : useEffect;

function getStoredReturn():
  | PendingRoomReturn
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw) as
        Partial<PendingRoomReturn>;

    if (
      typeof parsed.path !== 'string' ||
      typeof parsed.createdAt !== 'number' ||
      !parsed.path.startsWith(
        '/stanza?room='
      )
    ) {
      window.sessionStorage.removeItem(
        STORAGE_KEY
      );
      return null;
    }

    if (
      Date.now() -
        parsed.createdAt >
      MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(
        STORAGE_KEY
      );
      return null;
    }

    return {
      path: parsed.path,
      createdAt:
        parsed.createdAt,
    };
  } catch {
    window.sessionStorage.removeItem(
      STORAGE_KEY
    );

    return null;
  }
}

function saveCurrentRoomReturn() {
  if (typeof window === 'undefined') {
    return;
  }

  if (
    window.location.pathname !==
    '/stanza'
  ) {
    return;
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  const rawRoom =
    params.get('room');

  if (!rawRoom) {
    return;
  }

  const roomId =
    normalizeRoomCode(
      rawRoom
    );

  if (!roomId) {
    return;
  }

  const payload: PendingRoomReturn = {
    path:
      `/stanza?room=${encodeURIComponent(
        roomId
      )}`,
    createdAt:
      Date.now(),
  };

  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(payload)
  );
}

function clearRoomReturn() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(
    STORAGE_KEY
  );
}

export default function SharedRoomFlowGuard() {
  const router = useRouter();

  const {
    currentUser,
    isGuest,
    isLoading,
  } = useAuth();

  /*
   * Salva il deep-link PRIMA dei normali useEffect
   * della pagina stanza.
   *
   * Non dipende da AuthContext:
   * anche se isLoading è ancora true, il browser
   * conosce già /stanza?room=XXXX.
   */
  useBrowserLayoutEffect(() => {
    saveCurrentRoomReturn();
  }, [
    router.asPath,
  ]);

  /*
   * Se siamo entrati davvero nella stanza con una
   * sessione valida, il ritorno pendente non serve più.
   */
  useEffect(() => {
    if (
      router.pathname !==
        '/stanza' ||
      isLoading
    ) {
      return;
    }

    if (
      currentUser ||
      isGuest
    ) {
      clearRoomReturn();
    }
  }, [
    router.pathname,
    currentUser,
    isGuest,
    isLoading,
  ]);

  /*
   * auth.tsx nella repo porta Guest/Login a /home.
   *
   * Quando la sessione è pronta, se esiste una stanza
   * salvata torniamo automaticamente lì.
   */
  useEffect(() => {
    if (
      router.pathname !== '/home' ||
      isLoading ||
      (!currentUser && !isGuest)
    ) {
      return;
    }

    const pending =
      getStoredReturn();

    if (!pending) {
      return;
    }

    clearRoomReturn();

    void router.replace(
      pending.path
    );
  }, [
    router,
    router.pathname,
    currentUser,
    isGuest,
    isLoading,
  ]);

  return null;
}
