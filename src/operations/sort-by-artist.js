import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { ensurePublishTimes } from '../data/publish-time.js';
import { sortSongsByArtist } from '../sort/artist.js';
import { saveTitleSortConfig } from '../settings/title-sort.js';
import { loadArtistSortSettings, saveArtistSortSettings } from '../settings/artist-sort.js';
import { loadDateSortSettings, saveDateSortSettings } from '../settings/date-sort.js';
import { showArtistSortDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';
import { detectTextCategoryIds } from '../sort/title.js';
import { saveOrderBackup } from '../settings/order-backup.js';

export async function sortByArtist(pid) {
  const artistSettings = await loadArtistSortSettings();

  showToast('开始获取歌单歌曲...');
  const { playlist, items, originalSongIds } = await getAllSongs(pid);
  const categoryIds = detectTextCategoryIds(items.map(item => item.artist || ''));
  const result = await showArtistSortDialog(categoryIds, artistSettings);
  if (!result.isConfirmed) return;

  try {
    await saveTitleSortConfig(result.value.textSortConfig);
    await saveArtistSortSettings(result.value);
    await saveDateSortSettings(result.value.dateSortConfig);

    if (result.value.sortSameArtistByDate) {
      await ensurePublishTimes(items);
    }

    showToast(`获取完成：${items.length} 首，开始排序...`);
    const dateSortConfig = await loadDateSortSettings();
    const orderedItems = sortSongsByArtist(
      items,
      result.value,
      result.value.textSortConfig,
      dateSortConfig
    );
    const ordered = orderedItems.map(item => item.id);

    const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: 'sort' });
    showToast('写回歌单顺序(op=update)...');
    const res = await updatePlaylistOrder(pid, ordered);

    if (res && res.code === 200) {
      Swal.fire({
        icon: 'success',
        title: '排序完成',
        text: `${playlist.name}\n共 ${ordered.length} 首\n按歌手${result.value.sortSameArtistByDate ? `及发行日期（${dateSortConfig.descending ? '从新到旧' : '从旧到新'}）` : ''}排列\n${backupSaved ? '可从工具菜单恢复排序前顺序\n' : ''}刷新页面查看新顺序`,
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
