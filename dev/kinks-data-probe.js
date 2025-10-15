/* Kinks data probe: quick fetch + sanity logging */
(async () => {
  const host = document.getElementById('categoryChecklist');
  console.log('[TK TEST] host exists:', !!host, host);

  try {
    const u = new URL('/data/kinks.json', location.href);
    u.searchParams.set('v', Date.now()); // bust cache
    const res = await fetch(u, { cache: 'no-store' });
    console.log('[TK TEST] fetch ok?', res.ok, res.status, res.statusText);
    const json = await res.json().catch(e => (console.warn('json parse failed', e), null));
    console.log('[TK TEST] top-level keys:', json && typeof json==='object' ? Object.keys(json) : '(not object)');

    // try to find an array of items inside whatever shape it is
    function findArray(root, depth=5){
      if (!root || depth<0) return null;
      if (Array.isArray(root)) return root;
      if (typeof root==='object'){
        for (const k of ['items','categories','data','kinks','payload','results']) {
          if (Array.isArray(root[k])) return root[k];
        }
        for (const v of Object.values(root)){ const hit=findArray(v, depth-1); if (hit) return hit; }
      }
      return null;
    }
    const arr = findArray(json) || (Array.isArray(json) ? json : []);
    console.log('[TK TEST] found array length:', arr.length);
    if (arr.length) console.log('[TK TEST] first item sample:', arr[0]);
  } catch (e) {
    console.warn('[TK TEST] fetch failed:', e);
  }
})();
