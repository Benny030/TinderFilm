import { cache } from './cinemaCache';

const CACHE_TTL = 1000 * 60 * 20;

async function getBrowser() {
  const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isVercel) {
    // ─── Ambiente serverless: usa chromium precompilato ───────────────────
    const chromium = await import('@sparticuz/chromium');
    const { chromium: playwrightChromium } = await import('playwright-core');

    return playwrightChromium.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  } else {
    // ─── Locale: usa playwright normale ──────────────────────────────────
    const { chromium } = await import('playwright');
    return chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}

export async function fetchTheSpace(url: string): Promise<any> {
  // ─── Cache in memoria ─────────────────────────────────────────────────────
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const browser = await getBrowser();

  try {
    const context = await browser.newContext({
      locale: 'it-IT',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      extraHTTPHeaders: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
    });

    const page = await context.newPage();

    await page.goto('https://www.thespacecinema.it/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForTimeout(1500);

    let result: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await page.evaluate(async (apiUrl) => {
          const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Referer': 'https://www.thespacecinema.it/',
            },
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        }, url);
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        await page.waitForTimeout(2000);
      }
    }

    cache.set(url, { data: result, ts: Date.now() });
    return result;

  } finally {
    await browser.close();
  }
}