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

  console.log('🚀 SHOWTIMES API START');


  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }


  const cinemaId = String(
    req.query.cinemaId ?? ''
  );


  if (!cinemaId) {
    return res.status(400).json({
      error:'cinemaId obbligatorio'
    });
  }



  try {


    const days: ShowtimeDay[] = [];



    for(let i = 0; i < 7; i++){


      const dateObj = new Date();

      dateObj.setDate(
        dateObj.getDate() + i
      );



      const dateKey =
        [
          dateObj.getFullYear(),
          String(dateObj.getMonth()+1).padStart(2,'0'),
          String(dateObj.getDate()).padStart(2,'0')
        ].join('-');



      const showingDate =
        `${dateKey}T00:00:00`;



      const url =
        `https://www.thespacecinema.it/api/microservice/showings/cinemas/${cinemaId}/films?showingDate=${showingDate}&minEmbargoLevel=3&includesSession=true&includeSessionAttributes=true`;



      try {


        console.log(
          '🌐 CHIAMATA THE SPACE',
          url
        );



        const response:any =
          await fetchTheSpace(url);



        console.log(
          '📦 RESPONSE OK',
          cinemaId,
          dateKey
        );



        const data:any[] =
          Array.isArray(response)
          ?
          response
          :
          (
            response?.result ??
            response?.films ??
            []
          );



        const films: ShowtimeFilm[] =
          data.map((film:any)=>{


            const rawGroups =
              film.showingGroups ??
              film.sessions ??
              film.showings ??
              [];



            const groups = Array.isArray(rawGroups)
              ?
              rawGroups
              :
              [];




            const sessions: ShowtimeSession[] =
              groups
              .flatMap((group:any)=>

                Array.isArray(group.sessions)
                ?
                group.sessions
                :
                (
                  Array.isArray(group.showings)
                  ?
                  group.showings
                  :
                  []
                )

              )
              .map((session:any)=>{


                const rawTime =
                  session.startTime ??
                  session.showingTime ??
                  session.time ??
                  '';



                return {

                  id:String(
                    session.sessionId ??
                    session.id ??
                    ''
                  ),


                  time:
                    typeof rawTime === 'string' &&
                    rawTime.length >= 16
                    ?
                    rawTime.substring(11,16)
                    :
                    rawTime,



                  hall:
                    session.screenName ??
                    session.screen?.name ??
                    session.hall?.name ??
                    null,



                  format:
                    Array.isArray(session.attributes)
                    ?
                    session.attributes
                    .map((a:any)=>a.name)
                    .filter(Boolean)
                    .join(', ')
                    :
                    null,



                  bookingUrl:
                    session.bookingUrl?.startsWith('http')
                    ?
                    session.bookingUrl
                    :
                    `https://www.thespacecinema.it${session.bookingUrl ?? ''}`

                };


              });



            return {

              id:String(
                film.filmId ??
                film.id ??
                ''
              ),


              title:
                film.filmTitle ??
                film.title ??
                film.name ??
                'Titolo sconosciuto',



              posterUrl:
                film.posterImageSrc ??
                film.posterUrl ??
                film.imageUrl ??
                null,



              duration:
                film.runningTime
                ?
                `${film.runningTime} min`
                :
                null,



              sessions

            };

          });



        console.log(
          '🎞 FILM:',
          films.map(f=>({
            titolo:f.title,
            sessioni:f.sessions.length
          }))
        );



        days.push({

          date:dateKey,

          films

        });



      } catch(error:any){


        console.error(
          '❌ THE SPACE ERROR',
          {
            cinemaId,
            showingDate,
            message:error?.message,
            stack:error?.stack
          }
        );



        days.push({

          date:dateKey,

          films:[]

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



  } catch(error:any){


    console.error(
      '🔥 SHOWTIMES FATAL ERROR',
      error
    );



    return res.status(500).json({

      error:
        error?.message ??
        'Errore interno'

    });

  }

}