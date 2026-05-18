import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { id, mode, genres, year_from, year_to } = req.body;
    if (!id || !mode) return res.status(400).json({ error: 'id e mode obbligatori' });

    try {
      const supabase = createClient();
      const { error } = await supabase.from('rooms').upsert({
        id, mode,
        genres: genres ?? null,
        year_from: year_from ?? null,
        year_to: year_to ?? null,
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id obbligatorio' });

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .single();
      if (error) return res.status(404).json({ error: 'Stanza non trovata' });
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}