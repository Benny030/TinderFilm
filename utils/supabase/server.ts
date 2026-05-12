import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// ─── Usa service role se disponibile, altrimenti anon key ────────────────────
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;  // ← nome corretto

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Variabili Supabase mancanti: controlla NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
}

export const createClient = (): SupabaseClient => {
  return createSupabaseClient(supabaseUrl, supabaseKey);
};