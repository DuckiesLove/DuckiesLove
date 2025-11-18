(function(){
  // Idempotency guard: never re-process the same table twice
  if (window.__TK_COMPAT_DOM_PATCHED__) return;
  window.__TK_COMPAT_DOM_PATCHED__ = true;

  const compat = document.querySelector('table.compat');
  if (!compat) return;

  // Remove any duplicate header cells beyond the canonical 5
  const wanted = ['Kinks','Partner A','Match','Flag','Partner B'];
  const ths = [...compat.tHead?.rows?.[0]?.cells||[]];
  if (ths.length) {
    // If a second Item/Flag snuck in, rebuild the header cleanly
    compat.tHead.innerHTML = '';
    const tr = document.createElement('tr');
    wanted.forEach((h,i)=>{
      const th = document.createElement('th');
      th.textContent = h;
      th.className = ['label','a','match','flag','b'][i];
      tr.appendChild(th);
    });
    compat.tHead.appendChild(tr);
  }

  // Inject a matching colgroup so widths are fixed
  if (!compat.querySelector('colgroup')) {
    const cg = document.createElement('colgroup');
    ['label','a','match','flag','b'].forEach(cls=>{
      const c = document.createElement('col'); c.className = cls; cg.appendChild(c);
    });
    compat.insertBefore(cg, compat.firstChild);
  }

  // Normalize any legacy “flag glyph” text to a single symbol ▶
  compat.querySelectorAll('td.flag').forEach(td=>{
    const s = (td.textContent||'').trim();
    if (!s || /&|†|%/.test(s)) td.textContent = '▶';
  });
})();
