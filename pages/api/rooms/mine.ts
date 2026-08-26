import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawActorId = Array.isArray(req.query.actorId) ? req.query.actorId[0] : req.query.actorId;
  const actorId = typeof rawActorId === 'string' ? rawActorId.trim() : '';

  if (!actorId || !isUuid(actorId)) {
    return res.status(400).json({ error: 'actorId valido obbligatorio' });
  }

  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: memberships, error: membershipsError } = await supabase
    .from('room_participants')
    .select('room_id, role, membership_status, joined_at, expires_at')
    .eq('actor_id', actorId)
    .in('membership_status', ['active', 'pending'])
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('joined_at', { ascending: false });

  if (membershipsError) {
    return res.status(500).json({ error: membershipsError.message });
  }

  const rows = memberships ?? [];
  if (rows.length === 0) {
    return res.status(200).json({ active: [], pending: [], finished: [] });
  }

  const roomIds = Array.from(new Set(rows.map((row: any) => row.room_id)));

  const [{ data: rooms, error: roomsError }, { data: participants, error: participantsError }] =
    await Promise.all([
      supabase
        .from('rooms')
        .select(`
          id,
          mode,
          room_type,
          min_members,
          max_members,
          city,
          province,
          visibility,
          requires_approval,
          host_actor_id,
          is_locked,
          room_phase,
          created_at
        `)
        .in('id', roomIds),
      supabase
        .from('room_participants')
        .select('room_id, actor_id, display_name, role, membership_status, expires_at')
        .in('room_id', roomIds)
        .eq('membership_status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${now}`),
    ]);

  if (roomsError) return res.status(500).json({ error: roomsError.message });
  if (participantsError) return res.status(500).json({ error: participantsError.message });

  const roomMap = new Map((rooms ?? []).map((room: any) => [room.id, room]));
  const countByRoom = new Map<string, number>();
  const hostNameByRoom = new Map<string, string>();

  for (const participant of participants ?? []) {
    countByRoom.set(
      participant.room_id,
      (countByRoom.get(participant.room_id) ?? 0) + 1
    );

    if (participant.role === 'host') {
      hostNameByRoom.set(
        participant.room_id,
        participant.display_name || 'Utente'
      );
    }
  }

  const normalize = (membership: any) => {
    const room: any = roomMap.get(membership.room_id);
    if (!room) return null;

    return {
      id: room.id,
      mode: room.mode,
      room_type: room.room_type,
      city: room.city,
      province: room.province,
      min_members: room.min_members,
      max_members: room.max_members,
      participant_count: countByRoom.get(room.id) ?? 0,
      visibility: room.visibility,
      requires_approval: Boolean(room.requires_approval),
      host_actor_id: room.host_actor_id,
      host_name: hostNameByRoom.get(room.id) ?? 'Utente',
      is_host: membership.role === 'host',
      membership_status: membership.membership_status,
      is_locked: Boolean(room.is_locked),
      room_phase: room.room_phase,
      created_at: room.created_at,
      joined_at: membership.joined_at,
    };
  };

  const normalizedActive = rows
    .filter((row: any) => row.membership_status === 'active')
    .map(normalize)
    .filter(Boolean) as any[];

  const active = normalizedActive.filter((room: any) => room.room_phase !== 'finished');
  const finished = normalizedActive.filter((room: any) => room.room_phase === 'finished');

  const pending = rows
    .filter((row: any) => row.membership_status === 'pending')
    .map(normalize)
    .filter(Boolean);

  return res.status(200).json({ active, pending, finished });
}