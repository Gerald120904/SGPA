/**
 * SGPA — Coordinador principal del módulo Perfiles Académicos.
 * FRONTEND-ORDER-003
 */

import {
  listarAreasPerfil,
  listarPerfilesAcademicos,
  listarRequisitosPerfil,
  obtenerPerfil,
} from '../../services/perfiles-academicos.service.js';
import { listarCarreras } from '../../services/carreras.service.js';
import { usuarioTienePermiso } from '../../app/session.js';
import { PERMISOS } from '../../config/permissions.js';
import { habilitarCierreExterior } from '../../components/FormDialog.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  TIPOS_REQUISITO_PERFIL as TIPOS_REQUISITO,
  CONDICIONES_PERFIL as CONDICIONES,
  filtrarPerfilesAcademicos,
  formatearEtiquetaTipo,
  formatearFechaPerfil,
} from './perfiles-academicos.helpers.js';
import { renderizarTablaPerfiles } from './PerfilesCatalogo.js';
import { renderizarDetallePerfilHtml } from './PerfilDetalleView.js';
import {
  abrirEditorAreasDialog,
  abrirEditorPerfilDialog,
  abrirEditorRequisitosDialog,
  abrirGestorCursosPerfil,
  abrirNuevoPerfilDialog,
  cambiarEstadoPerfilActual,
} from './PerfilDialogs.js';

export {
  TIPOS_REQUISITO,
  CONDICIONES,
  filtrarPerfilesAcademicos,
  formatearEtiquetaTipo,
  formatearFechaPerfil,
};

let perfiles = [];
let carreras = [];
let perfilActual = null;
let areasActuales = [];
let requisitosActuales = [];

function puedeGestionar() {
  return usuarioTienePermiso(PERMISOS.PERFILES_ACADEMICOS_GESTIONAR);
}

export function PerfilesAcademicosPage() {
  return `
    <section id="perfilesAcademicosPage" class="module-view perfiles-academicos-page">
      <div class="sgpa-toolbar">
        <div>
          <h2>Perfiles docentes</h2>
          <p>
            Definición institucional de perfiles docentes,
            requisitos y cursos habilitados.
          </p>
        </div>

        ${
          puedeGestionar()
            ? `
              <button
                id="nuevoPerfilButton"
                class="sgpa-button sgpa-button-primary"
                type="button"
              >
                <i data-lucide="plus" aria-hidden="true"></i>
                Nuevo perfil
              </button>
            `
            : ''
        }
      </div>

      <div id="perfilesListado">
        <div class="sgpa-filters">
          <label class="sgpa-search" for="perfilesBuscar">
            <i data-lucide="search" aria-hidden="true"></i>
            <input id="perfilesBuscar" type="search" placeholder="Buscar por código, nombre o carrera...">
          </label>
          <select id="perfilesEstado" class="sgpa-select" aria-label="Filtrar por estado">
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
          </select>
        </div>
        <div id="perfilesContent" aria-live="polite">
          <div class="sgpa-state-message">Cargando perfiles académicos...</div>
        </div>
      </div>

      <div id="perfilDetalle" class="hidden" aria-live="polite"></div>

      <dialog id="perfilAcademicoDialog" class="sgpa-form-dialog sgpa-form-dialog-lg">
        <div id="perfilAcademicoDialogContent"></div>
      </dialog>
    </section>
  `;
}

function renderizarListado() {
  const contenedor = document.getElementById('perfilesContent');
  if (!contenedor) return;

  const texto =
    document.getElementById('perfilesBuscar')?.value?.trim().toLowerCase() || '';
  const estado = document.getElementById('perfilesEstado')?.value || 'TODOS';

  contenedor.innerHTML = renderizarTablaPerfiles({
    perfiles,
    texto,
    estado,
  });
  renderizarIconos();
}

async function recargarPerfiles() {
  const resultado = await listarPerfilesAcademicos();
  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || 'No fue posible actualizar el listado de perfiles.',
    );
  }
  perfiles = Array.isArray(resultado.data) ? resultado.data : [];
  renderizarListado();
}

function renderizarDetalle() {
  const contenedor = document.getElementById('perfilDetalle');
  if (!contenedor || !perfilActual) return;

  contenedor.innerHTML = renderizarDetallePerfilHtml({
    perfil: perfilActual,
    areas: areasActuales,
    requisitos: requisitosActuales,
    puedeGestionar: puedeGestionar(),
  });
  renderizarIconos();
}

async function cargarDetalle(id) {
  const listado = document.getElementById('perfilesListado');
  const detalle = document.getElementById('perfilDetalle');
  listado?.classList.add('hidden');
  detalle?.classList.remove('hidden');
  if (detalle) {
    detalle.innerHTML =
      '<div class="sgpa-state-message">Cargando perfil docente...</div>';
  }

  const [perfil, areas, requisitos] = await Promise.all([
    obtenerPerfil(id),
    listarAreasPerfil(id),
    listarRequisitosPerfil(id),
  ]);

  const error = [perfil, areas, requisitos].find((resultado) => !resultado?.ok);
  if (error) {
    if (detalle) {
      detalle.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error">${escapeHtml(error.message || 'No fue posible cargar el perfil.')}</div>`;
    }
    return;
  }

  perfilActual = perfil.data;
  areasActuales = Array.isArray(areas.data) ? areas.data : [];
  requisitosActuales = Array.isArray(requisitos.data) ? requisitos.data : [];
  renderizarDetalle();
}

async function recargarListadoYDetalle() {
  await recargarPerfiles();
  if (perfilActual?.id) {
    await cargarDetalle(perfilActual.id);
  }
}

async function manejarListado(event) {
  const boton = event.target.closest('[data-ver-perfil]');
  if (boton) await cargarDetalle(Number(boton.dataset.verPerfil));
}

async function manejarDetalle(event) {
  if (event.target.closest('[data-volver-perfiles]')) {
    document.getElementById('perfilDetalle')?.classList.add('hidden');
    document.getElementById('perfilesListado')?.classList.remove('hidden');
    perfilActual = null;
    return;
  }
  if (event.target.closest('[data-editar-perfil]')) {
    abrirEditorPerfilDialog({
      perfil: perfilActual,
      onUpdated: recargarListadoYDetalle,
    });
    return;
  }
  if (event.target.closest('[data-cambiar-estado-perfil]')) {
    await cambiarEstadoPerfilActual({
      perfil: perfilActual,
      onUpdated: recargarListadoYDetalle,
    });
    return;
  }
  if (event.target.closest('[data-gestionar-cursos]')) {
    await abrirGestorCursosPerfil({
      perfil: perfilActual,
      onReloadDetail: cargarDetalle,
    });
    return;
  }
  if (event.target.closest('[data-editar-areas]')) {
    abrirEditorAreasDialog({
      perfil: perfilActual,
      areasActuales,
      onUpdated: recargarListadoYDetalle,
    });
  }
  if (event.target.closest('[data-editar-requisitos]')) {
    abrirEditorRequisitosDialog({
      perfil: perfilActual,
      requisitosActuales,
      onUpdated: recargarListadoYDetalle,
    });
  }
}

function mostrarFallo(mensaje) {
  const contenedor = document.getElementById('perfilesContent');
  if (contenedor) {
    contenedor.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error">${escapeHtml(mensaje)}</div>`;
  }
}

export async function iniciarPerfilesAcademicosPage() {
  document
    .getElementById('nuevoPerfilButton')
    ?.addEventListener('click', () =>
      abrirNuevoPerfilDialog({
        carreras,
        onCreated: async (id) => {
          await recargarPerfiles();
          if (id) await cargarDetalle(id);
        },
      }),
    );

  document
    .getElementById('perfilesBuscar')
    ?.addEventListener('input', renderizarListado);
  document
    .getElementById('perfilesEstado')
    ?.addEventListener('change', renderizarListado);
  document
    .getElementById('perfilesContent')
    ?.addEventListener('click', manejarListado);
  document
    .getElementById('perfilDetalle')
    ?.addEventListener('click', manejarDetalle);

  const dialog = document.getElementById('perfilAcademicoDialog');
  habilitarCierreExterior(dialog);

  const [resultadoPerfiles, resultadoCarreras] = await Promise.all([
    listarPerfilesAcademicos(),
    listarCarreras(),
  ]);

  if (!resultadoPerfiles?.ok) {
    mostrarFallo(
      resultadoPerfiles?.message || 'No fue posible consultar los perfiles.',
    );
    return;
  }

  if (!resultadoCarreras?.ok) {
    mostrarFallo(
      resultadoCarreras?.message || 'No fue posible consultar las carreras.',
    );
    return;
  }

  perfiles = Array.isArray(resultadoPerfiles.data)
    ? resultadoPerfiles.data
    : [];
  carreras = Array.isArray(resultadoCarreras.carreras)
    ? resultadoCarreras.carreras
    : [];

  renderizarListado();
}
