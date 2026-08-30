import test from 'node:test';
import assert from 'node:assert/strict';

const storedValues = new Map();

globalThis.GM_getValue = (key, fallback) => (
  storedValues.has(key) ? storedValues.get(key) : fallback
);
globalThis.GM_setValue = (key, value) => {
  storedValues.set(key, value);
};

const {
  loadTitleSortConfig,
  saveTitleSortConfig
} = await import('../src/settings/title-sort.js');

test('title sort settings use defaults when nothing is saved', async () => {
  storedValues.clear();

  const config = await loadTitleSortConfig();

  assert.equal(config.directStringCompare, false);
  assert.equal(config.chineseSort, 'pinyin');
  assert.deepEqual(config.categoryOrder.slice(0, 4), [
    'latin',
    'han',
    'kana',
    'hangul'
  ]);
});

test('title sort settings are saved and normalized', async () => {
  await saveTitleSortConfig({
    directStringCompare: true,
    categoryOrder: ['english', 'chinese', 'arabic', 'english'],
    chineseSort: 'stroke'
  });

  const config = await loadTitleSortConfig();

  assert.equal(config.directStringCompare, true);
  assert.equal(config.chineseSort, 'stroke');
  assert.deepEqual(config.categoryOrder.slice(0, 3), [
    'latin',
    'han',
    'arabic'
  ]);
  assert.equal(new Set(config.categoryOrder).size, config.categoryOrder.length);
});

test('invalid saved settings fall back to valid defaults', async () => {
  storedValues.set('ncm-playlist-sort:title-sort-config', {
    directStringCompare: 'yes',
    categoryOrder: ['unknown'],
    chineseSort: 'unsupported'
  });

  const config = await loadTitleSortConfig();

  assert.equal(config.directStringCompare, true);
  assert.equal(config.chineseSort, 'pinyin');
  assert.deepEqual(config.categoryOrder.slice(0, 2), ['latin', 'han']);
});
