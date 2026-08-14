# Organizzazione stili e struttura UI del progetto

> **Stato verificato — 15 agosto 2026.** I CSS globali sono caricati da `pages/_app.tsx`: `styles/globals.css`, `styles/pages/landing.css`, `styles/pages/home.css` e `styles/pages/auth.css`. Le schermate swipe/match usano ancora gli oggetti TypeScript in `styles/appStyles.ts`; `styles/home.styles.ts` non risulta importato. La build di produzione passa con `npm.cmd run build`. L'unico avviso è la deprecazione Next.js di `middleware.ts` a favore di `proxy.ts`.

> Le sezioni seguenti descrivono la direzione di refactor desiderata. Non rappresentano ancora integralmente il codice corrente: landing e home contengono palette e stili inline locali, oltre ai token in `styles/token.ts`.

## Obiettivo

Separare in modo chiaro:

- logica di pagina
- rendering JSX
- design tokens
- fogli di stile per sezione/pagina
- componenti riutilizzabili

Questo rende più semplice mantenere il layout, aggiornare i temi e introdurre modifiche di design senza dover toccare codice di business o routing.

## Regola base

Un file di pagina deve contenere solo:

- state locale
- fetch / API calls
- auth checks
- routing
- JSX per la struttura della schermata

Un file di stile deve contenere solo:

- layout
- spacing
- palette
- responsività
- animazioni
- hover / focus / transitions

I token di design devono essere centralizzati e condivisi.

---

## Struttura consigliata

```text
Client/
  styles/
    token.ts              # colori, spacing, radius, shadows, typography
    globals.css           # reset, font base, utility globali
    pages/
      landing.css         # stile della landing page
      home.css            # stile della home page
      auth.css            # stile di auth / login
      profile.css         # stile del profilo
  components/
    layout/
    cinema/
    screens/
  pages/
    index.tsx              # logica + JSX della landing page
    home.tsx               # logica + JSX della home
    auth.tsx               # logica + JSX del login
    profilo.tsx            # logica + JSX del profilo
```

---

## Design tokens

Il file [Client/styles/token.ts](Client/styles/token.ts) è la sorgente unica per:

- colori primari / secondari
- sfondi chiari e scuri
- spacing
- radius
- shadows
- font families
- dimensioni testuali

Se un colore o uno spacing va aggiornato, va modificato lì, non dentro ogni pagina.

---

## Regola di refactor da seguire per tutte le schermate

### 1. Rimuovere palette inline dai componenti

Non definire più costanti come:

- D = { ... }
- L = { ... }
- FONT = ...
- FONT_DISPLAY = ...

all’interno delle pagine, se sono usate per lo stile globale della schermata.

Le palette vanno in token o in una sezione dedicata del CSS.

### 2. Estrarre lo stile dal JSX

Tutto ciò che è scritto in blocchi come:

```tsx
<style>{` ...css... `}</style>
```

dovrebbe essere spostato in un file CSS dedicato, mantenendo lo stesso naming delle classi.

### 3. Lasciare la logica nel componente

Nel component rimane solo:

- useEffect
- fetch
- routing
- toggle theme
- observer / animazioni state-based
- JSX

### 4. Dare un nome chiaro alle classi

Usare una convenzione semplice e coerente:

- `nav`, `hero`, `trending`, `feature-item`, `how`, `final-cta`
- `ticket-card`, `trend-card`, `room-card`, `section-header`

Questo aiuta a mantenere i CSS leggibili e facilita il cambiamento di ogni blocco.

### 5. Separare stile globale e stile pagina

- CSS globale: reset, tipografia base, utility condivise
- CSS pagina: layout e componenti specifici di una schermata
- componenti riutilizzabili: appena la struttura è stabile, spostare i blocchi comuni in componenti separati

---

## Pattern consigliato per i prossimi file

Per ogni nuova pagina fare così:

1. creare la pagina in [Client/pages](Client/pages)
2. creare il file CSS in [Client/styles/pages](Client/styles/pages)
3. importare il CSS nel componente
4. usare i token da [Client/styles/token.ts](Client/styles/token.ts)
5. mantenere le classi complesse ma leggibili
6. lasciare in pagina solo la logica di UI

---

## Esempio di struttura corretta

```tsx
import '@/styles/pages/home.css';

export default function HomePage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) router.replace('/auth');
  }, [currentUser, router]);

  return (
    <div className="home-page">
      <header className="home-header">...</header>
      <main className="home-main">...</main>
    </div>
  );
}
```

```css
.home-page {
  background: var(--color-bg);
  color: var(--color-text);
}

.home-header {
  display: flex;
  justify-content: space-between;
  padding: var(--space-lg);
}
```

---

## Vantaggi

- meno conflitti tra logica e stili
- aggiornamenti di design più sicuri
- facile ricerca e modifica dei blocchi di UI
- meno rischio di regressioni durante refactor
- scalabilità migliore quando il progetto cresce

---

## Regola finale

Quando un nuovo design viene richiesto, si modifica prima il token o lo stile della pagina, non la logica di business. In questo modo il codice resta ordinato e i prossimi aggiornamenti grafici diventano più prevedibili.
