import {
  listarUsuarios
} from '../../services/usuarios.service.js';

import {
  escapeHtml
} from '../../utils/html.js';


export function UsuariosPage() {

  return `
    <section class="module-view">

      <div class="section-heading usuarios-heading">

        <div>

          <h2>
            Usuarios
          </h2>

          <p>
            Consulte las cuentas y roles registrados en el SGPA.
          </p>

        </div>

      </div>


      <div
        id="usuariosContent"
        class="usuarios-content"
        aria-live="polite"
      >

        <div class="usuarios-message">
          Cargando usuarios...
        </div>

      </div>

    </section>
  `;

}


export async function iniciarUsuariosPage() {

  const contenedor =
    document.getElementById(
      'usuariosContent'
    );


  if (!contenedor) {
    return;
  }


  try {

    const resultado =
      await listarUsuarios();


    if (!resultado?.ok) {

      throw new Error(
        resultado?.message ||
        'No fue posible consultar los usuarios.'
      );

    }


    if (
      document.getElementById(
        'usuariosContent'
      ) !== contenedor
    ) {
      return;
    }


    const usuarios =
      Array.isArray(
        resultado.usuarios
      )
        ? resultado.usuarios
        : [];


    const filas =
      usuarios.length > 0
        ? usuarios
          .map(
            (usuario) => {

              const nombreCompleto = [
                usuario.nombres,
                usuario.apellido1,
                usuario.apellido2
              ]
                .filter(Boolean)
                .join(' ');


              const roles =
                Array.isArray(
                  usuario.roles
                ) &&
                usuario.roles.length > 0
                  ? usuario.roles
                    .join(', ')
                  : 'Sin rol asignado';


              return `
                <tr>

                  <td>
                    ${escapeHtml(
                      usuario.cedula
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      nombreCompleto
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      usuario.correo
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      roles
                    )}
                  </td>

                  <td>

                    <span class="usuarios-status ${
                      usuario.activo
                        ? 'is-active'
                        : 'is-inactive'
                    }">
                      ${
                        usuario.activo
                          ? 'Activo'
                          : 'Inactivo'
                      }
                    </span>

                  </td>

                </tr>
              `;

            }
          )
          .join('')
        : `
          <tr>
            <td
              class="usuarios-empty"
              colspan="5"
            >
              No hay usuarios registrados.
            </td>
          </tr>
        `;


    contenedor.innerHTML = `
      <div class="usuarios-table-wrap">

        <table class="usuarios-table">

          <thead>

            <tr>
              <th>Cédula</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Roles</th>
              <th>Estado</th>
            </tr>

          </thead>

          <tbody>
            ${filas}
          </tbody>

        </table>

      </div>
    `;

  } catch (error) {

    console.error(
      'Error cargando usuarios:',
      error
    );


    if (
      document.getElementById(
        'usuariosContent'
      ) !== contenedor
    ) {
      return;
    }


    contenedor.innerHTML = `
      <div
        class="usuarios-message usuarios-error"
        role="alert"
      >
        <h2>
          Error de conexión
        </h2>

        <p>
          ${escapeHtml(
            error?.message ||
            'No fue posible consultar los usuarios.'
          )}
        </p>
      </div>
    `;

  }

}
