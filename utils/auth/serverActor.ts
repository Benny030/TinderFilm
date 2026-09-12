import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { createHmac, timingSafeEqual } from 'crypto';

export type ServerActor = {
  id: string;
  type: 'user' | 'guest';
  displayName: string | null;
};

export type GuestSessionPayload = {
  id: string;
  name: string;
  expiresAt: number;
};

export const GUEST_SESSION_COOKIE = 'cineDateGuestSession';
export const GUEST_MARKER_COOKIE = 'cineDateGuest';

type CookieOptions = {
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  secure?: boolean;
  path?: string;
  maxAge?: number;
  expires?: Date | string;
  domain?: string;
};

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};

  if (!header) return result;

  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex < 0) continue;

    const rawName = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();

    if (!rawName) continue;

    try {
      result[decodeURIComponent(rawName)] = decodeURIComponent(rawValue);
    } catch {
      result[rawName] = rawValue;
    }
  }

  return result;
}

function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (typeof options.maxAge === 'number') {
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  }

  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }

  if (options.path) {
    cookie += `; Path=${options.path}`;
  }

  if (options.expires) {
    const expires =
      options.expires instanceof Date
        ? options.expires
        : new Date(options.expires);

    if (!Number.isNaN(expires.getTime())) {
      cookie += `; Expires=${expires.toUTCString()}`;
    }
  }

  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }

  if (options.secure) {
    cookie += '; Secure';
  }

  const sameSite = options.sameSite;

  if (sameSite === true || sameSite === 'strict') {
    cookie += '; SameSite=Strict';
  } else if (sameSite === 'lax') {
    cookie += '; SameSite=Lax';
  } else if (sameSite === 'none') {
    cookie += '; SameSite=None';
  }

  return cookie;
}

function getGuestSecret(): string {
  const secret = process.env.GUEST_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'GUEST_SESSION_SECRET mancante o troppo corto. Usa almeno 32 caratteri casuali.'
    );
  }

  return secret;
}

function encodePayload(payload: GuestSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(encoded: string): GuestSessionPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as Partial<GuestSessionPayload>;

    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }

    return {
      id: parsed.id,
      name: parsed.name,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', getGuestSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function createSignedGuestSession(
  payload: GuestSessionPayload
): string {
  const encoded = encodePayload(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function verifySignedGuestSession(
  token: string | undefined
): GuestSessionPayload | null {
  if (!token) return null;

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex <= 0) return null;

  const encoded = token.slice(0, dotIndex);
  const providedSignature = token.slice(dotIndex + 1);
  const expectedSignature = sign(encoded);

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) return null;

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  const payload = decodePayload(encoded);

  if (!payload || payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

function appendSetCookie(res: NextApiResponse, cookieValue: string) {
  const existing = res.getHeader('Set-Cookie');

  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }

  const values = Array.isArray(existing)
    ? existing.map(String)
    : [String(existing)];

  res.setHeader('Set-Cookie', [...values, cookieValue]);
}

function createRequestSupabaseClient(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies = parseCookieHeader(req.headers.cookie);

          return Object.entries(cookies).map(([name, value]) => ({
            name,
            value,
          }));
        },

        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          for (const { name, value, options } of cookiesToSet) {
            appendSetCookie(
              res,
              serializeCookie(name, value, {
                ...(options as CookieOptions),
                path: options?.path ?? '/',
              })
            );
          }
        },
      },
    }
  );
}

export async function resolveActor(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<ServerActor | null> {
  const supabase = createRequestSupabaseClient(req, res);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) {
    return {
      id: user.id,
      type: 'user',
      displayName:
        typeof user.user_metadata?.username === 'string'
          ? user.user_metadata.username
          : null,
    };
  }

  const cookies = parseCookieHeader(req.headers.cookie);

  const guest = verifySignedGuestSession(
    cookies[GUEST_SESSION_COOKIE]
  );

  if (!guest) return null;

  return {
    id: guest.id,
    type: 'guest',
    displayName: guest.name,
  };
}

export function readGuestSession(
  req: NextApiRequest
): GuestSessionPayload | null {
  const cookies = parseCookieHeader(req.headers.cookie);

  return verifySignedGuestSession(
    cookies[GUEST_SESSION_COOKIE]
  );
}

export function setGuestSessionCookies(
  res: NextApiResponse,
  payload: GuestSessionPayload
) {
  const maxAge = Math.max(
    0,
    Math.floor((payload.expiresAt - Date.now()) / 1000)
  );

  const secure = process.env.NODE_ENV === 'production';

  appendSetCookie(
    res,
    serializeCookie(
      GUEST_SESSION_COOKIE,
      createSignedGuestSession(payload),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge,
      }
    )
  );

  appendSetCookie(
    res,
    serializeCookie(GUEST_MARKER_COOKIE, 'true', {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge,
    })
  );
}

export function clearGuestSessionCookies(
  res: NextApiResponse
) {
  const secure = process.env.NODE_ENV === 'production';

  for (const name of [
    GUEST_SESSION_COOKIE,
    GUEST_MARKER_COOKIE,
  ]) {
    appendSetCookie(
      res,
      serializeCookie(name, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      })
    );
  }
}
