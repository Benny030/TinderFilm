import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type Body = {
  tmdb_ids?: unknown;
};

type Response =
  | {
      success: true;
      recorded: number;
    }
  | {
      success: false;
      error: string;
    };

function bearer(req: NextApiRequest) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    return null;
  }

  return auth.slice('Bearer '.length).trim() || null;
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(Number)
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0,
        ),
    ),
  ).slice(0, 40);
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

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const authClient = createClient(
    url,
    anon,
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

  const ids = normalizeIds(
    (req.body as Body | undefined)?.tmdb_ids,
  );

  if (ids.length === 0) {
    return res.status(200).json({
      success: true,
      recorded: 0,
    });
  }

  const admin = createClient(
    url,
    service,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  try {
    const { data: existing, error: readError } =
      await admin
        .from('user_recommendation_impressions')
        .select('tmdb_id, impression_count, first_seen_at')
        .eq('user_id', user.id)
        .in('tmdb_id', ids);

    if (readError) {
      throw readError;
    }

    const existingMap = new Map<
      number,
      {
        count: number;
        firstSeenAt: string | null;
      }
    >();

    for (const row of existing ?? []) {
      const tmdbId = Number(
        (row as any).tmdb_id,
      );

      if (!Number.isInteger(tmdbId)) {
        continue;
      }

      existingMap.set(tmdbId, {
        count: Math.max(
          1,
          Number(
            (row as any)
              .impression_count ?? 1,
          ),
        ),
        firstSeenAt:
          typeof (row as any)
            .first_seen_at === 'string'
            ? (row as any)
                .first_seen_at
            : null,
      });
    }

    const now =
      new Date().toISOString();

    const rows = ids.map((tmdbId) => {
      const previous =
        existingMap.get(tmdbId);

      return {
        user_id: user.id,
        tmdb_id: tmdbId,
        impression_count:
          (previous?.count ?? 0) + 1,
        first_seen_at:
          previous?.firstSeenAt ??
          now,
        last_seen_at: now,
      };
    });

    const { error: upsertError } =
      await admin
        .from('user_recommendation_impressions')
        .upsert(rows, {
          onConflict:
            'user_id,tmdb_id',
        });

    if (upsertError) {
      throw upsertError;
    }

    return res.status(200).json({
      success: true,
      recorded: rows.length,
    });
  } catch (error) {
    console.error(
      'recommendation impressions failed:',
      error,
    );

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Impossibile registrare le visualizzazioni.',
    });
  }
}
