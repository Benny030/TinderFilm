'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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

const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setGuestCookie(enabled: boolean) {
  if (typeof document === 'undefined') return;

  if (enabled) {
    document.cookie = `cineDateGuest=true; path=/; max-age=${GUEST_COOKIE_MAX_AGE}; samesite=lax`;
    return;
  }

  document.cookie = 'cineDateGuest=; path=/; max-age=0; samesite=lax';
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
      console.warn('Unable to load user profile:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error while loading user profile:', error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useRef(createBrowserClient()).current;

  const applySessionUser = async (session: Session) => {
    const userData = await getUserProfile(supabase, {
      id: session.user.id,
    });

    setCurrentUser((prev) => ({
      id: session.user.id,
      email: session.user.email ?? '',
      username: userData?.username ?? (prev?.isGuest === false && prev.id === session.user.id ? prev.username : ''),
      isGuest: false,
    }));

    sessionStorage.removeItem('cineDateGuest');
    sessionStorage.removeItem('cineDateGuestId');
    sessionStorage.removeItem('cineDateGuestName');
    setGuestCookie(false);

    setIsGuest(false);
    setGuestId(null);
    setGuestName(null);
  };

  useEffect(() => {
    if (router.pathname === '/auth/callback') {
      setIsLoading(false);
      return;
    }

    const sessionGuest = sessionStorage.getItem('cineDateGuest') === 'true';
    const sessionGuestId = sessionStorage.getItem('cineDateGuestId');
    const sessionGuestName = sessionStorage.getItem('cineDateGuestName');

    if (sessionGuest && sessionGuestId && sessionGuestName) {
      setIsGuest(true);
      setGuestId(sessionGuestId);
      setGuestName(sessionGuestName);
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Unable to read Supabase session:', error.message);
        }

        if (data.session?.user) {
          await applySessionUser(data.session);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Authentication initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setIsGuest(false);
            setGuestId(null);
            setGuestName(null);
            setIsLoading(false);
            return;
          }

          if (session?.user) {
            await applySessionUser(session);
          } else {
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Authentication state update failed:', error);
        } finally {
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router.pathname, supabase]);

  const enterAsGuest = () => {
    const newId = crypto.randomUUID();
    const newName = generateGuestName();

    sessionStorage.setItem('cineDateGuest', 'true');
    sessionStorage.setItem('cineDateGuestId', newId);
    sessionStorage.setItem('cineDateGuestName', newName);
    setGuestCookie(true);

    setIsGuest(true);
    setGuestId(newId);
    setGuestName(newName);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('cineDateGuest');
    sessionStorage.removeItem('cineDateGuestId');
    sessionStorage.removeItem('cineDateGuestName');
    setGuestCookie(false);
    setCurrentUser(null);
    setIsGuest(false);
    setGuestId(null);
    setGuestName(null);
  };

  return (
    <AuthContext.Provider value={{
      currentUser, isLoading, isGuest,
      guestId, guestName,
      enterAsGuest, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}