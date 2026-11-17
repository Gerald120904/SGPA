/**
 * SGPA — Coordinador de operaciones y eventos del módulo Optativas.
 * FRONTEND-ORDER-003
 */

import { renderizarIconos } from '../../utils/icons.js';
import {
  listarOptativas,
  listarCarrerasElegiblesOptativa,
  crearOptativa,
  actualizarOptativa,
  cambiarEstadoOptativa,
} from '../../services/optativas.service.js';
import { obtenerRolActivo, usuarioTienePermiso } from '../../app/session.js';
import { PERMISOS, ROLES } from '../../config/permissions.js';
import { mostrarAdvertencia, mostrarError } from '../../components/AlertModal.js';
import {
  proponerCrearOptativa,
  proponerActualizarOptativa,
  proponerEstadoOptativa,
} from '../../services/solicitudes-cambio.service.js';
import {
  CATEGORIAS_OPTATIVA,
  obtenerEtiquetaCategoria,
  filtrarOptativas,
  validarYConstruirDatosOptativa,
} from './optativas.helpers.js';
import {
  renderizarFiltrosOptativas,
  renderizarTablaOptativas,
} from './OptativasCatalogo.js';
import {
  renderizarDialogoOptativaHtml,
  abrirFormularioOptativa,
  confirmarCambioEstadoOptativa,
} from './OptativaFormDialog.js';

export { CATEGORIAS_OPTATIVA, obtenerEtiquetaCategoria, filtrarOptativas };

let optativas = [];
let carreras = [];
let instancia = 0;

const esAsistente = () => obtenerRolActivo() === ROLES.ASISTENTE_ESTUDIANTIL;
const puedeGestionar = () => usuarioTienePermiso(PERMISOS.OPTATIVAS_GESTIONAR);

export function OptativasPage() {
  return `
    <section id="optativasPage" class="module-view optativas-page">
      <div class="optativas-toolbar">
        <div>
          <h2>Catálogo de optativas</h2>
          <p>Asignaturas reales disponibles para los planes de estudio.</p>
        </div>
        ${
          puedeGestionar()
            ? `
          <button id="nuevaOptativa" class="sgpa-button sgpa-button-primary optativas-primary-button" type="button">
            <i data-lucide="plus" aria-hidden="true"></i>
            Nueva optativa
          </button>`
            : ''
        }
      </div>

      ${renderizarFiltrosOptativas()}

      <div id="optativasResultado" aria-live="polite">
        <div class="sgpa-state-message">Cargando optativas...</div>
      </div>

      ${renderizarDialogoOptativaHtml()}
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

  const busqueda = document.getElementById('buscarOptativa')?.value || '';
  const tipo = document.getElementById('tipoOptativaFiltro')?.value || '';
  const estado = document.getElementById('estadoOptativaFiltro')?.value || '';

  nodo.innerHTML = renderizarTablaOptativas({
    optativas,
    filtros: { busqueda, tipo, estado },
    gestionar: puedeGestionar(),
    rolActivo: obtenerRolActivo(),
  });
  renderizarIconos();
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

async function ejecutarCambioEstado(optativa, actual) {
  const confirmado = await confirmarCambioEstadoOptativa(optativa);
  if (!confirmado) return;

  try {
    const respuesta = await (
      esAsistente() ? proponerEstadoOptativa : cambiarEstadoOptativa
    )(optativa.id, !optativa.activo);
    if (!respuesta?.ok) {
      throw new Error(respuesta?.message || 'No fue posible cambiar el estado.');
    }
    await cargar(actual);
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

async function ejecutarGuardadoOptativa(form, actual) {
  const id = Number(form.dataset.id) || null;
  const evaluacion = validarYConstruirDatosOptativa({
    id,
    codigo: form.elements.codigo.value,
    nombre: form.elements.nombre.value,
    tipo: form.elements.tipo.value,
    carreraOrigenId: form.elements.carreraOrigenId.value,
    descripcion: form.elements.descripcion.value,
    rolActivo: obtenerRolActivo(),
  });

  if (!evaluacion.ok) {
    mostrarAdvertencia({
      titulo: evaluacion.titulo,
      mensaje: evaluacion.mensaje,
    });
    return;
  }

  try {
    const respuesta = id
      ? await (esAsistente() ? proponerActualizarOptativa : actualizarOptativa)(
          id,
          evaluacion.datos,
        )
      : await (esAsistente() ? proponerCrearOptativa : crearOptativa)(
          evaluacion.datos,
        );
    if (!respuesta?.ok) {
      throw new Error(respuesta?.message || 'No fue posible guardar la optativa.');
    }
    document.getElementById('optativaDialog').close();
    await cargar(actual);
  } catch (error) {
    mostrarError({
      titulo: 'Error al guardar',
      mensaje: error.message || 'No fue posible guardar la optativa.',
    });
  }
}

export function iniciarOptativasPage() {
  const actual = ++instancia;
  const pagina = document.getElementById('optativasPage');
  if (!pagina) return;

  pagina.addEventListener('input', (evento) => {
    if (
      evento.target.matches(
        '#buscarOptativa, #tipoOptativaFiltro, #estadoOptativaFiltro',
      )
    ) {
      renderizar();
    }
  });

  pagina.addEventListener('change', (evento) => {
    if (evento.target.matches('#tipoOptativaFiltro, #estadoOptativaFiltro')) {
      renderizar();
    }
  });

  pagina.addEventListener('click', async (evento) => {
    if (evento.target.closest('#nuevaOptativa')) {
      abrirFormularioOptativa({ carreras, rolActivo: obtenerRolActivo() });
      return;
    }
    if (evento.target.closest('#cancelarOptativa')) {
      document.getElementById('optativaDialog').close();
      return;
    }
    const editar = evento.target.closest('[data-editar-optativa]');
    if (editar) {
      const optativa = optativas.find(
        (o) => o.id === Number(editar.dataset.editarOptativa),
      );
      abrirFormularioOptativa({
        optativa,
        carreras,
        rolActivo: obtenerRolActivo(),
      });
      return;
    }
    const estado = evento.target.closest('[data-estado-optativa]');
    if (estado) {
      const optativa = optativas.find(
        (o) => o.id === Number(estado.dataset.estadoOptativa),
      );
      if (!optativa) return;
      await ejecutarCambioEstado(optativa, actual);
    }
  });

  document
    .getElementById('optativaForm')
    ?.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      await ejecutarGuardadoOptativa(evento.currentTarget, actual);
    });

  if (puedeGestionar()) {
    listarCarrerasElegiblesOptativa().then((r) => {
      if (actual === instancia && r?.ok) carreras = r.carreras ?? [];
    });
  }

  cargar(actual).catch((error) => mostrarMensaje(error.message));
}
