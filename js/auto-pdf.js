const exportToPDF = () => {
  const element = document.getElementById('pdf-container');
  const opt = {
    margin: 0,
    filename: 'Kink_Compatibility_Report.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#000',
      scrollY: 0,
      windowWidth: document.body.scrollWidth,
      windowHeight: document.body.scrollHeight
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    pagebreak: {
      mode: ['css', 'legacy'],
      avoid: ['.avoid-break']
    }
  };
  html2pdf().set(opt).from(element).save();
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('download');
  if (btn) btn.addEventListener('click', exportToPDF);
});
