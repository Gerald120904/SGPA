import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agruparAsignaturasVistaPrevia } from '../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js';

test('la vista previa conserva nombres, códigos, año y ciclo reales', () => {
  const cursos = [
    { id: 1, nivel: 1, ciclo: 1, orden: 2, curso: { nombre: 'Matemática General', codigo: 'MAT101' } },
    { id: 2, nivel: 1, ciclo: 1, orden: 1, curso: { nombre: 'Programación I', codigo: 'EIF101' } },
    { id: 3, nivel: 2, ciclo: 2, orden: 1, curso: { nombre: 'Bases de Datos', codigo: 'EIF201' } },
  ];
  const grupos = agruparAsignaturasVistaPrevia(cursos);
  assert.deepEqual(grupos.get(1).get(1), cursos.slice(0, 2));
  assert.deepEqual(grupos.get(2).get(2), [cursos[2]]);
  assert.match(readFileSync(new URL('../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js', import.meta.url), 'utf8'), /escapeHtml\(asignatura\.curso\?\.nombre \|\| asignatura\.nombreReferencia/);
});

test('agregar requisito refresca solo la lista y conserva el diálogo', () => {
  const fuente = readFileSync(new URL('../src/pages/planes-estudio/PlanesEstudioPage.js', import.meta.url), 'utf8');
  const agregar = fuente.split('async function agregarRequisitoFrontend')[1].split('async function eliminarRequisitoFrontend')[0];
  assert.match(agregar, /actualizarListaRequisitos\(actualizada\)/);
  assert.doesNotMatch(agregar, /abrirFormularioRequisitos\(actualizada\)/);
  assert.match(agregar, /mostrarExito\(/);
});

test('el detalle de Aulas no expone controles de reservas', () => {
  const fuente = readFileSync(new URL('../src/pages/aulas/AulasPage.js', import.meta.url), 'utf8');
  const detalle = fuente.split('async function abrirDetalleAula(')[1].split('function renderizarEquipamientoDelAula')[0];
  assert.doesNotMatch(detalle, /nuevaReservaAulaButton|data-reserva-action|Reservas extraordinarias/);
  assert.match(fuente, /function renderizarSeccionOcupacion/);
});
