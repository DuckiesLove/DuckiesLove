/*! TK LOG GATE: drop/throttle "[KINKS-UNSQUISH]" unless tkdebug enabled */
(() => {
  // Opt-in flag: ?tkdebug=1 or localStorage.tkdebug="1"
  const url = new URL(location.href);
  const TK_DEBUG = url.searchParams.get('tkdebug') === '1' || localStorage.getItem('tkdebug') === '1';
  // Expose for codemodded LOG
  window.__tk_shouldLog = !!TK_DEBUG;

  // Throttle map (per prefix)
  const last = new Map();
  const THROTTLE_MS = 2000;
  const shouldEmit = (key) => {
    const now = performance.now();
    const prev = last.get(key) || 0;
    if (now - prev < THROTTLE_MS) return false;
    last.set(key, now);
    return true;
  };

  const wrap = (orig) => function(...args){
    try {
      // If first arg is the UNSQUISH prefix, gate it
      const first = args[0];
      const isUnsquish = typeof first === 'string' && first.includes('[KINKS-UNSQUISH]');
      if (isUnsquish) {
        if (!TK_DEBUG) return;                 // drop entirely in prod
        if (!shouldEmit('[KINKS-UNSQUISH]')) { // throttle in debug
          return;
        }
      }
    } catch {}
    return orig.apply(this, args);
  };

  // Patch common consoles
  for (const k of ['log','info','debug']) {
    if (typeof console[k] === 'function') console[k] = wrap(console[k]);
  }

  // Small badge if debug enabled (so you know logs are flowing)
  if (TK_DEBUG) {
    const b = document.createElement('div');
    b.textContent = 'tkdebug=1 (UNSQUISH logs throttled)';
    b.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:2147483647;background:#0b0;color:#000;padding:4px 8px;border-radius:6px;font:12px system-ui';
    setTimeout(()=>b.remove(), 1500);
    (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', ()=>document.body.appendChild(b), {once:true}) : document.body.appendChild(b);
  }
})();
