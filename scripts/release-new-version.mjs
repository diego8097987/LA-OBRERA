import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const GITHUB_REPO = 'diego8097987/LA-OBRERA';

const bumpArg = (process.argv[2] || 'patch').toLowerCase();
const skipPublish = process.argv.includes('--no-publish');
const allowed = ['patch', 'minor', 'major'];
if (!allowed.includes(bumpArg)) {
  console.error('Uso: node scripts/release-new-version.mjs [patch|minor|major] [--no-publish]');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const [maj, min, pat] = String(pkg.version || '1.0.0')
  .split('.')
  .map((n) => Number.parseInt(n, 10) || 0);

const nextVersion =
  bumpArg === 'major'
    ? `${maj + 1}.0.0`
    : bumpArg === 'minor'
      ? `${maj}.${min + 1}.0`
      : `${maj}.${min}.${pat + 1}`;

console.log(`\nSubiendo versión: v${pkg.version} -> v${nextVersion}\n`);
pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runStep(label, cmd, args, { allowFail = false } = {}) {
  console.log(`\n==> ${label}...`);
  const res = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0 && !allowFail) {
    console.error(`\nError durante "${label}". Se cancela la publicación.`);
    process.exit(res.status ?? 1);
  }
  return res.status === 0;
}

runStep('Verificando tipos TypeScript', npmCmd, ['run', 'lint']);
runStep('Ejecutando pruebas unitarias y reglas de seguridad', npmCmd, ['test']);
runStep('Compilando instalador .exe y archivos de actualización', npmCmd, ['run', 'dist:win']);

const releaseDir = path.join(rootDir, 'release');
const ymlPath = path.join(releaseDir, 'latest.yml');
const exePath = path.join(releaseDir, `LA-OBRERA-POS-Setup-${nextVersion}.exe`);
const blockmapPath = path.join(releaseDir, `LA-OBRERA-POS-Setup-${nextVersion}.exe.blockmap`);

for (const file of [ymlPath, exePath, blockmapPath]) {
  if (!fs.existsSync(file)) {
    console.error(`No se encontró el archivo esperado: ${file}`);
    process.exit(1);
  }
}

if (!skipPublish) {
  // Push updated code if this folder is linked to git
  if (fs.existsSync(path.join(rootDir, '.git'))) {
    runStep('Guardando cambios en Git', 'git', ['add', '-A'], { allowFail: true });
    runStep(
      `Creando commit v${nextVersion}`,
      'git',
      ['commit', '-m', `chore(release): v${nextVersion}`],
      { allowFail: true }
    );
    runStep('Subiendo código a GitHub', 'git', ['push', 'origin', 'HEAD'], { allowFail: true });
  }

  // Publish GitHub Release automatically so every restaurant PC gets the update immediately
  runStep(`Publicando Release v${nextVersion} en GitHub (${GITHUB_REPO})`, 'gh', [
    'release',
    'create',
    `v${nextVersion}`,
    ymlPath,
    exePath,
    blockmapPath,
    '--repo',
    GITHUB_REPO,
    '--title',
    `LA OBRERA POS v${nextVersion}`,
    '--notes',
    `Actualización automática v${nextVersion} de LA OBRERA Grill Asadero POS para Windows 10 y Windows 11.`,
  ]);
}

console.log('\n=============================================================');
console.log(`  ¡ACTUALIZACIÓN v${nextVersion} PUBLICADA PARA TODOS LOS USUARIOS!`);
console.log('=============================================================');
console.log(`Repositorio: https://github.com/${GITHUB_REPO}/releases/tag/v${nextVersion}`);
console.log('Todas las computadoras con LA OBRERA POS recibirán el aviso automáticamente.\n');
