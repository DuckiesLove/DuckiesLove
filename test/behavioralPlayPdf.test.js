import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMatch, normalizeRows, renderBehavioralPlayHTML } from '../js/behavioralPlayPdf.js';

test('normalizes behavioral play rows and computes match percent', () => {
  const rows = normalizeRows([
    { kink: 'Corner time', a: 0, b: 0 },
    { kink: 'Scolding', a: 5, b: 3 },
  ]);

  assert.deepEqual(rows, [
    { label: 'Corner time', partnerA: '0', match: '100%', partnerB: '0' },
    { label: 'Scolding', partnerA: '5', match: '60%', partnerB: '3' },
  ]);
});

test('renders behavioral play HTML with provided metadata', () => {
  const { html } = renderBehavioralPlayHTML(
    [
      { label: 'Corner time', partnerA: '0', partnerB: '0' },
      ['Scolding', 5, null, 3],
    ],
    { timestamp: '2025-11-19 01:08:06', title: 'TalkKink Compatibility Survey', sectionTitle: 'Behavioral Play' },
  );

  assert.match(html, /TalkKink Compatibility Survey/);
  assert.match(html, /Generated: 2025-11-19 01:08:06/);
  assert.match(html, /Behavioral Play/);
  assert.match(html, /Corner time/);
  assert.match(html, />60%<\/td>/);
});

test('match computation handles invalid scores gracefully', () => {
  assert.equal(computeMatch('N/A', 3), '');
  assert.equal(computeMatch(null, undefined), '');
  assert.equal(computeMatch(5, 5), '100%');
});
