# Talk Kink /kinks Diagnostics

## Summary
- The public dataset `https://talkkink.org/data/kinks.json` is not accessible; all standard fallback locations return either `403` errors or no response.
- Because the survey bootstrap requires that JSON payload, the Start Survey button remains disabled and the page never loads categories for unauthenticated visitors.
- Publishing `data/kinks.json` (or allowing it to return a 200 JSON payload) will restore the category loader; alternatively, adjust the CDN to avoid rewriting the path to an authenticated-only resource.

## Steps Performed
1. Ran the repository's diagnostic helper: `node scripts/reason-kinks-json.mjs`.
2. Observed the script probe `data/kinks.json` and its fallbacks at the production origin.

## Detailed Output
```
❌ No JSON endpoint returned 200. [
  { url: 'https://talkkink.org/data/kinks.json', status: 'FAIL' },
  { url: 'https://talkkink.org/kinks.json', status: 'FAIL' },
  { url: 'https://talkkink.org/data/kinks.json', status: 'FAIL' },
  { url: 'https://talkkink.org/kinks.json', status: 'FAIL' }
]
Likely: data/kinks.json not published or blocked by server.
```

The failures confirm that every candidate endpoint is blocked, so the front-end bootstrap script never receives the kink catalog that it needs to render the survey UI.
