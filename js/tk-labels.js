(() => {
  const DICT_URLS = ["/data/kinks.json", "/kinksurvey/data/kinks.json", "/kinks.json"];
  const CODE_RE = /\bcb_[a-z0-9]+\b/i;

  // Seed so some rows read nicely while you complete /data/kinks.json
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

  // Which object keys might contain the human label in uploaded JSON
  const LABEL_KEYS = [
    "label","title","name","question","prompt","text","summary","short",
    "display","displayName","labelShort","titleShort","nameShort","desc",
    "description","caption","heading","subheading","subtitle","hint","help",
    "helper","note"
  ];
  // Which object keys might contain the cb_* code
  const CODE_KEYS = ["id","code","key","slug","cell","category","item","cb","kinkId","kink_id","nodeId"];

  const LABELS = { ...FALLBACK_LABELS };
  let loadedDict = false;

  const log = (...a) => console.info("[labels]", ...a);

  function isCode(v) { return typeof v === "string" && CODE_RE.test(v); }
  function codeFrom(v) {
    if (!v || typeof v !== "string") return null;
    const m = v.match(CODE_RE);
    return m ? m[0] : null;
  }
  function nice(s) {
    return typeof s === "string" ? s.trim().replace(/\s+/g," ").slice(0,160) : null;
  }
  function putLabel(code, label) {
    if (!code || !label) return;
    if (!LABELS[code]) LABELS[code] = label;
  }

  async function loadSharedDictionary() {
    if (loadedDict) return;
    for (const url of DICT_URLS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const txt = await res.text();
        // Don’t attempt to parse HTML error pages
        if (/^\s*</.test(txt)) continue;
        const data = JSON.parse(txt);
        const src = data?.labels && typeof data.labels === "object" ? data.labels : data;
        if (src && typeof src === "object") Object.assign(LABELS, src);
        loadedDict = true;
        log("loaded", Object.keys(LABELS).length, "labels from", url);
        break;
      } catch {}
    }
    if (!loadedDict) log("no shared dictionary found (optional)");
  }

  // Walk any uploaded JSON and harvest code → label pairs
  function harvestFromJSON(root) {
    const seen = new WeakSet();
    const stack = [root];
    let harvested = 0;

    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object" || seen.has(node)) continue;
      seen.add(node);

      // Try to extract (code,label) pairs from this node
      let code = null, label = null;

      // 1) direct fields
      for (const k of CODE_KEYS) {
        if (isCode(node[k])) { code = codeFrom(node[k]); break; }
      }
      for (const k of LABEL_KEYS) {
        if (!label && node[k]) label = nice(node[k]);
      }
      // 2) nested obvious containers
      if (!label && node.meta) {
        for (const k of LABEL_KEYS) {
          if (!label && node.meta[k]) label = nice(node.meta[k]);
        }
      }
      if (!label && node.question) {
        for (const k of LABEL_KEYS) {
          if (!label && node.question[k]) label = nice(node.question[k]);
        }
      }
      if (!label && node.text && typeof node.text === "string") {
        label = nice(node.text);
      }

      if (code && label) {
        putLabel(code, label);
        harvested++;
      }

      // Recurse
      for (const v of Object.values(node)) {
        if (v && typeof v === "object") stack.push(v);
      }
    }
    if (harvested) log("harvested", harvested, "labels from uploaded JSON");
  }

  function getCompatTable() {
    return (
      document.querySelector("#compatTable") ||
      document.querySelector(".compat-table") ||
      document.querySelector("main table") ||
      document.querySelector("table")
    );
  }

  // Replace any cb_* code shown in the first column with its friendly label
  function relabelTableChunked() {
    const table = getCompatTable();
    if (!table) return;

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    let i = 0;

    const step = (deadline) => {
      while (i < rows.length && (!deadline || deadline.timeRemaining() > 6)) {
        const tr = rows[i++];
        const td = tr?.children?.[0];
        if (!td) continue;

        const raw = (td.textContent || "").trim();
        const code = codeFrom(raw);
        if (!code) continue;

        const friendly = LABELS[code];
        if (friendly && friendly !== raw) {
          td.textContent = friendly;
          td.dataset.code = code; // keep original for debug/export
        }
      }
      if (i < rows.length) {
        (window.requestIdleCallback || window.setTimeout)(step, 1);
      } else {
        log("relabel complete. total rows:", rows.length);
      }
    };
    (window.requestIdleCallback || window.setTimeout)(step, 1);
  }

  // Build missing-label template for any codes still visible in the table
  function exportMissingLabels() {
    const table = getCompatTable();
    if (!table) return;
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const missing = {};

    for (const tr of rows) {
      const td = tr.children?.[0];
      if (!td) continue;
      const raw = (td.textContent || "").trim();
      const code = codeFrom(raw) || td.dataset.code;
      if (code && !LABELS[code]) missing[code] = "";
    }

    if (!Object.keys(missing).length) {
      alert("All categories are labeled. Nothing to export.");
      return;
    }

    const payload = JSON.stringify({ labels: missing }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kinks-missing-labels.template.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function addFloatingButton() {
    if (document.getElementById("tk-missing-labels-btn")) return;
    const btn = document.createElement("button");
    btn.id = "tk-missing-labels-btn";
    btn.textContent = "Missing labels";
    Object.assign(btn.style, {
      position: "fixed", right: "16px", bottom: "16px", zIndex: 9999,
      border: "2px solid #00e6ff", background: "transparent", color: "#00e6ff",
      padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
      font: "600 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      boxShadow: "0 0 8px rgba(0,230,255,.35)"
    });
    btn.onmouseenter = () => btn.style.background = "rgba(0,230,255,.1)";
    btn.onmouseleave = () => btn.style.background = "transparent";
    btn.onclick = exportMissingLabels;
    document.body.appendChild(btn);
  }

  // Also try to harvest labels straight from uploaded files (without interfering)
  function watchUploads() {
    document.querySelectorAll('input[type="file"]').forEach((inp) => {
      if (inp.dataset.tkWatched) return;
      inp.dataset.tkWatched = "1";
      inp.addEventListener("change", () => {
        const f = inp.files && inp.files[0];
        if (!f || !/\.json$/i.test(f.name)) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const txt = String(reader.result || "");
            // Skip if the file isn’t JSON (e.g., someone picked PDF)
            if (/^\s*</.test(txt)) return;
            const data = JSON.parse(txt);
            harvestFromJSON(data);
            // After harvesting, attempt relabel again
            relabelTableChunked();
          } catch {}
        };
        reader.readAsText(f);
      });
    });
  }

  // Kick everything off after DOM is ready
  function init() {
    addFloatingButton();
    watchUploads();
    loadSharedDictionary().then(() => relabelTableChunked());

    // The table may be re-rendered by your page code after uploads. Keep it fresh.
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "childList") {
          // debounce
          clearTimeout(init._t);
          init._t = setTimeout(relabelTableChunked, 60);
          break;
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
