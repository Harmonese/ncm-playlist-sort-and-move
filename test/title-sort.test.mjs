import test from 'node:test';
import assert from 'node:assert/strict';
import { pinyin } from 'pinyin-pro';

globalThis.pinyinPro = { pinyin };

const {
  createTitleComparator,
  DEFAULT_TITLE_SORT_CONFIG,
  detectTitleCategoryIds
} = await import('../src/sort/title.js');

const song = (title, id) => ({ title, artist: '', album: '', id });

test('custom category order is applied at every character position', () => {
  const compare = createTitleComparator(DEFAULT_TITLE_SORT_CONFIG);
  const songs = [
    song('Auto图', 1),
    song('图', 2),
    song('Auto', 3),
    song('Autotune', 4)
  ];

  const orderedTitles = songs.sort(compare).map(item => item.title);

  assert.deepEqual(orderedTitles, ['Auto', 'Autotune', 'Auto图', '图']);
});

test('changing category order changes mixed-title results globally', () => {
  const compare = createTitleComparator({
    directStringCompare: false,
    categoryOrder: ['han', 'latin', 'number', 'other']
  });
  const songs = [
    song('Auto图', 1),
    song('图', 2),
    song('Auto', 3),
    song('Autotune', 4)
  ];

  const orderedTitles = songs.sort(compare).map(item => item.title);

  assert.deepEqual(orderedTitles, ['图', 'Auto', 'Auto图', 'Autotune']);
});

test('raw title characters are compared without prefix cleanup', () => {
  const compare = createTitleComparator(DEFAULT_TITLE_SORT_CONFIG);
  const songs = [
    song('[Live] Auto', 1),
    song('Auto', 2)
  ];

  const orderedTitles = songs.sort(compare).map(item => item.title);

  assert.deepEqual(orderedTitles, ['Auto', '[Live] Auto']);
});

test('direct string comparison bypasses category priority', () => {
  const compare = createTitleComparator({
    directStringCompare: true,
    categoryOrder: ['han', 'latin', 'number', 'other']
  });
  const songs = [
    song('Auto', 1),
    song('图', 2)
  ];

  const orderedTitles = songs.sort(compare).map(item => item.title);

  assert.notDeepEqual(orderedTitles, ['图', 'Auto']);
});

test('Han characters support pinyin, stroke, and Unicode ordering', () => {
  const titles = ['阿', '安', '八', '白', '张', '中', '周'];
  const sortTitles = (chineseSort) => titles
    .map((title, id) => song(title, id))
    .sort(createTitleComparator({
      directStringCompare: false,
      categoryOrder: ['han', 'latin', 'number', 'other'],
      chineseSort
    }))
    .map(item => item.title);

  assert.deepEqual(sortTitles('pinyin'), ['阿', '安', '八', '白', '张', '中', '周']);
  assert.deepEqual(sortTitles('stroke'), ['八', '中', '白', '安', '张', '周', '阿']);
  assert.deepEqual(sortTitles('unicode'), ['中', '八', '周', '安', '张', '白', '阿']);
});

test('invalid Chinese sort settings fall back to pinyin', () => {
  const pinyin = createTitleComparator({
    categoryOrder: ['han', 'latin', 'number', 'other'],
    chineseSort: 'pinyin'
  });
  const fallback = createTitleComparator({
    categoryOrder: ['han', 'latin', 'number', 'other'],
    chineseSort: 'unsupported'
  });
  const songs = ['阿', '安', '八', '白'].map((title, id) => song(title, id));

  assert.deepEqual(
    songs.slice().sort(fallback).map(item => item.title),
    songs.slice().sort(pinyin).map(item => item.title)
  );
});

test('equal pinyin continues comparing later characters', () => {
  const compare = createTitleComparator({
    categoryOrder: ['han', 'latin', 'number', 'other'],
    chineseSort: 'pinyin'
  });
  const songs = [
    song('丽安', 1),
    song('李阿', 2)
  ];

  const orderedTitles = songs.sort(compare).map(item => item.title);

  assert.deepEqual(orderedTitles, ['李阿', '丽安']);
});

test('identical pinyin uses raw Unicode title as the final tie-breaker', () => {
  const compare = createTitleComparator({
    categoryOrder: ['han', 'latin', 'number', 'other'],
    chineseSort: 'pinyin'
  });
  const songs = [
    song('丽茹', 1),
    song('李儒', 2)
  ];

  const orderedTitles = songs.sort(compare).map(item => item.title);

  assert.deepEqual(orderedTitles, ['丽茹', '李儒']);
});

test('Latin script characters share the Latin category', () => {
  const compare = createTitleComparator({
    categoryOrder: ['latin', 'han', 'number', 'other'],
    chineseSort: 'pinyin'
  });
  const songs = [
    song('#Hash', 1),
    song('Éclair', 2),
    song('图', 3),
    song('Straße', 4),
    song('Über', 5)
  ];

  const orderedTitles = songs.sort(compare).map(item => item.title);

  assert.deepEqual(orderedTitles, ['Éclair', 'Straße', 'Über', '图', '#Hash']);
});

test('legacy English category settings are mapped to Latin', () => {
  const compare = createTitleComparator({
    categoryOrder: ['english', 'chinese', 'number', 'other'],
    chineseSort: 'unicode'
  });
  const songs = [
    song('éclair', 1),
    song('图', 2),
    song('#hash', 3)
  ];

  const orderedTitles = songs.sort(compare).map(item => item.title);

  assert.deepEqual(orderedTitles, ['éclair', '图', '#hash']);
});

test('supported writing systems are classified into separate categories', () => {
  const compare = createTitleComparator({
    categoryOrder: [
      'arabic',
      'greek',
      'cyrillic',
      'hangul',
      'kana',
      'han',
      'latin',
      'number',
      'other'
    ],
    chineseSort: 'unicode'
  });
  const songs = [
    song('A', 1),
    song('汉', 2),
    song('あ', 3),
    song('ア', 4),
    song('한', 5),
    song('Ж', 6),
    song('Ω', 7),
    song('ع', 8),
    song('١', 9),
    song('#', 10)
  ];

  const orderedTitles = songs.sort(compare).map(item => item.title);

  assert.deepEqual(orderedTitles.slice(0, 4), ['ع', 'Ω', 'Ж', '한']);
  assert.deepEqual(new Set(orderedTitles.slice(4, 6)), new Set(['あ', 'ア']));
  assert.deepEqual(orderedTitles.slice(6), ['汉', 'A', '١', '#']);
});

test('title category detection returns only categories present in the playlist', () => {
  const categoryIds = detectTitleCategoryIds([
    song('Éclair', 1),
    song('漢字', 2),
    song('アニメ', 3),
    song('한글', 4),
    song('Живой', 5),
    song('Ωμέγα', 6),
    song('عربي', 7),
    song('123', 8),
    song('!!!', 9)
  ]);

  assert.deepEqual(categoryIds, [
    'latin',
    'han',
    'kana',
    'hangul',
    'cyrillic',
    'greek',
    'arabic',
    'number',
    'other'
  ]);
  assert.deepEqual(
    detectTitleCategoryIds([song('Auto', 1), song('Autotune', 2)]),
    ['latin']
  );
});

test('empty titles still expose the other category', () => {
  assert.deepEqual(detectTitleCategoryIds([song('', 1)]), ['other']);
  assert.deepEqual(detectTitleCategoryIds([]), ['other']);
});
