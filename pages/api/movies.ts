import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type MoviePayload = {
  title: string;
  year: number;
  genre: string;
  cover?: string | null;
  trailer?: string | null;
  trama_c?: string | null;  // ← corretto
  trama_l?: string | null;  // ← corretto
};

type ResponseData = {
  id?: string;
  error?: string;
  [key: string]: any;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { title, year, genre, cover, trailer, trama_c, trama_l } = req.body as MoviePayload; // ← corretto

  if (!title || !year || !genre) {
    return res.status(400).json({ error: 'title, year e genre sono obbligatori' });
  }

  const newMovie = {
    id: generateUUID(),
    title: title.trim(),
    year: Number(year),
    genre: genre.trim(),
    cover: cover ? String(cover).trim() : null,
    trailer: trailer ? String(trailer).trim() : null,
    trama_c: trama_c ? String(trama_c).trim() : null,  // ← corretto
    trama_l: trama_l ? String(trama_l).trim() : null,  // ← corretto
  };

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from('movies').insert(newMovie).select().single();

    if (error) {
      console.error('SUPABASE ERROR:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Errore sconosciuto' });
  }
}