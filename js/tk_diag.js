/*! TK Diag: early error trap + on-screen status for /kinks/ */
(function(){
  // Build overlay
  const box = document.createElement('div');
  box.id = 'tk-diag';
  box.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;padding:8px 10px;border:1px solid #00e6ff66;border-radius:8px;background:#0a0a0a;color:#e6f2ff;font:12px system-ui;max-width:46ch;box-shadow:0 2px 14px #000a';
  box.innerHTML = '<b>TK diag</b><span id="tkx" style="float:right;cursor:pointer">×</span><div id="tkl" style="margin-top:6px;white-space:pre-wrap"></div>';

  const attachBox = () => {
    if (!box.isConnected && document.body) {
      document.body.appendChild(box);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachBox, {once:true});
  } else {
    attachBox();
  }

  if (document.head) {
    document.head.appendChild(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'/css/tk_diag_fallback.css'}));
  }
  document.addEventListener('click',e=>{ if(e.target && e.target.id==='tkx'){ box.remove(); } });

  const log = (...a)=> { const el = document.getElementById('tkl'); el && (el.textContent += a.join(' ')+'\n'); console.log('[TK]',...a); };

  // Early error trapping
  const errs=[];
  const state = window.__tkDiag = window.__tkDiag || {};
  state.box = box;
  state.attachBox = attachBox;
  state.errors = errs;
  state.log = log;
  state.runChecks = () => {};
  state.clearErrors = () => { errs.length = 0; };

  window.addEventListener('error', e=>{ errs.push({type:'error', msg:e.message, src:(e.filename||'')+':'+(e.lineno||'')}); log('ERR', e.message); }, true);
  window.addEventListener('unhandledrejection', e=>{ const m=String(e.reason && (e.reason.message||e.reason) || e); errs.push({type:'promise', msg:m}); log('REJECT', m); }, true);

  // Quick environment checks after paint
  function checks(){
    state.lastRun = Date.now();
    try {
      // 1) If computed body color is black, enable fallback class
      const bc = getComputedStyle(document.body||document.documentElement).color;
      if (/rgb\(0,\s*0,\s*0\)/.test(bc) || bc==='') {
        document.documentElement.classList.add('tk-diag-fallback');
        log('Color looked black → applied fallback text color.');
      }
      // 2) CSS presence
      try {
        const cssList = [...document.styleSheets].map(s=>s.href||'(inline)').filter(Boolean);
        log('CSS loaded:', cssList.join(', '));
      } catch (e) {
        log('CSS read failed:', String(e));
      }

      // 3) Data check
      if (typeof fetch === 'function') {
        const KINK_URLS = [
          '/data/kinks.json',
          '/kinksurvey/data/kinks.json',
          '/kinksurvey/kinks.json',
          '/kinks.json',
          '/assets/kinks.json'
        ];
        (async () => {
          for (const url of KINK_URLS) {
            try {
              const r = await fetch(url, {cache:'no-store'});
              log('kinks.json', url, r.status, r.headers.get('content-type')||'');
              if(!r.ok) continue;
              try {
                const j = await r.json();
                const items = Array.isArray(j) ? j.length
                           : Array.isArray(j?.kinks) ? j.kinks.length
                           : Array.isArray(j?.[0]?.items) ? j[0].items.length : 0;
                log('kinks items (approx):', String(items));
              } catch(e){
                log('kinks.json parse failed:', String(e));
              }
              break;
            } catch(e){
              log('kinks.json fetch failed:', String(e));
            }
          }
        })();
      } else {
        log('fetch unavailable in environment');
      }

      // 4) Start button + categories status
      const start = document.querySelector('#start,#startSurvey');
      const cats  = document.querySelectorAll('.category-panel input[type="checkbox"]').length;
      if (start) { log('Start disabled?', String(start.disabled)); if (cats>0) { start.disabled=false; log('Enabled Start (categories present).'); } }
      log('Category checkboxes seen:', String(cats));

      // 5) Print any trapped errors last (for quick copy)
      if (errs.length) log('errors:', JSON.stringify(errs));
    } catch(e){ log('diag exception:', String(e)); }
  }
  state.runChecks = checks;
  (document.readyState==='loading') ? document.addEventListener('DOMContentLoaded', checks, {once:true}) : checks();
})();
