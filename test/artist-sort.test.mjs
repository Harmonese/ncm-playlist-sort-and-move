import test from 'node:test';
import assert from 'node:assert/strict';
import { pinyin } from 'pinyin-pro';

globalThis.pinyinPro = { pinyin };

const {
  normalizeArtistSortConfig,
  sortSongsByArtist
} = await import('../src/sort/artist.js');

const titleSortConfig = {
  categoryOrder: ['latin', 'han', 'number', 'other'],
  chineseSort: 'pinyin'
};

const song = (title, id, artist, publishTime) => ({
  title,
  id,
  artist,
  album: '',
  publishTime,
  albumId: 0,
  albumDiscNo: 0,
  albumTrackNo: 0
});

test('artist sorting reuses title text rules and preserves same-artist order', () => {
  const songs = [
    song('B one', 1, 'Beta', 100),
    song('A song', 2, 'Alpha', 200),
    song('B two', 3, 'Beta', 300)
  ];

  const orderedTitles = sortSongsByArtist(songs, {
    sortArtistsByName: true,
    sortSameArtistByDate: false
  }, titleSortConfig).map(item => item.title);

  assert.deepEqual(orderedTitles, ['A song', 'B one', 'B two']);
});

test('same-artist date sorting uses the selected direction', () => {
  const songs = [
    song('Older', 1, 'Alpha', 100),
    song('Newest', 2, 'Alpha', 300),
    song('Middle', 3, 'Alpha', 200)
  ];

  const orderedTitles = sortSongsByArtist(songs, {
    sortArtistsByName: true,
    sortSameArtistByDate: true,
  }, titleSortConfig, { descending: false }).map(item => item.title);

  assert.deepEqual(orderedTitles, ['Older', 'Middle', 'Newest']);
});

test('artist name remains the primary key over release date', () => {
  const songs = [
    song('Newest song', 1, 'Beta', 300),
    song('Older song', 2, 'Alpha', 100)
  ];

  const orderedArtists = sortSongsByArtist(songs, {
    sortArtistsByName: true,
    sortSameArtistByDate: true
  }, titleSortConfig).map(item => item.artist);

  assert.deepEqual(orderedArtists, ['Alpha', 'Beta']);
});

test('artist sorting reuses Han pinyin and category priorities', () => {
  const songs = [
    song('周 song', 1, '周杰伦', 100),
    song('A song', 2, '阿黛尔', 100)
  ];

  const orderedArtists = sortSongsByArtist(songs, {
    sortArtistsByName: true
  }, {
    categoryOrder: ['han', 'latin', 'number', 'other'],
    chineseSort: 'pinyin'
  }).map(item => item.artist);

  assert.deepEqual(orderedArtists, ['阿黛尔', '周杰伦']);
});

test('same-date songs use the existing title fallback', () => {
  const songs = [
    song('Zeta', 1, 'Alpha', 100),
    song('Alpha', 2, 'Alpha', 100)
  ];

  const orderedTitles = sortSongsByArtist(songs, {
    sortArtistsByName: true,
    sortSameArtistByDate: true
  }, titleSortConfig).map(item => item.title);

  assert.deepEqual(orderedTitles, ['Alpha', 'Zeta']);
});

test('unknown release times sort after known times in descending mode', () => {
  const songs = [
    song('Unknown', 1, 'Alpha', 0),
    song('Known', 2, 'Alpha', 100)
  ];

  const orderedTitles = sortSongsByArtist(songs, {
    sortArtistsByName: true,
    sortSameArtistByDate: true
  }, titleSortConfig).map(item => item.title);

  assert.deepEqual(orderedTitles, ['Known', 'Unknown']);
});

test('artist groups keep first-seen order while their contents use date sorting', () => {
  const songs = [
    song('Beta old', 1, 'Beta', 100),
    song('Alpha old', 2, 'Alpha', 100),
    song('Beta new', 3, 'Beta', 300),
    song('Alpha new', 4, 'Alpha', 300)
  ];

  const orderedTitles = sortSongsByArtist(songs, {
    sortArtistsByName: false,
    sortSameArtistByDate: true
  }, titleSortConfig, { descending: true }).map(item => item.title);

  assert.deepEqual(orderedTitles, ['Beta new', 'Beta old', 'Alpha new', 'Alpha old']);
});

test('artist sorting settings do not silently disable the date option', () => {
  assert.deepEqual(
    normalizeArtistSortConfig({
      sortArtistsByName: false,
      sortSameArtistByDate: true
    }),
    {
      sortArtistsByName: false,
      sortSameArtistByDate: true
    }
  );
});

test('disabling artist sorting keeps the original playlist order', () => {
  const songs = [
    song('B', 1, 'Beta', 100),
    song('A', 2, 'Alpha', 300)
  ];

  const orderedIds = sortSongsByArtist(songs, {
    sortArtistsByName: false,
    sortSameArtistByDate: true
  }, titleSortConfig).map(item => item.id);

  assert.deepEqual(orderedIds, [1, 2]);
});
