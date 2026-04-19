
const SK={movies:'cd7_mv',swipes:'cd7_sw',names:'cd7_nm'};
function dbG(k){
  try{
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : null;
  }catch(e){
    console.error(e);
    return null;
  }
}

function dbS(k,v){
  try{
    localStorage.setItem(k, JSON.stringify(v));
  }catch(e){
    console.error(e);
  }
}
const SEED=[
  {id:'m1',title:'Inception',year:2010,genre:'Sci-Fi',cover:'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',trailer:'https://youtu.be/YoHD9XEInc0'},
  {id:'m2',title:'Interstellar',year:2014,genre:'Sci-Fi',cover:'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',trailer:'https://youtu.be/zSWdZVtXT7E'},
  {id:'m3',title:'Il Padrino',year:1972,genre:'Crime',cover:'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsLeBHka9jeJn.jpg',trailer:'https://youtu.be/sY1S34973zA'},
  {id:'m4',title:'Parasite',year:2019,genre:'Thriller',cover:'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',trailer:'https://youtu.be/5xH0HfJHsaY'},
  {id:'m5',title:'Everything Everywhere All at Once',year:2022,genre:'Commedia',cover:'https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg',trailer:'https://youtu.be/wxN1T1uxQ2g'},
  {id:'m6',title:'The Dark Knight',year:2008,genre:'Action',cover:'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',trailer:'https://youtu.be/EXeTwQWrcwY'},
  {id:'m7',title:'Oppenheimer',year:2023,genre:'Biografico',cover:'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',trailer:'https://youtu.be/uYPbbksJxIg'},
  {id:'m8',title:'La La Land',year:2016,genre:'Musical',cover:'https://image.tmdb.org/t/p/w500/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg',trailer:'https://youtu.be/0pdqf4P9MB8'},
];

const ST={user:null,movies:[],swipes:{},names:{p1:'Partner A',p2:'Partner B'},seenMatches:new Set(),poll:null,editingMovieId:null};

(async()=>{
  const m = dbG(SK.movies);
  const s = dbG(SK.swipes);
  const n = dbG(SK.names);
  ST.movies=m||SEED; ST.swipes=s||{};
  if(n)ST.names=n;
  if(!m)dbS(SK.movies,SEED);
  updNames();
})();

function updNames(){
  document.getElementById('p1n').textContent=ST.names.p1;
  document.getElementById('p2n').textContent=ST.names.p2;
  document.getElementById('s-p1').value=ST.names.p1;
  document.getElementById('s-p2').value=ST.names.p2;
}

function go(sid){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  document.getElementById(sid).classList.add('on');
  if(sid==='s-swipe'){renderSwipe();startPoll()}
  else stopPoll();
  if(sid==='s-matches')renderMatches();
}

function goMatches(){closeMod();go('s-matches')}
function goAdd(){
  document.getElementById('add-bk').onclick=()=>go(ST.user?'s-swipe':'s-landing');
  resetAddForm();
  renderAddTable();
  go('s-add');
}

function openAddModal(){
  if (!ST.editingMovieId){
    resetAddForm();
    document.getElementById('add-popup-subtitle').textContent = 'Inserisci i dettagli del film';
    const btn = document.getElementById('add-save-btn');
    if(btn) btn.textContent = '🎬 Aggiungi Film';
  }
  document.getElementById('add-popup').classList.add('on');
}

function closeAddModal(){
  document.getElementById('add-popup').classList.remove('on');
  ST.editingMovieId = null;
}

function resetAddForm(){
  ST.editingMovieId = null;
  document.getElementById('f-ti').value = '';
  document.getElementById('f-yr').value = '';
  document.getElementById('f-ge').value = '';
  document.getElementById('f-co').value = '';
  document.getElementById('f-tr').value = '';
  document.getElementById('cp').style.display = 'none';
  const btn = document.getElementById('add-save-btn');
  if(btn) btn.textContent = '🎬 Aggiungi Film';
}

function renderAddTable(){
  const tb = document.getElementById('add-table');
  if(!tb) return;
  tb.innerHTML = ST.movies.map(m => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid var(--color-border-tertiary)">${m.title}</td>
      <td style="padding:10px 8px;border-bottom:1px solid var(--color-border-tertiary);text-align:center">
        <button class="mbtn mb-tr" onclick="startEditMovie('${m.id}')" style="margin-right:6px;padding:6px 10px;min-width:36px">✏️</button>
        <button class="mbtn mb-mt" onclick="delMovie('${m.id}')" style="padding:6px 10px;min-width:36px">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function startEditMovie(id){
  const mv = ST.movies.find(m => m.id === id);
  if(!mv) return;
  ST.editingMovieId = id;
  document.getElementById('f-ti').value = mv.title;
  document.getElementById('f-yr').value = mv.year || '';
  document.getElementById('f-ge').value = mv.genre || '';
  document.getElementById('f-co').value = mv.cover || '';
  document.getElementById('f-tr').value = mv.trailer || '';
  document.getElementById('cpimg').src = mv.cover || '';
  document.getElementById('cp').style.display = mv.cover ? '' : 'none';
  const btn = document.getElementById('add-save-btn');
  if(btn) btn.textContent = '💾 Salva modifiche';
  document.getElementById('add-popup-subtitle').textContent = 'Modifica film';
  document.getElementById('add-popup').classList.add('on');
}

async function selectUser(u){
  ST.user=u;
  const fresh = dbG(SK.swipes) || {};
  ST.swipes=fresh;
  ST.seenMatches=new Set(Object.keys(fresh).filter(id=>fresh[id]?.p1&&fresh[id]?.p2));
  document.getElementById('swp-nm').textContent=ST.names[u];
  go('s-swipe');
}

function startPoll(){
  stopPoll();
  ST.poll=setInterval(async()=>{
    const[m,s]=await Promise.all([dbG(SK.movies),dbG(SK.swipes)]);
    if(m)ST.movies=m;
    if(s){
      ST.swipes=s;
      for(const id of Object.keys(s)){
        if(s[id]?.p1&&s[id]?.p2&&!ST.seenMatches.has(id)){
          ST.seenMatches.add(id);
          const mv=ST.movies.find(x=>x.id===id);
          if(mv)showMod(mv);
        }
      }
      renderSwipe();updPill();
    }
  },4000);
}
function stopPoll(){if(ST.poll){clearInterval(ST.poll);ST.poll=null}}

function getRem(){return ST.movies.filter(m=>ST.swipes[m.id]?.[ST.user]===undefined)}
function getMat(){return ST.movies.filter(m=>ST.swipes[m.id]?.p1===true&&ST.swipes[m.id]?.p2===true)}

function updPill(){
  const c=getMat().length,p=document.getElementById('mpill');
  if(c>0){p.textContent='❤ '+c;p.style.display=''}else p.style.display='none';
}

function renderSwipe(){
  const zone=document.getElementById('cstack');
  zone.innerHTML='';
  const rem=getRem();
  updPill();
  const ar=document.getElementById('arow'),pg=document.getElementById('prog');
  if(rem.length===0){
    ar.style.display='none';pg.style.display='none';
    const e=document.createElement('div');
    e.className='empty';
    e.innerHTML='<div class="ei">🍿</div><div class="et">Hai visto tutto!</div><div class="es">Aggiungi altri film o aspetta il tuo partner</div><button class="addbtn" onclick="goAdd()">＋ Aggiungi Film</button>';
    zone.appendChild(e);return;
  }
  ar.style.display='flex';pg.style.display='';
  pg.textContent=rem.length+' film rimanenti';
  if(rem.length>1)zone.appendChild(mkCard(rem[1],false));
  zone.appendChild(mkCard(rem[0],true));
}

function mkCard(mv,isTop){
  const d=document.createElement('div');
  d.className='mvc '+(isTop?'top':'bk');
  const vid=ytId(mv.trailer);
  const src = mv.cover || 'https://placehold.co/300x420/1a1a2e/EF9F27?text=' + encodeURIComponent(mv.title);
  d.innerHTML = `
    <img src="${src}" alt="${mv.title}" draggable="false">
    <div class="cgrad"></div>
    ${isTop ? '<div class="stamp sl">❤ LIKE</div><div class="stamp sp">✕ PASS</div>' : ''}
    ${vid && isTop ? '<button class="pbtn">▶ Trailer</button>' : ''}
    <div class="cinfo"><div class="ct">${mv.title}</div><div class="cm">${mv.year || ''}${mv.genre ? `<span class="cg">${mv.genre}</span>` : ''}</div></div>
  `;
  if(isTop) initDrag(d, mv, vid);
  return d;
}

function initDrag(el,mv,vid){
  let sx=0,sy=0,act=false,dx=0,dy=0,moved=false;
  const THRESH=85;
  const pb=el.querySelector('.pbtn');
  if(pb){
    pb.addEventListener('pointerdown',e=>e.stopPropagation());
    pb.addEventListener('click',e=>{e.stopPropagation();if(!moved)openTr(el,vid)});
  }
  el.addEventListener('pointerdown',e=>{
    if(e.target.closest('.pbtn')||e.target.closest('.trc'))return;
    act=true;moved=false;sx=e.clientX;sy=e.clientY;dx=0;dy=0;
    el.setPointerCapture(e.pointerId);el.style.transition='none';
  });
  el.addEventListener('pointermove',e=>{
    if(!act)return;
    dx=e.clientX-sx;dy=e.clientY-sy;
    if(Math.abs(dx)>4||Math.abs(dy)>4)moved=true;
    el.style.transform = `translateX(${dx}px) translateY(${dy * .15}px) rotate(${dx / 20}deg)`;
    const sl = el.querySelector('.sl'), sp = el.querySelector('.sp');
    if(sl)sl.style.opacity=Math.max(0,Math.min(1,dx/THRESH));
    if(sp)sp.style.opacity=Math.max(0,Math.min(1,-dx/THRESH));
  });
  el.addEventListener('pointerup',e=>{
    if(!act)return;act=false;
    el.style.transition='transform .35s cubic-bezier(.25,.46,.45,.94)';
    if(Math.abs(dx)>=THRESH){
      const lk = dx > 0;
      el.style.transform = `translateX(${lk ? '150vw' : '-150vw'}) rotate(${lk ? 25 : -25}deg)`;
      setTimeout(() => doSwipe(mv.id, lk), 350);
    }else{
      el.style.transform='';
      el.querySelectorAll('.stamp').forEach(s=>s.style.opacity=0);
    }
    dx=0;dy=0;
  });
}

function openTr(cardEl,vid){
  if(cardEl.querySelector('.trf'))return;
  const f=document.createElement('iframe');
  f.src = `https://www.youtube.com/embed/${vid}?autoplay=1`;
  f.className = 'trf'; f.allow = 'autoplay;fullscreen';
  const b=document.createElement('button');
  b.className='trc';b.textContent='✕';
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  b.onclick=e=>{e.stopPropagation();f.remove();b.remove()};
  cardEl.appendChild(f);cardEl.appendChild(b);
}

function btnSwipe(lk){
  const rem=getRem();if(!rem.length)return;
  const top=document.querySelector('.mvc.top');
  if(!top)return;
  top.style.transition='transform .35s cubic-bezier(.25,.46,.45,.94)';
  top.style.transform = `translateX(${lk ? '150vw' : '-150vw'}) rotate(${lk ? 25 : -25}deg)`;
  setTimeout(()=>doSwipe(rem[0].id,lk),350);
}

async function doSwipe(mid,lk){
  const lat=await dbG(SK.swipes)||{};
  if(!lat[mid])lat[mid]={};
  lat[mid][ST.user]=lk;
  ST.swipes=lat;
  await dbS(SK.swipes,lat);
  if(lk){
    const oth=ST.user==='p1'?'p2':'p1';
    if(lat[mid]?.[oth]===true&&!ST.seenMatches.has(mid)){
      ST.seenMatches.add(mid);
      const mv=ST.movies.find(x=>x.id===mid);
      if(mv)showMod(mv);
    }
  }
  renderSwipe();
}

function showMod(mv){
  const vid=ytId(mv.trailer);
  document.getElementById('m-cov').src=mv.cover||'';
  document.getElementById('m-ttl').textContent=mv.title;
  const trl=document.getElementById('m-tr');
  if(vid){ trl.href = `https://youtube.com/watch?v=${vid}`; trl.style.display = '' }
  else trl.style.display = 'none';
  document.getElementById('m-cl').onclick=closeMod;
  document.getElementById('mwrap').classList.add('on');
}
function closeMod(){document.getElementById('mwrap').classList.remove('on')}

function renderMatches(){
  const grid=document.getElementById('mgrid');
  const mat=getMat();
  if(mat.length===0){
    grid.style.display='flex';grid.style.flexDirection='column';
    grid.style.alignItems='center';grid.style.justifyContent='center';
    grid.innerHTML='<div class="ei">💔</div><div class="et">Nessun match ancora</div><div class="es">Inizia a fare swipe!</div>';
    return;
  }
  grid.style.display = 'grid';
  grid.innerHTML = mat.map(m => {
    const v = ytId(m.trailer);
    return `
      <div class="mi">
        <img src="${m.cover || ''}" alt="${m.title}" onerror="this.style.display='none'">
        <div class="miinfo">
          <div class="mit">${m.title}</div>
          ${v ? `<a class="mia" href="https://youtube.com/watch?v=${v}" target="_blank">▶ Trailer</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function prevCov(){
  const u=document.getElementById('f-co').value,w=document.getElementById('cp'),i=document.getElementById('cpimg');
  if(u){i.src=u;w.style.display=''}else w.style.display='none';
}

async function addMovie(){
  const ti=document.getElementById('f-ti').value.trim();
  if(!ti){
    const inp=document.getElementById('f-ti');
    inp.style.borderColor='#FF4D6A';
    let em=inp.nextElementSibling;
    if(em&&em.classList.contains('errmsg'))em.remove();
    const e=document.createElement('div');e.className='errmsg';e.textContent='Inserisci il titolo!';
    inp.insertAdjacentElement('afterend',e);
    setTimeout(()=>{inp.style.borderColor='';if(e.parentNode)e.remove()},3000);
    return;
  }
  const mvData={
    title: ti,
    year: document.getElementById('f-yr').value ? parseInt(document.getElementById('f-yr').value) : null,
    genre: document.getElementById('f-ge').value.trim() || null,
    cover: document.getElementById('f-co').value.trim() || null,
    trailer: document.getElementById('f-tr').value.trim() || null
  };
  if(ST.editingMovieId){
    ST.movies = ST.movies.map(m => m.id === ST.editingMovieId ? {...m, ...mvData} : m);
    ST.editingMovieId = null;
  } else {
    const mv = {id:'m'+Date.now(), ...mvData};
    ST.movies = [...ST.movies, mv];
  }
  await dbS(SK.movies,ST.movies);
  renderAddTable();
  closeAddModal();
  resetAddForm();
}

async function saveSettings(){
  const p1=document.getElementById('s-p1').value.trim()||'Partner A';
  const p2=document.getElementById('s-p2').value.trim()||'Partner B';
  ST.names={p1,p2};
  await dbS(SK.names,ST.names);
  updNames();go('s-landing');
}

async function resetSwipes(btn){
  ST.swipes={};ST.seenMatches=new Set();
  await dbS(SK.swipes,{});
  if(ST.user)renderSwipe();
  btn.textContent='✓ Resettati!';
  setTimeout(()=>btn.textContent='🔄 Reset Swipe',2000);
}

function ytId(url){
  if(!url)return null;
  const m=url.match(/(?:v=|youtu\.be\/|embed\/)([^&?\s]{11})/);
  return m?m[1]:null;
}

// Apri schermata gestione
function openManage(){
  renderTable();
  go('s-manage');
}

// Render tabella
function renderTable(){
  const tb = document.getElementById('movie-table');
  tb.innerHTML = '';

  ST.movies.forEach(m => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${m.title}</td>
      <td style="text-align:center">
        <button onclick="delMovie('${m.id}')" style="background:#ff4d6a;border:none;padding:5px 10px;border-radius:5px;color:#fff">
          ❌
        </button>
      </td>
    `;

    tb.appendChild(tr);
  });
}

// Aggiungi film da gestione
function addMovieManage(){
  const title = document.getElementById('new-title').value.trim();
  const cover = document.getElementById('new-cover').value.trim();

  if(!title){
    alert("Inserisci un titolo");
    return;
  }

  const mv = {
    id: 'm' + Date.now(),
    title,
    cover: cover || 'https://via.placeholder.com/300x450?text=No+Image'
  };

  ST.movies.push(mv);
  dbS(SK.movies, ST.movies);

  document.getElementById('new-title').value = '';
  document.getElementById('new-cover').value = '';

  renderTable();
}

// Elimina film
function delMovie(id){
  if(!confirm("Eliminare questo film?")) return;

  ST.movies = ST.movies.filter(m => m.id !== id);

  if(ST.editingMovieId === id) resetAddForm();

  // rimuovi anche dagli swipe
  const sw = dbG(SK.swipes) || {};
  delete sw[id];

  dbS(SK.movies, ST.movies);
  dbS(SK.swipes, sw);

  ST.swipes = sw;

  renderTable();
  if(document.getElementById('add-table')) renderAddTable();
}
