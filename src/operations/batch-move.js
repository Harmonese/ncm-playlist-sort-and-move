import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { showBatchMoveDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';

export async function batchMoveSongs(pid) {
  const result = await showBatchMoveDialog();
  if (!result.isConfirmed) return;

  const { start, end, target } = result.value;

  showToast('开始获取歌单歌曲...');
  const { playlist, items } = await getAllSongs(pid);
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

  if (target >= start && target <= end) {
    Swal.fire({
      icon: 'error',
      title: '目标位置无效',
      text: `目标位置（${target}）不能在起始位置（${start}）和结束位置（${end}）之间`,
      customClass: swalClasses
    });
    return;
  }

  const startIdx = start - 1;
  const endIdx = end - 1;
  const targetIdx = target - 1;

  const newOrder = [...items];
  const movedSongs = newOrder.splice(startIdx, endIdx - startIdx + 1);

  let insertIdx = targetIdx;
  if (targetIdx > endIdx) {
    insertIdx = targetIdx - movedSongs.length;
  }

  newOrder.splice(insertIdx + 1, 0, ...movedSongs);
  const orderedIds = newOrder.map(x => x.id);

  showToast('写回歌单顺序...');
  const res = await updatePlaylistOrder(pid, orderedIds);

  if (res && res.code === 200) {
    Swal.fire({
      icon: 'success',
      title: '移动完成',
      html: `已将位置 ${start}-${end} 的歌曲移到位置 ${target} 后面<br>刷新页面查看新顺序`,
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
