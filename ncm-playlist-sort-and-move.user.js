// ==UserScript==
// @name         网易云音乐歌单排序
// @namespace    https://github.com/Harmonese/ncm-playlist-sort-and-move
// @version      0.9.1
// @description  网易云音乐网页版歌单管理工具，支持歌单编排脚本、排序、随机排序、批量移动和批量删除歌曲
// @author       Harmonese
// @license      MIT
// @icon         https://raw.githubusercontent.com/Harmonese/ncm-playlist-sort-and-move/main/assets/icon.png
// @homepageURL  https://github.com/Harmonese/ncm-playlist-sort-and-move
// @supportURL   https://github.com/Harmonese/ncm-playlist-sort-and-move/issues
// @updateURL    https://raw.githubusercontent.com/Harmonese/ncm-playlist-sort-and-move/main/ncm-playlist-sort-and-move.user.js
// @downloadURL  https://raw.githubusercontent.com/Harmonese/ncm-playlist-sort-and-move/main/ncm-playlist-sort-and-move.user.js
// @match        https://music.163.com/*
// @require      https://cdn.jsdelivr.net/npm/pinyin-pro@3.29.3/dist/index.js
// @require      https://fastly.jsdelivr.net/npm/node-forge@1.3.1/dist/forge.min.js
// @require      https://fastly.jsdelivr.net/npm/sweetalert2@11.26.3/dist/sweetalert2.all.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
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
  var addSongsToPlaylist = (pid, ids) => weapiPost("/api/playlist/manipulate/tracks", {
    pid,
    trackIds: JSON.stringify(ids),
    op: "add"
  });
  var fetchAlbumDetail = (albumId) => weapiPost(`/api/v1/album/${albumId}`, {});
  var fetchSongRedCount = (songId) => weapiPost("/api/song/red/count", { songId });
  var fetchSongCommentCounts = (songIds) => weapiPost("/api/resource/commentInfo/list", {
    resourceType: "4",
    resourceIds: JSON.stringify(songIds)
  });

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
  function getPositiveNumber(value) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }
  function getNonNegativeNumber(value) {
    if (value === null || value === void 0 || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  function toSongItem(song, originalIndex = null) {
    return {
      id: song.id,
      originalIndex,
      title: song.name || "",
      artist: getArtistText(song),
      album: getAlbumText(song),
      albumId: song.al?.id || 0,
      albumDiscNo: getPositiveNumber(song.disc || song.cd),
      albumTrackNo: getPositiveNumber(song.no),
      publishTime: song.publishTime || 0,
      redCount: getNonNegativeNumber(song.redCount),
      popularity: getNonNegativeNumber(song.popularity ?? song.pop),
      commentCount: getNonNegativeNumber(song.commentCount)
    };
  }

  // src/sort/order.js
  function getOriginalIndex(item, fallbackIndex = 0) {
    return Number.isInteger(item?.originalIndex) && item.originalIndex >= 0 ? item.originalIndex : fallbackIndex;
  }
  function stableSort(items, compare, getIndex = getOriginalIndex) {
    return items.map((item, index) => ({
      item,
      index: getIndex(item, index),
      sourceIndex: index
    })).sort((a, b) => compare(a.item, b.item) || a.index - b.index || a.sourceIndex - b.sourceIndex).map(({ item }) => item);
  }
  function compareOriginalOrder(a, b) {
    if (!Number.isInteger(a?.originalIndex) || !Number.isInteger(b?.originalIndex)) {
      return 0;
    }
    return a.originalIndex - b.originalIndex;
  }

  // src/data/playlist.js
  function getPlaylistTrackIds(playlist) {
    if (Array.isArray(playlist?.trackIds) && playlist.trackIds.length) {
      return playlist.trackIds.map((track) => track.id);
    }
    return (playlist?.tracks || []).map((song) => song.id);
  }
  function assertCompleteSongItems(originalSongIds, items) {
    const expectedIds = originalSongIds.map((id) => String(id));
    const actualIds = items.map((item) => String(item.id));
    const expectedCounts = /* @__PURE__ */ new Map();
    const actualCounts = /* @__PURE__ */ new Map();
    for (const id of expectedIds) expectedCounts.set(id, (expectedCounts.get(id) || 0) + 1);
    for (const id of actualIds) actualCounts.set(id, (actualCounts.get(id) || 0) + 1);
    const complete = expectedIds.length === actualIds.length && expectedCounts.size === actualCounts.size && [...expectedCounts].every(([id, count]) => actualCounts.get(id) === count);
    if (complete) return;
    const missingIds = [...expectedCounts].filter(([id, count]) => (actualCounts.get(id) || 0) < count).map(([id]) => id);
    throw new Error(
      `\u6B4C\u5355\u6B4C\u66F2\u8BE6\u60C5\u4E0D\u5B8C\u6574\uFF1A\u5E94\u6709 ${expectedIds.length} \u9996\uFF0C\u5B9E\u9645\u83B7\u53D6 ${actualIds.length} \u9996${missingIds.length ? `\uFF1B\u7F3A\u5C11 ${missingIds.slice(0, 5).join("\u3001")}` : ""}`
    );
  }
  async function getAllSongs(pid) {
    const detail = await fetchPlaylistDetail(pid);
    if (!detail || detail.code !== 200) throw new Error("playlist/detail failed: " + JSON.stringify(detail));
    const pl = detail.playlist;
    const originalSongIds = getPlaylistTrackIds(pl);
    const trackCount = Number(pl.trackCount);
    if (Number.isFinite(trackCount) && trackCount > originalSongIds.length) {
      throw new Error(
        `\u6B4C\u5355\u6B4C\u66F2\u7D22\u5F15\u4E0D\u5B8C\u6574\uFF1A\u5E94\u6709 ${trackCount} \u9996\uFF0C\u5B9E\u9645\u83B7\u53D6 ${originalSongIds.length} \u9996`
      );
    }
    const originalIndexById = new Map(
      originalSongIds.map((id, index) => [String(id), index])
    );
    const items = [];
    if (pl.trackCount > (pl.tracks?.length || 0) && originalSongIds.length) {
      const trackIds = originalSongIds.map((id) => ({ id }));
      const chunkSize = 1e3;
      for (let i = 0; i < trackIds.length; i += chunkSize) {
        showToast(`\u62C9\u53D6\u6B4C\u66F2\u8BE6\u60C5 ${i + 1}-${Math.min(i + chunkSize, trackIds.length)}/${trackIds.length}`);
        const part = await fetchSongDetailByIds(trackIds.slice(i, i + chunkSize));
        if (!part || part.code !== 200) throw new Error("song/detail failed at " + i);
        for (const song of part.songs || []) {
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

  // src/sort/title.js
  var collator = new Intl.Collator(void 0, {
    numeric: false,
    sensitivity: "base",
    usage: "sort"
  });
  var strokeCollator = new Intl.Collator("zh-u-co-stroke", {
    numeric: false,
    sensitivity: "base",
    usage: "sort"
  });
  var pinyinCollator = new Intl.Collator("en", {
    numeric: false,
    sensitivity: "base",
    usage: "sort"
  });
  var TITLE_CATEGORIES = Object.freeze([
    { id: "latin", label: "\u62C9\u4E01\u5B57\u6BCD" },
    { id: "han", label: "\u6C49\u5B57" },
    { id: "kana", label: "\u65E5\u6587\u5047\u540D" },
    { id: "hangul", label: "\u97E9\u6587" },
    { id: "cyrillic", label: "\u897F\u91CC\u5C14\u5B57\u6BCD" },
    { id: "greek", label: "\u5E0C\u814A\u5B57\u6BCD" },
    { id: "arabic", label: "\u963F\u62C9\u4F2F\u5B57\u6BCD" },
    { id: "number", label: "\u6570\u5B57" },
    { id: "other", label: "\u5176\u4ED6" }
  ]);
  var TITLE_CHINESE_SORTS = Object.freeze([
    { id: "pinyin", label: "\u62FC\u97F3\u987A\u5E8F" },
    { id: "stroke", label: "\u7B14\u753B\u987A\u5E8F" },
    { id: "unicode", label: "Unicode \u987A\u5E8F" }
  ]);
  var TITLE_CHINESE_SORT_IDS = new Set(TITLE_CHINESE_SORTS.map((sort) => sort.id));
  var TITLE_CATEGORY_IDS = new Set(TITLE_CATEGORIES.map((category) => category.id));
  var DEFAULT_TITLE_SORT_CONFIG = Object.freeze({
    directStringCompare: false,
    categoryOrder: Object.freeze([
      "latin",
      "han",
      "kana",
      "hangul",
      "cyrillic",
      "greek",
      "arabic",
      "number",
      "other"
    ]),
    chineseSort: "pinyin"
  });
  var CATEGORY_ID_ALIASES = Object.freeze({
    english: "latin",
    chinese: "han"
  });
  function normalizeTitleSortConfig(config = DEFAULT_TITLE_SORT_CONFIG) {
    const source = config && typeof config === "object" ? config : DEFAULT_TITLE_SORT_CONFIG;
    const requestedOrder = Array.isArray(source.categoryOrder) ? source.categoryOrder : [];
    const categoryOrder = [];
    for (const requestedCategoryId of requestedOrder) {
      const categoryId = CATEGORY_ID_ALIASES[requestedCategoryId] || requestedCategoryId;
      if (TITLE_CATEGORY_IDS.has(categoryId) && !categoryOrder.includes(categoryId)) {
        categoryOrder.push(categoryId);
      }
    }
    for (const category of TITLE_CATEGORIES) {
      if (!categoryOrder.includes(category.id)) {
        categoryOrder.push(category.id);
      }
    }
    return {
      directStringCompare: Boolean(source.directStringCompare),
      categoryOrder,
      chineseSort: TITLE_CHINESE_SORT_IDS.has(source.chineseSort) ? source.chineseSort : DEFAULT_TITLE_SORT_CONFIG.chineseSort
    };
  }
  function classifyCharacter(character) {
    if (/\p{Script=Latin}/u.test(character)) return "latin";
    if (/\p{Decimal_Number}/u.test(character)) return "number";
    if (/\p{Script=Han}/u.test(character)) return "han";
    if (/\p{Script_Extensions=Hiragana}|\p{Script_Extensions=Katakana}/u.test(character)) {
      return "kana";
    }
    if (/\p{Script=Hangul}/u.test(character)) return "hangul";
    if (/\p{Script=Cyrillic}/u.test(character)) return "cyrillic";
    if (/\p{Script=Greek}/u.test(character)) return "greek";
    if (/\p{Script=Arabic}/u.test(character)) return "arabic";
    return "other";
  }
  function detectTextCategoryIds(texts = []) {
    const detected = /* @__PURE__ */ new Set();
    for (const text of texts) {
      for (const character of Array.from(text || "")) {
        detected.add(classifyCharacter(character));
      }
    }
    if (!detected.size) detected.add("other");
    return TITLE_CATEGORIES.filter((category) => detected.has(category.id)).map((category) => category.id);
  }
  function compareUnicodeCharacters(a, b) {
    return (a.codePointAt(0) || 0) - (b.codePointAt(0) || 0);
  }
  function compareUnicodeStrings(a, b) {
    const charsA = Array.from(a);
    const charsB = Array.from(b);
    const length = Math.min(charsA.length, charsB.length);
    for (let index = 0; index < length; index++) {
      const result = compareUnicodeCharacters(charsA[index], charsB[index]);
      if (result) return result;
    }
    return charsA.length - charsB.length;
  }
  var pinyinCache = /* @__PURE__ */ new Map();
  function getPinyinKey(character) {
    if (pinyinCache.has(character)) return pinyinCache.get(character);
    const pinyin = globalThis.pinyinPro?.pinyin;
    if (typeof pinyin !== "function") {
      throw new Error("\u62FC\u97F3\u6392\u5E8F\u5E93\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5");
    }
    const result = pinyin(character, {
      toneType: "none",
      type: "array",
      v: true
    });
    const key = Array.isArray(result) && result[0] ? result[0] : character;
    pinyinCache.set(character, key);
    return key;
  }
  function compareCharacters(a, b, category, chineseSort) {
    if (category === "han") {
      if (chineseSort === "unicode") {
        return compareUnicodeCharacters(a, b);
      }
      if (chineseSort === "pinyin") {
        return pinyinCollator.compare(getPinyinKey(a), getPinyinKey(b));
      }
      return strokeCollator.compare(a, b);
    }
    const result = collator.compare(a, b);
    if (result) return result;
    return 0;
  }
  function compareTitles(titleA, titleB, config, categoryRanks) {
    if (config.directStringCompare) {
      const result = collator.compare(titleA, titleB);
      return result || compareUnicodeStrings(titleA, titleB);
    }
    const charsA = Array.from(titleA);
    const charsB = Array.from(titleB);
    const length = Math.min(charsA.length, charsB.length);
    for (let index = 0; index < length; index++) {
      const charA = charsA[index];
      const charB = charsB[index];
      const categoryA = classifyCharacter(charA);
      const categoryB = classifyCharacter(charB);
      const rankA = categoryRanks[categoryA];
      const rankB = categoryRanks[categoryB];
      if (rankA !== rankB) return rankA - rankB;
      const characterResult = compareCharacters(charA, charB, categoryA, config.chineseSort);
      if (characterResult) return characterResult;
    }
    const lengthResult = charsA.length - charsB.length;
    if (lengthResult) return lengthResult;
    return compareUnicodeStrings(titleA, titleB);
  }
  function createTextComparator(config = DEFAULT_TITLE_SORT_CONFIG) {
    const normalizedConfig = normalizeTitleSortConfig(config);
    const categoryRanks = Object.fromEntries(
      normalizedConfig.categoryOrder.map((categoryId, index) => [categoryId, index])
    );
    return (textA = "", textB = "") => compareTitles(textA, textB, normalizedConfig, categoryRanks);
  }
  function createTitleComparator(config = DEFAULT_TITLE_SORT_CONFIG) {
    const compareText = createTextComparator(config);
    return (a, b) => {
      const titleA = a.title || "";
      const titleB = b.title || "";
      const titleResult = compareText(titleA, titleB);
      if (titleResult) return titleResult;
      const artistResult = collator.compare(a.artist || "", b.artist || "");
      if (artistResult) return artistResult;
      const albumResult = collator.compare(a.album || "", b.album || "");
      if (albumResult) return albumResult;
      return compareOriginalOrder(a, b);
    };
  }
  var cmpByTitle = createTitleComparator();

  // src/settings/storage.js
  function readStoredValue(key) {
    if (typeof globalThis.GM_getValue === "function") {
      return globalThis.GM_getValue(key, null);
    }
    if (typeof globalThis.GM?.getValue === "function") {
      return globalThis.GM.getValue(key, null);
    }
    if (globalThis.localStorage) {
      const raw = globalThis.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  }
  function writeStoredValue(key, value) {
    if (typeof globalThis.GM_setValue === "function") {
      return Promise.resolve(globalThis.GM_setValue(key, value)).then(() => true);
    }
    if (typeof globalThis.GM?.setValue === "function") {
      return Promise.resolve(globalThis.GM.setValue(key, value)).then(() => true);
    }
    if (globalThis.localStorage) {
      globalThis.localStorage.setItem(key, JSON.stringify(value));
      return true;
    }
    return false;
  }

  // src/settings/title-sort.js
  var TITLE_SORT_SETTINGS_KEY = "ncm-playlist-sort:title-sort-config";
  async function loadTitleSortConfig() {
    try {
      const stored = await Promise.resolve(readStoredValue(TITLE_SORT_SETTINGS_KEY));
      return normalizeTitleSortConfig(stored);
    } catch (error) {
      console.warn("[NCM-SORT] \u8BFB\u53D6\u6807\u9898\u6392\u5E8F\u8BBE\u7F6E\u5931\u8D25\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u8BBE\u7F6E", error);
      return normalizeTitleSortConfig(DEFAULT_TITLE_SORT_CONFIG);
    }
  }
  async function saveTitleSortConfig(config) {
    const normalized = normalizeTitleSortConfig(config);
    try {
      return await Promise.resolve(writeStoredValue(TITLE_SORT_SETTINGS_KEY, normalized));
    } catch (error) {
      console.warn("[NCM-SORT] \u4FDD\u5B58\u6807\u9898\u6392\u5E8F\u8BBE\u7F6E\u5931\u8D25", error);
      return false;
    }
  }

  // src/ui/styles.js
  var swalClasses = Object.freeze({
    popup: "ncm-sort-popup",
    title: "ncm-sort-popup-title",
    htmlContainer: "ncm-sort-popup-content",
    confirmButton: "ncm-sort-confirm",
    cancelButton: "ncm-sort-cancel",
    closeButton: "ncm-sort-close"
  });
  var dangerSwalClasses = Object.freeze({
    ...swalClasses,
    popup: "ncm-sort-popup ncm-sort-danger-popup"
  });
  function installStyles() {
    GM_addStyle(`
    .ncm-sort-title-btn i {
      font-style: normal;
    }

    .ncm-sort-popup {
      width: min(92vw, 460px) !important;
      padding: 26px 26px 22px !important;
      border: 1px solid #e1e6e8 !important;
      border-radius: 14px !important;
      box-shadow: 0 18px 50px rgba(24, 34, 38, 0.18) !important;
      color: #263238 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif !important;
    }

    .ncm-sort-manual-popup {
      width: min(92vw, 720px) !important;
    }

    .ncm-sort-script-popup {
      width: min(92vw, 760px) !important;
    }

    .ncm-sort-popup .swal2-title {
      margin: 0 0 20px !important;
      padding: 0 !important;
      color: #20282b !important;
      font-size: 21px !important;
      font-weight: 700 !important;
      line-height: 1.35 !important;
    }

    .ncm-sort-popup .swal2-html-container {
      margin: 0 !important;
      color: #4f5b60 !important;
      font-size: 14px !important;
      line-height: 1.6 !important;
    }

    .ncm-sort-popup .swal2-html-container p {
      margin: 0;
    }

    .ncm-sort-popup .swal2-actions {
      width: 100%;
      margin: 22px 0 0 !important;
      gap: 10px;
    }

    .ncm-sort-popup .swal2-confirm,
    .ncm-sort-popup .swal2-cancel {
      min-width: 92px;
      min-height: 40px;
      margin: 0 !important;
      padding: 0 18px !important;
      border: 0 !important;
      border-radius: 8px !important;
      box-shadow: none !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      line-height: 40px !important;
      transition: background-color 0.15s ease, transform 0.15s ease !important;
    }

    .ncm-sort-popup .swal2-confirm {
      background: #2f7d75 !important;
      color: #fff !important;
    }

    .ncm-sort-popup .swal2-confirm:hover {
      background: #256860 !important;
    }

    .ncm-sort-popup .swal2-cancel {
      background: #eef1f2 !important;
      color: #465257 !important;
    }

    .ncm-sort-popup .swal2-cancel:hover {
      background: #e1e6e8 !important;
    }

    .ncm-sort-popup .swal2-confirm:active,
    .ncm-sort-popup .swal2-cancel:active,
    .ncm-sort-menu-button:active,
    .ncm-sort-choice-button:active {
      transform: translateY(1px);
    }

    .ncm-sort-danger-popup .swal2-confirm {
      background: #c84f4f !important;
    }

    .ncm-sort-danger-popup .swal2-confirm:hover {
      background: #ad3f3f !important;
    }

    .ncm-sort-menu,
    .ncm-sort-choice-list {
      display: grid;
      gap: 10px;
    }

    .ncm-sort-menu-button,
    .ncm-sort-choice-button {
      display: flex;
      width: 100%;
      min-height: 44px;
      align-items: center;
      justify-content: flex-start;
      box-sizing: border-box;
      margin: 0 !important;
      padding: 0 16px !important;
      border: 1px solid #dfe5e7 !important;
      border-radius: 8px !important;
      background: #f7f9f9 !important;
      color: #2e393d !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      line-height: 1.4 !important;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease !important;
    }

    .ncm-sort-menu-button:hover,
    .ncm-sort-choice-button:hover {
      border-color: #73a9a3 !important;
      background: #edf6f4 !important;
      color: #205e58 !important;
    }

    .ncm-sort-choice-button.is-selected {
      border-color: #5c9a93 !important;
      background: #e5f2f0 !important;
      color: #205e58 !important;
      box-shadow: inset 3px 0 0 #2f7d75 !important;
    }

    .ncm-sort-choice-button:disabled {
      cursor: not-allowed;
    }

    .ncm-sort-menu-button-danger {
      border-color: #efd0d0 !important;
      background: #fff7f7 !important;
      color: #a83e3e !important;
    }

    .ncm-sort-menu-button-danger:hover {
      border-color: #d98282 !important;
      background: #fff0f0 !important;
      color: #8f3030 !important;
    }

    .ncm-sort-intro {
      margin-bottom: 18px !important;
      text-align: left;
    }

    .ncm-sort-title-settings {
      display: grid;
      gap: 16px;
      text-align: left;
    }

    .ncm-sort-title-settings .ncm-sort-intro {
      margin-bottom: 0 !important;
    }

    .ncm-sort-switch-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      cursor: pointer;
    }

    .ncm-sort-switch-row.is-disabled {
      opacity: 0.48;
      cursor: not-allowed;
    }

    .ncm-sort-date-settings {
      display: grid;
      gap: 12px;
      margin-bottom: 18px;
      padding: 14px;
      border: 1px solid #e0e6e8;
      border-radius: 8px;
      background: #fbfcfc;
      text-align: left;
    }

    .ncm-sort-date-order {
      display: grid;
      gap: 8px;
      margin-bottom: 18px;
      text-align: left;
      transition: opacity 0.15s ease;
    }

    .ncm-sort-date-order.is-disabled {
      opacity: 0.48;
    }

    .ncm-sort-switch-row input {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .ncm-sort-switch {
      position: relative;
      flex: 0 0 auto;
      width: 36px;
      height: 20px;
      margin-top: 1px;
      border-radius: 10px;
      background: #cbd4d6;
      transition: background-color 0.15s ease;
    }

    .ncm-sort-switch::after {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(24, 34, 38, 0.2);
      content: '';
      transition: transform 0.15s ease;
    }

    .ncm-sort-switch-row input:checked + .ncm-sort-switch {
      background: #2f7d75;
    }

    .ncm-sort-switch-row input:checked + .ncm-sort-switch::after {
      transform: translateX(16px);
    }

    .ncm-sort-switch-row input:focus-visible + .ncm-sort-switch {
      box-shadow: 0 0 0 3px rgba(92, 154, 147, 0.18);
    }

    .ncm-sort-switch-label {
      display: block;
      color: #2e393d;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
    }

    .ncm-sort-switch-help {
      display: block;
      margin-top: 3px;
      color: #6c787d;
      font-size: 12px;
      line-height: 1.45;
    }

    .ncm-sort-priority-panel {
      min-width: 0;
      margin: 0;
      padding: 14px 14px 12px;
      border: 1px solid #e0e6e8;
      border-radius: 8px;
      text-align: left;
      transition: opacity 0.15s ease, background-color 0.15s ease;
    }

    .ncm-sort-priority-panel legend {
      padding: 0 6px;
      color: #3e4a4f;
      font-size: 13px;
      font-weight: 700;
    }

    .ncm-sort-priority-panel.is-disabled {
      opacity: 0.48;
      background: #f4f6f6;
    }

    .ncm-sort-conditional.is-hidden {
      display: none;
    }

    .ncm-sort-priority-panel .ncm-sort-help {
      margin: 0 0 10px !important;
    }

    .ncm-sort-select-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 12px;
    }

    .ncm-sort-select {
      min-width: 144px;
      height: 36px;
      box-sizing: border-box;
      padding: 0 30px 0 10px;
      border: 1px solid #d5dddf;
      border-radius: 7px;
      background: #fff;
      color: #344146;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    .ncm-sort-select:focus {
      border-color: #5c9a93;
      box-shadow: 0 0 0 3px rgba(92, 154, 147, 0.16);
      outline: none;
    }

    .ncm-sort-priority-list {
      display: grid;
      gap: 7px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .ncm-sort-scroll-container {
      max-height: min(62vh, 560px);
      overflow-y: auto;
      padding: 2px 5px 2px 0;
      scrollbar-color: #a9c8c4 #f1f5f4;
      scrollbar-width: thin;
    }

    .ncm-sort-scroll-container::-webkit-scrollbar {
      width: 8px;
    }

    .ncm-sort-scroll-container::-webkit-scrollbar-track {
      border-radius: 4px;
      background: #f1f5f4;
    }

    .ncm-sort-scroll-container::-webkit-scrollbar-thumb {
      border: 2px solid #f1f5f4;
      border-radius: 4px;
      background: #a9c8c4;
    }

    .ncm-sort-song-item {
      min-height: 52px;
    }

    .ncm-sort-drag-placeholder {
      box-sizing: border-box;
      min-height: 38px;
      border: 1px dashed #8dbbb5;
      border-radius: 7px;
      background: #edf6f4;
    }

    .ncm-sort-song-list .ncm-sort-drag-placeholder {
      min-height: 52px;
    }

    .ncm-sort-song-name {
      flex: 1 1 auto;
    }

    .ncm-sort-song-details {
      display: grid;
      min-width: 0;
      gap: 2px;
      flex: 1 1 auto;
      text-align: left;
    }

    .ncm-sort-song-title,
    .ncm-sort-song-meta {
      display: block;
      min-width: 0;
      overflow-wrap: anywhere;
      text-align: left;
    }

    .ncm-sort-song-title {
      color: #2e393d;
      line-height: 1.4;
    }

    .ncm-sort-song-meta {
      color: #7a8588;
      font-size: 12px;
      font-weight: 400;
      line-height: 1.35;
    }

    .ncm-sort-priority-item {
      display: flex;
      min-height: 38px;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      box-sizing: border-box;
      padding: 5px 7px 5px 9px;
      border: 1px solid #e1e7e8;
      border-radius: 7px;
      background: #fbfcfc;
      cursor: grab;
      user-select: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease, background-color 0.15s ease;
    }

    .ncm-sort-priority-item:hover {
      border-color: #b9d6d2;
      background: #f6fbfa;
    }

    .ncm-sort-priority-item.is-dragging {
      opacity: 0.55;
      border-color: #5c9a93;
      background: #e5f2f0;
      box-shadow: 0 5px 14px rgba(47, 125, 117, 0.16);
      cursor: grabbing;
    }

    .ncm-sort-priority-item.is-drag-source-hidden {
      position: fixed !important;
      top: -10000px !important;
      left: -10000px !important;
      width: 1px !important;
      height: 1px !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      opacity: 0;
      pointer-events: none;
    }

    body.ncm-sort-is-pointer-dragging,
    body.ncm-sort-is-pointer-dragging * {
      cursor: grabbing !important;
    }

    .ncm-sort-priority-name {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 9px;
      color: #344146;
      font-size: 13px;
      font-weight: 600;
    }

    .ncm-sort-priority-index {
      display: inline-flex;
      width: 21px;
      height: 21px;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #edf2f2;
      color: #56706d;
      font-size: 12px;
      font-weight: 700;
    }

    .ncm-sort-song-list .ncm-sort-priority-index {
      width: 3.2em;
      min-width: 3.2em;
      height: 24px;
      border-radius: 6px;
    }

    .ncm-sort-priority-actions {
      display: inline-flex;
      align-items: center;
    }

    .ncm-sort-drag-handle {
      display: inline-flex;
      width: 30px;
      height: 30px;
      align-items: center;
      justify-content: center;
      margin: 0 !important;
      padding: 0 !important;
      border: 1px solid #dce4e5;
      border-radius: 6px !important;
      background: #fff;
      color: #6a777b;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
      line-height: 1;
      cursor: grab;
      touch-action: none;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .ncm-sort-drag-handle:hover,
    .ncm-sort-drag-handle:focus-visible {
      border-color: #73a9a3;
      background: #edf6f4;
      color: #205e58;
      outline: none;
    }

    .ncm-sort-drag-handle:active {
      cursor: grabbing;
    }

    .ncm-sort-priority-panel.is-disabled .ncm-sort-drag-handle {
      cursor: not-allowed;
    }

    .ncm-sort-help {
      margin-top: 6px !important;
      color: #6c787d !important;
      font-size: 13px !important;
      line-height: 1.55 !important;
    }

    .ncm-sort-detected {
      display: inline-block;
      max-width: 100%;
      box-sizing: border-box;
      margin-top: 10px !important;
      padding: 5px 9px;
      border: 1px solid #d7e8e5;
      border-radius: 6px;
      background: #f1f8f7;
      color: #286b64 !important;
      font-size: 12px !important;
      line-height: 1.45 !important;
    }

    .ncm-sort-warning {
      margin-top: 8px !important;
      color: #bd4848 !important;
      font-size: 13px !important;
      line-height: 1.55 !important;
    }

    .ncm-sort-script-editor,
    .ncm-sort-script-preview {
      text-align: left;
    }

    .ncm-sort-script-columns {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px;
      text-align: left;
    }

    .ncm-sort-script-preview-panel,
    .ncm-sort-script-command-panel {
      min-width: 0;
    }

    .ncm-sort-script-panel-title {
      margin-bottom: 7px;
      color: #3e4a4f;
      font-size: 13px;
      font-weight: 700;
    }

    .ncm-sort-script-live-preview {
      --ncm-sort-script-viewport-height: min(58vh, 520px);
      min-height: var(--ncm-sort-script-viewport-height);
      max-height: var(--ncm-sort-script-viewport-height);
      box-sizing: border-box;
      overflow-y: auto;
      padding: 0 10px;
      border: 1px solid #e0e6e8;
      border-radius: 8px;
      background: #fbfcfc;
      scrollbar-color: #a9c8c4 #f1f5f4;
      scrollbar-width: thin;
    }

    .ncm-sort-script-scroll-wrap {
      position: relative;
    }

    .ncm-sort-script-active-line {
      position: absolute;
      display: none;
      z-index: 3;
      right: 1px;
      left: 1px;
      height: 21.45px;
      box-sizing: border-box;
      border-top: 1px solid rgba(47, 125, 117, 0.36);
      border-bottom: 1px solid rgba(47, 125, 117, 0.36);
      background: rgba(92, 154, 147, 0.12);
      pointer-events: none;
    }

    .ncm-sort-script-active-line::after {
      position: absolute;
      top: -1px;
      right: 7px;
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(47, 125, 117, 0.9);
      color: #fff;
      content: attr(data-order);
      font-size: 10px;
      line-height: 18px;
    }

    .ncm-sort-script-live-summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 5px 9px;
      margin-bottom: 7px;
      color: #58666a;
      font-size: 12px;
    }

    .ncm-sort-script-live-summary strong {
      color: #2e393d;
      font-size: 13px;
    }

    .ncm-sort-script-live-summary .is-added,
    .ncm-sort-script-preview-row.is-added .ncm-sort-script-preview-marker {
      color: #2f7d75;
    }

    .ncm-sort-script-live-summary .is-removed {
      color: #a83e3e;
    }

    .ncm-sort-script-live-summary .is-loading,
    .ncm-sort-script-live-summary .is-error {
      grid-column: 1 / -1;
    }

    .ncm-sort-script-live-summary .is-loading {
      color: #6c787d;
    }

    .ncm-sort-script-live-summary .is-error {
      color: #a83e3e;
    }

    .ncm-sort-script-preview-list {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .ncm-sort-script-preview-list::before,
    .ncm-sort-script-preview-list::after {
      display: block;
      height: calc((min(58vh, 520px) - 32px) / 2);
      content: '';
    }

    .ncm-sort-script-preview-group {
      margin: 0;
      padding: 0;
      list-style: none;
      cursor: pointer;
      outline: none;
    }

    .ncm-sort-script-preview-group.is-selected > .ncm-sort-script-preview-row {
      border-color: #347b73;
      background: #e6f3f0;
      box-shadow: 0 0 0 2px rgba(52, 123, 115, 0.2);
    }

    .ncm-sort-script-track-list {
      display: grid;
      gap: 3px;
      margin: 4px 0 0 18px;
      padding: 0;
      list-style: none;
    }

    .ncm-sort-script-track-row {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 6px;
      box-sizing: border-box;
      padding: 4px;
      border-left: 2px solid #dce9e7;
      color: #58666a;
      font-size: 11px;
    }

    .ncm-sort-script-track-row.is-added {
      border-left-color: #73a9a3;
      background: #f1f8f7;
      color: #2f7d75;
    }

    .ncm-sort-script-track-marker {
      width: 12px;
      flex: 0 0 12px;
      color: #93a0a3;
      font-weight: 700;
      text-align: center;
    }

    .ncm-sort-script-track-row.is-added .ncm-sort-script-track-marker {
      color: #2f7d75;
    }

    .ncm-sort-script-preview-row {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 6px;
      padding: 5px 4px;
      border-bottom: 1px solid #edf1f1;
      color: #344146;
      font-size: 12px;
    }

    .ncm-sort-script-preview-source-row {
      box-sizing: border-box;
      overflow: hidden;
      padding: 5px 4px;
      border-bottom: 1px solid #edf1f1;
    }

    .ncm-sort-script-preview-source-row.is-blank {
      min-height: 21.45px;
      height: 21.45px;
      padding: 0;
      border-bottom-color: transparent;
      background: transparent;
    }

    .ncm-sort-script-preview-source-row.is-comment {
      min-height: 21.45px;
      height: 21.45px;
      display: block;
      overflow: hidden;
      padding: 0 4px;
      color: #829093;
      font: 12px/21.45px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ncm-sort-script-preview-row.is-added {
      background: #f1f8f7;
    }

    .ncm-sort-script-preview-marker {
      width: 12px;
      flex: 0 0 12px;
      color: #93a0a3;
      font-weight: 700;
      text-align: center;
    }

    .ncm-sort-script-preview-details {
      display: grid;
      min-width: 0;
      gap: 1px;
      flex: 1 1 auto;
    }

    .ncm-sort-script-preview-details > span {
      overflow-wrap: anywhere;
    }

    .ncm-sort-script-preview-details small {
      overflow-wrap: anywhere;
      color: #7a8588;
      font-size: 10px;
    }

    .ncm-sort-script-preview-row code {
      flex: 0 0 auto;
      color: #829093;
      font-size: 10px;
    }

    .ncm-sort-script-removed-title {
      margin: 12px 0 5px;
      color: #a83e3e;
      font-size: 11px;
      font-weight: 700;
    }

    .ncm-sort-script-removed-list {
      display: grid;
      gap: 3px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .ncm-sort-script-removed-list li {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 4px;
      background: #fff7f7;
      color: #704747;
      font-size: 11px;
    }

    .ncm-sort-script-removed-list span {
      overflow-wrap: anywhere;
    }

    .ncm-sort-script-removed-list code {
      flex: 0 0 auto;
      color: #ad7777;
      font-size: 10px;
    }

    .ncm-sort-script-preview-state,
    .ncm-sort-script-preview-error {
      margin: 0 !important;
      color: #6c787d !important;
      font-size: 12px !important;
      line-height: 1.55 !important;
    }

    .ncm-sort-script-preview-error {
      color: #a83e3e !important;
    }

    .ncm-sort-script-textarea {
      --ncm-sort-script-viewport-height: min(58vh, 520px);
      display: block;
      width: 100%;
      min-height: var(--ncm-sort-script-viewport-height);
      max-height: var(--ncm-sort-script-viewport-height);
      box-sizing: border-box;
      resize: vertical;
      overflow-y: auto;
      padding: calc((var(--ncm-sort-script-viewport-height) - 21.45px) / 2) 14px;
      border: 1px solid #d5dddf;
      border-radius: 8px;
      outline: none;
      background: #fbfcfc;
      color: #263238;
      font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      tab-size: 2;
    }

    .ncm-sort-script-textarea:focus {
      border-color: #5c9a93;
      box-shadow: 0 0 0 3px rgba(92, 154, 147, 0.16);
      background: #fff;
    }

    .ncm-sort-script-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 9px;
    }

    .ncm-sort-script-command-line {
      margin-top: 12px;
      padding: 10px 12px 11px;
      border: 1px solid #dfe8e6;
      border-radius: 8px;
      background: linear-gradient(135deg, #f7fbfa, #f1f8f6);
      text-align: left;
    }

    .ncm-sort-script-command-input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .ncm-sort-script-command-input-row::before {
      color: #5c9a93;
      content: '\u203A';
      font: 700 22px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    }

    .ncm-sort-script-command-input {
      min-width: 0;
      flex: 1 1 auto;
      height: 32px;
      box-sizing: border-box;
      padding: 0 10px;
      border: 1px solid #d5dddf;
      border-radius: 6px;
      outline: none;
      background: #fff;
      color: #263238;
      font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    }

    .ncm-sort-script-command-input:focus {
      border-color: #5c9a93;
      box-shadow: 0 0 0 3px rgba(92, 154, 147, 0.16);
    }

    .ncm-sort-script-command-line .ncm-sort-script-tool-button {
      width: 34px;
      min-height: 34px;
      padding: 0 !important;
      border-color: #5c9a93;
      background: #5c9a93;
      color: #fff;
      font-size: 19px;
      font-weight: 700;
      line-height: 1;
    }

    .ncm-sort-script-command-line .ncm-sort-script-tool-button:hover {
      border-color: #347b73;
      background: #347b73;
      color: #fff;
    }

    .ncm-sort-script-tool-button {
      min-height: 32px;
      margin: 0 !important;
      padding: 0 11px !important;
      border: 1px solid #d5dddf;
      border-radius: 6px;
      background: #fff;
      color: #4c585d;
      font-size: 12px;
      cursor: pointer;
    }

    .ncm-sort-script-tool-button:hover {
      border-color: #73a9a3;
      background: #edf6f4;
      color: #205e58;
    }

    .ncm-sort-script-help {
      margin: 9px 0 0 !important;
      color: #6c787d !important;
      font-size: 12px !important;
      line-height: 1.5 !important;
    }

    .ncm-sort-script-warning {
      margin-top: 9px !important;
      padding: 9px 11px;
      border: 1px solid #efd0d0;
      border-radius: 7px;
      background: #fff7f7;
      color: #a83e3e !important;
      font-size: 13px !important;
      line-height: 1.55 !important;
    }

    .ncm-sort-script-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin: 12px 0 0;
    }

    .ncm-sort-script-summary > div {
      display: flex;
      min-height: 64px;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid #e0e6e8;
      border-radius: 8px;
      background: #fbfcfc;
    }

    .ncm-sort-script-summary span {
      color: #6c787d;
      font-size: 12px;
    }

    .ncm-sort-script-summary strong {
      color: #2e393d;
      font-size: 18px;
    }

    .ncm-sort-fields {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      text-align: left;
    }

    .ncm-sort-fields-two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ncm-sort-field {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 6px;
    }

    .ncm-sort-label {
      color: #4c585d;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.4;
    }

    .ncm-sort-input.swal2-input {
      width: 100% !important;
      height: 42px !important;
      box-sizing: border-box;
      margin: 0 !important;
      padding: 0 10px !important;
      border: 1px solid #d5dddf !important;
      border-radius: 8px !important;
      box-shadow: none !important;
      color: #263238 !important;
      font-size: 15px !important;
    }

    .ncm-sort-input.swal2-input:focus {
      border-color: #5c9a93 !important;
      box-shadow: 0 0 0 3px rgba(92, 154, 147, 0.16) !important;
      outline: none !important;
    }

    .ncm-sort-popup .swal2-validation-message {
      margin: 12px 0 0 !important;
      border-radius: 8px !important;
      background: #fff4f4 !important;
      color: #a83e3e !important;
      font-size: 13px !important;
    }

    @media (max-width: 520px) {
      .ncm-sort-popup {
        width: calc(100vw - 24px) !important;
        padding: 22px 18px 18px !important;
      }

      .ncm-sort-manual-popup {
        width: calc(100vw - 24px) !important;
      }

      .ncm-sort-script-popup {
        width: calc(100vw - 24px) !important;
      }

      .ncm-sort-popup .swal2-title {
        margin-bottom: 16px !important;
        font-size: 19px !important;
      }

      .ncm-sort-priority-panel {
        padding-right: 10px;
        padding-left: 10px;
      }

      .ncm-sort-select-row {
        align-items: flex-start;
        flex-direction: column;
        gap: 6px;
      }

      .ncm-sort-select {
        width: 100%;
      }

      .ncm-sort-scroll-container {
        max-height: 58vh;
      }

      .ncm-sort-fields {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .ncm-sort-script-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .ncm-sort-script-columns {
        grid-template-columns: 1fr;
      }

      .ncm-sort-script-live-preview {
        min-height: 220px;
        max-height: 34vh;
      }

      .ncm-sort-popup .swal2-actions {
        flex-wrap: wrap;
      }

      .ncm-sort-popup .swal2-confirm,
      .ncm-sort-popup .swal2-cancel {
        flex: 1 1 120px;
      }
    }
  `);
  }

  // src/sort/date.js
  var collator2 = new Intl.Collator(void 0, {
    numeric: false,
    sensitivity: "base",
    usage: "sort"
  });
  var DEFAULT_DATE_SORT_CONFIG = Object.freeze({
    sortAlbumsByName: false,
    sortAlbumTracks: false
  });
  function normalizeDateSortConfig(config = DEFAULT_DATE_SORT_CONFIG) {
    const source = config && typeof config === "object" ? config : DEFAULT_DATE_SORT_CONFIG;
    const sortAlbumsByName = Boolean(source.sortAlbumsByName);
    return {
      sortAlbumsByName,
      sortAlbumTracks: sortAlbumsByName && Boolean(source.sortAlbumTracks)
    };
  }
  function compareAlbumTrackOrder(a, b) {
    const discA = a.albumDiscNo || 0;
    const discB = b.albumDiscNo || 0;
    if (discA !== discB) {
      if (!discA) return 1;
      if (!discB) return -1;
      return discA - discB;
    }
    const trackA = a.albumTrackNo || 0;
    const trackB = b.albumTrackNo || 0;
    if (trackA !== trackB) {
      if (!trackA) return 1;
      if (!trackB) return -1;
      return trackA - trackB;
    }
    return 0;
  }
  function isSameAlbum(a, b) {
    if (a.albumId && b.albumId) return a.albumId === b.albumId;
    return (a.album || "") === (b.album || "");
  }
  function cmpByDate(descending, config = DEFAULT_DATE_SORT_CONFIG) {
    const normalizedConfig = normalizeDateSortConfig(config);
    return (a, b) => {
      const timeA = a.publishTime || 0;
      const timeB = b.publishTime || 0;
      if (timeA !== timeB) {
        return descending ? timeB - timeA : timeA - timeB;
      }
      if (normalizedConfig.sortAlbumsByName) {
        const albumResult = collator2.compare(a.album || "", b.album || "");
        if (albumResult) return albumResult;
        if (normalizedConfig.sortAlbumTracks && isSameAlbum(a, b)) {
          const trackResult = compareAlbumTrackOrder(a, b);
          if (trackResult) return trackResult;
        }
      }
      return cmpByTitle(a, b);
    };
  }

  // src/sort/artist.js
  var DEFAULT_ARTIST_SORT_CONFIG = Object.freeze({
    sortArtistsByName: true,
    sortSameArtistByDate: false
  });
  function normalizeArtistSortConfig(config = DEFAULT_ARTIST_SORT_CONFIG) {
    const source = config && typeof config === "object" ? config : DEFAULT_ARTIST_SORT_CONFIG;
    const sortArtistsByName = source.sortArtistsByName !== false;
    return {
      sortArtistsByName,
      sortSameArtistByDate: Boolean(source.sortSameArtistByDate)
    };
  }
  function sortSongsByArtist(items, config, textSortConfig, dateSortConfig) {
    const normalizedConfig = normalizeArtistSortConfig(config);
    const compareArtist = createTextComparator(textSortConfig);
    const compareDate = cmpByDate(
      dateSortConfig?.descending !== false,
      dateSortConfig
    );
    const groups = [];
    const groupsByArtist = /* @__PURE__ */ new Map();
    items.forEach((item, index) => {
      const originalIndex = getOriginalIndex(item, index);
      const artist = item.artist || "";
      let group = groupsByArtist.get(artist);
      if (!group) {
        group = { artist, index: originalIndex, items: [] };
        groupsByArtist.set(artist, group);
        groups.push(group);
      }
      group.items.push({ item, index: originalIndex });
    });
    const orderedGroups = normalizedConfig.sortArtistsByName ? stableSort(groups, (a, b) => compareArtist(a.artist, b.artist), (group) => group.index) : groups;
    return orderedGroups.flatMap((group) => {
      if (normalizedConfig.sortSameArtistByDate) {
        group.items = stableSort(
          group.items,
          (a, b) => compareDate(a.item, b.item),
          (item) => item.index
        );
      }
      return group.items.map(({ item }) => item);
    });
  }

  // src/settings/artist-sort.js
  var ARTIST_SORT_SETTINGS_KEY = "ncm-playlist-sort:artist-sort-config";
  var DEFAULT_ARTIST_SORT_SETTINGS = Object.freeze({
    ...DEFAULT_ARTIST_SORT_CONFIG
  });
  function normalizeArtistSortSettings(settings = DEFAULT_ARTIST_SORT_SETTINGS) {
    const source = settings && typeof settings === "object" ? settings : DEFAULT_ARTIST_SORT_SETTINGS;
    const artistConfig = normalizeArtistSortConfig(source);
    return artistConfig;
  }
  async function loadArtistSortSettings() {
    try {
      const stored = await Promise.resolve(readStoredValue(ARTIST_SORT_SETTINGS_KEY));
      return normalizeArtistSortSettings(stored);
    } catch (error) {
      console.warn("[NCM-SORT] \u8BFB\u53D6\u6B4C\u624B\u6392\u5E8F\u8BBE\u7F6E\u5931\u8D25\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u8BBE\u7F6E", error);
      return normalizeArtistSortSettings(DEFAULT_ARTIST_SORT_SETTINGS);
    }
  }
  async function saveArtistSortSettings(settings) {
    const normalized = normalizeArtistSortSettings(settings);
    try {
      return await Promise.resolve(writeStoredValue(ARTIST_SORT_SETTINGS_KEY, normalized));
    } catch (error) {
      console.warn("[NCM-SORT] \u4FDD\u5B58\u6B4C\u624B\u6392\u5E8F\u8BBE\u7F6E\u5931\u8D25", error);
      return false;
    }
  }

  // src/settings/date-sort.js
  var DATE_SORT_SETTINGS_KEY = "ncm-playlist-sort:date-sort-config";
  var DEFAULT_DATE_SORT_SETTINGS = Object.freeze({
    descending: true,
    ...DEFAULT_DATE_SORT_CONFIG
  });
  function normalizeDateSortSettings(settings = DEFAULT_DATE_SORT_SETTINGS) {
    const source = settings && typeof settings === "object" ? settings : DEFAULT_DATE_SORT_SETTINGS;
    return {
      descending: source.descending !== false,
      ...normalizeDateSortConfig(source)
    };
  }
  async function loadDateSortSettings() {
    try {
      const stored = await Promise.resolve(readStoredValue(DATE_SORT_SETTINGS_KEY));
      return normalizeDateSortSettings(stored);
    } catch (error) {
      console.warn("[NCM-SORT] \u8BFB\u53D6\u53D1\u884C\u65E5\u671F\u6392\u5E8F\u8BBE\u7F6E\u5931\u8D25\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u8BBE\u7F6E", error);
      return normalizeDateSortSettings(DEFAULT_DATE_SORT_SETTINGS);
    }
  }
  async function saveDateSortSettings(settings) {
    const normalized = normalizeDateSortSettings(settings);
    try {
      return await Promise.resolve(writeStoredValue(DATE_SORT_SETTINGS_KEY, normalized));
    } catch (error) {
      console.warn("[NCM-SORT] \u4FDD\u5B58\u53D1\u884C\u65E5\u671F\u6392\u5E8F\u8BBE\u7F6E\u5931\u8D25", error);
      return false;
    }
  }

  // src/sort/heat.js
  var HEAT_SORT_METRICS = Object.freeze([
    { id: "popularity", label: "\u70ED\u5EA6\u503C" },
    { id: "redCount", label: "\u7EA2\u5FC3\u6570\u91CF" },
    { id: "commentCount", label: "\u8BC4\u8BBA\u6570\u91CF" }
  ]);
  var HEAT_SORT_METRIC_IDS = new Set(HEAT_SORT_METRICS.map((metric) => metric.id));
  var DEFAULT_HEAT_SORT_CONFIG = Object.freeze({
    metric: "popularity",
    descending: true
  });
  function normalizeHeatSortConfig(config = DEFAULT_HEAT_SORT_CONFIG) {
    const source = config && typeof config === "object" ? config : DEFAULT_HEAT_SORT_CONFIG;
    return {
      metric: HEAT_SORT_METRIC_IDS.has(source.metric) ? source.metric : DEFAULT_HEAT_SORT_CONFIG.metric,
      descending: source.descending !== false
    };
  }
  function getMetricValue(item, metric) {
    if (item?.[metric] === null || item?.[metric] === void 0 || item?.[metric] === "") {
      return null;
    }
    const value = Number(item?.[metric]);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  function cmpByHeat(config = DEFAULT_HEAT_SORT_CONFIG) {
    const normalizedConfig = normalizeHeatSortConfig(config);
    return (a, b) => {
      const valueA = getMetricValue(a, normalizedConfig.metric);
      const valueB = getMetricValue(b, normalizedConfig.metric);
      const knownA = valueA !== null;
      const knownB = valueB !== null;
      if (knownA !== knownB) return knownA ? -1 : 1;
      if (!knownA) return 0;
      if (valueA === valueB) return 0;
      return normalizedConfig.descending ? valueB - valueA : valueA - valueB;
    };
  }
  function sortSongsByHeat(items, config = DEFAULT_HEAT_SORT_CONFIG) {
    return stableSort(items, cmpByHeat(config));
  }

  // src/data/playlist-script-protocol.js
  var PLAYLIST_SCRIPT_VERSION = 1;
  function normalizePlaylistId(value) {
    const id = String(value ?? "").trim();
    return /^[1-9]\d*$/.test(id) ? id : null;
  }
  function createPlaylistScriptError(message, line = null) {
    const error = new Error(line ? `\u7B2C ${line} \u884C\uFF1A${message}` : message);
    error.name = "PlaylistScriptError";
    error.line = line;
    return error;
  }
  function parsePosition(value) {
    if (value === void 0) return null;
    if (!/^\d+$/.test(value)) {
      throw createPlaylistScriptError("position \u5FC5\u987B\u662F\u975E\u8D1F\u6574\u6570");
    }
    const position = Number(value);
    if (!Number.isSafeInteger(position)) {
      throw createPlaylistScriptError("position \u8D85\u51FA\u5B89\u5168\u6574\u6570\u8303\u56F4");
    }
    return position;
  }
  function parseSongPosition(value, label = "\u4F4D\u7F6E") {
    if (!/^\d+$/.test(value)) {
      throw createPlaylistScriptError(`${label}\u5FC5\u987B\u662F\u6B63\u6574\u6570`);
    }
    const position = Number(value);
    if (!Number.isSafeInteger(position) || position < 1) {
      throw createPlaylistScriptError(`${label}\u5FC5\u987B\u662F\u6B63\u6574\u6570`);
    }
    return position;
  }
  function isUnsignedIntegerToken(value) {
    return /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
  }
  function parseSortCommand(tokens) {
    if (!tokens.length) {
      throw createPlaylistScriptError("sort \u540E\u9700\u8981\u6307\u5B9A title\u3001date\u3001artist \u6216 heat");
    }
    let end = null;
    let start = null;
    if (tokens.length >= 3 && isUnsignedIntegerToken(tokens[tokens.length - 1]) && isUnsignedIntegerToken(tokens[tokens.length - 2])) {
      start = parseSongPosition(tokens[tokens.length - 2], "\u6392\u5E8F\u8D77\u59CB\u4F4D\u7F6E");
      end = parseSongPosition(tokens[tokens.length - 1], "\u6392\u5E8F\u7ED3\u675F\u4F4D\u7F6E");
      tokens = tokens.slice(0, -2);
    }
    const key = tokens.shift().toLowerCase();
    const options = {};
    const seen = /* @__PURE__ */ new Set();
    const addOption = (name, value) => {
      if (seen.has(name)) throw createPlaylistScriptError(`sort \u53C2\u6570\u91CD\u590D\uFF1A${name}`);
      seen.add(name);
      options[name] = value;
    };
    if (!["title", "date", "artist", "heat", "random"].includes(key)) {
      throw createPlaylistScriptError(`\u4E0D\u652F\u6301\u7684\u6392\u5E8F\u7C7B\u578B\uFF1A${key}`);
    }
    if (key === "random" && tokens.length) {
      throw createPlaylistScriptError(`random \u4E0D\u652F\u6301\u53C2\u6570\uFF1A${tokens[0]}`);
    }
    if (key === "heat") {
      const metric = tokens.shift()?.toLowerCase();
      const metricAliases = {
        popularity: "popularity",
        red: "redCount",
        redcount: "redCount",
        comments: "commentCount",
        comment: "commentCount",
        commentcount: "commentCount"
      };
      if (!metricAliases[metric]) {
        throw createPlaylistScriptError("heat \u5FC5\u987B\u6307\u5B9A popularity\u3001red \u6216 comments");
      }
      addOption("metric", metricAliases[metric]);
    }
    for (const rawOption of tokens) {
      const option = rawOption.toLowerCase();
      if (key === "title") {
        throw createPlaylistScriptError(`title \u4E0D\u652F\u6301\u53C2\u6570\uFF1A${rawOption}`);
      }
      if (option === "asc" || option === "desc") {
        addOption("descending", option === "desc");
        continue;
      }
      if (key === "date" || key === "artist") {
        if (option === "album" || option === "noalbum") {
          addOption("sortAlbumsByName", option === "album");
          continue;
        }
        if (option === "track" || option === "notrack") {
          addOption("sortAlbumTracks", option === "track");
          continue;
        }
      }
      if (key === "artist") {
        if (option === "name" || option === "original") {
          addOption("sortArtistsByName", option === "name");
          continue;
        }
        if (option === "date" || option === "nodate") {
          addOption("sortSameArtistByDate", option === "date");
          continue;
        }
      }
      if (key === "heat" && (option === "asc" || option === "desc")) continue;
      throw createPlaylistScriptError(`\u4E0D\u652F\u6301\u7684 sort \u53C2\u6570\uFF1A${rawOption}`);
    }
    if (key === "heat" && !Object.hasOwn(options, "metric")) {
      throw createPlaylistScriptError("heat \u5FC5\u987B\u6307\u5B9A\u6392\u5E8F\u6307\u6807");
    }
    if (options.sortAlbumTracks === true && options.sortAlbumsByName === false) {
      throw createPlaylistScriptError("track \u9700\u8981\u5148\u542F\u7528 album");
    }
    return {
      type: "sort",
      key,
      options,
      start,
      end,
      line: 1
    };
  }
  function validateCommandPosition(command, currentCount) {
    if (command.position === null || command.position === void 0) return;
    if (!Number.isInteger(currentCount) || currentCount < 0) {
      throw createPlaylistScriptError("\u65E0\u6CD5\u786E\u8BA4\u5F53\u524D\u6B4C\u5355\u6B4C\u66F2\u6570\u91CF");
    }
    if (command.position > currentCount) {
      throw createPlaylistScriptError(
        `position ${command.position} \u8D85\u51FA\u5F53\u524D\u6B4C\u5355\u8303\u56F4\uFF080-${currentCount}\uFF09`
      );
    }
  }
  function parsePlaylistScript(text, { allowEmpty = false } = {}) {
    if (typeof text !== "string") {
      throw createPlaylistScriptError("\u811A\u672C\u5185\u5BB9\u5FC5\u987B\u662F\u6587\u672C");
    }
    const commands = [];
    const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
    lines.forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.trim();
      if (!line) return;
      if (line.startsWith("#")) {
        const header = line.match(/^#\s*ncm-playlist\s*:\s*(\d+)$/i);
        if (header && Number(header[1]) !== PLAYLIST_SCRIPT_VERSION) {
          throw createPlaylistScriptError(`\u4E0D\u652F\u6301\u7684\u811A\u672C\u7248\u672C\uFF1A${header[1]}`, lineNumber);
        }
        return;
      }
      const match = line.match(/^(song|album)\s+(\S+)$/i);
      if (!match) {
        throw createPlaylistScriptError("\u53EA\u652F\u6301 song <\u6B4C\u66F2ID> \u6216 album <\u4E13\u8F91ID>", lineNumber);
      }
      const id = normalizePlaylistId(match[2]);
      if (!id) {
        throw createPlaylistScriptError("ID \u5FC5\u987B\u662F\u6B63\u6574\u6570", lineNumber);
      }
      commands.push({ type: match[1].toLowerCase(), id, line: lineNumber });
    });
    if (!commands.length && !allowEmpty) {
      throw createPlaylistScriptError("\u811A\u672C\u81F3\u5C11\u9700\u8981\u5305\u542B\u4E00\u6761 song \u6216 album \u547D\u4EE4");
    }
    return commands;
  }
  function parseScriptDocument(text) {
    const commands = parsePlaylistScript(text, { allowEmpty: true });
    const albumCommand = commands.find((command) => command.type === "album");
    if (albumCommand) {
      throw createPlaylistScriptError("\u811A\u672C\u6587\u672C\u53EA\u652F\u6301 song <\u6B4C\u66F2ID>", albumCommand.line);
    }
    return commands;
  }
  function parseSongOnlyPlaylistScript(text) {
    return parseScriptDocument(text);
  }
  function parseCommandLine(text) {
    if (typeof text !== "string" || !text.trim()) {
      throw createPlaylistScriptError("\u8BF7\u8F93\u5165\u547D\u4EE4");
    }
    const normalizedText = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
    if (normalizedText.includes("\n")) {
      throw createPlaylistScriptError("\u547D\u4EE4\u884C\u4E00\u6B21\u53EA\u80FD\u8F93\u5165\u4E00\u6761\u547D\u4EE4");
    }
    if (/^clear$/i.test(normalizedText)) {
      return { type: "clear", line: 1 };
    }
    const tokens = normalizedText.split(/\s+/);
    const verb = tokens.shift().toLowerCase();
    if (verb === "song" || verb === "album") {
      if (tokens.length < 1 || tokens.length > 2) {
        throw createPlaylistScriptError("\u53EA\u652F\u6301 song ID [position] \u6216 album ID [position]");
      }
      const id = normalizePlaylistId(tokens[0]);
      if (!id) {
        throw createPlaylistScriptError("ID \u5FC5\u987B\u662F\u6B63\u6574\u6570");
      }
      const command = { type: verb, id, line: 1 };
      if (tokens[1] !== void 0) command.position = parsePosition(tokens[1]);
      return command;
    }
    if (verb === "remove") {
      if (tokens.length < 1 || tokens.length > 2) {
        throw createPlaylistScriptError("remove \u9700\u8981 start [end]");
      }
      const start = parseSongPosition(tokens[0], "\u8D77\u59CB\u4F4D\u7F6E");
      const end = tokens[1] === void 0 ? start : parseSongPosition(tokens[1], "\u7ED3\u675F\u4F4D\u7F6E");
      return { type: "remove", start, end, line: 1 };
    }
    if (verb === "move") {
      if (tokens.length !== 3) throw createPlaylistScriptError("move \u9700\u8981 start end target");
      return {
        type: "move",
        start: parseSongPosition(tokens[0], "\u8D77\u59CB\u4F4D\u7F6E"),
        end: parseSongPosition(tokens[1], "\u7ED3\u675F\u4F4D\u7F6E"),
        target: parsePosition(tokens[2]),
        line: 1
      };
    }
    if (verb === "swap") {
      if (tokens.length !== 2) throw createPlaylistScriptError("swap \u9700\u8981\u4E24\u4E2A\u6B4C\u66F2\u4F4D\u7F6E");
      return {
        type: "swap",
        positionA: parseSongPosition(tokens[0], "\u6B4C\u66F2\u4F4D\u7F6E"),
        positionB: parseSongPosition(tokens[1], "\u6B4C\u66F2\u4F4D\u7F6E"),
        line: 1
      };
    }
    if (verb === "sort") return parseSortCommand(tokens);
    throw createPlaylistScriptError(
      "\u652F\u6301 song ID [position]\u3001album ID [position]\u3001clear\u3001remove\u3001move\u3001swap \u6216 sort"
    );
  }
  function buildSongScript(songIds) {
    if (!Array.isArray(songIds)) {
      throw createPlaylistScriptError("\u6B4C\u66F2 ID \u5217\u8868\u5FC5\u987B\u662F\u6570\u7EC4");
    }
    return songIds.map((id) => {
      const normalizedId = normalizePlaylistId(id);
      if (!normalizedId) throw createPlaylistScriptError(`\u65E0\u6548\u6B4C\u66F2 ID\uFF1A${id}`);
      return `song ${normalizedId}`;
    }).join("\n");
  }
  function buildPlaylistScript(songIds) {
    return buildSongScript(songIds);
  }

  // src/sort/random.js
  function shuffleItems(items, random = Math.random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const value = Number(random());
      const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.9999999999999999) : 0;
      const swapIndex = Math.floor(normalized * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  // src/data/playlist-plan.js
  function getAlbumSongs(response) {
    if (!response || response.code !== 200) return null;
    const nestedSongs = response.album?.songs;
    if (Array.isArray(nestedSongs) && nestedSongs.length) return nestedSongs;
    if (Array.isArray(response.songs) && response.songs.length) return response.songs;
    return Array.isArray(nestedSongs) ? nestedSongs : null;
  }
  function createSongBlock(id, line = null, item = { id }) {
    return {
      type: "song",
      id,
      line,
      position: null,
      songIds: [id],
      items: [item]
    };
  }
  function normalizeSongIds(songIds) {
    if (!Array.isArray(songIds)) {
      throw createPlaylistScriptError("\u6B4C\u66F2 ID \u5217\u8868\u5FC5\u987B\u662F\u6570\u7EC4");
    }
    return songIds.map((id) => {
      const normalizedId = normalizePlaylistId(id);
      if (!normalizedId) throw createPlaylistScriptError(`\u65E0\u6548\u6B4C\u66F2 ID\uFF1A${id}`);
      return normalizedId;
    });
  }
  function assertUniqueSongIds(songIds) {
    const seenIds = /* @__PURE__ */ new Set();
    const duplicateIds = /* @__PURE__ */ new Set();
    for (const id of songIds) {
      const normalizedId = String(id);
      if (seenIds.has(normalizedId)) duplicateIds.add(normalizedId);
      seenIds.add(normalizedId);
    }
    if (duplicateIds.size) {
      throw createPlaylistScriptError(`\u6267\u884C\u65B9\u6848\u4E2D\u5B58\u5728\u91CD\u590D\u6B4C\u66F2\uFF1A${[...duplicateIds].join("\u3001")}`);
    }
  }
  function createSongPlan(songIds, items = []) {
    const ids = normalizeSongIds(songIds);
    assertUniqueSongIds(ids);
    const itemMap = new Map(items.map((item) => [String(item.id), item]));
    const planItems = ids.map((id) => itemMap.get(id) || { id });
    return {
      songIds: ids,
      blocks: ids.map((id, index) => createSongBlock(id, index + 1, planItems[index])),
      items: planItems
    };
  }
  function insertSongIds(songIds, insertedIds, position) {
    const currentIds = normalizeSongIds(songIds);
    const idsToInsert = normalizeSongIds(insertedIds);
    if (!Number.isInteger(position) || position < 0 || position > currentIds.length) {
      throw createPlaylistScriptError(`\u63D2\u5165\u4F4D\u7F6E\u8D85\u51FA\u5F53\u524D\u6B4C\u5355\u8303\u56F4\uFF080-${currentIds.length}\uFF09`);
    }
    return [
      ...currentIds.slice(0, position),
      ...idsToInsert,
      ...currentIds.slice(position)
    ];
  }
  function validateSongRange(start, end, currentCount, label = "\u4F4D\u7F6E") {
    if (!Number.isInteger(currentCount) || currentCount < 0) {
      throw createPlaylistScriptError(`\u65E0\u6CD5\u786E\u8BA4\u5F53\u524D\u6B4C\u5355\u6B4C\u66F2\u6570\u91CF`);
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1) {
      throw createPlaylistScriptError(`${label}\u5FC5\u987B\u662F\u6B63\u6574\u6570`);
    }
    if (start > end) {
      throw createPlaylistScriptError("\u8D77\u59CB\u4F4D\u7F6E\u4E0D\u80FD\u5927\u4E8E\u7ED3\u675F\u4F4D\u7F6E");
    }
    if (end > currentCount) {
      throw createPlaylistScriptError(
        `${label}\u8D85\u51FA\u5F53\u524D\u6B4C\u5355\u8303\u56F4\uFF081-${currentCount}\uFF09`
      );
    }
  }
  function removeSongRange(songIds, start, end = start) {
    const ids = normalizeSongIds(songIds);
    validateSongRange(start, end, ids.length);
    return [...ids.slice(0, start - 1), ...ids.slice(end)];
  }
  function moveSongRange(songIds, start, end, target) {
    const ids = normalizeSongIds(songIds);
    validateSongRange(start, end, ids.length);
    if (!Number.isInteger(target) || target < 0 || target > ids.length) {
      throw createPlaylistScriptError(`\u76EE\u6807\u4F4D\u7F6E\u8D85\u51FA\u5F53\u524D\u6B4C\u5355\u8303\u56F4\uFF080-${ids.length}\uFF09`);
    }
    const sourceStart = start - 1;
    const sourceEnd = end;
    if (target > sourceStart && target < sourceEnd) {
      throw createPlaylistScriptError("\u76EE\u6807\u4F4D\u7F6E\u4E0D\u80FD\u4F4D\u4E8E\u79FB\u52A8\u533A\u95F4\u5185\u90E8");
    }
    const movedIds = ids.slice(sourceStart, sourceEnd);
    const remainingIds = [...ids.slice(0, sourceStart), ...ids.slice(sourceEnd)];
    const insertAt = target <= sourceStart ? target : target - movedIds.length;
    return [
      ...remainingIds.slice(0, insertAt),
      ...movedIds,
      ...remainingIds.slice(insertAt)
    ];
  }
  function swapSongPositions(songIds, positionA, positionB) {
    const ids = normalizeSongIds(songIds);
    validateSongRange(positionA, positionA, ids.length, "\u6B4C\u66F2\u4F4D\u7F6E");
    validateSongRange(positionB, positionB, ids.length, "\u6B4C\u66F2\u4F4D\u7F6E");
    const nextIds = [...ids];
    const indexA = positionA - 1;
    const indexB = positionB - 1;
    [nextIds[indexA], nextIds[indexB]] = [nextIds[indexB], nextIds[indexA]];
    return nextIds;
  }
  function resolveSelectionAfterTransform(nextIds, selectedSongId = null, fallbackIndex = null) {
    if (selectedSongId != null) {
      const selectedIndex = nextIds.indexOf(String(selectedSongId));
      if (selectedIndex >= 0) return selectedIndex;
    }
    if (fallbackIndex == null || !nextIds.length) return null;
    return Math.min(Math.max(fallbackIndex, 0), nextIds.length - 1);
  }
  function mergeDateSortConfig(settings = {}, options = {}) {
    const base = {
      descending: settings.descending !== false,
      ...DEFAULT_DATE_SORT_CONFIG,
      ...normalizeDateSortConfig(settings)
    };
    return {
      ...base,
      ...Object.hasOwn(options, "descending") ? { descending: options.descending } : {},
      ...Object.hasOwn(options, "sortAlbumsByName") ? { sortAlbumsByName: options.sortAlbumsByName } : {},
      ...Object.hasOwn(options, "sortAlbumTracks") ? { sortAlbumTracks: options.sortAlbumTracks } : {}
    };
  }
  function resolveSortConfig(command, settings = {}) {
    const options = command?.options || {};
    const title = normalizeTitleSortConfig(settings.title);
    const date = mergeDateSortConfig(settings.date, options);
    if (command?.key === "title") return { title };
    if (command?.key === "date") return { date };
    if (command?.key === "artist") {
      const artist = {
        ...normalizeArtistSortConfig(settings.artist),
        ...Object.hasOwn(options, "sortArtistsByName") ? { sortArtistsByName: options.sortArtistsByName } : {},
        ...Object.hasOwn(options, "sortSameArtistByDate") ? { sortSameArtistByDate: options.sortSameArtistByDate } : {}
      };
      return { title, date, artist };
    }
    if (command?.key === "heat") {
      return {
        heat: {
          ...normalizeHeatSortConfig(settings.heat),
          ...Object.hasOwn(options, "metric") ? { metric: options.metric } : {},
          ...Object.hasOwn(options, "descending") ? { descending: options.descending } : {}
        }
      };
    }
    if (command?.key === "random") return { random: true };
    throw createPlaylistScriptError(`\u4E0D\u652F\u6301\u7684\u6392\u5E8F\u7C7B\u578B\uFF1A${command?.key}`);
  }
  function sortSongRange(plan, command, sortConfig) {
    const count = plan.songIds.length;
    if (count === 0 && command.start == null && command.end == null) {
      return createSongPlan([]);
    }
    const start = command.start ?? 1;
    const end = command.end ?? count;
    validateSongRange(start, end, count, "\u6392\u5E8F\u4F4D\u7F6E");
    if (!sortConfig || !sortConfig[command.key]) {
      throw createPlaylistScriptError("\u6392\u5E8F\u914D\u7F6E\u65E0\u6548");
    }
    const selectedItems = plan.items.slice(start - 1, end);
    let orderedItems;
    if (command.key === "title") {
      orderedItems = stableSort(selectedItems, createTitleComparator(sortConfig.title));
    } else if (command.key === "date") {
      orderedItems = stableSort(
        selectedItems,
        cmpByDate(sortConfig.date.descending, sortConfig.date)
      );
    } else if (command.key === "artist") {
      orderedItems = sortSongsByArtist(
        selectedItems,
        sortConfig.artist,
        sortConfig.title,
        sortConfig.date
      );
    } else if (command.key === "heat") {
      orderedItems = sortSongsByHeat(selectedItems, sortConfig.heat);
    } else if (command.key === "random") {
      orderedItems = shuffleItems(selectedItems, sortConfig.randomFn);
    } else {
      throw createPlaylistScriptError(`\u4E0D\u652F\u6301\u7684\u6392\u5E8F\u7C7B\u578B\uFF1A${command.key}`);
    }
    const nextItems = [
      ...plan.items.slice(0, start - 1),
      ...orderedItems,
      ...plan.items.slice(end)
    ];
    return createSongPlan(nextItems.map((item) => item.id), nextItems);
  }
  async function resolveCommand(command, { fetchAlbum, sortConfig, sortItems } = {}) {
    if (!command || typeof command !== "object") {
      throw createPlaylistScriptError("\u547D\u4EE4\u5FC5\u987B\u662F\u5BF9\u8C61");
    }
    if (command.type === "clear") {
      return { type: "clear", command };
    }
    if (["remove", "move", "swap"].includes(command.type)) {
      return { type: command.type, command };
    }
    if (command.type === "sort") {
      const resolvedSortConfig = command.key === "random" ? { random: true, randomFn: sortConfig?.randomFn || Math.random } : sortConfig;
      if (!resolvedSortConfig) throw createPlaylistScriptError("\u6392\u5E8F\u914D\u7F6E\u65E0\u6548", command.line);
      return { type: "sort", command, sortConfig: resolvedSortConfig, items: sortItems };
    }
    const id = normalizePlaylistId(command.id);
    if (!id) throw createPlaylistScriptError("ID \u5FC5\u987B\u662F\u6B63\u6574\u6570", command.line);
    if (command.type === "song") {
      const item = { id };
      return {
        type: "insert",
        command: { ...command, id },
        songIds: [id],
        items: [item],
        blocks: [createSongBlock(id, command.line, item)]
      };
    }
    if (command.type !== "album") {
      throw createPlaylistScriptError(`\u4E0D\u652F\u6301\u7684\u6267\u884C\u547D\u4EE4\uFF1A${command.type}`, command.line);
    }
    if (typeof fetchAlbum !== "function") {
      throw createPlaylistScriptError(`\u65E0\u6CD5\u8BFB\u53D6\u4E13\u8F91 ${id}`, command.line);
    }
    let response;
    try {
      response = await fetchAlbum(id);
    } catch (error) {
      throw createPlaylistScriptError(`\u83B7\u53D6\u4E13\u8F91 ${id} \u5931\u8D25\uFF1A${error?.message || String(error)}`, command.line);
    }
    const songs = getAlbumSongs(response);
    if (!songs) {
      throw createPlaylistScriptError(`\u65E0\u6CD5\u83B7\u53D6\u4E13\u8F91 ${id} \u7684\u66F2\u76EE`, command.line);
    }
    if (!songs.length) {
      throw createPlaylistScriptError(`\u4E13\u8F91 ${id} \u6CA1\u6709\u53EF\u7528\u6B4C\u66F2`, command.line);
    }
    const songIds = songs.map((song) => normalizePlaylistId(song?.id));
    if (songIds.some((songId) => !songId)) {
      throw createPlaylistScriptError(`\u4E13\u8F91 ${id} \u7684\u66F2\u76EE\u6570\u636E\u4E0D\u5B8C\u6574\uFF0C\u65E0\u6CD5\u5B89\u5168\u5C55\u5F00`, command.line);
    }
    const items = songs.map((song) => toSongItem(song));
    return {
      type: "insert",
      command: { ...command, id },
      songIds,
      items,
      blocks: [{
        ...command,
        id,
        songIds,
        items,
        albumName: response.album?.name || "",
        albumArtist: response.album?.artist?.name || response.album?.artists?.map((artist) => artist.name).join("/") || ""
      }]
    };
  }
  function applyCommand(plan, resolvedCommand, {
    position = null,
    selectedIndex = null,
    selectedSongId = null
  } = {}) {
    if (!plan || !Array.isArray(plan.songIds)) {
      throw createPlaylistScriptError("\u6267\u884C\u65B9\u6848\u65E0\u6548");
    }
    if (!resolvedCommand || typeof resolvedCommand !== "object") {
      throw createPlaylistScriptError("\u5DF2\u89E3\u6790\u547D\u4EE4\u65E0\u6548");
    }
    if (resolvedCommand.type === "clear") return { ...createSongPlan([]), selectedIndex: null };
    const currentSelectedId = selectedSongId == null && Number.isInteger(selectedIndex) && selectedIndex >= 0 ? plan.songIds[selectedIndex] : selectedSongId == null ? null : String(selectedSongId);
    const findSelectedIndex = (nextIds2, fallbackIndex = null) => resolveSelectionAfterTransform(
      nextIds2,
      currentSelectedId,
      fallbackIndex
    );
    if (resolvedCommand.type === "remove") {
      const { start, end } = resolvedCommand.command;
      const nextIds2 = removeSongRange(plan.songIds, start, end);
      const nextPlan2 = createSongPlan(nextIds2, plan.items.filter((_, index) => index < start - 1 || index >= end));
      return { ...nextPlan2, selectedIndex: findSelectedIndex(nextIds2, start - 1) };
    }
    if (resolvedCommand.type === "move") {
      const { start, end, target } = resolvedCommand.command;
      const movedId = plan.songIds[start - 1];
      const nextIds2 = moveSongRange(plan.songIds, start, end, target);
      const itemMap = new Map(plan.items.map((item) => [String(item.id), item]));
      const nextPlan2 = createSongPlan(nextIds2, nextIds2.map((id) => itemMap.get(String(id)) || { id }));
      return { ...nextPlan2, selectedIndex: nextIds2.indexOf(String(movedId)) };
    }
    if (resolvedCommand.type === "swap") {
      const { positionA, positionB } = resolvedCommand.command;
      const nextIds2 = swapSongPositions(plan.songIds, positionA, positionB);
      const itemMap = new Map(plan.items.map((item) => [String(item.id), item]));
      const nextPlan2 = createSongPlan(nextIds2, nextIds2.map((id) => itemMap.get(String(id)) || { id }));
      return { ...nextPlan2, selectedIndex: findSelectedIndex(nextIds2) };
    }
    if (resolvedCommand.type === "sort") {
      const sortPlan = resolvedCommand.items ? createSongPlan(plan.songIds, resolvedCommand.items) : plan;
      const nextPlan2 = sortSongRange(sortPlan, resolvedCommand.command, resolvedCommand.sortConfig);
      return { ...nextPlan2, selectedIndex: findSelectedIndex(nextPlan2.songIds) };
    }
    if (resolvedCommand.type !== "insert") {
      throw createPlaylistScriptError("\u5DF2\u89E3\u6790\u547D\u4EE4\u4E0D\u662F\u53EF\u6267\u884C\u547D\u4EE4");
    }
    const insertAt = position ?? (Number.isInteger(selectedIndex) && selectedIndex >= 0 ? selectedIndex + 1 : plan.songIds.length);
    validateCommandPosition({ position: insertAt }, plan.songIds.length);
    const nextIds = insertSongIds(plan.songIds, resolvedCommand.songIds, insertAt);
    assertUniqueSongIds(nextIds);
    const existingItems = new Map((plan.items || []).map((item) => [String(item.id), item]));
    const insertedItems = new Map((resolvedCommand.items || []).map((item) => [String(item.id), item]));
    const items = nextIds.map((id) => insertedItems.get(id) || existingItems.get(id) || { id });
    const nextPlan = createSongPlan(nextIds, items);
    return {
      ...nextPlan,
      insertedRange: {
        start: insertAt,
        end: insertAt + resolvedCommand.songIds.length - 1
      },
      selectedIndex: insertAt + resolvedCommand.songIds.length - 1
    };
  }
  async function resolvePlaylistCommands(commands, { fetchAlbum } = {}) {
    if (!Array.isArray(commands)) {
      throw createPlaylistScriptError("\u547D\u4EE4\u5217\u8868\u5FC5\u987B\u662F\u6570\u7EC4");
    }
    const songIds = [];
    const blocks = [];
    const items = [];
    for (const command of commands) {
      const resolved = await resolveCommand(command, { fetchAlbum });
      if (resolved.type === "clear") {
        songIds.length = 0;
        blocks.length = 0;
        items.length = 0;
        continue;
      }
      songIds.push(...resolved.songIds);
      blocks.push(...resolved.blocks);
      items.push(...resolved.items);
    }
    assertUniqueSongIds(songIds);
    return { songIds, blocks, items };
  }
  function getPlaylistScriptDiff(currentIds, targetIds) {
    const current = currentIds.map((id) => String(id));
    const target = targetIds.map((id) => String(id));
    const currentSet = new Set(current);
    const targetSet = new Set(target);
    const addedIds = target.filter((id) => !currentSet.has(id));
    const removedIds = current.filter((id) => !targetSet.has(id));
    const currentCommon = current.filter((id) => targetSet.has(id));
    const targetCommon = target.filter((id) => currentSet.has(id));
    return {
      addedIds,
      removedIds,
      changedOrder: !sameSongOrder(currentCommon, targetCommon)
    };
  }
  function sameSongOrder(left, right) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((id, index) => String(id) === String(right[index]));
  }
  function getPlaylistScriptState(currentSongIds, savedScript) {
    if (!savedScript) {
      return {
        hasSavedScript: false,
        currentChanged: false,
        localChanged: false,
        conflicted: false
      };
    }
    const appliedSongIds = Array.isArray(savedScript.appliedSongIds) ? savedScript.appliedSongIds : [];
    const appliedScriptText = typeof savedScript.appliedScriptText === "string" ? savedScript.appliedScriptText : "";
    const currentChanged = !sameSongOrder(currentSongIds, appliedSongIds);
    const localChanged = savedScript.scriptText !== appliedScriptText;
    return {
      hasSavedScript: true,
      currentChanged,
      localChanged,
      conflicted: currentChanged && localChanged
    };
  }

  // src/ui/dialogs.js
  function getVisibleTextCategories(categoryIds) {
    const requestedIds = Array.isArray(categoryIds) ? new Set(categoryIds) : new Set(TITLE_CATEGORIES.map((category) => category.id));
    const categories = TITLE_CATEGORIES.filter((category) => requestedIds.has(category.id));
    return categories.length ? categories : [TITLE_CATEGORIES.find((category) => category.id === "other")];
  }
  function orderTitleCategories(categories, savedOrder) {
    const visibleIds = new Set(categories.map((category) => category.id));
    const ordered = [];
    for (const categoryId of savedOrder) {
      const category = categories.find((item) => item.id === categoryId);
      if (visibleIds.has(categoryId) && category && !ordered.includes(category)) {
        ordered.push(category);
      }
    }
    for (const category of categories) {
      if (!ordered.includes(category)) ordered.push(category);
    }
    return ordered;
  }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function createDragHandle() {
    return `
    <span
      class="ncm-sort-drag-handle"
      role="button"
      tabindex="0"
      title="\u62D6\u52A8\u8C03\u6574\u987A\u5E8F"
      aria-label="\u62D6\u52A8\u8C03\u6574\u987A\u5E8F"
    >\u22EE\u22EE</span>
  `;
  }
  function createTitleCategoryList(categories) {
    return categories.map((category, index) => `
    <li class="ncm-sort-priority-item" data-category="${category.id}">
      <span class="ncm-sort-priority-name">
        <span class="ncm-sort-priority-index">${index + 1}</span>
        ${category.label}
      </span>
      <span class="ncm-sort-priority-actions">
        ${createDragHandle()}
      </span>
    </li>
  `).join("");
  }
  function createManualSongList(items) {
    return items.map((item, index) => `
    <li class="ncm-sort-priority-item ncm-sort-song-item" data-song-id="${escapeHtml(item.id)}">
      <span class="ncm-sort-priority-name ncm-sort-song-name">
        <span class="ncm-sort-priority-index">${index + 1}</span>
        <span class="ncm-sort-song-details">
          <span class="ncm-sort-song-title">${escapeHtml(item.title || "\u672A\u547D\u540D\u6B4C\u66F2")}</span>
          <span class="ncm-sort-song-meta">${escapeHtml(item.artist || "\u672A\u77E5\u6B4C\u624B")}${item.album ? ` \xB7 ${escapeHtml(item.album)}` : ""}</span>
        </span>
      </span>
      <span class="ncm-sort-priority-actions">
        ${createDragHandle()}
      </span>
    </li>
  `).join("");
  }
  function readTextSortConfig(prefix, fallbackCategoryOrder = []) {
    const list = document.getElementById(`${prefix}-priority-list`);
    const directStringCompare = document.getElementById(`${prefix}-direct-compare`).checked;
    const chineseSort = document.getElementById(`${prefix}-chinese-sort`).value;
    const visibleOrder = [...list.querySelectorAll("[data-category]")].map((item) => item.dataset.category);
    const visibleIds = new Set(visibleOrder);
    const hiddenOrder = fallbackCategoryOrder.filter((categoryId) => !visibleIds.has(categoryId));
    return {
      directStringCompare,
      categoryOrder: [...visibleOrder, ...hiddenOrder],
      chineseSort
    };
  }
  function readTitleSortConfig(savedConfig) {
    return readTextSortConfig("title", savedConfig.categoryOrder);
  }
  function refreshPriorityIndexes(list) {
    [...list.querySelectorAll(".ncm-sort-priority-item")].forEach((item, index) => {
      item.querySelector(".ncm-sort-priority-index").textContent = index + 1;
    });
  }
  function movePriorityItem(list, item, direction) {
    const sibling = direction === "up" ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) return;
    if (direction === "up") {
      list.insertBefore(item, sibling);
    } else {
      list.insertBefore(sibling, item);
    }
    refreshPriorityIndexes(list);
    item.querySelector(".ncm-sort-drag-handle").focus();
  }
  function bindSortableList(list) {
    const dragThreshold = 5;
    let pendingDrag = null;
    let draggedItem = null;
    let dropPlaceholder = null;
    let dragFrame = 0;
    let latestDragPosition = null;
    let originalNextSibling = null;
    const cancelDragFrame = () => {
      if (!dragFrame) return;
      cancelAnimationFrame(dragFrame);
      dragFrame = 0;
    };
    const scheduleDragFrame = () => {
      if (!dragFrame) {
        dragFrame = requestAnimationFrame(updateDropPlaceholder);
      }
    };
    const updateDropPlaceholder = () => {
      dragFrame = 0;
      if (!draggedItem || !dropPlaceholder || !latestDragPosition) return;
      const { clientX, clientY } = latestDragPosition;
      const scrollContainer = list.closest(".ncm-sort-scroll-container");
      let didScroll = false;
      if (scrollContainer) {
        const rect = scrollContainer.getBoundingClientRect();
        const edgeSize = 44;
        const previousScrollTop = scrollContainer.scrollTop;
        if (clientY < rect.top + edgeSize) {
          scrollContainer.scrollTop -= 14;
        } else if (clientY > rect.bottom - edgeSize) {
          scrollContainer.scrollTop += 14;
        }
        didScroll = scrollContainer.scrollTop !== previousScrollTop;
      }
      const target = document.elementFromPoint(clientX, clientY)?.closest(".ncm-sort-priority-item");
      if (target?.parentElement === list) {
        const rect = target.getBoundingClientRect();
        const insertBefore = clientY < rect.top + rect.height / 2;
        if (insertBefore) {
          if (dropPlaceholder.nextElementSibling !== target) {
            list.insertBefore(dropPlaceholder, target);
          }
        } else if (target.nextElementSibling !== dropPlaceholder) {
          list.insertBefore(dropPlaceholder, target.nextSibling);
        }
      } else {
        const listRect = list.getBoundingClientRect();
        if (clientY <= listRect.top) {
          list.prepend(dropPlaceholder);
        } else if (clientY >= listRect.bottom) {
          list.append(dropPlaceholder);
        }
      }
      if (didScroll) {
        scheduleDragFrame();
      }
    };
    const startDrag = (item) => {
      draggedItem = item;
      originalNextSibling = item.nextElementSibling;
      dropPlaceholder = document.createElement("li");
      dropPlaceholder.className = "ncm-sort-drag-placeholder";
      dropPlaceholder.setAttribute("aria-hidden", "true");
      dropPlaceholder.style.height = `${item.getBoundingClientRect().height}px`;
      list.insertBefore(dropPlaceholder, item);
      item.classList.add("is-dragging", "is-drag-source-hidden");
      document.body.classList.add("ncm-sort-is-pointer-dragging");
    };
    const removePointerListeners = () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      window.removeEventListener("blur", handlePointerCancel);
      window.removeEventListener("keydown", handleDragKeydown, true);
    };
    const finishDrag = (commit) => {
      if (commit && dragFrame) {
        cancelDragFrame();
        updateDropPlaceholder();
      }
      cancelDragFrame();
      latestDragPosition = null;
      if (draggedItem && dropPlaceholder?.parentElement === list) {
        if (commit) {
          list.insertBefore(draggedItem, dropPlaceholder);
        } else if (originalNextSibling?.parentElement === list) {
          list.insertBefore(draggedItem, originalNextSibling);
        } else {
          list.append(draggedItem);
        }
        dropPlaceholder.remove();
        draggedItem.classList.remove("is-dragging", "is-drag-source-hidden");
        refreshPriorityIndexes(list);
      }
      document.body.classList.remove("ncm-sort-is-pointer-dragging");
      pendingDrag = null;
      draggedItem = null;
      dropPlaceholder = null;
      originalNextSibling = null;
      removePointerListeners();
    };
    function handlePointerMove(event) {
      if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;
      if (!draggedItem) {
        const distance = Math.hypot(
          event.clientX - pendingDrag.startX,
          event.clientY - pendingDrag.startY
        );
        if (distance < dragThreshold) return;
        startDrag(pendingDrag.item);
      }
      event.preventDefault();
      latestDragPosition = {
        clientX: event.clientX,
        clientY: event.clientY
      };
      scheduleDragFrame();
    }
    function handlePointerUp(event) {
      if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;
      finishDrag(Boolean(draggedItem));
    }
    function handlePointerCancel(event) {
      if (event?.pointerId != null && pendingDrag && event.pointerId !== pendingDrag.pointerId) return;
      finishDrag(false);
    }
    function handleDragKeydown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finishDrag(false);
    }
    list.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      if (list.closest("fieldset")?.disabled) return;
      const item = event.target.closest(".ncm-sort-priority-item");
      if (!item || item.parentElement !== list) return;
      if (event.pointerType !== "mouse" && !event.target.closest(".ncm-sort-drag-handle")) return;
      event.preventDefault();
      event.target.closest(".ncm-sort-drag-handle")?.focus({ preventScroll: true });
      pendingDrag = {
        item,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY
      };
      window.addEventListener("pointermove", handlePointerMove, { capture: true, passive: false });
      window.addEventListener("pointerup", handlePointerUp, true);
      window.addEventListener("pointercancel", handlePointerCancel, true);
      window.addEventListener("blur", handlePointerCancel);
      window.addEventListener("keydown", handleDragKeydown, true);
    });
    list.addEventListener("keydown", (event) => {
      const handle = event.target.closest(".ncm-sort-drag-handle");
      if (!handle) return;
      if (list.closest("fieldset")?.disabled) return;
      const item = handle.closest(".ncm-sort-priority-item");
      if (event.key === "ArrowUp") {
        event.preventDefault();
        movePriorityItem(list, item, "up");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        movePriorityItem(list, item, "down");
      }
    });
  }
  function readManualSongOrder() {
    return [...document.querySelectorAll("#manual-song-list [data-song-id]")].map((item) => item.dataset.songId);
  }
  function setPriorityDisabled(disabled, prefix = "title") {
    const fieldset = document.getElementById(`${prefix}-category-priority`);
    fieldset.disabled = disabled;
    fieldset.classList.toggle("is-disabled", disabled);
    fieldset.querySelectorAll(".ncm-sort-priority-item").forEach((item) => {
      item.querySelector(".ncm-sort-drag-handle")?.setAttribute("aria-disabled", String(disabled));
    });
  }
  function readDateSortConfig(prefix = "date") {
    const selectedOrder = document.querySelector(`[data-${prefix}-order].is-selected`);
    return {
      descending: selectedOrder?.dataset.descending !== "false",
      sortAlbumsByName: document.getElementById(`${prefix}-sort-albums`).checked,
      sortAlbumTracks: document.getElementById(`${prefix}-sort-tracks`).checked
    };
  }
  function readHeatSortConfig() {
    const selected = document.querySelector("[data-heat-sort].is-selected");
    return {
      metric: selected?.dataset.metric || HEAT_SORT_METRICS[0].id,
      descending: selected?.dataset.descending !== "false"
    };
  }
  function setDateTrackSortDisabled(disabled, prefix = "date") {
    const input = document.getElementById(`${prefix}-sort-tracks`);
    const row = document.getElementById(`${prefix}-sort-tracks-row`);
    input.disabled = disabled;
    if (disabled) input.checked = false;
    row.classList.toggle("is-disabled", disabled);
  }
  function readArtistSortConfig(textCategoryOrder) {
    return {
      sortArtistsByName: document.getElementById("artist-sort-name").checked,
      sortSameArtistByDate: document.getElementById("artist-sort-date").checked,
      textSortConfig: readTextSortConfig("artist", textCategoryOrder),
      dateSortConfig: readDateSortConfig("artist-date")
    };
  }
  async function showTitleSortDialog(categoryIds) {
    const savedConfig = await loadTitleSortConfig();
    const visibleCategories = getVisibleTextCategories(categoryIds);
    const categories = orderTitleCategories(visibleCategories, savedConfig.categoryOrder);
    const categoryNames = categories.map((category) => category.label).join("\u3001");
    return Swal.fire({
      title: "\u6309\u6807\u9898\u6392\u5E8F",
      html: `
      <div class="ncm-sort-title-settings">
        <div class="ncm-sort-intro">
          <p>\u9009\u62E9\u6807\u9898\u6392\u5E8F\u65B9\u5F0F</p>
          <p class="ncm-sort-help">\u4ECE\u5DE6\u5230\u53F3\u9010\u4E2A\u5B57\u7B26\u6BD4\u8F83</p>
          <p class="ncm-sort-detected">\u5F53\u524D\u6807\u9898\uFF1A${categories.length} \u7C7B\uFF08${categoryNames}\uFF09</p>
        </div>

        <label class="ncm-sort-switch-row">
          <input id="title-direct-compare" type="checkbox" ${savedConfig.directStringCompare ? "checked" : ""}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">\u4F7F\u7528\u76F4\u63A5\u5B57\u7B26\u4E32\u6BD4\u8F83</span>
            <span class="ncm-sort-switch-help">\u5F00\u542F\u540E\u4E0D\u4F7F\u7528\u4E0B\u9762\u7684\u5B57\u7B26\u7C7B\u522B\u4F18\u5148\u7EA7\u3002</span>
          </span>
        </label>

        <fieldset id="title-category-priority" class="ncm-sort-priority-panel">
          <legend>\u6587\u5B57\u4F53\u7CFB\u4F18\u5148\u7EA7</legend>
          <ol id="title-priority-list" class="ncm-sort-priority-list">
            ${createTitleCategoryList(categories)}
          </ol>
          <label class="ncm-sort-select-row">
            <span class="ncm-sort-label">\u6C49\u5B57\u6392\u5E8F\u65B9\u5F0F\uFF1A</span>
            <select id="title-chinese-sort" class="ncm-sort-select">
              ${TITLE_CHINESE_SORTS.map((sort) => `
                <option value="${sort.id}" ${sort.id === savedConfig.chineseSort ? "selected" : ""}>
                  ${sort.label}
                </option>
              `).join("")}
            </select>
          </label>
        </fieldset>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: "\u5F00\u59CB\u6392\u5E8F",
      cancelButtonText: "\u53D6\u6D88",
      focusConfirm: false,
      customClass: swalClasses,
      didOpen: () => {
        const directCompare = document.getElementById("title-direct-compare");
        const list = document.querySelector(".ncm-sort-priority-list");
        directCompare.addEventListener("change", () => {
          setPriorityDisabled(directCompare.checked);
        });
        bindSortableList(list);
        setPriorityDisabled(directCompare.checked);
      },
      preConfirm: () => readTitleSortConfig(savedConfig)
    });
  }
  function showManualSortDialog(items) {
    return Swal.fire({
      title: "\u624B\u52A8\u6392\u5E8F",
      html: `
      <div class="ncm-sort-intro">
        <p>\u62D6\u52A8\u6B4C\u66F2\u8C03\u6574\u6B4C\u5355\u987A\u5E8F</p>
        <p class="ncm-sort-detected">\u5171 ${items.length} \u9996\u6B4C\u66F2</p>
      </div>
      <div class="ncm-sort-scroll-container">
        <ol id="manual-song-list" class="ncm-sort-priority-list ncm-sort-song-list">
          ${createManualSongList(items)}
        </ol>
      </div>
    `,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: "\u4FDD\u5B58\u6392\u5E8F",
      cancelButtonText: "\u53D6\u6D88",
      focusConfirm: false,
      customClass: {
        ...swalClasses,
        popup: "ncm-sort-popup ncm-sort-manual-popup"
      },
      didOpen: () => {
        bindSortableList(document.getElementById("manual-song-list"));
      },
      preConfirm: () => ({
        orderedSongIds: readManualSongOrder()
      })
    });
  }
  async function showDateSortDialog() {
    const savedConfig = await loadDateSortSettings();
    return Swal.fire({
      title: "\u6309\u53D1\u884C\u65E5\u671F\u6392\u5E8F",
      html: `
      <div class="ncm-sort-intro">
        <p>\u9009\u62E9\u53D1\u884C\u65E5\u671F\u6392\u5E8F\u65B9\u5F0F</p>
      </div>
      <div class="ncm-sort-date-order">
        <div class="ncm-sort-choice-list">
          <button type="button" class="ncm-sort-choice-button ${savedConfig.descending ? "is-selected" : ""}" data-date-order data-descending="true" aria-pressed="${savedConfig.descending}">\u4ECE\u65B0\u5230\u65E7\uFF08\u5012\u5E8F\uFF09</button>
          <button type="button" class="ncm-sort-choice-button ${savedConfig.descending ? "" : "is-selected"}" data-date-order data-descending="false" aria-pressed="${!savedConfig.descending}">\u4ECE\u65E7\u5230\u65B0\uFF08\u987A\u5E8F\uFF09</button>
        </div>
      </div>
      <div class="ncm-sort-date-settings">
        <label class="ncm-sort-switch-row">
          <input id="date-sort-albums" type="checkbox" ${savedConfig.sortAlbumsByName ? "checked" : ""}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">\u4E0D\u540C\u4E13\u8F91\u6309\u4E13\u8F91\u540D\u79F0\u6392\u5E8F</span>
            <span class="ncm-sort-switch-help">\u5C06\u540C\u4E00\u53D1\u884C\u65E5\u671F\u4E0B\u7684\u6B4C\u66F2\u6309\u4E13\u8F91\u540D\u79F0\u805A\u62E2\u3002</span>
          </span>
        </label>
        <label id="date-sort-tracks-row" class="ncm-sort-switch-row ${savedConfig.sortAlbumsByName ? "" : "is-disabled"}">
          <input id="date-sort-tracks" type="checkbox" ${savedConfig.sortAlbumTracks ? "checked" : ""} ${savedConfig.sortAlbumsByName ? "" : "disabled"}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">\u540C\u4E00\u4E13\u8F91\u6309\u4E13\u8F91\u5185\u6B4C\u66F2\u987A\u5E8F\u6392\u5E8F</span>
            <span class="ncm-sort-switch-help">\u9700\u8981\u5148\u5F00\u542F\u4E0A\u9762\u7684\u4E13\u8F91\u540D\u79F0\u6392\u5E8F\u3002</span>
          </span>
        </label>
      </div>
    `,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: "\u5F00\u59CB\u6392\u5E8F",
      cancelButtonText: "\u53D6\u6D88",
      customClass: swalClasses,
      didOpen: () => {
        const orderButtons = [...document.querySelectorAll("[data-date-order]")];
        const albumSort = document.getElementById("date-sort-albums");
        orderButtons.forEach((button) => {
          button.addEventListener("click", () => {
            orderButtons.forEach((item) => {
              const selected = item === button;
              item.classList.toggle("is-selected", selected);
              item.setAttribute("aria-pressed", String(selected));
            });
          });
        });
        albumSort.addEventListener("change", () => {
          setDateTrackSortDisabled(!albumSort.checked);
        });
        setDateTrackSortDisabled(!albumSort.checked);
      },
      preConfirm: () => readDateSortConfig()
    });
  }
  async function showArtistSortDialog(categoryIds, savedSettings) {
    const artistConfig = savedSettings || await loadArtistSortSettings();
    const textConfig = await loadTitleSortConfig();
    const dateConfig = await loadDateSortSettings();
    const visibleCategories = getVisibleTextCategories(categoryIds);
    const categories = orderTitleCategories(visibleCategories, textConfig.categoryOrder);
    const categoryNames = categories.map((category) => category.label).join("\u3001");
    return Swal.fire({
      title: "\u6309\u6B4C\u624B\u6392\u5E8F",
      html: `
      <div class="ncm-sort-intro">
        <p>\u9009\u62E9\u6B4C\u624B\u6392\u5E8F\u65B9\u5F0F</p>
        <p class="ncm-sort-help">\u4ECE\u5DE6\u5230\u53F3\u9010\u4E2A\u5B57\u7B26\u6BD4\u8F83</p>
        <p class="ncm-sort-detected">\u5F53\u524D\u6B4C\u624B\u540D\u79F0\uFF1A${categories.length} \u7C7B\uFF08${categoryNames}\uFF09</p>
      </div>
      <div id="artist-text-settings" class="ncm-sort-priority-panel">
        <label class="ncm-sort-switch-row">
          <input id="artist-direct-compare" type="checkbox" ${textConfig.directStringCompare ? "checked" : ""}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">\u4F7F\u7528\u76F4\u63A5\u5B57\u7B26\u4E32\u6BD4\u8F83</span>
            <span class="ncm-sort-switch-help">\u5F00\u542F\u540E\u4E0D\u4F7F\u7528\u4E0B\u9762\u7684\u6587\u5B57\u4F53\u7CFB\u4F18\u5148\u7EA7\u3002</span>
          </span>
        </label>
        <fieldset id="artist-category-priority" class="ncm-sort-priority-panel">
          <legend>\u6587\u5B57\u4F53\u7CFB\u4F18\u5148\u7EA7</legend>
          <ol id="artist-priority-list" class="ncm-sort-priority-list">
            ${createTitleCategoryList(categories)}
          </ol>
          <label class="ncm-sort-select-row">
            <span class="ncm-sort-label">\u6C49\u5B57\u6392\u5E8F\u65B9\u5F0F\uFF1A</span>
            <select id="artist-chinese-sort" class="ncm-sort-select">
              ${TITLE_CHINESE_SORTS.map((sort) => `
                <option value="${sort.id}" ${sort.id === textConfig.chineseSort ? "selected" : ""}>
                  ${sort.label}
                </option>
              `).join("")}
            </select>
          </label>
        </fieldset>
      </div>
      <div class="ncm-sort-date-settings">
        <label class="ncm-sort-switch-row">
          <input id="artist-sort-name" type="checkbox" ${artistConfig.sortArtistsByName ? "checked" : ""}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">\u6309\u6B4C\u624B\u540D\u79F0\u6392\u5E8F</span>
            <span class="ncm-sort-switch-help">\u5173\u95ED\u540E\u6B4C\u624B\u5206\u7EC4\u6309\u7167\u539F\u6B4C\u5355\u4E2D\u9996\u6B21\u51FA\u73B0\u7684\u987A\u5E8F\u6392\u5217\u3002</span>
          </span>
        </label>
        <label class="ncm-sort-switch-row">
          <input id="artist-sort-date" type="checkbox" ${artistConfig.sortSameArtistByDate ? "checked" : ""}>
          <span class="ncm-sort-switch" aria-hidden="true"></span>
          <span>
            <span class="ncm-sort-switch-label">\u540C\u4E00\u6B4C\u624B\u6309\u53D1\u884C\u65F6\u95F4\u6392\u5E8F</span>
            <span class="ncm-sort-switch-help">\u5173\u95ED\u540E\u4FDD\u6301\u540C\u4E00\u6B4C\u624B\u7684\u539F\u6B4C\u5355\u76F8\u5BF9\u987A\u5E8F\u3002</span>
          </span>
        </label>
      </div>
      <div id="artist-date-settings" class="ncm-sort-conditional ${artistConfig.sortSameArtistByDate ? "" : "is-hidden"}">
        <div class="ncm-sort-date-order">
          <p class="ncm-sort-help">\u540C\u4E00\u6B4C\u624B\u5185\u6309\u53D1\u884C\u65E5\u671F\u6392\u5E8F\u65F6\uFF0C\u4F7F\u7528\u4E0B\u9762\u7684\u53D1\u884C\u65E5\u671F\u89C4\u5219</p>
          <div class="ncm-sort-choice-list">
            <button type="button" class="ncm-sort-choice-button ${dateConfig.descending ? "is-selected" : ""}" data-artist-date-order data-descending="true" aria-pressed="${dateConfig.descending}">\u4ECE\u65B0\u5230\u65E7\uFF08\u5012\u5E8F\uFF09</button>
            <button type="button" class="ncm-sort-choice-button ${dateConfig.descending ? "" : "is-selected"}" data-artist-date-order data-descending="false" aria-pressed="${!dateConfig.descending}">\u4ECE\u65E7\u5230\u65B0\uFF08\u987A\u5E8F\uFF09</button>
          </div>
        </div>
        <div class="ncm-sort-date-settings">
          <label class="ncm-sort-switch-row">
            <input id="artist-date-sort-albums" type="checkbox" ${dateConfig.sortAlbumsByName ? "checked" : ""}>
            <span class="ncm-sort-switch" aria-hidden="true"></span>
            <span>
              <span class="ncm-sort-switch-label">\u4E0D\u540C\u4E13\u8F91\u6309\u4E13\u8F91\u540D\u79F0\u6392\u5E8F</span>
              <span class="ncm-sort-switch-help">\u5C06\u540C\u4E00\u53D1\u884C\u65E5\u671F\u4E0B\u7684\u6B4C\u66F2\u6309\u4E13\u8F91\u540D\u79F0\u805A\u62E2\u3002</span>
            </span>
          </label>
          <label id="artist-date-sort-tracks-row" class="ncm-sort-switch-row ${dateConfig.sortAlbumsByName ? "" : "is-disabled"}">
            <input id="artist-date-sort-tracks" type="checkbox" ${dateConfig.sortAlbumTracks ? "checked" : ""} ${dateConfig.sortAlbumsByName ? "" : "disabled"}>
            <span class="ncm-sort-switch" aria-hidden="true"></span>
            <span>
              <span class="ncm-sort-switch-label">\u540C\u4E00\u4E13\u8F91\u6309\u4E13\u8F91\u5185\u6B4C\u66F2\u987A\u5E8F\u6392\u5E8F</span>
              <span class="ncm-sort-switch-help">\u9700\u8981\u5148\u5F00\u542F\u4E0A\u9762\u7684\u4E13\u8F91\u540D\u79F0\u6392\u5E8F\u3002</span>
            </span>
          </label>
        </div>
      </div>
    `,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: "\u5F00\u59CB\u6392\u5E8F",
      cancelButtonText: "\u53D6\u6D88",
      customClass: swalClasses,
      didOpen: () => {
        const directCompare = document.getElementById("artist-direct-compare");
        const list = document.getElementById("artist-priority-list");
        const orderButtons = [...document.querySelectorAll("[data-artist-date-order]")];
        const albumSort = document.getElementById("artist-date-sort-albums");
        const sameArtistDate = document.getElementById("artist-sort-date");
        const artistDateSettings = document.getElementById("artist-date-settings");
        directCompare.addEventListener("change", () => {
          setPriorityDisabled(directCompare.checked, "artist");
        });
        bindSortableList(list);
        orderButtons.forEach((button) => {
          button.addEventListener("click", () => {
            orderButtons.forEach((item) => {
              const selected = item === button;
              item.classList.toggle("is-selected", selected);
              item.setAttribute("aria-pressed", String(selected));
            });
          });
        });
        albumSort.addEventListener("change", () => {
          setDateTrackSortDisabled(!albumSort.checked, "artist-date");
        });
        sameArtistDate.addEventListener("change", () => {
          artistDateSettings.classList.toggle("is-hidden", !sameArtistDate.checked);
        });
        setPriorityDisabled(directCompare.checked, "artist");
        setDateTrackSortDisabled(!albumSort.checked, "artist-date");
      },
      preConfirm: () => readArtistSortConfig(textConfig.categoryOrder)
    });
  }
  function showHeatSortDialog(savedConfig) {
    const config = normalizeHeatSortConfig(savedConfig);
    const options = HEAT_SORT_METRICS.flatMap((metric) => [
      {
        metric: metric.id,
        descending: true,
        label: `${metric.label}\uFF1A${metric.id === "commentCount" ? "\u591A\u5230\u5C11" : "\u9AD8\u5230\u4F4E"}`
      },
      {
        metric: metric.id,
        descending: false,
        label: `${metric.label}\uFF1A${metric.id === "commentCount" ? "\u5C11\u5230\u591A" : "\u4F4E\u5230\u9AD8"}`
      }
    ]);
    return Swal.fire({
      title: "\u6309\u70ED\u5EA6\u6392\u5E8F",
      html: `
      <div class="ncm-sort-intro">
        <p>\u9009\u62E9\u70ED\u5EA6\u6307\u6807\u548C\u6392\u5E8F\u65B9\u5411\uFF1A</p>
      </div>
      <div class="ncm-sort-choice-list">
        ${options.map((option) => {
        const selected = option.metric === config.metric && option.descending === config.descending;
        return `<button type="button" class="ncm-sort-choice-button ${selected ? "is-selected" : ""}" data-heat-sort data-metric="${option.metric}" data-descending="${option.descending}" aria-pressed="${selected}">${option.label}</button>`;
      }).join("")}
      </div>
    `,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: "\u5F00\u59CB\u6392\u5E8F",
      cancelButtonText: "\u53D6\u6D88",
      customClass: swalClasses,
      didOpen: () => {
        const buttons = [...document.querySelectorAll("[data-heat-sort]")];
        buttons.forEach((button) => {
          button.addEventListener("click", () => {
            buttons.forEach((item) => {
              const selected = item === button;
              item.classList.toggle("is-selected", selected);
              item.setAttribute("aria-pressed", String(selected));
            });
          });
        });
      },
      preConfirm: () => readHeatSortConfig()
    });
  }
  function showPlaylistScriptDialog(scriptText, {
    playlistName = "\u5F53\u524D\u6B4C\u5355",
    currentCount = 0,
    currentScript = scriptText,
    currentItems = [],
    resolveScript = null,
    resolveCommand: resolveCommand2 = null,
    resolveSongItems = null,
    warning = ""
  } = {}) {
    return Swal.fire({
      title: "\u6B4C\u5355\u7F16\u6392\u811A\u672C",
      html: `
      <div class="ncm-sort-script-editor">
        <div class="ncm-sort-intro">
          <p>${escapeHtml(playlistName)}</p>
          <p class="ncm-sort-detected">\u5F53\u524D\u6B4C\u5355\uFF1A${currentCount} \u9996\u6B4C\u66F2</p>
          ${warning ? `<p class="ncm-sort-script-warning">${escapeHtml(warning)}</p>` : ""}
        </div>
        <div id="playlist-script-live-summary" class="ncm-sort-script-live-summary"></div>
        <div class="ncm-sort-script-columns">
          <div class="ncm-sort-script-preview-panel">
            <div class="ncm-sort-script-scroll-wrap">
              <div id="playlist-script-live-preview" class="ncm-sort-script-live-preview"></div>
            </div>
          </div>
          <div class="ncm-sort-script-command-panel">
            <div class="ncm-sort-script-scroll-wrap">
              <div id="playlist-script-active-line" class="ncm-sort-script-active-line" aria-hidden="true"></div>
              <textarea id="playlist-script-editor" class="ncm-sort-script-textarea" spellcheck="false">${escapeHtml(scriptText)}</textarea>
            </div>
            <div class="ncm-sort-script-toolbar">
              <button id="playlist-script-reset" type="button" class="ncm-sort-script-tool-button">\u4ECE\u5F53\u524D\u6B4C\u5355\u91CD\u65B0\u751F\u6210</button>
              <button id="playlist-script-copy" type="button" class="ncm-sort-script-tool-button">\u590D\u5236\u811A\u672C</button>
            </div>
          </div>
        </div>
        <div class="ncm-sort-script-command-line">
          <div class="ncm-sort-script-panel-title">\u547D\u4EE4\u884C</div>
          <div class="ncm-sort-script-command-input-row">
            <input id="playlist-script-command-input" class="ncm-sort-script-command-input" type="text" spellcheck="false" autocomplete="off">
            <button id="playlist-script-command-append" type="button" class="ncm-sort-script-tool-button" title="\u6267\u884C\u547D\u4EE4" aria-label="\u6267\u884C\u547D\u4EE4">\u21B5</button>
          </div>
        </div>
      </div>
    `,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: "\u89E3\u6790\u9884\u89C8",
      cancelButtonText: "\u53D6\u6D88",
      focusConfirm: false,
      customClass: {
        ...swalClasses,
        popup: "ncm-sort-popup ncm-sort-script-popup"
      },
      didOpen: () => {
        const editor = document.getElementById("playlist-script-editor");
        const preview = document.getElementById("playlist-script-live-preview");
        const summary = document.getElementById("playlist-script-live-summary");
        const activeLine = document.getElementById("playlist-script-active-line");
        const commandInput = document.getElementById("playlist-script-command-input");
        const appendButton = document.getElementById("playlist-script-command-append");
        let updateTimer = 0;
        let updateSequence = 0;
        let isScrollSyncing = false;
        let selectedSourceLine = null;
        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
        const getPreviewRows = () => [...preview.querySelectorAll("[data-source-line]")];
        const getPreviewRowPosition = (row) => {
          const previewRect = preview.getBoundingClientRect();
          const rowRect = row.getBoundingClientRect();
          return {
            top: rowRect.top - previewRect.top + preview.scrollTop,
            height: rowRect.height
          };
        };
        const getEditorLineMetrics = () => {
          const styles = getComputedStyle(editor);
          const lineHeight = Number.parseFloat(styles.lineHeight) || 21.45;
          const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
          return { lineHeight, paddingTop };
        };
        const updateActiveLine = (row) => {
          if (!row) return;
          const { lineHeight, paddingTop } = getEditorLineMetrics();
          const lineNumber = Number(row.dataset.sourceLine);
          selectedSourceLine = lineNumber;
          activeLine.style.top = `${paddingTop + (lineNumber - 1) * lineHeight - editor.scrollTop}px`;
          activeLine.dataset.line = String(lineNumber);
          activeLine.dataset.order = row.dataset.songOrder;
          activeLine.style.display = "block";
        };
        const interpolateAnchors = (value, anchors, sourceKey, targetKey) => {
          if (anchors.length === 1) return anchors[0][targetKey];
          if (value <= anchors[0][sourceKey]) {
            return anchors[0][targetKey];
          }
          const last = anchors.length - 1;
          if (value >= anchors[last][sourceKey]) {
            return anchors[last][targetKey];
          }
          for (let index = 0; index < last; index += 1) {
            const start = anchors[index];
            const end = anchors[index + 1];
            if (value > end[sourceKey]) continue;
            const distance = end[sourceKey] - start[sourceKey];
            const fraction = distance > 0 ? (value - start[sourceKey]) / distance : 0;
            return start[targetKey] + fraction * (end[targetKey] - start[targetKey]);
          }
          return anchors[last][targetKey];
        };
        const syncScroll = (source, target) => {
          if (isScrollSyncing) return;
          const rows = getPreviewRows();
          if (!rows.length) {
            activeLine.style.display = "none";
            selectedSourceLine = null;
            return;
          }
          const { lineHeight, paddingTop } = getEditorLineMetrics();
          const previewAnchors = rows.map((row) => {
            const position = getPreviewRowPosition(row);
            return {
              position: position.top + position.height / 2,
              line: paddingTop + (Number(row.dataset.sourceLine) - 0.5) * lineHeight
            };
          });
          const editorAnchors = previewAnchors.map((anchor) => ({
            position: anchor.line,
            line: anchor.position
          }));
          const activeSourcePosition = source === preview ? source.scrollTop + source.clientHeight / 2 : source.scrollTop + source.clientHeight / 2;
          const activeAnchors = source === preview ? previewAnchors : editorAnchors;
          const activeIndex = activeAnchors.reduce((bestIndex, anchor, index) => {
            const bestDistance = Math.abs(activeAnchors[bestIndex].position - activeSourcePosition);
            const distance = Math.abs(anchor.position - activeSourcePosition);
            return distance < bestDistance ? index : bestIndex;
          }, 0);
          rows.forEach((row, index) => row.classList.toggle("is-selected", index === activeIndex));
          const activeLineNumber = Number(rows[activeIndex].dataset.sourceLine);
          selectedSourceLine = activeLineNumber;
          activeLine.style.top = `${paddingTop + (activeLineNumber - 1) * lineHeight - editor.scrollTop}px`;
          activeLine.dataset.line = String(activeLineNumber);
          activeLine.dataset.order = rows[activeIndex].dataset.songOrder;
          activeLine.style.display = "block";
          let targetCenter;
          if (source === preview) {
            const sourceCenter = source.scrollTop + source.clientHeight / 2;
            targetCenter = interpolateAnchors(sourceCenter, previewAnchors, "position", "line");
          } else {
            const sourceCenter = source.scrollTop + source.clientHeight / 2;
            targetCenter = interpolateAnchors(sourceCenter, editorAnchors, "position", "line");
          }
          const targetScrollTop = targetCenter - target.clientHeight / 2;
          isScrollSyncing = true;
          target.scrollTop = clamp(targetScrollTop, 0, target.scrollHeight - target.clientHeight);
          requestAnimationFrame(() => {
            isScrollSyncing = false;
          });
        };
        preview.addEventListener("scroll", () => syncScroll(preview, editor));
        editor.addEventListener("scroll", () => syncScroll(editor, preview));
        const renderPreview = ({ commands = [], expanded = null, resolvedItems = [], error = "", loading = false } = {}) => {
          if (loading) {
            summary.innerHTML = '<span class="is-loading">\u6B63\u5728\u66F4\u65B0\u9884\u89C8\u2026\u2026</span>';
            preview.innerHTML = "";
            activeLine.style.display = "none";
            return;
          }
          if (error) {
            summary.innerHTML = `<span class="is-error">${escapeHtml(error)}</span>`;
            preview.innerHTML = "";
            activeLine.style.display = "none";
            return;
          }
          if (!expanded) {
            summary.innerHTML = "<span>\u8F93\u5165\u547D\u4EE4\u540E\u663E\u793A\u9884\u89C8\u3002</span>";
            preview.innerHTML = "";
            activeLine.style.display = "none";
            return;
          }
          const currentIds = currentItems.map((item) => String(item.id));
          const diff = getPlaylistScriptDiff(currentIds, expanded.songIds);
          const currentMap = new Map(currentItems.map((item) => [String(item.id), item]));
          const resolvedMap = new Map(resolvedItems.map((item) => [String(item.id), item]));
          const addedSet = new Set(diff.addedIds);
          const commandBlocks = new Map(expanded.blocks.map((block) => [block.line, block]));
          let targetSongOffset = 0;
          const rows = commands.map((command) => {
            const block = commandBlocks.get(command.line);
            const songStart = targetSongOffset + 1;
            const songEnd = targetSongOffset + block.songIds.length;
            targetSongOffset = songEnd;
            const isAlbum = command.type === "album";
            const blockAddedCount = block.songIds.filter((id) => addedSet.has(String(id))).length;
            const marker = blockAddedCount === block.songIds.length ? "+" : blockAddedCount ? "~" : "\xB7";
            const firstItem = block.items?.[0] || { id: block.songIds[0] };
            const songItem = resolvedMap.get(String(command.id)) || currentMap.get(String(command.id)) || firstItem;
            const title = isAlbum ? block.albumName || `\u4E13\u8F91 ${command.id}` : songItem.title || `\u6B4C\u66F2 ${command.id}`;
            const meta = isAlbum ? `${block.albumArtist ? `${block.albumArtist} \xB7 ` : ""}${block.songIds.length} \u9996\u6B4C\u66F2` : [songItem.artist, songItem.album].filter(Boolean).join(" \xB7 ") || `ID ${command.id}`;
            const trackRows = isAlbum ? block.songIds.map((id, index) => {
              const item = currentMap.get(String(id)) || block.items?.[index] || { id };
              const isTrackAdded = addedSet.has(String(id));
              return `
                <li class="ncm-sort-script-track-row ${isTrackAdded ? "is-added" : ""}">
                  <span class="ncm-sort-script-track-marker">${isTrackAdded ? "+" : "\xB7"}</span>
                  <span class="ncm-sort-script-preview-details">
                    <span>${escapeHtml(item.title || `\u6B4C\u66F2 ${id}`)}</span>
                    <small>${escapeHtml([item.artist, item.album].filter(Boolean).join(" \xB7 ") || `ID ${id}`)}</small>
                  </span>
                  <code>${escapeHtml(id)}</code>
                </li>
              `;
            }).join("") : "";
            return `
            <li data-source-line="${command.line}" data-song-order="${songStart === songEnd ? songStart : `${songStart}-${songEnd}`}" class="ncm-sort-script-preview-group ${selectedSourceLine === command.line ? "is-selected" : ""}" tabindex="0" role="button" aria-label="\u9009\u62E9\u6B4C\u66F2 ${songStart}">
              <div class="ncm-sort-script-preview-row ${blockAddedCount ? "is-added" : ""}">
                <span class="ncm-sort-script-preview-marker">${marker}</span>
                <span class="ncm-sort-script-preview-details">
                  <span>${escapeHtml(title)}</span>
                  <small>${escapeHtml(meta)}</small>
                </span>
                <code>${escapeHtml(command.id)}</code>
              </div>
              ${trackRows ? `<ol class="ncm-sort-script-track-list">${trackRows}</ol>` : ""}
            </li>
          `;
          }).join("");
          summary.innerHTML = `
            <span>\u547D\u4EE4 <strong>${commands.length}</strong></span>
            <span>\u76EE\u6807 <strong>${expanded.songIds.length}</strong></span>
            <span class="is-added">\u65B0\u589E <strong>${diff.addedIds.length}</strong></span>
            <span class="is-removed">\u79FB\u9664 <strong>${diff.removedIds.length}</strong></span>
            <span>\u987A\u5E8F <strong>${diff.changedOrder ? "\u53D8\u5316" : "\u4E0D\u53D8"}</strong></span>
        `;
          preview.innerHTML = `<ol class="ncm-sort-script-preview-list">${rows}</ol>`;
          if (!getPreviewRows().some((row) => Number(row.dataset.sourceLine) === selectedSourceLine)) {
            selectedSourceLine = null;
          }
          requestAnimationFrame(() => syncScroll(preview, editor));
        };
        const updatePreview = async () => {
          const sequence = ++updateSequence;
          let commands;
          try {
            commands = parseSongOnlyPlaylistScript(editor.value);
          } catch (error) {
            renderPreview({ error: error.message });
            return;
          }
          renderPreview({ loading: true });
          try {
            const expanded = await resolvePlaylistCommands(commands);
            const resolvedItems = resolveSongItems ? await resolveSongItems(expanded.songIds) : [];
            if (sequence === updateSequence) renderPreview({ commands, expanded, resolvedItems });
          } catch (error) {
            if (sequence === updateSequence) renderPreview({ error: error.message || String(error) });
          }
        };
        const appendCommand = async () => {
          let command;
          try {
            command = parseCommandLine(commandInput.value);
          } catch (error) {
            showToast(error.message || String(error));
            commandInput.focus();
            return;
          }
          appendButton.disabled = true;
          commandInput.disabled = true;
          try {
            const currentText = editor.value.replace(/\s+$/, "");
            const currentCommands = currentText ? parseSongOnlyPlaylistScript(currentText) : [];
            const currentIds = currentCommands.map((item) => item.id);
            const currentPlan = createSongPlan(currentIds);
            if (command.type === "clear") {
              const clearedPlan = applyCommand(currentPlan, await resolveCommand(command));
              editor.value = buildPlaylistScript(clearedPlan.songIds);
              selectedSourceLine = null;
              commandInput.value = "";
              editor.focus();
              updatePreview();
              showToast("\u5DF2\u6E05\u7A7A\u6267\u884C\u65B9\u6848");
              return;
            }
            const selectedIndex = command.position == null && selectedSourceLine == null ? -1 : currentCommands.findIndex((item) => item.line === selectedSourceLine);
            if (command.type === "album") showToast(`\u6B63\u5728\u8BFB\u53D6\u4E13\u8F91 ${command.id}...`);
            if (!resolveCommand2) throw new Error("\u5F53\u524D\u65E0\u6CD5\u89E3\u6790\u547D\u4EE4");
            const resolved = await resolveCommand2(command, currentPlan);
            const nextPlan = applyCommand(currentPlan, resolved, {
              position: command.position,
              selectedIndex,
              selectedSongId: selectedIndex >= 0 ? currentIds[selectedIndex] : null
            });
            editor.value = buildPlaylistScript(nextPlan.songIds);
            selectedSourceLine = nextPlan.selectedIndex == null ? null : nextPlan.selectedIndex + 1;
            commandInput.value = "";
            editor.focus();
            updatePreview();
            const successMessage = command.type === "album" ? `\u5DF2\u5C55\u5F00\u5E76\u63D2\u5165 ${resolved.songIds.length} \u9996\u6B4C\u66F2` : command.type === "song" ? "\u5DF2\u63D2\u5165 1 \u9996\u6B4C\u66F2" : command.type === "sort" ? "\u5DF2\u5B8C\u6210\u6392\u5E8F" : command.type === "remove" ? "\u5DF2\u5220\u9664\u6307\u5B9A\u6B4C\u66F2" : command.type === "move" ? "\u5DF2\u79FB\u52A8\u6307\u5B9A\u6B4C\u66F2" : "\u5DF2\u4EA4\u6362\u6B4C\u66F2\u4F4D\u7F6E";
            showToast(successMessage);
          } catch (error) {
            showToast(error.message || String(error));
            commandInput.focus();
          } finally {
            appendButton.disabled = false;
            commandInput.disabled = false;
          }
        };
        editor.addEventListener("input", () => {
          selectedSourceLine = null;
          clearTimeout(updateTimer);
          updateTimer = setTimeout(updatePreview, 280);
        });
        document.getElementById("playlist-script-reset").addEventListener("click", () => {
          editor.value = currentScript;
          editor.focus();
          updatePreview();
        });
        document.getElementById("playlist-script-copy").addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(editor.value);
            editor.focus();
            showToast("\u811A\u672C\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F");
          } catch (error) {
            editor.focus();
            editor.select();
            showToast("\u65E0\u6CD5\u76F4\u63A5\u8BBF\u95EE\u526A\u8D34\u677F\uFF0C\u5DF2\u9009\u4E2D\u811A\u672C\u5185\u5BB9\uFF0C\u8BF7\u624B\u52A8\u590D\u5236");
          }
        });
        appendButton.addEventListener("click", appendCommand);
        commandInput.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          appendCommand();
        });
        preview.addEventListener("click", (event) => {
          const row = event.target.closest("[data-source-line]");
          if (!row || !preview.contains(row)) return;
          selectedSourceLine = Number(row.dataset.sourceLine);
          getPreviewRows().forEach((item) => item.classList.toggle("is-selected", item === row));
          updateActiveLine(row);
          const position = getPreviewRowPosition(row);
          const targetScrollTop = clamp(
            position.top + position.height / 2 - preview.clientHeight / 2,
            0,
            preview.scrollHeight - preview.clientHeight
          );
          preview.scrollTo({ top: targetScrollTop, behavior: "smooth" });
        });
        preview.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const row = event.target.closest("[data-source-line]");
          if (!row || !preview.contains(row)) return;
          event.preventDefault();
          selectedSourceLine = Number(row.dataset.sourceLine);
          getPreviewRows().forEach((item) => item.classList.toggle("is-selected", item === row));
          updateActiveLine(row);
          const position = getPreviewRowPosition(row);
          const targetScrollTop = clamp(
            position.top + position.height / 2 - preview.clientHeight / 2,
            0,
            preview.scrollHeight - preview.clientHeight
          );
          preview.scrollTo({ top: targetScrollTop, behavior: "smooth" });
        });
        updatePreview();
      },
      preConfirm: () => {
        const value = document.getElementById("playlist-script-editor").value;
        try {
          parseSongOnlyPlaylistScript(value);
        } catch (error) {
          Swal.showValidationMessage(error.message);
          return false;
        }
        return { scriptText: value };
      }
    });
  }
  function showPlaylistScriptPreviewDialog({
    playlistName = "\u5F53\u524D\u6B4C\u5355",
    commandCount,
    targetCount,
    addedCount,
    removedCount,
    changedOrder,
    externalChange = false
  }) {
    const warning = externalChange ? '<p class="ncm-sort-script-warning">\u5F53\u524D\u6B4C\u5355\u5DF2\u504F\u79BB\u4E0A\u6B21\u5E94\u7528\u540E\u7684\u72B6\u6001\u3002\u786E\u8BA4\u540E\u5C06\u6309\u7167\u8FD9\u4EFD\u811A\u672C\u8986\u76D6\u5F53\u524D\u53D8\u5316\u3002</p>' : "";
    return Swal.fire({
      title: "\u9884\u89C8\u6B4C\u5355\u7F16\u6392",
      html: `
      <div class="ncm-sort-script-preview">
        <div class="ncm-sort-intro">
          <p>${escapeHtml(playlistName)}</p>
          ${warning}
        </div>
        <div class="ncm-sort-script-summary">
          <div><span>\u811A\u672C\u547D\u4EE4</span><strong>${commandCount}</strong></div>
          <div><span>\u5C55\u5F00\u540E\u6B4C\u66F2</span><strong>${targetCount}</strong></div>
          <div><span>\u65B0\u589E\u6B4C\u66F2</span><strong>${addedCount}</strong></div>
          <div><span>\u79FB\u9664\u6B4C\u66F2</span><strong>${removedCount}</strong></div>
          <div><span>\u987A\u5E8F\u53D8\u5316</span><strong>${changedOrder ? "\u6709" : "\u65E0"}</strong></div>
        </div>
        <p class="ncm-sort-script-help">\u786E\u8BA4\u540E\u4F1A\u4FDD\u5B58\u5F53\u524D\u987A\u5E8F\u5907\u4EFD\uFF0C\u5E76\u5C06\u6B4C\u5355\u5199\u56DE\u4E3A\u811A\u672C\u5C55\u5F00\u540E\u7684\u7ED3\u679C\u3002</p>
      </div>
    `,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: "\u786E\u8BA4\u5199\u56DE",
      cancelButtonText: "\u8FD4\u56DE\u7F16\u8F91",
      focusConfirm: false,
      customClass: externalChange ? dangerSwalClasses : swalClasses
    });
  }
  function showRestoreOrderDialog(backup) {
    const createdAt = backup.createdAt ? new Date(backup.createdAt).toLocaleString() : "\u672A\u77E5\u65F6\u95F4";
    const operationText = backup.operation === "delete" ? `\u5C06\u91CD\u65B0\u52A0\u5165 ${backup.removedSongIds.length} \u9996\u5DF2\u5220\u9664\u6B4C\u66F2\u5E76\u6062\u590D\u987A\u5E8F` : backup.operation === "script" ? `\u5C06\u79FB\u9664 ${backup.addedSongIds.length} \u9996\u65B0\u589E\u6B4C\u66F2\u3001\u91CD\u65B0\u52A0\u5165 ${backup.removedSongIds.length} \u9996\u6B4C\u66F2\u5E76\u6062\u590D\u987A\u5E8F` : backup.operation === "move" ? "\u5C06\u6062\u590D\u79FB\u52A8\u524D\u7684\u6B4C\u66F2\u987A\u5E8F" : "\u5C06\u6062\u590D\u6392\u5E8F\u524D\u7684\u6B4C\u66F2\u987A\u5E8F";
    return Swal.fire({
      icon: "warning",
      title: "\u6062\u590D\u4E0A\u6B21\u64CD\u4F5C\u524D\u987A\u5E8F\uFF1F",
      text: `${backup.playlistName || "\u5F53\u524D\u6B4C\u5355"}
\u5907\u4EFD\u65F6\u95F4\uFF1A${createdAt}
${operationText}`,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: "\u6062\u590D\u987A\u5E8F",
      cancelButtonText: "\u53D6\u6D88",
      customClass: dangerSwalClasses
    });
  }
  function showBatchMoveDialog() {
    return Swal.fire({
      title: "\u6279\u91CF\u79FB\u52A8\u6B4C\u66F2",
      html: `
      <div class="ncm-sort-intro">
        <p>\u8F93\u5165\u4E09\u4E2A\u6570\u5B57\u6765\u79FB\u52A8\u6B4C\u66F2\uFF1A</p>
        <p class="ncm-sort-help">
          \u4F8B\u5982\uFF1A2, 6, 10<br>
          \u8868\u793A\u5C06\u5E8F\u53F7 2-6 \u7684\u6B4C\u66F2\u79FB\u5230\u5E8F\u53F7 10 \u7684\u6B4C\u66F2\u540E\u9762\uFF1B\u76EE\u6807\u4F4D\u7F6E\u586B 0 \u8868\u793A\u79FB\u5230\u6700\u524D\u9762
        </p>
      </div>
      <div class="ncm-sort-fields">
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">\u8D77\u59CB\u4F4D\u7F6E\uFF1A</span>
          <input id="start-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="\u8D77\u59CB">
        </label>
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">\u7ED3\u675F\u4F4D\u7F6E\uFF1A</span>
          <input id="end-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="\u7ED3\u675F">
        </label>
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">\u76EE\u6807\u4F4D\u7F6E\uFF1A</span>
          <input id="target-pos" type="number" min="0" class="swal2-input ncm-sort-input" placeholder="\u76EE\u6807">
        </label>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: "\u5F00\u59CB\u79FB\u52A8",
      cancelButtonText: "\u53D6\u6D88",
      focusConfirm: false,
      customClass: swalClasses,
      preConfirm: () => {
        const start = parseInt(document.getElementById("start-pos").value);
        const end = parseInt(document.getElementById("end-pos").value);
        const target = parseInt(document.getElementById("target-pos").value);
        if (isNaN(start) || isNaN(end) || isNaN(target)) {
          Swal.showValidationMessage("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u6570\u5B57");
          return false;
        }
        if (start < 1 || end < 1 || target < 0) {
          Swal.showValidationMessage("\u8D77\u59CB\u3001\u7ED3\u675F\u4F4D\u7F6E\u5FC5\u987B\u5927\u4E8E\u7B49\u4E8E 1\uFF0C\u76EE\u6807\u4F4D\u7F6E\u5FC5\u987B\u5927\u4E8E\u7B49\u4E8E 0");
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
      <div class="ncm-sort-intro">
        <p>\u8F93\u5165\u4E24\u4E2A\u6570\u5B57\u6765\u5220\u9664\u6B4C\u66F2\uFF1A</p>
        <p class="ncm-sort-help">
          \u4F8B\u5982\uFF1A2, 6<br>
          \u8868\u793A\u5220\u9664\u5E8F\u53F7 2-6\uFF08\u5305\u542B\uFF09\u7684\u6240\u6709\u6B4C\u66F2
        </p>
        <p class="ncm-sort-warning">
          \u26A0\uFE0F \u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF0C\u8BF7\u8C28\u614E\u64CD\u4F5C\uFF01
        </p>
      </div>
      <div class="ncm-sort-fields ncm-sort-fields-two">
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">\u8D77\u59CB\u4F4D\u7F6E\uFF1A</span>
          <input id="del-start-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="\u8D77\u59CB">
        </label>
        <label class="ncm-sort-field">
          <span class="ncm-sort-label">\u7ED3\u675F\u4F4D\u7F6E\uFF1A</span>
          <input id="del-end-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="\u7ED3\u675F">
        </label>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: "\u786E\u8BA4\u5220\u9664",
      cancelButtonText: "\u53D6\u6D88",
      confirmButtonColor: "#e74c3c",
      focusConfirm: false,
      customClass: dangerSwalClasses,
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
      confirmButtonColor: "#e74c3c",
      customClass: dangerSwalClasses
    });
  }

  // src/settings/order-backup.js
  var ORDER_BACKUP_KEY = "ncm-playlist-sort:last-order-backup";
  var ORDER_BACKUP_OPERATIONS = /* @__PURE__ */ new Set(["sort", "move", "delete", "script"]);
  function normalizeBackup(backup) {
    if (!backup || typeof backup !== "object") return null;
    if (backup.pid === null || backup.pid === void 0) return null;
    if (!Array.isArray(backup.songIds) || !backup.songIds.length) return null;
    const operation = ORDER_BACKUP_OPERATIONS.has(backup.operation) ? backup.operation : "sort";
    const songIds = backup.songIds.map((id) => String(id));
    const songIdSet = new Set(songIds);
    const removedSongIds = [...new Set((backup.removedSongIds || []).map((id) => String(id)))].filter((id) => songIdSet.has(id));
    const addedSongIds = operation === "script" ? [...new Set((backup.addedSongIds || []).map((id) => String(id)))].filter((id) => !songIdSet.has(id)) : [];
    return {
      pid: String(backup.pid),
      playlistName: typeof backup.playlistName === "string" ? backup.playlistName : "",
      operation,
      songIds,
      removedSongIds: operation === "delete" || operation === "script" ? removedSongIds : [],
      addedSongIds,
      createdAt: Number.isFinite(backup.createdAt) ? backup.createdAt : 0
    };
  }
  async function loadOrderBackup() {
    try {
      const stored = await Promise.resolve(readStoredValue(ORDER_BACKUP_KEY));
      return normalizeBackup(stored);
    } catch (error) {
      console.warn("[NCM-SORT] \u8BFB\u53D6\u6392\u5E8F\u5907\u4EFD\u5931\u8D25", error);
      return null;
    }
  }
  async function saveOrderBackup(pid, songIds, playlistName = "", { operation = "sort", removedSongIds = [], addedSongIds = [] } = {}) {
    const backup = normalizeBackup({
      pid,
      playlistName,
      operation,
      songIds,
      removedSongIds,
      addedSongIds,
      createdAt: Date.now()
    });
    if (!backup) return false;
    try {
      return await Promise.resolve(writeStoredValue(ORDER_BACKUP_KEY, backup));
    } catch (error) {
      console.warn("[NCM-SORT] \u4FDD\u5B58\u6392\u5E8F\u5907\u4EFD\u5931\u8D25", error);
      return false;
    }
  }
  async function clearOrderBackup() {
    try {
      return await Promise.resolve(writeStoredValue(ORDER_BACKUP_KEY, null));
    } catch (error) {
      console.warn("[NCM-SORT] \u6E05\u9664\u6392\u5E8F\u5907\u4EFD\u5931\u8D25", error);
      return false;
    }
  }

  // src/operations/sort-by-title.js
  async function sortByTitle(pid) {
    showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2\u5E76\u8BC6\u522B\u6587\u5B57\u4F53\u7CFB...");
    const { playlist, items, originalSongIds } = await getAllSongs(pid);
    const categoryIds = detectTextCategoryIds(items.map((item) => item.title || ""));
    const settings = await showTitleSortDialog(categoryIds);
    if (!settings.isConfirmed) return;
    await saveTitleSortConfig(settings.value);
    if (!confirm("\u5C06\u76F4\u63A5\u4FEE\u6539\u5F53\u524D\u6B4C\u5355\u5185\u6B4C\u66F2\u987A\u5E8F\uFF0C\u6392\u5E8F\u540E\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u3002\u7EE7\u7EED\uFF1F")) return;
    showToast(`\u83B7\u53D6\u5B8C\u6210\uFF1A${items.length} \u9996\uFF0C\u5F00\u59CB\u6392\u5E8F...`);
    const ordered = stableSort(items, createTitleComparator(settings.value)).map((x) => x.id);
    const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: "sort" });
    showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F(op=update)...");
    const res = await updatePlaylistOrder(pid, ordered);
    if (res && res.code === 200) {
      Swal.fire({
        icon: "success",
        title: "\u6392\u5E8F\u5B8C\u6210",
        text: `${playlist.name}
\u5171 ${ordered.length} \u9996
${backupSaved ? "\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u6392\u5E8F\u524D\u987A\u5E8F\n" : ""}\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
        customClass: swalClasses
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "\u6392\u5E8F\u5931\u8D25",
        text: JSON.stringify(res),
        customClass: swalClasses
      });
    }
  }

  // src/data/publish-time.js
  async function ensurePublishTimes(items) {
    const albumCache = {};
    const needAlbumFetch = items.filter((item) => !item.publishTime && item.albumId > 0);
    if (!needAlbumFetch.length) return;
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

  // src/operations/sort-by-date.js
  async function sortByPublishDate(pid) {
    const result = await showDateSortDialog();
    if (!result.isConfirmed) return;
    await saveDateSortSettings(result.value);
    await performDateSort(pid, result.value.descending, result.value);
  }
  async function performDateSort(pid, descending, dateSortConfig) {
    try {
      showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
      const { playlist, items, originalSongIds } = await getAllSongs(pid);
      await ensurePublishTimes(items);
      showToast(`\u83B7\u53D6\u5B8C\u6210\uFF1A${items.length} \u9996\uFF0C\u5F00\u59CB\u6392\u5E8F...`);
      const ordered = stableSort(items, cmpByDate(descending, dateSortConfig)).map((x) => x.id);
      const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: "sort" });
      showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F(op=update)...");
      const res = await updatePlaylistOrder(pid, ordered);
      if (res && res.code === 200) {
        Swal.fire({
          icon: "success",
          title: "\u6392\u5E8F\u5B8C\u6210",
          text: `${playlist.name}
\u5171 ${ordered.length} \u9996
\u6309\u53D1\u884C\u65E5\u671F${descending ? "\u5012\u5E8F" : "\u987A\u5E8F"}\u6392\u5217
${backupSaved ? "\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u6392\u5E8F\u524D\u987A\u5E8F\n" : ""}\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
          customClass: swalClasses
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "\u6392\u5E8F\u5931\u8D25",
          text: JSON.stringify(res),
          customClass: swalClasses
        });
      }
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "\u51FA\u9519",
        text: e?.message || String(e),
        customClass: swalClasses
      });
    }
  }

  // src/operations/sort-by-artist.js
  async function sortByArtist(pid) {
    const artistSettings = await loadArtistSortSettings();
    showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
    const { playlist, items, originalSongIds } = await getAllSongs(pid);
    const categoryIds = detectTextCategoryIds(items.map((item) => item.artist || ""));
    const result = await showArtistSortDialog(categoryIds, artistSettings);
    if (!result.isConfirmed) return;
    try {
      await saveTitleSortConfig(result.value.textSortConfig);
      await saveArtistSortSettings(result.value);
      await saveDateSortSettings(result.value.dateSortConfig);
      if (result.value.sortSameArtistByDate) {
        await ensurePublishTimes(items);
      }
      showToast(`\u83B7\u53D6\u5B8C\u6210\uFF1A${items.length} \u9996\uFF0C\u5F00\u59CB\u6392\u5E8F...`);
      const dateSortConfig = await loadDateSortSettings();
      const orderedItems = sortSongsByArtist(
        items,
        result.value,
        result.value.textSortConfig,
        dateSortConfig
      );
      const ordered = orderedItems.map((item) => item.id);
      const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: "sort" });
      showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F(op=update)...");
      const res = await updatePlaylistOrder(pid, ordered);
      if (res && res.code === 200) {
        Swal.fire({
          icon: "success",
          title: "\u6392\u5E8F\u5B8C\u6210",
          text: `${playlist.name}
\u5171 ${ordered.length} \u9996
\u6309\u6B4C\u624B${result.value.sortSameArtistByDate ? `\u53CA\u53D1\u884C\u65E5\u671F\uFF08${dateSortConfig.descending ? "\u4ECE\u65B0\u5230\u65E7" : "\u4ECE\u65E7\u5230\u65B0"}\uFF09` : ""}\u6392\u5217
${backupSaved ? "\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u6392\u5E8F\u524D\u987A\u5E8F\n" : ""}\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
          customClass: swalClasses
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "\u6392\u5E8F\u5931\u8D25",
          text: JSON.stringify(res),
          customClass: swalClasses
        });
      }
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "\u51FA\u9519",
        text: e?.message || String(e),
        customClass: swalClasses
      });
    }
  }

  // src/data/heat.js
  var redCountCache = /* @__PURE__ */ new Map();
  var commentCountCache = /* @__PURE__ */ new Map();
  function isMissing(value) {
    return value === null || value === void 0;
  }
  async function ensureRedCounts(items) {
    const needFetch = items.filter((item) => isMissing(item.redCount));
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
        console.error(`\u83B7\u53D6\u6B4C\u66F2 ${item.id} \u7EA2\u5FC3\u6570\u5931\u8D25:`, error);
      }
      if ((i + 1) % 10 === 0) {
        showToast(`\u83B7\u53D6\u7EA2\u5FC3\u6570\u8FDB\u5EA6: ${i + 1}/${needFetch.length}`);
      }
      await sleep(100);
    }
    return { failed, requested: needFetch.length };
  }
  async function ensureCommentCounts(items) {
    const needFetch = items.filter((item) => isMissing(item.commentCount));
    let failed = 0;
    for (let start = 0; start < needFetch.length; start += 1e3) {
      const batch = needFetch.slice(start, start + 1e3);
      const uncached = batch.filter((item) => !commentCountCache.has(item.id));
      for (const item of batch) {
        if (commentCountCache.has(item.id)) {
          item.commentCount = commentCountCache.get(item.id);
        }
      }
      if (!uncached.length) continue;
      try {
        const result = await fetchSongCommentCounts(uncached.map((item) => item.id));
        if (result?.code !== 200 || !Array.isArray(result.data)) {
          failed += uncached.length;
        } else {
          const counts = /* @__PURE__ */ new Map();
          for (const entry of result.data) {
            const count = Number(entry.commentCount);
            if (Number.isFinite(count) && count >= 0) {
              counts.set(String(entry.resourceId), count);
            }
          }
          for (const item of uncached) {
            const count = counts.get(String(item.id));
            if (count === void 0) {
              failed++;
            } else {
              item.commentCount = count;
              commentCountCache.set(item.id, count);
            }
          }
        }
      } catch (error) {
        failed += uncached.length;
        console.error(`\u83B7\u53D6\u6B4C\u66F2\u8BC4\u8BBA\u6570\u5931\u8D25\uFF08${uncached.length} \u9996\uFF09:`, error);
      }
      showToast(`\u83B7\u53D6\u8BC4\u8BBA\u6570\u8FDB\u5EA6: ${Math.min(start + batch.length, needFetch.length)}/${needFetch.length}`);
      await sleep(100);
    }
    return { failed, requested: needFetch.length };
  }
  async function ensureHeatMetric(items, metric) {
    if (metric === "redCount") return ensureRedCounts(items);
    if (metric === "commentCount") return ensureCommentCounts(items);
    return { failed: 0, requested: 0 };
  }

  // src/settings/heat-sort.js
  var HEAT_SORT_SETTINGS_KEY = "ncm-playlist-sort:heat-sort-config";
  async function loadHeatSortConfig() {
    try {
      const stored = await Promise.resolve(readStoredValue(HEAT_SORT_SETTINGS_KEY));
      return normalizeHeatSortConfig(stored);
    } catch (error) {
      console.warn("[NCM-SORT] \u8BFB\u53D6\u70ED\u5EA6\u6392\u5E8F\u8BBE\u7F6E\u5931\u8D25\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u8BBE\u7F6E", error);
      return normalizeHeatSortConfig(DEFAULT_HEAT_SORT_CONFIG);
    }
  }
  async function saveHeatSortConfig(config) {
    const normalized = normalizeHeatSortConfig(config);
    try {
      return await Promise.resolve(writeStoredValue(HEAT_SORT_SETTINGS_KEY, normalized));
    } catch (error) {
      console.warn("[NCM-SORT] \u4FDD\u5B58\u70ED\u5EA6\u6392\u5E8F\u8BBE\u7F6E\u5931\u8D25", error);
      return false;
    }
  }

  // src/operations/sort-by-heat.js
  async function sortByHeat(pid) {
    const savedConfig = await loadHeatSortConfig();
    const result = await showHeatSortDialog(savedConfig);
    if (!result.isConfirmed) return;
    try {
      await saveHeatSortConfig(result.value);
      showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
      const { playlist, items, originalSongIds } = await getAllSongs(pid);
      let failed = 0;
      const summary = await ensureHeatMetric(items, result.value.metric);
      failed = summary.failed;
      showToast(`\u83B7\u53D6\u5B8C\u6210\uFF1A${items.length} \u9996\uFF0C\u5F00\u59CB\u6392\u5E8F...`);
      const ordered = sortSongsByHeat(items, result.value).map((item) => item.id);
      const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name);
      showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F(op=update)...");
      const res = await updatePlaylistOrder(pid, ordered);
      if (res && res.code === 200) {
        const metricLabel = HEAT_SORT_METRICS.find((metric) => metric.id === result.value.metric)?.label || "\u70ED\u5EA6\u6307\u6807";
        const directionLabel = result.value.descending ? "\u964D\u5E8F" : "\u5347\u5E8F";
        const failureText = failed ? `
${failed} \u9996\u6B4C\u66F2\u7684${metricLabel}\u83B7\u53D6\u5931\u8D25\uFF0C\u5DF2\u6392\u5728\u672B\u5C3E` : "";
        Swal.fire({
          icon: "success",
          title: "\u6392\u5E8F\u5B8C\u6210",
          text: `${playlist.name}
\u5171 ${ordered.length} \u9996
\u6309${metricLabel}${directionLabel}\u6392\u5217${failureText}
${backupSaved ? "\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u6392\u5E8F\u524D\u987A\u5E8F\n" : ""}\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
          customClass: swalClasses
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "\u6392\u5E8F\u5931\u8D25",
          text: JSON.stringify(res),
          customClass: swalClasses
        });
      }
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "\u51FA\u9519",
        text: e?.message || String(e),
        customClass: swalClasses
      });
    }
  }

  // src/operations/sort-by-random.js
  function sameOrder(left, right) {
    return left.length === right.length && left.every((id, index) => String(id) === String(right[index]));
  }
  async function sortByRandom(pid) {
    if (!confirm("\u5C06\u968F\u673A\u6253\u4E71\u5F53\u524D\u6B4C\u5355\u987A\u5E8F\uFF0C\u6392\u5E8F\u540E\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u3002\u7EE7\u7EED\uFF1F")) return;
    try {
      showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
      const { playlist, items, originalSongIds } = await getAllSongs(pid);
      showToast(`\u83B7\u53D6\u5B8C\u6210\uFF1A${items.length} \u9996\uFF0C\u5F00\u59CB\u968F\u673A\u6392\u5E8F...`);
      const ordered = shuffleItems(items).map((item) => item.id);
      if (sameOrder(ordered, originalSongIds)) {
        Swal.fire({
          icon: "info",
          title: "\u968F\u673A\u7ED3\u679C\u4E0E\u539F\u987A\u5E8F\u76F8\u540C",
          text: `${playlist.name}
\u672A\u5199\u56DE\u6B4C\u5355`,
          customClass: swalClasses
        });
        return;
      }
      const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: "sort" });
      showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F(op=update)...");
      const response = await updatePlaylistOrder(pid, ordered);
      if (response && response.code === 200) {
        Swal.fire({
          icon: "success",
          title: "\u968F\u673A\u6392\u5E8F\u5B8C\u6210",
          text: `${playlist.name}
\u5171 ${ordered.length} \u9996
${backupSaved ? "\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u968F\u673A\u6392\u5E8F\u524D\u987A\u5E8F\n" : ""}\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
          customClass: swalClasses
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "\u968F\u673A\u6392\u5E8F\u5931\u8D25",
          text: JSON.stringify(response),
          customClass: swalClasses
        });
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "\u51FA\u9519",
        text: error?.message || String(error),
        customClass: swalClasses
      });
    }
  }

  // src/operations/manual-sort.js
  function sameOrder2(left, right) {
    return left.length === right.length && left.every((id, index) => String(id) === String(right[index]));
  }
  async function manualSortSongs(pid) {
    showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
    const { playlist, items, originalSongIds } = await getAllSongs(pid);
    const result = await showManualSortDialog(items);
    if (!result.isConfirmed) return;
    const orderedSongIds = result.value?.orderedSongIds || [];
    if (orderedSongIds.length !== items.length) {
      throw new Error("\u624B\u52A8\u6392\u5E8F\u5217\u8868\u4E0E\u6B4C\u5355\u6B4C\u66F2\u6570\u91CF\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u91CD\u8BD5");
    }
    if (sameOrder2(orderedSongIds, originalSongIds)) {
      Swal.fire({
        icon: "info",
        title: "\u987A\u5E8F\u672A\u6539\u53D8",
        text: `${playlist.name}
\u672A\u5199\u56DE\u6B4C\u5355`,
        customClass: swalClasses
      });
      return;
    }
    const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: "sort" });
    showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F(op=update)...");
    const response = await updatePlaylistOrder(pid, orderedSongIds);
    if (response && response.code === 200) {
      Swal.fire({
        icon: "success",
        title: "\u6392\u5E8F\u5B8C\u6210",
        text: `${playlist.name}
\u5171 ${orderedSongIds.length} \u9996
${backupSaved ? "\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u6392\u5E8F\u524D\u987A\u5E8F\n" : ""}\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
        customClass: swalClasses
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "\u6392\u5E8F\u5931\u8D25",
        text: JSON.stringify(response),
        customClass: swalClasses
      });
    }
  }

  // src/operations/batch-move.js
  async function batchMoveSongs(pid) {
    const result = await showBatchMoveDialog();
    if (!result.isConfirmed) return;
    const { start, end, target } = result.value;
    showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
    const { playlist, items, originalSongIds } = await getAllSongs(pid);
    const totalCount = items.length;
    if (start > totalCount || end > totalCount || target > totalCount) {
      Swal.fire({
        icon: "error",
        title: "\u4F4D\u7F6E\u8D85\u51FA\u8303\u56F4",
        text: `\u6B4C\u5355\u5171\u6709 ${totalCount} \u9996\u6B4C\u66F2\uFF0C\u8F93\u5165\u7684\u4F4D\u7F6E\u4E0D\u80FD\u8D85\u8FC7\u6B64\u8303\u56F4`,
        customClass: swalClasses
      });
      return;
    }
    if (target > start - 1 && target < end) {
      Swal.fire({
        icon: "error",
        title: "\u76EE\u6807\u4F4D\u7F6E\u65E0\u6548",
        text: `\u76EE\u6807\u4F4D\u7F6E\uFF08${target}\uFF09\u4E0D\u80FD\u4F4D\u4E8E\u79FB\u52A8\u533A\u95F4\u5185\u90E8`,
        customClass: swalClasses
      });
      return;
    }
    const orderedIds = moveSongRange(items.map((item) => item.id), start, end, target);
    const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, { operation: "move" });
    showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F...");
    const res = await updatePlaylistOrder(pid, orderedIds);
    if (res && res.code === 200) {
      Swal.fire({
        icon: "success",
        title: "\u79FB\u52A8\u5B8C\u6210",
        html: `\u5DF2\u5C06\u4F4D\u7F6E ${start}-${end} \u7684\u6B4C\u66F2${target === 0 ? "\u79FB\u5230\u6B4C\u5355\u6700\u524D\u9762" : `\u79FB\u5230\u4F4D\u7F6E ${target} \u540E\u9762`}<br>${backupSaved ? "\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u79FB\u52A8\u524D\u987A\u5E8F<br>" : ""}\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
        customClass: swalClasses
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "\u79FB\u52A8\u5931\u8D25",
        text: JSON.stringify(res),
        customClass: swalClasses
      });
    }
  }

  // src/operations/batch-delete.js
  async function batchDeleteSongs(pid) {
    const result = await showBatchDeleteDialog();
    if (!result.isConfirmed) return;
    const { start, end } = result.value;
    showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
    const { playlist, items, originalSongIds } = await getAllSongs(pid);
    const totalCount = items.length;
    if (start > totalCount || end > totalCount) {
      Swal.fire({
        icon: "error",
        title: "\u4F4D\u7F6E\u8D85\u51FA\u8303\u56F4",
        text: `\u6B4C\u5355\u5171\u6709 ${totalCount} \u9996\u6B4C\u66F2\uFF0C\u8F93\u5165\u7684\u4F4D\u7F6E\u4E0D\u80FD\u8D85\u8FC7\u6B64\u8303\u56F4`,
        customClass: swalClasses
      });
      return;
    }
    const startIdx = start - 1;
    const endIdx = end - 1;
    const toDeleteCount = endIdx - startIdx + 1;
    const toDeleteIds = items.slice(startIdx, endIdx + 1).map((x) => x.id);
    const confirm2 = await showDeleteConfirmation(toDeleteCount, start, end);
    if (!confirm2.isConfirmed) return;
    const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name, {
      operation: "delete",
      removedSongIds: toDeleteIds
    });
    showToast("\u6B63\u5728\u5220\u9664\u6B4C\u66F2...");
    const res = await deleteSongsFromPlaylist(pid, toDeleteIds);
    if (res && res.code === 200) {
      Swal.fire({
        icon: "success",
        title: "\u5220\u9664\u5B8C\u6210",
        html: `\u5DF2\u5220\u9664 ${toDeleteCount} \u9996\u6B4C\u66F2<br>${backupSaved ? "\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u5220\u9664\u524D\u987A\u5E8F<br>" : ""}\u5237\u65B0\u9875\u9762\u67E5\u770B\u7ED3\u679C`,
        customClass: swalClasses
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "\u5220\u9664\u5931\u8D25",
        text: JSON.stringify(res),
        customClass: swalClasses
      });
    }
  }

  // src/operations/restore-order.js
  function countIds(ids) {
    const counts = /* @__PURE__ */ new Map();
    for (const id of ids) {
      const key = String(id);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }
  function sameSongSet(currentIds, backupIds) {
    if (currentIds.length !== backupIds.length) return false;
    const currentCounts = countIds(currentIds);
    const backupCounts = countIds(backupIds);
    if (currentCounts.size !== backupCounts.size) return false;
    for (const [id, count] of currentCounts) {
      if (backupCounts.get(id) !== count) return false;
    }
    return true;
  }
  function getExpectedCurrentIds(backup) {
    if (backup.operation === "script") {
      const removedIds2 = new Set(backup.removedSongIds);
      return [
        ...backup.songIds.filter((id) => !removedIds2.has(id)),
        ...backup.addedSongIds
      ];
    }
    if (backup.operation !== "delete") return backup.songIds;
    const removedIds = new Set(backup.removedSongIds);
    return backup.songIds.filter((id) => !removedIds.has(id));
  }
  async function restoreLastOrder(pid) {
    const backup = await loadOrderBackup();
    if (!backup || backup.pid !== String(pid)) {
      Swal.fire({
        icon: "info",
        title: "\u6CA1\u6709\u53EF\u6062\u590D\u7684\u987A\u5E8F",
        text: "\u5F53\u524D\u6B4C\u5355\u8FD8\u6CA1\u6709\u53EF\u6062\u590D\u7684\u987A\u5E8F\u53D8\u66F4\uFF0C\u6216\u5907\u4EFD\u5C5E\u4E8E\u5176\u4ED6\u6B4C\u5355\u3002",
        customClass: swalClasses
      });
      return;
    }
    const confirmation = await showRestoreOrderDialog(backup);
    if (!confirmation.isConfirmed) return;
    try {
      showToast("\u6B63\u5728\u68C0\u67E5\u5F53\u524D\u6B4C\u5355\u662F\u5426\u4ECD\u53EF\u6062\u590D...");
      const detail = await fetchPlaylistDetail(pid);
      if (!detail || detail.code !== 200) {
        throw new Error("playlist/detail failed: " + JSON.stringify(detail));
      }
      const currentIds = getPlaylistTrackIds(detail.playlist);
      if (!sameSongSet(currentIds, getExpectedCurrentIds(backup))) {
        Swal.fire({
          icon: "warning",
          title: "\u65E0\u6CD5\u5B89\u5168\u6062\u590D",
          text: "\u5F53\u524D\u6B4C\u5355\u7684\u6B4C\u66F2\u6570\u91CF\u6216\u5185\u5BB9\u5DF2\u7ECF\u53D8\u5316\uFF0C\u5907\u4EFD\u4ECD\u4F1A\u4FDD\u7559\u3002",
          customClass: swalClasses
        });
        return;
      }
      if (backup.operation === "script" && backup.addedSongIds.length) {
        showToast(`\u6B63\u5728\u79FB\u9664 ${backup.addedSongIds.length} \u9996\u65B0\u589E\u6B4C\u66F2...`);
        const deleteResult = await deleteSongsFromPlaylist(pid, backup.addedSongIds);
        if (!deleteResult || deleteResult.code !== 200) {
          Swal.fire({
            icon: "error",
            title: "\u79FB\u9664\u65B0\u589E\u6B4C\u66F2\u5931\u8D25",
            text: JSON.stringify(deleteResult),
            customClass: swalClasses
          });
          return;
        }
      }
      if ((backup.operation === "delete" || backup.operation === "script") && backup.removedSongIds.length) {
        showToast(`\u6B63\u5728\u91CD\u65B0\u52A0\u5165 ${backup.removedSongIds.length} \u9996\u6B4C\u66F2...`);
        const addResult = await addSongsToPlaylist(pid, backup.removedSongIds);
        if (!addResult || addResult.code !== 200) {
          Swal.fire({
            icon: "error",
            title: "\u91CD\u65B0\u52A0\u5165\u6B4C\u66F2\u5931\u8D25",
            text: JSON.stringify(addResult),
            customClass: swalClasses
          });
          return;
        }
      }
      showToast("\u6B63\u5728\u6062\u590D\u64CD\u4F5C\u524D\u7684\u6B4C\u5355\u987A\u5E8F...");
      const result = await updatePlaylistOrder(pid, backup.songIds);
      if (!result || result.code !== 200) {
        Swal.fire({
          icon: "error",
          title: "\u6062\u590D\u5931\u8D25",
          text: JSON.stringify(result),
          customClass: swalClasses
        });
        return;
      }
      await clearOrderBackup();
      Swal.fire({
        icon: "success",
        title: "\u6062\u590D\u5B8C\u6210",
        text: `${backup.playlistName || "\u5F53\u524D\u6B4C\u5355"}
\u5DF2\u6062\u590D\u64CD\u4F5C\u524D\u7684\u6B4C\u66F2\u987A\u5E8F
\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
        customClass: swalClasses
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "\u6062\u590D\u51FA\u9519",
        text: error?.message || String(error),
        customClass: swalClasses
      });
    }
  }

  // src/settings/playlist-script.js
  var PLAYLIST_SCRIPT_SETTINGS_PREFIX = "ncm-playlist-sort:playlist-script:";
  function getKey(pid) {
    return `${PLAYLIST_SCRIPT_SETTINGS_PREFIX}${String(pid)}`;
  }
  function normalizeIds(ids) {
    return Array.isArray(ids) ? ids.map((id) => String(id)) : [];
  }
  function normalizeSavedScript(pid, value) {
    if (!value || typeof value !== "object" || typeof value.scriptText !== "string") return null;
    const scriptText = value.scriptText.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
    const appliedScriptText = typeof value.appliedScriptText === "string" ? value.appliedScriptText.replaceAll("\r\n", "\n").replaceAll("\r", "\n") : scriptText;
    return {
      pid: String(pid),
      scriptText,
      appliedScriptText,
      appliedSongIds: normalizeIds(value.appliedSongIds),
      updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : 0
    };
  }
  async function loadPlaylistScript(pid) {
    try {
      const value = await Promise.resolve(readStoredValue(getKey(pid)));
      return normalizeSavedScript(pid, value);
    } catch (error) {
      console.warn("[NCM-SORT] \u8BFB\u53D6\u6B4C\u5355\u7F16\u6392\u811A\u672C\u5931\u8D25", error);
      return null;
    }
  }
  async function savePlaylistScript(pid, {
    scriptText,
    appliedSongIds,
    appliedScriptText = scriptText
  }) {
    const value = normalizeSavedScript(pid, {
      scriptText,
      appliedSongIds,
      appliedScriptText,
      updatedAt: Date.now()
    });
    if (!value) return false;
    try {
      return await Promise.resolve(writeStoredValue(getKey(pid), value));
    } catch (error) {
      console.warn("[NCM-SORT] \u4FDD\u5B58\u6B4C\u5355\u7F16\u6392\u811A\u672C\u5931\u8D25", error);
      return false;
    }
  }

  // src/operations/playlist-script.js
  function normalizeIds2(ids) {
    return ids.map((id) => String(id));
  }
  function showOperationError(title, error) {
    return Swal.fire({
      icon: "error",
      title,
      text: error?.message || String(error),
      customClass: swalClasses
    });
  }
  function getDriftWarning(state) {
    if (!state.currentChanged) return "";
    if (state.conflicted) {
      return "\u5F53\u524D\u6B4C\u5355\u548C\u672C\u5730\u811A\u672C\u90FD\u5DF2\u53D1\u751F\u53D8\u5316\u3002\u7EE7\u7EED\u5E94\u7528\u4F1A\u4EE5\u672C\u5730\u811A\u672C\u8986\u76D6\u5F53\u524D\u6B4C\u5355\u53D8\u5316\u3002";
    }
    return "\u5F53\u524D\u6B4C\u5355\u5DF2\u504F\u79BB\u4E0A\u6B21\u5E94\u7528\u540E\u7684\u72B6\u6001\u3002\u7EE7\u7EED\u5E94\u7528\u4F1A\u4EE5\u672C\u5730\u811A\u672C\u8986\u76D6\u5F53\u524D\u6B4C\u5355\u53D8\u5316\u3002";
  }
  async function getEditorScript(saved, currentIds, resolveScript) {
    if (!saved) return buildPlaylistScript(currentIds);
    if (!saved.scriptText.trim()) return "";
    let commands;
    try {
      commands = parsePlaylistScript(saved.scriptText);
    } catch (error) {
      throw new Error(`\u5DF2\u4FDD\u5B58\u7684\u6B4C\u5355\u7F16\u6392\u811A\u672C\u65E0\u6CD5\u89E3\u6790\uFF0C\u5DF2\u505C\u6B62\u64CD\u4F5C\uFF1A${error.message || String(error)}`);
    }
    if (!commands.some((command) => command.type === "album")) {
      return buildPlaylistScript(commands.map((command) => command.id));
    }
    try {
      showToast("\u6B63\u5728\u5C06\u65E7\u7248\u4E13\u8F91\u547D\u4EE4\u5C55\u5F00\u4E3A\u6B4C\u66F2\u547D\u4EE4...");
      const expanded = await resolveScript(commands);
      return buildPlaylistScript(expanded.songIds);
    } catch (error) {
      throw new Error(`\u5DF2\u4FDD\u5B58\u7684\u4E13\u8F91\u547D\u4EE4\u65E0\u6CD5\u5B89\u5168\u5C55\u5F00\uFF0C\u5DF2\u505C\u6B62\u64CD\u4F5C\uFF1A${error.message || String(error)}`);
    }
  }
  async function editPlaylistScript(pid) {
    showToast("\u5F00\u59CB\u83B7\u53D6\u6B4C\u5355\u6B4C\u66F2...");
    const { playlist, items, originalSongIds } = await getAllSongs(pid);
    const saved = await loadPlaylistScript(pid);
    const currentIds = normalizeIds2(originalSongIds);
    const albumResponses = /* @__PURE__ */ new Map();
    const songItemsById = new Map(items.map((item) => [String(item.id), item]));
    const fetchAlbum = async (albumId) => {
      if (!albumResponses.has(albumId)) {
        albumResponses.set(albumId, await fetchAlbumDetail(albumId));
      }
      return albumResponses.get(albumId);
    };
    const resolveScript = (commands2) => resolvePlaylistCommands(commands2, { fetchAlbum });
    const resolveSongItems = async (ids) => {
      const missingIds = [...new Set(ids.map((id) => String(id)))].filter((id) => !songItemsById.has(id));
      if (missingIds.length) {
        const response = await fetchSongDetailByIds(missingIds.map((id) => ({ id })));
        if (!response || response.code !== 200) {
          throw new Error(`\u83B7\u53D6\u6B4C\u66F2\u8BE6\u60C5\u5931\u8D25\uFF1A${JSON.stringify(response)}`);
        }
        for (const song of response.songs || []) {
          const item = toSongItem(song);
          songItemsById.set(String(item.id), item);
        }
      }
      const missingAfterFetch = ids.map((id) => String(id)).filter((id) => !songItemsById.has(id));
      if (missingAfterFetch.length) {
        throw new Error(`\u6B4C\u66F2\u8BE6\u60C5\u4E0D\u5B8C\u6574\uFF0C\u7F3A\u5C11\uFF1A${missingAfterFetch.slice(0, 5).join("\u3001")}`);
      }
      return ids.map((id) => songItemsById.get(String(id)));
    };
    const sortSettingsPromise = Promise.all([
      loadTitleSortConfig(),
      loadDateSortSettings(),
      loadArtistSortSettings(),
      loadHeatSortConfig()
    ]).then(([title, date, artist, heat]) => ({ title, date, artist, heat }));
    const resolveCommandWithCache = async (command, plan) => {
      if (command.type !== "sort") return resolveCommand(command, { fetchAlbum });
      if (!plan || !Array.isArray(plan.songIds)) {
        throw new Error("\u6392\u5E8F\u547D\u4EE4\u7F3A\u5C11\u5F53\u524D\u6267\u884C\u65B9\u6848");
      }
      if (command.key === "random") {
        return resolveCommand(command, {
          fetchAlbum,
          sortConfig: { random: true, randomFn: Math.random }
        });
      }
      const sortItems = await resolveSongItems(plan.songIds);
      const settings = await sortSettingsPromise;
      const sortConfig = resolveSortConfig(command, settings);
      if (command.key === "date" || command.key === "artist" && sortConfig.artist.sortSameArtistByDate) {
        await ensurePublishTimes(sortItems);
      }
      if (command.key === "heat") {
        const metricResult = await ensureHeatMetric(sortItems, sortConfig.heat.metric);
        if (metricResult.failed) {
          showToast(`${metricResult.failed} \u9996\u6B4C\u66F2\u7684\u6392\u5E8F\u6307\u6807\u83B7\u53D6\u5931\u8D25\uFF0C\u5C06\u6392\u5728\u672B\u5C3E`);
        }
      }
      return resolveCommand(command, { fetchAlbum, sortConfig, sortItems });
    };
    const initialScript = await getEditorScript(saved, currentIds, resolveScript);
    const state = getPlaylistScriptState(currentIds, saved);
    const editorResult = await showPlaylistScriptDialog(initialScript, {
      playlistName: playlist.name,
      currentCount: currentIds.length,
      currentScript: buildPlaylistScript(currentIds),
      currentItems: items,
      resolveScript,
      resolveCommand: resolveCommandWithCache,
      resolveSongItems,
      warning: getDriftWarning(state)
    });
    if (!editorResult.isConfirmed) return;
    const scriptText = editorResult.value.scriptText.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
    const commands = parseSongOnlyPlaylistScript(scriptText);
    let expanded;
    try {
      showToast("\u6B63\u5728\u5C55\u5F00\u6B4C\u5355\u7F16\u6392\u811A\u672C...");
      expanded = await resolveScript(commands);
    } catch (error) {
      await showOperationError("\u811A\u672C\u5C55\u5F00\u5931\u8D25", error);
      return;
    }
    await savePlaylistScript(pid, {
      scriptText,
      appliedSongIds: saved && Array.isArray(saved.appliedSongIds) ? saved.appliedSongIds : currentIds,
      appliedScriptText: saved && typeof saved.appliedScriptText === "string" ? saved.appliedScriptText : initialScript
    });
    const diff = getPlaylistScriptDiff(currentIds, expanded.songIds);
    const previewResult = await showPlaylistScriptPreviewDialog({
      playlistName: playlist.name,
      commandCount: commands.length,
      targetCount: expanded.songIds.length,
      addedCount: diff.addedIds.length,
      removedCount: diff.removedIds.length,
      changedOrder: diff.changedOrder,
      externalChange: state.currentChanged && !sameSongOrder(currentIds, expanded.songIds)
    });
    if (!previewResult.isConfirmed) return;
    if (!diff.addedIds.length && !diff.removedIds.length && !diff.changedOrder) {
      await savePlaylistScript(pid, {
        scriptText,
        appliedSongIds: expanded.songIds,
        appliedScriptText: scriptText
      });
      await Swal.fire({
        icon: "info",
        title: "\u6B4C\u5355\u6CA1\u6709\u53D8\u5316",
        text: "\u811A\u672C\u5DF2\u4FDD\u5B58\uFF0C\u672A\u5199\u56DE\u7F51\u6613\u4E91\u6B4C\u5355\u3002",
        customClass: swalClasses
      });
      return;
    }
    let latestDetail;
    try {
      latestDetail = await fetchPlaylistDetail(pid);
    } catch (error) {
      await showOperationError("\u65E0\u6CD5\u786E\u8BA4\u5F53\u524D\u6B4C\u5355\u72B6\u6001", error);
      return;
    }
    if (!latestDetail || latestDetail.code !== 200) {
      await showOperationError("\u65E0\u6CD5\u786E\u8BA4\u5F53\u524D\u6B4C\u5355\u72B6\u6001", new Error(JSON.stringify(latestDetail)));
      return;
    }
    const latestIds = normalizeIds2(getPlaylistTrackIds(latestDetail.playlist));
    if (!sameSongOrder(currentIds, latestIds)) {
      await Swal.fire({
        icon: "warning",
        title: "\u6B4C\u5355\u5728\u7F16\u8F91\u671F\u95F4\u53D1\u751F\u53D8\u5316",
        text: "\u672C\u6B21\u5199\u56DE\u5DF2\u53D6\u6D88\uFF0C\u521A\u624D\u7F16\u8F91\u7684\u811A\u672C\u5DF2\u4FDD\u7559\u3002\u8BF7\u91CD\u65B0\u6253\u5F00\u5DE5\u5177\u5E76\u786E\u8BA4\u6700\u65B0\u5DEE\u5F02\u3002",
        customClass: swalClasses
      });
      return;
    }
    const backupSaved = await saveOrderBackup(pid, currentIds, playlist.name, {
      operation: "script",
      removedSongIds: diff.removedIds,
      addedSongIds: diff.addedIds
    });
    try {
      if (diff.addedIds.length) {
        showToast(`\u6B63\u5728\u52A0\u5165 ${diff.addedIds.length} \u9996\u6B4C\u66F2...`);
        const addResult = await addSongsToPlaylist(pid, diff.addedIds);
        if (!addResult || addResult.code !== 200) {
          throw new Error(`\u52A0\u5165\u6B4C\u66F2\u5931\u8D25\uFF1A${JSON.stringify(addResult)}`);
        }
      }
      if (diff.removedIds.length) {
        showToast(`\u6B63\u5728\u79FB\u9664 ${diff.removedIds.length} \u9996\u6B4C\u66F2...`);
        const deleteResult = await deleteSongsFromPlaylist(pid, diff.removedIds);
        if (!deleteResult || deleteResult.code !== 200) {
          throw new Error(`\u79FB\u9664\u6B4C\u66F2\u5931\u8D25\uFF1A${JSON.stringify(deleteResult)}`);
        }
      }
      showToast("\u5199\u56DE\u6B4C\u5355\u987A\u5E8F(op=update)...");
      const updateResult = await updatePlaylistOrder(pid, expanded.songIds);
      if (!updateResult || updateResult.code !== 200) {
        throw new Error(`\u5199\u56DE\u6B4C\u5355\u987A\u5E8F\u5931\u8D25\uFF1A${JSON.stringify(updateResult)}`);
      }
    } catch (error) {
      await showOperationError("\u6B4C\u5355\u7F16\u6392\u5931\u8D25", error);
      return;
    }
    const scriptSaved = await savePlaylistScript(pid, {
      scriptText,
      appliedSongIds: expanded.songIds,
      appliedScriptText: scriptText
    });
    await Swal.fire({
      icon: "success",
      title: "\u6B4C\u5355\u7F16\u6392\u5B8C\u6210",
      text: `${playlist.name}
\u5171 ${expanded.songIds.length} \u9996\u6B4C\u66F2
${backupSaved ? "\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u5199\u56DE\u524D\u987A\u5E8F\n" : ""}${scriptSaved ? "\u811A\u672C\u5DF2\u4FDD\u5B58\u5230\u5F53\u524D\u6B4C\u5355\n" : ""}\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
      customClass: swalClasses
    });
  }

  // src/ui/menu.js
  async function showFunctionMenu(pid) {
    const backup = await loadOrderBackup();
    const canRestore = backup?.pid === String(pid);
    const result = await Swal.fire({
      title: "\u6B4C\u5355\u6392\u5E8F\u5DE5\u5177",
      html: `
      <div class="ncm-sort-menu">
        <button id="playlist-script" class="ncm-sort-menu-button">\u6B4C\u5355\u7F16\u6392\u811A\u672C</button>
        <button id="sort-by-title" class="ncm-sort-menu-button">\u6309\u6807\u9898\u6392\u5E8F</button>
        <button id="sort-by-date" class="ncm-sort-menu-button">\u6309\u53D1\u884C\u65E5\u671F\u6392\u5E8F</button>
        <button id="sort-by-artist" class="ncm-sort-menu-button">\u6309\u6B4C\u624B\u6392\u5E8F</button>
        <button id="sort-by-heat" class="ncm-sort-menu-button">\u6309\u70ED\u5EA6\u6392\u5E8F</button>
        <button id="sort-by-random" class="ncm-sort-menu-button">\u968F\u673A\u6392\u5E8F</button>
        <button id="manual-sort" class="ncm-sort-menu-button">\u624B\u52A8\u6392\u5E8F</button>
        ${canRestore ? '<button id="restore-last-order" class="ncm-sort-menu-button">\u6062\u590D\u4E0A\u6B21\u64CD\u4F5C\u524D\u987A\u5E8F</button>' : ""}
        <button id="batch-move" class="ncm-sort-menu-button">\u6279\u91CF\u79FB\u52A8\u6B4C\u66F2</button>
        <button id="batch-delete" class="ncm-sort-menu-button ncm-sort-menu-button-danger">\u6279\u91CF\u5220\u9664\u6B4C\u66F2</button>
      </div>
    `,
      showConfirmButton: false,
      showCloseButton: true,
      customClass: swalClasses,
      didOpen: () => {
        document.getElementById("playlist-script").addEventListener("click", async () => {
          Swal.close();
          try {
            await editPlaylistScript(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e),
              customClass: swalClasses
            });
          }
        });
        document.getElementById("sort-by-title").addEventListener("click", async () => {
          Swal.close();
          try {
            await sortByTitle(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e),
              customClass: swalClasses
            });
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
              text: e?.message || String(e),
              customClass: swalClasses
            });
          }
        });
        document.getElementById("sort-by-artist").addEventListener("click", async () => {
          Swal.close();
          try {
            await sortByArtist(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e),
              customClass: swalClasses
            });
          }
        });
        document.getElementById("sort-by-heat").addEventListener("click", async () => {
          Swal.close();
          try {
            await sortByHeat(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e),
              customClass: swalClasses
            });
          }
        });
        document.getElementById("sort-by-random").addEventListener("click", async () => {
          Swal.close();
          try {
            await sortByRandom(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e),
              customClass: swalClasses
            });
          }
        });
        document.getElementById("manual-sort").addEventListener("click", async () => {
          Swal.close();
          try {
            await manualSortSongs(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e),
              customClass: swalClasses
            });
          }
        });
        if (canRestore) {
          document.getElementById("restore-last-order").addEventListener("click", async () => {
            Swal.close();
            try {
              await restoreLastOrder(pid);
            } catch (e) {
              console.error(e);
              Swal.fire({
                icon: "error",
                title: "\u51FA\u9519",
                text: e?.message || String(e),
                customClass: swalClasses
              });
            }
          });
        }
        document.getElementById("batch-move").addEventListener("click", async () => {
          Swal.close();
          try {
            await batchMoveSongs(pid);
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "\u51FA\u9519",
              text: e?.message || String(e),
              customClass: swalClasses
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
              text: e?.message || String(e),
              customClass: swalClasses
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
          text: "\u65E0\u6CD5\u83B7\u53D6\u6B4C\u5355 ID",
          customClass: swalClasses
        });
        return;
      }
      await showFunctionMenu(pid);
    });
    op.appendChild(a);
    return true;
  }
  installStyles();
  setInterval(() => {
    const href = location.href;
    if (href.includes("playlist?id=") || href.includes("/playlist?") || href.includes("#/playlist?")) {
      injectButton();
    }
  }, 800);
})();
