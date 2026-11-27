import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const electronBinary = require('electron');

const helperScript = path.join(__dirname, 'render-icon-electron.cjs');
const res = spawnSync(electronBinary, [helperScript], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
});

if (res.status !== 0) {
  process.exit(res.status ?? 1);
}
