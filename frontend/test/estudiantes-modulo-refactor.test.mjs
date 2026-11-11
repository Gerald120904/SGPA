import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS_ESTUDIANTE,
  ORIGENES_ACADEMICOS_ESTUDIANTE,
  RESULTADOS_ACADEMICOS_ESTUDIANTE,
  obtenerTonoEstadoEstudiante,
  obtenerTonoEstadoSolicitud,
  extraerDataResultado,
  obtenerNombreCompletoEstudiante,
  formatearEstadoEstudiante,
  obtenerTextoAsignaturaEstudiante,
  obtenerTextoPeriodoEstudiante,
  esPeriodoIgualOPosterior,
  obtenerTextoPlanEstudiante,
  obtenerNombreResponsableEstudiante,
  formatearTextoEnumEstudiante,
} from '../src/pages/estudiantes/estudiantes.helpers.js';

test('estudiantes.helpers — constantes y formateadores de estado', () => {
  assert.equal(ESTADOS_ESTUDIANTE.length, 4);
  assert.equal(ORIGENES_ACADEMICOS_ESTUDIANTE.length, 4);
  assert.equal(RESULTADOS_ACADEMICOS_ESTUDIANTE.length, 2);

  assert.equal(obtenerTonoEstadoEstudiante('ACTIVO'), 'success');
  assert.equal(obtenerTonoEstadoEstudiante('GRADUADO'), 'info');
  assert.equal(obtenerTonoEstadoEstudiante('RETIRADO'), 'warning');
  assert.equal(obtenerTonoEstadoEstudiante('INACTIVO'), 'neutral');

  assert.equal(obtenerTonoEstadoSolicitud('PROCESADO'), 'success');
  assert.equal(obtenerTonoEstadoSolicitud('RECHAZADO'), 'danger');
  assert.equal(obtenerTonoEstadoSolicitud('REQUIERE_REVISION'), 'warning');

  assert.equal(formatearEstadoEstudiante('ACTIVO'), 'Activo');
  assert.equal(formatearEstadoEstudiante('OTRO'), 'OTRO');
  assert.equal(formatearEstadoEstudiante(null), '—');
});

test('estudiantes.helpers — nombres completos y extracción de datos', () => {
  assert.equal(
    obtenerNombreCompletoEstudiante({ nombres: 'Laura', apellido1: 'Mora', apellido2: 'Castro' }),
    'Laura Mora Castro',
  );
  assert.equal(obtenerNombreCompletoEstudiante(null), '');

  assert.deepEqual(extraerDataResultado({ data: [1, 2, 3] }), [1, 2, 3]);
  assert.deepEqual(extraerDataResultado({ ok: true }), { ok: true });
});

test('estudiantes.helpers — asignaturas, planes y períodos', () => {
  assert.equal(
    obtenerTextoAsignaturaEstudiante({
      planAsignatura: { curso: { codigo: 'EIF-201', nombre: 'Programación I' } },
    }),
    'EIF-201 - Programación I',
  );

  assert.equal(
    obtenerTextoPeriodoEstudiante({ codigo: 'PER-2026-1' }),
    'PER-2026-1',
  );
  assert.equal(obtenerTextoPeriodoEstudiante(null), '—');

  assert.equal(
    obtenerTextoPlanEstudiante({ codigo: 'INF-2026', nombre: 'Plan Sistemas 2026' }),
    'INF-2026 - Plan Sistemas 2026',
  );
  assert.equal(obtenerTextoPlanEstudiante(null), '—');
});

test('estudiantes.helpers — validación cronológica de períodos de ingreso', () => {
  const pIngreso = { anio: 2025, ciclo: 1 };
  const pPosterior = { anio: 2025, ciclo: 2 };
  const pAnterior = { anio: 2024, ciclo: 2 };
  const pIgual = { anio: 2025, ciclo: 1 };

  assert.equal(esPeriodoIgualOPosterior(pPosterior, pIngreso), true);
  assert.equal(esPeriodoIgualOPosterior(pIgual, pIngreso), true);
  assert.equal(esPeriodoIgualOPosterior(pAnterior, pIngreso), false);
  assert.equal(esPeriodoIgualOPosterior(null, pIngreso), true);
});

test('estudiantes.helpers — formato de enums y responsables', () => {
  assert.equal(formatearTextoEnumEstudiante('SOLICITUD_PENDIENTE'), 'Solicitud pendiente');
  assert.equal(formatearTextoEnumEstudiante(''), '—');

  assert.equal(
    obtenerNombreResponsableEstudiante({ nombres: 'Ana', apellido1: 'Rojas' }),
    'Ana Rojas',
  );
  assert.equal(
    obtenerNombreResponsableEstudiante({ correo: 'coord@una.ac.cr' }),
    'coord@una.ac.cr',
  );
  assert.equal(obtenerNombreResponsableEstudiante(null), '—');
});
