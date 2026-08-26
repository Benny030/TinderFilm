import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type Feedback = 'more_like_this' | 'not_for_me';

type ResponseData =
  | { success: true; tmdb_id: number; feedback: Feedback | null }
  | { error: string };

function getBearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Configurazione server incompleta' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Sessione non valida' });
  }

  const tmdbId = Number(req.body?.tmdb_id);
  const feedback = req.body?.feedback as Feedback;

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ error: 'tmdb_id non valido' });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('user_recommendation_feedback')
      .delete()
      .eq('user_id', user.id)
      .eq('tmdb_id', tmdbId);

    if (error) {
      console.error('recommendation feedback delete failed:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      tmdb_id: tmdbId,
      feedback: null,
    });
  }

  if (feedback !== 'more_like_this' && feedback !== 'not_for_me') {
    return res.status(400).json({ error: 'feedback non valido' });
  }

  const { error } = await supabase
    .from('user_recommendation_feedback')
    .upsert(
      {
        user_id: user.id,
        tmdb_id: tmdbId,
        feedback,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,tmdb_id',
      },
    );

  if (error) {
    console.error('recommendation feedback save failed:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    tmdb_id: tmdbId,
    feedback,
  });
}