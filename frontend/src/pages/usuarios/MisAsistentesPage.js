import { obtenerRolesUsuario, obtenerUsuario } from '../../app/session.js';
import { ROLES } from '../../config/permissions.js';
import {
  listarMisAlcancesJerarquia, listarMisAsistentes, obtenerAsistenteJerarquia,
  crearAsistenteJerarquia, configurarAsistenteJerarquia,
  obtenerConfiguracionAsistentesJerarquia,
} from '../../services/jerarquia.service.js';
import {
  listarMisSolicitudesCambio, listarSolicitudesPendientesCambio,
  aprobarSolicitudCambio, rechazarSolicitudCambio,
} from '../../services/solicitudes-cambio.service.js';
import { escapeHtml } from '../../utils/html.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { FormDialog } from '../../components/FormDialog.js';
import { StatCard } from '../../components/StatCard.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { renderizarIconos } from '../../utils/icons.js';

let instanciaActual = 0;

const MODULOS_DELEGABLES = [
  { nombre: 'Estudiantes', consultar: 'ESTUDIANTES_VER', gestionar: 'ESTUDIANTES_GESTIONAR' },
  { nombre: 'Cursos', consultar: 'CURSOS_VER', gestionar: 'CURSOS_GESTIONAR' },
  { nombre: 'Planes de estudio', consultar: 'PLANES_ESTUDIO_VER', gestionar: 'PLANES_ESTUDIO_GESTIONAR' },
  { nombre: 'Optativas', consultar: 'OPTATIVAS_VER', gestionar: 'OPTATIVAS_GESTIONAR' },
];

export function obtenerEstadoSeleccionPermisosDisponibles(permisos) {
  const disponibles = Array.from(permisos || []).filter((permiso) => !permiso.disabled);
  const seleccionados = disponibles.filter((permiso) => permiso.checked).length;
  return {
    checked: disponibles.length > 0 && seleccionados === disponibles.length,
    indeterminate: seleccionados > 0 && seleccionados < disponibles.length,
    disabled: disponibles.length === 0,
  };
}

export function establecerSeleccionPermisosDisponibles(permisos, seleccionado) {
  Array.from(permisos || []).filter((permiso) => !permiso.disabled)
    .forEach((permiso) => { permiso.checked = Boolean(seleccionado); });
}

export function MisAsistentesPage() {
  return `<section id="misAsistentesPage" class="module-view mis-asistentes-page">
    <header class="mis-asistentes-header sgpa-toolbar">
      <div class="mis-asistentes-heading">
        <span class="mis-asistentes-eyebrow">Administración académica</span>
        <h2>Asistentes y solicitudes</h2>
        <p>Gestione las carreras delegadas y revise los cambios pendientes de aprobación.</p>
      </div>
      <button type="button" id="crearAsistenteButton" class="mis-asistentes-btn mis-asistentes-btn-primary" disabled>
        <i data-lucide="user-plus" aria-hidden="true"></i><span>Crear asistente</span>
      </button>
    </header>
    <div id="misAsistentesFeedback" class="usuarios-feedback hidden" role="status" aria-live="polite"></div>
    <div id="misAsistentesContenido" class="mis-asistentes-content" aria-live="polite">
      <div class="mis-asistentes-loading"><i data-lucide="loader-circle" aria-hidden="true"></i><span>Cargando información...</span></div>
    </div>
    <dialog id="misAsistentesDialog" class="sgpa-form-dialog sgpa-form-dialog-lg mis-asistentes-dialog">
      <div id="misAsistentesDialogContenido"></div>
    </dialog>
  </section>`;
}

// Validaciones de entrada para el alta de asistentes. No modifican la delegación
// de carreras/permisos ni sustituyen las validaciones del backend.
const LIMITES_ASISTENTE = Object.freeze({
  cedula: 9,
  nombres: 60,
  apellido1: 50,
  apellido2: 50,
  correo: 150,
});

const NOMBRE_ASISTENTE_REGEX = /^[\p{L}\p{M}\s'-]+$/u;
const CEDULA_ASISTENTE_REGEX = /^\d{1,9}$/;
const CORREO_ASISTENTE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarEntradaAsistente(campo, valor) {
  const texto = String(valor ?? '');
  if (campo === 'cedula') return texto.replace(/\D/g, '').slice(0, LIMITES_ASISTENTE.cedula);
  if (campo === 'nombres' || campo === 'apellido1' || campo === 'apellido2') {
    return texto.replace(/[^\p{L}\p{M}\s'-]/gu, '').slice(0, LIMITES_ASISTENTE[campo]);
  }
  return texto.slice(0, LIMITES_ASISTENTE.correo);
}

export function validarDatosAsistente(datos = {}) {
  const cedula = String(datos.cedula ?? '').trim();
  const nombres = String(datos.nombres ?? '').trim();
  const apellido1 = String(datos.apellido1 ?? '').trim();
  const apellido2 = String(datos.apellido2 ?? '').trim();
  const correo = String(datos.correo ?? '').trim();
  const errores = {};

  if (!cedula) errores.cedula = 'La cédula es obligatoria.';
  else if (cedula.length > LIMITES_ASISTENTE.cedula || !CEDULA_ASISTENTE_REGEX.test(cedula)) {
    errores.cedula = 'La cédula debe contener solo números (máximo 9 dígitos, sin guiones).';
  }

  for (const [campo, nombre, obligatorio] of [
    ['nombres', 'Los nombres', true],
    ['apellido1', 'El primer apellido', true],
    ['apellido2', 'El segundo apellido', false],
  ]) {
    const texto = { nombres, apellido1, apellido2 }[campo];
    if (!texto && obligatorio) errores[campo] = `${nombre} es obligatorio.`;
    else if (texto.length > LIMITES_ASISTENTE[campo]) {
      errores[campo] = `${nombre} no puede superar ${LIMITES_ASISTENTE[campo]} caracteres.`;
    } else if (texto && !NOMBRE_ASISTENTE_REGEX.test(texto)) {
      errores[campo] = `${nombre} solo puede contener letras, espacios, guiones y apóstrofes.`;
    }
  }

  if (!correo) errores.correo = 'El correo electrónico es obligatorio.';
  else if (correo.length > LIMITES_ASISTENTE.correo) {
    errores.correo = 'El correo electrónico no puede superar 150 caracteres.';
  } else if (!CORREO_ASISTENTE_REGEX.test(correo)) {
    errores.correo = 'Ingrese un correo electrónico válido (por ejemplo: nombre@dominio.com).';
  }

  return { valido: Object.keys(errores).length === 0, errores };
}

function verificar(resultado, mensaje) {
  if (!resultado?.ok) throw new Error(resultado?.message || mensaje);
  return resultado.data;
}

function nombrePermiso(codigo) {
  if (String(codigo).endsWith('_VER')) return 'Consultar';
  if (String(codigo).endsWith('_GESTIONAR')) return 'Proponer cambios';
  return String(codigo).replaceAll('_', ' ').toLocaleLowerCase('es-CR');
}

function propuestaVisible(solicitud) {
  const datos = solicitud.datosPropuestos || {};
  const campos = [
    ['Curso', datos.cursoReferencia ? `${datos.cursoReferencia.codigo} · ${datos.cursoReferencia.nombre}` : undefined],
    ['Plan de estudio', datos.planReferencia ? `${datos.planReferencia.codigo} · ${datos.planReferencia.nombre}` : undefined],
    ['Código anterior', datos.datosAnteriores?.codigo],
    ['Código propuesto', datos.codigo],
    ['Nombre anterior', datos.datosAnteriores?.nombre],
    ['Nombre propuesto', datos.nombre],
    ['Descripción anterior', datos.datosAnteriores?.descripcion],
    ['Descripción propuesta', datos.descripcion],
    ['Estado anterior', typeof datos.datosAnteriores?.activo === 'boolean' ? (datos.datosAnteriores.activo ? 'Activo' : 'Inactivo') : undefined],
    ['Estado propuesto', typeof datos.activo === 'boolean' ? (datos.activo ? 'Activo' : 'Inactivo') : undefined],
    [solicitud.modulo === 'CURSOS' ? 'Curso ID' : solicitud.modulo === 'PLANES_ESTUDIO' ? 'Plan ID' : solicitud.modulo === 'OPTATIVAS' ? 'Optativa ID' : 'Estudiante ID', solicitud.objetivoId],
    ['Código de optativa', datos.codigo || datos.optativaReferencia?.codigo],
    ['Nombre de optativa', datos.nombre || datos.optativaReferencia?.nombre],
    ['Tipo de optativa', datos.tipo || datos.datosAnteriores?.tipo],
    ['Nuevo estado', datos.estado],
    ['Cédula', datos.cedula], ['Nombres', datos.nombres], ['Primer apellido', datos.apellido1],
    ['Segundo apellido', datos.apellido2], ['Correo', datos.correoInstitucional],
    ['Teléfono', datos.telefono], ['Plan', datos.planEstudioId], ['Período de ingreso', datos.periodoIngresoId],
    ['Asignatura', datos.nombreReferencia ? datos.nombreReferencia : (datos.cursoId ? `Curso #${datos.cursoId}` : undefined)],
    ['Nivel', datos.nivel],
    ['Ciclo / Período', datos.periodo],
    ['Créditos', datos.creditos],
    ['Tipo', datos.tipo],
    ['Orden', datos.orden],
    ['Asignatura ID', datos.planAsignaturaId],
    ['Requisito ID', datos.asignaturaRequisitoId],
    ['Salida académica', datos.nombre || (datos.salidaId ? `Salida #${datos.salidaId}` : undefined)],
    ['Título otorgado', datos.tituloOtorgado],
    ['Asignaturas asociadas', Array.isArray(datos.asignaturaIds) ? `${datos.asignaturaIds.length} asignaturas` : undefined],
    ['Cantidad de optativas', datos.cantidadOptativas],
    ['Créditos mínimos', datos.creditosMinimos],
    ['Carga masiva', Array.isArray(datos.asignaturas) ? `${datos.asignaturas.length} asignaturas` : (Array.isArray(datos.requisitos) ? `${datos.requisitos.length} requisitos` : undefined)],
    ['Importación', Array.isArray(datos.filas) ? `${datos.filas.length} filas` : (datos.nombreArchivo || (datos.resumenValidacion ? `${datos.resumenValidacion.total ?? ''} filas` : undefined))],
    ['Plan de destino', datos.planNuevoReferencia?.nombre ? `${datos.planNuevoReferencia.codigo} - ${datos.planNuevoReferencia.nombre}` : (datos.planNuevoId ? `Plan #${datos.planNuevoId}` : undefined)],
    ['Motivo de cambio', datos.motivo],
    ['Período de cambio', datos.periodoCambioId ? `Período #${datos.periodoCambioId}` : undefined],
    ['Estudiante afectado', datos.estudianteReferencia?.cedula ? `${datos.estudianteReferencia.cedula} - ${datos.estudianteReferencia.nombres}` : undefined],
    ['Resultado propuesto', datos.resultado],
    ['Origen académico', datos.origenAcademico],
    ['Observaciones', datos.observaciones],
  ];
  return `<dl class="mis-asistentes-propuesta">${campos.filter(([, valor]) => valor !== undefined && valor !== null)
    .map(([etiqueta, valor]) => `<div><dt>${escapeHtml(etiqueta)}</dt><dd>${escapeHtml(String(valor))}</dd></div>`).join('')}</dl>`;
}

export async function iniciarMisAsistentesPage() {
  const pagina = document.getElementById('misAsistentesPage');
  if (!pagina) return;
  const instancia = ++instanciaActual;
  const sigueActiva = () => instancia === instanciaActual && document.getElementById('misAsistentesPage') === pagina;
  const esAsistente = obtenerRolesUsuario().includes(ROLES.ASISTENTE_ESTUDIANTIL);
  const contenido = pagina.querySelector('#misAsistentesContenido');
  const feedback = pagina.querySelector('#misAsistentesFeedback');
  const dialogo = pagina.querySelector('#misAsistentesDialog');
  const dialogoContenido = pagina.querySelector('#misAsistentesDialogContenido');
  const estado = {
    alcances: [],
    asistentes: [],
    solicitudes: [],
    configuracion: { envioInvitacionHabilitado: false },
  };
  const crearAsistenteButton = pagina.querySelector('#crearAsistenteButton');
  crearAsistenteButton.hidden = esAsistente;

  function mensaje(texto, error = false) {
    feedback.textContent = texto;
    feedback.className = `usuarios-feedback ${error ? 'is-error' : ''}`;
  }

  async function cargar() {
    try {
      if (esAsistente) {
        estado.solicitudes = verificar(await listarMisSolicitudesCambio(), 'No se pudieron cargar sus solicitudes.');
      } else {
        const [alcances, asistentes, solicitudes, configuracion] = await Promise.all([
          listarMisAlcancesJerarquia(), listarMisAsistentes(), listarSolicitudesPendientesCambio(),
          obtenerConfiguracionAsistentesJerarquia(),
        ]);
        estado.alcances = verificar(alcances, 'No se pudo cargar su alcance.');
        estado.asistentes = verificar(asistentes, 'No se pudieron cargar los asistentes.');
        estado.solicitudes = verificar(solicitudes, 'No se pudieron cargar las solicitudes.');
        estado.configuracion = verificar(
          configuracion,
          'No se pudo consultar el estado de las invitaciones.',
        );
      }
      if (!sigueActiva()) return;
      const nombres = new Map(estado.asistentes.map((a) => [Number(a.id), `${a.nombres} ${a.apellido1}`]));
      const carreras = new Map(estado.alcances.map((c) => [Number(c.id), c.nombre]));
      contenido.innerHTML = `
        <div class="mis-asistentes-indicadores" aria-label="Resumen de gestión">
          ${esAsistente ? '' : `
            ${StatCard({ icon: 'graduation-cap', title: 'Carreras asignadas', value: estado.alcances.length, description: 'Alcance de delegación' })}
            ${StatCard({ icon: 'users', title: 'Asistentes registrados', value: estado.asistentes.length, description: 'Vinculados a su coordinación' })}
          `}
          ${StatCard({ icon: 'clipboard-list', title: esAsistente ? 'Mis solicitudes' : 'Solicitudes pendientes', value: estado.solicitudes.length, description: 'Registros de la consulta actual' })}
        </div>
        ${esAsistente ? '' : `
          <section class="mis-asistentes-panel" aria-label="Carreras delegables">
            <header class="mis-asistentes-panel-header">
              <div class="mis-asistentes-panel-title"><span class="mis-asistentes-panel-icon"><i data-lucide="graduation-cap" aria-hidden="true"></i></span>
                <div><h3>Mis carreras</h3><p>Carreras y permisos disponibles para delegar.</p></div>
              </div>
              <span class="mis-asistentes-count">${estado.alcances.length} ${estado.alcances.length === 1 ? 'carrera' : 'carreras'}</span>
            </header>
            ${estado.alcances.length
              ? `<div class="mis-asistentes-alcances-resumen">${estado.alcances.map((c) => `
                  <div class="mis-asistentes-alcance"><span class="mis-asistentes-alcance-icon"><i data-lucide="book-open" aria-hidden="true"></i></span>
                    <div class="mis-asistentes-alcance-detalle"><strong>${escapeHtml(c.nombre)}</strong>
                      ${Array.isArray(c.permisos) && c.permisos.length
                        ? `<span>${c.permisos.length} permiso(s) delegable(s)</span>`
                        : '<span>Esta carrera no tiene permisos disponibles para delegar.</span>'}
                    </div>
                  </div>`).join('')}</div>`
              : '<p class="mis-asistentes-empty">No tenés carreras asignadas para delegar. Solicitá al administrador que configure tus carreras y permisos.</p>'}
          </section>
          <section class="mis-asistentes-panel" aria-label="Mis asistentes">
            <header class="mis-asistentes-panel-header">
              <div class="mis-asistentes-panel-title"><span class="mis-asistentes-panel-icon"><i data-lucide="users" aria-hidden="true"></i></span>
                <div><h3>Mis asistentes</h3><p>Personas autorizadas y delegaciones académicas.</p></div>
              </div>
              <span class="mis-asistentes-count">${estado.asistentes.length} ${estado.asistentes.length === 1 ? 'asistente' : 'asistentes'}</span>
            </header>
            ${estado.asistentes.length ? `<ul class="mis-asistentes-lista">${estado.asistentes.map((a) => `<li class="mis-asistentes-persona">
              <span class="mis-asistentes-avatar" aria-hidden="true">${escapeHtml((a.nombres || 'A').trim().charAt(0).toLocaleUpperCase('es-CR'))}</span>
              <span class="mis-asistentes-persona-detalle"><strong>${escapeHtml(`${a.nombres} ${a.apellido1}`)}</strong><span>${escapeHtml(a.correo)}</span></span>
              <button type="button" data-action="editar-asistente" data-id="${a.id}" class="mis-asistentes-btn mis-asistentes-btn-secondary">
                <i data-lucide="pencil" aria-hidden="true"></i><span>Editar delegación</span>
              </button>
            </li>`).join('')}</ul>` : '<p class="mis-asistentes-empty">No hay asistentes asignados.</p>'}
          </section>`}
        <section class="mis-asistentes-panel" aria-label="Solicitudes de cambio">
          <header class="mis-asistentes-panel-header">
            <div class="mis-asistentes-panel-title"><span class="mis-asistentes-panel-icon"><i data-lucide="clipboard-list" aria-hidden="true"></i></span>
              <div><h3>${esAsistente ? 'Mis solicitudes' : 'Solicitudes de mis asistentes'}</h3><p>Detalle de propuestas, estado y acciones disponibles.</p></div>
            </div>
            <span class="mis-asistentes-count">${estado.solicitudes.length} ${estado.solicitudes.length === 1 ? 'solicitud' : 'solicitudes'}</span>
          </header>
          ${estado.solicitudes.length ? `<div class="mis-asistentes-solicitudes">${estado.solicitudes.map((s) => `
            <article class="mis-asistentes-solicitud">
              <div class="mis-asistentes-solicitud-top"><strong>${escapeHtml(s.modulo)} · ${escapeHtml(s.operacion)}</strong>
                ${StatusBadge({ label: s.estado, tone: s.estado === 'APROBADA' ? 'success' : s.estado === 'PENDIENTE' ? 'warning' : s.estado === 'RECHAZADA' || s.estado === 'INVALIDADA' ? 'danger' : 'neutral' })}</div>
              <p class="mis-asistentes-solicitud-meta">${esAsistente ? '' : `${escapeHtml(nombres.get(Number(s.solicitanteId)) || `Asistente #${s.solicitanteId}`)} · `}
                ${escapeHtml(carreras.get(Number(s.carreraId)) || `Carrera #${s.carreraId}`)} ·
                ${escapeHtml(new Date(s.createdAt).toLocaleString('es-CR'))}</p>
              ${propuestaVisible(s)}
              ${s.motivoRechazo ? `<p class="mis-asistentes-motivo">Motivo: ${escapeHtml(s.motivoRechazo)}</p>` : ''}
              ${!esAsistente && s.estado === 'PENDIENTE' ? `<div class="mis-asistentes-actions">
                <button type="button" data-action="aprobar" data-id="${s.id}" class="mis-asistentes-btn mis-asistentes-btn-primary"><i data-lucide="circle-check" aria-hidden="true"></i><span>Aprobar</span></button>
                <button type="button" data-action="rechazar" data-id="${s.id}" class="mis-asistentes-btn mis-asistentes-btn-secondary"><i data-lucide="circle-x" aria-hidden="true"></i><span>Rechazar</span></button>
              </div>` : ''}
            </article>`).join('')}</div>` : '<p class="mis-asistentes-empty">No hay solicitudes.</p>'}
        </section>`;
      renderizarIconos();
      crearAsistenteButton.disabled = false;
    } catch (error) {
      if (sigueActiva()) {
        crearAsistenteButton.disabled = true;
        contenido.innerHTML = '<div class="mis-asistentes-load-error">No fue posible cargar las carreras, permisos y solicitudes. Intentá nuevamente.</div>';
        mensaje(error.message, true);
      }
    }
  }

  function camposCarreras(asignadas = []) {
    const seleccionadas = new Map(asignadas.map((c) => [Number(c.carreraId), new Set(c.permisos)]));
    if (!estado.alcances.length) {
      return '<p class="mis-asistentes-empty">No tenés carreras asignadas para delegar. Solicitá al administrador que configure tus carreras y permisos.</p>';
    }

    return estado.alcances.map((c) => {
      const disponibles = new Set(Array.isArray(c.permisos) ? c.permisos : []);
      const modulos = MODULOS_DELEGABLES.map((modulo) => ({
        ...modulo,
        permisos: [modulo.consultar, modulo.gestionar]
          .filter((permiso) => disponibles.has(permiso)),
      })).filter((modulo) => modulo.permisos.length);

      return `<fieldset class="mis-asistentes-carrera" data-carrera-id="${c.id}" data-carrera-nombre="${escapeHtml(c.nombre)}">
      <legend><label><input type="checkbox" name="carrera" value="${c.id}" ${seleccionadas.has(Number(c.id)) ? 'checked' : ''}>
        ${escapeHtml(c.nombre)}</label></legend>
      ${modulos.length ? `
        <label class="mis-asistentes-seleccionar-todos">
          <input type="checkbox" name="seleccionar-todos-permisos">
          <span>Seleccionar todos los permisos disponibles</span>
        </label>
        <div class="mis-asistentes-permisos">${modulos.map((modulo) => `
          <section class="mis-asistentes-modulo">
            <strong>${escapeHtml(modulo.nombre)}</strong>
            <div>${modulo.permisos.map((permiso) => `<label>
              <input type="checkbox" name="permiso" value="${escapeHtml(permiso)}" ${seleccionadas.get(Number(c.id))?.has(permiso) ? 'checked' : ''}>
              ${escapeHtml(nombrePermiso(permiso))}</label>`).join('')}</div>
          </section>`).join('')}</div>`
        : '<p class="mis-asistentes-empty">Esta carrera no tiene permisos disponibles para delegar.</p>'}
    </fieldset>`;
    }).join('');
  }

  function actualizarSelectorCarrera(campo) {
    const selector = campo?.querySelector('[name="seleccionar-todos-permisos"]');
    if (!selector) return;
    const seleccion = obtenerEstadoSeleccionPermisosDisponibles(
      campo.querySelectorAll('[name="permiso"]'),
    );
    selector.checked = seleccion.checked;
    selector.indeterminate = seleccion.indeterminate;
    selector.disabled = seleccion.disabled;
  }

  function actualizarResumenFormulario(formulario) {
    const resumen = formulario.querySelector('#resumenDelegacionAsistente');
    const boton = formulario.querySelector('[type="submit"]');
    if (!resumen || !boton) return;
    const campos = [...formulario.querySelectorAll('.mis-asistentes-carrera')]
      .filter((campo) => campo.querySelector('[name="carrera"]')?.checked);
    const seleccion = campos.map((campo) => ({
      nombre: campo.dataset.carreraNombre,
      permisos: [...campo.querySelectorAll('[name="permiso"]:checked')]
        .map((input) => nombrePermiso(input.value)),
    }));
    const totalPermisos = seleccion.reduce((total, carrera) => total + carrera.permisos.length, 0);
    const usuario = obtenerUsuario();
    const coordinador = [usuario?.nombres, usuario?.apellido1]
      .filter(Boolean).join(' ') || 'Coordinador de la sesión';
    const invitacion = estado.configuracion.envioInvitacionHabilitado
      ? 'Envío habilitado; el resultado se confirmará al crear.'
      : 'Pendiente de envío; el envío automático está deshabilitado.';

    resumen.innerHTML = `
      <h4>Resumen de la delegación</h4>
      <p><strong>Coordinador responsable:</strong> ${escapeHtml(coordinador)}</p>
      <p><strong>Estado de la invitación:</strong> ${escapeHtml(invitacion)}</p>
      ${seleccion.length
        ? `<ul>${seleccion.map((carrera) => `<li><strong>${escapeHtml(carrera.nombre)}</strong>: ${carrera.permisos.length ? carrera.permisos.map(escapeHtml).join(', ') : 'sin permisos seleccionados'}</li>`).join('')}</ul>`
        : '<p>No hay carreras seleccionadas.</p>'}`;

    if (!formulario.dataset.id) boton.disabled = seleccion.length === 0 || totalPermisos === 0;
  }

  // Mensajes junto a los campos: esta validación se utiliza solo al crear.
  function mostrarErrorCampoAsistente(formulario, nombre, texto) {
    const entrada = formulario.querySelector(`.mis-asistentes-cuenta [name="${nombre}"]`);
    const error = formulario.querySelector(`#asistenteError-${nombre}`);
    if (!entrada || !error) return;
    error.textContent = texto || '';
    error.hidden = !texto;
    if (texto) entrada.setAttribute('aria-invalid', 'true');
    else entrada.removeAttribute('aria-invalid');
  }

  function validarCampoAsistente(formulario, nombre) {
    const datos = Object.fromEntries(new FormData(formulario));
    const { errores } = validarDatosAsistente(datos);
    mostrarErrorCampoAsistente(formulario, nombre, errores[nombre]);
  }

  function validarFormularioAltaAsistente(formulario) {
    formulario.dataset.intentoEnvio = 'true';
    const { valido, errores } = validarDatosAsistente(
      Object.fromEntries(new FormData(formulario)),
    );
    for (const nombre of Object.keys(LIMITES_ASISTENTE)) {
      mostrarErrorCampoAsistente(formulario, nombre, errores[nombre]);
    }
    if (!valido) {
      const primero = Object.keys(LIMITES_ASISTENTE).find((nombre) => errores[nombre]);
      formulario.querySelector(`.mis-asistentes-cuenta [name="${primero}"]`)?.focus();
    }
    return valido;
  }

  function abrirFormulario(id = null, asignadas = []) {
    dialogoContenido.innerHTML = FormDialog({
      formId: 'formAsistente',
      title: id ? 'Editar delegación' : 'Crear asistente',
      description: 'Solo se muestran carreras y permisos que puede delegar.',
      layout: 'custom',
      formClass: 'mis-asistentes-form',
      bodyClass: 'mis-asistentes-dialog-body',
      body: `
        <button type="button" data-action="cerrar" class="mis-asistentes-dialog-close" aria-label="Cerrar"><i data-lucide="x" aria-hidden="true"></i></button>
        ${id ? '' : `<div class="mis-asistentes-cuenta">
          <p class="mis-asistentes-campos-ayuda">Los campos marcados con <span aria-hidden="true">*</span> son obligatorios.</p>
          <label class="mis-asistentes-campo">
            <span>Cédula <span class="mis-asistentes-obligatorio" aria-hidden="true">*</span></span>
            <input name="cedula" type="text" inputmode="numeric" required maxlength="9" autocomplete="off" aria-describedby="asistenteError-cedula" placeholder="Solo números, máximo 9 dígitos">
            <small id="asistenteError-cedula" class="mis-asistentes-campo-error" role="alert" hidden></small>
          </label>
          <label class="mis-asistentes-campo">
            <span>Nombres <span class="mis-asistentes-obligatorio" aria-hidden="true">*</span></span>
            <input name="nombres" type="text" required maxlength="60" autocomplete="given-name" aria-describedby="asistenteError-nombres">
            <small id="asistenteError-nombres" class="mis-asistentes-campo-error" role="alert" hidden></small>
          </label>
          <label class="mis-asistentes-campo">
            <span>Primer apellido <span class="mis-asistentes-obligatorio" aria-hidden="true">*</span></span>
            <input name="apellido1" type="text" required maxlength="50" autocomplete="family-name" aria-describedby="asistenteError-apellido1">
            <small id="asistenteError-apellido1" class="mis-asistentes-campo-error" role="alert" hidden></small>
          </label>
          <label class="mis-asistentes-campo">
            <span>Segundo apellido <span class="mis-asistentes-opcional">(opcional)</span></span>
            <input name="apellido2" type="text" maxlength="50" aria-describedby="asistenteError-apellido2">
            <small id="asistenteError-apellido2" class="mis-asistentes-campo-error" role="alert" hidden></small>
          </label>
          <label class="mis-asistentes-campo mis-asistentes-campo-correo">
            <span>Correo electrónico <span class="mis-asistentes-obligatorio" aria-hidden="true">*</span></span>
            <input name="correo" type="email" required maxlength="150" autocomplete="email" aria-describedby="asistenteError-correo" placeholder="nombre@dominio.com">
            <small id="asistenteError-correo" class="mis-asistentes-campo-error" role="alert" hidden></small>
          </label>
        </div>`}
        <section class="mis-asistentes-delegacion">
          <h4>Carreras y permisos del asistente</h4>
          <div class="mis-asistentes-carreras">${camposCarreras(asignadas)}</div>
        </section>
        <section id="resumenDelegacionAsistente" class="mis-asistentes-resumen"></section>
      `,
      footerHtml: `<button type="button" data-action="cerrar" class="sgpa-form-secondary">Cancelar</button>
        <button type="submit" class="sgpa-form-primary"><i data-lucide="save" aria-hidden="true"></i>${id ? 'Guardar delegación' : estado.configuracion.envioInvitacionHabilitado ? 'Crear e invitar' : 'Crear asistente'}</button>`,
    });
    const formulario = dialogoContenido.querySelector('#formAsistente');
    formulario.dataset.id = String(id || '');
    // Solo el alta usa mensajes propios en lugar de globos nativos del navegador.
    if (!id) formulario.noValidate = true;
    formulario.querySelectorAll('.mis-asistentes-carrera').forEach(actualizarSelectorCarrera);
    actualizarResumenFormulario(formulario);
    renderizarIconos();
    dialogo.showModal();
  }

  pagina.addEventListener('click', async (event) => {
    const boton = event.target.closest('[data-action]');
    if (!boton) return;
    const accion = boton.dataset.action;
    if (accion === 'cerrar') { dialogo.close(); return; }
    if (accion === 'editar-asistente') {
      try {
        const datos = verificar(await obtenerAsistenteJerarquia(Number(boton.dataset.id)), 'No se pudo cargar la delegación.');
        abrirFormulario(Number(boton.dataset.id), datos.carreras);
      } catch (error) { mensaje(error.message, true); }
      return;
    }
    if (accion === 'aprobar') {
      const confirmado = await confirmarAccion({ titulo: 'Aprobar solicitud',
        mensaje: 'Esta acción registrará los datos propuestos en el sistema oficial.', textoConfirmar: 'Aprobar' });
      if (!confirmado) return;
      try {
        boton.disabled = true;
        const resultado = verificar(await aprobarSolicitudCambio(Number(boton.dataset.id)), 'No se pudo aprobar la solicitud.');
        mensaje(resultado.estado === 'INVALIDADA' ? 'La solicitud fue invalidada porque perdió autorización.' : 'Solicitud aprobada.');
        await cargar();
      } catch (error) { mensaje(error.message, true); } finally { boton.disabled = false; }
      return;
    }
    if (accion === 'rechazar') {
      dialogoContenido.innerHTML = FormDialog({
        formId: 'formRechazo',
        title: 'Rechazar solicitud',
        description: 'Indique el motivo para que el asistente pueda revisar su propuesta.',
        layout: 'custom',
        formClass: 'mis-asistentes-form mis-asistentes-rechazo-form',
        bodyClass: 'mis-asistentes-dialog-body',
        body: `<button type="button" data-action="cerrar" class="mis-asistentes-dialog-close" aria-label="Cerrar"><i data-lucide="x" aria-hidden="true"></i></button>
          <label class="mis-asistentes-motivo-input">Motivo<textarea name="motivo" required minlength="3" maxlength="500" rows="4"></textarea></label>`,
        footerHtml: `<button type="button" data-action="cerrar" class="sgpa-form-secondary">Cancelar</button>
          <button type="submit" class="sgpa-form-primary"><i data-lucide="circle-x" aria-hidden="true"></i>Rechazar solicitud</button>`,
      });
      dialogoContenido.querySelector('#formRechazo').dataset.id = String(Number(boton.dataset.id));
      renderizarIconos();
      dialogo.showModal();
    }
  });

  // Impide caracteres ajenos al campo; muestra errores en el propio formulario.
  pagina.addEventListener('input', (event) => {
    const entrada = event.target;
    if (!entrada.matches?.('#formAsistente .mis-asistentes-cuenta input')) return;
    const formulario = entrada.closest('#formAsistente');
    if (!formulario || formulario.dataset.id) return;
    const normalizado = normalizarEntradaAsistente(entrada.name, entrada.value);
    if (entrada.value !== normalizado) entrada.value = normalizado;
    if (entrada.dataset.revisado === 'true' || formulario.dataset.intentoEnvio === 'true') {
      validarCampoAsistente(formulario, entrada.name);
    }
  });

  pagina.addEventListener('focusout', (event) => {
    const entrada = event.target;
    if (!entrada.matches?.('#formAsistente .mis-asistentes-cuenta input')) return;
    const formulario = entrada.closest('#formAsistente');
    if (!formulario || formulario.dataset.id) return;
    entrada.value = entrada.value.trim();
    if (entrada.name === 'correo') entrada.value = entrada.value.toLowerCase();
    entrada.dataset.revisado = 'true';
    validarCampoAsistente(formulario, entrada.name);
  });

  pagina.addEventListener('change', (event) => {
    const campo = event.target.closest?.('#formAsistente .mis-asistentes-carrera');
    if (!campo) return;

    if (event.target.name === 'seleccionar-todos-permisos') {
      establecerSeleccionPermisosDisponibles(
        campo.querySelectorAll('[name="permiso"]'),
        event.target.checked,
      );
      if (event.target.checked) campo.querySelector('[name="carrera"]').checked = true;
    } else if (event.target.name === 'permiso' && event.target.checked) {
      campo.querySelector('[name="carrera"]').checked = true;
    }

    actualizarSelectorCarrera(campo);
    actualizarResumenFormulario(event.target.closest('#formAsistente'));
  });

  crearAsistenteButton.addEventListener('click', () => abrirFormulario());
  pagina.addEventListener('submit', async (event) => {
    if (event.target.id === 'formRechazo') {
      event.preventDefault();
      const form = event.target;
      const motivo = String(new FormData(form).get('motivo') || '').trim();
      if (motivo.length < 3) { mensaje('Escriba un motivo de al menos 3 caracteres.', true); return; }
      const boton = form.querySelector('[type="submit"]');
      try {
        boton.disabled = true;
        verificar(await rechazarSolicitudCambio(Number(form.dataset.id), motivo), 'No se pudo rechazar la solicitud.');
        dialogo.close();
        mensaje('Solicitud rechazada.');
        await cargar();
      } catch (error) { mensaje(error.message, true); } finally { boton.disabled = false; }
      return;
    }
    if (event.target.id !== 'formAsistente') return;
    event.preventDefault();
    const form = event.target;
    if (!form.dataset.id && !validarFormularioAltaAsistente(form)) return;
    if (!form.reportValidity()) return;
    const boton = form.querySelector('[type="submit"]');
    const carreras = [...form.querySelectorAll('.mis-asistentes-carrera')]
      .filter((campo) => campo.querySelector('[name="carrera"]')?.checked)
      .map((campo) => ({ carreraId: Number(campo.dataset.carreraId),
        permisos: [...campo.querySelectorAll('[name="permiso"]:checked')].map((input) => input.value) }));
    const id = Number(form.dataset.id);
    if (!id && !carreras.length) { mensaje('Seleccione al menos una carrera.', true); return; }
    if (!id && !carreras.some((carrera) => carrera.permisos.length > 0)) {
      mensaje('Seleccione al menos un permiso delegable.', true);
      return;
    }
    const datos = new FormData(form);
    try {
      boton.disabled = true;
      let resultadoCreacion = null;
      if (id) verificar(await configurarAsistenteJerarquia(id, carreras), 'No se pudo guardar la delegación.');
      else resultadoCreacion = verificar(await crearAsistenteJerarquia({
        cedula: String(datos.get('cedula') || '').trim(),
        nombres: String(datos.get('nombres') || '').trim(),
        apellido1: String(datos.get('apellido1') || '').trim(),
        apellido2: String(datos.get('apellido2') || '').trim() || undefined,
        correo: String(datos.get('correo') || '').trim().toLowerCase(), carreras,
      }), 'No se pudo crear el asistente.');
      dialogo.close();
      const estadoInvitacion = resultadoCreacion?.invitacion?.estado;
      mensaje(id
        ? 'Delegación actualizada.'
        : estadoInvitacion === 'ENVIADA'
          ? 'Asistente creado. La invitación fue enviada.'
          : 'Asistente creado. La invitación quedó pendiente de envío.');
      await cargar();
    } catch (error) { mensaje(error.message, true); } finally { boton.disabled = false; }
  });
  dialogo.addEventListener('click', (event) => { if (event.target === dialogo) dialogo.close(); });
  await cargar();
}
