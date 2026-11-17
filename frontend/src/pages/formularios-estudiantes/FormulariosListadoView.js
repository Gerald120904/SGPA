/**
 * SGPA — Vista de listado, tabla de formularios, estados y despacho de acciones.
 * FRONTEND-REFACTOR-FORMULARIOS-ESTUDIANTES-INTEGRAL-001
 */

import { DataTable } from '../../components/DataTable.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { usuarioTienePermiso } from '../../app/session.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { abrirEnlaceFormularioEstudiantes } from '../../services/formularios-estudiantes.service.js';
import { obtenerPresentacionEstadoFormulario } from './formularios-estudiantes.helpers.js';
import { PERMISOS } from './FormularioGoogleStatusView.js';
import {
  copiarEnlaceFormulario,
  abrirVistaPreviaFormulario,
  sincronizarFormularioAction,
  publicarFormularioAction,
  regenerarTokenFormularioAction,
  cerrarFormularioAction,
} from './FormularioAcciones.js';
import { abrirDialogoRespuestasFormulario } from './FormularioRespuestasDialog.js';

export function renderizarFilaFormulario(formulario) {
  const carrera = formulario.carrera?.nombre || 'Sin carrera';
  const plan = formulario.planEstudio?.nombre || 'Sin plan';
  const total = formulario.totalRespuestas ?? 0;
  const pendientes = formulario.pendientes ?? 0;
  const revision = formulario.requierenRevision ?? 0;

  const puedeGestionar = usuarioTienePermiso(PERMISOS.GESTIONAR);
  const puedeVerRespuestas = usuarioTienePermiso(PERMISOS.VER_RESPUESTAS);

  const esInterno = formulario.proveedor === 'INTERNO';
  const publicado = formulario.estado === 'PUBLICADO';
  const cerrado = formulario.estado === 'CERRADO';
  const operable = publicado || cerrado;

  const presentacionEstado = obtenerPresentacionEstadoFormulario(formulario.estado);
  const estadoBadge = StatusBadge({
    label: presentacionEstado.label,
    tone: presentacionEstado.tone,
  });

  const badgeProveedor = `
    <span class="badge-proveedor ${esInterno ? 'badge-interno' : 'badge-google'}">
      ${esInterno ? 'SGPA' : 'Google'}
    </span>
  `;

  return `
    <tr data-formulario-id="${formulario.id}">
      <td>
        <strong>${escapeHtml(formulario.titulo)}</strong>
        ${badgeProveedor}
      </td>
      <td>${escapeHtml(carrera)}</td>
      <td>${escapeHtml(plan)}</td>
      <td>${estadoBadge}</td>
      <td>
        <div class="formularios-response-summary">
          <strong>${total} respuestas</strong>
          <small>
            ${pendientes} pendiente${pendientes === 1 ? '' : 's'} · ${revision} en revisión
          </small>
        </div>
      </td>
      <td>
        ${
          formulario.responderUri
            ? `
              <button
                type="button"
                class="formularios-icon-button formularios-copy-button"
                data-action="copiar-enlace"
                data-id="${formulario.id}"
                title="Copiar enlace para responder"
                aria-label="Copiar enlace para responder"
              >
                <i data-lucide="copy" aria-hidden="true"></i>
              </button>
            `
            : '—'
        }
      </td>
      <td>
        <div class="formularios-table-actions">
          ${
            formulario.responderUri
              ? `
                <button
                  type="button"
                  class="formularios-icon-button"
                  data-action="abrir-enlace"
                  data-id="${formulario.id}"
                  title="${
                    esInterno
                      ? 'Abrir formulario web institucional'
                      : 'Abrir formulario en Google Forms'
                  }"
                >
                  <i data-lucide="external-link" aria-hidden="true"></i>
                </button>
              `
              : ''
          }

          ${
            puedeVerRespuestas
              ? `
                <button
                  type="button"
                  class="formularios-icon-button"
                  data-action="ver-respuestas"
                  data-id="${formulario.id}"
                  title="Ver respuestas"
                >
                  <i data-lucide="inbox" aria-hidden="true"></i>
                </button>
              `
              : ''
          }

          ${
            esInterno && formulario.responderUri
              ? `
                <button
                  type="button"
                  class="formularios-icon-button"
                  data-action="vista-previa"
                  data-id="${formulario.id}"
                  title="Vista previa del formulario (modo simulación)"
                  aria-label="Vista previa del formulario"
                >
                  <i data-lucide="eye" aria-hidden="true"></i>
                </button>
              `
              : ''
          }

          ${
            puedeGestionar && esInterno && (formulario.estado === 'CREADO' || formulario.estado === 'CREANDO')
              ? `
                <button
                  type="button"
                  class="formularios-icon-button formularios-icon-button-success"
                  data-action="publicar"
                  data-id="${formulario.id}"
                  title="Publicar formulario para estudiantes"
                >
                  <i data-lucide="globe" aria-hidden="true"></i>
                </button>
              `
              : ''
          }

          ${
            puedeGestionar && esInterno && publicado
              ? `
                <button
                  type="button"
                  class="formularios-icon-button"
                  data-action="regenerar-token"
                  data-id="${formulario.id}"
                  title="Regenerar enlace público (revoca el anterior)"
                >
                  <i data-lucide="key-round" aria-hidden="true"></i>
                </button>
              `
              : ''
          }

          ${
            !esInterno && puedeGestionar && operable
              ? `
                <button
                  type="button"
                  class="formularios-icon-button"
                  data-action="sincronizar"
                  data-id="${formulario.id}"
                  title="Sincronizar respuestas de Google Forms"
                >
                  <i data-lucide="refresh-cw" aria-hidden="true"></i>
                </button>
              `
              : ''
          }

          ${
            puedeGestionar && publicado
              ? `
                <button
                  type="button"
                  class="formularios-icon-button formularios-icon-button-danger"
                  data-action="cerrar"
                  data-id="${formulario.id}"
                  title="Cerrar formulario"
                >
                  <i data-lucide="lock" aria-hidden="true"></i>
                </button>
              `
              : ''
          }
        </div>
      </td>
    </tr>
  `;
}

export function renderizarTablaFormularios(contexto) {
  const contenedor = document.getElementById('formulariosEstudiantesContent');
  if (!contenedor) return;

  const formularios = contexto?.estado?.formularios || [];
  const rows = formularios.map(renderizarFilaFormulario).join('');

  contenedor.innerHTML = DataTable({
    columns: [
      'Título',
      'Carrera',
      'Plan de estudio',
      'Estado',
      'Respuestas',
      'Enlace',
      'Acciones',
    ],
    rows,
    emptyMessage: 'No hay formularios registrados.',
    ariaLabel: 'Formularios de estudiantes',
  });

  renderizarIconos();
}

export function renderizarCargaFormularios() {
  const contenedor = document.getElementById('formulariosEstudiantesContent');
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="formularios-loading-card">
      <span class="formularios-spinner" aria-hidden="true"></span>
      <p>Cargando formularios...</p>
    </div>
  `;
}

export async function manejarAccionFormulario(event, contexto, { onRecargar } = {}) {
  const button = event.target.closest('[data-action][data-id]');
  if (!button) return;

  const id = Number(button.dataset.id);
  if (!id) return;

  const formularios = contexto?.estado?.formularios || [];
  const formulario = formularios.find((item) => item.id === id);
  if (!formulario) return;

  const accion = button.dataset.action;

  switch (accion) {
    case 'copiar-enlace':
      await copiarEnlaceFormulario(formulario);
      break;

    case 'abrir-enlace':
      if (formulario.responderUri) {
        await abrirEnlaceFormularioEstudiantes(formulario.responderUri);
      }
      break;

    case 'vista-previa':
      await abrirVistaPreviaFormulario(formulario);
      break;

    case 'ver-respuestas':
      await abrirDialogoRespuestasFormulario(formulario);
      break;

    case 'publicar':
      await publicarFormularioAction(formulario, button, onRecargar);
      break;

    case 'regenerar-token':
      await regenerarTokenFormularioAction(formulario, button, onRecargar);
      break;

    case 'sincronizar':
      await sincronizarFormularioAction(formulario, button, onRecargar);
      break;

    case 'cerrar':
      await cerrarFormularioAction(formulario, button, onRecargar);
      break;
  }
}

export function conectarEventosListado(contexto, { onRecargar } = {}) {
  const contenido = document.getElementById('formulariosEstudiantesContent');
  if (!contenido) return;

  const handler = async (event) => {
    if (!contexto?.activo) return;
    await manejarAccionFormulario(event, contexto, { onRecargar });
  };

  contenido.removeEventListener('click', contenido._sgpaFormulariosClick);
  contenido._sgpaFormulariosClick = handler;
  contenido.addEventListener('click', handler);
}
