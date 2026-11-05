const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const major = Number(process.versions.node.split('.')[0]);
if (major !== 22) {
  console.error(`Empaquetado SGPA: se requiere Node 22 (actual: ${process.version}). Node 26 finaliza la extracción de Electron sin crear archivos y devuelve código 0.`);
  process.exit(1);
}

const started = Date.now();
const forge = path.join(root, 'node_modules', '@electron-forge', 'cli', 'dist', 'electron-forge.js');
const result = spawnSync(process.execPath, [forge, 'package'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const output = path.join(root, 'out', 'frontend-win32-x64');
const files = [path.join(output, 'frontend.exe'), path.join(output, 'resources', 'app.asar')];
for (const file of files) {
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.size === 0 || stat.mtimeMs < started - 2000) {
    console.error(`Empaquetado SGPA: falta el artefacto nuevo ${file}`);
    process.exit(1);
  }
}
console.log(`Empaquetado SGPA verificado: ${files[0]}`);
