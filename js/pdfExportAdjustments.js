export class CompatibilityPDFExporter {
  constructor(containerSelector = '#pdf-container') {
    this.containerSelector = containerSelector;
    this.styleAttr = 'data-pdf-fix';
    this.categoryShortMap = {
      "Choosing my partner’s outfit for the day or a scene": "Choosing outfit",
      "Selecting their underwear, lingerie, or base layers": "Selecting lingerie",
      "Styling their hair (braiding, brushing, tying, etc.)": "Styling hair",
      "Picking head coverings (bonnets, veils, hoods, hats) for mood or protocol": "Picking headwear",
      "Offering makeup, polish, or accessories as part of ritual or play": "Makeup/accessories",
      "Creating themed looks (slutty, innocent, doll-like, sharp, etc.)": "Themed looks",
      "Dressing them in role-specific costumes (maid, bunny, doll, etc.)": "Costumes",
      "Curating time-period or historical outfits (e.g., Victorian, 50s)": "Historical outfits",
      "Helping them present more femme, masc, or androgynous by request": "Gender styling",
      "Coordinating their look with mine for public or private scenes": "Coordinated look",
      "Implementing a “dress ritual” or aesthetic preparation": "Dress ritual",
      "Enforcing a visual protocol (e.g., no bra, heels required, tied hair)": "Visual protocol",
      "Having my outfit selected for me by a partner": "Outfit selected for me",
      "Wearing the underwear or lingerie they choose": "Wearing their choice"
    };
    this.css = `
      .pdf-export table {
        table-layout: fixed;
        width: 100%;
        border-collapse: collapse;
      }
      .pdf-export th, .pdf-export td {
        padding: 6px;
        vertical-align: top;
      }
      /* Category column takes most space for text */
      .pdf-export .col-category {
        width: 55% !important;
        text-align: left !important;
        white-space: normal !important;
      }
      /* Partner A, Match, Partner B evenly spaced */
      .pdf-export .col-a,
      .pdf-export .col-match,
      .pdf-export .col-b {
        width: 15% !important;
        text-align: center !important;
        white-space: nowrap !important;
      }
    `;
  }

  injectStyles() {
    if (document.querySelector(`style[${this.styleAttr}]`)) return;
    const s = document.createElement('style');
    s.setAttribute(this.styleAttr, 'true');
    s.textContent = this.css;
    document.head.appendChild(s);
  }

  removeFlagColumn(table) {
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;

    const headers = [...headRow.children];
    const flagIndex = headers.findIndex(
      (th) => /^flag$/i.test((th.textContent || '').trim())
    );
    if (flagIndex > -1) {
      headRow.removeChild(headers[flagIndex]);
      table.querySelectorAll('tbody tr').forEach((tr) => {
        const cells = tr.children;
        if (cells[flagIndex]) tr.removeChild(cells[flagIndex]);
      });
    }
  }

  setColumnClasses(table) {
    const headerCells = [...table.querySelector('thead tr').children];
    headerCells.forEach((th) => {
      const name = (th.textContent || '').trim().toLowerCase();
      if (name === 'category') th.classList.add('col-category');
      if (name === 'partner a') th.classList.add('col-a');
      if (name === 'match') th.classList.add('col-match');
      if (name === 'partner b') th.classList.add('col-b');
    });

    table.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, i) => {
        const name = (headerCells[i].textContent || '').trim().toLowerCase();
        if (name === 'category') {
          td.classList.add('col-category');
          const fullText = td.textContent.trim();
          if (this.categoryShortMap[fullText]) {
            td.textContent = this.categoryShortMap[fullText];
          }
        }
        if (name === 'partner a') td.classList.add('col-a');
        if (name === 'match') td.classList.add('col-match');
        if (name === 'partner b') td.classList.add('col-b');
      });
    });
  }

  prepareClone() {
    const src = document.querySelector(this.containerSelector);
    if (!src) throw new Error(`${this.containerSelector} not found`);
    const clone = src.cloneNode(true);
    clone.classList.add('pdf-export');

    clone.querySelectorAll('table').forEach((table) => {
      this.removeFlagColumn(table);
      this.setColumnClasses(table);
    });

    return clone;
  }

  async generate() {
    const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    this.injectStyles();
    const clone = this.prepareClone();

    document.body.appendChild(clone);
    // Your existing html2canvas + jsPDF logic goes here.
    document.body.removeChild(clone);
  }
}

/* Usage:
const exporter = new CompatibilityPDFExporter('#pdf-container');
exporter.generate();
*/
