/* CineHUB List Manager 2.3.1
 * Lazy, non-blocking M3U ingestion + logo enrichment.
 * Sources are loaded only on demand; the main CineHUB catalog remains untouched.
 */
(function(){
'use strict';
const DAY=86400000, REFRESH_DAYS=3;
const CFG={
  logosApi:'https://iptv-org.github.io/api/logos.json',
  tvLogos:'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/brazil/',
  remote:[
    ['IPTV Brasil · BR 01','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisBR01.m3u8'],
    ['IPTV Brasil · BR 02','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisBR02.m3u8'],
    ['IPTV Brasil · BR 03','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisBR03.m3u8'],
    ['IPTV Brasil · BR 04','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisBR04.m3u8'],
    ['IPTV Brasil · BR 05','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisBR05.m3u8'],
    ['IPTV Brasil · Filmes/Séries','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/Filmes-Series.m3u8'],
    ['IPTV Brasil · Europa','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisEuropa.m3u8'],
    ['IPTV Brasil · Itália','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisItalia.m3u8']
  ],
  local:[
    ['CineHUB · Lista 1','dados/listas/1.m3u'],
    ['CineHUB · Lista 2','dados/listas/2.m3u'],
    ['CineHUB · Lista 3','dados/listas/3.m3u'],
    ['CineHUB · Lista 4','dados/listas/4.m3u'],
    ['CineHUB · Lista 610','dados/listas/610.M3U8'],
    ['CineHUB · Europa','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisEuropa.m3u8'],
    ['CineHUB · Itália','dados/listas/CanaisItalia.m3u8'],
    ['CineHUB · Itália (alternativa)','https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisItalia.m3u8']
  ],
  saimo:'https://raw.githubusercontent.com/gabrielsaimo/SaimoPlayer/main/catalogo.txt',
  catalog:'https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/Filmes-Series.m3u8'
};
const state={saimo:false,loading:false,lastError:null,loaded:new Set(),logoMap:null,logoPromise:null,lastUpdate:Number(localStorage.getItem('cinehub_lists_updated')||0),channelIndex:null,groupSet:null,renderTimer:null,pendingDispatch:false,activeLoads:0};
function scheduleSourcesUpdated(force=false){
  if(force){if(state.renderTimer){clearTimeout(state.renderTimer);state.renderTimer=null} state.pendingDispatch=false;window.dispatchEvent(new CustomEvent('cinehub:sources-updated',{detail:{count:(window.canaisM3U8||[]).length}}));return}
  state.pendingDispatch=true;
  if(state.renderTimer)return;
  state.renderTimer=setTimeout(()=>{state.renderTimer=null;if(!state.pendingDispatch)return;state.pendingDispatch=false;window.dispatchEvent(new CustomEvent('cinehub:sources-updated',{detail:{count:(window.canaisM3U8||[]).length}}));},700);
}
function ensureChannelIndex(){
 if(state.channelIndex)return state.channelIndex;
 const idx=new Map(),groups=new Set();
 for(const x of (Array.isArray(window.canaisM3U8)?window.canaisM3U8:[])){
   if(!x?.stream||!allowed(x.nome,x.grupo))continue;
   const k=key(x.nome)||norm(x.nome);if(!k)continue;
   const cur=idx.get(k);
   if(!cur){idx.set(k,{...x,sources:[...(x.sources||[])]});if(x.grupo)groups.add(x.grupo);continue}
   cur.sources=[...(cur.sources||[]),...(x.sources||[])].filter((v,i,a)=>v?.url&&a.findIndex(q=>q?.url===v.url)===i);
   if(!cur.logo&&x.logo)cur.logo=x.logo;if((!cur.grupo||cur.grupo==='SaimoPlayer')&&x.grupo)cur.grupo=x.grupo;if(x.grupo)groups.add(x.grupo);
 }
 state.channelIndex=idx;state.groupSet=groups;
 window.canaisM3U8=[...idx.values()];window.canaisM3U8Grupos=[...groups].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 return idx;
}
const adult=/\b(adult|xxx|18\+|erotic|er[oó]tico|porn|porno|pornografia)\b/i;
function cleanChannelTitle(raw, attrs={}){
 let t=clean(attrs['tvg-name']||raw||'Sem título');
 t=t.replace(/^tv-logo\s*[—–:-]\s*/i,'').trim();
 t=t.replace(/^https?:\/\/[^\s]+$/i,'').trim();
 if(!t || /^tv[-_ ]?logo$/i.test(t)){
   const logo=clean(attrs['tvg-logo']||'');
   const m=logo.match(/(?:^|\/)([^\/]+?)(?:\.(?:png|jpe?g|webp|svg|gif))(?:\?.*)?$/i);
   if(m) t=m[1].replace(/[-_]+/g,' ').replace(/\bbr\b$/i,'').trim();
 }
 return t||'Canal sem nome';
}
function normalizeLogoUrl(url){
 const u=clean(url); if(!u)return '';
 return u.replace(/^http:\/\//i,'https://');
}

const clean=s=>String(s||'').trim();
const norm=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
function allowed(name,group){return !adult.test(`${name||''} ${group||''}`)}
function key(name){
 return norm(name).replace(/-(st|me|rk|ot|ss|nova|s\d+)(-|$)/g,'')
}
function dedupe(arr){
 const map=new Map();
 for(const x of arr||[]){
  if(!x?.stream||!allowed(x.nome,x.grupo))continue;
  const k=key(x.nome)||norm(x.nome); if(!k)continue;
  if(!map.has(k)){map.set(k,{...x,sources:[...(x.sources||[])]});continue}
  const cur=map.get(k);
  cur.sources=[...(cur.sources||[]),...(x.sources||[])].filter((v,i,a)=>v?.url&&a.findIndex(q=>q?.url===v.url)===i);
  if(!cur.logo&&x.logo)cur.logo=x.logo;
  if((!cur.grupo||cur.grupo==='SaimoPlayer')&&x.grupo)cur.grupo=x.grupo;
 }
 return [...map.values()];
}
async function fetchResponse(url,timeout=30000){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
 try{const r=await fetch(url,{cache:'no-store',signal:ctl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r}
 finally{clearTimeout(timer)}
}
function parseAttrs(line){
 const a={};let m;const re=/([\w-]+)="([^"]*)"/g;
 while((m=re.exec(line)))a[m[1]]=m[2];return a;
}
async function parseM3UStream(response,origin,onBatch){
 const reader=response.body?.getReader?.();
 if(!reader){
   const text=await response.text(); return parseM3UText(text,origin,onBatch);
 }
 const dec=new TextDecoder();let buf='',pending=null,count=0,batch=[];
 const emit=async()=>{if(batch.length){const b=batch;batch=[];await onBatch(b);await new Promise(r=>setTimeout(r,0));}};
 for(;;){
   const {value,done}=await reader.read();if(done)break;
   buf+=dec.decode(value,{stream:true});
   const lines=buf.split(/\r?\n/);buf=lines.pop()||'';
   for(const raw of lines){
     const line=raw.trim();
     if(line.startsWith('#EXTINF')) pending=line;
     else if(pending&&line&&!line.startsWith('#')){
       const attrs=parseAttrs(pending),comma=pending.indexOf(','),rawTitle=comma>=0?clean(pending.slice(comma+1)):(attrs['tvg-name']||'Sem título'),title=cleanChannelTitle(rawTitle,attrs);
       const group=attrs['group-title']||attrs.group||origin;
       if(allowed(title,group))batch.push({nome:title,grupo:group,logo:normalizeLogoUrl(attrs['tvg-logo']||''),stream:line,qualidade:attrs.quality||'',origem:origin,tvgId:attrs['tvg-id']||'',sources:[{url:line,referer:attrs['http-referrer']||attrs.referrer||'',userAgent:attrs['http-user-agent']||''}]});
       pending=null;count++;
       if(batch.length>=250)await emit();
     }
   }
 }
 buf+=dec.decode();if(pending&&buf.trim()&&!buf.trim().startsWith('#')){}
 await emit();return count;
}
async function parseM3UText(text,origin,onBatch){
 const lines=String(text||'').split(/\r?\n/),out=[];let pending=null;
 for(const raw of lines){
   const line=raw.trim();
   if(line.startsWith('#EXTINF'))pending=line;
   else if(pending&&line&&!line.startsWith('#')){
     const attrs=parseAttrs(pending),comma=pending.indexOf(','),rawTitle=comma>=0?clean(pending.slice(comma+1)):(attrs['tvg-name']||'Sem título'),title=cleanChannelTitle(rawTitle,attrs);
     const group=attrs['group-title']||attrs.group||origin;
     if(allowed(title,group))out.push({nome:title,grupo:group,logo:normalizeLogoUrl(attrs['tvg-logo']||''),stream:line,origem:origin,tvgId:attrs['tvg-id']||'',sources:[{url:line}]});
     pending=null;
     if(out.length>=250){const b=out.splice(0);await onBatch(b);await new Promise(r=>setTimeout(r,0))}
   }
 }
 if(out.length)await onBatch(out);
 return lines.length;
}
function merge(list,opts={}){
 const idx=ensureChannelIndex(), groups=state.groupSet||new Set();
 for(const x of list||[]){
   if(!x?.stream||!allowed(x.nome,x.grupo))continue;
   const k=key(x.nome)||norm(x.nome);if(!k)continue;
   const cur=idx.get(k);
   if(!cur){idx.set(k,{...x,sources:[...(x.sources||[])]});if(x.grupo)groups.add(x.grupo);continue}
   cur.sources=[...(cur.sources||[]),...(x.sources||[])].filter((v,i,a)=>v?.url&&a.findIndex(q=>q?.url===v.url)===i);
   if(!cur.logo&&x.logo)cur.logo=x.logo;
   if((!cur.grupo||cur.grupo==='SaimoPlayer')&&x.grupo)cur.grupo=x.grupo;
   if(!cur.tvgId&&x.tvgId)cur.tvgId=x.tvgId;
   if(x.grupo)groups.add(x.grupo);
 }
 window.canaisM3U8=[...idx.values()];window.canaisM3U8Grupos=[...groups].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 scheduleSourcesUpdated(!!opts.forceEvent);
 return window.canaisM3U8;
}
async function loadLogoMap(){
 if(state.logoMap)return state.logoMap;if(state.logoPromise)return state.logoPromise;
 state.logoPromise=(async()=>{
   const map=new Map();
   try{
     const r=await fetch(CFG.logosApi,{cache:'no-store'});const arr=await r.json();
     for(const x of Array.isArray(arr)?arr:[])if(x?.url&&(x.in_use!==false||!map.has(x.channel)))map.set(norm(x.channel),x.url);
   }catch(e){console.warn('[CineHUB] logos API indisponível',e)}
   state.logoMap=map;return map;
 })().finally(()=>state.logoPromise=null);
 return state.logoPromise;
}
function logoFallback(name){
 const s=norm(name);return s?CFG.tvLogos+s+'-br.png':'';
}
async function enrichLogos(list){
 const map=await loadLogoMap();
 let changed=0;
 for(const x of list||[]){
   const direct=map.get(norm(x.tvgId));
   const named=map.get(norm(x.nome));
   const suspicious=/tv-logo|logo\.(?:png|jpe?g|svg|webp)|^https?:/i.test(String(x.nome||''));
   const url=direct||named||(!x.logo?logoFallback(x.nome):'');
   if(url&&(!x.logo||suspicious)){x.logo=url;changed++}
 }
 return changed;
}
async function loadSource(id,label,url){
 if(state.loaded.has(id))return 0;
 state.activeLoads++;state.loading=true;
 try{
   const response=await fetchResponse(url,60000);
   let total=0;
   await parseM3UStream(response,label,async batch=>{
     total+=batch.length;await enrichLogos(batch);merge(batch);
   });
   state.loaded.add(id);return total;
 }catch(e){state.lastError=e;console.warn('[CineHUB] fonte indisponível:',label,e);return 0}
 finally{state.activeLoads=Math.max(0,state.activeLoads-1);state.loading=state.activeLoads>0}
}
async function loadIptv(opts={}){
 const includeLocal=opts.local!==false, includeRemote=opts.remote!==false;
 const wanted=[];
 if(includeRemote)CFG.remote.forEach((x,i)=>wanted.push([`r${i}`,...x]));
 if(includeLocal)CFG.local.forEach((x,i)=>wanted.push([`l${i}`,...x]));
 let total=0,cursor=0;
 const worker=async()=>{while(cursor<wanted.length){const job=wanted[cursor++];total+=await loadSource(...job)}};
 await Promise.all([worker(),worker()]);
 scheduleSourcesUpdated(true);
 state.lastUpdate=Date.now();localStorage.setItem('cinehub_lists_updated',String(state.lastUpdate));
 return {ok:true,count:total,loaded:state.loaded.size};
}
async function loadSupplemental(){
 return loadIptv({remote:false,local:true});
}
async function loadSaimo(){
 if(state.saimo)return {ok:true,count:0};
 try{
   const r=await fetchResponse(CFG.saimo,30000),text=await r.text();
   const out=[];let cur=null,src=null;
   for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const p=line.indexOf(':');if(p<0)continue;
     const k=line.slice(0,p).trim().toLowerCase(),v=line.slice(p+1).trim();
     if(k==='canal'){if(cur?.stream&&allowed(cur.nome,cur.grupo))out.push(cur);cur={nome:v,grupo:'SaimoPlayer',logo:'',stream:'',sources:[]};src=null}
     else if(cur){if(k==='categoria')cur.grupo=v||'SaimoPlayer';else if(k==='logo')cur.logo=v;else if(k==='fonte'){src={url:v};cur.sources.push(src);if(!cur.stream)cur.stream=v}else if(k==='referer'&&src)src.referer=v;else if((k==='agente'||k==='user-agent')&&src)src.userAgent=v}
   }
   if(cur?.stream&&allowed(cur.nome,cur.grupo))out.push(cur);
   await enrichLogos(out);merge(dedupe(out).map(x=>({...x,origem:'SaimoPlayer'})));state.saimo=true;
   return {ok:true,count:out.length}
 }catch(e){state.lastError=e;return {ok:false,error:e}}
}
async function loadCatalog(){
 try{
  const r=await fetchResponse(CFG.catalog,60000),text=await r.text(),out=[];let pending=null;
  for(const raw of text.split(/\r?\n/)){const l=raw.trim();if(l.startsWith('#EXTINF'))pending=l;else if(pending&&l&&!l.startsWith('#')){
    const a=parseAttrs(pending),comma=pending.indexOf(','),title=comma>=0?clean(pending.slice(comma+1)):'Sem título',group=a['group-title']||'Catálogo externo';
    const type=/s[ée]rie|series|temporada|epis[oó]dio/i.test(group+' '+title)?'series':'movie';
    out.push({titulo:title,imagem:(a['tvg-logo']||'').replace(/^http:\/\//,'https://')||'imagens/sem-capa.jpg',banner:(a['tvg-logo']||'').replace(/^http:\/\//,'https://')||'imagens/sem-capa.jpg',stream:l,categoria:group,tipo:type,__externalCatalog:true});pending=null;
  }}
  window.CineHUBExternalCatalog=out;window.dispatchEvent(new CustomEvent('cinehub:catalog-updated',{detail:{count:out.length}}));return {ok:true,count:out.length};
 }catch(e){state.lastError=e;return {ok:false,error:e}}
}
async function refresh(opts={}){state.loaded.clear();return loadIptv(opts)}
function due(){return !state.lastUpdate||Date.now()-state.lastUpdate>=REFRESH_DAYS*DAY}
window.CineHUBExternalSources={sources:{...CFG,refreshAfterDays:REFRESH_DAYS},state,loadSaimo,loadIptv,loadSupplemental,loadCatalog,refresh,parseM3U:parseM3UText,loadLogoMap,enrichLogos,due};
window.addEventListener('DOMContentLoaded',()=>{merge([]);loadLogoMap().catch(()=>{});});
})();
