import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

type RoomType = 'private' | 'group' | 'cinema_pair' | 'cinema_group';
type Visibility = 'private' | 'following' | 'followers' | 'network' | 'local' | 'public';
type ActorType = 'user' | 'guest';

type CreateRoomPayload = {
  id: string;
  mode: string;
  genres?: string | null;
  year_from?: number | null;
  year_to?: number | null;
  room_type?: RoomType;
  min_members?: number;
  max_members?: number;
  match_threshold_percent?: number;
  visibility?: Visibility;
  requires_approval?: boolean;
  host_actor_id?: string | null;
  host_actor_type?: ActorType | null;
  host_display_name?: string | null;
  city?: string | null;
  province?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
};

const ROOM_TYPES: RoomType[] = ['private', 'group', 'cinema_pair', 'cinema_group'];
const VISIBILITIES: Visibility[] = ['private', 'following', 'followers', 'network', 'local', 'public'];
const ACTOR_TYPES: ActorType[] = ['user', 'guest'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient();

  if (req.method === 'POST') {
    const body = req.body as CreateRoomPayload;

    const id = typeof body.id === 'string' ? body.id.trim().toUpperCase() : '';
    const mode = typeof body.mode === 'string' ? body.mode.trim() : '';
    const roomType: RoomType = body.room_type ?? 'private';
    const minMembers = body.min_members ?? 2;
    const maxMembers = body.max_members ?? 2;
    const threshold = body.match_threshold_percent ?? 100;
    const visibility: Visibility = body.visibility ?? 'private';
    const requiresApproval = visibility === 'private';
    const hostActorId = body.host_actor_id ?? null;
    const hostActorType = body.host_actor_type ?? null;
    const hostDisplayName = typeof body.host_display_name === 'string' ? body.host_display_name.trim() : null;
    const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim() : null;
    const province = typeof body.province === 'string' && body.province.trim() ? body.province.trim() : null;
    const countryCode = typeof body.country_code === 'string' && body.country_code.trim()
      ? body.country_code.trim().toUpperCase()
      : 'IT';
    const latitude = typeof body.latitude === 'number' ? body.latitude : null;
    const longitude = typeof body.longitude === 'number' ? body.longitude : null;
    const radiusKm = Number.isInteger(body.radius_km) ? Number(body.radius_km) : 25;

    if (!id || !mode) {
      return res.status(400).json({ error: 'id e mode obbligatori' });
    }
    if (!ROOM_TYPES.includes(roomType)) {
      return res.status(400).json({ error: 'room_type non valido' });
    }
    if (!VISIBILITIES.includes(visibility)) {
      return res.status(400).json({ error: 'visibility non valida' });
    }
    if (!['private', 'public'].includes(visibility)) {
      return res.status(400).json({ error: 'Le nuove stanze possono essere solo private o pubbliche' });
    }
    if (!Number.isInteger(minMembers) || !Number.isInteger(maxMembers) || minMembers < 2 || maxMembers < minMembers || maxMembers > 20) {
      return res.status(400).json({ error: 'Limiti partecipanti non validi' });
    }
    if (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 200) {
      return res.status(400).json({ error: 'radius_km non valido' });
    }
    if ((latitude !== null && (latitude < -90 || latitude > 90)) ||
        (longitude !== null && (longitude < -180 || longitude > 180))) {
      return res.status(400).json({ error: 'Coordinate non valide' });
    }
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
      return res.status(400).json({ error: 'match_threshold_percent deve essere tra 1 e 100' });
    }
    if ((hostActorId && !hostActorType) || (!hostActorId && hostActorType)) {
      return res.status(400).json({ error: 'host_actor_id e host_actor_type devono essere forniti insieme' });
    }
    if (hostActorType && !ACTOR_TYPES.includes(hostActorType)) {
      return res.status(400).json({ error: 'host_actor_type non valido' });
    }

    try {
      const { data, error } = await supabase
        .from('rooms')
        .upsert({
          id,
          mode,
          genres: body.genres ?? null,
          year_from: body.year_from ?? null,
          year_to: body.year_to ?? null,
          room_type: roomType,
          min_members: minMembers,
          max_members: maxMembers,
          match_threshold_percent: threshold,
          visibility,
          requires_approval: requiresApproval,
          host_actor_id: hostActorId,
          host_actor_type: hostActorType,
          city,
          province,
          country_code: countryCode,
          latitude,
          longitude,
          radius_km: radiusKm,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Se conosciamo il creatore, lo registriamo subito come host persistente.
      if (hostActorId && hostActorType) {
        const expiresAt = hostActorType === 'guest'
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null;

        const { error: hostError } = await supabase
          .from('room_participants')
          .upsert({
            room_id: id,
            actor_id: hostActorId,
            actor_type: hostActorType,
            display_name: hostDisplayName || null,
            role: 'host',
            membership_status: 'active',
            left_at: null,
            expires_at: expiresAt,
          }, { onConflict: 'room_id,actor_id' });

        if (hostError) {
          // Evitiamo una stanza "orfana": se non possiamo registrare l'host,
          // segnaliamo l'errore e non fingiamo che la creazione sia completa.
          return res.status(500).json({ error: `Stanza creata ma host non registrato: ${hostError.message}` });
        }
      }

      return res.status(200).json({ ok: true, room: data });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? 'Errore durante il salvataggio della stanza' });
    }
  }

  if (req.method === 'GET') {
    const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const id = typeof rawId === 'string' ? rawId.trim().toUpperCase() : '';

    if (!id) return res.status(400).json({ error: 'id obbligatorio' });

    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Stanza non trovata' });

      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? 'Errore durante il caricamento della stanza' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}