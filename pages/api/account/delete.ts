import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type DeleteAccountResponse =
  | { success: true }
  | { success: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteAccountResponse>
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({
      success: false,
      error: 'Metodo non consentito.',
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Missing Supabase server environment variables.');
    return res.status(500).json({
      success: false,
      error: 'Configurazione server incompleta.',
    });
  }

  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Sessione non valida.',
    });
  }

  const accessToken = authorization.slice('Bearer '.length).trim();

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(accessToken);

  if (userError || !user) {
    return res.status(401).json({
      success: false,
      error: 'Sessione scaduta o non valida.',
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: roleRow, error: roleError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError) throw roleError;

    if (roleRow?.role === 'admin') {
      return res.status(403).json({
        success: false,
        error:
          'Un account amministratore non può essere eliminato da questa schermata.',
      });
    }

    const {
      data: avatarFiles,
      error: avatarListError,
    } = await admin.storage
      .from('avatars')
      .list(user.id, { limit: 1000 });

    if (avatarListError) throw avatarListError;

    if (avatarFiles?.length) {
      const paths = avatarFiles
        .filter((file) => file.name)
        .map((file) => `${user.id}/${file.name}`);

      if (paths.length > 0) {
        const { error: avatarRemoveError } =
          await admin.storage.from('avatars').remove(paths);

        if (avatarRemoveError) throw avatarRemoveError;
      }
    }

    const { error: deleteError } =
      await admin.auth.admin.deleteUser(user.id, false);

    if (deleteError) throw deleteError;

    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    console.error('Permanent account deletion failed:', error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Impossibile eliminare definitivamente l’account.',
    });
  }
}