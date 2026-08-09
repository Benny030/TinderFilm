# Documentazione progetto CineDate

Ultimo aggiornamento: 9 agosto 2026

## Panoramica

CineDate è una web app per scegliere un film in coppia. Due persone entrano nella stessa stanza, scorrono lo stesso catalogo e ottengono un match quando esprimono entrambe un like sullo stesso titolo.

L'app supporta utenti autenticati tramite Supabase e utenti ospiti. Include inoltre la sezione Cinema, che trova i cinema The Space vicini e mostra le programmazioni sincronizzate su Supabase.

Il repository è diviso in due applicazioni:

- `Client/`: applicazione web Next.js, API routes e interfaccia utente.
- `Server/`: job Playwright che aggiorna i cinema e le proiezioni in Supabase.

## Stack

- Next.js 16, React 18 e TypeScript.
- Supabase per autenticazione, database, storage e realtime.
- TMDB per catalogo, dettagli e trailer dei film.
- WatchMode per le fonti streaming, se configurato.
- Leaflet e OpenStreetMap per la mappa Cinema.
- Playwright per la sincronizzazione delle programmazioni The Space.

## Avvio locale

### Client

```bash
cd Client
npm install
npm run dev
```

| Comando | Descrizione |
| --- | --- |
| `npm run dev` | Avvia Next.js in sviluppo con webpack. |
| `npm run build` | Genera la build di produzione. |
| `npm run start` | Avvia la build di produzione. |
| `npm run lint` | Esegue il controllo TypeScript (`tsc --noEmit`). |

### Sincronizzazione Cinema

```bash
cd Server
npm install
npm run sync:cinema
```

Lo script `sync-cinema-showings.mjs` usa Playwright per recuperare sette giorni di programmazione The Space. Inserisce o aggiorna i cinema nella tabella `cinemas`, sostituisce i dati in `cinema_showings` e carica le proiezioni a blocchi.

## Configurazione ambiente

Creare `Client/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TMDB_API_KEY=
WATCHMODE_API_KEY=
```

Creare `Server/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- Le variabili `NEXT_PUBLIC_*` sono disponibili nel browser: non devono contenere segreti.
- `SUPABASE_SERVICE_ROLE_KEY` è riservata al codice server e al job di sincronizzazione.
- Senza `TMDB_API_KEY` il catalogo remoto TMDB non è disponibile; la stanza può usare il fallback della tabella `movies`.
- Senza `WATCHMODE_API_KEY` l'endpoint WatchMode restituisce una lista di fonti vuota.
- I file `.env.local` e le chiavi non devono essere versionati.

## Architettura

```text
Client/
  pages/        Pagine e API routes Next.js
  components/   Componenti UI, swipe, match e Cinema
  context/      Stato autenticazione
  hooks/        Hook di autenticazione e gesture
  utils/        Supabase, TMDB, stanze e Cinema
  supabase/     Script SQL disponibili
  styles/       CSS e token visivi
  types/        Tipi condivisi

Server/
  sync-cinema-showings.mjs  Job di aggiornamento programmazioni
```

`middleware.ts` rinnova la sessione Supabase tramite cookie. `vercel.json` riserva fino a 60 secondi alle API Cinema `showtimes` e `check-film`.

## Flusso utente

1. L'utente accede o continua come ospite da `/auth`.
2. Da `/crea-stanza` crea una stanza o inserisce un codice esistente.
3. La configurazione della stanza viene salvata in `rooms` tramite `/api/rooms`.
4. In `/stanza` entrambi gli utenti ricevono lo stesso ordine di film grazie a `seededShuffle`.
5. Il canale Supabase `room-{roomId}` gestisce presenza ed eventi realtime (`swipe`, `match`, `reset`).
6. Se due like coincidono, `MatchScreen` mostra il film, trailer, fonti streaming e disponibilità Cinema.

Le modalità disponibili sono `trending`, `cinema`, `streaming` e `discover`.

Gli ospiti usano `sessionStorage` e il cookie `cineDateGuest`; le stanze recenti sono salvate in `localStorage` con la chiave `cineDateRecentRooms`.

## Pagine

| Percorso | Scopo |
| --- | --- |
| `/` | Landing e redirect in base alla sessione. |
| `/auth` | Login, registrazione, Google OAuth e accesso ospite. |
| `/auth/callback` | Callback OAuth/email. |
| `/username` | Creazione o modifica dello username. |
| `/home` | Trend TMDB e stanze recenti. |
| `/crea-stanza` | Creazione o ingresso in una stanza. |
| `/stanza` | Presenza realtime, swipe, match e reset. |
| `/cinema` | Ricerca cinema, mappa e programmazione. |
| `/profilo` | Profilo, avatar e preferenze. |
| `/film/[id]` | Dettaglio di un film. |

## API interne

| Endpoint | Metodi | Descrizione |
| --- | --- | --- |
| `/api/rooms` | GET, POST | Legge o salva la configurazione di una stanza. |
| `/api/movies` | GET, POST | Legge o inserisce film nel catalogo Supabase. |
| `/api/movies/[id]` | GET, PUT, DELETE | Gestisce un film specifico. |
| `/api/swipes` | GET, POST, DELETE | API swipe legacy e reset. |
| `/api/swipes_get` | GET | Lettura swipe legacy. |
| `/api/tmdb/trending` | GET | Film di tendenza TMDB con trailer. |
| `/api/tmdb/movie/[id]` | GET | Dettaglio di un film TMDB. |
| `/api/tmdb/movie/movies` | GET | Ricerca Discover TMDB per modalità stanza. |
| `/api/watchmode/[id]` | GET | Fonti streaming per un TMDB id. |
| `/api/cinema/nearby` | GET | Cinema entro `lat`, `lng`, `radius`. |
| `/api/cinema/showtimes` | GET | Programmazione Supabase per `cinemaId`, per i successivi sette giorni. |
| `/api/cinema/check-film` | GET | Verifica un titolo nei cinque cinema più vicini. |

`showtimes` usa la tabella `cinema_showings` e invia `s-maxage=1800, stale-while-revalidate`. `nearby` usa `no-store`.

## Dati Cinema

Il client non esegue scraping in tempo reale. Le API Cinema leggono da Supabase:

- `cinemas`: anagrafica e coordinate dei cinema The Space.
- `cinema_showings`: titolo, data, orario, sala, formato e URL di prenotazione delle proiezioni.

Il job in `Server/` deve essere pianificato esternamente con frequenza adeguata (ad esempio giornaliera). Durante l'aggiornamento, la tabella `cinema_showings` viene svuotata e ripopolata: è opportuno eseguire il job in una finestra controllata e monitorarne l'esito.

## File importanti

- `context/AuthContext.tsx`: sessione Supabase e accesso ospite.
- `pages/stanza.tsx`: orchestrazione della stanza realtime e rendering match.
- `utils/tmdb.ts`: recupero, mapping e ordinamento del catalogo.
- `utils/supabase/browser.ts` e `utils/supabase/server.ts`: client Supabase.
- `pages/api/cinema/*.ts`: API per cinema, programmazioni e verifica film.
- `Server/sync-cinema-showings.mjs`: sincronizzazione delle programmazioni The Space.
- `supabase/profile_mvp.sql`: campi profilo, bucket avatar e policy Storage.

## Task di lavoro

### Priorità alta — sicurezza e affidabilità

- [ ] **T1 — Mettere in sicurezza le API server.** Verificare RLS, autorizzazioni, validazione input e rate limiting per le route che usano Supabase. Risultato: nessuna operazione sensibile è autorizzata solo dal client.
- [ ] **T2 — Spostare il controllo admin lato server.** `components/screens/adminGate.tsx` non deve essere l'unico controllo di accesso. Risultato: ruoli e autorizzazioni sono verificati con policy Supabase e/o API server.
- [ ] **T3 — Rendere atomico l'aggiornamento Cinema.** Evitare che gli utenti leggano una tabella vuota mentre il job cancella e reinserisce le proiezioni. Risultato: staging/upsert o scambio atomico dei dati, con rollback in caso di errore.
- [ ] **T4 — Pianificare e monitorare il job Cinema.** Configurare una schedulazione, log consultabili e notifica in caso di fallimento. Risultato: programmazioni aggiornate e diagnosi rapida dei problemi.

### Priorità media — manutenzione e qualità

- [ ] **T5 — Definire il flusso swipe definitivo.** Valutare la rimozione delle API swipe legacy, lasciando il canale realtime come fonte primaria. Risultato: una sola logica dati per swipe, match e reset.
- [ ] **T6 — Aggiungere test automatici.** Coprire autenticazione, creazione stanza, match, API esterne e stati di errore. Risultato: suite eseguibile in CI prima del deploy.
- [ ] **T7 — Ripulire encoding e convenzioni.** Correggere mojibake in commenti/log e uniformare nomi e componenti. Risultato: file UTF-8 e codice più coerente.
- [ ] **T8 — Documentare schema e policy Supabase.** Aggiungere migrazioni ripetibili per tabelle applicative, Cinema e RLS. Risultato: un nuovo ambiente può essere configurato senza passaggi manuali non documentati.

### Priorità bassa — evoluzioni prodotto

- [ ] **T9 — Migliorare l'integrazione Cinema.** Introdurre fallback, metriche e cache persistente se il volume aumenta. Risultato: esperienza più stabile in caso di ritardi o indisponibilità del provider.
- [ ] **T10 — Rifinire il profilo.** Completare avatar, bio e generi preferiti con il bucket e le policy previste in `profile_mvp.sql`. Risultato: profilo salvato e protetto correttamente.

## Verifica prima del deploy

```bash
cd Client
npm run lint
npm run build
```

Prima della pubblicazione verificare anche variabili ambiente, URL di callback Supabase, policy RLS, limiti delle API esterne, licenze/attribuzioni di TMDB, WatchMode e OpenStreetMap, e l'esecuzione programmata del job Cinema.
