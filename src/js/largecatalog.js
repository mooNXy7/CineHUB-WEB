/* CineHUB Large Catalog — Data Engine first, local index fallback. */
(function(){
'use strict';
const M=window.CineHUBLargeManifest||{};
const cache=new Map(),pending=new Map(),cursors=new Map(),indexCache={movie:null,series:null};
const remotePaths={movie:'catalog/movies.index.json',series:'catalog/series.index.json'};

async function remoteIndex(type){
  try{
    if(!window.CineHUBDataEngine?.dataset)return null;
    const value=await window.CineHUBDataEngine.dataset(remotePaths[type]);
    return Array.isArray(value)?value:(Array.isArray(value?.items)?value.items:null);
  }catch{return null}
}
async function loadIndex(type){
  if(indexCache[type])return indexCache[type];
  const key='index:'+type;
  if(pending.has(key))return pending.get(key);
  const p=(async()=>{
    const remote=await remoteIndex(type);
    if(Array.isArray(remote)&&remote.length){
      indexCache[type]=remote;return remote;
    }
    const url=type==='series'?'dados/conteudo/indices/series.json':'dados/conteudo/indices/filmes.json';
    const local=await fetch(url,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()});
    indexCache[type]=Array.isArray(local)?local:[];return indexCache[type];
  })().finally(()=>pending.delete(key));
  pending.set(key,p);return p;
}
function parse(text,category){
  const lines=String(text||'').split(/\r?\n/),out=[];
  for(let i=0;i<lines.length;i++){
    const l=lines[i].trim();if(!l.startsWith('#EXTINF'))continue;
    const url=(lines[i+1]||'').trim();if(!url||url.startsWith('#'))continue;
    const attrs={};const re=/([\w-]+)="([^"]*)"/g;let m;
    while((m=re.exec(l)))attrs[m[1]]=m[2];
    const comma=l.indexOf(','),title=comma>=0?l.slice(comma+1).trim():(attrs['tvg-name']||'Sem título');
    const adult=/\b(adult|xxx|18\+|erotic|er[oó]tico|porn|porno|pornografia)\b/i;
    if(adult.test(title+' '+category))continue;
    const logo=(attrs['tvg-logo']||'').replace(/^http:\/\//,'https://')||'imagens/sem-capa.jpg';
    out.push({titulo:title,imagem:logo,banner:logo,stream:url,categoria:category,tipo:(M[category]?.type)||'movie',__large:true,__source:'CineHUB',tvgName:attrs['tvg-name']||title});
  }
  return out;
}
async function fetchChunk(file,category){
  const r=await fetch(file,{cache:'force-cache'});if(!r.ok)throw new Error('HTTP '+r.status);
  return parse(await r.text(),category);
}
async function first(category){
  const key='first:'+category;if(cache.has(key))return cache.get(key);
  if(pending.has(key))return pending.get(key);
  const p=(async()=>{const meta=M[category];if(!meta?.files?.length)return [];const arr=await fetchChunk(meta.files[0],category);cache.set(key,arr);cursors.set(category,1);return arr})().finally(()=>pending.delete(key));pending.set(key,p);return p;
}
async function next(category){
  const meta=M[category];if(!meta?.files?.length)return [];
  const n=cursors.get(category)||0;if(n>=meta.files.length)return [];
  const key='next:'+category+':'+n;if(cache.has(key)){cursors.set(category,n+1);return cache.get(key)}
  const arr=await fetchChunk(meta.files[n],category);cache.set(key,arr);cursors.set(category,n+1);return arr;
}
async function all(category){
  const key='all:'+category;if(cache.has(key))return cache.get(key);
  if(pending.has(key))return pending.get(key);
  const p=(async()=>{const meta=M[category];if(!meta)return [];const chunks=await Promise.all(meta.files.map(f=>fetchChunk(f,category)));const arr=chunks.flat();cache.set(key,arr);return arr})().finally(()=>pending.delete(key));pending.set(key,p);return p;
}
async function featured(type){
  const key='featured:'+type;if(cache.has(key))return cache.get(key);
  const url='dados/conteudo/catalogo/destaques.m3u8';
  const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error('HTTP '+r.status);
  const arr=parse(await r.text(),'Destaques').filter(x=>x.tipo===type).slice(0,180);cache.set(key,arr);return arr;
}
function categories(type){return Object.entries(M).filter(([,v])=>v.type===type).map(([name,v])=>({name,count:v.count,files:v.files.length}))}
async function findByTitle(type,title){const q=String(title||'').trim().toLocaleLowerCase('pt-BR');if(!q)return null;const idx=await loadIndex(type);return idx.find(x=>String(x.titulo||'').trim().toLocaleLowerCase('pt-BR')===q)||idx.find(x=>String(x.titulo||'').toLocaleLowerCase('pt-BR').includes(q))||null}
async function search(type,term,limit=120){const q=String(term||'').trim().toLocaleLowerCase('pt-BR');if(!q)return [];const idx=await loadIndex(type);return idx.filter(x=>`${x.titulo} ${x.categoria}`.toLocaleLowerCase('pt-BR').includes(q)).slice(0,limit)}
window.CineHUBLargeCatalog={manifest:M,loadIndex,first,next,all,featured,categories,search,findByTitle,index:(type)=>loadIndex(type),clear:()=>{cache.clear();cursors.clear();indexCache.movie=null;indexCache.series=null}};
})();