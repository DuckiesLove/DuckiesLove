const base = process.argv[2] || "https://talkkink.org";
const page = base.endsWith("/") ? base + "kinks/" : base + "/kinks/";
const targets = ["/css/style.css","/css/theme.css","/js/theme.js","/data/kinks.json"];
async function head(u){
  try{
    const r = await fetch(u, { cache:"no-store" });
    return { url:u, ok:r.ok, status:r.status, type:r.headers.get("content-type") || "" };
  }catch(e){ return { url:u, ok:false, status:"FETCH_FAIL", type:String(e) }; }
}
(async()=>{
  console.log("Checking:", page);
  const res = await Promise.all(targets.map(t => head(new URL(t, base).toString())));
  const pad = (s,n)=>String(s).padEnd(n);
  console.log(pad("STATUS",8), pad("OK",4), "URL", "TYPE");
  res.forEach(r => console.log(pad(r.status,8), pad(r.ok,4), r.url, r.type));
})();

