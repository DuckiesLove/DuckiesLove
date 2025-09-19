const base = (process.argv[2] || "https://talkkink.org").replace(/\/+$/,"");
const stamp = Date.now();
const urls = [
  `${base}/kinks/`,
  `${base}/css/style.css?v=${stamp}`,
  `${base}/css/theme.css?v=${stamp}`,
  `${base}/js/theme.js?v=${stamp}`,
  `${base}/data/kinks.json?v=${stamp}`
];

async function check(u){
  try{
    const r = await fetch(u, { cache: "no-store" });
    return { url: u, status: r.status, ok: r.ok, type: r.headers.get("content-type") || "" };
  }catch(e){
    return { url: u, status: "FETCH_FAIL", ok: false, type: String(e) };
  }
}

(async () => {
  const results = await Promise.all(urls.map(check));
  const pad = (s,n)=>String(s).padEnd(n);
  console.log("Checking", base);
  console.log(pad("STATUS",10), pad("OK",4), pad("TYPE",24), "URL");
  for (const r of results) console.log(pad(r.status,10), pad(r.ok,4), pad(r.type,24), r.url);
  // helper: print a hint if /kinks/ HTML doesn’t include the hotfix markers
  try{
    const html = await (await fetch(`${base}/kinks/?t=${stamp}`, { cache: "no-store" })).text();
    const hasBase = /<base href="\/"/i.test(html);
    const hasHotfix = /TK-HOTFIX/.test(html);
    console.log("\nHotfix markers — base tag:", hasBase, "hotfix blocks:", hasHotfix);
  }catch{}
})();
