/**
 * SGPA — Vista y renderizado interactivo de la Malla Curricular con rutas SVG.
 */

import { escapeHtml } from "../../utils/html.js";
import {
  calcularRutasTroncales,
  construirPathRedondeado as construirPathTroncal,
  expandirRectangulo,
} from "./malla-routing.mjs";
import {
  agruparMallaPorNivel,
  obtenerAsignaturaMallaSeleccionada,
  obtenerDatosAsignatura,
  obtenerIdsRutaMalla,
  obtenerPresentacionTipoAsignatura,
  obtenerRequisitosDeAsignatura,
  obtenerTiposRutaMalla,
  rectanguloRelativoMalla,
} from "./planes.helpers.js";

export function renderizarTarjetaMalla(asignatura, contexto) {
  const estado = contexto.estado;
  const datos = obtenerDatosAsignatura(asignatura);
  const requisitos = obtenerRequisitosDeAsignatura(
    asignatura.id,
    estado.requisitosPlan,
  );
  const cantidadRequisitos = requisitos.filter(
    (item) => item.tipo === "REQUISITO",
  ).length;
  const cantidadCorrequisitos = requisitos.filter(
    (item) => item.tipo === "CORREQUISITO",
  ).length;
  const creditos = Number(asignatura.creditos || 0);
  const presentacionTipo = obtenerPresentacionTipoAsignatura(asignatura);
  const seleccionada =
    Number(asignatura.id) === Number(estado.mallaAsignaturaSeleccionadaId);
  const idsRuta = obtenerIdsRutaMalla(
    estado.mallaAsignaturaSeleccionadaId,
    estado.requisitosPlan,
  );
  const perteneceRuta = idsRuta.has(Number(asignatura.id));
  const tiposRuta = obtenerTiposRutaMalla(
    estado.mallaAsignaturaSeleccionadaId,
    estado.requisitosPlan,
  ).get(Number(asignatura.id));

  return `
    <article
      class="malla-card malla-card-type-${presentacionTipo.clase} ${
        asignatura.activo ? "" : "malla-card-inactive"
      } ${seleccionada ? "is-selected" : ""} ${
        !seleccionada && perteneceRuta ? "is-route" : ""
      } ${
        estado.mallaAsignaturaSeleccionadaId && !perteneceRuta ? "is-muted" : ""
      } ${tiposRuta?.has("REQUISITO") ? "is-requirement" : ""} ${
        tiposRuta?.has("CORREQUISITO") ? "is-corequisite" : ""
      }"
      data-malla-asignatura="${asignatura.id}"
      tabindex="0"
      role="button"
      title="Mostrar requisitos directos de esta asignatura"
      aria-label="Mostrar requisitos directos de ${escapeHtml(datos.nombre)}"
      aria-pressed="${seleccionada}"
    >
      <span class="malla-card-decoration" aria-hidden="true"></span>

      <div class="malla-card-top">
        <strong>${escapeHtml(datos.codigo || asignatura.tipo)}</strong>
        <span class="malla-card-credits">${creditos} cr.</span>
      </div>

      <div class="malla-card-name">${escapeHtml(datos.nombre)}</div>

      <span
        class="malla-card-type-badge is-${presentacionTipo.clase}"
        title="${escapeHtml(presentacionTipo.detalle)}"
      >
        ${escapeHtml(presentacionTipo.etiqueta)}
      </span>

      <div class="malla-card-footer">
        <div class="malla-card-relations">
          ${
            cantidadRequisitos > 0
              ? `<span class="malla-requirement-badge">${cantidadRequisitos} req.</span>`
              : ""
          }
          ${
            cantidadCorrequisitos > 0
              ? `<span class="malla-coreq-badge">${cantidadCorrequisitos} correq.</span>`
              : ""
          }
          ${
            cantidadRequisitos === 0 && cantidadCorrequisitos === 0
              ? `<span class="malla-card-no-relations">Sin requisitos</span>`
              : ""
          }
        </div>

        <button
          class="malla-card-eye"
          data-malla-eye="${asignatura.id}"
          type="button"
          title="Ver requisitos"
          aria-label="Ver requisitos de ${escapeHtml(datos.nombre)}"
        >
          <i data-lucide="eye" aria-hidden="true"></i>
        </button>
      </div>

      <span class="malla-card-hover-line" aria-hidden="true"></span>
    </article>
  `;
}

export function renderizarColumnasMalla(asignaturas, contexto) {
  return agruparMallaPorNivel(asignaturas)
    .map((grupoNivel) => {
      const renderizarCiclo = (ciclo) => {
        const asignaturasCiclo = grupoNivel.ciclos.get(ciclo) || [];

        return `
          <section
            class="malla-cycle-column"
            data-malla-nivel="${grupoNivel.nivel}"
            data-malla-ciclo="${ciclo}"
          >
            <header class="malla-cycle-header">
              Ciclo ${ciclo}
            </header>

            <div class="malla-column-body">
              ${
                asignaturasCiclo.length
                  ? asignaturasCiclo
                      .map((asig) => renderizarTarjetaMalla(asig, contexto))
                      .join("")
                  : `<div class="malla-cycle-empty">Sin asignaturas</div>`
              }
            </div>
          </section>
        `;
      };

      return `
        <section class="malla-level-group" data-malla-level="${grupoNivel.nivel}">
          <header class="malla-level-header">
            NIVEL ${grupoNivel.nivel}
          </header>

          <div class="malla-level-cycles">
            ${renderizarCiclo(1)}
            ${renderizarCiclo(2)}
          </div>
        </section>
      `;
    })
    .join("");
}

export function renderizarResumenSeleccionMalla(contexto) {
  const asignatura = obtenerAsignaturaMallaSeleccionada(
    contexto.estado.mallaAsignaturaSeleccionadaId,
    contexto.estado.asignaturasPlan,
  );

  if (!asignatura) {
    return `
      <span class="malla-selection-empty">
        Seleccione una asignatura para visualizar únicamente sus requisitos y correquisitos directos.
      </span>
    `;
  }

  const datos = obtenerDatosAsignatura(asignatura);

  return `
    <span class="malla-selection-label">Asignatura seleccionada:</span>
    <strong class="malla-selection-chip">
      ${escapeHtml(datos.codigo || "")}
      <span>${escapeHtml(datos.nombre)}</span>
    </strong>
  `;
}

export function renderizarMallaCurricular(contexto, renderSalidas = () => "") {
  const asignaturas = contexto.estado.asignaturasPlan;

  if (!asignaturas || asignaturas.length === 0) {
    return `
      <div class="planes-message">
        No hay asignaturas para mostrar en esta malla.
      </div>
    `;
  }

  return `
    ${renderSalidas()}

    <section class="malla-workspace">
      <header class="malla-workspace-heading">
        <div class="malla-workspace-title">
          <span class="malla-workspace-icon">
            <i data-lucide="book-open" aria-hidden="true"></i>
          </span>
          <strong>Malla curricular</strong>
        </div>
      </header>

      <div class="malla-toolbar">
        <div class="malla-legend" aria-label="Tipos de conexión">
          <span>
            <i class="malla-legend-line" aria-hidden="true"></i>
            Requisito
          </span>
          <span>
            <i
              class="malla-legend-line malla-legend-dashed"
              aria-hidden="true"
            ></i>
            Correquisito
          </span>
        </div>

        <div id="mallaSeleccionResumen" class="malla-selection-summary">
          ${renderizarResumenSeleccionMalla(contexto)}
        </div>
      </div>

      <div id="mallaScroll" class="malla-scroll">
        <div id="mallaCanvas" class="malla-canvas">
          <svg
            id="mallaConnections"
            class="malla-connections"
            aria-hidden="true"
          ></svg>
          <div class="malla-plan-grid">
            ${renderizarColumnasMalla(asignaturas, contexto)}
          </div>
        </div>
      </div>
    </section>
  `;
}

export function dibujarConexionesMalla(contexto) {
  const canvas = document.getElementById("mallaCanvas");
  const svg = document.getElementById("mallaConnections");

  if (!canvas || !svg) {
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const ancho = Math.max(1, Math.ceil(canvas.clientWidth));
  const alto = Math.max(1, Math.ceil(canvas.clientHeight));
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
  svg.setAttribute("preserveAspectRatio", "none");

  let contenido = `
    <defs>
      <marker id="mallaArrowRequirement" markerWidth="8" markerHeight="8"
        refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"
        viewBox="0 0 8 8">
        <path d="M 0.8 0.8 L 7 4 L 0.8 7.2 Z"
          class="malla-arrow-head is-requirement"></path>
      </marker>
      <marker id="mallaArrowCorequisite" markerWidth="8" markerHeight="8"
        refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"
        viewBox="0 0 8 8">
        <path d="M 0.8 0.8 L 7 4 L 0.8 7.2 Z"
          class="malla-arrow-head is-corequisite"></path>
      </marker>
    </defs>
  `;
  const rectangulos = new Map();
  const obstaculos = [];

  canvas.querySelectorAll("[data-malla-asignatura]").forEach((card) => {
    const rect = rectanguloRelativoMalla(card, canvasRect);
    const id = String(card.dataset.mallaAsignatura);
    rectangulos.set(id, rect);
    obstaculos.push({ id, ...expandirRectangulo(rect, 5) });
  });

  canvas
    .querySelectorAll(".malla-level-header, .malla-cycle-header")
    .forEach((heading, indice) => {
      obstaculos.push({
        id: `heading-${indice}`,
        ...expandirRectangulo(rectanguloRelativoMalla(heading, canvasRect), 5),
      });
    });

  const estado = contexto.estado;
  const relaciones = (
    estado.mallaAsignaturaSeleccionadaId
      ? estado.requisitosPlan.filter(
          (relacion) =>
            Number(relacion.asignaturaId) ===
              Number(estado.mallaAsignaturaSeleccionadaId) &&
            Number(relacion.requisitoAsignaturaId),
        )
      : []
  ).map((relacion) => ({
    origenId: String(relacion.requisitoAsignaturaId),
    destinoId: String(relacion.asignaturaId),
    tipo: relacion.tipo === "CORREQUISITO" ? "CORREQUISITO" : "REQUISITO",
  }));

  const rutas = calcularRutasTroncales({
    relaciones,
    rectangulos,
    obstaculos,
    ancho,
    alto,
  }).filter((ruta) => ruta.puntos.length >= 2);

  const paths = rutas.map((ruta) => ({
    ...ruta,
    d: construirPathTroncal(ruta.puntos, 7),
    claseTipo:
      ruta.tipo === "CORREQUISITO" ? "is-corequisite" : "is-requirement",
  }));

  contenido += paths
    .map(({ d }) => `<path d="${d}" class="malla-connection-halo"></path>`)
    .join("");
  contenido += paths
    .map(
      ({ d, clase, claseTipo, flecha }) => `
      <path d="${d}" class="malla-connection ${claseTipo} is-${clase}"
        ${
          flecha
            ? `marker-end="url(#${
                claseTipo === "is-corequisite"
                  ? "mallaArrowCorequisite"
                  : "mallaArrowRequirement"
              })"`
            : ""
        }>
      </path>
    `,
    )
    .join("");

  svg.innerHTML = contenido;
}

export function programarDibujoMalla(contexto) {
  if (!contexto || !contexto.estado) {
    throw new TypeError(
      "programarDibujoMalla requiere un contexto de Planes de Estudio válido con estado.",
    );
  }

  const estado = contexto.estado;

  if (estado.frameDibujoMalla !== null) {
    if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(estado.frameDibujoMalla);
    }
  }

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    estado.frameDibujoMalla = window.requestAnimationFrame(() => {
      estado.frameDibujoMalla = null;
      dibujarConexionesMalla(contexto);
    });
  } else {
    dibujarConexionesMalla(contexto);
  }
}

export function mostrarTarjetaMallaCompleta(card) {
  const scroll = document.getElementById("mallaScroll");
  if (!scroll) return;
  const tarjeta = card.getBoundingClientRect();
  const visible = scroll.getBoundingClientRect();
  const margen = 8;
  const ajuste =
    tarjeta.left < visible.left + margen
      ? tarjeta.left - visible.left - margen
      : tarjeta.right > visible.right - margen
      ? tarjeta.right - visible.right + margen
      : 0;
  if (ajuste) {
    scroll.scrollBy({ left: ajuste, behavior: "smooth" });
  }
}

export function actualizarEstadoVisualMalla(contexto) {
  const canvas = document.getElementById("mallaCanvas");

  if (!canvas) {
    return;
  }

  const estado = contexto.estado;
  const idsRuta = obtenerIdsRutaMalla(
    estado.mallaAsignaturaSeleccionadaId,
    estado.requisitosPlan,
  );
  const tiposRuta = obtenerTiposRutaMalla(
    estado.mallaAsignaturaSeleccionadaId,
    estado.requisitosPlan,
  );

  canvas.querySelectorAll("[data-malla-asignatura]").forEach((card) => {
    const id = Number(card.dataset.mallaAsignatura);
    const seleccionada = id === Number(estado.mallaAsignaturaSeleccionadaId);

    card.classList.toggle("is-selected", seleccionada);
    card.classList.toggle("is-route", !seleccionada && idsRuta.has(id));
    card.classList.toggle(
      "is-muted",
      Boolean(estado.mallaAsignaturaSeleccionadaId) && !idsRuta.has(id),
    );
    card.classList.toggle(
      "is-requirement",
      !seleccionada && Boolean(tiposRuta.get(id)?.has("REQUISITO")),
    );
    card.classList.toggle(
      "is-corequisite",
      !seleccionada && Boolean(tiposRuta.get(id)?.has("CORREQUISITO")),
    );
    card.setAttribute("aria-pressed", String(seleccionada));
  });

  const resumen = document.getElementById("mallaSeleccionResumen");
  if (resumen) {
    resumen.innerHTML = renderizarResumenSeleccionMalla(contexto);
  }

  programarDibujoMalla(contexto);
}
