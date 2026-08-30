import {
  DEFAULT_TITLE_SORT_CONFIG,
  normalizeTitleSortConfig
} from '../sort/title.js';

const TITLE_SORT_SETTINGS_KEY = 'ncm-playlist-sort:title-sort-config';

function readStoredValue() {
  if (typeof globalThis.GM_getValue === 'function') {
    return globalThis.GM_getValue(TITLE_SORT_SETTINGS_KEY, null);
  }

  if (typeof globalThis.GM?.getValue === 'function') {
    return globalThis.GM.getValue(TITLE_SORT_SETTINGS_KEY, null);
  }

  if (globalThis.localStorage) {
    const raw = globalThis.localStorage.getItem(TITLE_SORT_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  return null;
}

function writeStoredValue(value) {
  if (typeof globalThis.GM_setValue === 'function') {
    return Promise.resolve(
      globalThis.GM_setValue(TITLE_SORT_SETTINGS_KEY, value)
    ).then(() => true);
  }

  if (typeof globalThis.GM?.setValue === 'function') {
    return Promise.resolve(
      globalThis.GM.setValue(TITLE_SORT_SETTINGS_KEY, value)
    ).then(() => true);
  }

  if (globalThis.localStorage) {
    globalThis.localStorage.setItem(TITLE_SORT_SETTINGS_KEY, JSON.stringify(value));
    return true;
  }

  return false;
}

export async function loadTitleSortConfig() {
  try {
    const stored = await Promise.resolve(readStoredValue());
    return normalizeTitleSortConfig(stored);
  } catch (error) {
    console.warn('[NCM-SORT] 读取标题排序设置失败，使用默认设置', error);
    return normalizeTitleSortConfig(DEFAULT_TITLE_SORT_CONFIG);
  }
}

export async function saveTitleSortConfig(config) {
  const normalized = normalizeTitleSortConfig(config);

  try {
    return await Promise.resolve(writeStoredValue(normalized));
  } catch (error) {
    console.warn('[NCM-SORT] 保存标题排序设置失败', error);
    return false;
  }
}
