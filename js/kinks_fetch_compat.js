/*! TK: fetch compatibility for /data/kinks.json (grouped → flat) */
(() => {
  const orig = window.fetch.bind(window);

  function toFlat(data) {
    // already flat?
    if (Array.isArray(data) && data.length && !('items' in (data[0]||{}))) return data;
    // { kinks: [] } ?
    if (data && Array.isArray(data.kinks)) return data.kinks;

    // grouped: [{ category, items: [...] }, ...]
    if (Array.isArray(data) && data.length && data[0] && Array.isArray(data[0].items)) {
      const flat = [];
      for (const group of data) {
        const cat = String(group.category ?? group.cat ?? '').trim();
        for (const it of (group.items || [])) {
          flat.push({
            id: it.id ?? `${cat}:${(it.label||'').toLowerCase().replace(/\s+/g,'-')}`,
            label: it.label ?? it.name ?? '',
            name: it.name ?? it.label ?? '',
            type: it.type ?? 'scale',
            category: cat,
            rating: it.rating ?? null
          });
        }
      }
      return flat;
    }
    // unknown shape → return as-is
    return data;
  }

  window.fetch = async function(input, init) {
    const url = (typeof input === 'string' ? input : input?.url) || '';
    if (url.includes('/data/kinks.json')) {
      const res = await orig(input, init);
      try {
        // bail if not 200
        if (!res.ok) return res;
        // bail if HTML (rewrite); let your watchdog/diagnostics handle it
        const ct = res.headers.get('content-type') || '';
        const txt = await res.clone().text();
        if (/^<!doctype html/i.test(txt) || /<html[\s>]/i.test(txt) || /text\/html/i.test(ct)) return res;

        // parse and flatten
        const json = JSON.parse(txt);
        const flat = toFlat(json);

        // hand back a *new* JSON response the app expects
        const blob = new Blob([JSON.stringify(flat)], { type: 'application/json' });
        return new Response(blob, { status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json' } });
      } catch {
        return res; // on any error, fall back to original response
      }
    }
    return orig(input, init);
  };
})();
