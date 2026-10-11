(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const catalogo=[],catalogoSeries=[]; const state={hero:0,current:null,currentType:null,liveChannel:null,hls:null,audio:null,audioReady:false,toast:null,heroTimer:null,heroLayer:0,homeOnline:false,homeRequest:0,homeItems:[],tvTab:'channels'};
function setPlayerMode(active){document.body.classList.toggle('player-active',!!active);if(active){document.body.style.overflow='hidden'}else if(!$$('.screen.active,.detail.active,.sheet.active,.player.active').length){document.body.style.overflow=''}}
const store={get:(k,f)=>{try{const v=localStorage.getItem(k);return v===null?f:JSON.parse(v)}catch{return f}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
function showTransitionLoading(text='Preparando CineHUB…',delay=0){
 const el=$('#transitionLoader'),label=$('#transitionLoaderText'); if(!el)return Promise.resolve();
 if(label)label.textContent=text; el.classList.add('active'); el.setAttribute('aria-hidden','false');
 return new Promise(resolve=>setTimeout(()=>{el.classList.remove('active');el.setAttribute('aria-hidden','true');resolve()},Math.max(160,delay)));
}
function adultEnabled(){return true}
function isAdultItem(item){return false}
function guardAdult(item,fn){if(typeof fn==='function')fn();return true}

function normalizeSeriesTitle(title){return String(title||'').replace(/\s*S\d{1,2}\s*E\d{1,3}\b.*$/i,'').replace(/\s*T\d{1,2}\s*E\d{1,3}\b.*$/i,'').trim()}
function normalizeContentItem(x,type){
 const item={...x};
 item.titulo=type==='series'?normalizeSeriesTitle(item.titulo):String(item.titulo||'').replace(/\s+/g,' ').trim();
 item.imagem=String(item.imagem||'imagens/sem-capa.jpg').replace(/^http:\/\//,'https://');
 item.banner=String(item.banner||item.imagem).replace(/^http:\/\//,'https://');
 item.categoria=String(item.categoria||item.grupo||(type==='series'?'Séries':'Filmes')).replace(/^Séries?\s*\|\s*/i,'').replace(/^Filmes?\s*\|\s*/i,'').trim()|| (type==='series'?'Séries':'Filmes');
 return item;
}
function uniqueSeries(items,limit=180){
 const seen=new Map();
 for(const raw of (items||[])){
  const x=normalizeContentItem(raw,'series'),key=x.titulo.toLocaleLowerCase('pt-BR');
  if(!key||seen.has(key))continue;
  x.__seriesIndex=true;
  seen.set(key,x);
  if(seen.size>=limit)break;
 }
 return [...seen.values()];
}
function closeAllScreens(){
 $$('.screen.active,.detail.active,.sheet.active,.player.active,.system-modal.active').forEach(x=>x.classList.remove('active'));
 setPlayerMode(false);document.body.style.overflow='';
}


function sound(kind='tap'){
 try{
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)return;
  if(!state.audio){
   state.audio=new C();
   state.audioMaster=state.audio.createGain();
   state.audioMaster.gain.value=.30;
   state.audioComp=state.audio.createDynamicsCompressor();
   state.audioComp.threshold.value=-20;
   state.audioComp.knee.value=12;
   state.audioComp.ratio.value=4;
   state.audioComp.attack.value=.003;
   state.audioComp.release.value=.11;
   state.audioMaster.connect(state.audioComp).connect(state.audio.destination);
  }
  const a=state.audio;
  if(a.state==='suspended')a.resume().catch(()=>{});
  const now=a.currentTime;
  if(state.lastSoundAt && now-state.lastSoundAt<.075)return;
  state.lastSoundAt=now;

  /* CineHUB UI sound palette: short, warm, streaming-app style. */
  const cfg={
   tap:{f:520,to:650,d:.075,type:'sine',vol:.90},
   open:{f:440,to:660,d:.145,type:'sine',vol:1.05},
   fav:{f:560,to:790,d:.125,type:'triangle',vol:1.00},
   success:{f:520,to:820,d:.16,type:'sine',vol:1.00},
   close:{f:620,to:420,d:.105,type:'sine',vol:.88},
   error:{f:250,to:180,d:.14,type:'triangle',vol:.90}
  }[kind]||{f:520,to:650,d:.075,type:'sine',vol:.90};

  const osc=a.createOscillator(), gain=a.createGain();
  osc.type=cfg.type;
  osc.frequency.setValueAtTime(cfg.f,now);
  osc.frequency.exponentialRampToValueAtTime(cfg.to,now+cfg.d*.78);
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(.095*cfg.vol,now+.006);
  gain.gain.exponentialRampToValueAtTime(.0001,now+cfg.d);
  osc.connect(gain).connect(state.audioMaster);
  osc.start(now);osc.stop(now+cfg.d+.012);

  if(kind==='open'||kind==='close'||kind==='fav'||kind==='success'){
   const hi=a.createOscillator(),hg=a.createGain();
   hi.type='sine';
   hi.frequency.setValueAtTime(cfg.f*2,now);
   hi.frequency.exponentialRampToValueAtTime(cfg.to*2,now+cfg.d*.72);
   hg.gain.setValueAtTime(.0001,now);
   hg.gain.exponentialRampToValueAtTime(.025,now+.008);
   hg.gain.exponentialRampToValueAtTime(.0001,now+cfg.d*.88);
   hi.connect(hg).connect(state.audioMaster);
   hi.start(now);hi.stop(now+cfg.d);
  }

  if(kind==='open'){
   const click=a.createOscillator(),cg=a.createGain();
   click.type='triangle';
   click.frequency.setValueAtTime(1050,now);
   click.frequency.exponentialRampToValueAtTime(720,now+.045);
   cg.gain.setValueAtTime(.0001,now);
   cg.gain.exponentialRampToValueAtTime(.018,now+.004);
   cg.gain.exponentialRampToValueAtTime(.0001,now+.055);
   click.connect(cg).connect(state.audioMaster);
   click.start(now);click.stop(now+.06);
  }
 }catch{}
}

function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(state.toast);state.toast=setTimeout(()=>t.classList.remove('show'),1900)}
const coverResolveCache=new Map();
async function resolveOnlineCover(title,type='series'){
 const key=`${type}:${String(title||'').trim().toLowerCase()}`; if(coverResolveCache.has(key))return coverResolveCache.get(key);
 try{
  const data=await window.CineHUBWeb?.searchTMDBResults?.(title,type,1); const r=data?.results?.[0];
  const url=r?.poster_path?window.CineHUBWeb.imageUrl(r.poster_path):'';
  coverResolveCache.set(key,url||''); return url||'';
 }catch{coverResolveCache.set(key,'');return ''}
}
function safeImg(img){if(!img)return;img.onerror=async()=>{if(img.dataset.fallback)return;img.dataset.fallback='1';const title=img.closest('.card')?.querySelector('.card-title')?.textContent?.trim();if(title&&window.CineHUBLargeCatalog?.findByTitle){try{const x=await window.CineHUBLargeCatalog.findByTitle('series',title);const u=x?.imagem||x?.banner;if(u&&u!==img.src){img.dataset.remote='1';img.src=String(u).replace(/^http:\/\//,'https://');return}}catch{}}if(title){const u=await resolveOnlineCover(title,'series');if(u&&u!==img.src){img.dataset.remote='1';img.src=u;return}}img.src='imagens/sem-capa.jpg'}}
function esc(v){return String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]||m))}
function currentLang(){return store.get('cinehub_lang','pt')}
function cinehubMode(){return window.CineHUBPerformance?.getMode?.()||'advanced'}
function setCineHUBMode(mode){
  const m=window.CineHUBPerformance?.setMode?.(mode)||mode;
  store.set('cinehub_mode_choice_v1',true);
  toast(m==='performance'?'Modo Performance ativado.':'Modo Avançado ativado.');
  return m;
}

const i18n={
pt:{home:'Início',me:'Discord',config:'Config',films:'Filmes',series:'Séries',tv:'Programação',watch:'▶ Assistir',details:'◌ Detalhes',trailer:'▷ Ver trailer',heroEyebrow:'Destaque CineHUB',now:'Agora no CineHUB',releases:'Lançamentos',releaseSub:'Novidades do catálogo.',curation:'Curadoria',forYou:'Para você',forYouSub:'Escolhas que combinam com seu momento.',explore:'Explore',discover:'Descubra o CineHUB',discoverSub:'Três universos, uma experiência.',filmsSub:'Catálogo organizado por gênero.',seriesSub:'Histórias para acompanhar por temporadas.',tvSub:'Canais preparados para o futuro.',inDevelopment:'Em desenvolvimento',premium:'CineHUB Premium',premiumSub:'Uma experiência ainda mais completa. Assinaturas e benefícios chegam em breve.',catalog:'Catálogo',filmsScreenSub:'Escolha sua próxima sessão.',seriesScreenSub:'Temporadas, histórias e universos.',searchFilms:'Pesquisar filmes...',searchSeries:'Pesquisar séries...',onlineGuide:'Guia online',tvScreenSub:'Canais e grades oficiais em um só lugar.',updating:'Preparando programação…',refresh:'↻ Atualizar',search:'Buscar',searchTitle:'Pesquisar',searchSub:'Encontre filmes e séries rapidamente.',searchAll:'O que você quer assistir?',empty:'Nada por aqui ainda.',noResults:'Nenhum resultado encontrado.',loading:'Carregando informações…',continue:'Continuar',list:'Minha Lista',learn:'Conhecer',yourCollection:'Sua coleção',listSub:'Seus favoritos em um só lugar.'},
es:{home:'Inicio',me:'Discord',config:'Ajustes',films:'Películas',series:'Series',tv:'Programación',watch:'▶ Ver',details:'◌ Detalles',trailer:'▷ Ver tráiler',heroEyebrow:'Destacado CineHUB',now:'Ahora en CineHUB',releases:'Estrenos',releaseSub:'Novedades del catálogo.',curation:'Curaduría',forYou:'Para ti',forYouSub:'Selecciones para tu momento.',explore:'Explorar',discover:'Descubre CineHUB',discoverSub:'Tres universos, una experiencia.',filmsSub:'Catálogo organizado por género.',seriesSub:'Historias por temporadas.',tvSub:'Canales preparados para el futuro.',inDevelopment:'En desarrollo',premium:'CineHUB Premium',premiumSub:'Una experiencia más completa. Suscripciones y beneficios próximamente.',catalog:'Catálogo',filmsScreenSub:'Elige tu próxima sesión.',seriesScreenSub:'Temporadas, historias y universos.',searchFilms:'Buscar películas...',searchSeries:'Buscar series...',onlineGuide:'Guía online',tvScreenSub:'Canales y parrillas oficiales en un solo lugar.',updating:'Preparando programación…',refresh:'↻ Actualizar',search:'Buscar',searchTitle:'Buscar',searchSub:'Encuentra películas y series rápidamente.',searchAll:'¿Qué quieres ver?',empty:'No hay nada aquí todavía.',noResults:'No se encontraron resultados.',loading:'Cargando información…',continue:'Continuar',list:'Mi lista',learn:'Conocer',yourCollection:'Tu colección',listSub:'Tus favoritos en un solo lugar.'},
en:{home:'Home',me:'Discord',config:'Settings',films:'Movies',series:'Series',tv:'Programming',watch:'▶ Watch',details:'◌ Details',trailer:'▷ Watch trailer',heroEyebrow:'CineHUB Featured',now:'Now on CineHUB',releases:'New releases',releaseSub:'New additions to the catalog.',curation:'Curated for you',forYou:'For you',forYouSub:'Picks that match your moment.',explore:'Explore',discover:'Discover CineHUB',discoverSub:'Three worlds, one experience.',filmsSub:'Catalog organized by genre.',seriesSub:'Stories across seasons.',tvSub:'Channels ready for the future.',inDevelopment:'In development',premium:'CineHUB Premium',premiumSub:'An even richer experience. Subscriptions and benefits coming soon.',catalog:'Catalog',filmsScreenSub:'Choose your next session.',seriesScreenSub:'Seasons, stories and universes.',searchFilms:'Search movies...',searchSeries:'Search series...',onlineGuide:'Online guide',tvScreenSub:'Official channels and schedules in one place.',updating:'Preparing programming…',refresh:'↻ Refresh',search:'Search',searchTitle:'Search',searchSub:'Find movies and series quickly.',searchAll:'What do you want to watch?',empty:'Nothing here yet.',noResults:'No results found.',loading:'Loading information…',continue:'Continue',list:'My List',learn:'Explore',yourCollection:'Your collection',listSub:'Your favorites in one place.'}
};
function tr(k){return (i18n[currentLang()]||i18n.pt)[k]||i18n.pt[k]||k}
function translateDOM(){
 const l=i18n[currentLang()]||i18n.pt;
 $$('[data-i18n]').forEach(el=>{if(l[el.dataset.i18n])el.textContent=l[el.dataset.i18n]});
 $$('[data-i18n-placeholder]').forEach(el=>{if(l[el.dataset.i18nPlaceholder])el.placeholder=l[el.dataset.i18nPlaceholder]});
 document.documentElement.lang=currentLang()==='pt'?'pt-BR':currentLang();
}
function applyLang(){translateDOM();const b=$$('.dock-btn');if(b[0])b[0].querySelector('span').textContent=tr('home');if(b[1])b[1].querySelector('span').textContent='Discord';if(b[2])b[2].querySelector('span').textContent=tr('config');}


function translateCommon(){
 const map={
  pt:{'Nada por aqui ainda.':'Nada por aqui ainda.','Minha Lista':'Minha Lista','Filmes assistidos':'Filmes assistidos','Na Minha Lista':'Na Minha Lista','Último título':'Último título','Configurações':'Configurações','Login local':'Login local','Entre no CineHUB':'Entre no CineHUB','Seu nome':'Seu nome','Seu e-mail':'Seu e-mail','Entrar':'Entrar','Sair da conta':'Sair da conta','Atualizar':'Atualizar','Idioma':'Idioma','Catálogo online':'Catálogo online','Conta':'Conta','Meu perfil':'Meu perfil','Premium':'Premium','Seu espaço':'Seu espaço','Personalização':'Personalização','Canal':'Canal','Futuro CineHUB':'Futuro CineHUB','Conhecer':'Conhecer'},
  es:{'Nada por aqui ainda.':'No hay nada aquí todavía.','Minha Lista':'Mi lista','Filmes assistidos':'Películas vistas','Na Minha Lista':'En mi lista','Último título':'Último título','Configurações':'Configuración','Login local':'Inicio de sesión local','Entre no CineHUB':'Entra en CineHUB','Seu nome':'Tu nombre','Seu e-mail':'Tu correo','Entrar':'Entrar','Sair da conta':'Cerrar sesión','Atualizar':'Actualizar','Idioma':'Idioma','Catálogo online':'Catálogo online','Conta':'Cuenta','Meu perfil':'Mi perfil','Premium':'Premium','Seu espaço':'Tu espacio','Personalização':'Personalización','Canal':'Canal','Futuro CineHUB':'Futuro CineHUB','Conhecer':'Conocer'},
  en:{'Nada por aqui ainda.':'Nothing here yet.','Minha Lista':'My List','Filmes assistidos':'Movies watched','Na Minha Lista':'In My List','Último título':'Last title','Configurações':'Settings','Login local':'Local login','Entre no CineHUB':'Enter CineHUB','Seu nome':'Your name','Seu e-mail':'Your email','Entrar':'Sign in','Sair da conta':'Sign out','Atualizar':'Refresh','Idioma':'Language','Catálogo online':'Online catalog','Conta':'Account','Meu perfil':'My profile','Premium':'Premium','Seu espaço':'Your space','Personalização':'Personalization','Canal':'Channel','Futuro CineHUB':'CineHUB future','Conhecer':'Explore'}
 }[currentLang()];
 if(!map)return;
 const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let n; while(n=w.nextNode()){const t=n.nodeValue.trim();if(map[t])n.nodeValue=n.nodeValue.replace(t,map[t]);}
}



function ripple(e,el){
 if(!el||el.dataset.noRipple==='1')return;
 const old=el.querySelector('.ripple'); if(old) old.remove();
 const r=document.createElement('span');r.className='ripple';
 const rect=el.getBoundingClientRect();
 const x=Number.isFinite(e?.clientX)?e.clientX-rect.left:rect.width/2;
 const y=Number.isFinite(e?.clientY)?e.clientY-rect.top:rect.height/2;
 r.style.left=x+'px';r.style.top=y+'px';
 el.appendChild(r);setTimeout(()=>r.remove(),420);
}
function card(item,type='movie'){
 const d=document.createElement('article');
 d.className='card press'+(type==='series'?' series-card':'')+(type==='channel'?' channel-card':'');
 d.tabIndex=0;
 const title=item.titulo||item.nome||'Sem título';
 const image=item.imagem||item.logo||'imagens/sem-capa.jpg';
 const badge=type==='series'?(item.temporadas||'Série'):(item.categoria||item.nota||item.status||'CineHUB');
 d.innerHTML=`<span class="badge">${badge}</span><img class="poster" src="${image}" alt="${title}" loading="lazy" decoding="async"><div class="card-info"><div class="card-title">${title}</div><div class="card-meta">${item.ano||item.categoria||item.status||''}</div></div>${type!=='channel'?favButton(item,type):''}`;
 safeImg(d.querySelector('img'));
 d.addEventListener('click',e=>{
   ripple(e,d);
   if(e.target.closest('.fav')){e.stopPropagation();toggleFav(item,type);return}
   guardAdult(item,()=>openDetail(item,type));
 });
 d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(item,type)}});
 return d;
}
function fillRow(id,items,type='movie'){
 const r=$('#'+id);if(!r)return;
 r.innerHTML='';
 const list=Array.isArray(items)?items:[];
 if(!list.length){r.innerHTML='<div class="empty">Nada por aqui ainda.</div>';return}
 const frag=document.createDocumentFragment();
 list.forEach(x=>frag.appendChild(card(x,type)));
 r.appendChild(frag);
}
function renderContinue(){
 const p=store.get('cinehub_progress',null),sec=$('#continueSection'),r=$('#continueRow');
 if(!sec||!r)return;
 if(!p||!p.titulo){sec.hidden=true;r.innerHTML='';return}
 sec.hidden=false;
 const local=catalogo.find(x=>x.titulo===p.titulo)||catalogoSeries.find(x=>x.titulo===p.titulo);
 const item=local||{titulo:p.titulo,imagem:p.imagem||p.banner||'imagens/sem-capa.jpg',ano:'',categoria:p.type==='series'?'Série':'Filme',temporadas:p.type==='series'?'Série':''};
 const pct=p.duracao?Math.min(100,(p.tempo/p.duracao)*100):0;
 r.innerHTML=`<article class="continue-card glass press" id="continueCard" style="--continue-image:url('${item.imagem}')"><img src="${item.imagem}" alt="${item.titulo}" loading="lazy" decoding="async"><div class="continue-overlay"></div><div class="continue-info"><span class="eyebrow">${p.type==='series'?'Continuar série':'Continuar assistindo'}</span><h3>${item.titulo}</h3><p>${p.type==='series'?`T${String(p.season||1).padStart(2,'0')} · E${String(p.episode||1).padStart(2,'0')}`:`${Math.max(0,Math.round(pct))}% concluído`}</p><div class="progress"><i style="width:${pct}%"></i></div><button class="primary press" id="continuePlay"><span class="button-icon"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg></span>Continuar</button></div></article>`;
 const c=$('#continueCard');safeImg(c?.querySelector('img'));
 if(!c)return;
 c.onclick=e=>{
   ripple(e,c);
   if(e.target.closest('button')){
     state.current=item;state.currentType=p.type||'movie';
     if(state.currentType==='series'){openDetail(item,'series');setTimeout(()=>playCurrent({type:'series',season:p.season||1,episode:p.episode||1}),120)}
     else{openDetail(item,'movie');setTimeout(()=>playCurrent({type:'movie'}),120)}
   }else openDetail(item,p.type||'movie');
 };
}
function stats(){return store.get('cinehub_stats',{watched:0,lastWatched:null})}
function bumpWatched(item){const s=stats();s.watched=(s.watched||0)+1;s.lastWatched=item?.titulo||item?.nome||null;store.set('cinehub_stats',s)}

function favKey(item,type){const t=type||item?.__type||item?.tipo||'movie';return `${t}:${item?.tmdb||item?.imdb||String(item?.titulo||'').toLowerCase().trim()}`}
function favs(){const raw=store.get('cinehub_favoritos',[]);if(!Array.isArray(raw))return [];return raw.map(x=>typeof x==='string'?{key:`movie:${x.toLowerCase().trim()}`,titulo:x,type:'movie'}:x)}
function isFav(item,type){return favs().some(x=>x.key===favKey(item,type))}
function favButton(item,type='movie'){return `<button class="fav press" aria-label="Favoritar">${isFav(item,type)?'♥':'♡'}</button>`}
function toggleFav(item,type=state.currentType||item?.__type||'movie'){const key=favKey(item,type);let a=favs();const exists=a.some(x=>x.key===key);a=exists?a.filter(x=>x.key!==key):[...a,{key,titulo:item.titulo,type,tmdb:item.tmdb||'',imdb:item.imdb||'',imagem:item.imagem||'',banner:item.banner||'',ano:item.ano||'',categoria:item.categoria||'',sinopse:item.sinopse||'',temporadas:item.temporadas||''}];store.set('cinehub_favoritos',a);sound('fav');renderHome();renderGrid();renderSeries();if(state.current?.titulo===item.titulo)$('#detailFav').textContent=!exists?'♥ Na Minha Lista':'♡ Minha Lista';toast(!exists?'Adicionado à Minha Lista':'Removido da Minha Lista')}
function renderFavorites(){const items=favs().map(x=>({titulo:x.titulo,tmdb:x.tmdb,imdb:x.imdb,imagem:x.imagem||'imagens/sem-capa.jpg',banner:x.banner,ano:x.ano,categoria:x.categoria,sinopse:x.sinopse,temporadas:x.temporadas,__type:x.type}));const r=$('#favoritesRow');if(!r)return;r.innerHTML='';if(!items.length){r.innerHTML='<div class="empty">Sua lista está vazia. Toque no ♡ de um título para guardar aqui.</div>';return}items.forEach(x=>r.appendChild(card(x,x.__type||'movie')))}
async function loadHomeCatalog(){
 if(!window.CineHUBLargeCatalog)return;
 try{
  const [featured,releases,series]=await Promise.all([
   window.CineHUBLargeCatalog.featured('movie'),
   window.CineHUBLargeCatalog.first('Filmes | Lançamentos'),
   window.CineHUBLargeCatalog.first('Séries | Netflix').catch(()=>[])
  ]);
  const movies=(featured||[]).map(x=>normalizeContentItem(x,'movie'));
  const releaseItems=(releases||[]).map(x=>normalizeContentItem(x,'movie'));
  const seriesItems=uniqueSeries(series||[],12);
  state.homeItems=[...movies.slice(0,8),...seriesItems.slice(0,4)];
  if(!state.homeItems.length)state.homeItems=releaseItems.slice(0,12);
  fillRow('trendingRow',movies.slice(0,12),'movie');
  fillRow('releaseRow',releaseItems.slice(0,12),'movie');
  fillRow('seriesTrendRow',seriesItems.slice(0,12),'series');
  const recommendations=[...movies.slice(0,6),...seriesItems.slice(0,6)];
  fillRow('recommendRow',recommendations,'movie');
  if(state.homeItems.length){hero(0);loadHeroHighlights().catch(()=>{});}
  return true;
 }catch(err){
  console.warn('[CineHUB] home catalog:',err);
  state.homeItems=[];
  loadHeroHighlights().catch(()=>{});
  return false;
 }
}
function renderHome(){
 fillRow('trendingRow',[]);fillRow('releaseRow',[]);fillRow('seriesTrendRow',[]);fillRow('recommendRow',[]);
 loadHomeCatalog();
 renderContinue();renderFavorites();
}

const HERO_2026=[
 {query:'Clash of the Thundermans',titulo:'O Confronto dos Thundermans',ano:'2026',categoria:'Filme · 2026'},
 {query:'Backrooms',titulo:'Backrooms',ano:'2026',categoria:'Filme · Terror'},
 {query:'Resident Evil',titulo:'Resident Evil',ano:'2026',categoria:'Filme · Terror'},
 {query:'28 Years Later: The Bone Temple',titulo:'28 Anos Depois: O Templo dos Ossos',ano:'2026',categoria:'Filme · Terror'},
 {query:'Spider-Man: Brand New Day',titulo:'Homem-Aranha: Um Novo Dia',ano:'2026',categoria:'Filme · Ação'},
 {query:'The Super Mario Galaxy Movie',titulo:'Super Mario Galaxy: O Filme',ano:'2026',categoria:'Filme · Animação'}
];
let heroHighlightsReady=false;
async function loadHeroHighlights(){
 if(heroHighlightsReady)return state.homeItems;
 heroHighlightsReady=true;
 const base=HERO_2026.map(x=>({...x,imagem:'imagens/sem-capa.jpg',banner:'imagens/sem-capa.jpg',sinopse:'Lançamento de 2026 em destaque no CineHUB.',nota:'—',__hero2026:true}));
 try{
   const results=await Promise.all(base.map(async item=>{
     try{
       const data=await window.CineHUBWeb?.searchTMDBResults?.(item.query,'movie',1);
       const hit=(data?.results||[]).find(x=>String(x.release_date||'').startsWith('2026'))||data?.results?.[0];
       if(!hit)return item;
       const online=window.CineHUBWeb.tmdbItem?window.CineHUBWeb.tmdbItem(hit,'movie'):{
         titulo:hit.title||hit.name||item.titulo,ano:String(hit.release_date||'').slice(0,4)||'2026',nota:hit.vote_average?Number(hit.vote_average).toFixed(1):'—',categoria:'Filme',imagem:window.CineHUBWeb.imageUrl(hit.poster_path),banner:window.CineHUBWeb.imageUrl(hit.backdrop_path),sinopse:hit.overview||'',tmdb:String(hit.id||''),__online:true,__type:'movie'
       };
       return {...item,...online,titulo:item.titulo};
     }catch{return item}
   }));
   state.homeItems=results.filter(x=>x?.imagem&&x.imagem!=='imagens/sem-capa.jpg');
   if(state.homeItems.length<3)state.homeItems=results;
 }catch{state.homeItems=base}
 hero(0);
 return state.homeItems;
}
function hero(i=0){
 const items=state.homeItems||[]; if(!items.length)return;
 const item=items[i%items.length]; state.hero=i%items.length;
 const nextLayer=state.heroLayer?0:1;
 const current=nextLayer?$('#heroBgA'):$('#heroBgB'),previous=nextLayer?$('#heroBgB'):$('#heroBgA');
 const image=item.banner||item.imagem;
 current.style.backgroundImage=`url("${image}")`;
 current.classList.add('active');previous.classList.remove('active');state.heroLayer=nextLayer;
 $('#heroTitle').textContent=item.titulo; $('#heroSynopsis').textContent=item.sinopse||`${item.categoria||'Conteúdo'} disponível no catálogo CineHUB.`;
 $('#heroMeta').innerHTML=`<span class="pill">${item.ano||'—'}</span><span class="pill hero-rating">★ ${item.nota||'Sem avaliação'}</span><span class="pill">${item.categoria||'—'}</span>${item.temporadas?`<span class="pill">${item.temporadas}</span>`:''}`;
 $('#heroPlay').onclick=()=>guardAdult(item,()=>openDetail(item,item.__seriesIndex?'series':item.tipo==='series'?'series':'movie'));
 $('#heroInfo').onclick=()=>guardAdult(item,()=>openDetail(item,item.__seriesIndex?'series':item.tipo==='series'?'series':'movie'));
 const ht=$('#heroTrailer');if(ht)ht.onclick=()=>guardAdult(item,()=>openTrailer(item));
 const dots=$('#heroDots');dots.innerHTML='';
 for(let n=0;n<Math.min(6,items.length);n++){const d=document.createElement('i');d.className=n===state.hero?'active':'';dots.appendChild(d)}
 translateDOM();
}
async function openTrailer(item){
 sound('open');
 const title=encodeURIComponent(`${item?.titulo||''} trailer oficial`);
 const player=$('#megaPlayer'),video=$('#video'),loading=$('#playerLoading');
 $('#player').classList.add('active');setPlayerMode(true);showTransitionLoading('Preparando trailer…',180);
 if(video)video.style.display='none';
 if(player){player.style.display='block';player.src=`https://www.youtube-nocookie.com/embed?listType=search&list=${title}&autoplay=1`; }
 if(loading){loading.classList.add('hide');}
 $('#playerMeta').innerHTML=`<span>${esc(item?.titulo||'Trailer')} · exibição interna</span>`;
}
async function openDetail(item,type='movie'){
 showTransitionLoading(type==='series'?'Abrindo série…':'Abrindo filme…',160);
 state.current={...item}; state.currentType=type; state.detailRequest=(state.detailRequest||0)+1; const req=state.detailRequest;
 $('#detailType').textContent=type==='series'?'Série':'Filme'; $('#detailTitle').textContent=item.titulo; $('#detailSynopsis').textContent=item.sinopse||tr('loading');
 $('#detailMeta').innerHTML=`<span class="pill">${item.ano||'—'}</span><span class="pill">${item.nota||'—'}</span><span class="pill">${item.categoria||'—'}</span>${item.temporadas?`<span class="pill">${item.temporadas}</span>`:''}`;
 const detailImg=item.banner||item.imagem; $('#detailHero').style.setProperty('--detail-image',`url("${detailImg}")`); $('#detailHero').style.backgroundImage=`url("${detailImg}")`; $('#detailFav').textContent=isFav(item,state.currentType)?'♥ Na Minha Lista':'♡ Minha Lista';
 $('#detailExtra').innerHTML='<div class="detail-loading">Buscando detalhes online…</div>'; $('#detail').classList.add('active'); sound('open'); document.body.style.overflow='hidden';
 try{
   let d=null;
   if(window.CineHUBWeb?.hasTMDB()) d=await CineHUBWeb.detailsTMDB(item,type);
   if(req!==state.detailRequest)return;
   if(d){
     // Persist the IDs resolved from TMDB on the current item so playback never
     // falls back to a malformed title-only URL when an ID is available.
     state.current={...state.current,tmdb:String(d.id||item.tmdb||''),imdb:String(d.external_ids?.imdb_id||item.imdb||'')};
     const title=d.title||d.name||item.titulo, year=(d.release_date||d.first_air_date||'').slice(0,4)||item.ano;
     const genres=(d.genres||[]).map(g=>g.name).slice(0,3).join(' · ')||item.categoria||'';
     const runtime=d.runtime||((d.episode_run_time||[])[0])||null;
     const rating=d.vote_average?`⭐ ${d.vote_average.toFixed(1)}`:item.nota;
     const overview=d.overview||item.sinopse||'';
     $('#detailTitle').textContent=title; $('#detailSynopsis').textContent=overview;
     $('#detailMeta').innerHTML=`<span class="pill">${year}</span><span class="pill">${rating}</span><span class="pill">${genres}</span>${runtime?`<span class="pill">${runtime} min</span>`:''}${d.number_of_seasons?`<span class="pill">${d.number_of_seasons} temporadas</span>`:''}`;
     const bg=CineHUBWeb.imageUrl(d.backdrop_path)||CineHUBWeb.imageUrl(d.poster_path)||item.banner||item.imagem; $('#detailHero').style.setProperty('--detail-image',`url("${bg}")`); $('#detailHero').style.backgroundImage=`url("${bg}")`;
     const cast=(d.credits?.cast||[]).slice(0,6).map(c=>c.name).join(', ');
     const trailer=(d.videos?.results||[]).find(v=>v.site==='YouTube'&&v.type==='Trailer');
     const br=d['watch/providers']?.results?.BR; const providers=[...(br?.flatrate||[]),...(br?.free||[]),...(br?.ads||[])].slice(0,6);
     const resolvedId=state.current.tmdb||state.current.imdb?'ID de reprodução resolvido':'ID não encontrado';
     $('#detailExtra').innerHTML=`<div class="detail-info-grid"><div><span>Elenco</span><b>${cast||'Não informado'}</b></div><div><span>Disponibilidade</span><b>${providers.length?providers.map(x=>x.provider_name).join(' · '):'Consultar disponibilidade'}</b></div></div><div class="detail-actions">${trailer?`<button class="secondary press" id="detailTrailerInternal">${tr('trailer')}</button>`:''}</div><small class="web-source">${resolvedId}. Detalhes online via catálogo. Toda reprodução permanece dentro do CineHUB.</small>`; if(trailer)$('#detailTrailerInternal').onclick=()=>openTrailer({...item,tmdb:state.current.tmdb});
     if(type==='series') addSeriesPlaybackControls(d);
   } else if(type==='series' && window.CineHUBWeb){
     try{ const tv=await CineHUBWeb.tvmaze(item.titulo); if(req!==state.detailRequest)return; const ep=tv._embedded?.episodes?.slice(-1)[0]; $('#detailSynopsis').textContent=(tv.summary||'').replace(/<[^>]*>/g,'')||item.sinopse; $('#detailMeta').innerHTML=`<span class="pill">${(tv.premiered||item.ano||'').slice(0,4)}</span><span class="pill">⭐ ${(tv.rating?.average||0).toFixed(1)}</span><span class="pill">${(tv.genres||[item.categoria]).slice(0,2).join(' · ')}</span>${tv.status?`<span class="pill">${tv.status}</span>`:''}`; $('#detailExtra').innerHTML=`<div class="detail-info-grid"><div><span>Próximo episódio</span><b>${tv._embedded?.nextepisode?.name||ep?.name||'Não informado'}</b></div><div><span>Temporadas</span><b>${tv._embedded?.episodes?new Set(tv._embedded.episodes.map(x=>x.season)).size:(item.temporadas||'—')}</b></div></div><small class="web-source">Informações online via TVmaze. Reprodução via fonte de conteúdo configurada.</small>`; addSeriesPlaybackControls(null); }catch{ $('#detailExtra').innerHTML='<small class="web-source">Detalhes online indisponíveis. O catálogo local continua funcionando.</small>'; addSeriesPlaybackControls(null); }
   } else { $('#detailExtra').innerHTML='<small class="web-source">Configure o acesso ao TMDB em Config para resolver o ID de reprodução. O catálogo local continua funcionando.</small>'; if(type==='series') addSeriesPlaybackControls(null); }
 }catch(err){ if(req===state.detailRequest) $('#detailExtra').innerHTML='<small class="web-source">Não foi possível atualizar os detalhes agora. O CineHUB continua usando os dados locais.</small>'; }
}
function addSeriesPlaybackControls(d){
 const seasons=Math.max(1,Number(d?.number_of_seasons)||Number((state.current?.temporadas||'').match(/\d+/)?.[0])||1);
 const saved=store.get('cinehub_last_episode',null);
 const season=Math.min(seasons,Math.max(1,Number(saved?.titulo===state.current?.titulo?saved.season:1)||1));
 const episode=Math.max(1,Number(saved?.titulo===state.current?.titulo?saved.episode:1)||1);
 $('#detailExtra').insertAdjacentHTML('beforeend',`<div class="episode-player-controls"><div><label for="seriesSeason">Temporada</label><select id="seriesSeason">${Array.from({length:seasons},(_,i)=>`<option value="${i+1}" ${i+1===season?'selected':''}>Temporada ${i+1}</option>`).join('')}</select></div><div><label for="seriesEpisode">Episódio</label><input id="seriesEpisode" type="number" min="1" max="99" value="${episode}" inputmode="numeric"></div><small>O episódio é reproduzido pela fonte de conteúdo configurada para o CineHUB.</small></div>`);
}

function close(id){
 const e=$('#'+id);if(!e)return;
 e.classList.remove('active');e.classList.remove('cinehub-screen-transition');e.querySelector?.('.sheet-panel')?.classList.remove('cinehub-screen-transition');
 if(id==='player'){
   clearTimeout(state.playerTimer); if(state.hls){try{state.hls.destroy()}catch{}state.hls=null} state.liveChannel=null;
   const frame=$('#megaPlayer'),local=$('#video'),loading=$('#playerLoading');
   if(frame){frame.src='about:blank';frame.style.display='none'}
   if(local){local.pause();local.removeAttribute('src');local.load();local.style.display='none';local.onerror=null;local.onloadedmetadata=null}
   if(loading)loading.classList.remove('hide');
   hidePlayerFallback();
   const meta=$('#playerMeta');if(meta)meta.textContent='';
   setPlayerMode(false);
 }
 if(id==='detail')state.current=null;
 if(id.endsWith('Sheet'))document.body.style.overflow='';
 if(!$$('.screen.active,.detail.active,.sheet.active,.player.active').length)document.body.style.overflow='';
}
function openScreen(id){
 sound('open');$$('.screen.active').forEach(x=>x.classList.remove('active'));
 const el=$('#'+id);if(!el)return;el.classList.add('active');document.body.style.overflow='hidden';
 showTransitionLoading(id==='tvScreen'?'Carregando programação…':id==='seriesScreen'?'Carregando séries…':id==='moviesScreen'?'Carregando filmes…':'Abrindo pesquisa…',170);
 if(id==='moviesScreen')renderGrid();
 if(id==='seriesScreen')renderSeries();
 if(id==='tvScreen'){setTvTab('channels');setupChannelChips();renderChannels();renderPopularChannels();window.CineHUBEPG?.load?.(window.canaisM3U8||[]);}
 if(id==='searchScreen')renderGlobalSearch($('#globalSearch').value);
}
function movieLargeCategories(){
 return [{name:'Todos',count:0},...(window.CineHUBLargeCatalog?.categories?.('movie')||[])];
}
function setupMovieChips(){
 const c=$('#movieChips');if(!c)return;c.innerHTML='';
 movieLargeCategories().forEach((item,n)=>{
   const b=document.createElement('button');b.className='chip'+(n===0?' active':'');
   b.dataset.cat=item.name;b.textContent=item.name==='Todos'?'Todos':`${item.name.replace(/^Filmes \| /,'')} · ${item.count.toLocaleString('pt-BR')}`;
   b.onclick=e=>{ripple(e,b);$$('#movieChips .chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');sound();renderGrid()};
   c.appendChild(b);
 });
 const h=$('#moviesScreen h1'); if(h)h.innerHTML=`Filmes <em class="title-count" id="movieTitleCount">${(window.CineHUBLargeCatalog?.index? '—':'')}</em>`;
}
let largeMovieItems=[],largeMovieCategory='',largeMovieOffset=0,largeMovieSearch='';
async function renderLargeMovies(){
 const g=$('#movieGrid'),more=$('#movieMore'),meta=$('#movieCatalogMeta');if(!g)return;
 const term=($('#movieSearch')?.value||'').trim().toLowerCase();
 const active=$('#movieChips .active')?.dataset.cat||'Todos';
 const category=active==='Todos'?'__featured':active;
 const changed=category!==largeMovieCategory||term!==largeMovieSearch;
 largeMovieCategory=category;largeMovieSearch=term;
 if(changed){largeMovieOffset=0;largeMovieItems=[];g.innerHTML='<div class="detail-loading">Carregando catálogo…</div>';}
 try{
   if(term){
     largeMovieItems=await window.CineHUBLargeCatalog.search('movie',term,160);
     const count=await window.CineHUBLargeCatalog.loadIndex('movie').then(x=>x.length);
     const tc=$('#movieTitleCount');if(tc)tc.textContent=count.toLocaleString('pt-BR');
   }else if(category==='__featured'){
     largeMovieItems=await window.CineHUBLargeCatalog.featured('movie');
   }else{
     largeMovieItems=await window.CineHUBLargeCatalog.first(category);
   }
   const visible=largeMovieItems.slice(0,120);g.innerHTML='';
   if(!visible.length){
     g.innerHTML='<div class="empty">Nenhum filme encontrado nesta categoria.</div>';
     if(window.CineHUBWeb?.hasTMDB?.()&&term){
       const online=await onlineSearch(term,'movie');g.innerHTML='';
       online.slice(0,40).forEach(x=>g.appendChild(card(x,'movie')));
       if(!online.length)g.innerHTML='<div class="empty">Nenhum filme encontrado.</div>';
     }
   }else{
     visible.forEach(x=>g.appendChild(card(x,'movie')));
   }
   const count=await window.CineHUBLargeCatalog.loadIndex('movie').then(x=>x.length).catch(()=>0);
   const tc=$('#movieTitleCount');if(tc)tc.textContent=count?count.toLocaleString('pt-BR'):'';
   if(meta)meta.textContent=active==='Todos'?`${count.toLocaleString('pt-BR')} títulos locais · catálogo online disponível na busca`: `${active.replace(/^Filmes \| /,'')} · ${movieLargeCategories().find(x=>x.name===active)?.count?.toLocaleString('pt-BR')||'—'} itens`;
   if(more){more.hidden=largeMovieItems.length<=visible.length||!!term;more.textContent='Mostrar mais';}
 }catch(err){
   console.warn('[CineHUB] catálogo de filmes:',err);
   g.innerHTML='<div class="empty">Não foi possível carregar o catálogo ampliado agora.</div>';
   if(meta)meta.textContent='Catálogo local temporariamente indisponível · a busca online continua disponível';
   if(more)more.hidden=true;
 }
}
async function renderGrid(){
 const g=$('#movieGrid');if(!g)return;
 if(window.CineHUBLargeCatalog){await renderLargeMovies();return;}
 const term=($('#movieSearch')?.value||'').toLowerCase().trim(),active=$('#movieChips .active')?.dataset.cat||'Todos';
 let arr=catalogo.filter(x=>active==='Todos'||x.categoria===active);
 if(term)arr=arr.filter(x=>`${x.titulo} ${x.categoria} ${x.ano}`.toLowerCase().includes(term));
 g.innerHTML=arr.length?'':'<div class="empty">Nenhum filme encontrado.</div>';arr.forEach(x=>g.appendChild(card(x,'movie')));
}
function seriesCategories(){
 const base=window.CineHUBLargeCatalog?.categories?.('series')||[];
 return [{name:'Todos',count:0},...base];
}
function setupSeriesChips(){
 const c=$('#seriesChips');if(!c)return;c.innerHTML='';
 seriesCategories().forEach((item,n)=>{
   const b=document.createElement('button');b.className='chip'+(n===0?' active':'');
   b.dataset.cat=item.name;b.textContent=item.name==='Todos'?'Todos':`${item.name.replace(/^Séries \| /,'').replace(/^Series \| /,'')} · ${item.count.toLocaleString('pt-BR')}`;
   b.onclick=e=>{ripple(e,b);$$('#seriesChips .chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');sound();renderSeries()};
   c.appendChild(b);
 });
 const h=$('#seriesScreen h1');if(h)h.innerHTML=`Séries <em class="title-count" id="seriesTitleCount">—</em>`;
}
let onlineSeriesRequest=0,seriesLargeSearch='';
async function renderSeries(){
 const term=($('#seriesSearch')?.value||'').trim().toLowerCase(),active=$('#seriesChips .active')?.dataset.cat||'Todos';
 const g=$('#seriesGrid');if(!g)return;
 try{
   let arr=[];
   if(window.CineHUBLargeCatalog){
     if(term){
       arr=await window.CineHUBLargeCatalog.search('series',term,180);
     }else if(active==='Todos'){
       arr=uniqueSeries(await window.CineHUBLargeCatalog.loadIndex('series'),180); arr=arr.map(x=>{x.imagem=x.imagem||x.banner||'imagens/sem-capa.jpg';x.banner=x.banner||x.imagem;return x});
     }else{
       const first=await window.CineHUBLargeCatalog.first(active);
       const seen=new Set();
       arr=uniqueSeries(first,180);
     }
   }else{
     arr=catalogoSeries.filter(x=>active==='Todos'||x.categoria===active);
     if(term)arr=arr.filter(x=>`${x.titulo} ${x.categoria} ${x.ano}`.toLowerCase().includes(term));
   }
   const total=window.CineHUBLargeCatalog?await window.CineHUBLargeCatalog.loadIndex('series').then(x=>x.length).catch(()=>0):arr.length;
   const tc=$('#seriesTitleCount');if(tc)tc.textContent=total.toLocaleString('pt-BR');
   g.innerHTML='';
   if(arr.length){
     arr.forEach(x=>{
       const item={...normalizeContentItem(x,'series'),ano:x.ano||'',nota:x.nota||'—',categoria:(x.categoria||'Séries').replace(/^Séries \| /,'').replace(/^Series \| /,''),temporadas:x.episodios?`${x.episodios} episódios`:x.temporadas,__seriesIndex:true};
       g.appendChild(card(item,'series'));
     });
     return;
   }
   if(term&&window.CineHUBWeb?.hasTMDB?.()){
     g.innerHTML='<div class="detail-loading">Buscando também no catálogo online…</div>';
     const req=++onlineSeriesRequest,online=await onlineSearch(term,'series');if(req!==onlineSeriesRequest)return;
     g.innerHTML='';if(online.length)online.forEach(x=>g.appendChild(card(x,'series')));else g.innerHTML='<div class="empty">Nenhuma série encontrada.</div>';
   }else g.innerHTML='<div class="empty">Nenhuma série encontrada nesta categoria.</div>';
 }catch(err){
   console.warn('[CineHUB] catálogo de séries:',err);
   g.innerHTML='<div class="empty">Não foi possível carregar o catálogo de séries agora.</div>';
 }
}
function channelGroups(){return ['Todos',...(window.canaisM3U8Grupos||[])];}
function setupChannelChips(){const c=$('#channelChips');if(!c)return;c.innerHTML='';channelGroups().forEach((cat,n)=>{const b=document.createElement('button');b.className='chip'+(n===0?' active':'');b.dataset.cat=cat;b.textContent=cat;b.onclick=e=>{ripple(e,b);$$('#channelChips .chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');sound();renderChannels()};c.appendChild(b)})}
let channelRenderRequest=0;
function logoCandidates(ch){
 const out=[]; const push=u=>{if(u&&!out.includes(u))out.push(u)};
 push(ch?.logo);
 const raw=String(ch?.nome||'').trim();
 const clean=raw.replace(/\b(HD|FHD|UHD|4K|SD|BR|BRASIL)\b/gi,' ').replace(/\s+/g,' ').trim();
 const variants=[raw,clean,raw.replace(/[.:|]/g,' ').replace(/\s+/g,' ').trim()];
 for(const name of variants){
   if(!name)continue;
   push('https://raw.githubusercontent.com/szneto/BrazilTVLogos/main/img/'+encodeURIComponent(name)+'.png');
   const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
   if(slug)push('https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/brazil/'+slug+'-br.png');
 }
 return out.length?out:['imagens/sem-capa.jpg'];
}
function setLogoFallback(img,candidates){
 let i=Number(img.dataset.logoTry||0);
 const next=()=>{i++;img.dataset.logoTry=String(i);if(i<candidates.length){img.src=candidates[i];return}img.src='imagens/sem-capa.jpg';img.onerror=null};
 img.onerror=next;
 img.src=candidates[0]||'imagens/sem-capa.jpg';
}
function channelCard(ch){
 const d=document.createElement('article');d.className='channel glass press';
 const candidates=logoCandidates(ch), logo=candidates[0]||'imagens/sem-capa.jpg',nn=window.CineHUBEPG?.forChannel?.(ch)||{};
 const cur=nn.current,next=nn.next,cat=ch.grupo||'Geral';
 d.innerHTML=`<div class="channel-top"><div class="channel-logo-wrap"><img class="channel-logo" loading="lazy" decoding="async" src="${esc(logo)}" alt="${esc(ch.nome)}"></div><span class="live-dot"><i></i> AO VIVO</span></div><div class="channel-title-row"><span class="channel-tv-icon">TV</span><h3>${esc(ch.nome)}</h3></div><div class="channel-meta-line"><span class="pill">${esc(cat)}</span><span class="pill ${cur?'epg-live':''}">${cur?'EPG disponível':'EPG indisponível'}</span></div><div class="channel-now">${cur?`Agora · ${esc(cur.title)}`:'Programação não informada'}${next?`<small>Próximo · ${esc(next.title)}</small>`:''}</div><button class="primary press channel-watch">▶ Assistir agora</button>`;
 setLogoFallback(d.querySelector('img'),candidates);
 d.onclick=e=>{ripple(e,d);guardAdult(ch,()=>openLiveChannel(ch))};
 return d;
}
function renderGuide(){
 const g=$('#tvGuideGrid'),meta=$('#tvGuideMeta');if(!g)return;
 const programmes=window.CineHUBEPG?.state?.programmes;
 if(!programmes||!programmes.size){g.innerHTML='<div class="empty">A guia será exibida quando algum EPG carregar com sucesso.</div>';return}
 const rows=[];
 for(const ch of (window.canaisM3U8||[])){
  const nn=window.CineHUBEPG.forChannel(ch);if(nn.current||nn.next)rows.push({ch,nn});
 }
 rows.sort((a,b)=>String(a.ch.nome).localeCompare(String(b.ch.nome),'pt-BR'));
 g.innerHTML=rows.length?'':'<div class="empty">Nenhum canal compatível com a guia neste momento.</div>';
 rows.slice(0,160).forEach(({ch,nn})=>{
  const d=document.createElement('article');d.className='guide-channel glass press';
  d.innerHTML=`<div class="guide-channel-head"><img src="${esc(ch.logo||'imagens/sem-capa.jpg')}" alt="" loading="lazy"><div><strong>${esc(ch.nome)}</strong><span>${esc(ch.grupo||'Geral')}</span></div><span class="live-dot"><i></i> AO VIVO</span></div><div class="guide-program current"><b>${nn.current?'Agora':'—'}</b><span>${esc(nn.current?.title||'Sem programa informado')}</span></div>${nn.next?`<div class="guide-program"><b>Próx.</b><span>${esc(nn.next.title)}</span></div>`:''}<button class="secondary press full guide-watch">▶ Assistir agora</button>`;
  d.querySelector('.guide-watch').onclick=e=>{e.stopPropagation();guardAdult(ch,()=>openLiveChannel(ch))};
  d.onclick=e=>{if(e.target.closest('button'))return;guardAdult(ch,()=>openLiveChannel(ch))};
  g.appendChild(d);
 });
 if(meta)meta.textContent=`${window.CineHUBEPG.state.matchedChannels||programmes.size} canais com EPG · os demais continuam disponíveis na aba Canais`;
}
function renderPopularChannels(){
 const box=$('#popularChannels'); if(!box)return;
 const all=window.canaisM3U8||[], wanted=['gloob','nickelodeon teen','record'];
 const picked=[]; const seen=new Set();
 for(const key of wanted){const ch=all.find(c=>{const n=String(c.nome||'').toLowerCase();return n.includes(key)&&!seen.has(c)}); if(ch){picked.push(ch);seen.add(ch)}}
 box.innerHTML=''; if(!picked.length){box.hidden=true;return} box.hidden=false;
 picked.forEach(ch=>box.appendChild(channelCard(ch)));
}
function setTvTab(tab){
 state.tvTab=tab;
 $$('#tvTabs .tv-tab').forEach(b=>b.classList.toggle('active',b.dataset.tvTab===tab));
 $$('.tv-panel').forEach(p=>p.classList.toggle('active',(tab==='channels'&&p.id==='tvChannelsPanel')||(tab==='guide'&&p.id==='tvGuidePanel')));
 if(tab==='guide')renderGuide();
}
let channelVisibleLimit=80;
function renderChannels(){
 const g=$('#channelGrid'),more=$('#channelMore');if(!g)return;
 const q=($('#channelSearch')?.value||'').trim().toLowerCase();
 const cat=$('#channelChips .active')?.dataset.cat||'Todos';
 let arr=cat==='Todos'?(window.canaisM3U8||[]):(window.canaisM3U8||[]).filter(ch=>ch.grupo===cat);
 if(q)arr=arr.filter(ch=>`${ch.nome} ${ch.grupo}`.toLowerCase().includes(q));
 channelVisibleLimit=q?160:80;
 g.innerHTML='';
 if(!arr.length){g.innerHTML='<div class="empty">Nenhum canal encontrado.</div>';if(more)more.hidden=true;return}
 $('#tvNowTitle').textContent=`${arr.length.toLocaleString('pt-BR')} canais disponíveis`;
 $('#tvNowMeta').textContent=`${cat==='Todos'?'Todas as categorias':cat} · toque em um canal para assistir`;
 const visible=arr.slice(0,channelVisibleLimit),frag=document.createDocumentFragment();
 visible.forEach(ch=>frag.appendChild(channelCard(ch)));g.appendChild(frag);
 if(more){more.hidden=arr.length<=channelVisibleLimit;more.textContent=`Mostrar mais · ${Math.min(80,arr.length-channelVisibleLimit)} canais`;}
}
function openLiveChannel(ch){
 const nn=window.CineHUBEPG?.forChannel?.(ch)||{},rows=window.CineHUBEPG?.guide?.(ch,8)||[];
 $('#tvDetailTitle').textContent=ch.nome;
 const schedule=rows.length?rows.map(p=>`<div class="program-row epg-row"><b>${new Date(p.start).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</b><span>${esc(p.title)}${p.desc?`<small>${esc(p.desc)}</small>`:''}</span></div>`).join(''):'<div class="empty">EPG ainda não disponível para este canal.</div>';
 $('#tvDetailContent').innerHTML=`<div class="channel-detail-head"><div class="channel-detail-logo"><img id="tvDetailLogoImg" src="${esc((logoCandidates(ch)[0]||'imagens/sem-capa.jpg'))}" alt=""></div><div><span class="eyebrow">${nn.current?'AO VIVO · EPG':'AO VIVO'}</span><h3>${esc(ch.grupo||'Programação')}</h3></div></div><div class="channel-schedule"><div class="setting-group"><h3>${nn.current?`Agora · ${esc(nn.current.title)}`:'Programação'}</h3>${nn.next?`<p class="epg-next-line">Próximo · ${esc(nn.next.title)}</p>`:''}${schedule}</div></div><div class="form-actions"><button class="primary press full" id="watchLiveChannel">▶ Assistir ao vivo</button></div><small class="web-source">As fontes alternativas permanecem dentro do player.</small>`;
 openSheet('tvDetailSheet');
 setLogoFallback($('#tvDetailLogoImg'),logoCandidates(ch));
 $('#watchLiveChannel').onclick=()=>{close('tvDetailSheet');setTimeout(()=>playLiveChannel(ch),70)};
}
function loadHLS(){
 if(window.Hls)return Promise.resolve(window.Hls);
 if(window.__cinehubHlsPromise)return window.__cinehubHlsPromise;
 window.__cinehubHlsPromise=new Promise((resolve,reject)=>{
   const s=document.createElement('script');
   s.src='https://cdn.jsdelivr.net/npm/hls.js@1.6.2/dist/hls.min.js';
   s.async=true;
   s.onload=()=>window.Hls?resolve(window.Hls):reject(new Error('HLS indisponível'));
   s.onerror=()=>reject(new Error('HLS indisponível'));
   document.head.appendChild(s);
 });
 return window.__cinehubHlsPromise;
}

function playLiveChannel(ch){
 state.liveChannel=ch;state.current=null;state.currentType='live';
 const frame=$('#megaPlayer'),video=$('#video'),loading=$('#playerLoading');if(!video)return;
 clearTimeout(state.playerTimer);hidePlayerFallback();
 if(frame){frame.src='about:blank';frame.style.display='none'}
 if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}
 video.style.display='block';video.controls=true;video.muted=false;video.autoplay=true;video.playsInline=true;
 loading?.classList.remove('hide');if(loading)loading.querySelector('p').textContent=`Conectando a ${ch.nome}…`;
 $('#playerMeta').textContent=`${ch.nome} · ${ch.grupo||'Ao vivo'}`;$('#player').classList.add('active');setPlayerMode(true);sound('open');
 const rawSources=(Array.isArray(ch.sources)?ch.sources.map(x=>typeof x==='string'?x:x?.url).filter(Boolean):[]);if(!rawSources.length&&ch.stream)rawSources.push(ch.stream); const sources=playbackCandidates(rawSources); renderPlayerSources(ch,sources);
 let index=0;
 const fallback=()=>{if(index+1<sources.length){index++;connect(index);return false}return true};
 const connect=(i)=>{
   const url=sources[i]; if(!url){showPlayerFallback('Nenhuma fonte de reprodução válida foi encontrada.');return}
   if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}
   video.pause();video.removeAttribute('src');video.load();
   loading?.classList.remove('hide');if(loading)loading.querySelector('p').textContent=sources.length>1?`Conectando à fonte ${i+1}/${sources.length}…`:`Conectando a ${ch.nome}…`;
   if(video.canPlayType('application/vnd.apple.mpegurl')){
     video.src=url;video.onloadedmetadata=()=>{loading?.classList.add('hide');video.play().catch(()=>{})};
     video.onerror=()=>{if(fallback())showPlayerFallback('O stream não pôde ser reproduzido neste navegador.',url)};
   }else{
     loadHLS().then(H=>{
       if(!H?.isSupported?.()){showPlayerFallback('Este navegador não oferece suporte a HLS.',url);return}
       const hls=new H({enableWorker:true,lowLatencyMode:true,maxBufferLength:12,backBufferLength:8});state.hls=hls;hls.loadSource(url);hls.attachMedia(video);
       hls.on(H.Events.MANIFEST_PARSED,()=>{loading?.classList.add('hide');video.play().catch(()=>{})});
       hls.on(H.Events.ERROR,(_,data)=>{if(data?.fatal){try{hls.destroy()}catch{}state.hls=null;if(fallback())showPlayerFallback('O servidor do canal recusou ou interrompeu a transmissão.',url);}});
     }).catch(()=>{if(fallback())showPlayerFallback('O módulo de reprodução HLS não pôde ser carregado neste navegador.',url)});
   }
 };
 connect(0);
 store.set('cinehub_last_channel',{nome:ch.nome,logo:ch.logo,grupo:ch.grupo,stream:ch.stream,sources:sources,at:Date.now()});
}

let globalSearchRequest=0,globalSearchTimer=0;
function renderSearchResultItem(x){
 const d=document.createElement('article');d.className='search-result glass press';
 const type=x.__type==='Série'?'series':'movie';
 d.innerHTML=`<img src="${x.imagem||'imagens/sem-capa.jpg'}" alt="${x.titulo}" loading="lazy" decoding="async"><div><h3>${x.titulo}</h3><p>${x.__type} • ${x.ano||'—'} • ${x.categoria||'—'}${x.__online?' • Online':''}</p></div><b>›</b>`;
 safeImg(d.querySelector('img'));d.onclick=e=>{ripple(e,d);guardAdult(x,()=>openDetail(x,type))};return d;
}
async function renderGlobalSearch(term=''){
 const q=term.trim(),out=$('#globalResults');if(!out)return;
 clearTimeout(globalSearchTimer);
 if(!q){out.innerHTML='<div class="empty">Comece digitando um filme ou uma série.</div>';return}
 const localBase=[...catalogo.map(x=>({...x,__type:'Filme'})),...catalogoSeries.map(x=>({...x,__type:'Série'}))];
 const local=localBase.filter(x=>`${x.titulo} ${x.categoria} ${x.ano}`.toLowerCase().includes(q.toLowerCase())).slice(0,20);
 if(local.length){out.innerHTML='';local.forEach(x=>out.appendChild(renderSearchResultItem(x)));return}
 if(window.CineHUBExternalSources?.loadCatalog){
   try{
     const ext=window.CineHUBExternalCatalog||((await window.CineHUBExternalSources.loadCatalog()).ok?window.CineHUBExternalCatalog:[]);
     const hit=(ext||[]).filter(x=>`${x.titulo} ${x.categoria}`.toLowerCase().includes(q.toLowerCase())).slice(0,24);
     if(hit.length){out.innerHTML='';const n=document.createElement('div');n.className='online-notice';n.innerHTML='<span class="online-dot"></span><span>Resultados da lista integrada</span>';out.appendChild(n);hit.forEach(x=>out.appendChild(renderSearchResultItem({...x,__type:x.tipo==='series'?'Série':'Filme'})));return}
   }catch(_){}
 }
 if(window.CineHUBLargeCatalog){
   try{
     const [movies,series]=await Promise.all([CineHUBLargeCatalog.search('movie',q,12),CineHUBLargeCatalog.search('series',q,12)]);
     const merged=[...movies.map(x=>({...x,__type:'Filme'})),...series.map(x=>({...x,__type:'Série',__seriesIndex:true}))];
     if(merged.length){out.innerHTML='';const n=document.createElement('div');n.className='online-notice';n.innerHTML='<span class="online-dot"></span><span>Resultados do catálogo CineHUB</span>';out.appendChild(n);merged.slice(0,24).forEach(x=>out.appendChild(renderSearchResultItem(x)));return}
   }catch(_){}
 }
 out.innerHTML='<div class="detail-loading">Pesquisando também no catálogo online…</div>';
 const req=++globalSearchRequest;
 const run=async()=>{
   if(!CineHUBWeb?.hasTMDB?.()){if(req===globalSearchRequest)out.innerHTML='<div class="empty">O catálogo online está temporariamente indisponível. Tente novamente.</div>';return}
   try{
     const [movies,series]=await Promise.all([CineHUBWeb.searchTMDBResults(q,'movie',1),CineHUBWeb.searchTMDBResults(q,'series',1)]);
     if(req!==globalSearchRequest)return;
     const merged=[
       ...(movies.results||[]).slice(0,10).map(r=>({...CineHUBWeb.tmdbItem(r,'movie'),__type:'Filme'})),
       ...(series.results||[]).slice(0,10).map(r=>({...CineHUBWeb.tmdbItem(r,'series'),__type:'Série'}))
     ].filter(x=>x.imagem).sort((a,b)=>(Number(b.nota)||0)-(Number(a.nota)||0));
     out.innerHTML='';
     if(!merged.length){out.innerHTML='<div class="empty">Nenhum resultado encontrado online.</div>';return}
     const n=document.createElement('div');n.className='online-notice';n.innerHTML=`<span class="online-dot"></span><span>${merged.length} resultados do catálogo online</span>`;out.appendChild(n);
     merged.forEach(x=>out.appendChild(renderSearchResultItem(x)));
   }catch{if(req===globalSearchRequest)out.innerHTML='<div class="empty">Não foi possível consultar o catálogo online agora.</div>'}
 };
 globalSearchTimer=setTimeout(run,280);
}
function openSearch(){openScreen('searchScreen');setTimeout(()=>$('#globalSearch').focus(),120)}

function openSheet(id){sound('open');$$('.sheet.active').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active');document.body.style.overflow='hidden'}
function profile(){renderMe();openSheet('meSheet')}
function renderMe(){const user=store.get('cinehub_user',null),s=stats(),favCount=favs().length,box=$('#meContent');if(!user){box.innerHTML=`<div class="login-box"><div class="user-hero"><div class="avatar">◉</div><div><h3>Entre no CineHUB</h3><p>Salve sua experiência neste aparelho.</p></div></div><div class="setting-group"><h3>Login local</h3><input class="field" id="loginName" placeholder="Seu nome"><input class="field" id="loginEmail" type="email" placeholder="Seu e-mail"><div class="form-actions"><button class="primary press full" id="loginBtn">Entrar</button></div><p class="login-note">Este login é local e não envia seus dados para um servidor. Ele prepara a base para a futura conta online.</p></div></div>`;$('#loginBtn').onclick=login;translateCommon();return}const loginDate=new Date(user.dataLogin||Date.now()).toLocaleDateString(currentLang()==='pt'?'pt-BR':currentLang()==='es'?'es-ES':'en-US');const initials=(user.nome||'C').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();box.innerHTML=`<div class="user-hero"><div class="avatar">${initials||'C'}</div><div><h3>${user.nome}</h3><p>${user.email}</p><p>Entrou em ${loginDate}</p></div></div><div class="stats"><div class="stat"><b>${s.watched||0}</b><span>Filmes assistidos</span></div><div class="stat"><b>${favCount}</b><span>Na Minha Lista</span></div><div class="stat"><b>${s.lastWatched?'1':'0'}</b><span>Último título</span></div></div><div class="setting-group"><h3>Conta</h3><button class="setting-row" id="profileConfig"><span>⚙ Configurações<small>Idioma e preferências</small></span><b>›</b></button><button class="setting-row" id="profilePremium"><span>✦ Premium<small>Conheça o futuro do CineHUB</small></span><b>›</b></button></div><div class="form-actions"><button class="secondary press full" id="logoutBtn">Sair da conta</button></div>`;$('#profileConfig').onclick=()=>{close('meSheet');setTimeout(()=>openSheet('configSheet'),80)};$('#profilePremium').onclick=()=>{close('meSheet');setTimeout(()=>openSheet('premiumSheet'),80)};$('#logoutBtn').onclick=()=>{localStorage.removeItem('cinehub_user');renderMe();toast('Sessão encerrada.')};translateCommon()}
function login(){const nome=$('#loginName').value.trim(),email=$('#loginEmail').value.trim();if(!nome||!email||!email.includes('@')){sound('error');toast('Informe um nome e um e-mail válido.');return}store.set('cinehub_user',{nome,email,dataLogin:Date.now()});sound('open');renderMe();toast('Login local criado com sucesso.')}
function renderSettings(){
 const l=currentLang(), has=window.CineHUBWeb?.hasTMDB?.();
 $('#settingsContent').innerHTML=`<div class="setting-group"><h3>Modo de navegação</h3><div class="lang-options"><button class="lang-option ${cinehubMode()==='performance'?'active':''}" id="modePerformance"><span>⚡ Performance</span><span>${cinehubMode()==='performance'?'Ativo':''}</span></button><button class="lang-option ${cinehubMode()==='advanced'?'active':''}" id="modeAdvanced"><span>✦ Avançado</span><span>${cinehubMode()==='advanced'?'Ativo':''}</span></button></div></div><div class="setting-group"><h3>Idioma</h3><div class="lang-options"><button class="lang-option ${l==='pt'?'active':''}" data-lang="pt"><span>🇧🇷 Português</span><span>${l==='pt'?'Ativo':''}</span></button><button class="lang-option ${l==='es'?'active':''}" data-lang="es"><span>🇪🇸 Español</span><span>${l==='es'?'Activo':''}</span></button><button class="lang-option ${l==='en'?'active':''}" data-lang="en"><span>🇺🇸 English</span><span>${l==='en'?'Active':''}</span></button></div></div><div class="setting-group"><h3>Conta</h3><button class="setting-row" id="configMe"><span>◉ Meu perfil<small>Dados e estatísticas da sua conta</small></span><b>›</b></button><button class="setting-row" id="configPremium"><span>✦ Premium<small>Assinaturas serão adicionadas futuramente</small></span><b>›</b></button></div>`;
 $$('.lang-option').forEach(btn=>btn.onclick=e=>{ripple(e,btn);store.set('cinehub_lang',btn.dataset.lang);applyLang();translateCommon();renderSettings();toast(currentLang()==='en'?'Language updated.':currentLang()==='es'?'Idioma actualizado.':'Idioma atualizado.')});
 $('#modePerformance')?.addEventListener('click',e=>{sound('open');setCineHUBMode('performance');renderSettings()});
 $('#modeAdvanced')?.addEventListener('click',e=>{sound('open');setCineHUBMode('advanced');renderSettings()});
 $('#configMe').onclick=()=>{close('configSheet');setTimeout(profile,80)};
 $('#configPremium').onclick=()=>{close('configSheet');setTimeout(()=>openSheet('premiumSheet'),80)};
 translateCommon();
}
function openConfig(){renderSettings();openSheet('configSheet')}
function openPlaybackFromDetail(){
 const item=state.current;if(!item)return;
 const type=state.currentType||'movie';
 if(type!=='series'){playCurrent({type:'movie'});return}
 const season=parseInt($('#seriesSeason')?.value||1,10)||1;
 const episode=parseInt($('#seriesEpisode')?.value||1,10)||1;
 // close(detail) clears state.current; preserve the selected title explicitly.
 state.current={...item};state.currentType='series';
 close('detail');
 state.current={...item};state.currentType='series';
 setTimeout(()=>playCurrent({type:'series',season,episode}),70);
}

function showPlayerFallback(message,url){
 const box=$('#playerFallback'),txt=$('#playerFallbackText');
 if(txt)txt.textContent=message||'A fonte externa não respondeu dentro do CineHUB.';
 if(box)box.hidden=false;
 $('#playerLoading')?.classList.add('hide');
}
function hidePlayerFallback(){const box=$('#playerFallback');if(box)box.hidden=true}
async function togglePlayerFullscreen(){
 const frame=$('#playerFrame');if(!frame)return;
 try{
   if(document.fullscreenElement){await document.exitFullscreen();return}
   if(frame.requestFullscreen)await frame.requestFullscreen();
   else if(frame.webkitRequestFullscreen)frame.webkitRequestFullscreen();
   else toast('Tela cheia não é suportada neste navegador.');
   sound('open');
 }catch{toast('Não foi possível expandir o player neste navegador.')}
}
async function resolveSeriesEpisode(item,season,episode){
 if(!item?.__seriesIndex||!Array.isArray(item.files)||!item.files.length)return item;
 const wanted=item.titulo.trim();
 const escaped=wanted.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const re=new RegExp(`^${escaped}\\s*S0?${season}\\s*E0?${episode}(?:\\s|$)`,'i');
 const found=[];
 for(const file of item.files){
   try{
     const r=await fetch(`dados/conteudo/catalogo/${file}`,{cache:'force-cache'});if(!r.ok)continue;
     const lines=(await r.text()).split(/\r?\n/);
     for(let i=0;i<lines.length;i++){
       const l=lines[i];if(!l.startsWith('#EXTINF'))continue;
       const comma=l.indexOf(','),title=comma>=0?l.slice(comma+1).trim():'';
       if(re.test(title.replace(/\s+/g,' ').trim())){
         const url=(lines[i+1]||'').trim();if(url&&!url.startsWith('#'))found.push(url);
       }
     }
   }catch(_){}
 }
 if(found.length)return {...item,stream:found[0],sources:[...new Set(found)]};
 return item;
}
function renderPlayerSources(item,sources){
 const meta=$('#playerMeta');if(!meta)return;
 const unique=[...new Set((sources||[]).filter(Boolean))];
 const label=esc(item?.titulo||item?.nome||'Conteúdo');
 if(unique.length<=1){meta.innerHTML=`<span>${label}${item?.categoria?` · ${esc(item.categoria)}`:''}</span>`;return}
 meta.innerHTML=`<div class="player-source-bar"><strong>${label}</strong><span>Fontes internas</span><div class="player-source-list">${unique.map((u,i)=>`<button class="player-source-btn press${i===0?' active':''}" data-source-index="${i}">Fonte ${i+1}</button>`).join('')}</div></div>`;
 $$('#playerMeta .player-source-btn').forEach(btn=>btn.onclick=()=>{
   const i=Number(btn.dataset.sourceIndex)||0;
   $$('#playerMeta .player-source-btn').forEach(x=>x.classList.toggle('active',x===btn));
   playDirectSources(item,unique,i);
 });
}
async function playInternalEmbedFallback(item,type,season=1,episode=1){
 const frame=$('#megaPlayer'),video=$('#video'),loading=$('#playerLoading'); if(!frame)return false;
 const candidates=window.CineHUBMegaEmbed?.candidates?.(type,item,season,episode)||[];
 if(!candidates.length)return false;
 if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}
 if(video){video.pause();video.removeAttribute('src');video.load();video.style.display='none'}
 frame.style.display='block'; frame.src='about:blank'; loading?.classList.remove('hide');
 if(loading)loading.querySelector('p').textContent='Preparando reprodução interna…';
 let i=0;
 const next=()=>{if(i>=candidates.length){showPlayerFallback('Nenhuma fonte interna respondeu para este conteúdo.');return} const u=candidates[i++]; frame.src=u; clearTimeout(state.embedTimer); state.embedTimer=setTimeout(()=>{if(i<candidates.length)next();else showPlayerFallback('A reprodução interna não respondeu.');},12000)};
 frame.onload=()=>{clearTimeout(state.embedTimer);loading?.classList.add('hide')}; next();
 return true;
}
function playbackCandidates(sources){
 const out=[]; for(const raw of sources||[]){const u=String(raw||'').trim(); if(!u)continue; out.push(u); if(/^http:\/\//i.test(u))out.push(u.replace(/^http:\/\//i,'https://'));}
 return [...new Set(out)];
}
function playDirectSources(item,sources,index=0){
 const video=$('#video'),frame=$('#megaPlayer'),loading=$('#playerLoading');if(!video)return;
 const url=sources[index];if(!url)return;
 if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}
 if(frame){frame.src='about:blank';frame.style.display='none'}
 video.style.display='block';video.controls=true;video.autoplay=true;video.playsInline=true;
 loading?.classList.remove('hide');if(loading)loading.querySelector('p').textContent=`Preparando fonte ${index+1}…`;
 const done=()=>{loading?.classList.add('hide');video.play().catch(()=>{})};
 const fail=()=>{if(index+1<sources.length)playDirectSources(item,sources,index+1);else playInternalEmbedFallback(item,state.currentType||'movie',Number($('#seriesSeason')?.value||1),Number($('#seriesEpisode')?.value||1)).catch(()=>showPlayerFallback('A fonte não pôde ser reproduzida dentro do CineHUB.'))};
 video.onerror=null;video.onloadedmetadata=null;
 if(/\.m3u8(?:\?|$)/i.test(url)&&!video.canPlayType('application/vnd.apple.mpegurl')){
   loadHLS().then(H=>{if(!H?.isSupported?.()){fail();return}
     const h=new H({enableWorker:true,lowLatencyMode:false,maxBufferLength:18,backBufferLength:8});state.hls=h;h.loadSource(url);h.attachMedia(video);
     h.on(H.Events.MANIFEST_PARSED,done);h.on(H.Events.ERROR,(_,d)=>{if(d?.fatal){try{h.destroy()}catch{}fail()}});
   }).catch(fail);
 }else{video.src=url;video.onloadedmetadata=done;video.onerror=fail}
 renderPlayerSources(item,sources);
 store.set('cinehub_last_played',{titulo:item.titulo,type:state.currentType||'movie',at:Date.now(),provider:url});
}
async function playCurrent(opts={}){
 let item=state.current;if(!item)return;
 const type=opts.type||state.currentType||'movie';
 const season=Math.max(1,parseInt(opts.season||1,10)||1),episode=Math.max(1,parseInt(opts.episode||1,10)||1);
 if(type==='series'&&item.__seriesIndex&&!item.stream){
   $('#playerLoading')?.classList.remove('hide');
   if($('#playerLoading'))$('#playerLoading p').textContent=`Localizando T${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}…`;
   item=await resolveSeriesEpisode(item,season,episode);
   state.current={...state.current,...item};
 }
 const frame=$('#megaPlayer'),local=$('#video'),loading=$('#playerLoading');if(!frame)return;
 sound('open');
 if(local){local.pause();local.removeAttribute('src');local.load();local.style.display='none';local.onerror=null;local.onloadedmetadata=null}
 hidePlayerFallback();frame.style.display='block';
 const directSources=[...(Array.isArray(item.sources)?item.sources:[]),item.stream,item.video].filter(Boolean);
 const uniqueSources=playbackCandidates(directSources);
 if(uniqueSources.length&&(type==='movie'||type==='live'||type==='series')){
   $('#player').classList.add('active');setPlayerMode(true);playDirectSources(item,uniqueSources,0);
   store.set('cinehub_progress',{titulo:item.titulo,imagem:item.imagem,banner:item.banner||item.imagem,tempo:0,duracao:100,type,season,episode,at:Date.now(),provider:uniqueSources[0]});
   bumpWatched(item);return;
 }
 const candidates=window.CineHUBMegaEmbed?.candidates?.(type,item,season,episode)||[];
 const url=candidates[0]||'';
 if(!url){showPlayerFallback('Não encontramos uma fonte interna para este título.');sound('error');return}
 frame.src='about:blank';
 if(loading){loading.classList.remove('hide');loading.querySelector('p').textContent=type==='series'?`Preparando T${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}…`:'Preparando reprodução…'}
 $('#player').classList.add('active');setPlayerMode(true);renderPlayerSources(item,[url]);

 let settled=false;const ready=()=>{settled=true;clearTimeout(state.playerTimer);loading?.classList.add('hide')};
 clearTimeout(state.playerTimer);state.playerTimer=setTimeout(()=>{if(settled)return;showPlayerFallback('A fonte não terminou de carregar dentro do CineHUB.',url)},10000);
 frame.onload=ready;frame.src=url;
 if(type==='series')store.set('cinehub_last_episode',{titulo:item.titulo,season,episode});
 store.set('cinehub_last_played',{titulo:item.titulo,type,season,episode,at:Date.now(),provider:url});
 store.set('cinehub_progress',{titulo:item.titulo,imagem:item.imagem,banner:item.banner||item.imagem,tempo:0,duracao:100,type,season,episode,at:Date.now(),provider:url});
 bumpWatched(item);
}

function setDockActive(name){$$('.dock-btn').forEach(x=>x.classList.toggle('active',x.dataset.dock===name));const pill=$('.dock-pill');const map={home:0,community:1,config:2};pill.style.transform=`translateX(calc(${map[name]||0} * 100%))`}
function initAudioUnlock(){
 document.addEventListener('pointerdown',()=>{
   try{
     if(state.audio && state.audio.state==='suspended')state.audio.resume().catch(()=>{});
     if(window.cinehubSplashPending){
       window.cinehubSplashPending=false;
       sound('open');
     }
   }catch{}
 },{passive:true,once:false});
}
function bind(){
 document.addEventListener('pointerdown',e=>{const el=e.target.closest('.press,.icon-btn,.dock-btn,.chip,.setting-row,.lang-option');if(el)ripple(e,el)},{passive:true});
 document.addEventListener('click',e=>{
  const screen=e.target.closest('[data-screen]');if(screen){const s=screen.dataset.screen;if(s==='movies'||s==='series'||s==='tv')openScreen(s==='movies'?'moviesScreen':s==='series'?'seriesScreen':'tvScreen')}
  const dock=e.target.closest('[data-dock]');if(dock){const d=dock.dataset.dock;setDockActive(d);if(d==='home'){showTransitionLoading('Voltando ao CineHUB…',150);close('moviesScreen');close('seriesScreen');close('tvScreen');close('searchScreen');close('detail');close('meSheet');close('discordSheet');close('configSheet');close('tvDetailSheet');close('premiumSheet');close('projectSheet');window.scrollTo({top:0,behavior:'smooth'})}if(d==='community')openSheet('discordSheet');if(d==='config')openConfig()}
  const closeBtn=e.target.closest('[data-close]');if(closeBtn)close(closeBtn.dataset.close);
  if(e.target.closest('[data-action="search"]'))openSearch();if(e.target.closest('[data-action="profile"]'))profile();if(e.target.closest('[data-action="premium"]'))openSheet('premiumSheet');if(e.target.closest('[data-action="project"]'))openSheet('projectSheet');
  const pressTarget=e.target.closest('.press,.icon-btn,.dock-btn,.chip,.setting-row,.lang-option,.mode-option');
  if(pressTarget){
    setTimeout(()=>{
      try{
        const now=state.audio?.currentTime??0;
        if(!state.lastSoundAt || now-state.lastSoundAt>.085){
          sound(e.target.closest('[data-close]')?'close':'tap');
        }
      }catch{}
    },0);
  }
 });
 const on=(sel,event,fn)=>{const el=$(sel);if(el)el.addEventListener(event,fn);};
 on('#detailFav','click',()=>state.current&&toggleFav(state.current,state.currentType));
 on('#choosePerformance','click',()=>{sound('open');setCineHUBMode('performance');close('welcomeModal')});
 on('#chooseAdvanced','click',()=>{sound('open');setCineHUBMode('advanced');close('welcomeModal')});
 on('#guideGoConfig','click',()=>{close('guideSheet');setTimeout(openConfig,80)});
 on('#playerFullscreen','click',togglePlayerFullscreen);
 on('#detailPlay','click',()=>openPlaybackFromDetail());
 on('#playerRetry','click',()=>{if(state.current)playCurrent({type:state.currentType||'movie',season:parseInt($('#seriesSeason')?.value||1,10)||1,episode:parseInt($('#seriesEpisode')?.value||1,10)||1});});
 on('#tvRefresh','click',async()=>{sound('open');const b=$('#tvRefresh');if(b)b.disabled=true;toast('Atualizando listas…');await window.CineHUBExternalSources?.loadSaimo?.();await window.CineHUBExternalSources?.loadIptv?.({remote:true,local:false});if(b)b.disabled=false;setupChannelChips();renderChannels();renderPopularChannels();toast('Listas atualizadas.')});
 on('#tvEpgSource','click',async()=>{const b=$('#tvEpgSource');const current=window.CineHUBEPG?.state?.source==='iptvcom'?'saimo':'iptvcom';window.CineHUBEPG?.setSource(current);if(b)b.textContent=current==='iptvcom'?'EPG: Brasil':'EPG: Principal';toast('Atualizando guia…');await window.CineHUBEPG?.load?.(window.canaisM3U8||[],true);renderChannels()});
 window.addEventListener('cinehub:epg-updated',e=>{const b=$('#tvEpgSource');if(b)b.textContent=(window.CineHUBEPG?.state?.source==='iptvcom')?'EPG: Brasil':'EPG: Principal';const count=Number(e.detail?.count||0);const tab=$('#tvGuideTab');if(tab){tab.hidden=count<=0;$('#tvGuideCount').textContent=count>0?`· ${count}`:'';}if($('#tvScreen')?.classList.contains('active')){renderChannels();if(state.tvTab==='guide')renderGuide()}if(count>0)sound('success')});

 on('#tvExternalSources','click',async()=>{sound('open');const b=$('#tvExternalSources');if(!b)return;b.disabled=true;b.textContent='Carregando fontes…';toast('Carregando listas sem travar a interface…');const r=await window.CineHUBExternalSources?.loadIptv?.({remote:true,local:true});b.disabled=false;b.textContent='＋ Fontes externas';setupChannelChips();renderChannels();renderPopularChannels();toast(r?.ok?`Fontes integradas: +${(r.count||0).toLocaleString('pt-BR')} entradas`:'Não foi possível carregar as fontes externas.');});
 window.addEventListener('cinehub:sources-updated',()=>{if(!$('#tvScreen')?.classList.contains('active'))return;const loading=Number(window.CineHUBExternalSources?.state?.activeLoads||0)>0;if(loading){const count=(window.canaisM3U8||[]).length;const title=$('#tvNowTitle');if(title)title.textContent=`${count.toLocaleString('pt-BR')} canais carregados`;if(!$('#channelGrid')?.childElementCount)renderChannels();return}setupChannelChips();renderChannels();renderPopularChannels()});
 on('#tvGuideTab','click',()=>{sound('open');setTvTab('guide')});
 on('#tvChannelsTab','click',()=>{sound('tap');setTvTab('channels')});
 on('#movieMore','click',async()=>{const cat=largeMovieCategory;if(!cat||cat==='__featured')return;const meta=window.CineHUBLargeCatalog.manifest[cat];if(!meta)return;const chunk=await window.CineHUBLargeCatalog.next(cat);if(!chunk.length){$('#movieMore').hidden=true;return}const items=largeMovieSearch?chunk.filter(x=>`${x.titulo} ${x.categoria}`.toLowerCase().includes(largeMovieSearch)):chunk;const g=$('#movieGrid');items.slice(0,120).forEach(x=>g.appendChild(card(x,'movie')));$('#movieCatalogMeta').textContent=`${cat.replace(/^Filmes \| /,'')} · carregando sob demanda · ${meta.count.toLocaleString('pt-BR')} títulos`;if((window.CineHUBLargeCatalog.manifest[cat]?.files||[]).length<=1)$('#movieMore').hidden=true});
 on('#movieReload','click',()=>{window.CineHUBLargeCatalog?.clear?.();setupMovieChips();renderGrid()});
 on('#channelSearch','input',renderChannels);
 on('#channelMore','click',()=>{const g=$('#channelGrid'),q=($('#channelSearch')?.value||'').trim().toLowerCase(),cat=$('#channelChips .active')?.dataset.cat||'Todos';let arr=(window.canaisM3U8||[]).filter(ch=>cat==='Todos'||ch.grupo===cat);if(q)arr=arr.filter(ch=>`${ch.nome} ${ch.grupo}`.toLowerCase().includes(q));const more=$('#channelMore');const next=arr.slice(channelVisibleLimit,channelVisibleLimit+80);next.forEach(ch=>g.appendChild(channelCard(ch)));channelVisibleLimit+=next.length;if(channelVisibleLimit>=arr.length)more.hidden=true});
 setupChannelChips();
 on('#movieSearch','input',renderGrid);
 on('#seriesSearch','input',renderSeries);
 on('#globalSearch','input',e=>renderGlobalSearch(e.target.value));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAllScreens()}});
}
function init(){try{Object.keys(localStorage).filter(k=>/tmdb.*token|token.*tmdb/i.test(k)).forEach(k=>localStorage.removeItem(k))}catch{};initAudioUnlock();applyLang();translateCommon();renderHome();setupMovieChips();setupSeriesChips();bind();clearInterval(state.heroTimer);state.heroTimer=setInterval(()=>{if(document.visibilityState==='visible'&&!document.body.classList.contains('player-active'))hero(state.hero+1)},12000);window.cinehubSplashPending=true;setTimeout(()=>$('#splash').classList.add('hide'),900); setTimeout(()=>{
  // The mode picker is intentionally shown on every CineHUB launch.
  openSheet('welcomeModal');
},1050);}
document.addEventListener('DOMContentLoaded',init);
})();

