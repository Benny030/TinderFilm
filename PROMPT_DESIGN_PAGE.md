# Prompt per redesign pagina

## Prompt base

Modifica il design della pagina [nome pagina] in [path file pagina], mantenendo la stessa logica di business, routing, auth e fetch. Separare correttamente stile e logica, rispettando il pattern già usato nel progetto: logica in componente React/TypeScript, styling in file dedicati CSS nella cartella styles/pages.

Obiettivo: rendere la pagina più [descrivere mood: premium / minimal / cinematografico / elegante / moderno / soft luxury], mantenendo la stessa struttura funzionale e il contenuto informativo. Il design deve essere coerente con i token già esistenti in [Client/styles/token.ts](Client/styles/token.ts) e con il sistema di tema dark/light già implementato.

Requisiti:
- non cambiare il comportamento delle funzioni esistenti
- non introdurre nuove librerie esterne
- non toccare auth, routing, fetch API o logica di business
- mantenere responsività mobile/desktop
- usare i colori, spacings e componenti già presenti nel design system del progetto
- separare i CSS in file dedicato nella cartella styles/pages
- mantenere classi e naming coerenti con lo standard del progetto
- preservare accessibilità e leggibilità del testo
- non rompere la compatibilità con il tema chiaro/scuro

### File da consultare
- Pagina: [path pagina]
- Stile attuale: [path CSS]
- Token: [Client/styles/token.ts](Client/styles/token.ts)
- Documentazione organizzazione: [Client/DOCUMENTAZIONE_ORGANIZZAZIONE_STILI.md](Client/DOCUMENTAZIONE_ORGANIZZAZIONE_STILI.md)

### Output richiesto
- Aggiorna solo il design visivo e la struttura presentazionale
- Mantieni la stessa UX funzionale
- Rimuovi eventuali inline style se presenti e spostali in CSS dedicato
- Lascia il codice pulito, leggibile e facile da mantenere
- Se serve, aggiungi variabili CSS o classi riutilizzabili ma senza creare duplicazioni inutili

## Prompt completo pronto da usare

Modifica il design della pagina [nome pagina] in [path file], mantenendo la stessa logica di auth, routing e fetch. La pagina deve restare funzionalmente identica, ma il design deve essere aggiornato in chiave [mood].

Fai in modo che:
- lo stile sia separato dalla logica, come già fatto nel progetto
- i CSS siano messi in un file dedicato dentro styles/pages
- il design sia coerente con i token in [Client/styles/token.ts](Client/styles/token.ts)
- il tema dark/light continui a funzionare correttamente
- il layout resti responsive e pulito su mobile e desktop
- non vengano introdotte nuove dipendenze
- non vengano toccate le parti di business logic, API o navigazione

File da leggere prima di modificare:
- [path pagina]
- [path CSS attuale]
- [Client/styles/token.ts](Client/styles/token.ts)
- [Client/DOCUMENTAZIONE_ORGANIZZAZIONE_STILI.md](Client/DOCUMENTAZIONE_ORGANIZZAZIONE_STILI.md)

Il risultato deve essere un codice pulito, leggibile e facilmente mantenibile per futuri cambi di design.

## Esempio concreto per CineDate

Modifica il design della landing page in [Client/pages/index.tsx](Client/pages/index.tsx), mantenendo la stessa logica di auth, routing e fetch. La pagina deve restare funzionalmente identica, ma deve avere un look più premium, elegante e cinematografico.

Fai in modo che:
- lo stile sia separato dalla logica e spostato in [Client/styles/pages/landing.css](Client/styles/pages/landing.css)
- il design resti coerente con i token in [Client/styles/token.ts](Client/styles/token.ts)
- il tema dark/light continui a funzionare correttamente
- l’UI sia più moderna, con maggiore spazio, più leggibilità e micro-interazioni leggere
- i bottoni e le card mantengano l’estetica del brand
- non si tocchi la logica di autenticazione, redirect e fetch
- il layout rimanga responsivo e pulito su mobile e desktop

Usa lo stesso pattern di organizzazione già applicato al progetto e tieni il codice facile da mantenere per futuri aggiornamenti di design.

## Checklist veloce da usare

Prima di mandare il prompt, controlla:
- [ ] Ho indicato il file esatto della pagina
- [ ] Ho indicato il file CSS dedicato
- [ ] Ho specificato il mood/desiderata visiva
- [ ] Ho detto cosa non deve cambiare
- [ ] Ho indicato i token o lo stile di riferimento
- [ ] Ho chiesto separazione logica/stile
- [ ] Ho richiesto mantenimento di dark/light
- [ ] Ho chiesto responsive e mantenibilità

## Variante breve

Cambia il design della pagina [path] senza toccare la logica. Mantieni comportamento, routing e auth invariati. Usa i token del progetto, separa stile e logica, applica un look [mood], responsive, coerente con dark/light, e lascia il codice pulito e facilmente modificabile.
