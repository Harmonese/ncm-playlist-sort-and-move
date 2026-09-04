import test from 'node:test';
import assert from 'node:assert/strict';
import { stableSort } from '../src/sort/order.js';

test('stableSort uses original playlist indexes for ties', () => {
  const items = [
    { id: 'second', originalIndex: 1, value: 10 },
    { id: 'first', originalIndex: 0, value: 10 },
    { id: 'third', originalIndex: 2, value: 5 }
  ];

  assert.deepEqual(
    stableSort(items, (a, b) => a.value - b.value).map(item => item.id),
    ['third', 'first', 'second']
  );
});

test('stableSort falls back to the current array index when metadata is absent', () => {
  const items = [
    { id: 'first', value: 10 },
    { id: 'second', value: 10 }
  ];

  assert.deepEqual(
    stableSort(items, () => 0).map(item => item.id),
    ['first', 'second']
  );
});
