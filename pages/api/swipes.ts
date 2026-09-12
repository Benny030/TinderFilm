import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';
import { resolveActor } from '@/utils/auth/serverActor';
import {
  getActiveRoomParticipants,
  reconcileVotingMatches,
} from '@/utils/rooms/reconcileMatches';

type SwipePayload = {
  roomId: string;
  movie_id: string;
  liked: boolean;
  actorId?: string;
  actorType?: 'user' | 'guest';
  displayName?: string | null;
};

const guestExpiry = () =>
  new Date(
    Date.now() + 24 * 60 * 60 * 1000
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

    if (!roomId) {
      return res.status(400).json({
        error: 'roomId obbligatorio',
      });
    }

    try {
      const now = new Date().toISOString();

      const matches =
        await reconcileVotingMatches(
          supabase,
          roomId
        );

      const { data: swipes, error } =
        await supabase
          .from('room_swipes')
          .select(
            'id, room_id, movie_id, actor_id, actor_type, liked, created_at, updated_at, expires_at'
          )
          .eq('room_id', roomId)
          .or(
            `expires_at.is.null,expires_at.gt.${now}`
          );

      if (error) {
        return res.status(500).json({
          error: error.message,
        });
      }

      return res.status(200).json({
        swipes: swipes ?? [],
        matches,
      });
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Errore nel ricalcolo dei match',
      });
    }
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

    const rawRoomId =
      (req.body?.roomId ??
        req.query.roomId) as
        | string
        | undefined;

    const roomId =
      typeof rawRoomId === 'string'
        ? rawRoomId.trim().toUpperCase()
        : '';

    if (!roomId) {
      return res.status(400).json({
        error: 'roomId obbligatorio',
      });
    }

    const { data: room, error: roomError } =
      await supabase
        .from('rooms')
        .select(
          'id, host_actor_id, host_actor_type'
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
          'Solo l’host può azzerare la stanza',
      });
    }

    const { error: matchError } =
      await supabase
        .from('room_matches')
        .delete()
        .eq('room_id', roomId);

    if (matchError) {
      return res.status(500).json({
        error: matchError.message,
      });
    }

    const { error: swipeError } =
      await supabase
        .from('room_swipes')
        .delete()
        .eq('room_id', roomId);

    if (swipeError) {
      return res.status(500).json({
        error: swipeError.message,
      });
    }

    return res.status(200).json({
      success: true,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Metodo non consentito',
    });
  }

  const actor =
    await resolveActor(req, res);

  if (!actor) {
    return res.status(401).json({
      error:
        'Sessione non valida o scaduta',
    });
  }

  const body =
    req.body as SwipePayload;

  const roomId =
    typeof body.roomId === 'string'
      ? body.roomId.trim().toUpperCase()
      : '';

  const movieId =
    typeof body.movie_id === 'string'
      ? body.movie_id.trim()
      : '';

  if (
    !roomId ||
    !movieId ||
    typeof body.liked !== 'boolean'
  ) {
    return res.status(400).json({
      error:
        'roomId, movie_id e liked sono obbligatori',
    });
  }

  try {
    const { data: room, error: roomError } =
      await supabase
        .from('rooms')
        .select(
          'id, min_members, match_threshold_percent, room_phase'
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

    if (room.room_phase !== 'voting') {
      return res.status(409).json({
        error:
          'Gli swipe sono consentiti solo durante la votazione',
      });
    }

    /*
     * Se questo film ha già raggiunto la maggioranza,
     * il voto degli altri partecipanti è ormai irrilevante.
     * Non salviamo ulteriori swipe sulla card già matchata.
     */
    const {
      data: alreadyMatched,
      error: alreadyMatchedError,
    } = await supabase
      .from('room_matches')
      .select(
        'id, room_id, movie_id, matched_members, total_members, match_percent, created_at'
      )
      .eq('room_id', roomId)
      .eq('movie_id', movieId)
      .maybeSingle();

    if (alreadyMatchedError) {
      return res.status(500).json({
        error: alreadyMatchedError.message,
      });
    }

    if (alreadyMatched) {
      return res.status(409).json({
        error:
          'Questo film è già diventato un match del gruppo',
        code: 'MOVIE_ALREADY_MATCHED',
        match: alreadyMatched,
      });
    }

    const now = new Date().toISOString();

    const {
      data: participant,
      error: participantError,
    } = await supabase
      .from('room_participants')
      .select(
        'actor_id, actor_type, membership_status, expires_at'
      )
      .eq('room_id', roomId)
      .eq('actor_id', actor.id)
      .eq('actor_type', actor.type)
      .eq('membership_status', 'active')
      .maybeSingle();

    if (participantError) {
      return res.status(500).json({
        error: participantError.message,
      });
    }

    if (!participant) {
      return res.status(403).json({
        error:
          'Non sei un partecipante attivo della stanza',
      });
    }

    if (
      participant.expires_at &&
      new Date(
        participant.expires_at
      ).getTime() <= Date.now()
    ) {
      return res.status(403).json({
        error:
          'La sessione guest della stanza è scaduta',
      });
    }

    const { data: swipe, error: swipeError } =
      await supabase
        .from('room_swipes')
        .upsert(
          {
            room_id: roomId,
            movie_id: movieId,
            actor_id: actor.id,
            actor_type: actor.type,
            liked: body.liked,
            expires_at:
              actor.type === 'guest'
                ? guestExpiry()
                : null,
          },
          {
            onConflict:
              'room_id,movie_id,actor_id',
          }
        )
        .select('*')
        .single();

    if (swipeError) {
      return res.status(500).json({
        error: swipeError.message,
      });
    }

    const matches =
      await reconcileVotingMatches(
        supabase,
        roomId
      );

    const currentMatch =
      matches.find(
        (match: any) =>
          String(match.movie_id) ===
          movieId
      ) ?? null;

    const participants =
      await getActiveRoomParticipants(
        supabase,
        roomId
      );

    const activeIds = new Set(
      participants.map(
        (p) => p.actor_id
      )
    );

    const { data: likedRows, error: likedError } =
      await supabase
        .from('room_swipes')
        .select('actor_id')
        .eq('room_id', roomId)
        .eq('movie_id', movieId)
        .eq('liked', true)
        .or(
          `expires_at.is.null,expires_at.gt.${now}`
        );

    if (likedError) {
      return res.status(500).json({
        error: likedError.message,
      });
    }

    const matchedMembers =
      new Set(
        (likedRows ?? [])
          .filter(
            (row: any) =>
              activeIds.has(row.actor_id)
          )
          .map(
            (row: any) =>
              row.actor_id
          )
      ).size;

    const totalMembers =
      participants.length;

    const matchPercent =
      totalMembers > 0
        ? Math.round(
            (matchedMembers / totalMembers) * 100
          )
        : 0;

    return res.status(201).json({
      swipe,
      matched: Boolean(currentMatch),
      match: currentMatch,
      stats: {
        matchedMembers,
        totalMembers,
        matchPercent,
        minMembers:
          room.min_members,
        thresholdPercent:
          room.match_threshold_percent,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Errore sconosciuto',
    });
  }
}
