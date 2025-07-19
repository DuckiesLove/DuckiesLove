let jsPDFLib = null;
export async function loadJsPDF() {
  if (jsPDFLib) return jsPDFLib;
  if (window.jspdf && window.jspdf.jsPDF && !window.jspdf.isStub) {
    jsPDFLib = window.jspdf.jsPDF;
    return jsPDFLib;
  }
  try {
    await import('./vendor/jspdf.umd.min.js');
    if (window.jspdf && window.jspdf.jsPDF && !window.jspdf.isStub) {
      jsPDFLib = window.jspdf.jsPDF;
      return jsPDFLib;
    }
  } catch (err) {
    console.warn('Failed to load local jsPDF:', err);
  }
  await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
  jsPDFLib = window.jspdf.jsPDF;
  return jsPDFLib;
}
