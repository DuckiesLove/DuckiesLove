const BASE = process.env.KINKS_BASE || "https://talkkink.org";
const url = (p) => new URL(p, BASE).toString();
const targets = ["/kinks/","/css/style.css","/css/theme.css","/js/theme.js","/data/kinks.json"];

async function probe(u){
  try{
    const r = await fetch(u, { cache: "no-store" });
    return { url: u, ok: r.ok, status: r.status, type: r.headers.get("content-type") || "" };
  }catch(e){
    return { url: u, ok: false, status: "FAIL", type: String(e) };
  }
}

(async ()=>{
  const out = [];
  for (const p of targets) out.push(await probe(url(p)));
  const pad = (s,n)=>String(s).padEnd(n);
  console.log(pad("STATUS",8), pad("OK",5), pad("TYPE",24), "URL");
  out.forEach(r => console.log(pad(r.status,8), pad(r.ok,5), pad(r.type,24), r.url));
  const bad = out.filter(r=>r.status!==200 && r.status!=="200");
  process.exit(bad.length?1:0);
})();
