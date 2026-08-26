import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

type HostAction = 'lock' | 'unlock' | 'start_voting' | 'select_winner' | 'finish_room' | 'remove_member' | 'approve_member' | 'reject_member';

type Payload = {
  roomId: string;
  requesterId: string;
  action: HostAction;
  targetActorId?: string;
  movieId?: string;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as Payload;
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim().toUpperCase() : '';
  const requesterId = typeof body.requesterId === 'string' ? body.requesterId.trim() : '';
  const action = body.action;

  if (!roomId || !requesterId || !action) {
    return res.status(400).json({ error: 'roomId, requesterId e action sono obbligatori' });
  }
  if (!isUuid(requesterId)) {
    return res.status(400).json({ error: 'requesterId non valido' });
  }

  const supabase = createClient();

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, host_actor_id, min_members, max_members, is_locked, room_phase')
    .eq('id', roomId)
    .maybeSingle();

  if (roomError) return res.status(500).json({ error: roomError.message });
  if (!room) return res.status(404).json({ error: 'Stanza non trovata' });
  if (room.host_actor_id !== requesterId) {
    return res.status(403).json({ error: 'Solo l’host può eseguire questa azione' });
  }

  if (action === 'lock' || action === 'unlock') {
    const isLocked = action === 'lock';
    const { data, error } = await supabase
      .from('rooms')
      .update({ is_locked: isLocked })
      .eq('id', roomId)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, room: data });
  }

  if (action === 'select_winner') {
    const movieId =
      typeof body.movieId === 'string' ? body.movieId.trim() : '';

    if (!movieId) {
      return res.status(400).json({ error: 'movieId obbligatorio' });
    }

    const { data: existingMatch, error: matchError } = await supabase
      .from('room_matches')
      .select('id, movie_id, matched_members, total_members, match_percent')
      .eq('room_id', roomId)
      .eq('movie_id', movieId)
      .maybeSingle();

    if (matchError) return res.status(500).json({ error: matchError.message });
    if (!existingMatch) {
      return res.status(409).json({
        error: 'Questo film non è un match valido della stanza',
      });
    }

    const { data, error } = await supabase
      .from('rooms')
      .update({
        selected_movie_id: movieId,
        selected_movie_at: new Date().toISOString(),
        room_phase: 'matched',
        is_locked: true,
      })
      .eq('id', roomId)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      ok: true,
      room: data,
      winner: existingMatch,
    });
  }

  if (action === 'finish_room') {
    const { data, error } = await supabase
      .from('rooms')
      .update({
        room_phase: 'finished',
        is_locked: true,
      })
      .eq('id', roomId)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, room: data });
  }

  if (action === 'start_voting') {
    const now = new Date().toISOString();
    const { count, error: countError } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('membership_status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (countError) return res.status(500).json({ error: countError.message });
    if ((count ?? 0) < Number(room.min_members ?? 2)) {
      return res.status(409).json({
        error: `Servono almeno ${room.min_members ?? 2} partecipanti per iniziare`,
      });
    }

    const { data, error } = await supabase
      .from('rooms')
      .update({ room_phase: 'voting', is_locked: true })
      .eq('id', roomId)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, room: data });
  }

  if (action === 'approve_member' || action === 'reject_member') {
    const targetActorId =
      typeof body.targetActorId === 'string' ? body.targetActorId.trim() : '';

    if (!targetActorId || !isUuid(targetActorId)) {
      return res.status(400).json({ error: 'targetActorId non valido' });
    }

    const { data: target, error: targetError } = await supabase
      .from('room_participants')
      .select('actor_id, membership_status, role')
      .eq('room_id', roomId)
      .eq('actor_id', targetActorId)
      .maybeSingle();

    if (targetError) return res.status(500).json({ error: targetError.message });
    if (!target) return res.status(404).json({ error: 'Richiesta non trovata' });
    if (target.membership_status !== 'pending') {
      return res.status(409).json({ error: 'Questa richiesta non è più pendente' });
    }

    if (action === 'approve_member') {
      const now = new Date().toISOString();
      const { count, error: countError } = await supabase
        .from('room_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('membership_status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${now}`);

      if (countError) return res.status(500).json({ error: countError.message });
      if ((count ?? 0) >= Number(room.max_members ?? 2)) {
        return res.status(409).json({ error: 'La stanza è già piena' });
      }

      const { error } = await supabase
        .from('room_participants')
        .update({
          membership_status: 'active',
          left_at: null,
        })
        .eq('room_id', roomId)
        .eq('actor_id', targetActorId);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, approved: true });
    }

    const { error } = await supabase
      .from('room_participants')
      .update({
        membership_status: 'removed',
        left_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('actor_id', targetActorId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, approved: false });
  }

  if (action === 'remove_member') {
    const targetActorId =
      typeof body.targetActorId === 'string' ? body.targetActorId.trim() : '';

    if (!targetActorId || !isUuid(targetActorId)) {
      return res.status(400).json({ error: 'targetActorId non valido' });
    }
    if (targetActorId === requesterId) {
      return res.status(400).json({ error: 'L’host non può rimuovere se stesso' });
    }

    const { data: target, error: targetError } = await supabase
      .from('room_participants')
      .select('actor_id, role, membership_status')
      .eq('room_id', roomId)
      .eq('actor_id', targetActorId)
      .maybeSingle();

    if (targetError) return res.status(500).json({ error: targetError.message });
    if (!target) return res.status(404).json({ error: 'Partecipante non trovato' });
    if (target.role === 'host') {
      return res.status(400).json({ error: 'Non puoi rimuovere l’host' });
    }

    const { error } = await supabase
      .from('room_participants')
      .update({
        membership_status: 'removed',
        left_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('actor_id', targetActorId);

    if (error) return res.status(500).json({ error: error.message });

    // Eliminiamo gli swipe del membro rimosso da questa stanza:
    // altrimenti continuerebbero a pesare sui match di gruppo.
    const { error: swipeDeleteError } = await supabase
      .from('room_swipes')
      .delete()
      .eq('room_id', roomId)
      .eq('actor_id', targetActorId);

    if (swipeDeleteError) {
      return res.status(500).json({ error: swipeDeleteError.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Azione host non valida' });
}