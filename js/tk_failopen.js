// TK Fail-Open for /kinks/ — runs only if the UI is stuck
(() => {
  const d = document;
  const $$ = (s,r=d)=>Array.from((r||d).querySelectorAll(s));
  const $  = (s,r=d)=>(r||d).querySelector(s);
  const imp = (el,p,v)=>{ try{ el.style.setProperty(p,v,'important'); }catch{} };

  function killOverlays() {
    // remove common "loading" markers
    $$('[data-loading],[aria-busy="true"],.spinner').forEach(n=>n.remove());
    // neuter full-viewport fixed overlays that eat clicks
    let off = 0;
    for (const el of $$('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      const covers = r.left<=0 && r.top<=0 && r.right>=innerWidth-1 && r.bottom>=innerHeight-1;
      if (covers && cs.visibility!=='hidden' && +cs.opacity>0.001 && cs.pointerEvents!=='none') {
        imp(el,'pointer-events','none'); imp(el,'z-index','0'); off++;
      }
    }
    // ensure the panel is clickable
    const panel = $('.category-panel') || d.body;
    imp(panel,'pointer-events','auto'); imp(panel,'z-index','2147483647');
    panel.querySelectorAll('*').forEach(n=>imp(n,'pointer-events','auto'));
    // enable inputs
    panel.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);
    return off;
  }

  async function fetchData() {
    try {
      const r = await fetch('/data/kinks.json?v=' + Date.now(), { cache:'no-store' });
      const ct = r.headers.get('content-type')||'';
      if (!r.ok) return { ok:false, why:'http '+r.status };
      const txt = await r.text();
      if (/^<!doctype html/i.test(txt) || /<html[\s>]/i.test(txt) || /text\/html/i.test(ct))
        return { ok:false, why:'html rewrite' };
      let j=null; try { j = JSON.parse(txt); } catch(e){ return { ok:false, why:'invalid json' }; }
      const arr = Array.isArray(j) ? j : (j && Array.isArray(j.kinks) ? j.kinks : []);
      const cats = [...new Set(arr.map(x=>String(x?.category||x?.cat||'').trim().toLowerCase()).filter(Boolean))];
      return { ok:true, count:arr.length, cats };
    } catch (e) {
      return { ok:false, why:String(e) };
    }
  }

  function banner(msg) {
    if ($('#tk-failopen')) return;
    const st = d.createElement('style');
    st.textContent = `
      #tk-failopen{position:fixed;top:10px;right:10px;z-index:2147483647;background:#111;color:#e6f2ff;
        border:1px solid #333;border-radius:10px;padding:10px;max-width:460px;font:12px system-ui;line-height:1.35}
      #tk-failopen b{color:#00e6ff}
      #tk-failopen button{background:#00e6ff;color:#000;border:0;border-radius:8px;padding:6px 10px;cursor:pointer}
      #tk-failopen .muted{opacity:.75}
    `;
    d.head.appendChild(st);
    const box = d.createElement('div');
    box.id = 'tk-failopen';
    box.innerHTML = `<b>Survey fail-open active</b><div id=tk-msg class=muted style="margin:.35rem 0 .5rem"></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button id=tk-enable>Enable Start</button>
        <button id=tk-done>Dismiss</button>
      </div>`;
    d.body.appendChild(box);
    $('#tk-msg').textContent = msg;
    $('#tk-enable').onclick = () => {
      $('#start,#startSurvey')?.removeAttribute('disabled');
      $('#tk-msg').textContent = 'Start button enabled. You can proceed.';
    };
    $('#tk-done').onclick = ()=>box.remove();
  }

  async function run() {
    // Give normal boot a brief chance
    const start = $('#start,#startSurvey');
    const surveyReady = () => $$('select').length>0 || $$('.kink-row,.survey-row').length>0;
    const timedOut = await new Promise(res=>{
      let t=0; const id=setInterval(()=>{ t+=200; if (surveyReady()) { clearInterval(id); res(false); }
        else if (t>=2500) { clearInterval(id); res(true); } },200);
    });
    if (!timedOut) return; // normal UI appeared, do nothing

    const overlays = killOverlays();
    const info = await fetchData();

    // Inform the user & fail-open
    if (!info.ok) {
      banner(`The page is stuck waiting for data: ${info.why}. We removed the overlay and enabled controls so you can proceed.`);
      start?.removeAttribute('disabled');
      return;
    }

    // Data is reachable but UI didn't render → probably tiny dataset vs. many checkboxes or init loop
    start?.removeAttribute('disabled');
    banner(`Loaded <b>${info.count}</b> items across <b>${info.cats.length}</b> categories. 
            Some categories may be unavailable; we enabled Start and removed blocking overlays (${overlays} neutralized).`);
  }

  // Silence the noisy logger so DevTools stays responsive
  const origLog = console.log.bind(console);
  const allowUnsquish = () => {
    try { return typeof window !== 'undefined' && window.__tk_shouldLog; }
    catch (_) { return false; }
  };
  console.log = (...a)=> {
    if (String(a?.[0]??'').includes('[KINKS-UNSQUISH]') && !allowUnsquish()) return;
    origLog(...a);
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') run();
  else d.addEventListener('DOMContentLoaded', run, { once:true });
})();

/*! TK font fail-open: never let webfonts block interactivity */
(function(){
  function killGoogleFontLinks(){
    var links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis"], link[href*="fonts.gstatic"]'));
    if (!links.length) return false;
    links.forEach(l => { try { l.disabled = true; l.parentNode && l.parentNode.removeChild(l); } catch(e){} });
    document.documentElement.classList.add('tk-font-fallback');
    return true;
  }

  // If the CSS was already stripped, nothing to do.
  // Otherwise, give fonts ~400ms; if still around, remove them.
  var done = false;
  function arm(){
    if (done) return;
    done = true;
    setTimeout(killGoogleFontLinks, 400);
  }

  // Run ASAP
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm, { once:true });
  } else {
    arm();
  }

  // Also fail-open if the Font Loading API reports trouble
  try {
    if (document.fonts && document.fonts.status === 'loading') {
      const t = setTimeout(() => { killGoogleFontLinks(); }, 700);
      document.fonts.addEventListener('loadingdone', () => clearTimeout(t), { once:true });
      document.fonts.addEventListener('loadingerror', () => { clearTimeout(t); killGoogleFontLinks(); }, { once:true });
    }
  } catch {}
})();
