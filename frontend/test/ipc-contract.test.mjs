import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const srcDir = path.join(frontendDir, 'src');
const preloadSource = await readFile(path.join(srcDir, 'preload.js'), 'utf8');
const mainSource = await readFile(path.join(srcDir, 'main.js'), 'utf8');

function extraerMetodosPreload(source) {
  const pattern = /^ {2}([A-Za-z_$][\w$]*):/gm;
  const matches = [...source.matchAll(pattern)];
  const methods = new Map();

  matches.forEach((match, index) => {
    const end = matches[index + 1]?.index ?? source.length;
    const block = source.slice(match.index, end);
    const channel = block.match(/ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/)?.[1];
    methods.set(match[1], channel);
  });

  return methods;
}

function extraerManejadoresLiterales(source) {
  return [...source.matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
}

function extraerManejadoresDinamicos(source) {
  const handlers = [];
  const loopPattern = /for\s*\(\s*const\s+(\w+)\s+of\s+\[([^\]]+)\]\s*\)/g;

  for (const loop of source.matchAll(loopPattern)) {
    const variable = loop[1];
    const values = [...loop[2].matchAll(/['"]([^'"]+)['"]/g)].map(
      (match) => match[1],
    );
    const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const handlePattern = new RegExp(
      'ipcMain\\.handle\\(\\s*`([^`]*\\$\\{' +
        escapedVariable +
        '\\}[^`]*)`',
      'g',
    );

    for (const handle of source.matchAll(handlePattern)) {
      values.forEach((value) => {
        handlers.push(handle[1].replace(`\${${variable}}`, value));
      });
    }
  }

  return handlers;
}

async function leerFuentesJs(directorio) {
  const entries = await readdir(directorio, { withFileTypes: true });
  const sources = [];

  for (const entry of entries) {
    const fullPath = path.join(directorio, entry.name);
    if (entry.isDirectory()) {
      sources.push(...(await leerFuentesJs(fullPath)));
    } else if (entry.name.endsWith('.js')) {
      sources.push({ file: fullPath, source: await readFile(fullPath, 'utf8') });
    }
  }

  return sources;
}

const preloadMethods = extraerMetodosPreload(preloadSource);
const ipcSources = [
  { file: path.join(srcDir, 'main.js'), source: mainSource },
  ...(await leerFuentesJs(path.join(srcDir, 'electron', 'ipc'))),
];
const registeredHandlers = ipcSources.flatMap(({ source }) => [
  ...extraerManejadoresLiterales(source),
  ...extraerManejadoresDinamicos(source),
]);

test('cada método requerido por los servicios existe en preload', async () => {
  const serviceSources = await leerFuentesJs(path.join(srcDir, 'services'));
  const requiredMethods = new Set();

  for (const { source } of serviceSources) {
    for (const match of source.matchAll(
      /(?:validarApi|exigirApi)\(\s*['"]([A-Za-z_$][\w$]*)['"]/g,
    )) {
      requiredMethods.add(match[1]);
    }
    for (const match of source.matchAll(
      /window\.sgpa\s*\.\s*([A-Za-z_$][\w$]*)/g,
    )) {
      requiredMethods.add(match[1]);
    }
  }

  const missing = [...requiredMethods].filter(
    (method) => !preloadMethods.has(method),
  );
  assert.deepEqual(missing, []);
});

test('cada canal invocado por preload tiene un manejador IPC registrado', () => {
  const registered = new Set(registeredHandlers);
  const missing = [...preloadMethods.entries()]
    .filter(([, channel]) => !channel || !registered.has(channel))
    .map(([method, channel]) => ({ method, channel }));

  assert.deepEqual(missing, []);
});

test('no existen manejadores IPC duplicados', () => {
  const duplicates = registeredHandlers.filter(
    (channel, index) => registeredHandlers.indexOf(channel) !== index,
  );
  assert.deepEqual([...new Set(duplicates)], []);
});

test('se conservan todos los contratos actuales de Aulas y Planes de Estudio', () => {
  const protectedChannels = [
    'planes-estudio:listar',
    'planes-estudio:obtener',
    'planes-estudio:crear',
    'planes-estudio:actualizar',
    'planes-estudio:cambiar-estado',
    'plan-reglas-optativas:obtener',
    'plan-reglas-optativas:guardar',
    'plan-reglas-optativas:eliminar',
    'plan-asignaturas:listar',
    'plan-asignaturas:obtener',
    'plan-asignaturas:crear',
    'plan-asignaturas:actualizar',
    'plan-asignaturas:cambiar-estado',
    'plan-asignaturas:carga-masiva',
    'plan-requisitos:listar',
    'plan-requisitos:crear',
    'plan-requisitos:eliminar',
    'plan-requisitos:carga-masiva',
    'salidas-academicas:listar',
    'salidas-academicas:crear',
    'salidas-academicas:actualizar',
    'salidas-academicas:cambiar-estado',
    'salidas-academicas:asignaturas',
    'plan-resumen:obtener',
    'plan-validaciones:validar',
    'plan-importacion:seleccionar-excel',
    'plan-importacion:validar',
    'plan-importacion:ejecutar',
    'plan-importacion:guardar-plantilla',
    'bloques-plan:listar',
    'bloques-plan:crear',
    'bloques-plan:actualizar',
    'bloques-plan:cambiar-estado',
    'aulas:listar',
    'aulas:obtener',
    'aulas:crear',
    'aulas:actualizar',
    'aulas:cambiar-estado',
    'aulas:equipamientos:listar',
    'aulas:equipamientos:crear',
    'aulas:equipamientos:actualizar',
    'aulas:equipamientos:cambiar-estado',
    'aulas:equipo-aula:listar',
    'aulas:equipo-aula:asignar',
    'aulas:equipo-aula:actualizar',
    'aulas:equipo-aula:desasignar',
    'aulas:equipo-aula:cambiar-estado',
    'aulas:indisponibilidades:listar',
    'aulas:indisponibilidades:obtener',
    'aulas:indisponibilidades:crear',
    'aulas:indisponibilidades:actualizar',
    'aulas:indisponibilidades:cambiar-estado',
    'aulas:reservas:listar',
    'aulas:reservas:obtener',
    'aulas:reservas:crear',
    'aulas:reservas:actualizar',
    'aulas:reservas:cambiar-estado',
    'aulas:ocupacion',
    'aulas:disponibilidades:listar',
    'aulas:disponibilidades:crear',
    'aulas:disponibilidades:actualizar',
    'aulas:disponibilidades:eliminar',
    'aulas:buscar-disponibles',
    'aulas:evaluar-asignacion',
    'aulas:auditoria:listar',
  ];
  const exposed = new Set(preloadMethods.values());
  const registered = new Set(registeredHandlers);

  assert.deepEqual(
    protectedChannels.filter(
      (channel) => !exposed.has(channel) || !registered.has(channel),
    ),
    [],
  );
});

test('se conservan las integraciones nuevas de carreras del profesor', () => {
  assert.equal(
    preloadMethods.get('listarCarrerasDisponiblesProfesor'),
    'profesores:mis-carreras-disponibles',
  );
  assert.equal(
    preloadMethods.get('actualizarMisCarrerasProfesor'),
    'profesores:actualizar-mis-carreras',
  );
});

test('shell.openExternal solo recibe URLs de Google validadas', () => {
  const calls = [...mainSource.matchAll(/shell\.openExternal\(([^)]+)\)/g)].map(
    (match) => match[1].trim(),
  );

  assert.deepEqual(calls, ['urlValidada', 'urlValidada']);
  assert.match(mainSource, /url\.protocol !== ["']https:["']/);
  assert.match(mainSource, /HOSTS_OAUTH_GOOGLE_PERMITIDOS/);
  assert.match(mainSource, /HOSTS_FORMULARIOS_GOOGLE_PERMITIDOS/);
});

test('cada API de Electron utilizada en main está importada', () => {
  const importMatch = mainSource.match(
    /import\s*\{([^}]+)\}\s*from\s*["']electron["']\s*;/,
  );
  assert.ok(importMatch, 'No se encontró el import nombrado de Electron.');

  const imported = new Set(
    importMatch[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const electronApis = [
    'app',
    'BrowserWindow',
    'ipcMain',
    'net',
    'shell',
  ];
  const used = electronApis.filter((name) =>
    new RegExp(`\\b${name}\\s*(?:\\.|\\()`).test(mainSource),
  );

  assert.deepEqual(
    used.filter((name) => !imported.has(name)),
    [],
  );
});

test('cada icono Lucide estático utilizado está registrado', async () => {
  const iconSource = await readFile(path.join(srcDir, 'utils', 'icons.js'), 'utf8');
  const registry = iconSource.match(/icons:\s*\{([\s\S]*?)\n\s*\}/)?.[1];
  assert.ok(registry, 'No se encontró el registro de iconos Lucide.');

  const registered = new Set(registry.match(/\b[A-Z][A-Za-z0-9]*\b/g) ?? []);
  const sourceFiles = await leerFuentesJs(srcDir);
  const used = new Set();

  for (const { source } of sourceFiles) {
    for (const match of source.matchAll(/data-lucide=["']([a-z0-9-]+)["']/g)) {
      used.add(
        match[1]
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(''),
      );
    }
  }

  ['RotateCcw', 'UserRound', 'MonitorCog', 'FileCheck'].forEach((name) =>
    used.add(name),
  );

  assert.deepEqual(
    [...used].filter((name) => !registered.has(name)).sort(),
    [],
  );
});
