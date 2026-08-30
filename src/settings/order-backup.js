import { readStoredValue, writeStoredValue } from './storage.js';

export const ORDER_BACKUP_KEY = 'ncm-playlist-sort:last-order-backup';
const ORDER_BACKUP_OPERATIONS = new Set(['sort', 'move', 'delete']);

function normalizeBackup(backup) {
  if (!backup || typeof backup !== 'object') return null;
  if (backup.pid === null || backup.pid === undefined) return null;
  if (!Array.isArray(backup.songIds) || !backup.songIds.length) return null;

  const operation = ORDER_BACKUP_OPERATIONS.has(backup.operation)
    ? backup.operation
    : 'sort';
  const songIds = backup.songIds.map(id => String(id));
  const songIdSet = new Set(songIds);

  return {
    pid: String(backup.pid),
    playlistName: typeof backup.playlistName === 'string' ? backup.playlistName : '',
    operation,
    songIds,
    removedSongIds: operation === 'delete'
      ? [...new Set((backup.removedSongIds || []).map(id => String(id)))].filter(id => songIdSet.has(id))
      : [],
    createdAt: Number.isFinite(backup.createdAt) ? backup.createdAt : 0
  };
}

export async function loadOrderBackup() {
  try {
    const stored = await Promise.resolve(readStoredValue(ORDER_BACKUP_KEY));
    return normalizeBackup(stored);
  } catch (error) {
    console.warn('[NCM-SORT] 读取排序备份失败', error);
    return null;
  }
}

export async function saveOrderBackup(
  pid,
  songIds,
  playlistName = '',
  { operation = 'sort', removedSongIds = [] } = {}
) {
  const backup = normalizeBackup({
    pid,
    playlistName,
    operation,
    songIds,
    removedSongIds,
    createdAt: Date.now()
  });

  if (!backup) return false;

  try {
    return await Promise.resolve(writeStoredValue(ORDER_BACKUP_KEY, backup));
  } catch (error) {
    console.warn('[NCM-SORT] 保存排序备份失败', error);
    return false;
  }
}

export async function clearOrderBackup() {
  try {
    return await Promise.resolve(writeStoredValue(ORDER_BACKUP_KEY, null));
  } catch (error) {
    console.warn('[NCM-SORT] 清除排序备份失败', error);
    return false;
  }
}
