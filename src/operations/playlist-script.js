import {
  addSongsToPlaylist,
  deleteSongsFromPlaylist,
  fetchAlbumDetail,
  fetchPlaylistDetail,
  updatePlaylistOrder
} from '../ncm/api.js';
import {
  buildPlaylistScript,
  expandPlaylistScript,
  getPlaylistScriptDiff,
  getPlaylistScriptState,
  parsePlaylistScript,
  sameSongOrder
} from '../data/playlist-script.js';
import { getAllSongs, getPlaylistTrackIds } from '../data/playlist.js';
import { loadPlaylistScript, savePlaylistScript } from '../settings/playlist-script.js';
import { saveOrderBackup } from '../settings/order-backup.js';
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

export async function editPlaylistScript(pid) {
  showToast('开始获取歌单歌曲...');
  const { playlist, items, originalSongIds } = await getAllSongs(pid);
  const saved = await loadPlaylistScript(pid);
  const currentIds = normalizeIds(originalSongIds);
  const initialScript = saved?.scriptText || buildPlaylistScript(currentIds);
  const state = getPlaylistScriptState(currentIds, saved);
  const albumResponses = new Map();
  const resolveScript = commands => expandPlaylistScript(commands, {
    fetchAlbum: async (albumId) => {
      if (!albumResponses.has(albumId)) {
        albumResponses.set(albumId, await fetchAlbumDetail(albumId));
      }
      return albumResponses.get(albumId);
    }
  });

  const editorResult = await showPlaylistScriptDialog(initialScript, {
    playlistName: playlist.name,
    currentCount: currentIds.length,
    currentScript: buildPlaylistScript(currentIds),
    currentItems: items,
    resolveScript,
    warning: getDriftWarning(state)
  });
  if (!editorResult.isConfirmed) return;

  const scriptText = editorResult.value.scriptText
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n');
  const commands = parsePlaylistScript(scriptText);

  // 先保留用户刚刚编辑的脚本；应用成功后再更新 appliedSongIds。
  await savePlaylistScript(pid, {
    scriptText,
    appliedSongIds: saved?.appliedSongIds?.length ? saved.appliedSongIds : currentIds,
    appliedScriptText: saved?.appliedScriptText || initialScript
  });

  let expanded;
  try {
    showToast('正在展开歌单编排脚本...');
    expanded = await resolveScript(commands);
  } catch (error) {
    await showOperationError('脚本展开失败', error);
    return;
  }

  const diff = getPlaylistScriptDiff(currentIds, expanded.songIds);
  const previewResult = await showPlaylistScriptPreviewDialog({
    playlistName: playlist.name,
    commandCount: commands.length,
    targetCount: expanded.songIds.length,
    addedCount: diff.addedIds.length,
    removedCount: diff.removedIds.length,
    changedOrder: diff.changedOrder,
    albumCount: commands.filter(command => command.type === 'album').length,
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
