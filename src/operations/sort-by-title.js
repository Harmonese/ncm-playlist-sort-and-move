import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { cmpByTitle } from '../sort/title.js';
import { swalClasses } from '../ui/styles.js';

export async function sortByTitle(pid) {
  showToast('开始获取歌单歌曲...');
  const { playlist, items } = await getAllSongs(pid);

  showToast(`获取完成：${items.length} 首，开始排序...`);
  const ordered = items.slice().sort(cmpByTitle).map(x => x.id);

  showToast('写回歌单顺序(op=update)...');
  const res = await updatePlaylistOrder(pid, ordered);
  if (res && res.code === 200) {
    Swal.fire({
      icon: 'success',
      title: '排序完成',
      text: `${playlist.name}\n共 ${ordered.length} 首\n刷新页面查看新顺序`,
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
