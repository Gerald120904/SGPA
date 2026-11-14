import { dependencias } from './estudiantes.dependencies.js';
import { estadoEstudiantes, accionesEstudiantes } from './estudiantes.state.js';
import { crearEstudiantesCatalogo } from './EstudiantesCatalogo.js';
import { crearEstudiantesOperaciones } from './EstudiantesOperaciones.js';
import { crearEstudiantesSolicitudes } from './EstudiantesSolicitudes.js';

const catalogo = crearEstudiantesCatalogo({ estado: estadoEstudiantes, acciones: accionesEstudiantes });
const operaciones = crearEstudiantesOperaciones({ estado: estadoEstudiantes, acciones: accionesEstudiantes });
const solicitudes = crearEstudiantesSolicitudes({ estado: estadoEstudiantes, acciones: accionesEstudiantes });
Object.assign(accionesEstudiantes, catalogo, operaciones, solicitudes);

export {
 ESTADOS_ESTUDIANTE as ESTADOS,
 ORIGENES_ACADEMICOS_ESTUDIANTE as ORIGENES_ACADEMICOS,
 RESULTADOS_ACADEMICOS_ESTUDIANTE as RESULTADOS_ACADEMICOS,
 obtenerTonoEstadoEstudiante,
 obtenerTonoEstadoSolicitud,
 extraerDataResultado as extraerData,
 obtenerNombreCompletoEstudiante as obtenerNombreCompleto,
 formatearEstadoEstudiante as formatearEstado,
 obtenerTextoAsignaturaEstudiante as obtenerTextoAsignatura,
 obtenerTextoPeriodoEstudiante as obtenerTextoPeriodo,
 esPeriodoIgualOPosterior,
 obtenerTextoPlanEstudiante as obtenerTextoPlan,
 obtenerNombreResponsableEstudiante as obtenerNombreResponsable,
 formatearFechaHoraEstudiante as formatearFechaHora,
 formatearTextoEnumEstudiante as formatearTextoEnum,
 obtenerResumenImportacion,
 obtenerDetalleFilaImportacion
} from './estudiantes.helpers.js';

function configurarTamanoDialog(
  dialog,
  tamano = 'md'
) {
  if (!dialog) {
    return;
  }

  dialog.classList.remove(
    'sgpa-form-dialog-md',
    'sgpa-form-dialog-lg'
  );

  dialog.classList.add(
    tamano === 'lg'
      ? 'sgpa-form-dialog-lg'
      : 'sgpa-form-dialog-md'
  );

  dialog.addEventListener?.('close', () => {
    estadoEstudiantes.versionDialog += 1;
  }, { once: true });
}

accionesEstudiantes.configurarTamanoDialog = configurarTamanoDialog;

export function EstudiantesPage() {
  return `
    <section
      id="estudiantesPage"
      class="module-view estudiantes-page"
    >
      <div class="sgpa-toolbar">
        <div>
          <nav
            class="estudiantes-breadcrumb"
            aria-label="Ruta de navegación"
          >
            <span id="estudiantesBreadcrumb">
              Estudiantes
            </span>
          </nav>

          <h2>
            Estudiantes
          </h2>

          <p>
            Gestión de estudiantes y seguimiento académico.
          </p>
        </div>
      </div>

      <div id="estudiantesNavegacion"></div>

      <dialog
        id="estudianteDialog"
        class="sgpa-form-dialog sgpa-form-dialog-md"
      >
        <div id="estudianteDialogContent"></div>
      </dialog>
    </section>
  `;
}

export function iniciarEstudiantesPage() {
  estadoEstudiantes.instanciaActual += 1;

  estadoEstudiantes.estudiantes = [];
  estadoEstudiantes.catalogoEstudiantes = [];
  estadoEstudiantes.carreraSeleccionada = null;
  estadoEstudiantes.planSeleccionado = null;
  estadoEstudiantes.vistaActual = 'CARRERAS';

  const contenedorNavegacion =
    document.getElementById(
      'estudiantesNavegacion'
    );

  contenedorNavegacion?.addEventListener(
    'click',
    async (event) => {
      const volverCarreras =
        event.target.closest(
          '#volverACarrerasBtn'
        );
      if (volverCarreras) {
        await accionesEstudiantes.mostrarCarreras();
        return;
      }

      const volverPlanes =
        event.target.closest(
          '#volverAPlanesBtn'
        );
      if (volverPlanes) {
        if (estadoEstudiantes.carreraSeleccionada) {
          await accionesEstudiantes.mostrarPlanesCarrera(
            estadoEstudiantes.carreraSeleccionada
          );
        } else {
          await accionesEstudiantes.mostrarCarreras();
        }
        return;
      }

      const carreraBtn =
        event.target.closest(
          '[data-carrera-id]'
        );
      if (carreraBtn) {
        const carreraId =
          Number(
            carreraBtn.dataset.carreraId
          );
        const carrera =
          estadoEstudiantes.carrerasDisponibles.find(
            (c) => c.id === carreraId
          );
        if (carrera) {
          estadoEstudiantes.carreraSeleccionada = carrera;
          await accionesEstudiantes.mostrarPlanesCarrera(
            carrera
          );
        }
        return;
      }

      const planBtn =
        event.target.closest(
          '[data-plan-id]'
        );
      if (planBtn) {
        const planId =
          Number(
            planBtn.dataset.planId
          );
        const plan =
          estadoEstudiantes.planesDisponibles.find(
            (p) => p.id === planId
          );
        if (plan) {
          estadoEstudiantes.planSeleccionado = plan;
          await accionesEstudiantes.mostrarEstudiantesPlan();
        }
        return;
      }

      const accionEstudiante =
        event.target.closest(
          '[data-action][data-id]'
        );
      if (accionEstudiante) {
        accionesEstudiantes.manejarAccionEstudiante(event);
        return;
      }

      const accionSolicitud =
        event.target.closest(
          '[data-solicitud-action][data-id]'
        );
      if (accionSolicitud) {
        accionesEstudiantes.manejarAccionSolicitud(event);
        return;
      }
    }
  );

  dependencias.renderizarIconos();

  // Entrar a Estudiantes -> NO cargar estudiantes -> cargar carreras
  accionesEstudiantes.mostrarCarreras();
}

export function destruirEstudiantesPage() {
  const estado = estadoEstudiantes;
  estado.instanciaActual += 1;
  estado.versionCarreras += 1;
  estado.versionPlanes += 1;
  estado.versionEstudiantes += 1;
  estado.versionBandeja += 1;
  estado.versionSolicitudes += 1;
  estado.versionProgreso += 1;
  estado.versionDialog += 1;

  if (estado.timerBusqueda !== null) {
    globalThis.window?.clearTimeout?.(estado.timerBusqueda);
    estado.timerBusqueda = null;
  }
  if (estado.timerBandeja !== null) {
    globalThis.window?.clearTimeout?.(estado.timerBandeja);
    estado.timerBandeja = null;
  }
  accionesEstudiantes.detenerPollingSolicitudes();

  if (typeof document !== 'undefined') {
    document.getElementById('estudianteDialog')?.close?.();
  }

  estado.carreraSeleccionada = null;
  estado.planSeleccionado = null;
  estado.vistaActual = 'CARRERAS';
  estado.carrerasDisponibles = [];
  estado.planesDisponibles = [];
  estado.estudiantes = [];
  estado.catalogoEstudiantes = [];
  estado.solicitudesFormularios = [];
  estado.registrosBandejaRevision = [];
  estado.seleccionBandejaRevision.clear();
}
