import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { shuffleItems } from '../sort/random.js';
import { swalClasses } from '../ui/styles.js';
import { saveOrderBackup } from '../settings/order-backup.js';

function sameOrder(left, right) {
  return left.length === right.length && left.every((id, index) => String(id) === String(right[index]));
}

export async function sortByRandom(pid) {
  if (!confirm('将随机打乱当前歌单顺序，排序后可从工具菜单恢复。继续？')) return;

  try {
    showToast('开始获取歌单歌曲...');
    const { playlist, items, originalSongIds } = await getAllSongs(pid);
    showToast(`获取完成：${items.length} 首，开始随机排序...`);
    const ordered = shuffleItems(items).map(item => item.id);

    if (sameOrder(ordered, originalSongIds)) {
      Swal.fire({
        icon: 'info',
        title: '随机结果与原顺序相同',
        text: `${playlist.name}\n未写回歌单`,
        customClass: swalClasses
      });
      return;
    }

    const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: 'sort' });
    showToast('写回歌单顺序(op=update)...');
    const response = await updatePlaylistOrder(pid, ordered);

    if (response && response.code === 200) {
      Swal.fire({
        icon: 'success',
        title: '随机排序完成',
        text: `${playlist.name}\n共 ${ordered.length} 首\n${backupSaved ? '可从工具菜单恢复随机排序前顺序\n' : ''}刷新页面查看新顺序`,
        customClass: swalClasses
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: '随机排序失败',
        text: JSON.stringify(response),
        customClass: swalClasses
      });
    }
  } catch (error) {
    console.error(error);
    Swal.fire({
      icon: 'error',
      title: '出错',
      text: error?.message || String(error),
      customClass: swalClasses
    });
  }
}
