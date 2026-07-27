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
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }


  const cinemaId = String(req.query.cinemaId ?? '');


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


      const yyyy =
        dateObj.getFullYear();

      const mm =
        String(dateObj.getMonth()+1)
        .padStart(2,'0');

      const dd =
        String(dateObj.getDate())
        .padStart(2,'0');


      const dateKey =
        `${yyyy}-${mm}-${dd}`;


      const showingDate =
        `${dateKey}T00:00:00`;



      const url =
        `https://www.thespacecinema.it/api/microservice/showings/cinemas/${cinemaId}/films?showingDate=${showingDate}&minEmbargoLevel=3&includesSession=true&includeSessionAttributes=true`;



      try {


        const response:any =
          await fetchTheSpace(url);



        console.log(
          '🎬 THE SPACE',
          cinemaId,
          dateKey
        );


        console.log(
          JSON.stringify(response)
          .slice(0,1500)
        );



        const data:any[] =
          Array.isArray(response)
            ? response
            : (
              response?.result ??
              response?.films ??
              []
            );



        const films: ShowtimeFilm[] =
          data.map((film:any)=>{


            const groups =
              film.showingGroups ??
              film.sessions ??
              film.showings ??
              [];



            const sessions: ShowtimeSession[] =
              groups
              .flatMap((group:any)=>
                group.sessions ??
                group.showings ??
                []
              )
              .map((s:any)=>{


                const rawTime =
                  s.startTime ??
                  s.showingTime ??
                  s.time ??
                  '';



                let time = rawTime;


                if(
                  typeof rawTime === 'string'
                  &&
                  rawTime.length >= 16
                ){
                  time =
                    rawTime.slice(11,16);
                }



                return {

                  id:String(
                    s.sessionId ??
                    s.id ??
                    ''
                  ),


                  time,


                  hall:
                    s.screenName ??
                    s.hall?.name ??
                    null,


                  format:
                    Array.isArray(s.attributes)
                    ?
                    s.attributes
                    .map((a:any)=>a.name)
                    .filter(Boolean)
                    .join(', ')
                    :
                    null,


                  bookingUrl:
                    s.bookingUrl?.startsWith('http')
                    ?
                    s.bookingUrl
                    :
                    `https://www.thespacecinema.it${s.bookingUrl ?? ''}`

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
          '🎞 FILM TROVATI:',
          films.map(f=>({
            title:f.title,
            sessioni:f.sessions.length
          }))
        );



        days.push({

          date:dateKey,

          films

        });



      }catch(err:any){


        console.error(
          '❌ Errore The Space',
          cinemaId,
          showingDate,
          err?.message ?? err
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



  }catch(err:any){


    console.error(
      'API SHOWTIMES ERROR',
      err
    );


    return res.status(500).json({

      error:
        err.message ??
        'Errore interno'

    });


  }

}