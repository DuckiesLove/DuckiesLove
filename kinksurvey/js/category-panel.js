<script>
(() => {
  const SCRIPT_FLAG = '__tkCategoryPanelBooted';
  if (window[SCRIPT_FLAG]) return;
  window[SCRIPT_FLAG] = true;

  const DATA_URL    = '/data/kinks.json';
  const STORAGE_KEY = '__TK_SELECTED_CATEGORIES';
  const PANEL_ID    = 'categoryChecklist';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const host  = document.getElementById(PANEL_ID);
  const badge = document.getElementById('selectedCountBadge');
  if (!host) {
    console.warn('[TK] Missing #categoryChecklist – nothing to render.');
    return;
  }

  // Uniform 2-column grid inside the panel
  Object.assign(host.style, {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
  });

  // Find a likely items array anywhere in a JSON tree
  function findItemArray(root, maxDepth = 6) {
    if (!root || maxDepth < 0) return null;

    if (Array.isArray(root)) {
      const looksRight = root.length && root.every(
        item => item && typeof item === 'object' &&
          ('name' in item || 'label' in item || 'title' in item || 'slug' in item)
      );
      if (looksRight) return root;
    }

    if (typeof root === 'object') {
      for (const key of ['items','categories','data','kinks','results','payload']) {
        if (Array.isArray(root[key])) {
          const hit = findItemArray(root[key], maxDepth - 1);
          if (hit) return hit;
        }
      }
      for (const value of Object.values(root)) {
        const hit = findItemArray(value, maxDepth - 1);
        if (hit) return hit;
      }
    }

    return null;
  }

  // Normalize to {id, name} and sort A→Z
  function normalize(raw) {
    const arr = findItemArray(raw) || (Array.isArray(raw) ? raw : []);
    const out = arr.map((item, index) => {
      const id =
        item?.id ?? item?.value ?? item?.slug ?? item?.key ?? `item-${index}`;
      const name =
        item?.name ?? item?.label ?? item?.title ?? item?.slug ?? String(id);
      return { id: String(id), name: String(name) };
    });
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  async function loadData() {
    if (Array.isArray(window.__TK_KINK_DATA) && window.__TK_KINK_DATA.length) {
      return window.__TK_KINK_DATA; // already normalized in this script
    }
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json  = await res.json();
      const items = normalize(json);
      window.__TK_KINK_DATA = items;
      if (!items.length) {
        console.warn('[TK] kinks.json loaded but no recognizable array found. Keys:', Object.keys(json || {}));
      }
      return items;
    } catch (err) {
      console.error('[TK] Failed to load categories:', err);
      return [];
    }
  }

  function updateBadge() {
    const total    = $$('input[type="checkbox"]', host).length;
    const selected = $$('input[type="checkbox"]:checked', host).length;
    if (badge) badge.textContent = `${selected} selected / ${total} total`;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify($$('input[type="checkbox"]:checked', host).map(n => n.value))
    );
  }

  function restore() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch {}

    saved.forEach(id => {
      const value   = String(id ?? '');
      const escaped = (window.CSS && CSS.escape) ? CSS.escape(value) : value.replace(/"/g, '\\"');
      const cb      = host.querySelector(`input[type="checkbox"][value="${escaped}"]`);
      if (cb) cb.checked = true;
    });
    updateBadge();
  }

  function render(items) {
    host.innerHTML = '';

    if (!items.length) {
      host.innerHTML = `<div style="opacity:.75;padding:16px;border:1px dashed #2a2a2a;border-radius:10px">
        No categories found. Confirm <code>${DATA_URL}</code> contains an array (or an object containing
        <em>items/categories/data/kinks</em>) with <code>name/label/title</code> fields.
      </div>`;
      if (badge) badge.textContent = '0 selected / 0 total';
      return;
    }

    const frag = document.createDocumentFragment();
    for (const { id, name } of items) {
      const row = document.createElement('label');
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

    const items = await loadData();
    render(items);

    document.getElementById('btnSelectAll')?.addEventListener('click', () => {
      $$('input[type="checkbox"]', host).forEach(cb => cb.checked = true);
      updateBadge();
    });
    document.getElementById('btnDeselectAll')?.addEventListener('click', () => {
      $$('input[type="checkbox"]', host).forEach(cb => cb.checked = false);
      updateBadge();
    });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot, { once:true })
    : boot();
})();
</script>
