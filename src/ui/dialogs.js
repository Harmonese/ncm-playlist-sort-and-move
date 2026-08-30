import { dangerSwalClasses, swalClasses } from './styles.js';
import {
  TITLE_CATEGORIES,
  TITLE_CHINESE_SORTS
} from '../sort/title.js';
import { loadTitleSortConfig } from '../settings/title-sort.js';
import { loadArtistSortSettings } from '../settings/artist-sort.js';
import { loadDateSortSettings } from '../settings/date-sort.js';
import { HEAT_SORT_METRICS, normalizeHeatSortConfig } from '../sort/heat.js';

function getVisibleTextCategories(categoryIds) {
  const requestedIds = Array.isArray(categoryIds)
    ? new Set(categoryIds)
    : new Set(TITLE_CATEGORIES.map(category => category.id));
  const categories = TITLE_CATEGORIES.filter(category => requestedIds.has(category.id));

  return categories.length
    ? categories
    : [TITLE_CATEGORIES.find(category => category.id === 'other')];
}

function orderTitleCategories(categories, savedOrder) {
  const visibleIds = new Set(categories.map(category => category.id));
  const ordered = [];

  for (const categoryId of savedOrder) {
    const category = categories.find(item => item.id === categoryId);
    if (visibleIds.has(categoryId) && category && !ordered.includes(category)) {
      ordered.push(category);
    }
  }

  for (const category of categories) {
    if (!ordered.includes(category)) ordered.push(category);
  }

  return ordered;
}

function createTitleCategoryList(categories) {
  return categories.map((category, index) => `
    <li class="ncm-sort-priority-item" data-category="${category.id}">
      <span class="ncm-sort-priority-name">
        <span class="ncm-sort-priority-index">${index + 1}</span>
        ${category.label}
      </span>
      <span class="ncm-sort-priority-actions">
        <button type="button" class="ncm-sort-icon-button" data-move="up" title="上移" aria-label="上移">↑</button>
        <button type="button" class="ncm-sort-icon-button" data-move="down" title="下移" aria-label="下移">↓</button>
      </span>
    </li>
  `).join('');
}

function readTextSortConfig(prefix, fallbackCategoryOrder = []) {
  const list = document.getElementById(`${prefix}-priority-list`);
  const directStringCompare = document.getElementById(`${prefix}-direct-compare`).checked;
  const chineseSort = document.getElementById(`${prefix}-chinese-sort`).value;
  const visibleOrder = [...list.querySelectorAll('[data-category]')].map(item => item.dataset.category);
  const visibleIds = new Set(visibleOrder);
  const hiddenOrder = fallbackCategoryOrder.filter(categoryId => !visibleIds.has(categoryId));

  return {
    directStringCompare,
    categoryOrder: [...visibleOrder, ...hiddenOrder],
    chineseSort
  };
}

function readTitleSortConfig(savedConfig) {
  return readTextSortConfig('title', savedConfig.categoryOrder);
}

function refreshPriorityIndexes(list) {
  [...list.querySelectorAll('.ncm-sort-priority-item')].forEach((item, index) => {
    item.querySelector('.ncm-sort-priority-index').textContent = index + 1;
  });
}

function setPriorityDisabled(disabled, prefix = 'title') {
  const fieldset = document.getElementById(`${prefix}-category-priority`);
  fieldset.disabled = disabled;
  fieldset.classList.toggle('is-disabled', disabled);
}

function readDateSortConfig(prefix = 'date') {
  const selectedOrder = document.querySelector(`[data-${prefix}-order].is-selected`);

  return {
    descending: selectedOrder?.dataset.descending !== 'false',
    sortAlbumsByName: document.getElementById(`${prefix}-sort-albums`).checked,
    sortAlbumTracks: document.getElementById(`${prefix}-sort-tracks`).checked
  };
}

function readHeatSortConfig() {
  const selected = document.querySelector('[data-heat-sort].is-selected');

  return {
    metric: selected?.dataset.metric || HEAT_SORT_METRICS[0].id,
    descending: selected?.dataset.descending !== 'false'
  };
}

function setDateTrackSortDisabled(disabled, prefix = 'date') {
  const input = document.getElementById(`${prefix}-sort-tracks`);
  const row = document.getElementById(`${prefix}-sort-tracks-row`);
  input.disabled = disabled;
  if (disabled) input.checked = false;
  row.classList.toggle('is-disabled', disabled);
}

function readArtistSortConfig(textCategoryOrder) {
  return {
    sortArtistsByName: document.getElementById('artist-sort-name').checked,
    sortSameArtistByDate: document.getElementById('artist-sort-date').checked,
    textSortConfig: readTextSortConfig('artist', textCategoryOrder),
    dateSortConfig: readDateSortConfig('artist-date')
  };
}

export async function showTitleSortDialog(categoryIds) {
  const savedConfig = await loadTitleSortConfig();
  const visibleCategories = getVisibleTextCategories(categoryIds);
  const categories = orderTitleCategories(visibleCategories, savedConfig.categoryOrder);
  const categoryNames = categories.map(category => category.label).join('、');

  return Swal.fire({
    title: '按标题排序',
    html: `
      <div class="ncm-sort-title-settings">
        <div class="ncm-sort-intro">
          <p>选择标题排序方式</p>
          <p class="ncm-sort-help">从左到右逐个字符比较</p>
          <p class="ncm-sort-detected">当前标题：${categories.length} 类（${categoryNames}）</p>
        </div>

        <label class="ncm-sort-switch-row">
          <input id="title-direct-compare" type="checkbox" ${savedConfig.directStringCompare ? 'checked' : ''}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">使用直接字符串比较</span>
            <span class="ncm-sort-switch-help">开启后不使用下面的字符类别优先级。</span>
          </span>
        </label>

        <fieldset id="title-category-priority" class="ncm-sort-priority-panel">
          <legend>文字体系优先级</legend>
          <ol id="title-priority-list" class="ncm-sort-priority-list">
            ${createTitleCategoryList(categories)}
          </ol>
          <label class="ncm-sort-select-row">
            <span class="ncm-sort-label">汉字排序方式：</span>
            <select id="title-chinese-sort" class="ncm-sort-select">
              ${TITLE_CHINESE_SORTS.map(sort => `
                <option value="${sort.id}" ${sort.id === savedConfig.chineseSort ? 'selected' : ''}>
                  ${sort.label}
                </option>
              `).join('')}
            </select>
          </label>
        </fieldset>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '开始排序',
    cancelButtonText: '取消',
    focusConfirm: false,
    customClass: swalClasses,
    didOpen: () => {
      const directCompare = document.getElementById('title-direct-compare');
      const list = document.querySelector('.ncm-sort-priority-list');

      directCompare.addEventListener('change', () => {
        setPriorityDisabled(directCompare.checked);
      });

      list.addEventListener('click', (event) => {
        const button = event.target.closest('[data-move]');
        if (!button) return;

        const item = button.closest('.ncm-sort-priority-item');
        const sibling = button.dataset.move === 'up'
          ? item.previousElementSibling
          : item.nextElementSibling;

        if (!sibling) return;

        if (button.dataset.move === 'up') {
          list.insertBefore(item, sibling);
        } else {
          list.insertBefore(sibling, item);
        }
        refreshPriorityIndexes(list);
      });

      setPriorityDisabled(directCompare.checked);
    },
    preConfirm: () => readTitleSortConfig(savedConfig)
  });
}

export async function showDateSortDialog() {
  const savedConfig = await loadDateSortSettings();

  return Swal.fire({
    title: '按发行日期排序',
    html: `
      <div class="ncm-sort-intro">
        <p>选择发行日期排序方式</p>
      </div>
      <div class="ncm-sort-date-order">
        <div class="ncm-sort-choice-list">
          <button type="button" class="ncm-sort-choice-button ${savedConfig.descending ? 'is-selected' : ''}" data-date-order data-descending="true" aria-pressed="${savedConfig.descending}">从新到旧（倒序）</button>
          <button type="button" class="ncm-sort-choice-button ${savedConfig.descending ? '' : 'is-selected'}" data-date-order data-descending="false" aria-pressed="${!savedConfig.descending}">从旧到新（顺序）</button>
        </div>
      </div>
      <div class="ncm-sort-date-settings">
        <label class="ncm-sort-switch-row">
          <input id="date-sort-albums" type="checkbox" ${savedConfig.sortAlbumsByName ? 'checked' : ''}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">不同专辑按专辑名称排序</span>
            <span class="ncm-sort-switch-help">将同一发行日期下的歌曲按专辑名称聚拢。</span>
          </span>
        </label>
        <label id="date-sort-tracks-row" class="ncm-sort-switch-row ${savedConfig.sortAlbumsByName ? '' : 'is-disabled'}">
          <input id="date-sort-tracks" type="checkbox" ${savedConfig.sortAlbumTracks ? 'checked' : ''} ${savedConfig.sortAlbumsByName ? '' : 'disabled'}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">同一专辑按专辑内歌曲顺序排序</span>
            <span class="ncm-sort-switch-help">需要先开启上面的专辑名称排序。</span>
          </span>
        </label>
      </div>
    `,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: '开始排序',
    cancelButtonText: '取消',
    customClass: swalClasses,
    didOpen: () => {
      const orderButtons = [...document.querySelectorAll('[data-date-order]')];
      const albumSort = document.getElementById('date-sort-albums');

      orderButtons.forEach((button) => {
        button.addEventListener('click', () => {
          orderButtons.forEach((item) => {
            const selected = item === button;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-pressed', String(selected));
          });
        });
      });

      albumSort.addEventListener('change', () => {
        setDateTrackSortDisabled(!albumSort.checked);
      });

      setDateTrackSortDisabled(!albumSort.checked);
    },
    preConfirm: () => readDateSortConfig()
  });
}

export async function showArtistSortDialog(categoryIds, savedSettings) {
  const artistConfig = savedSettings || await loadArtistSortSettings();
  const textConfig = await loadTitleSortConfig();
  const dateConfig = await loadDateSortSettings();
  const visibleCategories = getVisibleTextCategories(categoryIds);
  const categories = orderTitleCategories(visibleCategories, textConfig.categoryOrder);
  const categoryNames = categories.map(category => category.label).join('、');

  return Swal.fire({
    title: '按歌手排序',
    html: `
      <div class="ncm-sort-intro">
        <p>选择歌手排序方式</p>
        <p class="ncm-sort-help">从左到右逐个字符比较</p>
        <p class="ncm-sort-detected">当前歌手名称：${categories.length} 类（${categoryNames}）</p>
      </div>
      <div id="artist-text-settings" class="ncm-sort-priority-panel">
        <label class="ncm-sort-switch-row">
          <input id="artist-direct-compare" type="checkbox" ${textConfig.directStringCompare ? 'checked' : ''}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">使用直接字符串比较</span>
            <span class="ncm-sort-switch-help">开启后不使用下面的文字体系优先级。</span>
          </span>
        </label>
        <fieldset id="artist-category-priority" class="ncm-sort-priority-panel">
          <legend>文字体系优先级</legend>
          <ol id="artist-priority-list" class="ncm-sort-priority-list">
            ${createTitleCategoryList(categories)}
          </ol>
          <label class="ncm-sort-select-row">
            <span class="ncm-sort-label">汉字排序方式：</span>
            <select id="artist-chinese-sort" class="ncm-sort-select">
              ${TITLE_CHINESE_SORTS.map(sort => `
                <option value="${sort.id}" ${sort.id === textConfig.chineseSort ? 'selected' : ''}>
                  ${sort.label}
                </option>
              `).join('')}
            </select>
          </label>
        </fieldset>
      </div>
      <div class="ncm-sort-date-settings">
        <label class="ncm-sort-switch-row">
          <input id="artist-sort-name" type="checkbox" ${artistConfig.sortArtistsByName ? 'checked' : ''}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">按歌手名称排序</span>
            <span class="ncm-sort-switch-help">关闭后歌手分组按照原歌单中首次出现的顺序排列。</span>
          </span>
        </label>
        <label class="ncm-sort-switch-row">
          <input id="artist-sort-date" type="checkbox" ${artistConfig.sortSameArtistByDate ? 'checked' : ''}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">同一歌手按发行时间排序</span>
            <span class="ncm-sort-switch-help">关闭后保持同一歌手的原歌单相对顺序。</span>
          </span>
        </label>
      </div>
      <div id="artist-date-settings" class="ncm-sort-conditional ${artistConfig.sortSameArtistByDate ? '' : 'is-hidden'}">
        <div class="ncm-sort-date-order">
          <p class="ncm-sort-help">同一歌手内按发行日期排序时，使用下面的发行日期规则</p>
          <div class="ncm-sort-choice-list">
            <button type="button" class="ncm-sort-choice-button ${dateConfig.descending ? 'is-selected' : ''}" data-artist-date-order data-descending="true" aria-pressed="${dateConfig.descending}">从新到旧（倒序）</button>
            <button type="button" class="ncm-sort-choice-button ${dateConfig.descending ? '' : 'is-selected'}" data-artist-date-order data-descending="false" aria-pressed="${!dateConfig.descending}">从旧到新（顺序）</button>
          </div>
        </div>
        <div class="ncm-sort-date-settings">
          <label class="ncm-sort-switch-row">
            <input id="artist-date-sort-albums" type="checkbox" ${dateConfig.sortAlbumsByName ? 'checked' : ''}>
            <span class="ncm-sort-switch" aria-hidden="true"></span>
            <span>
              <span class="ncm-sort-switch-label">不同专辑按专辑名称排序</span>
              <span class="ncm-sort-switch-help">将同一发行日期下的歌曲按专辑名称聚拢。</span>
            </span>
          </label>
          <label id="artist-date-sort-tracks-row" class="ncm-sort-switch-row ${dateConfig.sortAlbumsByName ? '' : 'is-disabled'}">
            <input id="artist-date-sort-tracks" type="checkbox" ${dateConfig.sortAlbumTracks ? 'checked' : ''} ${dateConfig.sortAlbumsByName ? '' : 'disabled'}>
            <span class="ncm-sort-switch" aria-hidden="true"></span>
            <span>
              <span class="ncm-sort-switch-label">同一专辑按专辑内歌曲顺序排序</span>
              <span class="ncm-sort-switch-help">需要先开启上面的专辑名称排序。</span>
            </span>
          </label>
        </div>
      </div>
    `,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: '开始排序',
    cancelButtonText: '取消',
    customClass: swalClasses,
    didOpen: () => {
      const directCompare = document.getElementById('artist-direct-compare');
      const list = document.getElementById('artist-priority-list');
      const orderButtons = [...document.querySelectorAll('[data-artist-date-order]')];
      const albumSort = document.getElementById('artist-date-sort-albums');
      const sameArtistDate = document.getElementById('artist-sort-date');
      const artistDateSettings = document.getElementById('artist-date-settings');

      directCompare.addEventListener('change', () => {
        setPriorityDisabled(directCompare.checked, 'artist');
      });

      list.addEventListener('click', (event) => {
        const button = event.target.closest('[data-move]');
        if (!button) return;

        const item = button.closest('.ncm-sort-priority-item');
        const sibling = button.dataset.move === 'up'
          ? item.previousElementSibling
          : item.nextElementSibling;
        if (!sibling) return;

        if (button.dataset.move === 'up') {
          list.insertBefore(item, sibling);
        } else {
          list.insertBefore(sibling, item);
        }
        refreshPriorityIndexes(list);
      });

      orderButtons.forEach((button) => {
        button.addEventListener('click', () => {
          orderButtons.forEach((item) => {
            const selected = item === button;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-pressed', String(selected));
          });
        });
      });

      albumSort.addEventListener('change', () => {
        setDateTrackSortDisabled(!albumSort.checked, 'artist-date');
      });

      sameArtistDate.addEventListener('change', () => {
        artistDateSettings.classList.toggle('is-hidden', !sameArtistDate.checked);
      });

      setPriorityDisabled(directCompare.checked, 'artist');
      setDateTrackSortDisabled(!albumSort.checked, 'artist-date');
    },
    preConfirm: () => readArtistSortConfig(textConfig.categoryOrder)
  });
}

export function showHeatSortDialog(savedConfig) {
  const config = normalizeHeatSortConfig(savedConfig);
  const options = HEAT_SORT_METRICS.flatMap(metric => [
    {
      metric: metric.id,
      descending: true,
      label: `${metric.label}：${metric.id === 'commentCount' ? '多到少' : '高到低'}`
    },
    {
      metric: metric.id,
      descending: false,
      label: `${metric.label}：${metric.id === 'commentCount' ? '少到多' : '低到高'}`
    }
  ]);

  return Swal.fire({
    title: '按热度排序',
    html: `
      <div class="ncm-sort-intro">
        <p>选择热度指标和排序方向：</p>
        <p class="ncm-sort-help">红心数量来自网易云红心接口，热度值来自歌曲详情，评论数量使用批量接口。</p>
      </div>
      <div class="ncm-sort-choice-list">
        ${options.map(option => {
          const selected = option.metric === config.metric && option.descending === config.descending;
          return `<button type="button" class="ncm-sort-choice-button ${selected ? 'is-selected' : ''}" data-heat-sort data-metric="${option.metric}" data-descending="${option.descending}" aria-pressed="${selected}">${option.label}</button>`;
        }).join('')}
      </div>
    `,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: '开始排序',
    cancelButtonText: '取消',
    customClass: swalClasses,
    didOpen: () => {
      const buttons = [...document.querySelectorAll('[data-heat-sort]')];
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          buttons.forEach((item) => {
            const selected = item === button;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-pressed', String(selected));
          });
        });
      });
    },
    preConfirm: () => readHeatSortConfig()
  });
}

export function showRestoreOrderDialog(backup) {
  const createdAt = backup.createdAt
    ? new Date(backup.createdAt).toLocaleString()
    : '未知时间';
  const operationText = backup.operation === 'delete'
    ? `将重新加入 ${backup.removedSongIds.length} 首已删除歌曲并恢复顺序`
    : backup.operation === 'move'
      ? '将恢复移动前的歌曲顺序'
      : '将恢复排序前的歌曲顺序';

  return Swal.fire({
    icon: 'warning',
    title: '恢复上次操作前顺序？',
    text: `${backup.playlistName || '当前歌单'}\n备份时间：${createdAt}\n${operationText}`,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: '恢复顺序',
    cancelButtonText: '取消',
    customClass: dangerSwalClasses
  });
}

export function showBatchMoveDialog() {
  return Swal.fire({
    title: '批量移动歌曲',
    html: `
      <div class="ncm-sort-intro">
        <p>输入三个数字来移动歌曲：</p>
        <p class="ncm-sort-help">
          例如：2, 6, 10<br>
          表示将序号 2-6 的歌曲移到序号 10 的歌曲后面
        </p>
      </div>
      <div class="ncm-sort-fields">
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">起始位置：</span>
          <input id="start-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="起始">
        </label>
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">结束位置：</span>
          <input id="end-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="结束">
        </label>
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">目标位置：</span>
          <input id="target-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="目标">
        </label>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '开始移动',
    cancelButtonText: '取消',
    focusConfirm: false,
    customClass: swalClasses,
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
      <div class="ncm-sort-intro">
        <p>输入两个数字来删除歌曲：</p>
        <p class="ncm-sort-help">
          例如：2, 6<br>
          表示删除序号 2-6（包含）的所有歌曲
        </p>
        <p class="ncm-sort-warning">
          ⚠️ 此操作不可撤销，请谨慎操作！
        </p>
      </div>
      <div class="ncm-sort-fields ncm-sort-fields-two">
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">起始位置：</span>
          <input id="del-start-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="起始">
        </label>
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">结束位置：</span>
          <input id="del-end-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="结束">
        </label>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#e74c3c',
    focusConfirm: false,
    customClass: dangerSwalClasses,
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
    confirmButtonColor: '#e74c3c',
    customClass: dangerSwalClasses
  });
}
