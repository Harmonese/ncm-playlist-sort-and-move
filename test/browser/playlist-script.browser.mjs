import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from 'playwright';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8'
};

function createStaticServer() {
  return createServer(async (request, response) => {
    const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
    const relativePath = requestPath === '/' ? '/test/browser/playlist-script-harness.html' : requestPath;
    const filePath = normalize(join(repositoryRoot, `.${relativePath}`));
    const rootWithSeparator = repositoryRoot.endsWith(sep) ? repositoryRoot : `${repositoryRoot}${sep}`;

    if (!filePath.startsWith(rootWithSeparator) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(filePath).pipe(response);
  });
}

let server;
let browser;
let page;
let baseUrl;

test.before(async () => {
  server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.goto(`${baseUrl}/test/browser/playlist-script-harness.html`);
  await page.waitForFunction(() => window.__browserHarnessReady === true);
});

test.after(async () => {
  await browser?.close();
  await new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(error => (error ? reject(error) : resolve()));
  });
});

async function openDialog() {
  await page.evaluate(() => {
    window.openPlaylistScriptDialog();
  });
  await page.locator('#playlist-script-editor').waitFor();
  await page.waitForFunction(() => {
    const preview = document.querySelector('#playlist-script-live-preview');
    return preview && preview.textContent.includes('delta');
  });
}

async function waitForEditorValue(value) {
  await page.waitForFunction(expected => {
    return document.querySelector('#playlist-script-editor')?.value === expected;
  }, value);
}

test('playlist script dialog executes commands through the browser UI', async () => {
  await openDialog();

  const preview = page.locator('#playlist-script-live-preview');
  assert.match(await preview.textContent(), /delta/);
  assert.match(await preview.textContent(), /Artist A/);

  const commandInput = page.locator('#playlist-script-command-input');
  await commandInput.fill('move 2 4 0');
  await commandInput.press('Enter');
  await waitForEditorValue('song 2\nsong 3\nsong 4\nsong 1\nsong 5');

  await commandInput.fill('sort title 2 4');
  await commandInput.press('Enter');
  await waitForEditorValue('song 2\nsong 4\nsong 3\nsong 1\nsong 5');

  await commandInput.fill('remove 2 3');
  await commandInput.press('Enter');
  await waitForEditorValue('song 2\nsong 1\nsong 5');

  await commandInput.fill('sort random 1 3');
  await commandInput.press('Enter');
  await page.waitForFunction(() => {
    const value = document.querySelector('#playlist-script-editor')?.value || '';
    const ids = value.split('\n').filter(Boolean).map(line => line.replace('song ', ''));
    return ids.length === 3 && new Set(ids).size === 3 && ['1', '2', '5'].every(id => ids.includes(id));
  });

  const secondRow = page.locator('[data-source-line="2"]');
  await secondRow.click();
  await page.waitForFunction(() => {
    return document.querySelector('[data-source-line="2"]')?.classList.contains('is-selected');
  });
  assert.equal(await page.locator('#playlist-script-active-line').getAttribute('data-line'), '2');

  await page.locator('#test-cancel').click();
});

test('right-hand script panel is read-only while the command line remains editable', async () => {
  await page.reload();
  await page.waitForFunction(() => window.__browserHarnessReady === true);
  await openDialog();

  const editor = page.locator('#playlist-script-editor');
  const commandInput = page.locator('#playlist-script-command-input');
  const originalScript = await editor.inputValue();

  assert.equal(await editor.getAttribute('readonly'), '');
  await editor.click();
  await editor.press('End');
  await editor.type('song 9');
  assert.equal(await editor.inputValue(), originalScript);
  assert.equal(await commandInput.isEditable(), true);

  await page.locator('#test-cancel').click();
});

test('function menu exposes random sorting', async () => {
  await page.reload();
  await page.waitForFunction(() => window.__browserHarnessReady === true);
  await page.evaluate(() => {
    window.openFunctionMenu();
  });
  await page.locator('#sort-by-random').waitFor();
  assert.equal(await page.locator('#sort-by-random').textContent(), '随机排序');
  await page.evaluate(() => window.Swal.close());
});

test('browser harness keeps song metadata in the preview after inserting a song', async () => {
  await page.reload();
  await page.waitForFunction(() => window.__browserHarnessReady === true);
  await openDialog();

  const commandInput = page.locator('#playlist-script-command-input');
  await commandInput.fill('song 9 0');
  await commandInput.press('Enter');
  await waitForEditorValue('song 9\nsong 1\nsong 2\nsong 3\nsong 4\nsong 5');
  await page.waitForFunction(() => {
    return document.querySelector('#playlist-script-live-preview')?.textContent.includes('foxtrot');
  });
  assert.match(await page.locator('#playlist-script-live-preview').textContent(), /foxtrot/);

  await page.locator('#test-cancel').click();
});

test('album expansion, clear, and selected insertion work in the browser UI', async () => {
  await page.reload();
  await page.waitForFunction(() => window.__browserHarnessReady === true);
  await openDialog();

  const commandInput = page.locator('#playlist-script-command-input');
  await commandInput.fill('album 42 0');
  await commandInput.press('Enter');
  await waitForEditorValue('song 9\nsong 1\nsong 2\nsong 3\nsong 4\nsong 5');
  await page.waitForFunction(() => {
    return document.querySelector('#playlist-script-live-preview')?.textContent.includes('foxtrot');
  });

  await commandInput.fill('clear');
  await commandInput.press('Enter');
  await waitForEditorValue('');

  await commandInput.fill('song 9');
  await commandInput.press('Enter');
  await waitForEditorValue('song 9');

  await page.locator('#test-cancel').click();
});

test('omitted insertion position follows the selected preview row', async () => {
  await page.reload();
  await page.waitForFunction(() => window.__browserHarnessReady === true);
  await openDialog();

  const selectedRow = page.locator('[data-source-line="3"]');
  await selectedRow.click();
  assert.equal(await selectedRow.evaluate(row => row.classList.contains('is-selected')), true);

  const commandInput = page.locator('#playlist-script-command-input');
  await commandInput.fill('song 9');
  await commandInput.press('Enter');
  await waitForEditorValue('song 1\nsong 2\nsong 3\nsong 9\nsong 4\nsong 5');

  await page.locator('#test-cancel').click();
});

test('invalid and duplicate commands leave the editor unchanged', async () => {
  await page.reload();
  await page.waitForFunction(() => window.__browserHarnessReady === true);
  await openDialog();

  const commandInput = page.locator('#playlist-script-command-input');
  const editor = page.locator('#playlist-script-editor');
  const originalScript = await editor.inputValue();

  await commandInput.fill('move 2 4 2');
  await commandInput.press('Enter');
  await page.waitForTimeout(50);
  assert.equal(await editor.inputValue(), originalScript);
  assert.equal(await commandInput.inputValue(), 'move 2 4 2');

  await commandInput.fill('song 1 0');
  await commandInput.press('Enter');
  await page.waitForTimeout(50);
  assert.equal(await editor.inputValue(), originalScript);
  assert.equal(await commandInput.inputValue(), 'song 1 0');

  await commandInput.fill('album 999 0');
  await commandInput.press('Enter');
  await page.waitForTimeout(50);
  assert.equal(await editor.inputValue(), originalScript);
  assert.equal(await commandInput.inputValue(), 'album 999 0');

  await page.locator('#test-cancel').click();
});

test('confirmation rejects album commands in the persisted script document', async () => {
  await page.reload();
  await page.waitForFunction(() => window.__browserHarnessReady === true);
  await openDialog();

  const editor = page.locator('#playlist-script-editor');
  await page.evaluate(() => {
    document.querySelector('#playlist-script-editor').value = 'album 42';
  });
  await page.locator('#test-confirm').click();
  await page.waitForFunction(() => {
    return document.querySelector('#test-validation-message')?.textContent.includes('只支持 song');
  });
  assert.equal(await page.locator('#test-swal-dialog').count(), 1);

  await page.evaluate(() => {
    document.querySelector('#playlist-script-editor').value = 'song 1';
  });
  await page.locator('#test-confirm').click();
  await page.waitForFunction(() => window.__lastDialogResult?.isConfirmed === true);
  assert.equal(await page.locator('#test-swal-dialog').count(), 0);
});
