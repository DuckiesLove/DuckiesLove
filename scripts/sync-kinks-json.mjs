// Ensure the kink dataset is present at all URLs the /kinks page will try.
// Usage: node scripts/sync-kinks-json.mjs
import { promises as fs } from "fs";
import path from "path";

const repoRoot = process.cwd();
const src = path.join(repoRoot, "data", "kinks.json");

const targets = [
  // site root fallbacks used by the client
  path.join(repoRoot, "kinks.json"),
  path.join(repoRoot, "data", "kinks.json"),

  // GitHub Pages when publishing from /docs (both forms)
  path.join(repoRoot, "docs", "kinks.json"),
  path.join(repoRoot, "docs", "data", "kinks.json"),
  path.join(repoRoot, "docs", "kinks", "data", "kinks.json"),
];

async function ensureDir(p) { await fs.mkdir(path.dirname(p), { recursive: true }); }

async function main() {
  try {
    const buf = await fs.readFile(src);
    const pretty = JSON.stringify(JSON.parse(buf.toString()), null, 2); // validate & normalize
    let wrote = 0;
    for (const t of targets) {
      await ensureDir(t);
      await fs.writeFile(t, pretty + "\n");
      wrote++;
    }
    console.log(`✅ Synced kinks dataset to ${wrote} locations.`);
    console.log("   Source:", src);
    targets.forEach(t => console.log("   →", path.relative(repoRoot, t)));
  } catch (e) {
    console.error("❌ Could not sync dataset:", e?.message || e);
    console.error("Hint: generate it first with:  node scripts/generate-kinks-data.mjs");
    process.exit(1);
  }
}
main();

