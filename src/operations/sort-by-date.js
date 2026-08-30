import { sleep, showToast } from '../utils/dom.js';
import { fetchAlbumDetail, updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { cmpByDate } from '../sort/date.js';
import { showDateSortDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';

export async function sortByPublishDate(pid) {
  const result = await showDateSortDialog(pid, performDateSort);
}

export async function performDateSort(pid, descending) {
  try {
    showToast('开始获取歌单歌曲...');
    const { playlist, items } = await getAllSongs(pid);

    // 获取专辑发行时间（对于没有publishTime的歌曲）
    const albumCache = {};
    const needAlbumFetch = items.filter(item => !item.publishTime && item.albumId > 0);

    if (needAlbumFetch.length > 0) {
      showToast(`获取 ${needAlbumFetch.length} 首歌曲的专辑信息...`);
      for (let i = 0; i < needAlbumFetch.length; i++) {
        const item = needAlbumFetch[i];
        if (!albumCache[item.albumId]) {
          try {
            const albumDetail = await fetchAlbumDetail(item.albumId);
            if (albumDetail && albumDetail.code === 200) {
              albumCache[item.albumId] = albumDetail.album.publishTime || 0;
            }
            await sleep(100);
          } catch (e) {
            console.error(`获取专辑 ${item.albumId} 失败:`, e);
          }
        }
        item.publishTime = albumCache[item.albumId] || 0;

        if ((i + 1) % 10 === 0) {
          showToast(`获取专辑信息进度: ${i + 1}/${needAlbumFetch.length}`);
        }
      }
    }

    showToast(`获取完成：${items.length} 首，开始排序...`);
    const ordered = items.slice().sort(cmpByDate(descending)).map(x => x.id);

    showToast('写回歌单顺序(op=update)...');
    const res = await updatePlaylistOrder(pid, ordered);

    if (res && res.code === 200) {
      Swal.fire({
        icon: 'success',
        title: '排序完成',
        text: `${playlist.name}\n共 ${ordered.length} 首\n按发行日期${descending ? '倒序' : '顺序'}排列\n刷新页面查看新顺序`,
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
