import { showToast } from '../utils/dom.js';
import { deleteSongsFromPlaylist } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { showBatchDeleteDialog, showDeleteConfirmation } from '../ui/dialogs.js';

export async function batchDeleteSongs(pid) {
  const result = await showBatchDeleteDialog();
  if (!result.isConfirmed) return;

  const { start, end } = result.value;

  showToast('开始获取歌单歌曲...');
  const { playlist, items } = await getAllSongs(pid);
  const totalCount = items.length;

  if (start > totalCount || end > totalCount) {
    Swal.fire({
      icon: 'error',
      title: '位置超出范围',
      text: `歌单共有 ${totalCount} 首歌曲，输入的位置不能超过此范围`
    });
    return;
  }

  const startIdx = start - 1;
  const endIdx = end - 1;
  const toDeleteCount = endIdx - startIdx + 1;
  const toDeleteIds = items.slice(startIdx, endIdx + 1).map(x => x.id);

  // 二次确认
  const confirm2 = await showDeleteConfirmation(toDeleteCount, start, end);

  if (!confirm2.isConfirmed) return;

  showToast('正在删除歌曲...');
  const res = await deleteSongsFromPlaylist(pid, toDeleteIds);

  if (res && res.code === 200) {
    Swal.fire({
      icon: 'success',
      title: '删除完成',
      html: `已删除 ${toDeleteCount} 首歌曲<br>刷新页面查看结果`
    });
  } else {
    Swal.fire({
      icon: 'error',
      title: '删除失败',
      text: JSON.stringify(res)
    });
  }
}
