;(function () {
  const LABEL_URL = '/data/kinks.json'
  let LABELS = {}
  let LABELS_LOADED = false

  const sleep = (ms=0) => new Promise(r => setTimeout(r, ms))

  async function loadLabels() {
    if (LABELS_LOADED) return LABELS
    try {
      const res = await fetch(LABEL_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error('labels 404')
      LABELS = await res.json()
      // normalize keys to lowercase for case-insensitive lookup
      const norm = {}
      Object.keys(LABELS).forEach(k => { norm[k.toLowerCase()] = LABELS[k] })
      LABELS = norm
      LABELS_LOADED = true
      console.info('[labels] loaded %d labels from %s', Object.keys(LABELS).length, LABEL_URL)
    } catch (e) {
      console.warn('[labels] failed to load', e)
      LABELS = {}
      LABELS_LOADED = true
    }
    return LABELS
  }

  function findCode(text) {
    // trim, collapse spaces, and match any cb_ + letters/numbers
    const t = (text || '').trim()
    const m = /^cb_[a-z0-9]+$/i.exec(t)
    return m ? m[0].toLowerCase() : null
  }

  function labelFor(code) {
    if (!code) return null
    return LABELS[code] || null
  }

  async function relabelTable($table) {
    await loadLabels()
    if (!$table) $table = document.querySelector('table')
    if (!$table) return

    const missing = new Set()
    const rows = Array.from($table.querySelectorAll('tbody tr, tr')).filter(r => r.children.length >= 1)

    // yield to avoid long-task jank on large tables
    for (let i = 0; i < rows.length; i++) {
      const cell = rows[i].children[0]
      if (!cell) continue
      const raw = cell.textContent.trim()
      const code = findCode(raw)
      if (code) {
        const pretty = labelFor(code)
        if (pretty) {
          cell.textContent = pretty
          cell.dataset.code = code
        } else {
          // keep original visible but track missing so user can fill later
          cell.dataset.code = code
          missing.add(code)
        }
      }
      if (i % 25 === 0) await sleep(0)
    }

    wireMissingPill(missing)
  }

  function wireMissingPill(missingSet) {
    // Create / update a pill the user can click to download missing keys
    let pill = document.querySelector('#tk-missing-pill')
    if (!pill) {
      pill = document.createElement('button')
      pill.id = 'tk-missing-pill'
      pill.textContent = 'Missing labels'
      pill.style.cssText = `
        position:fixed; right:16px; bottom:16px; z-index:99999;
        background:#001f26; color:#00e6ff; border:2px solid #00e6ff;
        padding:10px 14px; border-radius:12px; font-weight:700;
        box-shadow:0 0 12px rgba(0,230,255,.3); cursor:pointer;
      `
      pill.addEventListener('click', () => {
        const missing = collectMissing()
        const blob = new Blob([JSON.stringify(missing, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'missing-labels.json'
        document.body.appendChild(a); a.click(); a.remove()
      })
      document.body.appendChild(pill)
    }
    const count = (missingSet && missingSet.size) || Object.keys(collectMissing()).length
    pill.style.display = count ? 'inline-block' : 'none'
    pill.textContent = count ? `Missing labels (${count})` : 'Missing labels'
  }

  function collectMissing() {
    const out = {}
    document.querySelectorAll('td[data-code], th[data-code]').forEach(td => {
      const code = (td.getAttribute('data-code') || '').toLowerCase()
      if (code && !LABELS[code]) out[code] = ''
    })
    return out
  }

  // Public shim
  function label(code) {
    if (!code) return null
    const guess = findCode(code) || String(code || '').trim().toLowerCase()
    return LABELS[guess] || null
  }

  const api = {
    relabelTable,
    loadLabels,
    load: loadLabels,
    label
  }

  window.TK_LABELS = api
  window.TKLabels = api

  // Auto-run when the compatibility table is present
  document.addEventListener('DOMContentLoaded', () => {
    // First run soon after render…
    setTimeout(() => relabelTable(), 0)
    // …and run again after uploads complete (A/B loaded)
    window.addEventListener('tk:compat:table-ready', () => relabelTable())
  })
})()
