/**
 * SGPA — Coordinador principal del módulo de Formularios de Estudiantes.
 * FRONTEND-REFACTOR-FORMULARIOS-ESTUDIANTES-INTEGRAL-001
 */

import {
  listarFormulariosEstudiantes,
  obtenerEstadoGoogleFormularios,
} from '../../services/formularios-estudiantes.service.js';
import { mostrarError } from '../../components/AlertModal.js';
import { DataTable } from '../../components/DataTable.js';
import {
  extraerResultadoFormularioServicio,
  normalizarEstadoGoogle,
  LIMITES_FORMULARIO,
  MODALIDADES_FORMULARIO,
  CAMPOS_FORMULARIO,
  validarDatosNuevoFormulario,
  construirDatosCrearFormulario,
  asignaturasElegiblesParaFormulario,
  agruparAsignaturasVistaPrevia,
} from './formularios-estudiantes.helpers.js';
import { contextoFormulariosGlobal } from './formularios-estudiantes.context.js';
import {
  renderizarEstadoGoogle,
  renderizarAcciones,
  actualizarEstadoGoogleAlFoco,
  conectarGoogle as conectarGoogleSubmodulo,
  desconectarGoogle as desconectarGoogleSubmodulo,
  PERMISOS,
} from './FormularioGoogleStatusView.js';
import {
  renderizarTablaFormularios,
  renderizarCargaFormularios,
  conectarEventosListado,
} from './FormulariosListadoView.js';
import { abrirNuevoFormulario as abrirNuevoFormularioSubmodulo } from './FormularioNuevoDialog.js';

export {
  LIMITES_FORMULARIO,
  MODALIDADES_FORMULARIO,
  CAMPOS_FORMULARIO,
  validarDatosNuevoFormulario,
  construirDatosCrearFormulario,
  asignaturasElegiblesParaFormulario,
  agruparAsignaturasVistaPrevia,
  contextoFormulariosGlobal,
  PERMISOS,
};

export function FormulariosEstudiantesPage() {
  return `
    <section
      id="formulariosEstudiantesPage"
      class="module-view formularios-page"
    >
      <div class="formularios-toolbar">
        <div class="formularios-toolbar-heading">
          <h2>Formularios de estudiantes</h2>

          <p>
            Gestión de formularios para
            recolección de información académica.
          </p>

          <div id="estadoGoogleFormularios"></div>
        </div>

        <div
          id="accionesFormularios"
          class="formularios-toolbar-actions"
        ></div>
      </div>

      <div
        id="formulariosEstudiantesContent"
        aria-live="polite"
      >
        ${DataTable({
          columns: [
            'Título',
            'Carrera',
            'Plan',
            'Estado',
            'Respuestas',
            'Enlace',
            'Acciones',
          ],
          rows: '',
          emptyMessage: 'No hay formularios registrados.',
          ariaLabel: 'Formularios de estudiantes',
        })}
      </div>

      <dialog
        id="formularioEstudianteDialog"
        class="sgpa-form-dialog sgpa-form-dialog-md"
      >
        <div id="formularioEstudianteDialogContent"></div>
      </dialog>
    </section>
  `;
}

export async function cargarFormularios() {
  const gen = contextoFormulariosGlobal.generacionInstancia;
  try {
    const resultado = await listarFormulariosEstudiantes();
    if (!contextoFormulariosGlobal.esInstanciaActiva(gen)) return;

    const data = extraerResultadoFormularioServicio(
      resultado,
      'No fue posible consultar los formularios.',
    );
    contextoFormulariosGlobal.estado.formularios = Array.isArray(data) ? data : [];
    renderizarTablaFormularios(contextoFormulariosGlobal);
  } catch (error) {
    if (!contextoFormulariosGlobal.esInstanciaActiva(gen)) return;
    contextoFormulariosGlobal.estado.formularios = [];
    renderizarTablaFormularios(contextoFormulariosGlobal);
    mostrarError({
      titulo: 'No fue posible cargar Formularios',
      mensaje: error?.message || 'Ocurrió un error al cargar la información.',
    });
  }
}

export async function conectarGoogle() {
  return conectarGoogleSubmodulo(contextoFormulariosGlobal);
}

export async function desconectarGoogle() {
  return desconectarGoogleSubmodulo(contextoFormulariosGlobal, {
    onRecargar: cargarFormularios,
  });
}

export async function abrirNuevoFormulario() {
  return abrirNuevoFormularioSubmodulo(contextoFormulariosGlobal, {
    onRecargar: cargarFormularios,
  });
}

export async function iniciarFormulariosEstudiantesPage() {
  const gen = contextoFormulariosGlobal.iniciar();

  renderizarCargaFormularios();
  conectarEventosListado(contextoFormulariosGlobal, {
    onRecargar: cargarFormularios,
  });

  contextoFormulariosGlobal.registrarListenerFoco(() =>
    actualizarEstadoGoogleAlFoco(contextoFormulariosGlobal),
  );

  try {
    const [google, resultadoFormularios] = await Promise.all([
      obtenerEstadoGoogleFormularios(),
      listarFormulariosEstudiantes(),
    ]);

    if (!contextoFormulariosGlobal.esInstanciaActiva(gen)) return;

    contextoFormulariosGlobal.estado.estadoGoogle = normalizarEstadoGoogle(google);

    const data = extraerResultadoFormularioServicio(
      resultadoFormularios,
      'No fue posible consultar los formularios.',
    );
    contextoFormulariosGlobal.estado.formularios = Array.isArray(data) ? data : [];

    renderizarEstadoGoogle(contextoFormulariosGlobal);
    renderizarAcciones(contextoFormulariosGlobal, {
      onNuevoFormulario: abrirNuevoFormulario,
      onRecargar: cargarFormularios,
    });
    renderizarTablaFormularios(contextoFormulariosGlobal);
  } catch (error) {
    if (!contextoFormulariosGlobal.esInstanciaActiva(gen)) return;
    console.error('Error al cargar Formularios:', error);
    contextoFormulariosGlobal.estado.formularios = [];
    renderizarTablaFormularios(contextoFormulariosGlobal);
    mostrarError({
      titulo: 'No fue posible cargar Formularios',
      mensaje: error?.message || 'Ocurrió un error al cargar la información.',
    });
  }
}

export function destruirFormulariosEstudiantesPage() {
  contextoFormulariosGlobal.destruir();
}
