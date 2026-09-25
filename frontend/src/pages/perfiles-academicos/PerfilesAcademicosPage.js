import {
  actualizarPerfil,
  guardarAreasPerfil,
  guardarRequisitosPerfil,
  listarAreasPerfil,
  listarPerfilesAcademicos,
  listarRequisitosPerfil,
  obtenerPerfil,
} from '../../services/perfiles-academicos.service.js';
import { usuarioTienePermiso } from '../../app/session.js';
import { PERMISOS } from '../../config/permissions.js';
import { DataTable } from '../../components/DataTable.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';

const TIPOS_REQUISITO = [
  'FORMACION_ACADEMICA',
  'IDIOMA_INSTRUMENTAL',
  'EXPERIENCIA_DOCENTE',
  'GRADO_COMPLEMENTARIO',
  'IDIOMA_GLOBAL',
  'EXPERIENCIA_PROFESIONAL',
  'CAPACITACIONES',
  'OTROS',
  'JORNADA',
  'HORARIO',
  'CAMPUS',
];

const CONDICIONES = new Set(['JORNADA', 'HORARIO', 'CAMPUS']);

let perfiles = [];
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
          <h2>Perfiles académicos</h2>
          <p>Definición oficial de áreas, requisitos y cursos habilitados.</p>
        </div>
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

export async function iniciarPerfilesAcademicosPage() {
  document.getElementById('perfilesBuscar')?.addEventListener('input', renderizarListado);
  document.getElementById('perfilesEstado')?.addEventListener('change', renderizarListado);
  document.getElementById('perfilesContent')?.addEventListener('click', manejarListado);
  document.getElementById('perfilDetalle')?.addEventListener('click', manejarDetalle);

  const dialog = document.getElementById('perfilAcademicoDialog');
  habilitarCierreExterior(dialog);

  const resultado = await listarPerfilesAcademicos();
  if (!resultado?.ok) {
    mostrarFallo(resultado?.message || 'No fue posible consultar los perfiles.');
    return;
  }

  perfiles = Array.isArray(resultado.data) ? resultado.data : [];
  renderizarListado();
}

function perfilesFiltrados() {
  const texto = document.getElementById('perfilesBuscar')?.value?.trim().toLowerCase() || '';
  const estado = document.getElementById('perfilesEstado')?.value || 'TODOS';

  return perfiles.filter((perfil) => {
    const coincideTexto = !texto || [
      perfil.codigo,
      perfil.nombre,
      perfil.numeroPerfil,
      perfil.carrera?.nombre,
    ].filter(Boolean).some((valor) => String(valor).toLowerCase().includes(texto));
    const coincideEstado = estado === 'TODOS' ||
      (estado === 'ACTIVOS' && perfil.activo) ||
      (estado === 'INACTIVOS' && !perfil.activo);
    return coincideTexto && coincideEstado;
  });
}

function renderizarListado() {
  const contenedor = document.getElementById('perfilesContent');
  if (!contenedor) return;

  const filas = perfilesFiltrados().map((perfil) => `
    <tr>
      <td><strong class="perfil-codigo">${escapeHtml(perfil.codigo)}</strong></td>
      <td>
        <div class="perfil-nombre">
          <strong>${escapeHtml(perfil.nombre)}</strong>
          <small>${escapeHtml(perfil.numeroPerfil || 'Sin número oficial')}</small>
        </div>
      </td>
      <td>${escapeHtml(perfil.carrera?.nombre || '—')}</td>
      <td>${StatusBadge({ label: perfil.activo ? 'ACTIVO' : 'INACTIVO', tone: perfil.activo ? 'success' : 'neutral' })}</td>
      <td class="sgpa-table-actions-cell">
        <button class="sgpa-button sgpa-button-secondary sgpa-button-sm" type="button" data-ver-perfil="${perfil.id}">
          <i data-lucide="eye" aria-hidden="true"></i> Ver detalle
        </button>
      </td>
    </tr>
  `).join('');

  contenedor.innerHTML = DataTable({
    columns: ['Código', 'Perfil', 'Carrera', 'Estado', { label: 'Acciones', className: 'sgpa-table-actions-cell' }],
    rows: filas,
    emptyMessage: 'No hay perfiles que coincidan con los filtros.',
    ariaLabel: 'Perfiles académicos',
  });
  renderizarIconos();
}

async function manejarListado(event) {
  const boton = event.target.closest('[data-ver-perfil]');
  if (boton) await cargarDetalle(Number(boton.dataset.verPerfil));
}

async function cargarDetalle(id) {
  const listado = document.getElementById('perfilesListado');
  const detalle = document.getElementById('perfilDetalle');
  listado?.classList.add('hidden');
  detalle?.classList.remove('hidden');
  if (detalle) detalle.innerHTML = '<div class="sgpa-state-message">Cargando definición oficial...</div>';

  const [perfil, areas, requisitos] = await Promise.all([
    obtenerPerfil(id),
    listarAreasPerfil(id),
    listarRequisitosPerfil(id),
  ]);

  const error = [perfil, areas, requisitos].find((resultado) => !resultado?.ok);
  if (error) {
    if (detalle) detalle.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error">${escapeHtml(error.message || 'No fue posible cargar el perfil.')}</div>`;
    return;
  }

  perfilActual = perfil.data;
  areasActuales = Array.isArray(areas.data) ? areas.data : [];
  requisitosActuales = Array.isArray(requisitos.data) ? requisitos.data : [];
  renderizarDetalle();
}

function renderizarDetalle() {
  const contenedor = document.getElementById('perfilDetalle');
  if (!contenedor || !perfilActual) return;

  const disciplinares = areasActuales.filter((area) => area.tipo === 'DISCIPLINAR');
  const estrategicas = areasActuales.filter((area) => area.tipo === 'ESTRATEGICA');
  const obligatorios = requisitosActuales.filter((item) => item.obligatorio && !CONDICIONES.has(item.tipo));
  const facultativos = requisitosActuales.filter((item) => !item.obligatorio && !CONDICIONES.has(item.tipo));
  const condiciones = requisitosActuales.filter((item) => CONDICIONES.has(item.tipo));
  const cursos = Array.isArray(perfilActual.cursos)
    ? perfilActual.cursos.filter((relacion) => relacion.activo !== false)
    : [];

  contenedor.innerHTML = `
    <button class="sgpa-button sgpa-button-secondary sgpa-back-button" type="button" data-volver-perfiles>
      <i data-lucide="arrow-left" aria-hidden="true"></i> Volver a perfiles
    </button>

    <article class="perfil-hero">
      <div>
        <div class="perfil-hero-badges">
          <span class="perfil-code-pill">${escapeHtml(perfilActual.codigo)}</span>
          ${StatusBadge({ label: perfilActual.activo ? 'ACTIVO' : 'INACTIVO', tone: perfilActual.activo ? 'success' : 'neutral' })}
        </div>
        <h2>${escapeHtml(perfilActual.nombre)}</h2>
        <p>${escapeHtml(perfilActual.numeroPerfil || 'Perfil oficial sin numeración registrada')}</p>
      </div>
      ${puedeGestionar() ? `
        <button class="sgpa-button sgpa-button-primary" type="button" data-editar-oficial>
          <i data-lucide="pencil" aria-hidden="true"></i> Editar información
        </button>
      ` : ''}
    </article>

    <section class="perfil-section">
      <header><div><span>Documento</span><h3>Información oficial</h3></div></header>
      <dl class="perfil-official-grid">
        ${datoOficial('Número de perfil', perfilActual.numeroPerfil)}
        ${datoOficial('Consecutivo', perfilActual.consecutivo)}
        ${datoOficial('Acuerdo de aprobación', perfilActual.acuerdoAprobacion)}
        ${datoOficial('Fecha de aprobación', formatearFecha(perfilActual.fechaAprobacion))}
        ${datoOficial('Tipo de registro', etiquetaTipo(perfilActual.tipoRegistro))}
        ${datoOficial('Carrera', perfilActual.carrera?.nombre)}
      </dl>
    </section>

    <div class="perfil-two-columns">
      ${seccionLista('Áreas disciplinares', 'book-open', disciplinares, 'No hay áreas disciplinares registradas.')}
      ${seccionLista('Áreas estratégicas', 'target', estrategicas, 'No hay áreas estratégicas registradas.')}
    </div>
    ${puedeGestionar() ? botonEditarSeccion('data-editar-areas', 'Editar áreas') : ''}

    <section class="perfil-section">
      <header><div><span>Asignación</span><h3>Cursos asociados</h3></div></header>
      <div class="perfil-chips">
        ${cursos.length ? cursos.map((relacion) => `<span>${escapeHtml(relacion.curso?.codigo || String(relacion.cursoId))}</span>`).join('') : '<p class="perfil-empty">No hay cursos asociados.</p>'}
      </div>
    </section>

    <div class="perfil-two-columns">
      ${seccionRequisitos('Requisitos obligatorios', obligatorios, true)}
      ${seccionRequisitos('Requisitos facultativos', facultativos, false)}
    </div>
    ${seccionRequisitos('Condiciones', condiciones, true)}
    ${puedeGestionar() ? botonEditarSeccion('data-editar-requisitos', 'Editar requisitos y condiciones') : ''}
  `;
  renderizarIconos();
}

function datoOficial(etiqueta, valor) {
  return `<div><dt>${escapeHtml(etiqueta)}</dt><dd>${escapeHtml(valor || 'No registrado')}</dd></div>`;
}

function seccionLista(titulo, icono, elementos, vacio) {
  return `
    <section class="perfil-section">
      <header><div><span>Áreas</span><h3><i data-lucide="${icono}" aria-hidden="true"></i>${escapeHtml(titulo)}</h3></div></header>
      ${elementos.length ? `<ul>${elementos.map((item) => `<li>${escapeHtml(item.descripcion)}</li>`).join('')}</ul>` : `<p class="perfil-empty">${escapeHtml(vacio)}</p>`}
    </section>
  `;
}

function seccionRequisitos(titulo, elementos, obligatorio) {
  return `
    <section class="perfil-section">
      <header>
        <div><span>Definición oficial</span><h3>${escapeHtml(titulo)}</h3></div>
        ${StatusBadge({ label: obligatorio ? 'OBLIGATORIO' : 'FACULTATIVO', tone: obligatorio ? 'warning' : 'info' })}
      </header>
      ${elementos.length ? `<div class="perfil-requirements">${elementos.map((item) => `
        <article><strong>${escapeHtml(etiquetaTipo(item.tipo))}</strong><p>${escapeHtml(item.descripcion)}</p></article>
      `).join('')}</div>` : '<p class="perfil-empty">No hay elementos registrados.</p>'}
    </section>
  `;
}

function botonEditarSeccion(atributo, texto) {
  return `<div class="perfil-section-action"><button class="sgpa-button sgpa-button-secondary sgpa-button-sm" type="button" ${atributo}><i data-lucide="pencil" aria-hidden="true"></i>${escapeHtml(texto)}</button></div>`;
}

async function manejarDetalle(event) {
  if (event.target.closest('[data-volver-perfiles]')) {
    document.getElementById('perfilDetalle')?.classList.add('hidden');
    document.getElementById('perfilesListado')?.classList.remove('hidden');
    perfilActual = null;
    return;
  }
  if (event.target.closest('[data-editar-oficial]')) abrirEditorOficial();
  if (event.target.closest('[data-editar-areas]')) abrirEditorAreas();
  if (event.target.closest('[data-editar-requisitos]')) abrirEditorRequisitos();
}

function abrirDialogo(contenido) {
  const dialog = document.getElementById('perfilAcademicoDialog');
  const host = document.getElementById('perfilAcademicoDialogContent');
  if (!dialog || !host) return null;
  host.innerHTML = contenido;
  dialog.showModal();
  renderizarIconos();
  return dialog;
}

function cerrarDialogo() {
  document.getElementById('perfilAcademicoDialog')?.close();
}

function abrirEditorOficial() {
  const body = `
    ${campo('Número de perfil', 'numeroPerfil', perfilActual.numeroPerfil, 'Perfil 1-2023')}
    ${campo('Consecutivo', 'consecutivo', perfilActual.consecutivo, 'UNA-CO-EI-ACUE-239-2023')}
    ${campo('Acuerdo de aprobación', 'acuerdoAprobacion', perfilActual.acuerdoAprobacion)}
    ${campo('Fecha de aprobación', 'fechaAprobacion', perfilActual.fechaAprobacion, '', 'date')}
    <label class="sgpa-form-field"><span>Tipo de registro</span><select id="tipoRegistro">
      <option value="">Sin registrar</option>
      <option value="PERFIL_NUEVO" ${perfilActual.tipoRegistro === 'PERFIL_NUEVO' ? 'selected' : ''}>Perfil nuevo</option>
      <option value="ACTUALIZACION" ${perfilActual.tipoRegistro === 'ACTUALIZACION' ? 'selected' : ''}>Actualización</option>
    </select></label>
  `;
  const dialog = abrirDialogo(FormDialog({ formId: 'perfilOficialForm', title: 'Información oficial', description: perfilActual.codigo, body, errorId: 'perfilFormError', cancelButtonId: 'cancelarPerfilForm', submitButtonId: 'guardarPerfilForm' }));
  document.getElementById('cancelarPerfilForm')?.addEventListener('click', cerrarDialogo);
  document.getElementById('perfilOficialForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const datos = {};
    ['numeroPerfil', 'consecutivo', 'acuerdoAprobacion', 'fechaAprobacion', 'tipoRegistro'].forEach((id) => {
      datos[id] = document.getElementById(id)?.value?.trim() || null;
    });
    await guardarCambio(() => actualizarPerfil(perfilActual.id, datos), 'La información oficial fue actualizada.', dialog);
  });
}

function abrirEditorAreas() {
  const disciplinares = areasActuales.filter((area) => area.tipo === 'DISCIPLINAR').map((area) => area.descripcion).join('\n');
  const estrategicas = areasActuales.filter((area) => area.tipo === 'ESTRATEGICA').map((area) => area.descripcion).join('\n');
  const body = `
    <label class="sgpa-form-field sgpa-form-field-full"><span>Áreas disciplinares</span><textarea id="areasDisciplinares" rows="8" placeholder="Una área por línea">${escapeHtml(disciplinares)}</textarea><small>Escriba una descripción por línea.</small></label>
    <label class="sgpa-form-field sgpa-form-field-full"><span>Áreas estratégicas</span><textarea id="areasEstrategicas" rows="8" placeholder="Una área por línea">${escapeHtml(estrategicas)}</textarea><small>Escriba una descripción por línea.</small></label>
  `;
  const dialog = abrirDialogo(FormDialog({ formId: 'perfilAreasForm', title: 'Áreas del perfil', description: 'La lista guardada reemplazará la configuración actual.', body, errorId: 'perfilFormError', cancelButtonId: 'cancelarPerfilForm', submitButtonId: 'guardarPerfilForm' }));
  document.getElementById('cancelarPerfilForm')?.addEventListener('click', cerrarDialogo);
  document.getElementById('perfilAreasForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const areas = [
      ...lineas('areasDisciplinares').map((descripcion, indice) => ({ tipo: 'DISCIPLINAR', descripcion, orden: indice + 1 })),
      ...lineas('areasEstrategicas').map((descripcion, indice) => ({ tipo: 'ESTRATEGICA', descripcion, orden: indice + 1 })),
    ];
    if (!(await confirmarAccion({ titulo: 'Reemplazar áreas', mensaje: 'Se sustituirá la lista completa de áreas del perfil.', textoConfirmar: 'Guardar áreas' }))) return;
    await guardarCambio(() => guardarAreasPerfil(perfilActual.id, areas), 'Las áreas fueron actualizadas.', dialog);
  });
}

function abrirEditorRequisitos() {
  const body = `
    <div class="perfil-requisitos-editor sgpa-form-field-full">
      <div id="requisitosEditorRows"></div>
      <button id="agregarRequisito" class="sgpa-button sgpa-button-secondary sgpa-button-sm" type="button"><i data-lucide="plus"></i>Agregar requisito</button>
    </div>
  `;
  const dialog = abrirDialogo(FormDialog({ formId: 'perfilRequisitosForm', title: 'Requisitos y condiciones', description: 'Edite la lista oficial completa.', body, errorId: 'perfilFormError', cancelButtonId: 'cancelarPerfilForm', submitButtonId: 'guardarPerfilForm', layout: 'custom' }));
  renderizarFilasRequisitos(requisitosActuales.map((item) => ({ ...item })));
  document.getElementById('cancelarPerfilForm')?.addEventListener('click', cerrarDialogo);
  document.getElementById('agregarRequisito')?.addEventListener('click', () => {
    const actuales = leerRequisitosEditor(false);
    actuales.push({ tipo: 'OTROS', obligatorio: false, descripcion: '', orden: actuales.length + 1 });
    renderizarFilasRequisitos(actuales);
  });
  document.getElementById('requisitosEditorRows')?.addEventListener('click', (event) => {
    const boton = event.target.closest('[data-quitar-requisito]');
    if (!boton) return;
    const actuales = leerRequisitosEditor(false);
    actuales.splice(Number(boton.dataset.quitarRequisito), 1);
    renderizarFilasRequisitos(actuales);
  });
  document.getElementById('perfilRequisitosForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requisitos = leerRequisitosEditor(true);
    if (!requisitos) return;
    if (!(await confirmarAccion({ titulo: 'Reemplazar requisitos', mensaje: 'Se sustituirá la lista completa de requisitos y condiciones.', textoConfirmar: 'Guardar requisitos' }))) return;
    await guardarCambio(() => guardarRequisitosPerfil(perfilActual.id, requisitos), 'Los requisitos fueron actualizados.', dialog);
  });
}

function renderizarFilasRequisitos(requisitos) {
  const host = document.getElementById('requisitosEditorRows');
  if (!host) return;
  host.innerHTML = requisitos.length ? requisitos.map((item, indice) => `
    <article class="perfil-requisito-editor-row" data-requisito-row>
      <select data-campo="tipo" aria-label="Tipo de requisito">${TIPOS_REQUISITO.map((tipo) => `<option value="${tipo}" ${item.tipo === tipo ? 'selected' : ''}>${escapeHtml(etiquetaTipo(tipo))}</option>`).join('')}</select>
      <label class="perfil-required-check"><input data-campo="obligatorio" type="checkbox" ${item.obligatorio ? 'checked' : ''}> Obligatorio</label>
      <input data-campo="orden" type="number" min="1" value="${Number(item.orden) || indice + 1}" aria-label="Orden">
      <button class="sgpa-button sgpa-button-secondary sgpa-icon-button" data-quitar-requisito="${indice}" type="button" aria-label="Eliminar"><i data-lucide="trash-2"></i></button>
      <textarea data-campo="descripcion" rows="3" placeholder="Descripción oficial">${escapeHtml(item.descripcion || '')}</textarea>
    </article>
  `).join('') : '<p class="perfil-empty">No hay requisitos. Puede agregar el primero.</p>';
  renderizarIconos();
}

function leerRequisitosEditor(validar) {
  const filas = [...document.querySelectorAll('[data-requisito-row]')];
  const requisitos = filas.map((fila, indice) => ({
    tipo: fila.querySelector('[data-campo="tipo"]')?.value,
    obligatorio: Boolean(fila.querySelector('[data-campo="obligatorio"]')?.checked),
    orden: Number(fila.querySelector('[data-campo="orden"]')?.value) || indice + 1,
    descripcion: fila.querySelector('[data-campo="descripcion"]')?.value?.trim() || '',
  }));
  if (validar && requisitos.some((item) => !item.descripcion)) {
    mostrarError({ titulo: 'Descripción requerida', mensaje: 'Todos los requisitos deben incluir una descripción.' });
    return null;
  }
  return requisitos;
}

async function guardarCambio(operacion, mensaje, dialog) {
  const resultado = await operacion();
  if (!resultado?.ok) {
    mostrarError({ titulo: 'No se pudo guardar', mensaje: resultado?.message || 'No fue posible actualizar el perfil.' });
    return;
  }
  dialog?.close();
  mostrarExito({ titulo: 'Perfil actualizado', mensaje });
  await cargarDetalle(perfilActual.id);
}

function campo(etiqueta, id, valor, placeholder = '', tipo = 'text') {
  return `<label class="sgpa-form-field"><span>${escapeHtml(etiqueta)}</span><input id="${id}" type="${tipo}" value="${escapeHtml(valor || '')}" placeholder="${escapeHtml(placeholder)}"></label>`;
}

function lineas(id) {
  return (document.getElementById(id)?.value || '').split('\n').map((linea) => linea.trim()).filter(Boolean);
}

function etiquetaTipo(valor) {
  if (!valor) return 'No registrado';
  return String(valor).toLowerCase().split('_').map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1)).join(' ');
}

function formatearFecha(fecha) {
  if (!fecha) return null;
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
}

function mostrarFallo(mensaje) {
  const contenedor = document.getElementById('perfilesContent');
  if (contenedor) contenedor.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error">${escapeHtml(mensaje)}</div>`;
}
