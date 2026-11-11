import { DataTable } from '../../components/DataTable.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { renderizarIconos } from '../../utils/icons.js';
import { listarOptativas, listarCarrerasElegiblesOptativa, crearOptativa, actualizarOptativa, cambiarEstadoOptativa } from '../../services/optativas.service.js';
import { obtenerRolActivo, usuarioTienePermiso } from '../../app/session.js';
import { PERMISOS, ROLES } from '../../config/permissions.js';
import { escapeHtml } from '../../utils/html.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { mostrarAdvertencia, mostrarError } from '../../components/AlertModal.js';
import { proponerCrearOptativa, proponerActualizarOptativa, proponerEstadoOptativa } from '../../services/solicitudes-cambio.service.js';
import { CATEGORIAS_OPTATIVA, obtenerEtiquetaCategoria, filtrarOptativas } from './optativas.helpers.js';

export { CATEGORIAS_OPTATIVA, obtenerEtiquetaCategoria, filtrarOptativas };

let optativas = [];
let carreras = [];
let instancia = 0;

const esAsistente = () => obtenerRolActivo() === ROLES.ASISTENTE_ESTUDIANTIL;
const puedeGestionar = () => usuarioTienePermiso(PERMISOS.OPTATIVAS_GESTIONAR);

export function OptativasPage() {
  const campos = `
    <label>
      <span>Código *</span>
      <input name="codigo" maxlength="30" required autocomplete="off" placeholder="Ej. OPT-001">
    </label>
    <label>
      <span>Nombre *</span>
      <input name="nombre" maxlength="150" required autocomplete="off" placeholder="Nombre de la asignatura">
    </label>
    <label>
      <span>Categoría *</span>
      <select name="tipo" required>
        <option value="DISCIPLINARIA">Disciplinaria</option>
        <option value="ABIERTA">Abierta</option>
        <option value="SEDE">Sede</option>
      </select>
    </label>
    <label>
      <span>Carrera de origen</span>
      <select name="carreraOrigenId"><option value="">Sin carrera de origen</option></select>
    </label>
    <label class="sgpa-form-wide">
      <span>Descripción</span>
      <textarea name="descripcion" maxlength="500" rows="3" placeholder="Descripción opcional"></textarea>
    </label>
  `;

  return `
    <section id="optativasPage" class="module-view optativas-page">
      <div class="optativas-toolbar">
        <div>
          <h2>Catálogo de optativas</h2>
          <p>Asignaturas reales disponibles para los planes de estudio.</p>
        </div>
        ${puedeGestionar() ? `
          <button id="nuevaOptativa" class="sgpa-button sgpa-button-primary optativas-primary-button" type="button">
            <i data-lucide="plus" aria-hidden="true"></i>
            Nueva optativa
          </button>` : ''}
      </div>

      <div class="optativas-filters">
        <label class="sgpa-search" for="buscarOptativa">
          <i data-lucide="search" aria-hidden="true"></i>
          <input id="buscarOptativa" type="search" placeholder="Buscar por código o nombre..." autocomplete="off" aria-label="Buscar optativas">
        </label>
        <select id="tipoOptativaFiltro" class="sgpa-select" aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          <option value="DISCIPLINARIA">Disciplinaria</option>
          <option value="ABIERTA">Abierta</option>
          <option value="SEDE">Sede</option>
        </select>
        <select id="estadoOptativaFiltro" class="sgpa-select" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="ACTIVA">Activas</option>
          <option value="INACTIVA">Inactivas</option>
        </select>
      </div>

      <div id="optativasResultado" aria-live="polite">
        <div class="sgpa-state-message">Cargando optativas...</div>
      </div>

      <dialog id="optativaDialog" class="sgpa-form-dialog sgpa-form-dialog-md">
        ${FormDialog({
          formId: 'optativaForm',
          title: 'Nueva optativa',
          description: 'Complete los datos de la asignatura optativa.',
          body: campos,
          errorId: 'optativaFormError',
          cancelButtonId: 'cancelarOptativa',
          submitButtonId: 'guardarOptativa',
          submitText: 'Guardar optativa',
        })}
      </dialog>
    </section>
  `;
}

function mostrarMensaje(mensaje) {
  const nodo = document.getElementById('optativasResultado');
  if (nodo) nodo.textContent = mensaje;
}

function renderizar() {
  const nodo = document.getElementById('optativasResultado');
  if (!nodo) return;

  const termino = document.getElementById('buscarOptativa')?.value || '';
  const tipo = document.getElementById('tipoOptativaFiltro')?.value || '';
  const estado = document.getElementById('estadoOptativaFiltro')?.value || '';
  const visibles = filtrarOptativas(optativas, { busqueda: termino, tipo, estado });

  const gestionar = puedeGestionar();
  const filas = visibles.map((o) => `
    <tr>
      <td><strong class="optativas-codigo">${escapeHtml(o.curso?.codigo ?? '—')}</strong></td>
      <td><strong>${escapeHtml(o.curso?.nombre ?? '—')}</strong></td>
      <td>${escapeHtml(obtenerEtiquetaCategoria(o.tipo))}</td>
      <td>${escapeHtml(o.carreraOrigen?.nombre ?? 'Institucional')}</td>
      <td>${StatusBadge({ label: o.activo ? 'Activa' : 'Inactiva', tone: o.activo ? 'success' : 'neutral' })}</td>
      ${gestionar ? `
        <td class="sgpa-table-actions-cell">
          <div class="sgpa-table-actions">
            ${obtenerRolActivo() === ROLES.ADMIN_GLOBAL || o.tipo === 'DISCIPLINARIA' ? `
              <button type="button"
                class="cursos-icon-button optativas-icon-button"
                data-editar-optativa="${Number(o.id)}"
                title="Editar optativa"
                aria-label="Editar ${escapeHtml(o.curso?.nombre ?? 'optativa')}">
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>
              <button type="button"
                class="cursos-icon-button optativas-icon-button ${o.activo ? 'optativas-icon-button--danger' : ''}"
                data-estado-optativa="${Number(o.id)}"
                title="${o.activo ? 'Desactivar' : 'Activar'} optativa"
                aria-label="${o.activo ? 'Desactivar' : 'Activar'} ${escapeHtml(o.curso?.nombre ?? 'optativa')}">
                <i data-lucide="${o.activo ? 'circle-pause' : 'circle-check'}" aria-hidden="true"></i>
              </button>` : ''}
          </div>
        </td>` : ''}
    </tr>
  `).join('');

  nodo.innerHTML = DataTable({
    columns: [
      'Código',
      'Nombre',
      'Categoría',
      'Carrera de origen',
      'Estado',
      ...(gestionar ? [{ label: 'Acciones', className: 'sgpa-table-actions-cell' }] : []),
    ],
    rows: filas,
    emptyMessage: 'No hay optativas que coincidan con los filtros.',
    ariaLabel: 'Catálogo de optativas',
  });
  renderizarIconos();
}

function abrirFormulario(optativa = null) {
  const dialogo = document.getElementById('optativaDialog');
  const formulario = document.getElementById('optativaForm');
  formulario.reset();
  formulario.dataset.id = optativa?.id ?? '';
  const titulo = dialogo.querySelector('.sgpa-form-heading h3');
  if (titulo) titulo.textContent = optativa ? 'Editar optativa' : 'Nueva optativa';
  formulario.elements.codigo.value = optativa?.curso?.codigo ?? '';
  formulario.elements.nombre.value = optativa?.curso?.nombre ?? '';
  formulario.elements.tipo.value = optativa?.tipo ?? 'DISCIPLINARIA';
  for (const option of formulario.elements.tipo.options) {
    option.disabled = obtenerRolActivo() !== ROLES.ADMIN_GLOBAL && option.value !== 'DISCIPLINARIA';
  }
  formulario.elements.carreraOrigenId.innerHTML = '<option value="">Sin carrera de origen</option>' + carreras.map((c) => `<option value="${Number(c.id)}">${escapeHtml(c.nombre)}</option>`).join('');
  formulario.elements.carreraOrigenId.value = optativa?.carreraOrigenId ?? '';
  formulario.elements.descripcion.value = optativa?.curso?.descripcion ?? '';
  formulario.elements.codigo.disabled = Boolean(optativa);
  formulario.elements.nombre.disabled = Boolean(optativa);
  dialogo.showModal();
  habilitarCierreExterior(dialogo);
}

async function cargar(actual) {
  const resultado = await listarOptativas();
  if (actual !== instancia) return;
  if (!resultado?.ok || !Array.isArray(resultado.optativas)) {
    mostrarMensaje(resultado?.message || 'No fue posible cargar el catálogo de optativas.');
    return;
  }
  optativas = resultado.optativas;
  renderizar();
}

export function iniciarOptativasPage() {
  const actual = ++instancia;
  const pagina = document.getElementById('optativasPage');
  if (!pagina) return;
  pagina.addEventListener('input', (evento) => {
    if (evento.target.matches('#buscarOptativa, #tipoOptativaFiltro, #estadoOptativaFiltro')) renderizar();
  });
  pagina.addEventListener('change', (evento) => {
    if (evento.target.matches('#tipoOptativaFiltro, #estadoOptativaFiltro')) renderizar();
  });
  pagina.addEventListener('click', async (evento) => {
    if (evento.target.closest('#nuevaOptativa')) abrirFormulario();
    if (evento.target.closest('#cancelarOptativa')) document.getElementById('optativaDialog').close();
    const editar = evento.target.closest('[data-editar-optativa]');
    if (editar) abrirFormulario(optativas.find((o) => o.id === Number(editar.dataset.editarOptativa)));
    const estado = evento.target.closest('[data-estado-optativa]');
    if (estado) {
      const optativa = optativas.find((o) => o.id === Number(estado.dataset.estadoOptativa));
      if (!optativa) return;
      const accion = optativa.activo ? 'Desactivar' : 'Activar';
      const confirmado = typeof confirmarAccion === 'function'
        ? await confirmarAccion({
            titulo: `${accion} optativa`,
            mensaje: `¿Desea ${accion.toLowerCase()} "${optativa.curso?.nombre || 'la optativa'}"?`,
            textoConfirmar: accion,
            peligro: optativa.activo,
          })
        : (typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(`${accion} ${optativa.curso?.nombre}?`) : true);
      if (!confirmado) return;
      try {
        const respuesta = await (esAsistente() ? proponerEstadoOptativa : cambiarEstadoOptativa)(optativa.id, !optativa.activo);
        if (!respuesta?.ok) throw new Error(respuesta?.message || 'No fue posible cambiar el estado.');
        await cargar(actual);
      } catch (error) { mostrarMensaje(error.message); }
    }
  });
  document.getElementById('optativaForm').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const form = evento.currentTarget;
    const id = Number(form.dataset.id) || null;
    const tipo = form.elements.tipo.value;
    const carreraOrigenId = Number(form.elements.carreraOrigenId.value) || null;
    if (tipo === 'DISCIPLINARIA' && !carreraOrigenId) {
      mostrarAdvertencia({ titulo: 'Dato requerido', mensaje: 'Seleccione la carrera de origen.' });
      return;
    }
    if (obtenerRolActivo() !== ROLES.ADMIN_GLOBAL && tipo !== 'DISCIPLINARIA') {
      mostrarAdvertencia({ titulo: 'Rol no autorizado', mensaje: 'Las optativas institucionales requieren el rol de administrador global.' });
      return;
    }
    const datos = id
      ? { tipo, carreraOrigenId, descripcion: form.elements.descripcion.value.trim() }
      : { codigo: form.elements.codigo.value.trim().toUpperCase(), nombre: form.elements.nombre.value.trim(), tipo, ...(carreraOrigenId ? { carreraOrigenId } : {}), descripcion: form.elements.descripcion.value.trim() };
    try {
      const respuesta = id
        ? await (esAsistente() ? proponerActualizarOptativa : actualizarOptativa)(id, datos)
        : await (esAsistente() ? proponerCrearOptativa : crearOptativa)(datos);
      if (!respuesta?.ok) throw new Error(respuesta?.message || 'No fue posible guardar la optativa.');
      document.getElementById('optativaDialog').close();
      await cargar(actual);
    } catch (error) {
      mostrarError({ titulo: 'Error al guardar', mensaje: error.message || 'No fue posible guardar la optativa.' });
    }
  });
  if (puedeGestionar()) {
    listarCarrerasElegiblesOptativa().then((r) => {
      if (actual === instancia && r?.ok) carreras = r.carreras ?? [];
    });
  }
  cargar(actual).catch((error) => mostrarMensaje(error.message));
}
