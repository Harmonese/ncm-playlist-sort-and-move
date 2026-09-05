import { toSongItem } from './song.js';
import { stableSort } from '../sort/order.js';
import { createTitleComparator, normalizeTitleSortConfig } from '../sort/title.js';
import {
  DEFAULT_DATE_SORT_CONFIG,
  cmpByDate,
  normalizeDateSortConfig
} from '../sort/date.js';
import {
  normalizeArtistSortConfig,
  sortSongsByArtist
} from '../sort/artist.js';
import {
  normalizeHeatSortConfig,
  sortSongsByHeat
} from '../sort/heat.js';
import { shuffleItems } from '../sort/random.js';
import {
  createPlaylistScriptError,
  normalizePlaylistId,
  validateCommandPosition
} from './playlist-script-protocol.js';

function getAlbumSongs(response) {
  if (!response || response.code !== 200) return null;
  const nestedSongs = response.album?.songs;
  if (Array.isArray(nestedSongs) && nestedSongs.length) return nestedSongs;
  if (Array.isArray(response.songs) && response.songs.length) return response.songs;
  return Array.isArray(nestedSongs) ? nestedSongs : null;
}

function createSongBlock(id, line = null, item = { id }) {
  return {
    type: 'song',
    id,
    line,
    position: null,
    songIds: [id],
    items: [item]
  };
}

function normalizeSongIds(songIds) {
  if (!Array.isArray(songIds)) {
    throw createPlaylistScriptError('歌曲 ID 列表必须是数组');
  }

  return songIds.map((id) => {
    const normalizedId = normalizePlaylistId(id);
    if (!normalizedId) throw createPlaylistScriptError(`无效歌曲 ID：${id}`);
    return normalizedId;
  });
}

export function assertUniqueSongIds(songIds) {
  const seenIds = new Set();
  const duplicateIds = new Set();
  for (const id of songIds) {
    const normalizedId = String(id);
    if (seenIds.has(normalizedId)) duplicateIds.add(normalizedId);
    seenIds.add(normalizedId);
  }
  if (duplicateIds.size) {
    throw createPlaylistScriptError(`执行方案中存在重复歌曲：${[...duplicateIds].join('、')}`);
  }
}

export function createSongPlan(songIds, items = []) {
  const ids = normalizeSongIds(songIds);
  assertUniqueSongIds(ids);
  const itemMap = new Map(items.map(item => [String(item.id), item]));
  const planItems = ids.map(id => itemMap.get(id) || { id });

  return {
    songIds: ids,
    blocks: ids.map((id, index) => createSongBlock(id, index + 1, planItems[index])),
    items: planItems
  };
}

export function insertSongIds(songIds, insertedIds, position) {
  const currentIds = normalizeSongIds(songIds);
  const idsToInsert = normalizeSongIds(insertedIds);
  if (!Number.isInteger(position) || position < 0 || position > currentIds.length) {
    throw createPlaylistScriptError(`插入位置超出当前歌单范围（0-${currentIds.length}）`);
  }
  return [
    ...currentIds.slice(0, position),
    ...idsToInsert,
    ...currentIds.slice(position)
  ];
}

export function validateSongRange(start, end, currentCount, label = '位置') {
  if (!Number.isInteger(currentCount) || currentCount < 0) {
    throw createPlaylistScriptError(`无法确认当前歌单歌曲数量`);
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1) {
    throw createPlaylistScriptError(`${label}必须是正整数`);
  }
  if (start > end) {
    throw createPlaylistScriptError('起始位置不能大于结束位置');
  }
  if (end > currentCount) {
    throw createPlaylistScriptError(
      `${label}超出当前歌单范围（1-${currentCount}）`
    );
  }
}

export function removeSongRange(songIds, start, end = start) {
  const ids = normalizeSongIds(songIds);
  validateSongRange(start, end, ids.length);
  return [...ids.slice(0, start - 1), ...ids.slice(end)];
}

export function moveSongRange(songIds, start, end, target) {
  const ids = normalizeSongIds(songIds);
  validateSongRange(start, end, ids.length);
  if (!Number.isInteger(target) || target < 0 || target > ids.length) {
    throw createPlaylistScriptError(`目标位置超出当前歌单范围（0-${ids.length}）`);
  }

  const sourceStart = start - 1;
  const sourceEnd = end;
  if (target > sourceStart && target < sourceEnd) {
    throw createPlaylistScriptError('目标位置不能位于移动区间内部');
  }

  const movedIds = ids.slice(sourceStart, sourceEnd);
  const remainingIds = [...ids.slice(0, sourceStart), ...ids.slice(sourceEnd)];
  const insertAt = target <= sourceStart ? target : target - movedIds.length;
  return [
    ...remainingIds.slice(0, insertAt),
    ...movedIds,
    ...remainingIds.slice(insertAt)
  ];
}

export function swapSongPositions(songIds, positionA, positionB) {
  const ids = normalizeSongIds(songIds);
  validateSongRange(positionA, positionA, ids.length, '歌曲位置');
  validateSongRange(positionB, positionB, ids.length, '歌曲位置');
  const nextIds = [...ids];
  const indexA = positionA - 1;
  const indexB = positionB - 1;
  [nextIds[indexA], nextIds[indexB]] = [nextIds[indexB], nextIds[indexA]];
  return nextIds;
}

export function resolveSelectionAfterTransform(nextIds, selectedSongId = null, fallbackIndex = null) {
  if (selectedSongId != null) {
    const selectedIndex = nextIds.indexOf(String(selectedSongId));
    if (selectedIndex >= 0) return selectedIndex;
  }
  if (fallbackIndex == null || !nextIds.length) return null;
  return Math.min(Math.max(fallbackIndex, 0), nextIds.length - 1);
}

function mergeDateSortConfig(settings = {}, options = {}) {
  const base = {
    descending: settings.descending !== false,
    ...DEFAULT_DATE_SORT_CONFIG,
    ...normalizeDateSortConfig(settings)
  };
  return {
    ...base,
    ...(Object.hasOwn(options, 'descending') ? { descending: options.descending } : {}),
    ...(Object.hasOwn(options, 'sortAlbumsByName')
      ? { sortAlbumsByName: options.sortAlbumsByName }
      : {}),
    ...(Object.hasOwn(options, 'sortAlbumTracks')
      ? { sortAlbumTracks: options.sortAlbumTracks }
      : {})
  };
}

export function resolveSortConfig(command, settings = {}) {
  const options = command?.options || {};
  const title = normalizeTitleSortConfig(settings.title);
  const date = mergeDateSortConfig(settings.date, options);

  if (command?.key === 'title') return { title };
  if (command?.key === 'date') return { date };
  if (command?.key === 'artist') {
    const artist = {
      ...normalizeArtistSortConfig(settings.artist),
      ...(Object.hasOwn(options, 'sortArtistsByName')
        ? { sortArtistsByName: options.sortArtistsByName }
        : {}),
      ...(Object.hasOwn(options, 'sortSameArtistByDate')
        ? { sortSameArtistByDate: options.sortSameArtistByDate }
        : {})
    };
    return { title, date, artist };
  }
  if (command?.key === 'heat') {
    return {
      heat: {
        ...normalizeHeatSortConfig(settings.heat),
        ...(Object.hasOwn(options, 'metric') ? { metric: options.metric } : {}),
        ...(Object.hasOwn(options, 'descending') ? { descending: options.descending } : {})
      }
    };
  }
  if (command?.key === 'random') return { random: true };
  throw createPlaylistScriptError(`不支持的排序类型：${command?.key}`);
}

export function sortSongRange(plan, command, sortConfig) {
  const count = plan.songIds.length;
  if (count === 0 && command.start == null && command.end == null) {
    return createSongPlan([]);
  }
  const start = command.start ?? 1;
  const end = command.end ?? count;
  validateSongRange(start, end, count, '排序位置');
  if (!sortConfig || !sortConfig[command.key]) {
    throw createPlaylistScriptError('排序配置无效');
  }

  const selectedItems = plan.items.slice(start - 1, end);
  let orderedItems;
  if (command.key === 'title') {
    orderedItems = stableSort(selectedItems, createTitleComparator(sortConfig.title));
  } else if (command.key === 'date') {
    orderedItems = stableSort(
      selectedItems,
      cmpByDate(sortConfig.date.descending, sortConfig.date)
    );
  } else if (command.key === 'artist') {
    orderedItems = sortSongsByArtist(
      selectedItems,
      sortConfig.artist,
      sortConfig.title,
      sortConfig.date
    );
  } else if (command.key === 'heat') {
    orderedItems = sortSongsByHeat(selectedItems, sortConfig.heat);
  } else if (command.key === 'random') {
    orderedItems = shuffleItems(selectedItems, sortConfig.randomFn);
  } else {
    throw createPlaylistScriptError(`不支持的排序类型：${command.key}`);
  }

  const nextItems = [
    ...plan.items.slice(0, start - 1),
    ...orderedItems,
    ...plan.items.slice(end)
  ];
  return createSongPlan(nextItems.map(item => item.id), nextItems);
}

export async function resolveCommand(command, { fetchAlbum, sortConfig, sortItems } = {}) {
  if (!command || typeof command !== 'object') {
    throw createPlaylistScriptError('命令必须是对象');
  }

  if (command.type === 'clear') {
    return { type: 'clear', command };
  }

  if (['remove', 'move', 'swap'].includes(command.type)) {
    return { type: command.type, command };
  }

  if (command.type === 'sort') {
    const resolvedSortConfig = command.key === 'random'
      ? { random: true, randomFn: sortConfig?.randomFn || Math.random }
      : sortConfig;
    if (!resolvedSortConfig) throw createPlaylistScriptError('排序配置无效', command.line);
    return { type: 'sort', command, sortConfig: resolvedSortConfig, items: sortItems };
  }

  const id = normalizePlaylistId(command.id);
  if (!id) throw createPlaylistScriptError('ID 必须是正整数', command.line);

  if (command.type === 'song') {
    const item = { id };
    return {
      type: 'insert',
      command: { ...command, id },
      songIds: [id],
      items: [item],
      blocks: [createSongBlock(id, command.line, item)]
    };
  }

  if (command.type !== 'album') {
    throw createPlaylistScriptError(`不支持的执行命令：${command.type}`, command.line);
  }
  if (typeof fetchAlbum !== 'function') {
    throw createPlaylistScriptError(`无法读取专辑 ${id}`, command.line);
  }

  let response;
  try {
    response = await fetchAlbum(id);
  } catch (error) {
    throw createPlaylistScriptError(`获取专辑 ${id} 失败：${error?.message || String(error)}`, command.line);
  }

  const songs = getAlbumSongs(response);
  if (!songs) {
    throw createPlaylistScriptError(`无法获取专辑 ${id} 的曲目`, command.line);
  }
  if (!songs.length) {
    throw createPlaylistScriptError(`专辑 ${id} 没有可用歌曲`, command.line);
  }

  const songIds = songs.map(song => normalizePlaylistId(song?.id));
  if (songIds.some(songId => !songId)) {
    throw createPlaylistScriptError(`专辑 ${id} 的曲目数据不完整，无法安全展开`, command.line);
  }

  const items = songs.map(song => toSongItem(song));
  return {
    type: 'insert',
    command: { ...command, id },
    songIds,
    items,
    blocks: [{
      ...command,
      id,
      songIds,
      items,
      albumName: response.album?.name || '',
      albumArtist: response.album?.artist?.name
        || response.album?.artists?.map(artist => artist.name).join('/')
        || ''
    }]
  };
}

export function applyCommand(plan, resolvedCommand, {
  position = null,
  selectedIndex = null,
  selectedSongId = null
} = {}) {
  if (!plan || !Array.isArray(plan.songIds)) {
    throw createPlaylistScriptError('执行方案无效');
  }
  if (!resolvedCommand || typeof resolvedCommand !== 'object') {
    throw createPlaylistScriptError('已解析命令无效');
  }

  if (resolvedCommand.type === 'clear') return { ...createSongPlan([]), selectedIndex: null };

  const currentSelectedId = selectedSongId == null && Number.isInteger(selectedIndex) && selectedIndex >= 0
    ? plan.songIds[selectedIndex]
    : selectedSongId == null ? null : String(selectedSongId);
  const findSelectedIndex = (nextIds, fallbackIndex = null) => resolveSelectionAfterTransform(
    nextIds,
    currentSelectedId,
    fallbackIndex
  );

  if (resolvedCommand.type === 'remove') {
    const { start, end } = resolvedCommand.command;
    const nextIds = removeSongRange(plan.songIds, start, end);
    const nextPlan = createSongPlan(nextIds, plan.items.filter((_, index) => index < start - 1 || index >= end));
    return { ...nextPlan, selectedIndex: findSelectedIndex(nextIds, start - 1) };
  }

  if (resolvedCommand.type === 'move') {
    const { start, end, target } = resolvedCommand.command;
    const movedId = plan.songIds[start - 1];
    const nextIds = moveSongRange(plan.songIds, start, end, target);
    const itemMap = new Map(plan.items.map(item => [String(item.id), item]));
    const nextPlan = createSongPlan(nextIds, nextIds.map(id => itemMap.get(String(id)) || { id }));
    return { ...nextPlan, selectedIndex: nextIds.indexOf(String(movedId)) };
  }

  if (resolvedCommand.type === 'swap') {
    const { positionA, positionB } = resolvedCommand.command;
    const nextIds = swapSongPositions(plan.songIds, positionA, positionB);
    const itemMap = new Map(plan.items.map(item => [String(item.id), item]));
    const nextPlan = createSongPlan(nextIds, nextIds.map(id => itemMap.get(String(id)) || { id }));
    return { ...nextPlan, selectedIndex: findSelectedIndex(nextIds) };
  }

  if (resolvedCommand.type === 'sort') {
    const sortPlan = resolvedCommand.items
      ? createSongPlan(plan.songIds, resolvedCommand.items)
      : plan;
    const nextPlan = sortSongRange(sortPlan, resolvedCommand.command, resolvedCommand.sortConfig);
    return { ...nextPlan, selectedIndex: findSelectedIndex(nextPlan.songIds) };
  }

  if (resolvedCommand.type !== 'insert') {
    throw createPlaylistScriptError('已解析命令不是可执行命令');
  }

  const insertAt = position ?? (
    Number.isInteger(selectedIndex) && selectedIndex >= 0
      ? selectedIndex + 1
      : plan.songIds.length
  );
  validateCommandPosition({ position: insertAt }, plan.songIds.length);

  const nextIds = insertSongIds(plan.songIds, resolvedCommand.songIds, insertAt);
  assertUniqueSongIds(nextIds);
  const existingItems = new Map((plan.items || []).map(item => [String(item.id), item]));
  const insertedItems = new Map((resolvedCommand.items || []).map(item => [String(item.id), item]));
  const items = nextIds.map(id => insertedItems.get(id) || existingItems.get(id) || { id });
  const nextPlan = createSongPlan(nextIds, items);

  return {
    ...nextPlan,
    insertedRange: {
      start: insertAt,
      end: insertAt + resolvedCommand.songIds.length - 1
    },
    selectedIndex: insertAt + resolvedCommand.songIds.length - 1
  };
}

export async function resolvePlaylistCommands(commands, { fetchAlbum } = {}) {
  if (!Array.isArray(commands)) {
    throw createPlaylistScriptError('命令列表必须是数组');
  }

  const songIds = [];
  const blocks = [];
  const items = [];
  for (const command of commands) {
    const resolved = await resolveCommand(command, { fetchAlbum });
    if (resolved.type === 'clear') {
      songIds.length = 0;
      blocks.length = 0;
      items.length = 0;
      continue;
    }
    songIds.push(...resolved.songIds);
    blocks.push(...resolved.blocks);
    items.push(...resolved.items);
  }
  assertUniqueSongIds(songIds);
  return { songIds, blocks, items };
}

export const expandPlaylistScript = resolvePlaylistCommands;

export function getPlaylistScriptDiff(currentIds, targetIds) {
  const current = currentIds.map(id => String(id));
  const target = targetIds.map(id => String(id));
  const currentSet = new Set(current);
  const targetSet = new Set(target);
  const addedIds = target.filter(id => !currentSet.has(id));
  const removedIds = current.filter(id => !targetSet.has(id));
  const currentCommon = current.filter(id => targetSet.has(id));
  const targetCommon = target.filter(id => currentSet.has(id));

  return {
    addedIds,
    removedIds,
    changedOrder: !sameSongOrder(currentCommon, targetCommon)
  };
}

export function sameSongOrder(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((id, index) => String(id) === String(right[index]));
}

export function getPlaylistScriptState(currentSongIds, savedScript) {
  if (!savedScript) {
    return {
      hasSavedScript: false,
      currentChanged: false,
      localChanged: false,
      conflicted: false
    };
  }

  const appliedSongIds = Array.isArray(savedScript.appliedSongIds)
    ? savedScript.appliedSongIds
    : [];
  const appliedScriptText = typeof savedScript.appliedScriptText === 'string'
    ? savedScript.appliedScriptText
    : '';
  const currentChanged = !sameSongOrder(currentSongIds, appliedSongIds);
  const localChanged = savedScript.scriptText !== appliedScriptText;
  return {
    hasSavedScript: true,
    currentChanged,
    localChanged,
    conflicted: currentChanged && localChanged
  };
}
