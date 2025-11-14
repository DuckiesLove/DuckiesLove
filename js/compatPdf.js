(function(){
  // Prevent double-bind of the download click
  if (window.__TKPDF_BOUND__) return;
  window.__TKPDF_BOUND__ = true;

  const btn = document.querySelector('#downloadPdfBtn') || document.querySelector('#btnDownloadPdf');
  if (!btn) return;

  // Centralized constants so layout is predictable
  const COLW = { item:56, partnerA:12, match:16, flag:4, partnerB:12 }; // must sum ~100
  const BG   = [10,10,12];      // dark page background
  const MARG = {top: 56, right: 36, bottom: 40, left: 36}; // title space + tight page

  const FLAG_RGB = {
    green: [24, 214, 154],
    yellow: [255, 204, 0],
    red: [255, 66, 66],
  };

  function parseHexColor(hex){
    if (!hex) return null;
    const clean = String(hex).trim().replace(/^#/, '');
    if (clean.length !== 6) return null;
    const r = parseInt(clean.slice(0,2), 16);
    const g = parseInt(clean.slice(2,4), 16);
    const b = parseInt(clean.slice(4,6), 16);
    if ([r,g,b].some(n=>Number.isNaN(n))) return null;
    return [r,g,b];
  }

  function extractFlagMeta(td){
    if (!td) return { text:'▶', color:null };

    const rawText = (td.textContent || '').trim();
    const dot = td.querySelector?.('.flag-dot');

    if (!dot){
      return { text: rawText || '▶', color:null };
    }

    const status = dot.dataset?.flagStatus || td.dataset?.flagStatus || '';
    const emoji = dot.dataset?.flagEmoji || rawText || '';
    const hasColor = dot.dataset?.hasColor === 'true';

    let color = null;
    if (hasColor){
      const cssColor = dot.style?.getPropertyValue?.('--flag-color') || '';
      color = parseHexColor(cssColor) || parseHexColor(dot.dataset?.flagColor) || parseHexColor(td.dataset?.flagColor) || null;
    }
    if (!color && status && FLAG_RGB[status]){
      color = FLAG_RGB[status];
    }

    if (!color){
      return { text: emoji || rawText || '▶', color:null };
    }

    return { text: '', color, status, emoji };
  }

  function drawFlagSquare(doc, cell, color){
    if (!Array.isArray(color) || color.length !== 3) return;
    const [r,g,b] = color.map(n=>Math.max(0, Math.min(255, Number(n) || 0)));
    const { x, y, height, width } = cell;
    const size = Math.min(width, height) * 0.45;
    const sx = x + (width - size) / 2;
    const sy = y + (height - size) / 2;
    doc.setFillColor(r,g,b);
    doc.setLineWidth(0);
    doc.rect(sx, sy, size, size, 'F');
  }

  // Draw outlined text (stroke + fill) for title/subtitle
  function drawOutlined(doc, text, x, y, opts={}, strokeWidth=0.6){
    const { fontSize=32, align='center' } = opts;
    doc.setFontSize(fontSize);
    doc.setTextColor(57,230,223);   // cyan
    // Stroke pass
    doc.setDrawColor(0,0,0);
    doc.setLineWidth(strokeWidth);
    doc.text(text, x, y, {align, renderingMode:'stroke'});
    // Fill pass
    doc.text(text, x, y, {align, renderingMode:'fill'});
  }

  async function buildPdf(){
    // Ensure jsPDF + AutoTable are present (local loader recommended)
    if (!window.jspdf?.jsPDF?.API?.autoTable) { throw new Error('jsPDF/AutoTable missing'); }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'letter' });
    // page bg
    doc.setFillColor(...BG); doc.rect(0,0,doc.internal.pageSize.getWidth(),doc.internal.pageSize.getHeight(),'F');

    const pageW = doc.internal.pageSize.getWidth();
    const centerX = pageW/2;
    const ts = new Date().toLocaleString();
    drawOutlined(doc, 'TalkKink Compatibility', centerX, 86, {fontSize:44});
    drawOutlined(doc, `Generated: ${ts}`, centerX, 112, {fontSize:16});
    drawOutlined(doc, 'Behavioral Play', centerX, 156, {fontSize:34});

    // Extract table rows from the live table to keep order identical
    const table = document.querySelector('table.compat');
    if (!table) throw new Error('No table.compat found');

    const rows = [...table.tBodies[0].rows].map(tr=>{
      const tds = [...tr.cells];
      const flagMeta = extractFlagMeta(tds[3]);
      return {
        item: (tds[0]?.textContent || '').trim(),
        partnerA: (tds[1]?.textContent || '').trim(),
        match: (tds[2]?.textContent || '').trim(),
        flag: flagMeta.text,
        partnerB: (tds[4]?.textContent || '').trim(),
        __flagColor: flagMeta.color
      };
    });

    doc.autoTable({
      startY: 180,
      columns: [
        { header: 'Item', dataKey: 'item' },
        { header: 'Partner A', dataKey: 'partnerA' },
        { header: 'Match', dataKey: 'match' },
        { header: 'Flag', dataKey: 'flag' },
        { header: 'Partner B', dataKey: 'partnerB' },
      ],
      body: rows,
      margin: MARG,
      styles: {
        fontSize: 12,
        textColor: [230,230,235],
        fillColor: [17,18,20],
        lineColor: [34,52,66],
        lineWidth: 0.5,
        cellPadding: {top:6, right:8, bottom:6, left:8},
        overflow: 'linebreak',
        rowPageBreak: 'avoid'
      },
      headStyles: {
        fillColor: [12,12,14],
        textColor: [57,230,223],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: {
        item: { cellWidth: `${COLW.item}%`, halign:'left'   },
        partnerA: { cellWidth: `${COLW.partnerA}%`, halign:'center' },
        match: { cellWidth: `${COLW.match}%`, halign:'center' },
        flag: { cellWidth: `${COLW.flag}%`, halign:'center' },
        partnerB: { cellWidth: `${COLW.partnerB}%`, halign:'center' }
      },
      didParseCell: (d)=>{
        // Force a single-line header, allow body to wrap
        if (d.section === 'head') d.cell.styles.minCellHeight = 20;
        if (d.section === 'body' && d.column.dataKey === 'flag' && Array.isArray(d.row.raw?.__flagColor)) {
          d.cell.text = [];
        }
      },
      didDrawCell: (d)=>{
        if (d.section === 'body' && d.column.dataKey === 'flag') {
          const color = d.row.raw?.__flagColor;
          if (Array.isArray(color)) drawFlagSquare(doc, d.cell, color);
        }
      }
    });

    doc.save('talkkink-compatibility.pdf');
  }

  // Bind once
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    Promise.resolve().then(buildPdf).catch(err=>alert(err?.message||err));
  }, { once:false }); // once=false because of our global __TKPDF_BOUND__ guard
})();
