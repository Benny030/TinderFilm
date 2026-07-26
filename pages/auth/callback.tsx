import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import type { Session } from '@supabase/supabase-js';
import { createBrowserClient } from '@/utils/supabase/browser';
import { C, FONT, TEXT, S, R } from '@/styles/token';
import { FilmSlate, CheckCircle, Warning } from '@phosphor-icons/react';

type Status = 'loading' | 'success' | 'error';

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

export default function AuthCallback() {
  const router = useRouter();
  const supabase = useRef(createBrowserClient()).current;
  const handledRef = useRef(false);

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Verifica in corso...');

  useEffect(() => {
    // ─── Aspetta che il router sia pronto prima di leggere i params ───────────
    if (!router.isReady) return;
    if (handledRef.current) return;
    handledRef.current = true;

    const handle = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          window.location.hash.replace(/^#/, '')
        );

        const code          = searchParams.get('code');
        const tokenHash     = searchParams.get('token_hash');
        const type          = searchParams.get('type') as any;
        const accessToken   = hashParams.get('access_token');
        const refreshToken  = hashParams.get('refresh_token');
        const authError     = searchParams.get('error') ?? hashParams.get('error');
        const errorDesc     = searchParams.get('error_description') ?? hashParams.get('error_description');

        if (authError) throw new Error(errorDesc ?? authError);

        let session: Session | null = null;

        // ─── Subito dopo exchangeCodeForSession ───────────────────────────────────
if (code) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  console.log('exchangeCodeForSession result:', {
    session: data.session ? 'EXISTS' : 'NULL',
    userId: data.session?.user?.id,
    error: error?.message,
  });
  if (error && error.name !== 'AuthPKCECodeVerifierMissingError') {
    throw error;
  }
  if (error) throw error;
  session = data.session;
} else if (accessToken && refreshToken) {
          // ─── Implicit flow ────────────────────────────────────────────────
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          session = data.session;

        } else if (tokenHash && type) {
          // ─── Email OTP ────────────────────────────────────────────────────
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) {
            const { data: existing } = await supabase.auth.getSession();
            if (!existing.session?.user) throw error;
            session = existing.session;
          } else {
            session = data.session;
          }

        } else {
          // ─── Nessun parametro — prova a leggere sessione esistente ────────
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        

        if (!session?.user) {
          setStatus('error');
          setMessage('Sessione non trovata. Riprova il login.');
          setTimeout(() => { window.location.href = '/auth'; }, 2500);
          return;
        }

        // ─── Controlla se ha già uno username ─────────────────────────────────
        const profile = await getUserProfile(supabase, {
          id: session.user.id,
          email: session.user.email,
        });

        // ─── Prima del redirect ───────────────────────────────────────────────────
        console.log('Profile check:', {
          username: profile?.username,
          redirectTo: profile?.username ? '/home' : '/username',
          sessionUser: session?.user?.id,
        });

        setStatus('success');

        if (profile?.username) {
          setMessage('Bentornato! Reindirizzamento...');
          // ─── window.location forza navigazione completa con cookie freschi ──
          setTimeout(() => { window.location.href = '/home'; }, 800);
        } else {
          setMessage('Accesso completato! Scegli il tuo username...');
          setTimeout(() => { window.location.href = '/username'; }, 1000);
        }

      } catch (err: any) {
        console.error('Callback error:', err);
        setStatus('error');
        setMessage(err.message ?? 'Qualcosa è andato storto. Riprova.');
        setTimeout(() => { window.location.href = '/auth'; }, 2500);
      }
    };

    handle();
  }, [router.isReady]); // ← solo router.isReady, non router intero

  return (
    <div style={{
      minHeight: '100vh', background: C.bgSoft,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT.sans, padding: S.md,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: S.md,
        textAlign: 'center', maxWidth: '320px',
      }}>
        {status === 'loading' && (
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: C.primaryLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FilmSlate size={36} color={C.primary} weight="duotone" />
          </div>
        )}
        {status === 'success' && (
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: '#dcfce7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={40} color={C.success} weight="fill" />
          </div>
        )}
        {status === 'error' && (
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: C.errorLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Warning size={40} color={C.error} weight="fill" />
          </div>
        )}

        <div>
          <div style={{ fontSize: TEXT.lg, fontWeight: '800', color: C.ink, marginBottom: S.xs }}>
            {status === 'loading' && 'Un momento...'}
            {status === 'success' && '✅ Tutto fatto!'}
            {status === 'error'   && 'Ops!'}
          </div>
          <div style={{ fontSize: TEXT.sm, color: C.muted, lineHeight: 1.6 }}>
            {message}
          </div>
        </div>

        {status === 'loading' && (
          <>
            <style>{`
              @keyframes progress {
                from { width: 0%; }
                to   { width: 100%; }
              }
            `}</style>
            <div style={{
              width: '200px', height: '3px',
              background: C.border, borderRadius: '999px', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', background: C.primary,
                borderRadius: '999px',
                animation: 'progress 2s ease forwards',
              }} />
            </div>
          </>
        )}

        {status === 'error' && (
          <button
            onClick={() => { window.location.href = '/auth'; }}
            style={{
              background: C.primary, color: '#fff', border: 'none',
              borderRadius: R.full, padding: '12px 24px',
              fontSize: TEXT.sm, fontWeight: '600',
              cursor: 'pointer', fontFamily: FONT.sans,
            }}
          >
            Torna al login
          </button>
        )}
      </div>
    </div>
  );
}