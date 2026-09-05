import { dangerSwalClasses, swalClasses } from './styles.js';
import {
  TITLE_CATEGORIES,
  TITLE_CHINESE_SORTS
} from '../sort/title.js';
import { loadTitleSortConfig } from '../settings/title-sort.js';
import { loadArtistSortSettings } from '../settings/artist-sort.js';
import { loadDateSortSettings } from '../settings/date-sort.js';
import { HEAT_SORT_METRICS, normalizeHeatSortConfig } from '../sort/heat.js';
import {
  buildPlaylistScript,
  parseCommandLine,
  parseSongOnlyPlaylistScript
} from '../data/playlist-script-protocol.js';
import {
  applyCommand,
  createSongPlan,
  getPlaylistScriptDiff,
  resolveCommand as resolvePlanCommand,
  resolvePlaylistCommands
} from '../data/playlist-plan.js';
import { showToast } from '../utils/dom.js';

function getCommandManualHtml() {
  return `
    <button id="playlist-script-command-manual" type="button" class="ncm-sort-script-manual-button" aria-expanded="false">
      <span aria-hidden="true">?</span> 使用帮助
    </button>
    <div id="playlist-script-command-manual-content" class="ncm-sort-script-manual" hidden>
      <div class="ncm-sort-script-manual-title">怎么使用</div>
      <p>在下方的命令输入框中输入一条命令，按 Enter 或点击回车按钮即可执行。执行结果会立即反映在脚本内容和歌曲预览中；确认写回前，你可以反复尝试和调整。</p>

      <div class="ncm-sort-script-manual-title">添加歌曲</div>
      <div class="ncm-sort-script-manual-grid">
        <code>song 歌曲ID</code><span>添加一首歌曲</span>
        <code>song 歌曲ID 位置</code><span>添加到指定位置</span>
        <code>album 专辑ID</code><span>读取专辑并添加其中的全部歌曲</span>
        <code>album 专辑ID 位置</code><span>把专辑歌曲添加到指定位置</span>
      </div>

      <div class="ncm-sort-script-manual-title">删除和调整顺序</div>
      <div class="ncm-sort-script-manual-grid">
        <code>remove 位置</code><span>删除指定位置的一首歌曲</span>
        <code>remove 起始位置 结束位置</code><span>删除一段歌曲</span>
        <code>move 起始位置 结束位置 目标位置</code><span>移动一段歌曲；目标为 0 表示移到最前</span>
        <code>swap 位置1 位置2</code><span>交换两首歌曲的位置</span>
        <code>clear</code><span>清空当前编辑结果</span>
      </div>

      <div class="ncm-sort-script-manual-title">排序</div>
      <div class="ncm-sort-script-manual-grid">
        <code>sort title</code><span>按歌曲标题排序（使用标题排序设置）</span>
        <code>sort date [asc|desc]</code><span>按发行日期排序，默认从新到旧</span>
        <code>sort artist [name|original] [date|nodate]</code><span>按歌手排序，可控制歌手分组和组内日期</span>
        <code>sort heat 指标 [asc|desc]</code><span>按热度排序：popularity、red 或 comments</span>
        <code>sort random</code><span>随机打乱顺序</span>
      </div>
      <p>任何排序命令最后都可以加“起始位置 结束位置”，只排序这一段。例如：<code>sort title 2 10</code>。</p>

      <div class="ncm-sort-script-manual-title">位置怎么计算？</div>
      <ul>
        <li><strong>添加位置</strong>从 0 开始：<code>0</code> 是最前面，<code>1</code> 是第一首歌后面。</li>
        <li><strong>删除、移动、交换和排序</strong>使用从 1 开始的歌曲序号，并且包含起点和终点。</li>
        <li>不写添加位置时，如果左侧预览中选中了歌曲，就会插入到选中歌曲后面；没有选中歌曲时添加到末尾。</li>
        <li>不写排序范围时，会对整个歌单排序。</li>
      </ul>

      <div class="ncm-sort-script-manual-title">可以直接试试</div>
      <pre>song 123
album 456 0
sort date desc
sort heat popularity desc 1 20
move 2 5 0
remove 8 10</pre>
      <p class="ncm-sort-script-manual-note">其中的歌曲 ID 和专辑 ID 需要替换成网易云音乐实际的数字 ID。命令只在当前编辑窗口中修改顺序，最后点击“解析预览”并确认后才会写回歌单。</p>
    </div>
  `;
}

function bindCommandManual() {
  const manualButton = document.getElementById('playlist-script-command-manual');
  const manual = document.getElementById('playlist-script-command-manual-content');
  manualButton?.addEventListener('click', () => {
    const isOpen = !manual.hidden;
    manual.hidden = isOpen;
    manualButton.setAttribute('aria-expanded', String(!isOpen));
    manualButton.classList.toggle('is-open', !isOpen);
  });
}

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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createDragHandle() {
  return `
    <span
      class="ncm-sort-drag-handle"
      role="button"
      tabindex="0"
      title="拖动调整顺序"
      aria-label="拖动调整顺序"
    >⋮⋮</span>
  `;
}

function createTitleCategoryList(categories) {
  return categories.map((category, index) => `
    <li class="ncm-sort-priority-item" data-category="${category.id}">
      <span class="ncm-sort-priority-name">
        <span class="ncm-sort-priority-index">${index + 1}</span>
        ${category.label}
      </span>
      <span class="ncm-sort-priority-actions">
        ${createDragHandle()}
      </span>
    </li>
  `).join('');
}

function createManualSongList(items) {
  return items.map((item, index) => `
    <li class="ncm-sort-priority-item ncm-sort-song-item" data-song-id="${escapeHtml(item.id)}">
      <span class="ncm-sort-priority-name ncm-sort-song-name">
        <span class="ncm-sort-priority-index">${index + 1}</span>
        <span class="ncm-sort-song-details">
          <span class="ncm-sort-song-title">${escapeHtml(item.title || '未命名歌曲')}</span>
          <span class="ncm-sort-song-meta">${escapeHtml(item.artist || '未知歌手')}${item.album ? ` · ${escapeHtml(item.album)}` : ''}</span>
        </span>
      </span>
      <span class="ncm-sort-priority-actions">
        ${createDragHandle()}
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

function movePriorityItem(list, item, direction) {
  const sibling = direction === 'up'
    ? item.previousElementSibling
    : item.nextElementSibling;

  if (!sibling) return;

  if (direction === 'up') {
    list.insertBefore(item, sibling);
  } else {
    list.insertBefore(sibling, item);
  }
  refreshPriorityIndexes(list);
  item.querySelector('.ncm-sort-drag-handle').focus();
}

function bindSortableList(list) {
  const dragThreshold = 5;
  let pendingDrag = null;
  let draggedItem = null;
  let dropPlaceholder = null;
  let dragFrame = 0;
  let latestDragPosition = null;
  let originalNextSibling = null;

  const cancelDragFrame = () => {
    if (!dragFrame) return;
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
  };

  const scheduleDragFrame = () => {
    if (!dragFrame) {
      dragFrame = requestAnimationFrame(updateDropPlaceholder);
    }
  };

  const updateDropPlaceholder = () => {
    dragFrame = 0;
    if (!draggedItem || !dropPlaceholder || !latestDragPosition) return;

    const { clientX, clientY } = latestDragPosition;
    const scrollContainer = list.closest('.ncm-sort-scroll-container');
    let didScroll = false;
    if (scrollContainer) {
      const rect = scrollContainer.getBoundingClientRect();
      const edgeSize = 44;
      const previousScrollTop = scrollContainer.scrollTop;
      if (clientY < rect.top + edgeSize) {
        scrollContainer.scrollTop -= 14;
      } else if (clientY > rect.bottom - edgeSize) {
        scrollContainer.scrollTop += 14;
      }
      didScroll = scrollContainer.scrollTop !== previousScrollTop;
    }

    const target = document.elementFromPoint(clientX, clientY)
      ?.closest('.ncm-sort-priority-item');
    if (target?.parentElement === list) {
      const rect = target.getBoundingClientRect();
      const insertBefore = clientY < rect.top + rect.height / 2;
      if (insertBefore) {
        if (dropPlaceholder.nextElementSibling !== target) {
          list.insertBefore(dropPlaceholder, target);
        }
      } else if (target.nextElementSibling !== dropPlaceholder) {
        list.insertBefore(dropPlaceholder, target.nextSibling);
      }
    } else {
      const listRect = list.getBoundingClientRect();
      if (clientY <= listRect.top) {
        list.prepend(dropPlaceholder);
      } else if (clientY >= listRect.bottom) {
        list.append(dropPlaceholder);
      }
    }

    if (didScroll) {
      scheduleDragFrame();
    }
  };

  const startDrag = (item) => {
    draggedItem = item;
    originalNextSibling = item.nextElementSibling;
    dropPlaceholder = document.createElement('li');
    dropPlaceholder.className = 'ncm-sort-drag-placeholder';
    dropPlaceholder.setAttribute('aria-hidden', 'true');
    dropPlaceholder.style.height = `${item.getBoundingClientRect().height}px`;
    list.insertBefore(dropPlaceholder, item);
    item.classList.add('is-dragging', 'is-drag-source-hidden');
    document.body.classList.add('ncm-sort-is-pointer-dragging');
  };

  const removePointerListeners = () => {
    window.removeEventListener('pointermove', handlePointerMove, true);
    window.removeEventListener('pointerup', handlePointerUp, true);
    window.removeEventListener('pointercancel', handlePointerCancel, true);
    window.removeEventListener('blur', handlePointerCancel);
    window.removeEventListener('keydown', handleDragKeydown, true);
  };

  const finishDrag = (commit) => {
    if (commit && dragFrame) {
      cancelDragFrame();
      updateDropPlaceholder();
    }
    cancelDragFrame();
    latestDragPosition = null;

    if (draggedItem && dropPlaceholder?.parentElement === list) {
      if (commit) {
        list.insertBefore(draggedItem, dropPlaceholder);
      } else if (originalNextSibling?.parentElement === list) {
        list.insertBefore(draggedItem, originalNextSibling);
      } else {
        list.append(draggedItem);
      }
      dropPlaceholder.remove();
      draggedItem.classList.remove('is-dragging', 'is-drag-source-hidden');
      refreshPriorityIndexes(list);
    }

    document.body.classList.remove('ncm-sort-is-pointer-dragging');
    pendingDrag = null;
    draggedItem = null;
    dropPlaceholder = null;
    originalNextSibling = null;
    removePointerListeners();
  };

  function handlePointerMove(event) {
    if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;

    if (!draggedItem) {
      const distance = Math.hypot(
        event.clientX - pendingDrag.startX,
        event.clientY - pendingDrag.startY
      );
      if (distance < dragThreshold) return;
      startDrag(pendingDrag.item);
    }

    event.preventDefault();
    latestDragPosition = {
      clientX: event.clientX,
      clientY: event.clientY
    };
    scheduleDragFrame();
  }

  function handlePointerUp(event) {
    if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;
    finishDrag(Boolean(draggedItem));
  }

  function handlePointerCancel(event) {
    if (event?.pointerId != null && pendingDrag && event.pointerId !== pendingDrag.pointerId) return;
    finishDrag(false);
  }

  function handleDragKeydown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    finishDrag(false);
  }

  list.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (list.closest('fieldset')?.disabled) return;

    const item = event.target.closest('.ncm-sort-priority-item');
    if (!item || item.parentElement !== list) return;
    if (event.pointerType !== 'mouse' && !event.target.closest('.ncm-sort-drag-handle')) return;

    event.preventDefault();
    event.target.closest('.ncm-sort-drag-handle')?.focus({ preventScroll: true });
    pendingDrag = {
      item,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener('pointercancel', handlePointerCancel, true);
    window.addEventListener('blur', handlePointerCancel);
    window.addEventListener('keydown', handleDragKeydown, true);
  });

  list.addEventListener('keydown', (event) => {
    const handle = event.target.closest('.ncm-sort-drag-handle');
    if (!handle) return;
    if (list.closest('fieldset')?.disabled) return;

    const item = handle.closest('.ncm-sort-priority-item');
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      movePriorityItem(list, item, 'up');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      movePriorityItem(list, item, 'down');
    }
  });
}

function readManualSongOrder() {
  return [...document.querySelectorAll('#manual-song-list [data-song-id]')]
    .map(item => item.dataset.songId);
}

function setPriorityDisabled(disabled, prefix = 'title') {
  const fieldset = document.getElementById(`${prefix}-category-priority`);
  fieldset.disabled = disabled;
  fieldset.classList.toggle('is-disabled', disabled);
  fieldset.querySelectorAll('.ncm-sort-priority-item').forEach((item) => {
    item.querySelector('.ncm-sort-drag-handle')?.setAttribute('aria-disabled', String(disabled));
  });
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

      bindSortableList(list);

      setPriorityDisabled(directCompare.checked);
    },
    preConfirm: () => readTitleSortConfig(savedConfig)
  });
}

export function showManualSortDialog(items) {
  return Swal.fire({
    title: '手动排序',
    html: `
      <div class="ncm-sort-intro">
        <p>拖动歌曲调整歌单顺序</p>
        <p class="ncm-sort-detected">共 ${items.length} 首歌曲</p>
      </div>
      <div class="ncm-sort-scroll-container">
        <ol id="manual-song-list" class="ncm-sort-priority-list ncm-sort-song-list">
          ${createManualSongList(items)}
        </ol>
      </div>
    `,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: '保存排序',
    cancelButtonText: '取消',
    focusConfirm: false,
    customClass: {
      ...swalClasses,
      popup: 'ncm-sort-popup ncm-sort-manual-popup'
    },
    didOpen: () => {
      bindSortableList(document.getElementById('manual-song-list'));
    },
    preConfirm: () => ({
      orderedSongIds: readManualSongOrder()
    })
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

      bindSortableList(list);

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

export function showPlaylistScriptDialog(scriptText, {
  playlistName = '当前歌单',
  currentCount = 0,
  currentItems = [],
  resolveScript = null,
  resolveCommand = null,
  resolveSongItems = null,
  warning = ''
} = {}) {
  return Swal.fire({
    title: '歌单编辑器',
    html: `
      <div class="ncm-sort-script-editor">
        ${getCommandManualHtml()}
        <div class="ncm-sort-intro">
          <p>${escapeHtml(playlistName)}</p>
          <p class="ncm-sort-detected">当前歌单：${currentCount} 首歌曲</p>
          ${warning ? `<p class="ncm-sort-script-warning">${escapeHtml(warning)}</p>` : ''}
        </div>
        <div id="playlist-script-live-summary" class="ncm-sort-script-live-summary"></div>
        <div class="ncm-sort-script-columns">
          <div class="ncm-sort-script-preview-panel">
            <div class="ncm-sort-script-scroll-wrap">
              <div id="playlist-script-live-preview" class="ncm-sort-script-live-preview"></div>
            </div>
          </div>
          <div class="ncm-sort-script-command-panel">
            <div class="ncm-sort-script-scroll-wrap">
              <div id="playlist-script-active-line" class="ncm-sort-script-active-line" aria-hidden="true"></div>
              <textarea id="playlist-script-editor" class="ncm-sort-script-textarea" spellcheck="false" readonly aria-readonly="true">${escapeHtml(scriptText)}</textarea>
            </div>
          </div>
        </div>
          <div class="ncm-sort-script-command-line">
          <div class="ncm-sort-script-command-heading">
            <div class="ncm-sort-script-panel-title">命令行</div>
            <div class="ncm-sort-script-command-actions">
              <span class="ncm-sort-script-command-hint">Enter 执行</span>
              <button id="playlist-script-upload" type="button" class="ncm-sort-script-file-button">上传 .nplc</button>
              <button id="playlist-script-download" type="button" class="ncm-sort-script-file-button">下载 .nplc</button>
            </div>
          </div>
          <div class="ncm-sort-script-command-input-row">
            <input id="playlist-script-command-input" class="ncm-sort-script-command-input" type="text" spellcheck="false" autocomplete="off" placeholder="例如：song 123 或 sort title">
            <button id="playlist-script-command-append" type="button" class="ncm-sort-script-tool-button" title="执行命令" aria-label="执行命令"><span aria-hidden="true">↵</span></button>
          </div>
          <input id="playlist-script-file-input" type="file" accept=".nplc,text/plain" hidden>
        </div>
      </div>
    `,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: '解析预览',
    cancelButtonText: '取消',
    focusConfirm: false,
    customClass: {
      ...swalClasses,
      popup: 'ncm-sort-popup ncm-sort-script-popup'
    },
    didOpen: () => {
      bindCommandManual();
      const editor = document.getElementById('playlist-script-editor');
      const preview = document.getElementById('playlist-script-live-preview');
      const summary = document.getElementById('playlist-script-live-summary');
      const activeLine = document.getElementById('playlist-script-active-line');
      const commandInput = document.getElementById('playlist-script-command-input');
      const appendButton = document.getElementById('playlist-script-command-append');
      const uploadButton = document.getElementById('playlist-script-upload');
      const downloadButton = document.getElementById('playlist-script-download');
      const fileInput = document.getElementById('playlist-script-file-input');
      const commandHistory = [];
      let updateTimer = 0;
      let updateSequence = 0;
      let isScrollSyncing = false;
      let selectedSourceLine = null;

      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

      const getPreviewRows = () => [...preview.querySelectorAll('[data-source-line]')];

      const getPreviewRowPosition = (row) => {
        const previewRect = preview.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        return {
          top: rowRect.top - previewRect.top + preview.scrollTop,
          height: rowRect.height
        };
      };

      const getEditorLineMetrics = () => {
        const styles = getComputedStyle(editor);
        const lineHeight = Number.parseFloat(styles.lineHeight) || 21.45;
        const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
        return { lineHeight, paddingTop };
      };

      const updateActiveLine = (row) => {
        if (!row) return;
        const { lineHeight, paddingTop } = getEditorLineMetrics();
        const lineNumber = Number(row.dataset.sourceLine);
        selectedSourceLine = lineNumber;
        activeLine.style.top = `${paddingTop + (lineNumber - 1) * lineHeight - editor.scrollTop}px`;
        activeLine.dataset.line = String(lineNumber);
        activeLine.dataset.order = row.dataset.songOrder;
        activeLine.style.display = 'block';
      };

      const interpolateAnchors = (value, anchors, sourceKey, targetKey) => {
        if (anchors.length === 1) return anchors[0][targetKey];

        if (value <= anchors[0][sourceKey]) {
          return anchors[0][targetKey];
        }
        const last = anchors.length - 1;
        if (value >= anchors[last][sourceKey]) {
          return anchors[last][targetKey];
        }

        for (let index = 0; index < last; index += 1) {
          const start = anchors[index];
          const end = anchors[index + 1];
          if (value > end[sourceKey]) continue;
          const distance = end[sourceKey] - start[sourceKey];
          const fraction = distance > 0
            ? (value - start[sourceKey]) / distance
            : 0;
          return start[targetKey] + fraction * (end[targetKey] - start[targetKey]);
        }

        return anchors[last][targetKey];
      };

      // 两侧内容高度不同，使用命令组中心作为锚点，并在相邻锚点之间连续插值。
      const syncScroll = (source, target) => {
        if (isScrollSyncing) return;
        const rows = getPreviewRows();
        if (!rows.length) {
          activeLine.style.display = 'none';
          selectedSourceLine = null;
          return;
        }

        const { lineHeight, paddingTop } = getEditorLineMetrics();
        const previewAnchors = rows.map((row) => {
          const position = getPreviewRowPosition(row);
          return {
            position: position.top + position.height / 2,
            line: paddingTop + (Number(row.dataset.sourceLine) - 0.5) * lineHeight
          };
        });
        const editorAnchors = previewAnchors.map(anchor => ({
          position: anchor.line,
          line: anchor.position
        }));

        const activeSourcePosition = source === preview
          ? source.scrollTop + source.clientHeight / 2
          : source.scrollTop + source.clientHeight / 2;
        const activeAnchors = source === preview ? previewAnchors : editorAnchors;
        const activeIndex = activeAnchors.reduce((bestIndex, anchor, index) => {
          const bestDistance = Math.abs(activeAnchors[bestIndex].position - activeSourcePosition);
          const distance = Math.abs(anchor.position - activeSourcePosition);
          return distance < bestDistance ? index : bestIndex;
        }, 0);
        rows.forEach((row, index) => row.classList.toggle('is-selected', index === activeIndex));
        const activeLineNumber = Number(rows[activeIndex].dataset.sourceLine);
        selectedSourceLine = activeLineNumber;
        activeLine.style.top = `${paddingTop + (activeLineNumber - 1) * lineHeight - editor.scrollTop}px`;
        activeLine.dataset.line = String(activeLineNumber);
        activeLine.dataset.order = rows[activeIndex].dataset.songOrder;
        activeLine.style.display = 'block';

        let targetCenter;
        if (source === preview) {
          const sourceCenter = source.scrollTop + source.clientHeight / 2;
          targetCenter = interpolateAnchors(sourceCenter, previewAnchors, 'position', 'line');
        } else {
          const sourceCenter = source.scrollTop + source.clientHeight / 2;
          targetCenter = interpolateAnchors(sourceCenter, editorAnchors, 'position', 'line');
        }

        const targetScrollTop = targetCenter - target.clientHeight / 2;
        isScrollSyncing = true;
        target.scrollTop = clamp(targetScrollTop, 0, target.scrollHeight - target.clientHeight);
        requestAnimationFrame(() => {
          isScrollSyncing = false;
        });
      };

      preview.addEventListener('scroll', () => syncScroll(preview, editor));
      editor.addEventListener('scroll', () => syncScroll(editor, preview));

      const renderPreview = ({ commands = [], expanded = null, resolvedItems = [], error = '', loading = false } = {}) => {
        if (loading) {
          summary.innerHTML = '<span class="is-loading">正在更新预览……</span>';
          preview.innerHTML = '';
          activeLine.style.display = 'none';
          return;
        }
        if (error) {
          summary.innerHTML = `<span class="is-error">${escapeHtml(error)}</span>`;
          preview.innerHTML = '';
          activeLine.style.display = 'none';
          return;
        }
        if (!expanded) {
          summary.innerHTML = '<span>输入命令后显示预览。</span>';
          preview.innerHTML = '';
          activeLine.style.display = 'none';
          return;
        }

        const currentIds = currentItems.map(item => String(item.id));
        const diff = getPlaylistScriptDiff(currentIds, expanded.songIds);
        const currentMap = new Map(currentItems.map(item => [String(item.id), item]));
        const resolvedMap = new Map(resolvedItems.map(item => [String(item.id), item]));
        const addedSet = new Set(diff.addedIds);
        const commandBlocks = new Map(expanded.blocks.map(block => [block.line, block]));
        let targetSongOffset = 0;
        const rows = commands.map((command) => {
          const block = commandBlocks.get(command.line);
          const songStart = targetSongOffset + 1;
          const songEnd = targetSongOffset + block.songIds.length;
          targetSongOffset = songEnd;
          const isAlbum = command.type === 'album';
          const blockAddedCount = block.songIds.filter(id => addedSet.has(String(id))).length;
          const marker = blockAddedCount === block.songIds.length ? '+' : blockAddedCount ? '~' : '·';
          const firstItem = block.items?.[0] || { id: block.songIds[0] };
          const songItem = resolvedMap.get(String(command.id)) || currentMap.get(String(command.id)) || firstItem;
          const title = isAlbum
            ? block.albumName || `专辑 ${command.id}`
            : songItem.title || `歌曲 ${command.id}`;
          const meta = isAlbum
            ? `${block.albumArtist ? `${block.albumArtist} · ` : ''}${block.songIds.length} 首歌曲`
            : [songItem.artist, songItem.album].filter(Boolean).join(' · ') || `ID ${command.id}`;
          const trackRows = isAlbum
            ? block.songIds.map((id, index) => {
              const item = currentMap.get(String(id)) || block.items?.[index] || { id };
              const isTrackAdded = addedSet.has(String(id));
              return `
                <li class="ncm-sort-script-track-row ${isTrackAdded ? 'is-added' : ''}">
                  <span class="ncm-sort-script-track-marker">${isTrackAdded ? '+' : '·'}</span>
                  <span class="ncm-sort-script-preview-details">
                    <span>${escapeHtml(item.title || `歌曲 ${id}`)}</span>
                    <small>${escapeHtml([item.artist, item.album].filter(Boolean).join(' · ') || `ID ${id}`)}</small>
                  </span>
                  <code>${escapeHtml(id)}</code>
                </li>
              `;
            }).join('')
            : '';

          return `
            <li data-source-line="${command.line}" data-song-order="${songStart === songEnd ? songStart : `${songStart}-${songEnd}`}" class="ncm-sort-script-preview-group ${selectedSourceLine === command.line ? 'is-selected' : ''}" tabindex="0" role="button" aria-label="选择歌曲 ${songStart}">
              <div class="ncm-sort-script-preview-row ${blockAddedCount ? 'is-added' : ''}">
                <span class="ncm-sort-script-preview-marker">${marker}</span>
                <span class="ncm-sort-script-preview-details">
                  <span>${escapeHtml(title)}</span>
                  <small>${escapeHtml(meta)}</small>
                </span>
                <code>${escapeHtml(command.id)}</code>
              </div>
              ${trackRows ? `<ol class="ncm-sort-script-track-list">${trackRows}</ol>` : ''}
            </li>
          `;
        }).join('');
        summary.innerHTML = `
            <span>命令 <strong>${commands.length}</strong></span>
            <span>目标 <strong>${expanded.songIds.length}</strong></span>
            <span class="is-added">新增 <strong>${diff.addedIds.length}</strong></span>
            <span class="is-removed">移除 <strong>${diff.removedIds.length}</strong></span>
            <span>顺序 <strong>${diff.changedOrder ? '变化' : '不变'}</strong></span>
        `;
        preview.innerHTML = `<ol class="ncm-sort-script-preview-list">${rows}</ol>`;
        if (!getPreviewRows().some(row => Number(row.dataset.sourceLine) === selectedSourceLine)) {
          selectedSourceLine = null;
        }
        requestAnimationFrame(() => syncScroll(preview, editor));
      };

      const updatePreview = async () => {
        const sequence = ++updateSequence;
        let commands;
        try {
          commands = parseSongOnlyPlaylistScript(editor.value);
        } catch (error) {
          renderPreview({ error: error.message });
          return;
        }

        renderPreview({ loading: true });
        try {
          const expanded = await resolvePlaylistCommands(commands);
          const resolvedItems = resolveSongItems
            ? await resolveSongItems(expanded.songIds)
            : [];
          if (sequence === updateSequence) renderPreview({ commands, expanded, resolvedItems });
        } catch (error) {
          if (sequence === updateSequence) renderPreview({ error: error.message || String(error) });
        }
      };

      const appendCommand = async (rawCommandText = commandInput.value, { silent = false } = {}) => {
        let command;
        try {
          command = parseCommandLine(rawCommandText);
        } catch (error) {
          showToast(error.message || String(error));
          commandInput.focus();
          return false;
        }

        appendButton.disabled = true;
        commandInput.disabled = true;
        try {
          const currentText = editor.value.replace(/\s+$/, '');
          const currentCommands = currentText
            ? parseSongOnlyPlaylistScript(currentText)
            : [];
          const currentIds = currentCommands.map(item => item.id);
          const currentPlan = createSongPlan(currentIds);

          if (command.type === 'clear') {
            const clearedPlan = applyCommand(currentPlan, await resolvePlanCommand(command));
            editor.value = buildPlaylistScript(clearedPlan.songIds);
            selectedSourceLine = null;
            commandInput.value = '';
            editor.focus();
            updatePreview();
            commandHistory.push(rawCommandText.trim());
            if (!silent) showToast('已清空当前编辑结果');
            return true;
          }

          const selectedIndex = command.position == null && selectedSourceLine == null
            ? -1
            : currentCommands.findIndex(item => item.line === selectedSourceLine);
          if (command.type === 'album') showToast(`正在读取专辑 ${command.id}...`);
          if (!resolveCommand) throw new Error('当前无法解析命令');
          const resolved = await resolveCommand(command, currentPlan);
          const nextPlan = applyCommand(currentPlan, resolved, {
            position: command.position,
            selectedIndex,
            selectedSongId: selectedIndex >= 0 ? currentIds[selectedIndex] : null
          });
          editor.value = buildPlaylistScript(nextPlan.songIds);
          selectedSourceLine = nextPlan.selectedIndex == null
            ? null
            : nextPlan.selectedIndex + 1;
          commandInput.value = '';
          editor.focus();
          updatePreview();
          commandHistory.push(rawCommandText.trim());
          const successMessage = command.type === 'album'
            ? `已展开并插入 ${resolved.songIds.length} 首歌曲`
            : command.type === 'song'
              ? '已插入 1 首歌曲'
              : command.type === 'sort'
                ? '已完成排序'
                : command.type === 'remove'
                  ? '已删除指定歌曲'
                  : command.type === 'move'
                    ? '已移动指定歌曲'
                    : '已交换歌曲位置';
          if (!silent) showToast(successMessage);
          return true;
        } catch (error) {
          showToast(error.message || String(error));
          commandInput.focus();
          return false;
        } finally {
          appendButton.disabled = false;
          commandInput.disabled = false;
        }
      };

      editor.addEventListener('input', () => {
        selectedSourceLine = null;
        clearTimeout(updateTimer);
        updateTimer = setTimeout(updatePreview, 280);
      });

      appendButton.addEventListener('click', appendCommand);
      commandInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        appendCommand();
      });
      uploadButton.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        let text;
        try {
          text = await file.text();
        } catch (error) {
          showToast(`无法读取文件：${error.message || String(error)}`);
          return;
        }
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
        const commands = [];
        try {
          lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            commands.push({ text: trimmed, line: index + 1 });
            parseCommandLine(trimmed);
          });
        } catch (error) {
          const lineNumber = commands.at(-1)?.line || 1;
          showToast(`文件第 ${lineNumber} 行无法识别：${error.message || String(error)}`);
          return;
        }
        if (!commands.length) {
          showToast('文件中没有可执行的命令');
          return;
        }
        uploadButton.disabled = true;
        downloadButton.disabled = true;
        try {
          for (const item of commands) {
            const success = await appendCommand(item.text, { silent: true });
            if (!success) {
              showToast(`文件第 ${item.line} 行执行失败，后续命令已停止`);
              break;
            }
          }
        } finally {
          uploadButton.disabled = false;
          downloadButton.disabled = false;
        }
      });
      downloadButton.addEventListener('click', () => {
        if (!commandHistory.length) {
          showToast('当前还没有可下载的命令');
          return;
        }
        const content = `# ncm-playlist-command: 1\n${commandHistory.join('\n')}\n`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = `${(playlistName || '歌单').replace(/[\\/:*?"<>|]/g, '_')}.nplc`;
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        showToast(`已下载 ${filename}`);
      });
      preview.addEventListener('click', (event) => {
        const row = event.target.closest('[data-source-line]');
        if (!row || !preview.contains(row)) return;
        selectedSourceLine = Number(row.dataset.sourceLine);
        getPreviewRows().forEach(item => item.classList.toggle('is-selected', item === row));
        updateActiveLine(row);
        const position = getPreviewRowPosition(row);
        const targetScrollTop = clamp(
          position.top + position.height / 2 - preview.clientHeight / 2,
          0,
          preview.scrollHeight - preview.clientHeight
        );
        preview.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      });
      preview.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('[data-source-line]');
        if (!row || !preview.contains(row)) return;
        event.preventDefault();
        selectedSourceLine = Number(row.dataset.sourceLine);
        getPreviewRows().forEach(item => item.classList.toggle('is-selected', item === row));
        updateActiveLine(row);
        const position = getPreviewRowPosition(row);
        const targetScrollTop = clamp(
          position.top + position.height / 2 - preview.clientHeight / 2,
          0,
          preview.scrollHeight - preview.clientHeight
        );
        preview.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      });

      updatePreview();
    },
    preConfirm: () => {
      const value = document.getElementById('playlist-script-editor').value;
      try {
        parseSongOnlyPlaylistScript(value);
      } catch (error) {
        Swal.showValidationMessage(error.message);
        return false;
      }
      return { scriptText: value };
    }
  });
}

export function showPlaylistScriptPreviewDialog({
  playlistName = '当前歌单',
  commandCount,
  targetCount,
  addedCount,
  removedCount,
  changedOrder,
  externalChange = false
}) {
  const warning = externalChange
    ? '<p class="ncm-sort-script-warning">当前歌单已偏离上次应用后的状态。确认后将按照这份脚本覆盖当前变化。</p>'
    : '';

  return Swal.fire({
    title: '预览歌单编排',
    html: `
      <div class="ncm-sort-script-preview">
        ${getCommandManualHtml()}
        <div class="ncm-sort-intro">
          <p>${escapeHtml(playlistName)}</p>
          ${warning}
        </div>
        <div class="ncm-sort-script-summary">
          <div><span>脚本命令</span><strong>${commandCount}</strong></div>
          <div><span>展开后歌曲</span><strong>${targetCount}</strong></div>
          <div><span>新增歌曲</span><strong>${addedCount}</strong></div>
          <div><span>移除歌曲</span><strong>${removedCount}</strong></div>
          <div><span>顺序变化</span><strong>${changedOrder ? '有' : '无'}</strong></div>
        </div>
        <p class="ncm-sort-script-help">确认后会保存当前顺序备份，并将歌单写回为脚本展开后的结果。</p>
      </div>
    `,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: '确认写回',
    cancelButtonText: '返回编辑',
    focusConfirm: false,
    customClass: externalChange ? dangerSwalClasses : swalClasses,
    didOpen: () => {
      bindCommandManual();
    }
  });
}

export function showRestoreOrderDialog(backup) {
  const createdAt = backup.createdAt
    ? new Date(backup.createdAt).toLocaleString()
    : '未知时间';
  const operationText = backup.operation === 'delete'
    ? `将重新加入 ${backup.removedSongIds.length} 首已删除歌曲并恢复顺序`
    : backup.operation === 'script'
      ? `将移除 ${backup.addedSongIds.length} 首新增歌曲、重新加入 ${backup.removedSongIds.length} 首歌曲并恢复顺序`
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
          表示将序号 2-6 的歌曲移到序号 10 的歌曲后面；目标位置填 0 表示移到最前面
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
          <input id="target-pos" type="number" min="0" class="swal2-input ncm-sort-input" placeholder="目标">
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

      if (start < 1 || end < 1 || target < 0) {
        Swal.showValidationMessage('起始、结束位置必须大于等于 1，目标位置必须大于等于 0');
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
