import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    if (!id) {
      return res.status(400).json({ error: 'Movie ID required' });
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.from('movies').delete().eq('id', id);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
