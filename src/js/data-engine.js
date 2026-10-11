/* CineHUB Data Engine client — additive remote-first adapter.
 * Never replaces the existing local datasets unless a published dataset is valid.
 */
(function(){
'use strict';
const BASE='/data-engine/';
const TIMEOUT=5000;
const cache=new Map(), pending=new Map();

async function fetchJSON(path){
  const key=BASE+path;
  if(cache.has(key))return cache.get(key);
  if(pending.has(key))return pending.get(key);
  const ctl=new AbortController(), timer=setTimeout(()=>ctl.abort(),TIMEOUT);
  const p=fetch(key,{cache:'no-store',signal:ctl.signal,headers:{Accept:'application/json'}})
    .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(v=>{cache.set(key,v);return v})
    .finally(()=>{clearTimeout(timer);pending.delete(key)});
  pending.set(key,p);
  return p;
}
async function manifest(){return fetchJSON('manifest.json')}
async function dataset(path){return fetchJSON(path)}
async function available(path){
  try{await fetchJSON(path);return true}catch{return false}
}
function clear(){cache.clear();pending.clear()}
window.CineHUBDataEngine={base:BASE,manifest,dataset,available,clear};
})();