import type { NextApiRequest, NextApiResponse } from 'next';

export type ShowtimeDay = {
  date: string;
  films: ShowtimeFilm[];
};

export type ShowtimeFilm = {
  id: number;
  title: string;
  posterUrl: string | null;
  duration: string | null;
  sessions: ShowtimeSession[];
};

export type ShowtimeSession = {
  id: number;
  time: string;
  hall: string | null;
  format: string | null;
  bookingUrl: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  const { cinemaId } = req.query;

  if (!cinemaId) {
    return res.status(400).json({
      error: 'cinemaId obbligatorio',
    });
  }

  try {
    const days: ShowtimeDay[] = [];

    for (let i = 0; i < 7; i++) {
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + i);

      const day = dateObj.toISOString().split('T')[0];

      const showingDate = `${day}T00:00:00`;

      const url =
        `https://www.thespacecinema.it/api/microservice/showings/cinemas/${cinemaId}/films` +
        `?showingDate=${showingDate}` +
        `&minEmbargoLevel=3` +
        `&includesSession=true` +
        `&includeSessionAttributes=true`;


      console.log('\n==============================');
      console.log('DATA:', day);
      console.log('URL:', url);


      let response: Response;

      try {
        response = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
            Referer: 'https://www.thespacecinema.it/',
          },
        });
      } catch (err) {
        console.error('Fetch error:', err);

        days.push({
          date: day,
          films: [],
        });

        continue;
      }


      console.log('HTTP:', response.status);


      if (!response.ok) {
        console.log('Risposta non disponibile');

        days.push({
          date: day,
          films: [],
        });

        continue;
      }


      const text = await response.text();


      if (!text) {
        console.log('Body vuoto');

        days.push({
          date: day,
          films: [],
        });

        continue;
      }


      let parsed: any;

      try {
        parsed = JSON.parse(text);
      } catch (err) {
        console.error('JSON non valido');
        console.log(text.substring(0, 500));

        days.push({
          date: day,
          films: [],
        });

        continue;
      }


      console.log(
        'Root keys:',
        Object.keys(parsed ?? {})
      );


      let filmsArray: any[] = [];


      /**
       * Nuovo formato The Space:
       *
       * {
       *   result:[
       *      {
       *        film: {...},
       *        showingGroups:[
       *          {
       *             sessions:[]
       *          }
       *        ]
       *      }
       *   ]
       * }
       */


      if (Array.isArray(parsed?.result)) {
        filmsArray = parsed.result;

      } else if (Array.isArray(parsed)) {
        filmsArray = parsed;

      } else if (Array.isArray(parsed?.films)) {
        filmsArray = parsed.films;

      } else if (Array.isArray(parsed?.data)) {
        filmsArray = parsed.data;

      }


      console.log(
        'Film trovati:',
        filmsArray.length
      );


      if (filmsArray[0]) {
        console.log(
          'Primo elemento:',
          JSON.stringify(
            filmsArray[0],
            null,
            2
          ).substring(0, 1500)
        );
      }


      const films: ShowtimeFilm[] = filmsArray.map(
        (film: any) => {


          const filmData =
            film.film ??
            film.movie ??
            film;


          const groups =
            film.showingGroups ??
            [];


          const sessions =
            groups.flatMap(
              (g: any) =>
                g.sessions ?? []
            );


          return {

            id:
              filmData.id ??
              filmData.filmId ??
              filmData.contentId ??
              0,


            title:
              filmData.title ??
              filmData.name ??
              filmData.filmTitle ??
              'Titolo sconosciuto',


            posterUrl:
              filmData.posterUrl ??
              filmData.imageUrl ??
              filmData.poster ??
              null,


            duration:
              filmData.duration
                ? `${filmData.duration} min`
                : null,


            sessions:
              sessions.map((s: any) => ({
                
                id:
                  Number(
                    s.sessionId ??
                    s.id ??
                    0
                  ),


                time:
                  s.startTime ??
                  s.showingTime ??
                  s.time ??
                  '',


                hall:
                  s.hall?.name ??
                  s.screenName ??
                  null,


                format:
                  s.attributes
                    ?.map((a: any) => a.name)
                    .join(', ') ??
                  null,


                bookingUrl:
                  s.bookingUrl
                    ? `https://www.thespacecinema.it${s.bookingUrl}`
                    :
                    `https://www.thespacecinema.it/acquisto-biglietti?sessionId=${s.sessionId ?? ''}`,

              })),

          };
        }
      );


      days.push({
        date: day,
        films,
      });

    }


    res.setHeader(
      'Cache-Control',
      's-maxage=1800, stale-while-revalidate'
    );


    return res.status(200).json({
      cinemaId,
      days,
    });


  } catch (err: any) {

    console.error(
      'Showtimes error:',
      err
    );


    return res.status(500).json({
      error: err.message,
    });

  }
}