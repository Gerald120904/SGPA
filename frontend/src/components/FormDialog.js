import {
  escapeHtml
} from '../utils/html.js';


/* =========================================================
   MANEJO DEL CIERRE EXTERIOR
   =========================================================
   Guarda el listener asociado a cada dialog para evitar
   registrar múltiples eventos cada vez que se abre.
   ========================================================= */

const dialogOutsideHandlers =
  new WeakMap();


/* =========================================================
   HABILITAR CIERRE AL HACER CLICK FUERA
   ========================================================= */

export function habilitarCierreExterior(
  dialog
) {

  if (!dialog) {
    return;
  }


  /*
   * Si el dialog ya tenía un listener anterior,
   * se elimina antes de registrar uno nuevo.
   */

  const handlerAnterior =
    dialogOutsideHandlers.get(
      dialog
    );


  if (handlerAnterior) {

    dialog.removeEventListener(
      'click',
      handlerAnterior
    );

  }


  const handler =
    (event) => {

      /*
       * Obtiene las dimensiones reales
       * del cuadro de diálogo.
       */

      const rect =
        dialog.getBoundingClientRect();


      /*
       * Comprobamos si las coordenadas
       * del click están fuera del formulario.
       */

      const clickFuera =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;


      if (!clickFuera) {
        return;
      }


      dialog.close();

    };


  dialog.addEventListener(
    'click',
    handler
  );


  dialogOutsideHandlers.set(
    dialog,
    handler
  );

}


/* =========================================================
   FORM DIALOG
   ========================================================= */

export function FormDialog({

  formId,

  title,

  description = '',

  body = '',

  errorId,

  cancelButtonId,

  submitButtonId,

  cancelText = 'Cancelar',

  submitText = 'Guardar',

  submitIcon = 'save'

}) {

  return `
    <form
      id="${escapeHtml(formId)}"
      class="sgpa-form"
    >

      <!-- =============================================== -->
      <!-- ACENTO INSTITUCIONAL -->
      <!-- =============================================== -->

      <div
        class="sgpa-form-accent"
        aria-hidden="true"
      ></div>


      <!-- =============================================== -->
      <!-- LOGO UNA -->
      <!-- =============================================== -->

      <div class="sgpa-form-brand">

        <img
          src="/Logo-UNA-Rojo_FondoTransparente.png"
          alt="Universidad Nacional de Costa Rica"
          class="sgpa-form-logo"
          draggable="false"
        />

      </div>


      <!-- =============================================== -->
      <!-- ENCABEZADO -->
      <!-- =============================================== -->

      <header class="sgpa-form-header">

        <div class="sgpa-form-heading">

          <span class="sgpa-form-eyebrow">
            SGPA · Campus Nicoya
          </span>


          <h3>
            ${escapeHtml(title)}
          </h3>


          ${
            description
              ? `
                  <p>
                    ${escapeHtml(description)}
                  </p>
                `
              : ''
          }

        </div>

      </header>


      <!-- =============================================== -->
      <!-- ÁREA CON SCROLL -->
      <!-- =============================================== -->

      <div class="sgpa-form-scroll">

        <!-- ============================================= -->
        <!-- ERROR -->
        <!-- ============================================= -->

        <div
          id="${escapeHtml(errorId)}"
          class="sgpa-form-error hidden"
          role="alert"
          aria-live="polite"
        ></div>


        <!-- ============================================= -->
        <!-- CAMPOS -->
        <!-- ============================================= -->

        <div class="sgpa-form-grid">

          ${body}

        </div>

      </div>


      <!-- =============================================== -->
      <!-- FOOTER -->
      <!-- =============================================== -->

      <footer class="sgpa-form-footer">

        <button
          id="${escapeHtml(cancelButtonId)}"
          class="sgpa-form-secondary"
          type="button"
        >

          ${escapeHtml(cancelText)}

        </button>


        <button
          id="${escapeHtml(submitButtonId)}"
          class="sgpa-form-primary"
          type="submit"
        >

          <i
            data-lucide="${escapeHtml(submitIcon)}"
            aria-hidden="true"
          ></i>


          <span>
            ${escapeHtml(submitText)}
          </span>

        </button>

      </footer>

    </form>
  `;

}