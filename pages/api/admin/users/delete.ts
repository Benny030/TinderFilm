import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type ResponseBody =
  | { success: true }
  | { success: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
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

  const accessToken = authorization
    .slice('Bearer '.length)
    .trim();

  const {
    targetUserId,
    confirmationUsername,
  } = req.body ?? {};

  if (
    typeof targetUserId !== 'string' ||
    typeof confirmationUsername !== 'string'
  ) {
    return res.status(400).json({
      success: false,
      error: 'Dati mancanti.',
    });
  }

  const authClient = createClient(
    supabaseUrl,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data: { user: actingUser },
    error: actingUserError,
  } = await authClient.auth.getUser(accessToken);

  if (actingUserError || !actingUser) {
    return res.status(401).json({
      success: false,
      error: 'Sessione scaduta o non valida.',
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
    }
  );

  try {
    const { data: actingRole, error: roleError } =
      await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', actingUser.id)
        .maybeSingle();

    if (roleError) throw roleError;

    if (actingRole?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Permessi amministratore richiesti.',
      });
    }

    /*
     * Dal pannello admin non permettiamo l'auto-eliminazione:
     * evita di rimuovere accidentalmente l'account con cui
     * stai amministrando CineDate.
     */
    if (targetUserId === actingUser.id) {
      return res.status(400).json({
        success: false,
        error:
          'Non puoi eliminare il tuo stesso account dal pannello admin.',
      });
    }

    const {
      data: targetProfile,
      error: targetProfileError,
    } = await admin
      .from('users')
      .select('id,username,email')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetProfileError) throw targetProfileError;

    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato.',
      });
    }

    if (
      confirmationUsername.trim() !==
      (targetProfile.username ?? '').trim()
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Lo username di conferma non corrisponde.',
      });
    }

    /*
     * Rimuove eventuali avatar posseduti dall'utente.
     */
    const {
      data: avatarFiles,
      error: avatarListError,
    } = await admin.storage
      .from('avatars')
      .list(targetUserId, {
        limit: 1000,
      });

    if (avatarListError) throw avatarListError;

    if (avatarFiles?.length) {
      const paths = avatarFiles
        .filter((file) => file.name)
        .map(
          (file) =>
            `${targetUserId}/${file.name}`
        );

      if (paths.length > 0) {
        const { error: removeAvatarError } =
          await admin.storage
            .from('avatars')
            .remove(paths);

        if (removeAvatarError) {
          throw removeAvatarError;
        }
      }
    }

    /*
     * Registra l'eliminazione PRIMA di cancellare l'account.
     * Dopo il CASCADE target_user_id diventerà NULL,
     * ma username/email resteranno conservati nei metadata.
     */
    const { error: auditError } = await admin
      .from('moderation_audit_log')
      .insert({
        admin_user_id: actingUser.id,
        action: 'user_deleted',
        target_user_id: targetUserId,
        metadata: {
          deleted_username: targetProfile.username,
          deleted_email: targetProfile.email,
        },
      });

    if (auditError) {
      throw auditError;
    }

    /*
     * Elimina auth.users.
     * La FK auth.users -> public.users ON DELETE CASCADE
     * propaga poi la cancellazione al profilo e ai dati
     * collegati.
     */
    const { error: deleteError } =
      await admin.auth.admin.deleteUser(
        targetUserId,
        false
      );

    if (deleteError) throw deleteError;

    return res.status(200).json({
      success: true,
    });
  } catch (error: unknown) {
    console.error(
      'Admin permanent user deletion failed:',
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Impossibile eliminare definitivamente l’utente.',
    });
  }
}