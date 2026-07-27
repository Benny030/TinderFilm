const cache = new Map<string, { data: any; ts: number }>();

const CACHE_TTL = 1000 * 60 * 30;

export async function fetchTheSpace(url: string): Promise<any> {

  const cached = cache.get(url);

  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    console.log('🟢 Cache The Space:', url);
    return cached.data;
  }

  console.log('🌐 Fetch The Space:', url);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'it-IT,it;q=0.9',
      'Referer': 'https://www.thespacecinema.it/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(
      `The Space API error ${response.status}`
    );
  }

  const data = await response.json();

  cache.set(url, {
    data,
    ts: Date.now(),
  });

  return data;
}