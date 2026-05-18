import type { NextApiRequest, NextApiResponse } from 'next';

export type StreamingSource = {
  name: string;
  type: 'sub' | 'rent' | 'buy' | 'free';
  price?: number;
  url?: string;
  logo: string;      // emoji fallback
  logoUrl?: string;  // URL logo ufficiale
  color?: string;    // colore brand
};

// ─── Loghi e colori brand ─────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { logo: string; color: string; logoUrl: string }> = {
  'Netflix': {
    logo: '🔴',
    color: '#E50914',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
  },
  'Prime Video': {
    logo: '🟦',
    color: '#00A8E1',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg',
  },
  'Amazon Video': {
    logo: '🟦',
    color: '#00A8E1',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg',
  },
  'Disney+': {
    logo: '✨',
    color: '#113CCF',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
  },
  'Disney Plus': {
    logo: '✨',
    color: '#113CCF',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
  },
  'Apple TV+': {
    logo: '⬛',
    color: '#000000',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
  },
  'Apple TV': {
    logo: '⬛',
    color: '#000000',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
  },
  'NOW': {
    logo: '🟣',
    color: '#00B4D8',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Now_TV_logo.svg/320px-Now_TV_logo.svg.png',
  },
  'NOW TV': {
    logo: '🟣',
    color: '#00B4D8',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Now_TV_logo.svg/320px-Now_TV_logo.svg.png',
  },
  'MUBI': {
    logo: '🎨',
    color: '#0B0B0B',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/MUBI_logo_2022.svg/320px-MUBI_logo_2022.svg.png',
  },
  'Paramount+': {
    logo: '⭐',
    color: '#0064FF',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount_Plus_logo.svg/320px-Paramount_Plus_logo.svg.png',
  },
  'Mediaset Infinity': {
    logo: '🟡',
    color: '#E4003A',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Mediaset_Infinity_logo.svg/320px-Mediaset_Infinity_logo.svg.png',
  },
  'RaiPlay': {
    logo: '🟢',
    color: '#005CA9',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/RaiPlay-Logo.svg/320px-RaiPlay-Logo.svg.png',
  },
  'YouTube': {
    logo: '▶️',
    color: '#FF0000',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg',
  },
  'Google Play': {
    logo: '▶️',
    color: '#01875F',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg',
  },
  'Rakuten TV': {
    logo: '🟤',
    color: '#BF0000',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Rakuten_TV_logo.svg/320px-Rakuten_TV_logo.svg.png',
  },
  'Chili': {
    logo: '🌶️',
    color: '#E2001A',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/CHILI_logo.svg/320px-CHILI_logo.svg.png',
  },
  'TIMvision': {
    logo: '🟠',
    color: '#0066CC',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/TIMvision_logo.svg/320px-TIMvision_logo.svg.png',
  },
  'Sky Go': {
    logo: '🔵',
    color: '#0072C9',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Sky_Go_logo.svg/320px-Sky_Go_logo.svg.png',
  },
};

function getMeta(name: string) {
  return PLATFORM_META[name] ?? { logo: '📺', color: '#666666', logoUrl: '' };
}

function normalizeSources(sourcesData: any[]): StreamingSource[] {
  const seen = new Set<string>();
  const sources: StreamingSource[] = [];

  for (const s of sourcesData) {
    const name = s.name as string;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const meta = getMeta(name);
    sources.push({
      name,
      type: s.type === 'sub'  ? 'sub'
          : s.type === 'rent' ? 'rent'
          : s.type === 'buy'  ? 'buy'
          : 'free',
      price:   s.price     ?? undefined,
      url:     s.web_url   ?? undefined,
      logo:    meta.logo,
      logoUrl: meta.logoUrl,
      color:   meta.color,
    });
  }

  const order = { sub: 0, free: 1, rent: 2, buy: 3 };
  return sources.sort((a, b) => order[a.type] - order[b.type]);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const apiKey = process.env.WATCHMODE_API_KEY;

  if (!apiKey) return res.status(200).json({ sources: [] });
  if (!id)     return res.status(400).json({ error: 'ID mancante' });

  try {
    const searchRes = await fetch(
      `https://api.watchmode.com/v1/search/?apiKey=${apiKey}&search_field=tmdb_movie_id&search_value=${id}`
    );
    if (!searchRes.ok) return res.status(200).json({ sources: [] });

    const searchData = await searchRes.json();
    if (!searchData.title_results?.length) return res.status(200).json({ sources: [] });

    const watchmodeId = searchData.title_results[0].id;

    // ─── Prova prima con regione IT ───────────────────────────────────────
    const sourcesRes = await fetch(
      `https://api.watchmode.com/v1/title/${watchmodeId}/sources/?apiKey=${apiKey}&regions=IT`
    );
    if (!sourcesRes.ok) return res.status(200).json({ sources: [] });

    let sourcesData = await sourcesRes.json();

    // ─── Fallback globale se nessuna fonte italiana ───────────────────────
    if (!Array.isArray(sourcesData) || sourcesData.length === 0) {
      const globalRes = await fetch(
        `https://api.watchmode.com/v1/title/${watchmodeId}/sources/?apiKey=${apiKey}`
      );
      if (globalRes.ok) {
        const globalData = await globalRes.json();
        if (Array.isArray(globalData) && globalData.length > 0) {
          const sources = normalizeSources(globalData);
          res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
          return res.status(200).json({ sources, global: true });
        }
      }
      return res.status(200).json({ sources: [] });
    }

    const sources = normalizeSources(sourcesData);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ sources });
  } catch (err: any) {
    return res.status(200).json({ sources: [], error: err.message });
  }
}