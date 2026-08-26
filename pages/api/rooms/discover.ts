import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

type DiscoverFilter = 'for_you' | 'following' | 'followers' | 'local';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawActorId = Array.isArray(req.query.actorId) ? req.query.actorId[0] : req.query.actorId;
  const actorId = typeof rawActorId === 'string' ? rawActorId.trim() : '';

  const rawCity = Array.isArray(req.query.city) ? req.query.city[0] : req.query.city;
  const city = typeof rawCity === 'string' ? rawCity.trim() : '';

  const rawFilter = Array.isArray(req.query.filter) ? req.query.filter[0] : req.query.filter;
  const filter: DiscoverFilter =
    rawFilter === 'following' || rawFilter === 'followers' || rawFilter === 'local'
      ? rawFilter
      : 'for_you';

  const rawLat = Array.isArray(req.query.lat) ? req.query.lat[0] : req.query.lat;
  const rawLon = Array.isArray(req.query.lon) ? req.query.lon[0] : req.query.lon;
  const rawRadius = Array.isArray(req.query.radiusKm) ? req.query.radiusKm[0] : req.query.radiusKm;

  const latitude = rawLat !== undefined && rawLat !== '' ? Number(rawLat) : null;
  const longitude = rawLon !== undefined && rawLon !== '' ? Number(rawLon) : null;
  const radiusKm = rawRadius !== undefined && rawRadius !== '' ? Number(rawRadius) : 25;

  if (actorId && !isUuid(actorId)) {
    return res.status(400).json({ error: 'actorId non valido' });
  }

  if (
    (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
  ) {
    return res.status(400).json({ error: 'Coordinate non valide' });
  }

  if (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 200) {
    return res.status(400).json({ error: 'Raggio non valido' });
  }

  const supabase = createClient();

  // La discovery considera tutte le stanze pubbliche ancora disponibili.
  let roomsQuery = supabase
    .from('rooms')
    .select(`
      id,
      mode,
      room_type,
      min_members,
      max_members,
      visibility,
      requires_approval,
      host_actor_id,
      host_actor_type,
      city,
      province,
      country_code,
      latitude,
      longitude,
      radius_km,
      is_locked,
      room_phase,
      created_at
    `)
    .eq('room_phase', 'waiting')
    .eq('is_locked', false)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(100);

  // Se non abbiamo coordinate, il comune diventa il filtro geografico.
  if (city && (latitude === null || longitude === null)) {
    roomsQuery = roomsQuery.ilike('city', city);
  }

  const { data: roomRows, error: roomsError } = await roomsQuery;

  if (roomsError) {
    return res.status(500).json({ error: roomsError.message });
  }

  const rooms = roomRows ?? [];
  if (rooms.length === 0) {
    return res.status(200).json({ rooms: [] });
  }

  const roomIds = rooms.map((room: any) => room.id);
  const hostIds = Array.from(
    new Set(
      rooms
        .map((room: any) => room.host_actor_id)
        .filter((id: any): id is string => typeof id === 'string')
    )
  );

  const now = new Date().toISOString();

  const [{ data: participants, error: participantsError }, { data: hostParticipants }] =
    await Promise.all([
      supabase
        .from('room_participants')
        .select('room_id, actor_id, membership_status, expires_at')
        .in('room_id', roomIds)
        .eq('membership_status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${now}`),
      supabase
        .from('room_participants')
        .select('room_id, actor_id, display_name, actor_type')
        .in('room_id', roomIds)
        .eq('role', 'host')
        .eq('membership_status', 'active'),
    ]);

  if (participantsError) {
    return res.status(500).json({ error: participantsError.message });
  }

  const countByRoom = new Map<string, number>();
  for (const participant of participants ?? []) {
    countByRoom.set(
      participant.room_id,
      (countByRoom.get(participant.room_id) ?? 0) + 1
    );
  }

  const hostByRoom = new Map<string, { display_name: string | null; actor_type: string }>();
  for (const host of hostParticipants ?? []) {
    hostByRoom.set(host.room_id, {
      display_name: host.display_name,
      actor_type: host.actor_type,
    });
  }

  // Relazioni social del richiedente. I guest non hanno righe in user_follows.
  const requesterFollows = new Set<string>();
  const requesterFollowers = new Set<string>();
  const requesterAllFollowing = new Set<string>();
  const commonFollowingByHost = new Map<string, number>();

  if (actorId && hostIds.length > 0) {
    const [{ data: followingRows }, { data: followerRows }, { data: allFollowingRows }] = await Promise.all([
      supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', actorId)
        .in('following_id', hostIds),
      supabase
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', actorId)
        .in('follower_id', hostIds),
      supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', actorId),
    ]);

    for (const row of followingRows ?? []) {
      requesterFollows.add(row.following_id);
    }
    for (const row of followerRows ?? []) {
      requesterFollowers.add(row.follower_id);
    }
    for (const row of allFollowingRows ?? []) {
      requesterAllFollowing.add(row.following_id);
    }

    const followedIds = Array.from(requesterAllFollowing);

    if (followedIds.length > 0) {
      const { data: hostFollowingRows } = await supabase
        .from('user_follows')
        .select('follower_id, following_id')
        .in('follower_id', hostIds)
        .in('following_id', followedIds);

      for (const row of hostFollowingRows ?? []) {
        commonFollowingByHost.set(
          row.follower_id,
          (commonFollowingByHost.get(row.follower_id) ?? 0) + 1
        );
      }
    }
  }

  const result = rooms
    .map((room: any) => {
      const participantCount = countByRoom.get(room.id) ?? 0;
      if (participantCount >= Number(room.max_members ?? 2)) return null;
      if (actorId && room.host_actor_id === actorId) return null;

      let distanceKm: number | null = null;

      if (
        latitude !== null &&
        longitude !== null &&
        typeof room.latitude === 'number' &&
        typeof room.longitude === 'number'
      ) {
        distanceKm = haversineKm(
          latitude,
          longitude,
          room.latitude,
          room.longitude
        );

        // Entrambi gli utenti devono considerarsi abbastanza vicini.
        const effectiveRadius = Math.min(
          radiusKm,
          Number(room.radius_km ?? 25)
        );

        if (distanceKm > effectiveRadius) return null;
      } else if (city && room.city && room.city.toLowerCase() !== city.toLowerCase()) {
        return null;
      }

      const hostId = typeof room.host_actor_id === 'string' ? room.host_actor_id : '';
      const iFollowHost = hostId ? requesterFollows.has(hostId) : false;
      const hostFollowsMe = hostId ? requesterFollowers.has(hostId) : false;
      const directNetwork = iFollowHost || hostFollowsMe;

      // Solo le stanze pubbliche entrano in discovery.
      // I rapporti social servono soltanto a filtrare/ordinare i risultati.
      if (room.visibility !== 'public') return null;

      if (filter === 'following' && !iFollowHost) return null;
      if (filter === 'followers' && !hostFollowsMe) return null;

      const relation =
        iFollowHost && hostFollowsMe
          ? 'mutual'
          : iFollowHost
            ? 'following'
            : hostFollowsMe
              ? 'follower'
              : 'public';

      const relationScore =
        relation === 'mutual'
          ? 0
          : relation === 'following'
            ? 1
            : relation === 'follower'
              ? 2
              : 3;

      return {
        id: room.id,
        mode: room.mode,
        room_type: room.room_type,
        city: room.city,
        province: room.province,
        radius_km: room.radius_km,
        min_members: room.min_members,
        max_members: room.max_members,
        participant_count: participantCount,
        available_spots: Math.max(0, Number(room.max_members ?? 2) - participantCount),
        visibility: room.visibility,
        requires_approval: Boolean(room.requires_approval),
        host_actor_id: room.host_actor_id,
        host_actor_type: room.host_actor_type,
        host_name: hostByRoom.get(room.id)?.display_name ?? 'Utente',
        relation,
        common_following_count: hostId ? (commonFollowingByHost.get(hostId) ?? 0) : 0,
        distance_km: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
        created_at: room.created_at,
        _relationScore: relationScore,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      // "Per te": prima rete sociale, poi distanza, poi stanze recenti.
      if (filter === 'for_you' && a._relationScore !== b._relationScore) {
        return a._relationScore - b._relationScore;
      }

      if (a.distance_km !== null && b.distance_km !== null && a.distance_km !== b.distance_km) {
        return a.distance_km - b.distance_km;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .map(({ _relationScore, ...room }: any) => room);

  return res.status(200).json({ rooms: result });
}