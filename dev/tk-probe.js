/* =========================  TK-PROBE (drop-in dev tester)  =========================
   How to use (any one of these):
   1) TEMP: paste this whole file in your app via Codex (e.g., dev/tk-probe.js), then:
        import TKProbe from "./dev/tk-probe.js";  TKProbe.install({ autoStart:true });
   2) RUNTIME: open the page, then in console:  TKProbe.install({ autoStart:true })
   3) AUTO: set localStorage.tkProbe="1" and reload, or add ?probe=1 to the URL.

   Panel buttons:
     Dump      → prints JSON to console and copies summary to clipboard
     Unfreeze  → removes spinner/aria-busy overlays + enables #start/#startSurvey
     Reset     → unregisters ServiceWorker + clears Cache API, then reloads

   Exposed API:
     TKProbe.install(opts?), TKProbe.start(opts?), TKProbe.stop()
     TKProbe.dump(), TKProbe.unfreeze(), TKProbe.reset()
   ================================================================================ */

const TKProbe = (() => {
  if (globalThis.TKProbe?.__alive) return globalThis.TKProbe; // idempotent guard

  // -------- config / state ----------
  const DEFAULTS = {
    readySelector:
      "[data-testid='category-list'],.category-list,#categoryList,#start,#startSurvey",
    panelPos: { top: 12, right: 12 },
    autoStart: false,
  };

  const S = {
    cfg: { ...DEFAULTS },
    running: false,
    counts: { errors: 0, rejs: 0, fails: 0, longTasks: 0, ready: false },
    logs: { errors: [], rejs: [], fails: [], longTasks: [] },
    timers: { pulse: null },
    els: { panel: null, readout: null },
    orig: { fetch: null, xhrOpen: null },
  };

  // -------- dom helpers ----------
  function h(tag, attrs = {}, html = "") {
    const el = document.createElement(tag);
    Object.assign(el, attrs);
    if (html) el.innerHTML = html;
    return el;
  }
  function css(el, styles) { Object.assign(el.style, styles || {}); }

  // -------- panel ----------
  function buildPanel() {
    const p = h("div");
    p.id = "tk-probe";
    css(p, {
      position: "fixed",
      zIndex: "2147483647",
      top: S.cfg.panelPos.top + "px",
      right: S.cfg.panelPos.right + "px",
      padding: "10px 12px",
      width: "270px",
      background: "#111",
      color: "#fff",
      border: "1px solid #444",
      borderRadius: "10px",
      font: "12px/1.4 system-ui,Segoe UI,Arial",
      boxShadow: "0 6px 20px rgba(0,0,0,.4)",
    });
    p.innerHTML = `
      <div style="font-weight:700;display:flex;justify-content:space-between;align-items:center">
        <span>TK Probe</span>
        <button id="tk-close" title="Close" style="background:#222;color:#fff;border:1px solid #555;border-radius:6px;padding:2px 6px">✕</button>
      </div>
      <div id="tk-readout" style="margin-top:6px;display:grid;grid-template-columns:1fr auto;gap:4px 8px"></div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
        <button id="tk-dump" style="flex:1">Dump</button>
        <button id="tk-unfreeze">Unfreeze</button>
        <button id="tk-reset">Reset</button>
      </div>
    `;
    // button styles (quick)
    p.querySelectorAll("button").forEach(b => {
      css(b, {
        background: "#1f2937", color: "#fff", border: "1px solid #374151",
        borderRadius: "8px", padding: "6px 8px", cursor: "pointer"
      });
    });
    S.els.panel = p;
    S.els.readout = p.querySelector("#tk-readout");
    p.querySelector("#tk-close").onclick = stop;
    p.querySelector("#tk-dump").onclick = dump;
    p.querySelector("#tk-unfreeze").onclick = unfreeze;
    p.querySelector("#tk-reset").onclick = reset;
    document.body.appendChild(p);
    render();
  }

  function render() {
    if (!S.els.readout) return;
    const { errors, rejs, fails, longTasks, ready } = S.counts;
    S.els.readout.innerHTML = `
      <div>URL</div><div>${location.pathname || "/"}</div>
      <div>Ready</div><div>${ready}</div>
      <div>Errors</div><div>${errors}</div>
      <div>Rejections</div><div>${rejs}</div>
      <div>FailedReqs</div><div>${fails}</div>
      <div>LongTasks</div><div>${longTasks}</div>
    `;
  }

  // -------- traps ----------
  function armTraps() {
    // errors
    globalThis.addEventListener("error", onError);
    globalThis.addEventListener("unhandledrejection", onRejection);

    // fetch
    S.orig.fetch = globalThis.fetch;
    globalThis.fetch = async (...args) => {
      try {
        const res = await S.orig.fetch(...args);
        if (!res.ok) onFail(`[fetch !ok] ${args[0]} ${res.status}`);
        return res;
      } catch (e) {
        onFail(`[fetch fail] ${args[0]} ${e?.message || e}`);
        throw e;
      }
    };

    // xhr
    S.orig.xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) {
      this.addEventListener("load", () => { if (this.status >= 400) onFail(`[xhr !ok] ${u} ${this.status}`); });
      this.addEventListener("error", () => onFail(`[xhr error] ${u}`));
      return S.orig.xhrOpen.apply(this, arguments);
    };

    // long tasks (if supported)
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          S.counts.longTasks++;
          S.logs.longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
        }
        render();
      }).observe({ entryTypes: ["longtask"] });
    } catch {}
  }

  function disarmTraps() {
    globalThis.removeEventListener("error", onError);
    globalThis.removeEventListener("unhandledrejection", onRejection);
    if (S.orig.fetch) globalThis.fetch = S.orig.fetch;
    if (S.orig.xhrOpen) XMLHttpRequest.prototype.open = S.orig.xhrOpen;
  }

  function onError(e) {
    S.counts.errors++;
    S.logs.errors.push(String(e.message || e));
    console.error("[ERR]", e.message || e);
    render();
  }
  function onRejection(e) {
    S.counts.rejs++;
    S.logs.rejs.push(String(e.reason || e));
    console.error("[REJ]", e.reason || e);
    render();
  }
  function onFail(msg) {
    S.counts.fails++;
    S.logs.fails.push(msg);
    console.error(msg);
    render();
  }

  // -------- utility actions ----------
  function pulse() {
    // readiness pulse + paint snapshot once
    const ready = !!document.querySelector(S.cfg.readySelector);
    if (ready !== S.counts.ready) {
      S.counts.ready = ready;
      render();
    }
  }

  async function reset() {
    try {
      if (!confirm("Unregister SW + clear caches, then reload?")) return;
      if ("caches" in globalThis) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg) await reg.unregister();
      location.reload();
    } catch (e) {
      console.error("Reset failed:", e);
    }
  }

  function unfreeze() {
    document.querySelector("#start,#startSurvey")?.removeAttribute("disabled");
    document.querySelectorAll(".spinner,[data-loading],[aria-busy='true']").forEach(n => n.remove());
    console.log("Unfreeze attempted (start enabled, spinners removed)");
  }

  function dump() {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = Object.fromEntries(
      (performance.getEntriesByType("paint") || []).map(p => [p.name, Math.round(p.startTime)])
    );
    const out = {
      url: location.href,
      counts: { ...S.counts },
      paints,
      timings: nav ? {
        DCL_ms: Math.round(nav.domContentLoadedEventEnd - nav.navigationStart),
        Load_ms: Math.round(nav.loadEventEnd - nav.navigationStart),
      } : {},
      errors: S.logs.errors.slice(-20),
      rejections: S.logs.rejs.slice(-20),
      failedRequests: S.logs.fails.slice(-20),
      longTasks: S.logs.longTasks.slice(-20),
    };
    console.log("🔎 TKProbe dump →", out);
    try { navigator.clipboard.writeText(JSON.stringify(out, null, 2)); console.log("📋 Copied JSON to clipboard"); } catch {}
    return out;
  }

  // -------- lifecycle ----------
  function start(opts = {}) {
    Object.assign(S.cfg, DEFAULTS, opts || {});
    if (S.running) return;
    S.running = true;
    if (!document.getElementById("tk-probe")) buildPanel();
    armTraps();
    pulse();
    S.timers.pulse = setInterval(pulse, 1000);
    console.log("✅ TKProbe started");
  }

  function stop() {
    if (!S.running) { S.els.panel?.remove(); return; }
    S.running = false;
    clearInterval(S.timers.pulse); S.timers.pulse = null;
    disarmTraps();
    S.els.panel?.remove(); S.els.panel = null; S.els.readout = null;
    console.log("🛑 TKProbe stopped");
  }

  function install(opts = {}) {
    // autoStart if ?probe=1 or localStorage flag present
    const urlAuto = /\bprobe=1\b/.test(location.search);
    const lsAuto = (localStorage.getItem("tkProbe") || "") === "1";
    const auto = opts.autoStart || urlAuto || lsAuto;
    if (auto) start(opts);
    return TKProbe;
  }

  const TKProbe = {
    __alive: true,
    install, start, stop, dump, unfreeze, reset,
  };

  globalThis.TKProbe = TKProbe;
  return TKProbe;
})();

/* ---------------- quick one-liners you can paste in Console while testing ----------------
TKProbe.install({ autoStart:true });          // show panel now
TKProbe.unfreeze();                           // enable Start & remove spinner
TKProbe.dump();                               // print + copy a JSON summary
localStorage.tkProbe="1"; location.reload();  // auto-run on every load
------------------------------------------------------------------------------------------ */
export default TKProbe;
