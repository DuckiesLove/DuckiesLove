const exportToPDF = () => {
  const element = document.getElementById('compatibility-wrapper');
  const width = element.scrollWidth;
  const height = element.scrollHeight;

  const opt = {
    margin: 0,
    filename: 'Kink_Compatibility_Report.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#000',
      scrollY: 0,
      width,
      windowWidth: width,
      windowHeight: height
    },
    jsPDF: {
      unit: 'px',
      format: [width, height],
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
