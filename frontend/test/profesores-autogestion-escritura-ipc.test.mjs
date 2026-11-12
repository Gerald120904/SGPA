import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarProfesoresAutogestionEscrituraIpc } from '../src/electron/ipc/profesores-autogestion-escritura.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(path.join(frontendDir, 'src', 'preload.js'), 'utf8');
const mainSource = readFileSync(path.join(frontendDir, 'src', 'main.js'), 'utf8');

const CANALES_AUTOGESTION_ESCRITURA = [
  'profesores:actualizar-mis-carreras',
  'profesores:solicitar-perfil',
  'profesores:crear-atestado',
  'profesores:actualizar-atestado',
  'profesores:inactivar-mi-atestado',
];

function crearArnes(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  registrarProfesoresAutogestionEscrituraIpc({
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

test('registra una sola vez los 5 canales de autogestión escritura compatibles con preload.js y main.js', () => {
  const { handlers } = crearArnes({ ok: true });
  assert.deepEqual([...handlers.keys()], CANALES_AUTOGESTION_ESCRITURA);
  assert.equal(new Set(handlers.keys()).size, 5);

  assert.match(
    preloadSource,
    /actualizarMisCarrerasProfesor:\s*\([\s\S]*?carreraIds[\s\S]*?\)\s*=>[\s\S]*?'profesores:actualizar-mis-carreras',\s*carreraIds/,
  );
  assert.match(
    preloadSource,
    /solicitarPerfilProfesor:\s*\([\s\S]*?perfilAcademicoId[\s\S]*?\)\s*=>[\s\S]*?'profesores:solicitar-perfil',\s*perfilAcademicoId/,
  );
  assert.match(
    preloadSource,
    /crearAtestadoProfesor:\s*\(datos\)\s*=>[\s\S]*?'profesores:crear-atestado',\s*datos/,
  );
  assert.match(
    preloadSource,
    /actualizarAtestadoProfesor:\s*\([\s\S]*?atestadoId,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'profesores:actualizar-atestado',\s*atestadoId,\s*datos/,
  );
  assert.match(
    preloadSource,
    /inactivarMiAtestadoProfesor:\s*\([\s\S]*?atestadoId[\s\S]*?\)\s*=>[\s\S]*?'profesores:inactivar-mi-atestado',\s*atestadoId/,
  );
  assert.equal(
    (mainSource.match(/registrarProfesoresAutogestionEscrituraIpc\s*\(/g) || []).length,
    1,
  );
});

test('envía métodos, rutas, cuerpos JSON (incluyendo ausencia de body al inactivar atestado) y respuestas exactas', async () => {
  const respuestaOk = { ok: true, data: { id: 18 } };
  const { handlers, llamadas } = crearArnes(respuestaOk);

  const datosCrearAtest = { tipo: 'TITULO', titulo: 'Maestría' };
  const datosActAtest = { titulo: 'Doctorado' };

  assert.equal(
    await handlers.get('profesores:actualizar-mis-carreras')(null, [1, 4]),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:solicitar-perfil')(null, 9),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:crear-atestado')(null, datosCrearAtest),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:actualizar-atestado')(null, 18, datosActAtest),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:inactivar-mi-atestado')(null, 18),
    respuestaOk,
  );

  assert.deepEqual(llamadas, [
    {
      ruta: '/profesores/mi-perfil/carreras',
      opciones: { method: 'PUT', body: { carreraIds: [1, 4] } },
    },
    {
      ruta: '/profesores/mi-perfil/perfiles',
      opciones: { method: 'POST', body: { perfilAcademicoId: 9 } },
    },
    {
      ruta: '/profesores/mi-perfil/atestados',
      opciones: { method: 'POST', body: datosCrearAtest },
    },
    {
      ruta: '/profesores/mi-perfil/atestados/18',
      opciones: { method: 'PATCH', body: datosActAtest },
    },
    {
      ruta: '/profesores/mi-perfil/atestados/18/inactivar',
      opciones: { method: 'PATCH' },
    },
  ]);
  assert.equal('body' in llamadas[4].opciones, false);
});

test('conserva casos límite null/undefined, errores HTTP, rechazos y los 29 canales de Profesores modularizados', async () => {
  const { handlers: hEdge, llamadas } = crearArnes({ ok: true, data: null });

  await hEdge.get('profesores:actualizar-mis-carreras')(null, null);
  await hEdge.get('profesores:solicitar-perfil')(null, undefined);
  await hEdge.get('profesores:crear-atestado')(null, undefined);
  await hEdge.get('profesores:actualizar-atestado')(null, undefined, null);
  await hEdge.get('profesores:inactivar-mi-atestado')(null, null);

  assert.deepEqual(llamadas, [
    { ruta: '/profesores/mi-perfil/carreras', opciones: { method: 'PUT', body: { carreraIds: null } } },
    { ruta: '/profesores/mi-perfil/perfiles', opciones: { method: 'POST', body: { perfilAcademicoId: undefined } } },
    { ruta: '/profesores/mi-perfil/atestados', opciones: { method: 'POST', body: undefined } },
    { ruta: '/profesores/mi-perfil/atestados/undefined', opciones: { method: 'PATCH', body: null } },
    { ruta: '/profesores/mi-perfil/atestados/null/inactivar', opciones: { method: 'PATCH' } },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Dato requerido.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permiso.' },
    { ok: false, status: 409, message: 'Duplicado.' },
    { ok: false, status: 0, message: 'Sin conexión.' },
  ]) {
    const { handlers } = crearArnes(errorHttp);
    for (const [canal, args] of [
      ['profesores:actualizar-mis-carreras', [null, []]],
      ['profesores:solicitar-perfil', [null, 1]],
      ['profesores:crear-atestado', [null, {}]],
      ['profesores:actualizar-atestado', [null, 1, {}]],
      ['profesores:inactivar-mi-atestado', [null, 1]],
    ]) {
      assert.equal(await handlers.get(canal)(...args), errorHttp);
    }
  }

  const rechazo = new Error('Timeout');
  const { handlers: hRechazo } = crearArnes(() => Promise.reject(rechazo));
  await assert.rejects(
    hRechazo.get('profesores:inactivar-mi-atestado')(null, 1),
    (err) => err === rechazo,
  );

  assert.deepEqual(mainSource.match(/['"]profesores:[^'"]+['"]/g) || [], []);

  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const canalesProfesores = [];
  for (const archivo of readdirSync(ipcDir).filter((n) => /^profesores.*\.ipc\.js$/.test(n)).sort()) {
    const src = readFileSync(path.join(ipcDir, archivo), 'utf8');
    for (const match of src.matchAll(/['"](profesores:[^'"]+)['"]/g)) canalesProfesores.push(match[1]);
  }
  assert.equal(canalesProfesores.length, 29);
  assert.equal(new Set(canalesProfesores).size, 29);
});
