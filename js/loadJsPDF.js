let jsPDFLib = null;

/**
 * Load the locally bundled jsPDF library. The vendor file is included in the
 * repository so no network access is required.
 */
export async function loadJsPDF() {
  if (jsPDFLib) return jsPDFLib;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    await import('./vendor/jspdf.umd.min.js');
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('jsPDF failed to load');
  }

  jsPDFLib = window.jspdf.jsPDF;
  return jsPDFLib;
}
