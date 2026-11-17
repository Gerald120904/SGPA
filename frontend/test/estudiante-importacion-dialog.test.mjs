import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obtenerResumenImportacion,
  obtenerDetalleFilaImportacion,
} from '../src/pages/estudiantes/estudiantes.helpers.js';
import {
  renderizarPreviewImportacionEstudiantes,
} from '../src/pages/estudiantes/EstudianteImportacionDialog.js';

test('EstudianteImportacionDialog / helpers — cálculo de resumen y detalle de filas', () => {
  const preview = {
    resumen: { total: 3, creados: 2, actualizados: 1, sinCambios: 0, errores: 0 },
  };
  const resumen = obtenerResumenImportacion(preview);
  assert.equal(resumen.total, 3);
  assert.equal(resumen.creados, 2);
  assert.equal(resumen.actualizados, 1);

  const filaConErrores = { errores: ['Cédula duplicada', 'Correo inválido'] };
  assert.equal(obtenerDetalleFilaImportacion(filaConErrores), 'Cédula duplicada · Correo inválido');

  const filaConCambios = {
    cambiosDatos: [{ campo: 'telefono', actual: '1111', nuevo: '2222' }],
  };
  assert.equal(obtenerDetalleFilaImportacion(filaConCambios), 'telefono: 1111 → 2222');
});

test('EstudianteImportacionDialog — renderizarPreviewImportacionEstudiantes monta tablas y botón de ejecución', () => {
  const contenedor = { innerHTML: '' };
  global.document = {
    getElementById: (id) => (id === 'previewImportacionEstudiantes' ? contenedor : null),
    querySelectorAll: () => [],
  };

  const preview = {
    resumen: { total: 2, creados: 1, actualizados: 1, sinCambios: 0, errores: 0 },
    filas: [
      {
        fila: 2,
        accion: 'CREAR',
        estudiante: {
          cedula: '109870123',
          nombres: 'Daniel',
          apellido1: 'Pérez',
          correoInstitucional: 'dperez@una.cr',
        },
      },
    ],
  };

  renderizarPreviewImportacionEstudiantes(preview, { carreraId: 1, planEstudioId: 10 });

  assert.match(contenedor.innerHTML, /Resumen de importación/);
  assert.match(contenedor.innerHTML, /109870123/);
  assert.match(contenedor.innerHTML, /Daniel Pérez/);
  assert.match(contenedor.innerHTML, /ejecutarImportacionEstudiantesButton/);
});
