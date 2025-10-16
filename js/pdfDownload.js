(function (global) {
  'use strict';

  // Example helper (replace/extend with yours)
  function toTitle(s){ return String(s||'').replace(/\s+/g,' ').trim(); }

  // MAIN: build and save the PDF (jsPDF or your own lib must already be included if needed)
  function downloadCompatibilityPDF(aData, bData, opts = {}) {
    if (!aData || !bData) { console.warn('[TK-PDF] Missing data'); return; }

    // TODO: Replace this stub with your real PDF code.
    // Example using jsPDF (ensure jspdf is loaded globally):
    if (global.jspdf || global.jsPDF) {
      const { jsPDF } = global.jspdf || global;
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });

      const theme = opts.theme || (global.document?.documentElement?.className || '');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
      doc.text('TalkKink — Compatibility Summary', 50, 60);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      doc.text(`Theme: ${theme}`, 50, 80);
      doc.text(`Partner A items: ${Object.keys(aData || {}).length}`, 50, 100);
      doc.text(`Partner B items: ${Object.keys(bData || {}).length}`, 50, 120);

      // … add your real table/content here …

      doc.save('TalkKink-Compatibility.pdf');
      return;
    }

    // If you use another generator, call it here:
    // buildAndSavePDF(aData, bData, opts);

    console.warn('[TK-PDF] No PDF library detected; include jsPDF or your generator before this script.');
  }

  // Expose globally
  global.downloadCompatibilityPDF = downloadCompatibilityPDF;

})(window);
