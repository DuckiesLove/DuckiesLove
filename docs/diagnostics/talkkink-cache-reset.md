# Talk Kink Hard Cache Reset

When a Talk Kink page keeps serving stale assets, paste the snippet below into the
DevTools console. It clears all Service Workers, Cache API entries, and the
`tk.ver` localStorage markers before reloading the current route with a
`?tkreset=1` query so the runtime performs a full bootstrap.

```html
<!-- TalkKink hard cache reset helper -->
<script>
(async () => {
  sessionStorage.setItem('tkreset', '1');

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) { try { await r.unregister(); } catch(e){} }
  }

  if (window.caches) {
    const keys = await caches.keys();
    for (const k of keys) { try { await caches.delete(k); } catch(e){} }
  }

  localStorage.removeItem('tk.ver');
  localStorage.removeItem('tk.ver.seen');

  location.replace(location.pathname + '?tkreset=1');
})();
</script>
```

Run it once per origin when asking browsers to distrust existing SW- or
Cache-backed bundles. It mirrors the behaviour of our production cache busters
but works even when an old Service Worker is stuck.
