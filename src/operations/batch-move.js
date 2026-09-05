import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { moveSongRange } from '../data/playlist-plan.js';
import { showBatchMoveDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';
import { saveOrderBackup } from '../settings/order-backup.js';

export async function batchMoveSongs(pid) {
  const result = await showBatchMoveDialog();
  if (!result.isConfirmed) return;

  const { start, end, target } = result.value;

  showToast('开始获取歌单歌曲...');
  const { playlist, items, originalSongIds } = await getAllSongs(pid);
  const totalCount = items.length;

  if (start > totalCount || end > totalCount || target > totalCount) {
    Swal.fire({
      icon: 'error',
      title: '位置超出范围',
      text: `歌单共有 ${totalCount} 首歌曲，输入的位置不能超过此范围`,
      customClass: swalClasses
    });
    return;
  }

  if (target > start - 1 && target < end) {
    Swal.fire({
      icon: 'error',
      title: '目标位置无效',
      text: `目标位置（${target}）不能位于移动区间内部`,
      customClass: swalClasses
    });
    return;
  }

  const orderedIds = moveSongRange(items.map(item => item.id), start, end, target);

  const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: 'move' });
  showToast('写回歌单顺序...');
  const res = await updatePlaylistOrder(pid, orderedIds);

  if (res && res.code === 200) {
    Swal.fire({
      icon: 'success',
      title: '移动完成',
      html: `已将位置 ${start}-${end} 的歌曲${target === 0 ? '移到歌单最前面' : `移到位置 ${target} 后面`}<br>${backupSaved ? '可从工具菜单恢复移动前顺序<br>' : ''}刷新页面查看新顺序`,
      customClass: swalClasses
    });
  } else {
    Swal.fire({
      icon: 'error',
      title: '移动失败',
      text: JSON.stringify(res),
      customClass: swalClasses
    });
  }
}
