import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

type ActorType = 'user' | 'guest';

type SwipePayload = {
  roomId: string;
  movie_id: string;
  liked: boolean;
  actorId: string;
  actorType: ActorType;
  displayName?: string | null;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const guestExpiry = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient();

  if (req.method === 'GET') {
    const rawRoomId = Array.isArray(req.query.roomId) ? req.query.roomId[0] : req.query.roomId;
    const roomId = typeof rawRoomId === 'string' ? rawRoomId.trim().toUpperCase() : '';

    if (!roomId) return res.status(400).json({ error: 'roomId obbligatorio' });

    const now = new Date().toISOString();
    const [{ data: swipes, error: swipesError }, { data: matches, error: matchesError }] = await Promise.all([
      supabase
        .from('room_swipes')
        .select('id, room_id, movie_id, actor_id, actor_type, liked, created_at, updated_at, expires_at')
        .eq('room_id', roomId)
        .or(`expires_at.is.null,expires_at.gt.${now}`),
      supabase
        .from('room_matches')
        .select('id, room_id, movie_id, matched_members, total_members, match_percent, created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true }),
    ]);

    if (swipesError) return res.status(500).json({ error: swipesError.message });
    if (matchesError) return res.status(500).json({ error: matchesError.message });

    return res.status(200).json({ swipes: swipes ?? [], matches: matches ?? [] });
  }

  if (req.method === 'DELETE') {
    const rawRoomId = (req.body?.roomId ?? req.query.roomId) as string | undefined;
    const roomId = typeof rawRoomId === 'string' ? rawRoomId.trim().toUpperCase() : '';

    if (!roomId) return res.status(400).json({ error: 'roomId obbligatorio: il reset globale non è più consentito' });

    const { error: matchDeleteError } = await supabase.from('room_matches').delete().eq('room_id', roomId);
    if (matchDeleteError) return res.status(500).json({ error: matchDeleteError.message });

    const { error: swipeDeleteError } = await supabase.from('room_swipes').delete().eq('room_id', roomId);
    if (swipeDeleteError) return res.status(500).json({ error: swipeDeleteError.message });

    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const body = req.body as SwipePayload;
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim().toUpperCase() : '';
  const movieId = typeof body.movie_id === 'string' ? body.movie_id.trim() : '';
  const actorId = typeof body.actorId === 'string' ? body.actorId.trim() : '';
  const actorType = body.actorType;

  if (!roomId || !movieId || !actorId || typeof body.liked !== 'boolean') {
    return res.status(400).json({ error: 'roomId, movie_id, actorId e liked sono obbligatori' });
  }
  if (!['user', 'guest'].includes(actorType)) return res.status(400).json({ error: 'actorType non valido' });
  if (!isUuid(actorId)) return res.status(400).json({ error: 'actorId deve essere un UUID valido' });

  try {
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, min_members, max_members, match_threshold_percent')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) return res.status(500).json({ error: roomError.message });
    if (!room) return res.status(404).json({ error: 'Stanza non trovata' });

    const now = new Date().toISOString();
    const { data: participant, error: participantError } = await supabase
      .from('room_participants')
      .select('actor_id, actor_type, display_name, membership_status, expires_at')
      .eq('room_id', roomId)
      .eq('actor_id', actorId)
      .eq('membership_status', 'active')
      .maybeSingle();

    if (participantError) return res.status(500).json({ error: participantError.message });
    if (!participant) return res.status(403).json({ error: 'Non sei un partecipante attivo della stanza' });
    if (participant.expires_at && new Date(participant.expires_at).getTime() <= Date.now()) {
      return res.status(403).json({ error: 'La sessione guest della stanza è scaduta' });
    }

    const { data: swipe, error: swipeError } = await supabase
      .from('room_swipes')
      .upsert({
        room_id: roomId,
        movie_id: movieId,
        actor_id: actorId,
        actor_type: actorType,
        liked: body.liked,
        expires_at: actorType === 'guest' ? guestExpiry() : null,
      }, { onConflict: 'room_id,movie_id,actor_id' })
      .select('*')
      .single();

    if (swipeError) return res.status(500).json({ error: swipeError.message });

    const { data: activeParticipants, error: participantsError } = await supabase
      .from('room_participants')
      .select('actor_id, actor_type, display_name, expires_at')
      .eq('room_id', roomId)
      .eq('membership_status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (participantsError) return res.status(500).json({ error: participantsError.message });

    const participants = activeParticipants ?? [];
    const activeIds = new Set(participants.map((p: any) => p.actor_id));
    const totalMembers = participants.length;

    const { data: likedRows, error: likedError } = await supabase
      .from('room_swipes')
      .select('actor_id, actor_type')
      .eq('room_id', roomId)
      .eq('movie_id', movieId)
      .eq('liked', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (likedError) return res.status(500).json({ error: likedError.message });

    const validLikedRows = (likedRows ?? []).filter((row: any) => activeIds.has(row.actor_id));
    const likedIds = new Set(validLikedRows.map((row: any) => row.actor_id));
    const matchedMembers = likedIds.size;
    const matchPercent = totalMembers > 0 ? Math.round((matchedMembers / totalMembers) * 100) : 0;
    const matched = totalMembers >= room.min_members && matchPercent >= room.match_threshold_percent;

    let match: any = null;

    if (matched) {
      const { data: matchRow, error: matchError } = await supabase
        .from('room_matches')
        .upsert({
          room_id: roomId,
          movie_id: movieId,
          matched_members: matchedMembers,
          total_members: totalMembers,
          match_percent: matchPercent,
        }, { onConflict: 'room_id,movie_id' })
        .select('*')
        .single();

      if (matchError) return res.status(500).json({ error: matchError.message });
      match = matchRow;

      const matchParticipants = participants
        .filter((p: any) => likedIds.has(p.actor_id))
        .map((p: any) => ({
          match_id: match.id,
          actor_id: p.actor_id,
          actor_type: p.actor_type,
          display_name: p.display_name ?? null,
          expires_at: p.actor_type === 'guest' ? p.expires_at ?? guestExpiry() : null,
        }));

      if (matchParticipants.length > 0) {
        const { error: upsertMembersError } = await supabase
          .from('room_match_participants')
          .upsert(matchParticipants, {
            onConflict: 'match_id,actor_id',
          });

        if (upsertMembersError) {
          return res.status(500).json({ error: upsertMembersError.message });
        }
      }

      // Rimuoviamo solo eventuali partecipanti non più validi per questo match.
      // Questo mantiene il contenuto coerente senza introdurre una finestra di race
      // tra DELETE e INSERT quando arrivano swipe concorrenti.
      const validActorIds = matchParticipants.map((p: any) => p.actor_id);

      if (validActorIds.length > 0) {
        const { data: existingMembers, error: existingMembersError } = await supabase
          .from('room_match_participants')
          .select('actor_id')
          .eq('match_id', match.id);

        if (existingMembersError) {
          return res.status(500).json({ error: existingMembersError.message });
        }

        const staleActorIds = (existingMembers ?? [])
          .map((row: any) => row.actor_id)
          .filter((actorId: string) => !validActorIds.includes(actorId));

        if (staleActorIds.length > 0) {
          const { error: staleDeleteError } = await supabase
            .from('room_match_participants')
            .delete()
            .eq('match_id', match.id)
            .in('actor_id', staleActorIds);

          if (staleDeleteError) {
            return res.status(500).json({ error: staleDeleteError.message });
          }
        }
      }
    } else {
      // Se il consenso scende sotto la soglia, rimuoviamo un eventuale match precedente.
      const { error: deleteMatchError } = await supabase
        .from('room_matches')
        .delete()
        .eq('room_id', roomId)
        .eq('movie_id', movieId);

      if (deleteMatchError) return res.status(500).json({ error: deleteMatchError.message });
    }

    return res.status(201).json({
      swipe,
      matched,
      match,
      stats: {
        matchedMembers,
        totalMembers,
        matchPercent,
        minMembers: room.min_members,
        thresholdPercent: room.match_threshold_percent,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Errore sconosciuto' });
  }
}