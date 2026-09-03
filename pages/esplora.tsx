"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useTheme } from '@/context/ThemeContext';
import {
  ArrowLeft, FilmSlate, FunnelSimple, MagnifyingGlass,
  Star, X, TrendUp, CalendarBlank, Trophy, Sparkle, User, VideoCamera,
} from '@phosphor-icons/react';

const D = {
  bg: '#0a0806', bgSoft: '#14100e', card: '#1c1613', cardHover: '#241d19',
  border: '#2d221c', gold: '#f5b92f', goldSoft: '#ffd875', pink: '#ed3d73',
  text: '#f0ebe6', textMuted: '#b5a89e', textFaint: '#7a6b60',
};
const L = {
  bg: '#f5efe8', bgSoft: '#ece3d9', card: '#ffffff', cardHover: '#faf5ef',
  border: '#d6cbbc', gold: '#b8860b', goldSoft: '#e8c84a', pink: '#b83060',
  text: '#1f1a16', textMuted: '#5c5248', textFaint: '#8a7c6e',
};
const FONT = "'Inter','Helvetica Neue',sans-serif";
const DISPLAY = "'Playfair Display','Georgia',serif";

type Mode = 'trending' | 'popular' | 'top_rated' | 'now_playing' | 'upcoming';
type SearchKind = 'all' | 'movie' | 'person';
type Movie = {
  tmdb_id: number; title: string; year: number | null; cover: string | null;
  rating: number; vote_count: number; genre?: string; overview?: string | null;
};

type MovieAvailabilityHint = {
  cinema: boolean;
  streaming: boolean;
  digital: boolean;
};
type Person = {
  tmdb_id: number; name: string; photo: string | null;
  known_for_department: string; known_for: Movie[];
};

const tabs: { id: Mode; label: string; icon: any }[] = [
  { id: 'trending', label: 'In tendenza', icon: TrendUp },
  { id: 'popular', label: 'Popolari', icon: Sparkle },
  { id: 'top_rated', label: 'Più votati', icon: Trophy },
  { id: 'now_playing', label: 'Al cinema', icon: CalendarBlank },
  { id: 'upcoming', label: 'Prossimamente', icon: CalendarBlank },
];

export default function EsploraFilmPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;
  const [mode, setMode] = useState<Mode>('trending');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('all');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [availabilityHints, setAvailabilityHints] = useState<Record<number, MovieAvailabilityHint>>({});
  const [availabilityFilter, setAvailabilityFilter] = useState<'all'|'cinema'|'streaming'|'digital'>('all');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [year, setYear] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    const tab = String(router.query.tab ?? 'trending');
    if (['trending','popular','top_rated','now_playing','upcoming'].includes(tab)) setMode(tab as Mode);
    const q = String(router.query.q ?? '').trim();
    if (q) setQuery(q);
  }, [router.isReady, router.query.tab, router.query.q]);

  useEffect(() => {
    if (!router.isReady) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(''); setPage(1);
      try {
        const params = new URLSearchParams({ page: '1', mode, kind });
        if (query.trim()) params.set('q', query.trim());
        const res = await fetch(`/api/tmdb/explore?${params}`, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Impossibile caricare i film');
        setMovies(Array.isArray(data.movies) ? data.movies : []);
        setPeople(Array.isArray(data.people) ? data.people : []);
        setTotalPages(Math.max(1, Number(data.total_pages ?? 1)));
      } catch (e: any) {
        if (e?.name !== 'AbortError') { setMovies([]); setPeople([]); setError(e?.message || 'Qualcosa è andato storto'); }
      } finally { setLoading(false); }
    }, query.trim() ? 320 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [router.isReady, mode, kind, query]);


  useEffect(() => {
    const ids = [...new Set(movies.map((movie) => movie.tmdb_id))]
      .filter((id) => Number.isInteger(id) && id > 0)
      .slice(0, 24);

    if (ids.length === 0) {
      setAvailabilityHints({});
      return;
    }

    let cancelled = false;

    const loadAvailabilityHints = async () => {
      try {
        const response = await fetch(
          `/api/tmdb/availability-batch?ids=${ids.join(',')}`,
          { cache: 'no-store' }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) return;

        if (!cancelled) {
          setAvailabilityHints(data.availability ?? {});
        }
      } catch {
        // Le card restano perfettamente usabili anche senza hint.
      }
    };

    void loadAvailabilityHints();

    return () => {
      cancelled = true;
    };
  }, [movies]);

  const visibleMovies = useMemo(() => movies.filter((m) => {
    if (minRating && Number(m.rating || 0) < minRating) return false;
    if (year && Number(m.year) !== Number(year)) return false;

    const hint = availabilityHints[m.tmdb_id];
    if (availabilityFilter === 'cinema' && !hint?.cinema) return false;
    if (availabilityFilter === 'streaming' && !hint?.streaming) return false;
    if (availabilityFilter === 'digital' && !hint?.digital) return false;

    return true;
  }), [movies, minRating, year, availabilityHints, availabilityFilter]);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    const next = page + 1; setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(next), mode, kind });
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/tmdb/explore?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Errore');
      const incoming: Movie[] = Array.isArray(data.movies) ? data.movies : [];
      const incomingPeople: Person[] = Array.isArray(data.people) ? data.people : [];
      setPeople(old => [...old, ...incomingPeople.filter(p => !old.some(x => x.tmdb_id === p.tmdb_id))]);
      setMovies((old) => [...old, ...incoming.filter((m) => !old.some((x) => x.tmdb_id === m.tmdb_id))]);
      setPage(next); setTotalPages(Math.max(1, Number(data.total_pages ?? totalPages)));
    } catch { setError('Non riesco a caricare altri film.'); }
    finally { setLoadingMore(false); }
  };

  const heading = query.trim()
    ? `Risultati per “${query.trim()}”`
    : kind === 'person'
      ? 'Persone popolari'
      : tabs.find(t => t.id === mode)?.label ?? 'Esplora';

  return (
    <AppShell activeNav="esplora">
      <main className="explore-page" style={{ background: P.bg, color: P.text }}>
        <style>{`
          .explore-page{min-height:100vh;font-family:${FONT};padding:30px 34px 70px}
          .explore-wrap{max-width:1180px;margin:0 auto}
          .explore-kicker{font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:${P.pink};margin-bottom:7px}
          .explore-title{font-family:${DISPLAY};font-size:clamp(34px,5vw,58px);line-height:.98;margin:0;font-weight:800;letter-spacing:-.035em}
          .explore-sub{color:${P.textMuted};font-size:13px;line-height:1.6;margin:12px 0 0;max-width:570px}
          .search-row{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:27px}
          .search-box{height:52px;border:1px solid ${P.border};background:${P.card};display:flex;align-items:center;gap:10px;padding:0 15px;transition:border-color .2s,box-shadow .2s}
          .search-box:focus-within{border-color:${P.gold};box-shadow:0 0 0 3px ${P.gold}18}
          .search-box input{border:0;outline:0;background:transparent;color:${P.text};font:600 14px ${FONT};width:100%;min-width:0}
          .search-box input::placeholder{color:${P.textFaint};font-weight:500}
          .icon-btn{width:52px;height:52px;border:1px solid ${P.border};background:${P.card};color:${P.text};display:grid;place-items:center;cursor:pointer}
          .tabs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:14px 0 0;padding-bottom:3px}.tabs::-webkit-scrollbar{display:none}
          .tab{border:1px solid ${P.border};background:${P.card};color:${P.textMuted};padding:9px 12px;white-space:nowrap;font:750 11px ${FONT};display:flex;gap:6px;align-items:center;cursor:pointer}
          .tab.active{border-color:${P.gold};color:${P.gold};background:${P.bgSoft}}
          .filters{margin-top:10px;border:1px solid ${P.border};background:${P.bgSoft};padding:13px;display:flex;gap:12px;align-items:end;flex-wrap:wrap}
          .filter label{display:block;color:${P.textFaint};font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}
          .filter select{height:36px;border:1px solid ${P.border};background:${P.card};color:${P.text};padding:0 10px;font:600 11px ${FONT};outline:0}
          .results-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin:32px 0 14px;padding-bottom:11px;border-bottom:1px solid ${P.border}}
          .results-title{font-family:${DISPLAY};font-size:22px;font-weight:800}.count{font-size:10px;color:${P.textFaint};font-weight:700}
          .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:18px 13px}
          .movie{border:0;background:transparent;color:${P.text};padding:0;text-align:left;cursor:pointer;min-width:0;font-family:${FONT}}
          .poster{position:relative;aspect-ratio:2/3;background:${P.bgSoft};border:1px solid ${P.border};overflow:hidden;transition:transform .22s,border-color .22s,box-shadow .22s}
          .movie:hover .poster{transform:translateY(-3px);border-color:${P.gold}80;box-shadow:0 10px 28px rgba(0,0,0,.18)}
          .poster img{width:100%;height:100%;object-fit:cover;display:block}
          .rating{position:absolute;right:7px;bottom:7px;background:rgba(8,7,6,.86);color:#fff;padding:4px 6px;font-size:9px;font-weight:850;display:flex;gap:3px;align-items:center;backdrop-filter:blur(5px)}
          .movie-title{font-size:11.5px;font-weight:850;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta{font-size:9.5px;color:${P.textFaint};margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .availability-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.availability-chip{font-size:8.5px;font-weight:850;padding:4px 6px;border:1px solid ${P.border};background:${P.card};white-space:nowrap}.availability-chip.cinema{border-color:${P.gold}90;color:${P.gold};background:${P.gold}10}.availability-chip.streaming{border-color:${P.pink}80;color:${P.pink};background:${P.pink}0d}.availability-chip.digital{color:${P.textMuted}}
          .empty{border:1px dashed ${P.border};background:${P.bgSoft};padding:42px 20px;text-align:center;color:${P.textMuted};font-size:12px;grid-column:1/-1}
          .load{display:block;margin:30px auto 0;border:1px solid ${P.gold};background:transparent;color:${P.gold};padding:11px 22px;font:800 11px ${FONT};cursor:pointer}
          @media(max-width:1000px){.grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
          @media(max-width:760px){.explore-page{padding:22px 20px 88px}.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 9px}.explore-title{font-size:38px}.search-row{margin-top:20px}.results-head{margin-top:25px}}
          @media(max-width:390px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        `}</style>
        <div className="explore-wrap">
          <button onClick={() => router.back()} style={{ border: 0, background: 'transparent', color: P.textMuted, padding: 0, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', font: `700 11px ${FONT}`, marginBottom: 22 }}>
            <ArrowLeft size={14}/> Indietro
          </button>
          <div className="explore-kicker">Catalogo CineDate</div>
          <h1 className="explore-title">Esplora film</h1>
          <p className="explore-sub">Cerca un film, un attore o un regista. Oppure lasciati guidare da tendenze, popolari e titoli al cinema.</p>

          <div className="search-row">
            <div className="search-box"><MagnifyingGlass size={19} color={P.gold}/><input
              autoFocus={false}
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder={
                kind === 'movie'
                  ? 'Cerca un film...'
                  : kind === 'person'
                    ? 'Cerca un attore o regista...'
                    : 'Cerca film, attori o registi...'
              }
            />{query && <button onClick={()=>setQuery('')} aria-label="Pulisci ricerca" style={{border:0,background:'transparent',color:P.textFaint,cursor:'pointer',display:'grid',placeItems:'center'}}><X size={15}/></button>}</div>
            <button className="icon-btn" onClick={()=>setFiltersOpen(v=>!v)} aria-label="Filtri" title="Filtri"><FunnelSimple size={19} weight={filtersOpen?'fill':'regular'} color={filtersOpen?P.gold:P.text}/></button>
          </div>


          <div className="tabs" style={{ marginTop: 10 }}>
            {([['all','Tutto'],['movie','Film'],['person','Attori e registi']] as const).map(([id,label]) => (
              <button key={id} className={`tab${kind===id?' active':''}`} onClick={() => setKind(id)}>
                {id === 'movie' ? <FilmSlate size={13}/> : <User size={13}/>} {label}
              </button>
            ))}
          </div>

          {query.trim() && kind==='person' && (
            <div style={{marginTop:10,color:P.textFaint,fontSize:10.5}}>
              Stai cercando solo attori e registi.
            </div>
          )}

          {!query.trim() && <div className="tabs">{tabs.map(t=>{const Icon=t.icon;return <button key={t.id} className={`tab${mode===t.id&&!query.trim()?' active':''}`} onClick={()=>{setQuery('');setMode(t.id);void router.replace({pathname:'/esplora',query:{tab:t.id}},undefined,{shallow:true});}}><Icon size={13} weight={mode===t.id&&!query.trim()?'fill':'regular'}/>{t.label}</button>})}</div>}

          {kind!=='person' && (
            <div style={{display:'flex',gap:7,overflowX:'auto',marginTop:10,paddingBottom:2}}>
              <button onClick={()=>{setMinRating(7);setYear('')}} style={{border:`1px solid ${minRating===7&&!year?P.gold:P.border}`,background:P.card,color:minRating===7&&!year?P.gold:P.textMuted,padding:'7px 9px',font:`800 9.5px ${FONT}`,cursor:'pointer',whiteSpace:'nowrap'}}>Voto 7+</button>
              <button onClick={()=>{setMinRating(8);setYear('')}} style={{border:`1px solid ${minRating===8&&!year?P.gold:P.border}`,background:P.card,color:minRating===8&&!year?P.gold:P.textMuted,padding:'7px 9px',font:`800 9.5px ${FONT}`,cursor:'pointer',whiteSpace:'nowrap'}}>Voto 8+</button>
              <button onClick={()=>{setMinRating(0);setYear(String(new Date().getFullYear()))}} style={{border:`1px solid ${year===String(new Date().getFullYear())?P.gold:P.border}`,background:P.card,color:year===String(new Date().getFullYear())?P.gold:P.textMuted,padding:'7px 9px',font:`800 9.5px ${FONT}`,cursor:'pointer',whiteSpace:'nowrap'}}>Quest'anno</button>
              {(minRating>0||year)&&<button onClick={()=>{setMinRating(0);setYear('')}} style={{border:`1px solid ${P.border}`,background:'transparent',color:P.pink,padding:'7px 9px',font:`800 9.5px ${FONT}`,cursor:'pointer',whiteSpace:'nowrap'}}>Reset</button>}
            </div>
          )}

          {filtersOpen && <div className="filters"><div className="filter"><label>Voto minimo</label><select value={minRating} onChange={e=>setMinRating(Number(e.target.value))}><option value={0}>Qualsiasi</option><option value={6}>6+</option><option value={7}>7+</option><option value={8}>8+</option></select></div><div className="filter"><label>Anno</label><select value={year} onChange={e=>setYear(e.target.value)}><option value="">Tutti</option>{Array.from({length:40},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}</select></div>{(minRating>0||year)&&<button onClick={()=>{setMinRating(0);setYear('')}} style={{height:36,border:0,background:'transparent',color:P.pink,font:`800 10px ${FONT}`,cursor:'pointer'}}>Azzera filtri</button>}</div>}

          {kind !== 'person' && (
          <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:3,marginTop:14}}>
            {([
              ['all','Tutti'],
              ['cinema','Al cinema'],
              ['streaming','Streaming'],
              ['digital','Digitale'],
            ] as const).map(([id,label])=>(
              <button
                key={id}
                type="button"
                onClick={()=>setAvailabilityFilter(id)}
                style={{
                  border:`1px solid ${availabilityFilter===id ? P.gold : P.border}`,
                  background:availabilityFilter===id ? `${P.gold}12` : P.card,
                  color:availabilityFilter===id ? P.gold : P.textMuted,
                  padding:'8px 10px',
                  whiteSpace:'nowrap',
                  font:`800 10px ${FONT}`,
                  cursor:'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          )}

          <div style={{
          color:P.textFaint,
          fontSize:9,
          fontWeight:900,
          textTransform:'uppercase',
          letterSpacing:'.12em',
          marginTop:24,
          marginBottom:-20,
        }}>
          {query.trim()
            ? 'Risultati di ricerca'
            : kind === 'person'
              ? 'Attori e registi'
              : 'Scopri'}
        </div>

        <div className="results-head"><div className="results-title">{heading}</div><div className="count">{loading?'Caricamento…':`${visibleMovies.length + people.length} risultati mostrati`}</div></div>


          {!loading && people.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <div className="results-title" style={{ marginBottom: 10 }}>
                {query.trim() ? 'Persone' : 'Attori e registi popolari'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
                {people.map(person => (
                  <button key={person.tmdb_id} onClick={() => router.push(`/persona/${person.tmdb_id}`)} style={{border:`1px solid ${P.border}`,background:P.card,color:P.text,padding:12,display:'flex',gap:11,alignItems:'center',textAlign:'left',cursor:'pointer',fontFamily:FONT,minWidth:0}}>
                    <div style={{width:54,height:54,borderRadius:'50%',overflow:'hidden',background:P.bgSoft,display:'grid',placeItems:'center',flexShrink:0}}>{person.photo?<img src={person.photo} alt={person.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<User size={23} color={P.textFaint}/>}</div>
                    <div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:900}}>{person.name}</div><div style={{fontSize:10,color:P.pink,fontWeight:800,marginTop:3}}>{person.known_for_department==='Directing'?'Regia':person.known_for_department==='Acting'?'Recitazione':person.known_for_department||'Cinema'}</div>{person.known_for.length>0&&<div style={{fontSize:9.5,color:P.textFaint,marginTop:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Conosciuto per: {person.known_for.slice(0,3).map(m=>m.title).join(', ')}</div>}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid">
            {loading ? Array.from({length:12},(_,i)=><div key={i}><div className="poster" style={{opacity:.45}}/><div style={{height:10,background:P.bgSoft,marginTop:8,width:'75%'}}/></div>) : error ? <div className="empty">{error}</div> : visibleMovies.length===0 ? <div className="empty"><FilmSlate size={28} weight="duotone" color={P.gold}/><div style={{marginTop:9,fontWeight:800,color:P.text}}>Nessun film trovato</div><div style={{marginTop:4}}>Prova un altro titolo o modifica i filtri.</div></div> : visibleMovies.map(movie=>{
              const availability = availabilityHints[movie.tmdb_id];
              return <button key={movie.tmdb_id} className="movie" onClick={()=>router.push(`/film/${movie.tmdb_id}`)}>
                <div className="poster">
                  {movie.cover?<img src={movie.cover} alt={movie.title} loading="lazy"/>:<div style={{height:'100%',display:'grid',placeItems:'center',color:P.textFaint}}><FilmSlate size={28}/></div>}
                  <div className="rating"><Star size={9} weight="fill" color={P.gold}/>{Number(movie.rating||0).toFixed(1)}</div>
                </div>
                <div className="movie-title">{movie.title}</div>
                <div className="meta">{movie.year || 'Anno n/d'}{movie.genre?` · ${movie.genre}`:''}</div>
                {availability && (availability.cinema || availability.streaming || availability.digital) && (
                  <div className="availability-row">
                    {availability.cinema && <span className="availability-chip cinema">Al cinema</span>}
                    {availability.streaming && <span className="availability-chip streaming">Streaming</span>}
                    {!availability.streaming && availability.digital && <span className="availability-chip digital">Noleggio / acquisto</span>}
                  </div>
                )}
              </button>
            })}
          </div>
          {!loading && !error && page < totalPages && <button className="load" onClick={loadMore} disabled={loadingMore}>{loadingMore?'Caricamento…':'Carica altri film'}</button>}
        </div>
      </main>
    </AppShell>
  );
}
