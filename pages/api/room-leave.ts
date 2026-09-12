import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';
import { resolveActor } from '@/utils/auth/serverActor';
import { reconcileVotingMatches } from '@/utils/rooms/reconcileMatches';

type LeavePayload = {
  roomId?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  const actor = await resolveActor(req, res);

  if (!actor) {
    return res.status(401).json({
      error: 'Sessione non valida o scaduta',
    });
  }

  const roomId =
    typeof req.body?.roomId === 'string'
      ? req.body.roomId.trim().toUpperCase()
      : '';

  if (!roomId) {
    return res.status(400).json({
      error: 'roomId obbligatorio',
    });
  }

  const supabase = createClient();

  const { data: room, error: roomError } =
    await supabase
      .from('rooms')
      .select(
        'id, host_actor_id, host_actor_type, room_phase'
      )
      .eq('id', roomId)
      .maybeSingle();

  if (roomError) {
    return res.status(500).json({
      error: roomError.message,
    });
  }

  if (!room) {
    return res.status(200).json({
      ok: true,
      alreadyGone: true,
    });
  }

  const isHost =
    room.host_actor_id === actor.id &&
    room.host_actor_type === actor.type;

  const now = new Date().toISOString();

  /*
   * Se l'host conferma l'uscita, la stanza termina.
   */
  if (isHost) {
    if (
      room.room_phase !== 'finished' &&
      room.room_phase !== 'expired'
    ) {
      const { error } = await supabase
        .from('rooms')
        .update({
          room_phase: 'finished',
          is_locked: true,
        })
        .eq('id', roomId)
        .eq('host_actor_id', actor.id)
        .eq('host_actor_type', actor.type);

      if (error) {
        return res.status(500).json({
          error: error.message,
        });
      }
    }

    await supabase
      .from('room_participants')
      .update({
        membership_status: 'left',
        left_at: now,
      })
      .eq('room_id', roomId)
      .eq('actor_id', actor.id)
      .eq('actor_type', actor.type);

    return res.status(200).json({
      ok: true,
      role: 'host',
      roomClosed: true,
    });
  }

  const {
    data: participant,
    error: participantError,
  } = await supabase
    .from('room_participants')
    .select(
      'actor_id, actor_type, membership_status, role'
    )
    .eq('room_id', roomId)
    .eq('actor_id', actor.id)
    .eq('actor_type', actor.type)
    .maybeSingle();

  if (participantError) {
    return res.status(500).json({
      error: participantError.message,
    });
  }

  if (!participant) {
    return res.status(200).json({
      ok: true,
      alreadyLeft: true,
    });
  }

  if (
    participant.membership_status === 'left' ||
    participant.membership_status === 'removed'
  ) {
    return res.status(200).json({
      ok: true,
      alreadyLeft: true,
    });
  }

  const { error: leaveError } =
    await supabase
      .from('room_participants')
      .update({
        membership_status: 'left',
        left_at: now,
      })
      .eq('room_id', roomId)
      .eq('actor_id', actor.id)
      .eq('actor_type', actor.type);

  if (leaveError) {
    return res.status(500).json({
      error: leaveError.message,
    });
  }

  /*
   * Chi conferma l'uscita dalla votazione non deve più
   * influenzare il gruppo con gli swipe precedenti.
   */
  const { error: swipeDeleteError } =
    await supabase
      .from('room_swipes')
      .delete()
      .eq('room_id', roomId)
      .eq('actor_id', actor.id);

  if (swipeDeleteError) {
    return res.status(500).json({
      error: swipeDeleteError.message,
    });
  }

  /*
   * Ricalcolo IMMEDIATO: non aspettiamo il prossimo swipe.
   */
  if (room.room_phase === 'voting') {
    try {
      await reconcileVotingMatches(
        supabase,
        roomId
      );
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Errore nel ricalcolo del gruppo',
      });
    }
  }

  return res.status(200).json({
    ok: true,
    role: 'member',
    status: 'left',
  });
}
