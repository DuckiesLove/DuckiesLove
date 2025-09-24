import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILES = {
  html: ["kinks/index.html", "docs/kinks/index.html"],
  data: ["data/kinks.json", "docs/data/kinks.json"],
  css:  ["css/style.css","css/theme.css","docs/css/style.css","docs/css/theme.css"],
  js:   ["js/theme.js","docs/js/theme.js"]
};

const readFirst = async (candidates) => {
  for (const rel of candidates) {
    const p = path.join(ROOT, rel);
    if (fss.existsSync(p)) return { path: p, text: await fs.readFile(p, "utf8") };
  }
  return null;
};

const walk = async (dir, out=[]) => {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
};

const norm = (s) => String(s||"").trim().replace(/\s+/g," ").toLowerCase();

const countCheckboxes = (html) => {
  // crude but effective: count checkbox inputs in the left panel markup
  const re = /<input[^>]+type\s*=\s*["']checkbox["'][^>]*>/gi;
  return (html.match(re)||[]).length;
};

const startIsDisabled = (html) => {
  const m = html.match(/<button[^>]*>\s*Start\s+Survey\s*<\/button>/i);
  if (!m) return null; // not found
  const openTag = html.slice(0, html.indexOf(m[0])).split("<button").pop();
  return /disabled/i.test(openTag);
};

async function categoriesFromJSON(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);
    const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.kinks) ? parsed.kinks : []);
    const cats = new Set(arr.map(x => norm(x?.category ?? x?.cat)));
    cats.delete(""); // remove empties
    return { count: cats.size, names: [...cats] };
  } catch (e) {
    return { count: 0, names: [], parseError: e.message };
  }
}

async function main() {
  const html = await readFirst(FILES.html);
  const data = await readFirst(FILES.data);
  const css1 = await readFirst([FILES.css[0], FILES.css[2]]);
  const css2 = await readFirst([FILES.css[1], FILES.css[3]]);
  const jsTheme = await readFirst(FILES.js);

  const problems = [];
  const notes = [];

  if (!html) problems.push({ why: "kinks/index.html not found", fix: "Ensure /kinks/ exists in publish folder (root or docs/)." });
  if (!data) problems.push({ why: "data/kinks.json not found", fix: "Publish data/kinks.json alongside /kinks/." });
  if (!css1) problems.push({ why: "css/style.css missing", fix: "Publish css/style.css (or update <link> hrefs)." });
  if (!css2) problems.push({ why: "css/theme.css missing", fix: "Publish css/theme.css (or update <link> hrefs)." });
  if (!jsTheme) problems.push({ why: "js/theme.js missing", fix: "Publish js/theme.js (or update <script> src)." });

  // Early exit if core files are missing
  if (!html || !data) {
    console.log(JSON.stringify({ ok:false, problems, notes }, null, 2));
    process.exit(1);
  }

  // Dataset coverage vs UI
  const checkboxCount = countCheckboxes(html.text);
  const dataCats = await categoriesFromJSON(data.text);

  if (dataCats.parseError) {
    problems.push({ why: "kinks.json is not valid JSON", fix: `Fix JSON: ${dataCats.parseError}` });
  } else {
    // Heuristic: UI has many checkboxes; JSON only a few categories -> empty renders
    if (checkboxCount >= 10 && dataCats.count <= 3) {
      problems.push({
        why: `Dataset coverage too small: UI has ~${checkboxCount} category checkboxes but kinks.json only has ${dataCats.count} unique categories`,
        fix: "Publish the full dataset to data/kinks.json OR dim/disable categories not present (UX guard)."
      });
      notes.push({ datasetCategories: dataCats.names.slice(0, 10), totalDatasetCategories: dataCats.count });
    } else {
      notes.push({ datasetCategories: dataCats.names.slice(0, 10), totalDatasetCategories: dataCats.count, uiCheckboxes: checkboxCount });
    }
  }

  // Start button gating
  const startDisabled = startIsDisabled(html.text);
  if (startDisabled === true) {
    notes.push({ startButton: "disabled in HTML" });
  } else if (startDisabled === false) {
    notes.push({ startButton: "enabled in HTML" });
  }

  // Repo-wide hints: UNSQUISH spam / Service Worker
  const files = await walk(ROOT);
  const codeFiles = files.filter(p => /\.(js|mjs|ts|css|html)$/i.test(p));
  let hasUnsquish = false, hasSW = false;

  for (const p of codeFiles) {
    const t = await fs.readFile(p, "utf8").catch(()=>null);
    if (!t) continue;
    if (!hasUnsquish && /\[KINKS-UNSQUISH\]/.test(t)) hasUnsquish = true;
    if (!hasSW && /serviceWorker\s*\.\s*register\s*\(/i.test(t)) hasSW = true;
    if (hasUnsquish && hasSW) break;
  }

  if (hasUnsquish) {
    problems.push({
      why: "Debug logger '[KINKS-UNSQUISH]' present (can flood console and stall the tab)",
      fix: "Remove or gate the logger behind `if (DEBUG)` and strip in production; avoid tight RAF/interval loops."
    });
  }
  if (hasSW) {
    notes.push({ serviceWorker: "register() found" });
    problems.push({
      why: "Service Worker detected — stale caches can freeze or blank the page after deploys",
      fix: "Bump SW version on deploy and add a 'clear caches & reload' path; provide a one-click 'Reset' for users."
    });
  }

  // Asset references sanity
  const missingRefs = [];
  if (!/\/css\/style\.css/i.test(html.text)) missingRefs.push("link to /css/style.css");
  if (!/\/css\/theme\.css/i.test(html.text)) missingRefs.push("link to /css/theme.css");
  if (!/\/js\/theme\.js/i.test(html.text))   missingRefs.push("script to /js/theme.js");
  if (!/\/data\/kinks\.json/i.test(html.text)) missingRefs.push("fetch /data/kinks.json");
  if (missingRefs.length) {
    problems.push({
      why: "index.html may not reference core assets",
      fix: "Ensure <link>/<script> and the data fetch point at /css/*, /js/theme.js, /data/kinks.json.",
      refs: missingRefs
    });
  }

  const ok = problems.length === 0;
  console.log(JSON.stringify({ ok, problems, notes, filesChecked: { html: html.path, data: data.path } }, null, 2));
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
