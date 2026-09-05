import { sleep, showToast } from '../utils/dom.js';
import { fetchPlaylistDetail, fetchSongDetailByIds } from '../ncm/api.js';
import { toSongItem } from './song.js';
import { stableSort } from '../sort/order.js';

export function getPlaylistTrackIds(playlist) {
  if (Array.isArray(playlist?.trackIds) && playlist.trackIds.length) {
    return playlist.trackIds.map(track => track.id);
  }

  return (playlist?.tracks || []).map(song => song.id);
}

export function assertCompleteSongItems(originalSongIds, items) {
  const expectedIds = originalSongIds.map(id => String(id));
  const actualIds = items.map(item => String(item.id));
  const expectedCounts = new Map();
  const actualCounts = new Map();

  for (const id of expectedIds) expectedCounts.set(id, (expectedCounts.get(id) || 0) + 1);
  for (const id of actualIds) actualCounts.set(id, (actualCounts.get(id) || 0) + 1);

  const complete = expectedIds.length === actualIds.length
    && expectedCounts.size === actualCounts.size
    && [...expectedCounts].every(([id, count]) => actualCounts.get(id) === count);
  if (complete) return;

  const missingIds = [...expectedCounts]
    .filter(([id, count]) => (actualCounts.get(id) || 0) < count)
    .map(([id]) => id);
  throw new Error(
    `歌单歌曲详情不完整：应有 ${expectedIds.length} 首，实际获取 ${actualIds.length} 首${missingIds.length ? `；缺少 ${missingIds.slice(0, 5).join('、')}` : ''}`
  );
}

export async function getAllSongs(pid) {
  const detail = await fetchPlaylistDetail(pid);
  if (!detail || detail.code !== 200) throw new Error('playlist/detail failed: ' + JSON.stringify(detail));

  const pl = detail.playlist;
  const originalSongIds = getPlaylistTrackIds(pl);
  const trackCount = Number(pl.trackCount);
  if (Number.isFinite(trackCount) && trackCount > originalSongIds.length) {
    throw new Error(
      `歌单歌曲索引不完整：应有 ${trackCount} 首，实际获取 ${originalSongIds.length} 首`
    );
  }
  const originalIndexById = new Map(
    originalSongIds.map((id, index) => [String(id), index])
  );
  const items = [];

  if (pl.trackCount > (pl.tracks?.length || 0) && originalSongIds.length) {
    const trackIds = originalSongIds.map(id => ({ id }));
    const chunkSize = 1000;
    for (let i = 0; i < trackIds.length; i += chunkSize) {
      showToast(`拉取歌曲详情 ${i + 1}-${Math.min(i + chunkSize, trackIds.length)}/${trackIds.length}`);
      const part = await fetchSongDetailByIds(trackIds.slice(i, i + chunkSize));
      if (!part || part.code !== 200) throw new Error('song/detail failed at ' + i);
      for (const song of (part.songs || [])) {
        items.push(toSongItem(song, originalIndexById.get(String(song.id)) ?? items.length));
      }
      await sleep(120);
    }
  } else {
    for (const [index, song] of (pl.tracks || []).entries()) {
      items.push(toSongItem(song, originalIndexById.get(String(song.id)) ?? index));
    }
  }

  assertCompleteSongItems(originalSongIds, items);

  return {
    playlist: pl,
    items: stableSort(items, (a, b) => a.originalIndex - b.originalIndex),
    originalSongIds
  };
}
