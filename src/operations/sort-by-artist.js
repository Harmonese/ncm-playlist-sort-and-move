import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { ensurePublishTimes } from '../data/publish-time.js';
import { sortSongsByArtist } from '../sort/artist.js';
import { loadTitleSortConfig } from '../settings/title-sort.js';
import { showArtistSortDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';

export async function sortByArtist(pid) {
  const result = await showArtistSortDialog();
  if (!result.isConfirmed) return;

  try {
    showToast('开始获取歌单歌曲...');
    const { playlist, items } = await getAllSongs(pid);

    if (result.value.sortSameArtistByDate) {
      await ensurePublishTimes(items);
    }

    showToast(`获取完成：${items.length} 首，开始排序...`);
    const titleSortConfig = await loadTitleSortConfig();
    const orderedItems = sortSongsByArtist(items, result.value, titleSortConfig);
    const ordered = orderedItems.map(item => item.id);

    showToast('写回歌单顺序(op=update)...');
    const res = await updatePlaylistOrder(pid, ordered);

    if (res && res.code === 200) {
      Swal.fire({
        icon: 'success',
        title: '排序完成',
        text: `${playlist.name}\n共 ${ordered.length} 首\n按歌手${result.value.sortSameArtistByDate ? '及发行日期' : ''}排列\n刷新页面查看新顺序`,
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
