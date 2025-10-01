(() => {
  // Where we try to load the shared dictionary from (first hit wins)
  const DICT_URLS = ["/data/kinks.json", "/kinksurvey/data/kinks.json", "/kinks.json"];

  // Minimal built-in seeds so the table isn’t empty if JSON fails
  const SEED = {
    cb_zsnrb:"Dress partner’s outfit", cb_6jd2f:"Pick lingerie / base layers",
    cb_kgrnn:"Uniforms (school, military, nurse, etc.)", cb_169ma:"Time-period dress-up",
    cb_4yyxa:"Dollification / polished object aesthetics",
    cb_2c0f9:"Hair-based play (brushing, ribbons, tying)", cb_qwnhi:"Head coverings / symbolic hoods",
    cb_zvchg:"Coordinated looks / dress codes", cb_qw9jg:"Ritualized grooming",
    cb_3ozhq:"Praise for pleasing visual display", cb_hqakm:"Formal appearance protocols",
    cb_rn136:"Clothing as power-role signal"
  };

  const CODE_RE = /\bcb_[a-z0-9]+\b/i;
  const LABELS = { ...SEED };
  let dictLoaded = false;

  // Fetch the dictionary from disk
  async function loadDictionary() {
    for (const url of DICT_URLS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) { console.info(`[labels] ${url} -> ${res.status}`); continue; }
        const data = await res.json();
        const map = (data && data.labels && typeof data.labels === "object") ? data.labels : data;
        Object.assign(LABELS, map);
        dictLoaded = true;
        console.info("[labels] loaded", Object.keys(map).length, "labels from", url);
        return;
      } catch (e) {
        console.info("[labels] fetch failed", url, e?.message || e);
      }
    }
  }

  // Convenience
  const tableEl = () =>
    document.querySelector("#compatTable, .compat-table, main table, table");

  function extractCode(td) {
    if (!td) return null;
    if (td.dataset && td.dataset.code) return td.dataset.code;
    const m = (td.textContent || "").match(CODE_RE);
    return m ? m[0] : null;
  }

  function applyLabels() {
    const t = tableEl();
    if (!t) return;
    let translated = 0, totalCodes = 0;

    t.querySelectorAll("tbody tr").forEach(tr => {
      const first = tr.querySelector("td");
      if (!first) return;
      const code = extractCode(first);
      if (!code) return;
      first.dataset.code = code;
      totalCodes++;
      const label = LABELS[code];
      if (label && label.trim() && first.textContent.trim() !== label.trim()) {
        first.textContent = label.trim();
        translated++;
      }
    });

    // Status + helper button
    badge().textContent = `Labels loaded: ${Object.keys(LABELS).length} · Missing: ${totalCodes - translated}`;
    badge().style.display = totalCodes - translated > 0 ? "inline-flex" : "none";
  }

  // Button to download a minimal “missing labels” JSON you can paste into /data/kinks.json
  let _badge;
  function badge() {
    if (_badge) return _badge;
    const b = document.createElement("button");
    b.type = "button";
    b.id = "tkMissingLabels";
    b.textContent = "Labels loaded: 0 · Missing: 0";
    b.style.cssText = "position:fixed;right:14px;bottom:14px;padding:10px 12px;border:1px solid #0ae;border-radius:10px;"+
      "background:#061018;color:#9ff;font:600 13px system-ui,Segoe UI,Roboto,sans-serif;z-index:9999;cursor:pointer";
    b.onclick = downloadMissing;
    document.body.appendChild(b);
    _badge = b; return b;
  }

  function downloadMissing() {
    const t = tableEl(); if (!t) return;
    const out = {};
    t.querySelectorAll("tbody tr").forEach(tr => {
      const td = tr.querySelector("td");
      const code = extractCode(td);
      if (code && !LABELS[code]) out[code] = "";
    });
    const blob = new Blob([JSON.stringify({ labels: out }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "kinks-missing-labels.json"; a.click();
    URL.revokeObjectURL(a.href);
    alert("Downloaded kinks-missing-labels.json.\n\nFill in the strings and merge into /data/kinks.json under \"labels\".\nThen hard-refresh the page.");
  }

  // Observe DOM changes; re-apply when table renders/updates
  const mo = new MutationObserver(applyLabels);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("load", async () => {
    await loadDictionary();
    // First pass + a couple of retries in case the table renders late
    applyLabels(); setTimeout(applyLabels, 250); setTimeout(applyLabels, 1000);
  });
})();
