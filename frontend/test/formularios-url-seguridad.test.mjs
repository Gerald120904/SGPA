import test from 'node:test';
import assert from 'node:assert/strict';
import { validarUrlExternaFormulario } from '../src/utils/validar-url-formulario.js';

const token = 'a'.repeat(64);

test('acepta exactamente el protocolo, host y puerto configurados', () => {
  const base = 'http://127.0.0.1:3103';
  const url = `${base}/formularios/p/${token}`;
  assert.equal(validarUrlExternaFormulario(url, base), url);
  assert.throws(() => validarUrlExternaFormulario(`http://127.0.0.1:3999/formularios/p/${token}`, base));
  assert.throws(() => validarUrlExternaFormulario(`https://127.0.0.1:3103/formularios/p/${token}`, base));
  assert.throws(() => validarUrlExternaFormulario(`http://localhost:3103/formularios/p/${token}`, base));
});

test('conserva Google HTTPS y bloquea rutas, credenciales y protocolos ajenos', () => {
  const base = 'https://sgpa.example.invalid';
  assert.equal(validarUrlExternaFormulario('https://docs.google.com/forms/d/example', base), 'https://docs.google.com/forms/d/example');
  for (const url of [
    'http://docs.google.com/forms/d/example',
    'https://docs.google.com:8443/forms/d/example',
    `https://sgpa.example.invalid/admin/${token}`,
    `https://user:pass@sgpa.example.invalid/formularios/p/${token}`,
    `https://sgpa.example.invalid:8443/formularios/p/${token}`,
    'javascript:alert(1)',
  ]) assert.throws(() => validarUrlExternaFormulario(url, base));
});

test('producción exige HTTPS aun si el origen configurado es HTTP', () => {
  assert.throws(() => validarUrlExternaFormulario(`http://127.0.0.1:3103/formularios/p/${token}`, 'http://127.0.0.1:3103', true));
});
