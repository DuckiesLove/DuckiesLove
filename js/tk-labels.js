(() => {
  const DICT_URLS = ["/data/kinks.json", "/kinksurvey/data/kinks.json", "/kinks.json"];

  // Small seed so a few rows look nice even if you haven’t filled the dictionary yet.
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
  let dictReady = false;

  // ──────────────────────────────────────────────────────────────────────
  // Utilities
  const CODE_RE = /\bcb_[a-z0-9]+\b/i;
  const isCode = (v) => typeof v === "string" && CODE_RE.test(v);
  const toLabelCandidate = (s) =>
    typeof s === "string" ? s.trim().replace(/\s+/g, " ").slice(0, 140) : null;

  function setLabel(code, label) {
    if (!code || !label) return;
    if (!LABELS[code]) LABELS[code] = label;
  }

  function getTable() {
    return (
      document.querySelector("#compatTable") ||
      document.querySelector(".compat-table") ||
      document.querySelector("main table") ||
      document.querySelector("table")
    );
  }

  function extractCodeFromCell(td) {
    if (!td) return null;
    if (td.dataset && td.dataset.code) return td.dataset.code.trim();
    const m = (td.textContent || "").trim().match(CODE_RE);
    return m ? m[0] : null;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Non-blocking dictionary loader
  async function loadSharedDictionary() {
    if (dictReady) return true;
    for (const url of DICT_URLS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        const src = data?.labels && typeof data.labels === "object" ? data.labels : data;
        if (src && typeof src === "object") Object.assign(LABELS, src);
        dictReady = true;
        console.info("[labels] loaded", Object.keys(LABELS).length, "labels from", url);
        break;
      } catch (_) {}
    }
    return dictReady;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Non-blocking deep harvest from uploaded A/B survey JSON
  function asyncHarvest(obj, { budgetMs = 8, hardCap = 120_000 } = {}) {
    // BFS queue; process in small idle slices
    const q = [];
    const seen = new WeakSet();
    const push = (x) => { if (x && typeof x === "object" && !seen.has(x)) { seen.add(x); q.push(x); } };

    push(obj);

    function tick(deadline) {
      const start = performance.now();
      let processed = 0;

      while (q.length) {
        if (processed > hardCap) break;

        // Time budget: stop if we’ve used the slice
        if (deadline && deadline.timeRemaining && deadline.timeRemaining() < 2) break;
        if (!deadline && performance.now() - start > budgetMs) break;

        const node = q.shift();
        processed++;

        try {
          // Scan immediate fields for code + candidate label nearby
          const keys = Object.keys(node);
          let nodeCode = null, nodeLabel = null;
          for (const k of keys) {
            const v = node[k];
            if (!nodeCode && isCode(v) && /^(id|code|key|slug|cell|category|item)$/i.test(k)) {
              nodeCode = v.match(CODE_RE)[0];
            }
            if (!nodeLabel && typeof v === "string" &&
                /^(title|name|label|question|prompt|text|summary|short|desc|description)$/i.test(k)) {
              nodeLabel = toLabelCandidate(v);
            }
          }
          if (nodeCode && nodeLabel) setLabel(nodeCode, nodeLabel);

          // Also check sibling strings for any explicit cb_*
          for (const k of keys) {
            const v = node[k];
            if (isCode(v)) {
              const code = v.match(CODE_RE)[0];
              for (const kk of keys) {
                if (kk === k) continue;
                const vv = node[kk];
                if (typeof vv === "string") setLabel(code, toLabelCandidate(vv));
                else if (vv && typeof vv === "object") {
                  const s = pickAnyString(vv);
                  if (s) setLabel(code, s);
                }
              }
            }
          }

          // Enqueue children
          for (const k of keys) {
            const v = node[k];
            if (v && typeof v === "object") push(v);
            else if (Array.isArray(v)) for (const it of v) push(it);
          }
        } catch {}
      }

      if (q.length) {
        scheduleIdle(tick);
      } else {
        console.info("[labels] harvest complete; total known:", Object.keys(LABELS).length);
        scheduleRelabel();
      }
    }

    scheduleIdle(tick);
  }

  function pickAnyString(o) {
    if (!o || typeof o !== "object") return null;
    for (const key of ["title","name","label","short","summary","prompt","question","text","desc","description"]) {
      const s = toLabelCandidate(o[key]);
      if (s) return s;
    }
    for (const k of Object.keys(o)) {
      const s = toLabelCandidate(o[k]);
      if (s) return s;
    }
    return null;
  }

  function scheduleIdle(fn) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(fn, { timeout: 100 });
    } else {
      setTimeout(() => fn(), 16);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Relabel table (throttled) and then disconnect when stable
  let relabelScheduled = false, relabelRunning = false, mo = null, stableTimer = null;

  function relabelNow() {
    if (relabelRunning) return;
    relabelRunning = true;

    const table = getTable();
    if (!table) { relabelRunning = false; relabelScheduled = false; return; }

    let changed = 0, total = 0, missing = 0;
    table.querySelectorAll("tbody tr").forEach(tr => {
      const td = tr.querySelector("td");
      if (!td) return;
      const code = extractCodeFromCell(td);
      if (!code) return;
      total++;
      td.dataset.code = code;
      const label = LABELS[code];
      if (label) {
        if (td.textContent.trim() !== label) {
          td.textContent = label;
          changed++;
        }
      } else {
        missing++;
      }
    });

    // If table looks stable (no missing for 2s), stop observing → prevents any thrash
    clearTimeout(stableTimer);
    if (missing === 0 && total > 0) {
      stableTimer = setTimeout(() => {
        if (mo) mo.disconnect();
        console.info("[labels] table stabilized; observer disconnected");
      }, 2000);
    }

    relabelRunning = false;
    relabelScheduled = false;
  }
  function scheduleRelabel() { if (!relabelScheduled) { relabelScheduled = true; setTimeout(relabelNow, 60); } }

  // ──────────────────────────────────────────────────────────────────────
  // Wire uploads with non-blocking harvesting
  function bindUploads() {
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (input.dataset.tkTapped === "1") return;
      input.dataset.tkTapped = "1";
      input.addEventListener("change", (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const json = JSON.parse(reader.result);
            console.info("[labels] starting async harvest from uploaded survey …");
            asyncHarvest(json);            // ← non-blocking now
          } catch (e) {
            console.warn("[labels] bad JSON upload:", e?.message || e);
          }
        };
        reader.readAsText(f);
      }, { passive: true });
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Boot
  window.TK_labelStatus = () => ({ dictReady, known: Object.keys(LABELS).length });

  loadSharedDictionary().finally(scheduleRelabel);

  mo = new MutationObserver(() => {
    bindUploads();
    scheduleRelabel();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("load", () => {
    bindUploads();
    scheduleRelabel();
    // one more pass after layout settles
    setTimeout(scheduleRelabel, 400);
    setTimeout(scheduleRelabel, 1200);
  });
})();
