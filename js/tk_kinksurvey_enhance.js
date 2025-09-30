/*! Talk Kink kinksurvey enhancements */
(function(){
  const $ = (sel, root = document) => root?.querySelector?.(sel) || null;
  const $$ = (sel, root = document) => (root?.querySelectorAll ? Array.from(root.querySelectorAll(sel)) : []);
  const byText = (sel, re, root = document) => $$(sel, root).find(node => re.test((node.textContent || "").trim())) || null;
  const el = (tag, attrs = {}, html = "") => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === "class") node.className = value;
      else node.setAttribute(key, value);
    });
    if (html) node.innerHTML = html;
    return node;
  };

  const START_SELECTORS = ['#startSurvey','#start','#startBtn','#startSurveyBtn','[data-start]'];
  const isKinkSurvey = /^\/kinksurvey(?:\/.*)?$/i.test(location.pathname || "");
  if (!isKinkSurvey) return;

  const HARD_NAV_CLASS = 'ksv-external';
  const HARD_NAV_EVENTS = ['click','mousedown','touchstart'];

  function ensureHardNavCapture(){
    if (document.__tkHardNavCapture) return;
    const handler = (ev) => {
      const anchor = ev.target?.closest?.(`a.${HARD_NAV_CLASS}`);
      if (!anchor) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      window.location.assign(anchor.href);
    };
    HARD_NAV_EVENTS.forEach(type => document.addEventListener(type, handler, true));
    document.__tkHardNavCapture = handler;
  }

  function applyHardNavigation(anchor, url){
    if (!anchor) return;
    anchor.href = url;
    anchor.classList.add(HARD_NAV_CLASS);
    anchor.setAttribute('rel','external noopener');
    if (!anchor.__tkHardNav){
      const go = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        window.location.assign(url);
      };
      HARD_NAV_EVENTS.forEach(type => anchor.addEventListener(type, go, true));
      anchor.__tkHardNav = go;
    }
    ensureHardNavCapture();
  }

  if (document.body){
    document.body.dataset.kinksurvey = '1';
    document.body.classList.add('tk-ksv');
    document.body.classList.remove('tk-no-js');
    document.body.classList.add('tk-js');
  }

  removeRequestButtons();

  function removeRequestButtons(){
    const killers = [
      '#requestJoinBtn',
      'button[data-action="request-join"]',
      'a[href="/join"]',
      'a[href*="mischief"][href*="join"]',
      'a[href*="request"][href*="join"]'
    ];
    killers.forEach(sel => {
      $$(sel).forEach(node => node.remove());
    });
    const byLabel = byText('a,button', /request\s+to\s+join\s+mischief\s+manor/i);
    if (byLabel) byLabel.remove();
  }

  function findStartButton(){
    for (const sel of START_SELECTORS) {
      const btn = $(sel);
      if (btn) return btn;
    }
    return null;
  }

  function moveThemeInto(row, legacyWrap){
    if (!row) return;
    const scopes = legacyWrap ? [legacyWrap, document] : [document];
    let select = null;
    for (const scope of scopes){
      select = $('#themeSelector', scope) || $('.theme-select', scope) || $('select[name="theme"]', scope);
      if (select) break;
    }
    if (!select){
      row.style.display = 'none';
      return;
    }
    const label = el('label',{class:'tk-theme'});
    label.append('Theme');
    label.appendChild(select);
    row.appendChild(label);
  }

  function forceClosePanel(){
    const panel = $('#categorySurveyPanel') || $('.category-panel') || $('#categoryPanel');
    const toggle = $('#panelToggle') || $('.panel-toggle');
    if (panel){
      panel.classList.remove('open');
      panel.setAttribute('aria-expanded','false');
      panel.setAttribute('aria-hidden','true');
    }
    document.body?.classList?.remove('panel-open','tk-panel-open','drawer-open','tk-drawer-open');
    toggle?.setAttribute?.('aria-expanded','false');
  }

  function retargetKsvButtons(){
    const buttons = $$("a.ksvBtn");
    if (!buttons.length) return;

    const findByLabel = (pattern) => buttons.find(btn => pattern.test((btn.textContent || "").trim())) || null;

    const compat = findByLabel(/compat/i);
    if (compat) applyHardNavigation(compat, 'https://talkkink.org/compatibility.html');

    const analysis = findByLabel(/individual\s*kink\s*analysis/i);
    if (analysis) applyHardNavigation(analysis, 'https://talkkink.org/individualkinkanalysis.html');
  }

  function ensureHero(){
    $$('#tkHero, #tk-hero, .tk-hero, #ksvHeroStack').forEach(node => node.remove());

    const legacyWrap = $('.landing-wrapper');
    const wrap = legacyWrap?.parentElement || $('main') || $('.wrap') || $('.page') || $('.kinks-root') || document.body;
    const anchor = legacyWrap || $('#categorySurveyPanel') || $('.category-panel') || $('#categoryPanel') || wrap?.firstChild;
    if (!wrap || !anchor) return;

    const hero = el('section',{id:'ksvHeroStack','aria-label':'Main actions'});
    hero.appendChild(el('h1',{},'Talk Kink Survey'));

    const stack = el('div',{class:'ksvButtons'});
    hero.appendChild(stack);

    const startNode = el('button',{
      class:'ksvBtn start-survey-btn',
      id:'tkHeroStart',
      type:'button',
      'data-ksv-start':'',
    },'Start Survey');
    startNode.removeAttribute('disabled');
    stack.appendChild(startNode);

    const compatNode = el('a',{class:'ksvBtn', id:'btn-compat', href:'https://talkkink.org/compatibility.html'},'Compatibility Page');
    stack.appendChild(compatNode);

    const analysisNode = el('a',{class:'ksvBtn', id:'btn-ika', href:'https://talkkink.org/individualkinkanalysis.html'},'Individual Kink Analysis');
    stack.appendChild(analysisNode);

    applyHardNavigation(compatNode, 'https://talkkink.org/compatibility.html');
    applyHardNavigation(analysisNode, 'https://talkkink.org/individualkinkanalysis.html');

    const themeRow = el('div',{class:'ksvThemeRow', id:'tkThemeRow'});
    moveThemeInto(themeRow, legacyWrap);
    if (themeRow.childElementCount) hero.appendChild(themeRow);

    if (anchor && anchor.parentNode === wrap) {
      wrap.insertBefore(hero, anchor);
    } else {
      wrap.insertBefore(hero, wrap.firstChild);
    }

    if (legacyWrap){
      const warning = $('#warning', legacyWrap) || $('#warning');
      if (warning && warning !== hero && warning.parentNode !== hero){
        hero.appendChild(warning);
      }
      legacyWrap.remove();
    }

    if (startNode && !startNode.dataset.ksvBound){
      startNode.dataset.ksvBound = '1';
      startNode.addEventListener('click', (event) => {
        const panel = $('#categorySurveyPanel') || $('.category-panel') || $('#categoryPanel');
        const isAlreadyOpen = panel?.classList?.contains('open');
        if (isAlreadyOpen){
          const focusTarget = panel?.querySelector('input,button,select,textarea,[tabindex]:not([tabindex="-1"])');
          if (focusTarget){
            setTimeout(() => focusTarget.focus({ preventScroll: true }), 60);
          }
          return;
        }
        const openPanel = typeof window?.tkKinksurveyOpenPanel === 'function' ? window.tkKinksurveyOpenPanel : null;
        if (openPanel){
          event?.preventDefault?.();
          event?.stopImmediatePropagation?.();
          openPanel({ focusFirst: true, trigger: startNode });
          return;
        }
        const toggle = $('#panelToggle') || $('.panel-toggle');
        const drawer = $('#tkDrawer');
        if (drawer){
          drawer.classList.add('open');
          document.body?.classList?.add('drawer-open','tk-drawer-open','tk-panel-open');
        }
        if (panel){
          panel.classList.add('open');
          document.body?.classList?.add('panel-open','tk-drawer-open','tk-panel-open');
        }
        toggle?.setAttribute?.('aria-expanded','true');
        const realStart = findStartButton();
        panel?.scrollIntoView({behavior:'smooth', block:'start'});
        setTimeout(() => realStart?.focus?.(), 280);
      });
    }
    retargetKsvButtons();
  }

  function ensureObserver(listHost){
    if (!listHost || listHost.__tkObserver) return;
    const observer = new MutationObserver(() => {
      if (listHost.querySelector('input[type="checkbox"]')){
        observer.disconnect();
        listHost.__tkObserver = null;
        enhancePanel();
      }
    });
    observer.observe(listHost,{childList:true, subtree:true});
    listHost.__tkObserver = observer;
  }

  function enhancePanel(){
    const panel = $('#categorySurveyPanel') || $('.category-panel') || $('#categoryPanel');
    const drawerContent = $('#tkDrawerContent');
    const enhanceScope = drawerContent || panel;
    if (!enhanceScope) return;

    const listHost = enhanceScope.querySelector('.category-list')
      || panel?.querySelector?.('.category-list');
    if (!listHost){
      ensureObserver(panel || enhanceScope);
      return;
    }

    const checkboxes = Array.from(listHost.querySelectorAll('input[type="checkbox"]'));
    if (!checkboxes.length){
      ensureObserver(listHost);
      return;
    }

    const datasetNode = panel || enhanceScope;
    if (datasetNode.dataset.tkEnhanced === '1'){
      updateCounter(datasetNode);
      return;
    }
    datasetNode.dataset.tkEnhanced = '1';

    panel?.classList.add('tk-wide-panel');

    listHost.parentElement?.querySelector('.tk-catbar')?.remove();

    const topBar = el('div',{class:'tk-catbar'});
    const selectAll = $('#selectAll', enhanceScope) || $('#selectAll', panel) || enhanceScope.querySelector('button#selectAll');
    const deselectAll = $('#deselectAll', enhanceScope) || $('#deselectAll', panel) || enhanceScope.querySelector('button#deselectAll');
    const originalRow = selectAll?.parentElement === deselectAll?.parentElement ? selectAll?.parentElement : null;

    if (selectAll) topBar.appendChild(selectAll);
    if (deselectAll) topBar.appendChild(deselectAll);

    const counter = el('div',{class:'tk-counter', id:'tkCatCounter'},'0 selected / 0 total');
    topBar.appendChild(counter);

    const parentForList = listHost.parentElement || enhanceScope;
    parentForList.insertBefore(topBar, listHost);

    if (originalRow && originalRow !== topBar){
      const hasContent = Array.from(originalRow.childNodes).some(node => {
        if (node === topBar) return true;
        if (node.nodeType === 1) return true;
        if (node.nodeType === 3 && node.textContent.trim()) return true;
        return false;
      });
      if (!hasContent) originalRow.remove();
    }

    const items = checkboxes.map(cb => {
      const label = cb.closest('label');
      let text = '';
      if (label) {
        text = label.textContent || '';
      } else {
        text = cb.getAttribute('aria-label') || cb.getAttribute('data-label') || cb.value || cb.id || '';
      }
      text = text.replace(/\s+/g,' ').trim();
      return {cb, text: text || 'Category'};
    });

    items.sort((a, b) => a.text.localeCompare(b.text, undefined, {sensitivity:'base'}));

    const grid = el('div',{class:'tk-catgrid'});
    let lastLetter = '';
    items.forEach(({cb, text}) => {
      const letter = (text[0] || '').toUpperCase();
      if (letter && letter !== lastLetter){
        grid.appendChild(el('div',{class:'tk-letter'}, letter));
        lastLetter = letter;
      }
      const row = el('label',{class:'tk-cat'});
      row.appendChild(cb);
      const span = el('span',{class:'lbl'});
      span.textContent = text;
      row.appendChild(span);
      grid.appendChild(row);
    });

    listHost.innerHTML = '';
    listHost.appendChild(grid);

    const update = () => {
      const total = items.length;
      const selected = items.reduce((count, item) => count + (item.cb.checked ? 1 : 0), 0);
      counter.textContent = `${selected} selected / ${total} total`;
      if (typeof window.tkUpdateCategoryChip === 'function') {
        window.tkUpdateCategoryChip(selected, total);
      }
    };

    items.forEach(item => item.cb.addEventListener('change', update));
    selectAll?.addEventListener('click', () => setTimeout(update, 0));
    deselectAll?.addEventListener('click', () => setTimeout(update, 0));

    update();
  }

  function updateCounter(panel){
    const counter = panel?.querySelector?.('#tkCatCounter') || document.querySelector('#tkCatCounter');
    if (!counter) return;
    const scope = document.querySelector('#tkDrawerContent') || panel || document;
    const checkboxes = scope.querySelectorAll('input[type="checkbox"]');
    const total = checkboxes.length;
    let selected = 0;
    checkboxes.forEach(cb => { if (cb.checked) selected += 1; });
    counter.textContent = `${selected} selected / ${total} total`;
    if (typeof window.tkUpdateCategoryChip === 'function') {
      window.tkUpdateCategoryChip(selected, total);
    }
  }

  function setupFullscreenDrawer(){
    const drawer = $('#tkCategoryDrawer');
    const body = document.body;
    if (!drawer || !body || drawer.dataset.tkFullscreen === '1') return;
    drawer.dataset.tkFullscreen = '1';

    const backdrop = $('#tkDrawerBackdrop');
    const closeBtn = $('#tkCloseDrawer', drawer) || $('#tkCloseDrawer');
    const actionsBar = drawer.querySelector('.tk-drawer-actions');

    let startNow = $('#tkStartNow', drawer);
    if (!startNow && actionsBar){
      startNow = el('button',{id:'tkStartNow', class:'tk-btn primary', type:'button'},'Start Now');
      actionsBar.prepend(startNow);
    }

    const allCategoryBoxes = () =>
      Array.from(drawer.querySelectorAll('input[type="checkbox"]')).filter(cb =>
        cb.classList.contains('category-checkbox') ||
        cb.name === 'category' ||
        cb.closest('.category-list')
      );

    const selectedCategories = () =>
      allCategoryBoxes()
        .filter(cb => cb.checked)
        .map(cb => cb.value || cb.getAttribute('value') || (cb.nextElementSibling?.textContent || '').trim())
        .filter(Boolean);

    const focusDrawer = () => {
      setTimeout(() => {
        const focusTarget = drawer.querySelector('input,button,select,textarea,[tabindex]') || drawer;
        focusTarget?.focus?.();
      }, 10);
    };

    const openFullscreen = () => {
      const api = window.tkCategoriesDrawer;
      if (api?.open) api.open();
      else {
        body.classList.add('tk-drawer-open','tk-panel-open');
        drawer.setAttribute('aria-hidden','false');
        backdrop?.setAttribute('aria-hidden','false');
      }
      body.classList.add('tk-fullscreen','tk-body-lock');
      backdrop?.setAttribute('aria-hidden','true');
      focusDrawer();
    };

    const closeFullscreen = () => {
      const api = window.tkCategoriesDrawer;
      if (api?.close) api.close();
      else {
        body.classList.remove('tk-drawer-open','tk-panel-open');
        drawer.setAttribute('aria-hidden','true');
        backdrop?.setAttribute('aria-hidden','true');
      }
      body.classList.remove('tk-fullscreen','tk-body-lock');
    };

    const startButton =
      $('#startSurvey') ||
      $('#start') ||
      $('#startSurveyBtn') ||
      ($$('button').find(btn => /start\s*survey/i.test(btn.textContent || '')) || null);

    if (startButton){
      startButton.addEventListener('click', (event) => {
        event?.preventDefault?.();
        event?.stopImmediatePropagation?.();
        openFullscreen();
      }, {capture:true});
    }

    startNow?.addEventListener('click', async (event) => {
      event?.preventDefault?.();
      const cats = selectedCategories();
      if (!cats.length){
        alert('Please select at least one category.');
        return;
      }
      try {
        if (typeof window.KINKS_boot === 'function'){
          await Promise.resolve(window.KINKS_boot({categories: cats}));
        } else {
          console.warn('[TK] KINKS_boot not found; continuing anyway.');
        }
      } catch (err) {
        console.error('[TK] Failed to start survey:', err);
        alert('Failed to start the survey. See console for details.');
        return;
      }
      closeFullscreen();
    });

    closeBtn?.addEventListener('click', (event) => {
      event?.preventDefault?.();
      closeFullscreen();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && body.classList.contains('tk-fullscreen')){
        closeFullscreen();
      }
    });
  }

  function boot(){
    forceClosePanel();
    ensureHero();
    retargetKsvButtons();
    enhancePanel();
    setupFullscreenDrawer();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

  try {
    window.tkKinkSurveyBoot = boot;
  } catch (err) {
    /* noop */
  }
})();
