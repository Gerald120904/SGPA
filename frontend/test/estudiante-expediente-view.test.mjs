import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderizarHistorialAcademico,
  renderizarHistorialPlanes,
  renderizarProgresoEstudiante,
} from '../src/pages/estudiantes/EstudianteExpedienteView.js';

test('EstudianteExpedienteView — renderizarHistorialAcademico monta markup institucional para cursos y notas', () => {
  const contenedor = { innerHTML: '' };
  global.document = {
    getElementById: (id) => (id === 'expedienteHistorialAcademico' ? contenedor : null),
  };

  const historial = [
    {
      asignatura: { codigo: 'INF-101', nombre: 'Programación I' },
      periodo: { codigo: '2025-I' },
      resultado: 'APROBADO',
      origenAcademico: 'CURSADO',
      fuenteRegistro: 'SISTEMA',
      observaciones: 'Aprobado con nota 8.5',
      registradoPor: { nombres: 'Carlos', apellido1: 'Sánchez' },
      createdAt: '2025-06-30T10:00:00.000Z',
    },
  ];

  renderizarHistorialAcademico(historial);

  assert.match(contenedor.innerHTML, /INF-101 - Programación I/);
  assert.match(contenedor.innerHTML, /2025-I/);
  assert.match(contenedor.innerHTML, /APROBADO/);
  assert.match(contenedor.innerHTML, /Cursado/);
  assert.match(contenedor.innerHTML, /Carlos Sánchez/);
});

test('EstudianteExpedienteView — renderizarHistorialPlanes monta cambios de plan con responsables', () => {
  const contenedor = { innerHTML: '' };
  global.document = {
    getElementById: (id) => (id === 'expedienteHistorialPlanes' ? contenedor : null),
  };

  const historial = [
    {
      planAnterior: { codigo: 'PLAN-2018', nombre: 'Plan Anterior' },
      planNuevo: { codigo: 'PLAN-2024', nombre: 'Plan Nuevo' },
      periodoCambio: { codigo: '2026-I' },
      motivo: 'Transición de carrera',
      cambiadoPor: { nombres: 'Elena', apellido1: 'Rojas' },
      createdAt: '2026-01-15T08:00:00.000Z',
    },
  ];

  renderizarHistorialPlanes(historial);

  assert.match(contenedor.innerHTML, /PLAN-2018 - Plan Anterior/);
  assert.match(contenedor.innerHTML, /PLAN-2024 - Plan Nuevo/);
  assert.match(contenedor.innerHTML, /Transición de carrera/);
  assert.match(contenedor.innerHTML, /Elena Rojas/);
});

test('EstudianteExpedienteView — renderizarProgresoEstudiante monta resumen y asignaturas habilitadas', () => {
  const contenedor = { innerHTML: '' };
  global.document = {
    getElementById: (id) => (id === 'expedienteProgreso' ? contenedor : null),
  };

  const progreso = {
    resumen: { totalPlan: 40, aprobadas: 25, reprobadas: 2, pendientes: 13, rezagadas: 1 },
    habilitadas: [
      {
        codigo: 'INF-202',
        nombre: 'Estructuras de Datos',
        nivel: 3,
        requisitosFaltantes: [],
        correquisitos: [],
      },
    ],
  };

  renderizarProgresoEstudiante(progreso);

  assert.match(contenedor.innerHTML, /Resumen/);
  assert.match(contenedor.innerHTML, /INF-202 - Estructuras de Datos/);
  assert.match(contenedor.innerHTML, /Habilitación de asignaturas/);
  assert.match(contenedor.innerHTML, /Rezago académico/);
});
