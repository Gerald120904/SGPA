import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBackendSeguro, normalizarUrlBackend, resolverUrlBackend, verificarIdentidadBackend } from '../src/electron/backend-identity.js';

const base = 'http://127.0.0.1:3000';
const isolated = 'sgpa_isolated_audit';
const identity = { app: 'SGPA', database: isolated, modoAislado: true };

test('D-03: valida identidad antes de credenciales y escrituras', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/identidad')) return { ok: true, json: async () => identity };
    return { ok: true, status: 200 };
  };
  await fetchBackendSeguro(fetcher, base, isolated, '/auth/login', { method: 'POST', body: 'credenciales' });
  assert.deepEqual(calls.map(call => call.url), [`${base}/auth/identidad`, `${base}/auth/login`]);
  await fetchBackendSeguro(fetcher, base, isolated, '/usuarios', { method: 'POST', body: 'datos' });
  assert.deepEqual(calls.slice(2).map(call => call.url), [`${base}/auth/identidad`, `${base}/usuarios`]);
});

test('D-03: rechaza servicio ajeno, base equivocada y modo incoherente antes de enviar datos', async () => {
  for (const wrong of [
    { ...identity, app: 'OTRO' },
    { ...identity, database: 'sgpa', modoAislado: false },
    { ...identity, modoAislado: false },
  ]) {
    const calls = [];
    const fetcher = async url => { calls.push(url); return { ok: true, json: async () => wrong }; };
    await assert.rejects(fetchBackendSeguro(fetcher, base, isolated, '/auth/login', { method: 'POST' }));
    assert.deepEqual(calls, [`${base}/auth/identidad`]);
  }
});

test('D-03: backend ausente o identidad HTTP fallida bloquean la peticion', async () => {
  await assert.rejects(verificarIdentidadBackend(async () => { throw new Error('ECONNREFUSED'); }, base, isolated));
  await assert.rejects(verificarIdentidadBackend(async () => ({ ok: false, status: 503 }), base, isolated));
});

test('D-03: acepta una base institucional configurada explícitamente', async () => {
  const database = 'sgpa_sede_regional';
  const respuesta = { app: 'SGPA', database, modoAislado: false };
  const calls = [];
  const fetcher = async url => {
    calls.push(url);
    return url.endsWith('/auth/identidad')
      ? { ok: true, json: async () => respuesta }
      : { ok: true, status: 200 };
  };
  await fetchBackendSeguro(fetcher, base, database, '/auth/login', { method: 'POST' });
  assert.deepEqual(calls, [`${base}/auth/identidad`, `${base}/auth/login`]);
});

test('servidor configurable: admite otro puerto local y bloquea URL externa insegura', () => {
  assert.equal(normalizarUrlBackend('http://127.0.0.1:3301/'), 'http://127.0.0.1:3301');
  assert.equal(normalizarUrlBackend('https://sgpa.example.org/'), 'https://sgpa.example.org');
  assert.throws(() => normalizarUrlBackend('http://otro-servidor.example.org'));
  assert.throws(() => normalizarUrlBackend('http://127.0.0.1:3301/auth/login'));
  assert.throws(() => normalizarUrlBackend('http://user:secret@127.0.0.1:3301'));
});

test('resolverUrlBackend: detecta automáticamente el backend activo que responde con SGPA/sgpa', async () => {
  const fetcher = async (url) => {
    if (url.includes(':3000')) {
      throw new Error('ECONNREFUSED');
    }
    if (url.includes(':3301/auth/identidad')) {
      return { ok: true, json: async () => ({ app: 'SGPA', database: 'sgpa', modoAislado: false }) };
    }
    return { ok: false, status: 404 };
  };

  const resuelta = await resolverUrlBackend(fetcher, {
    expectedDatabase: 'sgpa',
    env: {},
  });
  assert.equal(resuelta, 'http://127.0.0.1:3301');
});

test('resolverUrlBackend: no se conecta con un servicio en el puerto 3000 si no es SGPA', async () => {
  const fetcher = async (url) => {
    if (url.includes(':3000/auth/identidad')) {
      // Servicio ajeno en puerto 3000
      return { ok: true, json: async () => ({ app: 'OTRA_APP', database: 'otra' }) };
    }
    if (url.includes(':3301/auth/identidad')) {
      return { ok: true, json: async () => ({ app: 'SGPA', database: 'sgpa', modoAislado: false }) };
    }
    return { ok: false, status: 404 };
  };

  const resuelta = await resolverUrlBackend(fetcher, {
    expectedDatabase: 'sgpa',
    env: {},
  });
  // No debe elegir el servicio ajeno de 3000, sino el backend legítimo en 3301
  assert.equal(resuelta, 'http://127.0.0.1:3301');
});

test('resolverUrlBackend: respeta la URL configurada por SGPA_API_URL o por proyecto', async () => {
  const fetcher = async (url) => {
    if (url.includes(':4000/auth/identidad')) {
      return { ok: true, json: async () => ({ app: 'SGPA', database: 'sgpa', modoAislado: false }) };
    }
    return { ok: false, status: 404 };
  };

  const resuelta = await resolverUrlBackend(fetcher, {
    expectedDatabase: 'sgpa',
    env: { SGPA_API_URL: 'http://127.0.0.1:4000' },
  });
  assert.equal(resuelta, 'http://127.0.0.1:4000');

  const resueltaPorArchivo = await resolverUrlBackend(fetcher, {
    expectedDatabase: 'sgpa',
    env: {},
    leerConfigProyecto: () => ({ port: 4000 }),
  });
  assert.equal(resueltaPorArchivo, 'http://127.0.0.1:4000');
});

test('resolverUrlBackend: rechaza todos los candidatos si ninguno acredita SGPA/sgpa', async () => {
  const consultadas = [];
  const fetcher = async (url) => {
    consultadas.push(url);
    return { ok: true, json: async () => ({ app: 'SGPA', database: 'otra', modoAislado: false }) };
  };

  await assert.rejects(
    resolverUrlBackend(fetcher, { expectedDatabase: 'sgpa', env: {} }),
    /No se encontró un backend SGPA válido para sgpa/,
  );
  assert.deepEqual(consultadas, [
    'http://127.0.0.1:3000/auth/identidad',
    'http://127.0.0.1:3301/auth/identidad',
  ]);
});
