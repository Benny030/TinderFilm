import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';
import { resolveActor } from '@/utils/auth/serverActor';

type RoomType =
  | 'private'
  | 'group'
  | 'cinema_pair'
  | 'cinema_group';

type Visibility =
  | 'private'
  | 'following'
  | 'followers'
  | 'network'
  | 'local'
  | 'public';

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

  // Compatibilità con il frontend attuale.
  // Il server NON usa più questi valori per stabilire l'host.
  host_actor_id?: string | null;
  host_actor_type?: 'user' | 'guest' | null;
  host_display_name?: string | null;

  city?: string | null;
  province?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
};

const ROOM_TYPES: RoomType[] = [
  'private',
  'group',
  'cinema_pair',
  'cinema_group',
];

const VISIBILITIES: Visibility[] = [
  'private',
  'following',
  'followers',
  'network',
  'local',
  'public',
];

const guestExpiry = () =>
  new Date(
    Date.now() + 24 * 60 * 60 * 1000
  ).toISOString();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient();

  if (req.method === 'POST') {
    const actor = await resolveActor(req, res);

    if (!actor) {
      return res.status(401).json({
        error: 'Sessione non valida o scaduta',
      });
    }

    const body = req.body as CreateRoomPayload;

    const id =
      typeof body.id === 'string'
        ? body.id.trim().toUpperCase()
        : '';

    const mode =
      typeof body.mode === 'string'
        ? body.mode.trim()
        : '';

    const roomType: RoomType =
      body.room_type ?? 'private';

    const minMembers =
      body.min_members ?? 2;

    const maxMembers =
      body.max_members ?? 2;

    const threshold =
      body.match_threshold_percent ?? 100;

    const visibility: Visibility =
      body.visibility ?? 'private';

    const requiresApproval =
      visibility === 'private';

    const city =
      typeof body.city === 'string' &&
      body.city.trim()
        ? body.city.trim()
        : null;

    const province =
      typeof body.province === 'string' &&
      body.province.trim()
        ? body.province.trim()
        : null;

    const countryCode =
      typeof body.country_code === 'string' &&
      body.country_code.trim()
        ? body.country_code.trim().toUpperCase()
        : 'IT';

    const latitude =
      typeof body.latitude === 'number'
        ? body.latitude
        : null;

    const longitude =
      typeof body.longitude === 'number'
        ? body.longitude
        : null;

    const radiusKm =
      Number.isInteger(body.radius_km)
        ? Number(body.radius_km)
        : 25;

    if (!id || !mode) {
      return res.status(400).json({
        error: 'id e mode obbligatori',
      });
    }

    if (!ROOM_TYPES.includes(roomType)) {
      return res.status(400).json({
        error: 'room_type non valido',
      });
    }

    if (!VISIBILITIES.includes(visibility)) {
      return res.status(400).json({
        error: 'visibility non valida',
      });
    }

    if (!['private', 'public'].includes(visibility)) {
      return res.status(400).json({
        error:
          'Le nuove stanze possono essere solo private o pubbliche',
      });
    }

    if (
      !Number.isInteger(minMembers) ||
      !Number.isInteger(maxMembers) ||
      minMembers < 2 ||
      maxMembers < minMembers ||
      maxMembers > 20
    ) {
      return res.status(400).json({
        error: 'Limiti partecipanti non validi',
      });
    }

    if (
      !Number.isInteger(radiusKm) ||
      radiusKm < 1 ||
      radiusKm > 200
    ) {
      return res.status(400).json({
        error: 'radius_km non valido',
      });
    }

    if (
      (latitude !== null &&
        (latitude < -90 || latitude > 90)) ||
      (longitude !== null &&
        (longitude < -180 || longitude > 180))
    ) {
      return res.status(400).json({
        error: 'Coordinate non valide',
      });
    }

    if (
      !Number.isInteger(threshold) ||
      threshold < 1 ||
      threshold > 100
    ) {
      return res.status(400).json({
        error:
          'match_threshold_percent deve essere tra 1 e 100',
      });
    }

    /*
     * Non usiamo più UPSERT.
     *
     * Se il codice stanza esiste già, una nuova creazione
     * NON deve poter sovrascrivere host/configurazione.
     */
    const { data: existingRoom, error: existingError } =
      await supabase
        .from('rooms')
        .select('id')
        .eq('id', id)
        .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        error: existingError.message,
      });
    }

    if (existingRoom) {
      return res.status(409).json({
        error:
          'Codice stanza già esistente. Generane uno nuovo.',
      });
    }

    const displayName =
      actor.displayName ||
      (typeof body.host_display_name === 'string' &&
      body.host_display_name.trim()
        ? body.host_display_name.trim()
        : actor.type === 'guest'
          ? 'Ospite'
          : 'Utente');

    try {
      const { data, error } =
        await supabase
          .from('rooms')
          .insert({
            id,
            mode,
            genres: body.genres ?? null,
            year_from:
              body.year_from ?? null,
            year_to:
              body.year_to ?? null,
            room_type: roomType,
            min_members: minMembers,
            max_members: maxMembers,
            match_threshold_percent:
              threshold,
            visibility,
            requires_approval:
              requiresApproval,

            // Identità AUTOREVOLE lato server.
            host_actor_id: actor.id,
            host_actor_type: actor.type,

            city,
            province,
            country_code: countryCode,
            latitude,
            longitude,
            radius_km: radiusKm,
          })
          .select('*')
          .single();

      if (error) {
        /*
         * Copre anche un'eventuale collisione avvenuta
         * tra il controllo precedente e l'INSERT.
         */
        if (
          error.code === '23505'
        ) {
          return res.status(409).json({
            error:
              'Codice stanza già esistente. Generane uno nuovo.',
          });
        }

        throw error;
      }

      const now = new Date().toISOString();

      const { error: hostError } =
        await supabase
          .from('room_participants')
          .insert({
            room_id: id,
            actor_id: actor.id,
            actor_type: actor.type,
            display_name: displayName,
            role: 'host',
            membership_status: 'active',
            left_at: null,
            last_seen_at: now,
            expires_at:
              actor.type === 'guest'
                ? guestExpiry()
                : null,
          });

      if (hostError) {
        /*
         * Compensazione semplice:
         * se non riusciamo a creare l'host,
         * cancelliamo la stanza appena creata.
         *
         * La vera atomicità DB sarà una task separata,
         * ma così evitiamo una stanza orfana nel flusso normale.
         */
        await supabase
          .from('rooms')
          .delete()
          .eq('id', id)
          .eq('host_actor_id', actor.id);

        return res.status(500).json({
          error:
            `Impossibile registrare l'host: ${hostError.message}`,
        });
      }

      return res.status(201).json({
        ok: true,
        room: data,
      });
    } catch (err: any) {
      return res.status(500).json({
        error:
          err?.message ??
          'Errore durante il salvataggio della stanza',
      });
    }
  }

  if (req.method === 'GET') {
    const rawId =
      Array.isArray(req.query.id)
        ? req.query.id[0]
        : req.query.id;

    const id =
      typeof rawId === 'string'
        ? rawId.trim().toUpperCase()
        : '';

    if (!id) {
      return res.status(400).json({
        error: 'id obbligatorio',
      });
    }

    try {
      const { data, error } =
        await supabase
          .from('rooms')
          .select('*')
          .eq('id', id)
          .maybeSingle();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({
          error: 'Stanza non trovata',
        });
      }

      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({
        error:
          err?.message ??
          'Errore durante il caricamento della stanza',
      });
    }
  }

  return res.status(405).json({
    error: 'Method not allowed',
  });
}
