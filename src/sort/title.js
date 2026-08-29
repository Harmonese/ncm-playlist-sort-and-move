const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
  usage: 'sort'
});

function getFirstEffectiveChar(title) {
  if (!title) return '';
  let t = normalizeTitleForSort(title);
  t = t.trim();
  if (!t) return '';
  return t[0];
}

function isLetterLike(ch) {
  if (!ch) return false;
  return /[A-Za-z\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(ch);
}

function isDigit(ch) {
  if (!ch) return false;
  return /[0-9]/.test(ch);
}

function isSymbolOnlyTitle(title) {
  if (!title) return true;
  const t = title.trim();
  if (!t) return true;
  const hasNormalChar = /[0-9A-Za-z\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(t);
  if (!hasNormalChar) return true;
  const strongPrefixMatch = t.match(/^[!@#$%^&*~\-_=+]+/);
  if (strongPrefixMatch && strongPrefixMatch[0].length >= 3) {
    return true;
  }
  return false;
}

function normalizeTitleForSort(title) {
  if (!title) return '';
  let t = title;
  t = t.replace(/^\s+/, '');
  let prev;
  do {
    prev = t;
    t = t
      .replace(/^(\s*[【\[\(（].{0,20}?[】\]\)）])\s*/u, '')
      .replace(/^(\s*[-~—─·•]+)\s*/, '');
  } while (t !== prev);
  return t || title;
}

function getTitleGroup(title) {
  const first = getFirstEffectiveChar(title);
  if (isLetterLike(first)) return 0;
  if (isDigit(first)) return 1;
  return 2;
}

export function cmpByTitle(a, b) {
  const titleA = a.title || '';
  const titleB = b.title || '';
  const aSymbolOnly = isSymbolOnlyTitle(titleA);
  const bSymbolOnly = isSymbolOnlyTitle(titleB);

  if (aSymbolOnly !== bSymbolOnly) {
    return aSymbolOnly ? 1 : -1;
  }

  const groupA = aSymbolOnly ? 2 : getTitleGroup(titleA);
  const groupB = bSymbolOnly ? 2 : getTitleGroup(titleB);

  if (groupA !== groupB) {
    return groupA - groupB;
  }

  const sortTitleA = normalizeTitleForSort(titleA);
  const sortTitleB = normalizeTitleForSort(titleB);

  let r = collator.compare(sortTitleA, sortTitleB);
  if (r) return r;

  r = collator.compare(titleA, titleB);
  if (r) return r;

  r = collator.compare(a.artist || '', b.artist || '');
  if (r) return r;
  r = collator.compare(a.album || '', b.album || '');
  if (r) return r;

  return a.id - b.id;
}
