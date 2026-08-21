import {
  StatCard
} from '../../components/StatCard.js';

import {
  QuickAccessCard
} from '../../components/QuickAccessCard.js';

import {
  MODULES
} from '../../config/modules.js';

import {
  puedeAcceder
} from '../../config/permissions.js';

import {
  obtenerUsuario,
  obtenerRolesUsuario,
  obtenerRolPrincipal,
  formatearRol
} from '../../app/session.js';

import {
  escapeHtml
} from '../../utils/html.js';


export function DashboardPage() {

  const usuario =
    obtenerUsuario();


  const roles =
    obtenerRolesUsuario(
      usuario
    );


  const rolPrincipal =
    obtenerRolPrincipal(
      usuario
    );


  const nombre =
    usuario?.nombres ||
    'Usuario';


  /*
   * Todos los módulos disponibles
   * excepto Dashboard.
   */

  const accesosRapidos =
    MODULES.filter(
      (module) => {

        return (
          module.id !== 'dashboard' &&
          puedeAcceder(
            roles,
            module.id
          )
        );

      }
    );


  const cardsAcceso =
    accesosRapidos
      .map(
        (module) => {

          return QuickAccessCard({

            route:
              module.route,

            icon:
              module.icon,

            title:
              module.title,

            description:
              module.description

          });

        }
      )
      .join('');


  return `
    <section class="module-view">

      <!-- =============================================== -->
      <!-- BIENVENIDA -->
      <!-- =============================================== -->

      <div class="dashboard-welcome">

        <div>

          <span class="welcome-label">
            Panel administrativo
          </span>

          <h2>
            Bienvenido,
            ${escapeHtml(nombre)}
          </h2>

          <p>
            Gestione la información académica y consulte
            el estado general del sistema.
          </p>

        </div>


        <div class="welcome-badge">

          <i
            data-lucide="shield-check"
            aria-hidden="true"
          ></i>


          <div>

            <span>
              Perfil activo
            </span>

            <strong>
              ${escapeHtml(
                formatearRol(
                  rolPrincipal
                )
              )}
            </strong>

          </div>

        </div>

      </div>


      <!-- =============================================== -->
      <!-- INDICADORES -->
      <!-- =============================================== -->

      <div class="dashboard-stats">

        ${StatCard({
          icon:
            'graduation-cap',
          title:
            'Estudiantes',
          description:
            'Registrados'
        })}


        ${StatCard({
          icon:
            'book-open',
          title:
            'Cursos',
          description:
            'En el sistema'
        })}


        ${StatCard({
          icon:
            'briefcase',
          title:
            'Profesores',
          description:
            'Registrados'
        })}


        ${StatCard({
          icon:
            'door-open',
          title:
            'Aulas',
          description:
            'Disponibles'
        })}

      </div>


      <!-- =============================================== -->
      <!-- ACCESOS RÁPIDOS -->
      <!-- =============================================== -->

      <section class="dashboard-section">

        <div class="section-heading">

          <div>

            <h3>
              Accesos rápidos
            </h3>

            <p>
              Ingrese rápidamente a los módulos
              disponibles del sistema.
            </p>

          </div>

        </div>


        <div class="quick-grid">

          ${cardsAcceso}

        </div>

      </section>

    </section>
  `;

}
