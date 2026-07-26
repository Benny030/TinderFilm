import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let instance: SupabaseClient | null = null;

export const createBrowserClient = (): SupabaseClient => {
  if (instance) return instance;
  instance = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
  return instance;
};