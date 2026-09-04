import { readStoredValue, writeStoredValue } from './storage.js';

export const PLAYLIST_SCRIPT_SETTINGS_PREFIX = 'ncm-playlist-sort:playlist-script:';

function getKey(pid) {
  return `${PLAYLIST_SCRIPT_SETTINGS_PREFIX}${String(pid)}`;
}

function normalizeIds(ids) {
  return Array.isArray(ids) ? ids.map(id => String(id)) : [];
}

function normalizeSavedScript(pid, value) {
  if (!value || typeof value !== 'object' || typeof value.scriptText !== 'string') return null;

  const scriptText = value.scriptText.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const appliedScriptText = typeof value.appliedScriptText === 'string'
    ? value.appliedScriptText.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    : scriptText;

  return {
    pid: String(pid),
    scriptText,
    appliedScriptText,
    appliedSongIds: normalizeIds(value.appliedSongIds),
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : 0
  };
}

export async function loadPlaylistScript(pid) {
  try {
    const value = await Promise.resolve(readStoredValue(getKey(pid)));
    return normalizeSavedScript(pid, value);
  } catch (error) {
    console.warn('[NCM-SORT] 读取歌单编排脚本失败', error);
    return null;
  }
}

export async function savePlaylistScript(pid, {
  scriptText,
  appliedSongIds,
  appliedScriptText = scriptText
}) {
  const value = normalizeSavedScript(pid, {
    scriptText,
    appliedSongIds,
    appliedScriptText,
    updatedAt: Date.now()
  });
  if (!value) return false;

  try {
    return await Promise.resolve(writeStoredValue(getKey(pid), value));
  } catch (error) {
    console.warn('[NCM-SORT] 保存歌单编排脚本失败', error);
    return false;
  }
}

export async function clearPlaylistScript(pid) {
  try {
    return await Promise.resolve(writeStoredValue(getKey(pid), null));
  } catch (error) {
    console.warn('[NCM-SORT] 清除歌单编排脚本失败', error);
    return false;
  }
}
