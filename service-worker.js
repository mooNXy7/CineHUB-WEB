const CACHE='cinehub-2.3.5-data-engine';
const CORE=['./','./index.html','./manifest.json','./src/css/main.css','./src/js/cinehub.js','./src/js/epg.js','./src/js/largecatalog.js','./src/js/integracoes.js','./src/js/webdata.js','./src/js/data-engine.js','./src/js/motion.js','./src/js/performance.js','./dados/canais-m3u8.js','./dados/conteudo/manifest.js','./dados/listas.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(u.origin!==location.origin||e.request.method!=='GET')return;
 if(e.request.destination==='script'||e.request.destination==='document'||u.pathname.endsWith('.css')){
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
  return;
 }
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r})));
});
