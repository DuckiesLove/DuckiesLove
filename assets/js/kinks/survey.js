(() => {
  const DATA_URL = '/data/kinks.json';
  const STORAGE_KEY = '__TK_SELECTED_CATEGORIES';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let dataset = null;
  let allItemIds = new Set();
  let selectedItems = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  let role = 'Giving';
  let allQuestions = [];
  let visibleQuestions = [];
  let index = 0;
  const scores = { A: {}, B: {} };

  const themeControls = $('#themeControls');
  if (themeControls) {
    themeControls.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-theme]');
      if (!btn) return;
      document.documentElement.className = `theme-${btn.dataset.theme}`;
    });
  }

  const mainContainer = document.querySelector('#main');

  async function fetchDataset() {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load data (${response.status})`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/json/i.test(contentType)) {
      throw new Error(`Unexpected content-type: ${contentType}`);
    }

    const json = await response.json();
    const normalized = normalizeData(json);
    if (!Array.isArray(normalized?.categories) || !normalized.categories.length) {
      throw new Error('Kink data is empty or invalid');
    }
    if (!Array.isArray(normalized?.items) || !normalized.items.length) {
      throw new Error('Kink data is empty or invalid');
    }
    return normalized;
  }

  async function init() {
    try {
      dataset = await fetchDataset();
      if (!selectedItems.size) {
        selectedItems = new Set(dataset.items.map((item) => item.id));
        persistSelection();
      } else {
        selectedItems = new Set([...selectedItems].filter((id) => allItemIds.has(id)));
        if (!selectedItems.size) {
          selectedItems = new Set(dataset.items.map((item) => item.id));
          persistSelection();
        }
      }
      buildCategoryPanel();
      buildQuestions();
      paint();
      updateProgress();
    } catch (error) {
      console.error('[TalkKink] Failed to boot survey', error);
      const card = $('#questionCard');
      const target = card || mainContainer;
      if (target) {
        target.innerHTML = "<p role=\"alert\" style=\"color:white;\">Failed to load kink data. Please try again later.</p>";
      }
    }
  }

  init();

  function normalizeData(json) {
    allItemIds = new Set();
    const safeClone = {
      categories: [],
      items: [],
    };

    const categories = Array.isArray(json?.categories) ? json.categories : [];
    for (const cat of categories) {
      const catName = tidy(cat?.category ?? cat?.name ?? 'Miscellaneous');
      const payload = { name: catName, items: [] };
      if (Array.isArray(cat?.items)) {
        for (const item of cat.items) {
          const baseId = item?.id || slug(`${catName}-${item?.label ?? ''}`);
          const label = tidy(item?.label ?? 'Untitled');
          const roles = Array.isArray(item?.roles) && item.roles.length
            ? Array.from(new Set(item.roles))
            : ['General'];
          const entry = {
            id: baseId,
            label,
            roles,
            category: catName,
          };
          payload.items.push(entry);
          safeClone.items.push(entry);
          allItemIds.add(baseId);
        }
      }
      safeClone.categories.push(payload);
    }

    return safeClone;
  }

  function tidy(str = '') {
    return String(str)
      .replace(/\((?:\s*aka\s*)?CBT\)/gi, '')
      .replace(/Cock,?\s*Ball\s*Torture/gi, 'Cock and ball torture')
      .replace(/\bCBT\b/gi, 'Cock and ball torture')
      .replace(/\bC\.?B\.?\b/gi, 'Cock and ball')
      .replace(/\bCB(?=[\\/])/gi, 'Cock and ball')
      .replace(/\bCB\b/gi, 'Cock and ball')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s([,;:])/g, '$1')
      .replace(/Cock and ball\./gi, 'Cock and ball')
      .trim();
  }

  function slug(str) {
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function buildCategoryPanel() {
    const container = $('#categoryChecklist');
    if (!container) return;
    container.innerHTML = '';
    for (const cat of dataset.categories) {
      const catEl = document.createElement('div');
      catEl.className = 'cat';
      const heading = document.createElement('h4');
      heading.textContent = cat.name;
      catEl.append(heading);

      for (const item of cat.items) {
        const row = document.createElement('label');
        row.className = 'item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedItems.has(item.id);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            selectedItems.add(item.id);
          } else {
            selectedItems.delete(item.id);
          }
          persistSelection();
          syncVisibleQuestions();
          paint();
          updateProgress();
          updateSelectedCount();
        });
        const span = document.createElement('span');
        span.textContent = item.label;
        row.append(checkbox, span);
        catEl.append(row);
      }
      container.append(catEl);
    }
    updateSelectedCount();
  }

  function persistSelection() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selectedItems]));
  }

  function updateSelectedCount() {
    const badge = $('#selectedCountBadge');
    if (!badge) return;
    const count = selectedItems.size;
    const total = dataset?.items?.length ?? 0;
    if (!count) {
      badge.textContent = 'All questions hidden';
    } else if (count === total) {
      badge.textContent = 'All selected';
    } else {
      badge.textContent = `${count} selected`;
    }
  }

  function buildQuestions() {
    allQuestions = [];
    for (const item of dataset.items) {
      for (const itemRole of item.roles) {
        allQuestions.push({
          id: `${item.id}::${itemRole}`,
          baseId: item.id,
          role: itemRole,
          label: item.label,
          category: item.category,
        });
      }
    }
    syncVisibleQuestions();
  }

  function syncVisibleQuestions() {
    visibleQuestions = allQuestions.filter(
      (question) => selectedItems.has(question.baseId) && question.role === role,
    );
    if (!visibleQuestions.length) {
      index = 0;
    } else if (index >= visibleQuestions.length) {
      index = visibleQuestions.length - 1;
    }
  }

  function paint() {
    const card = $('#questionCard');
    if (!card) return;
    card.hidden = false;
    const current = visibleQuestions[index];
    if (!current) {
      $('#questionPath').textContent = 'Select one or more categories to begin.';
      $('#questionText').textContent = 'No questions available.';
      $$('div.scoreRow').forEach((row) => (row.innerHTML = ''));
      $('#compatText').textContent = 'N/A';
      $('#compatBar').style.setProperty('--fill', '0%');
      $('#flagRow').textContent = '';
      updateNavButtons();
      return;
    }

    $('#questionPath').textContent = `${current.category} • ${current.label}`;
    $('#questionText').textContent = `${current.role} interest (0 = never, 5 = eager)`;

    $$('#roleTabs [role="tab"]').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.role === role));
    });

    for (const who of ['A', 'B']) {
      const row = $(`.scoreRow[data-partner="${who}"]`);
      if (!row) continue;
      row.innerHTML = '';
      for (let value = 0; value <= 5; value += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = String(value);
        button.setAttribute('aria-pressed', scores[who][current.id] === value ? 'true' : 'false');
        button.addEventListener('click', () => {
          scores[who][current.id] = value;
          $$('button', row).forEach((b) => b.setAttribute('aria-pressed', 'false'));
          button.setAttribute('aria-pressed', 'true');
          renderCompatibility();
          updateProgress();
        });
        row.append(button);
      }
    }

    renderCompatibility();
    updateNavButtons();
  }

  function renderCompatibility() {
    const current = visibleQuestions[index];
    const compatBar = $('#compatBar');
    const compatText = $('#compatText');
    const flagRow = $('#flagRow');
    if (!current || !compatBar || !compatText || !flagRow) return;

    const scoreA = scores.A[current.id];
    const scoreB = scores.B[current.id];
    flagRow.textContent = '';

    if (Number.isInteger(scoreA) && Number.isInteger(scoreB)) {
      const compat = 100 - Math.abs(scoreA - scoreB) * 20;
      compatBar.style.setProperty('--fill', `${compat}%`);
      compatText.textContent = `${compat}%`;
      if (compat >= 90) flagRow.textContent += '⭐';
      if (compat <= 50) flagRow.textContent += ' 🚩';
      const enthusiasticA = scoreA === 5 && scoreB < 5;
      const enthusiasticB = scoreB === 5 && scoreA < 5;
      if (enthusiasticA || enthusiasticB) flagRow.textContent += ' 🟨';
    } else {
      compatBar.style.setProperty('--fill', '0%');
      compatText.textContent = 'N/A';
    }
  }

  function updateNavButtons() {
    const prev = $('#prevBtn');
    const next = $('#nextBtn');
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= visibleQuestions.length - 1 || !visibleQuestions.length;
  }

  function getProgressTotals() {
    let answered = 0;
    const totalSlots = visibleQuestions.length * 2;
    for (const question of visibleQuestions) {
      if (Number.isInteger(scores.A[question.id])) answered += 1;
      if (Number.isInteger(scores.B[question.id])) answered += 1;
    }
    return { answered, totalSlots };
  }

  function updateProgress() {
    const { answered, totalSlots } = getProgressTotals();
    const pct = totalSlots ? Math.round((answered / totalSlots) * 100) : 0;
    const progressBar = $('#progressBar');
    const pctEl = $('#progressPct');
    const textEl = $('#progressText');
    if (progressBar) progressBar.style.setProperty('--fill', `${pct}%`);
    if (pctEl) pctEl.textContent = `${pct}%`;
    const currentNumber = visibleQuestions.length ? index + 1 : 0;
    if (textEl) textEl.textContent = `Question ${currentNumber} of ${visibleQuestions.length}`;
  }

  function step(delta) {
    if (!visibleQuestions.length) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= visibleQuestions.length) return;
    index = nextIndex;
    paint();
    updateProgress();
  }

  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');
  prevBtn?.addEventListener('click', () => step(-1));
  nextBtn?.addEventListener('click', () => step(1));

  $('#roleTabs')?.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab) return;
    const newRole = tab.dataset.role;
    if (!newRole || newRole === role) return;
    role = newRole;
    index = 0;
    syncVisibleQuestions();
    paint();
    updateProgress();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      step(-1);
    } else if (event.key === 'ArrowRight') {
      step(1);
    }
  });

  const loadA = $('#loadA');
  const loadB = $('#loadB');
  const downloadA = $('#downloadA');
  const downloadB = $('#downloadB');
  const resetButton = $('#resetAll');
  const exportButton = $('#exportPDF');

  loadA?.addEventListener('change', () => handleImport('A', loadA));
  loadB?.addEventListener('change', () => handleImport('B', loadB));
  downloadA?.addEventListener('click', () => triggerDownload('A'));
  downloadB?.addEventListener('click', () => triggerDownload('B'));
  resetButton?.addEventListener('click', resetScores);
  exportButton?.addEventListener('click', () => window.print());

  function handleImport(partner, input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || '{}'));
        const incoming = payload?.scores && typeof payload.scores === 'object' ? payload.scores : payload;
        if (!incoming || typeof incoming !== 'object') throw new Error('Invalid file');
        const sanitized = {};
        for (const [key, value] of Object.entries(incoming)) {
          const numeric = Number(value);
          if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 5) {
            sanitized[key] = Math.round(numeric);
          }
        }
        scores[partner] = { ...scores[partner], ...sanitized };
        paint();
        updateProgress();
      } catch (error) {
        alert('Could not read that file. Please check the format.');
        console.error('[TalkKink] import failed', error);
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => {
      alert('We could not open that file.');
      input.value = '';
    };
    reader.readAsText(file);
  }

  function triggerDownload(partner) {
    const payload = {
      partner,
      exportedAt: new Date().toISOString(),
      scores: scores[partner],
      filters: {
        role,
        selectedItems: [...selectedItems],
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `talkkink-${partner.toLowerCase()}-${Date.now()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetScores() {
    scores.A = {};
    scores.B = {};
    index = 0;
    paint();
    updateProgress();
  }
})();

// --- survey interaction telemetry + resilient button handling ---
(() => {
  if (window.__tkSurveyDelegationReady__) return;
  window.__tkSurveyDelegationReady__ = true;

  window.addEventListener('error', (e) => {
    try {
      console.error('[Survey Fatal]', e?.message, `${e?.filename || ''}:${e?.lineno || 0}`);
    } catch (_) {
      console.error('[Survey Fatal]', e);
    }
  });

  const onReady = () => {
    const surveyRoot =
      document.querySelector('#survey') ||
      document.querySelector('.survey-root') ||
      document.querySelector('main') ||
      document.body;

    if (!surveyRoot) return;

    surveyRoot.addEventListener(
      'click',
      (event) => {
        const btn = event.target?.closest?.('button, [role="button"]');
        if (!btn || !surveyRoot.contains(btn)) return;
        const text = (btn.textContent || '').trim();
        console.info('[Survey Click]', {
          text,
          id: btn.id || null,
          classes: btn.className || '',
        });
      },
      { capture: true }
    );

    const state = Object.create(null);
    surveyRoot.addEventListener('click', (event) => {
      const target = event.target?.closest?.('button.option, [data-action="select"]');
      if (!target || !surveyRoot.contains(target)) return;

      if (target.tagName === 'BUTTON') {
        const type = target.getAttribute('type');
        if (!type || type.toLowerCase() === 'submit') {
          target.type = 'button';
        }
      }

      event.preventDefault();

      const group = target.closest('[data-group]');
      const groupKey = group?.dataset?.group || 'default';
      group?.querySelectorAll('button.option, [data-action="select"]').forEach((btn) => {
        const active = btn === target;
        btn.classList.toggle('selected', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      const value =
        target.dataset?.value ??
        target.value ??
        (target.textContent ? target.textContent.trim() : '');
      state[groupKey] = value;

      console.log('[Survey Selected]', { group: groupKey, value });
    });

    (async () => {
      if (typeof fetch !== 'function') return;
      try {
        const res = await fetch('/data/kinks.json', { cache: 'no-store' });
        const text = await res.text();
        try {
          JSON.parse(text);
        } catch (parseErr) {
          console.error('[kinks.json parse error]', parseErr, text.slice(0, 200));
        }
      } catch (fetchErr) {
        console.error('[kinks.json fetch error]', fetchErr);
      }
    })();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }
})();

(() => {
  const globalObj = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (!globalObj) return;

  const DEFAULT_LABELS = Object.freeze({
    0: 'Brain buffer overflow',
    1: 'Not Interested',
    2: 'Willing (Partner)',
    3: 'Curious',
    4: 'Like It',
    5: 'Love It'
  });

  const CARD_HANDLE = '__tkQuestionCardEnhancer__';

  function isElement(node){
    return !!node && typeof node === 'object' && node.nodeType === 1;
  }

  function resolveRow(card, options){
    if (options && isElement(options.scoreRow)) return options.scoreRow;
    if (options && typeof options.scoreSelector === 'string'){
      const viaSelector = card.querySelector(options.scoreSelector);
      if (viaSelector) return viaSelector;
    }
    return card.querySelector('.scoreRow[data-partner="A"]') || card.querySelector('.scoreRow');
  }

  function ensureHelper(card, row){
    let helper = card.querySelector('.rating-helper');
    if (helper) return helper;
    const parent = row && row.parentElement ? row.parentElement : row || card;
    helper = document.createElement('div');
    helper.className = 'rating-helper muted';
    helper.dataset.tkAutoHelper = '1';
    helper.setAttribute('aria-live', 'polite');
    parent.appendChild(helper);
    return helper;
  }

  function parseButtonValue(button){
    if (!button) return NaN;
    const { dataset } = button;
    if (dataset && dataset.value != null){
      const fromDataset = Number(dataset.value);
      if (Number.isFinite(fromDataset)) return fromDataset;
    }
    if (button.value != null && button.value !== ''){
      const fromValue = Number(button.value);
      if (Number.isFinite(fromValue)) return fromValue;
    }
    const text = button.textContent;
    if (typeof text === 'string' && text.trim()){
      const fromText = Number(text.trim());
      if (Number.isFinite(fromText)) return fromText;
    }
    return NaN;
  }

  function readSelectedValue(buttons){
    const pressed = buttons.find(btn => btn.getAttribute('aria-pressed') === 'true');
    const value = parseButtonValue(pressed);
    return Number.isFinite(value) ? value : null;
  }

  function applyLabelUpdates(target, updates){
    if (!updates || typeof updates !== 'object') return;
    for (const [rawKey, rawValue] of Object.entries(updates)){
      const numKey = Number(rawKey);
      if (!Number.isFinite(numKey)) continue;
      const key = String(numKey);
      if (rawValue == null){
        delete target[key];
      } else {
        target[key] = String(rawValue);
      }
    }
  }

  function labelFor(value, labels){
    if (!Number.isFinite(value)) return '';
    const key = String(value);
    return Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : '';
  }

  function buildDetail(card, button, type, value, event){
    return {
      card,
      button: button || null,
      event: event || null,
      type,
      value
    };
  }

  const g = globalObj;
  g.TK = g.TK || {};
  if (typeof g.TK.enhanceQuestionCard === 'function') return;

  g.TK.enhanceQuestionCard = function enhanceQuestionCard(card, options = {}){
    if (!isElement(card)) return null;
    if (card[CARD_HANDLE]) return card[CARD_HANDLE];

    const labels = {};
    applyLabelUpdates(labels, DEFAULT_LABELS);
    applyLabelUpdates(labels, options.labels);

    const row = resolveRow(card, options);
    const buttons = row ? Array.from(row.querySelectorAll('button')) : [];
    const helper = ensureHelper(card, row);
    const cleanup = [];

    const state = {
      selected: (() => {
        const value = readSelectedValue(buttons);
        return value ?? 0;
      })()
    };

    const update = (rawValue, type, button, event) => {
      const value = Number.isFinite(rawValue) ? rawValue : null;
      const label = value === null ? '' : labelFor(value, labels);
      const detail = buildDetail(card, button, type, value, event);

      let handledZero = false;
      if (value === 0 && typeof options.onZeroLabel === 'function'){
        handledZero = options.onZeroLabel(label, detail) === true;
      }

      if (helper && !(value === 0 && handledZero)){
        helper.textContent = label || '';
      }

      if (typeof options.onLabelChange === 'function'){
        options.onLabelChange(value, label, detail);
      }
    };

    for (const button of buttons){
      const value = parseButtonValue(button);
      if (!Number.isFinite(value)) continue;

      const handleEnter = event => update(value, 'hover', button, event);
      const handleLeave = event => update(state.selected, 'leave', button, event);
      const handleClick = event => {
        state.selected = value;
        update(value, 'select', button, event);
        if (typeof options.onSelect === 'function'){
          const label = labelFor(value, labels);
          const detail = buildDetail(card, button, 'select', value, event);
          options.onSelect(value, label, detail);
        }
      };

      button.addEventListener('mouseenter', handleEnter);
      button.addEventListener('focus', handleEnter);
      button.addEventListener('mouseleave', handleLeave);
      button.addEventListener('blur', handleLeave);
      button.addEventListener('click', handleClick);

      cleanup.push(() => {
        button.removeEventListener('mouseenter', handleEnter);
        button.removeEventListener('focus', handleEnter);
        button.removeEventListener('mouseleave', handleLeave);
        button.removeEventListener('blur', handleLeave);
        button.removeEventListener('click', handleClick);
      });
    }

    update(state.selected, 'init', null, null);

    const api = {
      updateLabels(next){
        applyLabelUpdates(labels, next);
        update(state.selected, 'labels', null, null);
      },
      destroy(){
        cleanup.forEach(fn => fn());
        cleanup.length = 0;
        if (helper && helper.dataset && helper.dataset.tkAutoHelper === '1'){
          helper.remove();
        }
        delete card[CARD_HANDLE];
      }
    };

    card[CARD_HANDLE] = api;
    return api;
  };

  Object.defineProperty(g.TK.enhanceQuestionCard, 'DEFAULT_LABELS', {
    value: DEFAULT_LABELS,
    enumerable: true,
    writable: false
  });
})();
(() => {
  if (window.__TK_KEEP_SMALL_VERTICAL_SCORE_CARD__) return;
  window.__TK_KEEP_SMALL_VERTICAL_SCORE_CARD__ = true;

  const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,.card-title,.title,[role="heading"]';

  const findSidebar = () =>
    document.querySelector('[data-sticky="score"]') ||
    document.querySelector('.score-sidebar');

  const normalizeHeadingText = (text = '') => text.trim().toLowerCase();

  const isScoreCard = (el) => {
    if (!el) return false;
    const heading = el.querySelector(HEADING_SELECTOR);
    if (!heading) return false;
    const text = normalizeHeadingText(heading.textContent || '');
    return text.startsWith('how to score');
  };

  const findScoreCards = () =>
    Array.from(
      document.querySelectorAll('.how-to-score, section, article, aside, div')
    ).filter(isScoreCard);

  const cleanKeptCard = (card) => {
    if (!card) return;

    const heading = card.querySelector(HEADING_SELECTOR) || card.firstElementChild;
    if (heading) {
      heading.textContent = 'How to score';
    }

    Object.assign(card.style, {
      width: '',
      height: '',
      position: '',
      left: '',
      right: '',
      top: '',
      bottom: '',
    });

    card.classList.add('tk-score-aside');
  };

  const removeExtras = () => {
    const sidebar = findSidebar();
    const cards = findScoreCards();
    if (!cards.length) return;

    const keep = sidebar ? cards.find((card) => sidebar.contains(card)) : cards[0];
    cards.forEach((card) => {
      if (card !== keep) card.remove();
    });

    if (keep && sidebar && !sidebar.contains(keep)) {
      sidebar.appendChild(keep);
    }

    cleanKeptCard(keep);
  };

  const run = () => removeExtras();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  const mo = new MutationObserver(() => {
    clearTimeout(window.__tkScoreReflowTimer__);
    window.__tkScoreReflowTimer__ = setTimeout(run, 120);
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
