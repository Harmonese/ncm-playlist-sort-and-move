// ==UserScript==
// @name         NCM Playlist Sort & Move (Enhanced)
// @namespace    https://github.com/Harmonese/ncm-playlist-sort-and-move
// @version      0.4.0
// @description  Sort playlist by title/date, batch move/delete songs with weapi+forge
// @author       Harmonese
// @homepageURL  https://github.com/Harmonese/ncm-playlist-sort-and-move
// @supportURL   https://github.com/Harmonese/ncm-playlist-sort-and-move/issues
// @updateURL    https://raw.githubusercontent.com/Harmonese/ncm-playlist-sort-and-move/main/ncm-playlist-sort-and-move.user.js
// @downloadURL  https://raw.githubusercontent.com/Harmonese/ncm-playlist-sort-and-move/main/ncm-playlist-sort-and-move.user.js
// @match        https://music.163.com/*
// @require      https://fastly.jsdelivr.net/npm/node-forge@1.3.1/dist/forge.min.js
// @require      https://fastly.jsdelivr.net/npm/sweetalert2@11.26.3/dist/sweetalert2.all.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      music.163.com
// ==/UserScript==

(function () {
  'use strict';

  // ---------- small helpers ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const q = (sel, root = document) => root.querySelector(sel);

  function showToast(text) {
    try {
      if (window.top && window.top.g_showTipCard) {
        window.top.g_showTipCard({ tip: text, type: 1 });
        return;
      }
    } catch (e) {}
    console.log('[NCM-SORT]', text);
  }

  function getPlaylistIdFromLocation() {
    const u = new URL(location.href);
    const id = u.searchParams.get('id');
    if (id) return Number(id);
    const hash = location.hash || '';
    const m = hash.match(/[?&]id=(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  function getCsrfToken() {
    const m1 = document.cookie.match(/(?:^|;\s*)_csrf=([^;]+)/);
    if (m1) return m1[1];
    const m2 = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
    return m2 ? m2[1] : '';
  }

  // ---------- weapi encryption ----------
  const iv = '0102030405060708';
  const presetKey = '0CoJUm6Qyw8W8jud';
  const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`;

  function aesEncrypt(text, key, ivStr) {
    const cipher = forge.cipher.createCipher('AES-CBC', key);
    cipher.start({ iv: ivStr });
    cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(text)));
    cipher.finish();
    return forge.util.encode64(cipher.output.getBytes());
  }

  function rsaEncrypt(str, pemPublicKey) {
    const k = forge.pki.publicKeyFromPem(pemPublicKey);
    const encrypted = k.encrypt(str, 'NONE');
    return forge.util.bytesToHex(encrypted);
  }

  function weapi(obj) {
    const text = JSON.stringify(obj);
    let secretKey = '';
    for (let i = 0; i < 16; i++) secretKey += base62.charAt(Math.floor(Math.random() * 62));
    return {
      params: aesEncrypt(aesEncrypt(text, presetKey, iv), secretKey, iv),
      encSecKey: rsaEncrypt(secretKey.split('').reverse().join(''), publicKey)
    };
  }

  function weapiPost(apiPath, dataObj) {
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

  // ---------- NCM API ----------
  const fetchPlaylistDetail = (pid) => weapiPost('/api/v6/playlist/detail', { id: pid, n: 100000, s: 8 });
  const fetchSongDetailByIds = (idObjs) => weapiPost('/api/v3/song/detail', { c: JSON.stringify(idObjs) });
  const updatePlaylistOrder = (pid, ids) =>
    weapiPost('/api/playlist/manipulate/tracks', { pid, trackIds: JSON.stringify(ids), op: 'update' });
  const deleteSongsFromPlaylist = (pid, ids) =>
    weapiPost('/api/playlist/manipulate/tracks', { pid, trackIds: JSON.stringify(ids), op: 'del' });
  const fetchAlbumDetail = (albumId) => weapiPost(`/api/v1/album/${albumId}`, {});

  // ---------- data ----------
  function getArtistText(song) {
    if (song.ar && song.ar.length) return song.ar.map(a => a.name).join('/');
    if (song.artists && song.artists.length) return song.artists.map(a => a.name).join('/');
    return '';
  }
  function getAlbumText(song) {
    if (song.al && song.al.name) return song.al.name;
    if (song.album && song.album.name) return song.album.name;
    return '';
  }

  // ---------- sorting ----------
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
    usage: 'sort'
  });

  function getFirstEffectiveChar(title) {
    if (!title) return '';
    let t = normalizeTitleForSort(title);
    t = t.trim();
    if (!t) return '';
    return t[0];
  }

  function isLetterLike(ch) {
    if (!ch) return false;
    return /[A-Za-z\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(ch);
  }

  function isDigit(ch) {
    if (!ch) return false;
    return /[0-9]/.test(ch);
  }

  function isSymbolOnlyTitle(title) {
    if (!title) return true;
    const t = title.trim();
    if (!t) return true;
    const hasNormalChar = /[0-9A-Za-z\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(t);
    if (!hasNormalChar) return true;
    const strongPrefixMatch = t.match(/^[!@#$%^&*~\-_=+]+/);
    if (strongPrefixMatch && strongPrefixMatch[0].length >= 3) {
      return true;
    }
    return false;
  }

  function normalizeTitleForSort(title) {
    if (!title) return '';
    let t = title;
    t = t.replace(/^\s+/, '');
    let prev;
    do {
      prev = t;
      t = t
        .replace(/^(\s*[【\[\(（].{0,20}?[】\]\)）])\s*/u, '')
        .replace(/^(\s*[-~—─·•]+)\s*/, '');
    } while (t !== prev);
    return t || title;
  }

  function getTitleGroup(title) {
    const first = getFirstEffectiveChar(title);
    if (isLetterLike(first)) return 0;
    if (isDigit(first)) return 1;
    return 2;
  }

  function cmpByTitle(a, b) {
    const titleA = a.title || '';
    const titleB = b.title || '';
    const aSymbolOnly = isSymbolOnlyTitle(titleA);
    const bSymbolOnly = isSymbolOnlyTitle(titleB);

    if (aSymbolOnly !== bSymbolOnly) {
      return aSymbolOnly ? 1 : -1;
    }

    const groupA = aSymbolOnly ? 2 : getTitleGroup(titleA);
    const groupB = bSymbolOnly ? 2 : getTitleGroup(titleB);

    if (groupA !== groupB) {
      return groupA - groupB;
    }

    const sortTitleA = normalizeTitleForSort(titleA);
    const sortTitleB = normalizeTitleForSort(titleB);

    let r = collator.compare(sortTitleA, sortTitleB);
    if (r) return r;

    r = collator.compare(titleA, titleB);
    if (r) return r;

    r = collator.compare(a.artist || '', b.artist || '');
    if (r) return r;
    r = collator.compare(a.album || '', b.album || '');
    if (r) return r;

    return a.id - b.id;
  }

  function cmpByDate(descending) {
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

  async function getAllSongs(pid) {
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
        for (const s of (part.songs || [])) {
          items.push({
            id: s.id,
            title: s.name || '',
            artist: getArtistText(s),
            album: getAlbumText(s),
            albumId: s.al?.id || 0,
            publishTime: s.publishTime || 0
          });
        }
        await sleep(120);
      }
    } else {
      for (const s of (pl.tracks || [])) {
        items.push({
          id: s.id,
          title: s.name || '',
          artist: getArtistText(s),
          album: getAlbumText(s),
          albumId: s.al?.id || 0,
          publishTime: s.publishTime || 0
        });
      }
    }
    return { playlist: pl, items };
  }

  // ---------- 按标题排序 ----------
  async function sortByTitle(pid) {
    showToast('开始获取歌单歌曲...');
    const { playlist, items } = await getAllSongs(pid);

    showToast(`获取完成：${items.length} 首，开始排序...`);
    const ordered = items.slice().sort(cmpByTitle).map(x => x.id);

    showToast('写回歌单顺序(op=update)...');
    const res = await updatePlaylistOrder(pid, ordered);
    if (res && res.code === 200) {
      Swal.fire({
        icon: 'success',
        title: '排序完成',
        text: `${playlist.name}\n共 ${ordered.length} 首\n刷新页面查看新顺序`
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: '排序失败',
        text: JSON.stringify(res)
      });
    }
  }

  // ---------- 按发行日期排序 ----------
  async function sortByPublishDate(pid) {
    const result = await Swal.fire({
      title: '按发行日期排序',
      html: `
        <div style="text-align: left; margin-bottom: 15px;">
          <p>选择排序方式：</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="sort-desc" class="swal2-styled" style="width: 100%;">从新到旧（倒序）</button>
          <button id="sort-asc" class="swal2-styled" style="width: 100%;">从旧到新（顺序）</button>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: '取消',
      didOpen: () => {
        document.getElementById('sort-desc').addEventListener('click', () => {
          Swal.close();
          performDateSort(pid, true);
        });
        document.getElementById('sort-asc').addEventListener('click', () => {
          Swal.close();
          performDateSort(pid, false);
        });
      }
    });
  }

  async function performDateSort(pid, descending) {
    try {
      showToast('开始获取歌单歌曲...');
      const { playlist, items } = await getAllSongs(pid);

      // 获取专辑发行时间（对于没有publishTime的歌曲）
      const albumCache = {};
      const needAlbumFetch = items.filter(item => !item.publishTime && item.albumId > 0);

      if (needAlbumFetch.length > 0) {
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

      showToast(`获取完成：${items.length} 首，开始排序...`);
      const ordered = items.slice().sort(cmpByDate(descending)).map(x => x.id);

      showToast('写回歌单顺序(op=update)...');
      const res = await updatePlaylistOrder(pid, ordered);

      if (res && res.code === 200) {
        Swal.fire({
          icon: 'success',
          title: '排序完成',
          text: `${playlist.name}\n共 ${ordered.length} 首\n按发行日期${descending ? '倒序' : '顺序'}排列\n刷新页面查看新顺序`
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: '排序失败',
          text: JSON.stringify(res)
        });
      }
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: 'error',
        title: '出错',
        text: e?.message || String(e)
      });
    }
  }

  // ---------- 批量移动歌曲 ----------
  async function batchMoveSongs(pid) {
    const result = await Swal.fire({
      title: '批量移动歌曲',
      html: `
        <div style="text-align: left; margin-bottom: 15px;">
          <p>输入三个数字来移动歌曲：</p>
          <p style="color: #666; font-size: 13px;">
            例如：2, 6, 10<br>
            表示将序号 2-6 的歌曲移到序号 10 的歌曲后面
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div style="flex: 1;">
            <label>起始位置：</label>
            <input id="start-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="起始">
          </div>
          <div style="flex: 1;">
            <label>结束位置：</label>
            <input id="end-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="结束">
          </div>
          <div style="flex: 1;">
            <label>目标位置：</label>
            <input id="target-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="目标">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '开始移动',
      cancelButtonText: '取消',
      focusConfirm: false,
      preConfirm: () => {
        const start = parseInt(document.getElementById('start-pos').value);
        const end = parseInt(document.getElementById('end-pos').value);
        const target = parseInt(document.getElementById('target-pos').value);

        if (isNaN(start) || isNaN(end) || isNaN(target)) {
          Swal.showValidationMessage('请输入有效的数字');
          return false;
        }

        if (start < 1 || end < 1 || target < 1) {
          Swal.showValidationMessage('位置必须大于等于 1');
          return false;
        }

        if (start > end) {
          Swal.showValidationMessage('起始位置不能大于结束位置');
          return false;
        }

        return { start, end, target };
      }
    });

    if (!result.isConfirmed) return;

    const { start, end, target } = result.value;

    showToast('开始获取歌单歌曲...');
    const { playlist, items } = await getAllSongs(pid);
    const totalCount = items.length;

    if (start > totalCount || end > totalCount || target > totalCount) {
      Swal.fire({
        icon: 'error',
        title: '位置超出范围',
        text: `歌单共有 ${totalCount} 首歌曲，输入的位置不能超过此范围`
      });
      return;
    }

    if (target >= start && target <= end) {
      Swal.fire({
        icon: 'error',
        title: '目标位置无效',
        text: `目标位置（${target}）不能在起始位置（${start}）和结束位置（${end}）之间`
      });
      return;
    }

    const startIdx = start - 1;
    const endIdx = end - 1;
    const targetIdx = target - 1;

    const newOrder = [...items];
    const movedSongs = newOrder.splice(startIdx, endIdx - startIdx + 1);

    let insertIdx = targetIdx;
    if (targetIdx > endIdx) {
      insertIdx = targetIdx - movedSongs.length;
    }

    newOrder.splice(insertIdx + 1, 0, ...movedSongs);
    const orderedIds = newOrder.map(x => x.id);

    showToast('写回歌单顺序...');
    const res = await updatePlaylistOrder(pid, orderedIds);

    if (res && res.code === 200) {
      Swal.fire({
        icon: 'success',
        title: '移动完成',
        html: `已将位置 ${start}-${end} 的歌曲移到位置 ${target} 后面<br>刷新页面查看新顺序`
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: '移动失败',
        text: JSON.stringify(res)
      });
    }
  }

  // ---------- 批量删除歌曲 ----------
  async function batchDeleteSongs(pid) {
    const result = await Swal.fire({
      title: '批量删除歌曲',
      html: `
        <div style="text-align: left; margin-bottom: 15px;">
          <p>输入两个数字来删除歌曲：</p>
          <p style="color: #666; font-size: 13px;">
            例如：2, 6<br>
            表示删除序号 2-6（包含）的所有歌曲
          </p>
          <p style="color: #e74c3c; font-size: 13px;">
            ⚠️ 此操作不可撤销，请谨慎操作！
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div style="flex: 1;">
            <label>起始位置：</label>
            <input id="del-start-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="起始">
          </div>
          <div style="flex: 1;">
            <label>结束位置：</label>
            <input id="del-end-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="结束">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonColor: '#e74c3c',
      focusConfirm: false,
      preConfirm: () => {
        const start = parseInt(document.getElementById('del-start-pos').value);
        const end = parseInt(document.getElementById('del-end-pos').value);

        if (isNaN(start) || isNaN(end)) {
          Swal.showValidationMessage('请输入有效的数字');
          return false;
        }

        if (start < 1 || end < 1) {
          Swal.showValidationMessage('位置必须大于等于 1');
          return false;
        }

        if (start > end) {
          Swal.showValidationMessage('起始位置不能大于结束位置');
          return false;
        }

        return { start, end };
      }
    });

    if (!result.isConfirmed) return;

    const { start, end } = result.value;

    showToast('开始获取歌单歌曲...');
    const { playlist, items } = await getAllSongs(pid);
    const totalCount = items.length;

    if (start > totalCount || end > totalCount) {
      Swal.fire({
        icon: 'error',
        title: '位置超出范围',
        text: `歌单共有 ${totalCount} 首歌曲，输入的位置不能超过此范围`
      });
      return;
    }

    const startIdx = start - 1;
    const endIdx = end - 1;
    const toDeleteCount = endIdx - startIdx + 1;
    const toDeleteIds = items.slice(startIdx, endIdx + 1).map(x => x.id);

    // 二次确认
    const confirm2 = await Swal.fire({
      title: '确认删除',
      html: `即将删除 <strong>${toDeleteCount}</strong> 首歌曲（位置 ${start}-${end}）<br><br>此操作不可撤销，确定继续？`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonColor: '#e74c3c'
    });

    if (!confirm2.isConfirmed) return;

    showToast('正在删除歌曲...');
    const res = await deleteSongsFromPlaylist(pid, toDeleteIds);

    if (res && res.code === 200) {
      Swal.fire({
        icon: 'success',
        title: '删除完成',
        html: `已删除 ${toDeleteCount} 首歌曲<br>刷新页面查看结果`
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: '删除失败',
        text: JSON.stringify(res)
      });
    }
  }

  // ---------- 显示功能选择弹窗 ----------
  async function showFunctionMenu(pid) {
    const result = await Swal.fire({
      title: '歌单排序工具',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="sort-by-title" class="swal2-styled" style="width: 100%;">按标题排序</button>
          <button id="sort-by-date" class="swal2-styled" style="width: 100%;">按发行日期排序</button>
          <button id="batch-move" class="swal2-styled" style="width: 100%;">批量移动歌曲</button>
          <button id="batch-delete" class="swal2-styled" style="width: 100%; background-color: #e74c3c;">批量删除歌曲</button>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        document.getElementById('sort-by-title').addEventListener('click', async () => {
          Swal.close();
          if (confirm('将直接修改当前歌单内歌曲顺序（不可一键撤销）。继续？')) {
            try {
              await sortByTitle(pid);
            } catch (e) {
              console.error(e);
              Swal.fire({
                icon: 'error',
                title: '出错',
                text: e?.message || String(e)
              });
            }
          }
        });

        document.getElementById('sort-by-date').addEventListener('click', async () => {
          Swal.close();
          try {
            await sortByPublishDate(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: 'error',
              title: '出错',
              text: e?.message || String(e)
            });
          }
        });

        document.getElementById('batch-move').addEventListener('click', async () => {
          Swal.close();
          try {
            await batchMoveSongs(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: 'error',
              title: '出错',
              text: e?.message || String(e)
            });
          }
        });

        document.getElementById('batch-delete').addEventListener('click', async () => {
          Swal.close();
          try {
            await batchDeleteSongs(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: 'error',
              title: '出错',
              text: e?.message || String(e)
            });
          }
        });
      }
    });
  }

  // ---------- UI ----------
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

})();
