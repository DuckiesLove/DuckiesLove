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

  const normalizeCategory = (value) =>
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const compareCategories = (a, b) =>
    String(a ?? "").localeCompare(String(b ?? ""), undefined, {
      sensitivity: "base",
      numeric: true,
      ignorePunctuation: true,
    });

  const sortCategoriesUnique = (values) => {
    const seen = new Set();
    const out = [];
    for (const value of values || []){
      const trimmed = String(value ?? "").trim();
      const key = normalizeCategory(trimmed);
      if (!trimmed || !key || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out.sort(compareCategories);
  };

  const START_SELECTORS = ['#startSurvey','#start','#startBtn','#startSurveyBtn','[data-start]'];
  const rawPath = String(location?.pathname || "");
  const normalizedPath = rawPath.replace(/\/+$/, '') || '/';
  const isKinkSurveyPath = /^\/kinksurvey(?:\/.*)?$/i.test(rawPath);
  const isKinkSurveyLanding = normalizedPath === '/kinksurvey';
  const isCompatibilityPage = /\/compatibility\.html$/i.test(normalizedPath);
  const DOCK_BODY_CLASS = 'tk-dock-layout';
  const DOCK_LAYOUT_ID = 'tkLayout';
  const DOCK_LEFT_ID = 'tkLeft';
  const DOCK_RIGHT_ID = 'tkRight';

  function ensureDockLayoutNodes(){
    const body = document.body;
    if (!body) return { layout: null, left: null, right: null };

    let layout = document.getElementById(DOCK_LAYOUT_ID);
    if (!layout){
      layout = el('main', { id: DOCK_LAYOUT_ID });
      body.prepend(layout);
    } else if (!layout.parentNode){
      body.prepend(layout);
    }

    let left = document.getElementById(DOCK_LEFT_ID);
    if (!left){
      left = el('section', { id: DOCK_LEFT_ID, role: 'region', 'aria-label': 'Survey categories' });
      layout.appendChild(left);
    } else if (!layout.contains(left)){
      layout.appendChild(left);
    }

    let right = document.getElementById(DOCK_RIGHT_ID);
    if (!right){
      right = el('aside', { id: DOCK_RIGHT_ID, role: 'complementary', 'aria-label': 'Survey actions' });
      layout.appendChild(right);
    } else if (!layout.contains(right)){
      layout.appendChild(right);
    }

    return { layout, left, right };
  }

  function mountDockPanel(left){
    if (!left) return null;
    const panel = document.getElementById('categorySurveyPanel') || document.querySelector('.category-panel');
    if (!panel) return null;

    if (panel.parentNode !== left){
      left.appendChild(panel);
    }

    try {
      panel.removeAttribute('hidden');
      panel.removeAttribute('inert');
      panel.classList.add('open','is-open');
      panel.setAttribute('aria-expanded','true');
      panel.setAttribute('aria-hidden','false');
      panel.style.removeProperty('position');
      panel.style.removeProperty('inset');
      panel.style.removeProperty('left');
      panel.style.removeProperty('right');
      panel.style.removeProperty('top');
      panel.style.removeProperty('bottom');
      panel.style.removeProperty('transform');
      panel.style.display = 'block';
      panel.style.visibility = 'visible';
      panel.style.opacity = '';
      panel.dataset.tkDocked = '1';
    } catch (err) {
      /* noop */
    }

    return panel;
  }

  function mountDockActions(right){
    const rail = ensureRightRail() || right;
    if (!rail) return;

    const hero = document.getElementById('ksvHeroStack');
    if (hero && hero.parentNode !== rail){
      rail.appendChild(hero);
    }

    const toggle = document.getElementById('panelToggle');
    if (toggle && toggle.parentNode !== rail){
      rail.appendChild(toggle);
    }

    moveButtonsIntoRail(rail);
  }

  function teardownDockLayout({ compatibility = false } = {}){
    window.__TK_DISABLE_PORTAL__ = false;
    if (compatibility){
      window.__TK_DISABLE_PANEL__ = true;
    }

    document.querySelectorAll('#tkRightRail,#tkDockCSS,#tkDockCSS_live').forEach(node => {
      try {
        node?.remove?.();
      } catch (err) {
        /* noop */
      }
    });

    const layout = document.getElementById(DOCK_LAYOUT_ID);
    if (layout){
      const panel = layout.querySelector('#categorySurveyPanel, .category-panel');
      if (panel && document.body && !document.body.contains(panel)){
        document.body.appendChild(panel);
      }
      try {
        layout.remove();
      } catch (err) {
        /* noop */
      }
    }

    const card = document.getElementById('tkDockCard');
    if (card){
      if (typeof card.__tkDockRO?.disconnect === 'function'){
        try { card.__tkDockRO.disconnect(); } catch (err) { /* noop */ }
      }
      if (typeof card.__tkDockPanelObserver?.disconnect === 'function'){
        try { card.__tkDockPanelObserver.disconnect(); } catch (err) { /* noop */ }
      }
      const panel = card.querySelector('#categorySurveyPanel');
      if (panel && document.body && !document.body.contains(panel)){
        document.body.appendChild(panel);
      }
      try {
        card.remove();
      } catch (err) {
        /* noop */
      }
    }

    const docEl = document.documentElement;
    if (docEl){
      docEl.classList.remove('tk-dock');
      if (docEl.__tkDockMutationObserver){
        try { docEl.__tkDockMutationObserver.disconnect(); } catch (err) { /* noop */ }
        delete docEl.__tkDockMutationObserver;
      }
    }

    const body = document.body;
    if (body){
      body.classList.remove(DOCK_BODY_CLASS);
      body.classList.remove('tk-dock-75');
      try { body.style.marginLeft = ''; } catch (err) { /* noop */ }
    }
  }

  function setupDockedSurveyLayout(){
    if (!isKinkSurveyLanding) return;

    const execute = () => {
      if (!document.body){
        window.setTimeout(execute, 16);
        return;
      }

      window.__TK_DISABLE_PORTAL__ = true;
      document.body.classList.add(DOCK_BODY_CLASS);
      ensureDockStyles();

      const { left, right } = ensureDockLayoutNodes();
      const panel = mountDockPanel(left);
      mountDockActions(right);

      if (!panel && typeof MutationObserver === 'function'){
        const mo = new MutationObserver(() => {
          if (mountDockPanel(left)) mo.disconnect();
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
        window.setTimeout(() => mo.disconnect(), 5000);
      }

      if (typeof MutationObserver === 'function'){
        const buttonsObserver = new MutationObserver(() => mountDockActions(right));
        buttonsObserver.observe(document.body, { childList: true, subtree: true });
        window.setTimeout(() => buttonsObserver.disconnect(), 5000);
      }

      if (typeof window.tkOpenPanel === 'function'){
        try { window.tkOpenPanel(); } catch (err) { /* noop */ }
      }
    };

    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', execute, { once: true });
    } else {
      execute();
    }
  }

  if (!isKinkSurveyLanding){
    teardownDockLayout({ compatibility: isCompatibilityPage });
    const panel = document.getElementById('categorySurveyPanel');
    if (panel){
      panel.classList.remove('visible','open');
      panel.setAttribute('aria-expanded','false');
      panel.style.display = 'none';
      panel.setAttribute('aria-hidden','true');
    }
    const body = document.body;
    body?.classList?.remove('panel-open','tk-panel-open','drawer-open','tk-drawer-open');
    ['tkOpenPanel','tkClosePanel','tkForcePanel','tkProbe'].forEach(key => {
      try {
        window[key] = () => {};
      } catch (err) {
        /* noop */
      }
    });
    return;
  }

  setupDockedSurveyLayout();

  if (!isKinkSurveyPath) return;

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

  function ensureDockStyles(){
    if (document.getElementById('tkDockCSS')) return;
    const css = `
      html.tk-dock body { margin-left: 0 !important; }
      body.${DOCK_BODY_CLASS} { margin-left: 0 !important; }
      body.${DOCK_BODY_CLASS} #${DOCK_LAYOUT_ID} {
        display: grid;
        grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
        gap: 24px;
        align-items: start;
        padding: 24px clamp(16px, 3vw, 48px);
        box-sizing: border-box;
        max-width: 1600px;
        margin: 0 auto;
      }
      body.${DOCK_BODY_CLASS} #${DOCK_LAYOUT_ID} > * {
        min-width: 0;
      }
      body.${DOCK_BODY_CLASS} #${DOCK_LEFT_ID} {
        min-height: calc(100vh - 96px);
      }
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} {
        position: sticky;
        top: 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        align-items: stretch;
      }
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} .themed-button,
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} a,
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} button {
        width: 100%;
      }
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} .ksvButtons {
        display: flex;
        flex-direction: column;
        gap: 18px;
        width: 100%;
      }
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} #panelToggle {
        position: static;
        width: 100%;
      }
      body.${DOCK_BODY_CLASS} #${DOCK_LEFT_ID} #categorySurveyPanel,
      body.${DOCK_BODY_CLASS} #${DOCK_LEFT_ID} .category-panel,
      body.${DOCK_BODY_CLASS} #${DOCK_LEFT_ID} #tkDockCard,
      body.${DOCK_BODY_CLASS} #${DOCK_LEFT_ID} .panel,
      body.${DOCK_BODY_CLASS} #tkDockCard,
      body.${DOCK_BODY_CLASS} #categorySurveyPanel,
      body.${DOCK_BODY_CLASS} .category-panel {
        position: static !important;
        inset: auto !important;
        width: 100% !important;
        height: auto !important;
        max-height: calc(100vh - 128px) !important;
        overflow: auto !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: auto !important;
        box-shadow: none !important;
        background: transparent !important;
      }
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} nav,
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} section,
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} .ksvBtn {
        width: 100%;
      }
      body.${DOCK_BODY_CLASS} #${DOCK_RIGHT_ID} .ksvBtn {
        justify-content: center;
      }
      body.${DOCK_BODY_CLASS} #${DOCK_LEFT_ID} .panel,
      body.${DOCK_BODY_CLASS} #${DOCK_LEFT_ID} .category-panel {
        max-width: none !important;
      }
    `.trim();
    const style = el('style',{ id: 'tkDockCSS' });
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureRightRail(){
    const { right } = ensureDockLayoutNodes();
    if (!right) return null;
    if (!right.querySelector('[data-rail-h]')){
      const header = el('div',{ 'data-rail-h': '1' });
      header.style.margin = '8px 0 12px';
      header.style.opacity = '.9';
      header.style.fontWeight = '600';
      header.textContent = 'Actions';
      right.prepend(header);
    }
    return right;
  }

  function moveButtonsIntoRail(rail){
    if (!rail) return;
    const candidates = Array.from(document.querySelectorAll('a,button')).filter(el => {
      if (!el || rail.contains(el)) return false;
      const text = (el.textContent || '').trim().toLowerCase();
      if (!text) return false;
      if (el.closest('#categorySurveyPanel')) return false;
      return /(start survey|compatibility page|individual kink analysis)/i.test(text);
    });

    candidates.forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text.includes('start survey')){
        if (!el.closest('#categorySurveyPanel')){
          el.style.display = 'none';
        }
        return;
      }
      el.style.minWidth = 'unset';
      el.style.width = '100%';
      rail.appendChild(el);
    });
  }

  function dockCategoryPanelLayout(){
    const path = (location.pathname || '').replace(/\/+$/, '') || '/';
    if (path !== '/kinksurvey') return;

    ensureDockStyles();
    const { left, right } = ensureDockLayoutNodes();
    document.body?.classList?.add(DOCK_BODY_CLASS);

    const panel = mountDockPanel(left);
    mountDockActions(right);
    moveButtonsIntoRail(right);

    if (panel){
      try {
        panel.classList.add('visible');
      } catch (err) {
        /* noop */
      }
    }

    document.body?.classList?.add('tk-panel-open');

    if (typeof window.tkOpenPanel === 'function'){
      try {
        window.tkOpenPanel();
      } catch (err) {
        /* noop */
      }
    }
  }

  const ThemeControl = (() => {
    const STORAGE_KEY = 'tk:theme';
    const CHOICES = ['auto','light','dark'];
    const root = document.documentElement;
    const sys = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
    let buttons = [];
    let currentChoice = 'auto';
    let bound = false;

    const readSaved = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (CHOICES.includes(saved)) return saved;
      } catch (err) {
        console.warn('[tk-theme] Unable to read saved theme:', err);
      }
      return 'auto';
    };

    const setPressed = (choice) => {
      buttons.forEach(btn => btn.setAttribute('aria-pressed', btn.dataset.theme === choice ? 'true' : 'false'));
    };

    const apply = (choice, { persist = true } = {}) => {
      if (!CHOICES.includes(choice)) choice = 'auto';
      currentChoice = choice;
      if (persist) {
        try { localStorage.setItem(STORAGE_KEY, choice); }
        catch (err) { console.warn('[tk-theme] Unable to save theme:', err); }
      }
      const actual = choice === 'auto'
        ? (sys && typeof sys.matches === 'boolean' ? (sys.matches ? 'dark' : 'light') : 'dark')
        : choice;

      if (root){
        root.setAttribute('data-theme', actual);
        root.dataset.tkThemeChoice = choice;
        root.dataset.tkThemeActual = actual;
      }
      const body = document.body;
      if (body){
        body.classList.remove('theme-dark','theme-light');
        body.classList.add(actual === 'dark' ? 'theme-dark' : 'theme-light');
        body.classList.toggle('theme-auto', choice === 'auto');
        body.dataset.tkThemeActual = actual;
      }
      setPressed(choice);
    };

    const ensureSystemListener = () => {
      if (!sys || bound) return;
      const handler = () => {
        if (currentChoice === 'auto') apply('auto', { persist: false });
      };
      if (sys.addEventListener) sys.addEventListener('change', handler);
      else if (sys.addListener) sys.addListener(handler);
      bound = true;
    };

    const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

    const createButton = (choice) => {
      const btn = el('button', {
        type: 'button',
        class: 'tk-theme-btn',
        'data-theme': choice,
        'aria-pressed': 'false',
      }, titleCase(choice));
      btn.addEventListener('click', () => apply(choice));
      buttons.push(btn);
      return btn;
    };

    const mount = (container) => {
      if (!container) return null;
      let existing = container.querySelector('#tkThemeBox');
      if (existing) return existing;

      buttons = [];
      const box = el('section', { id: 'tkThemeBox', 'aria-label': 'Theme controls' });
      box.appendChild(el('h3', {}, 'Theme'));

      const choices = el('div', {
        class: 'tk-theme-choices',
        role: 'group',
        'aria-label': 'Theme selection',
      });
      CHOICES.forEach(choice => choices.appendChild(createButton(choice)));
      box.appendChild(choices);
      box.appendChild(el('div', { class: 'tk-theme-help' }, '“Auto” follows your system preference and updates live.'));

      container.appendChild(box);

      ensureSystemListener();
      const saved = readSaved();
      apply(saved, { persist: false });
      setPressed(saved);
      return box;
    };

    const initial = readSaved();
    apply(initial, { persist: false });

    return { mount, apply };
  })();
  window.tkThemeControl = ThemeControl;
  window.tkApplyTheme = (mode) => ThemeControl.apply(mode, { persist: false });

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
    ThemeControl.mount(hero);

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

    items.sort((a, b) => compareCategories(a.text, b.text));

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
    if (body.classList.contains(DOCK_BODY_CLASS)) return;
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
      sortCategoriesUnique(
        allCategoryBoxes()
          .filter(cb => cb.checked)
          .map(cb => cb.value || cb.getAttribute('value') || (cb.nextElementSibling?.textContent || '').trim())
          .filter(Boolean)
      );

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

    const startHooks = [
      '#startSurvey',
      '#start',
      '#startSurveyBtn',
      '#startBtn',
      '.start-survey-btn',
      '[data-start]',
      '[data-start-survey]',
      '[data-tk-start]',
      '[data-tk-start-survey]'
    ];

    const startCandidates = new Set();
    startHooks.forEach(sel => {
      $$(sel).forEach(node => {
        if (node) startCandidates.add(node);
      });
    });

    $$("button,a").forEach(node => {
      if (/^start\s*survey$/i.test((node.textContent || '').trim())) {
        startCandidates.add(node);
      }
    });

    startCandidates.forEach(btn => {
      if (!btn || btn.dataset.tkStartWired === 'drawer') return;
      btn.addEventListener('click', (event) => {
        event?.preventDefault?.();
        event?.stopImmediatePropagation?.();
        openFullscreen();
      }, { capture: true });
      btn.dataset.tkStartWired = 'drawer';
    });

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
    dockCategoryPanelLayout();
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
