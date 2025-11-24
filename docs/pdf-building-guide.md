# Compatibility PDF Builder: Quick Sharing Guide

If you need to show a teammate where the compatibility PDF export lives, share these entry points:

## Frontend entry point
- **`auto-pdf.html`** wires the upload buttons, the PDF container, and the jsPDF CDN fallbacks. It bootstraps the UI and attaches `js/auto-pdf.js` plus the jsPDF/autoTable loaders required for exports.【F:auto-pdf.html†L6-L181】

## Core logic
- **`js/auto-pdf.js`** is the client controller. It parses the uploaded survey JSON, normalizes ratings, merges with the template, and invokes `generateCompatibilityPDF` once both surveys are ready.【F:js/auto-pdf.js†L1-L200】
- **`js/compatibilityPdf.js`** exposes the PDF generator used in the standalone page by re-exporting the implementation from the shared `docs/kinks` bundle.【F:js/compatibilityPdf.js†L1-L13】
- **`docs/kinks/js/compatibilityPdf.js`** contains the actual PDF layout logic (font setup, data sanitation, and doc creation). Share this if someone wants to customize the PDF output directly.【F:docs/kinks/js/compatibilityPdf.js†L1-L160】

## Running locally
1. Install dependencies and start the static server:
   - `npm install`
   - `npm start` (serves the project from `server.js`).
2. Open `http://localhost:3000/auto-pdf.html` in a browser.
3. Upload your survey JSON and your partner’s survey JSON; the Download PDF button enables once both files load.

That’s everything your friend needs to explore or reuse the PDF builder.
