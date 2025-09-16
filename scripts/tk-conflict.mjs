// scripts/tk-conflict.mjs
// Usage (from repo root):
//   node scripts/tk-conflict.mjs                 # check only (exit 1 if markers found)
//   node scripts/tk-conflict.mjs --fix=head      # auto-fix by keeping HEAD side
//   node scripts/tk-conflict.mjs --fix=incoming  # auto-fix by keeping incoming side
//   node scripts/tk-conflict.mjs --fix=head --bump-sw=service-worker.js
//
// Notes:
// - Scans text files (html, htm, js, jsx, ts, tsx, css, json, md).
// - Skips node_modules, .git, build dirs (dist, build, .next, out).
// - Exits non-zero if problems found or an error occurs.

import fs from "node:fs/promises";
import path from "node:path";

const argv = new Map(process.argv.slice(2).map(a => {
  const [k,v] = a.split("=");
  return [k.replace(/^--/,""), v ?? true];
}));
const FIX = argv.get("fix"); // undefined | "head" | "incoming"
const BUMP_SW = argv.get("bump-sw"); // e.g., "service-worker.js"

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "out", ".cache"]);
const EXTS = new Set(["html","htm","js","jsx","ts","tsx","css","json","md"]);
const TEXT_MAX = 5 * 1024 * 1024; // 5MB safety cap

let foundTotal = 0;
let fixedTotal = 0;
let filesWithConflicts = [];

async function walk(dir, acc=[]) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    if (e.name.startsWith(".")) {
      const isAllowedHidden =
        e.name === ".well-known" ||
        e.name === ".htaccess" ||
        e.name === ".env" ||
        e.name.startsWith(".env.");
      if (!isAllowedHidden) {
        continue; // skip hidden folder/file; still allow .well-known & .env variants
      }
    }
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(path.join(dir, e.name), acc);
    } else if (e.isFile()) {
      const ext = e.name.split(".").pop()?.toLowerCase() || "";
      if (!EXTS.has(ext)) continue;
      acc.push(path.join(dir, e.name));
    }
  }
  return acc;
}

function conflictRegex() {
  // Handles Windows/Unix line endings, captures both sides.
  // Greedy enough to handle multiple conflicts per file safely.
  return /<<<<<<<[^\n\r]*\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>>[^\n\r]*\r?\n?/g;
}

function resolveConflicts(src, keep) {
  const re = conflictRegex();
  let m, changes = 0;
  let out = "";
  let lastIndex = 0;

  while ((m = re.exec(src))) {
    changes++;
    out += src.slice(lastIndex, m.index);
    const left = m[1];   // HEAD side
    const right = m[2];  // incoming side
    out += (keep === "incoming") ? right : left; // default to HEAD if keep invalid
    lastIndex = re.lastIndex;
  }
  out += src.slice(lastIndex);
  return { text: out, changes };
}

function lineNumbersForMarkers(src) {
  const lines = [];
  let i = 0, idx = 0;
  while (true) {
    const next = src.indexOf("\n", idx);
    const line = src.slice(idx, next === -1 ? src.length : next);
    if (line.startsWith("<<<<<<<") || line === "=======" || line.startsWith(">>>>>>>")) {
      lines.push(i + 1);
    }
    if (next === -1) break;
    idx = next + 1; i++;
  }
  return lines;
}

async function processFile(fp) {
  try {
    const stat = await fs.stat(fp);
    if (stat.size > TEXT_MAX) return { fp, skipped: true };
    const raw = await fs.readFile(fp, "utf8");
    const hasConflict = /<<<<<<<|=======|>>>>>>>/.test(raw);
    if (!hasConflict) return { fp, conflicts: 0 };

    // Confirm they’re real conflict markers (not code blocks) by full pattern:
    const re = conflictRegex();
    if (!re.test(raw)) return { fp, conflicts: 0 }; // ignore stray strings

    // Collect line numbers for visibility
    const lines = lineNumbersForMarkers(raw);
    foundTotal++;
    filesWithConflicts.push({ fp, lines });

    if (FIX === "head" || FIX === "incoming") {
      const { text, changes } = resolveConflicts(raw, FIX);
      await fs.writeFile(fp, text, "utf8");
      fixedTotal += changes;
      return { fp, conflicts: changes, fixed: true, keep: FIX, lines };
    } else {
      return { fp, conflicts: lines.length, fixed: false, lines };
    }
  } catch (e) {
    console.error("Error reading:", fp, e.message);
    return { fp, error: e.message };
  }
}

async function bumpServiceWorkerVersion(swPathRel) {
  const swPath = path.resolve(ROOT, swPathRel);
  try {
    const src = await fs.readFile(swPath, "utf8");
    const stamp = new Date().toISOString().replace(/[:.TZ-]/g, "");
    const re = /(const|let|var)\s+VERSION\s*=\s*["'`](.*?)["'`]\s*;/;
    let out, changed = false;

    if (re.test(src)) {
      out = src.replace(re, ($0, kw, old) => {
        changed = true;
        return `${kw} VERSION = "${stamp}";`;
      });
    } else {
      // Fallback: append a VERSION define (top of file)
      out = `const VERSION = "${stamp}";\n` + src;
      changed = true;
    }

    if (changed) {
      await fs.writeFile(swPath, out, "utf8");
      console.log(`SW version bumped in ${swPathRel} → ${stamp}`);
    } else {
      console.log(`SW version not changed (pattern not found) in ${swPathRel}`);
    }
  } catch (e) {
    console.warn(`Skip SW bump (${swPathRel}): ${e.message}`);
  }
}

async function main() {
  const files = await walk(ROOT);
  const results = [];
  for (const f of files) results.push(await processFile(f));

  const hasConflicts = filesWithConflicts.length > 0;

  if (hasConflicts) {
    console.log("\n⚠️  Merge conflict markers detected in:");
    for (const { fp, lines } of filesWithConflicts) {
      console.log(`  - ${path.relative(ROOT, fp)}  lines: ${lines.join(", ")}`);
    }
  }

  if (FIX && hasConflicts) {
    console.log(`\n✅ Auto-fix applied, keep="${FIX}"  (replaced ${fixedTotal} conflict block(s)).`);
    if (BUMP_SW) {
      await bumpServiceWorkerVersion(BUMP_SW);
      console.log("ℹ️  Remember to rebuild and deploy so clients fetch fresh HTML/JS.");
    }
    console.log("\nDone.");
    process.exit(0);
  }

  if (hasConflicts) {
    console.error("\n❌ Conflict markers remain. Re-run with --fix=head or --fix=incoming (review before committing).");
    process.exit(1);
  } else {
    console.log("✅ No merge conflict markers found.");
    process.exit(0);
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(2); });
