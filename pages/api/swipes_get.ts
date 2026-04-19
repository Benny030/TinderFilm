import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('swipes').select('*');
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json(data || []);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
