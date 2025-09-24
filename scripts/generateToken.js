// Proxy-aware token generator with offline fallback (no deps)
import crypto from "node:crypto";
import fs from "node:fs/promises";

let fetchFn = globalThis.fetch;
let dispatcher;
try {
  // Use Node's built-in undici (ships with Node >=18) to support proxies
  const undici = await import("undici");
  fetchFn = undici.fetch;
  const ProxyAgent = undici.ProxyAgent;
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
  dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
} catch { /* older Node: will use global fetch if available */ }

const REMOTE = process.env.GENERATE_TOKEN_URL || "";   // e.g., https://api.example.com/token
const ENV_KEY = process.env.TOKEN_ENV_KEY || "APP_TOKEN";
const OUT     = process.env.TOKEN_OUT || ".env";
const BYTES   = Number(process.env.TOKEN_BYTES || 32); // 32 bytes ≈ 43 chars base64url

async function tryRemote() {
  if (!REMOTE || !fetchFn) return null;
  const opts = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose: "site" }) };
  if (dispatcher) opts.dispatcher = dispatcher;
  const r = await fetchFn(REMOTE, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.token ?? data.access_token ?? null;
}

function makeLocal() {
  return crypto.randomBytes(BYTES).toString("base64url");
}

async function writeEnv(key, value, file) {
  let body = `${key}=${value}\n`;
  // append or create; de-dupe key if it already exists
  try {
    let cur = await fs.readFile(file, "utf8").catch(() => "");
    const has = new RegExp(`^${key}=.*$`, "m").test(cur);
    if (has) cur = cur.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
    else cur += body;
    await fs.writeFile(file, cur, "utf8");
  } catch {
    await fs.writeFile(file, body, "utf8");
  }
}

(async () => {
  let token = null;
  let reason = "";

  try {
    token = await tryRemote();
  } catch (e) {
    reason = String(e && e.message || e);
  }

  if (!token) {
    if (reason) {
      console.warn(`[generate-token] remote fetch failed: ${reason}`);
      console.warn(`[generate-token] likely causes: proxy blocking/403, DNS/TLS issues, or wrong GENERATE_TOKEN_URL`);
    }
    token = makeLocal();
    console.log("[generate-token] using offline token (crypto.randomBytes)");
  } else {
    console.log("[generate-token] received token from remote");
  }

  await writeEnv(ENV_KEY, token, OUT);
  console.log(`[generate-token] wrote ${ENV_KEY} to ${OUT}`);
  console.log(token); // also print to stdout for pipelines
})();
