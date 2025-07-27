// SETUP DARK PDF EXPORT
const element = document.getElementById('results'); // main results container
element.classList.add('pdf-container');

const opt = {
  margin: [0, 0, 0, 0],
  filename: 'kink-compatibility-results.pdf',
  image: { type: 'jpeg', quality: 1 },
  html2canvas: {
    scale: 2,
    useCORS: true,
    backgroundColor: '#000',
    logging: true,
    scrollY: 0,
    scrollX: 0,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight
  },
  jsPDF: { unit: 'px', format: 'a4', orientation: 'portrait' }
};

// CLEAN EXPORT BUTTON (REMOVE "Trouble Downloading")
document.querySelectorAll('button').forEach(btn => {
  if (btn.innerText.toLowerCase().includes('trouble')) btn.remove();
});

// STYLE INJECTION (Print Overrides)
const printStyle = document.createElement('style');
printStyle.textContent = `
  @media print {
    body {
      background: #000 !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
    }
    .pdf-container {
      margin: 0 !important;
      padding: 0 !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;
document.head.appendChild(printStyle);

// STYLE INJECTION (Dark Theme)
const style = document.createElement('style');
style.innerHTML = `
  body {
    background-color: #000000 !important;
    color: #f0f0f0 !important;
    font-family: 'Arial', sans-serif;
  }

  #results {
    background-color: #000000 !important;
    padding: 2rem;
  }

  table {
    background-color: #1a1a1a !important;
    border-collapse: collapse;
    width: 100%;
    color: #e0e0e0;
  }

  th, td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #333;
  }

  th {
    background-color: #111 !important;
    color: #bbb;
    font-weight: 600;
  }

  .bar-container {
    background: #2a2a2a !important;
    border-radius: 5px;
  }

  .bar {
    height: 12px;
    border-radius: 5px;
  }

  .bar.green { background-color: #00e676 !important; }
  .bar.yellow { background-color: #ffeb3b !important; }
  .bar.red { background-color: #f44336 !important; }
`;
document.head.appendChild(style);

function downloadPDF() {
  html2pdf().set(opt).from(element).save();
}

window.downloadPDF = downloadPDF;

// EXECUTE EXPORT AUTOMATICALLY
downloadPDF();

