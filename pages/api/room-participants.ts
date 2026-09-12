import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';
import { resolveActor } from '@/utils/auth/serverActor';

type Role = 'host' | 'member';

type MembershipStatus =
  | 'pending'
  | 'active'
  | 'left'
  | 'removed';

type ParticipantPayload = {
  roomId: string;

  // Compatibilità col frontend attuale.
  // NON sono identità autorevoli.
  actorId?: string;
  actorType?: 'user' | 'guest';
  displayName?: string | null;
  role?: Role;
};

const PRESENCE_TIMEOUT_MS = 90 * 1000;
const guestExpiry = () =>
  new Date(
    Date.now() + 24 * 60 * 60 * 1000
  ).toISOString();

const presenceCutoff = () =>
  new Date(
    Date.now() - PRESENCE_TIMEOUT_MS
  ).toISOString();


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient();

  if (req.method === 'GET') {
    const rawRoomId =
      Array.isArray(req.query.roomId)
        ? req.query.roomId[0]
        : req.query.roomId;

    const roomId =
      typeof rawRoomId === 'string'
        ? rawRoomId.trim().toUpperCase()
        : '';

    const wantsPending =
      req.query.pending === '1';

    if (!roomId) {
      return res.status(400).json({
        error: 'roomId obbligatorio',
      });
    }


    if (wantsPending) {
      const actor =
        await resolveActor(req, res);

      if (!actor) {
        return res.status(401).json({
          error:
            'Sessione non valida o scaduta',
        });
      }

      const {
        data: room,
        error: roomError,
      } = await supabase
        .from('rooms')
        .select(
          'host_actor_id, host_actor_type'
        )
        .eq('id', roomId)
        .maybeSingle();

      if (roomError) {
        return res.status(500).json({
          error: roomError.message,
        });
      }

      if (!room) {
        return res.status(404).json({
          error: 'Stanza non trovata',
        });
      }

      if (
        room.host_actor_id !== actor.id ||
        room.host_actor_type !== actor.type
      ) {
        return res.status(403).json({
          error:
            'Solo l’host può vedere le richieste pendenti',
        });
      }
    }

    const now =
      new Date().toISOString();

    let participantsQuery =
      supabase
        .from('room_participants')
        .select(
          'id, room_id, actor_id, actor_type, display_name, role, membership_status, joined_at, left_at, expires_at, last_seen_at'
        )
        .eq('room_id', roomId)
        .eq(
          'membership_status',
          wantsPending
            ? 'pending'
            : 'active'
        )
        .or(
          `expires_at.is.null,expires_at.gt.${now}`
        )
        .order('joined_at', {
          ascending: true,
        });

    /*
     * Membership e presenza sono due concetti distinti.
     *
     * Un utente può restare membership_status=active,
     * ma dopo 90 secondi senza heartbeat non è più
     * considerato presente nella sessione corrente.
     */
    if (!wantsPending) {
      participantsQuery =
        participantsQuery.gte(
          'last_seen_at',
          presenceCutoff()
        );
    }

    const { data, error } =
      await participantsQuery;

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.status(200).json(
      data ?? []
    );
  }

  if (req.method === 'POST') {
    const actor =
      await resolveActor(req, res);

    if (!actor) {
      return res.status(401).json({
        error:
          'Sessione non valida o scaduta',
      });
    }

    const body =
      req.body as ParticipantPayload;

    const roomId =
      typeof body.roomId === 'string'
        ? body.roomId.trim().toUpperCase()
        : '';

    if (!roomId) {
      return res.status(400).json({
        error: 'roomId obbligatorio',
      });
    }

    const {
      data: room,
      error: roomError,
    } = await supabase
      .from('rooms')
      .select(
        'id, max_members, visibility, requires_approval, host_actor_id, host_actor_type, is_locked, room_phase'
      )
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) {
      return res.status(500).json({
        error: roomError.message,
      });
    }

    if (!room) {
      return res.status(404).json({
        error: 'Stanza non trovata',
      });
    }

    if (
      room.room_phase === 'finished' ||
      room.room_phase === 'expired'
    ) {
      return res.status(410).json({
        error:
          'Questa stanza non è più attiva',
      });
    }

    const now =
      new Date().toISOString();

    const {
      count,
      error: countError,
    } = await supabase
      .from('room_participants')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('room_id', roomId)
      .eq(
        'membership_status',
        'active'
      )
      .or(
        `expires_at.is.null,expires_at.gt.${now}`
      )
      .gte(
        'last_seen_at',
        presenceCutoff()
      );

    if (countError) {
      return res.status(500).json({
        error: countError.message,
      });
    }

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from('room_participants')
      .select(
        'actor_id, actor_type, membership_status, role'
      )
      .eq('room_id', roomId)
      .eq('actor_id', actor.id)
      .eq('actor_type', actor.type)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        error: existingError.message,
      });
    }

    const isHost =
      room.host_actor_id === actor.id &&
      room.host_actor_type === actor.type;

    /*
     * Se uno ha semplicemente navigato fuori dalla stanza,
     * la membership resta active.
     *
     * Al rientro, anche durante voting/matched/planning,
     * può riprendere la stessa sessione e il POST aggiorna
     * immediatamente last_seen_at.
     */
    const isReturningActiveMember =
      existing?.membership_status ===
        'active';

    const isExistingPending =
      existing?.membership_status ===
        'pending';

    const membershipStatus: MembershipStatus =
      isHost ||
      isReturningActiveMember ||
      room.visibility === 'public'
        ? 'active'
        : 'pending';

    /*
     * Dopo l'inizio della stanza non accettiamo membri nuovi
     * né persone che avevano abbandonato esplicitamente.
     *
     * Un membro già active può invece rientrare.
     */
    if (
      !isHost &&
      !isReturningActiveMember &&
      !isExistingPending &&
      (
        room.is_locked ||
        room.room_phase !== 'waiting'
      )
    ) {
      return res.status(423).json({
        error:
          'Gli ingressi in questa stanza sono chiusi',
      });
    }

    if (
      !isHost &&
      isExistingPending &&
      room.room_phase !== 'waiting'
    ) {
      return res.status(423).json({
        error:
          'La stanza è già iniziata',
      });
    }

    const countsAsNewActive =
      membershipStatus === 'active' &&
      !isReturningActiveMember &&
      !isHost;

    if (
      countsAsNewActive &&
      (count ?? 0) >=
        Number(room.max_members ?? 2)
    ) {
      return res.status(409).json({
        error: 'Stanza piena',
      });
    }

    const displayName =
      actor.displayName ||
      (
        typeof body.displayName ===
          'string' &&
        body.displayName.trim()
          ? body.displayName.trim()
          : actor.type === 'guest'
            ? 'Ospite'
            : 'Utente'
      );

    const { data, error } =
      await supabase
        .from('room_participants')
        .upsert(
          {
            room_id: roomId,
            actor_id: actor.id,
            actor_type: actor.type,
            display_name: displayName,
            role: isHost
              ? 'host'
              : 'member',
            membership_status:
              membershipStatus,
            left_at: null,
            last_seen_at: now,
            expires_at:
              actor.type === 'guest'
                ? guestExpiry()
                : null,
          },
          {
            onConflict:
              'room_id,actor_id',
          }
        )
        .select('*')
        .single();

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    if (
      membershipStatus === 'active'
    ) {
      const {
        error: roomPresenceError,
      } = await supabase
        .from('rooms')
        .update({
          empty_since: null,
        })
        .eq('id', roomId);

      if (roomPresenceError) {
        console.error(
          'Unable to clear room empty_since:',
          roomPresenceError.message
        );
      }
    }

    return res
      .status(existing ? 200 : 201)
      .json({
        participant: data,
      });
  }

  if (req.method === 'PATCH') {
    const actor =
      await resolveActor(req, res);

    if (!actor) {
      return res.status(401).json({
        error:
          'Sessione non valida o scaduta',
      });
    }

    const body = req.body as {
      roomId?: string;
      actorId?: string;
    };

    const roomId =
      typeof body.roomId === 'string'
        ? body.roomId.trim().toUpperCase()
        : '';

    if (!roomId) {
      return res.status(400).json({
        error: 'roomId obbligatorio',
      });
    }

    const heartbeatAt =
      new Date().toISOString();

    const { data, error } =
      await supabase
        .from('room_participants')
        .update({
          last_seen_at: heartbeatAt,
        })
        .eq('room_id', roomId)
        .eq('actor_id', actor.id)
        .eq('actor_type', actor.type)
        .eq(
          'membership_status',
          'active'
        )
        .select('actor_id')
        .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    if (!data) {
      return res.status(409).json({
        error:
          'Partecipante non attivo',
      });
    }

    const { error: roomError } =
      await supabase
        .from('rooms')
        .update({
          empty_since: null,
        })
        .eq('id', roomId)
        .eq(
          'room_phase',
          'waiting'
        );

    if (roomError) {
      console.error(
        'Unable to clear room empty_since on heartbeat:',
        roomError.message
      );
    }

    return res.status(200).json({
      ok: true,
      last_seen_at: heartbeatAt,
    });
  }

  if (req.method === 'DELETE') {
    const actor =
      await resolveActor(req, res);

    if (!actor) {
      return res.status(401).json({
        error:
          'Sessione non valida o scaduta',
      });
    }

    const body = req.body as {
      roomId?: string;
      actorId?: string;
      action?:
        | 'leave'
        | 'cancel_request';
    };

    const roomId =
      typeof body.roomId === 'string'
        ? body.roomId.trim().toUpperCase()
        : '';

    const action =
      body.action ?? 'leave';

    if (!roomId) {
      return res.status(400).json({
        error: 'roomId obbligatorio',
      });
    }

    const {
      data: participant,
      error: participantError,
    } = await supabase
      .from('room_participants')
      .select(
        'actor_id, actor_type, role, membership_status'
      )
      .eq('room_id', roomId)
      .eq('actor_id', actor.id)
      .eq('actor_type', actor.type)
      .maybeSingle();

    if (participantError) {
      return res.status(500).json({
        error:
          participantError.message,
      });
    }

    if (!participant) {
      return res.status(404).json({
        error:
          'Partecipazione non trovata',
      });
    }

    if (participant.role === 'host') {
      return res.status(409).json({
        error:
          'L’host non può abbandonare direttamente la stanza. Prima va gestita la chiusura della stanza.',
      });
    }

    if (
      action === 'cancel_request'
    ) {
      if (
        participant.membership_status !==
        'pending'
      ) {
        return res.status(409).json({
          error:
            'Questa partecipazione non è una richiesta pendente',
        });
      }

      const { error } =
        await supabase
          .from('room_participants')
          .update({
            membership_status: 'left',
            left_at:
              new Date().toISOString(),
          })
          .eq('room_id', roomId)
          .eq('actor_id', actor.id)
          .eq(
            'actor_type',
            actor.type
          )
          .eq(
            'membership_status',
            'pending'
          );

      if (error) {
        return res.status(500).json({
          error: error.message,
        });
      }

      return res.status(200).json({
        ok: true,
        status: 'cancelled',
      });
    }

    if (
      participant.membership_status !==
      'active'
    ) {
      return res.status(409).json({
        error:
          'Non sei un partecipante attivo di questa stanza',
      });
    }

    const {
      data: room,
      error: roomError,
    } = await supabase
      .from('rooms')
      .select('room_phase')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) {
      return res.status(500).json({
        error: roomError.message,
      });
    }

    if (!room) {
      return res.status(404).json({
        error: 'Stanza non trovata',
      });
    }

    /*
     * Un leave ESPLICITO resta definitivo per la sessione.
     * Durante voting non consentiamo l'abbandono esplicito:
     * per assenze temporanee basta smettere di inviare heartbeat.
     */
    if (
      room.room_phase === 'voting'
    ) {
      return res.status(409).json({
        error:
          'Non puoi abbandonare definitivamente mentre la votazione è in corso.',
      });
    }

    const { error } =
      await supabase
        .from('room_participants')
        .update({
          membership_status: 'left',
          left_at:
            new Date().toISOString(),
        })
        .eq('room_id', roomId)
        .eq('actor_id', actor.id)
        .eq(
          'actor_type',
          actor.type
        )
        .eq(
          'membership_status',
          'active'
        );

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    /*
     * Leave esplicito = cancelliamo gli swipe.
     * Assenza temporanea = gli swipe restano e tornano validi
     * se la persona rientra.
     */
    const {
      error: swipeDeleteError,
    } = await supabase
      .from('room_swipes')
      .delete()
      .eq('room_id', roomId)
      .eq('actor_id', actor.id);

    if (swipeDeleteError) {
      return res.status(500).json({
        error:
          swipeDeleteError.message,
      });
    }

    return res.status(200).json({
      ok: true,
      status: 'left',
    });
  }

  return res.status(405).json({
    error: 'Method not allowed',
  });
}
