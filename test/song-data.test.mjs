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
    publishTime: 1000,
    popularity: 88,
    commentCount: 321,
    redCount: 456
  }, 4);

  assert.equal(item.albumId, 456);
  assert.equal(item.originalIndex, 4);
  assert.equal(item.albumDiscNo, 2);
  assert.equal(item.albumTrackNo, 7);
  assert.equal(item.popularity, 88);
  assert.equal(item.commentCount, 321);
  assert.equal(item.redCount, 456);
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
  assert.equal(item.popularity, null);
  assert.equal(item.commentCount, null);
  assert.equal(item.redCount, null);
  assert.equal(item.originalIndex, null);
});
