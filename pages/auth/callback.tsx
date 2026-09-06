import type { GetServerSideProps } from 'next';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export default function AuthCallbackPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({
  req,
  res,
  query,
}) => {
  const correlationId = randomUUID();

  const code =
    typeof query.code === 'string'
      ? query.code
      : null;

  if (!code) {
    console.error('[Auth callback]', {
      correlationId,
      category: 'missing_code',
    });

    return {
      redirect: {
        destination: '/auth?oauth_error=missing_code',
        permanent: false,
      },
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Auth callback]', {
      correlationId,
      category: 'missing_supabase_env',
    });

    return {
      redirect: {
        destination: '/auth?oauth_error=configuration',
        permanent: false,
      },
    };
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({
            name,
            value: value ?? '',
          }));
        },

        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          const serializedCookies = cookiesToSet.map(
            ({ name, value, options }) => {
              let cookie = `${name}=${encodeURIComponent(value)}`;

              if (options?.maxAge !== undefined) {
                cookie += `; Max-Age=${options.maxAge}`;
              }

              if (options?.domain) {
                cookie += `; Domain=${options.domain}`;
              }

              cookie += `; Path=${options?.path ?? '/'}`;

              if (options?.httpOnly) {
                cookie += '; HttpOnly';
              }

              if (options?.secure) {
                cookie += '; Secure';
              }

              if (options?.sameSite) {
                const sameSite =
                  typeof options.sameSite === 'string'
                    ? options.sameSite
                    : options.sameSite === true
                      ? 'Strict'
                      : undefined;

                if (sameSite) {
                  cookie += `; SameSite=${sameSite}`;
                }
              }

              return cookie;
            }
          );

          res.setHeader('Set-Cookie', serializedCookies);
        },
      },
    }
  );

  try {
    /*
     * Questo callback è condiviso da Google OAuth e dalla conferma email.
     * In entrambi i casi Supabase invia un code PKCE.
     */
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[Auth callback]', {
        correlationId,
        category: 'code_exchange_failed',
        errorName: exchangeError.name,
        errorMessage: exchangeError.message,
      });

      return {
        redirect: {
          destination: '/auth?oauth_error=exchange_failed',
          permanent: false,
        },
      };
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[Auth callback]', {
        correlationId,
        category: 'user_not_found_after_exchange',
        errorMessage: userError?.message,
      });

      return {
        redirect: {
          destination: '/auth?oauth_error=session_failed',
          permanent: false,
        },
      };
    }

    let {
      data: profile,
      error: profileError,
    } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Auth callback]', {
        correlationId,
        category: 'profile_lookup_failed',
        userId: user.id,
        errorCode: profileError.code,
        errorMessage: profileError.message,
      });

      return {
        redirect: {
          destination: '/auth?oauth_error=profile_failed',
          permanent: false,
        },
      };
    }

    /*
     * La pagina /username aggiorna public.users.
     * Se per qualche motivo il trigger DB non ha ancora creato la riga
     * (caso che può succedere soprattutto nel signup email), la creiamo qui
     * lato server usando la service role già prevista dal progetto.
     *
     * Non inventiamo uno username: l'utente lo sceglierà nella pagina /username.
     */
    if (!profile && serviceRoleKey) {
      const admin = createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

      const { error: bootstrapError } = await admin
        .from('users')
        .upsert(
          {
            id: user.id,
            email: user.email ?? null,
          },
          {
            onConflict: 'id',
            ignoreDuplicates: false,
          }
        );

      if (bootstrapError) {
        console.error('[Auth callback]', {
          correlationId,
          category: 'profile_bootstrap_failed',
          userId: user.id,
          errorCode: bootstrapError.code,
          errorMessage: bootstrapError.message,
        });

        return {
          redirect: {
            destination: '/auth?oauth_error=profile_bootstrap_failed',
            permanent: false,
          },
        };
      }

      const {
        data: bootstrappedProfile,
        error: bootstrapReadError,
      } = await admin
        .from('users')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      if (bootstrapReadError) {
        console.error('[Auth callback]', {
          correlationId,
          category: 'profile_bootstrap_read_failed',
          userId: user.id,
          errorMessage: bootstrapReadError.message,
        });
      }

      profile = bootstrappedProfile ?? null;
    }

    /*
     * Se manca la service role non blocchiamo un'installazione che magari
     * crea public.users via trigger. In quel caso /username farà la verifica.
     */
    if (!profile && !serviceRoleKey) {
      console.warn('[Auth callback]', {
        correlationId,
        category: 'profile_missing_without_service_role',
        userId: user.id,
      });
    }

    console.info('[Auth callback]', {
      correlationId,
      category: 'success',
      userId: user.id,
      provider: user.app_metadata?.provider ?? 'email',
      hasUsername: Boolean(profile?.username),
    });

    return {
      redirect: {
        destination: profile?.username
          ? '/home'
          : '/username',
        permanent: false,
      },
    };
  } catch (error) {
    console.error('[Auth callback]', {
      correlationId,
      category: 'unexpected_callback_error',
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Unknown error',
    });

    return {
      redirect: {
        destination: '/auth?oauth_error=unexpected',
        permanent: false,
      },
    };
  }
};
