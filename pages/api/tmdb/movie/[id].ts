import type { NextApiRequest, NextApiResponse } from 'next';

type CandidateMovie = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  sharedCastCount: number;
  castIds: Set<number>;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return res
      .status(500)
      .json({ error: 'TMDB API key mancante' });
  }

  try {
    // ─── Film + trailer + credits ────────────────────────────────────────
    const [movieRes, videosRes, creditsRes] =
      await Promise.all([
        fetch(
          `https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=it-IT`
        ),

        fetch(
          `https://api.themoviedb.org/3/movie/${id}/videos?api_key=${apiKey}&language=it-IT`
        ),

        fetch(
          `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${apiKey}&language=it-IT`
        ),
      ]);

    if (!movieRes.ok) {
      throw new Error(
        `TMDB movie error: ${movieRes.status}`
      );
    }

    const movie = await movieRes.json();

    const videos = videosRes.ok
      ? await videosRes.json()
      : { results: [] };

    const credits = creditsRes.ok
      ? await creditsRes.json()
      : {
          cast: [],
          crew: [],
        };

    // ─── Trailer ─────────────────────────────────────────────────────────
    const trailer =
      videos.results?.find(
        (video: any) =>
          video.type === 'Trailer' &&
          video.site === 'YouTube'
      ) ?? videos.results?.[0];

    const trailerUrl = trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null;

    // ─── Generi ──────────────────────────────────────────────────────────
    const genres =
      movie.genres
        ?.map((genre: any) => genre.name)
        .join(', ') ?? '';

    const currentGenreIds = new Set<number>(
      (movie.genres ?? []).map(
        (genre: any) => genre.id
      )
    );

    // ─── Runtime ─────────────────────────────────────────────────────────
    const runtime = movie.runtime
      ? `${Math.floor(movie.runtime / 60)}h ${
          movie.runtime % 60
        }min`
      : null;

    // ─── CAST COMPLETO ───────────────────────────────────────────────────
    const fullCast = (credits.cast ?? []).map(
      (person: any) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        order: person.order ?? 999,

        profile: person.profile_path
          ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
          : null,
      })
    );

    // ─────────────────────────────────────────────────────────────────────
    // FILM SIMILI BASATI SUL CAST
    // ─────────────────────────────────────────────────────────────────────

    /*
      Usiamo i primi 5 attori principali.

      Più attori un film condivide con quello corrente,
      più alto sarà il suo punteggio.
    */

    const mainCast = (credits.cast ?? [])
      .filter(
        (person: any) =>
          person.id &&
          typeof person.id === 'number'
      )
      .slice(0, 5);

    const mainCastIds = new Set<number>(
      mainCast.map(
        (person: any) => person.id
      )
    );

    /*
      Una Map ci permette di unire lo stesso film
      trovato nella filmografia di più attori.

      Se per esempio un film compare sia nella
      filmografia di attore A che di attore B,
      avrà sharedCastCount = 2.
    */
    const candidateMap =
      new Map<number, CandidateMovie>();

    if (mainCast.length > 0) {
      const actorCreditResponses =
        await Promise.all(
          mainCast.map((person: any) =>
            fetch(
              `https://api.themoviedb.org/3/person/${person.id}/movie_credits?api_key=${apiKey}&language=it-IT`
            )
          )
        );

      const actorCreditsData =
        await Promise.all(
          actorCreditResponses.map(
            async (response) => {
              if (!response.ok) {
                return {
                  cast: [],
                };
              }

              return response.json();
            }
          )
        );

      actorCreditsData.forEach(
        (actorCredits, actorIndex) => {
          const actorId =
            mainCast[actorIndex]?.id;

          if (!actorId) return;

          for (const candidate of actorCredits.cast ??
            []) {
            // Escludiamo il film corrente
            if (
              Number(candidate.id) ===
              Number(movie.id)
            ) {
              continue;
            }

            // Solo film veri con ID
            if (!candidate.id) {
              continue;
            }

            /*
              Evitiamo risultati troppo "sporchi":
              devono avere almeno titolo e poster.
            */
            if (
              !candidate.title ||
              !candidate.poster_path
            ) {
              continue;
            }

            const existing =
              candidateMap.get(
                candidate.id
              );

            if (existing) {
              if (
                !existing.castIds.has(
                  actorId
                )
              ) {
                existing.castIds.add(
                  actorId
                );

                existing.sharedCastCount =
                  existing.castIds.size;
              }

              continue;
            }

            candidateMap.set(
              candidate.id,
              {
                id: candidate.id,

                title:
                  candidate.title,

                release_date:
                  candidate.release_date,

                poster_path:
                  candidate.poster_path,

                vote_average:
                  candidate.vote_average ??
                  0,

                vote_count:
                  candidate.vote_count ??
                  0,

                genre_ids:
                  candidate.genre_ids ??
                  [],

                sharedCastCount: 1,

                castIds:
                  new Set<number>([
                    actorId,
                  ]),
              }
            );
          }
        }
      );
    }

    // ─── Ranking film simili ─────────────────────────────────────────────
    const rankedSimilarMovies =
      Array.from(
        candidateMap.values()
      )
        .map((candidate) => {
          const candidateGenreIds =
            candidate.genre_ids ?? [];

          const sharedGenres =
            candidateGenreIds.filter(
              (genreId) =>
                currentGenreIds.has(
                  genreId
                )
            ).length;

          /*
            Peso fortissimo al cast.

            1 attore in comune = 100 punti
            2 attori = 200
            3 attori = 300

            Poi:
            + 12 punti per ogni genere in comune
            + rating
            + piccolo bonus se il film ha molti voti
          */

          const castScore =
            candidate.sharedCastCount *
            100;

          const genreScore =
            sharedGenres * 12;

          const ratingScore =
            candidate.vote_average ?? 0;

          const popularityScore =
            Math.min(
              Math.log10(
                Math.max(
                  candidate.vote_count ??
                    0,
                  1
                )
              ),
              5
            );

          const score =
            castScore +
            genreScore +
            ratingScore +
            popularityScore;

          return {
            ...candidate,
            score,
            sharedGenres,
          };
        })

        // Evitiamo roba senza abbastanza dati
        .filter(
          (candidate) =>
            candidate.poster_path &&
            candidate.title
        )

        .sort((a, b) => {
          /*
            Prima conta il numero di attori
            condivisi in assoluto.
          */
          if (
            b.sharedCastCount !==
            a.sharedCastCount
          ) {
            return (
              b.sharedCastCount -
              a.sharedCastCount
            );
          }

          /*
            Poi il punteggio generale.
          */
          if (b.score !== a.score) {
            return b.score - a.score;
          }

          /*
            Infine il numero di voti.
          */
          return (
            (b.vote_count ?? 0) -
            (a.vote_count ?? 0)
          );
        })

        .slice(0, 12);

    // ─── RESPONSE ────────────────────────────────────────────────────────
    return res.status(200).json({
      id: `tmdb_${movie.id}`,

      tmdb_id:
        movie.id,

      title:
        movie.title,

      year:
        movie.release_date
          ? parseInt(
              movie.release_date.split(
                '-'
              )[0]
            )
          : 0,

      genre:
        genres,

      cover:
        movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null,

      backdrop:
        movie.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
          : null,

      trailer:
        trailerUrl,

      trama_c:
        movie.overview ?? null,

      trama_l:
        movie.overview ?? null,

      rating:
        movie.vote_average ?? 0,

      runtime,

      tagline:
        movie.tagline ?? null,

      release_date:
        movie.release_date ?? null,

      vote_count:
        movie.vote_count ?? 0,

      director:
        credits.crew?.find(
          (person: any) =>
            person.job === 'Director'
        )?.name ?? null,

      // ─── CAST COMPLETO ────────────────────────────────────────────────
      cast:
        fullCast,

      // ─── FILM SIMILI BASATI SUL CAST ─────────────────────────────────
      similar:
        rankedSimilarMovies.map(
          (item) => ({
            tmdb_id:
              item.id,

            title:
              item.title,

            year:
              item.release_date
                ? parseInt(
                    item.release_date.split(
                      '-'
                    )[0]
                  )
                : 0,

            cover:
              item.poster_path
                ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
                : null,

            rating:
              item.vote_average ??
              0,

            // Questi due campi non servono
            // necessariamente al frontend,
            // ma possono essere utili in futuro.
            shared_cast:
              item.sharedCastCount,

            shared_genres:
              item.sharedGenres,
          })
        ),
    });
  } catch (err: any) {
    console.error(
      'TMDB movie error:',
      err
    );

    return res.status(500).json({
      error:
        err.message,
    });
  }
}