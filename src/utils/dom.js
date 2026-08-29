export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const q = (sel, root = document) => root.querySelector(sel);

export function showToast(text) {
  try {
    if (window.top && window.top.g_showTipCard) {
      window.top.g_showTipCard({ tip: text, type: 1 });
      return;
    }
  } catch (e) {}
  console.log('[NCM-SORT]', text);
}
