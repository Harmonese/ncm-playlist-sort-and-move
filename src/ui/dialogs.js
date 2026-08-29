export async function showDateSortDialog(pid, performDateSort) {
  const result = await Swal.fire({
    title: '按发行日期排序',
    html: `
      <div style="text-align: left; margin-bottom: 15px;">
        <p>选择排序方式：</p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="sort-desc" class="swal2-styled" style="width: 100%;">从新到旧（倒序）</button>
        <button id="sort-asc" class="swal2-styled" style="width: 100%;">从旧到新（顺序）</button>
      </div>
    `,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: '取消',
    didOpen: () => {
      document.getElementById('sort-desc').addEventListener('click', () => {
        Swal.close();
        performDateSort(pid, true);
      });
      document.getElementById('sort-asc').addEventListener('click', () => {
        Swal.close();
        performDateSort(pid, false);
      });
    }
  });
}

export function showBatchMoveDialog() {
  return Swal.fire({
    title: '批量移动歌曲',
    html: `
      <div style="text-align: left; margin-bottom: 15px;">
        <p>输入三个数字来移动歌曲：</p>
        <p style="color: #666; font-size: 13px;">
          例如：2, 6, 10<br>
          表示将序号 2-6 的歌曲移到序号 10 的歌曲后面
        </p>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <div style="flex: 1;">
          <label>起始位置：</label>
          <input id="start-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="起始">
        </div>
        <div style="flex: 1;">
          <label>结束位置：</label>
          <input id="end-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="结束">
        </div>
        <div style="flex: 1;">
          <label>目标位置：</label>
          <input id="target-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="目标">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '开始移动',
    cancelButtonText: '取消',
    focusConfirm: false,
    preConfirm: () => {
      const start = parseInt(document.getElementById('start-pos').value);
      const end = parseInt(document.getElementById('end-pos').value);
      const target = parseInt(document.getElementById('target-pos').value);

      if (isNaN(start) || isNaN(end) || isNaN(target)) {
        Swal.showValidationMessage('请输入有效的数字');
        return false;
      }

      if (start < 1 || end < 1 || target < 1) {
        Swal.showValidationMessage('位置必须大于等于 1');
        return false;
      }

      if (start > end) {
        Swal.showValidationMessage('起始位置不能大于结束位置');
        return false;
      }

      return { start, end, target };
    }
  });
}

export function showBatchDeleteDialog() {
  return Swal.fire({
    title: '批量删除歌曲',
    html: `
      <div style="text-align: left; margin-bottom: 15px;">
        <p>输入两个数字来删除歌曲：</p>
        <p style="color: #666; font-size: 13px;">
          例如：2, 6<br>
          表示删除序号 2-6（包含）的所有歌曲
        </p>
        <p style="color: #e74c3c; font-size: 13px;">
          ⚠️ 此操作不可撤销，请谨慎操作！
        </p>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <div style="flex: 1;">
          <label>起始位置：</label>
          <input id="del-start-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="起始">
        </div>
        <div style="flex: 1;">
          <label>结束位置：</label>
          <input id="del-end-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="结束">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#e74c3c',
    focusConfirm: false,
    preConfirm: () => {
      const start = parseInt(document.getElementById('del-start-pos').value);
      const end = parseInt(document.getElementById('del-end-pos').value);

      if (isNaN(start) || isNaN(end)) {
        Swal.showValidationMessage('请输入有效的数字');
        return false;
      }

      if (start < 1 || end < 1) {
        Swal.showValidationMessage('位置必须大于等于 1');
        return false;
      }

      if (start > end) {
        Swal.showValidationMessage('起始位置不能大于结束位置');
        return false;
      }

      return { start, end };
    }
  });
}

export function showDeleteConfirmation(toDeleteCount, start, end) {
  return Swal.fire({
    title: '确认删除',
    html: `即将删除 <strong>${toDeleteCount}</strong> 首歌曲（位置 ${start}-${end}）<br><br>此操作不可撤销，确定继续？`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#e74c3c'
  });
}
