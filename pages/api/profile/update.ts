import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

import {
  moderateText,
  moderationMessage,
} from '@/utils/contentModeration';

type Body = {
  username?: unknown;
  bio?: unknown;
  favorite_genres?: unknown;
  avatar_url?: unknown;
};

type Response =
  | { success: true; username: string }
  | { success: false; error: string };

const ALLOWED_GENRES = new Set([
  'Azione',
  'Avventura',
  'Animazione',
  'Commedia',
  'Crime',
  'Documentario',
  'Dramma',
  'Famiglia',
  'Fantasy',
  'Guerra',
  'Horror',
  'Mistero',
  'Musica',
  'Romance',
  'Fantascienza',
  'Thriller',
  'Storia',
  'Western',
]);

function getBearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return res.status(500).json({
      success: false,
      error: 'Configurazione server incompleta.',
    });
  }

  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Autenticazione richiesta.',
    });
  }

  const authClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

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

  const username =
    typeof body.username === 'string'
      ? body.username.trim().toLowerCase()
      : '';

  const bio =
    typeof body.bio === 'string'
      ? body.bio.trim()
      : '';

  const avatarUrl =
    typeof body.avatar_url === 'string' && body.avatar_url.trim()
      ? body.avatar_url.trim()
      : null;

  const genres = Array.isArray(body.favorite_genres)
    ? Array.from(
        new Set(
          body.favorite_genres
            .map((value) => String(value ?? '').trim())
            .filter((value) => ALLOWED_GENRES.has(value)),
        ),
      )
    : [];

  const usernameModeration =
    moderateText(username, 'username');

  if (!usernameModeration.allowed) {
    return res.status(400).json({
      success: false,
      error: moderationMessage(
        usernameModeration,
        'username',
      ),
    });
  }

  const bioModeration = moderateText(bio, 'bio');

  if (!bioModeration.allowed) {
    return res.status(400).json({
      success: false,
      error: moderationMessage(
        bioModeration,
        'bio',
      ),
    });
  }

  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  try {
    const { data: duplicate, error: duplicateError } =
      await admin
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', user.id)
        .maybeSingle();

    if (duplicateError) throw duplicateError;

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'Username già in uso, scegline un altro.',
      });
    }

    const { error: updateError } = await admin
      .from('users')
      .update({
        username,
        bio,
        avatar_url: avatarUrl,
        favorite_genres: genres,
      })
      .eq('id', user.id);

    if (updateError) {
      if (updateError.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'Username già in uso, scegline un altro.',
        });
      }

      throw updateError;
    }

    return res.status(200).json({
      success: true,
      username,
    });
  } catch (error) {
    console.error('Moderated profile update failed:', error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Impossibile salvare il profilo.',
    });
  }
}
