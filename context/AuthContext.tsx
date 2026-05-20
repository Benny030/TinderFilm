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

async function getUserProfile(
  supabase: ReturnType<typeof createBrowserClient>,
  user: { id: string; email?: string }
) {
  const { data: byId } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (byId?.username || !user.email) return byId;

  const { data: byEmail } = await supabase
    .from('users')
    .select('username')
    .eq('email', user.email)
    .maybeSingle();

  return byEmail;
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
      email: session.user.email,
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
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await applySessionUser(session);
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setIsGuest(false);
          setGuestId(null);
          setGuestName(null);
          return;
        }

        if (
          session?.user &&
          ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)
        ) {
          await applySessionUser(session);
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

    setIsGuest(true);
    setGuestId(newId);
    setGuestName(newName);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('cineDateGuest');
    sessionStorage.removeItem('cineDateGuestId');
    sessionStorage.removeItem('cineDateGuestName');
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
