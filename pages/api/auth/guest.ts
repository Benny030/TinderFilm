import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { generateGuestName } from '@/utils/guestName';
import {
  clearGuestSessionCookies,
  readGuestSession,
  setGuestSessionCookies,
  type GuestSessionPayload,
} from '@/utils/auth/serverActor';

const GUEST_TTL_MS = 24 * 60 * 60 * 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const existing = readGuestSession(req);

    if (existing) {
      return res.status(200).json(existing);
    }

    const guest: GuestSessionPayload = {
      id: randomUUID(),
      name: generateGuestName(),
      expiresAt: Date.now() + GUEST_TTL_MS,
    };

    setGuestSessionCookies(res, guest);

    return res.status(201).json(guest);
  }

  if (req.method === 'DELETE') {
    clearGuestSessionCookies(res);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({
    error: 'Metodo non consentito',
  });
}
