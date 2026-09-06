import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

import {
  moderateText,
  moderationMessage,
} from '@/utils/contentModeration';

type Body = {
  entry_id?: unknown;
  comment_id?: unknown;
  text?: unknown;
};

type Response =
  | { success: true }
  | { success: false; error: string };

function bearer(req: NextApiRequest) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim() || null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>,
) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'POST, PATCH');

    return res.status(405).json({
      success: false,
      error: 'Metodo non consentito.',
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon || !service) {
    return res.status(500).json({
      success: false,
      error: 'Configurazione server incompleta.',
    });
  }

  const token = bearer(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Autenticazione richiesta.',
    });
  }

  const authClient = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({
      success: false,
      error: 'Sessione non valida.',
    });
  }

  const body = (req.body ?? {}) as Body;
  const text =
    typeof body.text === 'string'
      ? body.text.trim()
      : '';

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Scrivi un commento.',
    });
  }

  if (text.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Il commento può contenere massimo 1000 caratteri.',
    });
  }

  const moderation = moderateText(text, 'comment');

  if (!moderation.allowed) {
    return res.status(400).json({
      success: false,
      error: moderationMessage(moderation, 'comment'),
    });
  }

  const admin = createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    if (req.method === 'POST') {
      const entryId =
        typeof body.entry_id === 'string'
          ? body.entry_id.trim()
          : '';

      if (!entryId) {
        return res.status(400).json({
          success: false,
          error: 'Recensione non valida.',
        });
      }

      const { error } = await admin
        .from('user_movie_review_comments')
        .insert({
          entry_id: entryId,
          user_id: user.id,
          text,
        });

      if (error) throw error;

      return res.status(200).json({
        success: true,
      });
    }

    const commentId =
      typeof body.comment_id === 'string'
        ? body.comment_id.trim()
        : '';

    if (!commentId) {
      return res.status(400).json({
        success: false,
        error: 'Commento non valido.',
      });
    }

    const { data: ownedComment, error: ownedError } =
      await admin
        .from('user_movie_review_comments')
        .select('id')
        .eq('id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (ownedError) throw ownedError;

    if (!ownedComment) {
      return res.status(403).json({
        success: false,
        error: 'Non puoi modificare questo commento.',
      });
    }

    const { error } = await admin
      .from('user_movie_review_comments')
      .update({ text })
      .eq('id', commentId)
      .eq('user_id', user.id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('Moderated comment save failed:', error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Impossibile salvare il commento.',
    });
  }
}
