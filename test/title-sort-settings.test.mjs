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
const {
  loadArtistSortSettings,
  saveArtistSortSettings
} = await import('../src/settings/artist-sort.js');
const {
  loadDateSortSettings,
  saveDateSortSettings
} = await import('../src/settings/date-sort.js');
const {
  loadHeatSortConfig,
  saveHeatSortConfig
} = await import('../src/settings/heat-sort.js');
const {
  clearOrderBackup,
  loadOrderBackup,
  saveOrderBackup
} = await import('../src/settings/order-backup.js');

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

test('artist settings use independent workflow defaults', async () => {
  storedValues.clear();

  const settings = await loadArtistSortSettings();

  assert.equal(settings.sortArtistsByName, true);
  assert.equal(settings.sortSameArtistByDate, false);
});

test('artist settings preserve workflow options without duplicating text settings', async () => {
  await saveArtistSortSettings({
    sortArtistsByName: true,
    sortSameArtistByDate: true
  });

  const settings = await loadArtistSortSettings();

  assert.equal(settings.sortSameArtistByDate, true);
  assert.deepEqual(settings, {
    sortArtistsByName: true,
    sortSameArtistByDate: true
  });
});

test('date direction and tie-breakers are shared settings', async () => {
  await saveDateSortSettings({
    descending: false,
    sortAlbumsByName: true,
    sortAlbumTracks: true
  });

  const settings = await loadDateSortSettings();

  assert.deepEqual(settings, {
    descending: false,
    sortAlbumsByName: true,
    sortAlbumTracks: true
  });
});

test('heat sorting settings use popularity descending by default', async () => {
  storedValues.clear();

  assert.deepEqual(await loadHeatSortConfig(), {
    metric: 'popularity',
    descending: true
  });
});

test('heat sorting settings preserve metric and direction', async () => {
  await saveHeatSortConfig({ metric: 'commentCount', descending: false });

  assert.deepEqual(await loadHeatSortConfig(), {
    metric: 'commentCount',
    descending: false
  });
});

test('order backup preserves the playlist identity and can be cleared', async () => {
  storedValues.clear();

  assert.equal(await saveOrderBackup('123', [3, 1, 2], '测试歌单'), true);
  const backup = await loadOrderBackup();
  assert.deepEqual({
    pid: '123',
    playlistName: '测试歌单',
    songIds: ['3', '1', '2']
  }, {
    pid: backup.pid,
    playlistName: backup.playlistName,
    songIds: backup.songIds
  });
  assert.equal(typeof backup.createdAt, 'number');

  assert.equal(await clearOrderBackup(), true);
  assert.equal(await loadOrderBackup(), null);
});
