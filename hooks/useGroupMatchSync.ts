import { useEffect } from 'react';

type GroupMatchDetail = {
  matchId: string;
  movieId: string;
};

type MovieLike = {
  id: string | number;
};

type MatchEntryLike<TMovie extends MovieLike> = {
  movie: TMovie;
  timestamp: number;
};

type Args<TMovie extends MovieLike> = {
  movies: TMovie[];
  setLastMatch: (movie: TMovie | null) => void;
  setMatches: (
    updater: (
      prev: MatchEntryLike<TMovie>[]
    ) => MatchEntryLike<TMovie>[]
  ) => void;
  setScreen: (
    screen: 'match'
  ) => void;
};

/**
 * Fallback affidabile al realtime Supabase.
 *
 * RoomLifecycleGuard controlla periodicamente i match server-side e,
 * quando ne nasce uno nuovo, emette "cinedate:group-match".
 * Tutti i client passano quindi subito al MatchScreen anche se
 * non hanno ancora votato la card che ha già raggiunto la maggioranza.
 */
export function useGroupMatchSync<
  TMovie extends MovieLike
>({
  movies,
  setLastMatch,
  setMatches,
  setScreen,
}: Args<TMovie>) {
  useEffect(() => {
    const onGroupMatch = (
      rawEvent: Event
    ) => {
      const event =
        rawEvent as CustomEvent<GroupMatchDetail>;

      const movieId =
        event.detail?.movieId;

      if (!movieId) return;

      const movie =
        movies.find(
          (item) =>
            String(item.id) ===
            String(movieId)
        );

      if (!movie) return;

      setLastMatch(movie);

      setMatches((prev) =>
        prev.some(
          (entry) =>
            String(
              entry.movie.id
            ) ===
            String(movie.id)
        )
          ? prev
          : [
              ...prev,
              {
                movie,
                timestamp:
                  Date.now(),
              },
            ]
      );

      setScreen('match');
    };

    window.addEventListener(
      'cinedate:group-match',
      onGroupMatch
    );

    return () => {
      window.removeEventListener(
        'cinedate:group-match',
        onGroupMatch
      );
    };
  }, [
    movies,
    setLastMatch,
    setMatches,
    setScreen,
  ]);
}
