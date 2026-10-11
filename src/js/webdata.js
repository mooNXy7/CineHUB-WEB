/* CineHUB Web Data — online catalog gateway via Supabase Edge Function.
 * No TMDB credential is stored in the browser. The TMDB token remains server-side.
 */
(() => {
  'use strict';
  const TTL = 6 * 60 * 60 * 1000;
  const SUPABASE_URL = 'https://qdheeiitzlvynshvkwcs.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_AzpaAW6_qoeiBxy4Pywa4g_XDn2up0z';
  const FUNCTION_URL = SUPABASE_URL + '/functions/v1/cinehub-catalog';

  const get = (k, fallback = null) => { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const cacheGet = key => { const x = get('cinehub_web_' + key); return x && Date.now() - x.t < TTL ? x.v : null; };
  const cacheSet = (key, v) => set('cinehub_web_' + key, { t: Date.now(), v });
  const img = p => p ? 'https://image.tmdb.org/t/p/w780' + p : '';

  const invoke = async (body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch {}
      if (!response.ok) throw new Error(payload?.error || `Supabase HTTP ${response.status}`);
      if (!payload?.success) throw new Error(payload?.error || 'Catálogo online indisponível.');
      return payload.data;
    } finally { clearTimeout(timer); }
  };

  const normalizeType = type => type === 'series' || type === 'tv' ? 'tv' : 'movie';

  const searchTMDB = async (item, type) => {
    const data = await searchTMDBResults(item?.titulo || '', type, 1);
    return data.results?.[0] || null;
  };

  const searchTMDBResults = async (query, type, page = 1) => {
    const q = String(query || '').trim();
    if (!q) return { page: 1, total_pages: 0, total_results: 0, results: [] };
    const t = normalizeType(type);
    const p = Math.max(1, Number(page) || 1);
    const key = `search_${t}_${q.toLowerCase()}_${p}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    const data = await invoke({ action: 'search', type: t, query: q, page: p });
    cacheSet(key, data);
    return data;
  };

  const tmdbItem = (r, type) => {
    const isSeries = normalizeType(type) === 'tv';
    const date = r.release_date || r.first_air_date || '';
    return {
      titulo: r.title || r.name || 'Sem título',
      ano: date.slice(0, 4) || '',
      nota: r.vote_average ? Number(r.vote_average).toFixed(1) : '—',
      categoria: isSeries ? 'Série' : 'Filme',
      imagem: img(r.poster_path),
      banner: img(r.backdrop_path),
      sinopse: r.overview || '',
      tmdb: String(r.id || ''),
      __online: true,
      __type: isSeries ? 'series' : 'movie'
    };
  };

  const detailsTMDB = async (item, type) => {
    const t = normalizeType(type);
    const directId = item?.tmdb || item?.tmdb_id || item?.tmdbId;
    const hit = directId ? { id: directId } : await searchTMDB(item, t);
    if (!hit) return null;
    const key = `details_${t}_${hit.id}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    const data = await invoke({ action: 'details', type: t, id: String(hit.id) });
    cacheSet(key, data);
    return data;
  };

  const feed = async (action, type, limit = 14) => {
    const t = normalizeType(type);
    const key = `feed_${action}_${t}`;
    const cached = cacheGet(key);
    const data = cached || await invoke({ action, type: t, page: 1 });
    if (!cached) cacheSet(key, data);
    return (data?.results || []).filter(x => x.poster_path).slice(0, limit).map(x => tmdbItem(x, t));
  };

  const homeFeeds = async () => {
    const cached = cacheGet('home_feeds_v3');
    if (cached) return cached;
    const results = await Promise.allSettled([
      feed('trending', 'movie', 14),
      feed('trending', 'tv', 14),
      feed('now_playing', 'movie', 14),
      feed('now_playing', 'tv', 14)
    ]);
    const value = x => x.status === 'fulfilled' ? x.value : [];
    const out = {
      trendingMovies: value(results[0]),
      trendingSeries: value(results[1]),
      newMovies: value(results[2]),
      newSeries: value(results[3])
    };
    cacheSet('home_feeds_v3', out);
    return out;
  };

  const tvmaze = async (title) => {
    const key = 'tvmaze_' + encodeURIComponent(title).replace(/%/g, '_');
    const cached = cacheGet(key); if (cached) return cached;
    const r = await fetch('https://api.tvmaze.com/singlesearch/shows?q=' + encodeURIComponent(title) + '&embed=episodes');
    if (!r.ok) throw new Error('TVmaze HTTP ' + r.status);
    const data = await r.json(); cacheSet(key, data); return data;
  };

  const schedule = async (date = '') => {
    const d = date || new Date().toISOString().slice(0, 10);
    const key = 'tvmaze_schedule_' + d;
    const cached = cacheGet(key); if (cached) return cached;
    const r = await fetch('https://api.tvmaze.com/schedule?country=BR&date=' + d);
    if (!r.ok) throw new Error('TVmaze HTTP ' + r.status);
    const data = await r.json(); cacheSet(key, data); return data;
  };

  const clearCache = () => Object.keys(localStorage).filter(k => k.startsWith('cinehub_web_')).forEach(k => localStorage.removeItem(k));

  window.CineHUBWeb = {
    token: () => '',
    invoke,
    searchTMDB,
    searchTMDBResults,
    tmdbItem,
    detailsTMDB,
    tvmaze,
    schedule,
    homeFeeds,
    imageUrl: img,
    hasTMDB: () => true,
    clearCache
  };
})();
