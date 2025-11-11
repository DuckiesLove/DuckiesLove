(function(){
  // Prevent double-bind of the download click
  if (window.__TKPDF_BOUND__) return;
  window.__TKPDF_BOUND__ = true;

  const btn = document.querySelector('#downloadPdfBtn') || document.querySelector('#btnDownloadPdf');
  if (!btn) return;

  // Centralized constants so layout is predictable
  const COLW = [56,12,16,4,12]; // label, A, match, flag, B (must sum ~100)
  const BG   = [10,10,12];      // dark page background
  const MARG = {top: 56, right: 36, bottom: 40, left: 36}; // title space + tight page

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
      const tds = [...tr.cells].slice(0,5); // enforce 5 cols
      const vals = tds.map((td,i)=>{
        let txt = (td.textContent||'').trim();
        if (i===3) txt = '▶'; // normalize flag
        return txt;
      });
      return vals;
    });

    doc.autoTable({
      startY: 180,
      head: [['Item','Partner A','Match','Flag','Partner B']],
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
        0: { cellWidth: `${COLW[0]}%`, halign:'left'   },
        1: { cellWidth: `${COLW[1]}%`, halign:'center' },
        2: { cellWidth: `${COLW[2]}%`, halign:'center' },
        3: { cellWidth: `${COLW[3]}%`, halign:'center' }, // tight flag
        4: { cellWidth: `${COLW[4]}%`, halign:'center' }
      },
      didParseCell: (d)=>{
        // Force a single-line header, allow body to wrap
        if (d.section === 'head') d.cell.styles.minCellHeight = 20;
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
