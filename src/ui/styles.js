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
