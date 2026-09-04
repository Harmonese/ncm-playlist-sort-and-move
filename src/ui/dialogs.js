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
