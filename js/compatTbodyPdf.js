/*
 * ALL-IN-ONE: "Download PDF" click doesn’t fire → robust bind + guaranteed export
 *
 * What this block does
 * 1) Dynamically loads jsPDF + AutoTable if they aren’t already on the page.
 * 2) Finds your download button by ANY of these:
 *      - #downloadBtn        - #downloadPdfBtn
 *      - [data-download-pdf] - button with text that includes “download pdf”
 *    (Re-binds automatically if the UI re-renders later.)
 * 3) Exports rows DIRECTLY from your table body (#compatTbody) or, if absent,
 *    from window.partnerAData / window.partnerBData. It recomputes Match% & Flag.
 * 4) A/B columns stay numeric; Match is %, Flag is icon (★ ⚑ 🚩).
 */
(function(){
  /* ---------- 0) Load libs if missing ---------- */
  function loadScript(src){
    return new Promise((res, rej)=>{
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureLibs(){
    if (!window.jspdf || !window.jspdf.jsPDF){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      console.log('[PDF] jsPDF loaded');
    }

    const needAuto = !((window.jspdf && window.jspdf.autoTable) ||
                       (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable));
    if (needAuto){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js');
      console.log('[PDF] AutoTable loaded');
    }
  }

  /* ---------- 1) Data collection ---------- */
  const THRESH = { star: 90, flag: 60, low: 30 };
  const ICON   = { star: '★', flag: '⚑', low: '🚩', blank: '' };
  const toNum = v => { const n = Number(String(v ?? '').trim()); return Number.isFinite(n) ? n : null; };
  const pct = (a,b) => { const A=toNum(a), B=toNum(b); if (A==null||B==null) return null; return Math.round(100-(Math.abs(A-B)/5)*100); };
  const flag = p => p==null?ICON.blank:(p>=THRESH.star?ICON.star:(p>=THRESH.flag?ICON.flag:(p<=THRESH.low?ICON.low:ICON.blank)));

  const detectScale = arr => {
    const vals = (arr || []).map(x => x?.score).filter(x => typeof x === 'number');
    if (!vals.length) return 1;
    const mx = Math.max(...vals), mn = Math.min(...vals);
    if (mx <= 5 && mn >= 0) return 1;
    if (mx <= 1 && mn >= 0) return 5;
    if (mx <= 7) return 5 / 7;
    if (mx <= 10) return 5 / 10;
    if (mx <= 100) return 5 / 100;
    return 5 / Math.max(5, mx);
  };

  function rowsFromTbody(){
    const tbody = document.querySelector('#compatTbody');
    if (!tbody) return [];
    const trs = Array.from(tbody.querySelectorAll('tr'));
    const out = [];
    for (const tr of trs){
      const tds = tr.querySelectorAll('td');
      if (!tds.length) continue;
      const cat  = tds[0]?.textContent?.trim() || tr.getAttribute('data-kink-id') || '';
      const aTxt = tr.querySelector('td[data-cell="A"]')?.textContent ?? tds[1]?.textContent ?? '';
      const bTxt = tr.querySelector('td[data-cell="B"]')?.textContent ?? tds[tds.length-1]?.textContent ?? '';
      const A = toNum(aTxt), B = toNum(bTxt), P = pct(A,B);
      out.push([cat || '—', (A ?? '—'), (P == null ? '—' : `${P}%`), flag(P), (B ?? '—')]);
    }
    return out;
  }

  function rowsFromMemory(){
    const A = (window.partnerAData?.items) || (Array.isArray(window.partnerAData) ? window.partnerAData : null);
    const B = (window.partnerBData?.items) || (Array.isArray(window.partnerBData) ? window.partnerBData : null);
    if (!A && !B) return [];
    const sA = detectScale(A || []), sB = detectScale(B || []);
    const mA = new Map((A || []).map(i => [(i.id || i.label), i]));
    const mB = new Map((B || []).map(i => [(i.id || i.label), i]));
    const union = new Map();
    (A || []).forEach(i => union.set(i.id || i.label, i.label || i.id));
    (B || []).forEach(i => union.set(i.id || i.label, i.label || i.id));
    const out = [];
    for (const [id, label] of union){
      const a = mA.get(id), b = mB.get(id);
      const Ar = typeof a?.score === 'number' ? a.score : null;
      const Br = typeof b?.score === 'number' ? b.score : null;
      const P = (Ar == null || Br == null) ? null : pct(Ar * sA, Br * sB);
      out.push([label || id || '—', (Ar ?? '—'), (P == null ? '—' : `${P}%`), flag(P), (Br ?? '—')]);
    }
    return out;
  }

  /* ---------- 2) AutoTable wrapper ---------- */
  function runAutoTable(doc, opts){
    if (typeof doc.autoTable === 'function') return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === 'function') return window.jspdf.autoTable(doc, opts);
    throw new Error('AutoTable not found after load.');
  }

  /* ---------- 3) Exporter ---------- */
  async function exportPDF(ev){
    ev?.preventDefault?.();
    try{
      await ensureLibs();

      let rows = rowsFromTbody();
      if (!rows.length) rows = rowsFromMemory();

      console.log(`[PDF] rows to export: ${rows.length}`);
      if (!rows.length){
        alert('No data rows found (table or memory). Load both surveys first.');
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({orientation:'landscape', unit:'pt', format:'a4'});

      doc.setFontSize(20);
      doc.text('Talk Kink • Compatibility Report', doc.internal.pageSize.width/2, 48, {align:'center'});

      runAutoTable(doc, {
        head: [['Category','Partner A','Match','Flag','Partner B']],
        body: rows,
        startY: 70,
        styles: { fontSize: 11, cellPadding: 6, overflow:'linebreak' },
        headStyles: { fillColor:[0,0,0], textColor:[255,255,255], fontStyle:'bold' },
        columnStyles: {
          0:{halign:'left',   cellWidth: 560},
          1:{halign:'center', cellWidth: 80 },
          2:{halign:'center', cellWidth: 90 },
          3:{halign:'center', cellWidth: 60 },
          4:{halign:'center', cellWidth: 80 }
        }
      });

      doc.save('compatibility-report.pdf');
    }catch(err){
      console.error('[PDF] Export failed:', err);
      alert('PDF export failed: ' + err.message);
    }
  }

  /* ---------- 4) Robust button binding (multi-selector + observer) ---------- */
  const BUTTON_SELECTORS = [
    '#downloadBtn',
    '#downloadPdfBtn',
    '[data-download-pdf]',
    'button[aria-label="Download PDF"]',
    'a[role="button"][href="#download-pdf"]'
  ];

  function findDownloadButton(){
    for (const sel of BUTTON_SELECTORS){
      const el = document.querySelector(sel);
      if (el) return el;
    }
    const btns = Array.from(document.querySelectorAll('button, a, [role=button]'));
    return btns.find(b => /download\s*pdf/i.test(b.textContent || ''));
  }

  function bindNow(){
    const btn = findDownloadButton();
    if (btn){
      btn.removeEventListener('click', exportPDF);
      btn.addEventListener('click', exportPDF);
      console.log('[PDF] Bound exporter to:', btn);
    } else {
      console.warn('[PDF] Download button not found yet; will keep watching for it…');
    }
  }

  const mo = new MutationObserver(() => bindNow());
  mo.observe(document.documentElement, {childList:true, subtree:true});
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bindNow);
  } else {
    bindNow();
  }

  window.downloadCompatibilityPDF = exportPDF;
})();

