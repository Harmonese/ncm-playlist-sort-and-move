import { sleep, showToast } from '../utils/dom.js';
import { fetchAlbumDetail } from '../ncm/api.js';

export async function ensurePublishTimes(items) {
  const albumCache = {};
  const needAlbumFetch = items.filter(item => !item.publishTime && item.albumId > 0);

  if (!needAlbumFetch.length) return;

  showToast(`获取 ${needAlbumFetch.length} 首歌曲的专辑信息...`);
  for (let i = 0; i < needAlbumFetch.length; i++) {
    const item = needAlbumFetch[i];
    if (!albumCache[item.albumId]) {
      try {
        const albumDetail = await fetchAlbumDetail(item.albumId);
        if (albumDetail && albumDetail.code === 200) {
          albumCache[item.albumId] = albumDetail.album.publishTime || 0;
        }
        await sleep(100);
      } catch (e) {
        console.error(`获取专辑 ${item.albumId} 失败:`, e);
      }
    }
    item.publishTime = albumCache[item.albumId] || 0;

    if ((i + 1) % 10 === 0) {
      showToast(`获取专辑信息进度: ${i + 1}/${needAlbumFetch.length}`);
    }
  }
}
