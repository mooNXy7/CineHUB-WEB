/* CineHUB telemetry client — test-only opt-in.
 * Active only when URL contains ?telemetry=1; never blocks app startup.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('telemetry') !== '1') return;

  const SUPABASE_URL = 'https://qdheeiitzlvynshvkwcs.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_AzpaAW6_qoeiBxy4Pywa4g_XDn2up0z';
  const ENDPOINT = SUPABASE_URL + '/functions/v1/cinehub-telemetry';
  const ua = navigator.userAgent || '';
  const isTV = location.protocol === 'file:' || /CineHUB-TV/i.test(ua);
  const isMobile = params.get('mobile') === '1' || /CineHUB-Mobile/i.test(ua);
  const appId = isTV ? 'cinehub-tv' : (isMobile ? 'cinehub-mobile' : 'cinehub-web');
  const platform = isTV ? 'android_tv' : (isMobile ? 'android_mobile' : 'web');
  const versionMatch = ua.match(/CineHUB-(?:Mobile|TV)\/([0-9.]+)/i);
  const appVersion = versionMatch?.[1] || 'unknown';
  const uuid = () => {
    try { return crypto.randomUUID(); }
    catch { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    }); }
  };
  const getOrCreate = (storage, key) => {
    try { let v = storage.getItem(key); if (!v) { v = uuid(); storage.setItem(key, v); } return v; }
    catch { return uuid(); }
  };
  const installationId = getOrCreate(localStorage, 'cinehub_telemetry_installation_id');
  const sessionId = getOrCreate(sessionStorage, 'cinehub_telemetry_session_id');
  const send = (event, properties = {}) => {
    const payload = {
      event_id: uuid(), event, app_id: appId, platform, app_version: appVersion,
      installation_id: installationId, session_id: sessionId, properties
    };
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: event === 'session_end'
      }).catch(() => {});
    } catch (_) { /* Telemetry must never affect playback or navigation. */ }
  };
  window.CineHUBTelemetry = { track: (event, properties) => {
    if (['app_open','session_start','heartbeat','session_end','app_error','playback_start','playback_error','playback_success'].includes(event)) send(event, properties);
  }};
  send('app_open');
  send('session_start');
  const heartbeat = setInterval(() => {
    if (document.visibilityState === 'visible') send('heartbeat');
  }, 5 * 60 * 1000);
  const end = () => { clearInterval(heartbeat); send('session_end'); };
  window.addEventListener('pagehide', end, { once: true });
  window.addEventListener('error', () => send('app_error', { error_code: 'UNHANDLED_ERROR' }));
  window.addEventListener('unhandledrejection', () => send('app_error', { error_code: 'UNHANDLED_REJECTION' }));
})();
