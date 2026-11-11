import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seleccionarPeriodoInicial,
  obtenerPeriodoAnteriorDisponibilidad,
  validarBloquesDisponibilidad,
} from '../src/pages/profesores/profesores.helpers.js';
import {
  setPeriodosDisponibilidad,
  setDisponibilidadActual,
  renderizarMiDisponibilidad,
  abrirFormularioMiDisponibilidad,
  guardarFormularioMiDisponibilidad,
} from '../src/pages/profesores/ProfesorDisponibilidadView.js';
import {
  renderizarExpedientePerfil,
} from '../src/pages/profesores/ProfesorDetalleView.js';
import {
  abrirFormularioAtestado,
  inactivarMiAtestado,
  abrirFormularioProyecto,
  cambiarEstadoMiProyecto,
} from '../src/pages/profesores/ProfesorFormDialog.js';

test('Profesores — Prioridad institucional de selección de período inicial', () => {
  // 1. Debe preferir EN_PREPARACION sobre los demás
  const periodos1 = [
    { id: 1, anio: 2026, ciclo: 1, estado: 'EN_CURSO' },
    { id: 2, anio: 2026, ciclo: 2, estado: 'EN_PREPARACION' },
    { id: 3, anio: 2026, ciclo: 3, estado: 'BORRADOR' },
  ];
  assert.equal(seleccionarPeriodoInicial(periodos1)?.id, 2);

  // 2. Si no hay EN_PREPARACION, prefiere EN_CURSO
  const periodos2 = [
    { id: 4, anio: 2026, ciclo: 1, estado: 'FINALIZADO' },
    { id: 5, anio: 2026, ciclo: 2, estado: 'EN_CURSO' },
    { id: 6, anio: 2026, ciclo: 3, estado: 'BORRADOR' },
  ];
  assert.equal(seleccionarPeriodoInicial(periodos2)?.id, 5);

  // 3. Si no hay EN_PREPARACION ni EN_CURSO, prefiere BORRADOR
  const periodos3 = [
    { id: 7, anio: 2026, ciclo: 1, estado: 'FINALIZADO' },
    { id: 8, anio: 2026, ciclo: 2, estado: 'BORRADOR' },
  ];
  assert.equal(seleccionarPeriodoInicial(periodos3)?.id, 8);

  // 4. Si no hay ninguno de esos, toma el primer período disponible
  const periodos4 = [
    { id: 9, anio: 2025, ciclo: 2, estado: 'FINALIZADO' },
    { id: 10, anio: 2025, ciclo: 1, estado: 'CERRADO' },
  ];
  assert.equal(seleccionarPeriodoInicial(periodos4)?.id, 9);

  // 5. Array vacío devuelve null
  assert.equal(seleccionarPeriodoInicial([]), null);
});

test('Profesores — Determinación del período anterior para copia de disponibilidad', () => {
  const listaPeriodos = [
    { id: 1, anio: 2025, ciclo: 3 },
    { id: 2, anio: 2026, ciclo: 1 },
    { id: 3, anio: 2026, ciclo: 2 },
    { id: 4, anio: 2026, ciclo: 3 },
  ];

  // Ciclo 2 de 2026 -> Ciclo 1 de 2026
  const antCiclo2 = obtenerPeriodoAnteriorDisponibilidad({ anio: 2026, ciclo: 2 }, listaPeriodos);
  assert.equal(antCiclo2?.id, 2);

  // Ciclo 3 de 2026 -> Ciclo 2 de 2026
  const antCiclo3 = obtenerPeriodoAnteriorDisponibilidad({ anio: 2026, ciclo: 3 }, listaPeriodos);
  assert.equal(antCiclo3?.id, 3);

  // Ciclo 1 de 2026 -> Ciclo 3 de 2025 (año anterior)
  const antCiclo1 = obtenerPeriodoAnteriorDisponibilidad({ anio: 2026, ciclo: 1 }, listaPeriodos);
  assert.equal(antCiclo1?.id, 1);
});

test('Profesores — Validación de bloques horarios y detección de superposiciones', () => {
  // 1. Hora fin menor o igual a hora inicio
  const bloquesInvertidos = [
    { dia: 'LUNES', horaInicio: '10:00', horaFin: '09:00', jornada: 'MANANA' },
  ];
  assert.match(validarBloquesDisponibilidad(bloquesInvertidos), /debe terminar después/);

  // 2. Mismo día con superposición horaria
  const bloquesSolapados = [
    { dia: 'LUNES', horaInicio: '08:00', horaFin: '11:00', jornada: 'MANANA' },
    { dia: 'LUNES', horaInicio: '10:30', horaFin: '12:00', jornada: 'MANANA' },
  ];
  assert.match(validarBloquesDisponibilidad(bloquesSolapados), /superpuestos el Lunes/);

  // 3. Mismo día sin superposición (consecutivos o separados)
  const bloquesValidosMismoDia = [
    { dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00', jornada: 'MANANA' },
    { dia: 'LUNES', horaInicio: '10:00', horaFin: '12:00', jornada: 'MANANA' },
    { dia: 'LUNES', horaInicio: '13:00', horaFin: '15:00', jornada: 'TARDE' },
  ];
  assert.equal(validarBloquesDisponibilidad(bloquesValidosMismoDia), null);

  // 4. Días distintos con mismas horas (completamente válido)
  const bloquesDistintosDias = [
    { dia: 'LUNES', horaInicio: '08:00', horaFin: '12:00', jornada: 'MANANA' },
    { dia: 'MARTES', horaInicio: '08:00', horaFin: '12:00', jornada: 'MANANA' },
  ];
  assert.equal(validarBloquesDisponibilidad(bloquesDistintosDias), null);
});

test('Profesores — ProfesorFormDialog: Atestados (creación, edición e inactivación)', async () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener() {},
  };

  const docAnterior = global.document;
  global.document = {
    createElement: () => ({
      id: '',
      open: false,
      showModal() {},
      close() {},
      remove() {},
      addEventListener() {},
      querySelector: (sel) => ({
        addEventListener: (event, handler) => {
          if (sel === '#sgpaConfirmCancel' && typeof handler === 'function') {
            setTimeout(handler, 0);
          }
        },
      }),
    }),
    body: { appendChild() {} },
    getElementById: (id) => {
      if (id === 'profesorRevisionDialog') return dialog;
      if (id === 'profesorRevisionDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  try {
    // 1. Apertura para nuevo atestado
    abrirFormularioAtestado({
      atestado: null,
      onGuardado: () => {},
    });

    assert.equal(dialog.open, true);
    assert.match(content.innerHTML, /id="miAtestadoForm"/);
    assert.match(content.innerHTML, /id="atestadoTipo"/);
    assert.match(content.innerHTML, /id="atestadoNombre"/);
    assert.match(content.innerHTML, /id="atestadoInstitucion"/);

    // 2. Apertura en modo edición
    const atestadoMock = {
      id: 5,
      tipo: 'TITULO_ACADEMICO',
      nombre: 'Maestría en Computación',
      institucion: 'UNA',
      fechaEmision: '2020-06-15',
      descripcion: 'Título oficial registrado',
    };

    abrirFormularioAtestado({
      atestado: atestadoMock,
      onGuardado: () => {},
    });

    assert.match(content.innerHTML, /Editar atestado/);
    assert.match(content.innerHTML, /Maestría en Computación/);
    assert.match(content.innerHTML, /Título oficial registrado/);

    // 3. Inactivación de atestado sin confirmación
    let llamado = false;
    global.window = {
      sgpa: {
        inactivarAtestadoProfesor: async () => { llamado = true; return { ok: true }; },
      },
    };

    await inactivarMiAtestado({ atestadoId: 5 });
    assert.equal(llamado, false);

  } finally {
    global.document = docAnterior;
  }
});

test('Profesores — ProfesorFormDialog: Proyectos (apertura y transiciones de estado)', async () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener() {},
  };

  const docAnterior = global.document;
  global.document = {
    createElement: () => ({
      id: '',
      open: false,
      showModal() {},
      close() {},
      remove() {},
      addEventListener() {},
      querySelector: (sel) => ({
        addEventListener: (event, handler) => {
          if (sel === '#sgpaConfirmCancel' && typeof handler === 'function') {
            setTimeout(handler, 0);
          }
        },
      }),
    }),
    body: { appendChild() {} },
    getElementById: (id) => {
      if (id === 'profesorRevisionDialog') return dialog;
      if (id === 'profesorRevisionDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  try {
    // 1. Apertura para nuevo proyecto
    abrirFormularioProyecto({
      proyecto: null,
      onGuardado: () => {},
    });

    assert.equal(dialog.open, true);
    assert.match(content.innerHTML, /id="miProyectoForm"/);
    assert.match(content.innerHTML, /id="proyectoNombre"/);
    assert.match(content.innerHTML, /id="proyectoUnidad"/);
    assert.match(content.innerHTML, /id="proyectoRol"/);

    // 2. Apertura en modo edición
    const proyectoMock = {
      id: 10,
      codigo: 'PRY-101',
      nombre: 'Laboratorio de Ciberseguridad',
      unidad: 'Escuela de Informática',
      rol: 'Investigador Principal',
      tipo: 'LABORATORIO',
      estado: 'ACTIVO',
    };

    abrirFormularioProyecto({
      proyecto: proyectoMock,
      onGuardado: () => {},
    });

    assert.match(content.innerHTML, /Editar proyecto/);
    assert.match(content.innerHTML, /Laboratorio de Ciberseguridad/);
    assert.match(content.innerHTML, /Escuela de Informática/);

    // 3. Cambio de estado sin confirmación
    let servicioLlamado = false;
    global.window = {
      sgpa: {
        cambiarEstadoProyectoProfesor: async () => { servicioLlamado = true; return { ok: true }; },
      },
    };

    await cambiarEstadoMiProyecto({ proyecto: { id: 10, nombre: 'Proyecto Test' }, activo: false });
    assert.equal(servicioLlamado, false);

  } finally {
    global.document = docAnterior;
  }
});

test('Profesores — ProfesorDisponibilidadView: Matriz de bloques y formulario', async () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener() {},
  };
  const contenedor = { innerHTML: '' };

  const docAnterior = global.document;
  global.document = {
    getElementById: (id) => {
      if (id === 'profesorRevisionDialog') return dialog;
      if (id === 'profesorRevisionDialogContent') return content;
      if (id === 'miDisponibilidadContent') return contenedor;
      return null;
    },
    querySelectorAll: () => [],
  };

  try {
    const periodoDestino = { id: 2, anio: 2026, ciclo: 2, nombre: 'II Ciclo 2026', estado: 'EN_CURSO' };
    const periodosMock = [
      { id: 1, anio: 2026, ciclo: 1, nombre: 'I Ciclo 2026', estado: 'FINALIZADO' },
      periodoDestino,
    ];

    setPeriodosDisponibilidad(periodosMock);
    setDisponibilidadActual({
      periodoId: 2,
      periodo: periodoDestino,
      estado: 'REGISTRADA',
      registrada: true,
      bloques: [
        { id: 1, dia: 'LUNES', horaInicio: '08:00', horaFin: '12:00', jornada: 'MANANA' },
        { id: 2, dia: 'MIERCOLES', horaInicio: '13:00', horaFin: '17:00', jornada: 'TARDE' },
      ],
    });

    // 1. Renderizado de matriz semanal
    renderizarMiDisponibilidad();

    assert.match(contenedor.innerHTML, /Registrada/);
    assert.match(contenedor.innerHTML, /Lunes/);
    assert.match(contenedor.innerHTML, /Miércoles/);
    assert.match(contenedor.innerHTML, /08:00\s*—\s*12:00/);
    assert.match(contenedor.innerHTML, /13:00\s*—\s*17:00/);

    // 2. Apertura del formulario de edición de disponibilidad
    abrirFormularioMiDisponibilidad();

    assert.equal(dialog.open, true);
    assert.match(content.innerHTML, /id="miDisponibilidadForm"/);
    assert.match(content.innerHTML, /Editar disponibilidad/);
  } finally {
    global.document = docAnterior;
  }
});

test('Profesores — ProfesorDetalleView: Renderizado de expediente de perfil académico', () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener() {},
  };

  const docAnterior = global.document;
  global.document = {
    getElementById: (id) => {
      if (id === 'profesorExpedienteDialog') return dialog;
      if (id === 'profesorExpedienteDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  try {
    const expedienteMock = {
      profesor: {
        id: 100,
        nombre: 'Ana',
        apellido1: 'Mora',
        apellido2: 'Gómez',
        correoInstitucional: 'ana.mora@una.cr',
      },
      perfil: { id: 10, nombre: 'Docente Titular Informática' },
      solicitud: { estado: 'APROBADO' },
      requisitos: [
        {
          id: 1,
          tipo: 'GRADO_ACADEMICO',
          obligatorio: true,
          descripcion: 'Título de Maestría en Informática',
          cumplimiento: { estado: 'CUMPLE' },
        },
      ],
    };

    renderizarExpedientePerfil({
      expediente: expedienteMock,
      modo: 'VALIDAR',
      perfilId: 10,
      puedeValidar: true,
    });

    assert.match(content.innerHTML, /Docente Titular Informática/);
    assert.match(content.innerHTML, /Título de Maestría en Informática/);
    assert.match(content.innerHTML, /APROBADO/);
  } finally {
    global.document = docAnterior;
  }
});

test('Profesores — Handlers reales: Envío simulado de atestados, proyectos y disponibilidad con manejo de errores', async () => {
  const docAnterior = global.document;
  const winAnterior = global.window;

  let llamadasServicio = {
    crearAtestado: [],
    crearProyecto: [],
    guardarDisponibilidad: [],
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
      crearAtestadoProfesor: async (datos) => {
        llamadasServicio.crearAtestado.push(datos);
        if (datos.nombre?.includes('ERROR_FORZADO')) {
          return { ok: false, message: 'Error forzado al registrar atestado' };
        }
        return { ok: true, atestado: { id: 50, ...datos } };
      },
      crearProyectoProfesor: async (datos) => {
        llamadasServicio.crearProyecto.push(datos);
        if (datos.nombre?.includes('ERROR_FORZADO')) {
          return { ok: false, message: 'Error forzado al registrar proyecto' };
        }
        return { ok: true, proyecto: { id: 70, ...datos } };
      },
      guardarMiDisponibilidadProfesor: async (payload) => {
        llamadasServicio.guardarDisponibilidad.push(payload);
        return { ok: true };
      },
    },
  };

  try {
    // 1. Envío de formulario de atestado exitoso
    let atestadoGuardado = null;
    abrirFormularioAtestado({
      atestado: null,
      onGuardado: (res) => { atestadoGuardado = res; },
    });

    mockElement('atestadoTipo').value = 'TITULO';
    mockElement('atestadoNombre').value = 'Maestría en Ciberseguridad';
    mockElement('atestadoInstitucion').value = 'Universidad Nacional';
    mockElement('atestadoFechaObtencion').value = '2024-06-15';
    mockElement('atestadoDescripcion').value = 'Graduado con honores';

    await mockElement('miAtestadoForm').onsubmit({ preventDefault: () => {} });

    assert.equal(llamadasServicio.crearAtestado.length, 1);
    assert.equal(llamadasServicio.crearAtestado[0].nombre, 'Maestría en Ciberseguridad');
    assert.equal(llamadasServicio.crearAtestado[0].fechaObtencion, '2024-06-15');
    assert.ok(atestadoGuardado, 'onGuardado debe invocarse');

    // 2. Envío de atestado con error de servicio
    let atestadoErrorGuardado = false;
    abrirFormularioAtestado({
      atestado: null,
      onGuardado: () => { atestadoErrorGuardado = true; },
    });

    mockElement('atestadoTipo').value = 'CERTIFICACION';
    mockElement('atestadoNombre').value = 'Certificación ERROR_FORZADO';
    mockElement('atestadoInstitucion').value = 'Cisco';

    await mockElement('miAtestadoForm').onsubmit({ preventDefault: () => {} });

    assert.equal(atestadoErrorGuardado, false, 'onGuardado no debe invocarse si el servicio falló');
    assert.equal(mockElement('guardarMiAtestado').disabled, false, 'El botón debe reactivarse tras error');

    // 3. Envío de formulario de proyecto exitoso
    let proyectoGuardado = null;
    abrirFormularioProyecto({
      proyecto: null,
      onGuardado: (res) => { proyectoGuardado = res; },
    });

    mockElement('proyectoNombre').value = 'Investigación en Redes Cuánticas';
    mockElement('proyectoUnidad').value = 'Escuela de Informática';
    mockElement('proyectoRol').value = 'Coordinador';
    mockElement('proyectoFechaInicio').value = '2025-01-15';
    mockElement('proyectoFechaFin').value = '2025-12-15';

    await mockElement('miProyectoForm').onsubmit({ preventDefault: () => {} });

    assert.equal(llamadasServicio.crearProyecto.length, 1);
    assert.equal(llamadasServicio.crearProyecto[0].nombre, 'Investigación en Redes Cuánticas');
    assert.ok(proyectoGuardado, 'onGuardado de proyecto debe invocarse');

    // 4. Validación de fechaFin < fechaInicio en proyecto (bloqueo sin llamada a servicio)
    abrirFormularioProyecto({ proyecto: null });
    mockElement('proyectoNombre').value = 'Proyecto Fechas Invertidas';
    mockElement('proyectoFechaInicio').value = '2025-12-15';
    mockElement('proyectoFechaFin').value = '2025-01-15'; // Menor que inicio

    await mockElement('miProyectoForm').onsubmit({ preventDefault: () => {} });

    assert.equal(llamadasServicio.crearProyecto.length, 1, 'No debe llamar al servicio con fechas inválidas');
  } finally {
    global.document = docAnterior;
    global.window = winAnterior;
    if (global.window) {
      global.window.clearTimeout = globalThis.clearTimeout;
      global.window.setTimeout = globalThis.setTimeout;
    }
  }
});
