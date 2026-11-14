import {
  listarProfesores,
} from '../../services/profesores.service.js';
import {
  DataTable,
} from '../../components/DataTable.js';
import {
  escapeHtml,
} from '../../utils/html.js';
import {
  renderizarIconos,
} from '../../utils/icons.js';
import {
  obtenerNombreCompleto,
  obtenerCarreras,
  obtenerPerfiles,
  obtenerCursos,
} from './profesores.helpers.js';

export function crearListadoProfesores({ esInstanciaActual }) {
  let profesores = [];

function renderizarProfesores() {
  const contenido =
    document.getElementById(
      'profesoresContent',
    );

  if (!contenido) {
    return;
  }


  const termino =
    document
      .getElementById(
        'profesoresBuscar',
      )
      ?.value
      ?.trim()
      .toLowerCase() || '';


  const filtrados =
    profesores.filter(
      (profesor) => {

        const carreras =
          obtenerCarreras(
            profesor,
          );

        const texto = [
          profesor.cedula,
          obtenerNombreCompleto(
            profesor,
          ),
          profesor.correo,
          ...carreras.map(
            (carrera) =>
              `${carrera.codigo} ${carrera.nombre}`,
          ),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();


        return texto.includes(
          termino,
        );

      },
    );


  const filas =
    filtrados
      .map(
        (profesor) => {

          const carreras =
            obtenerCarreras(
              profesor,
            );

          const perfiles =
            obtenerPerfiles(
              profesor,
            );

          const cursos =
            obtenerCursos(
              profesor,
            );


          const perfilesAprobados =
            perfiles.filter(
              (perfil) =>
                perfil.estado ===
                'APROBADO',
            ).length;


          return `
            <tr>

              <td>
                ${escapeHtml(
                  profesor.cedula,
                )}
              </td>


              <td>

                <div
                  class="profesores-person"
                >

                  <strong>
                    ${escapeHtml(
                      obtenerNombreCompleto(
                        profesor,
                      ),
                    )}
                  </strong>

                  <small>
                    ${escapeHtml(
                      profesor.correo,
                    )}
                  </small>

                </div>

              </td>


              <td>

                ${
                  carreras.length
                    ? `
                      <div
                        class="profesores-badges"
                      >
                        ${carreras
                          .map(
                            (carrera) => `
                              <span
                                class="profesores-badge"
                                title="${escapeHtml(
                                  carrera.nombre,
                                )}"
                              >
                                ${escapeHtml(
                                  carrera.codigo,
                                )}
                              </span>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                    : `
                      <span
                        class="profesores-muted"
                      >
                        Sin carreras
                      </span>
                    `
                }

              </td>


              <td>
                ${perfilesAprobados}
              </td>


              <td>
                ${cursos.length}
              </td>


              <td>

                <span
                  class="
                    profesores-status
                    ${
                      profesor.activo
                        ? 'is-active'
                        : 'is-inactive'
                    }
                  "
                >
                  ${
                    profesor.activo
                      ? 'Activo'
                      : 'Inactivo'
                  }
                </span>

              </td>


              <td>

                <button
                  class="profesores-icon-button"
                  type="button"
                  data-action="ver"
                  data-profesor-id="${profesor.id}"
                  title="Ver profesor"
                  aria-label="Ver profesor"
                >

                  <i
                    data-lucide="eye"
                    aria-hidden="true"
                  ></i>

                </button>

              </td>

            </tr>
          `;

        },
      )
      .join('');


  contenido.innerHTML =
    DataTable({

      columns: [
        'Cédula',
        'Profesor',
        'Carreras',
        'Perfiles',
        'Cursos',
        'Estado',
        'Acciones',
      ],

      rows:
        filas,

      emptyMessage:
        termino
          ? 'No hay profesores que coincidan con la búsqueda.'
          : 'No hay profesores registrados.',

      ariaLabel:
        'Listado de profesores',

    });


  renderizarIconos();
}


/* =========================================================
   DISPONIBILIDAD DOCENTE (CONSULTA GESTIÓN)
   ========================================================= */

async function cargarProfesores(
  instancia,
) {
  const contenido =
    document.getElementById(
      'profesoresContent',
    );


  if (!contenido) {
    return;
  }


  try {

    const resultado =
      await listarProfesores();


    if (
      !esInstanciaActual(instancia)
    ) {
      return;
    }


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar los profesores.',
      );
    }


    profesores =
      Array.isArray(
        resultado.profesores,
      )
        ? resultado.profesores
        : [];


    renderizarProfesores();

  } catch (error) {

    if (!esInstanciaActual(instancia)) {
      return;
    }

    contenido.innerHTML = `
      <div
        class="
          profesores-message
          profesores-error
        "
      >
        ${escapeHtml(
          error?.message ||
            'No fue posible cargar los profesores.',
        )}
      </div>
    `;

  }
}


/* =========================================================
   GESTIÓN ADMINISTRATIVA
   ========================================================= */

  return {
    renderizarProfesores,
    cargarProfesores,
    destruir() {
      profesores = [];
    },
  };
}
