import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: 'Movie ID required' });

  // ─── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const supabase = createClient();
      const { error } = await supabase.from('movies').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ success: true });
      
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  // ─── PATCH ────────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    try {
      const supabase = createClient();
      const { title, year, genre, cover, trailer, trama_c, trama_l } = req.body;

      const { data, error } = await supabase
        .from('movies')
        .update({ title, year, genre, cover, trailer, trama_c, trama_l })
        .eq('id', id)
        .select()      // ← restituisce il film aggiornato
        .single();     // ← un solo record

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data); // ← film completo, non { success: true }
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}