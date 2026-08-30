import { DEFAULT_HEAT_SORT_CONFIG, normalizeHeatSortConfig } from '../sort/heat.js';
import { readStoredValue, writeStoredValue } from './storage.js';

export const HEAT_SORT_SETTINGS_KEY = 'ncm-playlist-sort:heat-sort-config';

export async function loadHeatSortConfig() {
  try {
    const stored = await Promise.resolve(readStoredValue(HEAT_SORT_SETTINGS_KEY));
    return normalizeHeatSortConfig(stored);
  } catch (error) {
    console.warn('[NCM-SORT] 读取热度排序设置失败，使用默认设置', error);
    return normalizeHeatSortConfig(DEFAULT_HEAT_SORT_CONFIG);
  }
}

export async function saveHeatSortConfig(config) {
  const normalized = normalizeHeatSortConfig(config);

  try {
    return await Promise.resolve(writeStoredValue(HEAT_SORT_SETTINGS_KEY, normalized));
  } catch (error) {
    console.warn('[NCM-SORT] 保存热度排序设置失败', error);
    return false;
  }
}
