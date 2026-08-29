import fs from 'node:fs/promises';
import * as esbuild from 'esbuild';

const metadata = await fs.readFile('src/metadata.js', 'utf8');

await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  legalComments: 'none',
  banner: { js: metadata },
  outfile: 'ncm-playlist-sort-and-move.user.js'
});
