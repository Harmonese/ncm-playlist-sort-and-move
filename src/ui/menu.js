import { sortByTitle } from '../operations/sort-by-title.js';
import { sortByPublishDate } from '../operations/sort-by-date.js';
import { sortByArtist } from '../operations/sort-by-artist.js';
import { batchMoveSongs } from '../operations/batch-move.js';
import { batchDeleteSongs } from '../operations/batch-delete.js';
import { swalClasses } from './styles.js';

export async function showFunctionMenu(pid) {
  const result = await Swal.fire({
    title: '歌单排序工具',
    html: `
      <div class="ncm-sort-menu">
        <button id="sort-by-title" class="ncm-sort-menu-button">按标题排序</button>
        <button id="sort-by-date" class="ncm-sort-menu-button">按发行日期排序</button>
        <button id="sort-by-artist" class="ncm-sort-menu-button">按歌手排序</button>
        <button id="batch-move" class="ncm-sort-menu-button">批量移动歌曲</button>
        <button id="batch-delete" class="ncm-sort-menu-button ncm-sort-menu-button-danger">批量删除歌曲</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    customClass: swalClasses,
    didOpen: () => {
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
