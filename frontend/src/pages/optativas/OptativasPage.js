import { listarOptativas, listarCarrerasElegiblesOptativa, crearOptativa, actualizarOptativa, cambiarEstadoOptativa } from '../../services/optativas.service.js';
import { obtenerRolActivo, usuarioTienePermiso } from '../../app/session.js';
import { PERMISOS, ROLES } from '../../config/permissions.js';
import { escapeHtml } from '../../utils/html.js';
import { proponerCrearOptativa, proponerActualizarOptativa, proponerEstadoOptativa } from '../../services/solicitudes-cambio.service.js';

let optativas = [];
let carreras = [];
let instancia = 0;

const esAsistente = () => obtenerRolActivo() === ROLES.ASISTENTE_ESTUDIANTIL;
const puedeGestionar = () => usuarioTienePermiso(PERMISOS.OPTATIVAS_GESTIONAR);

export function OptativasPage() {
  return `<section id="optativasPage" class="module-view optativas-page">
    <header class="optativas-header"><div><h2>Catálogo de Optativas</h2>
    <p>Asignaturas reales disponibles para los planes de estudio.</p></div>
    ${puedeGestionar() ? '<button id="nuevaOptativa" type="button">Nueva optativa</button>' : ''}</header>
    <div class="optativas-filters">
      <input id="buscarOptativa" type="search" placeholder="Buscar por código o nombre" aria-label="Buscar optativas">
      <select id="tipoOptativaFiltro" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option><option value="DISCIPLINARIA">Disciplinaria</option><option value="ABIERTA">Abierta</option><option value="SEDE">Sede</option></select>
      <select id="estadoOptativaFiltro" aria-label="Filtrar por estado"><option value="">Todos los estados</option><option value="ACTIVA">Activas</option><option value="INACTIVA">Inactivas</option></select>
    </div>
    <div id="optativasResultado" role="status">Cargando optativas...</div>
    <dialog id="optativaDialog"><form id="optativaForm">
      <h3 id="optativaDialogTitulo">Optativa</h3>
      <label>Código<input name="codigo" maxlength="30" required></label>
      <label>Nombre<input name="nombre" maxlength="150" required></label>
      <label>Categoría<select name="tipo" required><option value="DISCIPLINARIA">Disciplinaria</option><option value="ABIERTA">Abierta</option><option value="SEDE">Sede</option></select></label>
      <label>Carrera de origen<select name="carreraOrigenId"><option value="">Sin carrera de origen</option></select></label>
      <label>Descripción<textarea name="descripcion" maxlength="500"></textarea></label>
      <div class="optativas-actions"><button type="button" id="cancelarOptativa">Cancelar</button><button type="submit">Guardar</button></div>
    </form></dialog>
  </section>`;
}

function mostrarMensaje(mensaje) {
  const nodo = document.getElementById('optativasResultado');
  if (nodo) nodo.textContent = mensaje;
}

function renderizar() {
  const nodo = document.getElementById('optativasResultado');
  if (!nodo) return;
  const termino = document.getElementById('buscarOptativa').value.trim().toLocaleLowerCase();
  const tipo = document.getElementById('tipoOptativaFiltro').value;
  const estado = document.getElementById('estadoOptativaFiltro').value;
  const visibles = optativas.filter((o) => {
    const coincide = `${o.curso?.codigo ?? ''} ${o.curso?.nombre ?? ''}`.toLocaleLowerCase().includes(termino);
    return coincide && (!tipo || o.tipo === tipo) && (!estado || Boolean(o.activo) === (estado === 'ACTIVA'));
  });
  if (!visibles.length) { nodo.textContent = 'No hay optativas para estos filtros.'; return; }
  nodo.innerHTML = `<div class="optativas-table-wrap"><table><thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Carrera de origen</th><th>Estado</th>${puedeGestionar() ? '<th>Acciones</th>' : ''}</tr></thead><tbody>${visibles.map((o) => `<tr>
    <td>${escapeHtml(o.curso?.codigo ?? '')}</td><td>${escapeHtml(o.curso?.nombre ?? '')}</td><td>${escapeHtml(o.tipo)}</td>
    <td>${escapeHtml(o.carreraOrigen?.nombre ?? 'Institucional')}</td><td>${o.activo ? 'Activa' : 'Inactiva'}</td>
    ${puedeGestionar() ? `<td>${obtenerRolActivo() === ROLES.ADMIN_GLOBAL || o.tipo === 'DISCIPLINARIA' ? `<button type="button" data-editar-optativa="${Number(o.id)}">Editar</button> <button type="button" data-estado-optativa="${Number(o.id)}">${o.activo ? 'Desactivar' : 'Activar'}</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

function abrirFormulario(optativa = null) {
  const dialogo = document.getElementById('optativaDialog');
  const formulario = document.getElementById('optativaForm');
  formulario.reset();
  formulario.dataset.id = optativa?.id ?? '';
  document.getElementById('optativaDialogTitulo').textContent = optativa ? 'Editar optativa' : 'Nueva optativa';
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
    if (evento.target.id === 'nuevaOptativa') abrirFormulario();
    if (evento.target.id === 'cancelarOptativa') document.getElementById('optativaDialog').close();
    const editar = evento.target.closest('[data-editar-optativa]');
    if (editar) abrirFormulario(optativas.find((o) => o.id === Number(editar.dataset.editarOptativa)));
    const estado = evento.target.closest('[data-estado-optativa]');
    if (estado) {
      const optativa = optativas.find((o) => o.id === Number(estado.dataset.estadoOptativa));
      if (!optativa || !window.confirm(`${optativa.activo ? 'Desactivar' : 'Activar'} ${optativa.curso?.nombre}?`)) return;
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
    if (tipo === 'DISCIPLINARIA' && !carreraOrigenId) { window.alert('Seleccione la carrera de origen.'); return; }
    if (obtenerRolActivo() !== ROLES.ADMIN_GLOBAL && tipo !== 'DISCIPLINARIA') { window.alert('Las optativas institucionales requieren el rol de administrador global.'); return; }
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
    } catch (error) { window.alert(error.message); }
  });
  if (puedeGestionar()) {
    listarCarrerasElegiblesOptativa().then((r) => {
      if (actual === instancia && r?.ok) carreras = r.carreras ?? [];
    });
  }
  cargar(actual).catch((error) => mostrarMensaje(error.message));
}
