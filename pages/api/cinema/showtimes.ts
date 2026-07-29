import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { cinemaId } = req.query;
  if (!cinemaId) return res.status(400).json({ error: 'cinemaId obbligatorio' });

  const base = process.env.CINEMA_API_URL;
  const response = await fetch(`${base}/cinema/showtimes/${cinemaId}`);
  const data = await response.json();

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
  return res.status(200).json(data);
}