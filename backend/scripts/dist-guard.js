// Keeps incremental compiler output while removing code emitted for deleted sources.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const backend = path.resolve(__dirname, '..');
const source = path.join(backend, 'src');
const dist = path.join(backend, 'dist');

function assertDistPath() {
  if (path.dirname(dist) !== backend || path.basename(dist) !== 'dist') {
    throw new Error('Unexpected dist path; refusing to modify files.');
  }
  if (fs.existsSync(dist) && fs.lstatSync(dist).isSymbolicLink()) {
    throw new Error('dist is a symbolic link; refusing to modify files.');
  }
}

function filesBelow(root, relative = '') {
  if (!fs.existsSync(path.join(root, relative))) return [];
  const files = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic link in ${root}: ${name}`);
    if (entry.isDirectory()) files.push(...filesBelow(root, name));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}

function prune() {
  assertDistPath();
  const current = new Set(
    filesBelow(source)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.spec.ts'))
      .map((name) => name.slice(0, -3).toLowerCase()),
  );
  const removed = [];
  for (const name of filesBelow(dist)) {
    const suffix = ['.d.ts.map', '.js.map', '.d.ts', '.js'].find((ext) => name.endsWith(ext));
    if (!suffix) continue;
    if (current.has(name.slice(0, -suffix.length).toLowerCase())) continue;
    fs.unlinkSync(path.join(dist, name));
    removed.push(name);
  }
  if (removed.length) process.stdout.write(`Removed ${removed.length} obsolete dist files.\n`);
  return removed;
}

const action = process.argv[2];
if (action === 'prune') {
  prune();
} else if (action === 'clean') {
  assertDistPath();
  fs.rmSync(dist, { recursive: true, force: true });
  process.stdout.write('Cleaned backend/dist.\n');
} else if (action === 'watch') {
  prune();
  let pending;
  const watcher = fs.watch(source, { recursive: true }, () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      try { prune(); }
      catch (error) { process.stderr.write(`${error.stack}\n`); child.kill(); process.exitCode = 1; }
    }, 100);
  });
  const cli = require.resolve('@nestjs/cli/bin/nest.js');
  const child = spawn(process.execPath, [cli, 'start', '--watch', ...process.argv.slice(3)], {
    cwd: backend,
    stdio: 'inherit',
    env: {
      ...process.env,
      SGPA_START_PROFILE: 'development',
      SGPA_RUNTIME_ENV: process.env.SGPA_RUNTIME_ENV || 'development',
    },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', (code) => { watcher.close(); clearTimeout(pending); process.exit(code ?? 1); });
} else {
  throw new Error('Use prune, clean or watch.');
}
