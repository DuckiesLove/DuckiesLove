/* ==========================================
   TalkKink Compatibility – JSON upload glue
   Accepts the JSON file exported by TKDownload
   (schema: "talkkink.v2") and a few legacy shapes.
   Stores normalized payloads to localStorage for
   the comparison + PDF steps.
========================================== */

(function () {
  const defaults = {
    btnSelf: '#btnUploadSelf',
    btnPartner: '#btnUploadPartner',
    btnPdf: '#btnDownloadPdf',
    selfInput: null,
    partnerInput: null,
    lsSelfKey: 'tk_compat.self',
    lsPartKey: 'tk_compat.partner',
    guardPdf: true,
    autoInit: true,
  };

  const overrides = (typeof window !== 'undefined' && window.TK_COMPAT_UPLOAD_CFG) || {};
  const cfg = Object.assign({}, defaults, overrides);

  if (cfg.autoInit === false) {
    if (typeof console !== 'undefined' && console.info) {
      console.info('[compat] upload glue disabled via config');
    }
    return;
  }

  // ---- Helpers -------------------------------------------------------------

  function log(...args) {
    console.log('[compat]', ...args);
  }

  function showToast(msg, type = 'info') {
    log(`${type.toUpperCase()}: ${msg}`);
    // (Optional) Wire this to your UI toast if you have one.
  }

  function pick(obj, keys) {
    const out = {};
    keys.forEach(k => { if (obj && k in obj) out[k] = obj[k]; });
    return out;
  }

  function coerceToArraySelectors(selectors) {
    if (!selectors) return [];
    if (Array.isArray(selectors)) return selectors;
    return String(selectors).split(',').map(s => s.trim()).filter(Boolean);
  }

  function firstMatch(selectors, root = document) {
    for (const selector of coerceToArraySelectors(selectors)) {
      const node = root.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  // Build a compact, side-indexed map by kinkId
  // { "<kinkId>": { giving: n?, receiving: n?, general: n? } }
  function toByKinkMap(enrichedAnswers) {
    const by = {};
    (enrichedAnswers || []).forEach(a => {
      const k = String(a.kinkId);
      if (!by[k]) by[k] = {};
      const side = (a.side || 'general').toLowerCase();
      by[k][side] = Number(a.score);
    });
    return by;
  }

  // ---- Normalizers ---------------------------------------------------------

  // v2 (recommended): { schema: 'talkkink.v2', answers: [{kinkId, title?, side, score, categoryId?, category?}], ... }
  function normalizeV2(payload) {
    if (!Array.isArray(payload.answers)) throw new Error('No answers[] in v2 payload');
    const answers = payload.answers.map(a => ({
      kinkId: String(a.kinkId),
      side:   String(a.side || 'general'),
      score:  Number(a.score),
      // keep readable fields if present
      title:      a.title ?? null,
      categoryId: a.categoryId ?? null,
      category:   a.category ?? null,
    }));
    return {
      schema: 'talkkink.v2',
      meta: pick(payload, ['exportedAt', 'surveyTitle', 'theme', 'selectedCategories']),
      answers,
      byKink: toByKinkMap(answers)
    };
  }

  // Legacy: { answers: [{kinkId/ id, side/ channel, score/ value}] }
  function normalizeLegacyAnswersArray(payload) {
    const arr = Array.isArray(payload.answers) ? payload.answers
              : Array.isArray(payload) ? payload
              : null;
    if (!arr) return null;

    const answers = arr.map(x => ({
      kinkId: String(x.kinkId ?? x.id),
      side:   String(x.side ?? x.channel ?? 'general'),
      score:  Number(x.score ?? x.value ?? 0),
      title:  x.title ?? null,
      categoryId: x.categoryId ?? null,
      category:   x.category ?? null
    }));
    return {
      schema: 'talkkink.v2',
      meta: pick(payload, ['exportedAt','surveyTitle','theme','selectedCategories']),
      answers,
      byKink: toByKinkMap(answers)
    };
  }

  // Legacy: { byKinkId: { "<id>": { giving, receiving, general } } }
  function normalizeLegacyByKink(payload) {
    const src = payload.byKinkId || payload.byKink || null;
    if (!src || typeof src !== 'object') return null;

    const answers = [];
    for (const [kinkId, sides] of Object.entries(src)) {
      for (const [side, val] of Object.entries(sides || {})) {
        if (val !== null && val !== undefined && val !== '') {
          answers.push({ kinkId: String(kinkId), side: String(side), score: Number(val) });
        }
      }
    }
    return {
      schema: 'talkkink.v2',
      meta: pick(payload, ['exportedAt','surveyTitle','theme','selectedCategories']),
      answers,
      byKink: toByKinkMap(answers)
    };
  }

  function normalizePayload(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Invalid file content');

    // v2 happy path
    if (typeof obj.schema === 'string' && obj.schema.toLowerCase().startsWith('talkkink')) {
      return normalizeV2(obj);
    }

    // legacy fallbacks
    const fromArr = normalizeLegacyAnswersArray(obj);
    if (fromArr) return fromArr;

    const fromMap = normalizeLegacyByKink(obj);
    if (fromMap) return fromMap;

    throw new Error('Unsupported survey format');
  }

  // ---- File selection + wiring --------------------------------------------

  function ensureInput(button, providedSelectors) {
    const direct = firstMatch(providedSelectors);
    if (direct && direct.tagName === 'INPUT' && direct.type === 'file') {
      return direct;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.style.display = 'none';

    const host = button?.parentElement || document.body;
    host.insertAdjacentElement('beforeend', input);
    return input;
  }

  function attachFileHandler(buttonSelectors, inputSelectors, onLoaded) {
    const btn = firstMatch(buttonSelectors);
    if (!btn) {
      console.warn('[compat] Missing button:', buttonSelectors);
      return;
    }
    const input = ensureInput(btn, inputSelectors);

    const controlsInputNatively =
      btn.tagName === 'LABEL' &&
      Boolean(btn.htmlFor) &&
      Boolean(input?.id) &&
      btn.htmlFor === input.id;

    if (btn.tagName !== 'INPUT' && !controlsInputNatively) {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        input.click();
      });
    }

    if (onLoaded === savePartner && input) {
      input.setAttribute('data-partner-upload', '');
      if (!input.id) input.id = 'partnerFile';
    }

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      if (onLoaded === savePartner) {
        let ok = true;
        if (typeof window.tkConfirmPartnerConsent === 'function') {
          try {
            ok = await window.tkConfirmPartnerConsent();
          } catch (err) {
            console.error('[compat] partner consent check failed:', err);
            ok = false;
          }
        } else {
          ok = window.confirm(
            'Before importing a partner\'s survey, confirm you have their explicit consent to upload and compare their responses here.\n\nClick "OK" to confirm consent and continue, or "Cancel" to stop.'
          );
        }

        if (!ok) {
          input.value = '';
          return;
        }
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(reader.result);
          const norm = normalizePayload(raw);
          onLoaded(norm, file.name);
        } catch (err) {
          console.error('[compat] Failed parsing file:', err);
          showToast('Could not read that file. Is it a TalkKink survey export?', 'error');
        } finally {
          input.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  // ---- Persist + enable next steps ----------------------------------------

  function saveSelf(norm) {
    localStorage.setItem(cfg.lsSelfKey, JSON.stringify(norm));
    showToast('Your survey loaded!');
    log('Self survey:', norm);
    document.dispatchEvent(new CustomEvent('tk-compat-upload', { detail: { who: 'self', data: norm } }));
  }

  function savePartner(norm) {
    localStorage.setItem(cfg.lsPartKey, JSON.stringify(norm));
    showToast("Partner's survey loaded!");
    log('Partner survey:', norm);
    document.dispatchEvent(new CustomEvent('tk-compat-upload', { detail: { who: 'partner', data: norm } }));
  }

  // Optional: gently validate that both are present before allowing PDF
  function canGenerate() {
    return !!(localStorage.getItem(cfg.lsSelfKey) && localStorage.getItem(cfg.lsPartKey));
  }

  function wirePdfButton() {
    if (!cfg.guardPdf) return;
    const btn = firstMatch(cfg.btnPdf);
    if (!btn) return;
    if (btn.dataset.tkCompatGuarded === '1') return;
    btn.dataset.tkCompatGuarded = '1';

    btn.addEventListener('click', () => {
      if (!canGenerate()) {
        showToast('Upload both surveys first.', 'warn');
      }
    });
  }

  // ---- Init ----------------------------------------------------------------

  function init() {
    attachFileHandler(cfg.btnSelf, cfg.selfInput, saveSelf);
    attachFileHandler(cfg.btnPartner, cfg.partnerInput, savePartner);
    wirePdfButton();
    log('upload glue ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
