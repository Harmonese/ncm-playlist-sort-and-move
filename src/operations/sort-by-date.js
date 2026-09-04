import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { ensurePublishTimes } from '../data/publish-time.js';
import { cmpByDate } from '../sort/date.js';
import { stableSort } from '../sort/order.js';
import { saveDateSortSettings } from '../settings/date-sort.js';
import { showDateSortDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';
import { saveOrderBackup } from '../settings/order-backup.js';

export async function sortByPublishDate(pid) {
  const result = await showDateSortDialog();
  if (!result.isConfirmed) return;

  await saveDateSortSettings(result.value);
  await performDateSort(pid, result.value.descending, result.value);
}

export async function performDateSort(pid, descending, dateSortConfig) {
  try {
    showToast('开始获取歌单歌曲...');
    const { playlist, items, originalSongIds } = await getAllSongs(pid);

    await ensurePublishTimes(items);

    showToast(`获取完成：${items.length} 首，开始排序...`);
    const ordered = stableSort(items, cmpByDate(descending, dateSortConfig)).map(x => x.id);

    const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: 'sort' });
    showToast('写回歌单顺序(op=update)...');
    const res = await updatePlaylistOrder(pid, ordered);

    if (res && res.code === 200) {
      Swal.fire({
        icon: 'success',
        title: '排序完成',
        text: `${playlist.name}\n共 ${ordered.length} 首\n按发行日期${descending ? '倒序' : '顺序'}排列\n${backupSaved ? '可从工具菜单恢复排序前顺序\n' : ''}刷新页面查看新顺序`,
        customClass: swalClasses
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: '排序失败',
        text: JSON.stringify(res),
        customClass: swalClasses
      });
    }
  } catch (e) {
    console.error(e);
    Swal.fire({
      icon: 'error',
      title: '出错',
      text: e?.message || String(e),
      customClass: swalClasses
    });
  }
}
