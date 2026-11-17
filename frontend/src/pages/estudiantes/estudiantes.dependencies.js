import {
  DataTable
} from '../../components/DataTable.js';
import {
  FormDialog,
  habilitarCierreExterior
} from '../../components/FormDialog.js';
import {
  mostrarError,
  mostrarAdvertencia,
  mostrarExito
} from '../../components/AlertModal.js';
import {
  SelectionCard
} from '../../components/SelectionCard.js';
import {
  StatusBadge
} from '../../components/StatusBadge.js';
import {
  usuarioTienePermiso,
  obtenerRolActivo
} from '../../app/session.js';
import {
  ROLES
} from '../../config/permissions.js';
import {
  proponerCrearEstudiante,
  proponerActualizarEstudiante,
  proponerEstadoEstudiante,
  proponerCambioPlanEstudiante,
  proponerResultadoEstudiante
} from '../../services/solicitudes-cambio.service.js';
import {
  obtenerCatalogoEstudiantesJerarquia
} from '../../services/jerarquia.service.js';
import {
  listarOptativas
} from '../../services/optativas.service.js';
import {
  listarEstudiantes,
  obtenerEstudiante,
  actualizarEstudiante,
  crearEstudiante,
  cambiarEstadoEstudiante,
  cambiarPlanEstudiante,
  obtenerHistorialAcademicoEstudiante,
  obtenerHistorialPlanesEstudiante,
  obtenerProgresoEstudiante,
  evaluarGraduacionEstudiante,
  registrarResultadoAcademicoEstudiante,
  contarEstudiantesPorCarrera,
  contarEstudiantesPorPlan,
  listarBandejaRevisionEstudiantes,
  obtenerRegistroRevisionEstudiante,
  aprobarRegistrosRevision,
  rechazarRegistrosRevision,
  devolverRegistrosRevision
} from '../../services/estudiantes.service.js';

import {
  listarPlanAsignaturas
} from '../../services/plan-asignaturas.service.js';
import {
  listarCarreras
} from '../../services/carreras.service.js';
import {
  listarPlanesEstudio
} from '../../services/planes-estudio.service.js';
import {
  listarPeriodosAcademicos
} from '../../services/periodos.service.js';
import {
  listarSolicitudesFormularios,
  aceptarSolicitudFormulario,
  rechazarSolicitudFormulario,
  contarSolicitudesPorPlan
} from '../../services/formularios-estudiantes.service.js';
import {
  confirmarAccion
} from '../../utils/confirm.js';
import {
  escapeHtml,
  calcularLongitudTexto
} from '../../utils/html.js';
import {
  renderizarIconos
} from '../../utils/icons.js';
import {
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
  formatearFechaHoraEstudiante as formatearFechaHora,
  formatearTextoEnumEstudiante as formatearTextoEnum
} from './estudiantes.helpers.js';
import {
  renderizarHistorialAcademico as renderizarHistorialAcademicoComponente,
  renderizarHistorialPlanes as renderizarHistorialPlanesComponente,
  renderizarProgresoEstudiante as renderizarProgresoEstudianteComponente
} from './EstudianteExpedienteView.js';
import {
  renderizarPreviewImportacionEstudiantes as renderizarPreviewImportacionEstudiantesComponente,
  abrirImportacionEstudiantes as abrirImportacionEstudiantesComponente
} from './EstudianteImportacionDialog.js';

export const PERMISOS = Object.freeze({ GESTIONAR: 'ESTUDIANTES_GESTIONAR' });
export const dependencias = Object.freeze({
 PERMISOS,
 DataTable,
 FormDialog,
 habilitarCierreExterior,
 mostrarError,
 mostrarAdvertencia,
 mostrarExito,
 SelectionCard,
 StatusBadge,
 usuarioTienePermiso,
 obtenerRolActivo,
 ROLES,
 proponerCrearEstudiante,
 proponerActualizarEstudiante,
 proponerEstadoEstudiante,
 proponerCambioPlanEstudiante,
 proponerResultadoEstudiante,
 obtenerCatalogoEstudiantesJerarquia,
 listarOptativas,
 listarEstudiantes,
 obtenerEstudiante,
 actualizarEstudiante,
 crearEstudiante,
 cambiarEstadoEstudiante,
 cambiarPlanEstudiante,
 obtenerHistorialAcademicoEstudiante,
 obtenerHistorialPlanesEstudiante,
 obtenerProgresoEstudiante,
 evaluarGraduacionEstudiante,
 registrarResultadoAcademicoEstudiante,
 contarEstudiantesPorCarrera,
 contarEstudiantesPorPlan,
 listarBandejaRevisionEstudiantes,
 obtenerRegistroRevisionEstudiante,
 aprobarRegistrosRevision,
 rechazarRegistrosRevision,
 devolverRegistrosRevision,
 listarPlanAsignaturas,
 listarCarreras,
 listarPlanesEstudio,
 listarPeriodosAcademicos,
 listarSolicitudesFormularios,
 aceptarSolicitudFormulario,
 rechazarSolicitudFormulario,
 contarSolicitudesPorPlan,
 confirmarAccion,
 escapeHtml,
 calcularLongitudTexto,
 renderizarIconos,
 ESTADOS,
 ORIGENES_ACADEMICOS,
 RESULTADOS_ACADEMICOS,
 obtenerTonoEstadoEstudiante,
 obtenerTonoEstadoSolicitud,
 extraerData,
 obtenerNombreCompleto,
 formatearEstado,
 obtenerTextoAsignatura,
 obtenerTextoPeriodo,
 esPeriodoIgualOPosterior,
 formatearFechaHora,
 formatearTextoEnum,
 renderizarHistorialAcademicoComponente,
 renderizarHistorialPlanesComponente,
 renderizarProgresoEstudianteComponente,
 renderizarPreviewImportacionEstudiantesComponente,
 abrirImportacionEstudiantesComponente
});
