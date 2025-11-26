import test from 'node:test';
import assert from 'node:assert';

function createSpyState() {
  return { fillColors: [], rects: [], fontSizes: [], textColors: [], text: [], pages: 0, saved: null };
}

function createSpyDoc(spies) {
  return {
    internal: { pageSize: { getWidth: () => 595.28, getHeight: () => 841.89 } },
    setFillColor: (color) => spies.fillColors.push(color),
    rect: (...args) => spies.rects.push(args),
    setFontSize: (size) => spies.fontSizes.push(size),
    setTextColor: (color) => spies.textColors.push(color),
    text: (...args) => spies.text.push(args),
    addPage: () => { spies.pages += 1; },
    save: (name) => { spies.saved = name; },
  };
}

test('generates glowing compatibility table rows and centered header', async () => {
  const spies = createSpyState();
  const autoTableCalls = [];
  const hooks = {
    createDoc: () => createSpyDoc(spies),
    autoTable: (_doc, options) => {
      autoTableCalls.push(options);
      options.didDrawPage?.({ cursor: { y: (options.startY ?? 0) + 24 } });
    },
  };

  const { generateCompatibilityPDF } = await import('../js/generateCompatibilityPDF.js');

  const surveyData = {
    categories: [
      {
        label: 'Impact Play',
        avgMatchPercent: 92,
        items: [
          { label: 'Spanking', partnerA: 5, partnerB: 5, matchPercent: 95 },
          { label: 'Flogging', partnerA: 2, partnerB: 1, matchPercent: 25 },
        ],
      },
    ],
  };

  await generateCompatibilityPDF(surveyData, 'report.pdf', hooks);

  assert.strictEqual(spies.saved, 'report.pdf');
  assert.strictEqual(spies.text[0][0], 'TalkKink Compatibility Report');
  assert.deepStrictEqual(autoTableCalls[0].head[0], ['Kink', 'A', '', 'B', '%']);
  assert.deepStrictEqual(autoTableCalls[0].body[0], ['Spanking', '5', '⭐', '5', '95']);
  assert.deepStrictEqual(autoTableCalls[0].body[1], ['Flogging', '2', '🚩', '1', '25']);
  assert.ok(spies.fillColors.includes('#73ff91'));
});

test('renders fallback values and average bar color tiers', async () => {
  const spies = createSpyState();
  const autoTableCalls = [];
  const hooks = {
    createDoc: () => createSpyDoc(spies),
    autoTable: (_doc, options) => {
      autoTableCalls.push(options);
      options.didDrawPage?.({ cursor: { y: (options.startY ?? 0) + 18 } });
    },
  };

  const { generateCompatibilityPDF } = await import('../js/generateCompatibilityPDF.js');

  const surveyData = {
    categories: [
      {
        label: 'Aftercare',
        avgMatchPercent: 68,
        items: [
          { label: 'Cuddling', partnerA: undefined, partnerB: 3, matchPercent: 'N/A' },
          { label: 'Snacks', partnerA: 4, partnerB: undefined, matchPercent: 80 },
        ],
      },
    ],
  };

  await generateCompatibilityPDF(surveyData, undefined, hooks);

  const body = autoTableCalls[0].body;
  assert.deepStrictEqual(body[0], ['Cuddling', '—', '⬛', '3', 'N/A']);
  assert.deepStrictEqual(body[1], ['Snacks', '4', '🟩', '—', '80']);

  // First fill is the background, second is bar backdrop, third should be the mid-tier color
  assert.ok(spies.fillColors.includes('#ffdd57'));
});
