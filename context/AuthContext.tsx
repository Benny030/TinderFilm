'use client';

import { createContext, useContext, useEffect, useState, type ReactNode, useRef } from 'react';
import { createBrowserClient } from '@/utils/supabase/browser';
import type { CurrentUser } from '@/types';

type AuthContextType = {
  currentUser: CurrentUser | null;
  isLoading: boolean;
  isGuest: boolean;
  enterAsGuest: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoading: true,
  isGuest: false,
  enterAsGuest: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const supabase = useRef(createBrowserClient()).current;

  useEffect(() => {
    // ─── Controlla se era ospite ──────────────────────────────────────────
    const guestFlag = localStorage.getItem('cineDateGuest') === 'true';
    if (guestFlag) setIsGuest(true);

    // ─── Controlla sessione Supabase attiva ───────────────────────────────
    const initAuth = async () => {
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

    initAuth();

    // ─── Ascolta cambiamenti auth ─────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
          // ─── se era ospite e ora si logga, rimuovi flag ───────────────
          localStorage.removeItem('cineDateGuest');
          setIsGuest(false);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const enterAsGuest = () => {
    localStorage.setItem('cineDateGuest', 'true');
    setIsGuest(true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('cineDateGuest');
    setCurrentUser(null);
    setIsGuest(false);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, isGuest, enterAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}