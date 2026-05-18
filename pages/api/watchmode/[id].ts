import type { NextApiRequest, NextApiResponse } from 'next';

type StreamingSource = {
  name: string;
  type: 'sub' | 'rent' | 'buy' | 'free';
  price?: number;
  url?: string;
  logo: string;
};

const PLATFORM_LOGOS: Record<string, string> = {
  'Netflix':          '🔴',
  'Prime Video':      '🟦',
  'Amazon Video':     '🟦',
  'Disney+':          '✨',
  'Disney Plus':      '✨',
  'Apple TV+':        '⬛',
  'Apple TV':         '⬛',
  'NOW':              '🟣',
  'NOW TV':           '🟣',
  'Sky Go':           '🔵',
  'MUBI':             '🎨',
  'YouTube':          '▶️',
  'Google Play':      '▶️',
  'Rakuten TV':       '🟤',
  'Chili':            '🌶️',
  'TIMvision':        '🟠',
  'Mediaset Infinity':'🟡',
  'RaiPlay':          '🟢',
  'Paramount+':       '⭐',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const apiKey = process.env.WATCHMODE_API_KEY;

  if (!apiKey) {
    console.error('WatchMode API key mancante');
    return res.status(200).json({ sources: [] });
  }

  if (!id) {
    return res.status(400).json({ error: 'ID mancante' });
  }

  try {
    // ─── Step 1: cerca il film su WatchMode tramite TMDB id ───────────────
    const searchUrl = `https://api.watchmode.com/v1/search/?apiKey=${apiKey}&search_field=tmdb_movie_id&search_value=${id}`;
    console.log('WatchMode search URL:', searchUrl);

    const searchRes = await fetch(searchUrl);

    if (!searchRes.ok) {
      console.error('WatchMode search failed:', searchRes.status, await searchRes.text());
      return res.status(200).json({ sources: [] });
    }

    const searchData = await searchRes.json();
    console.log('WatchMode search results:', JSON.stringify(searchData).slice(0, 200));

    if (!searchData.title_results?.length) {
      console.log('Nessun risultato WatchMode per tmdb_id:', id);
      return res.status(200).json({ sources: [] });
    }

    const watchmodeId = searchData.title_results[0].id;
    console.log('WatchMode ID trovato:', watchmodeId);

    // ─── Step 2: recupera le sorgenti per l'Italia ────────────────────────
    const sourcesUrl = `https://api.watchmode.com/v1/title/${watchmodeId}/sources/?apiKey=${apiKey}&regions=IT`;
    const sourcesRes = await fetch(sourcesUrl);

    if (!sourcesRes.ok) {
      console.error('WatchMode sources failed:', sourcesRes.status);
      return res.status(200).json({ sources: [] });
    }

    const sourcesData = await sourcesRes.json();
    console.log('WatchMode sources raw:', JSON.stringify(sourcesData).slice(0, 300));

    if (!Array.isArray(sourcesData) || sourcesData.length === 0) {
      // ─── Fallback: prova senza filtro regione ─────────────────────────
      const sourcesUrlGlobal = `https://api.watchmode.com/v1/title/${watchmodeId}/sources/?apiKey=${apiKey}`;
      const sourcesResGlobal = await fetch(sourcesUrlGlobal);
      if (sourcesResGlobal.ok) {
        const sourcesDataGlobal = await sourcesResGlobal.json();
        if (Array.isArray(sourcesDataGlobal) && sourcesDataGlobal.length > 0) {
          const sources = normalizeSources(sourcesDataGlobal);
          return res.status(200).json({ sources, note: 'disponibilità globale' });
        }
      }
      return res.status(200).json({ sources: [] });
    }

    const sources = normalizeSources(sourcesData);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ sources });

  } catch (err: any) {
    console.error('WatchMode handler error:', err);
    // ─── Ritorna sempre JSON valido, mai HTML ─────────────────────────────
    return res.status(200).json({ sources: [], error: err.message });
  }
}

function normalizeSources(sourcesData: any[]): StreamingSource[] {
  const seen = new Set<string>();
  const sources: StreamingSource[] = [];

  for (const s of sourcesData) {
    const name = s.name as string;
    if (!name || seen.has(name)) continue;
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

  // ─── Ordina: abbonamento → free → noleggio → acquisto ──────────────────
  const order = { sub: 0, free: 1, rent: 2, buy: 3 };
  return sources.sort((a, b) => order[a.type] - order[b.type]);
}