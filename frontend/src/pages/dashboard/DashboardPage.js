import {
  StatCard
} from '../../components/StatCard.js';

import {
  QuickAccessCard
} from '../../components/QuickAccessCard.js';

import {
  obtenerUsuario,
  obtenerRolUsuario,
  formatearRol
} from '../../app/session.js';

import {
  escapeHtml
} from '../../utils/html.js';


export function DashboardPage() {

  const usuario =
    obtenerUsuario();


  const rol =
    obtenerRolUsuario(
      usuario
    );


  const nombre =
    usuario?.nombres ||
    'Administrador';


  return `
    <section class="module-view">

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
                formatearRol(rol)
              )}
            </strong>

          </div>

        </div>

      </div>


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


      <section class="dashboard-section">

        <div class="section-heading">

          <div>

            <h3>
              Accesos rápidos
            </h3>

            <p>
              Ingrese rápidamente a los principales módulos.
            </p>

          </div>

        </div>


        <div class="quick-grid">

          ${QuickAccessCard({
            route:
              '/estudiantes',
            icon:
              'graduation-cap',
            title:
              'Estudiantes',
            description:
              'Gestión y avance curricular'
          })}


          ${QuickAccessCard({
            route:
              '/cursos',
            icon:
              'book-open',
            title:
              'Cursos',
            description:
              'Malla y requisitos'
          })}


          ${QuickAccessCard({
            route:
              '/profesores',
            icon:
              'briefcase',
            title:
              'Profesores',
            description:
              'Docentes y disponibilidad'
          })}


          ${QuickAccessCard({
            route:
              '/proyeccion',
            icon:
              'line-chart',
            title:
              'Proyección',
            description:
              'Demanda y planificación'
          })}

        </div>

      </section>

    </section>
  `;

}