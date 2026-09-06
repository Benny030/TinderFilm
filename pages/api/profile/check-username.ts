import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

import {
  moderateText,
  moderationMessage,
} from '@/utils/contentModeration';

type Response =
  | {
      available: true;
      username: string;
    }
  | {
      available: false;
      username: string;
      error: string;
    };

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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');

    return res.status(405).json({
      available: false,
      username: '',
      error: 'Metodo non consentito.',
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return res.status(500).json({
      available: false,
      username: '',
      error: 'Configurazione server incompleta.',
    });
  }

  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({
      available: false,
      username: '',
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
      available: false,
      username: '',
      error: 'Sessione non valida.',
    });
  }

  const username =
    typeof req.query.username === 'string'
      ? req.query.username.trim().toLowerCase()
      : '';

  const moderation = moderateText(username, 'username');

  if (!moderation.allowed) {
    return res.status(400).json({
      available: false,
      username,
      error: moderationMessage(
        moderation,
        'username',
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
    const { data: existing, error } =
      await admin
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', user.id)
        .maybeSingle();

    if (error) throw error;

    if (existing) {
      return res.status(200).json({
        available: false,
        username,
        error: 'Username già in uso.',
      });
    }

    return res.status(200).json({
      available: true,
      username,
    });
  } catch (error) {
    console.error(
      'Username availability check failed:',
      error
    );

    return res.status(500).json({
      available: false,
      username,
      error: 'Impossibile verificare lo username.',
    });
  }
}
