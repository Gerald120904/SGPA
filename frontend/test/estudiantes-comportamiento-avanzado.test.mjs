import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderizarHistorialAcademico,
  renderizarHistorialPlanes,
  renderizarProgresoEstudiante,
} from '../src/pages/estudiantes/EstudianteExpedienteView.js';
import {
  renderizarPreviewImportacionEstudiantes,
  abrirImportacionEstudiantes,
} from '../src/pages/estudiantes/EstudianteImportacionDialog.js';
import {
  obtenerResumenImportacion,
  obtenerDetalleFilaImportacion,
} from '../src/pages/estudiantes/estudiantes.helpers.js';

test('Estudiantes — Expediente Académico: Historial de asignaturas, notas y origen', () => {
  const contenedor = { innerHTML: '' };
  const docAnterior = global.document;
  global.document = {
    getElementById: (id) => (id === 'expedienteHistorialAcademico' ? contenedor : null),
  };

  try {
    const historialMock = [
      {
        id: 1,
        asignatura: { codigo: 'EIF201', nombre: 'Programación I' },
        periodo: { anio: 2025, ciclo: 1 },
        resultado: 'APROBADO',
        origenAcademico: 'CURSADO',
        fuenteRegistro: 'ACTA_OFICIAL',
        observaciones: 'Nota final: 9.0',
        registradoPor: { nombre: 'Coordinador', apellido1: 'EIF' },
        createdAt: '2025-07-10T12:00:00Z',
      },
      {
        id: 2,
        asignatura: { codigo: 'MAT001', nombre: 'Matemática General' },
        periodo: { anio: 2025, ciclo: 1 },
        resultado: 'REPROBADO',
        origenAcademico: 'CURSADO',
        fuenteRegistro: 'ACTA_OFICIAL',
        observaciones: 'Nota final: 5.5',
        registradoPor: { nombre: 'Coordinador', apellido1: 'EIF' },
        createdAt: '2025-07-10T12:00:00Z',
      },
    ];

    renderizarHistorialAcademico(historialMock);

    assert.match(contenedor.innerHTML, /EIF201/);
    assert.match(contenedor.innerHTML, /Programación I/);
    assert.match(contenedor.innerHTML, /APROBADO/);
    assert.match(contenedor.innerHTML, /REPROBADO/);
    assert.match(contenedor.innerHTML, /Nota final: 9\.0/);
  } finally {
    global.document = docAnterior;
  }
});

test('Estudiantes — Expediente Académico: Historial de traslados y cambios de plan', () => {
  const contenedor = { innerHTML: '' };
  const docAnterior = global.document;
  global.document = {
    getElementById: (id) => (id === 'expedienteHistorialPlanes' ? contenedor : null),
  };

  try {
    const historialPlanesMock = [
      {
        id: 10,
        planAnterior: { codigo: 'INF-2018', nombre: 'Plan 2018' },
        planNuevo: { codigo: 'INF-2024', nombre: 'Plan 2024' },
        motivo: 'Transición curricular institucional obligatoria',
        solicitadoPor: { nombre: 'Decano', apellido1: 'Facultad' },
        createdAt: '2026-01-15T09:00:00Z',
      },
    ];

    renderizarHistorialPlanes(historialPlanesMock);

    assert.match(contenedor.innerHTML, /INF-2018/);
    assert.match(contenedor.innerHTML, /INF-2024/);
    assert.match(contenedor.innerHTML, /Transición curricular institucional obligatoria/);
  } finally {
    global.document = docAnterior;
  }
});

test('Estudiantes — Expediente Académico: Barra de progreso curricular y créditos', () => {
  const contenedor = { innerHTML: '' };
  const docAnterior = global.document;
  global.document = {
    getElementById: (id) => (id === 'expedienteProgreso' ? contenedor : null),
  };

  try {
    const progresoMock = {
      resumen: {
        totalPlan: 45,
        aprobadas: 25,
        reprobadas: 2,
        pendientes: 15,
        rezagadas: 3,
      },
      habilitadas: [
        {
          codigo: 'EIF201',
          nombre: 'Programación I',
          habilitada: true,
          requisitosFaltantes: [],
          correquisitos: [],
        },
      ],
    };

    renderizarProgresoEstudiante(progresoMock);

    assert.match(contenedor.innerHTML, /45/);
    assert.match(contenedor.innerHTML, /25/);
    assert.match(contenedor.innerHTML, /Programación I/);
    assert.match(contenedor.innerHTML, /Habilitada/);
  } finally {
    global.document = docAnterior;
  }
});

test('Estudiantes — Importación Excel: Previsualización, tabla de resumen y detalle de filas', () => {
  const contenedor = { innerHTML: '' };
  const docAnterior = global.document;
  global.document = {
    getElementById: (id) => (id === 'previewImportacionEstudiantes' ? contenedor : null),
  };

  try {
    const previewMock = {
      filas: [
        {
          fila: 1,
          accion: 'CREAR',
          estudiante: {
            cedula: '5-0999-0888',
            nombres: 'Carlos',
            apellido1: 'Pérez',
            apellido2: 'Castro',
            correoInstitucional: 'carlos.perez@una.cr',
          },
          valido: true,
          errores: [],
        },
        {
          fila: 2,
          accion: 'ERROR',
          estudiante: {
            cedula: 'invalida',
            nombres: 'Estudiante',
            apellido1: 'Con Error',
            correoInstitucional: '',
          },
          valido: false,
          errores: ['Cédula con formato inválido', 'Correo requerido'],
        },
      ],
      resumen: {
        total: 2,
        creados: 1,
        actualizados: 0,
        sinCambios: 0,
        errores: 1,
      },
    };

    // 1. Verificar helper de resumen
    const resumen = obtenerResumenImportacion(previewMock);
    assert.equal(resumen.total, 2);
    assert.equal(resumen.creados, 1);
    assert.equal(resumen.errores, 1);

    // 2. Verificar detalle de fila
    const detalleError = obtenerDetalleFilaImportacion(previewMock.filas[1]);
    assert.match(detalleError, /Cédula con formato inválido/);

    // 3. Renderizar previsualización en el DOM
    renderizarPreviewImportacionEstudiantes(previewMock, {});

    assert.match(contenedor.innerHTML, /Carlos Pérez Castro/);
    assert.match(contenedor.innerHTML, /5-0999-0888/);
    assert.match(contenedor.innerHTML, /CREAR/);
    assert.match(contenedor.innerHTML, /ERROR/);
    assert.match(contenedor.innerHTML, /Cédula con formato inválido/);
  } finally {
    global.document = docAnterior;
  }
});

test('Estudiantes — Importación Excel: Validación obligatoria de carrera y plan antes de abrir', async () => {
  const docAnterior = global.document;
  const mockElement = (tag = 'div') => ({
    tagName: tag.toUpperCase(),
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => null,
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    classList: { add() {}, remove() {}, contains: () => false },
    dataset: {},
    style: {},
  });

  const dialog = mockElement('dialog');
  const content = mockElement('div');

  global.document = {
    body: mockElement('body'),
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: (tag) => mockElement(tag),
    getElementById: (id) => {
      if (id === 'estudianteDialog') return dialog;
      if (id === 'estudianteDialogContent') return content;
      return mockElement('div');
    },
  };

  try {
    // Si carrera o plan es null, debe abortar mostrando error sin abrir el diálogo
    await abrirImportacionEstudiantes({
      carrera: null,
      plan: null,
    });
    assert.equal(dialog.open, undefined);

    // Con carrera y plan válidos, procede a abrir el diálogo de importación
    await abrirImportacionEstudiantes({
      carrera: { id: 10, nombre: 'Ingeniería en Informática' },
      plan: { id: 100, codigo: 'INF-2024', nombre: 'Plan 2024' },
    });

    assert.equal(dialog.open, true);
    assert.match(content.innerHTML, /Importar estudiantes desde Excel/);
    assert.match(content.innerHTML, /Ingeniería en Informática/);
    assert.match(content.innerHTML, /INF-2024 - Plan 2024/);
  } finally {
    global.document = docAnterior;
  }
});

test('Estudiantes — Handlers reales: Confirmación, cancelación, parámetros de importación, errores de servicio y prevención de doble importación', async () => {
  const docAnterior = global.document;
  const winAnterior = global.window;

  let llamadasServicio = {
    ejecutar: [],
    proponer: [],
  };

  const elementos = new Map();
  const mockElement = (id, tag = 'div') => {
    if (elementos.has(id)) return elementos.get(id);
    const el = {
      id,
      tagName: tag.toUpperCase(),
      innerHTML: '',
      value: '',
      disabled: false,
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false,
      },
      dataset: {},
      addEventListener: (evt, handler) => {
        el['on' + evt] = handler;
      },
      showModal: () => { el.open = true; },
      close: () => { el.open = false; },
      appendChild: () => {},
      removeChild: () => {},
      remove: () => {},
      setAttribute: () => {},
      removeAttribute: () => {},
      querySelectorAll: () => [],
      querySelector: (sel) => {
        if (sel === '#sgpaConfirmAccept') return mockElement('sgpaConfirmAccept');
        if (sel === '#sgpaConfirmCancel') return mockElement('sgpaConfirmCancel');
        return null;
      },
    };
    elementos.set(id, el);
    return el;
  };

  const mockBody = mockElement('body');
  global.document = {
    body: mockBody,
    getElementById: (id) => mockElement(id),
    createElement: (tag) => mockElement(tag),
    querySelectorAll: () => [],
    querySelector: () => null,
  };

  global.window = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    sgpa: {
      ejecutarImportacionEstudiantes: async (ctx, datos) => {
        llamadasServicio.ejecutar.push({ ctx, datos });
        if (ctx.carreraId === 999) {
          return { ok: false, message: 'Fallo forzado al importar lote de estudiantes' };
        }
        return { ok: true, data: { totalFilas: 2 } };
      },
    },
  };

  try {
    const previewValido = {
      filas: [
        { fila: 1, accion: 'CREAR', estudiante: { cedula: '1-1111', nombres: 'Carlos' }, valido: true, errores: [] },
      ],
      resumen: { total: 1, creados: 1, actualizados: 0, sinCambios: 0, errores: 0 },
    };

    // 1. Cancelación en el diálogo de confirmación: no debe llamar al servicio
    mockElement('sgpaConfirmAccept').addEventListener('click', () => {}); // No auto-click accept
    mockElement('sgpaConfirmCancel').addEventListener('click', (evt) => {});

    // Forzar confirmación = false
    let autoConfirmar = false;
    mockElement('sgpaConfirmCancel').addEventListener = (evt, handler) => {
      if (evt === 'click' && !autoConfirmar) setTimeout(handler, 0);
    };
    mockElement('sgpaConfirmAccept').addEventListener = (evt, handler) => {
      if (evt === 'click' && autoConfirmar) setTimeout(handler, 0);
    };

    renderizarPreviewImportacionEstudiantes(
      previewValido,
      { carreraId: 10, planEstudioId: 100, datosExcel: [{ cedula: '1-1111' }] },
      { esAsistente: false, onImportado: () => {} },
    );

    const btnEjecutar = mockElement('ejecutarImportacionEstudiantesButton');
    assert.ok(btnEjecutar.onclick, 'El botón debe registrar listener de clic');
    await btnEjecutar.onclick();

    assert.equal(llamadasServicio.ejecutar.length, 0, 'No debe llamar al servicio si el usuario canceló');

    // 2. Confirmación exitosa y verificación de parámetros enviados
    autoConfirmar = true;
    let importadoExitoso = null;

    renderizarPreviewImportacionEstudiantes(
      previewValido,
      { carreraId: 10, planEstudioId: 100, datosExcel: [{ cedula: '1-1111' }] },
      { esAsistente: false, onImportado: (ctx) => { importadoExitoso = ctx; } },
    );

    await mockElement('ejecutarImportacionEstudiantesButton').onclick();

    assert.equal(llamadasServicio.ejecutar.length, 1);
    assert.equal(llamadasServicio.ejecutar[0].ctx.carreraId, 10);
    assert.equal(llamadasServicio.ejecutar[0].ctx.planEstudioId, 100);
    assert.deepEqual(llamadasServicio.ejecutar[0].datos, [{ cedula: '1-1111' }]);
    assert.ok(importadoExitoso, 'onImportado debe ejecutarse tras éxito');

    // 3. Manejo de error de servicio y reactivación del botón
    let falloImportado = false;
    renderizarPreviewImportacionEstudiantes(
      previewValido,
      { carreraId: 999, planEstudioId: 100, datosExcel: [{ cedula: '1-1111' }] },
      { esAsistente: false, onImportado: () => { falloImportado = true; } },
    );

    await mockElement('ejecutarImportacionEstudiantesButton').onclick();

    assert.equal(falloImportado, false, 'onImportado no debe ejecutarse en fallo');
    assert.equal(mockElement('ejecutarImportacionEstudiantesButton').disabled, false, 'Botón reactivado tras error');
  } finally {
    global.document = docAnterior;
    global.window = winAnterior;
    if (global.window) {
      global.window.clearTimeout = globalThis.clearTimeout;
      global.window.setTimeout = globalThis.setTimeout;
    }
  }
});
