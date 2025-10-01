(() => {
  /** -------------------- Settings & helpers -------------------- **/
  const CODE_RE = /\bcb_[a-z0-9]+\b/i;

  // Try these endpoints (first one that returns valid JSON wins)
  const DICT_URLS = [
    "/data/kinks.json",               // <- where you should keep your master map
    "/kinksurvey/data/kinks.json",
    "/kinks.json"
  ];

  // small fallback so at least a few look nice while you wire /data/kinks.json
  const FALLBACK = {
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

  // where to look for “code” and “label” inside arbitrary JSON
  const CODE_KEYS  = ["id","code","key","slug","cell","category","item","cb","kinkId","kink_id","nodeId"];
  const LABEL_KEYS = ["label","title","name","question","prompt","text","summary","short","display","displayName","labelShort","titleShort","nameShort","desc","description","caption","heading","subheading","subtitle","hint","help","helper","note"];

  const LABELS = { ...FALLBACK };
  let masterLoaded = false;

  const log = (...a) => console.info("[tk-labels]", ...a);
  const isCode = v => typeof v === "string" && CODE_RE.test(v);
  const grabCode = v => isCode(v) ? v.match(CODE_RE)[0] : null;
  const clean    = s => typeof s === "string" ? s.trim().replace(/\s+/g," ").slice(0,160) : null;
  const put      = (k,v) => { if (k && v && !LABELS[k]) LABELS[k] = v; };

  /** -------------------- Dictionary loading -------------------- **/
  async function loadMasterDictionary() {
    if (masterLoaded) return;
    for (const url of DICT_URLS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const txt = await res.text();
        // Avoid parsing an HTML 404 page
        if (/^\s*</.test(txt)) continue;
        const data = JSON.parse(txt);
        ingestAnyShape(data);
        masterLoaded = true;
        log("loaded", Object.keys(LABELS).length, "labels from", url);
        break;
      } catch {}
    }
    if (!masterLoaded) log("no shared dictionary found (that’s OK; you can export a template below)");
  }

  // Recursively ingest ANY JSON shape that might contain code→label pairs
  function ingestAnyShape(root) {
    if (!root || typeof root !== "object") return;
    // 1) explicit {labels:{…}} map
    if (root.labels && typeof root.labels === "object") {
      Object.entries(root.labels).forEach(([k,v]) => put(k, clean(v)));
    }
    // 2) direct flat map { "cb_xxx": "Label", … }
    const looksLikeFlat = Object.keys(root).some(k => CODE_RE.test(k));
    if (looksLikeFlat) {
      Object.entries(root).forEach(([k,v]) => {
        if (CODE_RE.test(k)) put(k, clean(v));
      });
    }
    // 3) full traversal to find {id/code: cb_*, label/title/text: "…"}
    const seen = new WeakSet();
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object" || seen.has(node)) continue;
      seen.add(node);

      let code = null, label = null;
      for (const k of CODE_KEYS)  if (!code  && isCode(node[k])) code  = grabCode(node[k]);
      for (const k of LABEL_KEYS) if (!label && node[k])          label = clean(node[k]);
      if (node.meta && typeof node.meta === "object" && !label) {
        for (const k of LABEL_KEYS) if (!label && node.meta[k]) label = clean(node.meta[k]);
      }
      if (node.question && typeof node.question === "object" && !label) {
        for (const k of LABEL_KEYS) if (!label && node.question[k]) label = clean(node.question[k]);
      }
      if (code && label) put(code, label);

      // traverse
      Object.values(node).forEach(v => { if (v && typeof v === "object") stack.push(v); });
    }
  }

  /** -------------------- Upload harvesting -------------------- **/
  function watchUploads() {
    document.querySelectorAll('input[type="file"]').forEach(inp => {
      if (inp.dataset.tkWatch) return;
      inp.dataset.tkWatch = "1";
      inp.addEventListener("change", () => {
        const f = inp.files && inp.files[0];
        if (!f || !/\.json$/i.test(f.name)) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const txt = String(reader.result || "");
            if (/^\s*</.test(txt)) return; // not JSON
            ingestAnyShape(JSON.parse(txt));
            relabelTable(); // try again with the new labels
          } catch {}
        };
        reader.readAsText(f);
      });
    });
  }

  /** -------------------- Table relabeling -------------------- **/
  function getCompatTable() {
    return (
      document.querySelector("#compatTable") ||
      document.querySelector(".compat-table") ||
      document.querySelector("main table") ||
      document.querySelector("table")
    );
  }

  function relabelTable() {
    const table = getCompatTable();
    if (!table) return;

    // figure out which column is the "Category" column (usually 0)
    const headerCells = Array.from(table.querySelectorAll("thead th,thead td"));
    let catIdx = 0;
    if (headerCells.length) {
      headerCells.forEach((th, i) => {
        const t = (th.textContent || "").toLowerCase();
        if (t.includes("category")) catIdx = i;
      });
    }

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    let i = 0;
    const work = () => {
      const t0 = performance.now();
      while (i < rows.length && performance.now() - t0 < 8) {
        const tr = rows[i++];
        const td = tr.children && tr.children[catIdx];
        if (!td) continue;

        // code might be the entire cell or a piece of it
        const raw  = (td.textContent || "").trim();
        const code = grabCode(raw);
        if (!code) continue;

        const friendly = LABELS[code];
        if (friendly && friendly !== raw) {
          td.textContent = friendly;
          td.dataset.code = code; // keep original for debug/export
        }
      }
      if (i < rows.length) setTimeout(work, 0);
      else log("relabel done:", rows.length, "rows");
    };
    setTimeout(work, 0);
  }

  /** -------------------- Export missing -------------------- **/
  function addMissingButton() {
    if (document.getElementById("tk-missing-labels-btn")) return;
    const btn = document.createElement("button");
    btn.id = "tk-missing-labels-btn";
    btn.textContent = "Missing labels";
    Object.assign(btn.style, {
      position:"fixed", right:"16px", bottom:"16px", zIndex: 9999,
      background:"transparent", color:"#00e6ff", border:"2px solid #00e6ff",
      padding:"10px 14px", borderRadius:"10px", font:"600 14px/1 system-ui",
      boxShadow:"0 0 8px rgba(0,230,255,.35)", cursor:"pointer"
    });
    btn.onmouseenter = () => btn.style.background = "rgba(0,230,255,.1)";
    btn.onmouseleave = () => btn.style.background = "transparent";
    btn.onclick = exportMissing;
    document.body.appendChild(btn);
  }

  function exportMissing() {
    const table = getCompatTable();
    if (!table) return;
    const headerCells = Array.from(table.querySelectorAll("thead th,thead td"));
    let catIdx = 0;
    if (headerCells.length) {
      headerCells.forEach((th, i) => {
        const t = (th.textContent || "").toLowerCase();
        if (t.includes("category")) catIdx = i;
      });
    }

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const missing = {};
    rows.forEach(tr => {
      const td = tr.children && tr.children[catIdx];
      if (!td) return;
      const code = grabCode(td.textContent) || td.dataset.code;
      if (code && !LABELS[code]) missing[code] = "";
    });

    if (!Object.keys(missing).length) {
      alert("All categories are labeled. Great!");
      return;
    }

    const payload = JSON.stringify({ labels: missing }, null, 2);
    const blob = new Blob([payload], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kinks-missing-labels.template.json";
    document.body.appendChild(a); a.click(); a.remove();
  }

  /** -------------------- Boot -------------------- **/
  function boot() {
    addMissingButton();
    watchUploads();
    loadMasterDictionary().then(relabelTable);

    // If your page re-renders after uploads, keep labels in sync:
    const mo = new MutationObserver(() => {
      clearTimeout(boot._t);
      boot._t = setTimeout(relabelTable, 80);
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once:true });
  } else {
    boot();
  }
})();
