const exportToPDF = () => {
  const element = document.getElementById('pdf-container');
  const opt = {
    margin: 0,
    filename: 'Kink_Compatibility_Report.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      scale: 4,
      useCORS: true,
      backgroundColor: '#000',
      scrollY: 0,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight
    },
    jsPDF: {
      unit: 'px',
      format: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      orientation: 'portrait'
    },
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
