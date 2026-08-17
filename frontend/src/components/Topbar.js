import {
  escapeHtml
} from '../utils/html.js';


export function Topbar({
  usuario
}) {

  const nombre =
    usuario?.nombres ||
    'Administrador';


  const inicial =
    nombre
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'A';


  return `
    <header class="topbar">

      <div>

        <p class="topbar-kicker">
          Sistema de Gestión y Proyección Académica
        </p>

        <h1 id="pageTitle">
          Dashboard
        </h1>

      </div>


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