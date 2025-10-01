// Tiny label loader/normalizer with graceful fallbacks
// - Loads /data/kinks.json (base labels)
// - Optionally merges /data/labels-overrides.json if it exists
// - Exposes: tkLabels.load() -> Promise<Map<id,label>>
//            tkLabels.get(id) -> string
(() => {
  const state = {
    loaded: false,
    map: new Map(),
  };

  async function safeFetchJson(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      return await res.json();
    } catch (e) {
      console.info("[labels] optional fetch failed:", url, e.message || e);
      return null;
    }
  }

  function ingestKinksJson(json) {
    // Expect shape: { groups: [{items:[{id,label}, …]}], items:[…] } OR flat list
    if (!json) return;
    const add = (id, label) => {
      if (!id) return;
      // keep first seen; allow override layer to replace later
      if (!state.map.has(id)) state.map.set(id, String(label || id));
    };
    if (Array.isArray(json)) {
      json.forEach(n => add(n.id || n.key, n.label || n.name || n.title || n.id));
      return;
    }
    if (json.items && Array.isArray(json.items)) {
      json.items.forEach(n => add(n.id || n.key, n.label || n.name || n.title || n.id));
    }
    if (json.groups && Array.isArray(json.groups)) {
      json.groups.forEach(g => {
        (g.items || []).forEach(n => add(n.id || n.key, n.label || n.name || n.title || n.id));
      });
    }
  }

  function ingestOverrides(json) {
    // Expect shape: { "cb_xxxxx": "Friendly label", … }
    if (!json) return;
    Object.entries(json).forEach(([id, label]) => {
      state.map.set(id, String(label || id));
    });
  }

  async function load() {
    if (state.loaded) return state.map;
    const base = await safeFetchJson("/data/kinks.json");
    ingestKinksJson(base);
    const overrides = await safeFetchJson("/data/labels-overrides.json"); // optional
    ingestOverrides(overrides);
    state.loaded = true;
    console.info("[labels] loaded", state.map.size, "labels");
    return state.map;
  }

  function get(id) {
    return state.map.get(id) || id; // fallback to raw code
  }

  window.tkLabels = { load, get };
})();
