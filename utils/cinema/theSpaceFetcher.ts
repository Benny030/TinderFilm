import { chromium } from 'playwright';

// ─── Cache in memoria per non aprire un browser ad ogni richiesta ─────────────
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minuti

export async function fetchTheSpace(url: string): Promise<any> {
  // ─── Controlla cache ────────────────────────────────────────────────────────
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'it-IT',
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Accept-Language': 'it-IT,it;q=0.9',
        'Referer': 'https://www.thespacecinema.it/',
      },
    });

    const page = await context.newPage();

    // ─── Prima visita la homepage per ottenere i cookie Cloudflare ───────────
    await page.goto('https://www.thespacecinema.it', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // ─── Poi chiama l'API JSON ────────────────────────────────────────────────
    const response = await page.evaluate(async (apiUrl: string) => {
      const res = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'it-IT,it;q=0.9',
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }, url);

    cache.set(url, { data: response, ts: Date.now() });
    return response;

  } finally {
    await browser.close();
  }
}