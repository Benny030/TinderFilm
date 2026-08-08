'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { C, FONT, R, S, SHADOW, TEXT } from '@/styles/token';
import { ArrowLeft, CalendarBlank, Clock, FilmSlate, Play, Star, UserCircle } from '@phosphor-icons/react';

type SimilarMovie = { tmdb_id: number; title: string; year: number; cover: string | null; rating: number };
type CastMember = { id: number; name: string; character: string; profile: string | null };
type MovieDetail = {
  tmdb_id: number; title: string; year: number; genre: string; cover: string | null; backdrop: string | null;
  trailer: string | null; trama_c: string | null; rating: number; vote_count: number; runtime: string | null;
  tagline: string | null; director: string | null; cast: CastMember[]; similar: SimilarMovie[];
};

const fallbackPoster = 'https://placehold.co/342x513/F4EEE6/6E6258?text=Film';

export default function FilmDetailPage() {
  const router = useRouter();
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const movieId = typeof router.query.id === 'string' ? router.query.id : null;

  useEffect(() => {
    if (!movieId) return;
    const loadMovie = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/tmdb/movie/${movieId}`);
        if (!response.ok) throw new Error('Film non trovato');
        setMovie(await response.json());
      } catch (error) {
        console.error(error);
        setMovie(null);
      } finally {
        setLoading(false);
      }
    };
    loadMovie();
  }, [movieId]);

  const trailerKey = movie?.trailer ? new URL(movie.trailer).searchParams.get('v') : null;

  return (
    <AppShell activeNav="home">
      <style>{`
        .film-page { padding-bottom: 96px; }
        .film-back { position:absolute; top:18px; left:18px; z-index:3; width:42px; height:42px; border:0; border-radius:50%; background:rgba(31,26,23,.72); color:#fff; display:grid; place-items:center; cursor:pointer; backdrop-filter:blur(8px); }
        .film-hero { height: 390px; position:relative; background:#2B2420 center/cover no-repeat; }
        .film-hero:after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,rgba(17,12,10,.74) 0%,rgba(17,12,10,.26) 60%,rgba(17,12,10,.04) 100%), linear-gradient(0deg,#fff 0%,transparent 42%); }
        .film-heading { position:absolute; z-index:2; left:calc(50% - min(42%, 430px)); bottom:42px; color:#fff; max-width:500px; }
        .film-heading h1 { font-size:clamp(30px,4vw,48px); line-height:1.04; margin:10px 0; letter-spacing:-.035em; }
        .film-content { max-width:1060px; margin:-18px auto 0; position:relative; padding:0 24px; }
        .film-overview { display:grid; grid-template-columns:190px minmax(0,1fr); gap:30px; align-items:start; }
        .film-poster { width:190px; border-radius:${R.lg}; box-shadow:${SHADOW.lg}; background:${C.bgSoft}; }
        .film-facts { display:flex; flex-wrap:wrap; gap:8px 18px; color:${C.muted}; font-size:${TEXT.sm}; }
        .fact { display:flex; align-items:center; gap:5px; }
        .genre-chip { background:${C.primaryLight}; color:${C.primary}; border-radius:${R.full}; padding:5px 10px; font-size:12px; font-weight:700; }
        .section { margin-top:38px; }
        .section h2 { font-size:${TEXT.lg}; margin:0 0 15px; color:${C.ink}; }
        .trailer { width:100%; aspect-ratio:16/9; border:0; border-radius:${R.lg}; box-shadow:${SHADOW.md}; background:#201B18; }
        .cast-row,.similar-row { display:flex; gap:14px; overflow-x:auto; padding:2px 1px 9px; scrollbar-width:none; }
        .cast-card { min-width:106px; max-width:106px; font-size:12px; color:${C.ink}; }
        .cast-photo { width:106px; height:106px; object-fit:cover; border-radius:50%; background:${C.bgSoft}; display:block; margin-bottom:8px; }
        .similar-card { min-width:132px; width:132px; cursor:pointer; border:0; padding:0; background:none; text-align:left; font-family:${FONT.sans}; color:${C.ink}; }
        .similar-card img { width:132px; aspect-ratio:2/3; object-fit:cover; border-radius:${R.md}; box-shadow:${SHADOW.sm}; display:block; transition:transform .18s; }
        .similar-card:hover img { transform:translateY(-4px); }
        .empty-trailer { min-height:190px; border:1.5px dashed ${C.border}; border-radius:${R.lg}; display:grid; place-items:center; color:${C.muted}; text-align:center; background:${C.bgSoft}; }
        .loading { min-height:70vh; display:grid; place-items:center; color:${C.muted}; }
        @media (max-width:700px) { .film-hero {height:330px}.film-heading {left:20px;right:20px;bottom:28px}.film-content{padding:0 16px;margin-top:-8px}.film-overview{grid-template-columns:108px 1fr;gap:18px}.film-poster{width:108px;border-radius:${R.md}}.film-overview-copy{grid-column:1/-1}.section{margin-top:30px} }
      `}</style>

      {loading ? <div className="loading"><FilmSlate size={38} color={C.primary} weight="duotone" /></div> : !movie ? (
        <div className="loading"><div><p>Non siamo riusciti a trovare questo film.</p><button onClick={() => router.push('/home')}>Torna alla home</button></div></div>
      ) : (
        <main className="film-page">
          <section className="film-hero" style={{ backgroundImage: movie.backdrop ? `url(${movie.backdrop})` : undefined }}>
            <button className="film-back" onClick={() => router.back()} aria-label="Torna indietro"><ArrowLeft size={21} /></button>
            <div className="film-heading">
              <span className="genre-chip">{movie.genre || 'Film'}</span>
              <h1>{movie.title}</h1>
              {movie.tagline && <div style={{ fontStyle:'italic', opacity:.9 }}>{movie.tagline}</div>}
            </div>
          </section>
          <div className="film-content">
            <div className="film-overview">
              <img className="film-poster" src={movie.cover || fallbackPoster} alt={`Locandina di ${movie.title}`} />
              <div className="film-overview-copy">
                <div className="film-facts">
                  {movie.year > 0 && <span className="fact"><CalendarBlank size={16} />{movie.year}</span>}
                  {movie.runtime && <span className="fact"><Clock size={16} />{movie.runtime}</span>}
                  {movie.rating > 0 && <span className="fact" style={{ color:'#B7791F', fontWeight:700 }}><Star size={16} weight="fill" />{movie.rating.toFixed(1)} <span style={{ color:C.muted, fontWeight:400 }}>({movie.vote_count.toLocaleString('it-IT')} voti)</span></span>}
                </div>
                {movie.director && <p style={{ color:C.muted, fontSize:TEXT.sm, margin:'15px 0 0' }}>Regia di <strong style={{ color:C.ink }}>{movie.director}</strong></p>}
                <p style={{ color:C.ink, fontSize:TEXT.base, lineHeight:1.7, margin:'16px 0 0' }}>{movie.trama_c || 'La trama non è ancora disponibile.'}</p>
              </div>
            </div>

            <section className="section">
              <h2>Trailer</h2>
              {trailerKey ? <iframe className="trailer" src={`https://www.youtube-nocookie.com/embed/${trailerKey}`} title={`Trailer di ${movie.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="empty-trailer"><div><Play size={32} color={C.primary} weight="fill" /><p>Trailer non disponibile al momento.</p></div></div>}
            </section>

            {movie.cast.length > 0 && <section className="section"><h2>Nel cast</h2><div className="cast-row">{movie.cast.map(person => <div className="cast-card" key={person.id}>{person.profile ? <img className="cast-photo" src={person.profile} alt={person.name} /> : <div className="cast-photo" style={{ display:'grid', placeItems:'center' }}><UserCircle size={50} color={C.faint} /></div>}<strong style={{ display:'block' }}>{person.name}</strong><span style={{ color:C.muted }}>{person.character}</span></div>)}</div></section>}

            {movie.similar.length > 0 && <section className="section"><h2>Film simili</h2><div className="similar-row">{movie.similar.map(item => <button className="similar-card" key={item.tmdb_id} onClick={() => router.push(`/film/${item.tmdb_id}`)}><img src={item.cover || fallbackPoster} alt={`Locandina di ${item.title}`} /><strong style={{ display:'block', marginTop:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</strong><span style={{ color:C.muted, fontSize:12 }}>{item.year || '—'}{item.rating > 0 ? ` · ★ ${item.rating.toFixed(1)}` : ''}</span></button>)}</div></section>}
          </div>
        </main>
      )}
    </AppShell>
  );
}
