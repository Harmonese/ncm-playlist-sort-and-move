// ==UserScript==
// @name         网易云音乐歌单排序
// @namespace    https://github.com/Harmonese/ncm-playlist-sort-and-move
// @version      0.6.0
// @description  网易云音乐网页版歌单管理工具，支持按标题、歌手、发行日期或热度排序、批量移动和批量删除歌曲
// @author       Harmonese
// @license      MIT
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

  // src/data/playlist.js
  function getPlaylistTrackIds(playlist) {
    if (Array.isArray(playlist?.trackIds) && playlist.trackIds.length) {
      return playlist.trackIds.map((track) => track.id);
    }
    return (playlist?.tracks || []).map((song) => song.id);
  }
  async function getAllSongs(pid) {
    const detail = await fetchPlaylistDetail(pid);
    if (!detail || detail.code !== 200) throw new Error("playlist/detail failed: " + JSON.stringify(detail));
    const pl = detail.playlist;
    const originalSongIds = getPlaylistTrackIds(pl);
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
    items.sort((a, b) => a.originalIndex - b.originalIndex);
    return { playlist: pl, items, originalSongIds };
  }

  // src/sort/order.js
  function getOriginalIndex(item, fallbackIndex = 0) {
    return Number.isInteger(item?.originalIndex) && item.originalIndex >= 0 ? item.originalIndex : fallbackIndex;
  }
  function compareOriginalOrder(a, b) {
    if (!Number.isInteger(a?.originalIndex) || !Number.isInteger(b?.originalIndex)) {
      return 0;
    }
    return a.originalIndex - b.originalIndex;
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
  function detectTitleCategoryIds(items = []) {
    return detectTextCategoryIds(items.map((item) => item.title || ""));
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
  function compareTitles(titleA, titleB, config) {
    if (config.directStringCompare) {
      const result = collator.compare(titleA, titleB);
      return result || compareUnicodeStrings(titleA, titleB);
    }
    const charsA = Array.from(titleA);
    const charsB = Array.from(titleB);
    const categoryRanks = Object.fromEntries(
      config.categoryOrder.map((categoryId, index) => [categoryId, index])
    );
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
    return (textA = "", textB = "") => compareTitles(textA, textB, normalizedConfig);
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

    .ncm-sort-priority-actions {
      display: inline-flex;
      gap: 4px;
    }

    .ncm-sort-icon-button {
      display: inline-flex;
      width: 28px;
      height: 28px;
      align-items: center;
      justify-content: center;
      margin: 0 !important;
      padding: 0 !important;
      border: 1px solid #dce4e5 !important;
      border-radius: 6px !important;
      background: #fff !important;
      color: #536166 !important;
      font-size: 15px !important;
      line-height: 1 !important;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
    }

    .ncm-sort-icon-button:hover {
      border-color: #73a9a3 !important;
      background: #edf6f4 !important;
      color: #205e58 !important;
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

      .ncm-sort-fields {
        grid-template-columns: 1fr;
        gap: 10px;
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
    if (normalizedConfig.sortArtistsByName) {
      groups.sort((a, b) => compareArtist(a.artist, b.artist) || a.index - b.index);
    }
    return groups.flatMap((group) => {
      if (normalizedConfig.sortSameArtistByDate) {
        group.items.sort((a, b) => compareDate(a.item, b.item) || a.index - b.index);
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
    { id: "redCount", label: "\u7EA2\u5FC3\u6570\u91CF" },
    { id: "popularity", label: "\u70ED\u5EA6\u503C" },
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
    const compare = cmpByHeat(config);
    return items.map((item, index) => ({
      item,
      index: getOriginalIndex(item, index)
    })).sort((a, b) => compare(a.item, b.item) || a.index - b.index).map(({ item }) => item);
  }

  // src/ui/dialogs.js
  function getVisibleTitleCategories(categoryIds) {
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
  function createTitleCategoryList(categories) {
    return categories.map((category, index) => `
    <li class="ncm-sort-priority-item" data-category="${category.id}">
      <span class="ncm-sort-priority-name">
        <span class="ncm-sort-priority-index">${index + 1}</span>
        ${category.label}
      </span>
      <span class="ncm-sort-priority-actions">
        <button type="button" class="ncm-sort-icon-button" data-move="up" title="\u4E0A\u79FB" aria-label="\u4E0A\u79FB">\u2191</button>
        <button type="button" class="ncm-sort-icon-button" data-move="down" title="\u4E0B\u79FB" aria-label="\u4E0B\u79FB">\u2193</button>
      </span>
    </li>
  `).join("");
  }
  function readTextSortConfig(prefix) {
    const list = document.getElementById(`${prefix}-priority-list`);
    const directStringCompare = document.getElementById(`${prefix}-direct-compare`).checked;
    const chineseSort = document.getElementById(`${prefix}-chinese-sort`).value;
    return {
      directStringCompare,
      categoryOrder: [...list.querySelectorAll("[data-category]")].map((item) => item.dataset.category),
      chineseSort
    };
  }
  function readTitleSortConfig() {
    return readTextSortConfig("title");
  }
  function refreshPriorityIndexes(list) {
    [...list.querySelectorAll(".ncm-sort-priority-item")].forEach((item, index) => {
      item.querySelector(".ncm-sort-priority-index").textContent = index + 1;
    });
  }
  function setPriorityDisabled(disabled, prefix = "title") {
    const fieldset = document.getElementById(`${prefix}-category-priority`);
    fieldset.disabled = disabled;
    fieldset.classList.toggle("is-disabled", disabled);
  }
  function readDateSortConfig() {
    const selectedOrder = document.querySelector("[data-date-order].is-selected");
    return {
      descending: selectedOrder?.dataset.descending !== "false",
      sortAlbumsByName: document.getElementById("date-sort-albums").checked,
      sortAlbumTracks: document.getElementById("date-sort-tracks").checked
    };
  }
  function readHeatSortConfig() {
    const selected = document.querySelector("[data-heat-sort].is-selected");
    return {
      metric: selected?.dataset.metric || HEAT_SORT_METRICS[0].id,
      descending: selected?.dataset.descending !== "false"
    };
  }
  function setDateTrackSortDisabled(disabled) {
    const input = document.getElementById("date-sort-tracks");
    const row = document.getElementById("date-sort-tracks-row");
    input.disabled = disabled;
    if (disabled) input.checked = false;
    row.classList.toggle("is-disabled", disabled);
  }
  function readArtistSortConfig() {
    return {
      sortArtistsByName: document.getElementById("artist-sort-name").checked,
      sortSameArtistByDate: document.getElementById("artist-sort-date").checked,
      textSortConfig: readTextSortConfig("artist")
    };
  }
  async function showTitleSortDialog(categoryIds) {
    const savedConfig = await loadTitleSortConfig();
    const visibleCategories = getVisibleTitleCategories(categoryIds);
    const categories = orderTitleCategories(visibleCategories, savedConfig.categoryOrder);
    const categoryNames = categories.map((category) => category.label).join("\u3001");
    return Swal.fire({
      title: "\u6309\u6807\u9898\u6392\u5E8F",
      html: `
      <div class="ncm-sort-title-settings">
        <div class="ncm-sort-intro">
          <p>\u9009\u62E9\u6807\u9898\u7684\u6BD4\u8F83\u65B9\u5F0F\uFF1A</p>
          <p class="ncm-sort-help">\u5173\u95ED\u76F4\u63A5\u6BD4\u8F83\u65F6\uFF0C\u811A\u672C\u4F1A\u4ECE\u5DE6\u5230\u53F3\u9010\u4E2A\u5B57\u7B26\u6BD4\u8F83\u3002</p>
          <p class="ncm-sort-help">\u4E0A\u6B21\u4F7F\u7528\u7684\u8BBE\u7F6E\u4F1A\u81EA\u52A8\u6062\u590D\u3002</p>
          <p class="ncm-sort-detected">\u5F53\u524D\u6B4C\u5355\uFF1A${categories.length} \u7C7B\uFF08${categoryNames}\uFF09</p>
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
          <legend>\u5B57\u7B26\u7C7B\u522B\u4F18\u5148\u7EA7</legend>
          <p class="ncm-sort-help">\u4EC5\u663E\u793A\u5F53\u524D\u6B4C\u5355\u51FA\u73B0\u7684\u7C7B\u522B\u3002\u8D8A\u9760\u4E0A\u4F18\u5148\u7EA7\u8D8A\u9AD8\uFF0C\u6BCF\u4E2A\u6807\u9898\u4F4D\u7F6E\u90FD\u4F1A\u4F7F\u7528\u540C\u4E00\u5957\u987A\u5E8F\u3002</p>
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
        list.addEventListener("click", (event) => {
          const button = event.target.closest("[data-move]");
          if (!button) return;
          const item = button.closest(".ncm-sort-priority-item");
          const sibling = button.dataset.move === "up" ? item.previousElementSibling : item.nextElementSibling;
          if (!sibling) return;
          if (button.dataset.move === "up") {
            list.insertBefore(item, sibling);
          } else {
            list.insertBefore(sibling, item);
          }
          refreshPriorityIndexes(list);
        });
        setPriorityDisabled(directCompare.checked);
      },
      preConfirm: () => readTitleSortConfig()
    });
  }
  async function showDateSortDialog() {
    const savedConfig = await loadDateSortSettings();
    return Swal.fire({
      title: "\u6309\u53D1\u884C\u65E5\u671F\u6392\u5E8F",
      html: `
      <div class="ncm-sort-intro">
        <p>\u9009\u62E9\u6392\u5E8F\u65B9\u5411\uFF1A</p>
        <p class="ncm-sort-help">\u53D1\u884C\u65E5\u671F\u76F8\u540C\u65F6\uFF0C\u53EF\u7EE7\u7EED\u6309\u4E13\u8F91\u548C\u4E13\u8F91\u5185\u66F2\u76EE\u987A\u5E8F\u6392\u5217\u3002</p>
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
    const visibleCategories = getVisibleTitleCategories(categoryIds);
    const categories = orderTitleCategories(visibleCategories, textConfig.categoryOrder);
    const categoryNames = categories.map((category) => category.label).join("\u3001");
    return Swal.fire({
      title: "\u6309\u6B4C\u624B\u6392\u5E8F",
      html: `
      <div class="ncm-sort-intro">
        <p>\u9009\u62E9\u6B4C\u624B\u6392\u5E8F\u65B9\u5F0F\uFF1A</p>
        <p class="ncm-sort-help">\u6B4C\u624B\u540D\u79F0\u4F1A\u4ECE\u5DE6\u5230\u53F3\u6BD4\u8F83\uFF0C\u4E0B\u9762\u7684\u6587\u5B57\u89C4\u5219\u4E0E\u201C\u6309\u6807\u9898\u6392\u5E8F\u201D\u5171\u4EAB\u3002</p>
        <p class="ncm-sort-detected">\u5F53\u524D\u6B4C\u5355\uFF1A${categories.length} \u7C7B\uFF08${categoryNames}\uFF09</p>
      </div>
      <fieldset id="artist-text-settings" class="ncm-sort-priority-panel">
        <legend>\u6587\u5B57\u6BD4\u8F83\u89C4\u5219\uFF08\u4E0E\u6807\u9898\u6392\u5E8F\u5171\u4EAB\uFF09</legend>
        <p class="ncm-sort-help">\u4FEE\u6539\u5E76\u786E\u8BA4\u540E\uFF0C\u6807\u9898\u6392\u5E8F\u548C\u6B4C\u624B\u6392\u5E8F\u90FD\u4F1A\u4F7F\u7528\u8FD9\u5957\u89C4\u5219\u3002\u8D8A\u9760\u4E0A\u4F18\u5148\u7EA7\u8D8A\u9AD8\u3002</p>
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
      </fieldset>
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
      <p class="ncm-sort-detected">\u540C\u6B4C\u624B\u53D1\u884C\u65E5\u671F\u89C4\u5219\uFF1A${dateConfig.descending ? "\u4ECE\u65B0\u5230\u65E7" : "\u4ECE\u65E7\u5230\u65B0"}${dateConfig.sortAlbumsByName ? "\uFF0C\u65E5\u671F\u76F8\u540C\u65F6\u6309\u4E13\u8F91\u540D\u79F0" : ""}${dateConfig.sortAlbumTracks ? "\u53CA\u4E13\u8F91\u5185\u66F2\u76EE\u987A\u5E8F" : ""}\uFF08\u4E0E\u201C\u6309\u53D1\u884C\u65E5\u671F\u6392\u5E8F\u201D\u5171\u4EAB\uFF09</p>
    `,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: "\u5F00\u59CB\u6392\u5E8F",
      cancelButtonText: "\u53D6\u6D88",
      customClass: swalClasses,
      didOpen: () => {
        const directCompare = document.getElementById("artist-direct-compare");
        const list = document.getElementById("artist-priority-list");
        directCompare.addEventListener("change", () => {
          setPriorityDisabled(directCompare.checked, "artist");
        });
        list.addEventListener("click", (event) => {
          const button = event.target.closest("[data-move]");
          if (!button) return;
          const item = button.closest(".ncm-sort-priority-item");
          const sibling = button.dataset.move === "up" ? item.previousElementSibling : item.nextElementSibling;
          if (!sibling) return;
          if (button.dataset.move === "up") {
            list.insertBefore(item, sibling);
          } else {
            list.insertBefore(sibling, item);
          }
          refreshPriorityIndexes(list);
        });
        setPriorityDisabled(directCompare.checked, "artist");
      },
      preConfirm: () => readArtistSortConfig()
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
        <p class="ncm-sort-help">\u7EA2\u5FC3\u6570\u91CF\u6765\u81EA\u7F51\u6613\u4E91\u7EA2\u5FC3\u63A5\u53E3\uFF0C\u70ED\u5EA6\u503C\u6765\u81EA\u6B4C\u66F2\u8BE6\u60C5\uFF0C\u8BC4\u8BBA\u6570\u91CF\u4F7F\u7528\u6279\u91CF\u63A5\u53E3\u3002</p>
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
  function showRestoreOrderDialog(backup) {
    const createdAt = backup.createdAt ? new Date(backup.createdAt).toLocaleString() : "\u672A\u77E5\u65F6\u95F4";
    return Swal.fire({
      icon: "warning",
      title: "\u6062\u590D\u6392\u5E8F\u524D\u987A\u5E8F\uFF1F",
      text: `${backup.playlistName || "\u5F53\u524D\u6B4C\u5355"}
\u5907\u4EFD\u65F6\u95F4\uFF1A${createdAt}
\u5171 ${backup.songIds.length} \u9996\u6B4C\u66F2`,
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
          \u8868\u793A\u5C06\u5E8F\u53F7 2-6 \u7684\u6B4C\u66F2\u79FB\u5230\u5E8F\u53F7 10 \u7684\u6B4C\u66F2\u540E\u9762
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
          <input id="target-pos" type="number" min="1" class="swal2-input ncm-sort-input" placeholder="\u76EE\u6807">
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
  function normalizeBackup(backup) {
    if (!backup || typeof backup !== "object") return null;
    if (backup.pid === null || backup.pid === void 0) return null;
    if (!Array.isArray(backup.songIds) || !backup.songIds.length) return null;
    return {
      pid: String(backup.pid),
      playlistName: typeof backup.playlistName === "string" ? backup.playlistName : "",
      songIds: backup.songIds.map((id) => String(id)),
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
  async function saveOrderBackup(pid, songIds, playlistName = "") {
    const backup = normalizeBackup({
      pid,
      playlistName,
      songIds,
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
    const categoryIds = detectTitleCategoryIds(items);
    const settings = await showTitleSortDialog(categoryIds);
    if (!settings.isConfirmed) return;
    await saveTitleSortConfig(settings.value);
    if (!confirm("\u5C06\u76F4\u63A5\u4FEE\u6539\u5F53\u524D\u6B4C\u5355\u5185\u6B4C\u66F2\u987A\u5E8F\uFF0C\u6392\u5E8F\u540E\u53EF\u4ECE\u5DE5\u5177\u83DC\u5355\u6062\u590D\u3002\u7EE7\u7EED\uFF1F")) return;
    showToast(`\u83B7\u53D6\u5B8C\u6210\uFF1A${items.length} \u9996\uFF0C\u5F00\u59CB\u6392\u5E8F...`);
    const ordered = items.slice().sort(createTitleComparator(settings.value)).map((x) => x.id);
    const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name);
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
      const ordered = items.slice().sort(cmpByDate(descending, dateSortConfig)).map((x) => x.id);
      const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name);
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
      const backupSaved = await saveOrderBackup(pid, originalSongIds, playlist.name);
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
        text: `\u6B4C\u5355\u5171\u6709 ${totalCount} \u9996\u6B4C\u66F2\uFF0C\u8F93\u5165\u7684\u4F4D\u7F6E\u4E0D\u80FD\u8D85\u8FC7\u6B64\u8303\u56F4`,
        customClass: swalClasses
      });
      return;
    }
    if (target >= start && target <= end) {
      Swal.fire({
        icon: "error",
        title: "\u76EE\u6807\u4F4D\u7F6E\u65E0\u6548",
        text: `\u76EE\u6807\u4F4D\u7F6E\uFF08${target}\uFF09\u4E0D\u80FD\u5728\u8D77\u59CB\u4F4D\u7F6E\uFF08${start}\uFF09\u548C\u7ED3\u675F\u4F4D\u7F6E\uFF08${end}\uFF09\u4E4B\u95F4`,
        customClass: swalClasses
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
        html: `\u5DF2\u5C06\u4F4D\u7F6E ${start}-${end} \u7684\u6B4C\u66F2\u79FB\u5230\u4F4D\u7F6E ${target} \u540E\u9762<br>\u5237\u65B0\u9875\u9762\u67E5\u770B\u65B0\u987A\u5E8F`,
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
    const { playlist, items } = await getAllSongs(pid);
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
    showToast("\u6B63\u5728\u5220\u9664\u6B4C\u66F2...");
    const res = await deleteSongsFromPlaylist(pid, toDeleteIds);
    if (res && res.code === 200) {
      Swal.fire({
        icon: "success",
        title: "\u5220\u9664\u5B8C\u6210",
        html: `\u5DF2\u5220\u9664 ${toDeleteCount} \u9996\u6B4C\u66F2<br>\u5237\u65B0\u9875\u9762\u67E5\u770B\u7ED3\u679C`,
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
  async function restoreLastOrder(pid) {
    const backup = await loadOrderBackup();
    if (!backup || backup.pid !== String(pid)) {
      Swal.fire({
        icon: "info",
        title: "\u6CA1\u6709\u53EF\u6062\u590D\u7684\u987A\u5E8F",
        text: "\u5F53\u524D\u6B4C\u5355\u8FD8\u6CA1\u6709\u6210\u529F\u6392\u5E8F\u8FC7\uFF0C\u6216\u5907\u4EFD\u5C5E\u4E8E\u5176\u4ED6\u6B4C\u5355\u3002",
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
      if (!sameSongSet(currentIds, backup.songIds)) {
        Swal.fire({
          icon: "warning",
          title: "\u65E0\u6CD5\u5B89\u5168\u6062\u590D",
          text: "\u5F53\u524D\u6B4C\u5355\u7684\u6B4C\u66F2\u6570\u91CF\u6216\u5185\u5BB9\u5DF2\u7ECF\u53D8\u5316\uFF0C\u5907\u4EFD\u4ECD\u4F1A\u4FDD\u7559\u3002",
          customClass: swalClasses
        });
        return;
      }
      showToast("\u6B63\u5728\u6062\u590D\u6392\u5E8F\u524D\u7684\u6B4C\u5355\u987A\u5E8F...");
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
\u5DF2\u6062\u590D\u6392\u5E8F\u524D\u7684\u6B4C\u66F2\u987A\u5E8F
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

  // src/ui/menu.js
  async function showFunctionMenu(pid) {
    const backup = await loadOrderBackup();
    const canRestore = backup?.pid === String(pid);
    const result = await Swal.fire({
      title: "\u6B4C\u5355\u6392\u5E8F\u5DE5\u5177",
      html: `
      <div class="ncm-sort-menu">
        <button id="sort-by-title" class="ncm-sort-menu-button">\u6309\u6807\u9898\u6392\u5E8F</button>
        <button id="sort-by-date" class="ncm-sort-menu-button">\u6309\u53D1\u884C\u65E5\u671F\u6392\u5E8F</button>
        <button id="sort-by-artist" class="ncm-sort-menu-button">\u6309\u6B4C\u624B\u6392\u5E8F</button>
        <button id="sort-by-heat" class="ncm-sort-menu-button">\u6309\u70ED\u5EA6\u6392\u5E8F</button>
        ${canRestore ? '<button id="restore-last-order" class="ncm-sort-menu-button">\u6062\u590D\u4E0A\u6B21\u6392\u5E8F\u524D\u987A\u5E8F</button>' : ""}
        <button id="batch-move" class="ncm-sort-menu-button">\u6279\u91CF\u79FB\u52A8\u6B4C\u66F2</button>
        <button id="batch-delete" class="ncm-sort-menu-button ncm-sort-menu-button-danger">\u6279\u91CF\u5220\u9664\u6B4C\u66F2</button>
      </div>
    `,
      showConfirmButton: false,
      showCloseButton: true,
      customClass: swalClasses,
      didOpen: () => {
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
