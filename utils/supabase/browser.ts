import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ─── Debug: vedi cosa viene letto ─────────────────────────────────────────────
console.log('SUPABASE URL:', supabaseUrl);
console.log('ANON KEY:', supabaseAnonKey ? supabaseAnonKey.slice(0, 20) + '...' : 'MANCANTE');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase client environment variables.');
}

let instance: SupabaseClient | null = null;

export const createBrowserClient = (): SupabaseClient => {
  if (instance) return instance;
  instance = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  return instance;
};