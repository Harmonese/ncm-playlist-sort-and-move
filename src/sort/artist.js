import { createTextComparator } from './title.js';
import { cmpByDate } from './date.js';
import { getOriginalIndex } from './order.js';

export const DEFAULT_ARTIST_SORT_CONFIG = Object.freeze({
  sortArtistsByName: true,
  sortSameArtistByDate: false
});

export function normalizeArtistSortConfig(config = DEFAULT_ARTIST_SORT_CONFIG) {
  const source = config && typeof config === 'object'
    ? config
    : DEFAULT_ARTIST_SORT_CONFIG;
  const sortArtistsByName = source.sortArtistsByName !== false;

  return {
    sortArtistsByName,
    sortSameArtistByDate: Boolean(source.sortSameArtistByDate)
  };
}

export function sortSongsByArtist(items, config, textSortConfig, dateSortConfig) {
  const normalizedConfig = normalizeArtistSortConfig(config);
  const compareArtist = createTextComparator(textSortConfig);
  const compareDate = cmpByDate(
    dateSortConfig?.descending !== false,
    dateSortConfig
  );
  const groups = [];
  const groupsByArtist = new Map();

  items.forEach((item, index) => {
    const originalIndex = getOriginalIndex(item, index);
    const artist = item.artist || '';
    let group = groupsByArtist.get(artist);
    if (!group) {
      group = { artist, index: originalIndex, items: [] };
      groupsByArtist.set(artist, group);
      groups.push(group);
    }
    group.items.push({ item, index: originalIndex });
  });

  if (normalizedConfig.sortArtistsByName) {
    groups.sort((a, b) => compareArtist(a.artist, b.artist) || a.index - b.index);
  }

  return groups.flatMap(group => {
    if (normalizedConfig.sortSameArtistByDate) {
      group.items.sort((a, b) => compareDate(a.item, b.item) || a.index - b.index);
    }
    return group.items.map(({ item }) => item);
  });
}
