const KEY = 'cineDateRecentRooms';

export type RecentRoom = {
  id: string;
  memberCount: number;
  lastUsed: string;
};

export function saveRecentRoom(roomId: string, memberCount = 1) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(KEY);
    const rooms: RecentRoom[] = stored ? JSON.parse(stored) : [];
    const filtered = rooms.filter((r) => r.id !== roomId);
    const updated = [
      { id: roomId, memberCount, lastUsed: new Date().toISOString() },
      ...filtered,
    ].slice(0, 5); // max 5 stanze recenti
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch { /* ignora */ }
}

export function getRecentRooms(): RecentRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}