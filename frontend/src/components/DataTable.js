import {
  escapeHtml
} from '../utils/html.js';


/* =========================================================
   NORMALIZAR COLUMNA
   ========================================================= */

function normalizarColumna(
  column
) {

  if (
    typeof column === 'string'
  ) {

    return {
      label:
        column,

      className:
        ''
    };

  }


  return {

    label:
      column?.label ||
      '',

    className:
      column?.className ||
      ''

  };

}


/* =========================================================
   DATA TABLE
   ========================================================= */

export function DataTable({

  columns = [],

  rows = '',

  emptyMessage =
    'No hay datos para mostrar.',

  ariaLabel =
    'Tabla de datos'

}) {

  const columnas =
    columns.map(
      normalizarColumna
    );


  const tieneFilas =
    typeof rows === 'string' &&
    rows.trim().length > 0;


  /* =======================================================
     SIN REGISTROS
     ======================================================= */

  if (!tieneFilas) {

    return `
      <div
        class="sgpa-table-empty"
        role="status"
      >

        <div class="sgpa-table-empty-icon">

          <i
            data-lucide="database"
            aria-hidden="true"
          ></i>

        </div>


        <strong>
          Sin registros
        </strong>


        <span>
          ${escapeHtml(
            emptyMessage
          )}
        </span>

      </div>
    `;

  }


  /* =======================================================
     ENCABEZADOS
     ======================================================= */

  const headers =
    columnas
      .map(
        (column) => `
          <th
            class="${escapeHtml(
              column.className
            )}"
            scope="col"
          >

            ${escapeHtml(
              column.label
            )}

          </th>
        `
      )
      .join('');


  /* =======================================================
     TABLA
     ======================================================= */

  return `
    <div class="sgpa-table-shell">

      <div class="sgpa-table-scroll">

        <table
          class="sgpa-data-table"
          aria-label="${escapeHtml(
            ariaLabel
          )}"
        >

          <thead>

            <tr>
              ${headers}
            </tr>

          </thead>


          <tbody>

            ${rows}

          </tbody>

        </table>

      </div>

    </div>
  `;

}