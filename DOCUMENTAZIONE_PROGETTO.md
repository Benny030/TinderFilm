# CineDate — Documentazione tecnica e architetturale

**Repository:** `Benny030/TinderFilm`
**Branch analizzato:** `main`
**Stack principale:** Next.js Pages Router + React + TypeScript + Supabase + TMDB
**Nome package:** `tinderfilm-next-supabase`

---

# 1. Panoramica del progetto

CineDate è una web application dedicata alla scoperta e scelta condivisa di film.

Il cuore dell’esperienza consiste nella creazione o partecipazione a una **stanza**, nella quale più utenti ricevono un catalogo comune di film e possono esprimere preferenze tramite un’interfaccia swipe.

Quando un film raggiunge la soglia di consenso configurata per la stanza, viene generato un **match**.

Il progetto si è successivamente esteso oltre il semplice meccanismo “Tinder dei film” e include oggi aree dedicate a:

* autenticazione e profili;
* utenti guest;
* stanze private/pubbliche;
* stanze di coppia e gruppo;
* swipe e match;
* cinema reali e programmazioni;
* scelta finale del film;
* libreria personale;
* film preferiti;
* watchlist;
* film visti;
* votazioni;
* recensioni;
* raccomandazioni personalizzate;
* pagine pubbliche degli utenti;
* blocco utenti;
* segnalazioni;
* pannello amministrativo;
* integrazione TMDB;
* integrazione con Supabase Realtime.

La struttura generale presente nel repository conferma un’app Next.js basata sul **Pages Router**, con frontend e backend API ospitati nello stesso progetto.

---

# 2. Stack tecnologico

Dal `package.json` risultano le principali dipendenze:

* **Next.js 16**
* **React 18**
* **TypeScript 5.6**
* **Supabase JS**
* **Supabase SSR**
* **Leaflet**
* **Phosphor Icons**
* **Playwright**
* **Playwright Core**
* **Chromium serverless tramite `@sparticuz/chromium`**

Gli script principali sono:

```text
npm run dev
npm run build
npm run start
npm run lint
```

Nel progetto `lint` esegue in realtà:

```text
tsc --noEmit
```

quindi attualmente il comando controlla il type-checking TypeScript, non ESLint.

---

# 3. Architettura generale

L'architettura può essere vista come cinque livelli principali.

```text
Browser / React UI
        │
        ├── Context e Hooks
        │
        ├── Supabase Browser Client
        │
        │
        └── Next.js API Routes
                    │
                    ├── Supabase
                    │   ├── Auth
                    │   ├── PostgreSQL
                    │   ├── Realtime
                    │   └── Storage
                    │
                    ├── TMDB
                    │
                    ├── servizi cinema
                    │
                    └── Playwright / Chromium
```

Il frontend può quindi comunicare con Supabase in due modi:

1. direttamente dal browser tramite il client anonimo;
2. tramite le API Next.js lato server.

Questa distinzione è molto importante dal punto di vista della sicurezza.

---

# 4. Entry point dell'applicazione

Il punto globale dell'app è:

```text
pages/_app.tsx
```

che:

* carica gli stylesheet globali;
* imposta viewport, colore tema e titolo;
* racchiude tutta l'app nel `ThemeProvider`;
* racchiude l'app nell'`AuthProvider`.

La gerarchia principale è:

```text
ThemeProvider
└── AuthProvider
    └── pagina corrente
```

---

# 5. Struttura delle directory

La parte realmente applicativa della repository può essere riassunta così:

```text
TinderFilm/
│
├── components/
│   ├── cinema/
│   ├── layout/
│   ├── screens/
│   └── social/
│
├── context/
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
│
├── hooks/
│   ├── useAuth.ts
│   └── useSwipe.ts
│
├── pages/
│   ├── api/
│   ├── admin/
│   ├── auth/
│   ├── attore/
│   ├── film/
│   ├── impostazioni/
│   ├── stanze/
│   ├── utente/
│   └── pagine principali
│
├── public/
│
├── styles/
│
├── supabase/
│
├── types/
│
├── utils/
│   ├── cinema/
│   └── supabase/
│
├── middleware.ts
├── next.config.mjs
├── tsconfig.json
├── vercel.json
└── package.json
```

---

# 6. Componenti

## `components/layout`

Contiene l'infrastruttura visuale condivisa.

### `AppShell.tsx`

Rappresenta il contenitore principale delle schermate dell'app.

Gestisce il layout generale e permette alle varie pagine di condividere una struttura coerente.

### `AppFooter.tsx`

Footer condiviso.

### `bottomNav.tsx`

Navigazione mobile inferiore.

Il progetto ha chiaramente una forte impostazione **mobile-first / app-like**.

---

# 7. Componenti delle stanze

La directory:

```text
components/screens/
```

contiene buona parte della logica visuale dell'esperienza principale.

### `WelcomeRoom.tsx`

Sala d'attesa della stanza.

Gestisce presumibilmente:

* informazioni stanza;
* partecipanti;
* ingresso;
* host;
* avvio della votazione;
* richieste di accesso.

### `SwipeCard.tsx`

Card visuale che rappresenta il film durante lo swipe.

Lavora insieme a:

```text
hooks/useSwipe.ts
```

### `MatchScreen.tsx`

Mostra un match appena raggiunto.

### `matchesScreen.tsx`

Mostra l'elenco dei match generati nella stanza.

### `CinemaPlanScreen.tsx`

Schermata dedicata alla pianificazione della visione al cinema.

### `finalmatchescreen.tsx`

Ulteriore rappresentazione finale del risultato della stanza.

### `EmptyState.tsx`

Componente generico per stati senza risultati.

---

# 8. Motore swipe

La logica gestuale è stata estratta nel custom hook:

```text
hooks/useSwipe.ts
```

Il sistema supporta:

* drag tramite mouse;
* drag tramite touch;
* soglia minima di spostamento;
* rilevamento della velocità;
* flick;
* animazione di uscita;
* snap-back della card;
* rotazione dinamica;
* fade;
* blocco durante l'animazione;
* long press.

Uno swipe può essere accettato:

* quando supera circa 92px;
* oppure quando viene rilevato un flick sufficientemente veloce.

È presente anche un **long press di 3 secondi**, collegato alla visualizzazione del trailer.

Questa separazione tra gesto e schermata è una buona scelta architetturale.

---

# 9. Sistema di autenticazione

La gestione centrale si trova in:

```text
context/AuthContext.tsx
```

CineDate supporta due identità differenti:

```text
Authenticated User
Guest User
```

## Utente autenticato

L'utente autenticato proviene da Supabase Auth.

Dal profilo `public.users` viene recuperato almeno:

```text
username
```

L'identità autorevole resta l'UUID Supabase dell'utente.

## Guest

Il guest viene creato localmente tramite:

```text
crypto.randomUUID()
```

e riceve un nome generato attraverso:

```text
utils/guestName.ts
```

La sessione guest viene mantenuta in:

```text
localStorage
```

con durata:

```text
24 ore
```

ed è accompagnata da un cookie tecnico:

```text
cineDateGuest=true
```

La sessione Supabase, quando presente, ha precedenza sull'identità guest.

---

# 10. Supabase

Sono presenti tre utility distinte:

```text
utils/supabase/browser.ts
utils/supabase/server.ts
utils/supabase/middleware.ts
```

## Browser

Il browser utilizza:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

tramite un client singleton.

## Server

Il client server utilizza:

```text
SUPABASE_SERVICE_ROLE_KEY
```

quando disponibile, con fallback sulla anon key.

Questa utility richiede particolare attenzione perché una route che utilizza la service role bypassa normalmente le policy RLS.

Le route che usano un client amministrativo devono quindi verificare esplicitamente l'identità dell'utente.

---

# 11. Stanze

La stanza è oggi uno degli oggetti centrali del progetto.

La API principale è:

```text
/api/rooms
```

La stanza supporta quattro tipologie:

```text
private
group
cinema_pair
cinema_group
```

La configurazione include:

```text
id
mode
genres
year_from
year_to

room_type

min_members
max_members
match_threshold_percent

visibility
requires_approval

host_actor_id
host_actor_type

city
province
country_code
latitude
longitude
radius_km
```

Il numero massimo di partecipanti è limitato a **20**.

La soglia di match è configurabile da **1 a 100%**.

Le stanze create dall'interfaccia API possono attualmente essere:

```text
private
public
```

anche se il tipo `Visibility` contiene valori più ampi come:

```text
following
followers
network
local
```

Ciò suggerisce un sistema di discovery/social già progettato per future estensioni.

---

# 12. Partecipanti delle stanze

La gestione partecipanti è separata dalle stanze.

La API:

```text
/api/room-participants
```

gestisce la membership.

Ogni partecipante viene modellato attraverso:

```text
actor_id
actor_type
display_name
```

dove:

```text
actor_type = user | guest
```

Questo permette allo stesso sistema di funzionare sia con account reali sia con guest.

Sono presenti anche concetti come:

```text
role
membership_status
expires_at
```

Il guest riceve una scadenza.

---

# 13. Stato della stanza

La pagina:

```text
pages/stanza.tsx
```

gestisce diversi stati UI:

```text
welcome
swipe
matches
match
plan
```

e stati logici della stanza:

```text
waiting
voting
matched
planning
finished
```

La pagina ricostruisce periodicamente lo stato utilizzando:

```text
/api/rooms
/api/room-participants
/api/swipes
```

Il database è quindi trattato come **source of truth**.

Supabase Realtime viene utilizzato soprattutto per notificare rapidamente ai client che lo stato deve essere aggiornato.

Questa è una scelta robusta: gli eventi realtime non rappresentano lo stato persistente, ma solamente un meccanismo di sincronizzazione.

---

# 14. Realtime

Ogni stanza crea un canale:

```text
room-{roomId}
```

Il sistema utilizza:

```text
Presence
Broadcast
```

Tra gli eventi osservati:

```text
participants_changed
room_state_changed
swipe
match
match_removed
reset
```

Questo permette ai partecipanti di vedere quasi immediatamente:

* entrate/uscite;
* nuove preferenze;
* nuovi match;
* cambiamenti di fase;
* selezione finale.

---

# 15. Swipe lato backend

L'endpoint principale è:

```text
/api/swipes
```

Utilizza le tabelle:

```text
room_swipes
room_matches
room_match_participants
room_participants
rooms
```

Lo swipe è salvato con:

```text
room_id
movie_id
actor_id
actor_type
liked
expires_at
```

È presente un upsert con conflitto su:

```text
room_id,movie_id,actor_id
```

quindi ogni partecipante mantiene un solo voto per film nella stanza.

---

# 16. Algoritmo del match

Dopo ogni swipe positivo il server:

1. determina i partecipanti attivi;
2. legge gli swipe positivi per quel film;
3. elimina quelli appartenenti a partecipanti non più attivi;
4. calcola:

```text
matchedMembers
totalMembers
matchPercent
```

La formula è:

```text
matchPercent =
matchedMembers / totalMembers * 100
```

Il film diventa match quando:

```text
totalMembers >= min_members
```

e:

```text
matchPercent >= match_threshold_percent
```

Il sistema quindi non è limitato al caso classico 2/2.

Può gestire, per esempio:

```text
5 partecipanti
soglia 60%
```

e generare un match quando almeno 3 utenti hanno messo like.

---

# 17. Catalogo film

Il progetto utilizza soprattutto **TMDB**.

Sono presenti endpoint dedicati a:

```text
/api/tmdb/search
/api/tmdb/trending
/api/tmdb/explore
/api/tmdb/movie/[id]
/api/tmdb/movie/movies
/api/tmdb/person/[id]
```

La API key server-side è:

```text
TMDB_API_KEY
```

---

# 18. Catalogo canonico interno

Una delle evoluzioni più importanti rispetto alla vecchia documentazione è l'introduzione di un catalogo persistente.

L'utility:

```text
utils/movieEntries.ts
```

utilizza:

```text
movie_catalog
```

La struttura prevista include:

```text
id
provider
provider_movie_id
title
year
genre
cover
backdrop
trailer
trama_c
trama_l
```

Il provider attualmente tipizzato è:

```text
tmdb
```

L'endpoint:

```text
/api/movie-catalog/ensure
```

garantisce che un film TMDB disponga di un record persistente interno prima di associargli dati personali.

Questa è un'importante correzione architetturale rispetto alla prima versione del progetto.

---

# 19. Libreria personale

La tabella centrale della libreria è:

```text
user_movie_entries
```

Ogni record rappresenta la relazione:

```text
utente ↔ film
```

e contiene:

```text
id
user_id
movie_id

rating
review_text
review_updated_at

is_favorite
in_watchlist
watched_on

created_at
updated_at
```

Il codice esegue upsert sul vincolo:

```text
user_id,movie_id
```

Ciò significa che per ogni utente e film esiste un unico stato personale.

---

# 20. Funzioni della libreria

`utils/movieEntries.ts` espone funzioni quali:

```text
getMovieEntry()
setFavorite()
setWatchlist()
markWatched()
clearWatched()
setRating()
saveReview()
saveRatingAndReview()
```

Il voto accettato va da:

```text
0.5 → 5
```

in intervalli di:

```text
0.5
```

Le recensioni sono limitate lato client a:

```text
3000 caratteri
```

---

# 21. Pagine della libreria e contenuti personali

`user_movie_entries` viene utilizzata almeno da:

```text
pages/libreria.tsx
pages/film/[id].tsx
pages/recensioni.tsx
pages/profilo.tsx
pages/api/recommendations/for-you.ts
utils/movieEntries.ts
```

Questo conferma che la libreria personale è ormai una feature realmente integrata, non soltanto una proposta.

---

# 22. Sistema "Per te"

La pagina:

```text
pages/per-te.tsx
```

utilizza un motore personalizzato:

```text
/api/recommendations/for-you
```

Il sistema costruisce un profilo di gusto combinando diversi segnali.

## Segnali positivi

```text
favorite
high_rating
watchlist
room_like
room_match
room_winner
explicit_more_like_this
```

## Segnali negativi

Include almeno:

```text
dislike nelle stanze
feedback "not_for_me"
```

---

# 23. Pesi delle raccomandazioni

Il sistema attribuisce pesi diversi.

Indicativamente:

```text
preferito          ≈ 6
voto >= 4.5        ≈ 6
voto >= 4          ≈ 5
voto >= 3.5        ≈ 3
watchlist           ≈ 2
room like           ≈ 2
room match          ≈ 2
room winner         ≈ 4
more_like_this      ≈ 8
```

A questi viene applicato anche un moltiplicatore di recency.

Gli eventi più recenti pesano maggiormente.

Esempio:

```text
<= 7 giorni     ×1.25
<= 30 giorni    ×1.15
<= 90 giorni    ×1.08
<= 180 giorni   ×1.03
```

---

# 24. Profilo di gusto

Il motore costruisce due mappe principali:

```text
genreWeights
actorWeights
```

Per i film seed interroga TMDB e ricava:

```text
generi
cast principale
```

Quindi CineDate non suggerisce film solamente perché “simili”, ma costruisce progressivamente una rappresentazione dei gusti dell'utente.

---

# 25. Cold start

Quando non esistono segnali sufficienti vengono usati:

```text
favorite_genres
```

del profilo utente.

È presente una mappatura dei nomi italiani/inglesi ai genre ID TMDB.

Esempio:

```text
azione        → 28
commedia      → 35
dramma        → 18
horror        → 27
fantascienza  → 878
thriller      → 53
```

Il sistema può quindi produrre consigli anche per utenti che non hanno ancora compilato la libreria.

---

# 26. Autenticazione delle raccomandazioni

La API `/api/recommendations/for-you` è strutturata correttamente sotto questo aspetto.

Richiede:

```text
Authorization: Bearer <access_token>
```

Il token viene verificato tramite:

```text
auth.getUser(token)
```

e solo dopo viene creato il client amministrativo con service role.

In questo caso l'ID utente utilizzato nelle query deriva dalla sessione verificata e non da un `userId` inviato dal browser.

Questo pattern dovrebbe essere adottato sistematicamente nelle altre API sensibili.

---

# 27. Cinema

La directory:

```text
components/cinema/
```

contiene:

```text
CineMap.tsx
CinemaInSala.tsx
```

Sono inoltre presenti API:

```text
/api/cinema/nearby
/api/cinema/showtimes
/api/cinema/check-film
```

e utility:

```text
utils/cinema/cinemaCache.ts
utils/cinema/cinemaChain.ts
utils/cinema/theSpaceCinemasFIX.ts
utils/cinema/theSpaceFetcher.ts
```

---

# 28. Scraping / recupero cinema

`theSpaceFetcher.ts` utilizza:

```text
Playwright
Chromium
```

e rileva se l'app sta girando in ambiente serverless attraverso:

```text
VERCEL
AWS_LAMBDA_FUNCTION_NAME
```

Il progetto utilizza quindi browser automation per ottenere parte delle informazioni relative ai cinema.

---

# 29. Geolocalizzazione

Sono presenti:

```text
/api/location/search
/api/location/reverse
```

che vengono utilizzate per trasformare:

```text
testo → coordinate
coordinate → località
```

Questa parte alimenta sia la ricerca dei cinema sia la creazione di stanze locali/cinema.

---

# 30. Film e attori

Le pagine dinamiche:

```text
/film/[id]
/attore/[id]
```

costituiscono le pagine di dettaglio.

La prima collega anche le funzionalità personali dell'utente:

* preferito;
* watchlist;
* visto;
* voto;
* recensione.

La seconda utilizza le informazioni TMDB relative a una persona/cast.

---

# 31. Profilo

Sono presenti:

```text
/profilo
/utente/[username]
/utente/[username]/connessioni
/persone
```

Questo mostra chiaramente l'evoluzione del prodotto verso una componente social.

La pagina utente contiene anche logiche relative al blocco di altri profili.

---

# 32. Blocco utenti

Esiste la schermata:

```text
/impostazioni/utenti-bloccati
```

che utilizza una RPC Supabase chiamata:

```text
get_my_blocked_users
```

Questo significa che parte della business logic sociale vive direttamente nel database tramite funzioni PostgreSQL.

---

# 33. Segnalazioni e moderazione

Sono presenti:

```text
components/social/ReportModal.tsx
/pages/impostazioni/segnalazioni.tsx
```

e un'ampia area amministrativa:

```text
/admin
/admin/audit
/admin/ricorsi
/admin/segnalazioni
/admin/sospensioni
/admin/utenti
```

Il progetto dispone quindi già di un impianto di moderation/backoffice considerevole.

---

# 34. Area amministrativa

La directory:

```text
pages/admin/
```

separa le principali funzioni amministrative.

### `index.tsx`

Dashboard amministrativa.

### `utenti.tsx`

Gestione utenti.

### `segnalazioni.tsx`

Gestione report/segnalazioni.

### `sospensioni.tsx`

Gestione sospensioni account.

### `ricorsi.tsx`

Gestione ricorsi.

### `audit.tsx`

Audit delle azioni amministrative.

È inoltre presente:

```text
/api/admin/users/delete
```

per eliminazioni amministrative.

---

# 35. Eliminazione account

Esiste una API specifica:

```text
/api/account/delete
```

che utilizza:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Poiché questa è un'operazione altamente sensibile, deve continuare ad avere una verifica server-side molto forte dell'identità.

---

# 36. Styling

Il progetto utilizza diversi approcci contemporaneamente.

```text
styles/globals.css
styles/pages/auth.css
styles/pages/home.css
styles/pages/landing.css

styles/token.ts
styles/appStyles.ts
styles/home.styles.ts
```

`token.ts` sembra rappresentare il design system più strutturato.

La coesistenza di:

* CSS globale;
* CSS specifico per pagina;
* oggetti di stile TypeScript;
* grandi quantità di styling inline nelle pagine;

rende però il frontend più difficile da mantenere.

---

# 37. Tipi TypeScript

La directory:

```text
types/
```

contiene:

```text
index.ts
stanza.ts
```

e centralizza parte dei modelli condivisi.

Sono presenti tipi per entità come:

```text
Movie
CurrentUser
RoomUser
SwipeState
MatchEntry
```

Una parte consistente delle pagine usa però ancora `any`, soprattutto nella trasformazione delle risposte Supabase.

È un'area che può essere migliorata introducendo tipi database generati automaticamente da Supabase.

---

# 38. Middleware

Il progetto contiene:

```text
middleware.ts
utils/supabase/middleware.ts
```

Il middleware utilizza il client SSR di Supabase e le variabili:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

La finalità è mantenere/aggiornare correttamente la sessione attraverso le richieste Next.js.

---

# 39. Variabili ambiente individuate

Senza riportare alcun valore sensibile, il codice fa riferimento almeno a:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

TMDB_API_KEY

VERCEL
AWS_LAMBDA_FUNCTION_NAME
```

Altre variabili possono essere presenti, ma queste sono direttamente osservabili nel codice analizzato.

---

# 40. Problema critico del repository Git

Attualmente risultano **versionati**:

```text
.env.local
node_modules/
.next/
tsconfig.tsbuildinfo
dev-server.log
dev-server.err.log
dev-server.out.log
```

oltre a molti file generati.

Questo è un problema importante.

Il `.gitignore` corrente contiene già correttamente:

```text
node_modules/
.next/
.vercel/
out
.DS_Store
.env.local
```

Il fatto che `.next`, `node_modules` e `.env.local` risultino comunque nell'albero Git significa che sono stati aggiunti al repository **prima di essere ignorati** o comunque sono ancora tracked.

Git continua infatti a tracciare un file già committato anche dopo che viene aggiunto a `.gitignore`.

Questa è attualmente una delle priorità tecniche principali.

---

# 41. Rischio `.env.local`

`.env.local` risulta versionato nell'albero del repository.

Non è necessario leggere il contenuto per concludere che la situazione vada corretta.

Se quel file ha mai contenuto:

```text
SUPABASE_SERVICE_ROLE_KEY
TMDB_API_KEY
altre credenziali
```

le chiavi devono essere considerate potenzialmente esposte.

La procedura corretta è:

1. rimuovere `.env.local` dal tracking;
2. verificare la cronologia Git;
3. ruotare tutte le chiavi sensibili che siano state committate;
4. mantenere soltanto `.env.example`.

---

# 42. Repository estremamente gonfiato

Sono versionati anche:

```text
node_modules
.next
```

inclusi cache Webpack e bundle di diversi megabyte.

Questo spiega le dimensioni molto elevate della repository.

Questi file:

* non appartengono al source code;
* rallentano clone e fetch;
* producono diff inutili;
* aumentano il rischio di conflitti;
* possono rendere più difficile code review e CI.

Devono essere rimossi dalla history/tracking.

---

# 43. Dimensione delle pagine

Alcuni file sono molto grandi.

Dall'albero risultano, per esempio:

```text
pages/profilo.tsx        ~95 KB
pages/home.tsx           ~93 KB
pages/recensioni.tsx     ~89 KB
pages/utente/[username]  ~68 KB
pages/crea-stanza.tsx    ~66 KB
pages/film/[id].tsx      ~53 KB
```

Questo suggerisce un elevato livello di logica UI e business logic concentrata direttamente nelle pagine.

La direzione consigliata è suddividerle in:

```text
features/
components/
services/
hooks/
queries/
```

---

# 44. Punti di forza dell'architettura

Il progetto presenta diverse buone scelte.

### DB come source of truth

Nelle stanze il Realtime non viene trattato come stato permanente.

### Match generalizzato

Il sistema funziona anche per gruppi e soglie configurabili.

### Identità guest separata

Il guest è modellato esplicitamente, senza fingere che sia un account reale.

### Catalogo canonico

L'introduzione di `movie_catalog` elimina molti problemi di identificazione film.

### Stato personale unico

`user_movie_entries` evita entità duplicate per preferito/watchlist/voto/recensione.

### Raccomandazioni spiegabili

Ogni suggerimento può essere collegato al segnale che l'ha generato.

### Autenticazione API "Per te"

La route verifica il bearer token prima di usare la service role.

---

# 45. Debolezze principali

## 45.1 Repository hygiene

È il problema più immediato.

Da rimuovere dal tracking:

```text
.env.local
.next
node_modules
*.log
tsconfig.tsbuildinfo
```

## 45.2 File monolitici

Molte pagine sono diventate troppo grandi.

## 45.3 Business logic distribuita

Una parte della logica vive:

* nei componenti;
* nelle pagine;
* nelle API;
* nel database;
* nelle RPC Supabase.

Serve una documentazione formale dei confini.

## 45.4 Uso di `any`

Diverse query Supabase perdono la protezione TypeScript.

## 45.5 Service role

Le API che utilizzano service role devono essere sottoposte a un audit sistematico.

## 45.6 Database non versionato completamente

Nel repository compare soltanto:

```text
supabase/profile_mvp.sql
```

ma il codice utilizza molte più tabelle e RPC.

Quindi lo schema di produzione non sembra essere completamente rappresentato da migration versionate.

Questo è un importante rischio operativo.

---

# 46. Schema database desumibile dal codice

Il codice fa riferimento almeno a entità equivalenti a:

```text
users

movie_catalog
user_movie_entries
user_recommendation_feedback

rooms
room_participants
room_swipes
room_matches
room_match_participants

cinemas
cinema_showings

blocchi utenti
segnalazioni
moderazione
```

e potenzialmente altre tabelle usate dalle pagine admin/social.

Il database Supabase dovrebbe diventare completamente riproducibile tramite migration.

---

# 47. Flusso principale — scelta del film

Il flusso completo può essere rappresentato così:

```text
Utente
  │
  ├── login / guest
  │
  ▼
Creazione o ingresso stanza
  │
  ▼
room_participants
  │
  ▼
Host avvia votazione
  │
  ▼
Catalogo comune TMDB
  │
  ▼
Swipe
  │
  ▼
POST /api/swipes
  │
  ├── room_swipes
  │
  ├── calcolo consenso
  │
  └── room_matches
        │
        ▼
       Match
        │
        ├── streaming / dettagli
        │
        └── cinema
              │
              ▼
        selezione proiezione
              │
              ▼
           piano finale
```

---

# 48. Flusso personale

```text
Film TMDB
   │
   ▼
/api/movie-catalog/ensure
   │
   ▼
movie_catalog
   │
   ▼
user_movie_entries
   │
   ├── rating
   ├── review
   ├── favorite
   ├── watchlist
   └── watched
```

Questa è probabilmente oggi la parte più importante del dominio persistente personale.

---

# 49. Flusso raccomandazioni

```text
user_movie_entries
room_swipes
room_matches
rooms
feedback esplicito
favorite_genres
        │
        ▼
costruzione seed
        │
        ▼
pesi + recency
        │
        ▼
profilo generi
profilo attori
        │
        ▼
TMDB similar/discover
        │
        ▼
ranking
        │
        ▼
pagina "Per te"
```

---

# 50. Priorità tecniche consigliate

Ordine consigliato degli interventi.

### P0 — Sicurezza repository

Rimuovere immediatamente dal tracking:

```text
.env.local
node_modules
.next
log
build info
```

e ruotare eventuali segreti già committati.

### P0 — Audit API service role

Individuare tutte le route che utilizzano:

```text
SUPABASE_SERVICE_ROLE_KEY
```

e verificare che ricavino l'identità dal token autenticato.

### P1 — Migration Supabase complete

Portare l'intero schema sotto version control:

```text
supabase/migrations/
```

incluse:

* tabelle;
* FK;
* unique;
* check;
* indici;
* trigger;
* funzioni;
* RPC;
* RLS;
* storage policies.

### P1 — Refactoring delle pagine monolitiche

Spezzare soprattutto:

```text
profilo
home
recensioni
utente/[username]
crea-stanza
film/[id]
cinema
stanza
```

### P1 — Supabase generated types

Generare i tipi TypeScript del database e ridurre progressivamente gli `any`.

### P2 — Service layer

Creare una struttura tipo:

```text
features/
  auth/
  rooms/
  movies/
  library/
  recommendations/
  cinema/
  social/
  moderation/
```

### P2 — Test

Aggiungere test per:

```text
auth
room creation
joining
approval
swipe
match threshold
guest expiry
library
recommendations
account deletion
admin authorization
```

---

# 51. Struttura target consigliata

Una possibile evoluzione:

```text
src/
├── components/
│
├── features/
│   ├── auth/
│   ├── rooms/
│   ├── movies/
│   ├── library/
│   ├── recommendations/
│   ├── cinema/
│   ├── social/
│   └── moderation/
│
├── hooks/
│
├── lib/
│   ├── supabase/
│   ├── tmdb/
│   └── cinema/
│
├── styles/
├── types/
└── utils/
```

Non è necessario migrare subito all'App Router per ottenere benefici: prima conviene ridurre la complessità interna.

---

# 52. Valutazione complessiva

CineDate non è più un semplice prototipo di swipe.

Il codice contiene già le fondamenta di una vera piattaforma cinematografica sociale:

```text
discovery
+
matching
+
stanze realtime
+
cinema
+
profilo
+
libreria
+
recensioni
+
raccomandazioni
+
social
+
moderazione
```

L'architettura di dominio sta diventando interessante e alcune evoluzioni recenti — in particolare `movie_catalog`, `user_movie_entries` e il motore `for-you` — vanno nella direzione corretta.

Il principale limite attuale non è la mancanza di funzionalità.

È il **debito strutturale accumulato mentre le funzionalità sono cresciute**.

Le tre priorità assolute sono quindi:

```text
1. pulizia e sicurezza Git
2. schema Supabase completamente versionato
3. modularizzazione del frontend/backend
```

Una volta risolti questi punti, il progetto può evolvere in modo molto più controllato senza dover riscrivere l'app da zero.

---

# 53. Mappa rapida per un nuovo sviluppatore

Se devi capire il progetto partendo da zero, l'ordine migliore di lettura è:

```text
package.json

pages/_app.tsx
context/AuthContext.tsx

pages/stanza.tsx
pages/api/rooms/index.ts
pages/api/room-participants.ts
pages/api/swipes.ts

hooks/useSwipe.ts
components/screens/SwipeCard.tsx
components/screens/WelcomeRoom.tsx
components/screens/MatchScreen.tsx

utils/movieEntries.ts
pages/film/[id].tsx
pages/libreria.tsx
pages/recensioni.tsx

pages/api/recommendations/for-you.ts
pages/per-te.tsx

utils/supabase/browser.ts
utils/supabase/server.ts
utils/supabase/middleware.ts

pages/cinema.tsx
utils/cinema/*
pages/api/cinema/*

pages/profilo.tsx
pages/utente/[username].tsx

pages/admin/*
```

Seguendo questo ordine si passa progressivamente da:

```text
bootstrap
→ identità
→ core rooms
→ swipe
→ persistenza personale
→ recommendation engine
→ cinema
→ social
→ amministrazione
```

e si ottiene una visione quasi completa del prodotto senza dover leggere casualmente centinaia di file.
