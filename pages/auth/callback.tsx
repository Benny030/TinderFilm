import { useState, useEffect, useRef, type FormEvent } from 'react';import { useRouter } from 'next/router';
import { createBrowserClient } from '@/utils/supabase/browser';

export default function AuthCallback() {
  const router = useRouter();
const supabase = useRef(createBrowserClient()).current;
  useEffect(() => {
    const handle = async () => {
      // ─── Supabase mette i token nell'hash dell'URL ────────────────────
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Controlla se ha già uno username
        const { data } = await supabase
          .from('users')
          .select('username')
          .eq('id', session.user.id)
          .single();

        if (data?.username) {
          router.replace('/');
        } else {
          router.replace('/username');
        }
      } else {
        router.replace('/auth');
      }
    };

    handle();
  }, []);

  return (
    <div style={{
      height: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#FAF3E0', fontSize: '32px',
    }}>
      🎬
    </div>
  );
}