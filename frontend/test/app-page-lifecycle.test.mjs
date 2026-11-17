import test from 'node:test';
import assert from 'node:assert/strict';

import {
  obtenerCicloVidaPagina,
  obtenerIdsPaginasImplementadas,
} from '../src/app/page-lifecycle.js';
import { obtenerModuloPorId } from '../src/config/modules.js';

test('el registro de páginas vincula una sola vez los renderizadores e inicializadores', () => {
  const ids = obtenerIdsPaginasImplementadas();
  assert.equal(new Set(ids).size, ids.length);

  for (const id of ids) {
    const ciclo = obtenerCicloVidaPagina(id);
    assert.equal(typeof ciclo.render, 'function', `${id} debe tener renderizador`);
    assert.ok(obtenerModuloPorId(id), `${id} debe corresponder a un módulo registrado`);
    assert.equal(Object.isFrozen(ciclo), true, `${id} debe tener su definición protegida`);
  }

  assert.equal(typeof obtenerCicloVidaPagina('dashboard').initialize, 'undefined');
  for (const id of ids.filter((pageId) => pageId !== 'dashboard')) {
    assert.equal(
      typeof obtenerCicloVidaPagina(id).initialize,
      'function',
      `${id} debe conservar su inicializador de página`,
    );
  }
});

test('el registro no asigna páginas a módulos desconocidos', () => {
  assert.equal(obtenerCicloVidaPagina('no-existe'), null);
  assert.equal(obtenerCicloVidaPagina('constructor'), null);
  assert.equal(obtenerCicloVidaPagina('__proto__'), null);
});

test('las páginas con consultas prolongadas declaran destructores opcionales y Login conserva su ciclo especial', () => {
  assert.equal(typeof obtenerCicloVidaPagina('profesores').destroy, 'function');
  assert.equal(typeof obtenerCicloVidaPagina('estudiantes').destroy, 'function');
  assert.equal(typeof obtenerCicloVidaPagina('formularios-estudiantes').destroy, 'function');
  assert.equal(typeof obtenerCicloVidaPagina('usuarios').destroy, 'function');
  assert.equal(typeof obtenerCicloVidaPagina('mis-asistentes').destroy, 'function');
  assert.equal(typeof obtenerCicloVidaPagina('cursos').destroy, 'function');
  assert.equal(typeof obtenerCicloVidaPagina('periodos').destroy, 'function');
  assert.equal(typeof obtenerCicloVidaPagina('planes-estudio').destroy, 'function');
  assert.equal(typeof obtenerCicloVidaPagina('perfiles-academicos').destroy, 'function');
  assert.equal(typeof obtenerCicloVidaPagina('dashboard').destroy, 'undefined');
  assert.equal(typeof obtenerCicloVidaPagina('aulas').destroy, 'undefined');
  assert.equal(obtenerCicloVidaPagina('login'), null);
});
