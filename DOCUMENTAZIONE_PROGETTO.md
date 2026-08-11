# Documento di analisi e proposta evolutiva — CineDate

Ultimo aggiornamento: 11 agosto 2026. Stato: sola analisi; nessuna modifica applicativa o al database è inclusa in questo documento.

## Contesto rapido per persone e agenti AI

**CineDate** è una web app per scegliere un film insieme: due persone entrano nella stessa stanza, ricevono lo stesso catalogo e indicano i titoli che gradiscono. Quando entrambe esprimono un like sullo stesso film, l'app mostra il match con dettagli e trailer, suggerisce dove il titolo è disponibile in streaming e, soprattutto, individua i cinema reali The Space più vicini alla posizione dell'utente. Per ogni cinema mostra la programmazione e fornisce il collegamento diretto alla pagina di acquisto/prenotazione del biglietto della proiezione. Il prodotto supporta sia utenti autenticati Supabase sia ospiti; gli ospiti possono partecipare alle stanze, ma i dati personali e persistenti devono appartenere soltanto a utenti autenticati.

L'obiettivo del progetto non è essere solo un sistema di swipe: CineDate deve diventare un posto personale e sociale per organizzare il proprio rapporto con i film. Le evoluzioni descritte qui puntano a permettere a ogni utente di salvare in modo affidabile voto, recensione personale, preferiti, film visti e watchlist; in seguito, di condividere selettivamente tali informazioni con gli amici. Privacy, assenza di duplicati, coerenza tra fonti film e autorizzazione lato database sono requisiti fondamentali, non dettagli opzionali.

Il progetto usa Next.js lato client/API, Supabase per Auth, database, Storage e Realtime, TMDB per gran parte del catalogo e un job server per le programmazioni The Space. Le stanze realtime sono intenzionalmente effimere e non sostituiscono la cronologia personale persistente. `auth.users` è l'identità autorevole; `public.users` è il profilo applicativo collegato a tale identità. Qualunque futura modifica che tocchi dati utente, recensioni, amicizie o API deve rispettare RLS, usare l'identità autenticata anziché dati dichiarati dal browser e mantenere una chiave canonica per i film.

Quando si lavora sul repository, distinguere sempre ciò che è già implementato da ciò che è solo proposto in questa analisi. In particolare, recensioni e relative tabelle esistono nello schema ma non sono ancora integrate nel flusso UI/API; amicizie, watchlist, visti e preferiti film non risultano ancora modellati. Non dedurre policy, trigger, indici o impostazioni Google OAuth dal codice: devono essere verificati nell'ambiente Supabase prima di implementare o migrare.

## Perimetro e attendibilità dell'analisi

Sono stati esaminati i file versionati di `Client/` e `Server/`, tutte le chiamate Supabase individuabili nel codice, i tipi TypeScript e lo script SQL `Client/supabase/profile_mvp.sql`. In data 11 agosto 2026 è stato inoltre fornito uno snapshot dello schema `public` attuale, usato nelle sezioni seguenti per confermare tabelle, colonne, PK, FK e check. Non sono invece disponibili policy RLS, indici oltre a PK/UNIQUE dichiarati, trigger, contenuto dei dati, file `.env.local` o configurazioni del dashboard Supabase/Google. Questi aspetti restano da verificare prima di ogni implementazione.

Le note storiche in `components/screens/notes.txt` non sono una fonte progettuale vincolante; lo schema fornito conferma comunque l'esistenza di `reviews`, `review_likes` e `matches`, mentre il codice corrente non le interroga né espone schermate per recensioni. Prima di implementare è necessario esportare RLS, indici e trigger dall'ambiente Supabase interessato.

## Struttura e comunicazione con il database attuali

L'app è una Next.js Pages Router. Il browser usa un singleton `createBrowserClient()` con chiave anonima (`utils/supabase/browser.ts`) per sessione, profilo e Storage. Le API Next.js e il job `Server/sync-cinema-showings.mjs` usano `utils/supabase/server.ts`/`createClient` con `SUPABASE_SERVICE_ROLE_KEY` quando disponibile, altrimenti con la chiave anonima. Le route osservate non ricavano o verificano l'utente dal token della richiesta: questa è un'area da correggere in una fase di sicurezza separata prima di esporre dati sociali.

Le relazioni e tabelle referenziate dal codice sono:

| Area | Tabelle/campi osservati | Osservazioni |
| --- | --- | --- |
| Identità e profilo | `users`: `id`, `email`, `username`; lo SQL aggiunge `avatar_url`, `bio`, `favorite_genres` | Il profilo è letto/scritto dal browser e `id` deriva da `auth.users.id`. Il codice cerca anche per email come fallback. |
| Film | `movies`: `id`, titolo e metadati locali; film TMDB con `tmdb_id` solo nell'oggetto in memoria | Non emerge una chiave canonica comune né un upsert del film TMDB in `movies`. |
| Stanze/match | `rooms`, `swipes`, `matches` | La stanza corrente sincronizza swipe e match via Supabase Realtime Broadcast/Presence; le API swipe legacy operano globalmente. |
| Cinema | `cinemas`, `cinema_showings` | Il job server usa service role per upsert/cancellazione/inserimento; le API leggono i dati tramite client server. |
| Storage | bucket `avatars` | `profile_mvp.sql` definisce bucket e policy Storage, non policy della tabella `users`. |

La scelta di dati personali non deve dipendere dagli eventi Realtime della stanza: essi sono effimeri, usano anche ospiti e non costituiscono una cronologia utente. Ogni scrittura personale deve invece essere associata a `auth.uid()` e autorizzata da RLS/API autenticata.

### Riscontri dallo schema fornito

- `users.id` è correttamente una FK verso `auth.users(id)` e `username` è unico. `favorite_genres` è indicato nello snapshot come `ARRAY`, ma senza tipo elemento: il tipo preciso va confermato; differisce dallo script versionato che lo dichiarava `jsonb`.
- `movies.id` è testo ed è la sola tabella cui `swipes.movie_id` è vincolato. `custom_movies` è una seconda anagrafica con `id uuid`: non ha FK su `created_by` e non è collegata a `movies`.
- `reviews.movie_id` non ha FK verso `movies`; `reviews.user_id` può essere null e `username` è una copia denormalizzata. Non esiste un vincolo unico per una recensione per utente-film.
- `review_likes.review_id` e `user_id` sono nullable e non esiste unicità su `(review_id, user_id)`; `likes_count` in `reviews` può quindi divergere dal dettaglio dei like.
- `matches` ha FK solo su `user_id`; `movie_id` e `room_id` non sono vincolati e non esiste unicità utente-film.
- Non esistono nello snapshot tabelle di amicizia, watchlist, film visti o preferiti. `room_members.user_id bigint` non è compatibile con `users.id uuid` e non ha FK utente; `room_presence` permette una sola presenza per utente, anche se contiene `room_id`.

## Recensioni, voto, preferiti, viste e watchlist

### Situazione rilevata

Le tabelle `reviews` e `review_likes` esistono, ma non sono integrate dal codice. Il profilo oggi salva generi preferiti, non film preferiti. Il catalogo presenta tre rappresentazioni non collegate: `movies.id` testuale, `custom_movies.id` UUID e `tmdb_id` nell'oggetto remoto in memoria. `reviews.movie_id` non è vincolato, quindi oggi può contenere valori non validi o riferirsi a convenzioni diverse. Perciò non è sicuro aggiungere nuove FK o dati personali senza prima scegliere come rappresentare tutti i film.

### Modello consigliato

1. Rendere ogni film referenziabile con un solo identificatore interno persistente. La soluzione preferibile è una tabella/catalogo film canonico con identificatore interno e coppia `provider` + `provider_movie_id` (per esempio `tmdb` + id TMDB), unica per provider. I film locali devono entrare nello stesso catalogo o essere esplicitamente mappati ad esso. Solo dopo, tutti i dati personali usano `movie_id` FK al catalogo canonico. Se il prodotto non vuole persistere il catalogo TMDB, l'alternativa è una coppia `movie_provider`/`external_movie_id` in ogni riga personale con vincolo univoco; perde però l'integrità referenziale verso i metadati del film.
2. Usare una sola riga di stato per coppia utente-film, ad esempio `user_movie_entries`. Deve contenere almeno: `user_id`, `movie_id`, `rating` nullable, `review_text` nullable, `review_updated_at`, `is_favorite`, `in_watchlist`, `watched_on` nullable, `created_at`, `updated_at`. Il vincolo unico su `(user_id, movie_id)` è la protezione primaria contro doppie recensioni, preferiti duplicati e film ripetuti nelle liste.
3. Interpretare le liste come viste dello stesso record, non come tabelle indipendenti: watchlist = `in_watchlist = true`; visti = `watched_on is not null`; preferiti = `is_favorite = true`; votati = `rating is not null`. Questo consente voto, recensione e visto nello stesso aggiornamento atomico. Decidere formalmente se segnare visto rimuove automaticamente dalla watchlist; la raccomandazione è rimuoverlo, salvo un esplicito requisito di mantenerlo.
4. Consentire una sola recensione personale modificabile per film. Se in futuro serviranno più visioni, aggiungere una tabella separata `user_movie_watch_events` con data e note per singola visione, mantenendo il riepilogo in `user_movie_entries`; non simulare cronologia duplicando recensioni.

Controlli consigliati: voto entro scala di prodotto dichiarata (ad esempio 0,5–5) e coerente con il componente UI; data di visione non futura; testo con limiti di lunghezza; aggiornamenti con timestamp server; FK non eliminabile o cancellazione gestita; esclusione degli ospiti. La funzione di like a una recensione, se rimane nel prodotto, va in una tabella separata con unico `(review_id, user_id)`, non in un contatore fidato dal client. Il contatore deve essere derivato o mantenuto transazionalmente lato database.

Privacy: voto, testo della recensione, preferito, watchlist e data di visione sono dati personali di utilizzo. Impostazione predefinita consigliata: privati. La visibilità agli amici deve essere distinta almeno per watchlist, voti/preferiti e testo recensioni; la data di visione dovrebbe restare privata salvo consenso separato. Non esporre l'email di `users` nelle query sociali.

### Task futuri — dati personali e recensioni

- [ ] **R1 — Audit di sicurezza e integrità.** Esportare RLS, indici, trigger e migrazioni; verificare dati orfani/nulli e decidere la bonifica di `reviews`, `review_likes`, `matches`, `custom_movies`, `room_members` e `room_presence` prima di introdurre nuovi vincoli.
- [ ] **R2 — Definire l'identità canonica del film.** Decidere migrazione/catalogo TMDB-locale e imporre l'unicità dell'identificatore esterno.
- [ ] **R3 — Progettare e migrare `user_movie_entries`.** Creare vincoli, check e indice unico; pianificare l'eventuale migrazione di recensioni/match esistenti senza perdita.
- [ ] **R4 — Applicare autorizzazione e privacy.** RLS con `auth.uid()` per proprietario e query friend-only limitate ai campi consentiti; evitare service role nelle azioni utente.
- [ ] **R5 — Implementare UI/API atomiche.** Upsert della singola riga utente-film, viste di liste, validazione server-side e gestione offline/errore.
- [ ] **R6 — Test.** Coprire doppio click, concorrenza, cancellazione/modifica, film TMDB/locali, ospite e privacy tra utenti.

## Social: richieste di amicizia e condivisione

Non risultano nello schema né nel codice tabelle, API o UI per amicizie. La presenza in una stanza non è un rapporto sociale persistente e non deve concedere accesso ai dati personali; inoltre l'attuale `room_presence` non è idonea a diventarlo, dato che ammette una sola riga per utente.

### Modello consigliato

Usare una sola relazione per coppia di utenti, non due righe speculari. Per impedire richieste incrociate/duplicate, memorizzare una coppia canonica (`user_low_id`, `user_high_id`) con vincolo `user_low_id < user_high_id` e `unique(user_low_id, user_high_id)`. Conservare separatamente `requested_by`, `status` (`pending`, `accepted`, `declined`), `created_at`, `responded_at`, `updated_at`. Il richiedente deve appartenere alla coppia; nessuna auto-relazione è ammessa. Se servirà il blocco, modellarlo separatamente e farlo prevalere su qualunque stato amicizia.

Transizioni ammesse: assente → pending (invio); pending → accepted (solo destinatario); pending → declined (solo destinatario); accepted → assente/rimosso (uno dei due). Una nuova richiesta dopo rifiuto necessita di una scelta di prodotto (cooldown o nuova riga); documentare e implementare una regola unica. Invio, accettazione, rifiuto e rimozione devono essere operazioni transazionali/RPC o API server autenticata: controllano identità, stato precedente e aggiornano una sola riga, così due richieste simultanee non producono duplicati.

Alla relazione `accepted` si collega esclusivamente il diritto di lettura delle condivisioni abilitate dal proprietario. Una tabella/impostazioni privacy per utente dovrebbe includere almeno `share_watchlist_with_friends`, `share_ratings_with_friends`, `share_favorites_with_friends`, `share_reviews_with_friends`; impostazione iniziale `false`. Le query devono calcolare l'amicizia bidirezionale accepted e proiettare soltanto i campi condivisi. Nessuna query deve restituire recensioni, voti o watchlist del non-amico, di una richiesta pending/declined o dopo rimozione. Valutare paginazione e una vista/RPC dedicata, evitando di dare al client accesso diretto generalizzato a tutte le righe personali.

### Task futuri — social

- [ ] **S1 — Confermare requisiti prodotto.** Definire ricerca utenti, ciclo di vita dopo rifiuto/rimozione, blocco e notifiche.
- [ ] **S2 — Migrare relazione canonica.** Tabelle, check, unicità per coppia, indici e operazioni atomiche di stato.
- [ ] **S3 — RLS e API social.** Consentire solo le transizioni dell'attore corretto e letture limitate a sé/amici accettati.
- [ ] **S4 — Collegare privacy e dati personali.** Implementare preferenze e endpoint/vista di condivisione che rispettino ogni flag.
- [ ] **S5 — UI e test.** Stati pending in entrata/uscita, azioni idempotenti, race condition, rimozione immediata dell'accesso e test anti-enumerazione utenti.

## Login con Google

### Flusso attuale e problemi verificabili

Da `pages/auth.tsx`, il bottone invoca `signInWithOAuth({ provider: 'google', redirectTo: <origin>/auth/callback })`. La pagina `pages/auth/callback.tsx` interpreta nello stesso client browser tre varianti: `code`/`exchangeCodeForSession`, token nel fragment/`setSession` e OTP/`verifyOtp`. Poi cerca il profilo prima per `users.id` e, in assenza username, per `users.email`, decidendo se mandare a `/home` o `/username`.

Questo flusso presenta rischi concreti: callback e username sono esclusi dal middleware proprio per una gara sui cookie; lo scambio di codice avviene nel browser mentre il middleware gestisce le sessioni tramite cookie; vengono supportati più flussi contemporaneamente senza una fonte unica; il ramo che dice di tollerare `AuthPKCECodeVerifierMissingError` lo rilancia subito dopo; e il fallback del profilo per email può collegare la UI a un profilo con `id` diverso dall'utente autenticato. Non sono presenti la configurazione Google/Supabase, log o un caso riproducibile, quindi non si può attribuire l'errore ricorrente a un singolo parametro mancante.

### Flusso consigliato

Usare un solo flusso Authorization Code con PKCE e una callback server-side che riceve solo `code`, esegue una sola volta l'exchange, salva/rinnova la sessione nei cookie e redirige. La documentazione Supabase per Google indica esplicitamente lo scambio alla callback per il flusso PKCE e richiede che `redirectTo` sia nella redirect allow list; le identità OAuth sono associate a un singolo utente Auth. [Guida Google Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [identità Auth](https://supabase.com/docs/guides/auth/identities).

Il profilo applicativo deve avere `users.id` FK/uno-a-uno con `auth.users.id` e venire creato automaticamente/idempotentemente al nuovo utente (trigger sicuro o endpoint server) senza cercare per email. L'utente esistente è riconosciuto da `auth.users.id`; lo username mancante porta al solo onboarding username. Email e avatar Google sono metadati di bootstrap, non chiavi di join del profilo.

Per collegare Google a un account esistente con password, offrire un'azione esplicita “Collega Google” solo in sessione autenticata e usare il meccanismo di identity linking supportato da Supabase; non fondere record applicativi lato client in base alla sola email. Supabase espone `linkIdentity()` proprio per associare un'identità OAuth a un utente esistente. [Riferimento `linkIdentity`](https://supabase.com/docs/reference/javascript/auth-linkidentity). Il comportamento di linking automatico e l'email verificata vanno comunque verificati nella configurazione del progetto prima del rilascio.

I token Google non sono necessari per login e non vanno salvati se l'app non chiama API Google. La sessione applicativa è quella Supabase: refresh via client/middleware cookie, scadenza e revoca configurate nel dashboard. Gli errori devono essere classificati (annullamento Google, redirect non autorizzato, exchange/PKCE, provider non configurato, rete) e mostrati senza dettagli sensibili; registrare lato server codice/categoria/correlation id, mai token o segreti.

### Task futuri — Google OAuth

- [ ] **G1 — Audit configurazione.** Verificare Google OAuth client, callback Supabase, Site URL, redirect allow list per locale/staging/produzione, provider abilitato e log Auth.
- [ ] **G2 — Unificare il flusso PKCE.** Sostituire la callback client multi-flusso con callback server-side/cookie coerente con `@supabase/ssr`; rimuovere workaround e rami non necessari.
- [ ] **G3 — Rendere canonico il profilo.** FK/trigger o provisioning idempotente su `auth.users.id`; eliminare il fallback di autorizzazione/identificazione per email.
- [ ] **G4 — Account linking esplicito.** Disegnare UX, conferma e gestione errori per collegare/scollegare Google da sessione esistente; testare account password preesistente e account Google preesistente.
- [ ] **G5 — Sessioni, osservabilità e test E2E.** Testare nuovo Google, Google già collegato, password→link, annullamento, callback duplicata, PKCE/cookie assenti, redirect errato e sign-out/revoca; log sicuri e messaggi localizzati.

## Priorità proposta

1. R1 e G1: schema di base disponibile, ma senza RLS/indici/trigger/configurazione non è possibile fare una migrazione o diagnosticare OAuth con certezza.
2. G2–G3 e R2: stabilizzare identità utente e identità film prima di salvare dati personali.
3. R3–R4 e S1–S4: integrità, autorizzazione e privacy prima della UI.
4. R5–R6, S5 e G4–G5: implementazione, esperienza utente e copertura automatica.
