import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lng, radius = '25' } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat e lng obbligatori' });

  try {
    const base = process.env.CINEMA_API_URL;
    const response = await fetch(
      `${base}/cinema/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    );
    const data = await response.json();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}