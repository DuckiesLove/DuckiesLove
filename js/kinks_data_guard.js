// TK data guard for /kinks/
// - Fetch /data/kinks.json
// - Disable/dim categories that have no rows in data
// - Auto-select one available category; enable Start when any available is checked
// - Show a small notice listing missing categories
(async () => {
  const d = document;
  const $ = (s, r=d) => r.querySelector(s);
  const $$ = (s, r=d) => Array.from(r.querySelectorAll(s));
  const norm = (t) => String(t||"").trim().replace(/\s+/g,' ').toLowerCase();

  // style for disabled categories + notice
  if (!$('#tk-guard-style')) {
    const st = d.createElement('style');
    st.id = 'tk-guard-style';
    st.textContent = `
      .tk-missing{opacity:.45; filter:grayscale(.3);}
      .tk-missing input{pointer-events:none !important}
      #tk-guard-note{background:#111;color:#e6f2ff;border:1px solid #333;padding:.5rem .75rem;border-radius:.5rem;margin:.75rem 0;line-height:1.3}
      #tk-guard-note b{color:#00e6ff}
    `;
    d.head.appendChild(st);
  }

  // Load the live data
  async function loadData(){
    try{
      const r = await fetch('/data/kinks.json?v=' + Date.now(), {cache:'no-store'});
      if (!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      const arr = Array.isArray(j) ? j : (j && Array.isArray(j.kinks) ? j.kinks : []);
      const cats = new Set(arr.map(x => norm(x.category || x.cat)));
      return {arr, cats};
    }catch(e){
      console.warn('[TK-GUARD] data fetch failed:', e);
      return {arr:[], cats:new Set()};
    }
  }

  // Extract UI categories and their checkboxes
  function getUICategories(){
    const panel = $('.category-panel') || d;
    const items = [];
    panel.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
      let label = '';
      // try siblings/parent text for label
      const p = cb.closest('div,li,label') || cb.parentElement;
      label = (p?.textContent || '').replace(/\s+/g,' ').trim();
      // trim leading checkbox char if present
      label = label.replace(/^\W+/, '');
      // keep only the first phrase before double spaces to avoid extra text
      items.push({ cb, label, key: norm(label), row: p || cb.parentElement });
    });
    // de-dup by key (some DOMs may have nested text)
    const seen = new Set();
    return items.filter(it => it.key && !seen.has(it.key) && (seen.add(it.key), true));
  }

  // Update Start button state
  function wireStart(cats){
    const start = $('#start,#startSurvey');
    if (!start) return;
    const update = () => {
      const any = $$('.category-panel input[type="checkbox"]').some(cb => !cb.disabled && cb.checked);
      start.disabled = !any;
    };
    $$('.category-panel input[type="checkbox"]').forEach(cb => cb.addEventListener('change', update));
    update();
  }

  // Insert/replace notice
  function showNotice(missing){
    let note = $('#tk-guard-note');
    if (!note) {
      note = d.createElement('div');
      note.id = 'tk-guard-note';
      const host = $('.category-panel') || d.body;
      host.prepend(note);
    }
    if (missing.length) {
      note.innerHTML = `Some categories are temporarily unavailable because the current data file only includes <b>${missing.available.join(', ') || 'no'}</b> categories. The others are disabled for now: ${missing.missing.join(', ')}.`;
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }

  // Main
  const { cats } = await loadData();
  const ui = getUICategories();
  if (!ui.length) return; // nothing to do

  // Split available vs missing
  const available = ui.filter(it => cats.has(it.key));
  const missing = ui.filter(it => !cats.has(it.key));

  // Disable missing visually and functionally
  missing.forEach(it => {
    it.cb.disabled = true;
    it.row?.classList?.add('tk-missing');
    it.cb.checked = false;
  });

  // Auto-select first available if none is selected yet
  const hasSelection = available.some(it => it.cb.checked);
  if (!hasSelection && available.length) {
    available[0].cb.checked = true;
    available[0].cb.dispatchEvent(new Event('change',{bubbles:true}));
  }

  // Enable/disable Start based on a real selection
  wireStart(cats);

  // Show a small explanatory banner
  showNotice({
    available: available.map(it => it.label),
    missing:   missing.map(it => it.label)
  });

  console.log(`[TK-GUARD] UI categories: ${ui.length}, available: ${available.length}, missing: ${missing.length}`);
})();
