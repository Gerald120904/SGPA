/**
 * SGPA — Vista de listado general, filtros, paginación y coordinación de plano de Aulas.
 */

import { DataTable } from '../../components/DataTable.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { cambiarEstadoAula, listarAulas } from '../../services/aulas.service.js';
import {
  TIPOS_AULA,
  compararAulasPorEstadoYNumero,
  compararAulasPorNumero,
  nombreMobiliario,
  nombreOrigen,
  nombreTipoAula,
  nombreVisibleAula,
  obtenerNumeroAula,
} from './aulas.helpers.js';
import {
  AULAS_POR_PAGINA,
  puedeBuscarAulasDisponibles,
  puedeGestionarAulas,
  validarGestionAulas,
} from './aulas.context.js';
import {
  construirSugerenciaDesdeSlot,
  obtenerAulaParaSlot,
  obtenerSlotRegistrablePorKey,
  renderizarPlanoAulas as renderizarPlanoAulasComponente,
} from './AulasPlanosView.js';

export function obtenerAulasFiltradas(aulas = [], root = document) {
  const texto =
    root
      .getElementById('aulasBuscar')
      ?.value?.trim()
      .toLowerCase() || '';

  const tipo = root.getElementById('aulasTipo')?.value || '';
  const estado = root.getElementById('aulasEstado')?.value || 'TODAS';

  return aulas.filter((aula) => {
    const coincideTexto =
      !texto ||
      [aula.codigo, aula.nombre, aula.ubicacion]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(texto));

    const coincideTipo = !tipo || aula.tipo === tipo;

    let coincideEstado = true;

    if (estado === 'ACTIVAS') {
      coincideEstado = aula.activo === true;
    }

    if (estado === 'INACTIVAS') {
      coincideEstado = aula.activo === false;
    }

    return coincideTexto && coincideTipo && coincideEstado;
  });
}

export function renderizarPaginacionAulas(totalElementos, contexto) {
  const { estado } = contexto;
  const totalPaginas = Math.max(
    1,
    Math.ceil(totalElementos / AULAS_POR_PAGINA),
  );

  estado.paginaAulasActual = Math.min(
    Math.max(estado.paginaAulasActual, 1),
    totalPaginas,
  );

  if (totalElementos <= AULAS_POR_PAGINA) {
    return '';
  }

  const inicio = (estado.paginaAulasActual - 1) * AULAS_POR_PAGINA + 1;
  const fin = Math.min(
    estado.paginaAulasActual * AULAS_POR_PAGINA,
    totalElementos,
  );

  const paginas = Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
    .map(
      (pagina) => `
        <button
          type="button"
          class="aulas-pagination-page ${
            pagina === estado.paginaAulasActual ? 'is-active' : ''
          }"
          data-aulas-page="${pagina}"
          aria-label="Ir a la página ${pagina}"
          aria-current="${
            pagina === estado.paginaAulasActual ? 'page' : 'false'
          }"
        >
          ${pagina}
        </button>
      `,
    )
    .join('');

  return `
    <nav
      class="aulas-pagination"
      aria-label="Paginación de aulas"
    >
      <div class="aulas-pagination-info">
        <span>
          Mostrando
          <strong>${inicio}-${fin}</strong>
          de
          <strong>${totalElementos}</strong>
          aulas
        </span>
      </div>

      <div class="aulas-pagination-controls">
        <button
          type="button"
          class="aulas-pagination-arrow"
          data-aulas-page="${estado.paginaAulasActual - 1}"
          ${estado.paginaAulasActual <= 1 ? 'disabled' : ''}
          aria-label="Página anterior"
        >
          <i
            data-lucide="chevron-left"
            aria-hidden="true"
          ></i>
        </button>

        <div class="aulas-pagination-pages">
          ${paginas}
        </div>

        <button
          type="button"
          class="aulas-pagination-arrow"
          data-aulas-page="${estado.paginaAulasActual + 1}"
          ${estado.paginaAulasActual >= totalPaginas ? 'disabled' : ''}
          aria-label="Página siguiente"
        >
          <i
            data-lucide="chevron-right"
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </nav>
  `;
}

export function renderizarListaAulas(contenido, filtradas, contexto) {
  const { estado } = contexto;
  const puedeGestionar = puedeGestionarAulas();

  const totalPaginas = Math.max(
    1,
    Math.ceil(filtradas.length / AULAS_POR_PAGINA),
  );

  estado.paginaAulasActual = Math.min(
    Math.max(estado.paginaAulasActual, 1),
    totalPaginas,
  );

  const inicio = (estado.paginaAulasActual - 1) * AULAS_POR_PAGINA;
  const aulasPagina = filtradas.slice(inicio, inicio + AULAS_POR_PAGINA);

  const filas = aulasPagina
    .map(
      (aula) => `
        <tr>
          <td>
            <strong class="aulas-code">
              ${escapeHtml(obtenerNumeroAula(aula) ?? aula.codigo)}
            </strong>
          </td>

          <td>
            <div class="aulas-name">
              <strong>
                ${escapeHtml(nombreVisibleAula(aula))}
              </strong>

              <small>
                ${escapeHtml(aula.ubicacion || 'Sin ubicación especificada')}
              </small>
            </div>
          </td>

          <td>
            ${escapeHtml(nombreTipoAula(aula.tipo))}
          </td>

          <td>
            ${escapeHtml(nombreMobiliario(aula.tipoMobiliario))}
          </td>

          <td>
            ${escapeHtml(aula.capacidad)}
          </td>

          <td>
            ${escapeHtml(nombreOrigen(aula.origen))}
          </td>

          <td>
            <span
              class="aulas-status ${aula.activo ? 'is-active' : 'is-inactive'}"
            >
              ${aula.activo ? 'Activa' : 'Inactiva'}
            </span>
          </td>

          <td>
            <div class="aulas-actions">
              <button
                type="button"
                class="aulas-icon-button"
                data-action="ver"
                data-aula-id="${aula.id}"
                title="Ver aula"
              >
                <i
                  data-lucide="eye"
                  aria-hidden="true"
                ></i>
              </button>

              ${
                puedeGestionar
                  ? `
                    <button
                      type="button"
                      class="aulas-icon-button"
                      data-action="editar"
                      data-aula-id="${aula.id}"
                      title="Editar aula"
                    >
                      <i
                        data-lucide="pencil"
                        aria-hidden="true"
                      ></i>
                    </button>

                    <button
                      type="button"
                      class="aulas-icon-button ${
                        aula.activo ? 'is-danger' : 'is-success'
                      }"
                      data-action="estado"
                      data-aula-id="${aula.id}"
                      title="${aula.activo ? 'Inactivar aula' : 'Activar aula'}"
                    >
                      <i
                        data-lucide="${
                          aula.activo ? 'circle-pause' : 'circle-check'
                        }"
                        aria-hidden="true"
                      ></i>
                    </button>
                  `
                  : ''
              }
            </div>
          </td>
        </tr>
      `,
    )
    .join('');

  contenido.innerHTML = `
    ${DataTable({
      columns: [
        'Número',
        'Aula',
        'Tipo',
        'Mobiliario',
        'Capacidad',
        'Origen',
        'Estado',
        'Acciones',
      ],
      rows: filas,
      emptyMessage: 'No se encontraron aulas.',
      ariaLabel: 'Listado de aulas',
    })}

    ${renderizarPaginacionAulas(filtradas.length, contexto)}
  `;

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export function renderizarAulas(contexto) {
  const { estado } = contexto;
  const contenido = document.getElementById('aulasContent');

  if (!contenido) {
    return;
  }

  const filtradas = obtenerAulasFiltradas(estado.aulas)
    .slice()
    .sort(compararAulasPorNumero);

  if (estado.vistaAulasActual === 'PLANO') {
    renderizarPlanoAulasComponente({
      contenido,
      filtradas,
      pisoEdificio2Actual: estado.pisoEdificio2Actual,
      selectorPisoEdificio2Abierto: estado.selectorPisoEdificio2Abierto,
      aulaPlanoSeleccionadaId: estado.aulaPlanoSeleccionadaId,
      obtenerAulaParaSlot: (slot) => obtenerAulaParaSlot(slot, estado.aulas),
    });
    return;
  }

  renderizarListaAulas(
    contenido,
    [...filtradas].sort(compararAulasPorEstadoYNumero),
    contexto,
  );
}

export async function cambiarEstadoAulaActual(
  aula,
  { onActualizado = null } = {},
) {
  if (!validarGestionAulas()) {
    return;
  }

  const nuevoEstado = !aula.activo;

  const confirmado = await confirmarAccion({
    titulo: nuevoEstado ? 'Activar aula' : 'Inactivar aula',
    mensaje: nuevoEstado
      ? `¿Desea activar "${nombreVisibleAula(aula)}"?`
      : `¿Desea inactivar "${nombreVisibleAula(aula)}"?`,
    textoConfirmar: nuevoEstado ? 'Activar' : 'Inactivar',
    peligro: !nuevoEstado,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoAula(aula.id, nuevoEstado);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible cambiar el estado del aula.',
      );
    }

    mostrarExito({
      titulo: nuevoEstado ? 'Aula activada' : 'Aula inactivada',
      mensaje: `El aula fue ${
        nuevoEstado ? 'activada' : 'inactivada'
      } correctamente.`,
    });

    if (typeof onActualizado === 'function') {
      await onActualizado();
    }
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo cambiar el estado',
      mensaje: error?.message || 'No fue posible actualizar el aula.',
    });
  }
}

export async function manejarAccionTabla(event, contexto, acciones = {}) {
  const { estado } = contexto;

  const botonPagina = event.target.closest('[data-aulas-page]');

  if (botonPagina) {
    const pagina = Number(botonPagina.dataset.aulasPage);

    if (Number.isInteger(pagina) && pagina >= 1) {
      estado.paginaAulasActual = pagina;
      renderizarAulas(contexto);
    }

    return;
  }

  const selectorPisoToggle = event.target.closest(
    '[data-edificio2-floor-toggle]',
  );

  if (selectorPisoToggle) {
    estado.selectorPisoEdificio2Abierto = !estado.selectorPisoEdificio2Abierto;
    renderizarAulas(contexto);
    return;
  }

  const opcionPiso = event.target.closest('[data-edificio2-floor]');

  if (opcionPiso) {
    const piso = Number(opcionPiso.dataset.edificio2Floor);

    if (piso === 2 || piso === 3) {
      estado.pisoEdificio2Actual = piso;
      estado.selectorPisoEdificio2Abierto = false;
      renderizarAulas(contexto);
    }

    return;
  }

  const selectorPlanoPendiente = event.target.closest('[data-plano-slot-key]');

  if (selectorPlanoPendiente) {
    const slot = obtenerSlotRegistrablePorKey(
      selectorPlanoPendiente.dataset.planoSlotKey,
    );

    if (slot) {
      if (slot.administrativo) {
        await acciones.onSolicitarHabilitacionSlot?.(slot);
      } else {
        acciones.onAbrirFormularioAula?.(null, construirSugerenciaDesdeSlot(slot));
      }
    }

    return;
  }

  const selectorPlano = event.target.closest('[data-plano-aula-id]');

  if (selectorPlano) {
    const aulaId = Number(selectorPlano.dataset.planoAulaId);

    if (aulaId) {
      const aula = estado.aulas.find((item) => item.id === aulaId);

      if (aula) {
        estado.aulaPlanoSeleccionadaId = aulaId;
        acciones.onAbrirAccionesPlano?.(aula);
      }
    }

    return;
  }

  const boton = event.target.closest('[data-action]');

  if (!boton) {
    return;
  }

  const aulaId = Number(boton.dataset.aulaId);

  if (!aulaId) {
    return;
  }

  const aula = estado.aulas.find((item) => item.id === aulaId);

  if (!aula) {
    return;
  }

  const action = boton.dataset.action;

  if (action === 'ver') {
    await acciones.onVerDetalle?.(aulaId);
    return;
  }

  if (!puedeGestionarAulas()) {
    return;
  }

  if (action === 'editar') {
    acciones.onAbrirFormularioAula?.(aula);
    return;
  }

  if (action === 'estado') {
    await cambiarEstadoAulaActual(aula, {
      onActualizado: acciones.onRefrescarPagina,
    });
  }
}

export function renderizarVistaListado(contexto, acciones = {}) {
  const { estado } = contexto;
  const vista = document.getElementById('aulasVista');

  if (!vista) {
    return;
  }

  vista.innerHTML = `
    <div class="aulas-toolbar">
      <div>
        <h2>Aulas</h2>
        <p>
          Gestión y consulta de espacios
          académicos disponibles.
        </p>
      </div>

      <div class="aulas-toolbar-actions">
        ${
          puedeBuscarAulasDisponibles()
            ? `
              <button
                id="buscarAulasDisponiblesButton"
                class="aulas-secondary-button"
                type="button"
              >
                <i
                  data-lucide="search"
                  aria-hidden="true"
                ></i>
                Buscar aulas disponibles
              </button>
            `
            : ''
        }

        ${
          puedeGestionarAulas()
            ? `
                <button
                  id="catalogoEquipamientosButton"
                  class="aulas-secondary-button"
                  type="button"
                >
                  <i
                    data-lucide="monitor-cog"
                    aria-hidden="true"
                  ></i>
                  Catálogo de equipamiento
                </button>

                <button
                  id="nuevaAulaButton"
                  class="aulas-primary-button"
                  type="button"
                >
                  <i
                    data-lucide="plus"
                    aria-hidden="true"
                  ></i>
                  Nueva aula
                </button>
            `
            : ''
        }
      </div>
    </div>

    <div class="aulas-filters">
      <label
        class="aulas-search"
        for="aulasBuscar"
      >
        <i
          data-lucide="search"
          aria-hidden="true"
        ></i>

        <input
          id="aulasBuscar"
          type="search"
          placeholder="Buscar por número, nombre o ubicación..."
          autocomplete="off"
        >
      </label>

      <select
        id="aulasTipo"
        class="aulas-select"
        aria-label="Filtrar por tipo"
      >
        <option value="">
          Todos los tipos
        </option>

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

      <select
        id="aulasEstado"
        class="aulas-select"
        aria-label="Filtrar por estado"
      >
        <option value="TODAS">Todas</option>
        <option value="ACTIVAS">Activas</option>
        <option value="INACTIVAS">Inactivas</option>
      </select>
    </div>

    <div class="aulas-view-bar">
      <div
        class="aulas-view-switch"
        role="group"
        aria-label="Cambiar vista de aulas"
      >
        <button
          type="button"
          class="aulas-view-button ${
            estado.vistaAulasActual === 'LISTA' ? 'is-active' : ''
          }"
          data-aulas-view="LISTA"
        >
          <i
            data-lucide="list"
            aria-hidden="true"
          ></i>
          Lista
        </button>

        <button
          type="button"
          class="aulas-view-button ${
            estado.vistaAulasActual === 'PLANO' ? 'is-active' : ''
          }"
          data-aulas-view="PLANO"
        >
          <i
            data-lucide="layout-dashboard"
            aria-hidden="true"
          ></i>
          Plano
        </button>
      </div>
    </div>

    <div
      id="aulasContent"
      aria-live="polite"
    >
      <div class="aulas-message">
        Cargando aulas...
      </div>
    </div>
  `;

  document.getElementById('aulasBuscar')?.addEventListener('input', () => {
    estado.paginaAulasActual = 1;
    renderizarAulas(contexto);
  });

  document.getElementById('aulasBuscar')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    const valor = event.currentTarget?.value?.trim();
    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero < 1) {
      return;
    }

    const aula = estado.aulas.find(
      (item) => obtenerNumeroAula(item) === numero,
    );

    if (!aula) {
      return;
    }

    event.preventDefault();

    estado.aulaPlanoSeleccionadaId = aula.id;
    estado.vistaAulasActual = 'PLANO';

    document.querySelectorAll('[data-aulas-view]').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.aulasView === 'PLANO');
    });

    renderizarAulas(contexto);
    acciones.onAbrirAccionesPlano?.(aula);
  });

  document.getElementById('aulasTipo')?.addEventListener('change', () => {
    estado.paginaAulasActual = 1;
    renderizarAulas(contexto);
  });

  document.getElementById('aulasEstado')?.addEventListener('change', () => {
    estado.paginaAulasActual = 1;
    renderizarAulas(contexto);
  });

  document.querySelectorAll('[data-aulas-view]').forEach((boton) => {
    boton.addEventListener('click', () => {
      estado.vistaAulasActual =
        boton.dataset.aulasView === 'PLANO' ? 'PLANO' : 'LISTA';

      if (estado.vistaAulasActual === 'LISTA') {
        estado.paginaAulasActual = 1;
      }

      document.querySelectorAll('[data-aulas-view]').forEach((item) => {
        item.classList.toggle(
          'is-active',
          item.dataset.aulasView === estado.vistaAulasActual,
        );
      });

      renderizarAulas(contexto);
    });
  });

  document
    .getElementById('buscarAulasDisponiblesButton')
    ?.addEventListener('click', () => {
      acciones.onAbrirBusquedaDisponibles?.();
    });

  document.getElementById('nuevaAulaButton')?.addEventListener('click', () => {
    acciones.onAbrirFormularioAula?.();
  });

  document
    .getElementById('catalogoEquipamientosButton')
    ?.addEventListener('click', () => {
      acciones.onAbrirCatalogoEquipamientos?.();
    });

  document.getElementById('aulasContent')?.addEventListener('click', (event) => {
    manejarAccionTabla(event, contexto, acciones);
  });

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export async function cargarAulas(instancia, contexto) {
  const contenido = document.getElementById('aulasContent');

  if (!contenido) {
    return;
  }

  try {
    const resultado = await listarAulas();

    if (!contexto.esInstanciaVigente(instancia)) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar las aulas.',
      );
    }

    contexto.estado.aulas = Array.isArray(resultado.aulas)
      ? resultado.aulas
      : [];

    renderizarAulas(contexto);
  } catch (error) {
    if (!contexto.esInstanciaVigente(instancia)) {
      return;
    }

    contenido.innerHTML = `
      <div class="aulas-message aulas-error">
        ${escapeHtml(error?.message || 'No fue posible cargar las aulas.')}
      </div>
    `;
  }
}
