# Documentazione progetto CineDate

Ultimo aggiornamento: 8 agosto 2026

## Panoramica

CineDate e una web app per scegliere un film in coppia. Gli utenti possono autenticarsi con Supabase o entrare come ospiti, creare o raggiungere una stanza tramite codice, fare swipe sui film e vedere un match quando entrambi esprimono un like sullo stesso titolo.

La sezione Cinema trova i cinema The Space vicini, mostra la programmazione dei sette giorni successivi e verifica se un film abbinato e in sala. Il progetto e composto da due applicazioni:

- `Client/`: app web Next.js, incluse API routes e integrazione serverless con Chromium.
- `Server/`: servizio Express locale alternativo e script di sincronizzazione delle programmazioni verso Supabase.

## Stack

- Next.js 16 con Pages Router, React 18 e TypeScript.
- Supabase per autenticazione, database e realtime.
- TMDB per catalogo, dettagli e trailer dei film.
- WatchMode per disponibilita streaming, se configurato.
- Leaflet e OpenStreetMap per la mappa Cinema.
- Playwright in locale; `playwright-core` e `@sparticuz/chromium` in ambiente Vercel/serverless.

## Avvio locale

### Client

```bash
cd Client
npm install
npm run dev
```

Script disponibili:

| Comando | Descrizione |
| --- | --- |
| `npm run dev` | Avvia Next in sviluppo con webpack. |
| `npm run build` | Genera la build di produzione. |
| `npm run start` | Avvia la build di produzione. |
| `npm run lint` | Esegue `tsc --noEmit` (non ESLint). |

### Servizio Cinema e sincronizzazione

In `Server/` sono presenti due flussi indipendenti:

- `server.js`: server Express con endpoint Cinema alternativi; richiede anche `express` e `cors`, che non sono elencati nel `package.json` attuale.
- `sync.js`: job Playwright che raccoglie sette giorni di programmazione e fa upsert nella tabella Supabase `cinema_showtimes`.

Per il job:

```bash
cd Server
npm install
npm run sync
```

Il comando `sync` legge `Server/.env` tramite `node --env-file=.env`.

## Configurazione ambiente

Creare `Client/.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TMDB_API_KEY=
WATCHMODE_API_KEY=
```

- Le variabili con prefisso `NEXT_PUBLIC_` sono esposte al browser: non inserire segreti.
- `SUPABASE_SERVICE_ROLE_KEY` deve restare solo lato server; il client server Supabase la preferisce alla anon key quando presente.
- Senza `TMDB_API_KEY`, le route TMDB non possono recuperare il catalogo remoto. La stanza prova comunque il fallback della tabella `movies`.
- Senza `WATCHMODE_API_KEY`, la route WatchMode restituisce `sources: []`.

Per il job in `Server/.env`:

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

Non versionare nessuno di questi file o le relative chiavi.

## Architettura client

```text
pages/             Pagine e API routes Next.js
components/        Layout, swipe, match e componenti Cinema
context/           Stato di autenticazione
hooks/             Hook auth e gesture swipe
utils/             Supabase, TMDB, stanze e Cinema
styles/            CSS globale e token
types/             Tipi condivisi
supabase/          Script SQL disponibili
public/            Asset statici
```

`middleware.ts` delega al middleware Supabase per aggiornare i cookie di sessione e applicare i controlli di route. `next.config.mjs` mantiene esterni dal bundle i pacchetti Chromium/Playwright necessari alle API Cinema. Su Vercel, `vercel.json` assegna fino a 60 secondi a `showtimes` e `check-film`.

## Pagine e flusso utente

| Percorso | Scopo |
| --- | --- |
| `/` | Landing e redirect in base allo stato di autenticazione. |
| `/auth` | Login, registrazione, Google OAuth e accesso ospite. |
| `/auth/callback` | Gestione callback OAuth/email. |
| `/username` | Scelta o aggiornamento dello username. |
| `/home` | Home con trend TMDB e stanze recenti. |
| `/crea-stanza` | Creazione di una stanza o ingresso tramite codice. |
| `/stanza` | Presenza realtime, swipe, match e reset. |
| `/cinema` | Ricerca cinema, mappa e programmazione. |
| `/profilo` | Profilo e preferenze. |

Un ospite viene conservato in `sessionStorage` e nel cookie `cineDateGuest`; le stanze recenti usano `localStorage` (`cineDateRecentRooms`). Gli utenti registrati usano Supabase Auth e la tabella `users` per il profilo.

## Stanze, catalogo e match

1. Da `/crea-stanza` l'utente seleziona una modalita e genera o inserisce un codice stanza.
2. `POST /api/rooms` salva `id`, `mode`, generi e intervallo anni nella tabella `rooms`.
3. `/stanza` recupera la configurazione e carica i film con `utils/tmdb.ts`; se necessario usa `movies` come fallback.
4. I film sono riordinati in modo deterministico con `seededShuffle`, per mantenere lo stesso ordine nella stanza.
5. Il canale Supabase `room-{roomId}` usa presence e broadcast per gli eventi `swipe`, `match` e `reset`.
6. Quando due partecipanti mettono like allo stesso film, viene mostrato `MatchScreen`, con trailer, fonti WatchMode e disponibilita Cinema.

Le modalita correnti sono `trending`, `cinema`, `streaming` e `discover`. La logica di gesture e animazioni e in `hooks/useSwipe.ts`; la card in `components/screens/SwipeCard.tsx`.

## Cinema

L'elenco dei cinema e in `utils/cinema/theSpaceCinemasFIX.ts`. La pagina richiede la geolocalizzazione del browser oppure cerca una citta tramite Nominatim/OpenStreetMap.

Le API Next chiamano `fetchTheSpace`:

- in locale lancia Chromium tramite Playwright;
- su Vercel/lambda usa Chromium precompilato tramite `@sparticuz/chromium` e `playwright-core`;
- visita prima il sito The Space per ottenere i cookie necessari, ritenta fino a tre volte e conserva una cache in memoria di 20 minuti.

La cache in memoria non e condivisa tra invocazioni serverless: per una cache persistente servono Redis, Vercel KV o un servizio equivalente. L'integrazione dipende da endpoint The Space non documentati e puo smettere di funzionare se il sito cambia o blocca l'automazione.

## API interne

| Endpoint | Metodi | Descrizione |
| --- | --- | --- |
| `/api/rooms` | GET, POST | Recupera o salva configurazione stanza. |
| `/api/movies` | GET, POST | Legge o inserisce film nel catalogo Supabase. |
| `/api/movies/[id]` | GET, PUT, DELETE | Gestisce un film specifico. |
| `/api/swipes` | GET, POST, DELETE | API swipe legacy e reset. |
| `/api/swipes_get` | GET | Lettura swipe legacy. |
| `/api/tmdb/trending` | GET | Film di tendenza TMDB con trailer. |
| `/api/tmdb/movie/[id]` | GET | Dettagli TMDB di un film. |
| `/api/tmdb/movie/movies` | GET | Discover TMDB per modalita stanza. |
| `/api/watchmode/[id]` | GET | Fonti streaming per un TMDB id. |
| `/api/cinema/nearby` | GET | Cinema entro `lat`, `lng`, `radius`. |
| `/api/cinema/showtimes` | GET | Programmazione per `cinemaId`, per sette giorni. |
| `/api/cinema/check-film` | GET | Presenza di un titolo nei cinque cinema piu vicini. |

`showtimes` invia cache HTTP `s-maxage=1800, stale-while-revalidate`; `nearby` imposta `no-store`.

## File importanti

- `context/AuthContext.tsx`: sessione Supabase e modalita ospite.
- `pages/stanza.tsx`: orchestrazione della stanza realtime e rendering dei match.
- `utils/tmdb.ts`: fetch, mapping e shuffle del catalogo.
- `utils/supabase/browser.ts` e `utils/supabase/server.ts`: client Supabase.
- `utils/cinema/theSpaceFetcher.ts`: browser, retry e cache per The Space.
- `pages/api/cinema/*.ts`: endpoint Cinema.
- `Server/sync.js`: sincronizzazione programmabile di `cinema_showtimes`.

## Limiti e interventi prioritari

- Molti file contengono ancora mojibake nei commenti e nei log; ripulire l'encoding UTF-8 prima della pubblicazione.
- `adminGate.tsx` contiene un controllo amministrativo lato client: spostare autorizzazioni e ruoli lato server/Supabase.
- Le chiavi service role vengono usate dalle API: verificare RLS, validazione degli input e rate limit prima del deploy pubblico.
- Le API Cinema fanno affidamento su scraping/browser automation e possono essere lente; predisporre fallback, monitoring e cache persistente.
- `Server/server.js` e `Server/sync.js` duplicano parte della logica Cinema rispetto al client; definire quale flusso e quello supportato per evitare dati e endpoint divergenti.
- Le API swipe legacy coesistono con il flusso realtime in stato locale; decidere se mantenerle o rimuoverle.
- Aggiungere test TypeScript, API ed end-to-end per auth, stanza, match e stati di errore delle API esterne.

## Verifica prima del deploy

```bash
cd Client
npm run lint
npm run build
```

Verificare inoltre variabili ambiente, URL di callback Supabase, policy RLS, limiti delle API, attribuzioni/licenze di TMDB, WatchMode e OpenStreetMap, e la compatibilita del provider con le API route e Chromium.
