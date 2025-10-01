/* tk-labels.js
 * Translates cb_* codes to short human labels, draws subtle match% bars,
 * guards JSON parsing (prevents "Unexpected token <" freeze on bad uploads),
 * and auto-applies when the table updates.
 */
(function () {
  // --- BASE LABELS (common, from your screenshots) ---
  const BASE_LABELS = {
    // Grooming / appearance
    cb_wwf76: "Makeup as protocol or control",
    cb_swujj: "Accessory or ornament rules",
    cb_k55xd: "Wardrobe restrictions or permissions",

    // Clothing / presentation cluster
    cb_zsnrb: "Dress partner’s outfit",
    cb_6jd2f: "Pick lingerie / base layers",
    cb_kgrnn: "Uniforms (school / military / nurse, etc.)",
    cb_169ma: "Time-period dress-up",
    cb_4yyxa: "Dollification / polished object aesthetics",
    cb_2c0f9: "Hair-based play (brushing / ribbons / tying)",
    cb_qwnhi: "Head coverings / symbolic hoods",
    cb_zvchg: "Coordinated looks / dress codes",
    cb_qw9jg: "Ritualized grooming",
    cb_3ozhq: "Praise for pleasing visual display",
    cb_hqakm: "Formal appearance protocols",
    cb_rn136: "Clothing as power-role signal",
    cb_z1ean: "Dress partner’s outfit (directive/decision)",
    cb_05hqj: "Makeup as protocol or control",

    // Bucket titles (unanswered box)
    bucket_bodily: "Bodily Fluids and Functions",
    bucket_bpt: "Body Part Torture",
    bucket_bondage: "Bondage and Suspension",
    bucket_breath: "Breath Play",
    bucket_psych: "Psychological",
    bucket_sex: "Sexual Activity"
  };

  // --- COVERAGE FROM YOUR LATEST RUN (seen in your JSON/PDFs) ---
  const SAMPLE_COVERAGE = {
    cb_ttnvq: "Mutual interest: Acknowledgment/Check-in",
    cb_ldaec: "Establish safe words / signals",
    cb_ybidt: "Aftercare expectation",
    cb_e0gun: "Hygiene / cleanup expectations",
    cb_eo3uk: "Light service or protocol",
    cb_6ay8i: "Eye contact rule",
    cb_cr4qi: "Decision-making authority (lite)",
    cb_9qszt: "Title / honorific usage",
    cb_5t4ff: "Scheduling or routine adherence",
    cb_pphe1: "Consent refresh / reaffirmation",
    cb_57aax: "Check-in during scene",
    cb_abkgw: "Stop at first sign of discomfort",
    cb_c2zy8: "Negotiated flexibility",
    cb_audvl: "No surprises / no ambush kink",
    cb_ww16h: "Scene boundaries: public vs private",
    cb_0zk14: "No-go list acknowledged",
    cb_2th5l: "Aftercare: physical touch",
    cb_leapq: "Aftercare: quiet/space",
    cb_bb9wv: "Device/gear preparation",
    cb_pc14l: "Safeguards in place",
    cb_8f9lu: "Health considerations",
    cb_28flb: "Allergy/trigger review",
    cb_6x608: "Sober play only",
    cb_jr5l5: "Obedience/comply tests (playful)",
    cb_0n2io: "No edge-play this session",
    cb_kzskf: "Explicit check-out at end",
    cb_a1eg2: "Hydration reminder",
    cb_rhwlo: "Aftercare: reassurance/affirmation",
    cb_n5azr: "Protocol in scene only",
    cb_3xp2v: "Protocol extends post-scene",
    cb_bhbhi: "Use of honorifics outside scene",
    cb_lsco7: "Public discretion phrase",
    cb_3201z: "End-of-day debrief",
    cb_x0t48: "No marks/visible evidence",
    cb_46k59: "No photos/audio"
  };

  let LABELS = { ...BASE_LABELS, ...SAMPLE_COVERAGE };

  async function safeFetchJSON(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      if (txt.trim().startsWith("<")) throw new Error("Not JSON (HTML detected)");
      return JSON.parse(txt);
    } catch (e) {
      console.warn(`[tk-labels] Failed to fetch ${url}:`, e.message);
      return null;
    }
  }

  async function loadOverrides() {
    const overrides = await safeFetchJSON("/data/labels-overrides.json");
    if (overrides && typeof overrides === "object") {
      LABELS = { ...LABELS, ...overrides };
      console.info("[tk-labels] overrides merged:", Object.keys(overrides).length, "keys");
    }
  }

  function labelFor(code) {
    return LABELS[code] || code;
  }

  function relabelTable(root = document) {
    const rows = root.querySelectorAll("table tbody tr");
    let changed = 0;
    rows.forEach((tr) => {
      const cell = tr.querySelector("td,th");
      if (!cell) return;
      const raw = cell.textContent.trim();
      if (/^cb_[a-z0-9]{4,}$/i.test(raw)) {
        const nice = labelFor(raw);
        if (nice !== raw) {
          cell.textContent = nice;
          changed++;
        }
      }
    });
    if (changed) console.info("[tk-labels] relabel done:", changed, "rows");
  }

  function applyPercentBars(root = document) {
    // Assuming column 3 is “Match %”
    const cells = root.querySelectorAll("table td:nth-child(3)");
    cells.forEach((td) => {
      const t = td.textContent.trim();
      if (!t || t === "—" || td.querySelector(".pct")) return;
      const m = t.match(/^(\d{1,3})%$/);
      if (!m) return;
      const pct = Math.max(0, Math.min(100, parseInt(m[1], 10)));
      td.classList.add("pct-cell");
      td.innerHTML =
        `<div class="pct"><span class="bar" style="width:${pct}%;"></span><span class="txt">${pct}%</span></div>`;
    });
  }

  // Public API
  const API = {
    load: async () => { await loadOverrides(); },
    relabel: relabelTable,
    bars: applyPercentBars,
    get: labelFor,
    // Safer JSON parse for uploads (prevents freeze on HTML/PDF/garbage)
    parseSurveyJSON(text) {
      if (typeof text !== "string") throw new Error("No file content");
      const s = text.replace(/^\uFEFF/, '').trim();
      if (!s || s[0] === "<") throw new Error("Not a JSON export (HTML or empty).");
      const data = JSON.parse(s);
      const ok = !!(
        data && (
          Array.isArray(data) ||
          Array.isArray(data.items) ||
          Array.isArray(data.cells) ||
          Array.isArray(data.rows) ||
          Array.isArray(data.data?.cells) ||
          Array.isArray(data.data) ||
          Array.isArray(data.answers) ||
          (data.answers && typeof data.answers === "object") ||
          data.answersByKey ||
          (data.map && typeof data.map === "object")
        )
      );
      if (!ok) throw new Error("JSON missing 'answers' or 'items'.");
      return data;
    }
  };

  // Auto-init after DOM ready, and observe updates to re-apply
  document.addEventListener("DOMContentLoaded", async () => {
    await API.load();
    API.relabel();
    API.bars();

    const target = document.querySelector("table") || document.body;
    const mo = new MutationObserver(() => {
      API.relabel();
      API.bars();
    });
    mo.observe(target, { childList: true, subtree: true });
  });

  window.TK_LABELS = API;
})();
