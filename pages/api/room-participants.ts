import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

type ActorType = 'user' | 'guest';
type Role = 'host' | 'member';
type MembershipStatus = 'pending' | 'active' | 'left' | 'removed';

type ParticipantPayload = {
  roomId: string;
  actorId: string;
  actorType: ActorType;
  displayName?: string | null;
  role?: Role;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const guestExpiry = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const presenceCutoff = () => new Date(Date.now() - 45 * 1000).toISOString();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient();

  if (req.method === 'GET') {
    const rawRoomId = Array.isArray(req.query.roomId) ? req.query.roomId[0] : req.query.roomId;
    const roomId = typeof rawRoomId === 'string' ? rawRoomId.trim().toUpperCase() : '';
    const wantsPending = req.query.pending === '1';
    const rawRequesterId = Array.isArray(req.query.requesterId) ? req.query.requesterId[0] : req.query.requesterId;
    const requesterId = typeof rawRequesterId === 'string' ? rawRequesterId.trim() : '';

    if (!roomId) return res.status(400).json({ error: 'roomId obbligatorio' });

    if (wantsPending) {
      if (!requesterId || !isUuid(requesterId)) {
        return res.status(400).json({ error: 'requesterId valido obbligatorio per leggere le richieste' });
      }

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('host_actor_id')
        .eq('id', roomId)
        .maybeSingle();

      if (roomError) return res.status(500).json({ error: roomError.message });
      if (!room) return res.status(404).json({ error: 'Stanza non trovata' });
      if (room.host_actor_id !== requesterId) {
        return res.status(403).json({ error: 'Solo l’host può vedere le richieste pendenti' });
      }
    }

    const now = new Date().toISOString();

    let participantsQuery = supabase
      .from('room_participants')
      .select('id, room_id, actor_id, actor_type, display_name, role, membership_status, joined_at, left_at, expires_at, last_seen_at')
      .eq('room_id', roomId)
      .eq('membership_status', wantsPending ? 'pending' : 'active')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('joined_at', { ascending: true });

    // Le richieste pending restano visibili finché l'host non le gestisce.
    // I partecipanti "active" invece devono essere realmente presenti adesso.
    if (!wantsPending) {
      participantsQuery = participantsQuery.gte('last_seen_at', presenceCutoff());
    }

    const { data, error } = await participantsQuery;

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data ?? []);
  }

  if (req.method === 'POST') {
    const body = req.body as ParticipantPayload;
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim().toUpperCase() : '';
    const actorId = typeof body.actorId === 'string' ? body.actorId.trim() : '';
    const actorType = body.actorType;

    if (!roomId || !actorId || !['user', 'guest'].includes(actorType)) {
      return res.status(400).json({ error: 'roomId, actorId e actorType sono obbligatori' });
    }
    if (!isUuid(actorId)) return res.status(400).json({ error: 'actorId deve essere un UUID valido' });

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, max_members, visibility, requires_approval, host_actor_id, is_locked, room_phase')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) return res.status(500).json({ error: roomError.message });
    if (!room) return res.status(404).json({ error: 'Stanza non trovata' });

    const now = new Date().toISOString();
    const { count, error: countError } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('membership_status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .gte('last_seen_at', presenceCutoff());

    if (countError) return res.status(500).json({ error: countError.message });

    const { data: existing } = await supabase
      .from('room_participants')
      .select('actor_id, membership_status')
      .eq('room_id', roomId)
      .eq('actor_id', actorId)
      .maybeSingle();

    const isHost = room.host_actor_id === actorId;
    const existingIsPresent =
      existing?.membership_status === 'active' ||
      existing?.membership_status === 'pending';

    // IMPORTANTE:
    // - l'host è sempre active;
    // - una stanza pubblica attiva subito il partecipante;
    // - in una stanza privata, se l'host aveva già approvato il partecipante,
    //   un refresh/rientro NON deve riportarlo da active a pending.
    const membershipStatus: MembershipStatus =
      isHost ||
      existing?.membership_status === 'active' ||
      room.visibility === 'public'
        ? 'active'
        : 'pending';

    // Una stanza chiusa/votazione avviata non accetta NUOVI ingressi.
    // Active/pending già esistenti possono invece rientrare/ricaricare.
    if (!existingIsPresent && !isHost && (room.is_locked || room.room_phase !== 'waiting')) {
      return res.status(423).json({ error: 'Gli ingressi in questa stanza sono chiusi' });
    }

    if (!existingIsPresent && membershipStatus === 'active' && (count ?? 0) >= room.max_members) {
      return res.status(409).json({ error: 'Stanza piena' });
    }

    const { data, error } = await supabase
      .from('room_participants')
      .upsert({
        room_id: roomId,
        actor_id: actorId,
        actor_type: actorType,
        display_name: body.displayName?.trim() || null,
        role: isHost ? 'host' : 'member',
        membership_status: membershipStatus,
        left_at: null,
        last_seen_at: now,
        expires_at: actorType === 'guest' ? guestExpiry() : null,
      }, { onConflict: 'room_id,actor_id' })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if (membershipStatus === 'active') {
      const { error: roomPresenceError } = await supabase
        .from('rooms')
        .update({ empty_since: null })
        .eq('id', roomId);

      if (roomPresenceError) {
        console.error('Unable to clear room empty_since:', roomPresenceError.message);
      }
    }

    return res.status(existing ? 200 : 201).json({ participant: data });
  }

  if (req.method === 'PATCH') {
    const body = req.body as { roomId?: string; actorId?: string };
    const roomId =
      typeof body.roomId === 'string' ? body.roomId.trim().toUpperCase() : '';
    const actorId =
      typeof body.actorId === 'string' ? body.actorId.trim() : '';

    if (!roomId || !actorId || !isUuid(actorId)) {
      return res.status(400).json({ error: 'roomId e actorId validi obbligatori' });
    }

    const heartbeatAt = new Date().toISOString();

    const { data, error } = await supabase
      .from('room_participants')
      .update({ last_seen_at: heartbeatAt })
      .eq('room_id', roomId)
      .eq('actor_id', actorId)
      .eq('membership_status', 'active')
      .select('actor_id')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) {
      return res.status(409).json({ error: 'Partecipante non attivo' });
    }

    // Se qualcuno è presente, la stanza non è vuota.
    const { error: roomError } = await supabase
      .from('rooms')
      .update({ empty_since: null })
      .eq('id', roomId)
      .eq('room_phase', 'waiting');

    if (roomError) {
      console.error('Unable to clear room empty_since on heartbeat:', roomError.message);
    }

    return res.status(200).json({ ok: true, last_seen_at: heartbeatAt });
  }

  if (req.method === 'DELETE') {
    const body = req.body as {
      roomId?: string;
      actorId?: string;
      action?: 'leave' | 'cancel_request';
    };

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim().toUpperCase() : '';
    const actorId = typeof body.actorId === 'string' ? body.actorId.trim() : '';
    const action = body.action ?? 'leave';

    if (!roomId || !actorId) {
      return res.status(400).json({ error: 'roomId e actorId obbligatori' });
    }
    if (!isUuid(actorId)) {
      return res.status(400).json({ error: 'actorId deve essere un UUID valido' });
    }

    const { data: participant, error: participantError } = await supabase
      .from('room_participants')
      .select('actor_id, role, membership_status')
      .eq('room_id', roomId)
      .eq('actor_id', actorId)
      .maybeSingle();

    if (participantError) {
      return res.status(500).json({ error: participantError.message });
    }
    if (!participant) {
      return res.status(404).json({ error: 'Partecipazione non trovata' });
    }

    if (participant.role === 'host') {
      return res.status(409).json({
        error: 'L’host non può abbandonare direttamente la stanza. Prima va gestito il trasferimento o la chiusura della stanza.',
      });
    }

    if (action === 'cancel_request') {
      if (participant.membership_status !== 'pending') {
        return res.status(409).json({ error: 'Questa partecipazione non è una richiesta pendente' });
      }

      const { error } = await supabase
        .from('room_participants')
        .update({
          membership_status: 'left',
          left_at: new Date().toISOString(),
        })
        .eq('room_id', roomId)
        .eq('actor_id', actorId);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, status: 'cancelled' });
    }

    if (participant.membership_status !== 'active') {
      return res.status(409).json({ error: 'Non sei un partecipante attivo di questa stanza' });
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('room_phase')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) return res.status(500).json({ error: roomError.message });
    if (!room) return res.status(404).json({ error: 'Stanza non trovata' });

    if (room.room_phase === 'voting') {
      return res.status(409).json({
        error: 'Non puoi abbandonare mentre la votazione è in corso.',
      });
    }

    const { error } = await supabase
      .from('room_participants')
      .update({
        membership_status: 'left',
        left_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('actor_id', actorId);

    if (error) return res.status(500).json({ error: error.message });

    // Gli swipe di chi abbandona non devono continuare a influenzare il gruppo.
    const { error: swipeDeleteError } = await supabase
      .from('room_swipes')
      .delete()
      .eq('room_id', roomId)
      .eq('actor_id', actorId);

    if (swipeDeleteError) {
      return res.status(500).json({ error: swipeDeleteError.message });
    }

    // Se dopo l'uscita non resta nessun partecipante attivo, parte il timer
    // di 2 minuti. Se invece qualcuno è ancora dentro, il timer resta azzerato.
    const activeNow = new Date().toISOString();
    const { count: remainingActive, error: remainingError } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('membership_status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${activeNow}`)
      .gte('last_seen_at', presenceCutoff());

    if (remainingError) {
      console.error('Unable to count remaining participants:', remainingError.message);
    } else {
      const { error: roomEmptyError } = await supabase
        .from('rooms')
        .update({
          empty_since: (remainingActive ?? 0) === 0 ? activeNow : null,
        })
        .eq('id', roomId)
        .eq('visibility', 'public')
        .eq('room_phase', 'waiting');

      if (roomEmptyError) {
        console.error('Unable to update room empty_since:', roomEmptyError.message);
      }
    }

    return res.status(200).json({ ok: true, status: 'left' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
