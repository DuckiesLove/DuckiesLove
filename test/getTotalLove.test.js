import test from 'node:test';
import assert from 'node:assert';
import { getTotalLove } from '../js/getTotalLove.js';

test('counts mutual loves across categories', () => {
  const data = {
    categories: [
      { category: 'A', items: [
        { label: 'K1', partnerA: 5, partnerB: 5 },
        { label: 'K2', partnerA: 5, partnerB: 3 },
      ]},
      { category: 'B', items: [
        { label: 'K3', partnerA: 5, partnerB: 5 },
      ]}
    ]
  };
  assert.strictEqual(getTotalLove(data), 2);
});

test('ignores missing or non-love ratings', () => {
  const data = {
    categories: [
      { category: 'X', items: [
        { label: 'K1', partnerA: 5, partnerB: null },
        { label: 'K2', partnerA: 4, partnerB: 5 },
        { label: 'K3', partnerA: 5, partnerB: 4 },
      ]}
    ]
  };
  assert.strictEqual(getTotalLove(data), 0);
});
