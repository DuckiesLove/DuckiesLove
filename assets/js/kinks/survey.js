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
