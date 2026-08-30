import { DEFAULT_DATE_SORT_CONFIG, normalizeDateSortConfig } from '../sort/date.js';
import { readStoredValue, writeStoredValue } from './storage.js';

export const DATE_SORT_SETTINGS_KEY = 'ncm-playlist-sort:date-sort-config';

export const DEFAULT_DATE_SORT_SETTINGS = Object.freeze({
  descending: true,
  ...DEFAULT_DATE_SORT_CONFIG
});

export function normalizeDateSortSettings(settings = DEFAULT_DATE_SORT_SETTINGS) {
  const source = settings && typeof settings === 'object'
    ? settings
    : DEFAULT_DATE_SORT_SETTINGS;

  return {
    descending: source.descending !== false,
    ...normalizeDateSortConfig(source)
  };
}

export async function loadDateSortSettings() {
  try {
    const stored = await Promise.resolve(readStoredValue(DATE_SORT_SETTINGS_KEY));
    return normalizeDateSortSettings(stored);
  } catch (error) {
    console.warn('[NCM-SORT] 读取发行日期排序设置失败，使用默认设置', error);
    return normalizeDateSortSettings(DEFAULT_DATE_SORT_SETTINGS);
  }
}

export async function saveDateSortSettings(settings) {
  const normalized = normalizeDateSortSettings(settings);

  try {
    return await Promise.resolve(writeStoredValue(DATE_SORT_SETTINGS_KEY, normalized));
  } catch (error) {
    console.warn('[NCM-SORT] 保存发行日期排序设置失败', error);
    return false;
  }
}
