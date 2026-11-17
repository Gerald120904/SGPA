import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOMBRES_DIA,
  ORDEN_DIA,
  NOMBRES_ESTADO_PROFESOR,
  NOMBRES_TIPO_ATESTADO,
  NOMBRES_TIPO_REQUISITO,
  obtenerNombreCompleto,
  obtenerCarreras,
  obtenerPerfiles,
  obtenerCursos,
  nombreEstadoProfesor,
  nombreTipoAtestado,
  nombreTipoRequisito,
  tonoCumplimiento,
  nombreEstadoDisponibilidad,
  seleccionarPeriodoInicial,
  filtrarListaProfesores,
} from '../src/pages/profesores/profesores.helpers.js';

test('profesores.helpers — formateadores de nombres y estructuras de profesor', () => {
  const profesor = {
    nombres: 'Carlos Alberto',
    apellido1: 'Sánchez',
    apellido2: 'Gómez',
    carreras: [{ id: 1, nombre: 'Informática' }],
    perfilesAcademicos: [{ id: 10, codigo: 'PER-INF' }],
    cursosHabilitados: [{ id: 100, codigo: 'INF-101' }],
  };

  assert.equal(obtenerNombreCompleto(profesor), 'Carlos Alberto Sánchez Gómez');
  assert.equal(obtenerNombreCompleto({ nombres: 'Ana', apellido1: 'Rojas' }), 'Ana Rojas');
  assert.equal(obtenerNombreCompleto(null), '');

  assert.equal(obtenerCarreras(profesor).length, 1);
  assert.equal(obtenerPerfiles(profesor).length, 1);
  assert.equal(obtenerCursos(profesor).length, 1);
  assert.deepEqual(obtenerCarreras(null), []);
});

test('profesores.helpers — constantes y etiquetas de estado y atestado', () => {
  assert.equal(nombreEstadoProfesor('PENDIENTE'), 'Pendiente');
  assert.equal(nombreEstadoProfesor('APROBADO'), 'Aprobado');
  assert.equal(nombreEstadoProfesor('RECHAZADO'), 'Rechazado');
  assert.equal(nombreEstadoProfesor(null), '—');

  assert.equal(nombreTipoAtestado('TITULO_ACADEMICO'), 'Título académico');
  assert.equal(nombreTipoAtestado('CERTIFICACION'), 'Certificación');

  assert.equal(nombreTipoRequisito('FORMACION_ACADEMICA'), 'Formación académica');
  assert.equal(nombreTipoRequisito('JORNADA'), 'Jornada');

  assert.equal(tonoCumplimiento('CUMPLE'), 'success');
  assert.equal(tonoCumplimiento('NO_CUMPLE'), 'danger');
  assert.equal(tonoCumplimiento('NO_APLICA'), 'neutral');
  assert.equal(tonoCumplimiento('OTRO'), 'warning');

  assert.equal(nombreEstadoDisponibilidad('REGISTRADA'), 'Registrada');
  assert.equal(nombreEstadoDisponibilidad('BLOQUEADA'), 'Bloqueada');
  assert.equal(nombreEstadoDisponibilidad(null), 'Pendiente');
});

test('profesores.helpers — selección de periodo inicial con prioridad institucional y soporte de BORRADOR', () => {
  const periodos = [
    { id: 1, codigo: 'PER-1', estado: 'CERRADO' },
    { id: 2, codigo: 'PER-2', estado: 'BORRADOR' },
    { id: 3, codigo: 'PER-3', estado: 'EN_CURSO' },
    { id: 4, codigo: 'PER-4', estado: 'EN_PREPARACION' },
  ];

  // Prioridad 1: EN_PREPARACION
  assert.equal(seleccionarPeriodoInicial(periodos)?.id, 4);

  // Prioridad 2: EN_CURSO si no hay preparación
  assert.equal(seleccionarPeriodoInicial([periodos[0], periodos[1], periodos[2]])?.id, 3);

  // Prioridad 3: BORRADOR si no hay preparación ni en curso (restaurada según HEAD)
  assert.equal(seleccionarPeriodoInicial([periodos[0], periodos[1]])?.id, 2);

  // Prioridad 4 (Fallback): primer periodo si solo hay cerrados u otros estados
  assert.equal(seleccionarPeriodoInicial([periodos[0]])?.id, 1);
  const soloCerrados = [
    { id: 10, codigo: 'PER-10', estado: 'CERRADO' },
    { id: 11, codigo: 'PER-11', estado: 'INACTIVO' },
  ];
  assert.equal(seleccionarPeriodoInicial(soloCerrados)?.id, 10);

  // Sin periodos o lista vacía / nula
  assert.equal(seleccionarPeriodoInicial([]), null);
  assert.equal(seleccionarPeriodoInicial(null), null);
  assert.equal(seleccionarPeriodoInicial(undefined), null);
});

test('profesores.helpers — filtrado de profesores por nombre, cédula o carrera', () => {
  const lista = [
    { id: 1, nombres: 'Esteban', apellido1: 'Vargas', cedula: '109870654', email: 'evargas@una.ac.cr', carreras: [{ nombre: 'Informática' }] },
    { id: 2, nombres: 'María', apellido1: 'Quesada', cedula: '208760543', email: 'mquesada@una.ac.cr', carreras: [{ nombre: 'Matemática' }] },
  ];

  assert.equal(filtrarListaProfesores(lista, '').length, 2);
  assert.equal(filtrarListaProfesores(lista, 'vargas').length, 1);
  assert.equal(filtrarListaProfesores(lista, '10987').length, 1);
  assert.equal(filtrarListaProfesores(lista, 'matemática').length, 1);
  assert.equal(filtrarListaProfesores(lista, 'desconocido').length, 0);
});
