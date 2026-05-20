import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { createBrowserClient } from '@/utils/supabase/browser';
import { C, FONT, TEXT, S, R } from '@/styles/token';
import { FilmSlate, CheckCircle, Warning } from '@phosphor-icons/react';

type Status = 'loading' | 'success' | 'error';

function getUrlParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  return {
    code: searchParams.get('code'),
    tokenHash: searchParams.get('token_hash'),
    type: searchParams.get('type') as any,
    accessToken: hashParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token'),
    error: searchParams.get('error') ?? hashParams.get('error'),
    errorDescription: searchParams.get('error_description') ?? hashParams.get('error_description'),
  };
}

async function getUserProfile(supabase: ReturnType<typeof createBrowserClient>, user: { id: string; email?: string }) {
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
  const supabase = createBrowserClient();
  const handledRef = useRef(false);

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Verifica in corso...');

  useEffect(() => {
    const handle = async () => {
      if (handledRef.current) return;
      handledRef.current = true;

      try {
        const {
          code,
          tokenHash,
          type,
          accessToken,
          refreshToken,
          error: authError,
          errorDescription,
        } = getUrlParams();

        if (authError) {
          throw new Error(errorDescription ?? authError);
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });

          if (error) {
            const { data: existingSession } = await supabase.auth.getSession();
            if (!existingSession.session?.user) throw error;
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          setStatus('error');
          setMessage('Link non valido o scaduto. Riprova.');
          setTimeout(() => router.replace('/auth'), 2500);
          return;
        }

        const data = await getUserProfile(supabase, {
          id: session.user.id,
          email: session.user.email,
        });

        if (data?.username) {
          setStatus('success');
          setMessage('Bentornato! Reindirizzamento...');
          setTimeout(() => router.replace('/home'), 800);
        } else {
          setStatus('success');
          setMessage('Email confermata! Scegli il tuo username...');
          setTimeout(() => router.replace('/username'), 1000);
        }
      } catch (err: any) {
        console.error('Callback error:', err);
        setStatus('error');
        setMessage(err.message ?? 'Qualcosa e andato storto. Riprova.');
        setTimeout(() => router.replace('/auth'), 2500);
      }
    };

    handle();
  }, [router, supabase]);

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
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FilmSlate size={36} color={C.primary} weight="duotone" />
          </div>
        )}
        {status === 'success' && (
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={40} color={C.success} weight="fill" />
          </div>
        )}
        {status === 'error' && (
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: C.errorLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Warning size={40} color={C.error} weight="fill" />
          </div>
        )}

        <div>
          <div style={{ fontSize: TEXT.lg, fontWeight: '800', color: C.ink, marginBottom: S.xs }}>
            {status === 'loading' && 'Un momento...'}
            {status === 'success' && 'Tutto fatto!'}
            {status === 'error' && 'Ops!'}
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
                to { width: 100%; }
              }
            `}</style>
            <div style={{ width: '200px', height: '3px', background: C.border, borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: C.primary, borderRadius: '999px', animation: 'progress 2s ease forwards' }} />
            </div>
          </>
        )}

        {status === 'error' && (
          <button
            onClick={() => router.replace('/auth')}
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
