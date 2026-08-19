import {
  MODULES
} from '../../config/modules.js';

import {
  puedeAcceder
} from '../../config/permissions.js';

import {
  obtenerUsuario,
  obtenerRolUsuario
} from '../../app/session.js';

import {
  ModuleCard
} from '../../components/ModuleCard.js';


/* =========================================================
   PANEL DE MÓDULOS
   =========================================================
   Esta página corresponde a la opción "Dashboard"
   del menú lateral.

   NO contiene estadísticas.
   NO utiliza DASHBOARD_MOCK.

   Su única función es mostrar accesos grandes
   a los distintos módulos del SGPA.
   ========================================================= */

export function ModulesPage() {

  const usuario =
    obtenerUsuario();


  const rol =
    obtenerRolUsuario(
      usuario
    );


  /* =======================================================
     MÓDULOS DISPONIBLES
     =======================================================

     Se excluyen:

     - home
       Porque es la página estadística inicial.

     - dashboard
       Porque esta misma página representa Dashboard.
     ======================================================= */

  const modulosDisponibles =
    MODULES.filter(
      (module) => {

        return (
          module.id !== 'home' &&
          module.id !== 'dashboard' &&
          puedeAcceder(
            rol,
            module.id
          )
        );

      }
    );


  /* =======================================================
     GENERAR CARDS
     ======================================================= */

  const cards =
    modulosDisponibles
      .map(
        (module) => {

          return ModuleCard({

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


  /* =======================================================
     RENDER
     ======================================================= */

  return `
    <section class="modules-dashboard">

      <!-- =============================================== -->
      <!-- ENCABEZADO -->
      <!-- =============================================== -->

      <header class="modules-dashboard-header">

        <div>

          <span class="modules-dashboard-label">
            Panel de módulos
          </span>

          <h2>
            Módulos del sistema
          </h2>

          <p>
            Seleccione el módulo del SGPA
            al que desea ingresar.
          </p>

        </div>

      </header>


      <!-- =============================================== -->
      <!-- GRID -->
      <!-- =============================================== -->

      <div class="modules-dashboard-grid">

        ${cards}

      </div>

    </section>
  `;

}