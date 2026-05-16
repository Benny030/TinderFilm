import type { NextApiRequest, NextApiResponse } from 'next';

type StreamingSource = {
  name: string;
  type: 'sub' | 'rent' | 'buy' | 'free';
  price?: number;
  url?: string;
  logo: string;
};

// ─── Mappa nomi → logo emoji ──────────────────────────────────────────────────
const PLATFORM_LOGOS: Record<string, string> = {
  'Netflix':        '🔴',
  'Prime Video':    '🟦',
  'Disney+':        '✨',
  'Apple TV+':      '⬛',
  'NOW':            '🟣',
  'Sky Go':         '🔵',
  'MUBI':           '🎨',
  'YouTube':        '▶️',
  'Google Play':    '▶️',
  'Apple TV':       '⬛',
  'Rakuten TV':     '🟤',
  'Chili':          '🌶️',
  'TIMvision':      '🟠',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query; // tmdb_id
  const apiKey = process.env.WATCHMODE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'WatchMode API key mancante' });

  try {
    // ─── Step 1: cerca il titolo su WatchMode tramite TMDB id ─────────────
    const searchRes = await fetch(
      `https://api.watchmode.com/v1/search/?apiKey=${apiKey}&search_field=tmdb_movie_id&search_value=${id}`
    );

    if (!searchRes.ok) throw new Error(`WatchMode search error: ${searchRes.status}`);
    const searchData = await searchRes.json();

    if (!searchData.title_results?.length) {
      return res.status(200).json({ sources: [] });
    }

    const watchmodeId = searchData.title_results[0].id;

    // ─── Step 2: recupera le sorgenti per l'Italia ────────────────────────
    const sourcesRes = await fetch(
      `https://api.watchmode.com/v1/title/${watchmodeId}/sources/?apiKey=${apiKey}&regions=IT`
    );

    if (!sourcesRes.ok) throw new Error(`WatchMode sources error: ${sourcesRes.status}`);
    const sourcesData = await sourcesRes.json();

    // ─── Normalizza e deduplica per piattaforma ───────────────────────────
    const seen = new Set<string>();
    const sources: StreamingSource[] = [];

    for (const s of sourcesData) {
      const name = s.name as string;
      if (seen.has(name)) continue;
      seen.add(name);

      sources.push({
        name,
        type: s.type === 'sub' ? 'sub'
            : s.type === 'rent' ? 'rent'
            : s.type === 'buy' ? 'buy'
            : 'free',
        price: s.price ?? undefined,
        url: s.web_url ?? undefined,
        logo: PLATFORM_LOGOS[name] ?? '📺',
      });
    }

    // ─── Ordina: abbonamento → free → noleggio → acquisto ────────────────
    const order = { sub: 0, free: 1, rent: 2, buy: 3 };
    sources.sort((a, b) => order[a.type] - order[b.type]);

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ sources });
  } catch (err: any) {
    console.error('WatchMode error:', err);
    return res.status(200).json({ sources: [] }); // fallback silenzioso
  }
}