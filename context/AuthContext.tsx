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
import { generateGuestName } from '@/utils/guestName';

type AuthContextType = {
  currentUser: CurrentUser | null;
  isLoading: boolean;
  isGuest: boolean;
  guestId: string | null;
  guestName: string | null;
  enterAsGuest: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoading: true,
  isGuest: false,
  guestId: null,
  guestName: null,
  enterAsGuest: () => {},
  signOut: async () => {},
});

const GUEST_TTL_MS = 24 * 60 * 60 * 1000;
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24;

const GUEST_STORAGE_KEY = 'cineDateGuestSession';

type StoredGuestSession = {
  id: string;
  name: string;
  expiresAt: number;
};

function setGuestCookie(enabled: boolean) {
  if (typeof document === 'undefined') return;

  if (enabled) {
    document.cookie =
      `cineDateGuest=true; path=/; max-age=${GUEST_COOKIE_MAX_AGE}; samesite=lax`;
    return;
  }

  document.cookie =
    'cineDateGuest=; path=/; max-age=0; samesite=lax';
}

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
  setGuestCookie(false);
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

function writeStoredGuestSession(id: string, name: string) {
  if (typeof window === 'undefined') return;

  const session: StoredGuestSession = {
    id,
    name,
    expiresAt: Date.now() + GUEST_TTL_MS,
  };

  localStorage.setItem(
    GUEST_STORAGE_KEY,
    JSON.stringify(session)
  );

  clearLegacyGuestStorage();
  setGuestCookie(true);
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

    /*
     * Prima controlliamo Supabase.
     *
     * Se esiste un account autenticato, l'account
     * ha sempre priorità sul guest.
     *
     * Se non esiste una sessione Supabase,
     * proviamo a ripristinare il guest persistente.
     */
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
          setIsGuest(true);
          setGuestId(
            storedGuest.id
          );
          setGuestName(
            storedGuest.name
          );

          /*
           * Rinnova solo il cookie tecnico per il tempo
           * residuo massimo previsto dal guest.
           * L'identità vera rimane governata da expiresAt.
           */
          setGuestCookie(true);
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
                setIsGuest(
                  true
                );
                setGuestId(
                  storedGuest.id
                );
                setGuestName(
                  storedGuest.name
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

  const enterAsGuest = () => {
    /*
     * Se esiste già un guest valido, lo riutilizziamo.
     * Così anche se il pulsante viene premuto di nuovo
     * non creiamo una seconda identità.
     */
    const existing =
      readStoredGuestSession();

    if (existing) {
      setIsGuest(true);
      setGuestId(existing.id);
      setGuestName(
        existing.name
      );
      setGuestCookie(true);
      return;
    }

    const newId =
      crypto.randomUUID();

    const newName =
      generateGuestName();

    writeStoredGuestSession(
      newId,
      newName
    );

    setCurrentUser(null);
    setIsGuest(true);
    setGuestId(newId);
    setGuestName(newName);
  };

  const signOut = async () => {
    await supabase.auth.signOut();

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