;(function () {
  /* global TK */
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  const panel        = qs('#categorySurveyPanel');
  const panelClose   = panel ? panel.querySelector('[data-action="close-panel"]') : null;
  const startBtn     = qs('#startSurveyBtn');
  const selectAllBtn = qs('#btnSelectAll');
  const deselectBtn  = qs('#btnDeselectAll');
  const catListBox   = qs('#categoryChecklist');
  const selectedBadge= qs('#selectedCountBadge');
  const beginBtn     = qs('#beginSurveyFromPanel');

  let CATEGORIES = [];
  let LABELS     = {};
  let selected   = new Set();

  function setAriaVisible(el, visible) {
    if (!el) return;
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    el.style.display = visible ? '' : 'none';
  }

  function updateSelectedBadge() {
    if (selectedBadge) {
      selectedBadge.textContent = `${selected.size} selected / ${CATEGORIES.length} total`;
    }
  }

  function renderCategoryChecklist() {
    if (!catListBox) return;
    catListBox.innerHTML = '';
    const frag = document.createDocumentFragment();

    const items = [...CATEGORIES].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    );

    for (const cat of items) {
      const label = document.createElement('label');
      label.className = 'tk-check';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = cat.id;
      input.className = 'tk-check__input';

      input.addEventListener('change', () => {
        if (input.checked) selected.add(cat.id);
        else selected.delete(cat.id);
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

  function selectAll(checked) {
    qsa('input[type="checkbox"]', catListBox).forEach(cb => {
      cb.checked = !!checked;
      if (checked) selected.add(cb.value);
      else selected.delete(cb.value);
    });
    updateSelectedBadge();
  }

  // Keep YOUR rating UI/labels. We just announce chosen categories.
  function startSurveyRun() {
    setAriaVisible(panel, false);
    // If you have a runner, it can listen for this event:
    document.dispatchEvent(new CustomEvent('tk:start-survey', {
      detail: { includeCategories: [...selected] }
    }));
  }

  async function init() {
    const { categories, labelsMap } = await TK.loadKinkData();
    CATEGORIES = categories;
    LABELS     = labelsMap || {};

    renderCategoryChecklist();

    if (startBtn)   startBtn.addEventListener('click', () => setAriaVisible(panel, true));
    if (panelClose) panelClose.addEventListener('click', () => setAriaVisible(panel, false));
    if (selectAllBtn) selectAllBtn.addEventListener('click', () => selectAll(true));
    if (deselectBtn)  deselectBtn.addEventListener('click', () => selectAll(false));
    if (beginBtn)     beginBtn.addEventListener('click', startSurveyRun);

    if (panel) {
      panel.removeAttribute('inert');
      setAriaVisible(panel, false);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
