import { showToast } from '../utils/dom.js';
import { fetchPlaylistDetail, updatePlaylistOrder } from '../ncm/api.js';
import { getPlaylistTrackIds } from '../data/playlist.js';
import { clearOrderBackup, loadOrderBackup } from '../settings/order-backup.js';
import { showRestoreOrderDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';

function countIds(ids) {
  const counts = new Map();
  for (const id of ids) {
    const key = String(id);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function sameSongSet(currentIds, backupIds) {
  if (currentIds.length !== backupIds.length) return false;

  const currentCounts = countIds(currentIds);
  const backupCounts = countIds(backupIds);
  if (currentCounts.size !== backupCounts.size) return false;

  for (const [id, count] of currentCounts) {
    if (backupCounts.get(id) !== count) return false;
  }

  return true;
}

export async function restoreLastOrder(pid) {
  const backup = await loadOrderBackup();
  if (!backup || backup.pid !== String(pid)) {
    Swal.fire({
      icon: 'info',
      title: '没有可恢复的顺序',
      text: '当前歌单还没有成功排序过，或备份属于其他歌单。',
      customClass: swalClasses
    });
    return;
  }

  const confirmation = await showRestoreOrderDialog(backup);
  if (!confirmation.isConfirmed) return;

  try {
    showToast('正在检查当前歌单是否仍可恢复...');
    const detail = await fetchPlaylistDetail(pid);
    if (!detail || detail.code !== 200) {
      throw new Error('playlist/detail failed: ' + JSON.stringify(detail));
    }

    const currentIds = getPlaylistTrackIds(detail.playlist);
    if (!sameSongSet(currentIds, backup.songIds)) {
      Swal.fire({
        icon: 'warning',
        title: '无法安全恢复',
        text: '当前歌单的歌曲数量或内容已经变化，备份仍会保留。',
        customClass: swalClasses
      });
      return;
    }

    showToast('正在恢复排序前的歌单顺序...');
    const result = await updatePlaylistOrder(pid, backup.songIds);
    if (!result || result.code !== 200) {
      Swal.fire({
        icon: 'error',
        title: '恢复失败',
        text: JSON.stringify(result),
        customClass: swalClasses
      });
      return;
    }

    await clearOrderBackup();
    Swal.fire({
      icon: 'success',
      title: '恢复完成',
      text: `${backup.playlistName || '当前歌单'}\n已恢复排序前的歌曲顺序\n刷新页面查看新顺序`,
      customClass: swalClasses
    });
  } catch (error) {
    console.error(error);
    Swal.fire({
      icon: 'error',
      title: '恢复出错',
      text: error?.message || String(error),
      customClass: swalClasses
    });
  }
}
