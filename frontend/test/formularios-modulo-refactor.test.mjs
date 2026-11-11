import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarEstadoGoogle,
  obtenerPresentacionEstadoFormulario,
  formatearFechaHoraFormulario,
  obtenerResumenRespuestaEstudiante,
  resolverUrlVistaPreviaFormulario,
  extraerResultadoFormularioServicio,
} from '../src/pages/formularios-estudiantes/formularios-estudiantes.helpers.js';
import { renderizarFilaRespuesta } from '../src/pages/formularios-estudiantes/FormularioRespuestasDialog.js';

test('formularios-estudiantes.helpers — normalización de estado Google y estados de formulario', () => {
  assert.deepEqual(
    normalizarEstadoGoogle({
      data: { conectado: false, estado: 'REQUIERE_REAUTENTICACION', googleEmail: 'a@una.cr' },
    }),
    {
      conectado: false,
      requiereReautenticacion: true,
      estado: 'REQUIERE_REAUTENTICACION',
      googleEmail: 'a@una.cr',
    },
  );

  assert.deepEqual(obtenerPresentacionEstadoFormulario('PUBLICADO'), {
    label: 'PUBLICADO',
    tone: 'success',
  });
  assert.deepEqual(obtenerPresentacionEstadoFormulario('CREANDO'), {
    label: 'BORRADOR',
    tone: 'info',
  });
  assert.deepEqual(obtenerPresentacionEstadoFormulario('ERROR'), {
    label: 'ERROR',
    tone: 'danger',
  });
});

test('formularios-estudiantes.helpers — resumen de respuestas y URL de vista previa', () => {
  const resumen = obtenerResumenRespuestaEstudiante({
    estado: 'REQUIERE_REVISION',
    procesadoAt: '2026-04-10T15:30:00.000Z',
    detalleError: 'Materia optativa pendiente',
    datosNormalizadosJson: {
      primerNombre: 'Ana',
      primerApellido: 'Solís',
      identificacion: '112233445',
      correoEstudiantil: 'ana@est.una.ac.cr',
      asignaturasAprobadas: [
        { codigo: 'EIF-101', nombre: 'Fundamentos' },
        { planAsignaturaId: 99 },
      ],
    },
  });

  assert.equal(resumen.nombre, 'Ana Solís');
  assert.equal(resumen.identificacion, '112233445');
  assert.equal(resumen.aprobadas, 2);
  assert.match(resumen.codigos, /EIF-101 — Fundamentos/);
  assert.match(resumen.codigos, /ID #99/);
  assert.equal(resumen.esPendiente, true);
  assert.equal(resumen.detalle, 'Materia optativa pendiente');
  assert.notEqual(formatearFechaHoraFormulario(resumen.fechaProcesado), '');

  assert.equal(
    resolverUrlVistaPreviaFormulario(
      { responderUri: 'https://sgpa.example.invalid/formularios/p/abc' },
      { data: { url: 'https://sgpa.example.invalid/formularios/p/abc?ticket=123' } },
    ),
    'https://sgpa.example.invalid/formularios/p/abc?ticket=123',
  );
  assert.equal(
    resolverUrlVistaPreviaFormulario(
      { responderUri: 'https://sgpa.example.invalid/formularios/p/abc' },
      null,
    ),
    null,
  );
  assert.throws(
    () => extraerResultadoFormularioServicio({ ok: false, message: 'Fallo controlado' }, 'Defecto'),
    /Fallo controlado/,
  );
});

test('FormularioRespuestasDialog — renderizarFilaRespuesta distingue pendientes y procesadas', () => {
  const htmlPendiente = renderizarFilaRespuesta({
    id: 15,
    estado: 'PENDIENTE',
    datosNormalizadosJson: {
      primerNombre: 'Luis',
      primerApellido: 'Mora',
      identificacion: '504440111',
      correoEstudiantil: 'luis@est.una.ac.cr',
      asignaturasAprobadas: [],
    },
  });
  assert.match(htmlPendiente, /Luis Mora/);
  assert.match(htmlPendiente, /btn-accion-aprobar-resp/);
  assert.match(htmlPendiente, /btn-accion-rechazar-resp/);

  const htmlAprobada = renderizarFilaRespuesta({
    id: 16,
    estado: 'APROBADA',
    datosNormalizadosJson: null,
  });
  assert.match(htmlAprobada, /Sin normalizar/);
  assert.doesNotMatch(htmlAprobada, /btn-accion-aprobar-resp/);
});
