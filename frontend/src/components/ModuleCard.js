import {
  escapeHtml
} from '../utils/html.js';


export function ModuleCard({
  route,
  icon,
  title,
  description
}) {

  return `
    <button
      class="module-card"
      data-route="${route}"
      type="button"
      title="Abrir ${escapeHtml(title)}"
    >

      <!-- =============================================== -->
      <!-- ACENTO ROJO UNA -->
      <!-- =============================================== -->

      <span
        class="module-card-accent"
        aria-hidden="true"
      ></span>


      <!-- =============================================== -->
      <!-- ICONO -->
      <!-- =============================================== -->

      <div class="module-card-icon">

        <i
          data-lucide="${icon}"
          aria-hidden="true"
        ></i>

      </div>


      <!-- =============================================== -->
      <!-- INFORMACIÓN -->
      <!-- =============================================== -->

      <div class="module-card-content">

        <strong>
          ${escapeHtml(title)}
        </strong>

        <p>
          ${escapeHtml(description)}
        </p>

      </div>


      <!-- =============================================== -->
      <!-- ACCIÓN -->
      <!-- =============================================== -->

      <div class="module-card-action">

        <span>
          Ingresar
        </span>

        <i
          data-lucide="chevron-right"
          aria-hidden="true"
        ></i>

      </div>

    </button>
  `;

}