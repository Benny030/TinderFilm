'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useRef(createBrowserClient()).current;

  useEffect(() => {
    // ─── sessionStorage: isolato per tab ─────────────────────────────────
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
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('username')
          .eq('id', session.user.id)
          .single();

        setCurrentUser({
          id: session.user.id,
          email: session.user.email ?? '',
          username: userData?.username ?? '',
          isGuest: false,
        });
      }

      setIsLoading(false);
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
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('username')
            .eq('id', session.user.id)
            .single();

          setCurrentUser({
            id: session.user.id,
            email: session.user.email ?? '',
            username: userData?.username ?? '',
            isGuest: false,
          });
          // ─── loggato → pulisci sessione ospite ────────────────────────
          sessionStorage.removeItem('cineDateGuest');
          sessionStorage.removeItem('cineDateGuestId');
          sessionStorage.removeItem('cineDateGuestName');
          setIsGuest(false);
          setGuestId(null);
          setGuestName(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const enterAsGuest = () => {
    // ─── genera identità unica per questa tab ─────────────────────────────
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