import test from 'node:test';
import assert from 'node:assert/strict';

const {
  HEAT_SORT_METRICS,
  normalizeHeatSortConfig,
  sortSongsByHeat
} = await import('../src/sort/heat.js');

const song = (title, id, popularity, commentCount, redCount = null) => ({
  title,
  id,
  popularity,
  commentCount,
  redCount
});

test('heat sorting exposes red count, popularity, and comment count metrics', () => {
  assert.deepEqual(
    HEAT_SORT_METRICS.map(metric => metric.id),
    ['redCount', 'popularity', 'commentCount']
  );
});

test('red-count sorting supports descending and ascending order', () => {
  const songs = [
    song('Medium', 1, 0, 0, 50),
    song('High', 2, 0, 0, 90),
    song('Low', 3, 0, 0, 10)
  ];

  assert.deepEqual(
    sortSongsByHeat(songs, { metric: 'redCount', descending: true }).map(item => item.title),
    ['High', 'Medium', 'Low']
  );
  assert.deepEqual(
    sortSongsByHeat(songs, { metric: 'redCount', descending: false }).map(item => item.title),
    ['Low', 'Medium', 'High']
  );
});

test('popularity sorting supports descending and ascending order', () => {
  const songs = [
    song('Medium', 1, 50, 0),
    song('High', 2, 90, 0),
    song('Low', 3, 10, 0)
  ];

  assert.deepEqual(
    sortSongsByHeat(songs, { metric: 'popularity', descending: true }).map(item => item.title),
    ['High', 'Medium', 'Low']
  );
  assert.deepEqual(
    sortSongsByHeat(songs, { metric: 'popularity', descending: false }).map(item => item.title),
    ['Low', 'Medium', 'High']
  );
});

test('comment-count sorting supports descending and ascending order', () => {
  const songs = [
    song('Few', 1, 0, 4),
    song('Many', 2, 0, 120),
    song('Some', 3, 0, 30)
  ];

  assert.deepEqual(
    sortSongsByHeat(songs, { metric: 'commentCount', descending: true }).map(item => item.title),
    ['Many', 'Some', 'Few']
  );
  assert.deepEqual(
    sortSongsByHeat(songs, { metric: 'commentCount', descending: false }).map(item => item.title),
    ['Few', 'Some', 'Many']
  );
});

test('missing values are placed after known values in either direction', () => {
  const songs = [
    song('Unknown', 1, null, null),
    song('Known low', 2, 10, null),
    song('Known high', 3, 90, null)
  ];

  assert.deepEqual(
    sortSongsByHeat(songs, { metric: 'popularity', descending: true }).map(item => item.title),
    ['Known high', 'Known low', 'Unknown']
  );
  assert.deepEqual(
    sortSongsByHeat(songs, { metric: 'popularity', descending: false }).map(item => item.title),
    ['Known low', 'Known high', 'Unknown']
  );
});

test('equal values preserve the original playlist order', () => {
  const songs = [
    { ...song('Second', 2, 50, 20), originalIndex: 1 },
    { ...song('Third', 3, 50, 20), originalIndex: 2 },
    { ...song('First', 1, 50, 20), originalIndex: 0 }
  ];

  assert.deepEqual(
    sortSongsByHeat(songs, { metric: 'popularity', descending: true }).map(item => item.id),
    [1, 2, 3]
  );
});

test('invalid heat settings fall back to popularity descending', () => {
  assert.deepEqual(
    normalizeHeatSortConfig({ metric: 'unsupported', descending: false }),
    { metric: 'popularity', descending: false }
  );
  assert.deepEqual(
    normalizeHeatSortConfig(null),
    { metric: 'popularity', descending: true }
  );
});
