import {
  addSongsToPlaylist,
  deleteSongsFromPlaylist,
  fetchAlbumDetail,
  fetchPlaylistDetail,
  fetchSongDetailByIds,
  updatePlaylistOrder
} from '../ncm/api.js';
import {
  buildPlaylistScript,
  parsePlaylistScript,
  parseSongOnlyPlaylistScript
} from '../data/playlist-script-protocol.js';
import {
  getPlaylistScriptDiff,
  getPlaylistScriptState,
  resolveCommand,
  resolvePlaylistCommands,
  resolveSortConfig,
  sameSongOrder
} from '../data/playlist-plan.js';
import { ensureHeatMetric } from '../data/heat.js';
import { getAllSongs, getPlaylistTrackIds } from '../data/playlist.js';
import { ensurePublishTimes } from '../data/publish-time.js';
import { toSongItem } from '../data/song.js';
import { loadArtistSortSettings } from '../settings/artist-sort.js';
import { loadDateSortSettings } from '../settings/date-sort.js';
import { loadHeatSortConfig } from '../settings/heat-sort.js';
import { loadPlaylistScript, savePlaylistScript } from '../settings/playlist-script.js';
import { saveOrderBackup } from '../settings/order-backup.js';
import { loadTitleSortConfig } from '../settings/title-sort.js';
import {
  showPlaylistScriptDialog,
  showPlaylistScriptPreviewDialog
} from '../ui/dialogs.js';
import { swalClasses } from '../ui/styles.js';
import { showToast } from '../utils/dom.js';

function normalizeIds(ids) {
  return ids.map(id => String(id));
}

function showOperationError(title, error) {
  return Swal.fire({
    icon: 'error',
    title,
    text: error?.message || String(error),
    customClass: swalClasses
  });
}

function getDriftWarning(state) {
  if (!state.currentChanged) return '';
  if (state.conflicted) {
    return '当前歌单和本地脚本都已发生变化。继续应用会以本地脚本覆盖当前歌单变化。';
  }
  return '当前歌单已偏离上次应用后的状态。继续应用会以本地脚本覆盖当前歌单变化。';
}

async function getEditorScript(saved, currentIds, resolveScript) {
  if (!saved) return buildPlaylistScript(currentIds);
  if (!saved.scriptText.trim()) return '';

  let commands;
  try {
    commands = parsePlaylistScript(saved.scriptText);
  } catch (error) {
    throw new Error(`已保存的歌单编排脚本无法解析，已停止操作：${error.message || String(error)}`);
  }

  if (!commands.some(command => command.type === 'album')) {
    return buildPlaylistScript(commands.map(command => command.id));
  }

  try {
    showToast('正在将旧版专辑命令展开为歌曲命令...');
    const expanded = await resolveScript(commands);
    return buildPlaylistScript(expanded.songIds);
  } catch (error) {
    throw new Error(`已保存的专辑命令无法安全展开，已停止操作：${error.message || String(error)}`);
  }
}

export async function editPlaylistScript(pid) {
  showToast('开始获取歌单歌曲...');
  const { playlist, items, originalSongIds } = await getAllSongs(pid);
  const saved = await loadPlaylistScript(pid);
  const currentIds = normalizeIds(originalSongIds);
  const albumResponses = new Map();
  const songItemsById = new Map(items.map(item => [String(item.id), item]));
  const fetchAlbum = async (albumId) => {
    if (!albumResponses.has(albumId)) {
      albumResponses.set(albumId, await fetchAlbumDetail(albumId));
    }
    return albumResponses.get(albumId);
  };
  const resolveScript = commands => resolvePlaylistCommands(commands, { fetchAlbum });
  const resolveSongItems = async (ids) => {
    const missingIds = [...new Set(ids.map(id => String(id)))].filter(id => !songItemsById.has(id));
    if (missingIds.length) {
      const response = await fetchSongDetailByIds(missingIds.map(id => ({ id })));
      if (!response || response.code !== 200) {
        throw new Error(`获取歌曲详情失败：${JSON.stringify(response)}`);
      }
      for (const song of response.songs || []) {
        const item = toSongItem(song);
        songItemsById.set(String(item.id), item);
      }
    }
    const missingAfterFetch = ids
      .map(id => String(id))
      .filter(id => !songItemsById.has(id));
    if (missingAfterFetch.length) {
      throw new Error(`歌曲详情不完整，缺少：${missingAfterFetch.slice(0, 5).join('、')}`);
    }
    return ids.map(id => songItemsById.get(String(id)));
  };
  const sortSettingsPromise = Promise.all([
    loadTitleSortConfig(),
    loadDateSortSettings(),
    loadArtistSortSettings(),
    loadHeatSortConfig()
  ]).then(([title, date, artist, heat]) => ({ title, date, artist, heat }));
  const resolveCommandWithCache = async (command, plan) => {
    if (command.type !== 'sort') return resolveCommand(command, { fetchAlbum });
    if (!plan || !Array.isArray(plan.songIds)) {
      throw new Error('排序命令缺少当前执行方案');
    }

    if (command.key === 'random') {
      return resolveCommand(command, {
        fetchAlbum,
        sortConfig: { random: true, randomFn: Math.random }
      });
    }

    const sortItems = await resolveSongItems(plan.songIds);
    const settings = await sortSettingsPromise;
    const sortConfig = resolveSortConfig(command, settings);
    if (command.key === 'date'
      || (command.key === 'artist' && sortConfig.artist.sortSameArtistByDate)) {
      await ensurePublishTimes(sortItems);
    }
    if (command.key === 'heat') {
      const metricResult = await ensureHeatMetric(sortItems, sortConfig.heat.metric);
      if (metricResult.failed) {
        showToast(`${metricResult.failed} 首歌曲的排序指标获取失败，将排在末尾`);
      }
    }
    return resolveCommand(command, { fetchAlbum, sortConfig, sortItems });
  };
  const initialScript = await getEditorScript(saved, currentIds, resolveScript);
  const state = getPlaylistScriptState(currentIds, saved);

  const editorResult = await showPlaylistScriptDialog(initialScript, {
    playlistName: playlist.name,
    currentCount: currentIds.length,
    currentScript: buildPlaylistScript(currentIds),
    currentItems: items,
    resolveScript,
    resolveCommand: resolveCommandWithCache,
    resolveSongItems,
    warning: getDriftWarning(state)
  });
  if (!editorResult.isConfirmed) return;

  const scriptText = editorResult.value.scriptText
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n');
  const commands = parseSongOnlyPlaylistScript(scriptText);

  let expanded;
  try {
    showToast('正在展开歌单编排脚本...');
    expanded = await resolveScript(commands);
  } catch (error) {
    await showOperationError('脚本展开失败', error);
    return;
  }

  // 只有脚本已经完整解析、专辑也安全展开后，才保存用户这次编辑的草稿。
  await savePlaylistScript(pid, {
    scriptText,
    appliedSongIds: saved && Array.isArray(saved.appliedSongIds) ? saved.appliedSongIds : currentIds,
    appliedScriptText: saved && typeof saved.appliedScriptText === 'string'
      ? saved.appliedScriptText
      : initialScript
  });

  const diff = getPlaylistScriptDiff(currentIds, expanded.songIds);
  const previewResult = await showPlaylistScriptPreviewDialog({
    playlistName: playlist.name,
    commandCount: commands.length,
    targetCount: expanded.songIds.length,
    addedCount: diff.addedIds.length,
    removedCount: diff.removedIds.length,
    changedOrder: diff.changedOrder,
    externalChange: state.currentChanged && !sameSongOrder(currentIds, expanded.songIds)
  });
  if (!previewResult.isConfirmed) return;

  if (!diff.addedIds.length && !diff.removedIds.length && !diff.changedOrder) {
    await savePlaylistScript(pid, {
      scriptText,
      appliedSongIds: expanded.songIds,
      appliedScriptText: scriptText
    });
    await Swal.fire({
      icon: 'info',
      title: '歌单没有变化',
      text: '脚本已保存，未写回网易云歌单。',
      customClass: swalClasses
    });
    return;
  }

  // 编辑弹窗打开期间歌单可能被其他页面或设备修改，写回前再检查一次。
  let latestDetail;
  try {
    latestDetail = await fetchPlaylistDetail(pid);
  } catch (error) {
    await showOperationError('无法确认当前歌单状态', error);
    return;
  }
  if (!latestDetail || latestDetail.code !== 200) {
    await showOperationError('无法确认当前歌单状态', new Error(JSON.stringify(latestDetail)));
    return;
  }
  const latestIds = normalizeIds(getPlaylistTrackIds(latestDetail.playlist));
  if (!sameSongOrder(currentIds, latestIds)) {
    await Swal.fire({
      icon: 'warning',
      title: '歌单在编辑期间发生变化',
      text: '本次写回已取消，刚才编辑的脚本已保留。请重新打开工具并确认最新差异。',
      customClass: swalClasses
    });
    return;
  }

  const backupSaved = await saveOrderBackup(pid, currentIds, playlist.name, {
    operation: 'script',
    removedSongIds: diff.removedIds,
    addedSongIds: diff.addedIds
  });

  try {
    if (diff.addedIds.length) {
      showToast(`正在加入 ${diff.addedIds.length} 首歌曲...`);
      const addResult = await addSongsToPlaylist(pid, diff.addedIds);
      if (!addResult || addResult.code !== 200) {
        throw new Error(`加入歌曲失败：${JSON.stringify(addResult)}`);
      }
    }

    if (diff.removedIds.length) {
      showToast(`正在移除 ${diff.removedIds.length} 首歌曲...`);
      const deleteResult = await deleteSongsFromPlaylist(pid, diff.removedIds);
      if (!deleteResult || deleteResult.code !== 200) {
        throw new Error(`移除歌曲失败：${JSON.stringify(deleteResult)}`);
      }
    }

    showToast('写回歌单顺序(op=update)...');
    const updateResult = await updatePlaylistOrder(pid, expanded.songIds);
    if (!updateResult || updateResult.code !== 200) {
      throw new Error(`写回歌单顺序失败：${JSON.stringify(updateResult)}`);
    }
  } catch (error) {
    await showOperationError('歌单编排失败', error);
    return;
  }

  const scriptSaved = await savePlaylistScript(pid, {
    scriptText,
    appliedSongIds: expanded.songIds,
    appliedScriptText: scriptText
  });
  await Swal.fire({
    icon: 'success',
    title: '歌单编排完成',
    text: `${playlist.name}\n共 ${expanded.songIds.length} 首歌曲\n${backupSaved ? '可从工具菜单恢复写回前顺序\n' : ''}${scriptSaved ? '脚本已保存到当前歌单\n' : ''}刷新页面查看新顺序`,
    customClass: swalClasses
  });
}
