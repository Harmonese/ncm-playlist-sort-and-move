import { sortByTitle } from '../operations/sort-by-title.js';
import { sortByPublishDate } from '../operations/sort-by-date.js';
import { sortByArtist } from '../operations/sort-by-artist.js';
import { sortByHeat } from '../operations/sort-by-heat.js';
import { sortByRandom } from '../operations/sort-by-random.js';
import { manualSortSongs } from '../operations/manual-sort.js';
import { batchMoveSongs } from '../operations/batch-move.js';
import { batchDeleteSongs } from '../operations/batch-delete.js';
import { restoreLastOrder } from '../operations/restore-order.js';
import { editPlaylistScript } from '../operations/playlist-script.js';
import { loadOrderBackup } from '../settings/order-backup.js';
import { swalClasses } from './styles.js';

export async function showFunctionMenu(pid) {
  const backup = await loadOrderBackup();
  const canRestore = backup?.pid === String(pid);
  const result = await Swal.fire({
    title: '歌单排序工具',
    html: `
      <div class="ncm-sort-menu">
        <button id="playlist-script" class="ncm-sort-menu-button">歌单编排脚本</button>
        <button id="sort-by-title" class="ncm-sort-menu-button">按标题排序</button>
        <button id="sort-by-date" class="ncm-sort-menu-button">按发行日期排序</button>
        <button id="sort-by-artist" class="ncm-sort-menu-button">按歌手排序</button>
        <button id="sort-by-heat" class="ncm-sort-menu-button">按热度排序</button>
        <button id="sort-by-random" class="ncm-sort-menu-button">随机排序</button>
        <button id="manual-sort" class="ncm-sort-menu-button">手动排序</button>
        ${canRestore ? '<button id="restore-last-order" class="ncm-sort-menu-button">恢复上次操作前顺序</button>' : ''}
        <button id="batch-move" class="ncm-sort-menu-button">批量移动歌曲</button>
        <button id="batch-delete" class="ncm-sort-menu-button ncm-sort-menu-button-danger">批量删除歌曲</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    customClass: swalClasses,
    didOpen: () => {
      document.getElementById('playlist-script').addEventListener('click', async () => {
        Swal.close();
        try {
          await editPlaylistScript(pid);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'error',
            title: '出错',
            text: e?.message || String(e),
            customClass: swalClasses
          });
        }
      });

      document.getElementById('sort-by-title').addEventListener('click', async () => {
        Swal.close();
        try {
          await sortByTitle(pid);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'error',
            title: '出错',
            text: e?.message || String(e),
            customClass: swalClasses
          });
        }
      });

      document.getElementById('sort-by-date').addEventListener('click', async () => {
        Swal.close();
        try {
          await sortByPublishDate(pid);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'error',
            title: '出错',
            text: e?.message || String(e),
            customClass: swalClasses
          });
        }
      });

      document.getElementById('sort-by-artist').addEventListener('click', async () => {
        Swal.close();
        try {
          await sortByArtist(pid);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'error',
            title: '出错',
            text: e?.message || String(e),
            customClass: swalClasses
          });
        }
      });

      document.getElementById('sort-by-heat').addEventListener('click', async () => {
        Swal.close();
        try {
          await sortByHeat(pid);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'error',
            title: '出错',
            text: e?.message || String(e),
            customClass: swalClasses
          });
        }
      });

      document.getElementById('sort-by-random').addEventListener('click', async () => {
        Swal.close();
        try {
          await sortByRandom(pid);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'error',
            title: '出错',
            text: e?.message || String(e),
            customClass: swalClasses
          });
        }
      });

      document.getElementById('manual-sort').addEventListener('click', async () => {
        Swal.close();
        try {
          await manualSortSongs(pid);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'error',
            title: '出错',
            text: e?.message || String(e),
            customClass: swalClasses
          });
        }
      });

      if (canRestore) {
        document.getElementById('restore-last-order').addEventListener('click', async () => {
          Swal.close();
          try {
            await restoreLastOrder(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: 'error',
              title: '出错',
              text: e?.message || String(e),
              customClass: swalClasses
            });
          }
        });
      }

      document.getElementById('batch-move').addEventListener('click', async () => {
        Swal.close();
        try {
          await batchMoveSongs(pid);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'error',
            title: '出错',
            text: e?.message || String(e),
            customClass: swalClasses
          });
        }
      });

      document.getElementById('batch-delete').addEventListener('click', async () => {
        Swal.close();
        try {
          await batchDeleteSongs(pid);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'error',
            title: '出错',
            text: e?.message || String(e),
            customClass: swalClasses
          });
        }
      });
    }
  });
}
