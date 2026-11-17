import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarProfesoresProyectosIpc } from '../src/electron/ipc/profesores-proyectos.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(path.join(frontendDir, 'src', 'preload.js'), 'utf8');
const mainSource = readFileSync(path.join(frontendDir, 'src', 'main.js'), 'utf8');

const CANALES_PROYECTOS = [
  'profesores:crear-proyecto',
  'profesores:actualizar-proyecto',
  'profesores:cambiar-estado-proyecto',
];

function crearArnes(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  registrarProfesoresProyectosIpc({
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

test('registra una sola vez los 3 canales de proyectos compatibles con preload.js y main.js', () => {
  const { handlers } = crearArnes({ ok: true });
  assert.deepEqual([...handlers.keys()], CANALES_PROYECTOS);
  assert.equal(new Set(handlers.keys()).size, 3);

  assert.match(
    preloadSource,
    /crearProyectoProfesor:\s*\(datos\)\s*=>[\s\S]*?'profesores:crear-proyecto',\s*datos/,
  );
  assert.match(
    preloadSource,
    /actualizarProyectoProfesor:\s*\([\s\S]*?proyectoId,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'profesores:actualizar-proyecto',\s*proyectoId,\s*datos/,
  );
  assert.match(
    preloadSource,
    /cambiarEstadoProyectoProfesor:\s*\([\s\S]*?proyectoId,\s*activo[\s\S]*?\)\s*=>[\s\S]*?'profesores:cambiar-estado-proyecto',\s*proyectoId,\s*activo/,
  );
  assert.equal((mainSource.match(/registrarProfesoresProyectosIpc\s*\(/g) || []).length, 1);
});

test('envía métodos, rutas, cuerpos JSON (incluyendo activo: false) y respuestas exitosas exactas', async () => {
  const respuestaOk = { ok: true, data: { id: 42, activo: false } };
  const { handlers, llamadas } = crearArnes(respuestaOk);

  const datosCrear = { nombre: 'Laboratorio de Robótica', tipo: 'LABORATORIO' };
  const datosActualizar = { nombre: 'Laboratorio de Robótica Avanzada' };

  assert.equal(await handlers.get('profesores:crear-proyecto')(null, datosCrear), respuestaOk);
  assert.equal(
    await handlers.get('profesores:actualizar-proyecto')(null, 42, datosActualizar),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:cambiar-estado-proyecto')(null, 42, false),
    respuestaOk,
  );

  assert.deepEqual(llamadas, [
    {
      ruta: '/profesores/mi-perfil/proyectos',
      opciones: { method: 'POST', body: datosCrear },
    },
    {
      ruta: '/profesores/mi-perfil/proyectos/42',
      opciones: { method: 'PATCH', body: datosActualizar },
    },
    {
      ruta: '/profesores/mi-perfil/proyectos/42/estado',
      opciones: { method: 'PATCH', body: { activo: false } },
    },
  ]);
});

test('conserva casos límite null/undefined, errores HTTP y rechazos sin permanecer en main.js', async () => {
  const { handlers: hEdge, llamadas } = crearArnes({ ok: true, data: null });

  await hEdge.get('profesores:crear-proyecto')(null, undefined);
  await hEdge.get('profesores:actualizar-proyecto')(null, null, null);
  await hEdge.get('profesores:cambiar-estado-proyecto')(null, 42, undefined);

  assert.deepEqual(llamadas, [
    { ruta: '/profesores/mi-perfil/proyectos', opciones: { method: 'POST', body: undefined } },
    { ruta: '/profesores/mi-perfil/proyectos/null', opciones: { method: 'PATCH', body: null } },
    {
      ruta: '/profesores/mi-perfil/proyectos/42/estado',
      opciones: { method: 'PATCH', body: { activo: undefined } },
    },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Datos inválidos.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permiso.' },
    { ok: false, status: 404, message: 'Proyecto no encontrado.' },
    { ok: false, status: 0, message: 'Sin conexión.' },
  ]) {
    const { handlers } = crearArnes(errorHttp);
    assert.equal(await handlers.get('profesores:crear-proyecto')(null, {}), errorHttp);
    assert.equal(await handlers.get('profesores:actualizar-proyecto')(null, 1, {}), errorHttp);
    assert.equal(await handlers.get('profesores:cambiar-estado-proyecto')(null, 1, true), errorHttp);
  }

  const rechazo = new Error('Fallo de red');
  const { handlers: hRechazo } = crearArnes(() => Promise.reject(rechazo));
  await assert.rejects(
    hRechazo.get('profesores:cambiar-estado-proyecto')(null, 1, false),
    (err) => err === rechazo,
  );

  for (const canal of CANALES_PROYECTOS) {
    assert.equal((mainSource.match(new RegExp(`['"]${canal}['"]`, 'g')) || []).length, 0);
  }
});
