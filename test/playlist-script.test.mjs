import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildPlaylistScript,
  applyCommand,
  createSongPlan,
  expandPlaylistScript,
  getPlaylistScriptState,
  assertUniqueSongIds,
  insertSongIds,
  moveSongRange,
  parseCommandLine,
  parsePlaylistCommand,
  parsePlaylistScript,
  parseSongOnlyPlaylistScript,
  resolveCommand,
  resolveSortConfig,
  removeSongRange,
  sameSongOrder,
  sortSongRange,
  swapSongPositions,
  validateCommandPosition
} = await import('../src/data/playlist-script.js');
const { shuffleItems } = await import('../src/sort/random.js');

test('playlist scripts parse song and album commands while ignoring comments', () => {
  assert.deepEqual(
    parsePlaylistScript(`\n# ncm-playlist: 1\n\nsong 123\nalbum 456\n`),
    [
      { type: 'song', id: '123', line: 4 },
      { type: 'album', id: '456', line: 5 }
    ]
  );
});

test('playlist scripts reject unsupported commands and empty scripts', () => {
  assert.throws(() => parsePlaylistScript('remove song 123'), /第 1 行/);
  assert.throws(() => parsePlaylistScript('# only comments'), /至少需要包含/);
  assert.throws(() => parsePlaylistScript('# ncm-playlist: 2\nsong 123'), /不支持的脚本版本/);
  assert.throws(() => parsePlaylistScript('song abc'), /ID 必须是正整数/);
});

test('playlist script editor accepts only song commands', () => {
  assert.deepEqual(
    parseSongOnlyPlaylistScript('# notes\nsong 123'),
    [{ type: 'song', id: '123', line: 2 }]
  );
  assert.throws(
    () => parseSongOnlyPlaylistScript('album 456'),
    /脚本文本只支持 song/
  );
});

test('playlist command line parses one song or album command', () => {
  assert.deepEqual(parsePlaylistCommand(' album 456 '), {
    type: 'album',
    id: '456',
    line: 1
  });
  assert.deepEqual(parseCommandLine('song 123 0'), {
    type: 'song',
    id: '123',
    position: 0,
    line: 1
  });
  assert.deepEqual(parseCommandLine('album 456 12').position, 12);
  assert.deepEqual(parseCommandLine('clear'), {
    type: 'clear',
    line: 1
  });
  assert.deepEqual(parseCommandLine('remove 2 5'), {
    type: 'remove',
    start: 2,
    end: 5,
    line: 1
  });
  assert.deepEqual(parseCommandLine('move 2 5 0'), {
    type: 'move',
    start: 2,
    end: 5,
    target: 0,
    line: 1
  });
  assert.deepEqual(parseCommandLine('swap 2 8'), {
    type: 'swap',
    positionA: 2,
    positionB: 8,
    line: 1
  });
  assert.deepEqual(parseCommandLine('sort date desc album track 2 10'), {
    type: 'sort',
    key: 'date',
    options: {
      descending: true,
      sortAlbumsByName: true,
      sortAlbumTracks: true
    },
    start: 2,
    end: 10,
    line: 1
  });
  assert.deepEqual(parseCommandLine('sort artist original nodate 5 20').options, {
    sortArtistsByName: false,
    sortSameArtistByDate: false
  });
  assert.deepEqual(parseCommandLine('sort heat popularity asc').options, {
    metric: 'popularity',
    descending: false
  });
  assert.deepEqual(parseCommandLine('sort random 2 10'), {
    type: 'sort',
    key: 'random',
    options: {},
    start: 2,
    end: 10,
    line: 1
  });
  assert.throws(() => parsePlaylistCommand('song 1\nsong 2'), /一次只能输入一条/);
  assert.throws(() => parseCommandLine('song 123 -1'), /position 必须/);
  assert.throws(() => parseCommandLine('sort title asc'), /title 不支持参数/);
  assert.throws(() => parseCommandLine('sort date noalbum track'), /track 需要/);
  assert.throws(() => parseCommandLine('sort random asc'), /random 不支持参数/);
});

test('playlist command positions are validated against the current plan', () => {
  validateCommandPosition({ type: 'song', id: '1', position: 0 }, 0);
  validateCommandPosition({ type: 'song', id: '1', position: 3 }, 3);
  assert.throws(
    () => validateCommandPosition({ type: 'song', id: '1', position: 4 }, 3),
    /超出当前歌单范围/
  );
  assert.deepEqual(insertSongIds(['1', '2', '3'], ['9', '10'], 1), ['1', '9', '10', '2', '3']);
  assert.throws(() => assertUniqueSongIds(['1', '2', '1']), /重复歌曲/);
});

test('range plan operations use current positions and a unified move target', () => {
  const ids = Array.from({ length: 12 }, (_, index) => String(index + 1));
  assert.deepEqual(removeSongRange(ids, 2, 5), ['1', '6', '7', '8', '9', '10', '11', '12']);
  assert.deepEqual(moveSongRange(ids, 2, 5, 0), [
    '2', '3', '4', '5', '1', '6', '7', '8', '9', '10', '11', '12'
  ]);
  assert.deepEqual(moveSongRange(ids, 2, 5, 10), [
    '1', '6', '7', '8', '9', '10', '2', '3', '4', '5', '11', '12'
  ]);
  assert.deepEqual(moveSongRange(ids, 8, 10, 2), [
    '1', '2', '8', '9', '10', '3', '4', '5', '6', '7', '11', '12'
  ]);
  assert.deepEqual(swapSongPositions(ids, 2, 8), [
    '1', '8', '3', '4', '5', '6', '7', '2', '9', '10', '11', '12'
  ]);
  assert.throws(() => moveSongRange(ids, 2, 5, 3), /移动区间内部/);
  assert.throws(() => removeSongRange(ids, 2, 13), /超出当前歌单范围/);
});

test('sort commands sort only the requested range', () => {
  const items = ['delta', 'charlie', 'bravo', 'alpha', 'echo'].map((title, index) => ({
    id: String(index + 1),
    title,
    artist: 'artist',
    album: 'album',
    originalIndex: index
  }));
  const command = parseCommandLine('sort title 2 4');
  const config = resolveSortConfig(command, {
    title: { directStringCompare: true },
    date: {},
    artist: {},
    heat: {}
  });
  const result = sortSongRange(createSongPlan(items.map(item => item.id), items), command, config);
  assert.deepEqual(result.songIds, ['1', '4', '3', '2', '5']);
});

test('sort commands use the resolve and apply pipeline', async () => {
  const items = [
    { id: '1', title: 'b', artist: 'a', album: 'a', originalIndex: 0 },
    { id: '2', title: 'a', artist: 'a', album: 'a', originalIndex: 1 }
  ];
  const command = parseCommandLine('sort title');
  const config = resolveSortConfig(command, { title: { directStringCompare: true } });
  const resolved = await resolveCommand(command, { sortConfig: config, sortItems: items });
  const result = applyCommand(createSongPlan(['1', '2']), resolved);
  assert.deepEqual(result.songIds, ['2', '1']);
});

test('random sort shuffles only the requested range', async () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((title, index) => ({
    id: String(index + 1),
    title,
    originalIndex: index
  }));
  assert.deepEqual(shuffleItems(items, () => 0).map(item => item.id), ['2', '3', '4', '5', '1']);

  const command = parseCommandLine('sort random 2 4');
  const config = resolveSortConfig(command, {});
  const resolved = await resolveCommand(command, {
    sortConfig: { ...config, randomFn: () => 0 },
    sortItems: items
  });
  const result = applyCommand(createSongPlan(items.map(item => item.id), items), resolved);
  assert.deepEqual(result.songIds, ['1', '3', '4', '2', '5']);
});

test('sorting an empty plan without a range is a no-op', () => {
  const command = parseCommandLine('sort title');
  const config = resolveSortConfig(command, {});
  assert.deepEqual(sortSongRange(createSongPlan([]), command, config).songIds, []);
});

test('resolved commands apply atomically at explicit and selected positions', async () => {
  const plan = createSongPlan(['1', '2', '3']);
  const resolved = await resolveCommand({ type: 'song', id: '9', line: 1 });

  const explicit = applyCommand(plan, resolved, { position: 0 });
  assert.deepEqual(explicit.songIds, ['9', '1', '2', '3']);
  assert.equal(explicit.selectedIndex, 0);

  const selected = applyCommand(plan, resolved, { selectedIndex: 1 });
  assert.deepEqual(selected.songIds, ['1', '2', '9', '3']);
  assert.equal(selected.selectedIndex, 2);
  assert.throws(
    () => applyCommand(plan, resolved, { position: 4 }),
    /超出当前歌单范围/
  );
});

test('resolved range commands update the plan and selection', async () => {
  const plan = createSongPlan(['1', '2', '3', '4', '5']);
  const removed = applyCommand(
    plan,
    await resolveCommand({ type: 'remove', start: 2, end: 3, line: 1 }),
    { selectedIndex: 1 }
  );
  assert.deepEqual(removed.songIds, ['1', '4', '5']);
  assert.equal(removed.selectedIndex, 1);

  const moved = applyCommand(
    plan,
    await resolveCommand({ type: 'move', start: 2, end: 3, target: 0, line: 1 })
  );
  assert.deepEqual(moved.songIds, ['2', '3', '1', '4', '5']);
  assert.equal(moved.selectedIndex, 0);

  const swapped = applyCommand(
    plan,
    await resolveCommand({ type: 'swap', positionA: 2, positionB: 5, line: 1 }),
    { selectedIndex: 1 }
  );
  assert.deepEqual(swapped.songIds, ['1', '5', '3', '4', '2']);
  assert.equal(swapped.selectedIndex, 4);
});

test('clear resolves to an empty plan and can be followed by insertion', async () => {
  const cleared = applyCommand(
    createSongPlan(['1', '2']),
    await resolveCommand({ type: 'clear', line: 1 })
  );
  assert.deepEqual(cleared.songIds, []);

  const next = applyCommand(
    cleared,
    await resolveCommand({ type: 'song', id: '3', line: 1 })
  );
  assert.deepEqual(next.songIds, ['3']);
});

test('playlist scripts expand albums into album track order', async () => {
  const expanded = await expandPlaylistScript([
    { type: 'song', id: '1', line: 1 },
    { type: 'album', id: '2', line: 2 }
  ], {
    fetchAlbum: async (id) => ({
      code: 200,
      album: {
        name: `Album ${id}`,
        songs: [{ id: 20 }, { id: 21 }]
      }
    })
  });

  assert.deepEqual(expanded.songIds, ['1', '20', '21']);
  assert.equal(expanded.blocks[1].albumName, 'Album 2');
});

test('playlist scripts prefer non-empty top-level album songs', async () => {
  const expanded = await expandPlaylistScript([
    { type: 'album', id: '2', line: 1 }
  ], {
    fetchAlbum: async () => ({
      code: 200,
      album: { songs: [] },
      songs: [{ id: 20 }, { id: 21 }]
    })
  });

  assert.deepEqual(expanded.songIds, ['20', '21']);
});

test('playlist scripts reject duplicate songs after album expansion', async () => {
  await assert.rejects(
    expandPlaylistScript([
      { type: 'song', id: '20', line: 1 },
      { type: 'album', id: '2', line: 2 }
    ], {
      fetchAlbum: async () => ({ code: 200, album: { songs: [{ id: 20 }] } })
    }),
    /重复歌曲/
  );
});

test('playlist scripts reject partially invalid album data instead of filtering it', async () => {
  await assert.rejects(
    expandPlaylistScript([
      { type: 'album', id: '2', line: 1 }
    ], {
      fetchAlbum: async () => ({
        code: 200,
        album: { songs: [{ id: 20 }, { name: 'missing id' }] }
      })
    }),
    /曲目数据不完整/
  );
});

test('playlist script export is a canonical song-only representation', () => {
  assert.equal(buildPlaylistScript([1, '2']), 'song 1\nsong 2');
  assert.equal(buildPlaylistScript([]), '');
  assert.deepEqual(parseSongOnlyPlaylistScript(''), []);
});

test('playlist script state distinguishes remote drift and local edits', () => {
  const saved = {
    scriptText: 'song 1\nsong 3',
    appliedScriptText: 'song 1\nsong 2',
    appliedSongIds: ['1', '2']
  };

  assert.deepEqual(getPlaylistScriptState(['1', '2'], saved), {
    hasSavedScript: true,
    currentChanged: false,
    localChanged: true,
    conflicted: false
  });
  assert.deepEqual(getPlaylistScriptState(['1', '4'], saved), {
    hasSavedScript: true,
    currentChanged: true,
    localChanged: true,
    conflicted: true
  });
  assert.equal(sameSongOrder(['1', 2], [1, '2']), true);
});

test('empty saved scripts remain an explicit empty target', () => {
  assert.deepEqual(getPlaylistScriptState(['1'], {
    scriptText: '',
    appliedScriptText: '',
    appliedSongIds: []
  }), {
    hasSavedScript: true,
    currentChanged: true,
    localChanged: false,
    conflicted: false
  });
});
