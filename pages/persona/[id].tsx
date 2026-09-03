"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useTheme } from '@/context/ThemeContext';
import {
  ArrowLeft,
  FilmSlate,
  Star,
  User,
  VideoCamera,
  MaskHappy,
  PenNib,
  CalendarBlank,
  MapPin,
  ShareNetwork,
} from '@phosphor-icons/react';

const D = {
  bg:'#0a0806', bgSoft:'#14100e', card:'#1c1613', cardHover:'#241d19',
  border:'#2d221c', gold:'#f5b92f', pink:'#ed3d73',
  text:'#f0ebe6', textMuted:'#b5a89e', textFaint:'#7a6b60',
};
const L = {
  bg:'#f5efe8', bgSoft:'#ece3d9', card:'#ffffff', cardHover:'#faf5ef',
  border:'#d6cbbc', gold:'#b8860b', pink:'#b83060',
  text:'#1f1a16', textMuted:'#5c5248', textFaint:'#8a7c6e',
};
const FONT="'Inter','Helvetica Neue',sans-serif";
const DISPLAY="'Playfair Display','Georgia',serif";

type CreditRole='acting'|'directing'|'writing'|'other';
type Credit={
  tmdb_id:number;
  title:string;
  year:number|null;
  cover:string|null;
  rating:number;
  vote_count:number;
  role:CreditRole;
  job:string|null;
  character:string|null;
  popularity:number;
};
type PersonDetail={
  tmdb_id:number;
  name:string;
  biography:string;
  birthday:string|null;
  deathday:string|null;
  place_of_birth:string|null;
  known_for_department:string;
  profile:string|null;
  also_known_as:string[];
  credits:Credit[];
};

type Filter='all'|'acting'|'directing'|'writing';

export default function PersonaPage(){
  const router=useRouter();
  const {theme}=useTheme();
  const P=theme==='dark'?D:L;

  const personId=typeof router.query.id==='string'?router.query.id:null;
  const [person,setPerson]=useState<PersonDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [showFullBio,setShowFullBio]=useState(false);
  const [filmQuery,setFilmQuery]=useState('');
  const [sortBy,setSortBy]=useState<'popular'|'recent'|'rating'>('popular');

  useEffect(()=>{
    if(!router.isReady||!personId)return;
    let cancelled=false;
    const load=async()=>{
      setLoading(true);setError('');
      try{
        const res=await fetch(`/api/tmdb/person/${encodeURIComponent(personId)}`,{cache:'no-store'});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw new Error(data.error||'Persona non trovata');
        if(!cancelled)setPerson(data);
      }catch(e:any){
        if(!cancelled){setPerson(null);setError(e?.message||'Impossibile caricare la persona');}
      }finally{
        if(!cancelled)setLoading(false);
      }
    };
    void load();
    return()=>{cancelled=true;};
  },[router.isReady,personId]);

  const credits=useMemo(()=>{
    if(!person)return[];

    let rows=filter==='all'
      ? [...person.credits]
      : person.credits.filter(c=>c.role===filter);

    const q=filmQuery.trim().toLowerCase();
    if(q){
      rows=rows.filter(c=>
        c.title.toLowerCase().includes(q) ||
        String(c.character||'').toLowerCase().includes(q) ||
        String(c.job||'').toLowerCase().includes(q)
      );
    }

    rows.sort((a,b)=>{
      if(sortBy==='recent') return (b.year||0)-(a.year||0);
      if(sortBy==='rating') return (b.rating||0)-(a.rating||0);
      return (b.popularity||0)-(a.popularity||0);
    });

    return rows;
  },[person,filter,filmQuery,sortBy]);

  const counts=useMemo(()=>{
    if(!person)return {acting:0,directing:0,writing:0};
    return {
      acting:person.credits.filter(c=>c.role==='acting').length,
      directing:person.credits.filter(c=>c.role==='directing').length,
      writing:person.credits.filter(c=>c.role==='writing').length,
    };
  },[person]);

  const roleLabel=(department:string)=>{
    if(department==='Acting')return 'Attore / Attrice';
    if(department==='Directing')return 'Regia';
    if(department==='Writing')return 'Sceneggiatura';
    if(department==='Production')return 'Produzione';
    return department||'Cinema';
  };

  const sharePerson = async () => {
    if (!person) return;

    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/persona/${person.tmdb_id}`
      : '';

    try {
      if (navigator.share) {
        await navigator.share({
          title: person.name,
          text: `Scopri ${person.name} su CineDate`,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      window.alert('Link copiato');
    } catch {
      // condivisione annullata
    }
  };

  if(loading){
    return <AppShell activeNav="home"><main style={{minHeight:'100vh',background:P.bg,color:P.textMuted,display:'grid',placeItems:'center',fontFamily:FONT}}><FilmSlate size={38} color={P.pink} weight="duotone"/></main></AppShell>;
  }

  if(!person){
    return <AppShell activeNav="home"><main style={{minHeight:'100vh',background:P.bg,color:P.text,display:'grid',placeItems:'center',fontFamily:FONT,padding:24}}><div style={{textAlign:'center'}}><User size={42} color={P.textFaint}/><h2 style={{fontFamily:DISPLAY}}>Persona non trovata</h2><p style={{color:P.textMuted}}>{error}</p><button onClick={()=>router.push('/esplora')} style={{border:`1px solid ${P.gold}`,background:'transparent',color:P.gold,padding:'10px 16px',fontWeight:800,cursor:'pointer'}}>Torna a Esplora</button></div></main></AppShell>;
  }

  const bio=person.biography?.trim()||'Biografia non disponibile.';
  const bioLong=bio.length>420;
  const bioShown=!showFullBio&&bioLong?`${bio.slice(0,420).trim()}…`:bio;

  return <AppShell activeNav="home">
    <main className="person-page" style={{background:P.bg,color:P.text}}>
      <style>{`
        .person-page{min-height:100vh;font-family:${FONT};padding:28px 34px 90px}.wrap{max-width:1120px;margin:0 auto}
        .back{border:0;background:transparent;color:${P.textMuted};padding:0;display:flex;align-items:center;gap:6px;font:750 11px ${FONT};cursor:pointer;margin-bottom:22px}
        .hero{display:grid;grid-template-columns:230px minmax(0,1fr);gap:32px;align-items:start}.profile{aspect-ratio:2/3;background:${P.bgSoft};border:1px solid ${P.border};overflow:hidden}.profile img{width:100%;height:100%;object-fit:cover;display:block}
        .kicker{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:${P.pink};margin-bottom:7px}.name{font-family:${DISPLAY};font-size:clamp(36px,5vw,58px);line-height:1;margin:0;font-weight:800;letter-spacing:-.035em}
        .role{margin-top:10px;color:${P.gold};font-size:12px;font-weight:850;display:flex;align-items:center;gap:6px}.facts{display:flex;flex-wrap:wrap;gap:8px;margin-top:17px}.fact{border:1px solid ${P.border};background:${P.card};padding:7px 9px;color:${P.textMuted};font-size:10px;font-weight:700;display:flex;gap:5px;align-items:center}
        .bio-title{font-family:${DISPLAY};font-size:20px;margin:25px 0 8px}.bio{font-size:12.5px;line-height:1.75;color:${P.textMuted};max-width:750px;margin:0;white-space:pre-line}.more{border:0;background:transparent;color:${P.gold};font:800 10px ${FONT};padding:8px 0 0;cursor:pointer}
        .section{margin-top:38px}.section-head{display:flex;justify-content:space-between;gap:15px;align-items:end;border-bottom:1px solid ${P.border};padding-bottom:11px;margin-bottom:14px}.section-title{font-family:${DISPLAY};font-size:24px;font-weight:800}.section-sub{color:${P.textFaint};font-size:10px;margin-top:4px}
        .tabs{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;margin-bottom:12px}.film-tools{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:16px}.film-search,.film-sort{height:38px;border:1px solid ${P.border};background:${P.card};color:${P.text};font:650 10.5px ${FONT};outline:none}.film-search{padding:0 11px}.film-sort{padding:0 9px}.tabs::-webkit-scrollbar{display:none}.tab{border:1px solid ${P.border};background:${P.card};color:${P.textMuted};padding:8px 11px;font:800 10px ${FONT};white-space:nowrap;cursor:pointer;display:flex;align-items:center;gap:5px}.tab.active{border-color:${P.gold};color:${P.gold};background:${P.bgSoft}}
        .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:18px 13px}.movie{border:0;background:transparent;color:${P.text};padding:0;text-align:left;cursor:pointer;min-width:0;font-family:${FONT}}.poster{position:relative;aspect-ratio:2/3;background:${P.bgSoft};border:1px solid ${P.border};overflow:hidden;transition:.2s}.movie:hover .poster{transform:translateY(-3px);border-color:${P.gold}80}.poster img{width:100%;height:100%;object-fit:cover}.rating{position:absolute;right:7px;bottom:7px;background:rgba(8,7,6,.86);color:#fff;padding:4px 6px;font-size:9px;font-weight:850;display:flex;gap:3px;align-items:center}.movie-title{font-size:11.5px;font-weight:850;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{font-size:9.5px;color:${P.textFaint};margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.credit{font-size:9px;color:${P.pink};margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:750}
        .empty{border:1px dashed ${P.border};background:${P.bgSoft};padding:34px;text-align:center;color:${P.textMuted};font-size:12px}
        @media(max-width:900px){.grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
        @media(max-width:760px){.person-page{padding:20px 20px 95px}.hero{grid-template-columns:112px minmax(0,1fr);gap:16px}.name{font-size:34px}.role{font-size:11px}.facts{margin-top:12px}.bio-title{margin-top:20px}.hero-copy{min-width:0}.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:15px 9px}.section{margin-top:30px}}
        @media(max-width:390px){.hero{grid-template-columns:96px minmax(0,1fr)}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>

      <div className="wrap">
        <button className="back" onClick={()=>router.back()}><ArrowLeft size={14}/> Indietro</button>

        <section className="hero">
          <div className="profile">
            {person.profile?<img src={person.profile} alt={person.name}/>:<div style={{height:'100%',display:'grid',placeItems:'center',color:P.textFaint}}><User size={48}/></div>}
          </div>

          <div className="hero-copy">
            <div className="kicker">Persona</div>
            <h1 className="name">{person.name}</h1>
            <div className="role">
              {person.known_for_department==='Directing'?<VideoCamera size={15} weight="fill"/>:person.known_for_department==='Acting'?<MaskHappy size={15} weight="fill"/>:<PenNib size={15}/>}
              {roleLabel(person.known_for_department)}
            </div>

            <button
              type="button"
              onClick={() => void sharePerson()}
              style={{
                marginTop:12,
                border:`1px solid ${P.border}`,
                background:P.card,
                color:P.textMuted,
                padding:'7px 10px',
                display:'inline-flex',
                alignItems:'center',
                gap:6,
                fontFamily:FONT,
                fontSize:10,
                fontWeight:800,
                cursor:'pointer',
              }}
            >
              <ShareNetwork size={14}/>
              Condividi profilo
            </button>

            <div className="facts">
              {person.birthday&&<span className="fact"><CalendarBlank size={12}/>{new Date(person.birthday+'T00:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}</span>}
              {person.deathday&&<span className="fact">† {new Date(person.deathday+'T00:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}</span>}
              {person.place_of_birth&&<span className="fact"><MapPin size={12}/>{person.place_of_birth}</span>}
            </div>

            {person.also_known_as.length>0&&(
              <div style={{marginTop:12,color:P.textFaint,fontSize:10.5,lineHeight:1.5}}>
                <strong style={{color:P.textMuted}}>Conosciuto anche come:</strong>{' '}
                {person.also_known_as.slice(0,4).join(', ')}
              </div>
            )}

            <h2 className="bio-title">Biografia</h2>
            <p className="bio">{bioShown}</p>
            {bioLong&&<button className="more" onClick={()=>setShowFullBio(v=>!v)}>{showFullBio?'Mostra meno':'Leggi tutto'}</button>}
          </div>
        </section>

        <div style={{
          display:'flex',
          gap:7,
          overflowX:'auto',
          marginTop:18,
          paddingBottom:3,
        }}>
          {[
            ['career','Carriera'],
            ['known-for','Conosciuto per'],
            ['filmography','Filmografia'],
          ].map(([id,label])=>(
            <button
              key={id}
              type="button"
              onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}
              style={{
                border:`1px solid ${P.border}`,
                background:P.card,
                color:P.textMuted,
                padding:'7px 10px',
                whiteSpace:'nowrap',
                font:`800 10px ${FONT}`,
                cursor:'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {person.credits.length>0&&(
          <section id="career" className="section">
            <div className="section-head">
              <div>
                <div className="section-title">Carriera in breve</div>
                <div className="section-sub">Un colpo d'occhio ai ruoli principali nel cinema</div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8}}>
              {[
                ['Recitazione', counts.acting],
                ['Regia', counts.directing],
                ['Sceneggiatura', counts.writing],
                ['Totale titoli', person.credits.length],
              ].filter(([,count])=>Number(count)>0).map(([label,count])=>(
                <div key={String(label)} style={{border:`1px solid ${P.border}`,background:P.card,padding:12}}>
                  <div style={{fontSize:9,color:P.textFaint,fontWeight:850,textTransform:'uppercase',letterSpacing:'.08em'}}>
                    {label}
                  </div>
                  <div style={{fontSize:22,color:P.text,fontWeight:900,marginTop:3}}>
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {person.credits.length>0&&(
          <section id="known-for" className="section">
            <div className="section-head">
              <div>
                <div className="section-title">Conosciuto per</div>
                <div className="section-sub">I titoli più rappresentativi della sua carriera</div>
              </div>
            </div>

            <div className="grid">
              {[...person.credits]
                .sort((a,b)=>{
                  const scoreA=(a.popularity||0)+(a.vote_count||0)/500;
                  const scoreB=(b.popularity||0)+(b.vote_count||0)/500;
                  return scoreB-scoreA;
                })
                .slice(0,6)
                .map(movie=>(
                  <button key={`known-${movie.tmdb_id}-${movie.role}`} className="movie" onClick={()=>router.push(`/film/${movie.tmdb_id}`)}>
                    <div className="poster">
                      {movie.cover?<img src={movie.cover} alt={movie.title} loading="lazy"/>:<div style={{height:'100%',display:'grid',placeItems:'center',color:P.textFaint}}><FilmSlate size={28}/></div>}
                      {movie.rating>0&&<div className="rating"><Star size={9} weight="fill" color={P.gold}/>{movie.rating.toFixed(1)}</div>}
                    </div>
                    <div className="movie-title">{movie.title}</div>
                    <div className="meta">{movie.year||'Anno n/d'}</div>
                  </button>
                ))}
            </div>
          </section>
        )}

        <section id="filmography" className="section">
          <div className="section-head">
            <div><div className="section-title">Filmografia</div><div className="section-sub">Film collegati al catalogo TMDB · clicca un titolo per aprire la scheda</div></div>
            <div style={{fontSize:10,color:P.textFaint,fontWeight:700}}>{credits.length} titoli</div>
          </div>

          <div className="tabs">
            <button className={`tab${filter==='all'?' active':''}`} onClick={()=>setFilter('all')}><FilmSlate size={12}/> Tutti</button>
            {counts.acting>0&&<button className={`tab${filter==='acting'?' active':''}`} onClick={()=>setFilter('acting')}><MaskHappy size={12}/> Recitazione · {counts.acting}</button>}
            {counts.directing>0&&<button className={`tab${filter==='directing'?' active':''}`} onClick={()=>setFilter('directing')}><VideoCamera size={12}/> Regia · {counts.directing}</button>}
            {counts.writing>0&&<button className={`tab${filter==='writing'?' active':''}`} onClick={()=>setFilter('writing')}><PenNib size={12}/> Sceneggiatura · {counts.writing}</button>}
          </div>

          <div className="film-tools">
            <input
              className="film-search"
              value={filmQuery}
              onChange={e=>setFilmQuery(e.target.value)}
              placeholder="Cerca nella filmografia..."
            />
            <select
              className="film-sort"
              value={sortBy}
              onChange={e=>setSortBy(e.target.value as 'popular'|'recent'|'rating')}
            >
              <option value="popular">Più noti</option>
              <option value="recent">Più recenti</option>
              <option value="rating">Voto più alto</option>
            </select>
          </div>

          {credits.length===0?<div className="empty">Non ci sono film disponibili per questo filtro.</div>:<div className="grid">
            {credits.map(movie=><button key={`${movie.tmdb_id}-${movie.role}-${movie.job||movie.character||''}`} className="movie" onClick={()=>router.push(`/film/${movie.tmdb_id}`)}>
              <div className="poster">
                {movie.cover?<img src={movie.cover} alt={movie.title} loading="lazy"/>:<div style={{height:'100%',display:'grid',placeItems:'center',color:P.textFaint}}><FilmSlate size={28}/></div>}
                {movie.rating>0&&<div className="rating"><Star size={9} weight="fill" color={P.gold}/>{movie.rating.toFixed(1)}</div>}
              </div>
              <div className="movie-title">{movie.title}</div>
              <div className="meta">{movie.year||'Anno n/d'}</div>
              <div className="credit">{movie.role==='acting'?(movie.character?`Come ${movie.character}`:'Recitazione'):movie.role==='directing'?(movie.job||'Regia'):movie.role==='writing'?(movie.job||'Sceneggiatura'):(movie.job||'Cinema')}</div>
            </button>)}
          </div>}
        </section>
      </div>

      <div style={{
        position:'fixed',
        left:0,
        right:0,
        bottom:'calc(72px + env(safe-area-inset-bottom))',
        zIndex:60,
        display:'flex',
        justifyContent:'center',
        pointerEvents:'none',
      }}>
        <div style={{
          display:'flex',
          gap:6,
          padding:7,
          background:theme==='dark'?'rgba(10,8,6,.92)':'rgba(255,255,255,.92)',
          border:`1px solid ${P.border}`,
          backdropFilter:'blur(10px)',
          pointerEvents:'auto',
        }}>
          {[
            ['career','Carriera'],
            ['known-for','Top'],
            ['filmography','Filmografia'],
          ].map(([id,label])=>(
            <button
              key={id}
              type="button"
              onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}
              style={{
                border:0,
                background:'transparent',
                color:P.textMuted,
                padding:'7px 9px',
                font:`800 9.5px ${FONT}`,
                cursor:'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </main>
  </AppShell>;
}
