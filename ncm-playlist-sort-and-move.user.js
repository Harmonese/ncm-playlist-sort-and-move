// ==UserScript==
// @name         网易云音乐歌单排序
// @namespace    https://github.com/Harmonese/ncm-playlist-sort-and-move
// @version      0.5.0
// @description  网易云音乐网页版歌单管理工具，支持按标题或发行日期排序、批量移动和批量删除歌曲
// @author       Harmonese
// @license      MIT
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

(() => {
  // src/utils/dom.js
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  var q = (sel, root = document) => root.querySelector(sel);
  function showToast(text) {
    try {
      if (window.top && window.top.g_showTipCard) {
        window.top.g_showTipCard({ tip: text, type: 1 });
        return;
      }
    } catch (e) {
    }
    console.log("[NCM-SORT]", text);
  }

  // src/utils/playlist-url.js
  function getPlaylistIdFromLocation() {
    const u = new URL(location.href);
    const id = u.searchParams.get("id");
    if (id) return Number(id);
    const hash = location.hash || "";
    const m = hash.match(/[?&]id=(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  // src/ncm/weapi.js
  var iv = "0102030405060708";
  var presetKey = "0CoJUm6Qyw8W8jud";
  var base62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`;
  function aesEncrypt(text, key, ivStr) {
    const cipher = forge.cipher.createCipher("AES-CBC", key);
    cipher.start({ iv: ivStr });
    cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(text)));
    cipher.finish();
    return forge.util.encode64(cipher.output.getBytes());
  }
  function rsaEncrypt(str, pemPublicKey) {
    const k = forge.pki.publicKeyFromPem(pemPublicKey);
    const encrypted = k.encrypt(str, "NONE");
    return forge.util.bytesToHex(encrypted);
  }
  function weapi(obj) {
    const text = JSON.stringify(obj);
    let secretKey = "";
    for (let i = 0; i < 16; i++) secretKey += base62.charAt(Math.floor(Math.random() * 62));
    return {
      params: aesEncrypt(aesEncrypt(text, presetKey, iv), secretKey, iv),
      encSecKey: rsaEncrypt(secretKey.split("").reverse().join(""), publicKey)
    };
  }

  // src/ncm/request.js
  function getCsrfToken() {
    const m1 = document.cookie.match(/(?:^|;\s*)_csrf=([^;]+)/);
    if (m1) return m1[1];
    const m2 = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
    return m2 ? m2[1] : "";
  }
  function weapiPost(apiPath, dataObj) {
    return new Promise((resolve, reject) => {
      const csrf = getCsrfToken();
      const payload = Object.assign({}, dataObj, { csrf_token: csrf });
      const enc = weapi(payload);
      GM_xmlhttpRequest({
        method: "POST",
        url: `https://music.163.com${apiPath.replace(/^\/api\//, "/weapi/")}?csrf_token=${encodeURIComponent(csrf)}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        data: `params=${encodeURIComponent(enc.params)}&encSecKey=${encodeURIComponent(enc.encSecKey)}`,
        responseType: "json",
        onload: (res) => resolve(res.response),
        onerror: reject
      });
    });
  }

  // src/ncm/api.js
  var fetchPlaylistDetail = (pid) => weapiPost("/api/v6/playlist/detail", { id: pid, n: 1e5, s: 8 });
  var fetchSongDetailByIds = (idObjs) => weapiPost("/api/v3/song/detail", { c: JSON.stringify(idObjs) });
  var updatePlaylistOrder = (pid, ids) => weapiPost("/api/playlist/manipulate/tracks", {
    pid,
    trackIds: JSON.stringify(ids),
    op: "update"
  });
  var deleteSongsFromPlaylist = (pid, ids) => weapiPost("/api/playlist/manipulate/tracks", {
    pid,
    trackIds: JSON.stringify(ids),
    op: "del"
  });
  var fetchAlbumDetail = (albumId) => weapiPost(`/api/v1/album/${albumId}`, {});

  // src/data/song.js
  function getArtistText(song) {
    if (song.ar && song.ar.length) return song.ar.map((a) => a.name).join("/");
    if (song.artists && song.artists.length) return song.artists.map((a) => a.name).join("/");
    return "";
  }
  function getAlbumText(song) {
    if (song.al && song.al.name) return song.al.name;
    if (song.album && song.album.name) return song.album.name;
    return "";
  }
  function toSongItem(song) {
    return {
      id: song.id,
      title: song.name || "",
      artist: getArtistText(song),
      album: getAlbumText(song),
      albumId: song.al?.id || 0,
      publishTime: song.publishTime || 0
    };
  }

  // src/data/playlist.js
  async function getAllSongs(pid) {
    const detail = await fetchPlaylistDetail(pid);
    if (!detail || detail.code !== 200) throw new Error("playlist/detail failed: " + JSON.stringify(detail));
    const pl = detail.playlist;
    const items = [];
    if (pl.trackCount > (pl.tracks?.length || 0)) {
      const trackIds = (pl.trackIds || []).map((t) => ({ id: t.id }));
      const chunkSize = 1e3;
      for (let i = 0; i < trackIds.length; i += chunkSize) {
        showToast(`\u62C9\u53D6\u6B4C\u66F2\u8BE6\u60C5 ${i + 1}-${Math.min(i + chunkSize, trackIds.length)}/${trackIds.length}`);
        const part = await fetchSongDetailByIds(trackIds.slice(i, i + chunkSize));
        if (!part || part.code !== 200) throw new Error("song/detail failed at " + i);
        for (const song of part.songs || []) {
          items.push(toSongItem(song));
        }
        await sleep(120);
      }
    } else {
      for (const song of pl.tracks || []) {
        items.push(toSongItem(song));
      }
    }
    return { playlist: pl, items };
  }

  // src/sort/title.js
  var collator = new Intl.Collator(void 0, {
    numeric: true,
    sensitivity: "base",
    usage: "sort"
  });
  function getFirstEffectiveChar(title) {
    if (!title) return "";
    let t = normalizeTitleForSort(title);
    t = t.trim();
    if (!t) return "";
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
    if (!title) return "";
    let t = title;
    t = t.replace(/^\s+/, "");
    let prev;
    do {
      prev = t;
      t = t.replace(/^(\s*[【\[\(（].{0,20}?[】\]\)）])\s*/u, "").replace(/^(\s*[-~—─·•]+)\s*/, "");
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
    const titleA = a.title || "";
    const titleB = b.title || "";
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
    r = collator.compare(a.artist || "", b.artist || "");
    if (r) return r;
    r = collator.compare(a.album || "", b.album || "");
    if (r) return r;
    return a.id - b.id;
  }

  // src/operations/sort-by-title.js
  async function sortByTitle(pid) {
    showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
    const { playlist, items } = await getAllSongs(pid);
    showToast(`\u83B7\u53D6\u5B8C\u6210\uFF1A${items.length} \u9996\uFF0C\u5F00\u59CB\u6392\u5E8F...`);
    const ordered = items.slice().sort(cmpByTitle).map((x) => x.id);
    showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F(op=update)...");
    const res = await updatePlaylistOrder(pid, ordered);
    if (res && res.code === 200) {
      Swal.fire({
        icon: "success",
        title: "\u6392\u5E8F\u5B8C\u6210",
        text: `${playlist.name}
\u5171 ${ordered.length} \u9996
\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "\u6392\u5E8F\u5931\u8D25",
        text: JSON.stringify(res)
      });
    }
  }

  // src/sort/date.js
  function cmpByDate(descending) {
    return (a, b) => {
      const timeA = a.publishTime || 0;
      const timeB = b.publishTime || 0;
      if (timeA !== timeB) {
        return descending ? timeB - timeA : timeA - timeB;
      }
      return cmpByTitle(a, b);
    };
  }

  // src/ui/dialogs.js
  async function showDateSortDialog(pid, performDateSort2) {
    const result = await Swal.fire({
      title: "\u6309\u53D1\u884C\u65E5\u671F\u6392\u5E8F",
      html: `
      <div style="text-align: left; margin-bottom: 15px;">
        <p>\u9009\u62E9\u6392\u5E8F\u65B9\u5F0F\uFF1A</p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="sort-desc" class="swal2-styled" style="width: 100%;">\u4ECE\u65B0\u5230\u65E7\uFF08\u5012\u5E8F\uFF09</button>
        <button id="sort-asc" class="swal2-styled" style="width: 100%;">\u4ECE\u65E7\u5230\u65B0\uFF08\u987A\u5E8F\uFF09</button>
      </div>
    `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "\u53D6\u6D88",
      didOpen: () => {
        document.getElementById("sort-desc").addEventListener("click", () => {
          Swal.close();
          performDateSort2(pid, true);
        });
        document.getElementById("sort-asc").addEventListener("click", () => {
          Swal.close();
          performDateSort2(pid, false);
        });
      }
    });
  }
  function showBatchMoveDialog() {
    return Swal.fire({
      title: "\u6279\u91CF\u79FB\u52A8\u6B4C\u66F2",
      html: `
      <div style="text-align: left; margin-bottom: 15px;">
        <p>\u8F93\u5165\u4E09\u4E2A\u6570\u5B57\u6765\u79FB\u52A8\u6B4C\u66F2\uFF1A</p>
        <p style="color: #666; font-size: 13px;">
          \u4F8B\u5982\uFF1A2, 6, 10<br>
          \u8868\u793A\u5C06\u5E8F\u53F7 2-6 \u7684\u6B4C\u66F2\u79FB\u5230\u5E8F\u53F7 10 \u7684\u6B4C\u66F2\u540E\u9762
        </p>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <div style="flex: 1;">
          <label>\u8D77\u59CB\u4F4D\u7F6E\uFF1A</label>
          <input id="start-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="\u8D77\u59CB">
        </div>
        <div style="flex: 1;">
          <label>\u7ED3\u675F\u4F4D\u7F6E\uFF1A</label>
          <input id="end-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="\u7ED3\u675F">
        </div>
        <div style="flex: 1;">
          <label>\u76EE\u6807\u4F4D\u7F6E\uFF1A</label>
          <input id="target-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="\u76EE\u6807">
        </div>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: "\u5F00\u59CB\u79FB\u52A8",
      cancelButtonText: "\u53D6\u6D88",
      focusConfirm: false,
      preConfirm: () => {
        const start = parseInt(document.getElementById("start-pos").value);
        const end = parseInt(document.getElementById("end-pos").value);
        const target = parseInt(document.getElementById("target-pos").value);
        if (isNaN(start) || isNaN(end) || isNaN(target)) {
          Swal.showValidationMessage("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u6570\u5B57");
          return false;
        }
        if (start < 1 || end < 1 || target < 1) {
          Swal.showValidationMessage("\u4F4D\u7F6E\u5FC5\u987B\u5927\u4E8E\u7B49\u4E8E 1");
          return false;
        }
        if (start > end) {
          Swal.showValidationMessage("\u8D77\u59CB\u4F4D\u7F6E\u4E0D\u80FD\u5927\u4E8E\u7ED3\u675F\u4F4D\u7F6E");
          return false;
        }
        return { start, end, target };
      }
    });
  }
  function showBatchDeleteDialog() {
    return Swal.fire({
      title: "\u6279\u91CF\u5220\u9664\u6B4C\u66F2",
      html: `
      <div style="text-align: left; margin-bottom: 15px;">
        <p>\u8F93\u5165\u4E24\u4E2A\u6570\u5B57\u6765\u5220\u9664\u6B4C\u66F2\uFF1A</p>
        <p style="color: #666; font-size: 13px;">
          \u4F8B\u5982\uFF1A2, 6<br>
          \u8868\u793A\u5220\u9664\u5E8F\u53F7 2-6\uFF08\u5305\u542B\uFF09\u7684\u6240\u6709\u6B4C\u66F2
        </p>
        <p style="color: #e74c3c; font-size: 13px;">
          \u26A0\uFE0F \u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF0C\u8BF7\u8C28\u614E\u64CD\u4F5C\uFF01
        </p>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <div style="flex: 1;">
          <label>\u8D77\u59CB\u4F4D\u7F6E\uFF1A</label>
          <input id="del-start-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="\u8D77\u59CB">
        </div>
        <div style="flex: 1;">
          <label>\u7ED3\u675F\u4F4D\u7F6E\uFF1A</label>
          <input id="del-end-pos" type="number" min="1" class="swal2-input" style="margin: 0;" placeholder="\u7ED3\u675F">
        </div>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: "\u786E\u8BA4\u5220\u9664",
      cancelButtonText: "\u53D6\u6D88",
      confirmButtonColor: "#e74c3c",
      focusConfirm: false,
      preConfirm: () => {
        const start = parseInt(document.getElementById("del-start-pos").value);
        const end = parseInt(document.getElementById("del-end-pos").value);
        if (isNaN(start) || isNaN(end)) {
          Swal.showValidationMessage("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u6570\u5B57");
          return false;
        }
        if (start < 1 || end < 1) {
          Swal.showValidationMessage("\u4F4D\u7F6E\u5FC5\u987B\u5927\u4E8E\u7B49\u4E8E 1");
          return false;
        }
        if (start > end) {
          Swal.showValidationMessage("\u8D77\u59CB\u4F4D\u7F6E\u4E0D\u80FD\u5927\u4E8E\u7ED3\u675F\u4F4D\u7F6E");
          return false;
        }
        return { start, end };
      }
    });
  }
  function showDeleteConfirmation(toDeleteCount, start, end) {
    return Swal.fire({
      title: "\u786E\u8BA4\u5220\u9664",
      html: `\u5373\u5C06\u5220\u9664 <strong>${toDeleteCount}</strong> \u9996\u6B4C\u66F2\uFF08\u4F4D\u7F6E ${start}-${end}\uFF09<br><br>\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF0C\u786E\u5B9A\u7EE7\u7EED\uFF1F`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "\u786E\u8BA4\u5220\u9664",
      cancelButtonText: "\u53D6\u6D88",
      confirmButtonColor: "#e74c3c"
    });
  }

  // src/operations/sort-by-date.js
  async function sortByPublishDate(pid) {
    const result = await showDateSortDialog(pid, performDateSort);
  }
  async function performDateSort(pid, descending) {
    try {
      showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
      const { playlist, items } = await getAllSongs(pid);
      const albumCache = {};
      const needAlbumFetch = items.filter((item) => !item.publishTime && item.albumId > 0);
      if (needAlbumFetch.length > 0) {
        showToast(`\u83B7\u53D6 ${needAlbumFetch.length} \u9996\u6B4C\u66F2\u7684\u4E13\u8F91\u4FE1\u606F...`);
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
              console.error(`\u83B7\u53D6\u4E13\u8F91 ${item.albumId} \u5931\u8D25:`, e);
            }
          }
          item.publishTime = albumCache[item.albumId] || 0;
          if ((i + 1) % 10 === 0) {
            showToast(`\u83B7\u53D6\u4E13\u8F91\u4FE1\u606F\u8FDB\u5EA6: ${i + 1}/${needAlbumFetch.length}`);
          }
        }
      }
      showToast(`\u83B7\u53D6\u5B8C\u6210\uFF1A${items.length} \u9996\uFF0C\u5F00\u59CB\u6392\u5E8F...`);
      const ordered = items.slice().sort(cmpByDate(descending)).map((x) => x.id);
      showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F(op=update)...");
      const res = await updatePlaylistOrder(pid, ordered);
      if (res && res.code === 200) {
        Swal.fire({
          icon: "success",
          title: "\u6392\u5E8F\u5B8C\u6210",
          text: `${playlist.name}
\u5171 ${ordered.length} \u9996
\u6309\u53D1\u884C\u65E5\u671F${descending ? "\u5012\u5E8F" : "\u987A\u5E8F"}\u6392\u5217
\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "\u6392\u5E8F\u5931\u8D25",
          text: JSON.stringify(res)
        });
      }
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "\u51FA\u9519",
        text: e?.message || String(e)
      });
    }
  }

  // src/operations/batch-move.js
  async function batchMoveSongs(pid) {
    const result = await showBatchMoveDialog();
    if (!result.isConfirmed) return;
    const { start, end, target } = result.value;
    showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
    const { playlist, items } = await getAllSongs(pid);
    const totalCount = items.length;
    if (start > totalCount || end > totalCount || target > totalCount) {
      Swal.fire({
        icon: "error",
        title: "\u4F4D\u7F6E\u8D85\u51FA\u8303\u56F4",
        text: `\u6B4C\u5355\u5171\u6709 ${totalCount} \u9996\u6B4C\u66F2\uFF0C\u8F93\u5165\u7684\u4F4D\u7F6E\u4E0D\u80FD\u8D85\u8FC7\u6B64\u8303\u56F4`
      });
      return;
    }
    if (target >= start && target <= end) {
      Swal.fire({
        icon: "error",
        title: "\u76EE\u6807\u4F4D\u7F6E\u65E0\u6548",
        text: `\u76EE\u6807\u4F4D\u7F6E\uFF08${target}\uFF09\u4E0D\u80FD\u5728\u8D77\u59CB\u4F4D\u7F6E\uFF08${start}\uFF09\u548C\u7ED3\u675F\u4F4D\u7F6E\uFF08${end}\uFF09\u4E4B\u95F4`
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
    const orderedIds = newOrder.map((x) => x.id);
    showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F...");
    const res = await updatePlaylistOrder(pid, orderedIds);
    if (res && res.code === 200) {
      Swal.fire({
        icon: "success",
        title: "\u79FB\u52A8\u5B8C\u6210",
        html: `\u5DF2\u5C06\u4F4D\u7F6E ${start}-${end} \u7684\u6B4C\u66F2\u79FB\u5230\u4F4D\u7F6E ${target} \u540E\u9762<br>\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "\u79FB\u52A8\u5931\u8D25",
        text: JSON.stringify(res)
      });
    }
  }

  // src/operations/batch-delete.js
  async function batchDeleteSongs(pid) {
    const result = await showBatchDeleteDialog();
    if (!result.isConfirmed) return;
    const { start, end } = result.value;
    showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
    const { playlist, items } = await getAllSongs(pid);
    const totalCount = items.length;
    if (start > totalCount || end > totalCount) {
      Swal.fire({
        icon: "error",
        title: "\u4F4D\u7F6E\u8D85\u51FA\u8303\u56F4",
        text: `\u6B4C\u5355\u5171\u6709 ${totalCount} \u9996\u6B4C\u66F2\uFF0C\u8F93\u5165\u7684\u4F4D\u7F6E\u4E0D\u80FD\u8D85\u8FC7\u6B64\u8303\u56F4`
      });
      return;
    }
    const startIdx = start - 1;
    const endIdx = end - 1;
    const toDeleteCount = endIdx - startIdx + 1;
    const toDeleteIds = items.slice(startIdx, endIdx + 1).map((x) => x.id);
    const confirm2 = await showDeleteConfirmation(toDeleteCount, start, end);
    if (!confirm2.isConfirmed) return;
    showToast("\u6B63\u5728\u5220\u9664\u6B4C\u66F2...");
    const res = await deleteSongsFromPlaylist(pid, toDeleteIds);
    if (res && res.code === 200) {
      Swal.fire({
        icon: "success",
        title: "\u5220\u9664\u5B8C\u6210",
        html: `\u5DF2\u5220\u9664 ${toDeleteCount} \u9996\u6B4C\u66F2<br>\u5237\u65B0\u9875\u9762\u67E5\u770B\u7ED3\u679C`
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "\u5220\u9664\u5931\u8D25",
        text: JSON.stringify(res)
      });
    }
  }

  // src/ui/menu.js
  async function showFunctionMenu(pid) {
    const result = await Swal.fire({
      title: "\u6B4C\u5355\u6392\u5E8F\u5DE5\u5177",
      html: `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="sort-by-title" class="swal2-styled" style="width: 100%;">\u6309\u6807\u9898\u6392\u5E8F</button>
        <button id="sort-by-date" class="swal2-styled" style="width: 100%;">\u6309\u53D1\u884C\u65E5\u671F\u6392\u5E8F</button>
        <button id="batch-move" class="swal2-styled" style="width: 100%;">\u6279\u91CF\u79FB\u52A8\u6B4C\u66F2</button>
        <button id="batch-delete" class="swal2-styled" style="width: 100%; background-color: #e74c3c;">\u6279\u91CF\u5220\u9664\u6B4C\u66F2</button>
      </div>
    `,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        document.getElementById("sort-by-title").addEventListener("click", async () => {
          Swal.close();
          if (confirm("\u5C06\u76F4\u63A5\u4FEE\u6539\u5F53\u524D\u6B4C\u5355\u5185\u6B4C\u66F2\u987A\u5E8F\uFF08\u4E0D\u53EF\u4E00\u952E\u64A4\u9500\uFF09\u3002\u7EE7\u7EED\uFF1F")) {
            try {
              await sortByTitle(pid);
            } catch (e) {
              console.error(e);
              Swal.fire({
                icon: "error",
                title: "\u51FA\u9519",
                text: e?.message || String(e)
              });
            }
          }
        });
        document.getElementById("sort-by-date").addEventListener("click", async () => {
          Swal.close();
          try {
            await sortByPublishDate(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e)
            });
          }
        });
        document.getElementById("batch-move").addEventListener("click", async () => {
          Swal.close();
          try {
            await batchMoveSongs(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e)
            });
          }
        });
        document.getElementById("batch-delete").addEventListener("click", async () => {
          Swal.close();
          try {
            await batchDeleteSongs(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e)
            });
          }
        });
      }
    });
  }

  // src/main.js
  function injectButton() {
    const op = q("#content-operation");
    if (!op) return false;
    if (op.querySelector(".ncm-sort-title-btn")) return true;
    const a = document.createElement("a");
    a.className = "u-btn2 u-btn2-1 ncm-sort-title-btn";
    a.style.marginLeft = "8px";
    a.innerHTML = "<i>\u6B4C\u5355\u6392\u5E8F\u5DE5\u5177</i>";
    a.href = "javascript:void(0)";
    a.addEventListener("click", async () => {
      const pid = getPlaylistIdFromLocation();
      if (!pid) {
        Swal.fire({
          icon: "warning",
          title: "\u672A\u8BC6\u522B\u5230\u6B4C\u5355",
          text: "\u65E0\u6CD5\u83B7\u53D6\u6B4C\u5355 ID"
        });
        return;
      }
      await showFunctionMenu(pid);
    });
    op.appendChild(a);
    return true;
  }
  GM_addStyle(`.ncm-sort-title-btn i{font-style:normal}`);
  setInterval(() => {
    const href = location.href;
    if (href.includes("playlist?id=") || href.includes("/playlist?") || href.includes("#/playlist?")) {
      injectButton();
    }
  }, 800);
})();
