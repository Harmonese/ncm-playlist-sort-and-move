import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { showManualSortDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';
import { saveOrderBackup } from '../settings/order-backup.js';

function sameOrder(left, right) {
  return left.length === right.length && left.every((id, index) => String(id) === String(right[index]));
}

export async function manualSortSongs(pid) {
  showToast('开始获取歌单歌曲...');
  const { playlist, items, originalSongIds } = await getAllSongs(pid);
  const result = await showManualSortDialog(items);

  if (!result.isConfirmed) return;

  const orderedSongIds = result.value?.orderedSongIds || [];
  if (orderedSongIds.length !== items.length) {
    throw new Error('手动排序列表与歌单歌曲数量不一致，请重试');
  }

  if (sameOrder(orderedSongIds, originalSongIds)) {
    Swal.fire({
      icon: 'info',
      title: '顺序未改变',
      text: `${playlist.name}\n未写回歌单`,
      customClass: swalClasses
    });
    return;
  }

  const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: 'sort' });
  showToast('写回歌单顺序(op=update)...');
  const response = await updatePlaylistOrder(pid, orderedSongIds);

  if (response && response.code === 200) {
    Swal.fire({
      icon: 'success',
      title: '排序完成',
      text: `${playlist.name}\n共 ${orderedSongIds.length} 首\n${backupSaved ? '可从工具菜单恢复排序前顺序\n' : ''}刷新页面查看新顺序`,
      customClass: swalClasses
    });
  } else {
    Swal.fire({
      icon: 'error',
      title: '排序失败',
      text: JSON.stringify(response),
      customClass: swalClasses
    });
  }
}
