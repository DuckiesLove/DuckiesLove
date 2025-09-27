/*! TK COMBO: fast-lane /check-session + grouped→flat shim for /data/kinks.json */
(() => {
  const of = window.fetch.bind(window);

  // URL flags
  let sp; try { sp = new URL(location.href).searchParams; } catch { sp = new URLSearchParams(); }
  const NO_SHIM  = sp.get('tknoshim') === '1';
  const FAST_ON  = sp.get('tkfast') !== '0';  // default ON

  const sameOrigin = (href) => {
    try { const u = new URL(href, location.href); return u.origin === location.origin ? u : null; }
    catch { return null; }
  };

  // ---------- /check-session fast lane ----------
  async function fastCheckSession(input, init) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort('tk-fastlane-timeout'), 350);
      // Make sure this probe never sets cookies or waits on CORS preflights
      const r = await of(input, { ...init, cache: 'no-store', credentials: 'omit', signal: ctrl.signal });
      clearTimeout(t);
      return r;
    } catch {
      // Synthesize a quick "nothing to do" response so callers proceed
      return new Response('', { status: 204, statusText: 'TK-FASTLANE' });
    }
  }

  // ---------- /data/kinks.json flattening ----------
  const isHtmlLike = (ct, text) =>
    /text\/html/i.test(ct || '') || /^\s*<!doctype html/i.test(text || '') || /<html[\s>]/i.test(text || '');

  const to = (p, ms) => Promise.race([ p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('shim-timeout')), ms)) ]);

  const norm = s => String(s ?? '').trim();
  function toFlat(data){
    if (Array.isArray(data) && data.length && !('items' in (data[0]||{}))) return data;
    if (data && Array.isArray(data.kinks)) return data.kinks;
    if (Array.isArray(data) && data.length && Array.isArray(data[0]?.items)) {
      const out=[]; for (const g of data) {
        const cat = norm(g.category ?? g.cat ?? '');
        for (const it of (g.items || [])) {
          out.push({
            id: it.id ?? `${cat}:${norm(it.label||it.name||'').toLowerCase().replace(/\s+/g,'-')}`,
            label: it.label ?? it.name ?? '',
            name:  it.name  ?? it.label ?? '',
            type:  it.type  ?? 'scale',
            category: cat,
            rating: it.rating ?? null
          });
        }
      }
      return out;
    }
    return data;
  }

  window.fetch = async function(input, init) {
    const raw = (typeof input === 'string' ? input : input?.url) || '';
    const u = sameOrigin(raw);
    if (!u) return of(input, init); // cross-origin untouched

    // 1) Fast lane for /check-session
    if (FAST_ON && /\/check-session\/?$/.test(u.pathname)) {
      return fastCheckSession(input, init);
    }

    // 2) Safe shim for /data/kinks.json
    if (!NO_SHIM && /\/data\/kinks\.json(?:$|\?)/.test(u.pathname + u.search)) {
      const res = await of(input, init);
      try {
        if (!res.ok) return res;
        const ct  = res.headers.get('content-type') || '';
        const txt = await to(res.clone().text(), 2000).catch(()=>null);
        if (txt == null || isHtmlLike(ct, txt)) return res;         // timeout or HTML rewrite → leave as-is
        const json = await to(Promise.resolve().then(()=>JSON.parse(txt)), 700).catch(()=>null);
        if (json == null) return res;
        const flat = toFlat(json);
        return new Response(new Blob([JSON.stringify(flat)], {type:'application/json'}), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      } catch { return res; }
    }

    // 3) Everything else untouched
    return of(input, init);
  };
})();
