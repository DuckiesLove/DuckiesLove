;(function () {
  window.TK = window.TK || {};
  const BUST = String(Date.now());

  // ---- Replace this minimal fallback with your full set when you’re ready. ----
  const KINKS_FALLBACK = {
    categories: [
      { id: "cb_e4bdv", title: "Dress partner’s outfit" },
      { id: "cb_hhxwj", title: "Pick lingerie / base layers" },
      { id: "cb_a19iy", title: "Uniforms (school, military, nurse, etc.)" },
      { id: "cb_5gzwk", title: "Time-period dress-up" },
      { id: "cb_jmxxq", title: "Dollification / polished object aesthetics" },
      { id: "cb_67z7h", title: "Hair-based play (brushing, ribbons, tying)" },
      { id: "cb_d8lcg", title: "Head coverings / symbolic hoods" },
      { id: "cb_h1ua2", title: "Coordinated looks / dress codes" },
      { id: "cb_6zi8g", title: "Ritualized grooming" },
      { id: "cb_5ca8j", title: "Praise for pleasing visual display" },
      { id: "cb_4kbnf", title: "Formal appearance protocols" },
      { id: "cb_k3ig3", title: "Clothing as power-role signal" }
      // …add the rest of your categories here using the same IDs you already use
    ],
    labels: {
      cb_e4bdv: "Dress partner’s outfit",
      cb_hhxwj: "Pick lingerie / base layers",
      cb_a19iy: "Uniforms (school, military, nurse, etc.)",
      cb_5gzwk: "Time-period dress-up",
      cb_jmxxq: "Dollification / polished object aesthetics",
      cb_67z7h: "Hair-based play (brushing, ribbons, tying)",
      cb_d8lcg: "Head coverings / symbolic hoods",
      cb_h1ua2: "Coordinated looks / dress codes",
      cb_6zi8g: "Ritualized grooming",
      cb_5ca8j: "Praise for pleasing visual display",
      cb_4kbnf: "Formal appearance protocols",
      cb_k3ig3: "Clothing as power-role signal"
      // …mirror the same keys (ID -> label)
    }
  };

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  function normalize(data) {
    // Accept shapes:
    //   { categories:[...], labels:{...} }
    //   { kinks:{ categories:[...], labels:{...} } }
    const categories =
      (data && Array.isArray(data.categories) && data.categories) ||
      (data && data.kinks && Array.isArray(data.kinks.categories) && data.kinks.categories) ||
      [];
    const labelsMap =
      (data && data.labels) ||
      (data && data.kinks && data.kinks.labels) ||
      {};
    if (!categories.length) throw new Error("No categories array in data.");
    return { categories, labelsMap };
  }

  async function loadKinkData() {
    try {
      const url = `/data/kinks.json?v=${BUST}`;
      const json = await fetchJSON(url);
      return normalize(json);
    } catch (e) {
      console.warn("[kinkdata] Falling back to embedded dataset:", e);
      return normalize(KINKS_FALLBACK);
    }
  }

  window.TK.loadKinkData = loadKinkData;
})();
