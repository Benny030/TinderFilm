import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchTheSpace } from '@/utils/cinema/theSpaceFetcher';

export type ShowtimeDay = {
  date: string;
  films: ShowtimeFilm[];
};

export type ShowtimeFilm = {
  id: string;
  title: string;
  posterUrl: string | null;
  duration: string | null;
  sessions: ShowtimeSession[];
};

export type ShowtimeSession = {
  id: string;
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
    return res.status(405).json({ error: 'Method not allowed' });
  }


  const { cinemaId } = req.query;

  if (!cinemaId) {
    return res.status(400).json({ error: 'cinemaId obbligatorio' });
  }


  try {

    const days: ShowtimeDay[] = [];


    for (let i = 0; i < 7; i++) {

      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + i);


      const date =
        `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}T00:00:00`;


      const dateKey =
        `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;


      const url =
        `https://www.thespacecinema.it/api/microservice/showings/cinemas/${cinemaId}/films?showingDate=${date}&minEmbargoLevel=3&includesSession=true`;


      try {

        const response: any = await fetchTheSpace(url);

        const data = response?.result ?? [];


        console.log('🎬 Film trovati', {
          cinemaId,
          date,
          count: data.length
        });


        const films: ShowtimeFilm[] = data.map((film:any) => {


          const sessions: ShowtimeSession[] =
            (film.showingGroups ?? [])
              .flatMap((group:any) => group.sessions ?? [])
              .map((s:any) => {


                const raw =
                  s.startTime ?? '';


                return {
                  id: s.sessionId ?? '',
                  
                  time:
                    raw.length > 5
                      ? raw.slice(11,16)
                      : raw,


                  hall:
                    s.screenName ?? null,


                  format:
                    (s.attributes ?? [])
                      .map((a:any)=>a.name)
                      .filter(Boolean)
                      .join(', ') || null,


                  bookingUrl:
                    s.bookingUrl?.startsWith('http')
                      ? s.bookingUrl
                      : `https://www.thespacecinema.it${s.bookingUrl ?? ''}`
                };

              });



          return {

            id:
              film.filmId ?? '',


            title:
              film.filmTitle ?? 'Titolo sconosciuto',


            posterUrl:
              film.posterImageSrc ?? null,


            duration:
              film.runningTime
                ? `${film.runningTime} min`
                : null,


            sessions

          };

        });



        days.push({
          date: dateKey,
          films
        });


      } catch(err) {

        console.error(
          'Errore The Space',
          cinemaId,
          date,
          err
        );


        days.push({
          date: dateKey,
          films: []
        });

      }

    }


    res.setHeader(
      'Cache-Control',
      's-maxage=1800, stale-while-revalidate'
    );


    return res.status(200).json({
      cinemaId,
      days
    });



  } catch(err:any) {

    return res.status(500).json({
      error: err.message
    });

  }

}