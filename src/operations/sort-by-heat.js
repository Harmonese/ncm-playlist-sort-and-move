import { showToast } from '../utils/dom.js';
import { updatePlaylistOrder } from '../ncm/api.js';
import { getAllSongs } from '../data/playlist.js';
import { ensureHeatMetric } from '../data/heat.js';
import { HEAT_SORT_METRICS, sortSongsByHeat } from '../sort/heat.js';
import { loadHeatSortConfig, saveHeatSortConfig } from '../settings/heat-sort.js';
import { showHeatSortDialog } from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';
import { saveOrderBackup } from '../settings/order-backup.js';

export async function sortByHeat(pid) {
  const savedConfig = await loadHeatSortConfig();
  const result = await showHeatSortDialog(savedConfig);
  if (!result.isConfirmed) return;

  try {
    await saveHeatSortConfig(result.value);
    showToast('开始获取歌单歌曲...');
    const { playlist, items, originalSongIds } = await getAllSongs(pid);
    let failed = 0;

    const summary = await ensureHeatMetric(items, result.value.metric);
    failed = summary.failed;

    showToast(`获取完成：${items.length} 首，开始排序...`);
    const ordered = sortSongsByHeat(items, result.value).map(item => item.id);

    const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name);
    showToast('写回歌单顺序(op=update)...');
    const res = await updatePlaylistOrder(pid, ordered);

    if (res && res.code === 200) {
      const metricLabel = HEAT_SORT_METRICS.find(metric => metric.id === result.value.metric)?.label || '热度指标';
      const directionLabel = result.value.descending ? '降序' : '升序';
      const failureText = failed ? `\n${failed} 首歌曲的${metricLabel}获取失败，已排在末尾` : '';
      Swal.fire({
        icon: 'success',
        title: '排序完成',
        text: `${playlist.name}\n共 ${ordered.length} 首\n按${metricLabel}${directionLabel}排列${failureText}\n${backupSaved ? '可从工具菜单恢复排序前顺序\n' : ''}刷新页面查看新顺序`,
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
