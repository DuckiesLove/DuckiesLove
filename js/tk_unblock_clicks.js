/*! TK unblock: neutralize full-viewport overlays & keep taps working */
(function(){
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

  // Turn full-screen overlays inert (pointer-events: none)
  function neutralize(){
    try{
      Array.from(document.querySelectorAll('body *')).forEach(el=>{
        const cs=getComputedStyle(el);
        const r=el.getBoundingClientRect();
        const big=r.width>innerWidth*0.85 && r.height>innerHeight*0.85;
        if ((['fixed','absolute','sticky'].includes(cs.position) || big) &&
            cs.pointerEvents!=='none' && +cs.zIndex>=1) {
          el.style.pointerEvents='none';
        }
      });
    }catch{}
  }

  // Enable/disable Start depending on category selections
  function enableStart(){
    try{
      const start=document.querySelector('#start,#startSurvey');
      if (!start) return;
      const any=!!document.querySelector('.category-panel input[type="checkbox"]:checked');
      start.disabled=!any; start.removeAttribute('aria-disabled');
    }catch{}
  }

  // Fallback Select All / Deselect All handlers by button text (idempotent)
  function bindFallbackButtons(){
    const btns=[...document.querySelectorAll('button,[role="button"]')];
    const boxes=()=>[...document.querySelectorAll('.category-panel input[type="checkbox"]')];

    const selectAll   = btns.find(b => /select\s*all/i.test(b.textContent||'')) || null;
    const deselectAll = btns.find(b => /deselect\s*all/i.test(b.textContent||'')) || null;

    if (selectAll && !selectAll.dataset.tkBound) {
      selectAll.addEventListener('click', e=>{
        e.preventDefault();
        boxes().forEach(b=>{ if (!b.checked) { b.checked=true; b.dispatchEvent(new Event('change',{bubbles:true})); } });
        enableStart();
      }, true);
      selectAll.dataset.tkBound='1';
    }
    if (deselectAll && !deselectAll.dataset.tkBound) {
      deselectAll.addEventListener('click', e=>{
        e.preventDefault();
        boxes().forEach(b=>{ if (b.checked) { b.checked=false; b.dispatchEvent(new Event('change',{bubbles:true})); } });
        enableStart();
      }, true);
      deselectAll.dataset.tkBound='1';
    }
  }

  // Keep Start in sync when user checks/unchecks a category
  document.addEventListener('change', e=>{
    if (e.target && e.target.matches('.category-panel input[type="checkbox"]')) enableStart();
  }, true);

  // Run now & after load (covers SPA/layout shifts)
  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', ()=>{ neutralize(); bindFallbackButtons(); enableStart(); }, {once:true});
  } else {
    neutralize(); bindFallbackButtons(); enableStart();
  }
  window.addEventListener('load', ()=>setTimeout(()=>{ neutralize(); bindFallbackButtons(); enableStart(); }, 120), {once:true});
})();
