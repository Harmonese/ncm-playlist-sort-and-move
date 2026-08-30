import { sleep, showToast } from '../utils/dom.js';
import {
  fetchSongCommentCounts,
  fetchSongRedCount
} from '../ncm/api.js';

const redCountCache = new Map();
const commentCountCache = new Map();

function isMissing(value) {
  return value === null || value === undefined;
}

export async function ensureRedCounts(items) {
  const needFetch = items.filter(item => isMissing(item.redCount));
  let failed = 0;

  for (let i = 0; i < needFetch.length; i++) {
    const item = needFetch[i];
    if (redCountCache.has(item.id)) {
      item.redCount = redCountCache.get(item.id);
      continue;
    }

    try {
      const result = await fetchSongRedCount(item.id);
      const count = Number(result?.data?.count);
      if (result?.code === 200 && Number.isFinite(count) && count >= 0) {
        item.redCount = count;
        redCountCache.set(item.id, count);
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      console.error(`获取歌曲 ${item.id} 红心数失败:`, error);
    }

    if ((i + 1) % 10 === 0) {
      showToast(`获取红心数进度: ${i + 1}/${needFetch.length}`);
    }
    await sleep(100);
  }

  return { failed, requested: needFetch.length };
}

export async function ensureCommentCounts(items) {
  const needFetch = items.filter(item => isMissing(item.commentCount));
  let failed = 0;

  for (let start = 0; start < needFetch.length; start += 1000) {
    const batch = needFetch.slice(start, start + 1000);
    const uncached = batch.filter(item => !commentCountCache.has(item.id));
    for (const item of batch) {
      if (commentCountCache.has(item.id)) {
        item.commentCount = commentCountCache.get(item.id);
      }
    }
    if (!uncached.length) continue;

    try {
      const result = await fetchSongCommentCounts(uncached.map(item => item.id));
      if (result?.code !== 200 || !Array.isArray(result.data)) {
        failed += uncached.length;
      } else {
        const counts = new Map();
        for (const entry of result.data) {
          const count = Number(entry.commentCount);
          if (Number.isFinite(count) && count >= 0) {
            counts.set(String(entry.resourceId), count);
          }
        }
        for (const item of uncached) {
          const count = counts.get(String(item.id));
          if (count === undefined) {
            failed++;
          } else {
            item.commentCount = count;
            commentCountCache.set(item.id, count);
          }
        }
      }
    } catch (error) {
      failed += uncached.length;
      console.error(`获取歌曲评论数失败（${uncached.length} 首）:`, error);
    }

    showToast(`获取评论数进度: ${Math.min(start + batch.length, needFetch.length)}/${needFetch.length}`);
    await sleep(100);
  }

  return { failed, requested: needFetch.length };
}

export async function ensureHeatMetric(items, metric) {
  if (metric === 'redCount') return ensureRedCounts(items);
  if (metric === 'commentCount') return ensureCommentCounts(items);
  return { failed: 0, requested: 0 };
}
