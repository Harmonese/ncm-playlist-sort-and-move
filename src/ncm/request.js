import { weapi } from './weapi.js';

function getCsrfToken() {
  const m1 = document.cookie.match(/(?:^|;\s*)_csrf=([^;]+)/);
  if (m1) return m1[1];
  const m2 = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
  return m2 ? m2[1] : '';
}

export function weapiPost(apiPath, dataObj) {
  return new Promise((resolve, reject) => {
    const csrf = getCsrfToken();
    const payload = Object.assign({}, dataObj, { csrf_token: csrf });
    const enc = weapi(payload);

    GM_xmlhttpRequest({
      method: 'POST',
      url: `https://music.163.com${apiPath.replace(/^\/api\//, '/weapi/')}?csrf_token=${encodeURIComponent(csrf)}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: `params=${encodeURIComponent(enc.params)}&encSecKey=${encodeURIComponent(enc.encSecKey)}`,
      responseType: 'json',
      onload: (res) => resolve(res.response),
      onerror: reject
    });
  });
}
