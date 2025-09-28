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
  const isKinkSurvey = /^\/kinksurvey\/?$/i.test(location.pathname || "");
  if (!isKinkSurvey) return;

  if (document.body){
    document.body.dataset.kinksurvey = '1';
    document.body.classList.add('tk-ksv');
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

  function ensureHero(){
    $$('#tkHero, #tk-hero, .tk-hero').forEach(node => node.remove());

    const legacyWrap = $('.landing-wrapper');
    const wrap = legacyWrap?.parentElement || $('main') || $('.wrap') || $('.page') || $('.kinks-root') || document.body;
    const anchor = legacyWrap || $('#categorySurveyPanel') || $('.category-panel') || $('#categoryPanel') || wrap?.firstChild;
    if (!wrap || !anchor) return;

    const hero = el('div',{class:'tk-hero','aria-label':'Main actions', id:'tkHero'});
    hero.appendChild(el('h1',{class:'tk-title'},'Talk Kink — Survey'));

    const startRow = el('div',{class:'tk-row row row-start'});
    hero.appendChild(startRow);
    let startNode = findStartButton();
    let usingExistingStart = false;
    if (legacyWrap && startNode && legacyWrap.contains(startNode)){
      startNode.classList.add('tk-btn','xl','cta','tk-cta');
      startRow.appendChild(startNode);
      usingExistingStart = true;
    } else {
      startNode = el('button',{
        class:'tk-btn xl cta tk-cta',
        id:'tkHeroStart',
        type:'button',
      },'Start Survey');
      startRow.appendChild(startNode);
    }

    startNode?.setAttribute?.('data-ksv-start','');

    const navRow = el('div',{class:'tk-row row row-nav'});
    navRow.appendChild(el('a',{class:'tk-pill cta tk-cta', href:'/compatibility/'},'Compatibility Page'));
    navRow.appendChild(el('a',{class:'tk-pill cta tk-cta', href:'/ika/'},'Individual Kink Analysis'));
    hero.appendChild(navRow);

    const themeRow = el('div',{class:'tk-row row row-theme', id:'tkThemeRow'});
    hero.appendChild(themeRow);
    moveThemeInto(themeRow, legacyWrap);
    if (!themeRow.childElementCount) themeRow.remove();

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

    if (!usingExistingStart){
      startNode?.addEventListener('click', (event) => {
        const openPanel = typeof window?.tkKinksurveyOpenPanel === 'function' ? window.tkKinksurveyOpenPanel : null;
        if (openPanel){
          event?.preventDefault?.();
          event?.stopImmediatePropagation?.();
          openPanel({ focusFirst: true, trigger: startNode });
          return;
        }
        const panel = $('#categorySurveyPanel') || $('.category-panel') || $('#categoryPanel');
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
    ensureHero();
    enhancePanel();
    setupFullscreenDrawer();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
