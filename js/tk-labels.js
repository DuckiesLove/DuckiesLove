(() => {
  const DICT_URLS = ["/data/kinks.json", "/kinksurvey/data/kinks.json", "/kinks.json"];

  // A small seed so the table looks nice even before your full dictionary exists.
  const FALLBACK_LABELS = {
    cb_zsnrb: "Dress partner’s outfit",
    cb_6jd2f: "Pick lingerie / base layers",
    cb_kgrnn: "Uniforms (school, military, nurse, etc.)",
    cb_169ma: "Time-period dress-up",
    cb_4yyxa: "Dollification / polished object aesthetics",
    cb_2c0f9: "Hair-based play (brushing, ribbons, tying)",
    cb_qwnhi: "Head coverings / symbolic hoods",
    cb_zvchg: "Coordinated looks / dress codes",
    cb_qw9jg: "Ritualized grooming",
    cb_3ozhq: "Praise for pleasing visual display",
    cb_hqakm: "Formal appearance protocols",
    cb_rn136: "Clothing as power-role signal"
  };

  const LABELS = { ...FALLBACK_LABELS };
  let dictReady = false, scheduled = false, running = false, observer = null;
  let uploadedA = null, uploadedB = null;

  // ── Utilities ────────────────────────────────────────────────────────────
  const CODE_RE = /\bcb_[a-z0-9]+\b/i;
  const isCode = (v) => typeof v === "string" && CODE_RE.test(v);

  function toLabelCandidate(v) {
    if (typeof v !== "string") return null;
    const s = v.trim();
    if (!s) return null;
    // Avoid long paragraphs; keep one line summary
    return s.replace(/\s+/g, " ").slice(0, 140);
  }

  function setLabel(code, label) {
    if (!code || !label) return;
    if (!LABELS[code]) LABELS[code] = label;
  }

  // Very aggressive deep search: walk ANY object/array and
  // whenever we see a cb_* code, try to pick a sensible label
  // from sibling keys typical for prompts/questions.
  function harvestDeep(obj) {
    try {
      if (!obj || typeof obj !== "object") return;

      const keys = Object.keys(obj);
      // If this node itself looks like an item with id/code + text/prompt:
      let foundCode = null, foundLabel = null;

      for (const k of keys) {
        const v = obj[k];
        if (!foundCode && isCode(v) && /^(id|code|key|slug|cell|category|item)$/i.test(k)) {
          foundCode = v.match(CODE_RE)[0];
        }
        if (!foundLabel && typeof v === "string" &&
            /^(title|name|label|question|prompt|text|summary|short|desc|description)$/i.test(k)) {
          foundLabel = toLabelCandidate(v);
        }
      }
      if (foundCode && foundLabel) setLabel(foundCode, foundLabel);

      // Also check for patterns like { id:'cb_xxx', prompt:{ text:'...' } }
      for (const k of keys) {
        const v = obj[k];
        if (isCode(v)) {
          const code = v.match(CODE_RE)[0];
          // Look around this node for a nearby text
          for (const kk of keys) {
            if (kk === k) continue;
            const vv = obj[kk];
            if (typeof vv === "string") setLabel(code, toLabelCandidate(vv));
            if (vv && typeof vv === "object") {
              const cand = pickAnyString(vv);
              if (cand) setLabel(code, cand);
            }
          }
        }
      }

      // Recurse
      for (const k of keys) {
        const v = obj[k];
        if (v && typeof v === "object") harvestDeep(v);
      }
    } catch {}
  }

  // Pick any “nice” string from a subobject
  function pickAnyString(o) {
    if (!o || typeof o !== "object") return null;
    for (const key of ["title","name","label","short","summary","prompt","question","text","desc","description"]) {
      if (typeof o[key] === "string") {
        const s = toLabelCandidate(o[key]);
        if (s) return s;
      }
    }
    // last resort: first string field we see
    for (const k of Object.keys(o)) {
      if (typeof o[k] === "string") {
        const s = toLabelCandidate(o[k]);
        if (s) return s;
      }
    }
    return null;
  }

  async function loadSharedDictionary() {
    if (dictReady) return true;
    for (const url of DICT_URLS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) { console.info(`[labels] ${url} -> ${res.status}`); continue; }
        const data = await res.json();
        if (data && typeof data === "object") {
          if (data.labels && typeof data.labels === "object") {
            Object.assign(LABELS, data.labels);
          } else {
            // If file is already a flat map { cb_x: "…" }
            Object.assign(LABELS, data);
          }
        }
        dictReady = true;
        console.info("[labels] loaded", Object.keys(LABELS).length, "labels from", url);
        break;
      } catch (e) { console.info("[labels] fetch failed", url, e?.message || e); }
    }
    return dictReady;
  }

  const getTable = () =>
    document.querySelector("#compatTable") ||
    document.querySelector(".compat-table") ||
    document.querySelector("main table") ||
    document.querySelector("table");

  function extractCodeFromCell(td) {
    if (!td) return null;
    if (td.dataset && td.dataset.code) return td.dataset.code.trim();
    const t = (td.textContent || "").trim();
    const m = t.match(CODE_RE);
    return m ? m[0] : null;
  }

  function relabelNow() {
    if (running) return;
    running = true;
    const table = getTable();
    if (!table) { running = false; scheduled = false; return; }

    let changed = 0;
    table.querySelectorAll("tbody tr").forEach(tr => {
      const first = tr.querySelector("td");
      if (!first) return;
      const code = extractCodeFromCell(first);
      if (!code) return;
      first.dataset.code = code;
      const text = LABELS[code];
      if (text && text !== first.textContent.trim()) {
        first.textContent = text;
        changed++;
      }
    });

    bumpMissingBadge();
    setTimeout(() => { running = false; scheduled = false; }, 60);
  }
  function scheduleRelabel() { if (!scheduled) { scheduled = true; setTimeout(relabelNow, 50); } }

  // ── Hook uploads to harvest labels directly from uploaded surveys ────────
  function bindUploads() {
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (input.dataset.tkTapped === "1") return;
      input.dataset.tkTapped = "1";
      input.addEventListener("change", ev => {
        const f = ev.target.files && ev.target.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const json = JSON.parse(reader.result);
            // Keep both copies so we can include them in the “missing download”
            if (!uploadedA) uploadedA = json; else uploadedB = json;
            // Aggressive deep harvest
            harvestDeep(json);
            console.info("[labels] harvested from uploaded survey; total now", Object.keys(LABELS).length);
            scheduleRelabel();
          } catch (e) {
            console.warn("[labels] failed to parse uploaded JSON:", e?.message || e);
          }
        };
        reader.readAsText(f);
      }, { passive: true });
    });
  }

  // ── Missing-labels helper UI (tiny badge + one-click JSON download) ──────
  let badge = null;
  function countMissing() {
    const table = getTable();
    if (!table) return 0;
    let n = 0;
    table.querySelectorAll("tbody tr").forEach(tr => {
      const td = tr.querySelector("td");
      const code = extractCodeFromCell(td);
      if (code && !LABELS[code]) n++;
    });
    return n;
  }
  function bumpMissingBadge() {
    const missing = countMissing();
    if (!badge) {
      badge = document.createElement("button");
      badge.type = "button";
      badge.textContent = "Missing labels: 0";
      badge.style.cssText =
        "position:fixed;right:14px;bottom:14px;z-index:9999;padding:10px 12px;border-radius:10px;border:1px solid #07e;" +
        "background:#00131a;color:#7ff;box-shadow:0 4px 16px rgba(0,0,0,.4);font:600 13px system-ui,Segoe UI,Roboto,sans-serif;cursor:pointer";
      badge.addEventListener("click", downloadMissingLabels);
      document.body.appendChild(badge);
    }
    badge.textContent = `Missing labels: ${missing}`;
    badge.style.display = missing > 0 ? "inline-block" : "none";
  }
  function collectMissingMap() {
    const table = getTable();
    const out = {};
    if (!table) return out;
    table.querySelectorAll("tbody tr").forEach(tr => {
      const td = tr.querySelector("td");
      const code = extractCodeFromCell(td);
      if (!code) return;
      if (!LABELS[code]) {
        // Try to guess from uploaded JSONs one more time
        const guess = tryGuessFromUploads(code);
        out[code] = guess || "";
      }
    });
    return out;
  }
  function tryGuessFromUploads(code) {
    const guessFrom = (obj) => {
      let best = null;
      (function walk(o) {
        if (!o || typeof o !== "object") return;
        const keys = Object.keys(o);
        for (const k of keys) {
          const v = o[k];
          if (typeof v === "string" && isCode(v) && v.match(CODE_RE)[0] === code) {
            // sibling strings
            for (const kk of keys) {
              if (kk === k) continue;
              const vv = o[kk];
              if (typeof vv === "string") { const s = toLabelCandidate(vv); if (s) best = s; }
              else if (vv && typeof vv === "object") { const s = pickAnyString(vv); if (s) best = s; }
            }
          } else if (v && typeof v === "object") walk(v);
        }
      })(obj);
      return best;
    };
    return (uploadedA && guessFrom(uploadedA)) || (uploadedB && guessFrom(uploadedB)) || null;
  }
  function downloadMissingLabels() {
    const map = collectMissingMap();
    const payload = { labels: map };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kinks-missing-labels.json";
    a.click();
    URL.revokeObjectURL(a.href);
    alert("A file named kinks-missing-labels.json was downloaded.\n\n" +
          "Open it, fill in the empty strings with the human-readable summaries, " +
          "and save/merge it into /data/kinks.json under the “labels” object.\n" +
          "Reload the page and everything will be translated.");
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  window.TK_labelStatus = () => ({ dictReady, known: Object.keys(LABELS).length });
  loadSharedDictionary().finally(scheduleRelabel);

  const mo = new MutationObserver(() => { bindUploads(); scheduleRelabel(); });
  mo.observe(document.body, { childList: true, subtree: true }); observer = mo;

  window.addEventListener("load", () => {
    bindUploads();
    scheduleRelabel();
    setTimeout(scheduleRelabel, 400);
    setTimeout(scheduleRelabel, 1200);
  });
})();
