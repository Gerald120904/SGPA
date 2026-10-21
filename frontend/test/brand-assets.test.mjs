import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const leer = (relativePath) =>
  readFileSync(path.join(frontendRoot, relativePath), 'utf8');

test('el renderer usa rutas relativas compatibles con file://', () => {
  assert.match(leer('vite.renderer.config.mjs'), /base:\s*['"]\.\/['"]/);
  assert.match(
    leer('src/utils/brand-assets.js'),
    /typeof import\.meta\.env.*import\.meta\.env\.BASE_URL[\s\S]*Logo-UNA-Rojo_FondoTransparente\.png/,
  );
});

test('todas las pantallas usan el logo institucional original desde public', () => {
  const logoPath = 'public/Logo-UNA-Rojo_FondoTransparente.png';
  assert.equal(existsSync(path.join(frontendRoot, logoPath)), true);

  for (const file of [
    'src/components/Sidebar.js',
    'src/pages/login/LoginPage.js',
    'src/components/FormDialog.js',
  ]) {
    const source = leer(file);
    assert.match(source, /logoUnaUrl/);
    assert.doesNotMatch(source, /src=["']\/Logo-UNA-Rojo_FondoTransparente\.png/);
  }
});
