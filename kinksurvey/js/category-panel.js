(() => {
  const SCRIPT_FLAG = '__tkCategoryPanelBooted';
  if (window[SCRIPT_FLAG]) return;
  window[SCRIPT_FLAG] = true;

  const DATA_URL = '/data/kinks.json';
  const STORAGE_KEY = '__TK_SELECTED_CATEGORIES';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const host = $('#categoryChecklist');
  const badge = $('#selectedCountBadge');
  if (!host) {
    console.warn('[TK] #categoryChecklist not found');
    return;
  }

  Object.assign(host.style, {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
  });

  function normalize(raw) {
    const items = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : [];

    return items
      .map((value, index) => ({
        id: String(value?.id ?? value?.value ?? value?.slug ?? index),
        name: String(value?.name ?? value?.label ?? value?.title ?? value?.slug ?? `Item ${index + 1}`)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function getData() {
    if (Array.isArray(window.__TK_KINK_DATA) && window.__TK_KINK_DATA.length) {
      return normalize(window.__TK_KINK_DATA);
    }
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      const items = normalize(json);
      window.__TK_KINK_DATA = items;
      return items;
    } catch (err) {
      console.error('[TK] failed to load categories:', err);
      return [];
    }
  }

  function updateBadge() {
    const total = $$('input[type="checkbox"]', host).length;
    const selected = $$('input[type="checkbox"]:checked', host).length;
    if (badge) badge.textContent = `${selected} selected / ${total} total`;
    try {
      const chosen = $$('input[type="checkbox"]:checked', host).map((node) => node.value);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chosen));
    } catch {
      /* ignore */
    }
  }

  function restore() {
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      saved = [];
    }

    saved.forEach((rawId) => {
      try {
        const value = String(rawId ?? '');
        const escaped = typeof CSS !== 'undefined' && CSS.escape
          ? CSS.escape(value)
          : value.replace(/"/g, '\\"');
        const cb = host.querySelector(`input[type="checkbox"][value="${escaped}"]`);
        if (cb) cb.checked = true;
      } catch {
        /* ignore */
      }
    });
    updateBadge();
  }

  function render(items) {
    host.innerHTML = '';

    if (!items.length) {
      host.innerHTML = `<div style="opacity:.75;padding:16px;border:1px dashed #2a2a2a;border-radius:10px">
        No categories found. Check <code>${DATA_URL}</code> or <code>window.__TK_KINK_DATA</code>.
      </div>`;
      if (badge) badge.textContent = '0 selected / 0 total';
      return;
    }

    const frag = document.createDocumentFragment();
    for (const { id, name } of items) {
      const row = document.createElement('label');
      row.className = 'tk-cat-row';
      row.style.cssText = `
        display:flex;align-items:center;gap:12px;
        padding:11px 14px;border:1px solid #2a2a2a;border-radius:12px;
        background:#0a0a0a;cursor:pointer;
      `;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = id;
      cb.style.width = cb.style.height = '18px';
      cb.addEventListener('change', updateBadge);

      const span = document.createElement('span');
      span.textContent = name;

      row.append(cb, span);
      frag.append(row);
    }

    host.append(frag);
    if (badge) badge.textContent = `0 selected / ${items.length} total`;
    restore();
  }

  async function boot() {
    if (host.dataset.tkPopulated === '1') return;
    host.dataset.tkPopulated = '1';

    const items = await getData();
    render(items);

    $('#btnSelectAll')?.addEventListener('click', () => {
      $$('input[type="checkbox"]', host).forEach((cb) => {
        cb.checked = true;
      });
      updateBadge();
    });

    $('#btnDeselectAll')?.addEventListener('click', () => {
      $$('input[type="checkbox"]', host).forEach((cb) => {
        cb.checked = false;
      });
      updateBadge();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
