/**
 * SGPA — Coordinador principal del módulo Carreras.
 * FRONTEND-ORDER-003
 */

import { listarCarreras } from '../../services/carreras.service.js';
import { usuarioTienePermiso } from '../../app/session.js';
import { PERMISOS } from '../../config/permissions.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { filtrarCarreras } from './carreras.helpers.js';
import { renderizarTablaCarreras } from './CarrerasCatalogo.js';
import {
  abrirFormularioCarrera,
  alternarEstadoCarrera,
} from './CarreraFormDialog.js';

export { filtrarCarreras };

let carreras = [];
let instanciaActual = 0;

function puedeGestionarCarreras() {
  return usuarioTienePermiso(PERMISOS.CARRERAS_GESTIONAR);
}

export function CarrerasPage() {
  return `
    <section id="carrerasPage" class="module-view carreras-page">
      <div class="carreras-toolbar">
        <div>
          <h2>Carreras</h2>
          <p>Administración de las carreras académicas del SGPA.</p>
        </div>

        ${
          puedeGestionarCarreras()
            ? `
              <button
                id="nuevaCarreraButton"
                class="carreras-primary-button"
                type="button"
              >
                <i data-lucide="plus" aria-hidden="true"></i>
                Nueva carrera
              </button>
            `
            : ''
        }
      </div>

      <div
        id="carrerasFeedback"
        class="carreras-feedback hidden"
        role="status"
      ></div>

      <div class="carreras-filters">
        <label class="carreras-search" for="carrerasBuscar">
          <i data-lucide="search" aria-hidden="true"></i>
          <input
            id="carrerasBuscar"
            type="search"
            placeholder="Buscar por código, nombre o descripción..."
            autocomplete="off"
          >
        </label>

        <select
          id="carrerasEstado"
          class="carreras-select"
          aria-label="Filtrar por estado"
        >
          <option value="TODAS">Todas</option>
          <option value="ACTIVAS">Activas</option>
          <option value="INACTIVAS">Inactivas</option>
        </select>
      </div>

      <div
        id="carrerasContent"
        class="carreras-content"
        aria-live="polite"
      >
        <div class="carreras-message">Cargando carreras...</div>
      </div>

      <dialog
        id="carreraDialog"
        class="sgpa-form-dialog sgpa-form-dialog-md"
      >
        <div id="carreraDialogContent"></div>
      </dialog>
    </section>
  `;
}

function renderizarCarreras() {
  const contenedor = document.getElementById('carrerasContent');
  if (!contenedor) {
    return;
  }

  const busqueda =
    document.getElementById('carrerasBuscar')?.value?.trim().toLowerCase() ||
    '';
  const estado = document.getElementById('carrerasEstado')?.value || 'TODAS';

  contenedor.innerHTML = renderizarTablaCarreras({
    carreras,
    busqueda,
    estado,
    puedeGestionar: puedeGestionarCarreras(),
  });

  renderizarIconos();
}

async function cargarCarreras(instancia) {
  const contenedor = document.getElementById('carrerasContent');
  if (!contenedor) {
    return;
  }

  try {
    const resultado = await listarCarreras();

    if (instancia !== instanciaActual) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar las carreras.',
      );
    }

    carreras = Array.isArray(resultado.carreras) ? resultado.carreras : [];
    renderizarCarreras();
  } catch (error) {
    console.error('Error cargando carreras:', error);

    if (instancia !== instanciaActual) {
      return;
    }

    contenedor.innerHTML = `
      <div class="carreras-message carreras-error" role="alert">
        <h3>No fue posible cargar las carreras</h3>
        <p>${escapeHtml(error?.message || 'Error de conexión.')}</p>
      </div>
    `;
  }
}

export function iniciarCarrerasPage() {
  instanciaActual += 1;
  const instancia = instanciaActual;
  carreras = [];

  const nuevaCarreraButton = document.getElementById('nuevaCarreraButton');
  const buscar = document.getElementById('carrerasBuscar');
  const estado = document.getElementById('carrerasEstado');
  const content = document.getElementById('carrerasContent');

  const recargar = () => cargarCarreras(instanciaActual);

  nuevaCarreraButton?.addEventListener('click', () => {
    abrirFormularioCarrera({
      puedeGestionar: puedeGestionarCarreras(),
      onSaved: recargar,
    });
  });

  buscar?.addEventListener('input', renderizarCarreras);
  estado?.addEventListener('change', renderizarCarreras);

  content?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) {
      return;
    }

    const id = Number(button.dataset.id);
    const carrera = carreras.find((item) => item.id === id);
    if (!carrera) {
      return;
    }

    if (button.dataset.action === 'editar') {
      abrirFormularioCarrera({
        carrera,
        puedeGestionar: puedeGestionarCarreras(),
        onSaved: recargar,
      });
      return;
    }

    if (button.dataset.action === 'estado') {
      await alternarEstadoCarrera({
        carrera,
        puedeGestionar: puedeGestionarCarreras(),
        onSaved: recargar,
      });
    }
  });

  cargarCarreras(instancia);
}
