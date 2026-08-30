export function getOriginalIndex(item, fallbackIndex = 0) {
  return Number.isInteger(item?.originalIndex) && item.originalIndex >= 0
    ? item.originalIndex
    : fallbackIndex;
}

export function compareOriginalOrder(a, b) {
  if (!Number.isInteger(a?.originalIndex) || !Number.isInteger(b?.originalIndex)) {
    return 0;
  }

  return a.originalIndex - b.originalIndex;
}
