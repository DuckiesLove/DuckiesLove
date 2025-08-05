// Confirm jsPDF is loaded before registering the click event
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("downloadPdfBtn");
  if (!btn) {
    console.error("❌ downloadPdfBtn not found");
    return;
  }

  btn.addEventListener("click", async () => {
    try {
      const { loadJsPDF } = await import("./loadJsPDF.js");
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF();

      // Replace this with actual report content generation
      doc.setFontSize(18);
      doc.text("✅ Kink Compatibility PDF Test", 20, 20);
      doc.text("If you see this, jsPDF loaded and click event worked.", 20, 30);

      doc.save("test-compatibility.pdf");
    } catch (err) {
      alert("❌ jsPDF failed to load. Check your internet or CDN blocking.");
      console.error("❌ jsPDF load error:", err);
    }
  });
});
