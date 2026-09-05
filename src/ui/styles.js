export const swalClasses = Object.freeze({
  popup: 'ncm-sort-popup',
  title: 'ncm-sort-popup-title',
  htmlContainer: 'ncm-sort-popup-content',
  confirmButton: 'ncm-sort-confirm',
  cancelButton: 'ncm-sort-cancel',
  closeButton: 'ncm-sort-close'
});

export const dangerSwalClasses = Object.freeze({
  ...swalClasses,
  popup: 'ncm-sort-popup ncm-sort-danger-popup'
});

export function installStyles() {
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
      content: '›';
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
