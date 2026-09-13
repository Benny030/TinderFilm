import { useEffect } from 'react';
import { useRouter } from 'next/router';

import { normalizeRoomCode } from '@/utils/roomCode';

const STORAGE_KEY = 'cinedate:pending-room-return';

export default function AuthRoomReturnCapture() {
  const router = useRouter();

  useEffect(() => {
    if (
      !router.isReady ||
      router.pathname !== '/auth'
    ) {
      return;
    }

    const rawFromRoom =
      Array.isArray(router.query.fromRoom)
        ? router.query.fromRoom[0]
        : router.query.fromRoom;

    if (typeof rawFromRoom !== 'string') {
      return;
    }

    const roomId =
      normalizeRoomCode(rawFromRoom);

    if (!roomId) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          path:
            `/stanza?room=${encodeURIComponent(roomId)}`,
          createdAt: Date.now(),
        })
      );
    } catch (error) {
      console.warn(
        'Unable to save room return destination:',
        error
      );
    }
  }, [
    router.isReady,
    router.pathname,
    router.query.fromRoom,
  ]);

  return null;
}
