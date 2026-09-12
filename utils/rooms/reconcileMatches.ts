import { createClient } from '@/utils/supabase/server';

type SupabaseServerClient = ReturnType<typeof createClient>;

type ActiveParticipant = {
  actor_id: string;
  actor_type: 'user' | 'guest';
  display_name: string | null;
  expires_at: string | null;
};

const guestExpiry = () =>
  new Date(
    Date.now() + 24 * 60 * 60 * 1000
  ).toISOString();

export async function getActiveRoomParticipants(
  supabase: SupabaseServerClient,
  roomId: string
): Promise<ActiveParticipant[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('room_participants')
    .select(
      'actor_id, actor_type, display_name, expires_at'
    )
    .eq('room_id', roomId)
    .eq('membership_status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error) throw error;

  return (data ?? []) as ActiveParticipant[];
}

export async function reconcileVotingMatches(
  supabase: SupabaseServerClient,
  roomId: string
) {
  const now = new Date().toISOString();

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select(
      'id, room_phase, match_threshold_percent'
    )
    .eq('id', roomId)
    .maybeSingle();

  if (roomError) throw roomError;
  if (!room) return [];

  /*
   * Dopo che il vincitore è stato scelto non tocchiamo più i match:
   * in matched/planning il risultato è già stato deciso.
   */
  if (room.room_phase !== 'voting') {
    const { data: existing, error } = await supabase
      .from('room_matches')
      .select(
        'id, room_id, movie_id, matched_members, total_members, match_percent, created_at'
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return existing ?? [];
  }

  const participants =
    await getActiveRoomParticipants(
      supabase,
      roomId
    );

  const activeIds = new Set(
    participants.map((p) => p.actor_id)
  );

  const totalMembers = participants.length;

  const [
    { data: likedRows, error: likedError },
    { data: existingMatches, error: existingError },
  ] = await Promise.all([
    supabase
      .from('room_swipes')
      .select('movie_id, actor_id')
      .eq('room_id', roomId)
      .eq('liked', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`),

    supabase
      .from('room_matches')
      .select(
        'id, movie_id, matched_members, total_members, match_percent'
      )
      .eq('room_id', roomId),
  ]);

  if (likedError) throw likedError;
  if (existingError) throw existingError;

  const likedByMovie =
    new Map<string, Set<string>>();

  for (const row of likedRows ?? []) {
    if (!activeIds.has(row.actor_id)) continue;

    const movieId = String(row.movie_id);

    if (!likedByMovie.has(movieId)) {
      likedByMovie.set(movieId, new Set());
    }

    likedByMovie
      .get(movieId)!
      .add(row.actor_id);
  }

  const existingByMovie = new Map(
    (existingMatches ?? []).map((row: any) => [
      String(row.movie_id),
      row,
    ])
  );

  const movieIds = new Set<string>([
    ...likedByMovie.keys(),
    ...existingByMovie.keys(),
  ]);

  /*
   * min_members serve per AVVIARE la stanza.
   * Una volta iniziato voting, se qualcuno esce,
   * la votazione può continuare finché restano almeno 2 persone.
   */
  const canStillMatch = totalMembers >= 2;

  for (const movieId of movieIds) {
    const likedIds =
      likedByMovie.get(movieId) ??
      new Set<string>();

    const matchedMembers = likedIds.size;

    const matchPercent =
      totalMembers > 0
        ? Math.round(
            (matchedMembers / totalMembers) * 100
          )
        : 0;

    /*
     * Regola di gruppo: maggioranza assoluta.
     *
     * 2 persone -> servono 2 sì
     * 3 persone -> servono 2 sì
     * 4 persone -> servono 3 sì
     * 5 persone -> servono 3 sì
     *
     * È più intuitiva di una percentuale fissa al 70%:
     * 2/3 è una maggioranza reale e deve produrre match.
     */
    const requiredLikes =
      Math.floor(totalMembers / 2) + 1;

    const matched =
      canStillMatch &&
      matchedMembers >= requiredLikes;

    const existing =
      existingByMovie.get(movieId);

    if (!matched) {
      if (existing) {
        const { error: deleteError } =
          await supabase
            .from('room_matches')
            .delete()
            .eq('id', existing.id);

        if (deleteError) throw deleteError;
      }

      continue;
    }

    const { data: matchRow, error: matchError } =
      await supabase
        .from('room_matches')
        .upsert(
          {
            room_id: roomId,
            movie_id: movieId,
            matched_members:
              matchedMembers,
            total_members:
              totalMembers,
            match_percent:
              matchPercent,
          },
          {
            onConflict:
              'room_id,movie_id',
          }
        )
        .select('id')
        .single();

    if (matchError) throw matchError;

    const matchId = matchRow.id;

    const matchParticipants =
      participants
        .filter((p) =>
          likedIds.has(p.actor_id)
        )
        .map((p) => ({
          match_id: matchId,
          actor_id: p.actor_id,
          actor_type: p.actor_type,
          display_name:
            p.display_name ?? null,
          expires_at:
            p.actor_type === 'guest'
              ? p.expires_at ??
                guestExpiry()
              : null,
        }));

    if (matchParticipants.length > 0) {
      const { error } = await supabase
        .from('room_match_participants')
        .upsert(matchParticipants, {
          onConflict:
            'match_id,actor_id',
        });

      if (error) throw error;
    }

    const {
      data: existingParticipants,
      error: existingParticipantsError,
    } = await supabase
      .from('room_match_participants')
      .select('actor_id')
      .eq('match_id', matchId);

    if (existingParticipantsError) {
      throw existingParticipantsError;
    }

    const validIds = new Set(
      matchParticipants.map(
        (p) => p.actor_id
      )
    );

    const staleIds =
      (existingParticipants ?? [])
        .map((row: any) => row.actor_id)
        .filter(
          (actorId: string) =>
            !validIds.has(actorId)
        );

    if (staleIds.length > 0) {
      const { error } = await supabase
        .from('room_match_participants')
        .delete()
        .eq('match_id', matchId)
        .in('actor_id', staleIds);

      if (error) throw error;
    }
  }

  const { data: matches, error: matchesError } =
    await supabase
      .from('room_matches')
      .select(
        'id, room_id, movie_id, matched_members, total_members, match_percent, created_at'
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

  if (matchesError) throw matchesError;

  return matches ?? [];
}
