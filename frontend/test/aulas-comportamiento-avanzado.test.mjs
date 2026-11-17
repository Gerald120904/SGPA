import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TODAS_LAS_AREAS_REGISTRABLES,
  PLANO_SECTOR_PRINCIPAL_P2,
  PLANO_SECTOR_HUMANISTICO,
  PLANO_SECTOR_BIBLIOTECA,
  PLANO_EDIFICIO2_PISO3,
  PLANO_EDIFICIO2_PISO2,
} from '../src/pages/aulas/aulas.planos.js';
import {
  buscarEspacioDuplicado,
  abrirFormularioAula,
} from '../src/pages/aulas/AulaFormDialog.js';
import {
  renderizarEquipamientoDelAula,
  abrirFormularioEquipamientoAula,
  desasignarEquipamientoDelAula,
} from '../src/pages/aulas/AulaEquipamientoDialog.js';
import {
  renderizarSlotPlanoRegistrable,
  renderizarFichaPlanoAula,
  renderizarPlanoAulas,
} from '../src/pages/aulas/AulasPlanosView.js';

test('Aulas — Correspondencia e integridad de las 30 áreas del plano', () => {
  // Debe contener exactamente 30 áreas registrables institucionales
  assert.equal(TODAS_LAS_AREAS_REGISTRABLES.length, 30);

  const keys = new Set();

  for (const area of TODAS_LAS_AREAS_REGISTRABLES) {
    assert.ok(area.key, 'Cada área debe tener una key única');
    assert.ok(!keys.has(area.key), `Key duplicada: ${area.key}`);
    keys.add(area.key);

    // Número es numérico o no definido en áreas administrativas
    if (area.numero != null) {
      assert.ok(typeof area.numero === 'number' && area.numero > 0, `Número inválido en ${area.key}`);
    }
    assert.ok(area.ubicacion, `Ubicación requerida en ${area.key}`);
    assert.ok(area.tipo, `Tipo requerido en ${area.key}`);
    assert.ok(area.origen, `Origen requerido en ${area.key}`);
  }

  // Verificar la suma de áreas por cada sector individual
  const sumaSectores = (
    PLANO_SECTOR_PRINCIPAL_P2.length +
    PLANO_SECTOR_HUMANISTICO.length +
    PLANO_SECTOR_BIBLIOTECA.length +
    PLANO_EDIFICIO2_PISO3.length +
    PLANO_EDIFICIO2_PISO2.length
  );
  assert.equal(sumaSectores, 30);
});

test('Aulas — Validación de espacios duplicados por código, número y origen', () => {
  const aulasExistentes = [
    { id: 10, codigo: '1', nombre: 'Aula 1 UNA', origen: 'UNA', tipo: 'AULA' },
    { id: 20, codigo: '2', nombre: 'Aula 2 UNA', origen: 'UNA', tipo: 'AULA' },
    { id: 30, codigo: '1', nombre: 'Aula 1 FUNDAUNA', origen: 'FUNDAUNA', tipo: 'AULA' },
    { id: 40, codigo: '18', nombre: 'Aula 18 UNA', origen: 'UNA', tipo: 'LABORATORIO' },
  ];

  // 1. Número duplicado en el mismo origen
  const dupNumero = buscarEspacioDuplicado(1, 'AULA', 'UNA', null, '', aulasExistentes);
  assert.ok(dupNumero);
  assert.equal(dupNumero.id, 10);

  // 2. Mismo número pero en diferente origen (permitido)
  const noDupOrigen = buscarEspacioDuplicado(2, 'AULA', 'FUNDAUNA', null, '', aulasExistentes);
  assert.equal(noDupOrigen, null);

  // 3. Edición del propio registro (no se auto-detecta como duplicado)
  const autoEdicion = buscarEspacioDuplicado(1, 'AULA', 'UNA', 10, '', aulasExistentes);
  assert.equal(autoEdicion, null);

  // 4. Espacio no existente
  const noExiste = buscarEspacioDuplicado(99, 'AULA', 'UNA', null, '', aulasExistentes);
  assert.equal(noExiste, null);
});

test('Aulas — AulaFormDialog: Apertura, renderizado de campos y permisos', async () => {
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
      if (id === 'aulaDialog') return dialog;
      if (id === 'aulaDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  try {
    // 1. Apertura en modo creación con sugerencia
    const sugerenciaMock = {
      numero: 5,
      ubicacion: 'Edificio principal, piso 2',
      tipo: 'AULA',
      tipoMobiliario: 'PUPITRE',
      origen: 'UNA',
    };

    abrirFormularioAula({
      aula: null,
      sugerencia: sugerenciaMock,
      aulas: [],
      onGuardado: () => {},
      puedeGestionar: true,
    });

    assert.equal(dialog.open, true);
    assert.match(content.innerHTML, /id="aulaForm"/);
    assert.match(content.innerHTML, /id="aulaNumero"/);
    assert.match(content.innerHTML, /id="aulaCapacidad"/);

    // 2. Apertura en modo solo lectura (no debe abrir dialog)
    dialog.open = false;
    abrirFormularioAula({
      aula: null,
      sugerencia: sugerenciaMock,
      aulas: [],
      onGuardado: () => {},
      puedeGestionar: false,
    });
    assert.equal(dialog.open, false);

    // 3. Apertura en modo edición de aula existente
    const aulaEdicion = {
      id: 55,
      codigo: '5',
      nombre: 'Aula 5 de Prueba',
      tipo: 'AULA',
      capacidad: 40,
      tipoMobiliario: 'MESA_COMPUTADORA',
      origen: 'UNA',
      activo: true,
      ubicacion: 'Edificio 2, piso 3',
    };

    abrirFormularioAula({
      aula: aulaEdicion,
      sugerencia: null,
      aulas: [aulaEdicion],
      onGuardado: () => {},
      puedeGestionar: true,
    });

    assert.match(content.innerHTML, /Editar aula/);
    assert.match(content.innerHTML, /value="5"/);
  } finally {
    global.document = docAnterior;
  }
});

test('Aulas — AulaEquipamientoDialog: Renderizado, permisos de solo lectura y desasignación', async () => {
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
      if (id === 'aulaDialog') return dialog;
      if (id === 'aulaDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  try {
    const aulaConEquipos = {
      id: 12,
      nombre: 'Laboratorio de Redes',
      equipamientoRelaciones: [
        {
          equipamientoId: 101,
          cantidadAsignada: 20,
          asignadoEn: '2026-02-15T08:00:00Z',
          observaciones: 'Routers Cisco',
          equipamiento: { id: 101, nombre: 'Router Cisco 2901', descripcion: 'Router institucional' },
        },
      ],
    };

    // 1. Abrir formulario de asignación
    abrirFormularioEquipamientoAula({
      aula: aulaConEquipos,
      relacion: null,
      equipamientoAulaActual: aulaConEquipos.equipamientoRelaciones,
      catalogoEquipamientos: [
        { id: 102, nombre: 'Switch HP 24p', activo: true, cantidadDisponible: 10 },
      ],
      puedeGestionar: true,
      onActualizado: () => {},
    });

    assert.equal(dialog.open, true);
    assert.match(content.innerHTML, /Asignar equipamiento/i);
    assert.match(content.innerHTML, /Switch HP 24p/);

    // 2. Modo solo lectura (sin permiso de gestión)
    const htmlSoloLectura = renderizarEquipamientoDelAula(aulaConEquipos.equipamientoRelaciones, false);
    assert.doesNotMatch(htmlSoloLectura, /Quitar del aula/);
    assert.doesNotMatch(htmlSoloLectura, /Editar asignación/);

    // 3. Modo con permiso de gestión
    const htmlConGestion = renderizarEquipamientoDelAula(aulaConEquipos.equipamientoRelaciones, true);
    assert.match(htmlConGestion, /Quitar del aula/);
    assert.match(htmlConGestion, /Editar asignación/);

    // 4. Intento de desasignación sin permisos de gestión (bloqueado)
    let llamado = false;
    global.window = {
      sgpa: {
        desasignarEquipamientoDeAula: async () => { llamado = true; return { ok: true }; },
      },
    };

    await desasignarEquipamientoDelAula({
      aulaId: 12,
      equipamientoId: 101,
      puedeGestionar: false,
      onActualizado: () => {},
      mostrarFeedback: () => {},
    });

    assert.equal(llamado, false, 'Sin permiso de gestión no se debe llamar al servicio');
  } finally {
    global.document = docAnterior;
  }
});

test('Aulas — AulasPlanosView: Selección dinámica de pisos y sectores edilicios', () => {
  const contenedor = { innerHTML: '' };
  const mockAulas = [
    { id: 1, codigo: '1', nombre: 'Aula 1', tipo: 'AULA', origen: 'UNA', activo: true },
    { id: 18, codigo: '18', nombre: 'Aula 18 STEM', tipo: 'LABORATORIO', origen: 'UNA', activo: true },
  ];

  // 1. Renderizado en Edificio 2, Piso 3
  renderizarPlanoAulas({
    contenido: contenedor,
    filtradas: mockAulas,
    pisoEdificio2Actual: 3,
    selectorPisoEdificio2Abierto: false,
    aulaPlanoSeleccionadaId: 1,
    obtenerAulaParaSlot: (slot) => (slot.numero === 1 ? mockAulas[0] : null),
  });

  assert.match(contenedor.innerHTML, /Piso 3/);
  assert.match(contenedor.innerHTML, /Sector Colegio Humanístico/);

  // 2. Renderizado en Edificio 2, Piso 2
  renderizarPlanoAulas({
    contenido: contenedor,
    filtradas: mockAulas,
    pisoEdificio2Actual: 2,
    selectorPisoEdificio2Abierto: false,
    aulaPlanoSeleccionadaId: 18,
    obtenerAulaParaSlot: (slot) => (slot.numero === 18 ? mockAulas[1] : null),
  });

  assert.match(contenedor.innerHTML, /Piso 2/);
  assert.match(contenedor.innerHTML, /Biblioteca y salas/);
});

test('Aulas — Handlers reales: Creación, edición con confirmación de reducción y errores de servicio', async () => {
  const docAnterior = global.document;
  const winAnterior = global.window;

  let llamadasServicio = {
    crear: [],
    actualizar: [],
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
        if (id === 'sgpaConfirmAccept' && evt === 'click') {
          setTimeout(handler, 0);
        }
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
      crearAula: async (datos) => {
        llamadasServicio.crear.push(datos);
        return { ok: true, aula: { id: 99, ...datos } };
      },
      actualizarAula: async (id, datos) => {
        llamadasServicio.actualizar.push({ id, datos });
        if (datos.nombre?.includes('ERROR_FORZADO')) {
          return { ok: false, message: 'Fallo forzado en servicio de aulas' };
        }
        return { ok: true, aula: { id, ...datos } };
      },
    },
  };

  try {
    // 1. Envío simulado de Creación
    let aulaCreadaGuardada = null;
    abrirFormularioAula({
      aula: null,
      sugerencia: { numero: 5, codigo: '5', origen: 'UNA' },
      aulas: [],
      onGuardado: (aula) => { aulaCreadaGuardada = aula; },
      puedeGestionar: true,
    });

    mockElement('aulaNumero').value = '5';
    mockElement('aulaCapacidad').value = '35';
    mockElement('aulaTipo').value = 'AULA';
    mockElement('aulaOrigen').value = 'UNA';
    mockElement('aulaMobiliario').value = 'MESAS_Y_SILLAS';
    mockElement('aulaUbicacion').value = 'Edificio 1, Piso 1';

    // Disparar submit del formulario de aula
    const formCrear = mockElement('aulaForm');
    assert.ok(formCrear.onsubmit, 'El formulario debe registrar handler de submit');
    await formCrear.onsubmit({ preventDefault: () => {} });
    assert.equal(llamadasServicio.crear.length, 1);
    assert.equal(llamadasServicio.crear[0].capacidad, 35);
    assert.equal(llamadasServicio.crear[0].origen, 'UNA');
    assert.ok(aulaCreadaGuardada, 'Callback onGuardado debe ejecutarse tras creación exitosa');

    // 2. Envío de Edición con confirmación de reducción de capacidad
    let aulaActualizadaGuardada = null;
    let confirmacionLlamada = false;

    // Mock modal de confirmación en el DOM
    mockElement('sgpaConfirmAccept').addEventListener('click', () => {});
    const aulaExistente = {
      id: 15,
      codigo: '15',
      nombre: 'Aula 15',
      capacidad: 40,
      tipo: 'AULA',
      origen: 'UNA',
      tipoMobiliario: 'MESAS_Y_SILLAS',
    };

    abrirFormularioAula({
      aula: aulaExistente,
      aulas: [aulaExistente],
      onGuardado: (aula) => { aulaActualizadaGuardada = aula; },
      puedeGestionar: true,
    });

    mockElement('aulaNumero').value = '15';
    mockElement('aulaCapacidad').value = '25'; // Reduce de 40 a 25
    mockElement('aulaTipo').value = 'AULA';
    mockElement('aulaOrigen').value = 'UNA';

    const formEditar = mockElement('aulaForm');
    await formEditar.onsubmit({ preventDefault: () => {} });

    assert.equal(llamadasServicio.actualizar.length, 1);
    assert.equal(llamadasServicio.actualizar[0].datos.capacidad, 25);
    assert.equal(llamadasServicio.actualizar[0].datos.confirmarReduccionCapacidad, true);
    assert.ok(aulaActualizadaGuardada, 'Callback onGuardado ejecutado');

    // 3. Manejo de error cuando el servicio falla
    mockElement('aulaNombreEspecial').value = 'ERROR_FORZADO';
    let guardadoFallo = false;
    abrirFormularioAula({
      aula: aulaExistente,
      aulas: [aulaExistente],
      onGuardado: () => { guardadoFallo = true; },
      puedeGestionar: true,
    });

    mockElement('aulaNumero').value = '15';
    mockElement('aulaCapacidad').value = '40';
    mockElement('aulaTipo').value = 'AULA';
    mockElement('aulaOrigen').value = 'UNA';
    mockElement('aulaNombreEspecial').value = 'ERROR_FORZADO';

    await mockElement('aulaForm').onsubmit({ preventDefault: () => {} });

    assert.equal(guardadoFallo, false, 'onGuardado no debe llamarse si el servicio rechazó');
    const botonGuardar = mockElement('guardarAula');
    assert.equal(botonGuardar.disabled, false, 'El botón debe quedar re-habilitado tras error');
  } finally {
    global.document = docAnterior;
    global.window = winAnterior;
    if (global.window) {
      global.window.clearTimeout = globalThis.clearTimeout;
      global.window.setTimeout = globalThis.setTimeout;
    }
  }
});
