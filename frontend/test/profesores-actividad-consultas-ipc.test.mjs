import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarProfesoresActividadConsultasIpc } from '../src/electron/ipc/profesores-actividad-consultas.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(path.join(frontendDir, 'src', 'preload.js'), 'utf8');
const mainSource = readFileSync(path.join(frontendDir, 'src', 'main.js'), 'utf8');

const CANALES_ACTIVIDAD = [
  'profesores:mis-atestados',
  'profesores:mis-proyectos',
];

function crearArnes(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  registrarProfesoresActividadConsultasIpc({
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

test('registra una sola vez los dos canales de actividad compatibles con preload.js y main.js', () => {
  const { handlers } = crearArnes({ ok: true, data: [] });
  assert.deepEqual([...handlers.keys()], CANALES_ACTIVIDAD);
  assert.equal(new Set(handlers.keys()).size, 2);

  assert.match(
    preloadSource,
    /listarMisAtestadosProfesor:\s*\(\)\s*=>[\s\S]*?'profesores:mis-atestados'/,
  );
  assert.match(
    preloadSource,
    /listarMisProyectosProfesor:\s*\(\)\s*=>[\s\S]*?'profesores:mis-proyectos'/,
  );
  assert.equal(
    (mainSource.match(/registrarProfesoresActividadConsultasIpc\s*\(/g) || []).length,
    1,
  );
});

test('ejecuta GET en los endpoints originales con passthrough directo y casos límite', async () => {
  const respuesta = { ok: true, data: [{ id: 21 }] };
  const { handlers, llamadas } = crearArnes(respuesta);

  assert.equal(await handlers.get('profesores:mis-atestados')(null, null), respuesta);
  assert.equal(await handlers.get('profesores:mis-proyectos')(null, undefined), respuesta);

  assert.deepEqual(llamadas, [
    { ruta: '/profesores/mi-perfil/atestados', opciones: undefined },
    { ruta: '/profesores/mi-perfil/proyectos', opciones: undefined },
  ]);
});

test('conserva mutaciones de atestados/proyectos en main, errores HTTP y rechazos sin alterarlos', async () => {
  for (const errorHttp of [
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permiso docente.' },
    { ok: false, status: 404, message: 'Recurso no encontrado.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnes(errorHttp);
    for (const canal of CANALES_ACTIVIDAD) {
      assert.equal(await handlers.get(canal)(null), errorHttp);
    }
  }

  const rechazo = new Error('Fallo de red');
  const { handlers: hRechazo } = crearArnes(() => Promise.reject(rechazo));
  await assert.rejects(
    hRechazo.get('profesores:mis-proyectos')(null),
    (err) => err === rechazo,
  );

  for (const canal of CANALES_ACTIVIDAD) {
    assert.equal((mainSource.match(new RegExp(`['"]${canal}['"]`, 'g')) || []).length, 0);
  }
  for (const escritura of [
    'profesores:crear-atestado',
    'profesores:actualizar-atestado',
    'profesores:inactivar-mi-atestado',
    'profesores:crear-proyecto',
    'profesores:actualizar-proyecto',
    'profesores:cambiar-estado-proyecto',
  ]) {
    assert.match(mainSource, new RegExp(`['"]${escritura}['"]`));
  }
});
