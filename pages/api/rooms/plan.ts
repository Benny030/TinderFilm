import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';
import { resolveActor } from '@/utils/auth/serverActor';

type SavePlanPayload = {
  roomId?: string;

  // Compatibilità con il frontend corrente.
  // Il server NON usa requesterId come identità.
  requesterId?: string;

  cinemaName?: string;
  showtimeAt?: string;
  cinemaId?: number | null;
  showingId?: string | null;
  bookingUrl?: string | null;
};

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

    const { data, error } =
      await supabase
        .from('rooms')
        .select(`
          id,
          room_type,
          room_phase,
          selected_movie_id,
          selected_movie_at,
          selected_cinema_name,
          selected_showtime_at,
          plan_confirmed_at,
          host_actor_id,
          city,
          province
        `)
        .eq('id', roomId)
        .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        error: 'Stanza non trovata',
      });
    }

    return res.status(200).json({
      plan: data,
    });
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
      req.body as SavePlanPayload;

    const roomId =
      typeof body.roomId === 'string'
        ? body.roomId.trim().toUpperCase()
        : '';

    const cinemaName =
      typeof body.cinemaName === 'string'
        ? body.cinemaName.trim()
        : '';

    const showtimeAt =
      typeof body.showtimeAt === 'string'
        ? body.showtimeAt.trim()
        : '';

    const cinemaId =
      typeof body.cinemaId === 'number' &&
      Number.isFinite(body.cinemaId)
        ? body.cinemaId
        : null;

    const showingId =
      typeof body.showingId === 'string' &&
      body.showingId.trim()
        ? body.showingId.trim()
        : null;

    const bookingUrl =
      typeof body.bookingUrl === 'string' &&
      body.bookingUrl.trim()
        ? body.bookingUrl.trim()
        : null;

    if (
      !roomId ||
      !cinemaName ||
      !showtimeAt
    ) {
      return res.status(400).json({
        error:
          'roomId, cinemaName e showtimeAt sono obbligatori',
      });
    }

    const parsedShowtime =
      new Date(showtimeAt);

    if (
      Number.isNaN(
        parsedShowtime.getTime()
      )
    ) {
      return res.status(400).json({
        error:
          'Data/orario non validi',
      });
    }

    const {
      data: room,
      error: roomError,
    } = await supabase
      .from('rooms')
      .select(
        'id, host_actor_id, host_actor_type, room_type, room_phase, selected_movie_id'
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
          'Solo l’host può confermare il piano',
      });
    }

    if (
      ![
        'cinema_pair',
        'cinema_group',
      ].includes(room.room_type)
    ) {
      return res.status(409).json({
        error:
          'Questa non è una stanza cinema',
      });
    }

    if (!room.selected_movie_id) {
      return res.status(409).json({
        error:
          'Prima devi scegliere il film vincente',
      });
    }

    if (
      ![
        'matched',
        'planning',
      ].includes(room.room_phase)
    ) {
      return res.status(409).json({
        error:
          'La stanza non è nella fase di pianificazione',
      });
    }

    /*
     * Non accettiamo una proiezione palesemente già passata.
     * Usiamo una tolleranza di 5 minuti per evitare falsi negativi
     * dovuti a piccoli scarti temporali.
     */
    if (
      parsedShowtime.getTime() <
      Date.now() - 5 * 60 * 1000
    ) {
      return res.status(409).json({
        error:
          'Non puoi selezionare una proiezione già trascorsa',
      });
    }

    const { data, error } =
      await supabase
        .from('rooms')
        .update({
          selected_cinema_name:
            cinemaName,
          selected_cinema_id:
            cinemaId,
          selected_showing_id:
            showingId,
          selected_booking_url:
            bookingUrl,
          selected_showtime_at:
            parsedShowtime.toISOString(),
          plan_confirmed_at:
            new Date().toISOString(),
          room_phase: 'planning',
          is_locked: true,
        })
        .eq('id', roomId)
        .eq(
          'host_actor_id',
          actor.id
        )
        .eq(
          'host_actor_type',
          actor.type
        )
        .select('*')
        .single();

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      plan: data,
    });
  }

  return res.status(405).json({
    error: 'Method not allowed',
  });
}
