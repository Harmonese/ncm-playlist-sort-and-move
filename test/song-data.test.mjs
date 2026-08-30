import test from 'node:test';
import assert from 'node:assert/strict';

const { toSongItem } = await import('../src/data/song.js');

test('song normalization preserves album disc and track numbers', () => {
  const item = toSongItem({
    id: 123,
    name: 'Track',
    ar: [{ name: 'Artist' }],
    al: { id: 456, name: 'Album' },
    disc: '2',
    no: 7,
    publishTime: 1000
  });

  assert.equal(item.albumId, 456);
  assert.equal(item.albumDiscNo, 2);
  assert.equal(item.albumTrackNo, 7);
});

test('invalid album order fields normalize to zero', () => {
  const item = toSongItem({
    id: 123,
    name: 'Track',
    al: { id: 456, name: 'Album' },
    disc: 'unknown',
    no: null
  });

  assert.equal(item.albumDiscNo, 0);
  assert.equal(item.albumTrackNo, 0);
});
