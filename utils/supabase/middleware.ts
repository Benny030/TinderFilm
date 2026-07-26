import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Non toccare /auth/callback ───────────────────────────────────────────
  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next({ request });
  }

  // ─── /username: lascia sempre passare, ci pensa la pagina stessa ─────────
  // Il middleware non può vedere i cookie subito dopo exchangeCodeForSession
  // perché @supabase/ssr li scrive solo lato client in questo flusso
  if (pathname.startsWith('/username')) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ─── /profilo richiede sessione reale ─────────────────────────────────────
  if (pathname.startsWith('/profilo') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  // ─── /home, /stanza, /crea-stanza: ospiti possono passare ────────────────
  const guestAllowed = ['/home', '/stanza', '/crea-stanza'];
  const isGuestAllowed = guestAllowed.some((p) => pathname.startsWith(p));
  if (isGuestAllowed && !user) {
    const isGuest = request.cookies.get('cineDateGuest')?.value === 'true';
    if (!isGuest) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};