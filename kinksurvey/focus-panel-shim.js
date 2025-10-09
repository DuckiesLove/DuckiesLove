/* Self-detecting focus/inert shim for the “Select categories” panel */
(() => {
  const q = (s,r=document)=>r.querySelector(s);
  const qa = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const textMatch=(el,rx)=>el && rx.test((el.textContent||'').trim());

  function findPanel(){
    return q('#categorySurveyPanel')||
           q('aside.category-panel')||
           q('aside[aria-label*="category" i]')||
           qa('aside,[role="dialog"]').find(p =>
             /category/i.test(p.getAttribute('aria-label')||'') ||
             qa('h1,h2,h3,[role="heading"]',p).some(h=>/category/i.test(h.textContent||'')));
  }
  function findOpenTrigger(panel){
    const id=panel.id, byControls=id? q(`[aria-controls="${id}"]`):null;
    if(byControls) return byControls;
    const cand=qa('button,a');
    return cand.find(el=>textMatch(el,/select\s+categories/i)) ||
           cand.find(el=>(el.getAttribute('aria-label')||'').toLowerCase().includes('categories'));
  }
  function findCloseBtn(panel){
    return q('[data-action="close"]',panel)||
           q('button[aria-label*="close" i]',panel)||
           qa('button',panel).find(el=>textMatch(el,/^close/i))||
           null;
  }
  function findReturnFocus(openBtn){
    return document.getElementById('start-survey-btn') ||
           qa('button,a').find(el=>/start\s+survey/i.test((el.textContent||'').toLowerCase())) ||
           openBtn || document.body;
  }
  function trapTabFactory(panel){
    return function(e){
      if(e.key!=='Tab')return;
      const f=qa('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',panel)
              .filter(el=>el.offsetParent!==null);
      if(!f.length)return;
      const first=f[0], last=f[f.length-1];
      if(e.shiftKey && document.activeElement===first){ last.focus(); e.preventDefault(); }
      else if(!e.shiftKey && document.activeElement===last){ first.focus(); e.preventDefault(); }
    };
  }
  function focusFirst(panel){
    ( q('[data-focus-first]',panel)||
      q('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',panel)||
      panel ).focus({preventScroll:true});
  }

  const panel=findPanel(); if(!panel) return;
  const openBtn=findOpenTrigger(panel);
  const closeBtn=findCloseBtn(panel);
  const returnTo=findReturnFocus(openBtn);
  const supportsInert=('inert' in HTMLElement.prototype);
  const trapTab=trapTabFactory(panel);

  panel.setAttribute('role', panel.getAttribute('role')||'dialog');
  panel.setAttribute('aria-modal','true');
  if(!panel.getAttribute('aria-label')) panel.setAttribute('aria-label','Category selection');

  function hidePanel(){
    (returnTo||document.body).focus({preventScroll:true});
    if(supportsInert) panel.inert=true; else panel.setAttribute('aria-hidden','true');
    panel.setAttribute('hidden','');
    panel.removeAttribute('tabindex');
    document.removeEventListener('keydown', onKey, true);
    panel.removeEventListener('keydown', trapTab, true);
  }
  function showPanel(){
    if(supportsInert) panel.inert=false; else panel.removeAttribute('aria-hidden');
    panel.removeAttribute('hidden');
    panel.setAttribute('tabindex','-1');
    document.addEventListener('keydown', onKey, true);
    panel.addEventListener('keydown', trapTab, true);
    requestAnimationFrame(()=>focusFirst(panel));
  }
  function onKey(e){ if(e.key==='Escape') hidePanel(); }

  // initialize hidden but focus-safe
  if(supportsInert) panel.inert=true; else panel.setAttribute('aria-hidden','true');
  panel.setAttribute('hidden','');

  if(openBtn) openBtn.addEventListener('click', e=>{e.preventDefault(); showPanel();});
  if(closeBtn) closeBtn.addEventListener('click', e=>{e.preventDefault(); hidePanel();});

  panel.addEventListener('click', e=>{ if(e.target===panel && !panel.hasAttribute('hidden')) hidePanel(); });
})();
