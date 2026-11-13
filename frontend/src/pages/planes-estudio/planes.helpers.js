/**
 * SGPA — Helpers puros y funciones de cálculo para Planes de Estudio.
 *
 * Centraliza constantes, validaciones, cálculos curriculares,
 * formateadores y transformadores de datos sin acoplamiento a estado mutable.
 */

import { usuarioTienePermiso, obtenerRolActivo } from "../../app/session.js";
import { PERMISOS, ROLES } from "../../config/permissions.js";
import { escapeHtml } from "../../utils/html.js";

export const GRADOS_PLAN = {
  DIPLOMADO: "Diplomado",
  BACHILLERATO: "Bachillerato",
  LICENCIATURA: "Licenciatura",
  MAESTRIA: "Maestría",
  OTRO: "Otro",
};

export const MIN_CREDITOS_ASIGNATURA = 1;
export const MAX_CREDITOS_ASIGNATURA = 6;
export const MAX_ORDEN_ASIGNATURA = 200;
export const MAX_NOMBRE_ASIGNATURA = 120;
export const MAX_ESPACIOS_OPTATIVOS_REGLA = 200;

export const TIPOS_OPTATIVA_PLAN = {
  DISCIPLINARIA: {
    etiqueta: "Disciplinaria / de carrera",
    detalle: "Espacio optativo propio de la carrera, limitado por la regla del plan.",
    clase: "disciplinaria",
  },
  ABIERTA: {
    etiqueta: "Abierta / otra área",
    detalle: "Espacio optativo abierto, limitado de forma independiente por la regla del plan.",
    clase: "abierta",
  },
  SEDE: {
    etiqueta: "De sede / otra área",
    detalle: "Espacio optativo de sede, limitado de forma independiente por la regla del plan.",
    clase: "sede",
  },
};

export function obtenerPresentacionTipoOptativa(tipoOptativa) {
  const codigo = String(tipoOptativa || "").toUpperCase();

  return (
    TIPOS_OPTATIVA_PLAN[codigo] || {
      etiqueta: "Genérica",
      detalle: "La categoría se determina por la optativa real reconocida al estudiante.",
      clase: "sin-clasificar",
    }
  );
}

export function obtenerConteoOptativasPlan(asignaturasPlan = []) {
  const optativas = asignaturasPlan.filter(
    (asignatura) =>
      asignatura.activo !== false &&
      String(asignatura.tipo || "").toUpperCase() === "OPTATIVA",
  );

  const disciplinarias = optativas.filter(
    (asignatura) =>
      String(asignatura.tipoOptativa || "").toUpperCase() === "DISCIPLINARIA",
  ).length;

  const abiertas = optativas.filter(
    (asignatura) =>
      String(asignatura.tipoOptativa || "").toUpperCase() === "ABIERTA",
  ).length;

  const sede = optativas.filter(
    (asignatura) =>
      String(asignatura.tipoOptativa || "").toUpperCase() === "SEDE",
  ).length;

  const sinClasificar = optativas.filter(
    (asignatura) => !String(asignatura.tipoOptativa || "").trim(),
  ).length;

  return {
    total: optativas.length,
    disciplinarias,
    abiertas,
    sede,
    otrasAreas: abiertas + sede,
    sinClasificar,
  };
}

export function obtenerReglaOptativasActual(reglaOptativasPlan) {
  return reglaOptativasPlan?.regla || null;
}

export function obtenerLimiteReglaOptativa(tipoOptativa, reglaOptativasPlan) {
  const regla = obtenerReglaOptativasActual(reglaOptativasPlan);

  if (!regla) {
    return null;
  }

  const tipo = String(tipoOptativa || "").toUpperCase();

  if (tipo === "DISCIPLINARIA") {
    return Number(regla.cantidadDisciplinarias || 0);
  }

  if (tipo === "ABIERTA") {
    return Number(regla.cantidadAbiertas || 0);
  }

  if (tipo === "SEDE") {
    return Number(regla.cantidadSede || 0);
  }

  return null;
}

export function obtenerConteoTipoOptativaSinAsignatura(
  tipoOptativa,
  asignaturasPlan = [],
  excluirId = null,
) {
  const tipo = String(tipoOptativa || "").toUpperCase();

  return asignaturasPlan.filter(
    (asignatura) =>
      asignatura.activo !== false &&
      Number(asignatura.id) !== Number(excluirId) &&
      String(asignatura.tipo || "").toUpperCase() === "OPTATIVA" &&
      String(asignatura.tipoOptativa || "").toUpperCase() === tipo,
  ).length;
}

export function obtenerEstadoCupoOptativa(
  tipoOptativa,
  reglaOptativasPlan,
  asignaturasPlan = [],
  excluirId = null,
) {
  const tipo = String(tipoOptativa || "").toUpperCase();
  const presentacion = obtenerPresentacionTipoOptativa(tipo);
  const regla = obtenerReglaOptativasActual(reglaOptativasPlan);

  if (!regla) {
    return {
      configurada: false,
      limite: 0,
      actuales: obtenerConteoTipoOptativaSinAsignatura(tipo, asignaturasPlan, excluirId),
      disponibles: 0,
      bloqueada: true,
      etiqueta: presentacion.etiqueta,
    };
  }

  const limite = Number(obtenerLimiteReglaOptativa(tipo, reglaOptativasPlan) || 0);
  const actuales = obtenerConteoTipoOptativaSinAsignatura(tipo, asignaturasPlan, excluirId);

  return {
    configurada: true,
    limite,
    actuales,
    disponibles: Math.max(0, limite - actuales),
    bloqueada: actuales >= limite,
    etiqueta: presentacion.etiqueta,
  };
}

export function validarCupoOptativaFrontend(
  tipo,
  tipoOptativa,
  reglaOptativasPlan,
  asignaturasPlan = [],
  asignaturaActual = null,
) {
  if (String(tipo || "").toUpperCase() !== "OPTATIVA") {
    return null;
  }

  if (asignaturaActual?.activo === false) {
    return null;
  }

  const regla = obtenerReglaOptativasActual(reglaOptativasPlan);

  if (!regla) {
    return (
      "Antes de agregar asignaturas optativas debe configurar la Regla de optativas del plan. " +
      "Defina cuántas optativas disciplinarias, abiertas y de sede tendrá el plan."
    );
  }

  const limite =
    Number(regla.cantidadDisciplinarias || 0) +
    Number(regla.cantidadAbiertas || 0) +
    Number(regla.cantidadSede || 0);
  const actuales = asignaturasPlan.filter(
    (item) =>
      item.activo !== false &&
      item.tipo === "OPTATIVA" &&
      Number(item.id) !== Number(asignaturaActual?.id ?? -1),
  ).length;

  if (actuales >= limite) {
    return `El plan ya alcanzó los ${limite} espacios optativos.`;
  }
  return null;
}

export function validarCargaRapidaOptativas(asignaturas, reglaOptativasPlan, asignaturasPlan = []) {
  const optativas = asignaturas.filter(
    (asignatura) => String(asignatura.tipo || "").toUpperCase() === "OPTATIVA",
  );

  if (!optativas.length) {
    return;
  }

  const regla = obtenerReglaOptativasActual(reglaOptativasPlan);

  if (!regla) {
    throw new Error(
      "Antes de cargar asignaturas optativas debe configurar la Regla de optativas del plan.",
    );
  }

  const limite =
    Number(regla.cantidadDisciplinarias || 0) +
    Number(regla.cantidadAbiertas || 0) +
    Number(regla.cantidadSede || 0);
  if (obtenerConteoOptativasPlan(asignaturasPlan).total + optativas.length > limite) {
    throw new Error(`La carga supera los ${limite} espacios optativos del plan.`);
  }
}

export function formatearGradoPlan(grado) {
  return GRADOS_PLAN[grado] || grado || "—";
}

export function puedeGestionarPlanes(_detalle = false) {
  return usuarioTienePermiso(PERMISOS.PLANES_ESTUDIO_GESTIONAR);
}

export const esAsistente = () => obtenerRolActivo() === ROLES.ASISTENTE_ESTUDIANTIL;
export const esCuentaJerarquica = () => {
  const rol = obtenerRolActivo();
  return rol === ROLES.COORDINADOR || rol === ROLES.ASISTENTE_ESTUDIANTIL;
};

export function obtenerDatosAsignatura(asignatura) {
  return {
    codigo: asignatura?.codigoReferencia || asignatura?.curso?.codigo || "",
    nombre:
      asignatura?.nombreReferencia || asignatura?.curso?.nombre || "Sin nombre",
  };
}

export function obtenerEtiquetaAsignatura(asignatura) {
  const datos = obtenerDatosAsignatura(asignatura);
  const codigo = datos.codigo || asignatura?.codigoReferencia || "SIN CÓDIGO";
  const nombre = datos.nombre || asignatura?.nombreReferencia || "Sin nombre";

  return `${codigo} - ${nombre}`;
}

export function obtenerPresentacionTipoAsignatura(asignatura) {
  const tipo = String(asignatura?.tipo || "OBLIGATORIA").toUpperCase();

  if (tipo === "OPTATIVA") {
    const optativa = obtenerPresentacionTipoOptativa(asignatura?.tipoOptativa);

    return {
      etiqueta: `Optativa · ${optativa.etiqueta}`,
      detalle: optativa.detalle,
      clase: "optativa",
    };
  }

  const presentaciones = {
    OBLIGATORIA: {
      etiqueta: "Obligatoria",
      detalle: "Materia concreta del plan",
      clase: "obligatoria",
    },
    GENERAL: {
      etiqueta: "Estudios generales",
      detalle: "Espacio de Estudios Generales",
      clase: "general",
    },
    OTRA: {
      etiqueta: "Otra",
      detalle: "Espacio curricular especial",
      clase: "otra",
    },
  };

  return (
    presentaciones[tipo] || {
      etiqueta: tipo,
      detalle: "Tipo curricular",
      clase: "otra",
    }
  );
}

export function obtenerAyudaTipoAsignatura(tipo) {
  const ayudas = {
    OBLIGATORIA:
      "Materia concreta del plan. Después puede incorporarse o vincularse al catálogo institucional de Cursos.",
    GENERAL:
      "Espacio curricular de Estudios Generales. No se convierte directamente en un Curso institucional desde el flujo normal de Cursos.",
    OPTATIVA:
      "Espacio optativo genérico. La categoría se determina por la asignatura real reconocida al estudiante y se valida contra la regla del plan.",
    OTRA:
      "Utilice este tipo para un espacio curricular especial que no corresponda a obligatoria, general u optativa.",
  };

  return ayudas[String(tipo || "OBLIGATORIA").toUpperCase()] || ayudas.OTRA;
}

export function obtenerAsignaturasParaRequisitos(asignaturasPlan = []) {
  return asignaturasPlan
    .filter((asignatura) => asignatura.activo)
    .slice()
    .sort(
      (a, b) =>
        Number(a.nivel) - Number(b.nivel) ||
        Number(a.ciclo) - Number(b.ciclo) ||
        Number(a.orden) - Number(b.orden),
    );
}

export function leerNumeroOpcional(id) {
  const input = document.getElementById(id);

  if (!input) {
    return undefined;
  }

  const valor = input.value.trim();

  if (valor === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isNaN(numero) ? null : numero;
}

export function obtenerResumenHoras(asignatura) {
  const partes = [];
  const agregar = (etiqueta, valor) => {
    if (valor !== null && valor !== undefined) {
      partes.push(`${etiqueta} ${valor}`);
    }
  };

  agregar("T", asignatura.horasTeoria);
  agregar("P", asignatura.horasPractica);
  agregar("L", asignatura.horasLaboratorio);
  agregar("G", asignatura.horasGira);
  agregar("EI", asignatura.horasEstudioIndependiente);
  agregar("HT", asignatura.horasTotales);
  agregar("HD", asignatura.horasDocente);

  return partes.join(" · ");
}

export function obtenerRequisitosDeAsignatura(asignaturaId, requisitosPlan = []) {
  return requisitosPlan.filter(
    (relacion) => Number(relacion.asignaturaId) === Number(asignaturaId),
  );
}

export function obtenerAsignaturasVisibles(asignaturasPlan = []) {
  return asignaturasPlan;
}

export function separarAsignaturasPlan(asignaturas = []) {
  return {
    activas: asignaturas.filter((asignatura) => asignatura.activo !== false),
    papelera: asignaturas.filter((asignatura) => asignatura.activo === false),
  };
}

export function ordenarAsignaturasMalla(asignaturas = []) {
  return asignaturas.slice().sort(
    (a, b) =>
      Number(b.activo !== false) - Number(a.activo !== false) ||
      Number(a.orden) - Number(b.orden),
  );
}

export function agruparAsignaturas(asignaturas = []) {
  const grupos = new Map();

  for (const asignatura of asignaturas) {
    const clave = `${asignatura.nivel}-${asignatura.ciclo}`;

    if (!grupos.has(clave)) {
      grupos.set(clave, {
        nivel: asignatura.nivel,
        ciclo: asignatura.ciclo,
        asignaturas: [],
      });
    }

    grupos.get(clave).asignaturas.push(asignatura);
  }

  return Array.from(grupos.values())
    .map((grupo) => ({
      ...grupo,
      asignaturas: ordenarAsignaturasMalla(grupo.asignaturas),
    }))
    .sort((a, b) => a.nivel - b.nivel || a.ciclo - b.ciclo);
}

export function obtenerNombreAnioNivel(nivel) {
  const nombres = {
    1: "Primer año",
    2: "Segundo año",
    3: "Tercer año",
    4: "Cuarto año",
  };

  return nombres[Number(nivel)] || `Nivel ${nivel}`;
}

export function obtenerNombreCiclo(ciclo) {
  const nombres = {
    1: "Ciclo I",
    2: "Ciclo II",
  };

  return nombres[Number(ciclo)] || `Ciclo ${ciclo}`;
}

export function calcularCreditosAsignaturas(asignaturas = []) {
  return asignaturas.reduce(
    (total, asignatura) => total + Number(asignatura.creditos || 0),
    0,
  );
}

export function normalizarNivelPaginaPlan(nivel, maxNiveles = 4) {
  const normalizado = Number(nivel) || 1;
  return Math.min(Math.max(1, normalizado), Math.max(1, maxNiveles));
}

export function formatearTipoSalida(tipo) {
  const tipos = {
    ENFASIS: "Énfasis",
    SALIDA_LATERAL: "Salida lateral",
    CERTIFICADO: "Certificado",
    OTRO: "Otro",
  };

  return tipos[tipo] || tipo || "—";
}

export function obtenerAsignaturasSalida(salida, asignaturasPlan = []) {
  if (!salida || !Array.isArray(salida.asignaturas)) {
    return [];
  }

  return salida.asignaturas
    .map((asignatura) => {
      const id = Number(asignatura?.id);
      if (!Number.isFinite(id)) {
        return asignatura;
      }

      return (
        asignaturasPlan.find((item) => Number(item.id) === id) || asignatura
      );
    })
    .filter(Boolean);
}

export function obtenerCreditosAsociadosSalida(salida, asignaturasPlan = []) {
  return obtenerAsignaturasSalida(salida, asignaturasPlan)
    .filter((asignatura) => asignatura.activo !== false)
    .reduce(
      (total, asignatura) => total + Number(asignatura.creditos || 0),
      0,
    );
}

function esNumeroCurricularValido(valor) {
  return (
    valor !== null &&
    valor !== undefined &&
    !(typeof valor === "string" && valor.trim() === "") &&
    Number.isFinite(Number(valor))
  );
}

export function obtenerPuntoCorteSalida(salida, asignaturasPlan = []) {
  const asignaturas = obtenerAsignaturasSalida(salida, asignaturasPlan)
    .filter(
      (asignatura) =>
        esNumeroCurricularValido(asignatura.nivel) &&
        esNumeroCurricularValido(asignatura.ciclo),
    )
    .slice()
    .sort(
      (a, b) =>
        Number(a.nivel) - Number(b.nivel) ||
        Number(a.ciclo) - Number(b.ciclo) ||
        Number(a.orden || 0) - Number(b.orden || 0),
    );

  const ultima = asignaturas.at(-1);

  if (ultima) {
    return {
      nivel: Number(ultima.nivel),
      ciclo: Number(ultima.ciclo),
    };
  }

  return null;
}

export function obtenerSalidasEnPuntoCorte(nivel, ciclo, salidasAcademicas = [], asignaturasPlan = []) {
  const listaSalidas = Array.isArray(salidasAcademicas) ? salidasAcademicas : [];

  return listaSalidas
    .filter((salida) => salida && salida.activo !== false)
    .filter((salida) => {
      const corte = obtenerPuntoCorteSalida(salida, asignaturasPlan);
      return (
        corte &&
        corte.nivel === Number(nivel) &&
        corte.ciclo === Number(ciclo)
      );
    })
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
}

export function renderizarEstadoCreditosSalida(salida, asignaturasPlan = []) {
  const asociados = obtenerCreditosAsociadosSalida(salida, asignaturasPlan);
  const requeridos = Number(salida.creditosRequeridos || 0);
  const completa = requeridos > 0 && asociados >= requeridos;

  return {
    asociados,
    requeridos,
    completa,
    porcentaje:
      requeridos > 0 ? Math.min(100, (asociados / requeridos) * 100) : 0,
  };
}

export function obtenerRelacionesRutaSeleccionada(mallaAsignaturaSeleccionadaId, requisitosPlan = []) {
  const seleccionadaId = Number(mallaAsignaturaSeleccionadaId);

  if (!seleccionadaId) {
    return [];
  }

  return requisitosPlan.filter(
    (relacion) =>
      Number(relacion.asignaturaId) === seleccionadaId &&
      Number(relacion.requisitoAsignaturaId),
  );
}

export function obtenerRelacionesMallaVisibles(mallaAsignaturaSeleccionadaId, requisitosPlan = []) {
  return obtenerRelacionesRutaSeleccionada(mallaAsignaturaSeleccionadaId, requisitosPlan);
}

export function obtenerIdsRutaMalla(mallaAsignaturaSeleccionadaId, requisitosPlan = []) {
  const ids = new Set();

  if (mallaAsignaturaSeleccionadaId) {
    ids.add(Number(mallaAsignaturaSeleccionadaId));
  }

  for (const relacion of obtenerRelacionesRutaSeleccionada(mallaAsignaturaSeleccionadaId, requisitosPlan)) {
    ids.add(Number(relacion.requisitoAsignaturaId));
    ids.add(Number(relacion.asignaturaId));
  }

  return ids;
}

export function obtenerTiposRutaMalla(mallaAsignaturaSeleccionadaId, requisitosPlan = []) {
  const tiposPorAsignatura = new Map();

  for (const relacion of obtenerRelacionesRutaSeleccionada(mallaAsignaturaSeleccionadaId, requisitosPlan)) {
    const id = Number(relacion.requisitoAsignaturaId);
    if (!tiposPorAsignatura.has(id)) {
      tiposPorAsignatura.set(id, new Set());
    }
    tiposPorAsignatura.get(id).add(
      relacion.tipo === "CORREQUISITO" ? "CORREQUISITO" : "REQUISITO",
    );
  }

  return tiposPorAsignatura;
}

export function agruparMallaPorNivel(asignaturas = []) {
  const grupos = agruparAsignaturas(asignaturas);
  const niveles = new Map();

  for (const grupo of grupos) {
    const nivel = Number(grupo.nivel);

    if (!niveles.has(nivel)) {
      niveles.set(nivel, {
        nivel,
        ciclos: new Map(),
      });
    }

    niveles.get(nivel).ciclos.set(Number(grupo.ciclo), grupo.asignaturas);
  }

  return Array.from(niveles.values()).sort((a, b) => a.nivel - b.nivel);
}

export function obtenerAsignaturaMallaSeleccionada(mallaAsignaturaSeleccionadaId, asignaturasPlan = []) {
  return asignaturasPlan.find(
    (asignatura) =>
      Number(asignatura.id) === Number(mallaAsignaturaSeleccionadaId),
  );
}

export function rectanguloRelativoMalla(elemento, contenedor) {
  const elementoRect = elemento.getBoundingClientRect();
  const contenedorRect = contenedor.getBoundingClientRect();

  return {
    left: elementoRect.left - contenedorRect.left + contenedor.scrollLeft,
    top: elementoRect.top - contenedorRect.top + contenedor.scrollTop,
    right: elementoRect.right - contenedorRect.left + contenedor.scrollLeft,
    bottom: elementoRect.bottom - contenedorRect.top + contenedor.scrollTop,
    width: elementoRect.width,
    height: elementoRect.height,
  };
}

export function renderizarEstadoGeneralRevision(validacion) {
  const valido = validacion?.valido === true;
  const advertencias = Number(validacion?.totalAdvertencias || 0);

  if (!valido) {
    return `<div class="plan-review-status plan-review-status-error"><i data-lucide="circle-x"></i><div><strong>El plan presenta errores</strong><p>Hay inconsistencias que deben corregirse antes de considerar completa la configuración.</p></div></div>`;
  }

  if (advertencias > 0) {
    return `<div class="plan-review-status plan-review-status-warning"><i data-lucide="triangle-alert"></i><div><strong>El plan no presenta errores críticos</strong><p>Se encontraron ${advertencias} advertencia${advertencias === 1 ? "" : "s"} para revisar.</p></div></div>`;
  }

  return '<div class="plan-review-status plan-review-status-ok"><i data-lucide="circle-check-big"></i><div><strong>Revisión completada</strong><p>No se detectaron errores ni advertencias automáticas.</p></div></div>';
}

export function formatearCodigoValidacion(codigo) {
  const nombres = {
    ASIGNATURA_SIN_NOMBRE: "Asignatura sin nombre curricular",
    ASIGNATURA_SIN_CODIGO: "Asignatura sin código curricular",
    CODIGO_ASIGNATURA_DUPLICADO: "Código curricular duplicado",
    HORAS_NO_COINCIDEN: "Horas inconsistentes",
    OPTATIVA_SIN_CLASIFICAR: "Optativa sin clasificar",
    REGLA_OPTATIVAS_NO_CONFIGURADA: "Regla de optativas no configurada",
    CANTIDAD_OPTATIVAS_DISCIPLINARIAS_NO_CUMPLIDA: "Cantidad de optativas disciplinarias",
    CANTIDAD_OPTATIVAS_ABIERTAS_NO_CUMPLIDA: "Cantidad de optativas abiertas",
    CANTIDAD_OPTATIVAS_SEDE_NO_CUMPLIDA: "Cantidad de optativas de sede",
    CURSO_DUPLICADO: "Curso duplicado",
    REQUISITO_POSTERIOR: "Requisito posterior",
    REQUISITO_INACTIVO: "Requisito inactivo",
    CICLO_REQUISITOS: "Ciclo de requisitos",
    SALIDA_SIN_ASIGNATURAS: "Salida académica vacía",
    CREDITOS_SALIDA_NO_COINCIDEN: "Créditos de salida",
  };

  return nombres[codigo] || codigo?.replaceAll("_", " ") || "Validación";
}

export function obtenerSugerenciaRevision(codigo) {
  const sugerencias = {
    ASIGNATURA_SIN_NOMBRE: "Revise el nombre curricular registrado para esta asignatura.",
    ASIGNATURA_SIN_CODIGO: "Revise el código curricular registrado para esta asignatura.",
    CODIGO_ASIGNATURA_DUPLICADO: "Revise los códigos de las asignaturas activas del plan y corrija el duplicado.",
    HORAS_NO_COINCIDEN: "Compare las horas totales con la suma de teoría, práctica, laboratorio, gira y estudio independiente.",
    OPTATIVA_SIN_CLASIFICAR: "Clasifique la optativa como disciplinaria, abierta o de sede.",
    REGLA_OPTATIVAS_NO_CONFIGURADA: "Revise la cantidad y clasificación de optativas activas y configure la regla del plan.",
    CANTIDAD_OPTATIVAS_DISCIPLINARIAS_NO_CUMPLIDA: "Compare la cantidad disciplinaria configurada con las asignaturas optativas activas de esa clasificación.",
    CANTIDAD_OPTATIVAS_ABIERTAS_NO_CUMPLIDA: "Compare la cantidad abierta configurada con las asignaturas optativas activas de esa clasificación.",
    CANTIDAD_OPTATIVAS_SEDE_NO_CUMPLIDA: "Compare la cantidad de sede configurada con las asignaturas optativas activas de esa clasificación.",
    REQUISITO_INACTIVO: "Revise el estado de la asignatura y de la relación de requisito asociada.",
    REQUISITO_POSTERIOR: "Revise la ubicación por nivel y ciclo del requisito y la relación registrada.",
    CICLO_REQUISITOS: "Revise las relaciones de requisitos del plan y elimine la dependencia circular.",
    SALIDA_SIN_ASIGNATURAS: "Revise las materias activas asociadas a esta salida académica.",
    CREDITOS_SALIDA_NO_COINCIDEN: "Compare los créditos requeridos con los créditos de las materias activas asociadas.",
  };

  return sugerencias[codigo] || "Revise la regla académica indicada y los datos relacionados en el plan.";
}

export function obtenerContextoItemRevision(
  item,
  asignaturas = [],
  salidas = [],
) {
  const asignatura = item?.asignaturaId
    ? asignaturas.find((registro) => Number(registro.id) === Number(item.asignaturaId))
    : null;
  const salida = item?.salidaId
    ? salidas.find((registro) => Number(registro.id) === Number(item.salidaId))
    : null;
  return asignatura
    ? obtenerDatosAsignatura(asignatura).nombre
    : salida?.nombre || null;
}

export function renderizarItemRevision(item, tipo, contexto = obtenerContextoItemRevision(item)) {
  const esError = tipo === "ERROR";
  return `
    <article class="plan-review-item ${esError ? "is-error" : "is-warning"}">
      <div class="plan-review-item-icon"><i data-lucide="${esError ? "circle-x" : "triangle-alert"}"></i></div>
      <div class="plan-review-item-content">
        <strong>${escapeHtml(formatearCodigoValidacion(item.codigo))}</strong>
        ${contexto ? `<small>Elemento relacionado: ${escapeHtml(contexto)}</small>` : ""}
        <p>${escapeHtml(item.mensaje || "Inconsistencia detectada.")}</p>
        <p class="plan-review-item-guidance"><strong>Qué revisar:</strong> ${escapeHtml(obtenerSugerenciaRevision(item.codigo))}</p>
      </div>
    </article>`;
}

export function renderizarGrupoRevision(titulo, descripcion, items, tipo) {
  return `
    <section class="plan-review-group">
      <header><div><strong>${escapeHtml(titulo)}</strong><small>${escapeHtml(descripcion)}</small></div><span>${items.length}</span></header>
      <div class="plan-review-list">${items.map((item) => renderizarItemRevision(item, tipo)).join("")}</div>
    </section>`;
}

export function renderizarDatoResumen(nombre, valor) {
  return `<div class="plan-summary-hour"><span>${escapeHtml(nombre)}</span><strong>${Number(valor || 0)}</strong></div>`;
}
