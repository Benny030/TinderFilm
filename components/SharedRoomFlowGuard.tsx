import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@/hooks/useAuth';
import { normalizeRoomCode } from '@/utils/roomCode';

const STORAGE_KEY = 'cinedate:pending-room-return';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type PendingRoomReturn = {
  path: string;
  createdAt: number;
};

function getRoomPath(roomId: string) {
  return `/stanza?room=${encodeURIComponent(roomId)}`;
}

function getStoredReturn(): PendingRoomReturn | null {
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

function clearRoomReturn() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(
    STORAGE_KEY
  );
}

function temporarilyMarkShared(
  button: HTMLButtonElement
) {
  const textNode =
    Array.from(
      button.childNodes
    ).find(
      (node) =>
        node.nodeType ===
          Node.TEXT_NODE &&
        node.textContent?.trim()
    );

  if (!textNode) {
    return;
  }

  const previousText =
    textNode.textContent;

  textNode.textContent =
    ' Condiviso';

  window.setTimeout(() => {
    if (textNode.isConnected) {
      textNode.textContent =
        previousText;
    }
  }, 1800);
}

export default function SharedRoomFlowGuard() {
  const router = useRouter();

  const {
    currentUser,
    isGuest,
    isLoading,
  } = useAuth();

  const roomId =
    useMemo(() => {
      const rawRoom =
        router.query.room;

      const value =
        Array.isArray(rawRoom)
          ? rawRoom[0]
          : rawRoom;

      if (
        typeof value !== 'string'
      ) {
        return '';
      }

      return normalizeRoomCode(
        value
      );
    }, [router.query.room]);

  /*
   * IMPORTANTE
   * ----------
   * NON facciamo più redirect da /stanza a /auth qui.
   *
   * Quello viene gestito direttamente da pages/stanza.tsx:
   * 1. salva cinedate:pending-room-return
   * 2. poi esegue router.replace('/auth?...')
   *
   * In questo modo non esiste più la race tra due useEffect.
   */

  /*
   * Dopo login / guest / OAuth / onboarding,
   * se il flusso esistente arriva su /home,
   * torniamo alla stanza salvata.
   *
   * Il guest può anche essere mandato direttamente alla stanza
   * da auth.tsx; in quel caso lo storage è già stato rimosso.
   */
  useEffect(() => {
    if (
      !router.isReady ||
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
    router.isReady,
    router.pathname,
    currentUser,
    isGuest,
    isLoading,
  ]);

  /*
   * Condivisione link stanza.
   *
   * Intercettiamo il bottone esistente senza modificare WelcomeRoom.
   */
  useEffect(() => {
    if (
      router.pathname !==
        '/stanza' ||
      !roomId
    ) {
      return;
    }

    const onClickCapture =
      async (
        event: MouseEvent
      ) => {
        const target =
          event.target as
            HTMLElement | null;

        const button =
          target?.closest(
            'button.cdr-room-mini-btn'
          ) as
            | HTMLButtonElement
            | null;

        if (!button) {
          return;
        }

        const label =
          button.textContent
            ?.trim()
            .toLowerCase() ??
          '';

        if (
          !label.includes(
            'condividi'
          ) &&
          !label.includes(
            'condiviso'
          )
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const relativeUrl =
          getRoomPath(
            roomId
          );

        const absoluteUrl =
          `${window.location.origin}${relativeUrl}`;

        const shareText =
          `Entra nella mia stanza CineDate.\n` +
          `Codice: ${roomId}`;

        try {
          if (
            navigator.share
          ) {
            await navigator.share({
              title:
                'CineDate',
              text:
                shareText,
              url:
                absoluteUrl,
            });
          } else {
            await navigator.clipboard.writeText(
              `${shareText}\n${absoluteUrl}`
            );
          }

          temporarilyMarkShared(
            button
          );
        } catch {
          // Condivisione annullata.
        }
      };

    document.addEventListener(
      'click',
      onClickCapture,
      true
    );

    return () => {
      document.removeEventListener(
        'click',
        onClickCapture,
        true
      );
    };
  }, [
    router.pathname,
    roomId,
  ]);

  return null;
}
