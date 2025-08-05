let jsPDFLib = null;

/**
 * Attempt to load jsPDF from a local vendor file first and fall back to a CDN
 * when available. If neither source is reachable, a very small stub is
 * provided so calling code can continue without throwing runtime errors.
 */
export async function loadJsPDF() {
  if (jsPDFLib) return jsPDFLib;

  // Already available (either real library or stub)
  if (window.jspdf && window.jspdf.jsPDF) {
    jsPDFLib = window.jspdf.jsPDF;
    return jsPDFLib;
  }

  // Try to import the local copy
  try {
    await import('./vendor/jspdf.umd.min.js');
  } catch (err) {
    console.warn('Failed to load local jsPDF:', err);
  }

  // If still not loaded, try the CDN
  if (!window.jspdf || !window.jspdf.jsPDF) {
    try {
      await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    } catch (err) {
      console.warn('Failed to load jsPDF from CDN:', err);
    }
  }

  // Final fallback – ensure a stub exists so downstream code doesn't crash
  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.warn('jsPDF not available; falling back to stub');
    window.jspdf = {
      jsPDF: function () {
        const message =
          "PDF library failed to load. Printing the page instead—choose 'Save as PDF' in your browser.";
        if (typeof alert === 'function') {
          alert(message);
          try {
            window.print && window.print();
          } catch {}
        } else {
          console.error(message);
        }
        // Methods used in the app are provided as no-ops
        return {
          setFillColor() {},
          rect() {},
          setDrawColor() {},
          line() {},
          setTextColor() {},
          setFont() {},
          setFontSize() {},
          text() {},
          addPage() {},
          save() {},
        };
      },
      isStub: true,
    };
  }

  jsPDFLib = window.jspdf.jsPDF;
  return jsPDFLib;
}
