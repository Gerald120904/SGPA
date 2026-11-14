import { puedeGestionarProfesores, esProfesorActual } from './profesores.permissions.js';
import { crearGestionDetalleProfesores } from './ProfesoresDetalle.js';
import { crearListadoProfesores } from './ProfesoresListado.js';
import { crearPaginaGestionProfesores } from './ProfesoresGestionPage.js';
import { crearAutogestionProfesores } from './ProfesoresAutogestion.js';

export {
  NOMBRES_DIA,
  ORDEN_DIA,
  NOMBRES_ESTADO_PROFESOR,
  NOMBRES_TIPO_ATESTADO,
  NOMBRES_TIPO_REQUISITO,
  obtenerNombreCompleto,
  obtenerCarreras,
  obtenerPerfiles,
  obtenerCursos,
  nombreEstadoProfesor,
  nombreTipoAtestado,
  nombreTipoRequisito,
  tonoCumplimiento,
  nombreEstadoDisponibilidad,
  seleccionarPeriodoInicial,
  filtrarListaProfesores,
  obtenerPeriodoAnteriorDisponibilidad,
  validarBloquesDisponibilidad,
} from './profesores.helpers.js';



let instanciaActual = 0;
let iniciarGestionProfesores = () => {};
let invalidarDetalleActual = () => {};
function crearNuevaInstancia() {
  invalidarDetalleActual();
  instanciaActual += 1;
  return instanciaActual;
}

const gestionDetalleProfesores = crearGestionDetalleProfesores({
  volverAListado: () => iniciarGestionProfesores(),
});
const {
  abrirProfesor,
  abrirMiExpedientePerfil,
  invalidarDetalle,
} = gestionDetalleProfesores;
invalidarDetalleActual = invalidarDetalle;

const listadoProfesores = crearListadoProfesores({
  esInstanciaActual: (instancia) => instancia === instanciaActual,
});

const { renderizarProfesores, cargarProfesores } = listadoProfesores;

/* =========================================================
   PÁGINA
   ========================================================= */

export function ProfesoresPage() {
  return `
    <section
      id="profesoresPage"
      class="module-view profesores-page"
    >

      <div
        id="profesoresVista"
      >

        <div class="profesores-toolbar">

          <div>
            <h2>
              Profesores
            </h2>

            <p>
              Gestión docente, perfiles académicos
              y disponibilidad.
            </p>
          </div>

        </div>


        <label
          class="profesores-search"
          for="profesoresBuscar"
        >

          <i
            data-lucide="search"
            aria-hidden="true"
          ></i>

          <input
            id="profesoresBuscar"
            type="search"
            placeholder="Buscar por nombre, cédula, correo o carrera..."
            autocomplete="off"
          >

        </label>


        <div
          id="profesoresContent"
          class="profesores-content"
          aria-live="polite"
        >

          <div class="profesores-message">
            Cargando profesores...
          </div>

        </div>

      </div>


      <dialog
        id="profesorRevisionDialog"
        class="
          sgpa-form-dialog
          sgpa-form-dialog-sm
        "
      >
        <div
          id="profesorRevisionDialogContent"
        ></div>
      </dialog>

      <dialog
        id="profesorExpedienteDialog"
        class="
          sgpa-form-dialog
          sgpa-form-dialog-lg
        "
      >
        <div
          id="profesorExpedienteDialogContent"
        ></div>
      </dialog>

    </section>
  `;
}


/* =========================================================
   SELECTOR DE MODO (MULTIRROL)
   ========================================================= */

function renderizarSelectorModo(
  modoActual,
) {
  const tieneGestion =
    puedeGestionarProfesores();

  const esProfesor =
    esProfesorActual();


  if (
    !tieneGestion ||
    !esProfesor
  ) {
    return '';
  }


  return `
    <div
      class="profesores-mode-switch"
    >

      <button
        type="button"
        class="
          profesores-mode-button
          ${
            modoActual === 'gestion'
              ? 'is-active'
              : ''
          }
        "
        data-profesores-mode="gestion"
      >
        <i
          data-lucide="users"
          aria-hidden="true"
        ></i>

        Gestión de profesores
      </button>


      <button
        type="button"
        class="
          profesores-mode-button
          ${
            modoActual === 'mi-perfil'
              ? 'is-active'
              : ''
          }
        "
        data-profesores-mode="mi-perfil"
      >
        <i
          data-lucide="user-round"
          aria-hidden="true"
        ></i>

        Mi perfil docente
      </button>

    </div>
  `;
}


function habilitarSelectorModo() {
  document
    .querySelectorAll(
      '[data-profesores-mode]',
    )
    .forEach(
      (boton) => {

        boton.addEventListener(
          'click',
          () => {

            const modo =
              boton.dataset
                .profesoresMode;


            if (
              modo ===
              'gestion'
            ) {
              iniciarGestionProfesores();

              return;
            }


            if (
              modo ===
              'mi-perfil'
            ) {
              iniciarMiPerfilDocente();
            }

          },
        );

      },
    );
}


/* =========================================================
   TABLA (GESTIÓN)
   ========================================================= */

const paginaGestionProfesores = crearPaginaGestionProfesores({
  puedeGestionarProfesores,
  crearNuevaInstancia,
  renderizarSelectorModo,
  habilitarSelectorModo,
  renderizarProfesores,
  cargarProfesores,
  abrirProfesor,
});
iniciarGestionProfesores = paginaGestionProfesores.iniciarGestionProfesores;

const autogestionProfesores = crearAutogestionProfesores({
  crearNuevaInstancia,
  esInstanciaActual: (instancia) => instancia === instanciaActual,
  renderizarSelectorModo,
  habilitarSelectorModo,
  abrirMiExpedientePerfil,
});

const { iniciarMiPerfilDocente } = autogestionProfesores;


export function iniciarProfesoresPage() {
  const esProfesor =
    esProfesorActual();

  const tieneGestion =
    puedeGestionarProfesores();


  if (
    esProfesor &&
    !tieneGestion
  ) {
    iniciarMiPerfilDocente();

    return;
  }


  if (tieneGestion) {
    iniciarGestionProfesores();

    return;
  }


  const vista =
    document.getElementById(
      'profesoresVista',
    );

  if (vista) {
    vista.innerHTML = `
      <div
        class="profesores-message"
      >
        No tiene acceso al módulo
        de profesores.
      </div>
    `;
  }
}

export function destruirProfesoresPage() {
  instanciaActual += 1;
  gestionDetalleProfesores.destruir();
  listadoProfesores.destruir();
  autogestionProfesores.destruir();
  if (typeof document !== 'undefined') {
    document.getElementById('profesorRevisionDialog')?.close?.();
    document.getElementById('profesorExpedienteDialog')?.close?.();
  }
}
