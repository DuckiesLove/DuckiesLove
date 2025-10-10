/* ------------------------------------------------------------
   FILE:  /js/pdfDownload.js
   PURPOSE: Full-bleed, black PDF export with NO margins + real names
   (bind this to your “Download PDF” button on the compatibility page)
   ------------------------------------------------------------ */
(() => {
  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
  async function ensurePDFLibs() {
    if (!window.jspdf) await loadScript("/js/vendor/jspdf.umd.min.js");
    if (!window.html2canvas) await loadScript("/js/vendor/html2canvas.min.js");
  }
  async function ensureLabelMap() {
    if (window.__TK__?.labelMap) return window.__TK__.labelMap;
    const fetchJSON = async u => (await fetch(u,{cache:"no-store"})).json();
    const kinks  = await fetchJSON("/data/kinks.json");
    const over   = await fetchJSON("/data/labels-overrides.json").catch(()=> ({}));
    const list   = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    const map    = {...over};
    list.forEach(it => {
      if (it?.id && it?.name) map[String(it.id)] = String(it.name);
      if (it?.code && it?.name) map[String(it.code)] = String(it.name);
      if (it?.cb && it?.label) map[String(it.cb)]  = String(it.label);
    });
    return map;
  }
  async function makeFullBleedPDF() {
    await ensurePDFLibs();
    const map = await ensureLabelMap();
    // swap codes->names on a cloned node (don’t touch on-screen table)
    const table = document.querySelector("table");
    if (!table) return alert("No table found to export.");
    const clone = table.cloneNode(true);
    clone.querySelectorAll("td:first-child, th:first-child").forEach(td => {
      const raw = td.textContent.trim();
      if (raw.startsWith("cb_") && map[raw]) td.textContent = map[raw];
    });
    // wrap in black background for html2canvas snapshot
    const wrap = document.createElement("div");
    wrap.style.background = "#000";
    wrap.style.padding = "0";
    wrap.style.margin = "0";
    wrap.appendChild(clone);
    document.body.appendChild(wrap);
    // snapshot
    const canvas = await html2canvas(wrap, {backgroundColor:"#000", scale:2});
    document.body.removeChild(wrap);
    // full-bleed PDF: no margins
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({orientation:"landscape", unit:"pt", format:"a4"});
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    // scale to edge-to-edge
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    pdf.save("compatibility.pdf");
  }
  // bind
  const btn = document.getElementById("dl") || document.querySelector("[data-tk='download']");
  btn?.addEventListener("click", (e) => { e.preventDefault(); makeFullBleedPDF(); });
  // export for manual calls
  window.tkMakeCompatibilityPDF = makeFullBleedPDF;
})();
