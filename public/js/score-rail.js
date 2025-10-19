(() => {
  const TAG = "[TK rail]";
  const log = (...a) => console.log(TAG, ...a);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // --- inject CSS once ---
  (function injectCSS(){
    if (document.getElementById("tk-rail-css")) return;
    const st = document.createElement("style");
    st.id = "tk-rail-css";
    st.textContent = `
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
    document.head.appendChild(st);
  })();

  // --- util ---
  const once = (sel, root=document) => root.querySelector(sel);
  const many = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function findStartButton(){
    const C = many('button, [role="button"], a, [onclick]');
    return C.find(n=>{
      const t = (n.innerText||n.textContent||"").toLowerCase();
      const a = (n.getAttribute("aria-label")||"").toLowerCase();
      const id=(n.id||"").toLowerCase(), cls=(n.className||"").toLowerCase();
      return /(start|begin|launch).*(survey|quiz)|^start$/.test(t)
          || /(start|begin).*(survey|quiz)/.test(a)
          || /start/.test(id) || /start/.test(cls);
    }) || null;
  }

  async function ensureStarted(){
    // require at least one category checked
    const checked = once('#categoryPanel input[type="checkbox"]:checked');
    if (!checked) { log("select a category first"); return false; }

    // if a question block already visible, we’re good
    if (getQuestionBlock(true)) return true;

    // click Start once
    const start = findStartButton();
    if (start) {
      start.click();
      log("clicked Start");
      await sleep(150);
    }
    return !!getQuestionBlock(true);
  }

  function getQuestionBlock(visibleOnly=false){
    const root = once('#surveyApp') || document.body;
    if (!root) return null;
    // heuristic: element containing “Giving/Receiving/General” + Next|Skip, or the 0..5 buttons
    const candidates = many('section,div', root).filter(el=>{
      const txt = (el.textContent||"").toLowerCase();
      const hasPills = /(giving|receiving|general)/.test(txt);
      const hasNav  = /(next|skip|back)/.test(txt);
      const has05   = /\b0\b.*\b1\b.*\b2\b.*\b3\b.*\b4\b.*\b5\b/.test(txt);
      return (hasPills && hasNav) || has05 || hasNav;
    });
    for (const el of candidates){
      const r = el.getBoundingClientRect();
      const vis = r.width>300 && r.height>120;
      if (!visibleOnly || vis) return el;
    }
    return null;
  }

  function unhide(el){
    if (!el) return;
    if (el.hasAttribute("hidden")) el.removeAttribute("hidden");
    if (el.style && el.style.display==="none") el.style.display="";
    el.setAttribute("aria-hidden","false");
  }

  // build a single rail (dedupe if already there)
  function chip(n, label, extra=""){
    const d=document.createElement("div");
    d.className="tk-chip";
    d.innerHTML=`<span class="tk-pip pip-${n}">${n}</span><span>${label}${extra?" — "+extra:""}</span>`;
    return d;
  }

  function mountRail(qBlock){
    if (!qBlock || !qBlock.parentElement) return;
    // keep exactly one
    many("#tkScoreRail").slice(1).forEach(n=>n.remove());

    let rail = once("#tkScoreRail");
    if (!rail){
      rail = document.createElement("aside");
      rail.id = "tkScoreRail";
      rail.innerHTML = `<div class="tk-card"><h3>How to score</h3><div class="tk-row" id="tkRow"></div></div>`;
    }
    // place immediately after the question container so it floats to the right column
    if (rail.previousElementSibling !== qBlock){
      qBlock.parentElement.insertBefore(rail, qBlock.nextSibling);
    }
    const row = once("#tkRow", rail);
    row.replaceChildren(
      chip(0,"Brain did a cartwheel","skipped for now 😅"),
      chip(1,"Hard Limit","full stop / non-negotiable"),
      chip(2,"Soft Limit","willing to try; safety & aftercare"),
      chip(3,"Curious / context-dependent","needs discussion"),
      chip(4,"Comfortable / enjoy"),
      chip(5,"Favorite / enthusiastic yes")
    );
  }

  async function tick(){
    const ok = await ensureStarted();
    if (!ok){ log("waiting: select category & start"); return; }
    const qb = getQuestionBlock(false);
    if (!qb){ log("question block not found yet"); return; }
    unhide(qb);
    mountRail(qb);
    log("rail mounted");
  }

  // observers
  const mo = new MutationObserver(()=>tick());
  mo.observe(document.documentElement, {subtree:true, childList:true});
  window.addEventListener("resize", tick);
  document.addEventListener("change", e=>{
    if (e.target && e.target.matches('#categoryPanel input[type="checkbox"]')) tick();
  });

  // first run
  log("booted");
  tick();
})();
