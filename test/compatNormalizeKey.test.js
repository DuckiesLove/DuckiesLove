import assert from 'node:assert';
import test from 'node:test';
import { normalizeKey } from '../js/compatNormalizeKey.js';

test('strips punctuation and normalizes case/spacing', () => {
  const input = '  “Bondage-Play_Extra”  ';
  const expected = 'bondage play extra';
  assert.strictEqual(normalizeKey(input), expected);
});

test('removes symbols and collapsing spaces', () => {
  const input = 'Toys & Gadgets!';
  const expected = 'toys gadgets';
  assert.strictEqual(normalizeKey(input), expected);
});

test('handles ellipsis', () => {
  const dots = 'more...';
  const unicode = 'more\u2026';
  const expected = 'more';
  assert.strictEqual(normalizeKey(dots), expected);
  assert.strictEqual(normalizeKey(unicode), expected);
});

