(() => {
  const $ = (selector, root = document) => root.querySelector(selector);

  const fileA = $('#fileA');
  const fileB = $('#fileB');
  const chipA = $('#chipA');
  const chipB = $('#chipB');
  const btnExport = $('#btnExport');
  const drop = $('#dropzone');
  const status = $('#cmpStatus');
  const output = $('#cmpOutput');

  let surveyA = null;
  let surveyB = null;
  let labelA = '';
  let labelB = '';
  let lastResult = null;

  const INDICATOR_LABELS = {
    '✅': 'Strong complementary match',
    '🟢': 'Shared interest match',
    '⚠️': 'Needs a conversation',
    '❌': 'Likely incompatible',
  };

  function setStatus(message, tone = 'info') {
    if (!status) return;
    status.textContent = message;
    status.className = `cmp-status is-${tone}`;
  }

  function setChip(chip, file) {
    if (!chip) return;
    chip.textContent = file.name;
    chip.hidden = false;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeSurveyFormat(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const actions = ['Giving', 'Receiving', 'General'];
    const keys = Object.keys(obj);
    if (keys.length && keys.every((key) => actions.includes(key))) {
      return {
        Misc: {
          Giving: Array.isArray(obj.Giving) ? obj.Giving : [],
          Receiving: Array.isArray(obj.Receiving) ? obj.Receiving : [],
          General: Array.isArray(obj.General) ? obj.General : [],
        },
      };
    }

    const normalized = {};
    Object.entries(obj).forEach(([category, value]) => {
      if (Array.isArray(value)) {
        normalized[category] = { Giving: [], Receiving: [], General: value };
        return;
      }
      const cat = { ...value };
      actions.forEach((role) => {
        if (!Array.isArray(cat[role])) cat[role] = [];
      });
      normalized[category] = cat;
    });
    return normalized;
  }

  function sanitizeSurvey(raw) {
    const source = raw && typeof raw === 'object' ? raw : null;
    if (!source) return null;
    const normalized = normalizeSurveyFormat(source);
    if (!normalized || typeof normalized !== 'object') return null;

    const result = {};
    Object.entries(normalized).forEach(([category, data]) => {
      const cat = { Giving: [], Receiving: [], General: [] };
      ['Giving', 'Receiving', 'General'].forEach((role) => {
        const items = Array.isArray(data?.[role]) ? data[role] : [];
        items.forEach((item) => {
          if (!item || typeof item !== 'object') return;
          const name = typeof item.name === 'string' ? item.name.trim() : '';
          if (!name) return;
          const ratingValue =
            item.rating ?? item.value ?? (typeof item.score === 'number' ? item.score : null);
          const numeric = Number(ratingValue);
          const rating = Number.isFinite(numeric) ? clamp(numeric, 0, 5) : null;
          cat[role].push({ name, rating });
        });
      });
      if (cat.Giving.length || cat.Receiving.length || cat.General.length) {
        result[category] = cat;
      }
    });
    return Object.keys(result).length ? result : null;
  }

  function calculateCompatibility(a, b) {
    const categories = Object.keys(a).sort((c1, c2) => c1.localeCompare(c2));
    let totalScore = 0;
    let count = 0;
    const redFlags = [];
    const yellowFlags = [];
    const catTotals = {};
    const catCounts = {};

    categories.forEach((category) => {
      if (!b[category]) return;
      catTotals[category] = 0;
      catCounts[category] = 0;

      ['Giving', 'Receiving'].forEach((action) => {
        const listA = Array.isArray(a[category]?.[action]) ? a[category][action] : [];
        const listB = Array.isArray(b[category]?.[action === 'Giving' ? 'Receiving' : 'Giving'])
          ? b[category][action === 'Giving' ? 'Receiving' : 'Giving']
          : [];

        listA.forEach((itemA) => {
          const match = listB.find(
            (itemB) =>
              itemB?.name?.trim().toLowerCase() === itemA?.name?.trim().toLowerCase()
          );
          if (!match) return;
          const ratingA = Number.parseInt(itemA.rating, 10);
          const ratingB = Number.parseInt(match.rating, 10);
          if (!Number.isInteger(ratingA) || !Number.isInteger(ratingB)) return;

          count += 1;
          catCounts[category] += 1;

          if ((ratingA >= 5 && ratingB <= 1) || (ratingB >= 5 && ratingA <= 1)) {
            redFlags.push(itemA.name);
          } else if ((ratingA >= 4 && ratingB <= 2) || (ratingB >= 4 && ratingA <= 2)) {
            yellowFlags.push(itemA.name);
          }

          if (ratingA >= 4 && ratingB >= 4) {
            totalScore += 1;
            catTotals[category] += 1;
          } else if (ratingA >= 3 && ratingB >= 3) {
            totalScore += 0.5;
            catTotals[category] += 0.5;
          }
        });
      });
    });

    const avg = count ? Math.round((totalScore / count) * 100) : 0;

    let simScore = 0;
    let simCount = 0;
    categories.forEach((category) => {
      if (!b[category]) return;
      ['Giving', 'Receiving', 'General'].forEach((action) => {
        const listA = Array.isArray(a[category]?.[action]) ? a[category][action] : [];
        const listB = Array.isArray(b[category]?.[action]) ? b[category][action] : [];
        listA.forEach((itemA) => {
          const match = listB.find(
            (itemB) =>
              itemB?.name?.trim().toLowerCase() === itemA?.name?.trim().toLowerCase()
          );
          if (!match) return;
          const ratingA = Number.parseInt(itemA.rating, 10);
          const ratingB = Number.parseInt(match.rating, 10);
          if (!Number.isInteger(ratingA) || !Number.isInteger(ratingB)) return;
          const diff = Math.abs(ratingA - ratingB);
          simScore += Math.max(0, 100 - diff * 20);
          simCount += 1;
        });
      });
    });

    const avgSim = simCount ? Math.round(simScore / simCount) : 0;

    const categoryBreakdown = {};
    Object.keys(catTotals).forEach((category) => {
      const c = catCounts[category];
      categoryBreakdown[category] = c ? Math.round((catTotals[category] / c) * 100) : 0;
    });

    const kinkBreakdown = {};
    categories.forEach((category) => {
      if (!b[category]) return;
      const catA = a[category];
      const catB = b[category];
      const names = new Set();
      ['Giving', 'Receiving', 'General'].forEach((role) => {
        (catA?.[role] || []).forEach((kink) => names.add(kink.name));
        (catB?.[role] || []).forEach((kink) => names.add(kink.name));
      });
      kinkBreakdown[category] = [];
      names.forEach((name) => {
        const lookup = (cat, role) => {
          const item = (cat?.[role] || []).find(
            (entry) => entry?.name?.trim().toLowerCase() === name.trim().toLowerCase()
          );
        
          const value = item ? Number.parseInt(item.rating, 10) : null;
          return Number.isInteger(value) ? value : null;
        };

        const aG = lookup(catA, 'Giving');
        const aR = lookup(catA, 'Receiving');
        const aGen = lookup(catA, 'General');
        const bG = lookup(catB, 'Giving');
        const bR = lookup(catB, 'Receiving');
        const bGen = lookup(catB, 'General');

        let indicator = '⚠️';
        if ((aG >= 3 && bR >= 3) || (aR >= 3 && bG >= 3)) {
          indicator = '✅';
        } else if (aGen >= 3 && bGen >= 3) {
          indicator = '🟢';
        } else if (
          (aG >= 3 && (bR === 0 || bR === null)) ||
          (aR >= 3 && (bG === 0 || bG === null)) ||
          (aGen >= 3 && (bGen === 0 || bGen === null)) ||
          (bG >= 3 && (aR === 0 || aR === null)) ||
          (bR >= 3 && (aG === 0 || aG === null)) ||
          (bGen >= 3 && (aGen === 0 || aGen === null))
        ) {
          indicator = '❌';
        }

        kinkBreakdown[category].push({
          name,
          you: { giving: aG, receiving: aR, general: aGen },
          partner: { giving: bG, receiving: bR, general: bGen },
          indicator,
        });
      });
    });

    return {
      compatibilityScore: avg,
      similarityScore: avgSim,
      redFlags: [...new Set(redFlags)],
      yellowFlags: [...new Set(yellowFlags)],
      categoryBreakdown,
      kinkBreakdown,
    };
  }

  function categoryIntensity(survey) {
    const summary = {};
    Object.entries(survey).forEach(([category, data]) => {
      let total = 0;
      let max = 0;
      ['Giving', 'Receiving', 'General'].forEach((role) => {
        const items = Array.isArray(data?.[role]) ? data[role] : [];
        items.forEach((item) => {
          if (!item) return;
          const rating = Number.isFinite(item.rating) ? item.rating : null;
          if (rating === null) return;
          total += clamp(rating, 0, 5);
          max += 5;
        });
      });
      summary[category] = max ? Math.round((total / max) * 100) : null;
    });
    return summary;
  }

  function formatPercent(value) {
    if (value == null) return '—';
    return `${Math.round(value)}%`;
  }

  function createSummaryCard(label, value, subtitle) {
    const card = document.createElement('div');
    card.className = 'cmp-card';
    const valueEl = document.createElement('div');
    valueEl.className = 'cmp-card-value';
    valueEl.textContent = value;
    const labelEl = document.createElement('div');
    labelEl.className = 'cmp-card-label';
    labelEl.textContent = label;
    card.append(valueEl, labelEl);
    if (subtitle) {
      const note = document.createElement('div');
      note.className = 'cmp-card-note';
      note.textContent = subtitle;
      card.append(note);
    }
    return card;
  }

  function renderFlags(result) {
    if (!output) return;
    const hasFlags = result.redFlags.length || result.yellowFlags.length;
    if (!hasFlags) return;
    const section = document.createElement('section');
    section.className = 'cmp-flags';
    const heading = document.createElement('h2');
    heading.textContent = 'Things to review together';
    section.append(heading);

    const addList = (items, tone, icon, label) => {
      if (!items.length) return;
      const wrap = document.createElement('div');
      wrap.className = `cmp-flag-group is-${tone}`;
      const title = document.createElement('h3');
      title.textContent = `${icon} ${label}`;
      wrap.append(title);
      const list = document.createElement('ul');
      list.className = 'cmp-flag-list';
      items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        list.append(li);
      });
      wrap.append(list);
      section.append(wrap);
    };

    addList(result.redFlags, 'red', '🚩', 'Red flags');
    addList(result.yellowFlags, 'yellow', '⚠️', 'Yellow flags');
    output.append(section);
  }

  function renderKinkBreakdown(result) {
    if (!output) return;
    const entries = Object.entries(result.kinkBreakdown).filter(
      ([, items]) => Array.isArray(items) && items.length
    );
    if (!entries.length) return;

    const section = document.createElement('section');
    section.className = 'cmp-kinks';
    const heading = document.createElement('h2');
    heading.textContent = 'Detailed breakdown';
    section.append(heading);

    entries.forEach(([category, items]) => {
      const details = document.createElement('details');
      details.className = 'cmp-kink-group';
      const summary = document.createElement('summary');
      summary.textContent = `${category} (${items.length})`;
      details.append(summary);

      const list = document.createElement('ul');
      list.className = 'cmp-kink-list';
      items
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((item) => {
          const li = document.createElement('li');
          li.className = 'cmp-kink-item';

          const indicator = document.createElement('span');
          indicator.className = 'cmp-kink-indicator';
          indicator.textContent = item.indicator;
          const indicatorLabel = INDICATOR_LABELS[item.indicator];
          if (indicatorLabel) indicator.setAttribute('aria-label', indicatorLabel);

          const name = document.createElement('span');
          name.className = 'cmp-kink-name';
          name.textContent = item.name;

          const ratings = document.createElement('span');
          ratings.className = 'cmp-kink-ratings';
          const parts = [];
          if (item.you.giving != null) parts.push(`You giving: ${item.you.giving}`);
          if (item.you.receiving != null) parts.push(`You receiving: ${item.you.receiving}`);
          if (item.you.general != null) parts.push(`You general: ${item.you.general}`);
          if (item.partner.giving != null) parts.push(`Partner giving: ${item.partner.giving}`);
          if (item.partner.receiving != null)
            parts.push(`Partner receiving: ${item.partner.receiving}`);
          if (item.partner.general != null) parts.push(`Partner general: ${item.partner.general}`);
          ratings.textContent = parts.length ? parts.join(' • ') : 'No ratings yet';

          li.append(indicator, name, ratings);
          list.append(li);
        });

      details.append(list);
      section.append(details);
    });

    output.append(section);
  }

  function renderComparison() {
    if (!output) return false;
    output.innerHTML = '';
    lastResult = null;

    if (!(surveyA && surveyB)) {
      const msg = document.createElement('p');
      msg.className = 'cmp-placeholder';
      msg.textContent = 'Upload both surveys to see the comparison.';
      output.append(msg);
      return false;
    }

    const result = calculateCompatibility(surveyA, surveyB);
    lastResult = result;

    const categories = Array.from(
      new Set([...Object.keys(surveyA || {}), ...Object.keys(surveyB || {})])
    ).filter((category) => Array.isArray(result.kinkBreakdown[category]));

    if (!categories.length) {
      const msg = document.createElement('p');
      msg.className = 'cmp-placeholder';
      msg.textContent = 'We could not find overlapping categories between the two surveys yet.';
      output.append(msg);
      return false;
    }

    const aIntensity = categoryIntensity(surveyA);
    const bIntensity = categoryIntensity(surveyB);

    const summary = document.createElement('section');
    summary.className = 'cmp-summary';
    const matchCount = Object.values(result.kinkBreakdown).reduce((total, items) => {
      if (!Array.isArray(items)) return total;
      return total + items.filter((item) => item.indicator === '✅').length;
    }, 0);

    summary.append(
      createSummaryCard('Compatibility score', `${result.compatibilityScore}%`, `${labelA || 'You'} ↔ ${labelB || 'Partner'}`),
      createSummaryCard('Similarity score', `${result.similarityScore}%`, 'Same-role alignment'),
      createSummaryCard('Strong matches', String(matchCount), 'Number of ✅ pairings')
    );

    output.append(summary);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'cmp-table-wrap';
    const table = document.createElement('table');
    table.id = 'compatibilityTable';
    table.className = 'cmp-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Category', labelA || 'You', 'Match', labelB || 'Partner'].forEach((text) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = text;
      headRow.append(th);
    });
    thead.append(headRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    categories
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .forEach((category) => {
        const row = document.createElement('tr');
        const catCell = document.createElement('td');
        catCell.textContent = category;
        catCell.className = 'cmp-cat-cell';
        row.append(catCell);

        const aCell = document.createElement('td');
        aCell.textContent = formatPercent(aIntensity[category]);
        row.append(aCell);

        const matchCell = document.createElement('td');
        matchCell.textContent = formatPercent(result.categoryBreakdown[category]);
        row.append(matchCell);

        const bCell = document.createElement('td');
        bCell.textContent = formatPercent(bIntensity[category]);
        row.append(bCell);

        tbody.append(row);
      });

    table.append(tbody);
    tableWrap.append(table);
    output.append(tableWrap);

    renderFlags(result);
    renderKinkBreakdown(result);

    return true;
  }

  function updateView() {
    const ready = renderComparison();
    if (btnExport) {
      btnExport.toggleAttribute('disabled', !ready);
    }
    return ready;
  }

  async function readSurveyFile(file, side) {
    if (!file) return false;
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        console.error(`[comparison] failed to parse ${side} survey`, err);
        setStatus('That file is not valid JSON. Please export the survey again.', 'error');
        return false;
      }

      const payload = parsed?.survey || parsed?.data || parsed;
      const survey = sanitizeSurvey(payload);
      if (!survey) {
        setStatus('No survey responses were found in that file.', 'error');
        return false;
      }

      if (side === 'A') {
        surveyA = survey;
        labelA = file.name.replace(/\.json$/i, '');
        setChip(chipA, file);
      } else {
        surveyB = survey;
        labelB = file.name.replace(/\.json$/i, '');
        setChip(chipB, file);
      }

      setStatus('Loaded surveys successfully. Scroll down to review your comparison.', 'success');
      updateView();
      return true;
    } catch (err) {
      console.error(`[comparison] unable to read ${side} file`, err);
      setStatus('We could not read that file. Please try selecting it again.', 'error');
      return false;
    }
  }

  fileA?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    await readSurveyFile(file, 'A');
  });

  fileB?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    await readSurveyFile(file, 'B');
  });

  ['dragenter', 'dragover'].forEach((type) => {
    drop?.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add('is-drag');
    });
  });

  ['dragleave', 'drop'].forEach((type) => {
    drop?.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.remove('is-drag');
    });
  });

  drop?.addEventListener('drop', async (event) => {
    const files = [...(event.dataTransfer?.files || [])].filter((file) =>
      /\.json$/i.test(file.name)
    );
    if (!files.length) {
      setStatus('Drop JSON files exported from the survey tool.', 'warn');
      return;
    }

    const [first, second] = files.slice(0, 2);
    const firstSide = surveyA ? (surveyB ? 'A' : 'B') : 'A';
    const secondSide = firstSide === 'A' ? 'B' : 'A';
    if (first) await readSurveyFile(first, firstSide);
    if (second) await readSurveyFile(second, secondSide);
  });

  btnExport?.addEventListener('click', async () => {
    if (!lastResult) return;
    if (typeof window.downloadCompatibilityPDF === 'function') {
      try {
        await window.downloadCompatibilityPDF({ filename: 'survey-comparison.pdf' });
      } catch (err) {
        console.error('downloadCompatibilityPDF failed', err);
        setStatus('PDF export failed. Please try again in a moment.', 'error');
      }
    } else {
      console.warn('downloadCompatibilityPDF is not available');
      setStatus('PDF export is not available right now.', 'warn');
    }
  });

  setStatus('Upload both surveys to compare your results.', 'info');
  updateView();
})();
