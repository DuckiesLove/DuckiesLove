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

  function emitUploadEvent(who, detail = {}) {
    if (!who) return;
    document.dispatchEvent(
      new CustomEvent('tk-compat-upload', {
        detail: Object.assign({ who }, detail)
      })
    );
  }

  function emitUploadError(who, reason, error) {
    if (!who) return;
    const detail = { who, reason: reason || 'Could not read that file.' };
    if (error) detail.error = error;
    document.dispatchEvent(new CustomEvent('tk-compat-upload-error', { detail }));
  }

  function pick(obj, keys) {
    const out = {};
    keys.forEach(k => { if (obj && k in obj) out[k] = obj[k]; });
    return out;
  }

  function coerceScore(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    if (num < 0) return 0;
    if (num > 5) return 5;
    return num;
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

  function persistLegacyPayload(who, rawPayload) {
    if (!rawPayload || typeof rawPayload !== 'object') return;

    let serialized;
    try {
      serialized = JSON.stringify(rawPayload);
    } catch (err) {
      console.warn('[compat] unable to serialize survey payload for legacy consumers', err);
      return;
    }

    const targets = who === 'partner'
      ? ['talkkink:partner']
      : ['talkkink:survey', 'talkkink:mine'];

    targets.forEach((key) => {
      try {
        localStorage.setItem(key, serialized);
      } catch (err) {
        console.warn('[compat] unable to persist survey payload', err);
      }
    });

    if (who === 'partner') {
      window.talkkinkPartner = rawPayload;
    } else {
      window.talkkinkMine = rawPayload;
      window.talkkinkSurvey = rawPayload;
    }
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

  function normalizeTalkkinkExport(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const format = String(payload.format || payload.schema || '').toLowerCase();
    if (format && !format.includes('talkkink')) return null;

    const fromItems = Array.isArray(payload.items) ? payload.items : null;
    const mapSources = [
      payload.answers,
      payload.answersById,
      payload.answersByKey,
      payload.map,
      payload.ratings,
      payload.scores
    ];
    const answers = [];

    const meta = pick(payload, [
      'generatedAt',
      'exportedAt',
      'surveyTitle',
      'title',
      'theme',
      'selectedCategories',
      'stamp',
      'counts',
      'context',
      'source'
    ]);

    if (!meta.exportedAt && meta.generatedAt) meta.exportedAt = meta.generatedAt;
    if (!meta.surveyTitle && meta.title) meta.surveyTitle = meta.title;
    if (!meta.surveyTitle && typeof meta.source === 'object') {
      meta.surveyTitle = meta.surveyTitle || meta.source?.title || meta.source?.name || null;
    }

    const pushAnswer = (entry, fallbackScore) => {
      if (!entry || typeof entry !== 'object') return;
      const kinkId = entry.kinkId ?? entry.id ?? entry.key ?? entry.slug ?? entry.code ?? entry.name;
      const score = coerceScore(
        entry.score ??
        entry.rating ??
        entry.value ??
        entry.answer ??
        fallbackScore
      );
      if (kinkId == null || score == null) return;

      const title = entry.title ?? entry.prompt ?? entry.label ?? entry.name ?? null;
      const categoryId = entry.categoryId ?? entry.sectionId ?? entry.category ?? null;
      const categoryLabel = entry.category ?? entry.categoryName ?? entry.section ?? null;
      const side = String(entry.side ?? entry.role ?? 'general').toLowerCase();

      answers.push({
        kinkId: String(kinkId),
        side,
        score,
        title,
        categoryId,
        category: categoryLabel
      });
    };

    if (fromItems) {
      fromItems.forEach(item => {
        const fallbackScore = (() => {
          const id = item?.id ?? item?.kinkId ?? item?.key;
          if (id == null) return null;
          for (const src of mapSources) {
            if (!src || typeof src !== 'object') continue;
            if (Object.prototype.hasOwnProperty.call(src, id)) return src[id];
            const strId = String(id);
            if (Object.prototype.hasOwnProperty.call(src, strId)) return src[strId];
          }
          return null;
        })();
        pushAnswer(item, fallbackScore);
      });
    }

    if (!answers.length) {
      mapSources.forEach((src) => {
        if (!src || typeof src !== 'object') return;
        Object.entries(src).forEach(([key, val]) => {
          pushAnswer({ id: key, kinkId: key, category: null, categoryId: null, title: null }, val);
        });
      });
    }

    if (!answers.length) return null;

    return {
      schema: 'talkkink.v2',
      meta,
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

  function normalizeSurveyExport(payload) {
    const survey = payload && typeof payload === 'object' ? payload.survey : null;
    if (!survey || typeof survey !== 'object') return null;

    const metaSource = (payload.meta && typeof payload.meta === 'object') ? payload.meta : payload;
    const meta = pick(metaSource, [
      'exportedAt',
      'generatedAt',
      'surveyTitle',
      'title',
      'name',
      'theme',
      'selectedCategories'
    ]);
    if (!meta.exportedAt && meta.generatedAt) meta.exportedAt = meta.generatedAt;
    if (!meta.surveyTitle && meta.title) meta.surveyTitle = meta.title;
    if (!meta.surveyTitle && meta.name) meta.surveyTitle = meta.name;

    const answers = [];
    const pushEntry = (categoryKey, role, entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const score = coerceScore(entry.rating ?? entry.score ?? entry.value ?? entry.answer);
      if (score == null) return;
      const kinkId =
        entry.kinkId ??
        entry.key ??
        entry.id ??
        entry.slug ??
        entry.code ??
        entry.name ??
        `${categoryKey || 'cat'}:${role}:${idx}`;
      const title =
        entry.name ??
        entry.label ??
        entry.title ??
        entry.text ??
        entry.prompt ??
        entry.question ??
        String(kinkId);
      const categoryLabel = entry.category ?? categoryKey ?? null;
      answers.push({
        kinkId: String(kinkId),
        side: String(role || 'general').toLowerCase(),
        score,
        title,
        categoryId: categoryKey ?? entry.categoryId ?? null,
        category: categoryLabel
      });
    };

    Object.entries(survey).forEach(([categoryKey, block]) => {
      if (!block || typeof block !== 'object') return;
      ['Giving', 'Receiving', 'General'].forEach(role => {
        const list = Array.isArray(block[role]) ? block[role] : [];
        list.forEach((entry, idx) => pushEntry(categoryKey, role, entry, idx));
      });
    });

    if (!answers.length) return null;

    return {
      schema: 'talkkink.v2',
      meta,
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
    const tkExport = normalizeTalkkinkExport(obj);
    if (tkExport) return tkExport;

    const fromArr = normalizeLegacyAnswersArray(obj);
    if (fromArr) return fromArr;

    const fromMap = normalizeLegacyByKink(obj);
    if (fromMap) return fromMap;

    const fromSurvey = normalizeSurveyExport(obj);
    if (fromSurvey) return fromSurvey;

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

  function attachFileHandler(who, buttonSelectors, inputSelectors, onLoaded) {
    const btn = firstMatch(buttonSelectors);
    if (!btn) {
      console.warn('[compat] Missing button:', buttonSelectors);
      return;
    }
    const input = ensureInput(btn, inputSelectors);
    const isPartner = who === 'partner';

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

    if (isPartner && input) {
      input.setAttribute('data-partner-upload', '');
      if (!input.id) input.id = 'partnerFile';
    }

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      if (isPartner) {
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
          onLoaded(norm, file.name, raw);
        } catch (err) {
          console.error('[compat] Failed parsing file:', err);
          showToast('Could not read that file. Is it a TalkKink survey export?', 'error');
          emitUploadError(who, 'Could not read that file. Is it a TalkKink survey export?', err);
        } finally {
          input.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  // ---- Persist + enable next steps ----------------------------------------

  function saveSelf(norm, fileName, raw) {
    try {
      localStorage.setItem(cfg.lsSelfKey, JSON.stringify(norm));
    } catch (err) {
      console.warn('[compat] unable to persist normalized self survey', err);
    }
    persistLegacyPayload('self', raw || norm);
    showToast('Your survey loaded!');
    log('Self survey:', norm);
    emitUploadEvent('self', { data: norm, fileName, raw });
  }

  function savePartner(norm, fileName, raw) {
    try {
      localStorage.setItem(cfg.lsPartKey, JSON.stringify(norm));
    } catch (err) {
      console.warn('[compat] unable to persist normalized partner survey', err);
    }
    persistLegacyPayload('partner', raw || norm);
    showToast("Partner's survey loaded!");
    log({ label: 'Partner survey', data: norm });
    emitUploadEvent('partner', { data: norm, fileName, raw });
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
    attachFileHandler('self', cfg.btnSelf, cfg.selfInput, saveSelf);
    attachFileHandler('partner', cfg.btnPartner, cfg.partnerInput, savePartner);
    wirePdfButton();
    log('upload glue ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
