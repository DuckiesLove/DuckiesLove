/*! TK unblock: neutralize overlays & keep survey controls interactive */
(function(){
  const START_SELECTOR = '#start,#startSurvey,#startSurveyBtn';
  const BOX_SELECTOR = '.category-panel input[type="checkbox"],input[name="category"][type="checkbox"]';

  // Make touchend/touchcancel non-passive so tap handlers can preventDefault when needed
  try{
    const ET=(window.EventTarget||window.Node||function(){}).prototype;
    const orig=ET.addEventListener;
    ET.addEventListener=function(type,listener,opts){
      if(type==='touchend'||type==='touchcancel'){
        if (opts==null) opts={}; else if (typeof opts==='boolean') opts={capture:opts};
        opts.passive=false;
        return orig.call(this,type,listener,opts);
      }
      return orig.call(this,type,listener,opts);
    };
  }catch{}

  function $(sel, root=document){ return root.querySelector(sel); }
  function $$(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function recoverAttributes(){
    try {
      $$('[inert]').forEach(node => node.removeAttribute('inert'));
      $$(BOX_SELECTOR).forEach(box => { box.disabled = false; box.style.pointerEvents = 'auto'; });
      const start = $(START_SELECTOR);
      if (start) {
        start.disabled = !!start.disabled && start.disabled; // leave as-is; syncStart adjusts below
        start.style.pointerEvents = 'auto';
      }
    } catch {}
  }

  // Turn full-screen overlays inert (pointer-events: none)
  function neutralizeOverlays(){
    try{
      $$("body *").forEach(el=>{
        const cs=getComputedStyle(el);
        if(cs.pointerEvents==='none' || cs.visibility==='hidden' || cs.display==='none') return;
        const rect=el.getBoundingClientRect();
        const covers = rect.left <= 0 && rect.top <= 0 &&
                       rect.right >= innerWidth - 1 && rect.bottom >= innerHeight - 1;
        const fixed = cs.position==='fixed';
        if ((fixed && covers) || (cs.position==='fixed' && +cs.zIndex>2000000000)){
          el.classList.add('tk-overlay-off');
        }
      });
    }catch{}
  }

  function getBoxes(){
    return $$(BOX_SELECTOR).filter(el => el instanceof HTMLInputElement);
  }

  function syncStart(){
    try{
      const start=$(START_SELECTOR);
      if(!start) return;
      const any=getBoxes().some(box => box.checked);
      start.disabled=!any;
      start.setAttribute('aria-disabled', String(!any));
      if (!any) {
        start.style.opacity = '0.5';
      } else {
        start.style.opacity = '1';
      }
    }catch{}
  }

  function dispatchToggle(value){
    getBoxes().forEach(box => {
      if (box.checked === value) return;
      box.checked = value;
      box.dispatchEvent(new Event('change', { bubbles:true }));
    });
    syncStart();
  }

  function wireButtons(){
    const selectAll=$('#selectAll');
    if (selectAll && !selectAll.dataset.tkBound){
      selectAll.addEventListener('click', e=>{ e.preventDefault(); dispatchToggle(true); });
      selectAll.dataset.tkBound='1';
    }
    const deselectAll=$('#deselectAll');
    if (deselectAll && !deselectAll.dataset.tkBound){
      deselectAll.addEventListener('click', e=>{ e.preventDefault(); dispatchToggle(false); });
      deselectAll.dataset.tkBound='1';
    }
  }

  function wireStartFallback(){
    const start=$(START_SELECTOR);
    if(!start || start.dataset.tkFallbackBound) return;
    start.addEventListener('click', async e=>{
      if (e.defaultPrevented) return;
      const chosen=getBoxes().filter(box=>box.checked).map(box=>box.value);
      if (!chosen.length) { syncStart(); return; }
      if (typeof window.KINKS_boot !== 'function') return;
      e.preventDefault();
      try {
        start.disabled = true;
        await window.KINKS_boot({ categories: chosen });
      } catch (err) {
        console.error('[TK] fallback start failed:', err);
      } finally {
        syncStart();
      }
    }, false);
    start.dataset.tkFallbackBound='1';
  }

  function bindCheckboxChanges(){
    document.addEventListener('change', e=>{
      if (e.target instanceof HTMLInputElement && e.target.matches(BOX_SELECTOR)){
        syncStart();
      }
    }, true);
  }

  function prime(){
    recoverAttributes();
    neutralizeOverlays();
    wireButtons();
    wireStartFallback();
    syncStart();
  }

  bindCheckboxChanges();

  if (document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', prime, {once:true});
  } else {
    prime();
  }
  window.addEventListener('load', ()=>setTimeout(prime, 100), {once:true});
})();
