// ─── Cache globale condivisa tra le API routes ────────────────────────────────
// In produzione Vercel ogni invocazione è isolata, quindi la cache dura
// solo per la durata della funzione. Per persistenza usa Redis o KV.
export const cache = new Map<string, { data: any; ts: number }>();