// Diagnose why /kinks/ won't render: missing JSON vs HTML rewrite (Node 18+)
const baseArg = process.argv[2];
const BASE = baseArg || process.env.KINKS_BASE || "https://talkkink.org";
const paths = ["/data/kinks.json","/kinks.json","./data/kinks.json","./kinks.json"];

const urlOf = p => new URL(p, BASE).toString();
const looksHTML = (ct, body) =>
  /text\/html/i.test(ct||"") || /^\s*<!doctype html/i.test(body||"") || /<html[\s>]/i.test(body||"");

async function probe(u) {
  try {
    const r = await fetch(u, { cache: "no-store" });
    const ct = r.headers.get("content-type") || "";
    const body = await r.text();
    return { url: u, ok: r.ok, status: r.status, ct, html: looksHTML(ct, body), len: body.length };
  } catch (e) {
    return { url: u, ok: false, status: "FAIL", ct: "", html: false, err: String(e) };
  }
}

(async () => {
  const results = [];
  const seen = new Set();
  for (const p of paths) {
    const url = urlOf(p);
    if (seen.has(url)) continue;
    seen.add(url);
    results.push(await probe(url));
  }

  console.error(`ℹ️ Checking JSON endpoints for ${BASE}`);

  // nothing reachable
  const ok200 = results.filter(r => r.ok);
  if (ok200.length === 0) {
    console.error("❌ No JSON endpoint returned 200.");
    for (const r of results) {
      const detail = r.err ? ` (${r.err})` : "";
      console.error(`   • ${r.url} → ${r.status}${detail}`);
    }
    console.error("Likely: data/kinks.json is unpublished, blocked by the server, or the domain is unreachable.");
    process.exit(1);
  }

  // first 200 that is actually HTML (rewrite)
  const html200 = ok200.find(r => r.html);
  if (html200) {
    console.error(`❌ ${html200.url} returned HTML (${html200.ct||"text/html"}) with status ${html200.status}.`);
    console.error("Reason: server rewrites missing JSON to an HTML fallback (e.g., compatibility page).");
    console.error("Fix: publish data/kinks.json and/or exempt /data/ from rewrites so missing files 404.");
    process.exit(1);
  }

  // good: try to parse JSON
  const good = ok200[0];
  try {
    const r = await fetch(good.url, { cache: "no-store" });
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j && Array.isArray(j.kinks) ? j.kinks : []);
    console.log(`✅ OK: ${good.url} (${good.ct||"application/json"}), items: ${Array.isArray(arr) ? arr.length : "unknown"}`);
    process.exit(0);
  } catch (e) {
    console.error(`❌ ${good.url} claimed JSON but did not parse: ${String(e)}`);
    process.exit(1);
  }
})();
