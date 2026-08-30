import {
  DEFAULT_TITLE_SORT_CONFIG,
  normalizeTitleSortConfig
} from '../sort/title.js';
import {
  DEFAULT_ARTIST_SORT_CONFIG,
  normalizeArtistSortConfig
} from '../sort/artist.js';
import { readStoredValue, writeStoredValue } from './storage.js';

export const ARTIST_SORT_SETTINGS_KEY = 'ncm-playlist-sort:artist-sort-config';

export const DEFAULT_ARTIST_SORT_SETTINGS = Object.freeze({
  ...DEFAULT_ARTIST_SORT_CONFIG,
  useTitleSortConfig: true,
  customTextConfig: DEFAULT_TITLE_SORT_CONFIG
});

export function normalizeArtistSortSettings(settings = DEFAULT_ARTIST_SORT_SETTINGS) {
  const source = settings && typeof settings === 'object'
    ? settings
    : DEFAULT_ARTIST_SORT_SETTINGS;
  const artistConfig = normalizeArtistSortConfig(source);

  return {
    ...artistConfig,
    useTitleSortConfig: source.useTitleSortConfig !== false,
    customTextConfig: normalizeTitleSortConfig(source.customTextConfig)
  };
}

export async function loadArtistSortSettings() {
  try {
    const stored = await Promise.resolve(readStoredValue(ARTIST_SORT_SETTINGS_KEY));
    return normalizeArtistSortSettings(stored);
  } catch (error) {
    console.warn('[NCM-SORT] 读取歌手排序设置失败，使用默认设置', error);
    return normalizeArtistSortSettings(DEFAULT_ARTIST_SORT_SETTINGS);
  }
}

export async function saveArtistSortSettings(settings) {
  const normalized = normalizeArtistSortSettings(settings);

  try {
    return await Promise.resolve(writeStoredValue(ARTIST_SORT_SETTINGS_KEY, normalized));
  } catch (error) {
    console.warn('[NCM-SORT] 保存歌手排序设置失败', error);
    return false;
  }
}
