import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

type SwipePayload = {
  movie_id: string;
  liked: boolean;
  user?: string;
  roomId?: string;
};

type ResponseData = {
  swipe?: { id: number; movie_id: string; liked: boolean; user: string };
  matched?: boolean;
  error?: string;
};

const selectAllSwipes = async (supabase: any) => {
  return supabase.from('swipes').select('*');
};

const deleteAllSwipes = async (supabase: any) => {
  return supabase.from('swipes').delete().not('id', 'is', null);
};

const deleteAllMatches = async (supabase: any) => {
  return supabase.from('matches').delete().not('id', 'is', null);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData | ResponseData[] | any>) {
  if (req.method === 'GET') {
    try {
      const supabase = createClient();
      const { data, error } = await selectAllSwipes(supabase);
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json(data || []);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const supabase = createClient();
      const { error: matchDeleteError } = await deleteAllMatches(supabase);
      if (matchDeleteError) {
        return res.status(500).json({ error: matchDeleteError.message });
      }
      const { error: swipeDeleteError } = await deleteAllSwipes(supabase);
      if (swipeDeleteError) {
        return res.status(500).json({ error: swipeDeleteError.message });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Errore sconosciuto' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { movie_id, liked, user, roomId } = req.body as SwipePayload;

  if (!movie_id || typeof liked !== 'boolean') {
    return res.status(400).json({ error: 'movie_id e liked sono obbligatori' });
  }

  const currentUser = typeof user === 'string' && user.trim() ? user.trim() : 'guest';

  try {
    const supabase = createClient();
    const swipeRow: any = { movie_id, liked, user: currentUser };
    if (roomId) {
      swipeRow.room_id = roomId;
    }

    let { data: swipeData, error: swipeError } = await supabase.from('swipes').insert(swipeRow).select().single();
    const roomIdColumnError = swipeError?.message?.match(/room_id/i);
    if (swipeError && roomIdColumnError) {
      delete swipeRow.room_id;
      const retry = await supabase.from('swipes').insert(swipeRow).select().single();
      swipeData = retry.data;
      swipeError = retry.error;
    }

    if (swipeError) {
      return res.status(500).json({ error: swipeError.message });
    }

    let matched = false;
    if (liked) {
      const { data: existingMatch, error: matchQueryError } = await supabase
        .from('matches')
        .select('movie_id')
        .eq('movie_id', movie_id)
        .limit(1)
        .maybeSingle();

      if (matchQueryError) {
        return res.status(500).json({ error: matchQueryError.message });
      }

      if (!existingMatch) {
        const { error: matchInsertError } = await supabase.from('matches').insert({ movie_id });
        if (matchInsertError) {
          return res.status(500).json({ error: matchInsertError.message });
        }
      }
      matched = true;
    }

    return res.status(201).json({ swipe: swipeData as ResponseData['swipe'], matched });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Errore sconosciuto' });
  }
}
