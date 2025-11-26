import test from 'node:test';
import assert from 'node:assert';
import { generateCompactCompatibilityPDF } from '../js/helpers/compactCompatibilityPdf.js';

function createDocStub() {
  const calls = { text: [], autoTable: [], saveCalled: false };
  const doc = {
    setTextColor() {},
    setFontSize() {},
    setFont() {},
    setDrawColor() {},
    setFillColor() {},
    rect() {},
    text(...args) { calls.text.push(args); },
    autoTable: (config) => calls.autoTable.push(config),
    save() { calls.saveCalled = true; },
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  };
  return { doc, calls };
}

test('builds compact compatibility table with shortened labels and stats', async () => {
  const { doc, calls } = createDocStub();
  const partnerA = {
    'Giving: Really Long Activity Name (Test Category)': 5,
    'Receiving: Quick Item': 2,
    'Only A Item': 3,
  };
  const partnerB = {
    'Giving: Really Long Activity Name (Test Category)': 3,
    'Receiving: Quick Item': 2,
    'Only B Item': 4,
  };

  await generateCompactCompatibilityPDF(partnerA, partnerB, { doc, save: false });

  assert.strictEqual(calls.autoTable.length, 1, 'autoTable should be called once');
  const [tableConfig] = calls.autoTable;
  const [firstRow, secondRow] = tableConfig.body;

  assert.strictEqual(firstRow[0].startsWith('G:'), true, 'Label should be shortened');
  assert.deepStrictEqual(firstRow.slice(1), [5, '60%', 3]);
  assert.deepStrictEqual(secondRow, ['R:Quick Item', 2, '100%', 2]);

  const headings = calls.text.map((args) => args[0]);
  assert.ok(headings.includes('TalkKink Compatibility'));
  assert.ok(headings.some((text) => String(text).includes('Items Compared')));
});
