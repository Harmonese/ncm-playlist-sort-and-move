import { sleep, showToast } from '../utils/dom.js';
import { fetchPlaylistDetail, fetchSongDetailByIds } from '../ncm/api.js';
import { toSongItem } from './song.js';

export async function getAllSongs(pid) {
  const detail = await fetchPlaylistDetail(pid);
  if (!detail || detail.code !== 200) throw new Error('playlist/detail failed: ' + JSON.stringify(detail));

  const pl = detail.playlist;
  const items = [];

  if (pl.trackCount > (pl.tracks?.length || 0)) {
    const trackIds = (pl.trackIds || []).map(t => ({ id: t.id }));
    const chunkSize = 1000;
    for (let i = 0; i < trackIds.length; i += chunkSize) {
      showToast(`拉取歌曲详情 ${i + 1}-${Math.min(i + chunkSize, trackIds.length)}/${trackIds.length}`);
      const part = await fetchSongDetailByIds(trackIds.slice(i, i + chunkSize));
      if (!part || part.code !== 200) throw new Error('song/detail failed at ' + i);
      for (const song of (part.songs || [])) {
        items.push(toSongItem(song));
      }
      await sleep(120);
    }
  } else {
    for (const song of (pl.tracks || [])) {
      items.push(toSongItem(song));
    }
  }
  return { playlist: pl, items };
}
