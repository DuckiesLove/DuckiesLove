const BASE = process.env.KINKS_BASE || "https://talkkink.org";
const U = p => new URL(p, BASE).toString();
const targets = ["/kinks/","/css/style.css","/css/theme.css","/js/theme.js","/data/kinks.json"];
async function head(u){
  try{ const r = await fetch(u,{method:"HEAD"}); return {u, ok:r.ok, s:r.status}; }
  catch(e){ return {u, ok:false, s:"FAIL"}; }
}
(async()=>{
  const rows = await Promise.all(targets.map(p=>head(U(p))));
  console.log("STATUS  OK   URL");
  for (const r of rows) console.log(String(r.s).padEnd(7), String(r.ok).padEnd(5), r.u);
  const liveOK = rows[0].s===200 || rows[0].s==="200";
  // Return JSON for the wrapper
  console.log(JSON.stringify({liveOK, rows}, null, 2));
})();
