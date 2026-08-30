export function readStoredValue(key) {
  if (typeof globalThis.GM_getValue === 'function') {
    return globalThis.GM_getValue(key, null);
  }

  if (typeof globalThis.GM?.getValue === 'function') {
    return globalThis.GM.getValue(key, null);
  }

  if (globalThis.localStorage) {
    const raw = globalThis.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }

  return null;
}

export function writeStoredValue(key, value) {
  if (typeof globalThis.GM_setValue === 'function') {
    return Promise.resolve(globalThis.GM_setValue(key, value)).then(() => true);
  }

  if (typeof globalThis.GM?.setValue === 'function') {
    return Promise.resolve(globalThis.GM.setValue(key, value)).then(() => true);
  }

  if (globalThis.localStorage) {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return true;
  }

  return false;
}
