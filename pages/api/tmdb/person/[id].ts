import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return res
      .status(500)
      .json({ error: 'TMDB API key mancante' });
  }

  try {
    const [personRes, creditsRes] =
      await Promise.all([
        fetch(
          `https://api.themoviedb.org/3/person/${id}?api_key=${apiKey}&language=it-IT`
        ),

        fetch(
          `https://api.themoviedb.org/3/person/${id}/movie_credits?api_key=${apiKey}&language=it-IT`
        ),
      ]);

    if (!personRes.ok) {
      throw new Error(
        `TMDB person error ${personRes.status}`
      );
    }

    const person =
      await personRes.json();

    const credits =
      creditsRes.ok
        ? await creditsRes.json()
        : { cast: [] };

    const movies = (
      credits.cast ?? []
    )
      .filter(
        (movie: any) =>
          movie.poster_path
      )

      .sort((a: any, b: any) => {
        const aVotes =
          a.vote_count ?? 0;

        const bVotes =
          b.vote_count ?? 0;

        const aRating =
          a.vote_average ?? 0;

        const bRating =
          b.vote_average ?? 0;

        return (
          bVotes * bRating -
          aVotes * aRating
        );
      })

      .map((movie: any) => ({
        tmdb_id: movie.id,

        title:
          movie.title,

        character:
          movie.character,

        year:
          movie.release_date
            ? parseInt(
                movie.release_date.split(
                  '-'
                )[0]
              )
            : 0,

        rating:
          movie.vote_average ?? 0,

        cover:
          movie.poster_path
            ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
            : null,
      }));

    return res.status(200).json({
      id: person.id,

      name:
        person.name,

      biography:
        person.biography,

      birthday:
        person.birthday,

      deathday:
        person.deathday,

      place_of_birth:
        person.place_of_birth,

      known_for:
        person.known_for_department,

      profile:
        person.profile_path
          ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
          : null,

      movies,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      error:
        error.message,
    });
  }
}