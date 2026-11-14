import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS_PERIODO,
  TRANSICIONES_PERIODO,
  obtenerTonoEstadoPeriodo,
  obtenerNombreEstadoPeriodo,
  obtenerNombreCicloPeriodo,
  formatearFechaPeriodo,
  esPeriodoEditable,
  filtrarPeriodosAcademicos,
  calcularFechaMaximaDisponibilidad,
  validarYConstruirDatosPeriodo,
} from '../src/pages/periodos/periodos.helpers.js';
import { ejecutarCambioEstadoPeriodo } from '../src/pages/periodos/PeriodoAcciones.js';

test('periodos.helpers — mapeo de nombres de estados', () => {
  assert.equal(obtenerNombreEstadoPeriodo('BORRADOR'), 'Borrador');
  assert.equal(obtenerNombreEstadoPeriodo('EN_PREPARACION'), 'En preparación');
  assert.equal(obtenerNombreEstadoPeriodo('EN_CURSO'), 'En curso');
  assert.equal(obtenerNombreEstadoPeriodo('CERRADO'), 'Cerrado');
  assert.equal(obtenerNombreEstadoPeriodo('CANCELADO'), 'Cancelado');
  assert.equal(obtenerNombreEstadoPeriodo('OTRO'), 'OTRO');
  assert.equal(obtenerNombreEstadoPeriodo(null), 'Sin estado');
});

test('periodos.helpers — tonos de estado institucionales', () => {
  assert.equal(obtenerTonoEstadoPeriodo('BORRADOR'), 'neutral');
  assert.equal(obtenerTonoEstadoPeriodo('EN_PREPARACION'), 'info');
  assert.equal(obtenerTonoEstadoPeriodo('EN_CURSO'), 'success');
  assert.equal(obtenerTonoEstadoPeriodo('CERRADO'), 'neutral');
  assert.equal(obtenerTonoEstadoPeriodo('CANCELADO'), 'danger');
  assert.equal(obtenerTonoEstadoPeriodo('DESCONOCIDO'), 'neutral');
});

test('periodos.helpers — nombres de ciclo oficiales', () => {
  assert.equal(obtenerNombreCicloPeriodo(1), 'I Ciclo');
  assert.equal(obtenerNombreCicloPeriodo(2), 'II Ciclo');
  assert.equal(obtenerNombreCicloPeriodo(3), 'Verano');
  assert.equal(obtenerNombreCicloPeriodo(4), 'Ciclo 4');
});

test('periodos.helpers — formatear fechas a DD/MM/AAAA', () => {
  assert.equal(formatearFechaPeriodo('2026-03-01'), '01/03/2026');
  assert.equal(formatearFechaPeriodo(''), '—');
  assert.equal(formatearFechaPeriodo(null), '—');
  assert.equal(formatearFechaPeriodo('invalida'), 'invalida');
});

test('periodos.helpers — editabilidad de periodos', () => {
  assert.equal(esPeriodoEditable({ estado: 'BORRADOR' }), true);
  assert.equal(esPeriodoEditable({ estado: 'EN_PREPARACION' }), true);
  assert.equal(esPeriodoEditable({ estado: 'EN_CURSO' }), false);
  assert.equal(esPeriodoEditable({ estado: 'CERRADO' }), false);
  assert.equal(esPeriodoEditable({ estado: 'CANCELADO' }), false);
  assert.equal(esPeriodoEditable(null), false);
});

test('periodos.helpers — filtrado por texto y estado', () => {
  const lista = [
    { id: 1, codigo: 'PER-2026-1', nombre: 'I Ciclo 2026', anio: 2026, ciclo: 1, estado: 'BORRADOR' },
    { id: 2, codigo: 'PER-2026-2', nombre: 'II Ciclo 2026', anio: 2026, ciclo: 2, estado: 'EN_CURSO' },
    { id: 3, codigo: 'PER-2025-1', nombre: 'I Ciclo 2025', anio: 2025, ciclo: 1, estado: 'CERRADO' },
  ];

  assert.equal(filtrarPeriodosAcademicos(lista, '', '').length, 3);
  assert.equal(filtrarPeriodosAcademicos(lista, '2026', '').length, 2);
  assert.equal(filtrarPeriodosAcademicos(lista, '', 'EN_CURSO').length, 1);
  assert.equal(filtrarPeriodosAcademicos(lista, 'II Ciclo', 'EN_CURSO').length, 1);
  assert.equal(filtrarPeriodosAcademicos(lista, 'inexistente', '').length, 0);
});

test('periodos.helpers — transiciones de estado oficiales', () => {
  assert.deepEqual(TRANSICIONES_PERIODO.BORRADOR.map((t) => t.estado), ['EN_PREPARACION', 'CANCELADO']);
  assert.deepEqual(TRANSICIONES_PERIODO.EN_PREPARACION.map((t) => t.estado), ['EN_CURSO', 'CANCELADO']);
  assert.deepEqual(TRANSICIONES_PERIODO.EN_CURSO.map((t) => t.estado), ['CERRADO']);
  assert.deepEqual(TRANSICIONES_PERIODO.CERRADO, []);
  assert.deepEqual(TRANSICIONES_PERIODO.CANCELADO, []);
});

test('periodos.helpers — validación de calendario, estructura bloqueada y corrección de período cerrado', () => {
  assert.equal(calcularFechaMaximaDisponibilidad('2026-03-01'), '2026-02-28');
  assert.equal(calcularFechaMaximaDisponibilidad(''), null);

  const fechaInvalida = validarYConstruirDatosPeriodo({
    anio: 2026,
    ciclo: 1,
    fechaInicio: '2026-03-10',
    fechaFin: '2026-03-05',
    fechaLimiteDisponibilidad: '2026-03-01',
  });
  assert.equal(fechaInvalida.ok, false);
  assert.match(fechaInvalida.error, /posterior a la fecha de inicio/);

  const limiteTardio = validarYConstruirDatosPeriodo({
    anio: 2026,
    ciclo: 1,
    fechaInicio: '2026-03-10',
    fechaFin: '2026-06-20',
    fechaLimiteDisponibilidad: '2026-03-10',
  });
  assert.equal(limiteTardio.ok, false);
  assert.match(limiteTardio.error, /anterior al inicio/);

  const bloqueado = validarYConstruirDatosPeriodo({
    observaciones: 'Solo texto',
    editando: true,
    estructuraBloqueada: true,
  });
  assert.deepEqual(bloqueado, { ok: true, datos: { observaciones: 'Solo texto' } });

  const motivoCorto = validarYConstruirDatosPeriodo({
    anio: 2026,
    ciclo: 1,
    fechaInicio: '2026-03-10',
    fechaFin: '2026-06-20',
    fechaLimiteDisponibilidad: '2026-03-01',
    excepcional: true,
    motivo: 'corto',
  });
  assert.equal(motivoCorto.ok, false);
  assert.match(motivoCorto.error, /al menos 10 caracteres/);

  const excepcionalValido = validarYConstruirDatosPeriodo({
    anio: 2026,
    ciclo: 1,
    fechaInicio: '2026-03-10',
    fechaFin: '2026-06-20',
    fechaLimiteDisponibilidad: '2026-03-01',
    observaciones: 'Corrección aprobada',
    excepcional: true,
    motivo: 'Ajuste oficial aprobado por dirección',
  });
  assert.equal(excepcionalValido.ok, true);
  assert.equal(excepcionalValido.datos.motivo, 'Ajuste oficial aprobado por dirección');
});

test('PeriodoAcciones — impide transiciones no disponibles declaradas por el backend', async () => {
  const alertEl = {
    id: 'sgpaAlertDialog',
    open: false,
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
    querySelector: () => null,
    getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
  let htmlAlerta = '';
  Object.defineProperty(alertEl, 'innerHTML', {
    get: () => htmlAlerta,
    set: (v) => {
      htmlAlerta = v;
    },
  });

  globalThis.document = {
    body: { appendChild: () => {} },
    getElementById: (id) => (id === 'sgpaAlertDialog' ? alertEl : null),
    createElement: () => alertEl,
    querySelectorAll: () => [],
  };
  let llamadoServicio = false;
  globalThis.window = {
    setTimeout,
    clearTimeout,
    sgpa: {
      cambiarEstadoPeriodoAcademico: async () => {
        llamadoServicio = true;
        return { ok: true };
      },
    },
  };

  await ejecutarCambioEstadoPeriodo({
    periodo: {
      id: 4,
      nombre: 'I Ciclo 2026',
      estado: 'BORRADOR',
      transicionesEstado: [
        { estado: 'EN_PREPARACION', disponible: false, motivo: 'Falta definir fechas' },
      ],
    },
    nuevoEstado: 'EN_PREPARACION',
    recargarPeriodos: async () => {},
    vigente: () => true,
    operacionId: 1,
  });

  assert.equal(llamadoServicio, false);
  assert.match(htmlAlerta, /Falta definir fechas/);
});

test('PeriodoAcciones — procesa el error devuelto por el servicio de cambio de estado', async () => {
  const botones = new Map();
  const confirmDialog = {
    open: false,
    innerHTML: '',
    addEventListener: () => {},
    querySelector(selector) {
      const id = selector.slice(1);
      if (!botones.has(id)) {
        const listeners = new Map();
        botones.set(id, {
          addEventListener(tipo, callback) {
            listeners.set(tipo, callback);
          },
          click() {
            return listeners.get('click')?.({ target: this });
          },
        });
      }
      return botones.get(id);
    },
    showModal() {
      this.open = true;
      queueMicrotask(() => botones.get('sgpaConfirmAccept')?.click());
    },
    close() {
      this.open = false;
    },
    remove: () => {},
  };
  const alertEl = {
    id: 'sgpaAlertDialog',
    open: false,
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
    querySelector: () => null,
    getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
  let htmlAlerta = '';
  Object.defineProperty(alertEl, 'innerHTML', {
    get: () => htmlAlerta,
    set: (value) => {
      htmlAlerta = value;
    },
  });

  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  let llamadasServicio = 0;
  globalThis.document = {
    body: { appendChild: () => {} },
    getElementById: (id) => (id === 'sgpaAlertDialog' ? alertEl : null),
    createElement: () => confirmDialog,
    querySelectorAll: () => [],
  };
  globalThis.window = { setTimeout, clearTimeout };
  globalThis.window.sgpa = {
    cambiarEstadoPeriodoAcademico: async () => {
      llamadasServicio += 1;
      return { ok: false, message: 'Backend de períodos no disponible' };
    },
  };

  try {
    await ejecutarCambioEstadoPeriodo({
      periodo: { id: 5, nombre: 'II Ciclo 2026', estado: 'BORRADOR' },
      nuevoEstado: 'EN_PREPARACION',
      recargarPeriodos: async () => {},
      vigente: () => true,
      operacionId: 2,
    });

    assert.equal(llamadasServicio, 1);
    assert.match(htmlAlerta, /Backend de períodos no disponible/);
    assert.match(htmlAlerta, /No se pudo cambiar el estado/);
  } finally {
    globalThis.document = anteriorDocument;
    globalThis.window = anteriorWindow;
  }
});
