/*  Unfreezes Start Survey + category panel.
    - Keeps your look; only toggles .is-open on #categorySurveyPanel (no focus traps).
    - On “Begin” it emits `tk:start-survey` with selected categories.
    - If no code handles it within 150ms, it navigates to /kinksurvey/?run=1&cats=...
    - Guarantees progress (no more frozen clicks).
*/
(function(){
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  const panel         = qs('#categorySurveyPanel');
  const startBtnHome  = qs('#startSurveyBtn');
  const panelCloseBtn = panel ? panel.querySelector('[data-action="close-panel"], .js-close, .tk-close') : null;
  const selectAllBtn  = qs('#btnSelectAll');
  const deselectBtn   = qs('#btnDeselectAll');
  const catListBox    = qs('#categoryChecklist');
  const beginBtn      = qs('#beginSurveyFromPanel');
  const selectedBadge = qs('#selectedCountBadge');

  let CATEGORIES = [];
  let LABELS     = {};
  let selected   = new Set();

  function openPanel(){ if(panel) panel.classList.add('is-open'); }
  function closePanel(){ if(panel) panel.classList.remove('is-open'); }

  function updateSelectedBadge(){
    if(!selectedBadge) return;
    selectedBadge.textContent = `${selected.size} selected / ${CATEGORIES.length} total`;
  }

  function renderCategoryChecklist(){
    if(!catListBox) return;
    catListBox.innerHTML = '';
    const frag = document.createDocumentFragment();

    const items = [...CATEGORIES].sort((a,b)=>
      (a.title||a.id).localeCompare((b.title||b.id), undefined, { sensitivity:'base' })
    );

    for(const cat of items){
      const label = document.createElement('label');
      label.className = 'tk-check';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = cat.id;
      input.className = 'tk-check__input';
      input.addEventListener('change', ()=>{
        if(input.checked) selected.add(cat.id); else selected.delete(cat.id);
        updateSelectedBadge();
      });

      const text = document.createElement('span');
      text.className = 'tk-check__label';
      text.textContent = LABELS[cat.id] || cat.title || cat.id;

      label.appendChild(input);
      label.appendChild(text);
      frag.appendChild(label);
    }
    catListBox.appendChild(frag);
    updateSelectedBadge();
  }

  function selectAll(checked){
    qsa('input[type="checkbox"]', catListBox).forEach(cb=>{
      cb.checked = !!checked;
      if(checked) selected.add(cb.value); else selected.delete(cb.value);
    });
    updateSelectedBadge();
  }

  function startSurveyRun(){
    try{
      closePanel();
      const detail = { includeCategories:[...selected] };
      const evt = new CustomEvent('tk:start-survey', { detail, bubbles:true });
      document.dispatchEvent(evt);

      // Runner can set window.__TK_SURVEY_STARTED = true to suppress fallback.
      setTimeout(()=>{
        if(!window.__TK_SURVEY_STARTED){
          const params = new URLSearchParams();
          if(detail.includeCategories.length) params.set('cats', detail.includeCategories.join(','));
          params.set('run','1');
          window.location.href = `/kinksurvey/?${params.toString()}`;
        }
      }, 150);
    }catch(err){
      console.error('[TK] startSurveyRun failed, using fallback:', err);
      window.location.href = '/kinksurvey/?run=1';
    }
  }

  async function init(){
    try{
      const data = await (window.TK && typeof TK.loadKinkData === 'function'
        ? TK.loadKinkData()
        : Promise.resolve({ categories:[], labelsMap:{} })
      );
      CATEGORIES = data.categories || [];
      LABELS     = data.labelsMap || {};

      renderCategoryChecklist();

      if(startBtnHome)  startBtnHome.addEventListener('click', e=>{ e.preventDefault(); openPanel(); });
      if(panelCloseBtn) panelCloseBtn.addEventListener('click', e=>{ e.preventDefault(); closePanel(); });
      if(selectAllBtn)  selectAllBtn.addEventListener('click', ()=>selectAll(true));
      if(deselectBtn)   deselectBtn.addEventListener('click', ()=>selectAll(false));
      if(beginBtn)      beginBtn.addEventListener('click', e=>{ e.preventDefault(); startSurveyRun(); });

      closePanel(); // start closed
      console.log(`[TK] Loaded ${CATEGORIES.length} categories; UI wired.`);
    }catch(err){
      console.error('[TK] kinksurvey init failed; enabling direct fallback. Error:', err);
      if(startBtnHome) startBtnHome.addEventListener('click', ()=>{ window.location.href = '/kinksurvey/?run=1'; });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
