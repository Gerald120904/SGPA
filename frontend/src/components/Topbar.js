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

  const carreras = usuario?.rolActivo === 'ASISTENTE_ESTUDIANTIL'
    ? (usuario.carrerasDisponibles || []).filter((c) => c.permisos?.length) : [];


  return `
    <header class="topbar">

      <!-- =============================================== -->
      <!-- SISTEMA -->
      <!-- =============================================== -->

      <div class="topbar-heading">

        <h1 class="topbar-system-title">
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
        ${carreras.length > 1 ? `<label>Carrera activa
          <select id="carreraActivaSelector" aria-label="Carrera activa">
            ${carreras.map((c) => `<option value="${Number(c.id)}" ${Number(c.id) === Number(usuario.carreraActiva) ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
          </select></label>` : ''}

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
