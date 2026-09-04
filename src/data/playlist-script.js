import { fetchAlbumDetail } from '../ncm/api.js';
import { toSongItem } from './song.js';

export const PLAYLIST_SCRIPT_VERSION = 1;
export const PLAYLIST_SCRIPT_HEADER = '# ncm-playlist: 1';

function normalizeId(value) {
  const id = String(value ?? '').trim();
  return /^[1-9]\d*$/.test(id) ? id : null;
}

function createScriptError(message, line = null) {
  const error = new Error(line ? `第 ${line} 行：${message}` : message);
  error.name = 'PlaylistScriptError';
  error.line = line;
  return error;
}

export function parsePlaylistScript(text) {
  if (typeof text !== 'string') {
    throw createScriptError('脚本内容必须是文本');
  }

  const commands = [];
  const lines = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith('#')) {
      const header = line.match(/^#\s*ncm-playlist\s*:\s*(\d+)$/i);
      if (header && Number(header[1]) !== PLAYLIST_SCRIPT_VERSION) {
        throw createScriptError(`不支持的脚本版本：${header[1]}`, lineNumber);
      }
      return;
    }

    const match = line.match(/^(song|album)\s+(\S+)$/i);
    if (!match) {
      throw createScriptError('只支持 song <歌曲ID> 或 album <专辑ID>', lineNumber);
    }

    const id = normalizeId(match[2]);
    if (!id) {
      throw createScriptError('ID 必须是正整数', lineNumber);
    }

    commands.push({ type: match[1].toLowerCase(), id, line: lineNumber });
  });

  if (!commands.length) {
    throw createScriptError('脚本至少需要包含一条 song 或 album 命令');
  }

  return commands;
}

export function buildPlaylistScript(songIds) {
  if (!Array.isArray(songIds) || !songIds.length) {
    throw createScriptError('无法为没有歌曲的歌单生成脚本');
  }

  const lines = songIds.map((id) => {
    const normalizedId = normalizeId(id);
    if (!normalizedId) throw createScriptError(`无效歌曲 ID：${id}`);
    return `song ${normalizedId}`;
  });

  return lines.join('\n');
}

function getAlbumSongs(response) {
  if (!response || response.code !== 200) return null;
  const nestedSongs = response.album?.songs;
  if (Array.isArray(nestedSongs) && nestedSongs.length) return nestedSongs;
  if (Array.isArray(response.songs) && response.songs.length) return response.songs;
  return Array.isArray(nestedSongs) ? nestedSongs : null;
}

export async function expandPlaylistScript(commands, {
  fetchAlbum = fetchAlbumDetail
} = {}) {
  if (!Array.isArray(commands) || !commands.length) {
    throw createScriptError('没有可执行的脚本命令');
  }

  const songIds = [];
  const blocks = [];
  const items = [];
  const albumCache = new Map();

  for (const command of commands) {
    if (command.type === 'song') {
      songIds.push(command.id);
      const songItem = { id: command.id };
      blocks.push({ ...command, songIds: [command.id], items: [songItem] });
      items.push(songItem);
      continue;
    }

    let response = albumCache.get(command.id);
    if (!response) {
      try {
        response = await fetchAlbum(command.id);
        albumCache.set(command.id, response);
      } catch (error) {
        throw createScriptError(`获取专辑 ${command.id} 失败：${error?.message || String(error)}`, command.line);
      }
    }

    const songs = getAlbumSongs(response);
    if (!songs) {
      throw createScriptError(`无法获取专辑 ${command.id} 的曲目`, command.line);
    }

    const albumSongIds = songs.map(song => normalizeId(song?.id)).filter(Boolean);
    if (!albumSongIds.length) {
      throw createScriptError(`专辑 ${command.id} 没有可用歌曲`, command.line);
    }

    songIds.push(...albumSongIds);
    items.push(...songs.map(song => toSongItem(song)));
    blocks.push({
      ...command,
      songIds: albumSongIds,
      items: songs.map(song => toSongItem(song)),
      albumName: response.album?.name || '',
      albumArtist: response.album?.artist?.name || response.album?.artists?.map(a => a.name).join('/') || ''
    });
  }

  const seenIds = new Set();
  const duplicateIds = new Set();
  for (const id of songIds) {
    if (seenIds.has(id)) duplicateIds.add(id);
    seenIds.add(id);
  }
  if (duplicateIds.size) {
    throw createScriptError(`展开后存在重复歌曲：${[...duplicateIds].join('、')}`);
  }

  return { songIds, blocks, items };
}

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

  const currentChanged = !sameSongOrder(currentSongIds, savedScript.appliedSongIds);
  const localChanged = savedScript.scriptText !== savedScript.appliedScriptText;
  return {
    hasSavedScript: true,
    currentChanged,
    localChanged,
    conflicted: currentChanged && localChanged
  };
}
