export const PLAYLIST_SCRIPT_VERSION = 1;
export const PLAYLIST_SCRIPT_HEADER = '# ncm-playlist: 1';

export function normalizePlaylistId(value) {
  const id = String(value ?? '').trim();
  return /^[1-9]\d*$/.test(id) ? id : null;
}

export function createPlaylistScriptError(message, line = null) {
  const error = new Error(line ? `第 ${line} 行：${message}` : message);
  error.name = 'PlaylistScriptError';
  error.line = line;
  return error;
}

function parsePosition(value) {
  if (value === undefined) return null;
  if (!/^\d+$/.test(value)) {
    throw createPlaylistScriptError('position 必须是非负整数');
  }
  const position = Number(value);
  if (!Number.isSafeInteger(position)) {
    throw createPlaylistScriptError('position 超出安全整数范围');
  }
  return position;
}

function parseSongPosition(value, label = '位置') {
  if (!/^\d+$/.test(value)) {
    throw createPlaylistScriptError(`${label}必须是正整数`);
  }
  const position = Number(value);
  if (!Number.isSafeInteger(position) || position < 1) {
    throw createPlaylistScriptError(`${label}必须是正整数`);
  }
  return position;
}

function isUnsignedIntegerToken(value) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
}

function parseSortCommand(tokens) {
  if (!tokens.length) {
    throw createPlaylistScriptError('sort 后需要指定 title、date、artist 或 heat');
  }

  let end = null;
  let start = null;
  if (tokens.length >= 3
    && isUnsignedIntegerToken(tokens[tokens.length - 1])
    && isUnsignedIntegerToken(tokens[tokens.length - 2])) {
    start = parseSongPosition(tokens[tokens.length - 2], '排序起始位置');
    end = parseSongPosition(tokens[tokens.length - 1], '排序结束位置');
    tokens = tokens.slice(0, -2);
  }

  const key = tokens.shift().toLowerCase();
  const options = {};
  const seen = new Set();
  const addOption = (name, value) => {
    if (seen.has(name)) throw createPlaylistScriptError(`sort 参数重复：${name}`);
    seen.add(name);
    options[name] = value;
  };

  if (!['title', 'date', 'artist', 'heat', 'random'].includes(key)) {
    throw createPlaylistScriptError(`不支持的排序类型：${key}`);
  }

  if (key === 'random' && tokens.length) {
    throw createPlaylistScriptError(`random 不支持参数：${tokens[0]}`);
  }

  if (key === 'heat') {
    const metric = tokens.shift()?.toLowerCase();
    const metricAliases = {
      popularity: 'popularity',
      red: 'redCount',
      redcount: 'redCount',
      comments: 'commentCount',
      comment: 'commentCount',
      commentcount: 'commentCount'
    };
    if (!metricAliases[metric]) {
      throw createPlaylistScriptError('heat 必须指定 popularity、red 或 comments');
    }
    addOption('metric', metricAliases[metric]);
  }

  for (const rawOption of tokens) {
    const option = rawOption.toLowerCase();
    if (key === 'title') {
      throw createPlaylistScriptError(`title 不支持参数：${rawOption}`);
    }
    if (option === 'asc' || option === 'desc') {
      addOption('descending', option === 'desc');
      continue;
    }
    if (key === 'date' || key === 'artist') {
      if (option === 'album' || option === 'noalbum') {
        addOption('sortAlbumsByName', option === 'album');
        continue;
      }
      if (option === 'track' || option === 'notrack') {
        addOption('sortAlbumTracks', option === 'track');
        continue;
      }
    }
    if (key === 'artist') {
      if (option === 'name' || option === 'original') {
        addOption('sortArtistsByName', option === 'name');
        continue;
      }
      if (option === 'date' || option === 'nodate') {
        addOption('sortSameArtistByDate', option === 'date');
        continue;
      }
    }
    if (key === 'heat' && (option === 'asc' || option === 'desc')) continue;
    throw createPlaylistScriptError(`不支持的 sort 参数：${rawOption}`);
  }

  if (key === 'heat' && !Object.hasOwn(options, 'metric')) {
    throw createPlaylistScriptError('heat 必须指定排序指标');
  }
  if (options.sortAlbumTracks === true && options.sortAlbumsByName === false) {
    throw createPlaylistScriptError('track 需要先启用 album');
  }

  return {
    type: 'sort',
    key,
    options,
    start,
    end,
    line: 1
  };
}

export function validateCommandPosition(command, currentCount) {
  if (command.position === null || command.position === undefined) return;
  if (!Number.isInteger(currentCount) || currentCount < 0) {
    throw createPlaylistScriptError('无法确认当前歌单歌曲数量');
  }
  if (command.position > currentCount) {
    throw createPlaylistScriptError(
      `position ${command.position} 超出当前歌单范围（0-${currentCount}）`
    );
  }
}

export function parsePlaylistScript(text, { allowEmpty = false } = {}) {
  if (typeof text !== 'string') {
    throw createPlaylistScriptError('脚本内容必须是文本');
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
        throw createPlaylistScriptError(`不支持的脚本版本：${header[1]}`, lineNumber);
      }
      return;
    }

    const match = line.match(/^(song|album)\s+(\S+)$/i);
    if (!match) {
      throw createPlaylistScriptError('只支持 song <歌曲ID> 或 album <专辑ID>', lineNumber);
    }

    const id = normalizePlaylistId(match[2]);
    if (!id) {
      throw createPlaylistScriptError('ID 必须是正整数', lineNumber);
    }

    commands.push({ type: match[1].toLowerCase(), id, line: lineNumber });
  });

  if (!commands.length && !allowEmpty) {
    throw createPlaylistScriptError('脚本至少需要包含一条 song 或 album 命令');
  }

  return commands;
}

export function parseScriptDocument(text) {
  const commands = parsePlaylistScript(text, { allowEmpty: true });
  const albumCommand = commands.find(command => command.type === 'album');
  if (albumCommand) {
    throw createPlaylistScriptError('脚本文本只支持 song <歌曲ID>', albumCommand.line);
  }
  return commands;
}

export function parseSongOnlyPlaylistScript(text) {
  return parseScriptDocument(text);
}

export function parseCommandLine(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw createPlaylistScriptError('请输入命令');
  }

  const normalizedText = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim();
  if (normalizedText.includes('\n')) {
    throw createPlaylistScriptError('命令行一次只能输入一条命令');
  }

  if (/^clear$/i.test(normalizedText)) {
    return { type: 'clear', line: 1 };
  }

  const tokens = normalizedText.split(/\s+/);
  const verb = tokens.shift().toLowerCase();

  if (verb === 'song' || verb === 'album') {
    if (tokens.length < 1 || tokens.length > 2) {
      throw createPlaylistScriptError('只支持 song ID [position] 或 album ID [position]');
    }
    const id = normalizePlaylistId(tokens[0]);
    if (!id) {
      throw createPlaylistScriptError('ID 必须是正整数');
    }
    const command = { type: verb, id, line: 1 };
    if (tokens[1] !== undefined) command.position = parsePosition(tokens[1]);
    return command;
  }

  if (verb === 'remove') {
    if (tokens.length < 1 || tokens.length > 2) {
      throw createPlaylistScriptError('remove 需要 start [end]');
    }
    const start = parseSongPosition(tokens[0], '起始位置');
    const end = tokens[1] === undefined ? start : parseSongPosition(tokens[1], '结束位置');
    return { type: 'remove', start, end, line: 1 };
  }

  if (verb === 'move') {
    if (tokens.length !== 3) throw createPlaylistScriptError('move 需要 start end target');
    return {
      type: 'move',
      start: parseSongPosition(tokens[0], '起始位置'),
      end: parseSongPosition(tokens[1], '结束位置'),
      target: parsePosition(tokens[2]),
      line: 1
    };
  }

  if (verb === 'swap') {
    if (tokens.length !== 2) throw createPlaylistScriptError('swap 需要两个歌曲位置');
    return {
      type: 'swap',
      positionA: parseSongPosition(tokens[0], '歌曲位置'),
      positionB: parseSongPosition(tokens[1], '歌曲位置'),
      line: 1
    };
  }

  if (verb === 'sort') return parseSortCommand(tokens);

  throw createPlaylistScriptError(
    '支持 song ID [position]、album ID [position]、clear、remove、move、swap 或 sort'
  );
}

export function parsePlaylistCommand(text) {
  return parseCommandLine(text);
}

export function buildSongScript(songIds) {
  if (!Array.isArray(songIds)) {
    throw createPlaylistScriptError('歌曲 ID 列表必须是数组');
  }

  return songIds.map((id) => {
    const normalizedId = normalizePlaylistId(id);
    if (!normalizedId) throw createPlaylistScriptError(`无效歌曲 ID：${id}`);
    return `song ${normalizedId}`;
  }).join('\n');
}

export function buildPlaylistScript(songIds) {
  return buildSongScript(songIds);
}
