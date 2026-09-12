import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import {
  DoorOpen,
  X,
} from '@phosphor-icons/react';

import { useTheme } from '@/context/ThemeContext';
import {
  FONT,
  R,
  THEME,
} from '@/styles/token';

type RoomPhase =
  | 'waiting'
  | 'voting'
  | 'matched'
  | 'planning'
  | 'finished'
  | 'expired';

type PendingExit = {
  nextUrl: string;
} | null;

function isStanzaUrl(url: string) {
  const path =
    url.split('?')[0].split('#')[0];

  return path === '/stanza';
}

export default function RoomLifecycleGuard() {
  const router = useRouter();
  const { theme } = useTheme();

  const P =
    theme === 'dark'
      ? THEME.dark
      : THEME.light;

  const [roomPhase, setRoomPhase] =
    useState<RoomPhase | null>(null);

  const [
    participantCount,
    setParticipantCount,
  ] = useState<number | null>(null);

  const [
    pendingExit,
    setPendingExit,
  ] = useState<PendingExit>(null);

  const [
    leaving,
    setLeaving,
  ] = useState(false);

  const roomIdRef = useRef('');
  const allowNextRouteRef =
    useRef(false);

  // Match già notificati a questo client.
  // Serve come fallback al realtime: ogni match viene aperto una sola volta.
  const seenMatchIdsRef =
    useRef<Set<string>>(new Set());

  const refreshState = async (
    roomId: string
  ) => {
    try {
      const [
        roomRes,
        participantsRes,
        swipesRes,
      ] = await Promise.all([
        fetch(
          `/api/rooms?id=${encodeURIComponent(
            roomId
          )}`
        ),
        fetch(
          `/api/room-participants?roomId=${encodeURIComponent(
            roomId
          )}`
        ),
        fetch(
          `/api/swipes?roomId=${encodeURIComponent(
            roomId
          )}`
        ),
      ]);

      if (roomRes.ok) {
        const room =
          await roomRes.json();

        if (
          [
            'waiting',
            'voting',
            'matched',
            'planning',
            'finished',
            'expired',
          ].includes(room.room_phase)
        ) {
          setRoomPhase(
            room.room_phase
          );
        }
      }

      if (participantsRes.ok) {
        const participants =
          await participantsRes.json();

        setParticipantCount(
          Array.isArray(participants)
            ? participants.length
            : 0
        );
      }

      /*
       * Fallback al broadcast realtime.
       *
       * Appena il server registra un nuovo match durante voting,
       * notifichiamo la pagina stanza tramite CustomEvent.
       * Il Set evita di riaprire lo stesso MatchScreen dopo "continua".
       */
      if (swipesRes.ok) {
        const payload =
          await swipesRes.json();

        const matches =
          Array.isArray(payload.matches)
            ? payload.matches
            : [];

        for (const match of matches) {
          const matchId =
            String(match.id ?? '');
          const movieId =
            String(match.movie_id ?? '');

          if (
            !matchId ||
            !movieId ||
            seenMatchIdsRef.current.has(matchId)
          ) {
            continue;
          }

          seenMatchIdsRef.current.add(matchId);

          window.dispatchEvent(
            new CustomEvent(
              'cinedate:group-match',
              {
                detail: {
                  matchId,
                  movieId,
                },
              }
            )
          );
        }
      }
    } catch {
      // Il prossimo polling ritenta.
    }
  };

  const leaveRoom = async () => {
    const roomId =
      roomIdRef.current;

    if (!roomId) {
      return true;
    }

    const response =
      await fetch(
        '/api/room-leave',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            roomId,
          }),
        }
      );

    if (!response.ok) {
      return false;
    }

    return true;
  };

  useEffect(() => {
    if (
      router.pathname !== '/stanza'
    ) {
      roomIdRef.current = '';
      setRoomPhase(null);
      setParticipantCount(null);
      return;
    }

    const rawRoom =
      router.query.room;

    const roomId =
      Array.isArray(rawRoom)
        ? rawRoom[0]
        : rawRoom;

    if (
      !roomId ||
      typeof roomId !== 'string'
    ) {
      return;
    }

    const normalized =
      roomId
        .trim()
        .toUpperCase();

    roomIdRef.current =
      normalized;

    void refreshState(normalized);

    const timer =
      window.setInterval(
        () => {
          void refreshState(
            normalized
          );
        },
        2000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    router.pathname,
    router.query.room,
  ]);

  /*
   * Il bottone "Stanza" di SwipeCard non cambia URL:
   * intercettiamo il click in capture PRIMA del suo onClick React.
   */
  useEffect(() => {
    const onDocumentClick = (
      event: MouseEvent
    ) => {
      if (
        router.pathname !==
          '/stanza' ||
        roomPhase !== 'voting'
      ) {
        return;
      }

      const target =
        event.target as
          | HTMLElement
          | null;

      const backButton =
        target?.closest(
          '.cdr-swipe-back'
        );

      if (!backButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      setPendingExit({
        nextUrl:
          '/crea-stanza',
      });
    };

    document.addEventListener(
      'click',
      onDocumentClick,
      true
    );

    return () => {
      document.removeEventListener(
        'click',
        onDocumentClick,
        true
      );
    };
  }, [
    router.pathname,
    roomPhase,
  ]);

  /*
   * Intercetta anche navigazione menu/browser mentre voting è attivo.
   */
  useEffect(() => {
    const onRouteChangeStart = (
      nextUrl: string
    ) => {
      if (
        allowNextRouteRef.current
      ) {
        allowNextRouteRef.current =
          false;
        return;
      }

      if (
        router.pathname !==
          '/stanza' ||
        isStanzaUrl(nextUrl)
      ) {
        return;
      }

      if (
        roomPhase !== 'voting'
      ) {
        /*
         * Prima della votazione uscire da /stanza
         * significa uscire davvero dalla room.
         */
        void leaveRoom();
        return;
      }

      setPendingExit({
        nextUrl,
      });

      router.events.emit(
        'routeChangeError'
      );

      // Next.js usa l'eccezione per interrompere la navigazione.
      throw new Error(
        'CINEDATE_ROUTE_CANCELLED'
      );
    };

    router.events.on(
      'routeChangeStart',
      onRouteChangeStart
    );

    return () => {
      router.events.off(
        'routeChangeStart',
        onRouteChangeStart
      );
    };
  }, [
    router,
    roomPhase,
  ]);

  const cancelExit = () => {
    if (leaving) return;
    setPendingExit(null);
  };

  const confirmExit = async () => {
    if (
      leaving ||
      !pendingExit
    ) {
      return;
    }

    setLeaving(true);

    try {
      const ok =
        await leaveRoom();

      if (!ok) {
        return;
      }

      const destination =
        pendingExit.nextUrl;

      setPendingExit(null);

      allowNextRouteRef.current =
        true;

      await router.push(
        destination
      );
    } finally {
      setLeaving(false);
    }
  };


  /*
   * Conteggio partecipanti integrato nell'header dello swipe.
   *
   * Evitiamo createPortal/react-dom: aggiungiamo un piccolo elemento
   * direttamente dentro .cdr-swipe-user e lo rimuoviamo al cleanup.
   * Risultato visivo: @nome · 3
   */
  useEffect(() => {
    if (
      router.pathname !== '/stanza' ||
      roomPhase !== 'voting' ||
      participantCount === null
    ) {
      return;
    }

    const userLabel = document.querySelector(
      '.cdr-swipe-user'
    ) as HTMLElement | null;

    if (!userLabel) return;

    let counter = userLabel.querySelector(
      '[data-cdr-participant-count]'
    ) as HTMLSpanElement | null;

    if (!counter) {
      counter = document.createElement('span');
      counter.setAttribute(
        'data-cdr-participant-count',
        'true'
      );

      Object.assign(counter.style, {
        marginLeft: '7px',
        paddingLeft: '7px',
        borderLeft: `1px solid ${P.border}`,
        color: P.textMuted,
        fontSize: '11px',
        fontWeight: '750',
        letterSpacing: '0',
        opacity: '0.9',
      });

      userLabel.appendChild(counter);
    }

    counter.textContent = String(participantCount);
    counter.title = `${participantCount} partecipanti`;

    return () => {
      counter?.remove();
    };
  }, [
    router.pathname,
    roomPhase,
    participantCount,
    P.border,
    P.textMuted,
  ]);

  const showVotingUI =
    router.pathname ===
      '/stanza' &&
    roomPhase ===
      'voting';

  return (
    <>

      {pendingExit && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cancelExit();
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20000,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            background:
              'rgba(10,8,6,.58)',
            backdropFilter:
              'blur(8px)',
            WebkitBackdropFilter:
              'blur(8px)',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cdr-leave-title"
            style={{
              width:
                'min(430px, 100%)',
              border: `1px solid ${P.border}`,
              borderRadius:
                R.md,
              background:
                P.surface,
              color: P.text,
              boxShadow:
                '0 28px 80px rgba(0,0,0,.30)',
              overflow:
                'hidden',
              fontFamily:
                FONT.sans,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems:
                  'flex-start',
                justifyContent:
                  'space-between',
                gap: 16,
                padding:
                  '20px 20px 14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems:
                    'flex-start',
                }}
              >
                <div
                  style={{
                    flex: '0 0 auto',
                    width: 40,
                    height: 40,
                    display: 'grid',
                    placeItems:
                      'center',
                    borderRadius:
                      R.sm,
                    background:
                      P.primaryGlow,
                    color:
                      P.primary,
                  }}
                >
                  <DoorOpen
                    size={20}
                    weight="duotone"
                  />
                </div>

                <div>
                  <h2
                    id="cdr-leave-title"
                    style={{
                      margin: 0,
                      fontFamily:
                        FONT.display,
                      fontSize: 24,
                      lineHeight: 1.05,
                    }}
                  >
                    Vuoi uscire dalla votazione?
                  </h2>

                  <p
                    style={{
                      margin:
                        '9px 0 0',
                      color:
                        P.textMuted,
                      fontSize: 12,
                      lineHeight: 1.55,
                    }}
                  >
                    Se esci, i tuoi voti verranno rimossi e il risultato del gruppo sarà ricalcolato sulle persone rimaste. Non potrai rientrare in questa votazione.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  cancelExit
                }
                disabled={
                  leaving
                }
                aria-label="Chiudi"
                style={{
                  width: 34,
                  height: 34,
                  flex: '0 0 auto',
                  display: 'grid',
                  placeItems:
                    'center',
                  border: `1px solid ${P.border}`,
                  borderRadius:
                    R.sm,
                  background:
                    'transparent',
                  color:
                    P.textMuted,
                  cursor:
                    leaving
                      ? 'default'
                      : 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: 10,
                padding:
                  '14px 20px 20px',
                borderTop: `1px solid ${P.border}`,
              }}
            >
              <button
                type="button"
                onClick={
                  cancelExit
                }
                disabled={
                  leaving
                }
                style={{
                  minHeight: 44,
                  border: `1px solid ${P.border}`,
                  borderRadius:
                    R.sm,
                  background:
                    'transparent',
                  color: P.text,
                  fontFamily:
                    FONT.sans,
                  fontSize: 12,
                  fontWeight: 850,
                  cursor:
                    leaving
                      ? 'default'
                      : 'pointer',
                }}
              >
                Resta nella stanza
              </button>

              <button
                type="button"
                onClick={() => {
                  void confirmExit();
                }}
                disabled={
                  leaving
                }
                style={{
                  minHeight: 44,
                  border: `1px solid ${P.primary}`,
                  borderRadius:
                    R.sm,
                  background:
                    P.primary,
                  color: '#fff',
                  fontFamily:
                    FONT.sans,
                  fontSize: 12,
                  fontWeight: 900,
                  cursor:
                    leaving
                      ? 'default'
                      : 'pointer',
                  opacity:
                    leaving
                      ? 0.65
                      : 1,
                }}
              >
                {leaving
                  ? 'Uscita…'
                  : 'Esci dalla votazione'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
