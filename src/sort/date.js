import { cmpByTitle } from './title.js';

export function cmpByDate(descending) {
  return (a, b) => {
    // 先按发行时间排序
    const timeA = a.publishTime || 0;
    const timeB = b.publishTime || 0;

    if (timeA !== timeB) {
      return descending ? (timeB - timeA) : (timeA - timeB);
    }

    // 发行时间相同则按标题排序
    return cmpByTitle(a, b);
  };
}
