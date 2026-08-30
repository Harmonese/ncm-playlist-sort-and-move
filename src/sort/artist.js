import { createTextComparator } from './title.js';
import { cmpByDate } from './date.js';

export const DEFAULT_ARTIST_SORT_CONFIG = Object.freeze({
  sortArtistsByName: true,
  sortSameArtistByDate: false,
  descending: true
});

export function normalizeArtistSortConfig(config = DEFAULT_ARTIST_SORT_CONFIG) {
  const source = config && typeof config === 'object'
    ? config
    : DEFAULT_ARTIST_SORT_CONFIG;
  const sortArtistsByName = source.sortArtistsByName !== false;

  return {
    sortArtistsByName,
    sortSameArtistByDate: sortArtistsByName && Boolean(source.sortSameArtistByDate),
    descending: source.descending !== false
  };
}

export function createArtistComparator(
  config = DEFAULT_ARTIST_SORT_CONFIG,
  titleSortConfig
) {
  const normalizedConfig = normalizeArtistSortConfig(config);
  const compareArtist = createTextComparator(titleSortConfig);
  const compareDate = cmpByDate(normalizedConfig.descending);

  return (a, b) => {
    if (!normalizedConfig.sortArtistsByName) return 0;

    const artistResult = compareArtist(a.artist || '', b.artist || '');
    if (artistResult) return artistResult;

    if (normalizedConfig.sortSameArtistByDate) {
      return compareDate(a, b);
    }

    return 0;
  };
}

export function sortSongsByArtist(items, config, titleSortConfig) {
  const compare = createArtistComparator(config, titleSortConfig);

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map(({ item }) => item);
}
