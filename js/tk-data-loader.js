/*  Minimal, robust data loader.
    Exposes: TK.loadKinkData(): Promise<{ categories: Array<{id,title}>, labelsMap: Record<string,string> }>
    Strategy:
      1) Try to fetch /data/kinks.json (and optional /data/labels-overrides.json).
      2) Detect shape and extract categories.
      3) Build labelsMap from both sources.
      4) If fetch fails, return a tiny safe fallback so UI stays interactive.
*/
window.TK = window.TK || {};
(function(){
  const fetchJson = async (url, timeoutMs=5000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try{
      const r = await fetch(url, { signal: ctrl.signal, credentials: 'same-origin' });
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }finally{
      clearTimeout(t);
    }
  };

  function normalizeCategories(source){
    // Try common shapes:
    //  a) { categories: [ { id, title }, ... ] }
    //  b) { categories: { cb_xxxx: "Name", ... } }
    //  c) { items: [ { id, label }, ... ] }
    //  d) Map-like { cb_xxxx: {...} }  (fall back to keys)
    if(!source) return [];
    if(Array.isArray(source.categories)){
      return source.categories
        .map(x => ({ id: x.id || x.code || x.key || '', title: x.title || x.name || '' }))
        .filter(x => x.id);
    }
    if(source.categories && typeof source.categories === 'object'){
      return Object.entries(source.categories).map(([id, val]) => ({
        id, title: (typeof val === 'string' ? val : (val && (val.title||val.name))) || id
      }));
    }
    if(Array.isArray(source.items)){
      return source.items
        .map(x => ({ id: x.id || x.code || x.key || '', title: x.label || x.title || x.name || '' }))
        .filter(x => x.id);
    }
    // Try map-of-objects fallback
    if(typeof source === 'object'){
      const keys = Object.keys(source).filter(k => /^cb_/.test(k));
      if(keys.length){
        return keys.map(k => ({ id:k, title: (source[k] && (source[k].title||source[k].name)) || k }));
      }
    }
    return [];
  }

  function mergeLabels(baseMap, overrideMap){
    const out = { ...(baseMap||{}) };
    if(overrideMap && typeof overrideMap === 'object'){
      for(const [k,v] of Object.entries(overrideMap)){
        if(typeof v === 'string' && v.trim()) out[k] = v.trim();
      }
    }
    return out;
  }

  async function loadKinkData(){
    // Primary locations (adjust if your paths differ)
    const kinksURL    = '/data/kinks.json';
    const labelsURL   = '/data/labels-overrides.json';   // optional

    try{
      const [kinks, labelsOverrides] = await Promise.allSettled([
        fetchJson(kinksURL),
        fetchJson(labelsURL)
      ]);

      const ksrc   = kinks.status === 'fulfilled' ? kinks.value : null;
      const lovr   = labelsOverrides.status === 'fulfilled' ? labelsOverrides.value : null;
      const cats   = normalizeCategories(ksrc);
      // Build base labels map from cats and source:
      let base = {};
      for(const c of cats){
        base[c.id] = c.title || c.id;
      }
      // Also merge any direct map ksrc.categories (object form)
      if(ksrc && ksrc.categories && typeof ksrc.categories === 'object' && !Array.isArray(ksrc.categories)){
        for(const [id, val] of Object.entries(ksrc.categories)){
          if(!base[id]){
            base[id] = (typeof val === 'string' ? val : (val && (val.title||val.name))) || id;
          }
        }
      }
      const labelsMap = mergeLabels(base, lovr);

      return { categories: cats, labelsMap };
    }catch(err){
      console.warn('[TK] loadKinkData failed, using fallback:', err);
      // Tiny fallback so the UI works no matter what.
      const fallback = [
        { id:'cb_sample1', title:'Sample Category A' },
        { id:'cb_sample2', title:'Sample Category B' }
      ];
      const labelsMap = { cb_sample1:'Sample Category A', cb_sample2:'Sample Category B' };
      return { categories: fallback, labelsMap };
    }
  }

  window.TK.loadKinkData = loadKinkData;
})();
