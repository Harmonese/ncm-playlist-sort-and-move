import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { createTitleComparator, detectTextCategoryIds } from '../sort/title.js';
import { saveTitleSortConfig } from '../settings/title-sort.js';
import { showTitleSortDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';
import { saveOrderBackup } from '../settings/order-backup.js';

export async function sortByTitle(pid) {
  showToast('开始获取歌单歌曲并识别文字体系...');
  const { playlist, items, originalSongIds } = await getAllSongs(pid);
  const categoryIds = detectTextCategoryIds(items.map(item => item.title || ''));
  const settings = await showTitleSortDialog(categoryIds);

  if (!settings.isConfirmed) return;

  await saveTitleSortConfig(settings.value);

  if (!confirm('将直接修改当前歌单内歌曲顺序，排序后可从工具菜单恢复。继续？')) return;

  showToast(`获取完成：${items.length} 首，开始排序...`);
  const ordered = items.slice().sort(createTitleComparator(settings.value)).map(x => x.id);

  const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name);
  showToast('写回歌单顺序(op=update)...');
  const res = await updatePlaylistOrder(pid, ordered);
  if (res && res.code === 200) {
    Swal.fire({
      icon: 'success',
      title: '排序完成',
      text: `${playlist.name}\n共 ${ordered.length} 首\n${backupSaved ? '可从工具菜单恢复排序前顺序\n' : ''}刷新页面查看新顺序`,
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
}
