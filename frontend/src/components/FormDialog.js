import {
  escapeHtml
} from '../utils/html.js';


/* =========================================================
   LISTENERS DE CIERRE EXTERIOR
   ========================================================= */

const dialogOutsideHandlers =
  new WeakMap();


/* =========================================================
   CERRAR AL HACER CLICK FUERA
   ========================================================= */

export function habilitarCierreExterior(
  dialog
) {

  if (!dialog) {
    return;
  }


  if (
    dialogOutsideHandlers.has(
      dialog
    )
  ) {
    return;
  }


  const handler =
    (event) => {

      if (!dialog.open) {
        return;
      }


      /*
       * Solo cerramos automáticamente cuando
       * el contenido actual utiliza FormDialog.
       *
       * Esto permite que Importar Excel siga
       * funcionando con su estructura antigua.
       */

      const formulario =
        dialog.querySelector(
          '.sgpa-form'
        );


      if (!formulario) {
        return;
      }


      const path =
        typeof event.composedPath ===
        'function'
          ? event.composedPath()
          : [];


      const clickDentro =
        path.includes(
          formulario
        );


      if (clickDentro) {
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

  errorId = '',

  cancelButtonId = '',

  submitButtonId = '',

  cancelText = 'Cancelar',

  submitText = 'Guardar',

  submitIcon = 'save',

  submitButtonType = 'submit',

  layout = 'grid',

  bodyClass = '',

  formClass = '',

  footerHtml = '',

  showFooter = true

}) {

  /* =======================================================
     CONTENEDOR DEL BODY
     ======================================================= */

  const bodyContainerClass =
    layout === 'custom'
      ? `
          sgpa-form-body
          ${bodyClass}
        `
      : `
          sgpa-form-grid
          ${bodyClass}
        `;


  /* =======================================================
     ERROR
     ======================================================= */

  const errorHtml =
    errorId
      ? `
          <div
            id="${escapeHtml(errorId)}"
            class="sgpa-form-error hidden"
            role="alert"
            aria-live="polite"
          ></div>
        `
      : '';


  /* =======================================================
     BOTÓN CANCELAR
     ======================================================= */

  const cancelButton =
    cancelButtonId
      ? `
          <button
            id="${escapeHtml(cancelButtonId)}"
            class="sgpa-form-secondary"
            type="button"
          >
            ${escapeHtml(cancelText)}
          </button>
        `
      : '';


  /* =======================================================
     BOTÓN PRINCIPAL
     ======================================================= */

  const submitButton =
    submitButtonId
      ? `
          <button
            id="${escapeHtml(submitButtonId)}"
            class="sgpa-form-primary"
            type="${escapeHtml(submitButtonType)}"
          >

            ${
              submitIcon
                ? `
                    <i
                      data-lucide="${escapeHtml(submitIcon)}"
                      aria-hidden="true"
                    ></i>
                  `
                : ''
            }

            <span>
              ${escapeHtml(submitText)}
            </span>

          </button>
        `
      : '';


  /* =======================================================
     FOOTER
     ======================================================= */

  let footer = '';


  if (showFooter) {

    footer = `
      <footer class="sgpa-form-footer">

        ${
          footerHtml
            ? footerHtml
            : `
                ${cancelButton}
                ${submitButton}
              `
        }

      </footer>
    `;

  }


  /* =======================================================
     RENDER
     ======================================================= */

  return `
    <form
      id="${escapeHtml(formId)}"
      class="
        sgpa-form
        ${escapeHtml(formClass)}
      "
    >

      <!-- =============================================== -->
      <!-- ACENTO UNA -->
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
        >

      </div>


      <!-- =============================================== -->
      <!-- HEADER -->
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
      <!-- CONTENIDO -->
      <!-- =============================================== -->

      <div class="sgpa-form-scroll">

        ${errorHtml}


        <div
          class="${bodyContainerClass}"
        >

          ${body}

        </div>

      </div>


      <!-- =============================================== -->
      <!-- FOOTER -->
      <!-- =============================================== -->

      ${footer}

    </form>
  `;

}