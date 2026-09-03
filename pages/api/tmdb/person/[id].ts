import type { NextApiRequest, NextApiResponse } from 'next';

type Role = 'acting' | 'directing' | 'writing' | 'other';

function mapRole(row: any): Role {
  if (row?.credit_type === 'cast' || row?.department === 'Acting') return 'acting';
  if (row?.department === 'Directing') return 'directing';
  if (row?.department === 'Writing') return 'writing';
  return 'other';
}

function normalizeCredit(row: any) {
  return {
    tmdb_id: Number(row.id),
    title: String(row.title || row.original_title || 'Senza titolo'),
    year: row.release_date ? Number(String(row.release_date).slice(0, 4)) : null,
    cover: row.poster_path ? `https://image.tmdb.org/t/p/w500${row.poster_path}` : null,
    rating: Number(row.vote_average || 0),
    vote_count: Number(row.vote_count || 0),
    role: mapRole(row),
    job: row.job ? String(row.job) : null,
    character: row.character ? String(row.character) : null,
    popularity: Number(row.popularity || 0),
  };
}

async function fetchPerson(id: number, apiKey: string, language: string) {
  const params = new URLSearchParams({
    api_key: apiKey,
    language,
    append_to_response: 'movie_credits',
  });
  const response = await fetch(`https://api.themoviedb.org/3/person/${id}?${params}`);
  if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
  return response.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key mancante' });

  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID persona non valido' });

  try {
    const it = await fetchPerson(id, apiKey, 'it-IT');

    // TMDB spesso non ha la biografia tradotta: usiamo inglese solo come fallback.
    let biography = String(it.biography || '').trim();
    if (!biography) {
      try {
        const en = await fetchPerson(id, apiKey, 'en-US');
        biography = String(en.biography || '').trim();
      } catch {
        biography = '';
      }
    }

    const cast = (Array.isArray(it?.movie_credits?.cast) ? it.movie_credits.cast : [])
      .filter((row:any) => row?.id && row?.title)
      .map((row:any) => ({ ...row, credit_type: 'cast', department: 'Acting' }));

    const crew = (Array.isArray(it?.movie_credits?.crew) ? it.movie_credits.crew : [])
      .filter((row:any) => row?.id && row?.title);

    // Manteniamo al massimo una voce per film/ruolo, così un regista che ha più
    // credit nello stesso titolo non produce 3 card identiche.
    const unique = new Map<string, ReturnType<typeof normalizeCredit>>();
    for (const row of [...cast, ...crew]) {
      const credit = normalizeCredit(row);
      const key = `${credit.tmdb_id}:${credit.role}`;
      const existing = unique.get(key);
      if (!existing || credit.popularity > existing.popularity) unique.set(key, credit);
    }

    const credits = [...unique.values()]
      .filter(c => c.role !== 'other')
      .sort((a, b) => {
        // prima i titoli più noti, poi i più recenti
        const scoreA = a.popularity + Math.min(a.vote_count, 5000) / 500;
        const scoreB = b.popularity + Math.min(b.vote_count, 5000) / 500;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.year || 0) - (a.year || 0);
      })
      .slice(0, 120);

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

    return res.status(200).json({
      tmdb_id: Number(it.id),
      name: String(it.name || 'Senza nome'),
      biography,
      birthday: it.birthday || null,
      deathday: it.deathday || null,
      place_of_birth: it.place_of_birth || null,
      known_for_department: String(it.known_for_department || ''),
      profile: it.profile_path ? `https://image.tmdb.org/t/p/h632${it.profile_path}` : null,
      also_known_as: Array.isArray(it.also_known_as) ? it.also_known_as : [],
      credits,
    });
  } catch (error:any) {
    console.error('TMDB person detail error:', error);
    return res.status(500).json({ error: error?.message || 'Errore TMDB' });
  }
}
