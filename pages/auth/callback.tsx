import type { GetServerSideProps } from 'next';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
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
    console.error('[OAuth callback]', {
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

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[OAuth callback]', {
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
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[OAuth callback]', {
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
      console.error('[OAuth callback]', {
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

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[OAuth callback]', {
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

    console.info('[OAuth callback]', {
      correlationId,
      category: 'success',
      userId: user.id,
      hasUsername: Boolean(profile?.username),
    });

    if (profile?.username) {
      return {
        redirect: {
          destination: '/home',
          permanent: false,
        },
      };
    }

    return {
      redirect: {
        destination: '/username',
        permanent: false,
      },
    };
  } catch (error) {
    console.error('[OAuth callback]', {
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