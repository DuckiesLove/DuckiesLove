import fs from "node:fs";

const file = process.argv[2] || "kinks/index.html";
let html = fs.readFileSync(file, "utf8");

// Remove any previous hotfix block to make this idempotent
html = html.replace(/<!-- TK-HOTFIX START -->(.|\n|\r)*?<!-- TK-HOTFIX END -->\s*/g, "");

// Head injection (root-absolute assets + safe fallbacks)
const HOTFIX_HEAD = `
<!-- TK-HOTFIX START -->
<link rel="stylesheet" href="/css/style.css" id="tk-style-root"/>
<link rel="stylesheet" href="/css/theme.css" id="tk-theme-root"/>
<style id="tk-fallback">
  :root{ --tk-fg:#e6f2ff; --tk-accent:#00e6ff; }
  body{ background:#000; color:var(--fg, var(--tk-fg)); }
  .themed-title,.category-panel,.themed-text{ color:var(--fg, var(--tk-fg)); }
  .themed-button{ background:var(--accent, var(--tk-accent)); color:#000; }
</style>
<script type="module" id="tk-theme-module">
  import { initTheme, applyThemeColors } from '/js/theme.js';
  try{ initTheme(); window.applyThemeColors = applyThemeColors; }catch(e){ console.error('[TK-theme]', e); }
</script>
<!-- TK-HOTFIX END -->
`;

// Body-end diagnostics (shows a visible message if the data JSON fails)
const HOTFIX_DIAG = `
<!-- TK-HOTFIX START -->
<script id="tk-diag">
(function(){
  function show(msg){
    let diag = document.getElementById('kinksDiagnostics');
    if(!diag){ diag = document.createElement('div'); diag.id='kinksDiagnostics'; document.body.prepend(diag); }
    diag.hidden = false;
    diag.style.cssText = "background:#111;color:#fff;padding:8px;border:1px solid #444;margin:8px 0";
    diag.textContent = msg;
  }
  // Only run if page didn't already boot data
  if(!window.__TK_BOOT_RAN){
    window.__TK_BOOT_RAN = true;
    (async () => {
      try{
        const r = await fetch('/data/kinks.json', { cache:'no-store' });
        if(!r.ok) throw new Error('kinks.json ' + r.status);
        const data = await r.json();
        if (typeof window.KINKS_boot === 'function') { window.KINKS_boot(data); }
      }catch(e){ show('Data bootstrap failed: ' + e.message); }
    })();
  }
})();
</script>
<!-- TK-HOTFIX END -->
`;

// Insert HOTFIX_HEAD after <head> opening tag
if (/<head[^>]*>/i.test(html)) {
  html = html.replace(/<head[^>]*>/i, (m) => m + HOTFIX_HEAD);
} else {
  // Safety: prepend at top if no <head> (shouldn't happen)
  html = HOTFIX_HEAD + html;
}

// Insert HOTFIX_DIAG before the final </body>
const BODY_CLOSE_RE = /<\/body>(?![\s\S]*<\/body>)/i;
if (BODY_CLOSE_RE.test(html)) {
  html = html.replace(BODY_CLOSE_RE, HOTFIX_DIAG + "\n</body>");
} else {
  html = html + "\n" + HOTFIX_DIAG;
}

fs.writeFileSync(file, html, "utf8");
console.log("Patched:", file);

