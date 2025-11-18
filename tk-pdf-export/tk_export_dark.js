import { readFile, writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { jsPDF } from "jspdf";

/*
USAGE EXAMPLES:
  # A) From an HTML file that already contains the table rows:
  node tk_export_dark.js --html compatibility.html --out compatibility-dark.pdf

  # B) From two survey JSON files (arrays or {items:[...]}) with {id|label, score}:
  node tk_export_dark.js --a partnerA.json --b partnerB.json --out compatibility-dark.pdf

  # C) From one combined JSON file:
  # { "partnerA":[...], "partnerB":[...] }
  node tk_export_dark.js --json combined.json --out compatibility-dark.pdf
*/

const args = parseArgs(process.argv.slice(2));
const TITLE = "Talk Kink • Compatibility Report";
const FILE  = args.out || "compatibility-dark.pdf";

// Layout constants (dark theme)
const GRID = 1.6;                // thick white borders
const FONT_SIZE = 11;
const LINE_H = 14;
const PAD_X = 6, PAD_Y = 8;
const MARGIN_LR = 30, TOP_Y = 70, BOTTOM = 40;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const key = k.replace(/^--/, "");
    const val = (i + 1 < argv.length && !argv[i + 1].startsWith("--")) ? argv[++i] : "true";
    out[key] = val;
  }
  return out;
}

// Helpers
const tidy = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const toNum = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const pctMatch = (a,b) => {
  if (a==null || b==null) return null;
  const p = Math.round(100 - (Math.abs(a-b)/5) * 100);
  return Math.max(0, Math.min(100, p));
};

function wrapToTwoLines(doc, text, maxWidth) {
  doc.setFontSize(FONT_SIZE);
  const raw = String(text ?? "");
  if (!raw) return ["—"];
  const words = raw.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (doc.getTextWidth(trial) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      else lines.push(w);
      cur = w;
    }
    if (lines.length === 2) break;
  }
  if (cur && lines.length < 2) lines.push(cur);
  if (!lines.length) lines.push("—");
  // ellipsis if truncated
  if ((lines.join(" ").length) < raw.length) {
    let last = lines[lines.length - 1];
    while (doc.getTextWidth(last + "…") > maxWidth && last.length) last = last.slice(0, -1);
    lines[lines.length - 1] = last + "…";
  }
  return lines.slice(0, 2);
}

function drawCell(doc, x, y, w, h, text, align) {
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(GRID);
  doc.rect(x, y, w, h); // stroke (page bg is black)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(FONT_SIZE);
  const innerW = w - PAD_X * 2;
  const lines = Array.isArray(text)
    ? text
    : (typeof text === "string" && text.includes("\n"))
      ? text.split("\n").slice(0, 2)
      : wrapToTwoLines(doc, text, innerW);
  const needed = Math.max(LINE_H, lines.length * LINE_H);
  let tx = x + PAD_X, ty = y + (h - needed) / 2 + LINE_H - 2;
  const opts = { baseline: "alphabetic" };
  if (align === "center") { tx = x + w / 2; opts.align = "center"; }
  if (align === "right")  { tx = x + w - PAD_X; opts.align = "right"; }
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], tx, ty + i * LINE_H, opts);
  }
}

function computeLayout(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - MARGIN_LR * 2;
  const A = 80, M = 90, B = 80;                 // numeric columns
  const Cat = Math.max(220, usable - (A + M + B)); // category gets the rest
  return { Cat, A, M, B, pageW };
}

// Source A: parse rows from HTML file containing the table
async function rowsFromHTMLFile(path) {
  const html = await readFile(path, "utf8");
  const dom = new JSDOM(html);
  const d = dom.window.document;
  const out = [];
  for (const tb of d.querySelectorAll("tbody")) {
    for (const tr of tb.querySelectorAll("tr")) {
      const tds = [...tr.querySelectorAll("td")];
      if (!tds.length) continue;
      const aCell = tr.querySelector('td[data-cell="A"]');
      const bCell = tr.querySelector('td[data-cell="B"]');
      const category = tidy(tds[0]?.textContent) || tr.getAttribute("data-kink-id") || "";
      const aTxt = tidy((aCell ? aCell.textContent : tds[1]?.textContent) || "");
      const bTxt = tidy((bCell ? bCell.textContent : tds[tds.length - 1]?.textContent) || "");
      if (!category && !aTxt && !bTxt) continue;
      const A = toNum(aTxt), B = toNum(bTxt);
      const pctCell = tds.map(td => tidy(td.textContent)).find(t => /%$/.test(t));
      const P = pctCell ? pctCell : (() => { const p = pctMatch(A, B); return p == null ? "—" : (p + "%"); })();
      out.push([category || "—", (A == null ? "—" : A), P, (B == null ? "—" : B)]);
    }
  }
  return out;
}

// Source B: two survey JSON files (each array or {items:[...]})
async function rowsFromSurveyFiles(pathA, pathB) {
  const parse = async (p) => JSON.parse(await readFile(p, "utf8"));
  const A = pathA ? await parse(pathA) : null;
  const B = pathB ? await parse(pathB) : null;

  const arrA = Array.isArray(A) ? A : (A?.items || []);
  const arrB = Array.isArray(B) ? B : (B?.items || []);

  const mapA = new Map(arrA.map(i => [(i.id || i.label), i]));
  const mapB = new Map(arrB.map(i => [(i.id || i.label), i]));
  const keys = new Map();
  arrA.forEach(i => keys.set(i.id || i.label, i.label || i.id));
  arrB.forEach(i => keys.set(i.id || i.label, i.label || i.id));

  const out = [];
  for (const [id, label] of keys) {
    const a = mapA.get(id), b = mapB.get(id);
    const Av = toNum(a?.score), Bv = toNum(b?.score);
    const p = pctMatch(Av, Bv);
    out.push([label || id || "—", (Av == null ? "—" : Av), (p == null ? "—" : (p + "%")), (Bv == null ? "—" : Bv)]);
  }
  return out;
}

// Source C: combined JSON { partnerA:[...], partnerB:[...] }
async function rowsFromCombinedJSON(path) {
  const obj = JSON.parse(await readFile(path, "utf8"));
  const A = Array.isArray(obj?.partnerA) ? obj.partnerA : [];
  const B = Array.isArray(obj?.partnerB) ? obj.partnerB : [];

  const mapA = new Map(A.map(i => [(i.id || i.label), i]));
  const mapB = new Map(B.map(i => [(i.id || i.label), i]));
  const keys = new Map();
  A.forEach(i => keys.set(i.id || i.label, i.label || i.id));
  B.forEach(i => keys.set(i.id || i.label, i.label || i.id));

  const out = [];
  for (const [id, label] of keys) {
    const a = mapA.get(id), b = mapB.get(id);
    const Av = toNum(a?.score), Bv = toNum(b?.score);
    const p = pctMatch(Av, Bv);
    out.push([label || id || "—", (Av == null ? "—" : Av), (p == null ? "—" : (p + "%")), (Bv == null ? "—" : Bv)]);
  }
  return out;
}

// MAIN
async function main() {
  let rows = [];
  if (args.html) {
    rows = await rowsFromHTMLFile(args.html);
  } else if (args.a || args.b) {
    rows = await rowsFromSurveyFiles(args.a, args.b);
  } else if (args.json) {
    rows = await rowsFromCombinedJSON(args.json);
  } else {
    console.error("No input provided.\nUse --html file.html OR --a A.json --b B.json OR --json combined.json");
    process.exit(1);
  }

  if (!rows.length) {
    console.error("No rows found to export.");
    process.exit(2);
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const { Cat, A, M, B, pageW } = computeLayout(doc);
  const pageH = doc.internal.pageSize.getHeight();
  const generatedStamp = `Generated: ${new Date().toLocaleString()}`;

  const paintBg = () => {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, pageH, "F"); // full black
    doc.setTextColor(255, 255, 255);
  };

  const drawTitleBlock = () => {
    doc.setFontSize(28);
    doc.text(TITLE, pageW / 2, 48, { align: "center" });
    doc.setFontSize(12);
    doc.text(generatedStamp, pageW / 2, 68, { align: "center" });
    doc.setFontSize(28);
  };

  // Title + first page
  paintBg();
  drawTitleBlock();

  const x0 = MARGIN_LR;
  let y = TOP_Y;

  function newPageIfNeeded(h) {
    if (y + h + BOTTOM > pageH) {
      doc.addPage();
      paintBg();
      drawTitleBlock();
      y = TOP_Y;
      drawHeader();
    }
  }

  function drawHeader() {
    const h = PAD_Y * 2 + LINE_H;
    let x = x0;
    drawCell(doc, x, y, Cat, h, "Category", "center"); x += Cat;
    drawCell(doc, x, y, A,   h, "Partner A", "center"); x += A;
    drawCell(doc, x, y, M,   h, "Match %",   "center"); x += M;
    drawCell(doc, x, y, B,   h, "Partner B", "center");
    y += h;
  }

  drawHeader();

  for (const [category, a, pct, b] of rows) {
    const catLines = wrapToTwoLines(doc, category, Cat - PAD_X * 2);
    const rowH = Math.max(PAD_Y * 2 + catLines.length * LINE_H, PAD_Y * 2 + LINE_H);
    newPageIfNeeded(rowH);
    let x = x0;
    drawCell(doc, x, y, Cat, rowH, catLines, "center"); x += Cat;
    drawCell(doc, x, y, A,   rowH, String(a ?? "—"), "center"); x += A;
    drawCell(doc, x, y, M,   rowH, String(pct ?? "—"), "center"); x += M;
    drawCell(doc, x, y, B,   rowH, String(b ?? "—"), "center");
    y += rowH;
  }

  const pdf = doc.output("arraybuffer");
  await writeFile(FILE, Buffer.from(pdf));
  console.log("✔ Wrote", FILE);
}

main().catch(err => {
  console.error("Export failed:", err);
  process.exit(3);
});

