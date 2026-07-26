import { type NextRequest } from 'next/server';
import { proxy, config as proxyConfig } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};