const SONGS = [
  { id: '1', title: 'delta', artist: 'Artist A', album: 'Album A' },
  { id: '2', title: 'charlie', artist: 'Artist A', album: 'Album A' },
  { id: '3', title: 'bravo', artist: 'Artist B', album: 'Album B' },
  { id: '4', title: 'alpha', artist: 'Artist B', album: 'Album B' },
  { id: '5', title: 'echo', artist: 'Artist C', album: 'Album C' },
  { id: '9', title: 'foxtrot', artist: 'Artist D', album: 'Album D' }
].map((item, index) => ({ ...item, originalIndex: index }));

const songMap = new Map(SONGS.map(item => [item.id, item]));

function installGreaseMonkeyStubs() {
  globalThis.GM_addStyle = (cssText) => {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.appendChild(style);
  };
}

function installSweetAlertStub() {
  let activeDialog = null;

  const removeDialog = () => {
    activeDialog?.remove();
    activeDialog = null;
  };

  globalThis.Swal = {
    fire(options) {
      removeDialog();
      const dialog = document.createElement('section');
      dialog.id = 'test-swal-dialog';
      dialog.className = options.customClass?.popup || '';
      dialog.innerHTML = `
        <h2>${options.title || ''}</h2>
        <div class="swal2-html-container">${options.html || ''}</div>
        <div class="test-swal-actions">
          ${options.showCancelButton ? '<button id="test-cancel" type="button">取消</button>' : ''}
          ${options.showConfirmButton ? '<button id="test-confirm" type="button">确认</button>' : ''}
        </div>
        <div id="test-validation-message" role="alert"></div>
      `;
      document.body.appendChild(dialog);
      activeDialog = dialog;
      options.didOpen?.();

      return new Promise((resolve) => {
        const finish = (result) => {
          removeDialog();
          resolve(result);
        };

        dialog.querySelector('#test-cancel')?.addEventListener('click', () => {
          finish({ isConfirmed: false, isDismissed: true });
        });
        dialog.querySelector('#test-confirm')?.addEventListener('click', async () => {
          const value = options.preConfirm ? await options.preConfirm() : undefined;
          if (value === false) return;
          finish({ isConfirmed: true, isDismissed: false, value });
        });
      });
    },

    showValidationMessage(message) {
      const validation = document.querySelector('#test-validation-message');
      if (validation) validation.textContent = message;
    },

    close() {
      removeDialog();
    }
  };
}

installGreaseMonkeyStubs();
installSweetAlertStub();

function getSongItems(ids) {
  return ids.map(id => songMap.get(String(id)) || {
    id: String(id),
    title: `song-${id}`,
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    originalIndex: Number(id)
  });
}

const initialScript = 'song 1\nsong 2\nsong 3\nsong 4\nsong 5';
const sortSettings = {
  title: { directStringCompare: true },
  date: { descending: true },
  artist: { sortArtistsByName: true, sortSameArtistByDate: false },
  heat: { metric: 'popularity', descending: true }
};

const [
  { installStyles },
  { showPlaylistScriptDialog },
  { showFunctionMenu },
  {
    applyCommand,
    createSongPlan,
    resolveCommand: resolvePlanCommand,
    resolvePlaylistCommands,
    resolveSortConfig
  },
  { buildPlaylistScript }
] = await Promise.all([
  import('../../src/ui/styles.js'),
  import('../../src/ui/dialogs.js'),
  import('../../src/ui/menu.js'),
  import('../../src/data/playlist-plan.js'),
  import('../../src/data/playlist-script-protocol.js')
]);

installStyles();

async function resolveSongItems(ids) {
  return getSongItems(ids);
}

async function fetchAlbum(albumId) {
  if (String(albumId) !== '42') {
    return { code: 200, album: { name: 'Empty Album', songs: [] } };
  }
  return {
    code: 200,
    album: {
      name: 'Test Album',
      artist: { name: 'Artist E' },
      songs: [
        { id: 9, name: 'foxtrot', ar: [{ name: 'Artist D' }], al: { name: 'Album D', id: 9 } }
      ]
    }
  };
}

async function resolveCommand(command, plan) {
  if (command.type !== 'sort') {
    return resolvePlanCommand(command, { fetchAlbum });
  }
  const sortItems = await resolveSongItems(plan.songIds);
  const sortConfig = resolveSortConfig(command, sortSettings);
  return resolvePlanCommand(command, { sortConfig, sortItems, fetchAlbum });
}

globalThis.openPlaylistScriptDialog = () => {
  const dialogPromise = showPlaylistScriptDialog(initialScript, {
    playlistName: '浏览器回归测试歌单',
    currentCount: 5,
    currentScript: initialScript,
    currentItems: getSongItems(['1', '2', '3', '4', '5']),
    resolveScript: commands => resolvePlaylistCommands(commands, { fetchAlbum }),
    resolveCommand,
    resolveSongItems
  });
  globalThis.__lastDialogPromise = dialogPromise;
  dialogPromise.then(result => {
    globalThis.__lastDialogResult = result;
  });
  return dialogPromise;
};

globalThis.openFunctionMenu = () => showFunctionMenu('test-playlist');

globalThis.playlistScriptHarness = {
  buildPlaylistScript,
  createSongPlan,
  applyCommand
};

globalThis.__browserHarnessReady = true;
