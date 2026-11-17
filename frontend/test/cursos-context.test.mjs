import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoCursos, reiniciarEstadoCursos } from '../src/pages/cursos/cursos.context.js';

test('Cursos mantiene una única fuente de estado académico y reinicia solo los datos de vista', () => {
  const instancia = estadoCursos.instanciaActual;
  const seleccion = estadoCursos.seleccionCarreraActual;
  estadoCursos.cursos = [{ id: 1 }];
  estadoCursos.carrerasDisponibles = [{ id: 2 }];
  estadoCursos.planesDisponibles = [{ id: 3 }];
  estadoCursos.carreraSeleccionadaId = 2;
  estadoCursos.planCarreraSeleccionado = { id: 3 };
  estadoCursos.asignaturasPlanCarrera = [{ id: 4 }];
  estadoCursos.requisitosPlanCarrera = [{ id: 5 }];
  estadoCursos.paginaCursos = 4;

  reiniciarEstadoCursos();

  assert.deepEqual(estadoCursos.cursos, []);
  assert.deepEqual(estadoCursos.carrerasDisponibles, []);
  assert.deepEqual(estadoCursos.planesDisponibles, []);
  assert.equal(estadoCursos.carreraSeleccionadaId, null);
  assert.equal(estadoCursos.planCarreraSeleccionado, null);
  assert.deepEqual(estadoCursos.asignaturasPlanCarrera, []);
  assert.deepEqual(estadoCursos.requisitosPlanCarrera, []);
  assert.equal(estadoCursos.paginaCursos, 1);
  assert.equal(estadoCursos.instanciaActual, instancia);
  assert.equal(estadoCursos.seleccionCarreraActual, seleccion);
});
