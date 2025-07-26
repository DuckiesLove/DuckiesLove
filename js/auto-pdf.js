/* === 4. PDF Export with Matching Background === */
function generatePDF() {
  html2pdf()
    .set({
      margin: 0,
      filename: `kink-compatibility-${new Date().toISOString().slice(0,10)}.pdf`,
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#1e1e2f' // matches container background
      },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    })
    .from(document.getElementById('comparison-container'))
    .save();
}

/* === 5. Auto-generate PDF on Page Load === */
window.addEventListener('load', () => {
  setTimeout(() => {
    generatePDF();
  }, 1000);
});
