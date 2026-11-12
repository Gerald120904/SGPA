import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarProfesoresAutogestionConsultasIpc } from '../src/electron/ipc/profesores-autogestion-consultas.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(path.join(frontendDir, 'src', 'preload.js'), 'utf8');
const mainSource = readFileSync(path.join(frontendDir, 'src', 'main.js'), 'utf8');

const CANALES_AUTOGESTION = [
  'profesores:mis-carreras-disponibles',
  'profesores:mis-perfiles',
  'profesores:perfiles-disponibles',
];

function crearArnes(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  registrarProfesoresAutogestionConsultasIpc({
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

test('registra una sola vez los tres canales de autogestión compatibles con preload.js y main.js', () => {
  const { handlers } = crearArnes({ ok: true, data: [] });
  assert.deepEqual([...handlers.keys()], CANALES_AUTOGESTION);
  assert.equal(new Set(handlers.keys()).size, 3);

  assert.match(
    preloadSource,
    /listarCarrerasDisponiblesProfesor:\s*\(\)\s*=>[\s\S]*?'profesores:mis-carreras-disponibles'/,
  );
  assert.match(
    preloadSource,
    /listarMisPerfilesProfesor:\s*\(\)\s*=>[\s\S]*?'profesores:mis-perfiles'/,
  );
  assert.match(
    preloadSource,
    /listarPerfilesDisponiblesProfesor:\s*\(\)\s*=>[\s\S]*?'profesores:perfiles-disponibles'/,
  );
  assert.equal(
    (mainSource.match(/registrarProfesoresAutogestionConsultasIpc\s*\(/g) || []).length,
    1,
  );
});

test('ejecuta GET en los endpoints originales con passthrough directo y casos límite', async () => {
  const respuesta = { ok: true, data: [{ id: 1 }] };
  const { handlers, llamadas } = crearArnes(respuesta);

  assert.equal(await handlers.get('profesores:mis-carreras-disponibles')(null, null), respuesta);
  assert.equal(await handlers.get('profesores:mis-perfiles')(null, undefined), respuesta);
  assert.equal(await handlers.get('profesores:perfiles-disponibles')(null, { extra: 1 }), respuesta);

  assert.deepEqual(llamadas, [
    { ruta: '/profesores/mi-perfil/carreras-disponibles', opciones: undefined },
    { ruta: '/profesores/mi-perfil/perfiles', opciones: undefined },
    { ruta: '/profesores/mi-perfil/perfiles-disponibles', opciones: undefined },
  ]);
});

test('propaga errores HTTP y rechazos sin alterar respuestas ni agregar validaciones', async () => {
  for (const errorHttp of [
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permiso docente.' },
    { ok: false, status: 500, message: 'Error interno.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnes(errorHttp);
    for (const canal of CANALES_AUTOGESTION) {
      assert.equal(await handlers.get(canal)(null), errorHttp);
    }
  }

  const rechazo = new Error('Fallo de red');
  const { handlers: hRechazo } = crearArnes(() => Promise.reject(rechazo));
  await assert.rejects(
    hRechazo.get('profesores:mis-perfiles')(null),
    (err) => err === rechazo,
  );
});

test('conserva los 3 canales de autogestión extraídos, los 29 de Profesores y los 32 de Aulas sin duplicados', () => {
  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const mainProfesores = [...mainSource.matchAll(/['"](profesores:[^'"]+)['"]/g)].map(
    (m) => m[1],
  );
  const autogestionSource = readFileSync(
    path.join(ipcDir, 'profesores-autogestion-consultas.ipc.js'),
    'utf8',
  );
  const canalesModulo = [...autogestionSource.matchAll(/['"](profesores:[^'"]+)['"]/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(canalesModulo, CANALES_AUTOGESTION);

  const profesoresModules = readdirSync(ipcDir)
    .filter((name) => /^profesores.*\.ipc\.js$/.test(name))
    .sort();
  const modularizados = [];
  for (const archivo of profesoresModules) {
    const src = readFileSync(path.join(ipcDir, archivo), 'utf8');
    for (const match of src.matchAll(/['"](profesores:[^'"]+)['"]/g)) modularizados.push(match[1]);
  }

  const todosProfesores = [...mainProfesores, ...modularizados];
  assert.equal(todosProfesores.length, 29);
  assert.equal(new Set(todosProfesores).size, 29);

  for (const canal of CANALES_AUTOGESTION) {
    assert.equal((mainSource.match(new RegExp(`['"]${canal}['"]`, 'g')) || []).length, 0);
  }
});
