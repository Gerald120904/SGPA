import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBackendSeguro, verificarIdentidadBackend } from '../src/electron/backend-identity.js';

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
