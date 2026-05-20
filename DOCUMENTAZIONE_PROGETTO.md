# Documentazione progetto CineDate

Questo documento riassume cosa viene usato nel progetto, dove si trova e a cosa serve.

## Panoramica

CineDate e' una web app per scegliere film insieme: gli utenti creano o entrano in una stanza, fanno swipe sui film e vedono i match quando piu' persone mettono like allo stesso titolo.

Il progetto usa Next.js con Pages Router, React, TypeScript e Supabase. I dati film arrivano principalmente da TMDB; le disponibilita' streaming vengono cercate tramite WatchMode quando e' disponibile una chiave API.

## Stack principale

- Next.js: framework React, routing in `pages/`, API routes in `pages/api/`.
- React 18: componenti UI, stato locale, context per autenticazione.
- TypeScript: tipizzazione del codice applicativo.
- Supabase: autenticazione, database e realtime/presence.
- TMDB API: recupero film trending, al cinema, streaming e discover.
- WatchMode API: sorgenti streaming per i film in match.
- Phosphor Icons: icone React importate da `@phosphor-icons/react`.
- CSS inline e design token locali: styling basato soprattutto su `styles/token.ts`.

Dipendenze principali in `package.json`:

```json
{
  "@phosphor-icons/react": "^2.1.10",
  "@supabase/ssr": "^0.5.0",
  "@supabase/supabase-js": "^2.46.0",
  "next": "^16.2.4",
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "typescript": "^5.6.0"
}
```

## Script disponibili

Da `package.json`:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

- `dev`: avvia il server di sviluppo Next.
- `build`: genera la build di produzione.
- `start`: avvia la build di produzione.
- `lint`: esegue il lint Next.

## Struttura cartelle

```text
pages/                 Pagine Next.js e API routes
components/            Componenti UI riutilizzabili
context/               Context React, in particolare AuthContext
hooks/                 Hook applicativi
utils/                 Utility e client Supabase
styles/                CSS globale e design token
types/                 Tipi TypeScript condivisi
public/                Asset statici
app_disabled/          Vecchia struttura App Router disabilitata/non usata
```

File di configurazione principali:

- `next.config.mjs`: abilita `reactStrictMode`.
- `tsconfig.json`: TypeScript strict, path alias `@/*`.
- `middleware.ts`: middleware Next che al momento delega a `utils/supabase/middleware.ts`.

## Routing pagine

Le pagine principali sono:

- `pages/index.tsx`: landing page.
- `pages/auth.tsx`: login, registrazione, Google OAuth, accesso ospite.
- `pages/auth/callback.tsx`: callback Supabase dopo conferma email/OAuth.
- `pages/username.tsx`: scelta username dopo registrazione.
- `pages/home.tsx`: home autenticata con film trending e stanze recenti.
- `pages/crea-stanza.tsx`: creazione stanza o ingresso tramite codice.
- `pages/stanza.tsx`: stanza, presence realtime, swipe, match e sorgenti streaming.

Nota: alcune sezioni di navigazione sono indicate come "presto" o non hanno pagina completa, per esempio recensioni, cinema e profilo.

## Autenticazione

L'autenticazione si basa su Supabase Auth.

File coinvolti:

- `context/AuthContext.tsx`: mantiene stato utente, ospite, caricamento e logout.
- `hooks/useAuth.ts`: wrapper comodo attorno al context.
- `pages/auth.tsx`: login/register/email/password, Google OAuth e accesso ospite.
- `pages/auth/callback.tsx`: verifica sessione e reindirizza a `/username` o `/home`.
- `pages/username.tsx`: salva lo username nella tabella `users`.

Modalita' supportate:

- Utente registrato con email e password.
- Utente via Google OAuth.
- Ospite locale, salvato in `sessionStorage`.

Chiavi `sessionStorage` usate per gli ospiti:

```text
cineDateGuest
cineDateGuestId
cineDateGuestName
```

## Supabase

Client e helper:

- `utils/supabase/browser.ts`: client browser singleton con `@supabase/supabase-js`.
- `utils/supabase/server.ts`: client server/API routes, usa service role se disponibile.
- `utils/supabase/middleware.ts`: attualmente restituisce solo `NextResponse.next()`.

Tabelle usate dal codice:

- `users`: profilo utente, almeno `id`, `email`, `username`.
- `rooms`: configurazione stanza, almeno `id`, `mode`, `genres`, `year_from`, `year_to`.
- `movies`: fallback o inserimento manuale film, almeno `id`, `title`, `year`, `genre`, `cover`, `trailer`, `trama_c`, `trama_l`.

Realtime:

- `pages/stanza.tsx` usa `supabase.channel("room-${roomId}")`.
- Presence traccia gli utenti online nella stanza.
- Broadcast invia eventi `swipe`, `match` e `reset`.

## API routes

API interne in `pages/api/`:

- `POST /api/rooms`: crea/aggiorna configurazione stanza su Supabase.
- `GET /api/rooms?id=...`: legge configurazione stanza.
- `GET /api/tmdb/trending`: film trending settimanali da TMDB, con trailer.
- `GET /api/watchmode/[id]`: sorgenti streaming WatchMode partendo da TMDB id.
- `POST /api/movies`: inserisce un film nella tabella `movies`.
- `GET/altre route TMDB`: cartelle `pages/api/tmdb/movie/` e `pages/api/tmdb/movie/[id].ts` gestiscono dati film TMDB.
- `pages/api/swipes.ts` e `pages/api/swipes_get.ts`: route dedicate agli swipe, da verificare rispetto al flusso realtime attuale.

## Servizi esterni

### Supabase

Usato per:

- Auth.
- Database.
- Realtime presence/broadcast.

### TMDB

Usato per:

- Film in tendenza.
- Film al cinema.
- Discover per genere/anno.
- Trailer YouTube.
- Poster e backdrop.

Gli URL immagini vengono costruiti con:

```text
https://image.tmdb.org/t/p/w500...
https://image.tmdb.org/t/p/w1280...
```

### WatchMode

Usato per:

- Cercare fonti streaming/noleggio/acquisto partendo dal `tmdb_id`.
- Prima prova la regione `IT`, poi fa fallback globale.

Se `WATCHMODE_API_KEY` manca, l'API risponde con `sources: []` senza bloccare l'app.

## Variabili ambiente

Il codice fa riferimento a queste variabili:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TMDB_API_KEY=
WATCHMODE_API_KEY=
```

Note importanti:

- `utils/supabase/browser.ts` usa `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `utils/supabase/server.ts` usa `SUPABASE_SERVICE_ROLE_KEY`, con fallback a `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Il progetto usa un solo client Supabase browser: `utils/supabase/browser.ts`.

## Design system

Il progetto non usa una libreria UI esterna. Il design e' costruito con:

- `styles/token.ts`: colori, radius, font, spacing, shadow, bottoni e input base.
- `styles/globals.css`: CSS globale.
- CSS inline nei componenti e nelle pagine.
- `@phosphor-icons/react` per molte icone.

Token principali:

- Colore brand: `C.primary = #E8386D`.
- Font sans: `Inter`, fallback Helvetica.
- Layout app: mobile centrato, desktop con sidebar tramite `components/layout/AppShell.tsx`.

## Utility locali

- `utils/roomCode.ts`: genera e normalizza codici stanza tipo `MAPLE-73`.
- `utils/recentRoom.ts`: salva fino a 5 stanze recenti in `localStorage`.
- `utils/guestName.ts`: genera nomi ospite casuali.

Local storage usato:

```text
cineDateRecentRooms
```

## Tipi condivisi

I tipi principali sono in `types/index.ts`:

- `Movie`
- `RoomUser`
- `SwipeState`
- `AuthUser`
- `GuestUser`
- `CurrentUser`
- `Review`
- `ReviewLike`
- `Match`
- `Props`

## Flusso principale utente

1. L'utente arriva su `/`.
2. Accede, si registra o entra come ospite.
3. Dopo registrazione conferma email e passa da `/auth/callback`.
4. Se non ha username, va su `/username`.
5. Da `/home` crea o entra in una stanza.
6. `/crea-stanza` salva eventuale configurazione su Supabase e apre `/stanza`.
7. In `/stanza` gli utenti entrano nello stesso canale realtime.
8. Ogni swipe viene broadcastato.
9. Se due utenti mettono like allo stesso film, compare il match.
10. Per il match si prova a mostrare dove vedere il film tramite WatchMode.

## Note tecniche e punti da ripulire

- Alcuni file mostrano caratteri non decodificati correttamente nei testi/commenti. Probabile problema di encoding storico.
- `middleware.ts` esiste ma il middleware Supabase attuale non aggiorna sessioni/cookie: restituisce solo `NextResponse.next()`.
- `app_disabled/` sembra una vecchia versione App Router non attiva.
- `tmp_script.js` e `cinedate_movie_matcher.html` sembrano file temporanei o prototipi: da valutare se conservarli.
- `pages/stanza.tsx` contiene molta logica in un solo file: in futuro si potrebbe dividere tra componenti UI, hook realtime e funzioni dati.
 
