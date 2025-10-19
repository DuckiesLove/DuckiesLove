(() => {
  const TAG = "[TK rail]";
  if (window.__TK_SCORE_RAIL__) {
    console.debug(TAG, "already booted; skipping duplicate script load");
    return;
  }
  window.__TK_SCORE_RAIL__ = true;

  const log = (...a) => console.log(TAG, ...a);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const debounce = (fn, ms = 120) => {
    let id;
    return (...args) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...args), ms);
    };
  };

  async function waitFor(selector, { root = document, timeout = 8000, step = 80 } = {}) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const node = root.querySelector(selector);
      if (node) return node;
      await sleep(step);
    }
    return null;
  }

  const CSS = `
    #tkScoreRail { position: sticky; top: 88px; margin-left: auto; width: min(520px, 42vw); z-index: 3; }
    #tkScoreRail .tk-card { border:1px solid rgba(0,255,255,.2); border-radius:14px; background:rgba(12,20,28,.65);
      backdrop-filter: blur(6px); box-shadow:0 0 0 1px rgba(0,255,255,.08), 0 18px 40px rgba(0,0,0,.35); padding:12px 14px; }
    #tkScoreRail h3 { margin:0 0 8px 0; font:600 14px/1.2 system-ui,Segoe UI,Roboto,Helvetica,Arial; letter-spacing:.02em;
      color:#cfefff; text-shadow:0 0 8px rgba(0,180,255,.35); }
    .tk-row { display:flex; gap:8px; overflow:auto; scrollbar-width:none; }
    .tk-row::-webkit-scrollbar { display:none; }
    .tk-chip { display:inline-flex; align-items:center; gap:8px; border:1px solid rgba(255,255,255,.12); border-radius:12px;
      background:rgba(20,28,36,.82); padding:8px 10px; font:500 13px/1.2 system-ui,Segoe UI,Roboto,Helvetica,Arial; color:#e9f7ff; white-space:nowrap; }
    .tk-pip { width:22px; height:22px; border-radius:50%; display:grid; place-items:center; font:700 12px/1 system-ui;
      color:#00131a; box-shadow:0 0 0 2px rgba(0,0,0,.35) inset; }
    .pip-0{background:#8ed6ff}.pip-1{background:#ff4d5f}.pip-2{background:#ffca2b}.pip-3{background:#71e27c}.pip-4{background:#35d06a}.pip-5{background:#09c15a}
    @media (max-width: 1200px){ #tkScoreRail{position:static;width:100%;margin-top:12px} }
  `;

  function ensureCss() {
    if (document.getElementById("tk-rail-css")) return;
    const style = document.createElement("style");
    style.id = "tk-rail-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function findStartButton() {
    const candidates = [...document.querySelectorAll('button, [role="button"], a, [onclick]')];
    const matcher = (value) => (value || "").trim().toLowerCase();
    return (
      candidates.find((node) => {
        const text = matcher(node.innerText || node.textContent);
        const aria = matcher(node.getAttribute("aria-label"));
        const id = matcher(node.id);
        const cls = matcher(node.className);
        return /(start|begin|launch).*(survey|quiz)|^start$/.test(text)
          || /(start|begin).*(survey|quiz)/.test(aria)
          || /start/.test(id)
          || /start/.test(cls);
      }) || null
    );
  }

  async function ensureSurveyStarted() {
    const anySelected = !!document.querySelector('#categoryPanel input[type="checkbox"]:checked');
    if (!anySelected) {
      log("no category selected yet");
      return false;
    }

    if (getQuestionContainer(true)) {
      log("question already visible");
      return true;
    }

    const start = findStartButton();
    if (start) {
      start.click();
      log("clicked Start");
      await sleep(150);
      return !!getQuestionContainer(true);
    }

    log("Start button not found (may already be started)");
    return !!getQuestionContainer(true);
  }

  function getQuestionContainer(visibleOnly = false) {
    const app = document.querySelector('#surveyApp') || document.querySelector('main') || document.body;
    if (!app) return null;

    const candidates = [...app.querySelectorAll('section, div')].filter((node) => {
      const text = (node.textContent || "").toLowerCase();
      const hasPills = /(giving|receiving|general)/.test(text);
      const hasScoreButtons = /\b0\b.*\b1\b.*\b2\b.*\b3\b.*\b4\b.*\b5\b/.test(text);
      const hasNav = /(next|skip|back)/.test(text);
      return (hasPills && hasNav) || hasScoreButtons || hasNav;
    });

    let best = null;
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      const visible = rect.width > 300 && rect.height > 120;
      if (!visibleOnly || visible) {
        best = node;
        break;
      }
    }
    return best;
  }

  function unhide(element) {
    if (!element) return;
    if (element.hasAttribute("hidden")) element.removeAttribute("hidden");
    if (element.style && element.style.display === "none") element.style.display = "";
    element.setAttribute("aria-hidden", "false");
  }

  function chip(score, label, extra = "") {
    const div = document.createElement("div");
    div.className = "tk-chip";
    div.innerHTML = `<span class="tk-pip pip-${score}">${score}</span><span>${label}${extra ? " — " + extra : ""}</span>`;
    return div;
  }

  function mountRailBeside(container) {
    if (!container || !container.parentElement) return null;

    const rails = [...document.querySelectorAll("#tkScoreRail")];
    rails.slice(1).forEach((node) => node.remove());

    let rail = document.getElementById("tkScoreRail");
    if (!rail) {
      rail = document.createElement("aside");
      rail.id = "tkScoreRail";
      rail.setAttribute("role", "complementary");
      rail.setAttribute("aria-label", "How to score");
      rail.innerHTML = `
        <div class="tk-card">
          <h3>How to score</h3>
          <div class="tk-row" id="tkRow"></div>
        </div>`;
    }

    if (rail.previousElementSibling !== container) {
      container.parentElement.insertBefore(rail, container.nextSibling);
    }

    const row = rail.querySelector("#tkRow");
    row.replaceChildren(
      chip(0, "Brain did a cartwheel", "skipped for now 😅"),
      chip(1, "Hard Limit", "full stop / non-negotiable"),
      chip(2, "Soft Limit", "willing to try; safety & aftercare"),
      chip(3, "Curious / context-dependent", "needs discussion"),
      chip(4, "Comfortable / enjoy"),
      chip(5, "Favorite / enthusiastic yes"),
    );
    return rail;
  }

  const place = debounce(async () => {
    log("place: tick");

    const started = await ensureSurveyStarted();
    if (!started) {
      log("waiting: select a category and/or click Start");
      return;
    }

    const container = getQuestionContainer(false);
    if (!container) {
      log("question container not found yet");
      return;
    }

    unhide(container);
    mountRailBeside(container);
    log("rail mounted");
  }, 120);

  function boot() {
    ensureCss();
    window.addEventListener("load", place);
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", place);
    document.addEventListener("change", (event) => {
      if (event.target && event.target.matches('#categoryPanel input[type="checkbox"]')) place();
    });
    log("booted (overlay disabled)");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
