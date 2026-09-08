import { escapeHtml } from "../../utils/html.js";
import { DataTable } from "../../components/DataTable.js";

/* =========================================================
   HELPERS
   ========================================================= */

export function obtenerCreditosCurso(curso, asignaturaPlan = null) {
  const valor =
    asignaturaPlan?.creditos ??
    curso?.creditos ??
    curso?.planAsignatura?.creditos ??
    0;

  return Number(valor || 0);
}

export function obtenerCarreraCursoIds(curso) {
  if (!Array.isArray(curso?.carreras)) {
    return [];
  }

  return curso.carreras
    .map((carrera) => Number(carrera.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export function cursoPerteneceACarrera(
  curso,
  carreraId,
  asignaturasPlan = [],
) {
  const id = Number(carreraId);

  if (!Number.isInteger(id) || id < 1) {
    return false;
  }

  if (obtenerCarreraCursoIds(curso).includes(id)) {
    return true;
  }

  return asignaturasPlan.some((asignatura) => {
    if (
      asignatura?.cursoId !== null &&
      asignatura?.cursoId !== undefined
    ) {
      return Number(asignatura.cursoId) === Number(curso.id);
    }

    const codigoAsignatura =
      asignatura?.codigoReferencia ||
      asignatura?.curso?.codigo ||
      "";

    return (
      codigoAsignatura &&
      String(codigoAsignatura).toUpperCase() ===
        String(curso?.codigo || "").toUpperCase()
    );
  });
}

export function encontrarAsignaturaPlanCurso(
  curso,
  asignaturasPlan = [],
) {
  const porId = asignaturasPlan.find(
    (asignatura) =>
      Number(asignatura?.cursoId) === Number(curso?.id),
  );

  if (porId) {
    return porId;
  }

  const codigoCurso =
    String(curso?.codigo || "")
      .trim()
      .toUpperCase();

  if (!codigoCurso) {
    return null;
  }

  return (
    asignaturasPlan.find((asignatura) => {
      const codigo =
        asignatura?.codigoReferencia ||
        asignatura?.curso?.codigo ||
        "";

      return (
        String(codigo).trim().toUpperCase() ===
        codigoCurso
      );
    }) || null
  );
}

export function obtenerRequisitosCurso(
  curso,
  asignaturasPlan = [],
  requisitosPlan = [],
) {
  const asignatura =
    encontrarAsignaturaPlanCurso(
      curso,
      asignaturasPlan,
    );

  if (!asignatura) {
    return [];
  }

  return requisitosPlan
    .filter(
      (relacion) =>
        Number(relacion.asignaturaId) ===
        Number(asignatura.id),
    )
    .map((relacion) => {
      const requisito =
        asignaturasPlan.find(
          (item) =>
            Number(item.id) ===
            Number(
              relacion.requisitoAsignaturaId,
            ),
        ) ||
        relacion.requisitoAsignatura ||
        null;

      const codigo =
        requisito?.codigoReferencia ||
        requisito?.curso?.codigo ||
        "SIN CÓDIGO";

      const nombre =
        requisito?.nombreReferencia ||
        requisito?.curso?.nombre ||
        "Asignatura no disponible";

      return {
        relacionId: relacion.id,
        tipo:
          relacion.tipo === "CORREQUISITO"
            ? "CORREQUISITO"
            : "REQUISITO",
        codigo,
        nombre,
        creditos:
          Number(requisito?.creditos || 0),
        nivel:
          requisito?.nivel ?? null,
        ciclo:
          requisito?.ciclo ?? null,
      };
    });
}

/* =========================================================
   CARDS DE CARRERA
   ========================================================= */

export function CarrerasCursosCards({
  carreras = [],
  cursos = [],
  carreraSeleccionadaId = null,
}) {
  const activas = carreras
    .filter((carrera) => carrera.activo === true)
    .slice()
    .sort((a, b) =>
      String(a.nombre || "").localeCompare(
        String(b.nombre || ""),
        "es",
      ),
    );

  if (activas.length === 0) {
    return `
      <div class="cursos-message">
        No hay carreras activas disponibles.
      </div>
    `;
  }

  return `
    <section class="cursos-careers-section">
      <div class="cursos-section-heading">
        <div>
          <span class="cursos-section-eyebrow">
            CARRERAS
          </span>

          <h3>
            Seleccione una carrera
          </h3>

          <p>
            La carrera seleccionada funciona como filtro
            del catálogo de cursos.
          </p>
        </div>
      </div>

      <div class="cursos-career-grid">
        ${activas
          .map((carrera) => {
            const cantidad = cursos.filter((curso) =>
              obtenerCarreraCursoIds(curso).includes(
                Number(carrera.id),
              ),
            ).length;

            const seleccionada =
              Number(carreraSeleccionadaId) ===
              Number(carrera.id);

            return `
              <button
                class="
                  cursos-career-card
                  ${seleccionada ? "is-selected" : ""}
                "
                type="button"
                data-curso-carrera="${carrera.id}"
                aria-pressed="${
                  seleccionada ? "true" : "false"
                }"
              >
                <span
                  class="cursos-career-card-decoration"
                  aria-hidden="true"
                ></span>

                <div class="cursos-career-card-icon">
                  <i
                    data-lucide="graduation-cap"
                    aria-hidden="true"
                  ></i>
                </div>

                <div class="cursos-career-card-main">
                  <strong>
                    ${escapeHtml(carrera.nombre)}
                  </strong>

                  <small>
                    ${escapeHtml(
                      carrera.codigo || "SIN CÓDIGO",
                    )}
                  </small>
                </div>

                <div class="cursos-career-card-footer">
                  <span>
                    ${cantidad}
                    curso${cantidad === 1 ? "" : "s"}
                  </span>

                  ${
                    seleccionada
                      ? `
                          <span class="cursos-career-selected">
                            <i
                              data-lucide="check"
                              aria-hidden="true"
                            ></i>
                            Seleccionada
                          </span>
                        `
                      : `
                          <span class="cursos-career-open">
                            Ver cursos
                          </span>
                        `
                  }
                </div>

                <span
                  class="cursos-career-card-line"
                  aria-hidden="true"
                ></span>
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

/* =========================================================
   ENCABEZADO DEL CATÁLOGO
   ========================================================= */

export function CursosCatalogoHeading({
  carrera,
  plan = null,
  cantidad = 0,
}) {
  if (!carrera) {
    return "";
  }

  return `
    <div class="cursos-catalog-heading">
      <div>
        <span class="cursos-section-eyebrow">
          CATÁLOGO DE CURSOS
        </span>

        <h3>
          ${escapeHtml(carrera.nombre)}
        </h3>

        <p>
          ${cantidad}
          curso${cantidad === 1 ? "" : "s"}
          registrado${cantidad === 1 ? "" : "s"}
          ${
            plan
              ? ` · Requisitos según ${escapeHtml(
                  plan.nombre,
                )}`
              : " · Sin plan activo para consultar requisitos"
          }
        </p>
      </div>

      ${
        carrera.codigo
          ? `
              <span class="cursos-catalog-code">
                ${escapeHtml(carrera.codigo)}
              </span>
            `
          : ""
      }
    </div>
  `;
}

/* =========================================================
   TABLA
   ========================================================= */

function renderizarRequisitosTabla(
  requisitos = [],
  curso,
) {
  if (requisitos.length === 0) {
    return `
      <span class="curso-no-requirements">
        Sin requisitos
      </span>
    `;
  }

  return `
    <div class="curso-requirements">
      ${requisitos
        .map(
          (requisito, indice) => `
            <button
              class="
                curso-requirement-badge
                ${
                  requisito.tipo === "CORREQUISITO"
                    ? "is-corequisite"
                    : ""
                }
              "
              type="button"
              data-requisito-curso="${curso.id}"
              data-requisito-indice="${indice}"
              title="${
                requisito.tipo === "CORREQUISITO"
                  ? "Ver correquisito"
                  : "Ver requisito"
              }: ${escapeHtml(requisito.nombre)}"
            >
              ${escapeHtml(requisito.codigo)}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

export function CursosTabla({
  cursos = [],
  asignaturasPlan = [],
  requisitosPlan = [],
}) {
  const filas = cursos
    .map((curso) => {
      const asignaturaPlan =
        encontrarAsignaturaPlanCurso(
          curso,
          asignaturasPlan,
        );

      const requisitos =
        obtenerRequisitosCurso(
          curso,
          asignaturasPlan,
          requisitosPlan,
        );

      const creditos =
        obtenerCreditosCurso(
          curso,
          asignaturaPlan,
        );

      return `
        <tr>
          <td>
            <strong class="curso-code">
              ${escapeHtml(curso.codigo)}
            </strong>
          </td>

          <td>
            <div class="curso-name">
              <strong>
                ${escapeHtml(curso.nombre)}
              </strong>

              ${
                curso.descripcion
                  ? `
                      <small>
                        ${escapeHtml(curso.descripcion)}
                      </small>
                    `
                  : ""
              }
            </div>
          </td>

          <td>
            <span class="curso-credits">
              ${creditos}
            </span>
          </td>

          <td>
            ${renderizarRequisitosTabla(
              requisitos,
              curso,
            )}
          </td>

          <td>
            <span
              class="
                curso-status
                ${
                  curso.activo
                    ? "curso-status-active"
                    : "curso-status-inactive"
                }
              "
            >
              ${
                curso.activo
                  ? "Activo"
                  : "Inactivo"
              }
            </span>
          </td>

          <td class="cursos-actions">
            <button
              class="cursos-icon-button"
              data-action="editar"
              data-id="${curso.id}"
              type="button"
              title="Editar curso"
              aria-label="Editar ${escapeHtml(
                curso.nombre,
              )}"
            >
              <i
                data-lucide="pencil"
                aria-hidden="true"
              ></i>
            </button>

            <button
              class="
                cursos-icon-button
                ${
                  curso.activo
                    ? "cursos-danger-button"
                    : "cursos-success-button"
                }
              "
              data-action="estado"
              data-id="${curso.id}"
              type="button"
              title="${
                curso.activo
                  ? "Desactivar curso"
                  : "Activar curso"
              }"
              aria-label="${
                curso.activo
                  ? "Desactivar"
                  : "Activar"
              } ${escapeHtml(curso.nombre)}"
            >
              <i
                data-lucide="${
                  curso.activo
                    ? "circle-pause"
                    : "circle-check"
                }"
                aria-hidden="true"
              ></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  return DataTable({
    columns: [
      "Código",
      "Nombre",
      "Créditos",
      "Requisitos",
      "Estado",
      "Acciones",
    ],
    rows: filas,
    emptyMessage:
      "No se encontraron cursos con los filtros seleccionados.",
    ariaLabel:
      "Listado de cursos de la carrera seleccionada",
  });
}

/* =========================================================
   MODAL PEQUEÑO DE REQUISITO
   ========================================================= */

export function abrirDetalleRequisito({
  requisito,
  curso,
}) {
  const dialog =
    document.getElementById(
      "cursoRequisitoDialog",
    );

  const content =
    document.getElementById(
      "cursoRequisitoDialogContent",
    );

  if (!dialog || !content || !requisito) {
    return;
  }

  const esCorrequisito =
    requisito.tipo === "CORREQUISITO";

  content.innerHTML = `
    <div class="curso-requirement-modal-card">
      <button
        id="cerrarCursoRequisito"
        class="curso-requirement-modal-close"
        type="button"
        aria-label="Cerrar"
      >
        <i
          data-lucide="x"
          aria-hidden="true"
        ></i>
      </button>

      <span class="curso-requirement-modal-eyebrow">
        ${
          esCorrequisito
            ? "CORREQUISITO ACADÉMICO"
            : "REQUISITO ACADÉMICO"
        }
      </span>

      <div class="curso-requirement-modal-code">
        ${escapeHtml(requisito.codigo)}
      </div>

      <h3>
        ${escapeHtml(requisito.nombre)}
      </h3>

      <div class="curso-requirement-modal-meta">
        ${
          requisito.creditos !== null &&
          requisito.creditos !== undefined
            ? `
                <span>
                  ${Number(requisito.creditos || 0)}
                  créditos
                </span>
              `
            : ""
        }

        ${
          requisito.nivel
            ? `
                <span>
                  Nivel ${escapeHtml(requisito.nivel)}
                </span>
              `
            : ""
        }

        ${
          requisito.ciclo
            ? `
                <span>
                  Ciclo ${escapeHtml(requisito.ciclo)}
                </span>
              `
            : ""
        }
      </div>

      <p>
        ${
          esCorrequisito
            ? "Esta asignatura debe cursarse de forma simultánea con"
            : "Esta asignatura debe aprobarse antes de cursar"
        }
        <strong>
          ${escapeHtml(curso?.nombre || "el curso seleccionado")}
        </strong>.
      </p>

      <button
        id="cerrarCursoRequisitoFooter"
        class="curso-requirement-modal-button"
        type="button"
      >
        Entendido
      </button>
    </div>
  `;

  const cerrar = () => dialog.close();

  document
    .getElementById("cerrarCursoRequisito")
    ?.addEventListener("click", cerrar);

  document
    .getElementById("cerrarCursoRequisitoFooter")
    ?.addEventListener("click", cerrar);

  dialog.onclick = (event) => {
    if (event.target === dialog) {
      cerrar();
    }
  };

  if (!dialog.open) {
    dialog.showModal();
  }
}
