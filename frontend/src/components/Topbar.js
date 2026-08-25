import {
  escapeHtml
} from '../utils/html.js';


export function Topbar({
  usuario
}) {

  const nombre =
    usuario?.nombres ||
    'Usuario';


  const inicial =
    nombre
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'A';


  return `
    <header class="topbar">

      <!-- =============================================== -->
      <!-- PÁGINA ACTUAL -->
      <!-- =============================================== -->

      <div class="topbar-heading">

        <h1 id="pageTitle">
          Sistema de Gestión y Proyección Académica
        </h1>

        <p class="topbar-subtitle">
          Campus Nicoya
        </p>

      </div>


      <!-- =============================================== -->
      <!-- USUARIO -->
      <!-- =============================================== -->

      <div class="topbar-user">

        <div class="topbar-user-text">

          <strong>
            ${escapeHtml(nombre)}
          </strong>

          <span>
            Campus Nicoya
          </span>

        </div>


        <div class="topbar-avatar">
          ${escapeHtml(inicial)}
        </div>

      </div>

    </header>
  `;

}
