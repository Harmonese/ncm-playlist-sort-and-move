import { sortByTitle } from '../operations/sort-by-title.js';
import { sortByPublishDate } from '../operations/sort-by-date.js';
import { batchMoveSongs } from '../operations/batch-move.js';
import { batchDeleteSongs } from '../operations/batch-delete.js';

export async function showFunctionMenu(pid) {
  const result = await Swal.fire({
    title: '歌单排序工具',
    html: `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="sort-by-title" class="swal2-styled" style="width: 100%;">按标题排序</button>
        <button id="sort-by-date" class="swal2-styled" style="width: 100%;">按发行日期排序</button>
        <button id="batch-move" class="swal2-styled" style="width: 100%;">批量移动歌曲</button>
        <button id="batch-delete" class="swal2-styled" style="width: 100%; background-color: #e74c3c;">批量删除歌曲</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: () => {
      document.getElementById('sort-by-title').addEventListener('click', async () => {
        Swal.close();
        if (confirm('将直接修改当前歌单内歌曲顺序（不可一键撤销）。继续？')) {
          try {
            await sortByTitle(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: 'error',
              title: '出错',
              text: e?.message || String(e)
            });
          }
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
            text: e?.message || String(e)
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
            text: e?.message || String(e)
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
            text: e?.message || String(e)
          });
        }
      });
    }
  });
}
