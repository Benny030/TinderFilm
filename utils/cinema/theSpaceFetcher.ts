import { chromium } from 'playwright';

const cache = new Map<string, { data: any; ts: number }>();

const CACHE_TTL = 1000 * 60 * 20;


export async function fetchTheSpace(url: string): Promise<any> {

  const cached = cache.get(url);

  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }


  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
  });


  try {

    const context = await browser.newContext({

      locale: 'it-IT',

      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',

      extraHTTPHeaders: {

        'Accept':
          'application/json, text/plain, */*',

        'Accept-Language':
          'it-IT,it;q=0.9',

      }

    });


    const page = await context.newPage();


    await page.goto(
      'https://www.thespacecinema.it/',
      {
        waitUntil:'networkidle',
        timeout:30000
      }
    );


    // piccolo delay anti bot
    await page.waitForTimeout(1500);



    let result:any = null;


    for(let attempt=0; attempt<3; attempt++){

      try {

        result = await page.evaluate(
          async(apiUrl)=>{

            const response = await fetch(apiUrl,{
              
              method:'GET',

              credentials:'include',

              headers:{
                'Accept':
                'application/json, text/plain, */*',

                'Referer':
                'https://www.thespacecinema.it/'
              }

            });


            if(!response.ok){

              throw new Error(
                `HTTP ${response.status}`
              );

            }


            return await response.json();


          },
          url
        );


        break;


      } catch(err){

        if(attempt===2)
          throw err;


        await page.waitForTimeout(
          2000
        );

      }

    }



    cache.set(
      url,
      {
        data:result,
        ts:Date.now()
      }
    );


    return result;



  } finally {

    await browser.close();

  }

}