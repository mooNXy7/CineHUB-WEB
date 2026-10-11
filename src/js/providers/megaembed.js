/* CineHUB Stable 11.2 — Universal Content Provider
 * Uses the documented MegaEmbed endpoints and keeps a safe fallback chain.
 * IMPORTANT: this adapter only builds embed URLs; it does not bypass provider
 * iframe/CSP restrictions. If a provider blocks embedding, the player exposes
 * an external-open fallback instead of leaving a broken page in the CineHUB UI.
 */
(()=>{
  'use strict';
  const MGE='https://mgeb.top/embed/';
  const API='https://megaembedapi.site/embed/';
  const clean=v=>String(v??'').trim();
  const enc=v=>encodeURIComponent(clean(v));
  const id=item=>({
    tmdb: clean(item?.tmdb||item?.tmdb_id||item?.tmdbId),
    imdb: clean(item?.imdb||item?.imdb_id||item?.imdbId)
  });

  function movieCandidates(item){
    if(item?.megaEmbedUrl) return [clean(item.megaEmbedUrl)];
    const {tmdb,imdb}=id(item), out=[];
    // Current documented MegaEmbed domain first.
    if(tmdb) out.push(`${MGE}${enc(tmdb)}`);
    if(imdb) out.push(`${MGE}${enc(imdb)}`);
    // MegaEmbedAPI fallback, including its documented direct-ID routes.
    if(imdb) out.push(`${API}${enc(imdb)}`);
    if(tmdb) out.push(`${API}${enc(tmdb)}`);
    // Last-resort documented lookup route.
    if(item?.titulo) out.push(`${API}movie?title=${enc(item.titulo)}&year=${enc(item.ano||'')}`);
    return [...new Set(out)];
  }

  function seriesCandidates(item,season=1,episode=1){
    if(item?.megaEmbedUrl){
      const u=clean(item.megaEmbedUrl);
      return [u.includes('{season}')?u.replace('{season}',season).replace('{episode}',episode):`${u.replace(/\/$/,'')}/${season}/${episode}`];
    }
    const {tmdb,imdb}=id(item),s=Math.max(1,Number(season)||1),e=Math.max(1,Number(episode)||1),out=[];
    if(tmdb){
      out.push(`${MGE}${enc(tmdb)}/${s}/${e}`);
      out.push(`${MGE}${enc(tmdb)}-${s}-${e}`);
    }
    if(imdb){
      out.push(`${MGE}${enc(imdb)}/${s}/${e}`);
      out.push(`${MGE}${enc(imdb)}-${s}-${e}`);
    }
    if(tmdb) out.push(`${API}${enc(tmdb)}/${s}/${e}`);
    if(imdb) out.push(`${API}${enc(imdb)}/${s}/${e}`);
    if(tmdb) out.push(`${API}series?tmdb=${enc(tmdb)}&sea=${s}&epi=${e}`);
    if(imdb) out.push(`${API}series?imdb=${enc(imdb)}&sea=${s}&epi=${e}`);
    if(item?.titulo) out.push(`${API}series?title=${enc(item.titulo)}&year=${enc(item.ano||'')}&season=${s}&episode=${e}`);
    return [...new Set(out)];
  }

  function movie(item){return movieCandidates(item)[0]||''}
  function series(item,season=1,episode=1){return seriesCandidates(item,season,episode)[0]||''}
  function candidates(type,item,season=1,episode=1){return type==='series'?seriesCandidates(item,season,episode):movieCandidates(item)}
  function movieStatus(item){
    const imdb=id(item).imdb;
    return imdb?`${API.replace('/embed/','')}/api/status?imdb=${enc(imdb)}&type=movie`:null;
  }
  window.CineHUBMegaEmbed={movie,series,candidates,movieStatus,base:MGE,api:API};
})();
