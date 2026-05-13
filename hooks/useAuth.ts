import { useAuth as useAuthContext } from '@/context/AuthContext';
import { useRouter } from 'next/router';

export function useAuth() {
  const {
    currentUser, isLoading, isGuest,
    guestId, guestName,
    enterAsGuest, signOut,
  } = useAuthContext();
  const router = useRouter();

  const isLoggedIn = currentUser !== null && currentUser.isGuest === false;

  const requireAuth = (callback: () => void) => {
    if (!isLoggedIn) {
      router.push('/auth');
      return;
    }
    callback();
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  return {
    currentUser,
    isLoading,
    isGuest,
    isLoggedIn,
    guestId,
    guestName,
    enterAsGuest,
    requireAuth,
    signOut: handleSignOut,
  };
}