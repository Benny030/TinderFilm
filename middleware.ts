import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── /username richiede una sessione reale ─────────────────────────────
  if (pathname.startsWith('/username') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // ─── /profilo richiede una sessione reale ──────────────────────────────
  if (pathname.startsWith('/profilo') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // ─── /home, /stanza, /crea-stanza: ospiti possono passare ─────────────
  const guestAllowed = ['/home', '/stanza', '/crea-stanza'];

  const isGuestAllowed = guestAllowed.some((path) =>
    pathname.startsWith(path)
  );

  if (isGuestAllowed && !user) {
    const isGuest =
      request.cookies.get('cineDateGuest')?.value === 'true';

    if (!isGuest) {
      const url = request.nextUrl.clone();

      /*
       * Se l'utente ha aperto direttamente una stanza condivisa,
       * il middleware interviene prima che React possa montare la pagina.
       *
       * Conserviamo quindi esplicitamente il codice stanza in `fromRoom`.
       */
      const room =
        pathname.startsWith('/stanza')
          ? request.nextUrl.searchParams.get('room')
          : null;

      url.pathname = '/auth';
      url.search = '';

      if (room) {
        url.searchParams.set('fromRoom', room);
      }

      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
