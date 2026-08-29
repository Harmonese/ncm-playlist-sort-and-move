import { q } from './utils/dom.js';
import { getPlaylistIdFromLocation } from './utils/playlist-url.js';
import { showFunctionMenu } from './ui/menu.js';

'use strict';

function injectButton() {
  const op = q('#content-operation');
  if (!op) return false;
  if (op.querySelector('.ncm-sort-title-btn')) return true;

  const a = document.createElement('a');
  a.className = 'u-btn2 u-btn2-1 ncm-sort-title-btn';
  a.style.marginLeft = '8px';
  a.innerHTML = '<i>歌单排序工具</i>';
  a.href = 'javascript:void(0)';

  a.addEventListener('click', async () => {
    const pid = getPlaylistIdFromLocation();
    if (!pid) {
      Swal.fire({
        icon: 'warning',
        title: '未识别到歌单',
        text: '无法获取歌单 ID'
      });
      return;
    }
    await showFunctionMenu(pid);
  });

  op.appendChild(a);
  return true;
}

GM_addStyle(`.ncm-sort-title-btn i{font-style:normal}`);

// SPA: retry inject
setInterval(() => {
  const href = location.href;
  if (href.includes('playlist?id=') || href.includes('/playlist?') || href.includes('#/playlist?')) {
    injectButton();
  }
}, 800);
