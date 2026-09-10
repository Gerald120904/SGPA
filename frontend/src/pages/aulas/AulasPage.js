import {
  actualizarAula,
  cambiarEstadoAula,
  crearAula,
  listarAulas,
  obtenerAula,

  listarEquipamientos,
  crearEquipamiento,
  actualizarEquipamiento,
  cambiarEstadoEquipamiento,

  listarEquipamientoAula,
  asignarEquipamientoAula,
  actualizarEquipamientoAula,
  cambiarEstadoEquipamientoAula,

  listarIndisponibilidadesAula,
  crearIndisponibilidadAula,
  actualizarIndisponibilidadAula,
  cambiarEstadoIndisponibilidadAula,

  listarReservasAula,
  crearReservaAula,
  actualizarReservaAula,
  cambiarEstadoReservaAula,

  consultarOcupacionAula,

  listarDisponibilidadesAula,
  crearDisponibilidadAula,
  actualizarDisponibilidadAula,
  eliminarDisponibilidadAula,

  buscarAulasDisponibles,
  evaluarAulaParaAsignacion,

  listarAuditoriaAula,
} from '../../services/aulas.service.js';

import {
  listarPeriodosAcademicos,
} from '../../services/periodos.service.js';

import {
  DataTable,
} from '../../components/DataTable.js';

import {
  FormDialog,
  habilitarCierreExterior,
} from '../../components/FormDialog.js';

import {
  mostrarError,
  mostrarExito,
} from '../../components/AlertModal.js';

import {
  confirmarAccion,
} from '../../utils/confirm.js';

import {
  escapeHtml,
} from '../../utils/html.js';

import {
  renderizarIconos,
} from '../../utils/icons.js';

import {
  obtenerRolesUsuario,
} from '../../app/session.js';

import {
  ROLES,
} from '../../config/permissions.js';


let aulas = [];

let catalogoEquipamientos = [];

let equipamientoAulaActual = [];

let indisponibilidadesAulaActual = [];

let reservasAulaActual = [];

let ocupacionAulaActual = null;

let periodosDisponibilidadAula = [];

let periodoDisponibilidadActual = null;

let disponibilidadBaseAulaActual = [];

let periodosBusquedaAulas = [];

let equipamientosBusquedaAulas = [];

let aulasDisponiblesActual = [];

let criteriosBusquedaAulasActual = null;

let auditoriaAulaActual = [];

let aulaDetalleActual = null;

let instanciaActual = 0;


/* =========================================================
   CONSTANTES
   ========================================================= */

const TIPOS_AULA = {
  AULA:
    'Aula',

  LABORATORIO:
    'Laboratorio',

  AUDITORIO:
    'Auditorio',

  SALA:
    'Sala',

  VIRTUAL:
    'Virtual',
};


const TIPOS_MOBILIARIO = {
  PUPITRE:
    'Pupitre',

  MESA_INDIVIDUAL:
    'Mesa individual',

  MESA_GRUPAL:
    'Mesa grupal',

  MESA_COMPUTADORA:
    'Mesa para computadora',

  BUTACA:
    'Butaca',

  SIN_MOBILIARIO:
    'Sin mobiliario',

  SIN_ESPECIFICAR:
    'Sin especificar',
};


const ORIGENES_AULA = {
  UNA:
    'UNA',

  UNED:
    'UNED',

  OTRO:
    'Otro',
};


const DIAS_SEMANA_AULA = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};


/* =========================================================
   PÁGINA
   ========================================================= */

export function AulasPage() {
  return `
    <section
      id="aulasPage"
      class="module-view aulas-page"
    >

      <div
        id="aulasVista"
      ></div>


      <dialog
        id="aulaDialog"
        class="
          sgpa-form-dialog
          sgpa-form-dialog-md
        "
      >
        <div
          id="aulaDialogContent"
        ></div>
      </dialog>

    </section>
  `;
}


/* =========================================================
   PERMISOS
   ========================================================= */

function puedeAdministrarAulas() {
  const roles =
    obtenerRolesUsuario();

  return roles.includes(
    ROLES.ADMIN_GLOBAL,
  );
}


function puedeGestionarIndisponibilidades() {
  const roles =
    obtenerRolesUsuario();

  return (
    roles.includes(
      ROLES.ADMIN_GLOBAL,
    ) ||
    roles.includes(
      ROLES.COORDINADOR,
    )
  );
}


function puedeGestionarReservas() {
  const roles =
    obtenerRolesUsuario();

  return (
    roles.includes(
      ROLES.ADMIN_GLOBAL,
    ) ||
    roles.includes(
      ROLES.COORDINADOR,
    )
  );
}


function puedeGestionarDisponibilidadAula() {
  const roles =
    obtenerRolesUsuario();

  return (
    roles.includes(
      ROLES.ADMIN_GLOBAL,
    ) ||
    roles.includes(
      ROLES.COORDINADOR,
    )
  );
}


function puedeEvaluarAsignacionAula() {
  const roles =
    obtenerRolesUsuario();

  return (
    roles.includes(
      ROLES.ADMIN_GLOBAL,
    ) ||
    roles.includes(
      ROLES.COORDINADOR,
    )
  );
}


function puedeConsultarAuditoriaAula() {
  const roles =
    obtenerRolesUsuario();

  return (
    roles.includes(
      ROLES.ADMIN_GLOBAL,
    ) ||
    roles.includes(
      ROLES.COORDINADOR,
    )
  );
}


function periodoPermiteEditarDisponibilidad(
  periodo,
) {
  return [
    'BORRADOR',
    'EN_PREPARACION',
  ].includes(
    periodo?.estado,
  );
}


/* =========================================================
   FORMATEADORES
   ========================================================= */

function nombreTipoAula(
  tipo,
) {
  return (
    TIPOS_AULA[tipo] ||
    tipo ||
    '—'
  );
}


function nombreMobiliario(
  tipo,
) {
  return (
    TIPOS_MOBILIARIO[tipo] ||
    tipo ||
    '—'
  );
}


function nombreOrigen(
  origen,
) {
  return (
    ORIGENES_AULA[origen] ||
    origen ||
    '—'
  );
}


const TIPOS_INDISPONIBILIDAD = {
  MANTENIMIENTO:
    'Mantenimiento',

  REPARACION:
    'Reparación',

  LIMPIEZA:
    'Limpieza',

  BLOQUEO:
    'Bloqueo',

  OTRO:
    'Otro',
};


function nombreTipoIndisponibilidad(
  tipo,
) {
  return (
    TIPOS_INDISPONIBILIDAD[
      tipo
    ] ||
    tipo ||
    '—'
  );
}


const TIPOS_RESERVA = {
  EXAMEN: 'Examen',
  REUNION: 'Reunión',
  ACTIVIDAD: 'Actividad',
  CONFERENCIA: 'Conferencia',
  EVENTO: 'Evento',
  OTRO: 'Otro',
};


function nombreTipoReserva(
  tipo,
) {
  return (
    TIPOS_RESERVA[tipo] ||
    tipo ||
    '—'
  );
}


function normalizarFechaHoraInput(
  valor,
) {
  if (!valor) {
    return valor;
  }

  return valor.length === 16
    ? `${valor}:00`
    : valor;
}


function fechaHoraLocalParaInput(
  fecha,
) {
  const pad =
    (valor) =>
      String(valor)
        .padStart(
          2,
          '0',
        );


  return [
    fecha.getFullYear(),
    '-',
    pad(
      fecha.getMonth() + 1,
    ),
    '-',
    pad(
      fecha.getDate(),
    ),
    'T',
    pad(
      fecha.getHours(),
    ),
    ':',
    pad(
      fecha.getMinutes(),
    ),
  ].join('');
}


function obtenerRangoOcupacionInicial() {
  const ahora =
    new Date();


  const inicio =
    new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
      0,
      0,
    );


  const fin =
    new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
      23,
      59,
    );


  return {
    inicio:
      fechaHoraLocalParaInput(
        inicio,
      ),

    fin:
      fechaHoraLocalParaInput(
        fin,
      ),
  };
}


function nombreOrigenOcupacion(
  origen,
) {
  const nombres = {
    RESERVA:
      'Reserva',

    INDISPONIBILIDAD:
      'Indisponibilidad',
  };


  return (
    nombres[origen] ||
    origen ||
    '—'
  );
}


function horaCorta(
  hora,
) {
  if (!hora) {
    return '—';
  }

  return String(hora)
    .slice(0, 5);
}


function seleccionarPeriodoPreferido(
  periodos,
) {
  if (!periodos.length) {
    return null;
  }


  return (
    periodos.find(
      (periodo) =>
        periodo.estado ===
        'EN_PREPARACION',
    ) ||
    periodos.find(
      (periodo) =>
        periodo.estado ===
        'EN_CURSO',
    ) ||
    periodos.find(
      (periodo) =>
        periodo.estado ===
        'BORRADOR',
    ) ||
    periodos[0]
  );
}


const RECOMENDACIONES_CAPACIDAD = {
  SOBRECAPACIDAD:
    'Sobrecapacidad',

  AL_LIMITE:
    'Al límite',

  AJUSTADA:
    'Ajustada',

  RECOMENDADA:
    'Recomendada',

  MUY_RECOMENDADA:
    'Muy recomendada',
};


function nombreRecomendacionCapacidad(
  valor,
) {
  return (
    RECOMENDACIONES_CAPACIDAD[
      valor
    ] ||
    'Sin evaluar'
  );
}


const ACCIONES_AUDITORIA_AULA = {
  CREAR:
    'Creación',

  ACTUALIZAR:
    'Actualización',

  CAMBIAR_ESTADO:
    'Cambio de estado',

  ASIGNAR_EQUIPAMIENTO:
    'Asignación de equipamiento',

  ACTUALIZAR_EQUIPAMIENTO:
    'Actualización de equipamiento',

  CAMBIAR_ESTADO_EQUIPAMIENTO:
    'Cambio de estado del equipamiento',

  CREAR_DISPONIBILIDAD:
    'Creación de disponibilidad',

  ACTUALIZAR_DISPONIBILIDAD:
    'Actualización de disponibilidad',

  ELIMINAR_DISPONIBILIDAD:
    'Eliminación de disponibilidad',
};


const ENTIDADES_AUDITORIA_AULA = {
  AULA:
    'Aula',

  EQUIPAMIENTO:
    'Equipamiento',

  AULA_EQUIPAMIENTO:
    'Equipamiento del aula',

  INDISPONIBILIDAD:
    'Indisponibilidad',

  RESERVA:
    'Reserva',

  DISPONIBILIDAD_AULA:
    'Disponibilidad del aula',
};


function nombreAccionAuditoria(
  accion,
) {
  return (
    ACCIONES_AUDITORIA_AULA[
      accion
    ] ||
    accion ||
    '—'
  );
}


function nombreEntidadAuditoria(
  entidad,
) {
  return (
    ENTIDADES_AUDITORIA_AULA[
      entidad
    ] ||
    entidad ||
    '—'
  );
}


function obtenerDetalleAuditoria(
  detalle,
) {
  if (!detalle) {
    return null;
  }

  if (
    typeof detalle ===
    'object'
  ) {
    return detalle;
  }

  try {
    return JSON.parse(
      detalle,
    );
  } catch {
    return detalle;
  }
}


function detalleAuditoriaTexto(
  detalle,
) {
  const valor =
    obtenerDetalleAuditoria(
      detalle,
    );

  if (valor === null) {
    return '';
  }

  if (
    typeof valor ===
    'string'
  ) {
    return valor;
  }

  return JSON.stringify(
    valor,
    null,
    2,
  );
}


function formatearFechaHora(
  valor,
) {
  if (!valor) {
    return '—';
  }


  const fecha =
    new Date(valor);


  if (
    Number.isNaN(
      fecha.getTime(),
    )
  ) {
    return valor;
  }


  return new Intl.DateTimeFormat(
    'es-CR',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  ).format(fecha);
}


function fechaParaInput(
  valor,
) {
  if (!valor) {
    return '';
  }


  const fecha =
    new Date(valor);


  if (
    Number.isNaN(
      fecha.getTime(),
    )
  ) {
    return '';
  }


  const pad =
    (numero) =>
      String(numero)
        .padStart(
          2,
          '0',
        );


  return [
    fecha.getFullYear(),
    '-',
    pad(
      fecha.getMonth() + 1,
    ),
    '-',
    pad(
      fecha.getDate(),
    ),
    'T',
    pad(
      fecha.getHours(),
    ),
    ':',
    pad(
      fecha.getMinutes(),
    ),
  ].join('');
}


/* =========================================================
   VISTA PRINCIPAL
   ========================================================= */

function renderizarVistaListado() {
  const vista =
    document.getElementById(
      'aulasVista',
    );


  if (!vista) {
    return;
  }


  const administrador =
    puedeAdministrarAulas();


  vista.innerHTML = `

    <div
      class="aulas-toolbar"
    >

      <div>

        <h2>
          Aulas
        </h2>

        <p>
          Gestión y consulta de espacios
          académicos disponibles.
        </p>

      </div>


      <div class="aulas-actions">

        <button
          id="buscarAulasDisponiblesButton"
          class="aulas-secondary-button"
          type="button"
        >
          <i
            data-lucide="search"
            aria-hidden="true"
          ></i>

          Buscar aulas disponibles
        </button>

        ${
          administrador
            ? `
                <button
                  id="catalogoEquipamientosButton"
                  class="aulas-secondary-button"
                  type="button"
                >
                  <i
                    data-lucide="monitor-cog"
                    aria-hidden="true"
                  ></i>

                  Catálogo de equipamiento
                </button>

                <button
                  id="nuevaAulaButton"
                  class="aulas-primary-button"
                  type="button"
                >

                  <i
                    data-lucide="plus"
                    aria-hidden="true"
                  ></i>

                  Nueva aula

                </button>
            `
            : ''
        }

      </div>

    </div>


    <div
      class="aulas-filters"
    >

      <label
        class="aulas-search"
        for="aulasBuscar"
      >

        <i
          data-lucide="search"
          aria-hidden="true"
        ></i>

        <input
          id="aulasBuscar"
          type="search"
          placeholder="Buscar por código, nombre o ubicación..."
          autocomplete="off"
        >

      </label>


      <select
        id="aulasTipo"
        class="aulas-select"
        aria-label="Filtrar por tipo"
      >

        <option value="">
          Todos los tipos
        </option>

        ${Object.entries(
          TIPOS_AULA,
        )
          .map(
            ([valor, nombre]) => `
              <option
                value="${valor}"
              >
                ${nombre}
              </option>
            `,
          )
          .join('')}

      </select>


      <select
        id="aulasEstado"
        class="aulas-select"
        aria-label="Filtrar por estado"
      >

        <option value="TODAS">
          Todas
        </option>

        <option value="ACTIVAS">
          Activas
        </option>

        <option value="INACTIVAS">
          Inactivas
        </option>

      </select>

    </div>


    <div
      id="aulasContent"
      aria-live="polite"
    >

      <div
        class="aulas-message"
      >
        Cargando aulas...
      </div>

    </div>

  `;


  document
    .getElementById(
      'aulasBuscar',
    )
    ?.addEventListener(
      'input',
      renderizarAulas,
    );


  document
    .getElementById(
      'aulasTipo',
    )
    ?.addEventListener(
      'change',
      renderizarAulas,
    );


  document
    .getElementById(
      'aulasEstado',
    )
    ?.addEventListener(
      'change',
      renderizarAulas,
    );


  document
    .getElementById(
      'buscarAulasDisponiblesButton',
    )
    ?.addEventListener(
      'click',
      abrirBusquedaAulasDisponibles,
    );


  document
    .getElementById(
      'nuevaAulaButton',
    )
    ?.addEventListener(
      'click',
      () => {
        abrirFormularioAula();
      },
    );


  document
    .getElementById(
      'catalogoEquipamientosButton',
    )
    ?.addEventListener(
      'click',
      abrirCatalogoEquipamientos,
    );


  document
    .getElementById(
      'aulasContent',
    )
    ?.addEventListener(
      'click',
      manejarAccionTabla,
    );


  renderizarIconos();
}


/* =========================================================
   FILTRADO
   ========================================================= */

function obtenerAulasFiltradas() {
  const texto =
    document
      .getElementById(
        'aulasBuscar',
      )
      ?.value
      ?.trim()
      .toLowerCase() || '';


  const tipo =
    document
      .getElementById(
        'aulasTipo',
      )
      ?.value || '';


  const estado =
    document
      .getElementById(
        'aulasEstado',
      )
      ?.value || 'TODAS';


  return aulas.filter(
    (aula) => {

      const coincideTexto =
        !texto ||
        [
          aula.codigo,
          aula.nombre,
          aula.ubicacion,
        ]
          .filter(Boolean)
          .some(
            (valor) =>
              String(valor)
                .toLowerCase()
                .includes(texto),
          );


      const coincideTipo =
        !tipo ||
        aula.tipo === tipo;


      let coincideEstado =
        true;


      if (
        estado === 'ACTIVAS'
      ) {
        coincideEstado =
          aula.activo === true;
      }


      if (
        estado === 'INACTIVAS'
      ) {
        coincideEstado =
          aula.activo === false;
      }


      return (
        coincideTexto &&
        coincideTipo &&
        coincideEstado
      );

    },
  );
}


/* =========================================================
   TABLA
   ========================================================= */

function renderizarAulas() {
  const contenido =
    document.getElementById(
      'aulasContent',
    );


  if (!contenido) {
    return;
  }


  const filtradas =
    obtenerAulasFiltradas();


  const administrador =
    puedeAdministrarAulas();


  const filas =
    filtradas
      .map(
        (aula) => `
          <tr>

            <td>
              <strong
                class="aulas-code"
              >
                ${escapeHtml(
                  aula.codigo,
                )}
              </strong>
            </td>


            <td>

              <div
                class="aulas-name"
              >

                <strong>
                  ${escapeHtml(
                    aula.nombre,
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    aula.ubicacion ||
                      'Sin ubicación especificada',
                  )}
                </small>

              </div>

            </td>


            <td>
              ${escapeHtml(
                nombreTipoAula(
                  aula.tipo,
                ),
              )}
            </td>


            <td>
              ${escapeHtml(
                nombreMobiliario(
                  aula.tipoMobiliario,
                ),
              )}
            </td>


            <td>
              ${escapeHtml(
                aula.capacidad,
              )}
            </td>


            <td>
              ${escapeHtml(
                nombreOrigen(
                  aula.origen,
                ),
              )}
            </td>


            <td>

              <span
                class="
                  aulas-status
                  ${
                    aula.activo
                      ? 'is-active'
                      : 'is-inactive'
                  }
                "
              >
                ${
                  aula.activo
                    ? 'Activa'
                    : 'Inactiva'
                }
              </span>

            </td>


            <td>

              <div
                class="aulas-actions"
              >

                <button
                  type="button"
                  class="aulas-icon-button"
                  data-action="ver"
                  data-aula-id="${
                    aula.id
                  }"
                  title="Ver aula"
                >
                  <i
                    data-lucide="eye"
                    aria-hidden="true"
                  ></i>
                </button>


                ${
                  administrador
                    ? `
                      <button
                        type="button"
                        class="aulas-icon-button"
                        data-action="editar"
                        data-aula-id="${
                          aula.id
                        }"
                        title="Editar aula"
                      >
                        <i
                          data-lucide="pencil"
                          aria-hidden="true"
                        ></i>
                      </button>


                      <button
                        type="button"
                        class="
                          aulas-icon-button
                          ${
                            aula.activo
                              ? 'is-danger'
                              : 'is-success'
                          }
                        "
                        data-action="estado"
                        data-aula-id="${
                          aula.id
                        }"
                        title="${
                          aula.activo
                            ? 'Inactivar aula'
                            : 'Activar aula'
                        }"
                      >
                        <i
                          data-lucide="${
                            aula.activo
                              ? 'circle-pause'
                              : 'circle-check'
                          }"
                          aria-hidden="true"
                        ></i>
                      </button>
                    `
                    : ''
                }

              </div>

            </td>

          </tr>
        `,
      )
      .join('');


  contenido.innerHTML =
    DataTable({

      columns: [
        'Código',
        'Aula',
        'Tipo',
        'Mobiliario',
        'Capacidad',
        'Origen',
        'Estado',
        'Acciones',
      ],

      rows:
        filas,

      emptyMessage:
        'No se encontraron aulas.',

      ariaLabel:
        'Listado de aulas',

    });


  renderizarIconos();
}


/* =========================================================
   CARGAR
   ========================================================= */

async function cargarAulas(
  instancia,
) {
  const contenido =
    document.getElementById(
      'aulasContent',
    );


  if (!contenido) {
    return;
  }


  try {

    const resultado =
      await listarAulas();


    if (
      instancia !==
      instanciaActual
    ) {
      return;
    }


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar las aulas.',
      );
    }


    aulas =
      Array.isArray(
        resultado.aulas,
      )
        ? resultado.aulas
        : [];


    renderizarAulas();

  } catch (error) {

    contenido.innerHTML = `
      <div
        class="
          aulas-message
          aulas-error
        "
      >
        ${escapeHtml(
          error?.message ||
            'No fue posible cargar las aulas.',
        )}
      </div>
    `;

  }
}


/* =========================================================
   ACCIONES DE TABLA
   ========================================================= */

async function manejarAccionTabla(
  event,
) {
  const boton =
    event.target.closest(
      '[data-action]',
    );


  if (!boton) {
    return;
  }


  const aulaId =
    Number(
      boton.dataset.aulaId,
    );


  if (!aulaId) {
    return;
  }


  const aula =
    aulas.find(
      (item) =>
        item.id === aulaId,
    );


  if (!aula) {
    return;
  }


  const action =
    boton.dataset.action;


  if (
    action === 'ver'
  ) {
    await abrirDetalleAula(
      aulaId,
    );

    return;
  }


  if (
    !puedeAdministrarAulas()
  ) {
    return;
  }


  if (
    action === 'editar'
  ) {
    abrirFormularioAula(
      aula,
    );

    return;
  }


  if (
    action === 'estado'
  ) {
    await cambiarEstadoAulaActual(
      aula,
    );
  }
}


/* =========================================================
   CATÁLOGO DE EQUIPAMIENTO
   ========================================================= */

async function abrirCatalogoEquipamientos() {
  const vista =
    document.getElementById(
      'aulasVista',
    );


  if (!vista) {
    return;
  }


  vista.innerHTML = `
    <div class="aulas-message">
      Cargando equipamientos...
    </div>
  `;


  try {

    const resultado =
      await listarEquipamientos();


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar el catálogo.',
      );
    }


    catalogoEquipamientos =
      Array.isArray(
        resultado.equipamientos,
      )
        ? resultado.equipamientos
        : [];


    renderizarCatalogoEquipamientos();

  } catch (error) {

    mostrarError({
      titulo:
        'No se pudo cargar el catálogo',

      mensaje:
        error?.message ||
        'No fue posible consultar los equipamientos.',
    });


    iniciarAulasPage();

  }
}


function renderizarCatalogoEquipamientos() {
  const vista =
    document.getElementById(
      'aulasVista',
    );


  if (!vista) {
    return;
  }


  const administrador =
    puedeAdministrarAulas();


  const filas =
    catalogoEquipamientos
      .map(
        (equipo) => `
          <tr>

            <td>
              <strong>
                ${escapeHtml(
                  equipo.nombre,
                )}
              </strong>
            </td>


            <td>
              ${escapeHtml(
                equipo.descripcion ||
                  'Sin descripción',
              )}
            </td>


            <td>
              <span
                class="
                  aulas-status
                  ${
                    equipo.activo
                      ? 'is-active'
                      : 'is-inactive'
                  }
                "
              >
                ${
                  equipo.activo
                    ? 'Activo'
                    : 'Inactivo'
                }
              </span>
            </td>


            <td>

              ${
                administrador
                  ? `
                    <div
                      class="aulas-actions"
                    >

                      <button
                        type="button"
                        class="aulas-icon-button"
                        data-equipamiento-action="editar"
                        data-equipamiento-id="${
                          equipo.id
                        }"
                        title="Editar"
                      >
                        <i
                          data-lucide="pencil"
                        ></i>
                      </button>


                      <button
                        type="button"
                        class="
                          aulas-icon-button
                          ${
                            equipo.activo
                              ? 'is-danger'
                              : 'is-success'
                          }
                        "
                        data-equipamiento-action="estado"
                        data-equipamiento-id="${
                          equipo.id
                        }"
                        title="${
                          equipo.activo
                            ? 'Inactivar'
                            : 'Activar'
                        }"
                      >
                        <i
                          data-lucide="${
                            equipo.activo
                              ? 'circle-pause'
                              : 'circle-check'
                          }"
                        ></i>
                      </button>

                    </div>
                  `
                  : '—'
              }

            </td>

          </tr>
        `,
      )
      .join('');


  vista.innerHTML = `

    <div
      class="aulas-detail-header"
    >

      <button
        id="volverCatalogoAulas"
        class="aulas-back-button"
        type="button"
      >
        <i data-lucide="arrow-left"></i>
        Volver
      </button>


      <div>
        <h2>
          Catálogo de equipamiento
        </h2>

        <p>
          Tipos de equipos disponibles
          para asignar a las aulas.
        </p>
      </div>


      ${
        administrador
          ? `
            <button
              id="nuevoEquipamientoButton"
              class="aulas-primary-button"
              type="button"
            >
              <i data-lucide="plus"></i>
              Nuevo equipamiento
            </button>
          `
          : ''
      }

    </div>


    ${DataTable({
      columns: [
        'Equipamiento',
        'Descripción',
        'Estado',
        'Acciones',
      ],

      rows: filas,

      emptyMessage:
        'No existen equipamientos registrados.',

      ariaLabel:
        'Catálogo de equipamientos',
    })}

  `;


  document
    .getElementById(
      'volverCatalogoAulas',
    )
    ?.addEventListener(
      'click',
      iniciarAulasPage,
    );


  document
    .getElementById(
      'nuevoEquipamientoButton',
    )
    ?.addEventListener(
      'click',
      () => {
        abrirFormularioEquipamiento();
      },
    );


  vista.addEventListener(
    'click',
    manejarAccionCatalogoEquipamiento,
  );


  renderizarIconos();
}


function abrirFormularioEquipamiento(
  equipamiento = null,
) {
  const dialog =
    document.getElementById(
      'aulaDialog',
    );

  const content =
    document.getElementById(
      'aulaDialogContent',
    );


  if (
    !dialog ||
    !content
  ) {
    return;
  }


  const editando =
    Boolean(equipamiento);


  content.innerHTML =
    FormDialog({

      formId:
        'equipamientoForm',

      title:
        editando
          ? 'Editar equipamiento'
          : 'Nuevo equipamiento',

      description:
        'Defina un tipo de equipamiento que podrá asignarse a las aulas.',

      body: `

        <label
          class="sgpa-form-wide"
        >
          <span>
            Nombre
          </span>

          <input
            id="equipamientoNombre"
            type="text"
            maxlength="100"
            value="${escapeHtml(
              equipamiento?.nombre ||
                '',
            )}"
            required
          >
        </label>


        <label
          class="sgpa-form-wide"
        >
          <span>
            Descripción
          </span>

          <textarea
            id="equipamientoDescripcion"
            rows="4"
            maxlength="500"
          >${escapeHtml(
            equipamiento
              ?.descripcion || '',
          )}</textarea>
        </label>

      `,

      errorId:
        'equipamientoFormError',

      cancelButtonId:
        'cancelarEquipamiento',

      submitButtonId:
        'guardarEquipamiento',

      submitText:
        editando
          ? 'Guardar cambios'
          : 'Crear equipamiento',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarEquipamiento',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'equipamientoForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const datos = {
          nombre:
            document
              .getElementById(
                'equipamientoNombre',
              )
              ?.value
              ?.trim(),

          descripcion:
            document
              .getElementById(
                'equipamientoDescripcion',
              )
              ?.value
              ?.trim() || '',
        };


        try {

          const resultado =
            editando
              ? await actualizarEquipamiento(
                  equipamiento.id,
                  datos,
                )
              : await crearEquipamiento(
                  datos,
                );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible guardar el equipamiento.',
            );
          }


          dialog.close();


          mostrarExito({
            titulo:
              editando
                ? 'Equipamiento actualizado'
                : 'Equipamiento creado',

            mensaje:
              'La información fue guardada correctamente.',
          });


          await abrirCatalogoEquipamientos();

        } catch (error) {

          mostrarError({
            titulo:
              'No se pudo guardar',

            mensaje:
              error?.message ||
              'No fue posible guardar el equipamiento.',
          });

        }

      },
    );


  renderizarIconos();
}


async function manejarAccionCatalogoEquipamiento(
  event,
) {
  const boton =
    event.target.closest(
      '[data-equipamiento-action]',
    );


  if (!boton) {
    return;
  }


  const id =
    Number(
      boton.dataset
        .equipamientoId,
    );


  const equipamiento =
    catalogoEquipamientos.find(
      (item) =>
        item.id === id,
    );


  if (!equipamiento) {
    return;
  }


  if (
    boton.dataset
      .equipamientoAction ===
    'editar'
  ) {
    abrirFormularioEquipamiento(
      equipamiento,
    );

    return;
  }


  if (
    boton.dataset
      .equipamientoAction ===
    'estado'
  ) {
    await cambiarEstadoCatalogoEquipamiento(
      equipamiento,
    );
  }
}


async function cambiarEstadoCatalogoEquipamiento(
  equipamiento,
) {
  const activo =
    !equipamiento.activo;


  const confirmado =
    await confirmarAccion({

      titulo:
        activo
          ? 'Activar equipamiento'
          : 'Inactivar equipamiento',

      mensaje:
        `¿Desea ${
          activo
            ? 'activar'
            : 'inactivar'
        } "${equipamiento.nombre}"?`,

      textoConfirmar:
        activo
          ? 'Activar'
          : 'Inactivar',

      peligro:
        !activo,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await cambiarEstadoEquipamiento(
        equipamiento.id,
        activo,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible cambiar el estado.',
      );
    }


    mostrarExito({
      titulo:
        activo
          ? 'Equipamiento activado'
          : 'Equipamiento inactivado',

      mensaje:
        'El estado fue actualizado correctamente.',
    });


    await abrirCatalogoEquipamientos();

  } catch (error) {

    mostrarError({
      titulo:
        'No se pudo cambiar el estado',

      mensaje:
        error?.message ||
        'No fue posible actualizar el equipamiento.',
    });

  }
}


/* =========================================================
   DETALLE DEL AULA
   ========================================================= */

async function abrirDetalleAula(
  aulaId,
) {
  const vista =
    document.getElementById(
      'aulasVista',
    );


  if (!vista) {
    return;
  }


  vista.innerHTML = `
    <div class="aulas-message">
      Cargando aula...
    </div>
  `;


  try {

    const [
      resultadoAula,
      resultadoEquipamiento,
      resultadoCatalogo,
      resultadoIndisponibilidades,
      resultadoReservas,
      resultadoPeriodos,
    ] = await Promise.all([

      obtenerAula(
        aulaId,
      ),

      listarEquipamientoAula(
        aulaId,
      ),

      listarEquipamientos(),

      listarIndisponibilidadesAula(
        aulaId,
      ),

      listarReservasAula(
        aulaId,
      ),

      listarPeriodosAcademicos(),

    ]);


    if (!resultadoAula?.ok) {
      throw new Error(
        resultadoAula?.message ||
          'No fue posible consultar el aula.',
      );
    }

    if (!resultadoEquipamiento?.ok) {
      throw new Error(
        resultadoEquipamiento?.message ||
          'No fue posible consultar el equipamiento del aula.',
      );
    }

    if (!resultadoCatalogo?.ok) {
      throw new Error(
        resultadoCatalogo?.message ||
          'No fue posible consultar el catálogo de equipamientos.',
      );
    }

    if (!resultadoIndisponibilidades?.ok) {
      throw new Error(
        resultadoIndisponibilidades?.message ||
          'No fue posible consultar las indisponibilidades.',
      );
    }

    if (!resultadoReservas?.ok) {
      throw new Error(
        resultadoReservas?.message ||
          'No fue posible consultar las reservas.',
      );
    }

    if (!resultadoPeriodos?.ok) {
      throw new Error(
        resultadoPeriodos?.message ||
          'No fue posible consultar los periodos académicos.',
      );
    }


    aulaDetalleActual =
      resultadoAula.data;


    equipamientoAulaActual =
      Array.isArray(
        resultadoEquipamiento
          .equipamientos,
      )
        ? resultadoEquipamiento
            .equipamientos
        : [];


    catalogoEquipamientos =
      Array.isArray(
        resultadoCatalogo
          .equipamientos,
      )
        ? resultadoCatalogo
            .equipamientos
        : [];


    indisponibilidadesAulaActual =
      Array.isArray(
        resultadoIndisponibilidades
          .indisponibilidades,
      )
        ? resultadoIndisponibilidades
            .indisponibilidades
        : [];


    reservasAulaActual =
      Array.isArray(
        resultadoReservas.reservas,
      )
        ? resultadoReservas.reservas
        : [];


    periodosDisponibilidadAula =
      Array.isArray(
        resultadoPeriodos.periodos,
      )
        ? resultadoPeriodos.periodos
        : [];

    auditoriaAulaActual = [];


    const aula =
      aulaDetalleActual;


    vista.innerHTML = `

      <div
        class="aulas-detail-header"
      >

        <button
          id="volverAulasButton"
          class="aulas-back-button"
          type="button"
        >
          <i
            data-lucide="arrow-left"
            aria-hidden="true"
          ></i>

          Volver
        </button>


        <div>

          <h2>
            ${escapeHtml(
              aula.codigo,
            )}
            —
            ${escapeHtml(
              aula.nombre,
            )}
          </h2>

          <p>
            ${escapeHtml(
              aula.ubicacion ||
                'Sin ubicación especificada',
            )}
          </p>

        </div>


        <span
          class="
            aulas-status
            ${
              aula.activo
                ? 'is-active'
                : 'is-inactive'
            }
          "
        >
          ${
            aula.activo
              ? 'Activa'
              : 'Inactiva'
          }
        </span>

      </div>


      <section
        class="aulas-detail-card"
      >

        <h3>
          Información general
        </h3>


        <div
          class="aulas-info-grid"
        >

          <div>
            <span>
              Código
            </span>

            <strong>
              ${escapeHtml(
                aula.codigo,
              )}
            </strong>
          </div>


          <div>
            <span>
              Capacidad
            </span>

            <strong>
              ${escapeHtml(
                aula.capacidad,
              )}
              personas
            </strong>
          </div>


          <div>
            <span>
              Tipo
            </span>

            <strong>
              ${escapeHtml(
                nombreTipoAula(
                  aula.tipo,
                ),
              )}
            </strong>
          </div>


          <div>
            <span>
              Mobiliario
            </span>

            <strong>
              ${escapeHtml(
                nombreMobiliario(
                  aula.tipoMobiliario,
                ),
              )}
            </strong>
          </div>


          <div>
            <span>
              Origen
            </span>

            <strong>
              ${escapeHtml(
                nombreOrigen(
                  aula.origen,
                ),
              )}
            </strong>
          </div>


          <div>
            <span>
              Ubicación
            </span>

            <strong>
              ${escapeHtml(
                aula.ubicacion ||
                  'No especificada',
              )}
            </strong>
          </div>

        </div>

      </section>


      <section
        class="aulas-detail-card"
      >

        <div
          class="aulas-section-header"
        >

          <div>
            <h3>
              Equipamiento
            </h3>

            <p class="aulas-muted">
              Equipos y recursos disponibles
              en este espacio.
            </p>
          </div>


          ${
            puedeAdministrarAulas() &&
            aula.activo
              ? `
                <button
                  id="asignarEquipamientoButton"
                  class="aulas-primary-button"
                  type="button"
                >
                  <i data-lucide="plus"></i>
                  Asignar equipamiento
                </button>
              `
              : ''
          }

        </div>


        ${renderizarEquipamientoDelAula(
          equipamientoAulaActual,
        )}

      </section>


      ${renderizarSeccionDisponibilidadBase()}


      <section
        class="aulas-detail-card"
      >

        <div
          class="aulas-section-header"
        >

          <div>

            <h3>
              Indisponibilidades
            </h3>

            <p
              class="aulas-muted"
            >
              Periodos en los que el aula
              no puede utilizarse.
            </p>

          </div>


          ${
            puedeGestionarIndisponibilidades() &&
            aula.activo
              ? `
                <button
                  id="nuevaIndisponibilidadButton"
                  class="aulas-primary-button"
                  type="button"
                >

                  <i
                    data-lucide="plus"
                    aria-hidden="true"
                  ></i>

                  Nueva indisponibilidad

                </button>
              `
              : ''
          }

        </div>


        ${renderizarIndisponibilidades(
          indisponibilidadesAulaActual,
        )}

      </section>


      <section
        class="aulas-detail-card"
      >

        <div
          class="aulas-section-header"
        >

          <div>
            <h3>
              Reservas extraordinarias
            </h3>

            <p class="aulas-muted">
              Exámenes, reuniones, eventos
              y otras ocupaciones temporales.
            </p>
          </div>


          ${
            puedeGestionarReservas() &&
            aula.activo
              ? `
                <button
                  id="nuevaReservaAulaButton"
                  class="aulas-primary-button"
                  type="button"
                >
                  <i
                    data-lucide="plus"
                    aria-hidden="true"
                  ></i>

                  Nueva reserva
                </button>
              `
              : ''
          }

        </div>


        ${renderizarReservasAula(
          reservasAulaActual,
        )}

      </section>


      ${renderizarSeccionOcupacion()}

      ${renderizarSeccionDisponibilidadBase()}

      ${
        puedeConsultarAuditoriaAula()
          ? renderizarSeccionAuditoriaAula()
          : ''
      }

    `;


    document
      .getElementById(
        'volverAulasButton',
      )
      ?.addEventListener(
        'click',
        iniciarAulasPage,
      );


    document
      .getElementById(
        'asignarEquipamientoButton',
      )
      ?.addEventListener(
        'click',
        () => {
          abrirFormularioEquipamientoAula();
        },
      );


    vista
      .querySelectorAll(
        '[data-aula-equipo-action]',
      )
      .forEach(
        (boton) => {

          boton.addEventListener(
            'click',
            async () => {

              const id =
                Number(
                  boton.dataset
                    .equipamientoId,
                );


              const relacion =
                equipamientoAulaActual.find(
                  (item) =>
                    item.equipamientoId ===
                    id,
                );


              if (!relacion) {
                return;
              }


              if (
                boton.dataset
                  .aulaEquipoAction ===
                'editar'
              ) {
                abrirFormularioEquipamientoAula(
                  relacion,
                );

                return;
              }


              await cambiarEstadoEquipamientoDelAula(
                relacion,
              );

            },
          );

        },
      );


    document
      .getElementById(
        'nuevaIndisponibilidadButton',
      )
      ?.addEventListener(
        'click',
        () => {
          abrirFormularioIndisponibilidad();
        },
      );


    vista
      .querySelectorAll(
        '[data-indisponibilidad-action]',
      )
      .forEach(
        (boton) => {

          boton.addEventListener(
            'click',
            async () => {

              const id =
                Number(
                  boton.dataset
                    .indisponibilidadId,
                );


              const indisponibilidad =
                indisponibilidadesAulaActual
                  .find(
                    (item) =>
                      item.id === id,
                  );


              if (!indisponibilidad) {
                return;
              }


              if (
                boton.dataset
                  .indisponibilidadAction ===
                'editar'
              ) {
                abrirFormularioIndisponibilidad(
                  indisponibilidad,
                );

                return;
              }


              await cambiarEstadoIndisponibilidad(
                indisponibilidad,
              );

            },
          );

        },
      );


    document
      .getElementById(
        'nuevaReservaAulaButton',
      )
      ?.addEventListener(
        'click',
        () => {
          abrirFormularioReserva();
        },
      );


    vista
      .querySelectorAll(
        '[data-reserva-action]',
      )
      .forEach(
        (boton) => {

          boton.addEventListener(
            'click',
            async () => {

              const id =
                Number(
                  boton.dataset.reservaId,
                );

              const reserva =
                reservasAulaActual.find(
                  (item) =>
                    item.id === id,
                );

              if (!reserva) {
                return;
              }


              if (
                boton.dataset
                  .reservaAction ===
                'editar'
              ) {
                abrirFormularioReserva(
                  reserva,
                );

                return;
              }


              await cambiarEstadoReserva(
                reserva,
              );

            },
          );

        },
      );


    document
      .getElementById(
        'ocupacionAulaForm',
      )
      ?.addEventListener(
        'submit',
        async (event) => {

          event.preventDefault();


          const inicio =
            document
              .getElementById(
                'ocupacionInicio',
              )
              ?.value;


          const fin =
            document
              .getElementById(
                'ocupacionFin',
              )
              ?.value;


          if (
            !inicio ||
            !fin
          ) {
            return;
          }


          if (fin <= inicio) {

            mostrarError({

              titulo:
                'Rango inválido',

              mensaje:
                'La fecha y hora de finalización debe ser posterior al inicio.',

            });

            return;
          }


          await cargarOcupacionAula(
            inicio,
            fin,
          );

        },
      );


    configurarDisponibilidadBaseAula();


    document
      .getElementById(
        'cargarAuditoriaAulaButton',
      )
      ?.addEventListener(
        'click',
        cargarAuditoriaAula,
      );


    renderizarIconos();

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo cargar el aula',

      mensaje:
        error?.message ||
        'No fue posible consultar la información.',

    });


    iniciarAulasPage();

  }
}


/* =========================================================
   EQUIPAMIENTO DEL AULA (RENDER / FORMS)
   ========================================================= */

function renderizarEquipamientoDelAula(
  equipamientos,
) {
  if (!equipamientos.length) {
    return `
      <p class="aulas-muted">
        Esta aula no tiene equipamiento
        registrado.
      </p>
    `;
  }


  return `
    <div
      class="aulas-equipment-list"
    >

      ${equipamientos
        .map(
          (relacion) => `
            <article
              class="aulas-equipment-item"
            >

              <div
                class="aulas-equipment-main"
              >

                <div>

                  <strong>
                    ${escapeHtml(
                      relacion
                        .equipamiento
                        ?.nombre ||
                        'Equipamiento',
                    )}
                  </strong>

                  <span>
                    ${
                      relacion
                        .equipamiento
                        ?.descripcion
                        ? escapeHtml(
                            relacion
                              .equipamiento
                              .descripcion,
                          )
                        : 'Sin descripción'
                    }
                  </span>

                </div>


                <span
                  class="
                    aulas-status
                    ${
                      relacion.activo
                        ? 'is-active'
                        : 'is-inactive'
                    }
                  "
                >
                  ${
                    relacion.activo
                      ? 'Activo'
                      : 'Inactivo'
                  }
                </span>

              </div>


              <div
                class="aulas-equipment-counts"
              >

                <div>
                  <span>Total</span>

                  <strong>
                    ${relacion.cantidadTotal}
                  </strong>
                </div>


                <div>
                  <span>Disponibles</span>

                  <strong>
                    ${relacion.cantidadDisponible}
                  </strong>
                </div>

              </div>


              ${
                relacion.observaciones
                  ? `
                    <p
                      class="aulas-equipment-note"
                    >
                      ${escapeHtml(
                        relacion
                          .observaciones,
                      )}
                    </p>
                  `
                  : ''
              }


              ${
                puedeAdministrarAulas()
                  ? `
                    <div
                      class="aulas-actions"
                      style="margin-top: 12px;"
                    >

                      <button
                        type="button"
                        class="aulas-secondary-button"
                        data-aula-equipo-action="editar"
                        data-equipamiento-id="${
                          relacion
                            .equipamientoId
                        }"
                      >
                        Editar cantidades
                      </button>


                      <button
                        type="button"
                        class="
                          aulas-secondary-button
                          ${
                            relacion.activo
                              ? 'is-danger'
                              : 'is-success'
                          }
                        "
                        data-aula-equipo-action="estado"
                        data-equipamiento-id="${
                          relacion
                            .equipamientoId
                        }"
                      >
                        ${
                          relacion.activo
                            ? 'Inactivar'
                            : 'Reactivar'
                        }
                      </button>

                    </div>
                  `
                  : ''
              }

            </article>
          `,
        )
        .join('')}

    </div>
  `;
}


function abrirFormularioEquipamientoAula(
  relacion = null,
) {
  if (!aulaDetalleActual) {
    return;
  }


  const dialog =
    document.getElementById(
      'aulaDialog',
    );

  const content =
    document.getElementById(
      'aulaDialogContent',
    );


  if (!dialog || !content) {
    return;
  }


  const editando =
    Boolean(relacion);


  const idsAsignados =
    new Set(
      equipamientoAulaActual
        .filter(
          (item) =>
            item.activo,
        )
        .map(
          (item) =>
            item.equipamientoId,
        ),
    );


  const disponibles =
    catalogoEquipamientos.filter(
      (equipo) =>
        equipo.activo &&
        !idsAsignados.has(
          equipo.id,
        ),
    );


  if (
    !editando &&
    !disponibles.length
  ) {
    mostrarError({
      titulo:
        'Sin equipamiento disponible',

      mensaje:
        'No existen equipamientos activos pendientes de asignar a esta aula.',
    });

    return;
  }


  content.innerHTML =
    FormDialog({

      formId:
        'equipamientoAulaForm',

      title:
        editando
          ? 'Editar equipamiento del aula'
          : 'Asignar equipamiento',

      body: `

        ${
          editando
            ? `
              <div
                class="sgpa-form-wide"
              >
                <strong>
                  ${escapeHtml(
                    relacion
                      .equipamiento
                      ?.nombre || '',
                  )}
                </strong>
              </div>
            `
            : `
              <label
                class="sgpa-form-wide"
              >
                <span>
                  Equipamiento
                </span>

                <select
                  id="equipoAulaId"
                  required
                >

                  <option
                    value=""
                    selected
                    disabled
                  >
                    Seleccione...
                  </option>

                  ${disponibles
                    .map(
                      (equipo) => `
                        <option
                          value="${equipo.id}"
                        >
                          ${escapeHtml(
                            equipo.nombre,
                          )}
                        </option>
                      `,
                    )
                    .join('')}

                </select>
              </label>
            `
        }


        <label>
          <span>
            Cantidad total
          </span>

          <input
            id="equipoCantidadTotal"
            type="number"
            min="1"
            value="${
              relacion
                ?.cantidadTotal ||
              1
            }"
            required
          >
        </label>


        <label>
          <span>
            Cantidad disponible
          </span>

          <input
            id="equipoCantidadDisponible"
            type="number"
            min="0"
            value="${
              relacion
                ?.cantidadDisponible ??
              1
            }"
            required
          >
        </label>


        <label
          class="sgpa-form-wide"
        >
          <span>
            Observaciones
          </span>

          <textarea
            id="equipoAulaObservaciones"
            maxlength="500"
            rows="3"
          >${escapeHtml(
            relacion
              ?.observaciones || '',
          )}</textarea>
        </label>

      `,

      errorId:
        'equipamientoAulaError',

      cancelButtonId:
        'cancelarEquipamientoAula',

      submitButtonId:
        'guardarEquipamientoAula',

      submitText:
        editando
          ? 'Guardar cambios'
          : 'Asignar',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarEquipamientoAula',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'equipamientoAulaForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const cantidadTotal =
          Number(
            document
              .getElementById(
                'equipoCantidadTotal',
              )
              ?.value,
          );


        const cantidadDisponible =
          Number(
            document
              .getElementById(
                'equipoCantidadDisponible',
              )
              ?.value,
          );


        if (
          cantidadTotal < 1 ||
          cantidadDisponible < 0 ||
          cantidadDisponible >
            cantidadTotal
        ) {
          mostrarError({
            titulo:
              'Cantidades inválidas',

            mensaje:
              'La cantidad disponible debe estar entre 0 y la cantidad total.',
          });

          return;
        }


        const datos = {
          cantidadTotal,
          cantidadDisponible,

          observaciones:
            document
              .getElementById(
                'equipoAulaObservaciones',
              )
              ?.value
              ?.trim() || '',
        };


        try {

          let resultado;


          if (editando) {

            resultado =
              await actualizarEquipamientoAula(
                aulaDetalleActual.id,
                relacion
                  .equipamientoId,
                datos,
              );

          } else {

            resultado =
              await asignarEquipamientoAula(
                aulaDetalleActual.id,
                {
                  equipamientoId:
                    Number(
                      document
                        .getElementById(
                          'equipoAulaId',
                        )
                        ?.value,
                    ),

                  ...datos,
                },
              );

          }


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible guardar el equipamiento.',
            );
          }


          dialog.close();


          mostrarExito({
            titulo:
              editando
                ? 'Equipamiento actualizado'
                : 'Equipamiento asignado',

            mensaje:
              'La información del aula fue actualizada correctamente.',
          });


          await abrirDetalleAula(
            aulaDetalleActual.id,
          );

        } catch (error) {

          mostrarError({
            titulo:
              'No se pudo guardar',

            mensaje:
              error?.message ||
              'No fue posible actualizar el equipamiento.',
          });

        }

      },
    );


  renderizarIconos();
}


async function cambiarEstadoEquipamientoDelAula(
  relacion,
) {
  const activo =
    !relacion.activo;


  const confirmado =
    await confirmarAccion({

      titulo:
        activo
          ? 'Reactivar equipamiento'
          : 'Inactivar equipamiento',

      mensaje:
        `¿Desea ${
          activo
            ? 'reactivar'
            : 'inactivar'
        } "${
          relacion.equipamiento
            ?.nombre
        }" en esta aula?`,

      textoConfirmar:
        activo
          ? 'Reactivar'
          : 'Inactivar',

      peligro:
        !activo,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await cambiarEstadoEquipamientoAula(
        aulaDetalleActual.id,
        relacion.equipamientoId,
        activo,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible cambiar el estado.',
      );
    }


    mostrarExito({
      titulo:
        activo
          ? 'Equipamiento reactivado'
          : 'Equipamiento inactivado',

      mensaje:
        'El estado fue actualizado correctamente.',
    });


    await abrirDetalleAula(
      aulaDetalleActual.id,
    );

  } catch (error) {

    mostrarError({
      titulo:
        'No se pudo cambiar el estado',

      mensaje:
        error?.message ||
        'No fue posible actualizar el equipamiento.',
    });

  }
}


/* =========================================================
   INDISPONIBILIDADES (RENDER / FORMS)
   ========================================================= */

function renderizarIndisponibilidades(
  indisponibilidades,
) {
  if (
    !indisponibilidades.length
  ) {
    return `
      <p class="aulas-muted">
        Esta aula no tiene
        indisponibilidades registradas.
      </p>
    `;
  }


  return `
    <div
      class="aulas-unavailability-list"
    >

      ${indisponibilidades
        .map(
          (item) => `
            <article
              class="aulas-unavailability-item"
            >

              <div
                class="aulas-equipment-main"
              >

                <div>

                  <strong>
                    ${escapeHtml(
                      nombreTipoIndisponibilidad(
                        item.tipo,
                      ),
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      item.motivo,
                    )}
                  </span>

                </div>


                <span
                  class="
                    aulas-status
                    ${
                      item.activo
                        ? 'is-active'
                        : 'is-inactive'
                    }
                  "
                >
                  ${
                    item.activo
                      ? 'Activa'
                      : 'Inactiva'
                  }
                </span>

              </div>


              <div
                class="aulas-unavailability-dates"
              >

                <div>

                  <span>
                    Desde
                  </span>

                  <strong>
                    ${escapeHtml(
                      formatearFechaHora(
                        item.fechaHoraInicio,
                      ),
                    )}
                  </strong>

                </div>


                <i
                  data-lucide="arrow-right"
                  aria-hidden="true"
                ></i>


                <div>

                  <span>
                    Hasta
                  </span>

                  <strong>
                    ${escapeHtml(
                      formatearFechaHora(
                        item.fechaHoraFin,
                      ),
                    )}
                  </strong>

                </div>

              </div>


              ${
                puedeGestionarIndisponibilidades()
                  ? `
                    <div
                      class="aulas-actions"
                    >

                      <button
                        type="button"
                        class="aulas-secondary-button"
                        data-indisponibilidad-action="editar"
                        data-indisponibilidad-id="${
                          item.id
                        }"
                      >
                        Editar
                      </button>


                      <button
                        type="button"
                        class="
                          aulas-secondary-button
                          ${
                            item.activo
                              ? 'is-danger'
                              : 'is-success'
                          }
                        "
                        data-indisponibilidad-action="estado"
                        data-indisponibilidad-id="${
                          item.id
                        }"
                      >
                        ${
                          item.activo
                            ? 'Inactivar'
                            : 'Reactivar'
                        }
                      </button>

                    </div>
                  `
                  : ''
              }

            </article>
          `,
        )
        .join('')}

    </div>
  `;
}


function abrirFormularioIndisponibilidad(
  indisponibilidad = null,
) {
  if (!aulaDetalleActual) {
    return;
  }


  const dialog =
    document.getElementById(
      'aulaDialog',
    );

  const content =
    document.getElementById(
      'aulaDialogContent',
    );


  if (
    !dialog ||
    !content
  ) {
    return;
  }


  const editando =
    Boolean(
      indisponibilidad,
    );


  content.innerHTML =
    FormDialog({

      formId:
        'indisponibilidadAulaForm',

      title:
        editando
          ? 'Editar indisponibilidad'
          : 'Nueva indisponibilidad',

      description:
        editando
          ? 'Actualice el periodo en que el aula no estará disponible.'
          : 'Registre un periodo durante el cual el aula no podrá utilizarse.',

      body: `

        <label>

          <span>
            Tipo
          </span>

          <select
            id="indisponibilidadTipo"
            required
          >

            ${Object.entries(
              TIPOS_INDISPONIBILIDAD,
            )
              .map(
                ([valor, nombre]) => `
                  <option
                    value="${valor}"
                    ${
                      (
                        indisponibilidad
                          ?.tipo ||
                        'MANTENIMIENTO'
                      ) === valor
                        ? 'selected'
                        : ''
                    }
                  >
                    ${nombre}
                  </option>
                `,
              )
              .join('')}

          </select>

        </label>


        <label>

          <span>
            Inicio
          </span>

          <input
            id="indisponibilidadInicio"
            type="datetime-local"
            value="${fechaParaInput(
              indisponibilidad
                ?.fechaHoraInicio,
            )}"
            required
          >

        </label>


        <label>

          <span>
            Finalización
          </span>

          <input
            id="indisponibilidadFin"
            type="datetime-local"
            value="${fechaParaInput(
              indisponibilidad
                ?.fechaHoraFin,
            )}"
            required
          >

        </label>


        <label
          class="sgpa-form-wide"
        >

          <span>
            Motivo
          </span>

          <textarea
            id="indisponibilidadMotivo"
            rows="4"
            maxlength="500"
            required
            placeholder="Indique por qué el aula no estará disponible"
          >${escapeHtml(
            indisponibilidad
              ?.motivo || '',
          )}</textarea>

        </label>

      `,

      errorId:
        'indisponibilidadAulaError',

      cancelButtonId:
        'cancelarIndisponibilidad',

      submitButtonId:
        'guardarIndisponibilidad',

      submitText:
        editando
          ? 'Guardar cambios'
          : 'Registrar indisponibilidad',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarIndisponibilidad',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'indisponibilidadAulaForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const inicio =
          document
            .getElementById(
              'indisponibilidadInicio',
            )
            ?.value;


        const fin =
          document
            .getElementById(
              'indisponibilidadFin',
            )
            ?.value;


        const motivo =
          document
            .getElementById(
              'indisponibilidadMotivo',
            )
            ?.value
            ?.trim();


        const errorBox =
          document.getElementById(
            'indisponibilidadAulaError',
          );


        if (
          !inicio ||
          !fin ||
          fin <= inicio
        ) {
          if (errorBox) {
            errorBox.textContent =
              'La fecha y hora de finalización debe ser posterior al inicio.';

            errorBox.classList.remove(
              'hidden',
            );
          }

          return;
        }


        if (!motivo) {
          if (errorBox) {
            errorBox.textContent =
              'Debe indicar el motivo de la indisponibilidad.';

            errorBox.classList.remove(
              'hidden',
            );
          }

          return;
        }


        const datos = {

          tipo:
            document
              .getElementById(
                'indisponibilidadTipo',
              )
              ?.value,

          fechaHoraInicio:
            normalizarFechaHoraInput(
              inicio,
            ),

          fechaHoraFin:
            normalizarFechaHoraInput(
              fin,
            ),

          motivo,

        };


        const boton =
          document.getElementById(
            'guardarIndisponibilidad',
          );


        if (boton) {
          boton.disabled =
            true;
        }


        try {

          const resultado =
            editando
              ? await actualizarIndisponibilidadAula(
                  aulaDetalleActual.id,
                  indisponibilidad.id,
                  datos,
                )
              : await crearIndisponibilidadAula(
                  aulaDetalleActual.id,
                  datos,
                );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible guardar la indisponibilidad.',
            );
          }


          dialog.close();


          mostrarExito({

            titulo:
              editando
                ? 'Indisponibilidad actualizada'
                : 'Indisponibilidad registrada',

            mensaje:
              editando
                ? 'La indisponibilidad fue actualizada correctamente.'
                : 'El aula quedó bloqueada durante el periodo indicado.',

          });


          await abrirDetalleAula(
            aulaDetalleActual.id,
          );

        } catch (error) {

          mostrarError({

            titulo:
              'No se pudo guardar',

            mensaje:
              error?.message ||
              'No fue posible guardar la indisponibilidad.',

          });

        } finally {

          if (boton) {
            boton.disabled =
              false;
          }

        }

      },
    );


  renderizarIconos();
}


async function cambiarEstadoIndisponibilidad(
  indisponibilidad,
) {
  if (!aulaDetalleActual) {
    return;
  }


  const activo =
    !indisponibilidad.activo;


  const confirmado =
    await confirmarAccion({

      titulo:
        activo
          ? 'Reactivar indisponibilidad'
          : 'Inactivar indisponibilidad',

      mensaje:
        activo
          ? 'El aula volverá a considerarse no disponible durante este periodo.'
          : 'Esta restricción dejará de bloquear el uso del aula.',

      textoConfirmar:
        activo
          ? 'Reactivar'
          : 'Inactivar',

      peligro:
        !activo,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await cambiarEstadoIndisponibilidadAula(
        aulaDetalleActual.id,
        indisponibilidad.id,
        activo,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible cambiar el estado.',
      );
    }


    mostrarExito({

      titulo:
        activo
          ? 'Indisponibilidad reactivada'
          : 'Indisponibilidad inactivada',

      mensaje:
        'El estado fue actualizado correctamente.',

    });


    await abrirDetalleAula(
      aulaDetalleActual.id,
    );

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo cambiar el estado',

      mensaje:
        error?.message ||
          'No fue posible actualizar la indisponibilidad.',

    });

  }
}


/* =========================================================
   RESERVAS EXTRAORDINARIAS (RENDER / FORMS)
   ========================================================= */

function renderizarReservasAula(
  reservas,
) {
  if (!reservas.length) {
    return `
      <p class="aulas-muted">
        Esta aula no tiene reservas
        extraordinarias registradas.
      </p>
    `;
  }

  return `
    <div
      class="aulas-reservation-list"
    >

      ${reservas
        .map(
          (reserva) => `
            <article
              class="aulas-reservation-item"
            >

              <div
                class="aulas-equipment-main"
              >

                <div>

                  <strong>
                    ${escapeHtml(
                      reserva.titulo,
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      nombreTipoReserva(
                        reserva.tipo,
                      ),
                    )}
                  </span>

                </div>


                <span
                  class="
                    aulas-status
                    ${
                      reserva.activo
                        ? 'is-active'
                        : 'is-inactive'
                    }
                  "
                >
                  ${
                    reserva.activo
                      ? 'Activa'
                      : 'Inactiva'
                  }
                </span>

              </div>


              <div
                class="aulas-reservation-dates"
              >

                <div>
                  <span>Desde</span>

                  <strong>
                    ${escapeHtml(
                      formatearFechaHora(
                        reserva.fechaHoraInicio,
                      ),
                    )}
                  </strong>
                </div>


                <i
                  data-lucide="arrow-right"
                  aria-hidden="true"
                ></i>


                <div>
                  <span>Hasta</span>

                  <strong>
                    ${escapeHtml(
                      formatearFechaHora(
                        reserva.fechaHoraFin,
                      ),
                    )}
                  </strong>
                </div>

              </div>


              ${
                reserva.descripcion
                  ? `
                    <p
                      class="aulas-equipment-note"
                    >
                      ${escapeHtml(
                        reserva.descripcion,
                      )}
                    </p>
                  `
                  : ''
              }


              ${
                puedeGestionarReservas()
                  ? `
                    <div
                      class="aulas-actions"
                    >

                      <button
                        type="button"
                        class="aulas-secondary-button"
                        data-reserva-action="editar"
                        data-reserva-id="${
                          reserva.id
                        }"
                      >
                        Editar
                      </button>


                      <button
                        type="button"
                        class="
                          aulas-secondary-button
                          ${
                            reserva.activo
                              ? 'is-danger'
                              : 'is-success'
                          }
                        "
                        data-reserva-action="estado"
                        data-reserva-id="${
                          reserva.id
                        }"
                      >
                        ${
                          reserva.activo
                            ? 'Inactivar'
                            : 'Reactivar'
                        }
                      </button>

                    </div>
                  `
                  : ''
              }

            </article>
          `,
        )
        .join('')}

    </div>
  `;
}


function abrirFormularioReserva(
  reserva = null,
) {
  if (!aulaDetalleActual) {
    return;
  }

  const dialog =
    document.getElementById(
      'aulaDialog',
    );

  const content =
    document.getElementById(
      'aulaDialogContent',
    );

  if (!dialog || !content) {
    return;
  }

  const editando =
    Boolean(reserva);


  content.innerHTML =
    FormDialog({

      formId:
        'reservaAulaForm',

      title:
        editando
          ? 'Editar reserva'
          : 'Nueva reserva extraordinaria',

      description:
        'Registre una ocupación temporal del aula.',

      body: `

        <label>

          <span>Tipo</span>

          <select
            id="reservaTipo"
            required
          >
            ${Object.entries(
              TIPOS_RESERVA,
            )
              .map(
                ([valor, nombre]) => `
                  <option
                    value="${valor}"
                    ${
                      (
                        reserva?.tipo ||
                        'EXAMEN'
                      ) === valor
                        ? 'selected'
                        : ''
                    }
                  >
                    ${nombre}
                  </option>
                `,
              )
              .join('')}
          </select>

        </label>


        <label
          class="sgpa-form-wide"
        >

          <span>Título</span>

          <input
            id="reservaTitulo"
            type="text"
            maxlength="150"
            value="${escapeHtml(
              reserva?.titulo || '',
            )}"
            required
          >

        </label>


        <label>

          <span>Inicio</span>

          <input
            id="reservaInicio"
            type="datetime-local"
            value="${fechaParaInput(
              reserva?.fechaHoraInicio,
            )}"
            required
          >

        </label>


        <label>

          <span>Finalización</span>

          <input
            id="reservaFin"
            type="datetime-local"
            value="${fechaParaInput(
              reserva?.fechaHoraFin,
            )}"
            required
          >

        </label>


        <label
          class="sgpa-form-wide"
        >

          <span>Descripción</span>

          <textarea
            id="reservaDescripcion"
            rows="4"
            maxlength="500"
            placeholder="Descripción opcional"
          >${escapeHtml(
            reserva?.descripcion || '',
          )}</textarea>

        </label>

      `,

      errorId:
        'reservaAulaError',

      cancelButtonId:
        'cancelarReservaAula',

      submitButtonId:
        'guardarReservaAula',

      submitText:
        editando
          ? 'Guardar cambios'
          : 'Crear reserva',

    });


  dialog.showModal();

  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarReservaAula',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'reservaAulaForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();

        const inicio =
          document
            .getElementById(
              'reservaInicio',
            )
            ?.value;

        const fin =
          document
            .getElementById(
              'reservaFin',
            )
            ?.value;

        const titulo =
          document
            .getElementById(
              'reservaTitulo',
            )
            ?.value
            ?.trim();


        const errorBox =
          document.getElementById(
            'reservaAulaError',
          );


        if (!titulo) {
          if (errorBox) {
            errorBox.textContent =
              'El título es obligatorio.';

            errorBox.classList.remove(
              'hidden',
            );
          }

          return;
        }


        if (
          !inicio ||
          !fin ||
          fin <= inicio
        ) {
          if (errorBox) {
            errorBox.textContent =
              'La finalización debe ser posterior al inicio.';

            errorBox.classList.remove(
              'hidden',
            );
          }

          return;
        }


        const datos = {

          tipo:
            document
              .getElementById(
                'reservaTipo',
              )
              ?.value,

          titulo,

          descripcion:
            document
              .getElementById(
                'reservaDescripcion',
              )
              ?.value
              ?.trim() || '',

          fechaHoraInicio:
            normalizarFechaHoraInput(
              inicio,
            ),

          fechaHoraFin:
            normalizarFechaHoraInput(
              fin,
            ),

        };


        const boton =
          document.getElementById(
            'guardarReservaAula',
          );


        if (boton) {
          boton.disabled = true;
        }


        try {

          const resultado =
            editando
              ? await actualizarReservaAula(
                  aulaDetalleActual.id,
                  reserva.id,
                  datos,
                )
              : await crearReservaAula(
                  aulaDetalleActual.id,
                  datos,
                );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible guardar la reserva.',
            );
          }


          dialog.close();


          mostrarExito({

            titulo:
              editando
                ? 'Reserva actualizada'
                : 'Reserva creada',

            mensaje:
              editando
                ? 'La reserva fue actualizada correctamente.'
                : 'El aula quedó reservada en el horario indicado.',

          });


          await abrirDetalleAula(
            aulaDetalleActual.id,
          );

        } catch (error) {

          mostrarError({

            titulo:
              'No se pudo guardar la reserva',

            mensaje:
              error?.message ||
              'No fue posible registrar la reserva.',

          });

        } finally {

          if (boton) {
            boton.disabled = false;
          }

        }

      },
    );

  renderizarIconos();
}


async function cambiarEstadoReserva(
  reserva,
) {
  const activo =
    !reserva.activo;


  const confirmado =
    await confirmarAccion({

      titulo:
        activo
          ? 'Reactivar reserva'
          : 'Inactivar reserva',

      mensaje:
        activo
          ? `¿Desea reactivar "${reserva.titulo}"?`
          : `¿Desea inactivar "${reserva.titulo}"?`,

      textoConfirmar:
        activo
          ? 'Reactivar'
          : 'Inactivar',

      peligro:
        !activo,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await cambiarEstadoReservaAula(
        aulaDetalleActual.id,
        reserva.id,
        activo,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible cambiar el estado.',
      );
    }


    mostrarExito({

      titulo:
        activo
          ? 'Reserva reactivada'
          : 'Reserva inactivada',

      mensaje:
        'El estado fue actualizado correctamente.',

    });


    await abrirDetalleAula(
      aulaDetalleActual.id,
    );

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo cambiar el estado',

      mensaje:
        error?.message ||
          'No fue posible actualizar la reserva.',

    });

  }
}


/* =========================================================
   OCUPACIÓN (RENDER / QUERY)
   ========================================================= */

function renderizarSeccionOcupacion() {
  const rango =
    obtenerRangoOcupacionInicial();


  return `
    <section
      class="aulas-detail-card"
    >

      <div
        class="aulas-section-header"
      >

        <div>

          <h3>
            Ocupación del aula
          </h3>

          <p
            class="aulas-muted"
          >
            Consulte reservas e
            indisponibilidades que afectan
            un rango de tiempo.
          </p>

        </div>

      </div>


      <form
        id="ocupacionAulaForm"
        class="aulas-occupancy-form"
      >

        <label>

          <span>
            Desde
          </span>

          <input
            id="ocupacionInicio"
            type="datetime-local"
            value="${rango.inicio}"
            required
          >

        </label>


        <label>

          <span>
            Hasta
          </span>

          <input
            id="ocupacionFin"
            type="datetime-local"
            value="${rango.fin}"
            required
          >

        </label>


        <button
          class="aulas-primary-button"
          type="submit"
        >
          <i
            data-lucide="search"
            aria-hidden="true"
          ></i>

          Consultar
        </button>

      </form>


      <div
        id="ocupacionAulaContent"
        class="aulas-occupancy-content"
      >

        <p
          class="aulas-muted"
        >
          Consulte un rango para ver
          la ocupación registrada.
        </p>

      </div>

    </section>
  `;
}


async function cargarOcupacionAula(
  inicio,
  fin,
) {
  if (!aulaDetalleActual) {
    return;
  }


  const contenido =
    document.getElementById(
      'ocupacionAulaContent',
    );


  if (!contenido) {
    return;
  }


  contenido.innerHTML = `
    <div class="aulas-message-inline">
      Consultando ocupación...
    </div>
  `;


  try {

    const resultado =
      await consultarOcupacionAula(
        aulaDetalleActual.id,
        {
          fechaHoraInicio:
            normalizarFechaHoraInput(
              inicio,
            ),

          fechaHoraFin:
            normalizarFechaHoraInput(
              fin,
            ),
        },
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar la ocupación.',
      );
    }


    ocupacionAulaActual =
      resultado.data;


    renderizarOcupacionAula();

  } catch (error) {

    contenido.innerHTML = `
      <div
        class="
          aulas-message-inline
          aulas-error
        "
      >
        ${escapeHtml(
          error?.message ||
            'No fue posible consultar la ocupación.',
        )}
      </div>
    `;

  }
}


function renderizarOcupacionAula() {
  const contenido =
    document.getElementById(
      'ocupacionAulaContent',
    );


  if (
    !contenido ||
    !ocupacionAulaActual
  ) {
    return;
  }


  const ocupaciones =
    Array.isArray(
      ocupacionAulaActual
        .ocupaciones,
    )
      ? ocupacionAulaActual
          .ocupaciones
      : [];


  if (!ocupaciones.length) {

    contenido.innerHTML = `

      <div
        class="aulas-occupancy-free"
      >

        <i
          data-lucide="circle-check"
          aria-hidden="true"
        ></i>


        <div>

          <strong>
            Sin ocupaciones registradas
          </strong>

          <p>
            No existen reservas
            extraordinarias ni
            indisponibilidades activas
            dentro de este rango.
          </p>

        </div>

      </div>
    `;


    renderizarIconos();

    return;
  }


  contenido.innerHTML = `

    <div
      class="aulas-occupancy-summary"
    >

      <span>
        ${
          ocupaciones.length
        }
        ${
          ocupaciones.length === 1
            ? 'ocupación encontrada'
            : 'ocupaciones encontradas'
        }
      </span>

    </div>


    <div
      class="aulas-occupancy-list"
    >

      ${ocupaciones
        .map(
          (ocupacion) => `
            <article
              class="aulas-occupancy-item"
            >

              <div
                class="aulas-equipment-main"
              >

                <div>

                  <strong>
                    ${escapeHtml(
                      ocupacion.titulo,
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      nombreOrigenOcupacion(
                        ocupacion.origen,
                      ),
                    )}
                    ·
                    ${escapeHtml(
                      ocupacion.tipo ||
                        '—',
                    )}
                  </span>

                </div>


                <span
                  class="
                    aulas-occupancy-origin
                    aulas-occupancy-${String(
                      ocupacion.origen,
                    ).toLowerCase()}
                  "
                >
                  ${escapeHtml(
                    nombreOrigenOcupacion(
                      ocupacion.origen,
                    ),
                  )}
                </span>

              </div>


              <div
                class="aulas-reservation-dates"
              >

                <div>

                  <span>
                    Desde
                  </span>

                  <strong>
                    ${escapeHtml(
                      formatearFechaHora(
                        ocupacion
                          .fechaHoraInicio,
                      ),
                    )}
                  </strong>

                </div>


                <i
                  data-lucide="arrow-right"
                  aria-hidden="true"
                ></i>


                <div>

                  <span>
                    Hasta
                  </span>

                  <strong>
                    ${escapeHtml(
                      formatearFechaHora(
                        ocupacion
                          .fechaHoraFin,
                      ),
                    )}
                  </strong>

                </div>

              </div>


              ${
                ocupacion.descripcion
                  ? `
                    <p
                      class="aulas-equipment-note"
                    >
                      ${escapeHtml(
                        ocupacion.descripcion,
                      )}
                    </p>
                  `
                  : ''
              }

            </article>
          `,
        )
        .join('')}

    </div>
  `;


  renderizarIconos();
}


/* =========================================================
   FORMULARIO CREAR / EDITAR
   ========================================================= */

function abrirFormularioAula(
  aula = null,
) {
  const dialog =
    document.getElementById(
      'aulaDialog',
    );

  const content =
    document.getElementById(
      'aulaDialogContent',
    );


  if (
    !dialog ||
    !content
  ) {
    return;
  }


  const editando =
    Boolean(aula);


  content.innerHTML =
    FormDialog({

      formId:
        'aulaForm',

      title:
        editando
          ? 'Editar aula'
          : 'Nueva aula',

      description:
        editando
          ? 'Actualice la información del espacio académico.'
          : 'Registre un nuevo espacio académico.',

      body: `

        <label>

          <span>
            Código
          </span>

          <input
            id="aulaCodigo"
            type="text"
            maxlength="30"
            value="${escapeHtml(
              aula?.codigo || '',
            )}"
            required
          >

        </label>


        <label>

          <span>
            Nombre
          </span>

          <input
            id="aulaNombre"
            type="text"
            maxlength="100"
            value="${escapeHtml(
              aula?.nombre || '',
            )}"
            required
          >

        </label>


        <label
          class="sgpa-form-wide"
        >

          <span>
            Ubicación
          </span>

          <input
            id="aulaUbicacion"
            type="text"
            maxlength="150"
            value="${escapeHtml(
              aula?.ubicacion || '',
            )}"
            placeholder="Ej. Edificio principal, segundo piso"
          >

        </label>


        <label>

          <span>
            Capacidad
          </span>

          <input
            id="aulaCapacidad"
            type="number"
            min="1"
            max="65535"
            value="${escapeHtml(
              aula?.capacidad || '',
            )}"
            required
          >

        </label>


        <label>

          <span>
            Tipo
          </span>

          <select
            id="aulaTipo"
            required
          >

            ${Object.entries(
              TIPOS_AULA,
            )
              .map(
                ([valor, nombre]) => `
                  <option
                    value="${valor}"
                    ${
                      (
                        aula?.tipo ||
                        'AULA'
                      ) === valor
                        ? 'selected'
                        : ''
                    }
                  >
                    ${nombre}
                  </option>
                `,
              )
              .join('')}

          </select>

        </label>


        <label>

          <span>
            Mobiliario
          </span>

          <select
            id="aulaMobiliario"
            required
          >

            ${Object.entries(
              TIPOS_MOBILIARIO,
            )
              .map(
                ([valor, nombre]) => `
                  <option
                    value="${valor}"
                    ${
                      (
                        aula
                          ?.tipoMobiliario ||
                        'SIN_ESPECIFICAR'
                      ) === valor
                        ? 'selected'
                        : ''
                    }
                  >
                    ${nombre}
                  </option>
                `,
              )
              .join('')}

          </select>

        </label>


        <label>

          <span>
            Origen
          </span>

          <select
            id="aulaOrigen"
            required
          >

            ${Object.entries(
              ORIGENES_AULA,
            )
              .map(
                ([valor, nombre]) => `
                  <option
                    value="${valor}"
                    ${
                      (
                        aula?.origen ||
                        'UNA'
                      ) === valor
                        ? 'selected'
                        : ''
                    }
                  >
                    ${nombre}
                  </option>
                `,
              )
              .join('')}

          </select>

        </label>

      `,

      errorId:
        'aulaFormError',

      cancelButtonId:
        'cancelarAula',

      submitButtonId:
        'guardarAula',

      submitText:
        editando
          ? 'Guardar cambios'
          : 'Crear aula',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarAula',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'aulaForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const datos = {

          codigo:
            document
              .getElementById(
                'aulaCodigo',
              )
              ?.value
              ?.trim(),

          nombre:
            document
              .getElementById(
                'aulaNombre',
              )
              ?.value
              ?.trim(),

          ubicacion:
            document
              .getElementById(
                'aulaUbicacion',
              )
              ?.value
              ?.trim() || '',

          capacidad:
            Number(
              document
                .getElementById(
                  'aulaCapacidad',
                )
                ?.value,
            ),

          tipo:
            document
              .getElementById(
                'aulaTipo',
              )
              ?.value,

          tipoMobiliario:
            document
              .getElementById(
                'aulaMobiliario',
              )
              ?.value,

          origen:
            document
              .getElementById(
                'aulaOrigen',
              )
              ?.value,

        };


        if (
          !datos.capacidad ||
          datos.capacidad < 1
        ) {
          mostrarError({
            titulo:
              'Capacidad inválida',

            mensaje:
              'La capacidad debe ser mayor a cero.',
          });

          return;
        }


        if (
          editando &&
          datos.capacidad <
            aula.capacidad
        ) {

          const confirmado =
            await confirmarAccion({

              titulo:
                'Reducir capacidad del aula',

              mensaje:
                `La capacidad cambiará de ${aula.capacidad} a ${datos.capacidad}. ¿Desea continuar?`,

              textoConfirmar:
                'Reducir capacidad',

              peligro:
                true,

            });


          if (!confirmado) {
            return;
          }


          datos.confirmarReduccionCapacidad =
            true;
        }


        const boton =
          document.getElementById(
            'guardarAula',
          );


        if (boton) {
          boton.disabled =
            true;
        }


        try {

          const resultado =
            editando
              ? await actualizarAula(
                  aula.id,
                  datos,
                )
              : await crearAula(
                  datos,
                );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible guardar el aula.',
            );
          }


          dialog.close();


          mostrarExito({

            titulo:
              editando
                ? 'Aula actualizada'
                : 'Aula creada',

            mensaje:
              editando
                ? 'La información del aula fue actualizada correctamente.'
                : 'El aula fue registrada correctamente.',

          });


          await iniciarAulasPage();

        } catch (error) {

          mostrarError({

            titulo:
              'No se pudo guardar el aula',

            mensaje:
              error?.message ||
              'No fue posible guardar la información.',

          });

        } finally {

          if (boton) {
            boton.disabled =
              false;
          }

        }

      },
    );


  renderizarIconos();
}


/* =========================================================
   DISPONIBILIDAD BASE (RENDER / FORMS)
   ========================================================= */

function renderizarSeccionDisponibilidadBase() {
  return `
    <section
      class="aulas-detail-card"
    >

      <div
        class="aulas-section-header"
      >

        <div>

          <h3>
            Disponibilidad base
          </h3>

          <p
            class="aulas-muted"
          >
            Horarios en los que el aula
            puede utilizarse normalmente
            durante cada periodo académico.
          </p>

        </div>


        <select
          id="aulaPeriodoDisponibilidad"
          class="aulas-select"
        >

          ${
            periodosDisponibilidadAula.length
              ? periodosDisponibilidadAula
                  .map(
                    (periodo) => `
                      <option
                        value="${periodo.id}"
                      >
                        ${escapeHtml(
                          periodo.codigo,
                        )}
                        —
                        ${escapeHtml(
                          periodo.nombre,
                        )}
                      </option>
                    `,
                  )
                  .join('')
              : `
                <option value="">
                  Sin periodos académicos
                </option>
              `
          }

        </select>

      </div>


      <div
        id="aulaDisponibilidadBaseContent"
      >

        <p class="aulas-muted">
          Seleccione un periodo
          académico.
        </p>

      </div>

    </section>
  `;
}


function configurarDisponibilidadBaseAula() {
  const selector =
    document.getElementById(
      'aulaPeriodoDisponibilidad',
    );


  if (
    !selector ||
    !periodosDisponibilidadAula.length
  ) {
    return;
  }


  const inicial =
    seleccionarPeriodoPreferido(
      periodosDisponibilidadAula,
    );


  if (!inicial) {
    return;
  }


  selector.value =
    String(inicial.id);


  selector.addEventListener(
    'change',
    async () => {

      const periodoId =
        Number(
          selector.value,
        );


      if (periodoId) {
        await cargarDisponibilidadBaseAula(
          periodoId,
        );
      }

    },
  );


  cargarDisponibilidadBaseAula(
    inicial.id,
  );
}


async function cargarDisponibilidadBaseAula(
  periodoId,
) {
  const contenido =
    document.getElementById(
      'aulaDisponibilidadBaseContent',
    );


  if (
    !contenido ||
    !aulaDetalleActual
  ) {
    return;
  }


  contenido.innerHTML = `
    <div class="aulas-message-inline">
      Consultando disponibilidad...
    </div>
  `;


  try {

    const resultado =
      await listarDisponibilidadesAula(
        aulaDetalleActual.id,
        periodoId,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar la disponibilidad.',
      );
    }


    periodoDisponibilidadActual =
      periodosDisponibilidadAula.find(
        (periodo) =>
          periodo.id === periodoId,
      ) || null;


    disponibilidadBaseAulaActual =
      Array.isArray(
        resultado.disponibilidades,
      )
        ? resultado.disponibilidades
        : [];


    renderizarDisponibilidadBaseAula();

  } catch (error) {

    contenido.innerHTML = `
      <div
        class="
          aulas-message-inline
          aulas-error
        "
      >
        ${escapeHtml(
          error?.message ||
            'No fue posible consultar la disponibilidad.',
        )}
      </div>
    `;

  }
}


function renderizarDisponibilidadBaseAula() {
  const contenido =
    document.getElementById(
      'aulaDisponibilidadBaseContent',
    );


  if (!contenido) {
    return;
  }


  const puedeEditar =
    puedeGestionarDisponibilidadAula() &&
    aulaDetalleActual?.activo &&
    periodoPermiteEditarDisponibilidad(
      periodoDisponibilidadActual,
    );


  contenido.innerHTML = `

    <div
      class="aulas-base-availability-header"
    >

      <div>

        <span
          class="
            aulas-status
            ${
              periodoPermiteEditarDisponibilidad(
                periodoDisponibilidadActual,
              )
                ? 'is-active'
                : 'is-inactive'
            }
          "
        >
          ${
            periodoPermiteEditarDisponibilidad(
              periodoDisponibilidadActual,
            )
              ? 'Periodo editable'
              : 'Solo lectura'
          }
        </span>

      </div>


      ${
        puedeEditar
          ? `
            <button
              id="nuevoBloqueAulaButton"
              type="button"
              class="aulas-primary-button"
            >
              <i
                data-lucide="plus"
                aria-hidden="true"
              ></i>

              Agregar bloque
            </button>
          `
          : ''
      }

    </div>


    ${
      disponibilidadBaseAulaActual.length
        ? `
          <div
            class="aulas-base-availability-list"
          >

            ${disponibilidadBaseAulaActual
              .map(
                (bloque) => `
                  <div
                    class="aulas-base-availability-row"
                  >

                    <div>

                      <strong>
                        ${escapeHtml(
                          DIAS_SEMANA_AULA[
                            bloque.diaSemana
                          ],
                        )}
                      </strong>

                      <span>
                        ${escapeHtml(
                          horaCorta(
                            bloque.horaInicio,
                          ),
                        )}
                        —
                        ${escapeHtml(
                          horaCorta(
                            bloque.horaFin,
                          ),
                        )}
                      </span>

                    </div>


                    ${
                      puedeEditar
                        ? `
                          <div
                            class="aulas-actions"
                          >

                            <button
                              type="button"
                              class="aulas-icon-button"
                              data-disponibilidad-action="editar"
                              data-disponibilidad-id="${bloque.id}"
                              title="Editar bloque"
                            >
                              <i
                                data-lucide="pencil"
                                aria-hidden="true"
                              ></i>
                            </button>


                            <button
                              type="button"
                              class="
                                aulas-icon-button
                                is-danger
                              "
                              data-disponibilidad-action="eliminar"
                              data-disponibilidad-id="${bloque.id}"
                              title="Eliminar bloque"
                            >
                              <i
                                data-lucide="trash-2"
                                aria-hidden="true"
                              ></i>
                            </button>

                          </div>
                        `
                        : ''
                    }

                  </div>
                `,
              )
              .join('')}

          </div>
        `
        : `
          <div
            class="aulas-occupancy-free"
          >
            <i
              data-lucide="calendar"
              aria-hidden="true"
            ></i>

            <div>
              <strong>
                Sin disponibilidad configurada
              </strong>

              <p>
                No existen bloques base
                registrados para este periodo.
              </p>
            </div>
          </div>
        `
    }

  `;


  document
    .getElementById(
      'nuevoBloqueAulaButton',
    )
    ?.addEventListener(
      'click',
      () => {
        abrirFormularioBloqueAula();
      },
    );


  contenido
    .querySelectorAll(
      '[data-disponibilidad-action]',
    )
    .forEach(
      (boton) => {

        boton.addEventListener(
          'click',
          async () => {

            const id =
              Number(
                boton.dataset
                  .disponibilidadId,
              );


            const bloque =
              disponibilidadBaseAulaActual
                .find(
                  (item) =>
                    item.id === id,
                );


            if (!bloque) {
              return;
            }


            if (
              boton.dataset
                .disponibilidadAction ===
              'editar'
            ) {
              abrirFormularioBloqueAula(
                bloque,
              );

              return;
            }


            await confirmarEliminarBloqueAula(
              bloque,
            );

          },
        );

      },
    );


  renderizarIconos();
}


function abrirFormularioBloqueAula(
  bloque = null,
) {
  if (
    !aulaDetalleActual ||
    !periodoDisponibilidadActual
  ) {
    return;
  }


  const dialog =
    document.getElementById(
      'aulaDialog',
    );

  const content =
    document.getElementById(
      'aulaDialogContent',
    );


  if (!dialog || !content) {
    return;
  }


  const editando =
    Boolean(bloque);


  content.innerHTML =
    FormDialog({

      formId:
        'disponibilidadAulaForm',

      title:
        editando
          ? 'Editar bloque'
          : 'Agregar bloque de disponibilidad',

      description:
        `${periodoDisponibilidadActual.codigo} — ${periodoDisponibilidadActual.nombre}`,

      body: `

        <label
          class="sgpa-form-wide"
        >
          <span>
            Día
          </span>

          <select
            id="disponibilidadAulaDia"
            required
          >

            ${Object.entries(
              DIAS_SEMANA_AULA,
            )
              .map(
                ([valor, nombre]) => `
                  <option
                    value="${valor}"
                    ${
                      Number(
                        bloque?.diaSemana ||
                          1,
                      ) ===
                      Number(valor)
                        ? 'selected'
                        : ''
                    }
                  >
                    ${nombre}
                  </option>
                `,
              )
              .join('')}

          </select>
        </label>


        <label>
          <span>
            Hora inicio
          </span>

          <input
            id="disponibilidadAulaInicio"
            type="time"
            value="${escapeHtml(
              horaCorta(
                bloque?.horaInicio ||
                  '',
              ),
            )}"
            required
          >
        </label>


        <label>
          <span>
            Hora fin
          </span>

          <input
            id="disponibilidadAulaFin"
            type="time"
            value="${escapeHtml(
              horaCorta(
                bloque?.horaFin ||
                  '',
              ),
            )}"
            required
          >
        </label>

      `,

      errorId:
        'disponibilidadAulaError',

      cancelButtonId:
        'cancelarDisponibilidadAula',

      submitButtonId:
        'guardarDisponibilidadAula',

      submitText:
        editando
          ? 'Guardar cambios'
          : 'Agregar bloque',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarDisponibilidadAula',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'disponibilidadAulaForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const diaSemana =
          Number(
            document
              .getElementById(
                'disponibilidadAulaDia',
              )
              ?.value,
          );


        const horaInicio =
          document
            .getElementById(
              'disponibilidadAulaInicio',
            )
            ?.value;


        const horaFin =
          document
            .getElementById(
              'disponibilidadAulaFin',
            )
            ?.value;


        const errorBox =
          document.getElementById(
            'disponibilidadAulaError',
          );


        if (
          !horaInicio ||
          !horaFin ||
          horaFin <= horaInicio
        ) {
          if (errorBox) {
            errorBox.textContent =
              'La hora de finalización debe ser posterior a la hora de inicio.';

            errorBox.classList.remove(
              'hidden',
            );
          }

          return;
        }


        const datos = {
          diaSemana,
          horaInicio,
          horaFin,
        };


        const boton =
          document.getElementById(
            'guardarDisponibilidadAula',
          );


        if (boton) {
          boton.disabled = true;
        }


        try {

          const resultado =
            editando
              ? await actualizarDisponibilidadAula(
                  aulaDetalleActual.id,
                  bloque.id,
                  datos,
                )
              : await crearDisponibilidadAula(
                  aulaDetalleActual.id,
                  {
                    periodoId:
                      periodoDisponibilidadActual.id,

                    ...datos,
                  },
                );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible guardar el bloque.',
            );
          }


          dialog.close();


          mostrarExito({

            titulo:
              editando
                ? 'Bloque actualizado'
                : 'Bloque agregado',

            mensaje:
              'La disponibilidad base del aula fue actualizada correctamente.',

          });


          await cargarDisponibilidadBaseAula(
            periodoDisponibilidadActual.id,
          );

        } catch (error) {

          mostrarError({

            titulo:
              'No se pudo guardar el bloque',

            mensaje:
              error?.message ||
              'No fue posible actualizar la disponibilidad.',

          });

        } finally {

          if (boton) {
            boton.disabled = false;
          }

        }

      },
    );


  renderizarIconos();
}


async function confirmarEliminarBloqueAula(
  bloque,
) {
  const confirmado =
    await confirmarAccion({

      titulo:
        'Eliminar bloque',

      mensaje:
        `Se eliminará la disponibilidad del ${
          DIAS_SEMANA_AULA[
            bloque.diaSemana
          ]
        } de ${horaCorta(
          bloque.horaInicio,
        )} a ${horaCorta(
          bloque.horaFin,
        )}.`,

      textoConfirmar:
        'Eliminar',

      peligro:
        true,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await eliminarDisponibilidadAula(
        aulaDetalleActual.id,
        bloque.id,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible eliminar el bloque.',
      );
    }


    mostrarExito({

      titulo:
        'Bloque eliminado',

      mensaje:
        'La disponibilidad fue eliminada correctamente.',

    });


    await cargarDisponibilidadBaseAula(
      periodoDisponibilidadActual.id,
    );

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo eliminar',

      mensaje:
        error?.message ||
          'No fue posible eliminar el bloque.',

    });

  }
}


/* =========================================================
   CAMBIAR ESTADO
   ========================================================= */

async function cambiarEstadoAulaActual(
  aula,
) {
  const nuevoEstado =
    !aula.activo;


  const confirmado =
    await confirmarAccion({

      titulo:
        nuevoEstado
          ? 'Activar aula'
          : 'Inactivar aula',

      mensaje:
        nuevoEstado
          ? `¿Desea activar "${aula.nombre}"?`
          : `¿Desea inactivar "${aula.nombre}"?`,

      textoConfirmar:
        nuevoEstado
          ? 'Activar'
          : 'Inactivar',

      peligro:
        !nuevoEstado,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await cambiarEstadoAula(
        aula.id,
        nuevoEstado,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible cambiar el estado del aula.',
      );
    }


    mostrarExito({

      titulo:
        nuevoEstado
          ? 'Aula activada'
          : 'Aula inactivada',

      mensaje:
        `El aula fue ${
          nuevoEstado
            ? 'activada'
            : 'inactivada'
        } correctamente.`,

    });


    await iniciarAulasPage();

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo cambiar el estado',

      mensaje:
        error?.message ||
        'No fue posible actualizar el aula.',

    });

  }
}


/* =========================================================
   AUDITORÍA DEL AULA (RENDER / CONSULTA)
   ========================================================= */

function renderizarSeccionAuditoriaAula() {
  return `
    <section
      class="aulas-detail-card"
    >

      <div
        class="aulas-section-header"
      >

        <div>

          <h3>
            Auditoría
          </h3>

          <p
            class="aulas-muted"
          >
            Historial de cambios y
            operaciones realizadas
            sobre esta aula.
          </p>

        </div>


        <button
          id="cargarAuditoriaAulaButton"
          type="button"
          class="aulas-secondary-button"
        >
          <i
            data-lucide="history"
            aria-hidden="true"
          ></i>

          Ver auditoría
        </button>

      </div>


      <div
        id="auditoriaAulaContent"
      >
        <p class="aulas-muted">
          Presione "Ver auditoría"
          para consultar el historial.
        </p>
      </div>

    </section>
  `;
}


async function cargarAuditoriaAula() {
  if (
    !aulaDetalleActual ||
    !puedeConsultarAuditoriaAula()
  ) {
    return;
  }


  const contenido =
    document.getElementById(
      'auditoriaAulaContent',
    );


  if (!contenido) {
    return;
  }


  contenido.innerHTML = `
    <div
      class="aulas-message-inline"
    >
      Consultando auditoría...
    </div>
  `;


  try {

    const resultado =
      await listarAuditoriaAula(
        aulaDetalleActual.id,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar la auditoría.',
      );
    }


    auditoriaAulaActual =
      Array.isArray(
        resultado.auditoria,
      )
        ? resultado.auditoria
        : [];


    renderizarAuditoriaAula();

  } catch (error) {

    contenido.innerHTML = `
      <div
        class="
          aulas-message-inline
          aulas-error
        "
      >
        ${escapeHtml(
          error?.message ||
            'No fue posible consultar la auditoría.',
        )}
      </div>
    `;

  }
}


function renderizarAuditoriaAula() {
  const contenido =
    document.getElementById(
      'auditoriaAulaContent',
    );


  if (!contenido) {
    return;
  }


  if (
    !auditoriaAulaActual.length
  ) {
    contenido.innerHTML = `
      <div
        class="aulas-occupancy-free"
      >
        <i
          data-lucide="history"
          aria-hidden="true"
        ></i>

        <div>
          <strong>
            Sin registros
          </strong>

          <p>
            No existen movimientos
            registrados para esta aula.
          </p>
        </div>
      </div>
    `;

    renderizarIconos();

    return;
  }


  contenido.innerHTML = `
    <div
      class="aulas-audit-list"
    >

      ${auditoriaAulaActual
        .map(
          (registro) => {

            const detalle =
              detalleAuditoriaTexto(
                registro.detalle,
              );


            return `
              <article
                class="aulas-audit-item"
              >

                <div
                  class="aulas-audit-header"
                >

                  <div>

                    <strong>
                      ${escapeHtml(
                        nombreAccionAuditoria(
                          registro.accion,
                        ),
                      )}
                    </strong>

                    <span>
                      ${escapeHtml(
                        nombreEntidadAuditoria(
                          registro.entidad,
                        ),
                      )}

                      ${
                        registro.entidadId
                          ? ` #${registro.entidadId}`
                          : ''
                      }
                    </span>

                  </div>


                  <time>
                    ${escapeHtml(
                      formatearFechaHora(
                        registro.createdAt,
                      ),
                    )}
                  </time>

                </div>


                <div
                  class="aulas-audit-meta"
                >
                  <i
                    data-lucide="user"
                    aria-hidden="true"
                  ></i>

                  ${
                    registro.usuarioId
                      ? `Usuario #${escapeHtml(
                          registro.usuarioId,
                        )}`
                      : 'Sistema'
                  }
                </div>


                ${
                  detalle
                    ? `
                      <details
                        class="aulas-audit-details"
                      >
                        <summary>
                          Ver detalle del cambio
                        </summary>

                        <pre>${escapeHtml(
                          detalle,
                        )}</pre>
                      </details>
                    `
                    : ''
                }

              </article>
            `;
          },
        )
        .join('')}

    </div>
  `;


  renderizarIconos();
}


/* =========================================================
   BÚSQUEDA Y EVALUACIÓN DE AULAS DISPONIBLES
   ========================================================= */

async function abrirBusquedaAulasDisponibles() {
  const vista =
    document.getElementById(
      'aulasVista',
    );


  if (!vista) {
    return;
  }


  vista.innerHTML = `
    <div class="aulas-message">
      Preparando búsqueda...
    </div>
  `;


  try {

    const [
      resultadoPeriodos,
      resultadoEquipamientos,
    ] = await Promise.all([

      listarPeriodosAcademicos(),

      listarEquipamientos(),

    ]);


    if (!resultadoPeriodos?.ok) {
      throw new Error(
        resultadoPeriodos?.message ||
          'No fue posible consultar los periodos académicos.',
      );
    }


    if (!resultadoEquipamientos?.ok) {
      throw new Error(
        resultadoEquipamientos?.message ||
          'No fue posible consultar los equipamientos.',
      );
    }


    periodosBusquedaAulas =
      (
        Array.isArray(
          resultadoPeriodos.periodos,
        )
          ? resultadoPeriodos.periodos
          : []
      ).filter(
        (periodo) =>
          ![
            'CERRADO',
            'CANCELADO',
          ].includes(
            periodo.estado,
          ),
      );


    equipamientosBusquedaAulas =
      (
        Array.isArray(
          resultadoEquipamientos
            .equipamientos,
        )
          ? resultadoEquipamientos
              .equipamientos
          : []
      ).filter(
        (equipo) =>
          equipo.activo,
      );


    aulasDisponiblesActual = [];

    criteriosBusquedaAulasActual =
      null;


    renderizarBusquedaAulasDisponibles();

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo iniciar la búsqueda',

      mensaje:
        error?.message ||
        'No fue posible cargar la información necesaria.',

    });


    iniciarAulasPage();

  }
}


function renderizarBusquedaAulasDisponibles() {
  const vista =
    document.getElementById(
      'aulasVista',
    );


  if (!vista) {
    return;
  }


  const periodoInicial =
    seleccionarPeriodoPreferido(
      periodosBusquedaAulas,
    );


  vista.innerHTML = `

    <div
      class="aulas-detail-header"
    >

      <button
        id="volverBusquedaAulasButton"
        class="aulas-back-button"
        type="button"
      >
        <i
          data-lucide="arrow-left"
          aria-hidden="true"
        ></i>

        Volver
      </button>


      <div>

        <h2>
          Buscar aulas disponibles
        </h2>

        <p>
          Consulte espacios que cumplan
          el horario y los requisitos
          académicos indicados.
        </p>

      </div>

    </div>


    <section
      class="aulas-detail-card"
    >

      <form
        id="buscarAulasForm"
        class="aulas-search-available-form"
      >

        <label>

          <span>
            Periodo académico
          </span>

          <select
            id="buscarAulaPeriodo"
            required
          >

            ${
              periodosBusquedaAulas.length
                ? periodosBusquedaAulas
                    .map(
                      (periodo) => `
                        <option
                          value="${periodo.id}"
                          ${
                            periodoInicial
                              ?.id ===
                            periodo.id
                              ? 'selected'
                              : ''
                          }
                        >
                          ${escapeHtml(
                            periodo.codigo,
                          )}
                          —
                          ${escapeHtml(
                            periodo.nombre,
                          )}
                        </option>
                      `,
                    )
                    .join('')
                : `
                  <option
                    value=""
                    disabled
                    selected
                  >
                    Sin periodos disponibles
                  </option>
                `
            }

          </select>

        </label>


        <label>

          <span>
            Fecha
          </span>

          <input
            id="buscarAulaFecha"
            type="date"
            required
          >

        </label>


        <label>

          <span>
            Hora inicio
          </span>

          <input
            id="buscarAulaHoraInicio"
            type="time"
            required
          >

        </label>


        <label>

          <span>
            Hora fin
          </span>

          <input
            id="buscarAulaHoraFin"
            type="time"
            required
          >

        </label>


        <label>

          <span>
            Estudiantes
          </span>

          <input
            id="buscarAulaEstudiantes"
            type="number"
            min="1"
            placeholder="Opcional"
          >

        </label>


        <label>

          <span>
            Tipo de aula
          </span>

          <select
            id="buscarAulaTipo"
          >

            <option value="">
              Cualquier tipo
            </option>

            ${Object.entries(
              TIPOS_AULA,
            )
              .map(
                ([valor, nombre]) => `
                  <option
                    value="${valor}"
                  >
                    ${nombre}
                  </option>
                `,
              )
              .join('')}

          </select>

        </label>


        <label>

          <span>
            Mobiliario
          </span>

          <select
            id="buscarAulaMobiliario"
          >

            <option value="">
              Cualquier mobiliario
            </option>

            ${Object.entries(
              TIPOS_MOBILIARIO,
            )
              .map(
                ([valor, nombre]) => `
                  <option
                    value="${valor}"
                  >
                    ${nombre}
                  </option>
                `,
              )
              .join('')}

          </select>

        </label>


        <label
          class="aulas-search-checkbox"
        >

          <input
            id="buscarAulaSobrecupo"
            type="checkbox"
          >

          <span>
            Incluir aulas con
            sobrecapacidad
          </span>

        </label>


        <div
          class="
            aulas-search-equipment
            sgpa-form-wide
          "
        >

          <div
            class="aulas-section-header"
          >

            <div>

              <strong>
                Equipamiento requerido
              </strong>

              <p class="aulas-muted">
                Opcional
              </p>

            </div>


            <button
              id="agregarRequisitoEquipamientoButton"
              type="button"
              class="aulas-secondary-button"
            >
              <i
                data-lucide="plus"
                aria-hidden="true"
              ></i>

              Agregar requisito
            </button>

          </div>


          <div
            id="requisitosEquipamientoAula"
            class="aulas-search-equipment-list"
          ></div>

        </div>


        <div
          class="
            aulas-search-submit
            sgpa-form-wide
          "
        >

          <button
            type="submit"
            class="aulas-primary-button"
          >

            <i
              data-lucide="search"
              aria-hidden="true"
            ></i>

            Buscar aulas

          </button>

        </div>

      </form>

    </section>


    <section
      class="aulas-detail-card"
    >

      <div
        class="aulas-section-header"
      >

        <div>

          <h3>
            Resultados
          </h3>

          <p
            id="buscarAulasResumen"
            class="aulas-muted"
          >
            Complete los criterios
            y ejecute una búsqueda.
          </p>

        </div>

      </div>


      <div
        id="buscarAulasResultados"
      ></div>

    </section>

  `;


  document
    .getElementById(
      'volverBusquedaAulasButton',
    )
    ?.addEventListener(
      'click',
      iniciarAulasPage,
    );


  document
    .getElementById(
      'agregarRequisitoEquipamientoButton',
    )
    ?.addEventListener(
      'click',
      () => {
        agregarRequisitoEquipamientoBusqueda();
      },
    );


  document
    .getElementById(
      'buscarAulaPeriodo',
    )
    ?.addEventListener(
      'change',
      actualizarLimitesFechaBusquedaAula,
    );


  document
    .getElementById(
      'buscarAulasForm',
    )
    ?.addEventListener(
      'submit',
      ejecutarBusquedaAulasDisponibles,
    );


  actualizarLimitesFechaBusquedaAula();


  renderizarIconos();
}


function actualizarLimitesFechaBusquedaAula() {
  const selector =
    document.getElementById(
      'buscarAulaPeriodo',
    );

  const inputFecha =
    document.getElementById(
      'buscarAulaFecha',
    );


  if (
    !selector ||
    !inputFecha
  ) {
    return;
  }


  const periodoId =
    Number(
      selector.value,
    );


  const periodo =
    periodosBusquedaAulas.find(
      (item) =>
        item.id === periodoId,
    );


  if (!periodo) {
    return;
  }


  inputFecha.min =
    periodo.fechaInicio;

  inputFecha.max =
    periodo.fechaFin;


  if (
    !inputFecha.value ||
    inputFecha.value <
      periodo.fechaInicio ||
    inputFecha.value >
      periodo.fechaFin
  ) {
    inputFecha.value =
      periodo.fechaInicio;
  }
}


function agregarRequisitoEquipamientoBusqueda() {
  const contenedor =
    document.getElementById(
      'requisitosEquipamientoAula',
    );


  if (!contenedor) {
    return;
  }


  if (
    !equipamientosBusquedaAulas.length
  ) {
    mostrarError({

      titulo:
        'Sin equipamientos',

      mensaje:
        'No existen equipamientos activos disponibles para usar como requisito.',

    });

    return;
  }


  const fila =
    document.createElement(
      'div',
    );


  fila.className =
    'aulas-search-equipment-row';


  fila.innerHTML = `

    <select
      data-requisito-equipamiento
      required
    >

      <option
        value=""
        selected
        disabled
      >
        Seleccione equipamiento...
      </option>


      ${equipamientosBusquedaAulas
        .map(
          (equipo) => `
            <option
              value="${equipo.id}"
            >
              ${escapeHtml(
                equipo.nombre,
              )}
            </option>
          `,
        )
        .join('')}

    </select>


    <input
      data-requisito-cantidad
      type="number"
      min="1"
      value="1"
      required
      aria-label="Cantidad mínima"
    >


    <button
      type="button"
      class="
        aulas-icon-button
        is-danger
      "
      title="Eliminar requisito"
    >
      <i
        data-lucide="trash-2"
        aria-hidden="true"
      ></i>
    </button>

  `;


  fila
    .querySelector(
      'button',
    )
    ?.addEventListener(
      'click',
      () => {
        fila.remove();
      },
    );


  contenedor.appendChild(
    fila,
  );


  renderizarIconos();
}


function construirCriteriosBusquedaAulas() {
  const periodoId =
    Number(
      document
        .getElementById(
          'buscarAulaPeriodo',
        )
        ?.value,
    );


  const fecha =
    document
      .getElementById(
        'buscarAulaFecha',
      )
      ?.value;


  const horaInicio =
    document
      .getElementById(
        'buscarAulaHoraInicio',
      )
      ?.value;


  const horaFin =
    document
      .getElementById(
        'buscarAulaHoraFin',
      )
      ?.value;


  if (
    !periodoId ||
    !fecha ||
    !horaInicio ||
    !horaFin
  ) {
    throw new Error(
      'Debe indicar periodo, fecha y horario.',
    );
  }


  if (
    horaFin <= horaInicio
  ) {
    throw new Error(
      'La hora de finalización debe ser posterior a la hora de inicio.',
    );
  }


  const filas =
    [
      ...document.querySelectorAll(
        '.aulas-search-equipment-row',
      ),
    ];


  const equipamientos =
    filas.map(
      (fila) => ({

        equipamientoId:
          Number(
            fila.querySelector(
              '[data-requisito-equipamiento]',
            )?.value,
          ),

        cantidadMinima:
          Number(
            fila.querySelector(
              '[data-requisito-cantidad]',
            )?.value,
          ),

      }),
    );


  const ids =
    new Set();


  for (
    const requisito of
    equipamientos
  ) {

    if (
      !requisito.equipamientoId ||
      requisito.cantidadMinima < 1
    ) {
      throw new Error(
        'Revise los requisitos de equipamiento.',
      );
    }


    if (
      ids.has(
        requisito.equipamientoId,
      )
    ) {
      throw new Error(
        'No puede agregar dos veces el mismo equipamiento.',
      );
    }


    ids.add(
      requisito.equipamientoId,
    );

  }


  const criterios = {

    periodoId,

    fechaHoraInicio:
      `${fecha}T${horaInicio}:00`,

    fechaHoraFin:
      `${fecha}T${horaFin}:00`,

    incluirSobrecupo:
      document
        .getElementById(
          'buscarAulaSobrecupo',
        )
        ?.checked === true,

  };


  const cantidadEstudiantes =
    Number(
      document
        .getElementById(
          'buscarAulaEstudiantes',
        )
        ?.value,
    );


  if (cantidadEstudiantes > 0) {
    criterios.cantidadEstudiantes =
      cantidadEstudiantes;
  }


  const tipo =
    document
      .getElementById(
        'buscarAulaTipo',
      )
      ?.value;


  if (tipo) {
    criterios.tipo =
      tipo;
  }


  const tipoMobiliario =
    document
      .getElementById(
        'buscarAulaMobiliario',
      )
      ?.value;


  if (tipoMobiliario) {
    criterios.tipoMobiliario =
      tipoMobiliario;
  }


  if (equipamientos.length) {
    criterios.equipamientos =
      equipamientos;
  }


  return criterios;
}


async function ejecutarBusquedaAulasDisponibles(
  event,
) {
  event.preventDefault();


  const resultados =
    document.getElementById(
      'buscarAulasResultados',
    );


  if (!resultados) {
    return;
  }


  try {

    const criterios =
      construirCriteriosBusquedaAulas();


    criteriosBusquedaAulasActual =
      criterios;


    resultados.innerHTML = `
      <div
        class="aulas-message-inline"
      >
        Buscando aulas disponibles...
      </div>
    `;


    const resultado =
      await buscarAulasDisponibles(
        criterios,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible buscar aulas disponibles.',
      );
    }


    aulasDisponiblesActual =
      Array.isArray(
        resultado.aulas,
      )
        ? resultado.aulas
        : [];


    renderizarResultadosBusquedaAulas();

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo realizar la búsqueda',

      mensaje:
        error?.message ||
        'Revise los criterios ingresados.',

    });

  }
}


function renderizarResultadosBusquedaAulas() {
  const contenido =
    document.getElementById(
      'buscarAulasResultados',
    );

  const resumen =
    document.getElementById(
      'buscarAulasResumen',
    );


  if (!contenido) {
    return;
  }


  if (resumen) {
    resumen.textContent =
      aulasDisponiblesActual.length === 1
        ? '1 aula disponible encontrada.'
        : `${aulasDisponiblesActual.length} aulas disponibles encontradas.`;
  }


  const puedeEvaluar =
    puedeEvaluarAsignacionAula();


  const filas =
    aulasDisponiblesActual
      .map(
        (aula) => {

          const equipos =
            (
              aula.equipamientos ||
              []
            )
              .filter(
                (relacion) =>
                  relacion.activo &&
                  relacion
                    .equipamiento
                    ?.activo,
              )
              .map(
                (relacion) =>
                  `${relacion.equipamiento.nombre} (${relacion.cantidadDisponible})`,
              );


          return `
            <tr>

              <td>

                <div
                  class="aulas-name"
                >

                  <strong>
                    ${escapeHtml(
                      aula.codigo,
                    )}
                    —
                    ${escapeHtml(
                      aula.nombre,
                    )}
                  </strong>

                  <small>
                    ${escapeHtml(
                      aula.ubicacion ||
                        'Sin ubicación',
                    )}
                  </small>

                </div>

              </td>


              <td>
                ${escapeHtml(
                  nombreTipoAula(
                    aula.tipo,
                  ),
                )}
              </td>


              <td>
                ${escapeHtml(
                  nombreMobiliario(
                    aula.tipoMobiliario,
                  ),
                )}
              </td>


              <td>
                ${aula.capacidad}
              </td>


              <td>
                ${
                  aula.capacidadSobrante ===
                  null
                    ? '—'
                    : aula.capacidadSobrante
                }
              </td>


              <td>

                <span
                  class="
                    aulas-capacity-badge
                    aulas-capacity-${String(
                      aula.recomendacionCapacidad ||
                        'none',
                    ).toLowerCase()}
                  "
                >
                  ${escapeHtml(
                    nombreRecomendacionCapacidad(
                      aula.recomendacionCapacidad,
                    ),
                  )}
                </span>

              </td>


              <td>
                ${
                  equipos.length
                    ? escapeHtml(
                        equipos.join(
                          ', ',
                        ),
                      )
                    : '—'
                }
              </td>


              <td>

                <div
                  class="aulas-actions"
                >

                  <button
                    type="button"
                    class="aulas-icon-button"
                    data-busqueda-action="ver"
                    data-aula-id="${
                      aula.id
                    }"
                    title="Ver aula"
                  >
                    <i
                      data-lucide="eye"
                      aria-hidden="true"
                    ></i>
                  </button>


                  ${
                    puedeEvaluar
                      ? `
                        <button
                          type="button"
                          class="aulas-secondary-button"
                          data-busqueda-action="evaluar"
                          data-aula-id="${aula.id}"
                        >
                          Evaluar
                        </button>
                      `
                      : ''
                  }

                </div>

              </td>

            </tr>
          `;

        },
      )
      .join('');


  contenido.innerHTML =
    DataTable({

      columns: [
        'Aula',
        'Tipo',
        'Mobiliario',
        'Capacidad',
        'Sobrante',
        'Recomendación',
        'Equipamiento',
        'Acciones',
      ],

      rows:
        filas,

      emptyMessage:
        'No existen aulas que cumplan todos los criterios indicados.',

      ariaLabel:
        'Aulas disponibles',

    });


  contenido
    .querySelectorAll(
      '[data-busqueda-action]',
    )
    .forEach(
      (boton) => {

        boton.addEventListener(
          'click',
          async () => {

            const aulaId =
              Number(
                boton.dataset.aulaId,
              );


            if (
              boton.dataset
                .busquedaAction ===
              'ver'
            ) {
              await abrirDetalleAula(
                aulaId,
              );

              return;
            }


            await evaluarAulaDisponible(
              aulaId,
            );

          },
        );

      },
    );


  renderizarIconos();
}


async function evaluarAulaDisponible(
  aulaId,
) {
  if (
    !criteriosBusquedaAulasActual
  ) {
    return;
  }


  try {

    const resultado =
      await evaluarAulaParaAsignacion(
        aulaId,
        criteriosBusquedaAulasActual,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible evaluar el aula.',
      );
    }


    const evaluacion =
      resultado.data;


    if (
      evaluacion
        .requiereAutorizacionSobrecupo
    ) {

      mostrarError({

        titulo:
          'Requiere autorización de sobrecupo',

        mensaje:
          `El aula tiene capacidad para ${evaluacion.capacidad} personas y se indicaron ${evaluacion.cantidadEstudiantes} estudiantes.`,

      });

      return;
    }


    if (!evaluacion.apta) {

      mostrarError({

        titulo:
          'Aula no apta',

        mensaje:
          'El aula ya no está disponible o no cumple todos los requisitos indicados.',

      });

      return;
    }


    const advertencias =
      Array.isArray(
        evaluacion.advertencias,
      )
        ? evaluacion.advertencias
        : [];


    mostrarExito({

      titulo:
        'Aula apta',

      mensaje:
        advertencias.length
          ? advertencias.join(' ')
          : 'El aula cumple los requisitos para el horario indicado.',

    });

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo evaluar el aula',

      mensaje:
        error?.message ||
        'No fue posible completar la evaluación.',

    });

  }
}


/* =========================================================
   INICIALIZADOR
   ========================================================= */

export function iniciarAulasPage() {
  instanciaActual += 1;

  const instancia =
    instanciaActual;


  renderizarVistaListado();


  cargarAulas(
    instancia,
  );
}
