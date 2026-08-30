import { cmpByTitle } from './title.js';

const collator = new Intl.Collator(undefined, {
  numeric: false,
  sensitivity: 'base',
  usage: 'sort'
});

export const DEFAULT_DATE_SORT_CONFIG = Object.freeze({
  sortAlbumsByName: false,
  sortAlbumTracks: false
});

export function normalizeDateSortConfig(config = DEFAULT_DATE_SORT_CONFIG) {
  const source = config && typeof config === 'object' ? config : DEFAULT_DATE_SORT_CONFIG;
  const sortAlbumsByName = Boolean(source.sortAlbumsByName);

  return {
    sortAlbumsByName,
    sortAlbumTracks: sortAlbumsByName && Boolean(source.sortAlbumTracks)
  };
}

function compareAlbumTrackOrder(a, b) {
  const discA = a.albumDiscNo || 0;
  const discB = b.albumDiscNo || 0;
  if (discA !== discB) {
    if (!discA) return 1;
    if (!discB) return -1;
    return discA - discB;
  }

  const trackA = a.albumTrackNo || 0;
  const trackB = b.albumTrackNo || 0;
  if (trackA !== trackB) {
    if (!trackA) return 1;
    if (!trackB) return -1;
    return trackA - trackB;
  }

  return 0;
}

function isSameAlbum(a, b) {
  if (a.albumId && b.albumId) return a.albumId === b.albumId;
  return (a.album || '') === (b.album || '');
}

export function cmpByDate(descending, config = DEFAULT_DATE_SORT_CONFIG) {
  const normalizedConfig = normalizeDateSortConfig(config);

  return (a, b) => {
    // 先按发行时间排序
    const timeA = a.publishTime || 0;
    const timeB = b.publishTime || 0;

    if (timeA !== timeB) {
      return descending ? (timeB - timeA) : (timeA - timeB);
    }

    if (normalizedConfig.sortAlbumsByName) {
      const albumResult = collator.compare(a.album || '', b.album || '');
      if (albumResult) return albumResult;

      if (normalizedConfig.sortAlbumTracks && isSameAlbum(a, b)) {
        const trackResult = compareAlbumTrackOrder(a, b);
        if (trackResult) return trackResult;
      }
    }

    // 发行时间相同则按标题排序
    return cmpByTitle(a, b);
  };
}
