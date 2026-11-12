/**
 * SGPA — Renderizador visual del croquis interactivo de sectores y planos de Aulas.
 * FRONTEND-REF-DEEP-002
 */

import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { cambiarEstadoAula } from '../../services/aulas.service.js';
import { validarGestionAulas } from './aulas.context.js';
import {
  PLANO_SECTOR_PRINCIPAL_P2,
  PLANO_SECTOR_HUMANISTICO,
  PLANO_SECTOR_BIBLIOTECA,
  PLANO_EDIFICIO2_PISO3,
  PLANO_EDIFICIO2_PISO2,
  TODAS_LAS_AREAS_REGISTRABLES,
} from './aulas.planos.js';
import {
  nombreTipoAula,
  nombreMobiliario,
  nombreOrigen,
  obtenerNumeroAula,
  obtenerNombreEspecialAula,
  prefijoVisibleEspacio,
  nombreVisibleAula,
  claseTipoPlano,
  etiquetaPrincipalSlot,
  aulaCoincideConSlot,
} from './aulas.helpers.js';

export function renderizarSlotPlanoRegistrable({
  slot,
  idsFiltradas,
  incluirArea = true,
  aula = null,
  aulaPlanoSeleccionadaId = null,
}) {
  const visible = aula ? idsFiltradas.has(aula.id) : true;
  const seleccionada = aula && aula.id === aulaPlanoSeleccionadaId;
  const deshabilitada = aula && aula.activo === false;
  const administrativo = Boolean(slot.administrativo) && !aula;
  const mostrarComoAdministrativo = administrativo || deshabilitada;

  const especial = aula
    ? obtenerNombreEspecialAula(aula)
    : slot.nombreEspecial || '';

  const numeroAdministrativo =
    obtenerNumeroAula(aula) ?? slot.numero ?? null;

  const administrativoVertical =
    mostrarComoAdministrativo &&
    ['left-top', 'left-bottom', 'right-top', 'right-bottom'].includes(slot.area);

  const etiqueta = mostrarComoAdministrativo
    ? administrativoVertical
      ? 'Administrativo'
      : 'Área administrativa'
    : etiquetaPrincipalSlot(slot, aula);

  const subtitulo = mostrarComoAdministrativo
    ? numeroAdministrativo
      ? `Aula ${numeroAdministrativo} potencial`
      : 'Disponible para habilitar'
    : slot.etiquetaPlano
      ? aula
        ? nombreTipoAula(aula.tipo)
        : 'Disponible para registrar'
      : aula
        ? especial || nombreTipoAula(aula.tipo)
        : especial || 'Disponible para registrar';

  const claseTipo = mostrarComoAdministrativo
    ? 'is-administrative'
    : claseTipoPlano(aula?.tipo || slot.tipo);

  return `
    <button
      type="button"
      class="
        aulas-plan-space
        ${claseTipo}
        ${administrativoVertical ? 'is-admin-vertical' : ''}
        ${aula ? 'is-registered' : 'is-pending'}
        ${deshabilitada ? 'is-disabled-academic' : ''}
        ${aula && !visible ? 'is-filtered-out' : ''}
        ${seleccionada ? 'is-selected' : ''}
      "
      ${incluirArea ? `style="grid-area: ${slot.area};"` : ''}
      ${aula
      ? `data-plano-aula-id="${aula.id}"`
      : `data-plano-slot-key="${slot.key}"`
    }
      aria-label="${escapeHtml(
      aula
        ? nombreVisibleAula(aula)
        : mostrarComoAdministrativo
          ? numeroAdministrativo
            ? `Área administrativa correspondiente al Aula ${numeroAdministrativo}`
            : 'Área administrativa disponible para habilitar como aula'
          : `Registrar ${etiqueta}`,
    )}"
    >
      <strong>${escapeHtml(etiqueta)}</strong>
      <span>${escapeHtml(subtitulo)}</span>
    </button>
  `;
}

export function renderizarFichaPlanoAula(aula, puedeGestionar = false) {
  if (!aula) {
    return `
      <div class="aulas-plan-empty-detail">
        <div class="aulas-plan-empty-icon" aria-hidden="true">
          <i data-lucide="door-open"></i>
        </div>
        <strong>Seleccione un aula</strong>
        <p>
          Haga clic sobre un espacio registrado para consultar
          sus datos, o seleccione un bloque disponible para
          iniciar el registro del aula desde el plano.
        </p>
      </div>
    `;
  }

  return `
    <div class="aulas-plan-detail-card">
      <div class="aulas-plan-detail-top">
        <span>Aula seleccionada</span>
        <span class="aulas-status ${aula.activo ? 'is-active' : 'is-inactive'}">
          ${aula.activo ? 'Activa' : 'Inactiva'}
        </span>
      </div>

      <h3>${escapeHtml(nombreVisibleAula(aula))}</h3>
      <p>${escapeHtml(aula.ubicacion || 'Sin ubicación especificada')}</p>

      <div class="aulas-plan-detail-grid">
        <div>
          <span>Número</span>
          <strong>${escapeHtml(obtenerNumeroAula(aula) ?? aula.codigo)}</strong>
        </div>
        <div>
          <span>Tipo</span>
          <strong>${escapeHtml(nombreTipoAula(aula.tipo))}</strong>
        </div>
        <div>
          <span>Capacidad</span>
          <strong>${escapeHtml(aula.capacidad)}</strong>
        </div>
        <div>
          <span>Mobiliario</span>
          <strong>${escapeHtml(nombreMobiliario(aula.tipoMobiliario))}</strong>
        </div>
        <div>
          <span>Origen</span>
          <strong>${escapeHtml(nombreOrigen(aula.origen))}</strong>
        </div>
      </div>

      <div class="aulas-plan-detail-actions">
        <button
          type="button"
          class="aulas-secondary-button"
          data-action="ver"
          data-aula-id="${aula.id}"
        >
          <i data-lucide="eye" aria-hidden="true"></i>
          Ver detalle
        </button>

        ${puedeGestionar
      ? `
              <button
                type="button"
                class="aulas-primary-button"
                data-action="editar"
                data-aula-id="${aula.id}"
              >
                <i data-lucide="pencil" aria-hidden="true"></i>
                Editar aula
              </button>
            `
      : ''
    }
      </div>
    </div>
  `;
}

export function renderizarPlanoAulas({
  contenido,
  filtradas = [],
  pisoEdificio2Actual = 3,
  selectorPisoEdificio2Abierto = false,
  aulaPlanoSeleccionadaId = null,
  obtenerAulaParaSlot = () => null,
}) {
  if (!contenido) return;

  const idsFiltradas = new Set(filtradas.map((aula) => aula.id));

  const otrasAulas = filtradas.filter(
    (aula) =>
      !TODAS_LAS_AREAS_REGISTRABLES.some((slot) =>
        aulaCoincideConSlot(aula, slot),
      ),
  );

  const principalSlots = PLANO_SECTOR_PRINCIPAL_P2.map((slot) =>
    renderizarSlotPlanoRegistrable({
      slot,
      idsFiltradas,
      incluirArea: true,
      aula: obtenerAulaParaSlot(slot),
      aulaPlanoSeleccionadaId,
    }),
  ).join('');

  const humanisticoSlots = PLANO_SECTOR_HUMANISTICO.map((slot) =>
    renderizarSlotPlanoRegistrable({
      slot,
      idsFiltradas,
      incluirArea: false,
      aula: obtenerAulaParaSlot(slot),
      aulaPlanoSeleccionadaId,
    }),
  ).join('');

  const bibliotecaSlots = PLANO_SECTOR_BIBLIOTECA.map((slot) =>
    renderizarSlotPlanoRegistrable({
      slot,
      idsFiltradas,
      incluirArea: true,
      aula: obtenerAulaParaSlot(slot),
      aulaPlanoSeleccionadaId,
    }),
  ).join('');

  const slotsEdificio2 = (
    pisoEdificio2Actual === 2 ? PLANO_EDIFICIO2_PISO2 : PLANO_EDIFICIO2_PISO3
  )
    .map((slot) =>
      renderizarSlotPlanoRegistrable({
        slot,
        idsFiltradas,
        incluirArea: true,
        aula: obtenerAulaParaSlot(slot),
        aulaPlanoSeleccionadaId,
      }),
    )
    .join('');

  const selectorPiso = `
    <div
      class="aulas-floor-selector ${selectorPisoEdificio2Abierto ? 'is-open' : ''}"
      style="grid-area: center;"
    >
      <button
        type="button"
        class="aulas-floor-selector-trigger"
        data-edificio2-floor-toggle="true"
        aria-expanded="${selectorPisoEdificio2Abierto ? 'true' : 'false'}"
      >
        <span>Edificio 2</span>
        <strong>Piso ${pisoEdificio2Actual}</strong>
        <small>Cambiar piso</small>
        <b aria-hidden="true">▾</b>
      </button>

      <div
        class="aulas-floor-selector-menu"
        ${selectorPisoEdificio2Abierto ? '' : 'hidden'}
      >
        <button
          type="button"
          class="${pisoEdificio2Actual === 3 ? 'is-active' : ''}"
          data-edificio2-floor="3"
        >
          <strong>Piso 3</strong>
          <span>Aulas 9 a 15 y espacios administrativos</span>
        </button>

        <button
          type="button"
          class="${pisoEdificio2Actual === 2 ? 'is-active' : ''}"
          data-edificio2-floor="2"
        >
          <strong>Piso 2</strong>
          <span>S.T.E.M. y Laboratorio de Idiomas</span>
        </button>
      </div>
    </div>
  `;

  const esquinasDecorativasEdificio = `
    <div class="aulas-campus-corner aulas-campus-corner-top-left" aria-hidden="true"></div>
    <div class="aulas-campus-corner aulas-campus-corner-top-right" aria-hidden="true"></div>
    <div class="aulas-campus-corner aulas-campus-corner-bottom-left" aria-hidden="true"></div>
    <div class="aulas-campus-corner aulas-campus-corner-bottom-right" aria-hidden="true"></div>
  `;

  const mapaEdificio2 =
    pisoEdificio2Actual === 2
      ? `
          <div class="aulas-sector-map aulas-sector-map-edificio2-piso2">
            ${esquinasDecorativasEdificio}
            ${slotsEdificio2}
            ${selectorPiso}
          </div>
        `
      : `
          <div class="aulas-sector-map aulas-sector-map-edificio2-piso3">
            ${esquinasDecorativasEdificio}
            ${slotsEdificio2}
            ${selectorPiso}
          </div>
        `;

  contenido.innerHTML = `
    <section class="aulas-plan-shell">
      <div class="aulas-plan-main">
        <header class="aulas-plan-header">
          <div>
            <span class="aulas-plan-eyebrow">
              Campus Nicoya · croquis referencial
            </span>
            <h3>Selector visual de aulas</h3>
            <p>
              Consulte el plano institucional del campus, registre espacios
              directamente desde los bloques disponibles y acceda a las aulas
              ya registradas desde el mismo croquis.
            </p>
          </div>

          <div class="aulas-plan-legend" aria-label="Leyenda del plano">
            <span>
              <i class="is-available"></i>
              Registrada
            </span>
            <span>
              <i class="is-empty"></i>
              Disponible para registrar
            </span>
            <span>
              <i class="is-support"></i>
              Espacio de referencia
            </span>
          </div>
        </header>

        <div class="aulas-campus-layout">
          <section class="aulas-sector-card aulas-sector-card-edificio2">
            <div class="aulas-sector-heading">
              <strong>Edificio 2</strong>
              <span>
                Cambie de piso desde el selector central para consultar los espacios disponibles.
              </span>
            </div>
            ${mapaEdificio2}
          </section>

          <section class="aulas-sector-card aulas-sector-card-biblioteca">
            <div class="aulas-sector-heading">
              <strong>Biblioteca y salas</strong>
              <span>
                Sector de apoyo académico con biblioteca y salas utilizadas para reuniones,
                centros y actividades universitarias.
              </span>
            </div>
            <div class="aulas-biblioteca-grid">
              ${bibliotecaSlots}
              <div class="aulas-plan-support-block is-biblioteca is-library-main" style="grid-area: bib-main;">Biblioteca</div>
            </div>
          </section>

          <section class="aulas-sector-card aulas-sector-card-humanistico">
            <div class="aulas-sector-heading">
              <strong>Sector Colegio Humanístico</strong>
              <span>
                Aulas 16 y 17 disponibles para actividades universitarias.
              </span>
            </div>
            <div class="aulas-humanistico-stack">
              ${humanisticoSlots}
            </div>
          </section>

          <section class="aulas-sector-card aulas-sector-card-principal">
            <div class="aulas-sector-heading">
              <strong>Edificio principal · Piso 2</strong>
              <span>
                Distribución de aulas 1 a 8. Haga clic sobre un bloque disponible
                para registrarlo directamente desde el croquis.
              </span>
            </div>
            <div class="aulas-sector-map aulas-sector-map-principal">
              ${esquinasDecorativasEdificio}
              ${principalSlots}
              <div class="aulas-campus-core is-principal" style="grid-area: center;">
                <strong>Piso 2</strong>
                <span>Edificio académico principal</span>
              </div>
            </div>
          </section>
        </div>

        ${otrasAulas.length
      ? `
              <div class="aulas-plan-other">
                <div>
                  <strong>Otros espacios registrados</strong>
                  <span>
                    Registros que todavía no tienen una posición definida dentro del croquis principal.
                  </span>
                </div>
                <div class="aulas-plan-other-list">
                  ${otrasAulas
        .map(
          (aula) => `
                        <button
                          type="button"
                          class="aulas-plan-other-item"
                          data-plano-aula-id="${aula.id}"
                        >
                          <strong>${escapeHtml(nombreVisibleAula(aula))}</strong>
                          <span>
                            ${escapeHtml(
            aula.ubicacion || nombreOrigen(aula.origen),
          )}
                          </span>
                        </button>
                      `,
        )
        .join('')}
                </div>
              </div>
            `
      : ''
    }
      </div>
    </section>
  `;

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export function obtenerSlotRegistrablePorKey(key) {
  return (
    TODAS_LAS_AREAS_REGISTRABLES.find((item) => item.key === key) || null
  );
}

export function obtenerAulaParaSlot(slot, aulas = []) {
  return (
    aulas.find((aula) => aulaCoincideConSlot(aula, slot)) || null
  );
}

export function construirSugerenciaDesdeSlot(slot) {
  if (!slot) {
    return null;
  }

  return {
    numero: slot.numero || '',
    codigo: slot.codigo || '',
    nombreEspecial: slot.nombreEspecial || '',
    ubicacion: slot.ubicacion || '',
    tipo: slot.tipo || 'AULA',
    tipoMobiliario: slot.tipoMobiliario || 'SIN_ESPECIFICAR',
    origen: slot.origen || 'UNA',
    capacidad: slot.capacidad || '',
    referenciaPlano: slot.referenciaPlano || '',
  };
}

export function abrirAccionesAulaPlano({
  aula,
  puedeGestionar = false,
  onVerDetalle = null,
  onEditarAula = null,
  onCambiarDisponibilidad = null,
} = {}) {
  if (!aula) {
    return;
  }

  document.getElementById('aulasPlanoActionDialog')?.remove();

  const dialog = document.createElement('dialog');
  dialog.id = 'aulasPlanoActionDialog';
  dialog.className = 'sgpa-confirm-dialog aulas-plan-action-dialog';

  const puedeEditar = Boolean(puedeGestionar);
  const permiteCambioDisponibilidad = puedeEditar && aula.tipo === 'AULA';
  const aulaHabilitada = aula.activo === true;

  dialog.innerHTML = `
    <div
      class="sgpa-confirm-card aulas-plan-action-card"
    >
      <div
        class="aulas-plan-action-icon"
        aria-hidden="true"
      >
        ?
      </div>

      <div
        class="aulas-plan-action-content"
      >
        <span>
          ${aulaHabilitada ? 'Aula seleccionada' : 'Espacio administrativo'}
        </span>

        <h3>
          ¿Qué desea hacer?
        </h3>

        <p>
          ${escapeHtml(nombreVisibleAula(aula))}
          ·
          ${escapeHtml(aula.ubicacion || 'Sin ubicación especificada')}
        </p>

        ${
          !aulaHabilitada
            ? `
                <div class="aulas-plan-action-notice">
                  Este espacio está deshabilitado para asignaciones académicas
                  y se representa como área administrativa en el plano.
                </div>
              `
            : ''
        }
      </div>

      <div
        class="aulas-plan-action-buttons"
      >
        <button
          type="button"
          id="aulasPlanoVerAula"
          class="aulas-plan-action-view"
        >
          <i
            data-lucide="eye"
            aria-hidden="true"
          ></i>
          Ver aula
        </button>

        ${
          puedeEditar
            ? `
                <button
                  type="button"
                  id="aulasPlanoEditarAula"
                  class="aulas-plan-action-edit"
                >
                  <i
                    data-lucide="pencil"
                    aria-hidden="true"
                  ></i>
                  Editar aula
                </button>
              `
            : ''
        }

        ${
          permiteCambioDisponibilidad
            ? `
                <button
                  type="button"
                  id="aulasPlanoCambiarDisponibilidad"
                  class="aulas-plan-action-availability ${
                    aulaHabilitada ? 'is-disable' : 'is-enable'
                  }"
                >
                  <i
                    data-lucide="${
                      aulaHabilitada ? 'circle-pause' : 'circle-check'
                    }"
                    aria-hidden="true"
                  ></i>
                  ${aulaHabilitada ? 'Deshabilitar aula' : 'Habilitar aula'}
                </button>
              `
            : ''
        }

        <button
          type="button"
          id="aulasPlanoCerrarAcciones"
          class="aulas-plan-action-cancel"
        >
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const cerrar = () => {
    if (dialog.open) {
      dialog.close();
    }

    dialog.remove();
  };

  dialog
    .querySelector('#aulasPlanoCerrarAcciones')
    ?.addEventListener('click', cerrar);

  dialog
    .querySelector('#aulasPlanoVerAula')
    ?.addEventListener('click', async () => {
      cerrar();
      if (typeof onVerDetalle === 'function') {
        await onVerDetalle(aula.id);
      }
    });

  dialog
    .querySelector('#aulasPlanoEditarAula')
    ?.addEventListener('click', () => {
      cerrar();
      if (typeof onEditarAula === 'function') {
        onEditarAula(aula);
      }
    });

  dialog
    .querySelector('#aulasPlanoCambiarDisponibilidad')
    ?.addEventListener('click', async () => {
      cerrar();
      if (typeof onCambiarDisponibilidad === 'function') {
        await onCambiarDisponibilidad(aula);
      }
    });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cerrar();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      cerrar();
    }
  });

  dialog.showModal();

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export async function solicitarHabilitacionSlotAdministrativo({
  slot,
  onAbrirFormulario = null,
} = {}) {
  if (!slot) {
    return;
  }

  const tieneNumero =
    Number.isInteger(Number(slot.numero)) && Number(slot.numero) > 0;

  const confirmado = await confirmarAccion({
    titulo: tieneNumero
      ? `Habilitar Aula ${slot.numero}`
      : 'Habilitar espacio administrativo',
    mensaje: tieneNumero
      ? `El espacio correspondiente al Aula ${slot.numero} está siendo utilizado actualmente como área administrativa. ¿Desea iniciar su habilitación como aula académica? Al continuar se abrirá el formulario para completar sus datos antes de registrarla.`
      : 'Este espacio del Edificio 2 está siendo utilizado actualmente como área administrativa. ¿Desea habilitarlo como aula académica? Al continuar podrá asignarle el número de aula y completar sus datos antes de registrarlo.',
    textoConfirmar: 'Habilitar aula',
    peligro: false,
  });

  if (!confirmado) {
    return;
  }

  if (typeof onAbrirFormulario === 'function') {
    onAbrirFormulario(null, construirSugerenciaDesdeSlot(slot));
  }
}

export async function cambiarDisponibilidadAcademicaAulaPlano({
  aula,
  onActualizado = null,
} = {}) {
  if (!aula || !validarGestionAulas()) {
    return;
  }

  const habilitar = aula.activo === false;

  const confirmado = await confirmarAccion({
    titulo: habilitar ? 'Habilitar aula' : 'Deshabilitar aula',
    mensaje: habilitar
      ? `¿Desea habilitar nuevamente "${nombreVisibleAula(aula)}" como espacio académico? El aula volverá a estar disponible para asignaciones.`
      : `¿Desea deshabilitar "${nombreVisibleAula(aula)}" como espacio académico? En el plano se mostrará como área administrativa y dejará de estar disponible para asignaciones mientras permanezca deshabilitada.`,
    textoConfirmar: habilitar ? 'Habilitar' : 'Deshabilitar',
    peligro: !habilitar,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoAula(aula.id, habilitar);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible actualizar la disponibilidad académica del aula.',
      );
    }

    mostrarExito({
      titulo: habilitar ? 'Aula habilitada' : 'Aula deshabilitada',
      mensaje: habilitar
        ? 'El aula volvió a quedar disponible como espacio académico.'
        : 'El aula quedó deshabilitada y se mostrará como espacio administrativo en el plano.',
    });

    if (typeof onActualizado === 'function') {
      await onActualizado();
    }
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo actualizar el aula',
      mensaje:
        error?.message ||
        'No fue posible actualizar la disponibilidad académica del aula.',
    });
  }
}
