import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

import {
  moderateText,
  moderationMessage,
} from '@/utils/contentModeration';

type Body = {
  movie_id?: unknown;
  review_text?: unknown;
  rating?: unknown;
  publish_rating?: unknown;
};

type Response =
  | { success: true; entry_id: string }
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
  const movieId =
    typeof body.movie_id === 'string'
      ? body.movie_id.trim()
      : '';
  const reviewText =
    typeof body.review_text === 'string'
      ? body.review_text.trim()
      : '';

  const rating =
    typeof body.rating === 'number' &&
    Number.isFinite(body.rating)
      ? body.rating
      : null;

  const publishRating = body.publish_rating === true;

  if (!movieId) {
    return res.status(400).json({
      success: false,
      error: 'Film non valido.',
    });
  }

  if (!reviewText) {
    return res.status(400).json({
      success: false,
      error: 'Scrivi la tua recensione.',
    });
  }

  if (reviewText.length > 3000) {
    return res.status(400).json({
      success: false,
      error: 'La recensione può contenere massimo 3000 caratteri.',
    });
  }

  const moderation = moderateText(reviewText, 'review');

  if (!moderation.allowed) {
    return res.status(400).json({
      success: false,
      error: moderationMessage(moderation, 'review'),
    });
  }

  if (
    rating !== null &&
    (rating < 0 || rating > 5)
  ) {
    return res.status(400).json({
      success: false,
      error: 'Valutazione non valida.',
    });
  }

  const admin = createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: existing, error: existingError } =
      await admin
        .from('user_movie_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('movie_id', movieId)
        .maybeSingle();

    if (existingError) throw existingError;

    const payload = {
      rating,
      review_text: reviewText,
      review_visibility: 'public',
      rating_visibility:
        rating !== null && publishRating
          ? 'public'
          : 'private',
    };

    if (existing?.id) {
      const { error } = await admin
        .from('user_movie_entries')
        .update(payload)
        .eq('id', existing.id)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        entry_id: existing.id,
      });
    }

    const { data: inserted, error } = await admin
      .from('user_movie_entries')
      .insert({
        user_id: user.id,
        movie_id: movieId,
        ...payload,
      })
      .select('id')
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      entry_id: inserted.id,
    });
  } catch (error) {
    console.error('Moderated review save failed:', error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Impossibile pubblicare la recensione.',
    });
  }
}
