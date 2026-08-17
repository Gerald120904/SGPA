export function ModulePlaceholder(
  titulo
) {

  return `
    <div class="module-placeholder">

      <div class="placeholder-icon">

        <i
          data-lucide="construction"
          aria-hidden="true"
        ></i>

      </div>


      <h2>
        ${titulo}
      </h2>


      <p>
        La interfaz de este módulo se implementará
        en la siguiente etapa de desarrollo.
      </p>

    </div>
  `;

}