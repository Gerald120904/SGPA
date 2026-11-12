import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarProfesoresConsultasIpc } from '../src/electron/ipc/profesores-consultas.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(path.join(frontendDir, 'src', 'preload.js'), 'utf8');
const mainSource = readFileSync(path.join(frontendDir, 'src', 'main.js'), 'utf8');

const CANALES_EXTRAIDOS = [
  'profesores:listar',
  'profesores:obtener',
  'profesores:disponibilidad',
];

function crearArnes(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  registrarProfesoresConsultasIpc({
    ipcMain: {
      handle(canal, handler) {
        assert.equal(handlers.has(canal), false, `Canal duplicado: ${canal}`);
        handlers.set(canal, handler);
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

test('registra una sola vez los tres canales y conserva sus contratos de preload', () => {
  const { handlers } = crearArnes({ ok: true, data: [] });
  assert.deepEqual([...handlers.keys()], CANALES_EXTRAIDOS);
  assert.equal(new Set(handlers.keys()).size, 3);

  assert.match(
    preloadSource,
    /listarProfesores:\s*\(filtros\s*=\s*\{\}\)\s*=>[\s\S]*?'profesores:listar',\s*filtros/,
  );
  assert.match(
    preloadSource,
    /obtenerProfesor:\s*\(id\)\s*=>[\s\S]*?'profesores:obtener',\s*id/,
  );
  assert.match(
    preloadSource,
    /obtenerDisponibilidadProfesor:\s*\([\s\S]*?profesorId,\s*periodoId[\s\S]*?\)\s*=>[\s\S]*?'profesores:disponibilidad',\s*profesorId,\s*periodoId/,
  );
  assert.equal((mainSource.match(/registrarProfesoresConsultasIpc\s*\(/g) || []).length, 1);
});

test('lista con query codificada y conserva el wrapper de éxito', async () => {
  const profesores = [{ id: 8, nombre: 'Ana' }];
  const { handlers, llamadas } = crearArnes({ ok: true, data: profesores });
  const filtros = { nombre: 'Ana & José', activo: false, omitido: null, sinValor: undefined };

  assert.deepEqual(
    await handlers.get('profesores:listar')(null, filtros),
    { ok: true, profesores },
  );
  assert.deepEqual(llamadas, [
    { ruta: '/profesores?nombre=Ana+%26+Jos%C3%A9&activo=false', opciones: undefined },
  ]);
});

test('conserva filtros por defecto, ruta sin query y el error explícito para filtros null', async () => {
  const { handlers, llamadas } = crearArnes({ ok: true, data: [] });
  assert.deepEqual(await handlers.get('profesores:listar')(null), { ok: true, profesores: [] });
  assert.deepEqual(await handlers.get('profesores:listar')(null, {}), { ok: true, profesores: [] });
  assert.deepEqual(llamadas, [
    { ruta: '/profesores', opciones: undefined },
    { ruta: '/profesores', opciones: undefined },
  ]);
  await assert.rejects(handlers.get('profesores:listar')(null, null), TypeError);
});

test('detalle y disponibilidad mantienen argumentos, rutas y retorno directo', async () => {
  const detalle = { ok: true, data: { id: 17 } };
  const disponibilidad = { ok: true, data: [{ periodoId: 4 }] };
  const { handlers: handlersDetalle, llamadas: llamadasDetalle } = crearArnes(detalle);
  const { handlers: handlersDisp, llamadas: llamadasDisp } = crearArnes(disponibilidad);

  assert.equal(await handlersDetalle.get('profesores:obtener')(null, 17), detalle);
  assert.deepEqual(llamadasDetalle, [{ ruta: '/profesores/17', opciones: undefined }]);

  assert.equal(await handlersDisp.get('profesores:disponibilidad')(null, 17, 4), disponibilidad);
  assert.deepEqual(llamadasDisp, [
    { ruta: '/profesores/17/disponibilidad/4', opciones: undefined },
  ]);
});

test('conserva null/undefined, propaga errores y no cambia rechazos', async () => {
  const errorHttp = { ok: false, status: 403, message: 'Sin permiso.' };
  const { handlers: handlersError, llamadas: llamadasError } = crearArnes(errorHttp);

  assert.equal(await handlersError.get('profesores:listar')(null, {}), errorHttp);
  assert.equal(await handlersError.get('profesores:obtener')(null, null), errorHttp);
  assert.equal(await handlersError.get('profesores:disponibilidad')(null, undefined, null), errorHttp);
  assert.deepEqual(llamadasError, [
    { ruta: '/profesores', opciones: undefined },
    { ruta: '/profesores/null', opciones: undefined },
    { ruta: '/profesores/undefined/disponibilidad/null', opciones: undefined },
  ]);

  const rejection = new Error('Fallo de red');
  const { handlers } = crearArnes(() => Promise.reject(rejection));
  await assert.rejects(
    handlers.get('profesores:disponibilidad')(null, 1, 2),
    (error) => error === rejection,
  );
});

test('la extracción retira esos tres canales y conserva los 29 canales de Profesores sin duplicados', () => {
  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const profesoresFiles = [
    'src/main.js',
    ...readdirSync(ipcDir)
      .filter((name) => /^profesores.*\.ipc\.js$/.test(name))
      .sort()
      .map((name) => path.join('src', 'electron', 'ipc', name)),
  ];
  const moduleSource = readFileSync(
    path.join(ipcDir, 'profesores-consultas.ipc.js'),
    'utf8',
  );
  const extractedModuleChannels = [...moduleSource.matchAll(/['"](profesores:[^'"]+)['"]/g)]
    .map((match) => match[1]);
  const allProfesoresChannels = [];
  for (const relativePath of profesoresFiles) {
    const source = readFileSync(path.join(frontendDir, relativePath), 'utf8');
    for (const match of source.matchAll(/['"](profesores:[^'"]+)['"]/g)) {
      allProfesoresChannels.push(match[1]);
    }
  }

  assert.equal(extractedModuleChannels.length, 3);
  assert.equal(new Set(extractedModuleChannels).size, 3);
  assert.equal(allProfesoresChannels.length, 29);
  assert.equal(new Set(allProfesoresChannels).size, 29);

  for (const canal of CANALES_EXTRAIDOS) {
    assert.equal((mainSource.match(new RegExp(`['"]${canal}['"]`, 'g')) || []).length, 0);
  }
  const combinedProfesoresSource = profesoresFiles
    .map((relativePath) => readFileSync(path.join(frontendDir, relativePath), 'utf8'))
    .join('\n');
  for (const canal of [
    'profesores:expediente-perfil',
    'profesores:revisar-requisito-perfil',
    'profesores:mi-perfil',
    'profesores:mis-carreras-disponibles',
    'profesores:crear-atestado',
    'profesores:mis-proyectos',
    'profesores:periodos-mi-disponibilidad',
    'profesores:historial-mi-disponibilidad',
  ]) {
    assert.match(combinedProfesoresSource, new RegExp(`['"]${canal}['"]`));
  }
});

test('los 32 canales IPC de Aulas permanecen registrados sin duplicados', () => {
  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const aulasModules = [
    'src/main.js',
    ...readdirSync(ipcDir)
      .filter((name) => /^aulas.*\.ipc\.js$/.test(name))
      .sort()
      .map((name) => path.join('src', 'electron', 'ipc', name)),
  ];
  const canales = [];
  for (const relativePath of aulasModules) {
    const source = readFileSync(path.join(frontendDir, relativePath), 'utf8');
    for (const match of source.matchAll(/[\'"](aulas:[^\'"]+)[\'"]/g)) canales.push(match[1]);
  }
  assert.equal(canales.length, 32);
  assert.equal(new Set(canales).size, 32);
});
