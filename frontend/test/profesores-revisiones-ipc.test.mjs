import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarProfesoresRevisionesIpc } from '../src/electron/ipc/profesores-revisiones.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(path.join(frontendDir, 'src', 'preload.js'), 'utf8');
const mainSource = readFileSync(path.join(frontendDir, 'src', 'main.js'), 'utf8');

const CANALES_REVISIONES = [
  'profesores:revisar-requisito-perfil',
  'profesores:guardar-evidencias-requisito',
  'profesores:revisar-perfil',
  'profesores:inactivar-perfil',
  'profesores:revisar-atestado',
];

function crearArnes(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  registrarProfesoresRevisionesIpc({
    ipcMain: {
      handle(canal, fn) {
        assert.equal(handlers.has(canal), false, `Canal duplicado: ${canal}`);
        handlers.set(canal, fn);
      },
    },
    ejecutarPeticionAutenticada(ruta, opciones) {
      llamadas.push({ ruta, opciones });
      if (typeof respuestaOImplementacion === 'function') {
        return respuestaOImplementacion(ruta, opciones);
      }
      return respuestaOImplementacion;
    },
  });
  return { handlers, llamadas };
}

test('registra una sola vez los 5 canales de revisiones compatibles con preload.js y main.js', () => {
  const { handlers } = crearArnes({ ok: true });
  assert.deepEqual([...handlers.keys()], CANALES_REVISIONES);
  assert.equal(new Set(handlers.keys()).size, 5);

  assert.match(
    preloadSource,
    /revisarRequisitoPerfilProfesor:\s*\([\s\S]*?profesorId,\s*perfilId,\s*requisitoId,\s*datos[\s\S]*?\)\s*=>[\s\S]*?"profesores:revisar-requisito-perfil",\s*profesorId,\s*perfilId,\s*requisitoId,\s*datos/,
  );
  assert.match(
    preloadSource,
    /guardarEvidenciasRequisitoProfesor:\s*\([\s\S]*?perfilId,\s*requisitoId,\s*datos[\s\S]*?\)\s*=>[\s\S]*?"profesores:guardar-evidencias-requisito",\s*perfilId,\s*requisitoId,\s*datos/,
  );
  assert.match(
    preloadSource,
    /revisarPerfilProfesor:\s*\([\s\S]*?profesorId,\s*perfilId,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'profesores:revisar-perfil',\s*profesorId,\s*perfilId,\s*datos/,
  );
  assert.match(
    preloadSource,
    /inactivarPerfilProfesor:\s*\([\s\S]*?profesorId,\s*perfilId,\s*observacion[\s\S]*?\)\s*=>[\s\S]*?'profesores:inactivar-perfil',\s*profesorId,\s*perfilId,\s*observacion/,
  );
  assert.match(
    preloadSource,
    /revisarAtestadoProfesor:\s*\([\s\S]*?profesorId,\s*atestadoId,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'profesores:revisar-atestado',\s*profesorId,\s*atestadoId,\s*datos/,
  );
  assert.equal((mainSource.match(/registrarProfesoresRevisionesIpc\s*\(/g) || []).length, 1);
});

test('envía métodos, rutas, cuerpos JSON y respuestas exitosas exactas en revisiones y evidencias', async () => {
  const respuestaOk = { ok: true, data: { actualizado: true } };
  const { handlers, llamadas } = crearArnes(respuestaOk);

  const datosReq = { estado: 'APROBADO', observacion: 'Verificado' };
  const datosEvid = { evidencias: [{ url: 'https://ejemplo.local/doc.pdf' }] };
  const datosPerf = { estado: 'APROBADO' };
  const datosAtest = { estado: 'RECHAZADO', motivo: 'Ilegible' };

  assert.equal(
    await handlers.get('profesores:revisar-requisito-perfil')(null, 3, 10, 22, datosReq),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:guardar-evidencias-requisito')(null, 10, 22, datosEvid),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:revisar-perfil')(null, 3, 10, datosPerf),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:inactivar-perfil')(null, 3, 10, 'Perfil vencido'),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:revisar-atestado')(null, 3, 45, datosAtest),
    respuestaOk,
  );

  assert.deepEqual(llamadas, [
    {
      ruta: '/profesores/3/perfiles/10/requisitos/22/revision',
      opciones: { method: 'PATCH', body: datosReq },
    },
    {
      ruta: '/profesores/mi-perfil/perfiles/10/requisitos/22/evidencias',
      opciones: { method: 'PUT', body: datosEvid },
    },
    {
      ruta: '/profesores/3/perfiles/10/revision',
      opciones: { method: 'PATCH', body: datosPerf },
    },
    {
      ruta: '/profesores/3/perfiles/10/inactivar',
      opciones: { method: 'PATCH', body: { observacion: 'Perfil vencido' } },
    },
    {
      ruta: '/profesores/3/atestados/45/revision',
      opciones: { method: 'PATCH', body: datosAtest },
    },
  ]);
});

test('conserva casos límite null/undefined, errores HTTP y rechazos sin alterarlos', async () => {
  const { handlers: hEdge, llamadas } = crearArnes({ ok: true, data: null });

  await hEdge.get('profesores:revisar-requisito-perfil')(null, undefined, null, 1, null);
  await hEdge.get('profesores:guardar-evidencias-requisito')(null, null, undefined, undefined);
  await hEdge.get('profesores:revisar-perfil')(null, undefined, null, undefined);
  await hEdge.get('profesores:inactivar-perfil')(null, 3, 10, undefined);
  await hEdge.get('profesores:revisar-atestado')(null, null, undefined, null);

  assert.deepEqual(llamadas, [
    {
      ruta: '/profesores/undefined/perfiles/null/requisitos/1/revision',
      opciones: { method: 'PATCH', body: null },
    },
    {
      ruta: '/profesores/mi-perfil/perfiles/null/requisitos/undefined/evidencias',
      opciones: { method: 'PUT', body: undefined },
    },
    {
      ruta: '/profesores/undefined/perfiles/null/revision',
      opciones: { method: 'PATCH', body: undefined },
    },
    {
      ruta: '/profesores/3/perfiles/10/inactivar',
      opciones: { method: 'PATCH', body: { observacion: undefined } },
    },
    {
      ruta: '/profesores/null/atestados/undefined/revision',
      opciones: { method: 'PATCH', body: null },
    },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Datos inválidos.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permisos.' },
    { ok: false, status: 404, message: 'Registro no encontrado.' },
    { ok: false, status: 0, message: 'Sin conexión.' },
  ]) {
    const { handlers } = crearArnes(errorHttp);
    assert.equal(await handlers.get('profesores:revisar-requisito-perfil')(null, 1, 2, 3, {}), errorHttp);
    assert.equal(await handlers.get('profesores:guardar-evidencias-requisito')(null, 2, 3, {}), errorHttp);
    assert.equal(await handlers.get('profesores:revisar-perfil')(null, 1, 2, {}), errorHttp);
    assert.equal(await handlers.get('profesores:inactivar-perfil')(null, 1, 2, ''), errorHttp);
    assert.equal(await handlers.get('profesores:revisar-atestado')(null, 1, 4, {}), errorHttp);
  }

  const rechazo = new Error('Fallo de red');
  const { handlers: hRechazo } = crearArnes(() => Promise.reject(rechazo));
  await assert.rejects(
    hRechazo.get('profesores:revisar-perfil')(null, 1, 2, {}),
    (err) => err === rechazo,
  );
  for (const canal of CANALES_REVISIONES) {
    assert.equal((mainSource.match(new RegExp(`['"]${canal}['"]`, 'g')) || []).length, 0);
  }

  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const modulosProfesores = readdirSync(ipcDir).filter((n) => /^profesores.*\.ipc\.js$/.test(n));
  assert.equal(modulosProfesores.length, 9);
});
