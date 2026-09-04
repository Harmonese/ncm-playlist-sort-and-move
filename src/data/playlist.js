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

export async function getAllSongs(pid) {
  const detail = await fetchPlaylistDetail(pid);
  if (!detail || detail.code !== 200) throw new Error('playlist/detail failed: ' + JSON.stringify(detail));

  const pl = detail.playlist;
  const originalSongIds = getPlaylistTrackIds(pl);
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

  return {
    playlist: pl,
    items: stableSort(items, (a, b) => a.originalIndex - b.originalIndex),
    originalSongIds
  };
}
