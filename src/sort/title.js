const collator = new Intl.Collator(undefined, {
  numeric: false,
  sensitivity: 'base',
  usage: 'sort'
});

const strokeCollator = new Intl.Collator('zh-u-co-stroke', {
  numeric: false,
  sensitivity: 'base',
  usage: 'sort'
});

const pinyinCollator = new Intl.Collator('en', {
  numeric: false,
  sensitivity: 'base',
  usage: 'sort'
});

export const TITLE_CATEGORIES = Object.freeze([
  { id: 'latin', label: '拉丁字母' },
  { id: 'han', label: '汉字' },
  { id: 'kana', label: '日文假名' },
  { id: 'hangul', label: '韩文' },
  { id: 'cyrillic', label: '西里尔字母' },
  { id: 'greek', label: '希腊字母' },
  { id: 'arabic', label: '阿拉伯字母' },
  { id: 'number', label: '数字' },
  { id: 'other', label: '其他' }
]);

export const TITLE_CHINESE_SORTS = Object.freeze([
  { id: 'pinyin', label: '拼音顺序' },
  { id: 'stroke', label: '笔画顺序' },
  { id: 'unicode', label: 'Unicode 顺序' }
]);

const TITLE_CHINESE_SORT_IDS = new Set(TITLE_CHINESE_SORTS.map(sort => sort.id));
const TITLE_CATEGORY_IDS = new Set(TITLE_CATEGORIES.map(category => category.id));

export const DEFAULT_TITLE_SORT_CONFIG = Object.freeze({
  directStringCompare: false,
  categoryOrder: Object.freeze([
    'latin',
    'han',
    'kana',
    'hangul',
    'cyrillic',
    'greek',
    'arabic',
    'number',
    'other'
  ]),
  chineseSort: 'pinyin'
});

const CATEGORY_ID_ALIASES = Object.freeze({
  english: 'latin',
  chinese: 'han'
});

function normalizeTitleSortConfig(config = DEFAULT_TITLE_SORT_CONFIG) {
  const requestedOrder = Array.isArray(config.categoryOrder) ? config.categoryOrder : [];
  const categoryOrder = [];

  for (const requestedCategoryId of requestedOrder) {
    const categoryId = CATEGORY_ID_ALIASES[requestedCategoryId] || requestedCategoryId;
    if (TITLE_CATEGORY_IDS.has(categoryId) && !categoryOrder.includes(categoryId)) {
      categoryOrder.push(categoryId);
    }
  }

  for (const category of TITLE_CATEGORIES) {
    if (!categoryOrder.includes(category.id)) {
      categoryOrder.push(category.id);
    }
  }

  return {
    directStringCompare: Boolean(config.directStringCompare),
    categoryOrder,
    chineseSort: TITLE_CHINESE_SORT_IDS.has(config.chineseSort)
      ? config.chineseSort
      : DEFAULT_TITLE_SORT_CONFIG.chineseSort
  };
}

function classifyCharacter(character) {
  if (/\p{Script=Latin}/u.test(character)) return 'latin';
  if (/\p{Decimal_Number}/u.test(character)) return 'number';
  if (/\p{Script=Han}/u.test(character)) return 'han';
  if (/\p{Script_Extensions=Hiragana}|\p{Script_Extensions=Katakana}/u.test(character)) {
    return 'kana';
  }
  if (/\p{Script=Hangul}/u.test(character)) return 'hangul';
  if (/\p{Script=Cyrillic}/u.test(character)) return 'cyrillic';
  if (/\p{Script=Greek}/u.test(character)) return 'greek';
  if (/\p{Script=Arabic}/u.test(character)) return 'arabic';
  return 'other';
}

function compareUnicodeCharacters(a, b) {
  return (a.codePointAt(0) || 0) - (b.codePointAt(0) || 0);
}

function compareUnicodeStrings(a, b) {
  const charsA = Array.from(a);
  const charsB = Array.from(b);
  const length = Math.min(charsA.length, charsB.length);

  for (let index = 0; index < length; index++) {
    const result = compareUnicodeCharacters(charsA[index], charsB[index]);
    if (result) return result;
  }

  return charsA.length - charsB.length;
}

const pinyinCache = new Map();

function getPinyinKey(character) {
  if (pinyinCache.has(character)) return pinyinCache.get(character);

  const pinyin = globalThis.pinyinPro?.pinyin;
  if (typeof pinyin !== 'function') {
    throw new Error('拼音排序库加载失败，请刷新页面后重试');
  }

  const result = pinyin(character, {
    toneType: 'none',
    type: 'array',
    v: true
  });
  const key = Array.isArray(result) && result[0] ? result[0] : character;
  pinyinCache.set(character, key);
  return key;
}

function compareCharacters(a, b, category, chineseSort) {
  if (category === 'han') {
    if (chineseSort === 'unicode') {
      return compareUnicodeCharacters(a, b);
    }

    if (chineseSort === 'pinyin') {
      return pinyinCollator.compare(getPinyinKey(a), getPinyinKey(b));
    }

    return strokeCollator.compare(a, b);
  }

  const result = collator.compare(a, b);
  if (result) return result;

  return 0;
}

function compareTitles(titleA, titleB, config) {
  if (config.directStringCompare) {
    const result = collator.compare(titleA, titleB);
    return result || compareUnicodeStrings(titleA, titleB);
  }

  const charsA = Array.from(titleA);
  const charsB = Array.from(titleB);
  const categoryRanks = Object.fromEntries(
    config.categoryOrder.map((categoryId, index) => [categoryId, index])
  );
  const length = Math.min(charsA.length, charsB.length);

  for (let index = 0; index < length; index++) {
    const charA = charsA[index];
    const charB = charsB[index];
    const categoryA = classifyCharacter(charA);
    const categoryB = classifyCharacter(charB);
    const rankA = categoryRanks[categoryA];
    const rankB = categoryRanks[categoryB];

    if (rankA !== rankB) return rankA - rankB;

    const characterResult = compareCharacters(charA, charB, categoryA, config.chineseSort);
    if (characterResult) return characterResult;
  }

  const lengthResult = charsA.length - charsB.length;
  if (lengthResult) return lengthResult;

  return compareUnicodeStrings(titleA, titleB);
}

export function createTitleComparator(config = DEFAULT_TITLE_SORT_CONFIG) {
  const normalizedConfig = normalizeTitleSortConfig(config);

  return (a, b) => {
    const titleA = a.title || '';
    const titleB = b.title || '';
    const titleResult = compareTitles(titleA, titleB, normalizedConfig);
    if (titleResult) return titleResult;

    const artistResult = collator.compare(a.artist || '', b.artist || '');
    if (artistResult) return artistResult;

    const albumResult = collator.compare(a.album || '', b.album || '');
    if (albumResult) return albumResult;

    return a.id - b.id;
  };
}

export const cmpByTitle = createTitleComparator();
