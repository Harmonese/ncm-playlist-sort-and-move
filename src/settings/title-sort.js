import {
  DEFAULT_TITLE_SORT_CONFIG,
  normalizeTitleSortConfig
} from '../sort/title.js';
import { readStoredValue, writeStoredValue } from './storage.js';

export const TITLE_SORT_SETTINGS_KEY = 'ncm-playlist-sort:title-sort-config';

export async function loadTitleSortConfig() {
  try {
    const stored = await Promise.resolve(readStoredValue(TITLE_SORT_SETTINGS_KEY));
    return normalizeTitleSortConfig(stored);
  } catch (error) {
    console.warn('[NCM-SORT] 读取标题排序设置失败，使用默认设置', error);
    return normalizeTitleSortConfig(DEFAULT_TITLE_SORT_CONFIG);
  }
}

export async function saveTitleSortConfig(config) {
  const normalized = normalizeTitleSortConfig(config);

  try {
    return await Promise.resolve(writeStoredValue(TITLE_SORT_SETTINGS_KEY, normalized));
  } catch (error) {
    console.warn('[NCM-SORT] 保存标题排序设置失败', error);
    return false;
  }
}
