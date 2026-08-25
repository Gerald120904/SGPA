import {
  escapeHtml
} from '../utils/html.js';


export function ModuleCard({
  module
}) {

  const title =
    module.navLabel ||
    module.title ||
    'Módulo';


  const description =
    module.description ||
    'Gestión del módulo';


  const icon =
    module.icon ||
    'circle';


  return `
    <button
      class="module-card"
      data-route="${module.route}"
      data-module="${module.id}"
      type="button"
      aria-label="Abrir ${escapeHtml(title)}"
    >

      <!-- ============================================= -->
      <!-- DECORACIÓN -->
      <!-- ============================================= -->

      <span
        class="module-card-decoration"
        aria-hidden="true"
      ></span>


      <!-- ============================================= -->
      <!-- PARTE SUPERIOR -->
      <!-- ============================================= -->

      <div class="module-card-top">

        <div class="module-card-icon">

          <i
            data-lucide="${icon}"
            aria-hidden="true"
          ></i>

        </div>



      </div>


      <!-- ============================================= -->
      <!-- INFORMACIÓN -->
      <!-- ============================================= -->

      <div class="module-card-content">

        <strong>
          ${escapeHtml(title)}
        </strong>

        <p>
          ${escapeHtml(description)}
        </p>

      </div>


      <!-- ============================================= -->
      <!-- ACCIÓN -->
      <!-- ============================================= -->

      <div class="module-card-action">

        <span>
          Abrir módulo
        </span>

        <i
          data-lucide="chevron-right"
          aria-hidden="true"
        ></i>

      </div>


      <!-- ============================================= -->
      <!-- LÍNEA HOVER -->
      <!-- ============================================= -->

      <span
        class="module-card-hover-line"
        aria-hidden="true"
      ></span>

    </button>
  `;

}