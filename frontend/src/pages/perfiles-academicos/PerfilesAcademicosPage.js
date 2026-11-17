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
import {
  obtenerRolActivo,
  obtenerUsuario,
  obtenerVersionSesion,
  usuarioTienePermiso,
} from '../../app/session.js';
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
import { crearContextoPerfilesAcademicos } from './perfiles-academicos.context.js';

export {
  TIPOS_REQUISITO,
  CONDICIONES,
  filtrarPerfilesAcademicos,
  formatearEtiquetaTipo,
  formatearFechaPerfil,
};

const contexto = crearContextoPerfilesAcademicos();

function puedeGestionar() {
  return usuarioTienePermiso(PERMISOS.PERFILES_ACADEMICOS_GESTIONAR);
}

function crearControlOperacion(instancia, perfilId = null) {
  const versionSesion = obtenerVersionSesion();
  const usuario = obtenerUsuario();
  const usuarioId = usuario?.id ?? null;
  const rolActivo = obtenerRolActivo(usuario);
  const detalleToken = contexto.estado.detalleToken;

  return {
    esVigente() {
      const usuarioActual = obtenerUsuario();
      return Boolean(
        contexto.esInstanciaVigente(instancia) &&
          contexto.estado.detalleToken === detalleToken &&
          (perfilId == null || Number(contexto.estado.perfilActual?.id) === Number(perfilId)) &&
          obtenerVersionSesion() === versionSesion &&
          (usuarioActual?.id ?? null) === usuarioId &&
          obtenerRolActivo(usuarioActual) === rolActivo &&
          puedeGestionar(),
      );
    },
    reservar(clave) {
      return contexto.reservarOperacion(clave, instancia);
    },
    marcarEnviada(clave, token) {
      return contexto.marcarOperacionEnviada(clave, token);
    },
    liberar(clave, token) {
      return contexto.liberarOperacion(clave, token);
    },
  };
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
    perfiles: contexto.estado.perfiles,
    texto,
    estado,
  });
  renderizarIconos();
}

async function recargarPerfiles(instancia) {
  const resultado = await listarPerfilesAcademicos();
  if (!contexto.esInstanciaVigente(instancia ?? contexto.estado.instanciaActual)) {
    return;
  }
  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || 'No fue posible actualizar el listado de perfiles.',
    );
  }
  contexto.estado.perfiles = Array.isArray(resultado.data) ? resultado.data : [];
  renderizarListado();
}

function renderizarDetalle() {
  const contenedor = document.getElementById('perfilDetalle');
  if (!contenedor || !contexto.estado.perfilActual) return;

  contenedor.innerHTML = renderizarDetallePerfilHtml({
    perfil: contexto.estado.perfilActual,
    areas: contexto.estado.areasActuales,
    requisitos: contexto.estado.requisitosActuales,
    puedeGestionar: puedeGestionar(),
  });
  renderizarIconos();
}

async function cargarDetalle(id) {
  const marca = contexto.iniciarDetalle(id);
  const listado = document.getElementById('perfilesListado');
  const detalle = document.getElementById('perfilDetalle');
  listado?.classList.add('hidden');
  detalle?.classList.remove('hidden');
  if (detalle) {
    detalle.innerHTML =
      '<div class="sgpa-state-message">Cargando perfil docente...</div>';
  }

  try {
    const [perfil, areas, requisitos] = await Promise.all([
      obtenerPerfil(id),
      listarAreasPerfil(id),
      listarRequisitosPerfil(id),
    ]);

    if (!contexto.esDetalleVigente(marca)) {
      return;
    }

    const error = [perfil, areas, requisitos].find((resultado) => !resultado?.ok);
    if (error) {
      if (detalle) {
        detalle.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error">${escapeHtml(error.message || 'No fue posible cargar el perfil.')}</div>`;
      }
      return;
    }

    contexto.estado.perfilActual = perfil.data;
    contexto.estado.areasActuales = Array.isArray(areas.data) ? areas.data : [];
    contexto.estado.requisitosActuales = Array.isArray(requisitos.data) ? requisitos.data : [];
    renderizarDetalle();
  } catch (err) {
    if (contexto.esDetalleVigente(marca) && detalle) {
      detalle.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error">${escapeHtml(err?.message || 'No fue posible cargar el perfil.')}</div>`;
    }
  }
}

async function recargarListadoYDetalle() {
  const instancia = contexto.estado.instanciaActual;
  await recargarPerfiles(instancia);
  if (!contexto.esInstanciaVigente(instancia)) return;
  if (contexto.estado.perfilActual?.id) {
    await cargarDetalle(contexto.estado.perfilActual.id);
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
    contexto.estado.perfilActual = null;
    return;
  }
  if (event.target.closest('[data-editar-perfil]')) {
    abrirEditorPerfilDialog({
      perfil: contexto.estado.perfilActual,
      controlOperacion: crearControlOperacion(
        contexto.estado.instanciaActual,
        contexto.estado.perfilActual?.id,
      ),
      onUpdated: recargarListadoYDetalle,
    });
    return;
  }
  if (event.target.closest('[data-cambiar-estado-perfil]')) {
    await cambiarEstadoPerfilActual({
      perfil: contexto.estado.perfilActual,
      controlOperacion: crearControlOperacion(
        contexto.estado.instanciaActual,
        contexto.estado.perfilActual?.id,
      ),
      onUpdated: recargarListadoYDetalle,
    });
    return;
  }
  if (event.target.closest('[data-gestionar-cursos]')) {
    await abrirGestorCursosPerfil({
      perfil: contexto.estado.perfilActual,
      controlOperacion: crearControlOperacion(
        contexto.estado.instanciaActual,
        contexto.estado.perfilActual?.id,
      ),
      onReloadDetail: cargarDetalle,
    });
    return;
  }
  if (event.target.closest('[data-editar-areas]')) {
    abrirEditorAreasDialog({
      perfil: contexto.estado.perfilActual,
      areasActuales: contexto.estado.areasActuales,
      controlOperacion: crearControlOperacion(
        contexto.estado.instanciaActual,
        contexto.estado.perfilActual?.id,
      ),
      onUpdated: recargarListadoYDetalle,
    });
  }
  if (event.target.closest('[data-editar-requisitos]')) {
    abrirEditorRequisitosDialog({
      perfil: contexto.estado.perfilActual,
      requisitosActuales: contexto.estado.requisitosActuales,
      controlOperacion: crearControlOperacion(
        contexto.estado.instanciaActual,
        contexto.estado.perfilActual?.id,
      ),
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
  const { instancia, signal } = contexto.iniciarInstancia();

  document
    .getElementById('nuevoPerfilButton')
    ?.addEventListener(
      'click',
      () => {
        const controlOperacion = crearControlOperacion(instancia);
        if (!controlOperacion.esVigente()) return;
        abrirNuevoPerfilDialog({
          carreras: contexto.estado.carreras,
          controlOperacion,
          onCreated: async (id) => {
            if (!controlOperacion.esVigente()) return;
            await recargarPerfiles(instancia);
            if (id && contexto.esInstanciaVigente(instancia)) {
              await cargarDetalle(id);
            }
          },
        });
      },
      { signal },
    );

  document
    .getElementById('perfilesBuscar')
    ?.addEventListener('input', renderizarListado, { signal });
  document
    .getElementById('perfilesEstado')
    ?.addEventListener('change', renderizarListado, { signal });
  document
    .getElementById('perfilesContent')
    ?.addEventListener('click', manejarListado, { signal });
  document
    .getElementById('perfilDetalle')
    ?.addEventListener('click', manejarDetalle, { signal });

  const dialog = document.getElementById('perfilAcademicoDialog');
  habilitarCierreExterior(dialog);

  try {
    const [resultadoPerfiles, resultadoCarreras] = await Promise.all([
      listarPerfilesAcademicos(),
      listarCarreras(),
    ]);

    if (!contexto.esInstanciaVigente(instancia)) {
      return;
    }

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

    contexto.estado.perfiles = Array.isArray(resultadoPerfiles.data)
      ? resultadoPerfiles.data
      : [];
    contexto.estado.carreras = Array.isArray(resultadoCarreras.carreras)
      ? resultadoCarreras.carreras
      : [];

    renderizarListado();
  } catch (error) {
    if (contexto.esInstanciaVigente(instancia)) {
      mostrarFallo(error?.message || 'Error de conexión al cargar perfiles.');
    }
  }
}

export function destruirPerfilesAcademicosPage() {
  contexto.destruir();
}
