/**
 * js/compatibilityPdf.js
 *
 * Thin wrapper around the new pretty PDF generator (TKCompatPDF).
 * - NO own jsPDF / autoTable usage
 * - NO Flag column
 * - NO extra PDF; it just forwards to TKCompatPDF.download(...)
 *
 * This file replaces the old generateDarkPDF / tkHeaderAndTable / addSection code.
 */

(function () {
  // Grab whatever rows the comparison page is already using
  function currentRows() {
    // Live rows on the page
    if (Array.isArray(window.talkkinkCompatRows) && window.talkkinkCompatRows.length) {
      return window.talkkinkCompatRows;
    }

    // Fallback: saved rows in localStorage
    try {
      const raw = localStorage.getItem('talkkink:compatRows');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[compat-wrapper] Failed to read compat rows from storage:', err);
      return [];
    }
  }

  async function handleDownloadClick(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    const rows = currentRows();
    if (!rows.length) {
      alert('Upload both surveys first so we can build your compatibility report.');
      return;
    }

    if (window.TKCompatPDF && typeof window.TKCompatPDF.download === 'function') {
      try {
        await window.TKCompatPDF.download(rows);
      } catch (err) {
        console.error('[compat-wrapper] TKCompatPDF.download failed:', err);
        alert('PDF could not be generated. Check console for details.');
      }
    } else {
      console.error('[compat-wrapper] TKCompatPDF not available on window.');
      alert('Pretty PDF generator is not loaded. Make sure assets/js/compatPdf.js is included.');
    }
  }

  function wireButton() {
    const btn = document.querySelector('#downloadBtn, #downloadPdfBtn, [data-download-pdf]');
    if (!btn) return;

    // Remove any old inline onclick="generateDarkPDF()" or similar
    btn.removeAttribute('onclick');

    // Make sure we don’t double-bind
    btn.addEventListener('click', handleDownloadClick, { passive: false });
  }

  document.addEventListener('DOMContentLoaded', wireButton);
})();
