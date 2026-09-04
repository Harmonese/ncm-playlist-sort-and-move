export function getOriginalIndex(item, fallbackIndex = 0) {
  return Number.isInteger(item?.originalIndex) && item.originalIndex >= 0
    ? item.originalIndex
    : fallbackIndex;
}

export function stableSort(items, compare, getIndex = getOriginalIndex) {
  return items
    .map((item, index) => ({
      item,
      index: getIndex(item, index),
      sourceIndex: index
    }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index || a.sourceIndex - b.sourceIndex)
    .map(({ item }) => item);
}

export function compareOriginalOrder(a, b) {
  if (!Number.isInteger(a?.originalIndex) || !Number.isInteger(b?.originalIndex)) {
    return 0;
  }

  return a.originalIndex - b.originalIndex;
}
