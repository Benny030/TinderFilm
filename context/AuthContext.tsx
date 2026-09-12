'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/router';
import type { Session } from '@supabase/supabase-js';
import { createBrowserClient } from '@/utils/supabase/browser';
import type { CurrentUser } from '@/types';

type AuthContextType = {
  currentUser: CurrentUser | null;
  isLoading: boolean;
  isGuest: boolean;
  guestId: string | null;
  guestName: string | null;
  enterAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoading: true,
  isGuest: false,
  guestId: null,
  guestName: null,
  enterAsGuest: async () => {},
  signOut: async () => {},
});

const GUEST_STORAGE_KEY = 'cineDateGuestSession';

type StoredGuestSession = {
  id: string;
  name: string;
  expiresAt: number;
};

function clearLegacyGuestStorage() {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem('cineDateGuest');
  sessionStorage.removeItem('cineDateGuestId');
  sessionStorage.removeItem('cineDateGuestName');
}

function clearStoredGuestSession() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(GUEST_STORAGE_KEY);
  clearLegacyGuestStorage();
}

function readStoredGuestSession(): StoredGuestSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredGuestSession>;

    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      clearStoredGuestSession();
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      clearStoredGuestSession();
      return null;
    }

    return {
      id: parsed.id,
      name: parsed.name,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    clearStoredGuestSession();
    return null;
  }
}

function writeStoredGuestSession(
  session: StoredGuestSession
) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(
    GUEST_STORAGE_KEY,
    JSON.stringify(session)
  );

  clearLegacyGuestStorage();
}

async function requestGuestSession(): Promise<StoredGuestSession> {
  const response = await fetch('/api/auth/guest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || 'Impossibile creare la sessione ospite'
    );
  }

  if (
    typeof data.id !== 'string' ||
    typeof data.name !== 'string' ||
    typeof data.expiresAt !== 'number'
  ) {
    throw new Error('Sessione ospite non valida');
  }

  return {
    id: data.id,
    name: data.name,
    expiresAt: data.expiresAt,
  };
}

async function revokeGuestServerSession() {
  try {
    await fetch('/api/auth/guest', {
      method: 'DELETE',
    });
  } catch (error) {
    console.warn(
      'Unable to clear server guest session:',
      error
    );
  }
}

async function getUserProfile(
  supabase: ReturnType<typeof createBrowserClient>,
  user: { id: string }
) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn(
        'Unable to load user profile:',
        error.message
      );
      return null;
    }

    return data;
  } catch (error) {
    console.error(
      'Unexpected error while loading user profile:',
      error
    );
    return null;
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [isGuest, setIsGuest] =
    useState(false);

  const [guestId, setGuestId] =
    useState<string | null>(null);

  const [guestName, setGuestName] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const supabase =
    useRef(createBrowserClient()).current;

  const applySessionUser = async (
    session: Session
  ) => {
    const userData =
      await getUserProfile(
        supabase,
        {
          id: session.user.id,
        }
      );

    setCurrentUser((prev) => ({
      id: session.user.id,
      email:
        session.user.email ?? '',
      username:
        userData?.username ??
        (
          prev?.isGuest === false &&
          prev.id === session.user.id
            ? prev.username
            : ''
        ),
      isGuest: false,
    }));

    clearStoredGuestSession();
    await revokeGuestServerSession();

    setIsGuest(false);
    setGuestId(null);
    setGuestName(null);
  };

  useEffect(() => {
    if (
      router.pathname ===
      '/auth/callback'
    ) {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        const {
          data,
          error,
        } =
          await supabase.auth.getSession();

        if (error) {
          console.warn(
            'Unable to read Supabase session:',
            error.message
          );
        }

        if (data.session?.user) {
          await applySessionUser(
            data.session
          );
          return;
        }

        setCurrentUser(null);

        const storedGuest =
          readStoredGuestSession();

        if (storedGuest) {
          /*
           * Non ci fidiamo dell'UUID nel localStorage.
           * Chiediamo sempre al server l'identità guest firmata.
           *
           * - Se il cookie firmato è valido, il server restituisce
           *   la stessa identità.
           * - Se il browser proviene dalla vecchia implementazione,
           *   il server crea una nuova identità autorevole.
           */
          const serverGuest =
            await requestGuestSession();

          writeStoredGuestSession(
            serverGuest
          );

          setIsGuest(true);
          setGuestId(
            serverGuest.id
          );
          setGuestName(
            serverGuest.name
          );
          return;
        }

        setIsGuest(false);
        setGuestId(null);
        setGuestName(null);
      } catch (error) {
        console.error(
          'Authentication initialization failed:',
          error
        );

        clearStoredGuestSession();
        setCurrentUser(null);
        setIsGuest(false);
        setGuestId(null);
        setGuestName(null);
      } finally {
        setIsLoading(false);
      }
    };

    void init();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
  async (
    event,
    session
  ) => {
    // L'inizializzazione iniziale è già gestita da init().
    // Evita che isLoading diventi false mentre il guest
    // firmato è ancora in fase di ripristino.
    if (event === 'INITIAL_SESSION') {
      return;
    }

    try {
            if (
              event ===
              'SIGNED_OUT'
            ) {
              setCurrentUser(
                null
              );

              const storedGuest =
                readStoredGuestSession();

              if (
                storedGuest
              ) {
                const serverGuest =
                  await requestGuestSession();

                writeStoredGuestSession(
                  serverGuest
                );

                setIsGuest(
                  true
                );
                setGuestId(
                  serverGuest.id
                );
                setGuestName(
                  serverGuest.name
                );
              } else {
                setIsGuest(
                  false
                );
                setGuestId(
                  null
                );
                setGuestName(
                  null
                );
              }

              setIsLoading(
                false
              );

              return;
            }

            if (
              session?.user
            ) {
              await applySessionUser(
                session
              );
            } else {
              setCurrentUser(
                null
              );
            }
          } catch (error) {
            console.error(
              'Authentication state update failed:',
              error
            );
          } finally {
            setIsLoading(
              false
            );
          }
        }
      );

    return () =>
      subscription.unsubscribe();
  }, [
    router.pathname,
    supabase,
  ]);

  const enterAsGuest = async () => {
    const serverGuest =
      await requestGuestSession();

    writeStoredGuestSession(
      serverGuest
    );

    setCurrentUser(null);
    setIsGuest(true);
    setGuestId(serverGuest.id);
    setGuestName(serverGuest.name);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await revokeGuestServerSession();

    clearStoredGuestSession();

    setCurrentUser(null);
    setIsGuest(false);
    setGuestId(null);
    setGuestName(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        isGuest,
        guestId,
        guestName,
        enterAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(
    AuthContext
  );
}
