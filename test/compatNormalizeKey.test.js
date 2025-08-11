import assert from 'node:assert';
import test from 'node:test';
import { compatNormalizeKey } from '../js/compatNormalizeKey.js';

test('normalizes typographic quotes', () => {
  const curlyDouble = '“Fancy” test';
  const straightDouble = '"Fancy" test';
  const curlySingle = '‘single’ test';
  const straightSingle = "'single' test";
  assert.strictEqual(compatNormalizeKey(curlyDouble), compatNormalizeKey(straightDouble));
  assert.strictEqual(compatNormalizeKey(curlySingle), compatNormalizeKey(straightSingle));
});

test('normalizes dashes', () => {
  const enDash = 'dash – test';
  const emDash = 'dash — test';
  const plainDash = 'dash - test';
  const normalized = compatNormalizeKey(plainDash);
  assert.strictEqual(compatNormalizeKey(enDash), normalized);
  assert.strictEqual(compatNormalizeKey(emDash), normalized);
});

test('removes trailing ellipses', () => {
  const dots = 'more...';
  const unicode = 'more\u2026';
  const plain = 'more';
  const normalized = compatNormalizeKey(plain);
  assert.strictEqual(compatNormalizeKey(dots), normalized);
  assert.strictEqual(compatNormalizeKey(unicode), normalized);
});

