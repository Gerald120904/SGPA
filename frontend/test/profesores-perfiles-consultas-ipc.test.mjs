import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarProfesoresPerfilesConsultasIpc } from '../src/electron/ipc/profesores-perfiles-consultas.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(
  path.join(frontendDir, 'src', 'preload.js'),
  'utf8',
);
const mainSource = readFileSync(
  path.join(frontendDir, 'src', 'main.js'),
  'utf8',
);

const CANALES_PERFILES_CONSULTAS = [
  'profesores:expediente-perfil',
  'profesores:mi-expediente-perfil',
  'profesores:mi-perfil',
];

function crearArnes(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  registrarProfesoresPerfilesConsultasIpc({
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

test('registra una sola vez los tres canales compatibles con preload.js y main.js', () => {
  const { handlers } = crearArnes({ ok: true, data: {} });
  assert.deepEqual([...handlers.keys()], CANALES_PERFILES_CONSULTAS);
  assert.equal(new Set(handlers.keys()).size, 3);

  assert.match(
    preloadSource,
    /obtenerExpedientePerfilProfesor:\s*\(profesorId,\s*perfilId\)\s*=>[\s\S]*?"profesores:expediente-perfil",\s*profesorId,\s*perfilId/,
  );
  assert.match(
    preloadSource,
    /obtenerMiExpedientePerfilProfesor:\s*\(perfilId\)\s*=>[\s\S]*?"profesores:mi-expediente-perfil",\s*perfilId/,
  );
  assert.match(
    preloadSource,
    /obtenerMiPerfilProfesor:\s*\(\)\s*=>[\s\S]*?'profesores:mi-perfil'/,
  );
  assert.equal(
    (mainSource.match(/registrarProfesoresPerfilesConsultasIpc\s*\(/g) || []).length,
    1,
  );
});
test('ejecuta GET en las rutas exactas con retorno directo y sin opciones extra', async () => {
  const respuesta = { ok: true, data: { id: 15, requisitos: [] } };
  const { handlers, llamadas } = crearArnes(respuesta);

  assert.equal(
    await handlers.get('profesores:expediente-perfil')(null, 7, 12),
    respuesta,
  );
  assert.equal(
    await handlers.get('profesores:mi-expediente-perfil')(null, 12),
    respuesta,
  );
  assert.equal(await handlers.get('profesores:mi-perfil')(null), respuesta);

  assert.deepEqual(llamadas, [
    { ruta: '/profesores/7/perfiles/12/expediente', opciones: undefined },
    { ruta: '/profesores/mi-perfil/perfiles/12/expediente', opciones: undefined },
    { ruta: '/profesores/mi-perfil', opciones: undefined },
  ]);
});

test('conserva casos límite null/undefined, errores HTTP y rechazos de transporte', async () => {
  const { handlers: handlersEdge, llamadas } = crearArnes({ ok: true, data: null });

  await handlersEdge.get('profesores:expediente-perfil')(null, null, undefined);
  await handlersEdge.get('profesores:mi-expediente-perfil')(null, undefined);
  await handlersEdge.get('profesores:mi-perfil')(null, 'argumentoIgnorado');

  assert.deepEqual(llamadas, [
    { ruta: '/profesores/null/perfiles/undefined/expediente', opciones: undefined },
    { ruta: '/profesores/mi-perfil/perfiles/undefined/expediente', opciones: undefined },
    { ruta: '/profesores/mi-perfil', opciones: undefined },
  ]);

  for (const errorHttp of [
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permisos para consultar expedientes.' },
    { ok: false, status: 404, message: 'Expediente no encontrado.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnes(errorHttp);
    assert.equal(await handlers.get('profesores:expediente-perfil')(null, 1, 2), errorHttp);
    assert.equal(await handlers.get('profesores:mi-expediente-perfil')(null, 2), errorHttp);
    assert.equal(await handlers.get('profesores:mi-perfil')(null), errorHttp);
  }

  const rechazo = new Error('Fallo de red');
  const { handlers: handlersRechazo } = crearArnes(() => Promise.reject(rechazo));
  await assert.rejects(
    handlersRechazo.get('profesores:mi-perfil')(null),
    (err) => err === rechazo,
  );
});

test('conserva los 3 canales extraídos, los 29 canales de Profesores y 32 canales de Aulas sin duplicados', () => {
  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const mainProfesores = [...mainSource.matchAll(/['"](profesores:[^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  for (const canal of CANALES_PERFILES_CONSULTAS) {
    assert.equal((mainSource.match(new RegExp(`['"]${canal}['"]`, 'g')) || []).length, 0);
  }

  const perfilesConsultasSource = readFileSync(
    path.join(ipcDir, 'profesores-perfiles-consultas.ipc.js'),
    'utf8',
  );
  const canalesModulo = [
    ...perfilesConsultasSource.matchAll(/['"](profesores:[^'"]+)['"]/g),
  ].map((match) => match[1]);
  assert.deepEqual(canalesModulo, CANALES_PERFILES_CONSULTAS);

  const profesoresModules = readdirSync(ipcDir)
    .filter((name) => /^profesores.*\.ipc\.js$/.test(name))
    .sort();
  const todosProfesores = [...mainProfesores];
  for (const archivo of profesoresModules) {
    const source = readFileSync(path.join(ipcDir, archivo), 'utf8');
    for (const match of source.matchAll(/['"](profesores:[^'"]+)['"]/g)) {
      todosProfesores.push(match[1]);
    }
  }
  assert.equal(todosProfesores.length, 29);
  assert.equal(new Set(todosProfesores).size, 29);

  const aulasModules = readdirSync(ipcDir)
    .filter((name) => /^aulas.*\.ipc\.js$/.test(name))
    .sort();
  assert.equal(aulasModules.length, 8);
  const todosAulas = [];
  for (const archivo of aulasModules) {
    const source = readFileSync(path.join(ipcDir, archivo), 'utf8');
    for (const match of source.matchAll(/['"](aulas:[^'"]+)['"]/g)) {
      todosAulas.push(match[1]);
    }
  }
  assert.equal(todosAulas.length, 32);
  assert.equal(new Set(todosAulas).size, 32);
});
