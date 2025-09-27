/*! TK click rerouter: tunnels clicks through overlays to real controls */
(function(){
  function nonPassiveTouch(){
    try{
      const ET=(window.EventTarget||window.Node||function(){}).prototype;
      const orig=ET.addEventListener;
      ET.addEventListener=function(type,fn,opts){
        if(type==='touchend'||type==='touchcancel'){
          if (opts==null) opts={}; else if (typeof opts==='boolean') opts={capture:opts};
          opts.passive=false; return orig.call(this,type,fn,opts);
        }
        return orig.call(this,type,fn,opts);
      };
    }catch{}
  }
  const isAction = el => el && (
    el.matches('button,[role="button"],a.themed-button,input[type="checkbox"]') ||
    /select\s*all|deselect\s*all|start\s*survey/i.test((el.textContent||'').trim())
  );
  function enableStart(){
    const s=document.querySelector('#start,#startSurvey');
    if (!s) return; const any=!!document.querySelector('.category-panel input[type="checkbox"]:checked');
    s.disabled = !any; s.removeAttribute('aria-disabled');
  }
  function reroute(e){
    const x=e.clientX, y=e.clientY;
    const peeled=[]; let top=document.elementFromPoint(x,y); let tries=0;
    const targetOK = el => isAction(el) || (el && el.matches('.category-panel *'));
    while (top && !targetOK(top) && tries<40){
      const cs=getComputedStyle(top);
      if (cs.pointerEvents!=='none'){ top.style.pointerEvents='none'; peeled.push(top); }
      top=document.elementFromPoint(x,y); tries++;
    }
    if (top && top!==e.target && targetOK(top)){
      if (top.matches('input[type="checkbox"]')){
        top.checked=!top.checked;
        top.dispatchEvent(new Event('change',{bubbles:true,cancelable:true}));
        enableStart();
      } else {
        top.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      }
      e.stopImmediatePropagation(); e.preventDefault();
    }
    peeled.forEach(el=>el.style.pointerEvents='');
  }
  function bindFallback(){
    document.addEventListener('click', e=>{
      const t=e.target.closest('button,[role="button"],a.themed-button'); if(!t) return;
      const txt=(t.textContent||'').toLowerCase();
      const boxes=()=>Array.from(document.querySelectorAll('.category-panel input[type="checkbox"]'));
      if (txt.includes('select all')){ e.preventDefault(); boxes().forEach(b=>{if(!b.checked){b.checked=true;b.dispatchEvent(new Event('change',{bubbles:true}));}}); enableStart(); }
      if (txt.includes('deselect all')){ e.preventDefault(); boxes().forEach(b=>{if(b.checked){b.checked=false;b.dispatchEvent(new Event('change',{bubbles:true}));}}); enableStart(); }
      if (txt.includes('start survey')||t.id==='start'||t.id==='startSurvey'){ enableStart(); }
    }, true);
    document.addEventListener('change', e=>{ if (e.target && e.target.matches('.category-panel input[type="checkbox"]')) enableStart(); }, true);
  }
  function raise(){
    const s=document.createElement('style');
    s.textContent=`button,.themed-button,[role="button"],#start,#startSurvey{position:relative;z-index:2147483640!important;pointer-events:auto!important}.category-panel,.category-panel *{pointer-events:auto!important}`;
    document.head.appendChild(s);
  }
  function seed(){
    const b=document.querySelector('.category-panel input[type="checkbox"]');
    if (b && !b.checked){ b.checked=true; b.dispatchEvent(new Event('change',{bubbles:true})); }
    enableStart();
  }
  nonPassiveTouch(); bindFallback(); raise(); seed();
  ['click','pointerdown','mousedown','touchstart','touchend'].forEach(t=>document.addEventListener(t, reroute, true));
})();
