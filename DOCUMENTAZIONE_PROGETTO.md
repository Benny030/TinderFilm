# Documentazione progetto CineDate

Ultimo aggiornamento: 2026-07-28

Questo documento descrive lo stato attuale del progetto: architettura, routing, flussi principali, API, file rilevanti e punti da migliorare.

## Panoramica

CineDate e' una web app per scegliere film insieme. Gli utenti possono registrarsi, accedere con Google/email o entrare come ospiti, creare o raggiungere una stanza tramite codice, fare swipe sui film e vedere i match quando due partecipanti mettono like allo stesso titolo. Include inoltre una sezione Cinema per trovare i The Space Cinema vicini, consultarne la programmazione e acquistare i biglietti.

Il progetto usa Next.js Pages Router, React, TypeScript e Supabase. Il catalogo film arriva principalmente da TMDB; WatchMode viene usato per mostrare dove guardare un film quando e' configurata la chiave API.

## Stack principale

- Next.js Pages Router: pagine in `pages/`, API routes in `pages/api/`.
- React 18: UI, stato locale, context di autenticazione.
- TypeScript: tipizzazione applicativa.
- Supabase: autenticazione, database, realtime broadcast e presence.
- TMDB API: trending, now playing, discover, dettaglio film e trailer.
- WatchMode API: fonti streaming, noleggio e acquisto.
- Leaflet e OpenStreetMap: mappa della sezione Cinema.
- Playwright: recupero della programmazione dal sito The Space Cinema.
- Phosphor Icons: icone React.
- CSS globale, CSS inline e token locali in `styles/token.ts`.

Dipendenze principali:

```json
{
  "@phosphor-icons/react": "^2.1.10",
  "@supabase/ssr": "^0.5.2",
  "@supabase/supabase-js": "^2.46.0",
  "leaflet": "^1.9.4",
  "next": "^16.2.4",
  "playwright": "^1.62.0",
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "typescript": "^5.6.0"
}
```

## Script

Da `package.json`:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

- `dev`: avvia Next in sviluppo con webpack (`next dev --webpack`).
- `build`: genera la build di produzione.
- `start`: avvia la build di produzione.
- `lint`: esegue `tsc --noEmit`, quindi e' un controllo TypeScript.

## Variabili ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TMDB_API_KEY=
WATCHMODE_API_KEY=
```

Note:

- `utils/supabase/browser.ts` richiede `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `utils/supabase/server.ts` usa `SUPABASE_SERVICE_ROLE_KEY` quando disponibile, altrimenti usa la anon key.
- Se `WATCHMODE_API_KEY` manca, `/api/watchmode/[id]` risponde con `sources: []` senza bloccare l'app.
- Se `TMDB_API_KEY` manca nelle API TMDB, le API rispondono errore; in `/stanza` il caricamento server prova il fallback su tabella `movies`.

## Struttura generale

```text
pages/        Pagine Next.js e API routes.
components/   Componenti layout e schermate riutilizzabili.
context/      Provider React, soprattutto autenticazione.
hooks/        Hook applicativi.
utils/        Utility locali, TMDB, storage e client Supabase.
styles/       CSS globale, token e vecchi style object.
types/        Tipi TypeScript condivisi.
supabase/     Script SQL.
public/       Asset statici.
```

## Routing pagine

- `/`: landing iniziale e redirect in base allo stato auth, implementata in `pages/index.tsx`.
- `/auth`: login, registrazione, OAuth Google e accesso ospite, implementata in `pages/auth.tsx`.
- `/auth/callback`: callback Supabase OAuth/email, implementata in `pages/auth/callback.tsx`.
- `/username`: scelta username dopo registrazione/OAuth, implementata in `pages/username.tsx`.
- `/home`: home autenticata/ospite, trending TMDB e stanze recenti, implementata in `pages/home.tsx`.
- `/crea-stanza`: creazione stanza o ingresso tramite codice, implementata in `pages/crea-stanza.tsx`.
- `/stanza`: stanza realtime con welcome, swipe, match e stato vuoto, implementata in `pages/stanza.tsx`.
- `/cinema`: ricerca dei The Space Cinema vicini, mappa, programmazione e link ai biglietti, implementata in `pages/cinema.tsx`.
- `/profilo`: profilo utente e preferenze, implementata in `pages/profilo.tsx`.

## Autenticazione

L'autenticazione si basa su Supabase Auth.

File principali:

- `context/AuthContext.tsx`: stato utente, stato ospite, inizializzazione sessione, cookie guest e logout.
- `hooks/useAuth.ts`: wrapper comodo sopra il context, con `requireAuth` e redirect post logout.
- `pages/auth.tsx`: login/register/email/password, Google OAuth e guest login.
- `pages/auth/callback.tsx`: gestisce redirect OAuth/email e recupero sessione.
- `pages/username.tsx`: crea/aggiorna il profilo nella tabella `users`.

Modalita' supportate:

- utente registrato con email/password;
- utente Google OAuth;
- ospite locale salvato in `sessionStorage` e cookie `cineDateGuest`.

Chiavi storage:

```text
sessionStorage:
cineDateGuest
cineDateGuestId
cineDateGuestName
cineDatePendingUserId
cineDatePendingUserEmail
cineDateOAuthStarted

localStorage:
cineDateRecentRooms
```

## Supabase

Client e middleware:

- `utils/supabase/browser.ts`: client browser singleton.
- `utils/supabase/server.ts`: client server/API routes.
- `utils/supabase/middleware.ts`: refresh auth cookie e controlli su route protette.
- `middleware.ts`: entrypoint Next che delega al middleware Supabase.

Tabelle richiamate dal codice:

- `users`: profilo utente (`id`, `email`, `username`, campi profilo).
- `rooms`: configurazione stanza (`id`, `mode`, `genres`, `year_from`, `year_to`).
- `movies`: catalogo/fallback film.
- `swipes`: storico swipe per API legacy.
- `matches`: usata da reset/API swipe legacy.

Realtime stanza:

- `pages/stanza.tsx` apre un canale `room-${roomId}`.
- Presence traccia fino a 2 utenti online nella stanza.
- Broadcast invia eventi `swipe`, `match` e `reset`.
- Gli swipe sono tenuti in stato locale come `SwipeState`, indicizzato per `movieId` e `userId`.

## Flusso stanza e swipe

1. L'utente crea una stanza da `/crea-stanza` scegliendo una modalita' film.
2. La configurazione viene salvata su `/api/rooms` e passata anche in query string per il primo caricamento.
3. `/stanza` legge il codice stanza da `room`.
4. `getServerSideProps` recupera la configurazione da query o da Supabase.
5. I film vengono caricati tramite `fetchMoviesForRoom` in `utils/tmdb.ts`; se TMDB non restituisce film, viene usato il fallback Supabase `movies`.
6. La lista viene mischiata con `seededShuffle(movies, roomId)` per avere ordine stabile per la stessa stanza.
7. La schermata welcome mostra codice stanza, partecipanti realtime e ingresso nella sessione di swipe.
8. Lo swipe viene gestito da `hooks/useSwipe.ts` e visualizzato da `components/screens/SwipeCard.tsx`.
9. Se l'utente mette like a un film gia' piaciuto da un altro partecipante, viene creato un match locale e broadcastato.
10. `components/screens/MatchScreen.tsx` mostra il match, trailer e disponibilita' WatchMode.
11. Quando non restano film, `components/screens/EmptyState.tsx` propone reset o ritorno alla home.

## Modalita' stanza

`pages/crea-stanza.tsx` supporta:

- `trending`: film piu' popolari della settimana da TMDB.
- `cinema`: film attualmente in sala in Italia (`now_playing`, regione `IT`).
- `streaming`: discover TMDB con watch provider popolari in Italia.
- `discover`: filtri personalizzati per generi e intervallo anni.

La funzione centrale per questo caricamento e' `fetchMoviesForRoom` in `utils/tmdb.ts`.

## Cinema

La sezione `/cinema` e' disponibile a utenti autenticati e ospiti. Richiede la geolocalizzazione del browser; se non e' disponibile, l'utente puo' cercare manualmente una citta' tramite Nominatim/OpenStreetMap.

- Mostra i cinema dell'elenco statico `THE_SPACE_CINEMAS` entro 10, 25 o 50 km.
- Offre una vista mappa Leaflet/OpenStreetMap e una vista elenco.
- Per il cinema selezionato, carica la programmazione dei sette giorni successivi dal sito The Space Cinema.
- Gli orari rimandano al sito The Space Cinema per l'acquisto dei biglietti.
- `CinemaInSala`, integrato in `MatchScreen`, controlla se il film del match e' in programmazione nei cinque cinema piu' vicini entro 50 km.

Il recupero della programmazione usa Playwright per ottenere i cookie necessari al sito The Space Cinema e conserva i risultati in una cache in memoria per 30 minuti. Di conseguenza la funzionalita' richiede che il runtime di deploy supporti un browser Chromium; inoltre i risultati dipendono dalla disponibilita' e dalla struttura dell'API non pubblica di The Space Cinema.

## API interne

- `GET/POST /api/rooms`: legge o salva configurazione stanza.
- `GET/POST /api/movies`: lista/inserimento film Supabase.
- `GET/PUT/DELETE /api/movies/[id]`: dettaglio, update o delete film.
- `POST/GET/DELETE /api/swipes`: gestione swipe legacy e reset match/swipe.
- `GET /api/swipes_get`: lettura swipe legacy.
- `GET /api/tmdb/trending`: trending settimanali da TMDB con trailer.
- `GET /api/tmdb/movie/[id]`: dettaglio film TMDB con trailer, runtime e tagline.
- `GET /api/tmdb/movie/movies`: ricerca/discover TMDB per modalita' `trending`, `cinema`, `streaming`, `discover`.
- `GET /api/watchmode/[id]`: fonti WatchMode partendo da TMDB id, con regione IT e fallback globale.
- `GET /api/cinema/nearby`: restituisce i The Space Cinema entro il raggio indicato da `lat`, `lng` e `radius`.
- `GET /api/cinema/showtimes`: restituisce la programmazione dei successivi sette giorni per `cinemaId`.
- `GET /api/cinema/check-film`: cerca un titolo nei cinque cinema The Space piu' vicini, usando `title`, `lat`, `lng` e `radius`.

## Mappa dei file

### Root

- `package.json`: dipendenze e script.
- `package-lock.json`: lockfile npm.
- `next.config.mjs`: configurazione Next, `reactStrictMode`.
- `tsconfig.json`: configurazione TypeScript e alias `@/*`.
- `next-env.d.ts`: tipi generati da Next.
- `middleware.ts`: entrypoint middleware Next.
- `DOCUMENTAZIONE_PROGETTO.md`: questa documentazione.
- `.env.local`: variabili ambiente locali, non da condividere.
- `.gitignore`: file ignorati da Git.
- `.gitattributes`: attributi Git.
- `dev-server.log`, `dev-server.err.log`, `dev-server.out.log`: log locali del server di sviluppo.
- `tsconfig.tsbuildinfo`: cache TypeScript generata.

### Pages

- `pages/_app.tsx`: wrapper globale, importa CSS e `AuthProvider`.
- `pages/_document.tsx`: documento HTML custom.
- `pages/index.tsx`: landing iniziale e redirect in base ad auth/loading.
- `pages/auth.tsx`: schermata auth completa.
- `pages/auth/callback.tsx`: callback Supabase e redirect post-login.
- `pages/username.tsx`: scelta e salvataggio username.
- `pages/home.tsx`: home con greeting, trending TMDB, stanze recenti e banner ospite.
- `pages/crea-stanza.tsx`: UI creazione/ingresso stanza, modalita' catalogo e filtri discover.
- `pages/stanza.tsx`: orchestrazione stanza realtime, SSR film, swipe, match e reset.
- `pages/cinema.tsx`: ricerca dei cinema, geolocalizzazione, mappa e programmazione.
- `pages/profilo.tsx`: profilo utente, avatar e preferenze.

### API Routes

- `pages/api/rooms/index.ts`: GET/POST configurazione stanza.
- `pages/api/movies.ts`: GET/POST catalogo film Supabase.
- `pages/api/movies/[id].ts`: GET/PUT/DELETE singolo film.
- `pages/api/swipes.ts`: POST/GET/DELETE swipe legacy e reset.
- `pages/api/swipes_get.ts`: GET swipe legacy.
- `pages/api/tmdb/trending.ts`: trending TMDB con arricchimento trailer.
- `pages/api/tmdb/movie/[id].ts`: dettaglio TMDB per id.
- `pages/api/tmdb/movie/movies.ts`: discover/search TMDB per le modalita' stanza.
- `pages/api/watchmode/[id].ts`: lookup WatchMode e normalizzazione fonti.
- `pages/api/cinema/nearby.ts`: filtro dei cinema vicini e calcolo della distanza.
- `pages/api/cinema/showtimes.ts`: recupero e normalizzazione della programmazione The Space Cinema.
- `pages/api/cinema/check-film.ts`: verifica della presenza di un film nei cinema vicini.

### Components

- `components/layout/AppShell.tsx`: layout applicativo con sidebar desktop e bottom nav.
- `components/layout/bottomNav.tsx`: navigazione mobile.
- `components/screens/addFilmscreen.tsx`: schermata inserimento manuale film.
- `components/screens/adminGate.tsx`: gate admin hardcoded.
- `components/screens/EmptyState.tsx`: stato finale quando non restano film da swipare.
- `components/screens/finalmatchescreen.tsx`: vecchia schermata match finale, stile legacy.
- `components/screens/MatchScreen.tsx`: schermata match corrente con streaming, trailer e reset.
- `components/screens/matchesScreen.tsx`: lista match legacy.
- `components/screens/SwipeCard.tsx`: card corrente con drag, overlay like/pass, flip dettagli e azioni.
- `components/screens/swipeScreen.tsx`: vecchia schermata swipe legacy basata su `styles/appStyles`.
- `components/screens/WelcomeRoom.tsx`: welcome stanza corrente con codice, utenti e ingresso.
- `components/cinema/CineMap.tsx`: mappa Leaflet client-side con posizione utente e marker dei cinema.
- `components/cinema/CinemaInSala.tsx`: disponibilita' del film del match nei cinema vicini.
- `components/screens/welcomeScreen.tsx`: vecchia welcome screen legacy.
- `components/screens/HomeScreen.tsx`: file vuoto, non usato.
- `components/screens/LandingScreen.tsx`: file vuoto, non usato.
- `components/cinema/CinemaCard.tsx`, `RadiusFilter.tsx`, `ShowtimesList.tsx`: file vuoti, non usati.
- `components/screens/notes.txt`: note tecniche/prototipali.

### Context, Hook e Utility

- `context/AuthContext.tsx`: provider auth, sessione Supabase e guest mode.
- `hooks/useAuth.ts`: hook per context auth, stato login e logout con redirect.
- `hooks/useSwipe.ts`: hook per gesture swipe, animazione fly-out/snap-back e long press trailer.
- `utils/guestName.ts`: generazione nome ospite casuale.
- `utils/recentRoom.ts`: salvataggio/lettura stanze recenti in localStorage.
- `utils/roomCode.ts`: generazione e normalizzazione codici stanza.
- `utils/tmdb.ts`: fetch film per stanza, mapping generi, trailer e shuffle deterministico.
- `utils/cinema/theSpaceCinemas.ts`: elenco e coordinate dei The Space Cinema supportati.
- `utils/cinema/theSpaceFetcher.ts`: client Playwright con cache in memoria per le API The Space Cinema.
- `utils/supabase/browser.ts`: client Supabase browser.
- `utils/supabase/server.ts`: client Supabase server.
- `utils/supabase/middleware.ts`: middleware Supabase/route protection.

### Styles, Types, Database e Asset

- `styles/globals.css`: CSS globale.
- `styles/token.ts`: design token condivisi.
- `styles/appStyles.ts`: vecchio/alternativo oggetto stili usato da componenti legacy.
- `types/index.ts`: tipi condivisi (`Movie`, `RoomUser`, `SwipeState`, `CurrentUser`, `Match`, ecc.).
- `types/stanza.ts`: tipi specifici stanza (`ExtendedMovie`, `StreamingSource`, `MatchEntry`).
- `supabase/profile_mvp.sql`: SQL per profilo MVP.
- `public/cinema-ambience.mp3`: asset audio statico.

## Debiti tecnici e miglioramenti

### Priorita' alta

- Diversi file hanno testi/commenti con mojibake, incluso il nuovo flusso Cinema (`pages/cinema.tsx`, `components/cinema/*`, `utils/cinema/theSpaceFetcher.ts`), oltre a `hooks/useSwipe.ts`, `pages/stanza.tsx`, `components/screens/SwipeCard.tsx`, `components/screens/MatchScreen.tsx`, `pages/crea-stanza.tsx`, `types/index.ts` e alcune API. Va ripulito l'encoding per evitare stringhe rotte in UI e commenti.
- `pages/stanza.tsx` e' migliorata rispetto alla versione monolitica, ma contiene ancora realtime, stato swipe, match, routing e SSR nello stesso file. Prossimo passo consigliato: estrarre `useRoomRealtime` e `useRoomSwipeState`.
- La logica TMDB e' duplicata tra `utils/tmdb.ts`, `/api/tmdb/trending` e `/api/tmdb/movie/movies`. Conviene condividere mapping generi, trailer e formatter.
- `components/screens/adminGate.tsx` contiene credenziali admin hardcoded. Spostare il controllo lato server o in variabili ambiente.
- Le API legacy `pages/api/swipes.ts` e `pages/api/swipes_get.ts` sembrano separate dal flusso realtime corrente. Decidere se mantenerle, tipizzarle meglio o rimuoverle.

### Priorita' media

- `hooks/useSwipe.ts` contiene soglie e durate hardcoded (`DRAG_THRESHOLD`, `THROW_DURATION`, ecc.). Renderle configurabili aiuterebbe test e tuning UX.
- `types/index.ts` non include ancora tutti i campi usati dai film TMDB (`tmdb_id`, `backdrop`, `rating`), che oggi vengono aggiunti via cast o tramite `ExtendedMovie`.
- Le risposte esterne TMDB/WatchMode sono ancora trattate spesso come `any`. Aggiungere tipi minimi ridurrebbe bug sui cambi di schema.
- `MatchScreen` apre link esterni con `window.open` e usa loghi remoti da Wikimedia; valutare allowlist immagini/asset locali se si irrigidisce la policy.
- Il limite stanza a 2 partecipanti e' applicato lato UI/presence, non come vincolo forte lato server.
- `home.tsx` ha alcune parti ripetute per CTA desktop e potrebbe essere diviso in componenti.
- La ricerca manuale della citta' interroga Nominatim direttamente dal browser. Per affidabilita', privacy e rispetto delle policy del servizio, valutare un endpoint proxy con cache e identificazione dell'app.
- `check-film.ts` confronta i titoli con euristiche testuali e interroga fino a cinque cinema in parallelo: possono verificarsi falsi positivi/negativi e tempi di risposta elevati.

### Priorita' bassa / pulizia

- `components/screens/HomeScreen.tsx` e `components/screens/LandingScreen.tsx` sono vuoti.
- `components/cinema/CinemaCard.tsx`, `RadiusFilter.tsx` e `ShowtimesList.tsx` sono vuoti: rimuoverli oppure spostarvi la UI ora contenuta in `pages/cinema.tsx`.
- `styles/appStyles.ts` convive con `styles/token.ts` per componenti legacy: scegliere una direzione unica.
- `components/screens/notes.txt` puo' essere trasformato in issue/task o integrato solo dove ancora utile.

## Requisiti per la pubblicazione online

Questa sezione descrive cio' che manca per rendere CineDate adatta a un pubblico reale. Non sostituisce una verifica legale, di sicurezza o di infrastruttura svolta da professionisti qualificati.

### Bloccanti prima del lancio

- **Correggere la build TypeScript.** Attualmente gli import di `utils/cinema/theSpaceCinemas.ts` usano sia `theSpaceCinemas` sia `thespaceCinemas`. Su filesystem case-sensitive questo impedisce la build. Va scelto un unico nome e tutti gli import vanno uniformati; la pipeline deve eseguire `npm run lint` e `npm run build` prima di ogni deploy.
- **Rimuovere le credenziali hardcoded.** `components/screens/adminGate.tsx` non deve contenere segreti o controlli di autorizzazione lato client. Gli eventuali ruoli amministrativi devono essere verificati lato server/Supabase, con RLS e variabili ambiente.
- **Proteggere dati e API Supabase.** Verificare e testare le policy RLS per ogni tabella: ogni utente deve poter leggere e modificare solo i dati necessari. La `SUPABASE_SERVICE_ROLE_KEY` deve restare solo sul server, mai in file o bundle pubblici. Attivare backup, rotazione delle chiavi e revisione degli accessi del progetto Supabase.
- **Gestire abusi.** Aggiungere rate limit e limiti di payload alle API, soprattutto auth, stanze, swipe e Cinema; validare e normalizzare tutti i parametri lato server; usare codici stanza non prevedibili; predisporre una pagina/contatto per segnalazioni e un flusso di blocco utente se l'app viene resa sociale.
- **Rendere l'infrastruttura ripetibile.** Configurare dominio, HTTPS, variabili ambiente di produzione, URL di redirect Supabase OAuth/email, ambiente di staging separato, backup del database e deploy automatico da CI. Il provider deve supportare Next.js con API routes e Playwright/Chromium: una configurazione serverless standard potrebbe non essere sufficiente per `fetchTheSpace`.
- **Aggiungere osservabilita'.** Servono logging strutturato senza dati sensibili, tracciamento degli errori client/server, health check, monitoraggio uptime e alert. Definire una procedura per incidenti, rollback e indisponibilita' delle API esterne.

### Privacy, contenuti e condizioni d'uso

- Pubblicare Privacy Policy, Termini d'uso e contatti del titolare prima di raccogliere account, email, username, preferenze e posizione. L'informativa deve chiarire finalita', base giuridica, tempi di conservazione, fornitori/trasferimenti e modalita' di esercizio dei diritti; la Commissione europea riepiloga le informazioni minime richieste dagli articoli 12-14 GDPR: <https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/principles-gdpr/what-information-must-be-given-individuals-whose-data-collected_en>.
- Mostrare un testo chiaro prima della richiesta di geolocalizzazione, usare la posizione solo per la ricerca locale e non salvarla sul server senza una necessita' esplicita e documentata. La geolocalizzazione e' un dato personale e richiede un'informativa specifica; si veda il Garante: <https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/6697925>.
- Se vengono introdotti analytics, advertising o altri tracciatori non tecnici, predisporre consenso granulare, banner e registro delle preferenze prima di abilitarli. Verificare il caso concreto con consulenza privacy.
- Esporre le attribuzioni e rispettare licenze/termini di TMDB, WatchMode, OpenStreetMap, Wikimedia e The Space Cinema. La programmazione The Space proviene da endpoint non documentati: ottenere un'autorizzazione o un'integrazione ufficiale prima di farne una dipendenza commerciale.
- Per Nominatim, evitare chiamate dirette dal browser in produzione: usare un provider contrattualizzato oppure un proxy con cache, rate limit, User-Agent/Referer identificativo e possibilita' di sostituzione. Il servizio pubblico richiede massimo una richiesta al secondo per applicazione, attribuzione e caching: <https://operations.osmfoundation.org/policies/nominatim/>.

### Affidabilita' e qualita' del prodotto

- Correggere tutto il mojibake in testi, emoji e commenti prima di pubblicare: oggi alcune stringhe possono apparire corrotte agli utenti.
- Aggiungere test automatici per autenticazione, creazione/accesso stanza, sincronizzazione realtime, match, reset, API TMDB e casi di errore delle API esterne. Creare almeno un test end-to-end per il percorso ospite e uno per l'utente registrato.
- Gestire stati di caricamento, assenza dati e errore per tutte le richieste esterne, con retry controllati e messaggi comprensibili. La sezione Cinema deve degradare bene se Chromium, The Space, Nominatim o OpenStreetMap non rispondono.
- Rendere accessibili le schermate: navigazione completa da tastiera, focus visibile, contrasto adeguato, label per i controlli, testo alternativo per immagini e rispetto di `prefers-reduced-motion`. Verificare almeno desktop, mobile e screen reader.
- Aggiungere pagine 404/500 curate, metadata SEO/social, favicon/manifest, sitemap e robots.txt; definire anche un canale di assistenza e una pagina di stato.

### Ordine di lavoro consigliato

1. Risolvere gli errori di build e i segreti/controlli admin lato client.
2. Verificare RLS, autorizzazioni e validazione/rate limit delle API.
3. Preparare hosting, dominio, staging, CI/CD, backup e monitoraggio.
4. Pubblicare policy privacy/termini, attribuzioni e flussi di geolocalizzazione conformi.
5. Completare test, accessibilita', stati di errore e prova di carico prima dell'apertura al pubblico.

## Flusso utente principale

1. L'utente apre `/`.
2. Accede, si registra o entra come ospite da `/auth`.
3. Dopo OAuth/email passa da `/auth/callback` quando Supabase usa un redirect esplicito.
4. Se non ha username viene mandato a `/username`.
5. Da `/home` crea o raggiunge una stanza.
6. `/crea-stanza` salva la configurazione e apre `/stanza`.
7. In `/stanza` gli utenti entrano nello stesso canale realtime.
8. Ogni swipe viene salvato nello stato locale e broadcastato.
9. Se due utenti mettono like allo stesso film, viene mostrato il match.
10. Sul match si tenta di mostrare trailer e disponibilita' WatchMode.

### Consultazione cinema

1. L'utente apre `/cinema` dalla navigazione.
2. L'app richiede la geolocalizzazione; in alternativa l'utente inserisce una citta'.
3. `/api/cinema/nearby` restituisce i The Space Cinema entro il raggio selezionato.
4. L'utente seleziona un cinema da mappa o elenco.
5. `/api/cinema/showtimes` carica la programmazione dei sette giorni successivi e gli orari rimandano alla pagina di acquisto.

## Note operative

- Prima di lavorare su auth o sessioni: controllare `context/AuthContext.tsx`, `hooks/useAuth.ts`, `pages/auth.tsx`, `pages/auth/callback.tsx`, `pages/username.tsx` e `utils/supabase/middleware.ts`.
- Prima di lavorare su stanze/swipe/match: partire da `pages/stanza.tsx`, `hooks/useSwipe.ts`, `components/screens/SwipeCard.tsx`, `components/screens/MatchScreen.tsx` e `types/stanza.ts`.
- Prima di lavorare su film/TMDB/streaming: controllare `utils/tmdb.ts`, `pages/api/tmdb/*`, `pages/api/watchmode/[id].ts` e `pages/crea-stanza.tsx`.
- Evitare log di token, sessioni complete, cookie o payload sensibili.
- Il comando `npm run lint` e' un controllo TypeScript, non ESLint.
