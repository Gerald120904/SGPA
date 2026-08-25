import {
  MODULES
} from '../../config/modules.js';

import {
  puedeAcceder
} from '../../config/permissions.js';

import {
  obtenerUsuario,
  obtenerRolesUsuario
} from '../../app/session.js';

import {
  ModuleCard
} from '../../components/ModuleCard.js';


/* =========================================================
   PANEL DE GESTIÓN
   =========================================================
   Esta página corresponde a la opción
   "Panel de gestión" del menú lateral.

   Su función es mostrar accesos visuales
   a los distintos módulos disponibles
   según los permisos del usuario.
   ========================================================= */

export function ModulesPage() {

  const usuario =
    obtenerUsuario();


  const roles =
    obtenerRolesUsuario(
      usuario
    );


  /* =======================================================
     MÓDULOS DISPONIBLES
     =======================================================

     Se excluyen:

     - home
       Corresponde al Dashboard principal.

     - dashboard
       Corresponde a esta misma pantalla.
     ======================================================= */

  const modulosDisponibles =
    MODULES.filter(
      (module) => {

        return (
          module.id !== 'home' &&
          module.id !== 'dashboard' &&
          puedeAcceder(
            roles,
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
            module
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
            Panel de gestión
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
      <!-- GRID DE MÓDULOS -->
      <!-- =============================================== -->

      <div class="modules-dashboard-grid">

        ${cards}

      </div>

    </section>
  `;

}