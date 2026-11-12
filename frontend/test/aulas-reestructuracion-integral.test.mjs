import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AulasPage,
  compararAulasPorEstadoYNumero,
  iniciarAulasPage,
} from '../src/pages/aulas/AulasPage.js';
import {
  detalleAuditoriaTexto,
  fechaHoraLocalParaInput,
  fechaParaInput,
  horaCorta,
  nombreAccionAuditoria,
  nombreEntidadAuditoria,
  nombreOrigenOcupacion,
  nombreRecomendacionCapacidad,
  nombreTipoReserva,
  normalizarFechaHoraInput,
  normalizarHoraFormulario,
  obtenerDetalleAuditoria,
  obtenerRangoOcupacionInicial,
  periodoPermiteEditarDisponibilidad,
  seleccionarPeriodoPreferido,
  separarFechaHoraFormulario,
} from '../src/pages/aulas/aulas.helpers.js';
import {
  crearContextoAulas,
  puedeBuscarAulasDisponibles,
  puedeConsultarAuditoriaAula,
  puedeGestionarAulas,
} from '../src/pages/aulas/aulas.context.js';
import {
  inicializarControlesHorario,
  prepararParteHora,
  renderizarControlFechaHoraCompacto,
  renderizarControlHoraCompacto,
  sincronizarControlFechaHoraCompacto,
  sincronizarControlHoraCompacto,
} from '../src/pages/aulas/aulas.horarios.js';
import {
  cargarAulas,
  manejarAccionTabla,
  obtenerAulasFiltradas,
  renderizarAulas,
  renderizarPaginacionAulas,
  renderizarVistaListado,
} from '../src/pages/aulas/AulasListadoView.js';
import {
  construirSugerenciaDesdeSlot,
  obtenerAulaParaSlot,
  obtenerSlotRegistrablePorKey,
} from '../src/pages/aulas/AulasPlanosView.js';
import {
  abrirCatalogoEquipamientos,
  renderizarCatalogoEquipamientos,
} from '../src/pages/aulas/AulasEquipamientosCatalogoView.js';
import {
  cargarDisponibilidadBaseAula,
  renderizarSeccionDisponibilidadBase,
} from '../src/pages/aulas/AulaDisponibilidadView.js';
import {
  renderizarIndisponibilidades,
} from '../src/pages/aulas/AulaIndisponibilidadesView.js';
import {
  cargarOcupacionAula,
  renderizarOcupacionAula,
  renderizarSeccionOcupacion,
} from '../src/pages/aulas/AulaOcupacionView.js';
import {
  renderizarReservasAula,
} from '../src/pages/aulas/AulaReservasView.js';
import {
  cargarAuditoriaAula,
  renderizarAuditoriaAula,
  renderizarSeccionAuditoriaAula,
} from '../src/pages/aulas/AulaAuditoriaView.js';
import {
  abrirDetalleAula,
} from '../src/pages/aulas/AulaDetalleView.js';
import {
  construirCriteriosBusquedaAulas,
  ejecutarBusquedaAulasDisponibles,
  evaluarAulaDisponible,
  renderizarResultadosBusquedaAulas,
} from '../src/pages/aulas/AulasBusquedaView.js';
import { guardarSesion } from '../src/app/session.js';
import { ROLES } from '../src/config/permissions.js';

function crearDomSimulado() {
  const elementos = new Map();

  function crearElemento(id, tag = 'div') {
    if (id && elementos.has(id)) {
      return elementos.get(id);
    }

    const listeners = new Map();
    const clases = new Set();
    const children = [];

    const el = {
      id: id || '',
      tagName: tag.toUpperCase(),
      innerHTML: '',
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
      open: false,
      dataset: {},
      className: '',
      min: '',
      max: '',
      classList: {
        add: (...names) => names.forEach((n) => clases.add(n)),
        remove: (...names) => names.forEach((n) => clases.delete(n)),
        toggle: (name, force) => {
          if (force === undefined) {
            if (clases.has(name)) clases.delete(name);
            else clases.add(name);
          } else if (force) {
            clases.add(name);
          } else {
            clases.delete(name);
          }
        },
        contains: (name) => clases.has(name),
      },
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      removeEventListener: (type, fn) => {
        if (!listeners.has(type)) return;
        listeners.set(
          type,
          listeners.get(type).filter((h) => h !== fn),
        );
      },
      getListeners: (type) => listeners.get(type) || [],
      dispatchEvent: async (type, event = {}) => {
        const handlers = [...(listeners.get(type) || [])];
        for (const h of handlers) {
          await h({ currentTarget: el, target: el, preventDefault: () => {}, ...event });
        }
      },
      appendChild: (child) => children.push(child),
      remove: () => {
        if (id) elementos.delete(id);
      },
      showModal: () => {
        el.open = true;
      },
      close: () => {
        el.open = false;
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      matches: () => false,
      closest: () => null,
    };

    if (id) {
      elementos.set(id, el);
    }
    return el;
  }

  return {
    elementos,
    crearElemento,
    document: {
      body: crearElemento('__body__', 'body'),
      getElementById: (id) => crearElemento(id),
      createElement: (tag) => crearElemento('', tag),
      querySelectorAll: () => [],
      querySelector: () => null,
    },
  };
}

test('aulas.helpers — formateadores, fechas, horarios, auditoría y periodos', () => {
  assert.equal(nombreTipoReserva('EXAMEN'), 'Examen');
  assert.equal(nombreTipoReserva('CUSTOM'), 'CUSTOM');
  assert.equal(nombreTipoReserva(null), '—');

  assert.equal(nombreRecomendacionCapacidad('RECOMENDADA'), 'Recomendada');
  assert.equal(nombreRecomendacionCapacidad('OTRO'), 'Sin evaluar');
  assert.equal(nombreRecomendacionCapacidad(undefined), 'Sin evaluar');

  assert.equal(nombreOrigenOcupacion('RESERVA'), 'Reserva');
  assert.equal(nombreOrigenOcupacion('INDISPONIBILIDAD'), 'Indisponibilidad');
  assert.equal(nombreOrigenOcupacion(null), '—');

  assert.equal(nombreAccionAuditoria('CREAR'), 'Creación');
  assert.equal(nombreAccionAuditoria('DESCONOCIDA'), 'DESCONOCIDA');
  assert.equal(nombreEntidadAuditoria('AULA'), 'Aula');
  assert.equal(nombreEntidadAuditoria(undefined), '—');

  assert.equal(obtenerDetalleAuditoria(null), null);
  assert.deepEqual(obtenerDetalleAuditoria({ a: 1 }), { a: 1 });
  assert.deepEqual(obtenerDetalleAuditoria('{"a":2}'), { a: 2 });
  assert.equal(obtenerDetalleAuditoria('texto plano'), 'texto plano');
  assert.equal(detalleAuditoriaTexto(null), '');
  assert.equal(detalleAuditoriaTexto('hola'), 'hola');
  assert.match(detalleAuditoriaTexto({ a: 1 }), /"a": 1/);

  assert.equal(periodoPermiteEditarDisponibilidad({ estado: 'BORRADOR' }), true);
  assert.equal(periodoPermiteEditarDisponibilidad({ estado: 'EN_PREPARACION' }), true);
  assert.equal(periodoPermiteEditarDisponibilidad({ estado: 'EN_CURSO' }), false);
  assert.equal(periodoPermiteEditarDisponibilidad(null), false);

  assert.equal(seleccionarPeriodoPreferido([]), null);
  assert.equal(
    seleccionarPeriodoPreferido([
      { id: 1, estado: 'BORRADOR' },
      { id: 2, estado: 'EN_CURSO' },
      { id: 3, estado: 'EN_PREPARACION' },
    ])?.id,
    3,
  );
  assert.equal(
    seleccionarPeriodoPreferido([{ id: 1, estado: 'CERRADO' }])?.id,
    1,
  );

  assert.equal(normalizarFechaHoraInput('2026-11-12T08:30'), '2026-11-12T08:30:00');
  assert.equal(normalizarFechaHoraInput('2026-11-12T08:30:15'), '2026-11-12T08:30:15');
  assert.equal(normalizarFechaHoraInput(''), '');

  const ref = new Date(2026, 10, 12, 9, 5);
  assert.equal(fechaHoraLocalParaInput(ref), '2026-11-12T09:05');
  assert.deepEqual(obtenerRangoOcupacionInicial(ref), {
    inicio: '2026-11-12T00:00',
    fin: '2026-11-12T23:59',
  });

  assert.equal(horaCorta('07:30:00'), '07:30');
  assert.equal(horaCorta(null), '—');

  assert.equal(normalizarHoraFormulario('7:5'), '07:05');
  assert.equal(normalizarHoraFormulario('23:59:00'), '23:59');
  assert.equal(normalizarHoraFormulario('24:00'), '');
  assert.equal(normalizarHoraFormulario('12:60'), '');
  assert.equal(normalizarHoraFormulario('abc'), '');

  assert.deepEqual(separarFechaHoraFormulario('2026-11-12T08:15'), {
    fecha: '2026-11-12',
    hora: '08:15',
  });
  assert.deepEqual(separarFechaHoraFormulario('invalido'), {
    fecha: '',
    hora: '',
  });
  assert.equal(fechaParaInput('fecha-invalida'), '');
  assert.equal(fechaParaInput(null), '');
});

test('aulas.horarios — renderizado, validación y sincronización sin duplicar listeners', () => {
  const htmlHora = renderizarControlHoraCompacto('horaInicio', '8:5');
  assert.match(htmlHora, /id="horaInicio"/);
  assert.match(htmlHora, /value="08"/);
  assert.match(htmlHora, /value="05"/);

  const htmlFechaHora = renderizarControlFechaHoraCompacto(
    'fechaInicio',
    '2026-11-12T14:30',
  );
  assert.match(htmlFechaHora, /id="fechaInicio"/);
  assert.match(htmlFechaHora, /value="2026-11-12T14:30"/);

  const docAnterior = global.document;
  const { document: docSim, crearElemento } = crearDomSimulado();
  global.document = docSim;

  try {
    const hidden = crearElemento('horaPrueba', 'input');
    const horaIn = crearElemento('hIn', 'input');
    const minIn = crearElemento('mIn', 'input');
    horaIn.value = '25';
    minIn.value = '30';

    assert.equal(prepararParteHora(horaIn, 23), '');
    assert.equal(horaIn.classList.contains('is-invalid'), true);

    horaIn.value = '9a';
    assert.equal(prepararParteHora(horaIn, 23), '09');
    assert.equal(horaIn.classList.contains('is-invalid'), false);

    const control = {
      dataset: { targetId: 'horaPrueba' },
      querySelector: (sel) => {
        if (sel === '[data-time-hour]') return horaIn;
        if (sel === '[data-time-minute]') return minIn;
        return null;
      },
      querySelectorAll: () => [horaIn, minIn],
    };

    sincronizarControlHoraCompacto(control);
    assert.equal(hidden.value, '09:30');

    const fechaHidden = crearElemento('fechaPrueba', 'input');
    const dateIn = crearElemento('dIn', 'input');
    dateIn.value = '2026-11-12';
    const dtControl = {
      dataset: { targetId: 'fechaPrueba' },
      querySelector: (sel) => {
        if (sel === '[data-datetime-date]') return dateIn;
        if (sel === '[data-time-hour]') return horaIn;
        if (sel === '[data-time-minute]') return minIn;
        return null;
      },
      querySelectorAll: () => [dateIn, horaIn, minIn],
    };
    sincronizarControlFechaHoraCompacto(dtControl);
    assert.equal(fechaHidden.value, '2026-11-12T09:30');

    const rootSim = {
      querySelectorAll: (sel) =>
        sel === '[data-aulas-time-control]' ? [control] : [],
    };
    inicializarControlesHorario(rootSim);
    inicializarControlesHorario(rootSim);
    assert.equal(horaIn.getListeners('input').length, 1);
    assert.equal(horaIn.getListeners('blur').length, 1);
  } finally {
    global.document = docAnterior;
  }
});

test('aulas.context — tokens de concurrencia, limpieza y permisos', () => {
  const ctx = crearContextoAulas();
  let limpiado = 0;
  ctx.registrarLimpiezaVista(() => {
    limpiado += 1;
  });

  const i1 = ctx.iniciarInstancia();
  assert.equal(limpiado, 1);
  assert.equal(ctx.esInstanciaVigente(i1.instancia), true);

  const disp1 = ctx.siguienteTokenDisponibilidad();
  assert.equal(ctx.esDisponibilidadVigente(disp1), true);
  const disp2 = ctx.siguienteTokenDisponibilidad();
  assert.equal(ctx.esDisponibilidadVigente(disp1), false);
  assert.equal(ctx.esDisponibilidadVigente(disp2), true);

  const sub1 = ctx.iniciarSubvista();
  assert.equal(ctx.esSubvistaVigente(sub1.instancia, sub1.subvistaToken), true);
  assert.equal(ctx.esDisponibilidadVigente(disp2), false);

  const i2 = ctx.iniciarInstancia();
  assert.equal(ctx.esInstanciaVigente(i1.instancia), false);
  assert.equal(ctx.esSubvistaVigente(sub1.instancia, sub1.subvistaToken), false);
  assert.equal(ctx.esInstanciaVigente(i2.instancia), true);

  guardarSesion({
    usuario: {
      id: 1,
      rolActivo: ROLES.ADMIN_GLOBAL,
      roles: [ROLES.ADMIN_GLOBAL],
    },
  });
  assert.equal(puedeGestionarAulas(), true);
  assert.equal(puedeBuscarAulasDisponibles(), true);
  assert.equal(puedeConsultarAuditoriaAula(), true);
});

test('AulasListadoView y AulasPlanosView — filtros, paginación, acciones y protección ante respuestas obsoletas', async () => {
  const docAnterior = global.document;
  const winAnterior = global.window;
  const { document: docSim, crearElemento } = crearDomSimulado();
  global.document = docSim;

  try {
    guardarSesion({
      usuario: {
        id: 1,
        rolActivo: ROLES.ADMIN_GLOBAL,
        roles: [ROLES.ADMIN_GLOBAL],
      },
    });

    const ctx = crearContextoAulas();
    const lista = Array.from({ length: 12 }, (_, idx) => ({
      id: idx + 1,
      codigo: String(idx + 1),
      nombre: `Aula ${idx + 1}`,
      ubicacion: idx === 0 ? 'Edificio Principal' : 'Edificio 2',
      tipo: idx === 11 ? 'LABORATORIO' : 'AULA',
      tipoMobiliario: 'PUPITRE',
      capacidad: 30,
      origen: 'UNA',
      activo: idx % 2 === 0,
    }));
    ctx.estado.aulas = lista;

    crearElemento('aulasBuscar').value = 'principal';
    assert.equal(obtenerAulasFiltradas(lista, docSim).length, 1);

    crearElemento('aulasBuscar').value = '';
    crearElemento('aulasTipo').value = 'LABORATORIO';
    assert.equal(obtenerAulasFiltradas(lista, docSim).length, 1);

    crearElemento('aulasTipo').value = '';
    crearElemento('aulasEstado').value = 'INACTIVAS';
    assert.equal(obtenerAulasFiltradas(lista, docSim).length, 6);

    crearElemento('aulasEstado').value = 'TODAS';

    const pagHtml = renderizarPaginacionAulas(12, ctx);
    assert.match(pagHtml, /data-aulas-page="2"/);
    assert.match(pagHtml, /Mostrando[\s\S]*1-10[\s\S]*12/);

    renderizarVistaListado(ctx, {});
    renderizarAulas(ctx);
    assert.match(crearElemento('aulasContent').innerHTML, /Aula 1/);

    await manejarAccionTabla(
      {
        target: {
          closest: (sel) =>
            sel === '[data-aulas-page]'
              ? { dataset: { aulasPage: '2' } }
              : null,
        },
      },
      ctx,
      {},
    );
    assert.equal(ctx.estado.paginaAulasActual, 2);

    const slot = obtenerSlotRegistrablePorKey('principal-p2-aula-1');
    assert.ok(slot);
    assert.equal(obtenerAulaParaSlot(slot, lista)?.id, 1);
    assert.equal(construirSugerenciaDesdeSlot(slot)?.numero, 1);

    // Respuesta obsoleta en cargarAulas no debe sobrescribir la instancia más reciente
    let resolverLento;
    global.window = {
      sgpa: {
        listarAulas: () =>
          new Promise((resolve) => {
            resolverLento = resolve;
          }),
      },
    };

    const marcaVieja = ctx.iniciarInstancia();
    const promesaVieja = cargarAulas(marcaVieja.instancia, ctx);
    ctx.iniciarInstancia();
    ctx.estado.aulas = [{ id: 99, codigo: '99', nombre: 'Aula 99', activo: true }];
    resolverLento({ ok: true, aulas: [{ id: 1, codigo: '1', nombre: 'Aula Vieja', activo: true }] });
    await promesaVieja;
    assert.equal(ctx.estado.aulas[0].id, 99);
  } finally {
    global.document = docAnterior;
    global.window = winAnterior;
  }
});

test('AulasEquipamientosCatalogoView — montaje repetido no duplica listeners en aulasVista', async () => {
  const docAnterior = global.document;
  const winAnterior = global.window;
  const { document: docSim, crearElemento } = crearDomSimulado();
  global.document = docSim;

  try {
    guardarSesion({
      usuario: {
        id: 1,
        rolActivo: ROLES.ADMIN_GLOBAL,
        roles: [ROLES.ADMIN_GLOBAL],
      },
    });
    global.window = {
      sgpa: {
        listarEquipamientos: async () => ({
          ok: true,
          equipamientos: [
            {
              id: 10,
              nombre: 'Proyector',
              descripcion: 'Epson',
              cantidadTotal: 5,
              cantidadAsignada: 1,
              cantidadDisponible: 4,
              activo: true,
            },
          ],
        }),
      },
    };

    const ctx = crearContextoAulas();
    const vista = crearElemento('aulasVista');
    await abrirCatalogoEquipamientos(ctx, {});
    await abrirCatalogoEquipamientos(ctx, {});
    renderizarCatalogoEquipamientos(ctx, {});

    assert.equal(vista.getListeners('click').length, 1);
    ctx.limpiarVista();
    assert.equal(vista.getListeners('click').length, 0);
  } finally {
    global.document = docAnterior;
    global.window = winAnterior;
  }
});

test('Submódulos de detalle, disponibilidad, ocupación, reservas, auditoría y búsqueda', async () => {
  const docAnterior = global.document;
  const winAnterior = global.window;
  const { document: docSim, crearElemento } = crearDomSimulado();
  global.document = docSim;

  try {
    guardarSesion({
      usuario: {
        id: 1,
        rolActivo: ROLES.ADMIN_GLOBAL,
        roles: [ROLES.ADMIN_GLOBAL],
      },
    });

    const ctx = crearContextoAulas();
    ctx.estado.aulaDetalleActual = { id: 7, codigo: '7', nombre: 'Aula 7', activo: true };
    ctx.estado.periodosDisponibilidadAula = [
      { id: 1, codigo: '2026-1', nombre: 'I Ciclo', estado: 'EN_PREPARACION' },
    ];

    assert.match(renderizarSeccionDisponibilidadBase(ctx), /aulaPeriodoDisponibilidad/);
    assert.match(renderizarIndisponibilidades([]), /no tiene[\s\S]*indisponibilidades/);
    assert.match(renderizarSeccionOcupacion(), /ocupacionAulaForm/);
    assert.match(renderizarReservasAula([]), /no tiene reservas/);
    assert.match(renderizarSeccionAuditoriaAula(), /cargarAuditoriaAulaButton/);

    let resolverDispLenta;
    global.window = {
      sgpa: {
        listarDisponibilidadesAula: () =>
          new Promise((resolve) => {
            resolverDispLenta = resolve;
          }),
        consultarOcupacionAula: async () => ({
          ok: true,
          data: { ocupaciones: [] },
        }),
        listarAuditoriaAula: async () => ({
          ok: true,
          auditoria: [
            {
              accion: 'CREAR',
              entidad: 'AULA',
              entidadId: 7,
              createdAt: '2026-11-12T10:00:00Z',
              usuarioId: 1,
              detalle: { codigo: '7' },
            },
          ],
        }),
        obtenerAula: async () => ({ ok: true, data: ctx.estado.aulaDetalleActual }),
        listarEquipamientoAula: async () => ({ ok: true, equipamientos: [] }),
        listarEquipamientos: async () => ({ ok: true, equipamientos: [] }),
        listarIndisponibilidadesAula: async () => ({ ok: true, indisponibilidades: [] }),
        listarReservasAula: async () => ({ ok: true, reservas: [] }),
        listarPeriodosAcademicos: async () => ({
          ok: true,
          periodos: ctx.estado.periodosDisponibilidadAula,
        }),
        buscarAulasDisponibles: async () => ({
          ok: true,
          aulas: [
            {
              id: 7,
              codigo: '7',
              nombre: 'Aula 7',
              tipo: 'AULA',
              tipoMobiliario: 'PUPITRE',
              capacidad: 35,
              capacidadSobrante: 5,
              recomendacionCapacidad: 'RECOMENDADA',
              equipamientos: [],
            },
          ],
        }),
        evaluarAulaParaAsignacion: async () => ({
          ok: true,
          data: { apta: true, advertencias: [] },
        }),
      },
    };

    // Guard de concurrencia en disponibilidad base
    crearElemento('aulaDisponibilidadBaseContent');
    const promesaDisp = cargarDisponibilidadBaseAula(1, ctx);
    ctx.siguienteTokenDisponibilidad();
    resolverDispLenta({ ok: true, disponibilidades: [{ id: 55, diaSemana: 1 }] });
    await promesaDisp;
    assert.equal(ctx.estado.disponibilidadBaseAulaActual.length, 0);

    // Ocupación y auditoría
    crearElemento('ocupacionAulaContent');
    await cargarOcupacionAula('2026-11-12T08:00', '2026-11-12T10:00', ctx);
    renderizarOcupacionAula(ctx);
    assert.match(crearElemento('ocupacionAulaContent').innerHTML, /Sin ocupaciones registradas/);

    crearElemento('auditoriaAulaContent');
    await cargarAuditoriaAula(ctx);
    renderizarAuditoriaAula(ctx);
    assert.match(crearElemento('auditoriaAulaContent').innerHTML, /Creación/);

    // Detalle completo sin controles de reservas
    await abrirDetalleAula(7, ctx, {});
    const detalleHtml = crearElemento('aulasVista').innerHTML;
    assert.match(detalleHtml, /Aula 7/);
    assert.doesNotMatch(detalleHtml, /nuevaReservaAulaButton|data-reserva-action/);

    // Búsqueda y validación de criterios
    assert.throws(
      () => construirCriteriosBusquedaAulas(docSim),
      /Debe indicar periodo, fecha y horario/,
    );
    crearElemento('buscarAulaPeriodo').value = '1';
    crearElemento('buscarAulaFecha').value = '2026-11-12';
    crearElemento('buscarAulaHoraInicio').value = '10:00';
    crearElemento('buscarAulaHoraFin').value = '09:00';
    assert.throws(
      () => construirCriteriosBusquedaAulas(docSim),
      /posterior a la hora de inicio/,
    );
    crearElemento('buscarAulaHoraFin').value = '11:00';

    crearElemento('buscarAulasResultados');
    crearElemento('buscarAulasResumen');
    await ejecutarBusquedaAulasDisponibles({ preventDefault: () => {} }, ctx, {});
    renderizarResultadosBusquedaAulas(ctx, {});
    assert.match(crearElemento('buscarAulasResultados').innerHTML, /Aula 7/);
    await evaluarAulaDisponible(7, ctx);

    // Montaje principal de AulasPage sin errores
    assert.match(AulasPage(), /id="aulasVista"/);
    assert.equal(typeof compararAulasPorEstadoYNumero, 'function');
    iniciarAulasPage();
  } finally {
    global.document = docAnterior;
    global.window = winAnterior;
  }
});
