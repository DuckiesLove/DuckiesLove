// Confirm jsPDF is loaded before registering the click event
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("downloadPdfBtn");
  if (!btn) {
    console.error("❌ downloadPdfBtn not found");
    return;
  }

  btn.addEventListener("click", () => {
    // Fail-safe check
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("❌ jsPDF failed to load. Check your internet or CDN blocking.");
      console.error("❌ jsPDF not available:", window.jspdf);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Replace this with actual report content generation
    doc.setFontSize(18);
    doc.text("✅ Kink Compatibility PDF Test", 20, 20);
    doc.text("If you see this, jsPDF loaded and click event worked.", 20, 30);

    doc.save("test-compatibility.pdf");
  });
});
