import { renderizarIconos } from '../../utils/icons.js';

export function crearPaginaGestionProfesores({
  puedeGestionarProfesores,
  crearNuevaInstancia,
  renderizarSelectorModo,
  habilitarSelectorModo,
  renderizarProfesores,
  cargarProfesores,
  abrirProfesor,
}) {
function iniciarGestionProfesores() {
  if (
    !puedeGestionarProfesores()
  ) {
    return;
  }

  const pagina =
    document.getElementById(
      'profesoresPage',
    );


  if (!pagina) {
    return;
  }


  const instancia = crearNuevaInstancia();


  const vista =
    document.getElementById(
      'profesoresVista',
    );


  if (!vista) {
    return;
  }


  vista.innerHTML = `

    ${renderizarSelectorModo(
      'gestion',
    )}

    <div
      class="profesores-toolbar"
    >

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

      <div
        class="profesores-message"
      >
        Cargando profesores...
      </div>

    </div>

  `;


  habilitarSelectorModo();


  document
    .getElementById(
      'profesoresBuscar',
    )
    ?.addEventListener(
      'input',
      renderizarProfesores,
    );


  document
    .getElementById(
      'profesoresContent',
    )
    ?.addEventListener(
      'click',
      async (event) => {

        const boton =
          event.target.closest(
            '[data-action="ver"]',
          );


        if (!boton) {
          return;
        }


        const profesorId =
          Number(
            boton.dataset
              .profesorId,
          );


        if (!profesorId) {
          return;
        }


        await abrirProfesor(
          profesorId,
        );

      },
    );


  renderizarIconos();


  cargarProfesores(
    instancia,
  );
}


/* =========================================================
   AUTOGESTIÓN: MI PERFIL DOCENTE
   ========================================================= */

  return { iniciarGestionProfesores };
}
