import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { title, lat, lng, radius = '25' } = req.query;
  if (!title || !lat || !lng) return res.status(400).json({ error: 'title, lat, lng obbligatori' });

  const base = process.env.CINEMA_API_URL;
  const response = await fetch(
    `${base}/cinema/check-film?title=${encodeURIComponent(title as string)}&lat=${lat}&lng=${lng}&radius=${radius}`
  );
  const data = await response.json();

  return res.status(200).json(data);
}