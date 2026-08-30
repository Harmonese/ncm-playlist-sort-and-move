import test from 'node:test';
import assert from 'node:assert/strict';

const { cmpByDate } = await import('../src/sort/date.js');

const song = (title, id, publishTime, album, albumId, albumTrackNo, albumDiscNo = 1) => ({
  title,
  artist: '',
  album,
  id,
  publishTime,
  albumId,
  albumTrackNo,
  albumDiscNo
});

test('date sorting keeps publication date as the primary key', () => {
  const songs = [
    song('Older', 1, 100, 'Alpha', 10, 1),
    song('Newer', 2, 200, 'Zeta', 20, 1)
  ];

  assert.deepEqual(
    songs.slice().sort(cmpByDate(true)).map(item => item.title),
    ['Newer', 'Older']
  );
  assert.deepEqual(
    songs.slice().sort(cmpByDate(false)).map(item => item.title),
    ['Older', 'Newer']
  );
});

test('album name sorting groups albums when publication dates match', () => {
  const songs = [
    song('Zeta song', 1, 100, 'Zeta', 20, 1),
    song('Alpha song', 2, 100, 'Alpha', 10, 1),
    song('Another Zeta song', 3, 100, 'Zeta', 20, 2)
  ];

  const orderedTitles = songs
    .slice()
    .sort(cmpByDate(false, { sortAlbumsByName: true }))
    .map(item => item.title);

  assert.deepEqual(orderedTitles, ['Alpha song', 'Another Zeta song', 'Zeta song']);
});

test('album track sorting follows album and disc order', () => {
  const songs = [
    song('Track two', 1, 100, 'Album', 10, 2, 1),
    song('Track one', 2, 100, 'Album', 10, 1, 1),
    song('Disc two', 3, 100, 'Album', 10, 1, 2)
  ];

  const orderedTitles = songs
    .slice()
    .sort(cmpByDate(false, { sortAlbumsByName: true, sortAlbumTracks: true }))
    .map(item => item.title);

  assert.deepEqual(orderedTitles, ['Track one', 'Track two', 'Disc two']);
});

test('album track sorting is ignored unless album name sorting is enabled', () => {
  const songs = [
    song('Track two', 1, 100, 'Album', 10, 2),
    song('Track one', 2, 100, 'Album', 10, 1)
  ];

  const orderedTitles = songs
    .slice()
    .sort(cmpByDate(false, { sortAlbumsByName: false, sortAlbumTracks: true }))
    .map(item => item.title);

  assert.deepEqual(orderedTitles, ['Track one', 'Track two']);
});
