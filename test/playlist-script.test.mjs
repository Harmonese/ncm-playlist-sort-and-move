import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildPlaylistScript,
  expandPlaylistScript,
  getPlaylistScriptState,
  parsePlaylistScript,
  sameSongOrder
} = await import('../src/data/playlist-script.js');

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

test('playlist script export is a canonical song-only representation', () => {
  assert.equal(buildPlaylistScript([1, '2']), 'song 1\nsong 2');
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
