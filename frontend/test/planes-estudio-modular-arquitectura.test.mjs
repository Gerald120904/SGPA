import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import {
  GRADOS_PLAN,
  TIPOS_OPTATIVA_PLAN,
  calcularCreditosAsignaturas,
  esAsistente,
  formatearGradoPlan,
  formatearTipoSalida,
  leerNumeroOpcional,
  normalizarNivelPaginaPlan,
  obtenerAsignaturasParaRequisitos,
  obtenerAsignaturasSalida,
  obtenerAsignaturasVisibles,
  obtenerAyudaTipoAsignatura,
  obtenerConteoOptativasPlan,
  obtenerConteoTipoOptativaSinAsignatura,
  obtenerContextoItemRevision,
  obtenerDatosAsignatura,
  obtenerEstadoCupoOptativa,
  obtenerEtiquetaAsignatura,
  obtenerIdsRutaMalla,
  obtenerNombreAnioNivel,
  obtenerNombreCiclo,
  obtenerPresentacionTipoAsignatura,
  obtenerPresentacionTipoOptativa,
  obtenerPuntoCorteSalida,
  obtenerRequisitosDeAsignatura,
  obtenerResumenHoras,
  obtenerSalidasEnPuntoCorte,
  obtenerTiposRutaMalla,
  ordenarAsignaturasMalla,
  rectanguloRelativoMalla,
  renderizarDatoResumen,
  renderizarEstadoCreditosSalida,
  renderizarEstadoGeneralRevision,
  renderizarGrupoRevision,
  separarAsignaturasPlan,
} from "../src/pages/planes-estudio/planes.helpers.js";

import { crearContextoPlanesEstudio } from "../src/pages/planes-estudio/planes-estudio.context.js";
import { PlanesEstudioPage, iniciarPlanesEstudioPage } from "../src/pages/planes-estudio/PlanesEstudioPage.js";
import { abrirFormularioPlan } from "../src/pages/planes-estudio/PlanFormDialog.js";
import { renderizarPlanes, alternarEstado, crearVersionDesdePlan, activarVersionDesdePlan } from "../src/pages/planes-estudio/PlanesListadoView.js";
import { renderizarTarjetaMalla, renderizarMallaCurricular, programarDibujoMalla, dibujarConexionesMalla } from "../src/pages/planes-estudio/PlanMallaCurricularView.js";
import { abrirFormularioAsignatura, abrirCargaRapida } from "../src/pages/planes-estudio/PlanAsignaturaDialog.js";
import {
  abrirFormularioRequisitos,
  abrirRequisitosRapidos,
  crearFilaRequisitoRapido,
  agregarFilaRequisitoRapido,
  eliminarFilaRequisitoRapido,
  construirRequisitosRapidos,
} from "../src/pages/planes-estudio/PlanRequisitosDialog.js";
import { abrirReglaOptativasPlan, recargarReglaOptativasPlan } from "../src/pages/planes-estudio/PlanReglaOptativasDialog.js";
import { abrirAdministradorSalidas, renderizarSalidasMalla } from "../src/pages/planes-estudio/PlanSalidasDialog.js";
import { seleccionarExcelParaPlan, descargarPlantillaPlan } from "../src/pages/planes-estudio/PlanImportacionDialog.js";
import { abrirRevisionPlan, abrirDetalleResumenPlan } from "../src/pages/planes-estudio/PlanRevisionDialog.js";
import { abrirComparadorPlanes, abrirTransicionCurricular, abrirBandejaConvalidacionesExternas } from "../src/pages/planes-estudio/PlanTransicionesDialog.js";
import { renderizarDetallePlan, conectarEventosDetallePlan, abrirDetallePlan } from "../src/pages/planes-estudio/PlanDetalleView.js";

test("Arquitectura modular: Todos los submódulos exportan sus contratos esperados", () => {
  assert.equal(typeof PlanesEstudioPage, "function");
  assert.equal(typeof iniciarPlanesEstudioPage, "function");
  assert.equal(typeof crearContextoPlanesEstudio, "function");
  assert.equal(typeof abrirFormularioPlan, "function");
  assert.equal(typeof renderizarPlanes, "function");
  assert.equal(typeof alternarEstado, "function");
  assert.equal(typeof crearVersionDesdePlan, "function");
  assert.equal(typeof activarVersionDesdePlan, "function");
  assert.equal(typeof renderizarTarjetaMalla, "function");
  assert.equal(typeof renderizarMallaCurricular, "function");
  assert.equal(typeof programarDibujoMalla, "function");
  assert.equal(typeof dibujarConexionesMalla, "function");
  assert.equal(typeof abrirFormularioAsignatura, "function");
  assert.equal(typeof abrirCargaRapida, "function");
  assert.equal(typeof abrirFormularioRequisitos, "function");
  assert.equal(typeof abrirRequisitosRapidos, "function");
  assert.equal(typeof abrirReglaOptativasPlan, "function");
  assert.equal(typeof recargarReglaOptativasPlan, "function");
  assert.equal(typeof abrirAdministradorSalidas, "function");
  assert.equal(typeof renderizarSalidasMalla, "function");
  assert.equal(typeof seleccionarExcelParaPlan, "function");
  assert.equal(typeof descargarPlantillaPlan, "function");
  assert.equal(typeof abrirRevisionPlan, "function");
  assert.equal(typeof abrirDetalleResumenPlan, "function");
  assert.equal(typeof abrirComparadorPlanes, "function");
  assert.equal(typeof abrirTransicionCurricular, "function");
  assert.equal(typeof abrirBandejaConvalidacionesExternas, "function");
  assert.equal(typeof renderizarDetallePlan, "function");
  assert.equal(typeof conectarEventosDetallePlan, "function");
  assert.equal(typeof abrirDetallePlan, "function");
});

test("Aislamiento e integridad: Ningún submódulo nuevo importa el archivo local protegido", () => {
  const dir = new URL("../src/pages/planes-estudio/", import.meta.url);
  const files = readdirSync(dir).filter(
    (file) => file.endsWith(".js") && file !== "planes-estudio.helpers.js",
  );

  for (const file of files) {
    const content = readFileSync(new URL(file, dir), "utf8");
    assert.doesNotMatch(
      content,
      /planes-estudio\.helpers/i,
      `El archivo ${file} no debe depender de planes-estudio.helpers.js`,
    );
  }
});

test("Limpieza arquitectónica: PlanesEstudioPage.js no contiene código muerto artificial ni listeners obsoletos", () => {
  const source = readFileSync(
    new URL("../src/pages/planes-estudio/PlanesEstudioPage.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /__auditoriaMallaRouting/, "No debe existir código artificial de auditoría");
  assert.doesNotMatch(source, /sincronizarDesdeContexto/, "No debe existir sincronización manual duplicada");
  assert.doesNotMatch(source, /sincronizarHaciaContexto/, "No debe existir sincronización manual duplicada");
  assert.doesNotMatch(source, /iniciarPlanesEstudioPage[\s\S]*?addEventListener\(["']resize["']/, "El listener de resize pertenece exclusivamente a PlanDetalleView");
  assert.match(source, /function renderizarDetallePlan\(\)\s*\{\s*return renderizarDetallePlanSubmodulo\(contextoPlanes, construirHandlersDetalle\(\)\);\s*\}/);
  assert.doesNotMatch(source, /function actualizarListaRequisitos\(/);
  assert.doesNotMatch(source, /function agregarRequisitoFrontend\(/);
  assert.doesNotMatch(source, /function eliminarRequisitoFrontend\(/);
  assert.match(source, /recargarRequisitosPlanSubmodulo\(contextoPlanes/);
});

test("Contexto de Planes de Estudio: Inicialización, tokens de concurrencia y ciclo de vida de controladores", () => {
  const ctx = crearContextoPlanesEstudio();

  assert.ok(ctx.estado);
  assert.deepEqual(ctx.estado.planes, []);
  assert.deepEqual(ctx.estado.carrerasDisponibles, []);
  assert.equal(ctx.estado.planSeleccionado, null);
  assert.equal(ctx.estado.vistaDetallePlan, "LISTA");

  const i1 = ctx.iniciarInstancia();
  assert.equal(i1.instancia, 1);
  assert.ok(i1.signal);
  assert.equal(i1.signal.aborted, false);

  const i2 = ctx.iniciarInstancia();
  assert.equal(i2.instancia, 2);
  assert.equal(i1.signal.aborted, true);
  assert.equal(i2.signal.aborted, false);

  const d1 = ctx.iniciarDetalleEventos();
  assert.ok(d1.signal);
  assert.equal(d1.signal.aborted, false);
  ctx.cancelarDetalleEventos();
  assert.equal(d1.signal.aborted, true);

  // Fuente única de verdad y reseteo
  ctx.estado.planSeleccionado = { id: 5, nombre: "Plan Test" };
  ctx.estado.asignaturasPlan = [{ id: 10, nombre: "Asignatura A" }];
  assert.equal(ctx.obtenerAsignaturaPorId(10).nombre, "Asignatura A");

  ctx.resetearDetalle();
  assert.equal(ctx.estado.planSeleccionado, null);
  assert.deepEqual(ctx.estado.asignaturasPlan, []);
});

test("Helpers puros: Cálculos de créditos, estados y separación activa/papelera", () => {
  const asignaturas = [
    { id: 1, activo: true, creditos: 4, curso: { nombre: "Calculo I", codigo: "MAT101" } },
    { id: 2, activo: true, creditos: 3, curso: { nombre: "Intro Progra", codigo: "EIF101" } },
    { id: 3, activo: false, creditos: 5, curso: { nombre: "Inactivo", codigo: "OLD101" } },
  ];

  const total = calcularCreditosAsignaturas(asignaturas);
  assert.equal(total, 12);

  const { activas, papelera } = separarAsignaturasPlan(asignaturas);
  assert.equal(activas.length, 2);
  assert.equal(papelera.length, 1);
  assert.equal(papelera[0].id, 3);
  assert.equal(calcularCreditosAsignaturas(activas), 7);

  const visibles = obtenerAsignaturasVisibles(asignaturas);
  assert.equal(visibles.length, 3);
});

test("Helpers puros: Clasificación de tipos y ayudas curriculares", () => {
  assert.equal(GRADOS_PLAN.BACHILLERATO, "Bachillerato");
  assert.equal(GRADOS_PLAN.LICENCIATURA, "Licenciatura");
  assert.ok(TIPOS_OPTATIVA_PLAN.DISCIPLINARIA);
  assert.ok(TIPOS_OPTATIVA_PLAN.ABIERTA);

  const tipo = obtenerPresentacionTipoAsignatura({ tipo: "OBLIGATORIA" });
  assert.equal(tipo.etiqueta, "Obligatoria");
  assert.equal(tipo.clase, "obligatoria");

  const resumen = renderizarDatoResumen("Horas Teóricas", 4);
  assert.match(resumen, /Horas Teóricas/);
  assert.match(resumen, /4/);
});

test("PlanRequisitosDialog: Gestión dinámica de filas y construcción de carga rápida", () => {
  const ctx = crearContextoPlanesEstudio();
  assert.equal(ctx.estado.filasRequisitosRapidos.length, 0);

  agregarFilaRequisitoRapido(ctx);
  assert.equal(ctx.estado.filasRequisitosRapidos.length, 1);
  const fila1 = ctx.estado.filasRequisitosRapidos[0];
  assert.equal(fila1.tipo, "REQUISITO");

  agregarFilaRequisitoRapido(ctx);
  assert.equal(ctx.estado.filasRequisitosRapidos.length, 2);

  eliminarFilaRequisitoRapido(ctx, fila1.id);
  assert.equal(ctx.estado.filasRequisitosRapidos.length, 1);

  // No permite eliminar la última fila restante
  eliminarFilaRequisitoRapido(ctx, ctx.estado.filasRequisitosRapidos[0].id);
  assert.equal(ctx.estado.filasRequisitosRapidos.length, 1);
});

test("PlanSalidasDialog: determina puntos de corte desde asignaturas asociadas del contrato", () => {
  const asignaturasPlan = [
    { id: 11, nivel: 1, ciclo: 2, orden: 1 },
    { id: 12, nivel: 2, ciclo: 1, orden: 1 },
    { id: 13, nivel: 2, ciclo: 2, orden: 1 },
  ];
  const puntoCorteOriginal = (salida) => {
    const ultima = salida.asignaturas
      .filter((asignatura) => Number.isFinite(Number(asignatura.nivel)) && Number.isFinite(Number(asignatura.ciclo)))
      .slice()
      .sort((a, b) => Number(a.nivel) - Number(b.nivel) || Number(a.ciclo) - Number(b.ciclo) || Number(a.orden || 0) - Number(b.orden || 0))
      .at(-1);
    return ultima ? { nivel: Number(ultima.nivel), ciclo: Number(ultima.ciclo) } : null;
  };
  const salidas = [
    { id: 1, nombre: "Salida Lateral", activo: true, asignaturas: [asignaturasPlan[0], asignaturasPlan[1]] },
    { id: 2, nombre: "Salida Profesional", activo: true, asignaturas: [asignaturasPlan[2]] },
    { id: 3, nombre: "Sin asignaturas", nivel: 4, ciclo: 2, activo: true, asignaturas: [] },
    { id: 4, nombre: "Datos nulos", asignaturas: [{ nivel: null, ciclo: null }] },
    { id: 5, nombre: "Nivel nulo", asignaturas: [{ nivel: null, ciclo: 1 }] },
    { id: 6, nombre: "Ciclo nulo", asignaturas: [{ nivel: 1, ciclo: null }] },
    { id: 7, nombre: "Datos ausentes", asignaturas: [{ nivel: undefined, ciclo: undefined }] },
    { id: 8, nombre: "Cadena vacía", asignaturas: [{ nivel: "", ciclo: " " }] },
  ];

  assert.deepEqual(obtenerPuntoCorteSalida(salidas[0], asignaturasPlan), { nivel: 2, ciclo: 1 });
  assert.deepEqual(obtenerPuntoCorteSalida(salidas[1], asignaturasPlan), { nivel: 2, ciclo: 2 });
  assert.deepEqual(obtenerPuntoCorteSalida(salidas[0], asignaturasPlan), puntoCorteOriginal(salidas[0]));
  assert.deepEqual(obtenerPuntoCorteSalida(salidas[1], asignaturasPlan), puntoCorteOriginal(salidas[1]));
  for (const salida of salidas.slice(2)) {
    assert.equal(obtenerPuntoCorteSalida(salida, asignaturasPlan), null, salida.nombre);
  }

  const enPunto = obtenerSalidasEnPuntoCorte(2, 1, salidas, asignaturasPlan);
  assert.deepEqual(enPunto.map((salida) => salida.id), [1]);
  assert.deepEqual(obtenerSalidasEnPuntoCorte(3, 1, salidas, asignaturasPlan), []);
});

test("PlanesEstudioPage HTML shell: Genera estructura base con breadcrumb, filtros y contenedores", () => {
  const html = PlanesEstudioPage();
  assert.match(html, /id="planesEstudioPage"/);
  assert.match(html, /id="planesContent"/);
  assert.match(html, /id="planesBuscar"/);
  assert.match(html, /id="planesEstado"/);
  assert.match(html, /id="planesCarrera"/);
  assert.match(html, /id="comparadorPlanesButton"/);
  assert.match(html, /id="transicionCurricularButton"/);
  assert.match(html, /id="planDialog"/);
  assert.match(html, /id="comparadorPlanesDialog"/);
  assert.match(html, /id="transicionCurricularDialog"/);
  assert.match(html, /id="convalidacionesExternasDialog"/);
});
