import {
  MODULES
} from '../../config/modules.js';

import {
  puedeAcceder
} from '../../config/permissions.js';

import {
  obtenerUsuario,
  obtenerRolesEfectivos,
  obtenerPermisosUsuario,
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
    obtenerRolesEfectivos(
      usuario
    );

  const permisos =
    obtenerPermisosUsuario(
      usuario,
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
            module.id,
            permisos,
          )
        );

      }
    );


  /* =======================================================
     GENERAR CARDS O ESTADO VACÍO
     ======================================================= */

  const contenido = modulosDisponibles.length > 0
    ? `
      <div class="modules-dashboard-grid system-modules-grid">
        ${modulosDisponibles.map((module) => ModuleCard({ module })).join('')}
      </div>
    `
    : `
      <div class="modules-dashboard-empty" role="status">
        <i data-lucide="circle-alert" class="empty-icon" aria-hidden="true"></i>
        <h3>Sin módulos asignados</h3>
        <p>No tiene módulos asignados para su rol actual.</p>
        <small>Si considera que esto es un error, contacte a la administración del sistema.</small>
      </div>
    `;


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
      <!-- CONTENIDO DE MÓDULOS -->
      <!-- =============================================== -->

      ${contenido}

    </section>
  `;

}
