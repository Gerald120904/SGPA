import {
  escapeHtml
} from '../utils/html.js';

import {
  renderizarIconos
} from '../utils/icons.js';


let timerAlerta = null;


/* =========================================================
   OBTENER / CREAR DIALOG
   ========================================================= */

function obtenerAlertDialog() {

  let dialog =
    document.getElementById(
      'sgpaAlertDialog'
    );


  if (dialog) {
    return dialog;
  }


  dialog =
    document.createElement(
      'dialog'
    );


  dialog.id =
    'sgpaAlertDialog';


  dialog.className =
    'sgpa-alert-dialog';


  document.body.appendChild(
    dialog
  );


  /* =======================================================
     CLICK FUERA
     ======================================================= */

  dialog.addEventListener(
    'click',
    (event) => {

      const rect =
        dialog.getBoundingClientRect();


      const clickFuera =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;


      if (clickFuera) {

        cerrarAlerta(
          dialog
        );

      }

    }
  );


  /* =======================================================
     ESC
     ======================================================= */

  dialog.addEventListener(
    'cancel',
    (event) => {

      event.preventDefault();


      cerrarAlerta(
        dialog
      );

    }
  );


  return dialog;

}


/* =========================================================
   CERRAR ALERTA
   ========================================================= */

function cerrarAlerta(
  dialog
) {

  if (!dialog?.open) {
    return;
  }


  if (timerAlerta) {

    window.clearTimeout(
      timerAlerta
    );


    timerAlerta =
      null;

  }


  dialog.classList.add(
    'sgpa-alert-closing'
  );


  window.setTimeout(
    () => {

      if (dialog.open) {

        dialog.close();

      }


      dialog.classList.remove(
        'sgpa-alert-closing'
      );

    },
    160
  );

}


/* =========================================================
   MOSTRAR ALERTA
   ========================================================= */

function mostrarAlerta({

  tipo,

  titulo,

  mensaje,

  textoBoton = 'Entendido',

  duracion = 0

}) {

  const dialog =
    obtenerAlertDialog();


  /*
   * Si había otra alerta visible,
   * se reemplaza.
   */

  if (dialog.open) {

    dialog.close();

  }


  if (timerAlerta) {

    window.clearTimeout(
      timerAlerta
    );


    timerAlerta =
      null;

  }


  const esExito =
    tipo === 'success';


  const icono =
    esExito
      ? 'check'
      : 'triangle-alert';


  const etiqueta =
    esExito
      ? 'Operación completada'
      : 'Atención';


  dialog.innerHTML = `
    <article
      class="
        sgpa-alert
        ${
          esExito
            ? 'sgpa-alert-success'
            : 'sgpa-alert-error'
        }
      "
    >

      <!-- =============================================== -->
      <!-- ICONO -->
      <!-- =============================================== -->

      <div class="sgpa-alert-icon-area">

        <div
          class="sgpa-alert-icon-ring"
          aria-hidden="true"
        >

          <i
            data-lucide="${icono}"
            aria-hidden="true"
          ></i>

        </div>

      </div>


      <!-- =============================================== -->
      <!-- CONTENIDO -->
      <!-- =============================================== -->

      <div class="sgpa-alert-content">

        <span class="sgpa-alert-eyebrow">
          ${escapeHtml(etiqueta)}
        </span>


        <h3>
          ${escapeHtml(titulo)}
        </h3>


        ${
          mensaje
            ? `
                <p>
                  ${escapeHtml(mensaje)}
                </p>
              `
            : ''
        }

      </div>


      <!-- =============================================== -->
      <!-- ACCIÓN -->
      <!-- =============================================== -->

      <div class="sgpa-alert-actions">

        <button
          id="sgpaAlertAccept"
          class="sgpa-alert-button"
          type="button"
        >
          ${escapeHtml(textoBoton)}
        </button>

      </div>


      ${
        esExito && duracion > 0
          ? `
              <div
                class="sgpa-alert-progress"
                aria-hidden="true"
              >
                <span
                  style="
                    --sgpa-alert-duration:
                    ${duracion}ms;
                  "
                ></span>
              </div>
            `
          : ''
      }

    </article>
  `;


  renderizarIconos();


  dialog.showModal();


  document
    .getElementById(
      'sgpaAlertAccept'
    )
    ?.addEventListener(
      'click',
      () => {

        cerrarAlerta(
          dialog
        );

      }
    );


  /*
   * Success se cierra automáticamente.
   *
   * Los errores permanecen visibles hasta
   * que el usuario los cierre.
   */

  if (
    esExito &&
    duracion > 0
  ) {

    timerAlerta =
      window.setTimeout(
        () => {

          cerrarAlerta(
            dialog
          );

        },
        duracion
      );

  }

}


/* =========================================================
   SUCCESS
   ========================================================= */

export function mostrarExito({

  titulo =
    'Operación realizada',

  mensaje =
    '',

  textoBoton =
    'Continuar',

  duracion =
    2600

} = {}) {

  mostrarAlerta({

    tipo:
      'success',

    titulo,

    mensaje,

    textoBoton,

    duracion

  });

}


/* =========================================================
   ERROR
   ========================================================= */

export function mostrarError({

  titulo =
    'No fue posible completar la operación',

  mensaje =
    'Ocurrió un error inesperado.',

  textoBoton =
    'Entendido'

} = {}) {

  mostrarAlerta({

    tipo:
      'error',

    titulo,

    mensaje,

    textoBoton,

    duracion:
      0

  });

}