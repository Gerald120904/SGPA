/**
 * SGPA — Búsqueda de aulas disponibles y evaluación para asignación académica.
 */

import { DataTable } from '../../components/DataTable.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  buscarAulasDisponibles,
  evaluarAulaParaAsignacion,
  listarEquipamientos,
} from '../../services/aulas.service.js';
import { listarPeriodosAcademicos } from '../../services/periodos.service.js';
import {
  TIPOS_AULA,
  TIPOS_MOBILIARIO,
  nombreMobiliario,
  nombreRecomendacionCapacidad,
  nombreTipoAula,
  nombreVisibleAula,
  seleccionarPeriodoPreferido,
} from './aulas.helpers.js';
import {
  inicializarControlesHorario,
  renderizarControlHoraCompacto,
} from './aulas.horarios.js';
import {
  puedeAsignarAulas,
  puedeBuscarAulasDisponibles,
  puedeUsarEvaluacionAula,
} from './aulas.context.js';

export async function abrirBusquedaAulasDisponibles(
  contexto,
  { onVolver = null, onVerDetalle = null } = {},
) {
  if (!puedeBuscarAulasDisponibles()) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para buscar aulas disponibles.',
    });
    return;
  }

  const vista = document.getElementById('aulasVista');

  if (!vista) {
    return;
  }

  const { instancia, subvistaToken } = contexto.iniciarSubvista();

  vista.innerHTML = `
    <div class="aulas-message">
      Preparando búsqueda...
    </div>
  `;

  try {
    const [resultadoPeriodos, resultadoEquipamientos] = await Promise.all([
      listarPeriodosAcademicos(),
      listarEquipamientos(),
    ]);

    if (!contexto.esSubvistaVigente(instancia, subvistaToken)) {
      return;
    }

    if (!resultadoPeriodos?.ok) {
      throw new Error(
        resultadoPeriodos?.message ||
          'No fue posible consultar los periodos académicos.',
      );
    }

    if (!resultadoEquipamientos?.ok) {
      throw new Error(
        resultadoEquipamientos?.message ||
          'No fue posible consultar los equipamientos.',
      );
    }

    contexto.estado.periodosBusquedaAulas = (
      Array.isArray(resultadoPeriodos.periodos)
        ? resultadoPeriodos.periodos
        : []
    ).filter((periodo) => !['CERRADO', 'CANCELADO'].includes(periodo.estado));

    contexto.estado.equipamientosBusquedaAulas = (
      Array.isArray(resultadoEquipamientos.equipamientos)
        ? resultadoEquipamientos.equipamientos
        : []
    ).filter((equipo) => equipo.activo);

    contexto.estado.aulasDisponiblesActual = [];
    contexto.estado.criteriosBusquedaAulasActual = null;

    renderizarBusquedaAulasDisponibles(contexto, { onVolver, onVerDetalle });
  } catch (error) {
    if (!contexto.esSubvistaVigente(instancia, subvistaToken)) {
      return;
    }

    mostrarError({
      titulo: 'No se pudo iniciar la búsqueda',
      mensaje: error?.message || 'No fue posible cargar la información necesaria.',
    });

    if (typeof onVolver === 'function') {
      onVolver();
    }
  }
}

export function renderizarBusquedaAulasDisponibles(
  contexto,
  { onVolver = null, onVerDetalle = null } = {},
) {
  const vista = document.getElementById('aulasVista');

  if (!vista) {
    return;
  }

  const { periodosBusquedaAulas } = contexto.estado;
  const periodoInicial = seleccionarPeriodoPreferido(periodosBusquedaAulas);

  vista.innerHTML = `
    <div class="aulas-detail-header">
      <button
        id="volverBusquedaAulasButton"
        class="aulas-back-button"
        type="button"
      >
        <i
          data-lucide="arrow-left"
          aria-hidden="true"
        ></i>
        Volver
      </button>

      <div>
        <h2>Buscar aulas disponibles</h2>
        <p>
          Consulte espacios que cumplan
          el horario y los requisitos
          académicos indicados.
        </p>
      </div>
    </div>

    <section class="aulas-detail-card aulas-search-panel">
      <div class="aulas-search-intro">
        <div
          class="aulas-search-intro-icon"
          aria-hidden="true"
        >
          <i data-lucide="search"></i>
        </div>

        <div>
          <strong>Encuentre el espacio adecuado</strong>
          <p>
            Defina el periodo, horario, capacidad
            y recursos necesarios para localizar
            aulas disponibles.
          </p>
        </div>
      </div>

      <form
        id="buscarAulasForm"
        class="aulas-search-available-form"
      >
        <label>
          <span>Periodo académico</span>

          <select
            id="buscarAulaPeriodo"
            required
          >
            ${
              periodosBusquedaAulas.length
                ? periodosBusquedaAulas
                    .map(
                      (periodo) => `
                        <option
                          value="${periodo.id}"
                          ${
                            periodoInicial?.id === periodo.id ? 'selected' : ''
                          }
                        >
                          ${escapeHtml(periodo.codigo)}
                          —
                          ${escapeHtml(periodo.nombre)}
                        </option>
                      `,
                    )
                    .join('')
                : `
                  <option
                    value=""
                    disabled
                    selected
                  >
                    Sin periodos disponibles
                  </option>
                `
            }
          </select>
        </label>

        <label>
          <span>Fecha</span>

          <input
            id="buscarAulaFecha"
            type="date"
            required
          >
        </label>

        <label>
          <span>Hora inicio</span>

          ${renderizarControlHoraCompacto('buscarAulaHoraInicio')}
        </label>

        <label>
          <span>Hora fin</span>

          ${renderizarControlHoraCompacto('buscarAulaHoraFin')}
        </label>

        <label>
          <span>Estudiantes</span>

          <input
            id="buscarAulaEstudiantes"
            type="number"
            min="1"
            placeholder="Opcional"
          >
        </label>

        <label>
          <span>Tipo de aula</span>

          <select id="buscarAulaTipo">
            <option value="">Cualquier tipo</option>
            ${Object.entries(TIPOS_AULA)
              .map(
                ([valor, nombre]) => `
                  <option value="${valor}">
                    ${nombre}
                  </option>
                `,
              )
              .join('')}
          </select>
        </label>

        <label>
          <span>Mobiliario</span>

          <select id="buscarAulaMobiliario">
            <option value="">Cualquier mobiliario</option>
            ${Object.entries(TIPOS_MOBILIARIO)
              .map(
                ([valor, nombre]) => `
                  <option value="${valor}">
                    ${nombre}
                  </option>
                `,
              )
              .join('')}
          </select>
        </label>

        <label class="aulas-search-checkbox">
          <input
            id="buscarAulaSobrecupo"
            type="checkbox"
          >

          <span>
            Incluir aulas con
            sobrecapacidad
          </span>
        </label>

        <div class="aulas-search-equipment sgpa-form-wide">
          <div class="aulas-section-header">
            <div>
              <strong>Equipamiento requerido</strong>
              <p class="aulas-muted">Opcional</p>
            </div>

            <button
              id="agregarRequisitoEquipamientoButton"
              type="button"
              class="aulas-secondary-button"
            >
              <i
                data-lucide="plus"
                aria-hidden="true"
              ></i>
              Agregar requisito
            </button>
          </div>

          <div
            id="requisitosEquipamientoAula"
            class="aulas-search-equipment-list"
          ></div>
        </div>

        <div class="aulas-search-submit sgpa-form-wide">
          <button
            type="submit"
            class="aulas-primary-button"
          >
            <i
              data-lucide="search"
              aria-hidden="true"
            ></i>
            Buscar aulas
          </button>
        </div>
      </form>
    </section>

    <section class="aulas-detail-card aulas-search-results-panel">
      <div class="aulas-section-header">
        <div>
          <h3>Resultados</h3>
          <p
            id="buscarAulasResumen"
            class="aulas-muted"
          >
            Complete los criterios
            y ejecute una búsqueda.
          </p>
        </div>
      </div>

      <div id="buscarAulasResultados"></div>
    </section>
  `;

  inicializarControlesHorario(vista);

  document
    .getElementById('volverBusquedaAulasButton')
    ?.addEventListener('click', () => {
      if (typeof onVolver === 'function') {
        onVolver();
      }
    });

  document
    .getElementById('agregarRequisitoEquipamientoButton')
    ?.addEventListener('click', () => {
      agregarRequisitoEquipamientoBusqueda(contexto);
    });

  document
    .getElementById('buscarAulaPeriodo')
    ?.addEventListener('change', () => {
      actualizarLimitesFechaBusquedaAula(contexto);
    });

  document
    .getElementById('buscarAulasForm')
    ?.addEventListener('submit', (event) =>
      ejecutarBusquedaAulasDisponibles(event, contexto, { onVerDetalle }),
    );

  actualizarLimitesFechaBusquedaAula(contexto);

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export function actualizarLimitesFechaBusquedaAula(contexto) {
  const selector = document.getElementById('buscarAulaPeriodo');
  const inputFecha = document.getElementById('buscarAulaFecha');

  if (!selector || !inputFecha) {
    return;
  }

  const periodoId = Number(selector.value);
  const periodo = contexto.estado.periodosBusquedaAulas.find(
    (item) => item.id === periodoId,
  );

  if (!periodo) {
    return;
  }

  inputFecha.min = periodo.fechaInicio;
  inputFecha.max = periodo.fechaFin;

  if (
    !inputFecha.value ||
    inputFecha.value < periodo.fechaInicio ||
    inputFecha.value > periodo.fechaFin
  ) {
    inputFecha.value = periodo.fechaInicio;
  }
}

export function agregarRequisitoEquipamientoBusqueda(contexto) {
  const contenedor = document.getElementById('requisitosEquipamientoAula');

  if (!contenedor) {
    return;
  }

  const { equipamientosBusquedaAulas } = contexto.estado;

  if (!equipamientosBusquedaAulas.length) {
    mostrarError({
      titulo: 'Sin equipamientos',
      mensaje:
        'No existen equipamientos activos disponibles para usar como requisito.',
    });
    return;
  }

  const fila = document.createElement('div');
  fila.className = 'aulas-search-equipment-row';

  fila.innerHTML = `
    <select
      data-requisito-equipamiento
      required
    >
      <option
        value=""
        selected
        disabled
      >
        Seleccione equipamiento...
      </option>

      ${equipamientosBusquedaAulas
        .map(
          (equipo) => `
            <option value="${equipo.id}">
              ${escapeHtml(equipo.nombre)}
            </option>
          `,
        )
        .join('')}
    </select>

    <input
      data-requisito-cantidad
      type="number"
      min="1"
      value="1"
      required
      aria-label="Cantidad mínima"
    >

    <button
      type="button"
      class="aulas-icon-button is-danger"
      title="Eliminar requisito"
    >
      <i
        data-lucide="trash-2"
        aria-hidden="true"
      ></i>
    </button>
  `;

  fila.querySelector('button')?.addEventListener('click', () => {
    fila.remove();
  });

  contenedor.appendChild(fila);

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export function construirCriteriosBusquedaAulas(root = document) {
  const periodoId = Number(root.getElementById('buscarAulaPeriodo')?.value);
  const fecha = root.getElementById('buscarAulaFecha')?.value;
  const horaInicio = root.getElementById('buscarAulaHoraInicio')?.value;
  const horaFin = root.getElementById('buscarAulaHoraFin')?.value;

  if (!periodoId || !fecha || !horaInicio || !horaFin) {
    throw new Error('Debe indicar periodo, fecha y horario.');
  }

  if (horaFin <= horaInicio) {
    throw new Error(
      'La hora de finalización debe ser posterior a la hora de inicio.',
    );
  }

  const filas = [...root.querySelectorAll('.aulas-search-equipment-row')];

  const equipamientos = filas.map((fila) => ({
    equipamientoId: Number(
      fila.querySelector('[data-requisito-equipamiento]')?.value,
    ),
    cantidadMinima: Number(
      fila.querySelector('[data-requisito-cantidad]')?.value,
    ),
  }));

  const ids = new Set();

  for (const requisito of equipamientos) {
    if (!requisito.equipamientoId || requisito.cantidadMinima < 1) {
      throw new Error('Revise los requisitos de equipamiento.');
    }

    if (ids.has(requisito.equipamientoId)) {
      throw new Error('No puede agregar dos veces el mismo equipamiento.');
    }

    ids.add(requisito.equipamientoId);
  }

  const criterios = {
    periodoId,
    fechaHoraInicio: `${fecha}T${horaInicio}:00`,
    fechaHoraFin: `${fecha}T${horaFin}:00`,
    incluirSobrecupo:
      root.getElementById('buscarAulaSobrecupo')?.checked === true,
  };

  const cantidadEstudiantes = Number(
    root.getElementById('buscarAulaEstudiantes')?.value,
  );

  if (cantidadEstudiantes > 0) {
    criterios.cantidadEstudiantes = cantidadEstudiantes;
  }

  const tipo = root.getElementById('buscarAulaTipo')?.value;

  if (tipo) {
    criterios.tipo = tipo;
  }

  const tipoMobiliario = root.getElementById('buscarAulaMobiliario')?.value;

  if (tipoMobiliario) {
    criterios.tipoMobiliario = tipoMobiliario;
  }

  if (equipamientos.length) {
    criterios.equipamientos = equipamientos;
  }

  return criterios;
}

export async function ejecutarBusquedaAulasDisponibles(
  event,
  contexto,
  { onVerDetalle = null } = {},
) {
  event.preventDefault();

  const resultados = document.getElementById('buscarAulasResultados');

  if (!resultados) {
    return;
  }

  const marca = contexto.siguienteTokenBusqueda();

  try {
    const criterios = construirCriteriosBusquedaAulas();
    contexto.estado.criteriosBusquedaAulasActual = criterios;

    resultados.innerHTML = `
      <div class="aulas-message-inline">
        Buscando aulas disponibles...
      </div>
    `;

    const resultado = await buscarAulasDisponibles(criterios);

    if (!contexto.esBusquedaVigente(marca)) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible buscar aulas disponibles.',
      );
    }

    contexto.estado.criteriosBusquedaAulasActual = criterios;
    contexto.estado.aulasDisponiblesActual = Array.isArray(resultado.aulas)
      ? resultado.aulas
      : [];

    renderizarResultadosBusquedaAulas(contexto, { onVerDetalle });
  } catch (error) {
    if (!contexto.esBusquedaVigente(marca)) {
      return;
    }

    mostrarError({
      titulo: 'No se pudo realizar la búsqueda',
      mensaje: error?.message || 'Revise los criterios ingresados.',
    });
  }
}

export function renderizarResultadosBusquedaAulas(
  contexto,
  { onVerDetalle = null } = {},
) {
  const contenido = document.getElementById('buscarAulasResultados');
  const resumen = document.getElementById('buscarAulasResumen');

  if (!contenido) {
    return;
  }

  const { aulasDisponiblesActual } = contexto.estado;

  if (resumen) {
    resumen.textContent =
      aulasDisponiblesActual.length === 1
        ? '1 aula disponible encontrada.'
        : `${aulasDisponiblesActual.length} aulas disponibles encontradas.`;
  }

  const puedeEvaluar = puedeUsarEvaluacionAula();

  const filas = aulasDisponiblesActual
    .map((aula) => {
      const equipos = (aula.equipamientos || [])
        .filter(
          (relacion) => relacion.activo && relacion.equipamiento?.activo,
        )
        .map(
          (relacion) =>
            `${relacion.equipamiento.nombre} (${relacion.cantidadAsignada})`,
        );

      return `
        <tr>
          <td>
            <div class="aulas-name">
              <strong>
                ${escapeHtml(nombreVisibleAula(aula))}
              </strong>

              <small>
                ${escapeHtml(aula.ubicacion || 'Sin ubicación')}
              </small>
            </div>
          </td>

          <td>
            ${escapeHtml(nombreTipoAula(aula.tipo))}
          </td>

          <td>
            ${escapeHtml(nombreMobiliario(aula.tipoMobiliario))}
          </td>

          <td>${aula.capacidad}</td>

          <td>
            ${
              aula.capacidadSobrante === null ? '—' : aula.capacidadSobrante
            }
          </td>

          <td>
            <span
              class="aulas-capacity-badge aulas-capacity-${String(
                aula.recomendacionCapacidad || 'none',
              ).toLowerCase()}"
            >
              ${escapeHtml(
                nombreRecomendacionCapacidad(aula.recomendacionCapacidad),
              )}
            </span>
          </td>

          <td>
            ${equipos.length ? escapeHtml(equipos.join(', ')) : '—'}
          </td>

          <td>
            <div class="aulas-actions">
              <button
                type="button"
                class="aulas-icon-button"
                data-busqueda-action="ver"
                data-aula-id="${aula.id}"
                title="Ver aula"
              >
                <i
                  data-lucide="eye"
                  aria-hidden="true"
                ></i>
              </button>

              ${
                puedeEvaluar
                  ? `
                    <button
                      type="button"
                      class="aulas-secondary-button"
                      data-busqueda-action="evaluar"
                      data-aula-id="${aula.id}"
                    >
                      Evaluar
                    </button>
                  `
                  : ''
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  contenido.innerHTML = DataTable({
    columns: [
      'Aula',
      'Tipo',
      'Mobiliario',
      'Capacidad',
      'Sobrante',
      'Recomendación',
      'Equipamiento',
      'Acciones',
    ],
    rows: filas,
    emptyMessage:
      'No existen aulas que cumplan todos los criterios indicados.',
    ariaLabel: 'Aulas disponibles',
  });

  contenido.querySelectorAll('[data-busqueda-action]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      const aulaId = Number(boton.dataset.aulaId);

      if (boton.dataset.busquedaAction === 'ver') {
        if (typeof onVerDetalle === 'function') {
          await onVerDetalle(aulaId);
        }
        return;
      }

      await evaluarAulaDisponible(aulaId, contexto);
    });
  });

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export async function evaluarAulaDisponible(aulaId, contexto) {
  if (!puedeAsignarAulas()) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para asignar aulas.',
    });
    return;
  }

  const { criteriosBusquedaAulasActual } = contexto.estado;

  if (!criteriosBusquedaAulasActual) {
    return;
  }

  try {
    const resultado = await evaluarAulaParaAsignacion(
      aulaId,
      criteriosBusquedaAulasActual,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible evaluar el aula.',
      );
    }

    const evaluacion = resultado.data;

    if (evaluacion.requiereAutorizacionSobrecupo) {
      mostrarError({
        titulo: 'Requiere autorización de sobrecupo',
        mensaje: `El aula tiene capacidad para ${evaluacion.capacidad} personas y se indicaron ${evaluacion.cantidadEstudiantes} estudiantes.`,
      });
      return;
    }

    if (!evaluacion.apta) {
      mostrarError({
        titulo: 'Aula no apta',
        mensaje:
          'El aula ya no está disponible o no cumple todos los requisitos indicados.',
      });
      return;
    }

    const advertencias = Array.isArray(evaluacion.advertencias)
      ? evaluacion.advertencias
      : [];

    mostrarExito({
      titulo: 'Aula apta',
      mensaje: advertencias.length
        ? advertencias.join(' ')
        : 'El aula cumple los requisitos para el horario indicado.',
    });
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo evaluar el aula',
      mensaje: error?.message || 'No fue posible completar la evaluación.',
    });
  }
}
